import test from 'node:test'; import assert from 'node:assert/strict'; import { spawn } from 'node:child_process'; import { io } from 'socket.io-client';
import { CASES, CABINETS, interactPoint, route } from '../packages/shared/world.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const connect = port => new Promise((res, rej) => { const s = io(`http://localhost:${port}`, { transports: ['websocket'], extraHeaders: { Origin: 'http://localhost:3000' } }); s.once('connect', () => res(s)); s.once('connect_error', rej); });
const request = (s, ev, data) => new Promise(r => s.emit(ev, data, r));
const state = s => new Promise(r => s.once('state', r));
async function walkTo(s, last, to, ms = 9000) {
  const t = Date.now(); const path = route(last(), to); let k = 0;
  while (k < path.length && Date.now() - t < ms) { const p = last(), q = path[k], dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d < (k === path.length - 1 ? .2 : .45)) { k++; continue; } s.emit('input', { x: dx / d, z: dz / d, angle: Math.atan2(dz, dx), interact: false }); await sleep(40); }
  s.emit('input', { x: 0, z: 0, angle: 0, interact: false });
}
test('мультиплеер: комнаты, фильтр видимости, плохой ввод, взлом с сиреной, шкаф, переподключение, тренировка', { timeout: 60000 }, async () => {
  const port = 19001; const child = spawn(process.execPath, ['apps/server/index.mjs'], { env: { ...process.env, PORT: String(port), FRONTEND_URL: 'http://localhost:3000' }, stdio: 'ignore' }); let a, b, c;
  try {
    await sleep(800); a = await connect(port); b = await connect(port);
    const ja = await request(a, 'room:join', { name: 'Test-A' }); assert(ja.ok);
    const jb = await request(b, 'room:join', { name: 'Test-B', code: ja.code }); assert(jb.ok);
    const bad = await request(c = await connect(port), 'room:join', { name: 'X', code: 'ZZZZZZ' }); assert(!bad.ok); c.disconnect();
    b.emit('ready'); await sleep(80); a.emit('start');
    let S; a.on('state', st => S = st); while (!S || S.phase !== 'playing') await sleep(50);
    assert.equal(S.roster.length, 2);
    for (const p of S.players) assert(p.id !== ja.id);
    // некорректный ввод не ломает сервер
    a.emit('input', null); a.emit('input', { x: 'bad', z: 0, angle: 0 }); a.emit('input', { x: 1e9, z: NaN, angle: 0 }); await sleep(100); assert(Number.isFinite(S.you.x));
    // взлом удержанием → сирена → добыча
    const me = () => S.you; const ci = CASES.findIndex(c => c.id === 'c3'); const cs = CASES[ci];
    await walkTo(a, me, { x: cs.x, z: cs.z + .85 });
    let alarm = false; const t0 = Date.now();
    while (Date.now() - t0 < 6000 && !S.cases[ci][0]) { a.emit('input', { x: 0, z: 0, angle: -Math.PI / 2, interact: true }); if (S.alarms.some(x => x.x === cs.x && x.z === cs.z)) alarm = true; await sleep(50); }
    a.emit('input', { x: 0, z: 0, angle: 0, interact: false });
    assert(S.cases[ci][0], 'витрина взломана'); assert(alarm, 'сработала сирена'); assert(S.you.stats.stolen > 0 || S.you.bag > 0 || S.you.stats.caught > 0);
    // шкаф: прячемся на 5 секунд
    const h = CABINETS.find(x => x.id === 'h0'); const ip = interactPoint(h); await walkTo(a, me, ip, 12000);
    if (S.you.stunned) await sleep(2200);
    await walkTo(a, me, ip, 4000);
    for (let i = 0; i < 8 && S.you.action?.type !== 'hide'; i++) { a.emit('input', { x: 0, z: 0, angle: Math.atan2(h.z - ip.z, h.x - ip.x), interact: true }); await sleep(80); }
    a.emit('input', { x: 0, z: 0, angle: 0, interact: false });
    assert.equal(S.you.action?.type, 'hide', 'игрок в шкафу');
    await sleep(5400); assert.notEqual(S.you.action?.type, 'hide', 'через 5 секунд выходит');
    // переподключение по токену
    a.disconnect(); await sleep(150); c = await connect(port);
    const resumed = await request(c, 'room:join', { token: ja.token, code: ja.code }); assert.equal(resumed.id, ja.id);
    const restored = await state(c); assert.equal(restored.you.name, 'Test-A'); c.disconnect();
    // тренировка с ботами
    c = await connect(port); const pr = await request(c, 'room:join', { name: 'Solo', practice: true }); assert(pr.ok);
    let P; c.on('state', st => P = st); while (!P || P.phase === 'lobby') await sleep(50);
    assert.equal(P.roster.filter(p => p.bot).length, 3);
  } finally { a?.disconnect(); b?.disconnect(); c?.disconnect(); child.kill(); }
});
