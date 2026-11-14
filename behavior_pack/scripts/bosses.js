// Overlord: Tomb of Nazarick - boss fights.
//
// Every boss of the add-on (the Floor Guardians and Ainz, the great demons and angels, the world
// bosses, the arena champions; the three dragons keep their own staged fights in dragons.js) now
// fights in phases. Its moves are telegraphed: a warning on the screen of everyone near and glowing
// circles or lines on the ground, then - after a second or two - the blow lands on whoever is still
// standing there. At two-thirds and one-third of its health a boss changes phase: it throws back
// those close to it, may call allies, adds harder moves, and in its last phase it is enraged. Some
// moves leave burning, freezing or poisoned ground behind. A fallen boss pays out gear materials to
// everyone who fought it, and the first time you defeat each boss a Codex of the Supreme Beings.
import { world, system, EntityDamageCause } from "@minecraft/server";
import { giveItem, notify, profileOf, touch } from "./rpg.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * A move. Shapes: `slam` (a circle round the boss), `ring` (a band from `inner` to `radius`, safe close
 * in), `line` (`lines` lines from the boss towards its target, fanned or crossed), `barrage` (a circle
 * under every player near and a few more about), `pull` (drags players in, then a slam), `blink` (the
 * boss appears behind its target and strikes round itself), `summon` (calls `count` of `type`).
 * `hazard` makes the struck ground linger for that many seconds.
 * @typedef {{
 *   name: string, shape: "slam" | "ring" | "line" | "barrage" | "pull" | "blink" | "summon",
 *   power: number, radius?: number, inner?: number, length?: number, lines?: number, count?: number,
 *   type?: string, delay?: number, hazard?: number, element?: string,
 * }} Move
 * @typedef {{ name: string, element: string, damage: number, moves: Move[][], adds?: [string, number][], first?: boolean }} Boss
 * `moves[n]` are the moves added in phase n (0, 1, 2); `adds` are called at each change of phase.
 */

/** @type {Record<string, Boss>} */
export const BOSSES = {
  ainz: {
    name: "Ainz Ooal Gown", element: "dark", damage: 14, adds: [[id("death_knight"), 2]],
    moves: [
      [{ name: "Reality Slash", shape: "line", power: 1.4, length: 18, element: "arcane" }, { name: "Negative Burst", shape: "slam", power: 1.1, radius: 6 }],
      [{ name: "Explode Mine", shape: "barrage", power: 1.0, radius: 2.5, count: 4, element: "fire" }, { name: "Black Hole", shape: "pull", power: 1.2, radius: 9 }],
      [{ name: "The Goal of All Life Is Death", shape: "slam", power: 2.2, radius: 10, delay: 55 }, { name: "Grasp Heart", shape: "blink", power: 1.3, radius: 3.5 }],
    ],
  },
  albedo: {
    name: "Albedo", element: "dark", damage: 14,
    moves: [
      [{ name: "Bardiche Charge", shape: "line", power: 1.3, length: 14 }, { name: "Hermes Trismegistus", shape: "slam", power: 1.0, radius: 5 }],
      [{ name: "Walls of Jericho", shape: "ring", power: 1.3, inner: 3, radius: 9 }],
      [{ name: "Avenger's Leap", shape: "blink", power: 1.5, radius: 4 }, { name: "Three-Fold Cleave", shape: "line", power: 1.2, length: 12, lines: 3 }],
    ],
  },
  shalltear: {
    name: "Shalltear Bloodfallen", element: "dark", damage: 12, adds: [[id("vampire_bride"), 2]],
    moves: [
      [{ name: "Spuit Lance Charge", shape: "line", power: 1.3, length: 16 }, { name: "Blood Pool", shape: "slam", power: 1.0, radius: 5, hazard: 6 }],
      [{ name: "Vampiric Blink", shape: "blink", power: 1.3, radius: 3.5 }],
      [{ name: "Purification Javelin", shape: "barrage", power: 1.4, radius: 2.5, count: 5, element: "holy" }, { name: "Einherjar", shape: "line", power: 1.1, length: 14, lines: 4 }],
    ],
  },
  cocytus: {
    name: "Cocytus", element: "ice", damage: 13,
    moves: [
      [{ name: "Frozen Heaven", shape: "slam", power: 1.1, radius: 6 }, { name: "Halberd Sweep", shape: "line", power: 1.1, length: 10, lines: 3 }],
      [{ name: "Field of Frost", shape: "barrage", power: 0.8, radius: 3, count: 4, hazard: 8 }],
      [{ name: "Absolute Zero", shape: "ring", power: 1.6, inner: 2.5, radius: 10 }, { name: "Four-Armed Fury", shape: "line", power: 1.3, length: 12, lines: 4 }],
    ],
  },
  demiurge: {
    name: "Demiurge", element: "fire", damage: 10, adds: [[id("shadow_demon"), 2]],
    moves: [
      [{ name: "Hellfire Rain", shape: "barrage", power: 1.0, radius: 2.5, count: 4 }, { name: "Commanding Voice", shape: "pull", power: 0.8, radius: 8 }],
      [{ name: "Hellflame Wall", shape: "line", power: 1.2, length: 14, lines: 3, hazard: 6 }],
      [{ name: "Gehenna Flame", shape: "ring", power: 1.5, inner: 3, radius: 11, hazard: 6 }],
    ],
  },
  aura: {
    name: "Aura Bella Fiora", element: "acid", damage: 9, adds: [[id("gigant_basilisk"), 1]],
    moves: [
      [{ name: "Whip Lash", shape: "line", power: 1.1, length: 10 }, { name: "Volley", shape: "barrage", power: 0.9, radius: 2.5, count: 3 }],
      [{ name: "Beast Stampede", shape: "line", power: 1.2, length: 16, lines: 3 }],
      [{ name: "Breath of Fear", shape: "slam", power: 1.3, radius: 8, hazard: 6 }],
    ],
  },
  mare: {
    name: "Mare Bello Fiore", element: "acid", damage: 8,
    moves: [
      [{ name: "Earth Surge", shape: "ring", power: 1.1, inner: 2.5, radius: 8 }, { name: "Fissure", shape: "line", power: 1.2, length: 14 }],
      [{ name: "Thorn Garden", shape: "barrage", power: 0.9, radius: 3, count: 4, hazard: 8 }],
      [{ name: "Great Upheaval", shape: "slam", power: 1.6, radius: 9 }],
    ],
  },
  pandoras_actor: {
    name: "Pandora's Actor", element: "arcane", damage: 11,
    moves: [
      [{ name: "Borrowed Burst", shape: "slam", power: 1.0, radius: 6, element: "dark" }, { name: "Borrowed Lance", shape: "line", power: 1.2, length: 14, element: "dark" }],
      [{ name: "Shapeshift Ambush", shape: "blink", power: 1.3, radius: 3.5 }],
      [{ name: "Grand Performance", shape: "barrage", power: 1.2, radius: 3, count: 6 }],
    ],
  },
  gargantua: {
    name: "Gargantua", element: "none", damage: 18,
    moves: [
      [{ name: "Titan Stomp", shape: "slam", power: 1.0, radius: 7 }, { name: "Boulder Charge", shape: "line", power: 1.2, length: 14 }],
      [{ name: "Quake Wave", shape: "ring", power: 1.2, inner: 3, radius: 10 }],
      [{ name: "Rockfall", shape: "barrage", power: 1.0, radius: 3, count: 6 }],
    ],
  },
  rubedo: {
    name: "Rubedo", element: "arcane", damage: 18, adds: [[id("death_knight"), 2]],
    moves: [
      [{ name: "Annihilation Ray", shape: "line", power: 1.3, length: 20, lines: 1 }, { name: "Shatter", shape: "slam", power: 1.1, radius: 6 }],
      [{ name: "Starfall", shape: "barrage", power: 1.1, radius: 3, count: 6 }, { name: "Collapse", shape: "pull", power: 1.2, radius: 10 }],
      [{ name: "World's End", shape: "ring", power: 1.8, inner: 3, radius: 12, hazard: 6 }, { name: "Cross of Ruin", shape: "line", power: 1.3, length: 16, lines: 4 }, { name: "Phase Step", shape: "blink", power: 1.4, radius: 4 }],
    ],
  },
  jaldabaoth: {
    name: "Jaldabaoth", element: "fire", damage: 16, adds: [[id("shadow_demon"), 2]],
    moves: [
      [{ name: "Meteor Fall", shape: "barrage", power: 1.0, radius: 3, count: 4 }, { name: "Infernal Claw", shape: "line", power: 1.2, length: 12, lines: 3 }],
      [{ name: "Gehenna", shape: "ring", power: 1.4, inner: 3, radius: 11, hazard: 6 }],
      [{ name: "Demon Emperor's Wrath", shape: "slam", power: 2.0, radius: 9, delay: 50, hazard: 8 }, { name: "Cross of Flames", shape: "line", power: 1.3, length: 16, lines: 4 }],
    ],
  },
  evil_lord_wrath: {
    name: "Evil Lord Wrath", element: "fire", damage: 14,
    moves: [
      [{ name: "Wrathful Slam", shape: "slam", power: 1.1, radius: 6 }, { name: "Burning Charge", shape: "line", power: 1.2, length: 14 }],
      [{ name: "Brimstone", shape: "barrage", power: 1.0, radius: 3, count: 4, hazard: 6 }],
      [{ name: "Inferno", shape: "ring", power: 1.5, inner: 3, radius: 10 }],
    ],
  },
  zytl_qae: {
    name: "Zy'tl Q'ae, the Destroyer Tree", element: "acid", damage: 20, adds: [[id("treant_sapling"), 2]],
    moves: [
      [{ name: "Root Eruption", shape: "ring", power: 1.1, inner: 2, radius: 9 }, { name: "Vine Lash", shape: "line", power: 1.2, length: 16 }],
      [{ name: "Seed Barrage", shape: "barrage", power: 1.0, radius: 3, count: 6, hazard: 8 }, { name: "Uprooting Grasp", shape: "pull", power: 1.1, radius: 12 }],
      [{ name: "Fall of the World Tree", shape: "slam", power: 2.0, radius: 11, delay: 50 }, { name: "Saplings Awaken", shape: "summon", power: 1.0, radius: 6, type: id("treant_sapling"), count: 3 }],
    ],
  },
  quagoa_warlord: {
    name: "Quagoa Warlord", element: "none", damage: 14, adds: [[id("quagoa"), 2]],
    moves: [
      [{ name: "Burrowing Charge", shape: "line", power: 1.1, length: 12 }, { name: "Pick Slam", shape: "slam", power: 1.2, radius: 5 }],
      [{ name: "Cave-In", shape: "barrage", power: 1.0, radius: 2.5, count: 5, hazard: 6 }, { name: "Clan Muster", shape: "summon", power: 1, radius: 5, type: id("quagoa"), count: 3 }],
      [{ name: "Tremor of the Deep", shape: "ring", power: 1.4, inner: 2.5, radius: 9 }, { name: "Ambush from Below", shape: "blink", power: 1.3, radius: 3.5 }],
    ],
  },
  rune_golem: {
    name: "Rune Golem of the Royal Forge", element: "lightning", damage: 18,
    moves: [
      [{ name: "Anvil Fall", shape: "slam", power: 1.2, radius: 6 }, { name: "Rune Beam", shape: "line", power: 1.2, length: 16 }],
      [{ name: "Runic Lattice", shape: "line", power: 1.2, length: 14, lines: 4 }, { name: "Forge Magnet", shape: "pull", power: 1.0, radius: 11 }],
      [{ name: "Overcharged Core", shape: "ring", power: 1.5, inner: 3, radius: 10, hazard: 6 }, { name: "Storm of Runes", shape: "barrage", power: 1.1, radius: 3, count: 6 }],
    ],
  },
  dark_young: {
    name: "Dark Young", element: "acid", damage: 14,
    moves: [
      [{ name: "Grasping Tendrils", shape: "pull", power: 1.0, radius: 9 }, { name: "Trample", shape: "line", power: 1.2, length: 12 }],
      [{ name: "Spore Bloom", shape: "barrage", power: 0.9, radius: 3, count: 5, hazard: 8 }],
      [{ name: "Black Goat's Feast", shape: "slam", power: 1.7, radius: 9, element: "dark" }],
    ],
  },
  decem: {
    name: "Decem Hougan", element: "acid", damage: 12, adds: [[id("behemoth"), 1]],
    moves: [
      [{ name: "Elemental Rain", shape: "barrage", power: 1.0, radius: 2.5, count: 4 }, { name: "Root Spear", shape: "line", power: 1.1, length: 14 }],
      [{ name: "Wild Growth", shape: "ring", power: 1.2, inner: 2.5, radius: 9, hazard: 6 }],
      [{ name: "King's Command", shape: "line", power: 1.3, length: 16, lines: 4 }],
    ],
  },
  zesshi: {
    name: "Zesshi Zetsumei", element: "dark", damage: 16,
    moves: [
      [{ name: "Scythe Reap", shape: "slam", power: 1.1, radius: 5 }, { name: "Godspeed", shape: "blink", power: 1.2, radius: 3.5 }],
      [{ name: "Scythe Cross", shape: "line", power: 1.3, length: 14, lines: 4 }],
      [{ name: "Antilife Cocoon", shape: "ring", power: 1.6, inner: 2.5, radius: 10 }, { name: "Final Judgement", shape: "barrage", power: 1.2, radius: 3, count: 5 }],
    ],
  },
  dominion_authority: {
    name: "Dominion Authority", element: "holy", damage: 12, adds: [[id("archangel_flame"), 2]],
    moves: [
      [{ name: "Holy Smite", shape: "barrage", power: 1.0, radius: 2.5, count: 4 }, { name: "Sacred Ring", shape: "ring", power: 1.1, inner: 2.5, radius: 8 }],
      [{ name: "Scepter Beam", shape: "line", power: 1.3, length: 18 }],
      [{ name: "Judgement Day", shape: "slam", power: 1.8, radius: 10, delay: 50 }],
    ],
  },
  go_gin: {
    name: "Go Gin", element: "none", damage: 14,
    moves: [
      [{ name: "Club Slam", shape: "slam", power: 1.1, radius: 5 }, { name: "Bull Rush", shape: "line", power: 1.2, length: 12 }],
      [{ name: "Ground Pound", shape: "ring", power: 1.2, inner: 2.5, radius: 8 }],
      [{ name: "Arena Rocks", shape: "barrage", power: 1.0, radius: 3, count: 4 }],
    ],
  },
  zero: {
    name: "Zero", element: "none", damage: 12,
    moves: [
      [{ name: "Leopard Rush", shape: "line", power: 1.2, length: 12 }, { name: "Phoenix Palm", shape: "blink", power: 1.2, radius: 3 }],
      [{ name: "Spirit Burst", shape: "slam", power: 1.2, radius: 6 }],
      [{ name: "Six Arms Fury", shape: "line", power: 1.2, length: 10, lines: 4 }],
    ],
  },
};

/** At what share of its health a boss moves to its second and third phase. */
export const PHASES = [0.66, 0.33];
/** Seconds between moves in each phase. */
const CADENCE = [7, 5.5, 4];
const RANGE = 28; // a boss acts only with a player this close
const WARN = 34; // ticks between the warning and the blow, unless a move says otherwise

// ------------------------------------------------------------------ state

/**
 * @typedef {{ entity: Entity, key: string, phase: number, next: number, pending: Pending | undefined, seen: Set<string> }} Fight
 * @typedef {{ move: Move, at: number, spots: Vector3[], lines: { from: Vector3, dir: Vector3 }[] }} Pending
 * @typedef {{ dimension: import("@minecraft/server").Dimension, at: Vector3, radius: number, until: number, damage: number, element: string, boss: Entity }} Hazard
 */
/** @type {Map<string, Fight>} */
export const fights = new Map();
/** @type {Hazard[]} */
export const hazards = [];

/** The boss entry of an entity, if it is one. @param {Entity} entity */
export function bossOf(entity) {
  if (!entity.typeId.startsWith(`${NS}:`)) return undefined;
  const key = entity.typeId.slice(NS.length + 1);
  return BOSSES[key] ? key : undefined;
}

/** @param {Entity} entity */
function share(entity) {
  try {
    const health = entity.getComponent("minecraft:health");
    return health && health.effectiveMax > 0 ? health.currentValue / health.effectiveMax : 1;
  } catch {
    return 1;
  }
}

/** Players near a spot. @param {Entity} boss @param {number} radius */
function playersNear(boss, radius, at = boss.location) {
  try {
    return boss.dimension.getPlayers({ location: at, maxDistance: radius }).filter((p) => p.isValid);
  } catch {
    return [];
  }
}

/** Shows a title to every player near a boss. @param {Entity} boss @param {string} title @param {string} subtitle */
function announce(boss, title, subtitle) {
  for (const player of playersNear(boss, 48)) {
    try {
      player.onScreenDisplay.setTitle(title, { subtitle, fadeInDuration: 4, stayDuration: 40, fadeOutDuration: 10 });
    } catch {
      // the player left
    }
  }
}

/** @param {Vector3} a @param {Vector3} b @param {number} [scale] */
function add(a, b, scale = 1) {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale };
}

/** @param {Entity} boss @param {Player} player @param {number} amount */
function hurt(boss, player, amount) {
  try {
    player.applyDamage(amount, { cause: EntityDamageCause.magic, damagingEntity: boss });
  } catch {
    // the player left or is in creative mode
  }
}

/** Distance from a point to a segment on the ground. @param {Vector3} p @param {Vector3} from @param {Vector3} dir @param {number} length */
function offLine(p, from, dir, length) {
  const t = Math.max(0, Math.min(length, (p.x - from.x) * dir.x + (p.z - from.z) * dir.z));
  return Math.hypot(p.x - (from.x + dir.x * t), p.z - (from.z + dir.z * t));
}

// ------------------------------------------------------------------ the fight

/** Registers a boss the first time it is seen. @param {Entity} entity */
export function engage(entity) {
  const key = bossOf(entity);
  if (!key || fights.has(entity.id)) return fights.get(entity.id);
  /** @type {Fight} */
  const fight = { entity, key, phase: 0, next: system.currentTick + 4 * TICKS, pending: undefined, seen: new Set() };
  fights.set(entity.id, fight);
  return fight;
}

/** The moves a boss can use in its current phase. @param {Fight} fight */
export function movesOf(fight) {
  return BOSSES[fight.key].moves.slice(0, fight.phase + 1).flat();
}

/**
 * One step of a fight: a change of phase, a blow that is due, or a new move.
 * @param {Fight} fight @param {number} now @param {() => number} [random]
 */
export function step(fight, now, random = Math.random) {
  const boss = fight.entity;
  const info = BOSSES[fight.key];
  const near = playersNear(boss, RANGE);
  for (const p of near) fight.seen.add(p.id);
  const health = share(boss);
  while (fight.phase < PHASES.length && health <= PHASES[fight.phase]) changePhase(fight);
  if (fight.phase >= 2 && now % (2 * TICKS) === 0) fx.puff(boss.dimension, "flame_linger", add(boss.location, { x: 0, y: 1.2, z: 0 }), info.element, 1.2);
  if (fight.pending) {
    const pending = fight.pending;
    if (now >= pending.at) {
      fight.pending = undefined;
      resolve(fight, pending);
    } else if ((pending.at - now) % 8 === 0) warn(boss, pending, info);
    return;
  }
  if (near.length === 0 || now < fight.next) return;
  const moves = movesOf(fight);
  const move = moves[Math.floor(random() * moves.length)];
  const target = near[Math.floor(random() * near.length)];
  begin(fight, move, target, now, random);
  fight.next = now + Math.round(CADENCE[fight.phase] * TICKS) + (move.delay ?? WARN);
}

/** @param {Fight} fight */
function changePhase(fight) {
  fight.phase += 1;
  const boss = fight.entity;
  const info = BOSSES[fight.key];
  const last = fight.phase >= PHASES.length;
  announce(boss, `§c${info.name}`, last ? "§4Enraged!" : `§6Phase ${fight.phase + 1}`);
  const d = boss.dimension;
  try {
    boss.addEffect("resistance", 2 * TICKS, { amplifier: 4, showParticles: false }); // a moment's respite while it changes
    if (last) {
      boss.addEffect("strength", 20000000, { amplifier: 0, showParticles: false });
      boss.addEffect("speed", 20000000, { amplifier: 0, showParticles: false });
    }
  } catch {
    // the boss is unloading
  }
  fx.pillar(d, boss.location, info.element, 6);
  fx.nova(d, add(boss.location, { x: 0, y: 1, z: 0 }), info.element, 5);
  fx.shake(d, boss.location, 16, 0.4, 0.5);
  for (const p of playersNear(boss, 5)) {
    try {
      const dx = p.location.x - boss.location.x;
      const dz = p.location.z - boss.location.z;
      const length = Math.hypot(dx, dz) || 1;
      p.applyKnockback({ x: (dx / length) * 1.6, z: (dz / length) * 1.6 }, 0.45);
    } catch {
      // cannot be moved
    }
  }
  for (const [type, count] of info.adds ?? []) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      try {
        const add_ = d.spawnEntity(type, { x: boss.location.x + Math.cos(a) * 3, y: boss.location.y, z: boss.location.z + Math.sin(a) * 3 });
        add_.addTag("overlord_boss_add");
        fx.rise(d, add_.location, info.element, 0.9);
      } catch {
        // no room
      }
    }
  }
  fight.next = system.currentTick + 2 * TICKS;
  fight.pending = undefined;
}

/**
 * Starts a move: picks where it will land and warns everyone.
 * @param {Fight} fight @param {Move} move @param {Player} target @param {number} now @param {() => number} random
 */
function begin(fight, move, target, now, random) {
  const boss = fight.entity;
  const info = BOSSES[fight.key];
  /** @type {Pending} */
  const pending = { move, at: now + (move.delay ?? WARN), spots: [], lines: [] };
  if (move.shape === "summon") {
    pending.at = now;
  } else if (move.shape === "barrage") {
    for (const p of playersNear(boss, RANGE)) pending.spots.push({ ...p.location });
    for (let i = pending.spots.length; i < (move.count ?? 3); i++) {
      const a = random() * Math.PI * 2;
      const r = 3 + random() * 7;
      pending.spots.push({ x: boss.location.x + Math.cos(a) * r, y: boss.location.y, z: boss.location.z + Math.sin(a) * r });
    }
  } else if (move.shape === "line") {
    const dx = target.location.x - boss.location.x;
    const dz = target.location.z - boss.location.z;
    const base = Math.atan2(dz, dx);
    const count = move.lines ?? 1;
    for (let i = 0; i < count; i++) {
      const angle = count === 4 ? base + (i * Math.PI) / 2 : base + (i - (count - 1) / 2) * 0.45;
      pending.lines.push({ from: { ...boss.location }, dir: { x: Math.cos(angle), y: 0, z: Math.sin(angle) } });
    }
  } else if (move.shape === "blink") {
    // It will appear behind its target: the circle is drawn there.
    let view = { x: 0, y: 0, z: 1 };
    try {
      view = target.getViewDirection();
    } catch {
      // keep the default
    }
    const length = Math.hypot(view.x, view.z) || 1;
    pending.spots.push({ x: target.location.x - (view.x / length) * 2, y: target.location.y, z: target.location.z - (view.z / length) * 2 });
    pending.at = now + Math.min(move.delay ?? WARN, 22); // a blink gives less warning
  } else if (move.shape === "pull") {
    for (const p of playersNear(boss, move.radius ?? 8)) {
      try {
        const dx = boss.location.x - p.location.x;
        const dz = boss.location.z - p.location.z;
        const length = Math.hypot(dx, dz) || 1;
        p.applyKnockback({ x: (dx / length) * 1.3, z: (dz / length) * 1.3 }, 0.2);
      } catch {
        // cannot be moved
      }
    }
  }
  fight.pending = pending;
  for (const p of playersNear(boss, 40)) {
    try {
      notify(p, `§c${info.name}: §e${move.name}!`);
    } catch {
      // the player left
    }
  }
  try {
    boss.dimension.playSound("mob.evocation_illager.prepare_attack", boss.location, { volume: 1.2, pitch: 0.7 });
  } catch {
    // cosmetic only
  }
  warn(boss, pending, info);
}

/** Draws the warning of a move that is coming. @param {Entity} boss @param {Pending} pending @param {Boss} info */
function warn(boss, pending, info) {
  const d = boss.dimension;
  const move = pending.move;
  const element = move.element ?? info.element;
  if (move.shape === "slam" || move.shape === "pull") {
    fx.circle(d, boss.location, element, move.radius ?? 6);
  } else if (move.shape === "ring") {
    fx.ring(d, boss.location, element, move.radius ?? 8);
    fx.circle(d, boss.location, "none", move.inner ?? 2.5); // the safe ground stays pale
  } else if (move.shape === "barrage" || move.shape === "blink") {
    for (const spot of pending.spots) fx.circle(d, spot, element, move.radius ?? 3);
  } else if (move.shape === "line") {
    for (const line of pending.lines) {
      for (let s = 1.5; s <= (move.length ?? 12); s += 3) fx.circle(d, add(line.from, line.dir, s), element, 1.2);
    }
  }
}

/** The blow falls. @param {Fight} fight @param {Pending} pending */
function resolve(fight, pending) {
  const boss = fight.entity;
  if (!boss.isValid) return;
  const info = BOSSES[fight.key];
  const move = pending.move;
  const element = move.element ?? info.element;
  const damage = info.damage * move.power;
  const d = boss.dimension;
  /** @type {Vector3[]} */
  const leave = [];
  if (move.shape === "summon") {
    for (let i = 0; i < (move.count ?? 1); i++) {
      try {
        d.spawnEntity(move.type ?? id("old_guarder"), add(boss.location, { x: i - 1, y: 0, z: 1 })).addTag("overlord_boss_add");
      } catch {
        // no room
      }
    }
    return;
  }
  if (move.shape === "slam" || move.shape === "pull") {
    for (const p of playersNear(boss, move.radius ?? 6)) hurt(boss, p, damage);
    fx.nova(d, boss.location, element, move.radius ?? 6);
    fx.shake(d, boss.location, (move.radius ?? 6) + 8, 0.35, 0.4);
    leave.push({ ...boss.location });
  } else if (move.shape === "ring") {
    const inner = move.inner ?? 2.5;
    for (const p of playersNear(boss, move.radius ?? 8)) {
      if (Math.hypot(p.location.x - boss.location.x, p.location.z - boss.location.z) >= inner) hurt(boss, p, damage);
    }
    fx.ring(d, boss.location, element, move.radius ?? 8);
    fx.nova(d, boss.location, element, inner);
    fx.shake(d, boss.location, (move.radius ?? 8) + 6, 0.3, 0.4);
  } else if (move.shape === "barrage") {
    for (const spot of pending.spots) {
      for (const p of playersNear(boss, move.radius ?? 3, spot)) hurt(boss, p, damage);
      fx.fall(d, spot, element, 6);
      system.runTimeout(() => fx.nova(d, spot, element, move.radius ?? 3), 6);
      leave.push(spot);
    }
  } else if (move.shape === "line") {
    const length = move.length ?? 12;
    const hit = new Set();
    for (const line of pending.lines) {
      for (const p of playersNear(boss, length + 2, line.from)) {
        if (hit.has(p.id) || offLine(p.location, line.from, line.dir, length) > 1.6) continue;
        hit.add(p.id);
        hurt(boss, p, damage);
      }
      fx.beam(d, add(line.from, { x: 0, y: 1, z: 0 }), add(add(line.from, line.dir, length), { x: 0, y: 1, z: 0 }), element, 1.6);
      for (let s = 2; s <= length; s += 4) leave.push(add(line.from, line.dir, s));
    }
  } else if (move.shape === "blink") {
    const spot = pending.spots[0];
    try {
      boss.teleport(spot, { checkForBlocks: true });
    } catch {
      // no room behind the target: it strikes from where it stands
    }
    fx.blink(d, boss.location, spot, element);
    for (const p of playersNear(boss, move.radius ?? 3.5, spot)) hurt(boss, p, damage);
    fx.nova(d, spot, element, move.radius ?? 3.5);
  }
  if (move.hazard) {
    for (const at of leave) hazards.push({ dimension: d, at, radius: move.shape === "barrage" ? (move.radius ?? 3) : 2.5, until: system.currentTick + move.hazard * TICKS, damage: info.damage * 0.15, element, boss });
  }
  fx.light(d, add(boss.location, { x: 0, y: 1, z: 0 }), 14, 8);
}

/** Burning, freezing or poisoned ground hurts whoever stands on it. @param {number} now */
export function tickHazards(now) {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    if (now >= h.until || !h.boss.isValid) {
      hazards.splice(i, 1);
      continue;
    }
    fx.afterglow(h.dimension, h.at, h.element, h.radius);
    try {
      for (const p of h.dimension.getPlayers({ location: h.at, maxDistance: h.radius })) hurt(h.boss, p, h.damage);
    } catch {
      // the ground is unloading
    }
  }
}

/** Finds bosses near players, every two seconds. */
function scan() {
  for (const player of world.getAllPlayers()) {
    try {
      for (const entity of player.dimension.getEntities({ location: player.location, maxDistance: 40, families: ["monster"] })) {
        if (bossOf(entity)) engage(entity);
      }
    } catch {
      // the player is changing dimension
    }
  }
}

system.runInterval(() => {
  const now = system.currentTick;
  if (now % (2 * TICKS) === 0) scan();
  for (const [key, fight] of fights) {
    if (!fight.entity.isValid) {
      fights.delete(key);
      continue;
    }
    try {
      step(fight, now);
    } catch {
      // the boss is unloading
    }
  }
  if (now % 10 === 0) tickHazards(now);
}, 2);

// ------------------------------------------------------------------ rewards

/** Gear materials a boss leaves to each of its foes. */
export const GEMS = ["ruby", "sapphire", "topaz", "jade", "onyx", "sunstone"].map((g) => id(`gem_${g}`));

/**
 * Pays a fallen boss's foes: refining stones and gems for everyone who fought it, and a Codex the first
 * time each of them defeats this boss. Returns the players paid.
 * @param {Entity} dead @param {string} key @param {Set<string>} seen @param {() => number} [random]
 */
export function reward(dead, key, seen, random = Math.random) {
  const info = BOSSES[key];
  /** @type {Player[]} */
  const paid = [];
  let health = 0;
  try {
    health = dead.getComponent("minecraft:health")?.effectiveMax ?? 0;
  } catch {
    // gone
  }
  for (const player of playersNear(dead, 48)) {
    if (seen.size > 0 && !seen.has(player.id)) continue;
    const stones = 2 + Math.floor(random() * 3);
    giveItem(player, id("refining_stone"), stones);
    const gems = health >= 700 ? 2 : 1;
    for (let i = 0; i < gems; i++) giveItem(player, GEMS[Math.floor(random() * GEMS.length)], 1);
    const p = profileOf(player);
    if (!Array.isArray(p.bosses)) p.bosses = [];
    let line = `§6[Boss] §f${info.name} is defeated! §b${stones} Refining Stones§f and §d${gems} gem${gems > 1 ? "s" : ""}§f.`;
    if (!p.bosses.includes(key)) {
      p.bosses.push(key);
      giveItem(player, id("codex_of_skills"), 1);
      line += ` §5First victory: a Codex of the Supreme Beings!`;
    }
    touch(player);
    try {
      player.sendMessage(line);
    } catch {
      // the player left
    }
    paid.push(player);
  }
  return paid;
}

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    const key = bossOf(dead);
    if (!key) return;
    const fight = fights.get(dead.id);
    fights.delete(dead.id);
    fx.pillar(dead.dimension, dead.location, BOSSES[key].element, 7);
    fx.nova(dead.dimension, { x: dead.location.x, y: dead.location.y + 1, z: dead.location.z }, BOSSES[key].element, 6);
    reward(dead, key, fight?.seen ?? new Set());
  } catch {
    // the boss is already unloaded
  }
});
