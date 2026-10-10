// Записывает реальный матч: управляемый скриптом игрок + боты сервера. Сохраняет все пакеты state.
import { io } from 'socket.io-client';
import fs from 'node:fs';
import * as W from '../packages/shared/world.mjs';
const URL = process.env.URL || 'http://localhost:10001', OUT = process.env.OUT || '/data/qa/rec.json';
const s = io(URL, { transports: ['websocket'], extraHeaders: { origin: 'http://localhost:3000' } });
const rec = { states: [], notices: [], inputs: [] }; let S = null, myId; const t0 = Date.now(); const T = () => Date.now() - t0;
let spottedAt = -1e9;
s.on('state', st => { S = st; rec.states.push({ at: T(), st }); for (const e of st.events || []) if (e.type === 'spotted' && e.pid === myId) spottedAt = Date.now(); });
s.on('notice', n => rec.notices.push({ at: T(), n }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let inp = { x: 0, z: 0, angle: 1.57, interact: false };
setInterval(() => { s.emit('input', inp); rec.inputs.push({ at: T(), ...inp }); }, 50);
const me = () => S.you;
async function walk(pts, { tol = .3, timeout = 15000, until, dashOk = true } = {}) {
  const st = Date.now(); let k = 0;
  while (k < pts.length && Date.now() - st < timeout) {
    if (until && until()) break; const p = me(), q = pts[k], dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
    if (d < (k === pts.length - 1 ? tol : .45)) { k++; continue; }
    const sp = Math.min(1, d / .5 + .25); inp = { x: dx / d * sp, z: dz / d * sp, angle: Math.atan2(dz, dx), interact: false };
    if (dashOk && d > 4 && me().dashCd === 0 && Math.random() < .03) s.emit('action', 'dash');
    // толкаем соперника рядом
    for (const o of S.players) if (o.id !== myId && Math.hypot(o.x - p.x, o.z - p.z) < 1.3 && me().pushCd === 0 && o.bag > 0) { inp.angle = Math.atan2(o.z - p.z, o.x - p.x); s.emit('input', inp); s.emit('action', 'push'); }
    await sleep(40);
  }
  inp = { ...inp, x: 0, z: 0 };
}
const len = r => { let L = 0, c = me(); for (const q of r) { L += Math.hypot(q.x - c.x, q.z - c.z); c = q; } return L; };
const goto = (to, o) => walk(W.route(me(), to), o);
function stand(c) { if (c.type === 'wall') return [W.interactPoint(c)]; const h = (c.big ? .62 : c.type === 'pedestal' ? .55 : .45) + .42; return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => ({ x: c.x + a * h, z: c.z + b * h })).filter(p => !W.blocked(p.x, p.z)); }
function bestCase(skip = []) { let b = null; W.CASES.forEach((c, i) => { if (S.cases[i][0] || skip.includes(c.id)) return; for (const sp of stand(c)) { const r = W.route(me(), sp); if (!r.length) continue; const L = len(r) - (c.item === 'crown' ? 6 : 0); if (!b || L < b.L) b = { c, i, sp, L }; } }); return b; }
async function steal(b) {
  await goto(b.sp, { tol: .15 }); const p = me(); const t = Date.now();
  while (Date.now() - t < 12000 && !S.cases[b.i][0]) { inp = { x: 0, z: 0, angle: Math.atan2(b.c.z - p.z, b.c.x - p.x), interact: true }; await sleep(50); }
  inp = { ...inp, interact: false }; return S.cases[b.i][0];
}
async function hide() {
  const h = W.CABINETS.map(h => ({ h, L: len(W.route(me(), W.interactPoint(h))) })).sort((a, b) => a.L - b.L)[0].h;
  const ip = W.interactPoint(h); await goto(ip, { tol: .25 });
  inp = { x: 0, z: 0, angle: Math.atan2(h.z - ip.z, h.x - ip.x), interact: true }; await sleep(400); inp = { ...inp, interact: false };
  const t = Date.now(); while (Date.now() - t < 7000 && (me().action?.type === 'hide' || Date.now() - t < 1000)) await sleep(100);
  return h;
}
async function deposit() { const ex = W.EXITS[S.activeExit]; await goto({ x: ex.x, z: ex.z }, { timeout: 25000, until: () => me().bag === 0 }); }
s.on('connect', () => s.emit('room:join', { name: 'Киро', practice: !!process.env.PRACTICE }, async res => {
  myId = res.id; console.log('joined', res.code);
  if (!process.env.PRACTICE) { await sleep(1500); for (let i = 0; i < 5; i++) { s.emit('bot:add'); await sleep(450); } await sleep(1500); s.emit('start'); }
  while (!S || S.phase !== 'playing') await sleep(50);
  console.log('playing at', T());
  let n = 0;
  while (S.phase === 'playing') {
    const b = bestCase(['c9']); if (!b) break; console.log(T(), 'go case', b.c.id, b.c.item);
    const ok = await steal(b); console.log(T(), 'stolen', ok, me().bag);
    if (ok && me().bag > 0) { const h = await hide(); console.log(T(), 'hid in', h.id); }
    for (let k = 0; k < 3 && me().bag > 0 && S.phase === 'playing'; k++) {
      const ex = W.EXITS[S.activeExit]; const st0 = Date.now();
      await goto({ x: ex.x, z: ex.z }, { timeout: 25000, until: () => me().bag === 0 || (Date.now() - spottedAt < 300 && me().hideCd === 0) });
      if (me().bag > 0 && me().hideCd === 0) { const h = await hide(); console.log(T(), 'escape hide', h.id); }
    }
    console.log(T(), 'deposit', me().score);
  }
  while (S.phase !== 'results') await sleep(100); await sleep(4000);
  fs.writeFileSync(OUT, JSON.stringify(rec)); console.log('saved', rec.states.length, 'states', T()); process.exit(0);
}));
