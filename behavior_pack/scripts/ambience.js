// Overlord: Tomb of Nazarick - creature visuals.
// Gives the creatures themselves some presence: something hangs in the air around the
// notable ones (embers round a demon, frost round a dragon of ice, shadow round the
// undead lords), a melee blow leaves a crescent in the attacker's colour, a death is
// marked, and a great foe arrives inside a magic circle.
import { world, system, EntityDamageCause } from "@minecraft/server";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const RANGE = 28; // creatures this close to a player are dressed
const PER_PASS = 24; // at most this many creatures are dressed in one pass
const GREAT = 300; // health from which a creature counts as a great foe

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {[particle: string, element: string, height: number, size: number]} Aura */

/** What hangs in the air around a creature: particle, element, height above its feet, size. */
/** @type {Record<string, Aura[]>} */
export const AURAS = {
  // the undead lords
  [id("ainz")]: [["wisp", "dark", 1.4, 1.2], ["glyph", "arcane", 0.3, 1.1]],
  [id("death_knight")]: [["wisp", "dark", 1.4, 1.0]],
  [id("elder_lich")]: [["wisp", "dark", 1.2, 0.8]],
  [id("skeleton_mage")]: [["glyph", "arcane", 0.3, 0.7]],
  [id("soul_eater")]: [["ember", "ice", 0.9, 1.0]],
  [id("khajiit")]: [["wisp", "dark", 1.2, 0.9]],
  [id("shalltear")]: [["ember", "fire", 1.0, 0.9]],
  [id("albedo")]: [["wisp", "dark", 1.2, 0.8]],
  [id("zesshi")]: [["wisp", "dark", 1.0, 0.7]],
  [id("dark_young")]: [["wisp", "dark", 3.0, 3.0]],
  // demons
  [id("demiurge")]: [["ember", "fire", 1.2, 0.9]],
  [id("evil_lord_wrath")]: [["flame", "fire", 1.8, 1.6], ["ember", "fire", 2.4, 1.6]],
  [id("jaldabaoth")]: [["flame", "fire", 1.2, 1.1], ["ember", "fire", 1.8, 1.2]],
  [id("hellhound")]: [["ember", "fire", 0.8, 0.8]],
  [id("shadow_demon")]: [["wisp", "dark", 0.9, 0.7]],
  [id("lupusregina")]: [["ember", "fire", 1.2, 0.7]],
  [id("rubedo")]: [["ember", "fire", 1.2, 1.0]],
  [id("gargantua")]: [["ember", "fire", 3.0, 2.4]],
  // ice
  [id("cocytus")]: [["ember", "ice", 1.8, 1.4]],
  [id("frost_giant")]: [["ember", "ice", 2.4, 1.6]],
  // the holy
  [id("archangel_flame")]: [["ray", "holy", 0.2, 0.6]],
  [id("dominion_authority")]: [["ray", "holy", 0.4, 1.4], ["glyph", "holy", 0.6, 1.6]],
  // lightning
  [id("narberal")]: [["arc", "lightning", 1.3, 0.6]],
  // arcane and the wilds
  [id("evileye")]: [["glyph", "arcane", 0.2, 0.6]],
  [id("fluder")]: [["glyph", "arcane", 0.3, 0.8]],
  [id("aura")]: [["ember", "acid", 1.0, 0.7]],
  [id("mare")]: [["ember", "acid", 1.0, 0.7]],
  [id("decem")]: [["ember", "acid", 1.2, 0.9]],
  [id("solution")]: [["droplet", "acid", 1.0, 0.5]],
};

/** The colour of a creature's blows and of its death, where it is not the colour of its aura. */
/** @type {Record<string, string>} */
const THEME = {
  // the dragons' own visuals are in dragons.js; these colour their bites and their deaths
  [id("frost_dragon")]: "ice",
  [id("skeletal_dragon")]: "dark",
  [id("platinum_dragon_lord")]: "lightning",
  [id("old_guarder")]: "dark",
  [id("vampire_bride")]: "dark",
  [id("eight_edge_assassin")]: "dark",
  [id("nigun")]: "holy",
  [id("theocracy_priest")]: "holy",
  [id("paladin")]: "holy",
  [id("remedios")]: "holy",
  [id("gigant_basilisk")]: "acid",
  [id("behemoth")]: "acid",
};

/**
 * The element a creature's effects are drawn in.
 * @param {Entity} entity
 */
export function themeOf(entity) {
  const aura = AURAS[entity.typeId];
  if (aura) return aura[0][1];
  const theme = THEME[entity.typeId];
  if (theme) return theme;
  try {
    if (entity.matches({ families: ["undead"] })) return "dark";
    if (entity.matches({ families: ["demon"] })) return "fire";
    if (entity.matches({ families: ["angel"] })) return "holy";
  } catch {
    // the entity is leaving
  }
  return "none";
}

/** @param {Entity} entity */
function maxHealth(entity) {
  try {
    return entity.getComponent("minecraft:health")?.effectiveMax ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Draws what hangs in the air around the notable creatures near the players. Returns how many were dressed.
 */
export function dress() {
  const seen = new Set();
  let count = 0;
  for (const player of world.getAllPlayers()) {
    /** @type {Entity[]} */
    let near = [];
    try {
      near = player.dimension.getEntities({ location: player.location, maxDistance: RANGE, excludeTypes: ["minecraft:player"] });
    } catch {
      continue; // the dimension is unloading
    }
    for (const entity of near) {
      if (count >= PER_PASS) return count;
      const aura = AURAS[entity.typeId];
      if (!aura || seen.has(entity.id)) continue;
      seen.add(entity.id);
      try {
        if (entity.getEffect("invisibility")) continue; // nothing gives away the unseen
        for (const [particle, element, height, size] of aura) {
          fx.puff(entity.dimension, particle, { x: entity.location.x, y: entity.location.y + height, z: entity.location.z }, element, size);
        }
        count++;
      } catch {
        // the entity is leaving
      }
    }
  }
  return count;
}

system.runInterval(() => {
  try {
    dress();
  } catch (error) {
    console.warn(`[Overlord] creature visuals failed: ${error}`);
  }
}, Math.round(1.5 * TICKS));

/** Attacker id -> tick of its last drawn blow, so a flurry does not flood the screen. */
const lastBlow = new Map();

// A creature's melee blow leaves a crescent in its colour on whatever it struck.
world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const attacker = event.damageSource.damagingEntity;
    if (!attacker || !attacker.isValid || !attacker.typeId.startsWith(`${NS}:`)) return;
    if (event.damageSource.cause !== EntityDamageCause.entityAttack) return;
    if (system.currentTick - (lastBlow.get(attacker.id) ?? -100) < 8) return;
    lastBlow.set(attacker.id, system.currentTick);
    const victim = event.hurtEntity;
    const great = maxHealth(attacker) >= GREAT;
    fx.slash(victim.dimension, { x: victim.location.x, y: victim.location.y + 1.1, z: victim.location.z }, themeOf(attacker), great ? 1.8 : 1.0);
    if (great) fx.shake(victim.dimension, victim.location, 8, 0.25, 0.2);
  } catch {
    // someone vanished mid-blow
  }
});

// Deaths are marked: a burst in the creature's colour, a skull over the undead, a nova for the great.
world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    if (!dead.typeId.startsWith(`${NS}:`)) return;
    lastBlow.delete(dead.id);
    const at = { x: dead.location.x, y: dead.location.y + 1, z: dead.location.z };
    const element = themeOf(dead);
    let undead = false;
    try {
      undead = dead.matches({ families: ["undead"] });
    } catch {
      // not readable any more
    }
    if (maxHealth(dead) >= GREAT) {
      fx.nova(dead.dimension, at, element, 5);
      fx.pillar(dead.dimension, dead.location, element, 6, 1.6);
      fx.shake(dead.dimension, at, 20, 0.6, 0.5);
      if (undead) fx.skull(dead.dimension, { x: at.x, y: at.y + 1.5, z: at.z }, 2.2);
    } else {
      fx.spark(dead.dimension, at, element, 0.9);
      if (undead) fx.puff(dead.dimension, "wisp", at, "dark", 0.9);
    }
  } catch {
    // the dead are already unloaded
  }
});

// A great foe does not simply appear: it arrives inside a magic circle.
world.afterEvents.entitySpawn.subscribe((event) => {
  const entity = event.entity;
  try {
    if (!entity.typeId.startsWith(`${NS}:`)) return;
  } catch {
    return;
  }
  system.runTimeout(() => {
    try {
      if (!entity.isValid || maxHealth(entity) < GREAT) return;
      const element = themeOf(entity);
      fx.circle(entity.dimension, entity.location, element, 3.2);
      fx.pillar(entity.dimension, entity.location, element, 5, 1.4);
      fx.ring(entity.dimension, entity.location, element, 4);
    } catch {
      // it left again at once
    }
  }, 2);
});
