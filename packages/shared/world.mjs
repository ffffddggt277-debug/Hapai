// ХАПАЙ! 2.0 — общая карта, правила и геометрия (сервер + клиент).
export const VERSION = '2.0.0';
export const WORLD = { width: 44, height: 32 };
export const RULES = {
  speed: 4.3, radius: 0.36, range: 9, fov: 105 * Math.PI / 180, near: 0.9,
  round: 180, finale: 30, capacity: 150, slow: 0.4,
  dashCooldown: 4, dashTime: 0.22, dashSpeed: 13,
  pushCooldown: 2.2, pushRange: 1.6,
  hideTime: 5, hideCooldown: 7, interactRange: 1.35,
  stunTime: 2, alarmTime: 12, restock: 40,
};
const T = 0.5;
const H = (z, x0, x1) => [(x0 + x1) / 2, z, x1 - x0, T];
const V = (x, z0, z1) => [x, (z0 + z1) / 2, T, z1 - z0];
// Внешний контур с проёмами под выходы (N, S, W, E).
export const WALLS = [
  H(0.25, 0, 20.5), H(0.25, 23.5, 44), H(31.75, 0, 20.5), H(31.75, 23.5, 44),
  V(0.25, 0, 22.5), V(0.25, 25.5, 32), V(43.75, 0, 6.5), V(43.75, 9.5, 32),
  // западное крыло
  V(14, 0, 3.5), V(14, 6.5, 12), V(14, 15, 18.5), V(14, 21, 25.5), V(14, 28.5, 32),
  H(16, 0, 5.5), H(16, 8.5, 14),
  // восточное крыло
  V(30, 0, 3.5), V(30, 6.5, 12), V(30, 15, 18.5), V(30, 21, 25.5), V(30, 28.5, 32),
  H(16, 30, 35.5), H(16, 38.5, 44),
  // главный зал
  H(9, 14, 19.5), H(9, 24.5, 30), H(23, 14, 19.5), H(23, 24.5, 30),
];
// Невидимые барьеры за выходами: дальше выхода не уйти.
export const BARRIERS = [[22, -0.6, 4, 0.6], [22, 32.6, 4, 0.6], [-0.6, 24, 0.6, 4], [44.6, 8, 0.6, 4]];
export const ROOMS = [
  { name: 'Галерея живописи', x: 7, z: 8 }, { name: 'Зал скульптуры', x: 7, z: 24 },
  { name: 'Вестибюль', x: 22, z: 4.5 }, { name: 'Главный зал', x: 22, z: 16 },
  { name: 'Погрузочный док', x: 22, z: 27.5 }, { name: 'Восточная коллекция', x: 37, z: 8 },
  { name: 'Сокровищница', x: 37, z: 24 },
];
export function roomAt(x, z) {
  if (x < 14) return z < 16 ? ROOMS[0] : ROOMS[1];
  if (x > 30) return z < 16 ? ROOMS[5] : ROOMS[6];
  return z < 9 ? ROOMS[2] : z < 23 ? ROOMS[3] : ROOMS[4];
}
export const EXITS = [
  { id: 0, x: 22, z: 1.4, name: 'Главный вход', van: [22, -3.2, 0] },
  { id: 1, x: 42.6, z: 8, name: 'Служебная дверь', van: [47.2, 8, Math.PI / 2] },
  { id: 2, x: 22, z: 30.6, name: 'Погрузочный док', van: [22, 35.2, Math.PI] },
  { id: 3, x: 1.4, z: 24, name: 'Пожарный выход', van: [-3.2, 24, -Math.PI / 2] },
];
export const ITEMS = {
  crown: { name: 'Корона императрицы', value: 100, time: 5, model: 'crown' },
  chest: { name: 'Сундук с золотом', value: 45, time: 4, model: 'chest' },
  lion: { name: 'Бронзовый лев', value: 35, time: 3.2, model: 'lion' },
  whale: { name: 'Бронзовый кит', value: 30, time: 3, model: 'whale' },
  katana: { name: 'Древняя катана', value: 30, time: 3, model: 'katana' },
  bust: { name: 'Мраморный бюст', value: 25, time: 2.6, model: 'bust' },
  painting1: { name: 'Пейзаж с мельницей', value: 25, time: 2.6, model: 'painting1' },
  painting2: { name: 'Старый город', value: 25, time: 2.6, model: 'painting2' },
  horse: { name: 'Фарфоровый конь', value: 20, time: 2.2, model: 'horse' },
  vase_blue: { name: 'Кобальтовая ваза', value: 15, time: 1.8, model: 'vase_blue' },
  vase_brass: { name: 'Латунная ваза', value: 15, time: 1.8, model: 'vase_brass' },
  vase_white: { name: 'Белая амфора', value: 15, time: 1.8, model: 'vase_white' },
  clock: { name: 'Каминные часы', value: 15, time: 1.8, model: 'clock' },
  lantern: { name: 'Фонарь капитана', value: 10, time: 1.4, model: 'lantern' },
};
// type: case — витрина; wall — картина на стене (f — куда смотрит); pedestal — открытый постамент
export const CASES = [
  { id: 'c0', item: 'painting1', type: 'wall', x: 6, z: 0.62, f: [0, 1] },
  { id: 'c1', item: 'painting2', type: 'wall', x: 0.62, z: 10.5, f: [1, 0] },
  { id: 'c2', item: 'vase_blue', type: 'case', x: 4.5, z: 5.5 },
  { id: 'c3', item: 'vase_brass', type: 'case', x: 9.5, z: 5.5 },
  { id: 'c4', item: 'lantern', type: 'case', x: 7, z: 11.5 },
  { id: 'c5', item: 'bust', type: 'case', x: 4.5, z: 20 },
  { id: 'c6', item: 'horse', type: 'case', x: 10, z: 20 },
  { id: 'c7', item: 'lion', type: 'case', x: 10, z: 28.5 },
  { id: 'c8', item: 'whale', type: 'case', x: 5, z: 28.5 },
  { id: 'c9', item: 'crown', type: 'case', x: 22, z: 16, big: true },
  { id: 'c10', item: 'painting1', type: 'wall', x: 14.37, z: 10.6, f: [1, 0] },
  { id: 'c11', item: 'katana', type: 'case', x: 34, z: 5 },
  { id: 'c12', item: 'vase_white', type: 'case', x: 39.5, z: 4.5 },
  { id: 'c13', item: 'clock', type: 'case', x: 34, z: 20.5 },
  { id: 'c14', item: 'chest', type: 'pedestal', x: 40, z: 28 },
  { id: 'c15', item: 'lantern', type: 'case', x: 39.5, z: 20.5 },
  { id: 'c16', item: 'vase_blue', type: 'case', x: 34.5, z: 27.5 },
  { id: 'c17', item: 'painting2', type: 'wall', x: 29.63, z: 21.2, f: [-1, 0] },
];
// Шкафы для пряток. f — направление дверей.
export const CABINETS = [
  { id: 'h0', x: 13.35, z: 8.6, f: [-1, 0] }, { id: 'h1', x: 0.9, z: 19, f: [1, 0] },
  { id: 'h2', x: 17, z: 0.9, f: [0, 1] }, { id: 'h3', x: 16.4, z: 22.35, f: [0, -1] },
  { id: 'h4', x: 27.6, z: 9.65, f: [0, 1] }, { id: 'h5', x: 43.1, z: 13.2, f: [-1, 0] },
  { id: 'h6', x: 33.5, z: 31.1, f: [0, -1] }, { id: 'h7', x: 26.8, z: 31.1, f: [0, -1] },
  { id: 'h8', x: 13.35, z: 29.6, f: [-1, 0] },
];
// Декор. block — мешает ходьбе, occlude — закрывает обзор.
export const DECOR = [
  { kind: 'statue', x: 7, z: 24.3, r: 0, w: 1.4, d: 1.1, block: true, occlude: true },
  { kind: 'ropes', x: 22, z: 16, r: 0 },
  { kind: 'bench', x: 7, z: 14.6, r: Math.PI, w: 1.5, d: .55, block: true },
  { kind: 'bench', x: 18, z: 16, r: Math.PI / 2, w: .55, d: 1.5, block: true },
  { kind: 'bench', x: 26, z: 16, r: -Math.PI / 2, w: .55, d: 1.5, block: true },
  { kind: 'grandclock', x: 31.2, z: 1.2, r: 0, w: .7, d: .5, block: true, occlude: true },
  { kind: 'grandclock', x: 13.3, z: 1.2, r: 0, w: .7, d: .5, block: true, occlude: true },
  { kind: 'cupboard', x: 37, z: 0.95, r: 0, w: 1.7, d: .6, block: true, occlude: true },
  { kind: 'cupboard', x: 43.05, z: 24, r: -Math.PI / 2, w: .6, d: 1.7, block: true, occlude: true },
  { kind: 'chair', x: 25.6, z: 2.2, r: 2.6, w: .5, d: .5, block: true },
  { kind: 'chair', x: 26.8, z: 2.4, r: -2.4, w: .5, d: .5, block: true },
  { kind: 'desk', x: 26.2, z: 1.2, r: 0, w: 2.2, d: .8, block: true },
  { kind: 'fan', x: 28.8, z: 1.0, r: -.6, w: .5, d: .5, block: true },
  { kind: 'crates', x: 18, z: 29.5, r: .2, w: 1.6, d: 1.2, block: true, occlude: true },
  { kind: 'crates', x: 26, z: 26, r: -.3, w: 1.2, d: 1.2, block: true },
];
export const WALL_DECOR = [
  { kind: 'shield', i: 0, x: 0.55, z: 27, f: [1, 0] }, { kind: 'shield', i: 2, x: 0.55, z: 29.5, f: [1, 0] },
  { kind: 'shield', i: 4, x: 3, z: 31.45, f: [0, -1] }, { kind: 'shield', i: 6, x: 11, z: 31.45, f: [0, -1] },
  { kind: 'shield', i: 1, x: 13.65, z: 23, f: [-1, 0] }, { kind: 'shield', i: 3, x: 13.65, z: 17.2, f: [-1, 0] },
  { kind: 'shield', i: 5, x: 30.35, z: 9.5, f: [1, 0] }, { kind: 'shield', i: 7, x: 43.45, z: 3, f: [-1, 0] },
  { kind: 'camera', x: 14.4, z: 9.4, f: [1, 1] }, { kind: 'camera', x: 29.6, z: 22.6, f: [-1, -1] },
  { kind: 'camera', x: 0.6, z: 0.6, f: [1, 1] }, { kind: 'camera', x: 43.4, z: 31.4, f: [-1, -1] },
  { kind: 'camera', x: 43.4, z: 0.6, f: [-1, 1] }, { kind: 'camera', x: 0.6, z: 31.4, f: [1, -1] },
];
export const CHANDELIERS = [[22, 12.5], [22, 19.5], [7, 8], [7, 24], [37, 8], [37, 24], [22, 4.5]];
export const COINS = [[3, 2.5], [11, 2.5], [2.5, 14], [12, 14], [2.5, 17.5], [12.5, 24], [7, 30.5], [17, 6], [27, 6.5], [16, 11], [28, 21], [16, 19], [19, 26], [25, 29], [32, 2.5], [42, 2.5], [32, 13.5], [36.5, 14], [32, 17.5], [42, 18], [37, 30.5], [41.5, 24.5]];
export const SPAWNS = [{ x: 18, z: 4 }, { x: 26, z: 4 }, { x: 18, z: 27 }, { x: 26, z: 27.5 }, { x: 20, z: 6.5 }, { x: 24, z: 6.5 }, { x: 20, z: 25 }, { x: 24, z: 25 }];
export const DRONE_ROUTES = [
  [[7, 3.5], [7, 13], [3, 13], [7, 13], [7, 18.5], [7, 30], [12, 30], [7, 30], [7, 18.5], [7, 13]],
  [[17, 12], [27, 12], [27, 20], [17, 20]],
  [[37, 3.5], [37, 13], [42, 13], [37, 13], [37, 18.5], [37, 30], [32, 30], [37, 30], [37, 18.5], [37, 13]],
];
export const COLORS = ['#ffd23f', '#3ee6c4', '#ff6b6b', '#8f7bff', '#5fb7ff', '#ff8fd0', '#9cf06b', '#ff9f43'];
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

const cabBox = c => c.f[0] ? [c.x, c.z, 0.8, 1.3] : [c.x, c.z, 1.3, 0.8];
const caseBox = c => c.type === 'wall' ? null : c.big ? [c.x, c.z, 1.25, 1.25] : c.type === 'pedestal' ? [c.x, c.z, 1.1, .8] : [c.x, c.z, .9, .9];
const decorBox = d => d.w ? [d.x, d.z, d.w, d.d] : null;
// Препятствия для ходьбы игроков; окклюдеры для обзора.
export const SOLIDS = [...WALLS, ...BARRIERS, ...CABINETS.map(cabBox), ...CASES.map(caseBox).filter(Boolean), ...DECOR.filter(d => d.block).map(decorBox)];
export const OCCLUDERS = [...WALLS, ...CABINETS.map(cabBox), ...DECOR.filter(d => d.occlude).map(decorBox)];
export const FLY_SOLIDS = [...WALLS, ...BARRIERS, ...CABINETS.map(cabBox)];
// Ропы вокруг короны — тонкие стенки с проходом с юга.
SOLIDS.push([22, 14.4, 3.2, .12], [20.4, 16, .12, 3.2], [23.6, 16, .12, 3.2]);

export function segmentHit(ax, az, bx, bz, box) {
  const [x, z, w, d] = box; let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, q] of [[-dx, ax - (x - w / 2)], [dx, (x + w / 2) - ax], [-dz, az - (z - d / 2)], [dz, (z + d / 2) - az]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return null; } else { const t = q / p; if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); if (t0 > t1) return null; }
  }
  return t0;
}
export function lineOfSight(ax, az, bx, bz, list = OCCLUDERS) { for (const w of list) if (segmentHit(ax, az, bx, bz, w) !== null) return false; return true; }
export function inCone(p, q, fov = RULES.fov, range = RULES.range) {
  const dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz);
  if (dist > range) return false; if (dist < RULES.near) return true;
  return Math.abs(angleDiff(Math.atan2(dz, dx), p.angle)) <= fov / 2;
}
export function canSee(p, q, fov, range) { return inCone(p, q, fov, range) && lineOfSight(p.x, p.z, q.x, q.z); }
export function blocked(x, z, r = RULES.radius, list = SOLIDS) {
  for (const [wx, wz, w, d] of list) if (Math.hypot(x - clamp(x, wx - w / 2, wx + w / 2), z - clamp(z, wz - d / 2, wz + d / 2)) < r) return true;
  return false;
}
export function move(p, dx, dz, r = RULES.radius, list = SOLIDS) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
  for (let i = 0; i < n; i++) { if (!blocked(p.x + dx / n, p.z, r, list)) p.x += dx / n; if (!blocked(p.x, p.z + dz / n, r, list)) p.z += dz / n; }
}
export function visionPolygon(p, rays = 120) {
  const pts = [];
  // маленький круг вокруг себя
  for (let i = 0; i <= 16; i++) { const a = p.angle + RULES.fov / 2 + i / 16 * (2 * Math.PI - RULES.fov); pts.push([p.x + Math.cos(a) * RULES.near, p.z + Math.sin(a) * RULES.near]); }
  for (let i = 0; i <= rays; i++) {
    const a = p.angle - RULES.fov / 2 + i / rays * RULES.fov, bx = p.x + Math.cos(a) * RULES.range, bz = p.z + Math.sin(a) * RULES.range;
    let t = 1; for (const w of OCCLUDERS) { const h = segmentHit(p.x, p.z, bx, bz, w); if (h !== null && h < t) t = h; }
    t = Math.min(1, t + 0.012); pts.push([p.x + (bx - p.x) * t, p.z + (bz - p.z) * t]);
  }
  return pts;
}
// Навигационная сетка 0.5 м для ботов и дронов.
const CELL = 0.5, GW = WORLD.width / CELL, GH = WORLD.height / CELL;
function makeGrid(r, list) { const g = new Uint8Array(GW * GH); for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) g[j * GW + i] = blocked((i + .5) * CELL, (j + .5) * CELL, r, list) ? 0 : 1; return g; }
let GRIDS = null;
function grids() { return GRIDS ||= { walk: makeGrid(0.42, SOLIDS), fly: makeGrid(0.4, FLY_SOLIDS) }; }
export function route(from, to, mode = 'walk') {
  const g = grids()[mode], list = mode === 'fly' ? FLY_SOLIDS : SOLIDS;
  const ci = v => clamp(Math.floor(v / CELL), 0, GW - 1), cj = v => clamp(Math.floor(v / CELL), 0, GH - 1);
  const near = (i, j) => { if (g[j * GW + i]) return [i, j]; for (let r = 1; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < GW && b < GH && g[b * GW + a]) return [a, b]; } return [i, j]; };
  const [si, sj] = near(ci(from.x), cj(from.z)), [ti, tj] = near(ci(to.x), cj(to.z));
  const start = sj * GW + si, goal = tj * GW + ti, prev = new Int32Array(GW * GH).fill(-1); prev[start] = start;
  const q = [start]; let found = start === goal;
  for (let k = 0; k < q.length && !found; k++) {
    const c = q[k], i = c % GW, j = (c / GW) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= GW || b >= GH) continue; const n = b * GW + a;
      if (prev[n] !== -1 || !g[n]) continue; if (di && dj && (!g[j * GW + a] || !g[b * GW + i])) continue;
      prev[n] = c; if (n === goal) { found = true; break; } q.push(n);
    }
  }
  if (!found) return [];
  const cells = []; for (let c = goal; c !== start; c = prev[c]) cells.unshift(c);
  const pts = cells.map(c => ({ x: (c % GW + .5) * CELL, z: (((c / GW) | 0) + .5) * CELL }));
  if (pts.length) pts[pts.length - 1] = { x: to.x, z: to.z };
  // сглаживание: пропускаем точки, если путь прямой и свободный
  const out = []; let cur = from;
  for (let k = 0; k < pts.length; k++) {
    let far = k; for (let m = Math.min(pts.length - 1, k + 12); m > k; m--) if (clearPath(cur, pts[m], mode === 'fly' ? .38 : .4, list)) { far = m; break; }
    out.push(pts[far]); cur = pts[far]; k = far;
  }
  return out;
}
function clearPath(a, b, r, list) { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / .25); for (let i = 1; i <= n; i++) if (blocked(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n, r, list)) return false; return true; }
export function interactPoint(c) { // точка, где должен стоять игрок
  if (c.f) return { x: c.x + c.f[0] * 0.95, z: c.z + c.f[1] * 0.95 };
  return { x: c.x, z: c.z };
}
export function caseReach(c, p) {
  if (c.type === 'wall') { const ip = interactPoint(c); return Math.hypot(p.x - ip.x, p.z - ip.z) < 1.1; }
  const half = c.big ? .62 : c.type === 'pedestal' ? .55 : .45;
  const dx = Math.max(0, Math.abs(p.x - c.x) - half), dz = Math.max(0, Math.abs(p.z - c.z) - half);
  return Math.hypot(dx, dz) < (c.big ? 0.75 : 0.62);
}
export function cabinetReach(h, p) { const ip = interactPoint(h); return Math.hypot(p.x - ip.x, p.z - ip.z) < 1.0; }
