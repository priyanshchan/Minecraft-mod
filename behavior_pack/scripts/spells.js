// Overlord: Tomb of Nazarick - tier magic.
// The Grimoire teaches spells from the 1st to the 10th tier plus super-tier magic;
// up to four are assigned to slots and cast with the Magic Wand. Spells cost mana,
// scale with spell power and mastery (repeated use), and carry an element that
// some creatures are weak or resistant to.
import { world, system, EntityDamageCause, Direction } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { giveItem, notify, profileOf, setHudExtra, spellPower, spendMana, restoreMana, touch, hasAllies } from "./rpg.js";
import * as skills from "./skills.js";
import { cataclysm, goalOfAllLife, pantheon } from "./godspells.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const SLOTS = 4;
const CRYSTAL = id("data_crystal");

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {"arcane" | "fire" | "ice" | "lightning" | "holy" | "acid" | "dark" | "none"} Element */
/**
 * @typedef {{
 *   key: string, name: string, tier: number, mana: number, cooldown: number, element: Element,
 *   help: string, cast: (player: Player, power: number) => boolean,
 * }} Spell
 */

// ------------------------------------------------------------------ helpers

/** @param {Vector3} a @param {Vector3} b @param {number} [scale] */
function add(a, b, scale = 1) {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale };
}

/** @param {import("@minecraft/server").Dimension} dimension @param {string} effect @param {Vector3} location */
function particle(dimension, effect, location) {
  try {
    dimension.spawnParticle(effect, location);
  } catch {
    // unloaded chunk
  }
}

/** @param {import("@minecraft/server").Dimension} dimension @param {string} sound @param {Vector3} location @param {number} [pitch] */
function playSound(dimension, sound, location, pitch = 1) {
  try {
    dimension.playSound(sound, location, { volume: 1, pitch });
  } catch {
    // unloaded chunk
  }
}

/** Living mobs a spell may hurt around a point (no players, allies or pets). */
/** @param {import("@minecraft/server").Dimension} dimension @param {Vector3} location @param {number} radius */
function foesNear(dimension, location, radius) {
  /** @type {Entity[]} */
  const found = [];
  try {
    for (const entity of dimension.getEntities({
      location,
      maxDistance: radius,
      excludeTypes: ["minecraft:player"],
      excludeFamilies: ["nazarick_ally", "inanimate"],
    })) {
      try {
        if (entity.getComponent("minecraft:health") && !entity.getComponent("minecraft:is_tamed")) found.push(entity);
      } catch {
        // entity left the world
      }
    }
  } catch {
    // unloaded chunk
  }
  return found;
}

/** The mob the player is looking at. @param {Player} player @param {number} reach */
function aimedMob(player, reach) {
  return player
    .getEntitiesFromViewDirection({ maxDistance: reach })
    .map((h) => h.entity)
    .find((e) => e.isValid && e.typeId !== "minecraft:player" && e.getComponent("minecraft:health"));
}

/** Where the player is aiming: a mob, else a block top, else undefined. @param {Player} player @param {number} reach */
function aimPoint(player, reach) {
  const mob = aimedMob(player, reach);
  if (mob) return mob.location;
  const hit = player.getBlockFromViewDirection({ maxDistance: reach });
  if (!hit) return undefined;
  const b = hit.block.location;
  return { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 };
}

/** Creatures with an unusual reaction to an element: multiplier on the damage they take. */
/** @type {Record<string, Partial<Record<Element, number>>>} */
export const AFFINITY = {
  [id("cocytus")]: { ice: 0.25, fire: 1.5 },
  [id("demiurge")]: { fire: 0.25, ice: 1.5 },
  [id("fluder")]: { fire: 0.5 },
  [id("gargantua")]: { lightning: 0.5, arcane: 0.75 },
  [id("soul_eater")]: { fire: 1.25 },
  [id("narberal")]: { lightning: 0.25 },
  [id("solution")]: { fire: 1.5 },
  [id("frost_dragon")]: { ice: 0.1, fire: 1.5 },
  [id("hellhound")]: { fire: 0.1, ice: 1.5, holy: 1.25 },
  [id("shadow_demon")]: { fire: 0.5, holy: 1.5, dark: 0.5 },
  [id("evil_lord_wrath")]: { fire: 0.1, ice: 1.5, holy: 1.25 },
  [id("archangel_flame")]: { holy: 0.25, fire: 0.5, dark: 1.5 },
  [id("dominion_authority")]: { holy: 0.1, lightning: 0.5, dark: 1.5 },
  [id("skeletal_dragon")]: { ice: 0.5, holy: 1.5 },
  [id("gigant_basilisk")]: { acid: 0.25, ice: 1.5 },
  [id("frost_giant")]: { ice: 0.1, fire: 1.5 },
  [id("ghoul")]: { holy: 1.5, fire: 1.25 },
  [id("wraith")]: { holy: 1.5, dark: 0.25 },
  [id("death_cavalier")]: { holy: 1.5, dark: 0.5 },
  [id("treant_sapling")]: { fire: 1.75, acid: 0.25 },
  [id("zytl_qae")]: { fire: 1.5, acid: 0.1, ice: 0.75 },
  [id("dark_young")]: { dark: 0.25, fire: 1.5, holy: 1.25 },
  [id("jaldabaoth")]: { fire: 0.1, ice: 1.5, holy: 1.25 },
  [id("go_gin")]: { fire: 1.5 },
  [id("behemoth")]: { lightning: 0.25, acid: 1.5 },
  [id("eight_edge_assassin")]: { holy: 1.5, dark: 0.5 },
  [id("platinum_dragon_lord")]: { lightning: 0.25, ice: 0.5, dark: 1.25 },
  [id("war_troll")]: { fire: 1.5, acid: 1.5 },
  [id("vampire_bride")]: { fire: 1.25 },
  "minecraft:blaze": { fire: 0.25, ice: 1.5 },
  "minecraft:magma_cube": { fire: 0.25, ice: 1.5 },
  "minecraft:stray": { ice: 0.25, fire: 1.5 },
  "minecraft:snow_golem": { ice: 0.25, fire: 2 },
};

/**
 * Deals spell damage with elemental modifiers and side effects.
 * @param {Player} player @param {Entity} target @param {number} amount @param {Element} element
 */
function hurt(player, target, amount, element) {
  try {
    if (!target.isValid) return;
    let factor = AFFINITY[target.typeId]?.[element] ?? 1;
    if (element === "holy" && target.matches({ families: ["undead"] })) factor *= 1.5;
    if (element === "dark" && target.matches({ families: ["undead"] })) factor *= 0.25; // negative energy barely harms the dead
    const where = { x: target.location.x, y: target.location.y + 1.4, z: target.location.z };
    const dimension = target.dimension;
    target.applyDamage(Math.max(1, Math.round(amount * factor)), {
      cause: element === "fire" ? EntityDamageCause.fire : EntityDamageCause.magic,
      damagingEntity: player,
    });
    if (!target.isValid) {
      if (element === "dark" && dimension) fx.skull(dimension, where); // death magic leaves its mark over the slain
      return;
    }
    if (element === "fire") target.setOnFire(4, true);
    else if (element === "ice") target.addEffect("slowness", 4 * TICKS, { amplifier: 2 });
    else if (element === "lightning") target.addEffect("slowness", 1 * TICKS, { amplifier: 6 });
    else if (element === "acid") target.addEffect("poison", 5 * TICKS, { amplifier: 1 });
    else if (element === "dark") target.addEffect("wither", 4 * TICKS, { amplifier: 1 });
  } catch {
    // target died or left mid-spell
  }
}

/** Where a spell leaves the caster: roughly the outstretched hand. @param {Player} player */
function hand(player) {
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  return { x: head.x + dir.x * 0.7, y: head.y - 0.25 + dir.y * 0.7, z: head.z + dir.z * 0.7 };
}

/** Beam plus impact burst on a target point. @param {Player} player @param {Vector3} from @param {Vector3} at @param {Element} element @param {string} accent */
function strikeFx(player, from, at, element, accent) {
  fx.beam(player.dimension, from, at, element);
  fx.spark(player.dimension, at, element, 1.2);
  fx.ring(player.dimension, add(at, { x: 0, y: -0.9, z: 0 }), element, 1.4);
  particle(player.dimension, accent, at);
}

const SPARK = "minecraft:electric_spark_particle";
const CRIT = "minecraft:critical_hit_emitter";
const FLAME = "minecraft:basic_flame_particle";
const FROST = "minecraft:blue_flame_particle";
const TOTEM = "minecraft:totem_particle";
const SOUL = "minecraft:soul_particle";
const SPORE = "minecraft:villager_happy";

// --------------------------------------------------------------- spell kinds

/** Single-target bolt at the mob in view. */
/** @param {number} range @param {number} damage @param {Element} element @param {string} effect @param {string} sound */
function bolt(range, damage, element, effect, sound) {
  return (/** @type {Player} */ player, /** @type {number} */ power) => {
    const target = aimedMob(player, range);
    if (!target) return false;
    const at = add(target.location, { x: 0, y: 1, z: 0 });
    strikeFx(player, hand(player), at, element, effect);
    playSound(player.dimension, sound, at, 1.3);
    hurt(player, target, damage * power, element);
    return true;
  };
}

/** Piercing line through everything ahead. */
/** @param {number} length @param {number} damage @param {Element} element @param {string} effect @param {string} sound */
function line(length, damage, element, effect, sound) {
  return (/** @type {Player} */ player, /** @type {number} */ power) => {
    const origin = hand(player);
    const dir = player.getViewDirection();
    const struck = new Set();
    fx.beam(player.dimension, origin, add(origin, dir, length), element, 1.6);
    for (let step = 1; step <= length; step += 1.5) {
      const point = add(origin, dir, step);
      if (Math.round(step / 1.5) % 2 === 0) fx.spark(player.dimension, point, element, 0.8);
      for (const foe of foesNear(player.dimension, point, 1.8)) {
        if (struck.has(foe.id)) continue;
        struck.add(foe.id);
        particle(player.dimension, effect, add(foe.location, { x: 0, y: 1, z: 0 }));
        hurt(player, foe, damage * power, element);
      }
    }
    fx.ring(player.dimension, add(origin, dir, length), element, 2);
    playSound(player.dimension, sound, player.location, 1.4);
    return true;
  };
}

/** Lightning that jumps between nearby foes. */
/** @param {number} jumps @param {number} damage */
function chain(jumps, damage) {
  return (/** @type {Player} */ player, /** @type {number} */ power) => {
    /** @type {Entity | undefined} */
    let target = aimedMob(player, 24);
    if (!target) return false;
    const struck = new Set();
    let from = hand(player);
    for (let i = 0; i < jumps && target; i++) {
      struck.add(target.id);
      const at = add(target.location, { x: 0, y: 1, z: 0 });
      strikeFx(player, from, at, "lightning", SPARK);
      /** @type {Entity | undefined} */
      const next = foesNear(player.dimension, target.location, 7).find((f) => !struck.has(f.id));
      hurt(player, target, damage * power * Math.pow(0.85, i), "lightning");
      from = at;
      target = next;
    }
    playSound(player.dimension, "ambient.weather.lightning.impact", from, 1.5);
    return true;
  };
}

/** Area burst where the player aims, optionally after a delay and with a pull towards the centre. */
/** @param {number} radius @param {number} damage @param {Element} element @param {{ delay?: number, pull?: boolean, effect?: string, sound?: string, debuff?: [string, number, number][] }} [options] */
function burst(radius, damage, element, options = {}) {
  return (/** @type {Player} */ player, /** @type {number} */ power) => {
    const center = aimPoint(player, 40);
    if (!center) return false;
    const dimension = player.dimension;
    const accent = options.effect ?? CRIT;
    const strike = () => {
      fx.pillar(dimension, center, element, Math.min(12, 4 + radius), 1 + radius * 0.12);
      fx.nova(dimension, add(center, { x: 0, y: 0.8, z: 0 }), element, radius);
      if (radius >= 5) fx.shake(dimension, center, radius * 3, Math.min(1.2, radius * 0.1), 0.5);
      fx.ring(dimension, center, element, radius);
      fx.ring(dimension, add(center, { x: 0, y: 0.6, z: 0 }), element, radius * 0.6);
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const rim = { x: center.x + Math.cos(angle) * radius * 0.7, y: center.y + 0.5, z: center.z + Math.sin(angle) * radius * 0.7 };
        fx.spark(dimension, rim, element, 1.3);
        particle(dimension, accent, rim);
      }
      playSound(dimension, options.sound ?? "random.explode", center, 0.7);
      if (!player.isValid) return;
      for (const foe of foesNear(dimension, center, radius)) {
        hurt(player, foe, damage * power, element);
        try {
          if (foe.isValid) for (const [effect, seconds, amplifier] of options.debuff ?? []) foe.addEffect(effect, seconds * TICKS, { amplifier });
        } catch {
          // immune
        }
        if (options.pull && foe.isValid) {
          try {
            const dx = center.x - foe.location.x;
            const dz = center.z - foe.location.z;
            const len = Math.hypot(dx, dz) || 1;
            foe.applyKnockback({ x: (dx / len) * 1.5, z: (dz / len) * 1.5 }, 0.3);
          } catch {
            // immovable
          }
        }
      }
    };
    fx.circle(dimension, center, element, radius);
    if (options.delay) {
      // Telegraph: the target circle pulses while the spell gathers, then something falls from the sky.
      const ticks = options.delay * TICKS;
      for (let t = 0; t < ticks; t += 20) {
        system.runTimeout(() => {
          fx.circle(dimension, center, element, radius);
          fx.rise(dimension, center, element, radius * 0.8);
          fx.implode(dimension, add(center, { x: 0, y: 3, z: 0 }), element, Math.min(8, radius)); // power gathering overhead
        }, t);
      }
      system.runTimeout(() => fx.fall(dimension, center, element, 10), Math.max(0, ticks - 10));
      playSound(dimension, "beacon.activate", center, 1.2);
      system.runTimeout(strike, ticks);
    } else strike();
    return true;
  };
}

/** Cone of force in front of the caster. */
/** @param {number} radius @param {number} damage @param {Element} element @param {number} push */
function cone(radius, damage, element, push) {
  return (/** @type {Player} */ player, /** @type {number} */ power) => {
    const view = player.getViewDirection();
    for (const foe of foesNear(player.dimension, player.location, radius)) {
      const dx = foe.location.x - player.location.x;
      const dz = foe.location.z - player.location.z;
      const len = Math.hypot(dx, dz) || 1;
      if ((dx / len) * view.x + (dz / len) * view.z < 0.3) continue;
      hurt(player, foe, damage * power, element);
      fx.spark(player.dimension, add(foe.location, { x: 0, y: 1, z: 0 }), element);
      try {
        if (foe.isValid) foe.applyKnockback({ x: (dx / len) * push, z: (dz / len) * push }, 0.4);
      } catch {
        // immovable
      }
    }
    for (let d = 1; d <= radius; d += 1.5) {
      system.runTimeout(() => fx.ring(player.dimension, add(player.location, { x: view.x * d, y: 0.6, z: view.z * d }), element, 0.8 + d * 0.5), Math.round(d));
    }
    playSound(player.dimension, "mob.irongolem.throw", player.location, 0.8);
    return true;
  };
}

/** Heals the caster and players within `radius`. */
/** @param {number} amount @param {number} radius */
function healing(amount, radius) {
  return (/** @type {Player} */ player, /** @type {number} */ power) => {
    const targets = radius > 0 ? player.dimension.getPlayers({ location: player.location, maxDistance: radius }) : [player];
    for (const ally of targets) {
      const health = ally.getComponent("minecraft:health");
      if (health && health.currentValue > 0) {
        health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount * power));
      }
      fx.rise(player.dimension, ally.location, "holy", 0.8);
      fx.circle(player.dimension, ally.location, "holy", 1.0);
      fx.spiral(player.dimension, () => (ally.isValid ? ally.location : undefined), "holy", 0.8, 2);
      particle(player.dimension, "minecraft:heart_particle", add(ally.location, { x: 0, y: 2, z: 0 }));
    }
    if (radius > 0) fx.ring(player.dimension, player.location, "holy", radius);
    playSound(player.dimension, "random.orb", player.location, 0.9);
    return true;
  };
}

/** Curse on the mob in view: effects only, no damage. */
/** @param {number} range @param {[string, number, number][]} effects [effect, seconds, amplifier] @param {string} sound */
function curse(range, effects, sound) {
  return (/** @type {Player} */ player) => {
    const target = aimedMob(player, range);
    if (!target) return false;
    for (const [effect, seconds, amplifier] of effects) target.addEffect(effect, seconds * TICKS, { amplifier });
    strikeFx(player, hand(player), add(target.location, { x: 0, y: 1, z: 0 }), "dark", SOUL);
    fx.circle(player.dimension, target.location, "dark", 1.2);
    fx.rise(player.dimension, target.location, "dark", 0.8);
    fx.beam(player.dimension, hand(player), add(target.location, { x: 0, y: 1, z: 0 }), "dark", 0.7);
    playSound(player.dimension, sound, target.location, 1.2);
    return true;
  };
}

/** Negative energy that also restores the caster. */
/** @param {number} damage @param {number} healShare @param {number} mana */
function drain(damage, healShare, mana) {
  return (/** @type {Player} */ player, /** @type {number} */ power) => {
    const target = aimedMob(player, 24);
    if (!target) return false;
    const at = add(target.location, { x: 0, y: 1, z: 0 });
    fx.spark(player.dimension, at, "dark", 1.2);
    fx.beam(player.dimension, at, hand(player), "dark");
    fx.rise(player.dimension, player.location, "dark", 0.7);
    fx.implode(player.dimension, add(player.location, { x: 0, y: 1, z: 0 }), "dark", 1.4);
    particle(player.dimension, SOUL, at);
    hurt(player, target, damage * power, "dark");
    const health = player.getComponent("minecraft:health");
    if (health && health.currentValue > 0) {
      health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + damage * power * healShare));
    }
    restoreMana(player, mana);
    playSound(player.dimension, "mob.wither.hurt", player.location, 1.4);
    return true;
  };
}

/** Most creatures a player may command through summoning spells and Sealing Crystals at one time. */
export const MAX_ALLIES = 4;

/** How many summoned creatures a player may command: four, and more with Legion. @param {Player} player */
export function allyLimit(player) {
  return MAX_ALLIES + skills.extraAllies(profileOf(player));
}

/**
 * Summons allied creatures that follow and fight for the player until their time runs out.
 * Returns how many appeared (0 when the player already commands as many as allowed).
 * @param {Player} player @param {string} type @param {number} count
 */
export function summonAlly(player, type, count) {
  const tag = `overlord_ally_${player.id}`;
  let present = 0;
  try {
    present = player.dimension.getEntities({ tags: [tag] }).length;
  } catch {
    // dimension unloading
  }
  const room = Math.min(count, allyLimit(player) - present);
  /** @type {Entity[]} */
  const allies = [];
  for (let i = 0; i < room; i++) {
    const angle = ((present + i) / MAX_ALLIES) * Math.PI * 2;
    const spot = { x: player.location.x + Math.cos(angle) * 2, y: player.location.y, z: player.location.z + Math.sin(angle) * 2 };
    const ally = player.dimension.spawnEntity(type, spot, { spawnEvent: `${NS}:become_summoned` });
    ally.addTag("overlord_summoned");
    ally.addTag(tag);
    fx.circle(player.dimension, spot, "arcane", 1.1);
    fx.rise(player.dimension, spot, "arcane", 0.7);
    fx.pillar(player.dimension, spot, "arcane", 2.6, 0.8);
    allies.push(ally);
  }
  // Ownership can only be set once the summoned form has been applied.
  system.runTimeout(() => {
    for (const ally of allies) {
      try {
        if (ally.isValid && player.isValid) ally.getComponent("minecraft:tameable")?.tame(player);
      } catch {
        // it still fights monsters even if it could not be bound
      }
    }
  }, 2);
  return allies.length;
}

/** Summoning spell. */
/** @param {string} type @param {number} count @param {string} sound */
function summoning(type, count, sound) {
  return (/** @type {Player} */ player) => {
    if (summonAlly(player, type, count) === 0) {
      notify(player, `§7You already command ${allyLimit(player)} summoned creatures`);
      return false;
    }
    playSound(player.dimension, sound, player.location, 1.2);
    return true;
  };
}

/** Self buff. */
/** @param {[string, number, number][]} effects [effect, seconds, amplifier] @param {Element} [color] */
function buff(effects, color = "none") {
  return (/** @type {Player} */ player) => {
    for (const [effect, seconds, amplifier] of effects) {
      player.addEffect(effect, seconds * TICKS, { amplifier, showParticles: false });
    }
    fx.spiral(player.dimension, () => (player.isValid ? player.location : undefined), color);
    fx.rise(player.dimension, player.location, color, 0.8);
    playSound(player.dimension, "random.orb", player.location, 1.3);
    return true;
  };
}

/** @param {Player} player */
function castFireball(player) {
  const dir = player.getViewDirection();
  const origin = add(player.getHeadLocation(), dir, 1.4);
  const ball = player.dimension.spawnEntity(id("fireball"), origin);
  const projectile = ball.getComponent("minecraft:projectile");
  const velocity = { x: dir.x * 1.8, y: dir.y * 1.8, z: dir.z * 1.8 };
  if (projectile) {
    projectile.owner = player;
    projectile.shoot(velocity, { uncertainty: 0 });
  } else ball.applyImpulse(velocity);
  fx.spark(player.dimension, origin, "fire", 1.2);
  fx.ring(player.dimension, add(origin, { x: 0, y: -0.2, z: 0 }), "fire", 0.9);
  playSound(player.dimension, "mob.ghast.fireball", origin, 1.1);
  return true;
}

const FACE = {
  [Direction.Up]: { x: 0, y: 1, z: 0 },
  [Direction.Down]: { x: 0, y: -2, z: 0 },
  [Direction.North]: { x: 0, y: 0, z: -1 },
  [Direction.South]: { x: 0, y: 0, z: 1 },
  [Direction.West]: { x: -1, y: 0, z: 0 },
  [Direction.East]: { x: 1, y: 0, z: 0 },
};

/** @param {Player} player */
function castDimensionalMove(player) {
  const hit = player.getBlockFromViewDirection({ maxDistance: 32 });
  if (!hit) return false;
  const face = FACE[hit.face] ?? FACE[Direction.Up];
  const b = hit.block.location;
  const to = { x: b.x + 0.5 + face.x, y: b.y + face.y, z: b.z + 0.5 + face.z };
  const from = player.location;
  if (!player.tryTeleport(to, { checkForBlocks: true }) && !player.tryTeleport(add(to, { x: 0, y: 1, z: 0 }), { checkForBlocks: true })) {
    return false;
  }
  // Gone from one place in a rush of gathered light, there in the next in a shaft of it.
  fx.circle(player.dimension, from, "arcane", 1.3);
  fx.blink(player.dimension, from, to, "arcane");
  fx.wash(player, { red: 0.08, green: 0.02, blue: 0.14 }, 0.3);
  playSound(player.dimension, "mob.endermen.portal", to, 1);
  return true;
}

/** @param {Player} player @param {number} power */
function castGraspHeart(player, power) {
  const target = aimedMob(player, 24);
  if (!target) return false;
  const at = add(target.location, { x: 0, y: 1, z: 0 });
  strikeFx(player, hand(player), at, "dark", SOUL);
  fx.circle(player.dimension, target.location, "dark", 1.4);
  fx.spark(player.dimension, at, "fire", 0.8); // the crushed heart
  fx.skull(player.dimension, add(at, { x: 0, y: 0.8, z: 0 }), 1.2);
  fx.beam(player.dimension, hand(player), at, "dark", 0.8);
  playSound(player.dimension, "mob.wither.hurt", at, 0.6);
  hurt(player, target, 75 * power, "dark");
  try {
    if (target.isValid) target.addEffect("slowness", 3 * TICKS, { amplifier: 6 }); // survivors are stunned
  } catch {
    // immune
  }
  return true;
}

/** @param {Player} player */
function castTimeStop(player) {
  const dimension = player.dimension;
  const center = player.location;
  for (const foe of foesNear(dimension, center, 14)) {
    try {
      foe.addEffect("slowness", 8 * TICKS, { amplifier: 6 });
      foe.addEffect("weakness", 8 * TICKS, { amplifier: 5 });
      fx.circle(dimension, foe.location, "none", 1.0);
    } catch {
      // immune
    }
  }
  for (let i = 0; i < 4; i++) {
    system.runTimeout(() => fx.ring(dimension, center, "none", 4 + i * 3.4), i * 3);
  }
  fx.circle(dimension, center, "none", 6);
  fx.wash(player, { red: 0.85, green: 0.85, blue: 0.95 }, 0.35);
  playSound(dimension, "beacon.activate", center, 0.5);
  return true;
}

/** Casting pose per spell; anything not listed points at its target. */
/** @type {Record<string, fx.Pose>} */
const POSE = {};
for (const key of ["light_healing", "heal", "reinforce_armor", "lesser_strength", "haste", "fly", "regenerate", "full_potential", "dimensional_move"]) POSE[key] = "self";
for (const key of ["summon_undead_3", "summon_angel_4", "summon_undead_5", "summon_undead_6"]) POSE[key] = "summon";
for (const key of ["bone_lance", "ice_lance", "reality_slash", "wall_of_hell"]) POSE[key] = "sweep";
for (const key of ["energy_drain", "sleep", "grasp_heart", "death"]) POSE[key] = "channel";
for (const key of ["fire_rain", "ice_pillar", "napalm", "holy_smite", "gravity_maelstrom", "sand_field_all", "meteor_fall", "nuclear_blast", "time_stop"]) POSE[key] = "raise";
POSE.shock_wave = "slam";

// -------------------------------------------------------------------- spells

/** Tier 11 is super-tier magic; tier 12 god-tier, taught only to those who have conquered the Great Tomb. */
const SUPER = 11;
export const GOD = 12;

/** @type {Spell[]} */
export const SPELLS = [
  { key: "magic_arrow", name: "Magic Arrow", tier: 1, mana: 4, cooldown: 0.8, element: "arcane", help: "Bolt of force at the mob you look at.", cast: bolt(24, 7, "arcane", CRIT, "random.orb") },
  { key: "light_healing", name: "Light Healing", tier: 1, mana: 8, cooldown: 4, element: "holy", help: "Restores 3 hearts.", cast: healing(6, 0) },
  { key: "sleep", name: "Sleep", tier: 1, mana: 6, cooldown: 6, element: "none", help: "Makes one mob drowsy: it can barely move or fight for 6 seconds.", cast: curse(20, [["slowness", 6, 6], ["weakness", 6, 5]], "random.orb") },
  { key: "acid_arrow", name: "Acid Arrow", tier: 2, mana: 5, cooldown: 1.2, element: "acid", help: "Bolt of acid that poisons.", cast: bolt(24, 5, "acid", SPORE, "random.fizz") },
  { key: "shock_wave", name: "Shock Wave", tier: 2, mana: 8, cooldown: 3, element: "arcane", help: "Cone of force that throws mobs back.", cast: cone(6, 6, "arcane", 2.2) },
  { key: "reinforce_armor", name: "Reinforce Armor", tier: 2, mana: 12, cooldown: 20, element: "none", help: "Resistance I for 60 seconds.", cast: buff([["resistance", 60, 0]], "arcane") },
  { key: "lesser_strength", name: "Lesser Strength", tier: 2, mana: 12, cooldown: 20, element: "none", help: "Strength I for 60 seconds.", cast: buff([["strength", 60, 0]], "fire") },
  { key: "thunderlance", name: "Thunderlance", tier: 2, mana: 7, cooldown: 1.5, element: "lightning", help: "Lance of lightning at one mob.", cast: bolt(26, 9, "lightning", SPARK, "ambient.weather.lightning.impact") },
  { key: "fireball", name: "Fireball", tier: 3, mana: 8, cooldown: 1.5, element: "fire", help: "Explosive ball of fire.", cast: castFireball },
  { key: "lightning", name: "Lightning", tier: 3, mana: 9, cooldown: 1.5, element: "lightning", help: "Bolt that stuns for a moment.", cast: bolt(28, 13, "lightning", SPARK, "ambient.weather.lightning.impact") },
  { key: "freezing_bullet", name: "Freezing Bullet", tier: 3, mana: 9, cooldown: 1.5, element: "ice", help: "Bolt of ice that slows.", cast: bolt(28, 11, "ice", FROST, "random.glass") },
  { key: "haste", name: "Haste", tier: 3, mana: 12, cooldown: 20, element: "none", help: "Speed II for 30 seconds.", cast: buff([["speed", 30, 1]], "lightning") },
  { key: "summon_undead_3", name: "Summon Undead 3rd Tier", tier: 3, mana: 20, cooldown: 30, element: "dark", help: "Two Old Guarders fight for you for 2 minutes.", cast: summoning(id("old_guarder"), 2, "mob.wither.spawn") },
  { key: "fly", name: "Fly", tier: 3, mana: 15, cooldown: 12, element: "none", help: "Lifts you up, then lets you glide.", cast: buff([["levitation", 6, 2], ["slow_falling", 25, 0]]) },
  { key: "ice_lance", name: "Ice Lance", tier: 4, mana: 11, cooldown: 2, element: "ice", help: "Piercing lance of ice that slows.", cast: line(16, 14, "ice", FROST, "random.glass") },
  { key: "regenerate", name: "Regenerate", tier: 4, mana: 16, cooldown: 15, element: "none", help: "Regeneration II for 12 seconds.", cast: buff([["regeneration", 12, 1]], "holy") },
  { key: "holy_ray", name: "Holy Ray", tier: 4, mana: 12, cooldown: 2, element: "holy", help: "Ray of holy light; strong against undead.", cast: bolt(28, 17, "holy", TOTEM, "random.orb") },
  { key: "summon_angel_4", name: "Summon Angel 4th Tier", tier: 4, mana: 28, cooldown: 40, element: "holy", help: "An Archangel Flame fights for you for 2 minutes.", cast: summoning(id("archangel_flame"), 1, "beacon.activate") },
  { key: "paralysis", name: "Paralysis", tier: 4, mana: 10, cooldown: 6, element: "none", help: "Holds one mob almost still for 6 seconds.", cast: curse(20, [["slowness", 6, 6], ["weakness", 6, 2], ["mining_fatigue", 6, 2]], "random.orb") },
  { key: "summon_undead_5", name: "Summon Undead 5th Tier", tier: 5, mana: 30, cooldown: 45, element: "dark", help: "Two Ghouls fight for you for 2 minutes.", cast: summoning(id("ghoul"), 2, "mob.wither.spawn") },
  { key: "dragon_lightning", name: "Dragon Lightning", tier: 5, mana: 16, cooldown: 3, element: "lightning", help: "Lightning that jumps to 4 mobs.", cast: chain(4, 16) },
  { key: "dimensional_move", name: "Dimensional Move", tier: 5, mana: 14, cooldown: 3, element: "none", help: "Teleport to the block you look at (32 blocks).", cast: castDimensionalMove },
  { key: "fire_rain", name: "Fire Rain", tier: 5, mana: 18, cooldown: 4, element: "fire", help: "Burning rain where you aim (4 blocks).", cast: burst(4, 16, "fire", { effect: FLAME, sound: "mob.ghast.fireball" }) },
  { key: "sand_field_all", name: "Sand Field: All", tier: 5, mana: 18, cooldown: 8, element: "arcane", help: "Sandstorm where you aim (6 blocks): slows and weakens.", cast: burst(6, 8, "arcane", { effect: CRIT, sound: "dig.grass", debuff: [["slowness", 8, 3], ["weakness", 8, 1]] }) },
  { key: "heal", name: "Heal", tier: 6, mana: 22, cooldown: 8, element: "holy", help: "Restores 10 hearts to you and players within 8 blocks.", cast: healing(20, 8) },
  { key: "bone_lance", name: "Thousand Bone Lance", tier: 6, mana: 18, cooldown: 3, element: "arcane", help: "Volley of lances through everything ahead.", cast: line(20, 24, "arcane", CRIT, "item.trident.riptide_1") },
  { key: "ice_pillar", name: "Ice Pillar", tier: 6, mana: 20, cooldown: 4, element: "ice", help: "Pillar of ice where you aim (4 blocks).", cast: burst(4, 22, "ice", { effect: FROST, sound: "random.glass" }) },
  { key: "wall_of_hell", name: "Wall of Hell", tier: 6, mana: 20, cooldown: 4, element: "fire", help: "Wall of hellfire through everything ahead (14 blocks).", cast: line(14, 24, "fire", FLAME, "mob.ghast.fireball") },
  { key: "summon_undead_6", name: "Summon Undead 6th Tier", tier: 6, mana: 45, cooldown: 60, element: "dark", help: "A Death Knight fights for you for 5 minutes.", cast: summoning(id("death_knight"), 1, "mob.wither.spawn") },
  { key: "chain_dragon_lightning", name: "Chain Dragon Lightning", tier: 7, mana: 26, cooldown: 4, element: "lightning", help: "Lightning that jumps to 8 mobs.", cast: chain(8, 24) },
  { key: "wail_of_the_banshee", name: "Wail of the Banshee", tier: 7, mana: 26, cooldown: 6, element: "dark", help: "A shriek of the dead ahead of you (8 blocks): harms every mob and throws it back.", cast: cone(8, 18, "dark", 1.6) },
  { key: "napalm", name: "Napalm", tier: 7, mana: 24, cooldown: 4, element: "fire", help: "Pillar of fire where you aim (4 blocks).", cast: burst(4, 22, "fire", { effect: FLAME }) },
  { key: "hell_flame", name: "Hell Flame", tier: 7, mana: 28, cooldown: 5, element: "fire", help: "A small black flame that consumes one mob.", cast: bolt(30, 42, "fire", FLAME, "mob.ghast.fireball") },
  { key: "holy_smite", name: "Holy Smite", tier: 7, mana: 28, cooldown: 5, element: "holy", help: "Pillar of holy light where you aim (4 blocks).", cast: burst(4, 30, "holy", { effect: TOTEM, sound: "beacon.activate" }) },
  { key: "gravity_maelstrom", name: "Gravity Maelstrom", tier: 8, mana: 32, cooldown: 6, element: "arcane", help: "Crushing sphere that drags mobs in (5 blocks).", cast: burst(5, 32, "arcane", { pull: true }) },
  { key: "full_potential", name: "Greater Full Potential", tier: 8, mana: 30, cooldown: 45, element: "none", help: "Strength II and Speed II for 30 seconds.", cast: buff([["strength", 30, 1], ["speed", 30, 1]], "holy") },
  { key: "death", name: "Death", tier: 8, mana: 36, cooldown: 8, element: "dark", help: "Negative energy that withers one mob (weak against undead).", cast: bolt(28, 52, "dark", SOUL, "mob.wither.hurt") },
  { key: "energy_drain", name: "Energy Drain", tier: 8, mana: 30, cooldown: 6, element: "dark", help: "Drains one mob: heals you and returns some mana.", cast: drain(38, 0.3, 10) },
  { key: "vermilion_nova", name: "Vermilion Nova", tier: 9, mana: 40, cooldown: 6, element: "fire", help: "Column of flame on a single mob.", cast: bolt(32, 60, "fire", FLAME, "mob.ghast.fireball") },
  { key: "call_greater_thunder", name: "Call Greater Thunder", tier: 9, mana: 42, cooldown: 6, element: "lightning", help: "Heavy lightning that jumps to 3 mobs.", cast: chain(3, 46) },
  { key: "grasp_heart", name: "Grasp Heart", tier: 9, mana: 45, cooldown: 10, element: "dark", help: "Crushes the heart of one mob; survivors are stunned.", cast: castGraspHeart },
  { key: "reality_slash", name: "Reality Slash", tier: 10, mana: 45, cooldown: 8, element: "arcane", help: "Cuts space itself along 24 blocks.", cast: line(24, 48, "arcane", CRIT, "item.trident.riptide_1") },
  { key: "time_stop", name: "Time Stop", tier: 10, mana: 50, cooldown: 40, element: "none", help: "Freezes mobs within 14 blocks for 8 seconds.", cast: castTimeStop },
  { key: "meteor_fall", name: "Meteor Fall", tier: 10, mana: 60, cooldown: 15, element: "fire", help: "A meteor lands where you aim after 2 seconds (7 blocks).", cast: burst(7, 60, "fire", { delay: 2, effect: FLAME }) },
  { key: "nuclear_blast", name: "Nuclear Blast", tier: 10, mana: 65, cooldown: 15, element: "fire", help: "Vast explosion where you aim (8 blocks).", cast: burst(8, 55, "fire", { effect: FLAME }) },
  { key: "implosion", name: "Implosion", tier: 10, mana: 60, cooldown: 12, element: "arcane", help: "Collapses one mob from within.", cast: bolt(30, 95, "arcane", CRIT, "random.explode") },
  { key: "fallen_down", name: "Fallen Down", tier: SUPER, mana: 120, cooldown: 120, element: "holy", help: "Super-tier: a pillar of light after 3 seconds (9 blocks).", cast: burst(9, 120, "holy", { delay: 3, sound: "ambient.weather.thunder" }) },
  { key: "ia_shub_niggurath", name: "Ia Shub-Niggurath", tier: SUPER, mana: 140, cooldown: 150, element: "dark", help: "Super-tier: a black wind of death after 4 seconds (10 blocks).", cast: burst(10, 140, "dark", { delay: 4, effect: SOUL, sound: "mob.wither.spawn" }) },
  { key: "goal_of_all_life", name: "The Goal of All Life Is Death", tier: GOD, mana: 200, cooldown: 300, element: "dark", help: "God-tier (for those who have conquered the Great Tomb): a clock of twelve marks counts down for six seconds; then every lesser creature within 40 blocks dies, bosses lose a third of their health, the souls heal you and four Death Knights rise to serve you.", cast: goalOfAllLife },
  { key: "pantheon", name: "Pantheon", tier: GOD, mana: 180, cooldown: 300, element: "holy", help: "God-tier (for those who have conquered the Great Tomb): the heavens open, six Archangel Flames descend to fight for you, and for ten seconds pillars of judgement fall on your foes within 32 blocks (twice as hard on the undead and demons) while your allies are healed; then all of them are struck at once.", cast: pantheon },
  { key: "cataclysm", name: "Cataclysm", tier: GOD, mana: 200, cooldown: 300, element: "fire", help: "God-tier (for those who have conquered the Great Tomb): the sky darkens over the place you point at; thirty meteors rain down across 20 blocks, then a colossal meteor strikes its heart, leaving burning ground and a shockwave out to 26 blocks.", cast: cataclysm },
  { key: "sword_of_damocles", name: "Sword of Damocles", tier: SUPER, mana: 130, cooldown: 150, element: "arcane", help: "Super-tier: a colossal blade falls after 4 seconds (6 blocks).", cast: burst(6, 200, "arcane", { delay: 4, sound: "random.anvil_land" }) },
];

/** Level needed to learn a tier. @param {number} tier */
export function levelForTier(tier) {
  return tier >= GOD ? 80 : tier >= SUPER ? 70 : (tier - 1) * 6 + 1;
}

/** Data Crystals needed to learn a tier. @param {number} tier */
export function costForTier(tier) {
  return tier >= GOD ? 48 : tier >= SUPER ? 30 : tier === 1 ? 0 : tier * 2;
}

/** @param {number} tier */
function tierName(tier) {
  return tier >= GOD ? "God-tier" : tier >= SUPER ? "Super-tier" : `Tier ${tier}`;
}

const MASTERY = [0, 10, 30, 70, 150]; // casts needed for mastery levels 1-5

/** Mastery level (1-5) of a spell. @param {Player} player @param {string} key */
export function masteryOf(player, key) {
  const casts = profileOf(player).casts[key] ?? 0;
  let level = 1;
  for (let i = 0; i < MASTERY.length; i++) if (casts >= MASTERY[i]) level = i + 1;
  return level;
}

/** Ensures the spell lists are sane and the starter spell is known. @param {Player} player */
function book(player) {
  const p = profileOf(player);
  const known = new Set(SPELLS.map((s) => s.key));
  p.spells = p.spells.filter((k) => known.has(k));
  if (!p.spells.includes("magic_arrow")) p.spells.push("magic_arrow");
  while (p.slots.length < SLOTS) p.slots.push("");
  p.slots = p.slots.slice(0, SLOTS).map((k) => (p.spells.includes(k) ? k : ""));
  if (!p.slots.some((k) => k !== "")) p.slots[0] = "magic_arrow";
  if (!(p.slot >= 0 && p.slot < SLOTS) || p.slots[p.slot] === "") p.slot = Math.max(0, p.slots.findIndex((k) => k !== ""));
  return p;
}

/** @param {string} key */
function spellByKey(key) {
  return SPELLS.find((s) => s.key === key);
}

/** @param {Player} player */
function refreshHud(player) {
  const p = book(player);
  const spell = spellByKey(p.slots[p.slot]);
  setHudExtra(player, spell ? ` §7| §d${spell.name}` : "");
}

// ------------------------------------------------------------------- casting

/** `${playerId}|${spell}` -> tick when castable again. */
const ready = new Map();

/** Clears every spell's recharge for a player (the Creative Tome of Ascension). @param {Player} player */
export function resetCooldowns(player) {
  for (const key of [...ready.keys()]) if (key.startsWith(`${player.id}|`)) ready.delete(key);
}

/** Teaches every spell, god-tier included, filling free slots. Returns how many were new. @param {Player} player */
export function learnAll(player) {
  const p = book(player);
  let added = 0;
  for (const spell of SPELLS) {
    if (p.spells.includes(spell.key)) continue;
    p.spells.push(spell.key);
    added += 1;
  }
  touch(player);
  refreshHud(player);
  return added;
}

/**
 * Casts the spell in the selected slot (Magic Wand).
 * @param {Player} player
 */
export function castSelected(player) {
  const p = book(player);
  const spell = spellByKey(p.slots[p.slot]);
  if (!spell) {
    notify(player, "§7No spell in this slot - open your Grimoire");
    return false;
  }
  const key = `${player.id}|${spell.key}`;
  const wait = Math.ceil(((ready.get(key) ?? 0) - system.currentTick) / TICKS);
  if (wait > 0) {
    notify(player, `§7${spell.name} ready in §f${wait}s`);
    return false;
  }
  const prof = profileOf(player);
  // Path of Tier Magic: cheaper spells, now and then a free one, and every fourth spell maximized.
  const count = (castCount.get(player.id) ?? 0) + 1;
  const maximized = skills.rank(prof, "maximize_magic") > 0 && count % 4 === 0;
  const free = maximized || Math.random() < skills.value(prof, "overcast") / 100;
  const cost = free ? 0 : Math.max(1, Math.round(spell.mana * skills.manaCostFactor(prof)));
  if (!spendMana(player, cost)) return false;
  const surge = !maximized && Math.random() < skills.value(prof, "spell_surge") / 100;
  const presence = skills.rank(prof, "presence") > 0 && hasAllies(player) ? skills.value(prof, "presence") / 100 : 0;
  const power =
    spellPower(player) *
    (1 + (masteryOf(player, spell.key) - 1) * 0.08) *
    (1 + skills.elementBonus(prof, spell.element) + presence) *
    (maximized ? 1.8 : surge ? 1.6 : 1);
  let done = false;
  try {
    done = spell.cast(player, power);
  } catch (error) {
    console.warn(`[Overlord] ${spell.key} failed: ${error}`);
  }
  if (!done) {
    restoreMana(player, cost);
    notify(player, `§7${spell.name}: no target`);
    return false;
  }
  castCount.set(player.id, count);
  fx.castFx(player, spell.element, spell.tier, POSE[spell.key] ?? "point");
  if (maximized || surge) {
    // The spell visibly swells: a second, larger burst of its element at the caster's hand.
    fx.nova(player.dimension, fx.handOf(player), spell.element, maximized ? 2.2 : 1.4);
  }
  if (spell.element === "holy") radiate(player, skills.value(prof, "radiance") * 2);
  ready.set(key, system.currentTick + Math.round(spell.cooldown * skills.cooldownFactor(prof) * TICKS));
  const before = masteryOf(player, spell.key);
  // Scholar: now and then a cast counts twice towards mastery.
  const study = Math.random() < skills.value(prof, "scholar") / 100 ? 2 : 1;
  p.casts[spell.key] = (p.casts[spell.key] ?? 0) + study;
  touch(player);
  const after = masteryOf(player, spell.key);
  if (after > before) {
    player.sendMessage(`§6[Overlord] §d${spell.name}§f reached mastery §e${after}§f (+${(after - 1) * 8}% power).`);
  } else notify(player, maximized ? `§d§lMaximize Magic: §r§d${spell.name}!` : surge ? `§dSpell Surge: ${spell.name}!` : `§d${spell.name}!${free ? " §7(Overcast: no mana)" : ""}`);
  return true;
}

/** Spells each player has cast, for Maximize Magic. */
/** @type {Map<string, number>} */
const castCount = new Map();

/**
 * Radiance: a holy spell heals other players and the caster's companions and summons nearby.
 * @param {Player} player @param {number} amount health restored
 */
function radiate(player, amount) {
  if (amount <= 0) return;
  try {
    const near = player.dimension.getEntities({ location: player.location, maxDistance: 6 });
    for (const ally of near) {
      if (ally.id === player.id) continue;
      const ours =
        ally.typeId === "minecraft:player" ||
        ally.hasTag(`overlord_ally_${player.id}`) ||
        (ally.typeId === id("retainer") && ally.getDynamicProperty("overlord:owner") === player.id);
      if (!ours) continue;
      const health = ally.getComponent("minecraft:health");
      if (!health || health.currentValue <= 0) continue;
      health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));
      fx.rise(player.dimension, ally.location, "holy", 0.6);
    }
  } catch {
    // an ally is unloading
  }
}

/**
 * Switches to the next filled spell slot (sneak + use the Magic Wand).
 * @param {Player} player
 */
export function cycleSpell(player) {
  const p = book(player);
  for (let step = 1; step <= SLOTS; step++) {
    const next = (p.slot + step) % SLOTS;
    if (p.slots[next] !== "") {
      p.slot = next;
      break;
    }
  }
  touch(player);
  refreshHud(player);
  const spell = spellByKey(p.slots[p.slot]);
  notify(player, spell ? `§dSpell: §f${spell.name} §7(${spell.mana} mana)` : "§7No spells assigned");
}

// ------------------------------------------------------------------ learning

/** @param {Player} player @param {string} itemId */
export function countItem(player, itemId) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return 0;
  let total = 0;
  for (let i = 0; i < container.size; i++) {
    const stack = container.getItem(i);
    if (stack && stack.typeId === itemId) total += stack.amount;
  }
  return total;
}

/** @param {Player} player @param {string} itemId @param {number} amount */
export function takeItem(player, itemId, amount) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  let left = amount;
  for (let i = 0; i < container.size && left > 0; i++) {
    const stack = container.getItem(i);
    if (!stack || stack.typeId !== itemId) continue;
    if (stack.amount > left) {
      stack.amount -= left;
      container.setItem(i, stack);
      left = 0;
    } else {
      left -= stack.amount;
      container.setItem(i, undefined);
    }
  }
}

/**
 * A scroll or tome of a spell was used: if the player knows the spell, it counts towards its mastery.
 * @param {Player} player @param {string} key
 */
export function creditCast(player, key) {
  const p = book(player);
  if (!p.spells.includes(key)) return false;
  const before = masteryOf(player, key);
  p.casts[key] = (p.casts[key] ?? 0) + 1;
  touch(player);
  const after = masteryOf(player, key);
  if (after > before) notify(player, `§d${spellByKey(key)?.name ?? key} mastery ${after}`);
  return true;
}

/**
 * Reading a tome teaches its spell for free, once the reader's level allows that tier.
 * @param {Player} player @param {string} key
 */
export function studyTome(player, key) {
  const p = book(player);
  const spell = spellByKey(key);
  if (!spell || p.spells.includes(key) || p.level < levelForTier(spell.tier)) return false;
  p.spells.push(key);
  const free = p.slots.indexOf("");
  if (free >= 0) p.slots[free] = key;
  touch(player);
  refreshHud(player);
  try {
    player.sendMessage(`§5[Grimoire] §fStudying the tome, you have learned §d${spell.name}§f. It can now be cast with the Magic Wand as well.`);
    player.playSound("random.levelup", { volume: 1, pitch: 1.5 });
  } catch {
    // cosmetic only
  }
  return true;
}

/**
 * Tries to learn a spell. Returns a message describing the outcome.
 * @param {Player} player @param {string} key
 */
export function learnSpell(player, key) {
  const p = book(player);
  const spell = spellByKey(key);
  if (!spell) return "§7Unknown spell";
  if (p.spells.includes(key)) return `§7You already know ${spell.name}`;
  if (p.level < levelForTier(spell.tier)) return `§7${spell.name} needs level ${levelForTier(spell.tier)}`;
  if (spell.tier >= GOD && !(Array.isArray(p.bosses) && p.bosses.includes("great_tomb"))) {
    return "§7God-tier magic is taught only to those who have conquered the Great Tomb of Nazarick";
  }
  const cost = costForTier(spell.tier);
  if (countItem(player, CRYSTAL) < cost) return `§7${spell.name} costs ${cost} Data Crystals`;
  takeItem(player, CRYSTAL, cost);
  p.spells.push(key);
  const free = p.slots.indexOf("");
  if (free >= 0) p.slots[free] = key;
  touch(player);
  refreshHud(player);
  try {
    player.playSound("random.levelup", { volume: 1, pitch: 1.5 });
  } catch {
    // cosmetic only
  }
  return `§aLearned §d${spell.name}§a!`;
}

/**
 * @param {ActionFormData} form @param {Player} player @param {(choice: number) => void} onChoice
 */
function show(form, player, onChoice) {
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      try {
        onChoice(response.selection);
      } catch (error) {
        console.warn(`[Overlord] grimoire action failed: ${error}`);
      }
    })
    .catch((error) => console.warn(`[Overlord] grimoire failed: ${error}`));
}

/**
 * Opens the Grimoire.
 * @param {Player} player
 */
export function openGrimoire(player) {
  const p = book(player);
  const form = new ActionFormData()
    .title("Grimoire")
    .body(
      `Spells known: §d${p.spells.length}/${SPELLS.length}§r\n` +
        "Assign up to four spells, then cast with the Magic Wand. Sneak + use the wand to switch spell."
    );
  for (let i = 0; i < SLOTS; i++) {
    const spell = spellByKey(p.slots[i]);
    form.button(`Slot ${i + 1}${i === p.slot ? " (selected)" : ""}\n${spell ? `${spell.name} - mastery ${masteryOf(player, spell.key)}` : "empty"}`);
  }
  form.button("Learn spells");
  form.button("Preview the eight elements\nShows each element's effects around you");
  form.button(`Spell lighting: ${fx.lightsEnabled() ? "on" : "off"}\nSpells light up their surroundings`);
  show(form, player, (choice) => {
    if (choice < SLOTS) openSlot(player, choice);
    else if (choice === SLOTS) openLearn(player);
    else if (choice === SLOTS + 1) fx.showcase(player);
    else {
      fx.setLights(!fx.lightsEnabled());
      if (!fx.lightsEnabled()) fx.dim(true);
      notify(player, fx.lightsEnabled() ? "§eSpells now light their surroundings" : "§7Spell lighting is off for this world");
    }
  });
}

/** @param {Player} player @param {number} slot */
function openSlot(player, slot) {
  const p = book(player);
  const known = SPELLS.filter((s) => p.spells.includes(s.key));
  const form = new ActionFormData().title(`Slot ${slot + 1}`).body("Choose the spell for this slot.");
  for (const spell of known) form.button(`${spell.name}\n${tierName(spell.tier)} - ${spell.mana} mana, ${spell.cooldown}s`);
  form.button("Empty this slot");
  show(form, player, (choice) => {
    const picked = choice < known.length ? known[choice].key : "";
    if (picked !== "") {
      const other = p.slots.indexOf(picked);
      if (other >= 0) p.slots[other] = p.slots[slot]; // swap instead of duplicating
    }
    p.slots[slot] = picked;
    if (picked !== "") p.slot = slot;
    touch(player);
    refreshHud(player);
    openGrimoire(player);
  });
}

/** @param {Player} player */
function openLearn(player) {
  const p = book(player);
  const unknown = SPELLS.filter((s) => !p.spells.includes(s.key));
  const form = new ActionFormData()
    .title("Learn spells")
    .body(`Your level: §6${p.level}§r   Data Crystals: §b${countItem(player, CRYSTAL)}§r`);
  for (const spell of unknown) {
    const locked = p.level < levelForTier(spell.tier);
    form.button(
      `${locked ? "§8" : ""}${spell.name} (${tierName(spell.tier)})\n` +
        (locked ? `Needs level ${levelForTier(spell.tier)}` : `${costForTier(spell.tier)} crystals - ${spell.help}`)
    );
  }
  form.button("Back");
  show(form, player, (choice) => {
    if (choice >= unknown.length) return openGrimoire(player);
    notify(player, learnSpell(player, unknown[choice].key));
    openLearn(player);
  });
}

// -------------------------------------------------------------------- setup

world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  system.runTimeout(() => {
    try {
      if (!player.isValid) return;
      refreshHud(player);
      if (event.initialSpawn && !player.hasTag("overlord_grimoire_given")) {
        player.addTag("overlord_grimoire_given");
        giveItem(player, id("grimoire"), 1);
        giveItem(player, id("magic_wand"), 1);
        player.sendMessage("§6[Overlord] §fYou received a §dGrimoire§f and a §dMagic Wand§f. Learn tier magic in the Grimoire and cast it with the wand.");
      }
    } catch {
      // player left before setup
    }
  }, 3 * TICKS);
});

world.afterEvents.playerLeave.subscribe((event) => {
  for (const key of [...ready.keys()]) if (key.startsWith(`${event.playerId}|`)) ready.delete(key);
});
