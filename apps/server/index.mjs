import http from 'node:http';
import crypto from 'node:crypto';
import { Server } from 'socket.io';
import {
  VERSION, RULES, SPAWNS, EXITS, CASES, CABINETS, COINS, ITEMS, DRONE_ROUTES, COLORS, FLY_SOLIDS,
  canSee, lineOfSight, move, route, clamp, caseReach, cabinetReach, interactPoint, angleDiff, roomAt, blocked,
} from '@hapai/shared';

const PORT = process.env.PORT || 10000;
const origins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim()).filter(Boolean);
const TICK = 30, SEND_EVERY = 2;
// только для тестов/записи трейлера: укороченный раунд
if (process.env.ROUND_SECONDS) RULES.round = Math.max(40, +process.env.ROUND_SECONDS || RULES.round);
const rooms = new Map(), sessions = new Map();
const now = () => performance.now() / 1000;
const BOT_NAMES = ['Лис', 'Бонни', 'Шустрый', 'Тень', 'Котя', 'Барон', 'Пиксель'];

const httpServer = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const path = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';
  if (path === '/health' || path === '/') res.end(JSON.stringify({ ok: true, game: 'HAPAI', version: VERSION }));
  else if (path === '/stats') res.end(JSON.stringify({ rooms: rooms.size, connections: io.engine.clientsCount }));
  else { res.writeHead(404); res.end('{"error":"not found"}'); }
});
const io = new Server(httpServer, {
  cors: { origin: origins },
  allowRequest: (req, cb) => cb(null, !req.headers.origin || origins.includes(req.headers.origin)),
  maxHttpBufferSize: 4096, pingInterval: 10000, pingTimeout: 8000,
});

// ---------- комнаты и игроки
function newRoom() {
  let code; do code = crypto.randomBytes(3).toString('hex').toUpperCase(); while (rooms.has(code));
  const r = { code, owner: null, players: new Map(), phase: 'lobby', time: RULES.round, started: 0, countdownAt: 0, cases: [], coins: [], sacks: [], drones: [], alarms: [], feed: [], events: [], activeExit: 0, exitOrder: [0, 1, 2, 3], born: now(), seq: 0 };
  rooms.set(code, r); return r;
}
function freeColor(r) { const used = new Set([...r.players.values()].map(p => p.color)); return COLORS.find(c => !used.has(c)) || COLORS[r.players.size % COLORS.length]; }
function makePlayer(r, id, name, bot = false) {
  const s = SPAWNS[r.players.size % SPAWNS.length];
  return { id, name, color: freeColor(r), x: s.x, z: s.z, angle: Math.PI / 2, bag: 0, loot: [], score: 0, stats: blankStats(), input: { x: 0, z: 0, angle: Math.PI / 2 }, interact: false, action: null, dashUntil: 0, dashReady: 0, pushReady: 0, pushAt: 0, stun: 0, caughtAt: 0, immune: 0, hideReady: 0, bot, connected: true, ready: bot, lastInput: now(), brain: bot ? { repath: 0, path: [], goal: null } : null };
}
const blankStats = () => ({ stolen: 0, delivered: 0, pushes: 0, caught: 0, hides: 0, items: 0 });
function notify(r, text, kind = 'info') { r.feed.unshift({ id: ++r.seq, text, kind, at: now() }); r.feed = r.feed.slice(0, 5); }
function emitEvent(r, e) { r.events.push({ ...e, id: ++r.seq }); }

function begin(r) {
  r.phase = 'countdown'; r.countdownAt = now() + 3.5; r.time = RULES.round;
  r.cases = CASES.map(c => ({ id: c.id, item: c.item, empty: false, progress: 0, restockAt: 0, alarmAt: -99 }));
  r.coins = COINS.map(([x, z], i) => ({ id: `coin-${i}`, x, z, value: 5, respawnAt: 0, taken: false }));
  r.sacks = []; r.alarms = []; r.events = []; r.feed = [];
  r.drones = DRONE_ROUTES.map((rt, i) => ({ id: `drone-${i}`, x: rt[0][0], z: rt[0][1], angle: 0, state: 'patrol', route: i, wp: 1, path: [], target: null, lastSeen: null, until: 0, repath: 0, speed: 0 }));
  r.exitOrder = [0, 1, 3].sort(() => Math.random() - .5); r.exitOrder.push(2);
  r.activeExit = r.exitOrder[0];
  let i = 0;
  for (const p of r.players.values()) {
    const s = SPAWNS[i++ % SPAWNS.length];
    Object.assign(p, { x: s.x, z: s.z, angle: Math.PI / 2, bag: 0, loot: [], score: 0, stats: blankStats(), action: null, interact: false, dashUntil: 0, dashReady: 0, pushReady: 0, stun: 0, immune: 0, hideReady: 0, input: { x: 0, z: 0, angle: Math.PI / 2 } });
    if (p.brain) p.brain = { repath: 0, path: [], goal: null };
  }
}

// ---------- действия
function cancelAction(r, p) {
  if (p.action?.type === 'hide') return; // из шкафа не выдернуть
  p.action = null;
}
function dropLoot(r, p, amount, x = p.x, z = p.z) {
  const value = Math.min(p.bag, Math.ceil(amount)); if (value <= 0) return 0;
  p.bag -= value; if (!p.bag) p.loot = []; else p.loot = p.loot.slice(0, Math.max(1, Math.round(p.loot.length * p.bag / (p.bag + value))));
  // мешок выпадает рядом, в свободное место
  let sx = x, sz = z;
  for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI * 2, d = .5 + Math.random() * .5; const nx = x + Math.cos(a) * d, nz = z + Math.sin(a) * d; if (!blocked(nx, nz, .25)) { sx = nx; sz = nz; break; } }
  r.sacks.push({ id: `sack-${++r.seq}`, x: sx, z: sz, value, pickupAt: now() + .8 });
  return value;
}
function dash(r, p) {
  const t = now(); if (t < p.dashReady || t < p.stun || p.action?.type === 'hide') return;
  p.dashUntil = t + RULES.dashTime; p.dashReady = t + RULES.dashCooldown; cancelAction(r, p);
  emitEvent(r, { type: 'dash', pid: p.id, x: p.x, z: p.z });
}
function push(r, p) {
  const t = now(); if (t < p.pushReady || t < p.stun || p.action?.type === 'hide') return;
  p.pushReady = t + RULES.pushCooldown; p.pushAt = t; cancelAction(r, p);
  emitEvent(r, { type: 'push', pid: p.id, x: p.x, z: p.z });
  for (const q of r.players.values()) {
    if (q.id === p.id || t < q.immune || q.action?.type === 'hide') continue;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
    if (d < RULES.pushRange && Math.cos(Math.atan2(dz, dx) - p.angle) > .3 && lineOfSight(p.x, p.z, q.x, q.z)) {
      const lost = dropLoot(r, q, Math.max(q.bag * .5, Math.min(q.bag, 5)), q.x + dx / (d || 1) * .4, q.z + dz / (d || 1) * .4);
      move(q, dx / (d || 1) * 1.0, dz / (d || 1) * 1.0);
      q.stun = t + .55; q.immune = t + 1.1; q.action = null; p.stats.pushes++;
      emitEvent(r, { type: 'hit', pid: q.id, by: p.id, x: q.x, z: q.z, lost });
      if (lost) notify(r, `${p.name} выбил у ${q.name} ${lost} ◈`, 'push');
    }
  }
}
function triggerAlarm(r, c, p) {
  const t = now(), def = CASES.find(x => x.id === c.id);
  if (t - c.alarmAt < 6) return; c.alarmAt = t;
  const a = { id: `alarm-${++r.seq}`, x: def.x, z: def.z, caseId: c.id, until: t + RULES.alarmTime, room: roomAt(def.x, def.z).name };
  r.alarms = r.alarms.filter(x => x.caseId !== c.id); r.alarms.push(a);
  emitEvent(r, { type: 'alarm', x: def.x, z: def.z, caseId: c.id });
  notify(r, `Тревога: ${a.room}!`, 'alarm');
  // два ближайших свободных дрона летят на сирену
  const free = r.drones.filter(d => d.state !== 'chase').sort((a1, b1) => Math.hypot(a1.x - def.x, a1.z - def.z) - Math.hypot(b1.x - def.x, b1.z - def.z));
  for (const d of free.slice(0, c.item === 'crown' ? 3 : 2)) { d.state = 'respond'; d.target = { x: def.x, z: def.z + (def.type === 'wall' ? 0 : 1.1) }; d.path = []; d.repath = 0; }
}
function tryInteract(r, p) {
  const t = now();
  if (p.action || t < p.stun) return;
  let best = null, bd = 9;
  CASES.forEach((def, i) => {
    const c = r.cases[i]; if (c.empty || !caseReach(def, p)) return;
    const ip = def.type === 'wall' ? interactPoint(def) : def; const d = Math.hypot(p.x - ip.x, p.z - ip.z);
    if (d < bd) { bd = d; best = { type: 'steal', caseId: def.id, index: i }; }
  });
  for (const h of CABINETS) {
    if (!cabinetReach(h, p)) continue; const ip = interactPoint(h); const d = Math.hypot(p.x - ip.x, p.z - ip.z) - .2;
    if (d < bd) { bd = d; best = { type: 'hide', cabId: h.id }; }
  }
  if (!best) return;
  if (best.type === 'steal') {
    const def = CASES[best.index], value = ITEMS[def.item].value;
    if (p.bag + value > RULES.capacity) { if (!p.fullWarnAt || t - p.fullWarnAt > 2) { p.fullWarnAt = t; emitEvent(r, { type: 'full', pid: p.id }); } return; }
    p.action = { type: 'steal', caseId: def.id, index: best.index, since: t };
  } else {
    if (t < p.hideReady) return;
    if ([...r.players.values()].some(q => q.action?.type === 'hide' && q.action.cabId === best.cabId)) { emitEvent(r, { type: 'occupied', pid: p.id, cabId: best.cabId }); return; }
    const h = CABINETS.find(c => c.id === best.cabId);
    p.action = { type: 'hide', cabId: h.id, since: t, until: t + RULES.hideTime, ox: p.x, oz: p.z };
    p.angle = Math.atan2(-h.f[1], -h.f[0]); p.stats.hides++;
    emitEvent(r, { type: 'cabinet', cabId: h.id, pid: p.id, open: true });
    for (const d of r.drones) if (d.target?.id === p.id) { d.state = 'search'; d.until = t + 3; d.target = { x: p.x, z: p.z }; }
  }
}
function updateAction(r, p, dt) {
  const t = now(), a = p.action; if (!a) return;
  if (a.type === 'hide') {
    if (t >= a.until) {
      const h = CABINETS.find(c => c.id === a.cabId), ip = interactPoint(h);
      p.x = ip.x; p.z = ip.z; p.angle = Math.atan2(h.f[1], h.f[0]); p.action = null; p.hideReady = t + RULES.hideCooldown; p.immune = Math.max(p.immune, t + .8);
      emitEvent(r, { type: 'cabinet', cabId: h.id, pid: p.id, open: false });
    }
    return;
  }
  if (a.type === 'steal') {
    const def = CASES[a.index], c = r.cases[a.index];
    if (!p.interact || c.empty || !caseReach(def, p) || t < p.stun) { p.action = null; return; }
    if (Math.hypot(p.input.x, p.input.z) > .3) return; // пауза, пока двигаешься
    const ip = def.type === 'wall' ? interactPoint(def) : def;
    p.angle = def.type === 'wall' ? Math.atan2(-def.f[1], -def.f[0]) : Math.atan2(ip.z - p.z, ip.x - p.x);
    const before = c.progress;
    c.progress = Math.min(1, c.progress + dt / ITEMS[def.item].time); c.lastHit = t;
    // сирена срабатывает, когда стекло трескается (на 45% взлома), а не сразу — есть шанс успеть
    if ((before < .45 && c.progress >= .45) || (c.progress >= .45 && t - c.alarmAt > 6)) triggerAlarm(r, c, p);
    if (c.progress >= 1) {
      const item = ITEMS[def.item];
      c.empty = true; c.progress = 0; c.restockAt = t + (def.item === 'crown' ? 70 : RULES.restock);
      p.bag += item.value; p.loot.push(def.item); p.stats.stolen += item.value; p.stats.items++; p.action = null;
      emitEvent(r, { type: 'stolen', caseId: def.id, pid: p.id, item: def.item, value: item.value, x: def.x, z: def.z });
      notify(r, `${p.name} украл: ${item.name}`, def.item === 'crown' ? 'crown' : 'steal');
    }
  }
}

// ---------- дроны
function droneSees(d, p) { return canSee({ x: d.x, z: d.z, angle: d.angle }, p, 80 * Math.PI / 180, 7) ; }
function steerTo(d, goal, speed, dt) {
  const dx = goal.x - d.x, dz = goal.z - d.z, dist = Math.hypot(dx, dz);
  if (dist < .05) return dist;
  const step = Math.min(dist, speed * dt);
  move(d, dx / dist * step, dz / dist * step, .38, FLY_SOLIDS);
  const want = Math.atan2(dz, dx); d.angle += angleDiff(want, d.angle) * Math.min(1, dt * 7);
  return dist;
}
function followPath(d, goal, speed, dt, t) {
  if (!d.path.length || t > d.repath) { d.path = route(d, goal, 'fly'); d.repath = t + .9; }
  const next = d.path[0] || goal; const dist = steerTo(d, next, speed, dt);
  if (dist < .35 && d.path.length) d.path.shift();
  return Math.hypot(goal.x - d.x, goal.z - d.z);
}
function updateDrones(r, dt, t) {
  const finale = r.time <= RULES.finale;
  for (const d of r.drones) {
    // восприятие
    let seen = null, sd = 99;
    for (const p of r.players.values()) {
      if (p.action?.type === 'hide' || t < p.immune || r.phase !== 'playing') continue;
      if (!(p.bag > 0 || p.action?.type === 'steal' || finale)) continue;
      if (!droneSees(d, p)) continue; const dist = Math.hypot(p.x - d.x, p.z - d.z); if (dist < sd) { sd = dist; seen = p; }
    }
    if (seen) { if (d.state !== 'chase') { d.chaseSince = t; } if (d.state !== 'chase') emitEvent(r, { type: 'spotted', did: d.id, pid: seen.id }); d.state = 'chase'; d.target = { id: seen.id, x: seen.x, z: seen.z }; d.lastSeen = t; }
    const sp = (finale ? 1.15 : 1);
    if (d.state === 'chase') {
      const p = r.players.get(d.target?.id);
      if (!p || p.action?.type === 'hide' || t - d.lastSeen > 1.3 || t - (d.chaseSince ||= t) > 9) { d.state = 'search'; d.until = t + 4; d.target = { x: d.target?.x ?? d.x, z: d.target?.z ?? d.z }; d.path = []; }
      else {
        if (lineOfSight(d.x, d.z, p.x, p.z, FLY_SOLIDS)) { d.path = []; steerTo(d, p, 3.95 * sp, dt); } else followPath(d, d.target, 3.95 * sp, dt, t);
        if (Math.hypot(p.x - d.x, p.z - d.z) < .78 && t >= p.immune) {
          const lost = dropLoot(r, p, p.bag); p.stun = t + RULES.stunTime; p.caughtAt = t; p.immune = t + RULES.stunTime + 2.5; p.action = null; p.stats.caught++;
          emitEvent(r, { type: 'caught', pid: p.id, did: d.id, x: p.x, z: p.z, lost });
          notify(r, `${p.name} пойман дроном${lost ? ` и потерял ${lost} ◈` : ''}`, 'caught');
          d.state = 'search'; d.until = t + 2.5; d.target = { x: d.x, z: d.z }; d.path = [];
        }
      }
    } else if (d.state === 'respond') {
      const left = followPath(d, d.target, 5.1 * sp, dt, t);
      if (left < .8) { d.state = 'search'; d.until = t + 5; d.path = []; d.spin = 0; }
    } else if (d.state === 'search') {
      if (d.target && Math.hypot(d.target.x - d.x, d.target.z - d.z) > .6) followPath(d, d.target, 3.4 * sp, dt, t);
      else { d.angle += dt * 2.6; if (!d.wander || t > d.wander) { d.wander = t + 1.4; const a = Math.random() * 6.28; const nx = d.x + Math.cos(a) * 2.2, nz = d.z + Math.sin(a) * 2.2; if (!blocked(nx, nz, .4, FLY_SOLIDS)) { d.target = { x: nx, z: nz }; d.path = []; } } }
      if (t > d.until) { d.state = 'patrol'; d.path = []; const rt = DRONE_ROUTES[d.route]; let bi = 0, bd = 1e9; rt.forEach((w, i) => { const dd = Math.hypot(w[0] - d.x, w[1] - d.z); if (dd < bd) { bd = dd; bi = i; } }); d.wp = bi; }
    } else {
      const rt = DRONE_ROUTES[d.route], w = rt[d.wp], goal = { x: w[0], z: w[1] };
      const left = followPath(d, goal, 2.7 * sp, dt, t);
      if (left < .5) { d.wp = (d.wp + 1) % rt.length; d.path = []; }
    }
  }
}

// ---------- боты
function botThink(r, p, t) {
  const b = p.brain; let goal = null, wantInteract = false;
  const ex = EXITS[r.activeExit];
  const chased = r.drones.find(d => d.state === 'chase' && d.target?.id === p.id);
  if (p.action?.type === 'hide') { p.input = { x: 0, z: 0, angle: p.angle }; p.interact = false; return; }
  if (chased && t >= p.hideReady) {
    const cab = CABINETS.map(h => ({ h, ip: interactPoint(h) })).sort((a, c) => Math.hypot(a.ip.x - p.x, a.ip.z - p.z) - Math.hypot(c.ip.x - p.x, c.ip.z - p.z))[0];
    if (Math.hypot(cab.ip.x - p.x, cab.ip.z - p.z) < 6) { goal = cab.ip; wantInteract = Math.hypot(cab.ip.x - p.x, cab.ip.z - p.z) < .9; }
    if (Math.hypot(chased.x - p.x, chased.z - p.z) < 2.2) dash(r, p);
  }
  if (!goal && (p.bag >= 55 || (p.bag > 0 && r.time < 40) || (p.bag > 0 && chased))) goal = ex;
  if (!goal) {
    // ближайшая витрина или мешок
    let best = null, bd = 1e9;
    CASES.forEach((def, i) => { const c = r.cases[i]; if (c.empty || p.bag + ITEMS[def.item].value > RULES.capacity) return; const ip = def.type === 'wall' ? interactPoint(def) : { x: def.x, z: def.z + (def.big ? 1.05 : .85) }; const d = Math.hypot(ip.x - p.x, ip.z - p.z) - ITEMS[def.item].value * .05 + (p.id.charCodeAt(4) % 3); if (d < bd) { bd = d; best = { ...ip, def, i }; } });
    for (const s of r.sacks) { const d = Math.hypot(s.x - p.x, s.z - p.z) - 3; if (d < bd) { bd = d; best = { x: s.x, z: s.z }; } }
    if (best) { goal = best; if (best.def && caseReach(best.def, p)) wantInteract = true; }
  }
  if (p.action?.type === 'steal') { p.input = { x: 0, z: 0, angle: p.angle }; p.interact = true; return; }
  // толкнуть соседа с добычей
  for (const q of r.players.values()) if (q.id !== p.id && q.bag > 15 && Math.hypot(q.x - p.x, q.z - p.z) < 1.3 && t > p.pushReady && Math.random() < .05) { p.angle = Math.atan2(q.z - p.z, q.x - p.x); p.input.angle = p.angle; push(r, p); }
  p.interact = wantInteract;
  if (!goal) { p.input = { x: 0, z: 0, angle: p.angle }; return; }
  if (!b.path.length || t > b.repath || b.goal?.x !== goal.x || b.goal?.z !== goal.z) { b.path = route(p, goal); b.repath = t + 1.2; b.goal = { x: goal.x, z: goal.z }; }
  const next = b.path[0] || goal; const dx = next.x - p.x, dz = next.z - p.z, dist = Math.hypot(dx, dz);
  if (dist < .3 && b.path.length) b.path.shift();
  if (wantInteract) { p.input = { x: 0, z: 0, angle: p.angle }; return; }
  p.input = { x: dx / Math.max(dist, .001) * Math.min(1, dist * 2), z: dz / Math.max(dist, .001) * Math.min(1, dist * 2), angle: Math.atan2(dz, dx) };
  p.lastInput = t;
}

// ---------- снимки
function roster(r) { return [...r.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score, ready: p.ready, bot: p.bot, connected: p.connected, stats: r.phase === 'results' ? p.stats : undefined })); }
function publicPlayer(p, t) {
  return { id: p.id, name: p.name, color: p.color, x: +p.x.toFixed(3), z: +p.z.toFixed(3), angle: +p.angle.toFixed(3), bag: p.bag, loot: p.loot.slice(-4), score: p.score,
    anim: t < p.stun ? (t - p.caughtAt < RULES.stunTime ? 'caught' : 'stunned') : t < p.dashUntil ? 'dash' : t - p.pushAt < .35 ? 'push' : p.action?.type === 'steal' && Math.hypot(p.input.x, p.input.z) <= .3 ? 'steal' : (Math.hypot(p.input.x, p.input.z) > .1 && t - p.lastInput < .3) ? 'move' : 'idle' };
}
function selfState(p, t) {
  const a = p.action;
  return { ...publicPlayer(p, t), stats: p.stats, dashCd: Math.max(0, p.dashReady - t), pushCd: Math.max(0, p.pushReady - t), hideCd: Math.max(0, p.hideReady - t), stunned: t < p.stun, stunLeft: Math.max(0, p.stun - t),
    action: a ? (a.type === 'hide' ? { type: 'hide', cabId: a.cabId, left: Math.max(0, a.until - t), elapsed: t - a.since } : { type: 'steal', caseId: a.caseId }) : null };
}
function snapshot(r, p, t) {
  const viewer = { x: p.x, z: p.z, angle: p.angle };
  const hidden = p.action?.type === 'hide';
  const sees = q => !hidden && canSee(viewer, q);
  return {
    t: Date.now(), code: r.code, owner: r.owner, phase: r.phase, time: +r.time.toFixed(2), countdown: r.phase === 'countdown' ? Math.max(0, r.countdownAt - t) : 0,
    activeExit: r.activeExit, nextExit: r.time > RULES.finale ? Math.max(0, (RULES.round - r.time) % 36) : 0, finale: r.phase === 'playing' && r.time <= RULES.finale,
    roster: roster(r), you: selfState(p, t),
    players: [...r.players.values()].filter(q => q.id !== p.id && q.action?.type !== 'hide' && sees(q)).map(q => publicPlayer(q, t)),
    drones: r.drones.filter(d => sees(d)).map(d => ({ id: d.id, x: +d.x.toFixed(3), z: +d.z.toFixed(3), angle: +d.angle.toFixed(3), state: d.state })),
    cases: r.cases.map(c => [c.empty ? 1 : 0, +c.progress.toFixed(3)]),
    coins: r.coins.filter(c => !c.taken && sees(c)).map(c => c.id),
    sacks: r.sacks.filter(s => sees(s)).map(s => ({ id: s.id, x: +s.x.toFixed(2), z: +s.z.toFixed(2), value: s.value })),
    alarms: r.alarms.map(a => ({ id: a.id, x: a.x, z: a.z, room: a.room, left: +(a.until - t).toFixed(1) })),
    feed: r.feed.filter(f => t - f.at < 6).map(({ id, text, kind }) => ({ id, text, kind })),
    events: r.pending.filter(e => e.pid === p.id || e.type === 'alarm' || e.type === 'stolen' || e.type === 'cabinet' && sees(CABINETS.find(h => h.id === e.cabId)) || (e.x !== undefined && sees(e))).map(e => (e.type === 'cabinet' && e.pid !== p.id ? { ...e, pid: undefined } : e)),
  };
}

// ---------- сокеты
io.on('connection', socket => {
  let player = null, room = null, windowAt = now(), messages = 0;
  const rate = () => { if (now() - windowAt > 1) { windowAt = now(); messages = 0; } return ++messages < 120; };
  socket.on('ping:measure', ack => { if (typeof ack === 'function') ack(); });
  socket.on('room:join', (data, ack) => {
    if (typeof ack !== 'function' || !data || typeof data !== 'object') return;
    if (player) return ack({ ok: false, error: 'Ты уже в комнате.' });
    if (!rate()) return ack({ ok: false, error: 'Слишком много запросов.' });
    const token = typeof data.token === 'string' ? data.token.slice(0, 64) : '', old = sessions.get(token);
    if (old && rooms.has(old.room) && !old.player.connected && now() - old.player.goneAt < 45) {
      room = rooms.get(old.room); player = old.player; player.connected = true; player.lastInput = now(); player.socket = socket.id; socket.join(room.code);
      return ack({ ok: true, token, code: room.code, id: player.id, resumed: true });
    }
    if (!data.code && rooms.size >= 200) return ack({ ok: false, error: 'Все комнаты заняты. Попробуй позже.' });
    if (data.code) {
      room = rooms.get(String(data.code).toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 6));
      if (!room) return ack({ ok: false, error: 'Комната не найдена. Проверь код.' });
      if ([...room.players.values()].filter(p => !p.bot).length >= 8 || room.players.size >= 8 && ![...room.players.values()].some(p => p.bot)) return ack({ ok: false, error: 'В комнате уже восемь игроков.' });
      if (room.phase !== 'lobby') return ack({ ok: false, error: 'Матч уже идёт. Дождись следующего.' });
      if (room.players.size >= 8) { const bot = [...room.players.values()].find(p => p.bot); room.players.delete(bot.id); }
    } else room = newRoom();
    const name = String(data.name || 'Грабитель').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Грабитель';
    const id = crypto.randomUUID(), t = crypto.randomBytes(24).toString('hex');
    player = makePlayer(room, id, name); player.socket = socket.id; room.players.set(id, player); if (!room.owner) room.owner = id;
    sessions.set(t, { room: room.code, player }); socket.join(room.code);
    if (data.practice && !data.code) { for (let i = 0; i < 3; i++) addBot(room); begin(room); }
    ack({ ok: true, token: t, code: room.code, id });
  });
  socket.on('input', data => {
    if (!rate() || !player || !data || typeof data !== 'object' || ![data.x, data.z, data.angle].every(Number.isFinite)) return;
    const len = Math.max(1, Math.hypot(data.x, data.z));
    player.input = { x: clamp(data.x / len, -1, 1), z: clamp(data.z / len, -1, 1), angle: Math.atan2(Math.sin(data.angle), Math.cos(data.angle)) };
    player.interact = !!data.interact; player.lastInput = now();
  });
  socket.on('action', action => { if (!rate() || !room || room.phase !== 'playing' || !player) return; if (action === 'dash') dash(room, player); if (action === 'push') push(room, player); });
  socket.on('ready', () => { if (rate() && player && room.phase === 'lobby') player.ready = !player.ready; });
  socket.on('bot:add', () => { if (rate() && room && player.id === room.owner && room.phase === 'lobby' && room.players.size < 8) addBot(room); });
  socket.on('bot:remove', () => { if (rate() && room && player.id === room.owner && room.phase === 'lobby') { const b = [...room.players.values()].reverse().find(p => p.bot); if (b) room.players.delete(b.id); } });
  socket.on('start', () => {
    if (!rate() || !room || player.id !== room.owner || room.phase !== 'lobby') return;
    if (room.players.size < 2) return socket.emit('notice', 'Нужно минимум двое. Пригласи друга или добавь бота.');
    if ([...room.players.values()].some(p => !p.ready && p.id !== room.owner)) return socket.emit('notice', 'Дождись готовности всех игроков.');
    begin(room);
  });
  socket.on('rematch', () => { if (rate() && room && player.id === room.owner && room.phase === 'results') { room.phase = 'lobby'; for (const p of room.players.values()) p.ready = p.bot; } });
  socket.on('leave', () => { if (player && room) { room.players.delete(player.id); if (room.owner === player.id) room.owner = [...room.players.values()].find(x => !x.bot)?.id || null; player = null; room = null; } });
  socket.on('disconnect', () => { if (player) { player.connected = false; player.goneAt = now(); player.input = { x: 0, z: 0, angle: player.angle }; player.interact = false; } });
});
function addBot(r) { const used = new Set([...r.players.values()].map(p => p.name)); const name = BOT_NAMES.find(n => !used.has(n)) || 'Бот'; const b = makePlayer(r, `bot-${crypto.randomBytes(3).toString('hex')}`, name, true); r.players.set(b.id, b); }

// ---------- игровой цикл
let last = now(), frame = 0;
setInterval(() => {
  const t = now(), dt = Math.min(.06, t - last); last = t; frame++;
  for (const r of rooms.values()) {
    for (const [id, p] of r.players) if (!p.bot && !p.connected && t - p.goneAt > 45) { dropLoot(r, p, p.bag); r.players.delete(id); if (r.owner === id) r.owner = [...r.players.values()].find(x => !x.bot)?.id || null; }
    if (![...r.players.values()].some(p => !p.bot)) { rooms.delete(r.code); continue; }
    r.pending = r.pending || [];
    if (r.phase === 'countdown' && t >= r.countdownAt) { r.phase = 'playing'; r.started = t; notify(r, 'Музей открыт. Хапай!', 'start'); emitEvent(r, { type: 'start' }); }
    if (r.phase === 'playing') {
      const prevTime = r.time; r.time = Math.max(0, RULES.round - (t - r.started));
      if (prevTime > RULES.finale && r.time <= RULES.finale) { r.activeExit = 2; notify(r, 'ФИНАЛ! Открыт только погрузочный док', 'alarm'); emitEvent(r, { type: 'finale' }); }
      else if (r.time > RULES.finale) { const idx = Math.floor((t - r.started) / 36) % 3; const ex = r.exitOrder[idx]; if (ex !== r.activeExit) { r.activeExit = ex; notify(r, `Выход открыт: ${EXITS[ex].name}`, 'exit'); emitEvent(r, { type: 'exit', exit: ex }); } }
      r.alarms = r.alarms.filter(a => a.until > t);
      for (const c of r.cases) { if (c.empty && t > c.restockAt) { c.empty = false; c.progress = 0; } if (!c.empty && c.progress > 0 && t - (c.lastHit || 0) > 8) c.progress = Math.max(0, c.progress - dt * .05); }
      for (const c of r.coins) if (c.taken && t > c.respawnAt) c.taken = false;
      for (const p of r.players.values()) {
        if (p.bot) botThink(r, p, t);
        if (!p.bot && t - p.lastInput > .5) { p.input.x = p.input.z = 0; }
        if (p.action?.type !== 'hide' && t >= p.stun) p.angle = p.input.angle;
        if (p.interact) tryInteract(r, p);
        updateAction(r, p, dt);
        if (p.action?.type === 'hide' || t < p.stun || (!p.connected && !p.bot)) continue;
        const stealing = p.action?.type === 'steal';
        const speed = t < p.dashUntil ? RULES.dashSpeed : RULES.speed * (1 - p.bag / RULES.capacity * RULES.slow) * (stealing ? .35 : 1);
        if (t < p.dashUntil) move(p, Math.cos(p.angle) * speed * dt * (Math.hypot(p.input.x, p.input.z) > .1 ? 0 : 1) + p.input.x * speed * dt, Math.sin(p.angle) * speed * dt * (Math.hypot(p.input.x, p.input.z) > .1 ? 0 : 1) + p.input.z * speed * dt);
        else move(p, p.input.x * speed * dt, p.input.z * speed * dt);
        for (const c of r.coins) if (!c.taken && Math.hypot(p.x - c.x, p.z - c.z) < .6 && p.bag + c.value <= RULES.capacity) { c.taken = true; c.respawnAt = t + 25; p.bag += c.value; p.stats.stolen += c.value; emitEvent(r, { type: 'coin', pid: p.id, x: c.x, z: c.z }); }
        for (let i = r.sacks.length - 1; i >= 0; i--) { const s = r.sacks[i]; if (t > s.pickupAt && Math.hypot(p.x - s.x, p.z - s.z) < .7 && p.bag < RULES.capacity) { const take = Math.min(s.value, RULES.capacity - p.bag); p.bag += take; s.value -= take; if (!p.loot.length) p.loot.push('sack'); emitEvent(r, { type: 'sack', pid: p.id, x: s.x, z: s.z, value: take }); if (!s.value) r.sacks.splice(i, 1); } }
        const e = EXITS[r.activeExit];
        if (p.bag && Math.hypot(p.x - e.x, p.z - e.z) < 1.55) { p.score += p.bag; p.stats.delivered += p.bag; emitEvent(r, { type: 'deposit', pid: p.id, value: p.bag, x: p.x, z: p.z }); notify(r, `${p.name} вынес ${p.bag} ◈`, 'deposit'); p.bag = 0; p.loot = []; }
      }
      updateDrones(r, dt, t);
      if (r.time <= 0) { r.phase = 'results'; for (const p of r.players.values()) { p.action = null; p.interact = false; } notify(r, 'Ограбление завершено!', 'end'); emitEvent(r, { type: 'end' }); }
    }
    r.pending.push(...r.events); r.events = [];
    if (frame % SEND_EVERY === 0) { for (const p of r.players.values()) if (!p.bot && p.connected) io.to(p.socket).emit('state', snapshot(r, p, t)); r.pending = []; }
  }
}, 1000 / TICK);
setInterval(() => { for (const [token, s] of sessions) if (!rooms.has(s.room) || !s.player.connected && now() - s.player.goneAt > 45) sessions.delete(token); }, 30000).unref();
httpServer.listen(PORT, '0.0.0.0', () => console.log(`HAPAI ${VERSION} server :${PORT}; origins=${origins.join(',')}`));
