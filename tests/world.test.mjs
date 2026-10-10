import test from 'node:test'; import assert from 'node:assert/strict';
import { canSee, move, blocked, route, lineOfSight, visionPolygon, CASES, CABINETS, EXITS, SPAWNS, COINS, interactPoint, caseReach, cabinetReach, RULES, WORLD } from '../packages/shared/world.mjs';

test('обзор только в сторону взгляда', () => {
  const p = { x: 22, z: 8, angle: 0 };
  assert(canSee(p, { x: 24, z: 8 }));
  assert(!canSee(p, { x: 20, z: 8 }), 'сзади не видно');
  assert(!canSee(p, { x: 22 + RULES.range + 1, z: 8 }), 'дальше дальности не видно');
});
test('стены закрывают видимость', () => {
  // наружная стена: за пределами карты ничего не видно
  assert(!lineOfSight(10, 2, 10, -3)); assert(lineOfSight(22, 2, 22, -3), 'через проём выхода видно');
  const poly = visionPolygon({ x: 10, z: 3, angle: -Math.PI / 2 });
  assert(poly.length > 10); for (const [x, z] of poly) assert(z > -0.5, 'луч обрезан стеной');
});
test('нельзя пройти сквозь стену даже рывком', () => {
  const p = { x: 22, z: 1.5 }; for (let i = 0; i < 20; i++) move(p, 0.3, -0.6);
  assert(p.z > -0.5 && !blocked(p.x, p.z) || p.z < -0.5, 'игрок не застрял в стене');
});
test('все витрины, шкафы, монеты и выходы достижимы со всех спавнов', () => {
  for (const s of SPAWNS) {
    for (const c of CASES) { const ip = c.type === 'wall' ? interactPoint(c) : null; const goal = ip || { x: c.x, z: c.z + (c.big ? 1.05 : .85) }; const r = route(s, goal); assert(r.length > 0, `витрина ${c.id}`); assert(caseReach(c, r.at(-1)) || c.type !== 'wall', `можно дотянуться до ${c.id}`); }
    for (const h of CABINETS) { const ip = interactPoint(h); assert(route(s, ip).length > 0, `шкаф ${h.id}`); assert(cabinetReach(h, ip)); }
    for (const e of EXITS) assert(route(s, { x: e.x, z: e.z }).length > 0, `выход ${e.name}`);
  }
  for (const [x, z] of COINS) assert(route(SPAWNS[0], { x, z }).length > 0 && !blocked(x, z), `монета ${x},${z}`);
});
test('объекты внутри карты', () => {
  for (const c of [...CASES, ...CABINETS]) assert(c.x >= 0 && c.x <= WORLD.width && c.z >= 0 && c.z <= WORLD.height);
  assert.equal(RULES.hideTime, 5);
});
