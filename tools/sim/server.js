const sig = () => { const subs = []; return { subscribe: (f) => (subs.push(f), f), fire: (e) => subs.forEach((f) => f(e)) }; };
export const timers = []; export let tick = 0;
export const system = {
  get currentTick() { return tick; },
  runTimeout: (f, t = 0) => { timers.push({ at: tick + t, f }); return 1; },
  runInterval: (f, t = 1) => { timers.push({ every: t, f }); return 1; },
};
export function advance(n) { for (let i = 0; i < n; i++) { tick++; for (const t of [...timers]) { if (t.every ? tick % t.every === 0 : t.at === tick) { t.f(); if (!t.every) timers.splice(timers.indexOf(t), 1); } } } }
export const players = [];
const objectives = new Map();
export const world = {
  afterEvents: { entityDie: sig(), entityHurt: sig(), playerSpawn: sig(), playerLeave: sig(), worldLoad: sig(), itemUse: sig(), itemCompleteUse: sig(), projectileHitEntity: sig(), projectileHitBlock: sig() },
  getAllPlayers: () => players,
  scoreboard: {
    getObjective: (n) => objectives.get(n), addObjective: (n) => { const o = { scores: new Map(), setScore(p, v) { this.scores.set(p.id, v); } }; objectives.set(n, o); return o; },
    setObjectiveAtDisplaySlot: () => {}, objectives,
  },
};
export const DisplaySlotId = { BelowName: "BelowName" };
export const EntityDamageCause = { entityAttack: "entityAttack", magic: "magic" };
export const Direction = { Up: "Up", Down: "Down", North: "North", South: "South", East: "East", West: "West" };
export const EquipmentSlot = { Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet", Mainhand: "Mainhand" };
export const GameMode = { Creative: "Creative" };
export const emitted = [];
export class MolangVariableMap { constructor() { this.v = {}; } setColorRGB(k, c) { this.v[k] = c; } setFloat(k, n) { this.v[k] = n; } }
export class ItemStack { constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; } }
