// Overlord: Tomb of Nazarick - weapons and armour in play.
//
// Weapons: every weapon of the add-on belongs to a kind (blade, greatsword, heavy, dagger, polearm,
// fist, staff, whip) and an element. Melee blows leave a crescent in the weapon's colour; every
// third blow in a quick chain is a finisher of the weapon's kind; dealing damage fills an Awakening
// gauge, and a full gauge awakens the weapon (sneak + use) for twelve seconds of stronger, burning
// blows. Weapons that had no active art now have one.
//
// Armour: two pieces of a set give a small bonus and four the full one (main.js keeps the old
// full-set effects); a full set surrounds its wearer with its own particles and grants an Armour Art,
// used by tapping sneak twice.
import { world, system, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { notify, registerMenu, restoreMana } from "./rpg.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {"blade" | "greatsword" | "heavy" | "dagger" | "polearm" | "fist" | "staff" | "whip"} Kind */

// ------------------------------------------------------------------ tables

/** What each kind of weapon does as the third blow of a chain. */
/** @type {Record<Kind, { name: string, help: string }>} */
export const FINISHERS = {
  blade: { name: "Crescent Cut", help: "a wide cut that strikes every foe in front of you for 70% of the blow" },
  greatsword: { name: "Cleaving Arc", help: "a full spin that strikes every foe within 3.5 blocks for 80% of the blow" },
  heavy: { name: "Earthbreaker", help: "a shockwave that strikes and lifts every foe within 4 blocks for 70% of the blow" },
  dagger: { name: "Thousand Cuts", help: "four more cuts on the target, each for 30% of the blow, and it withers" },
  polearm: { name: "Piercing Thrust", help: "a thrust that runs through everything in a 6-block line for 90% of the blow" },
  fist: { name: "Rising Dragon", help: "an uppercut for the full blow again that throws the target into the air" },
  staff: { name: "Arcane Burst", help: "a burst of magic around the target for 60% of the blow, and 6 mana back" },
  whip: { name: "Chain Lash", help: "the lash leaps to three more foes within 5 blocks for 60% of the blow" },
};

/**
 * Every weapon of the add-on: its kind, its element (the colour of its effects) and its arts.
 * `trait` is what each blow does (most of it in main.js); `art` is what using it does.
 * @type {Record<string, { kind: Kind, element: string, trait: string, art: string }>}
 */
export const WEAPONS = {
  staff_of_ainz_ooal_gown: { kind: "staff", element: "dark", trait: "-", art: "Fireball; sneak: Grasp Heart" },
  spuit_lance: { kind: "polearm", element: "dark", trait: "drinks a quarter of every blow", art: "Blood Lance: an 8-block thrust of blood that heals you for half the harm" },
  ginnungagap: { kind: "heavy", element: "arcane", trait: "-", art: "Shockwave" },
  god_slaying_emperor_blade: { kind: "blade", element: "ice", trait: "blue flame slows the target", art: "Azure Draw: a lunging draw-cut through everything in 6 blocks" },
  death_knight_sword: { kind: "greatsword", element: "dark", trait: "-", art: "Undead Wrath: a cursed slam that withers everything within 4 blocks" },
  dark_warrior_greatsword: { kind: "greatsword", element: "dark", trait: "-", art: "Twin Blade Storm: two whirling turns that cut everything within 4 blocks" },
  razor_edge: { kind: "blade", element: "none", trait: "a second cut ignores armour", art: "Fourfold Slash: four instant cuts on the foe before you" },
  stiletto: { kind: "dagger", element: "fire", trait: "sets the target alight", art: "Stored Spell: releases a burst of fire on the foe you look at" },
  shadow_of_yggdrasil: { kind: "staff", element: "acid", trait: "-", art: "Earth Surge" },
  aura_whip: { kind: "whip", element: "acid", trait: "-", art: "Lash" },
  frost_pain: { kind: "blade", element: "ice", trait: "slows the target", art: "Icy Burst" },
  brain_katana: { kind: "blade", element: "none", trait: "-", art: "God Flash" },
  iron_gauntlets: { kind: "fist", element: "none", trait: "throws the target back", art: "Dragon Fist: a wave of force down a 6-block line that hurls foes away" },
  magic_rifle: { kind: "heavy", element: "lightning", trait: "-", art: "Fires a magic bullet" },
  runic_hammer: { kind: "heavy", element: "lightning", trait: "-", art: "Rune Burst" },
  fang_dagger: { kind: "dagger", element: "dark", trait: "drinks part of every blow", art: "Feral Pounce: leap at the foe you look at and bite deep" },
  charons_guidance: { kind: "polearm", element: "dark", trait: "-", art: "Reap" },
  angel_mace: { kind: "heavy", element: "holy", trait: "burns the undead with holy fire", art: "Judgement: holy light falls on every foe within 4 blocks, twice as hard on the undead" },
  hellfire_blade: { kind: "blade", element: "fire", trait: "sets the target alight", art: "Hellfire Wall" },
  kilineyram: { kind: "blade", element: "dark", trait: "withers the target", art: "Dark Blade" },
  safarlisia: { kind: "blade", element: "holy", trait: "cuts the undead twice", art: "Holy Strike" },
  takemikazuchi: { kind: "blade", element: "lightning", trait: "-", art: "Five Kings" },
  fell_iron: { kind: "heavy", element: "none", trait: "staggers the target", art: "Fracture" },
  fluder_staff: { kind: "staff", element: "fire", trait: "-", art: "Triple Fireball" },
  golem_fist: { kind: "fist", element: "none", trait: "-", art: "Ground Slam" },
  holy_staff: { kind: "staff", element: "holy", trait: "-", art: "Holy Light" },
  blade_bug: { kind: "dagger", element: "acid", trait: "poisons the target", art: "Swarm: a cloud of blade bugs poisons everything within 4 blocks" },
  martial_lord_club: { kind: "heavy", element: "none", trait: "-", art: "Roar" },
  elf_kings_staff: { kind: "staff", element: "acid", trait: "-", art: "Call Elemental" },
  giants_maul: { kind: "heavy", element: "ice", trait: "-", art: "Quake" },
  dragonbone_blade: { kind: "greatsword", element: "none", trait: "the sweep carries half the blow to foes beside the target", art: "Dragon's Cleave: a great cut through everything in a 5-block cone" },
  six_arms_knuckles: { kind: "fist", element: "none", trait: "-", art: "Flurry" },
};

/** The new weapon arts: weapon -> [cooldown category, seconds]. */
/** @type {Record<string, [string, number]>} */
export const NEW_ARTS = {
  spuit_lance: ["overlord_blood_lance", 8],
  god_slaying_emperor_blade: ["overlord_azure_draw", 8],
  death_knight_sword: ["overlord_undead_wrath", 10],
  dark_warrior_greatsword: ["overlord_blade_storm", 9],
  razor_edge: ["overlord_fourfold", 7],
  stiletto: ["overlord_stored_spell", 8],
  iron_gauntlets: ["overlord_dragon_fist", 8],
  fang_dagger: ["overlord_pounce", 7],
  angel_mace: ["overlord_judgement", 10],
  blade_bug: ["overlord_swarm", 9],
  dragonbone_blade: ["overlord_dragon_cleave", 9],
};

/**
 * Armour sets: two pieces give `two`, a full set its old bonus (main.js), its aura and its art.
 * @type {Record<string, { name: string, element: string, particle: string, two: string, full: string, art: string, cooldown: number }>}
 */
export const SETS = {
  dark_warrior: { name: "Dark Warrior", element: "dark", particle: "wisp", two: "Resistance I", full: "Strength I and Resistance I", art: "Dark Charge: you hurl yourself forward, striking everything in your path", cooldown: 30 },
  world_champion: { name: "World Champion", element: "holy", particle: "glyph", two: "Speed I", full: "Strength II, Resistance I and Speed I", art: "Dimensional Cut: a cut through space along a 12-block line", cooldown: 45 },
  regalia: { name: "Overlord's Regalia", element: "dark", particle: "orbit", two: "a mana a second", full: "+50% mana recovery and +25% spell power", art: "Despair Aura: every foe within 10 blocks is weakened and slowed, and you regain 40 mana", cooldown: 40 },
  dragonscale: { name: "Dragonscale", element: "ice", particle: "shard", two: "Fire Resistance", full: "Fire Resistance, Resistance I; attackers are chilled", art: "Frost Breath: a cone of freezing breath 7 blocks long", cooldown: 30 },
  infernal: { name: "Infernal", element: "fire", particle: "ember", two: "Fire Resistance", full: "Fire Resistance and Strength I; attackers burn", art: "Hellfire Nova: a ring of fire bursts out 5 blocks around you", cooldown: 30 },
  vestment: { name: "Scripture Vestment", element: "holy", particle: "ray", two: "a mana a second", full: "Regeneration I", art: "Sanctuary: you and your allies within 8 blocks are healed and regenerate", cooldown: 40 },
  ranger: { name: "Ranger", element: "acid", particle: "dust", two: "Jump Boost I", full: "Speed I and Jump Boost I", art: "Arrow Rain: arrows fall around the spot you look at", cooldown: 30 },
  crimson: { name: "Crimson Valkyrie", element: "fire", particle: "droplet", two: "your blows drink 4% of their harm", full: "your blows drink 10% of their harm", art: "Blood Frenzy: Strength II and blows that drink 30% for 10 seconds", cooldown: 40 },
  platinum: { name: "Platinum", element: "holy", particle: "mote", two: "Resistance I", full: "Resistance II and Regeneration I", art: "Platinum Bulwark: Absorption III, Resistance III, and half of every blow thrown back for 8 seconds", cooldown: 45 },
  bonedragon: { name: "Bone Dragon", element: "dark", particle: "wisp", two: "15% of magical harm turned aside", full: "35% of magical harm turned aside", art: "Bone Prison: bones bind every foe within 6 blocks", cooldown: 35 },
  beasthide: { name: "Beast Hide", element: "acid", particle: "dust", two: "Haste I", full: "Haste I and Saturation", art: "Hunter's Howl: Speed II, Strength I and Jump Boost II for 12 seconds; foes nearby falter", cooldown: 35 },
};

const AWAKEN_FULL = 120; // damage dealt to fill the gauge
const AWAKEN_TICKS = 12 * TICKS;
const CHAIN_TICKS = 30; // a blow within this long of the last one keeps a chain going

// ------------------------------------------------------------------ helpers

/** The add-on weapon key the player holds, if any. @param {Player} player */
export function heldWeapon(player) {
  try {
    const item = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId;
    if (!item || !item.startsWith(`${NS}:`)) return undefined;
    const key = item.slice(NS.length + 1);
    return key in WEAPONS ? key : undefined;
  } catch {
    return undefined;
  }
}

/** How many pieces of each set the player wears. @param {Player} player */
export function wornSets(player) {
  /** @type {Record<string, number>} */
  const count = {};
  try {
    const gear = player.getComponent("minecraft:equippable");
    if (!gear) return count;
    /** @type {[EquipmentSlot, string][]} */
    const slots = [[EquipmentSlot.Head, "helmet"], [EquipmentSlot.Chest, "chestplate"], [EquipmentSlot.Legs, "leggings"], [EquipmentSlot.Feet, "boots"]];
    for (const [slot, piece] of slots) {
      const item = gear.getEquipment(slot)?.typeId;
      if (!item || !item.startsWith(`${NS}:`) || !item.endsWith(`_${piece}`)) continue;
      const set = item.slice(NS.length + 1, -(piece.length + 1));
      if (set in SETS) count[set] = (count[set] ?? 0) + 1;
    }
  } catch {
    // the player is leaving
  }
  return count;
}

/** The set the player wears in full, if any. @param {Player} player */
export function fullSet(player) {
  return Object.entries(wornSets(player)).find(([, n]) => n >= 4)?.[0];
}

/** @param {Vector3} a @param {Vector3} b @param {number} [scale] */
function add(a, b, scale = 1) {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale };
}

/** @param {Entity} entity @param {number} [dy] */
function above(entity, dy = 1) {
  return { x: entity.location.x, y: entity.location.y + dy, z: entity.location.z };
}

/** Flat facing of a player. @param {Player} player */
function facing(player) {
  let view = { x: 0, y: 0, z: 1 };
  try {
    view = player.getViewDirection();
  } catch {
    // keep the default
  }
  const length = Math.hypot(view.x, view.z) || 1;
  return { x: view.x / length, y: 0, z: view.z / length };
}

/** @param {Entity} entity @param {number} amount */
function heal(entity, amount) {
  try {
    const health = entity.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0 || amount <= 0) return;
    health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));
  } catch {
    // unloading
  }
}

/** @param {Entity} entity @param {Player} player */
function isFriend(entity, player) {
  try {
    if (entity.id === player.id || entity.typeId === "minecraft:player" || entity.typeId === id("retainer")) return true;
    if (entity.hasTag("overlord_summoned") || entity.hasTag(`overlord_ally_${player.id}`)) return true;
    return entity.getComponent("minecraft:tameable")?.isTamed === true;
  } catch {
    return true;
  }
}

/** Monsters near a spot. @param {Player} player @param {Vector3} at @param {number} radius */
export function foesNear(player, at, radius) {
  try {
    return player.dimension.getEntities({ location: at, maxDistance: radius, families: ["monster"] }).filter((e) => e.isValid && !isFriend(e, player));
  } catch {
    return [];
  }
}

/** Monsters in a cone in front of the player. @param {Player} player @param {number} reach @param {number} cos half-angle's cosine */
function foesAhead(player, reach, cos) {
  const dir = facing(player);
  return foesNear(player, player.location, reach).filter((foe) => {
    const dx = foe.location.x - player.location.x;
    const dz = foe.location.z - player.location.z;
    const length = Math.hypot(dx, dz);
    return length < 1 || (dx * dir.x + dz * dir.z) / length >= cos;
  });
}

/** Monsters along a line from the player. @param {Player} player @param {number} length */
function foesInLine(player, length) {
  const dir = facing(player);
  /** @type {Map<string, Entity>} */
  const found = new Map();
  for (let step = 1; step <= length; step += 1) {
    for (const foe of foesNear(player, add(player.location, dir, step), 1.6)) found.set(foe.id, foe);
  }
  return [...found.values()];
}

let striking = false;

/**
 * Deals harm straight off a foe's health (so it is not lost to the moment of invulnerability after a
 * blow), killing it outright when little would be left, credited to the player.
 * @param {Player} player @param {Entity} foe @param {number} amount
 */
export function strike(player, foe, amount) {
  try {
    if (!foe.isValid || amount <= 0) return;
    const health = foe.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0) return;
    if (health.currentValue - amount > 0.5) health.setCurrentValue(health.currentValue - amount);
    else {
      striking = true;
      try {
        foe.applyDamage(health.effectiveMax * 4, { cause: EntityDamageCause.magic, damagingEntity: player });
      } finally {
        striking = false;
      }
    }
  } catch {
    // the foe vanished
  }
}

/** @param {Entity} foe @param {number} up @param {Vector3} [from] */
function lift(foe, up, from) {
  try {
    if (from) {
      const dx = foe.location.x - from.x;
      const dz = foe.location.z - from.z;
      const length = Math.hypot(dx, dz) || 1;
      foe.applyKnockback({ x: (dx / length) * 1.2, z: (dz / length) * 1.2 }, up);
    } else foe.applyKnockback({ x: 0, z: 0 }, up);
  } catch {
    // some creatures cannot be moved
  }
}

/** @param {Player} player @param {string} sound @param {number} [pitch] */
function sound(player, sound, pitch = 1) {
  try {
    player.dimension.playSound(sound, player.location, { volume: 1, pitch });
  } catch {
    // cosmetic only
  }
}

/** Per-player cooldowns of the new arts and the armour arts. */
/** @type {Map<string, number>} */
const cooldowns = new Map();

/** @param {Player} player @param {string} category @param {number} seconds */
function ready(player, category, seconds) {
  const key = `${player.id}|${category}`;
  const left = Math.ceil(((cooldowns.get(key) ?? 0) - system.currentTick) / TICKS);
  if (left > 0) {
    notify(player, `§7Recharging... §f${left}s`);
    return false;
  }
  cooldowns.set(key, system.currentTick + seconds * TICKS);
  try {
    player.startItemCooldown(category, seconds * TICKS);
  } catch {
    // purely visual
  }
  return true;
}

/** Seconds until an armour art is ready again. @param {Player} player @param {string} set */
export function armourArtLeft(player, set) {
  return Math.max(0, Math.ceil(((cooldowns.get(`${player.id}|armour_${set}`) ?? 0) - system.currentTick) / TICKS));
}

// ------------------------------------------------------------------ blows

/** @type {Map<string, { count: number, tick: number }>} */
const chains = new Map();
/** Awakening gauge per player (0..AWAKEN_FULL). */
/** @type {Map<string, number>} */
export const gauges = new Map();
/** Tick until which each player's weapon is awake. */
/** @type {Map<string, number>} */
const awake = new Map();
/** Tick until which a Crimson set's Blood Frenzy lasts, and a Platinum Bulwark. */
/** @type {Map<string, number>} */
const frenzy = new Map();
/** @type {Map<string, number>} */
const bulwark = new Map();

/** Whether the player's weapon is awake. @param {Player} player */
export function isAwake(player) {
  return system.currentTick < (awake.get(player.id) ?? 0);
}

world.afterEvents.entityHurt.subscribe((event) => {
  if (striking) return;
  try {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    if (!attacker || attacker.typeId !== "minecraft:player" || event.damageSource.cause !== EntityDamageCause.entityAttack) return;
    if (!victim.isValid || victim.typeId === "minecraft:player") return;
    const player = /** @type {Player} */ (attacker);
    // A finishing blow dealt by another system (several times the foe's health) is not a swing of the weapon.
    const health = victim.getComponent("minecraft:health");
    if (health && event.damage >= health.effectiveMax * 3) return;
    onBlow(player, victim, event.damage);
  } catch {
    // the foe vanished mid-hit
  }
});

/**
 * A melee blow by a player: armour that drinks, then (with an add-on weapon) the crescent, the chain
 * and its finisher, the awakened burst and the gauge.
 * @param {Player} player @param {Entity} victim @param {number} damage
 */
export function onBlow(player, victim, damage) {
  const sets = wornSets(player);
  const drink = (system.currentTick < (frenzy.get(player.id) ?? 0) ? 0.3 : 0) + ((sets.crimson ?? 0) >= 2 && (sets.crimson ?? 0) < 4 ? 0.04 : 0);
  if (drink > 0) heal(player, damage * drink);

  const key = heldWeapon(player);
  if (!key) return;
  const weapon = WEAPONS[key];
  const d = player.dimension;
  fx.slash(d, above(victim), weapon.element, 1);

  // An awakened weapon hits harder and bursts in its element around the target.
  if (isAwake(player)) {
    strike(player, victim, damage * 0.35);
    fx.spark(d, above(victim), weapon.element, 1.1);
    for (const other of foesNear(player, victim.location, 2)) if (other.id !== victim.id) strike(player, other, damage * 0.3);
  }

  // The chain: every third blow in quick succession is the kind's finisher.
  const now = system.currentTick;
  const last = chains.get(player.id);
  const count = last && now - last.tick <= CHAIN_TICKS ? last.count + 1 : 1;
  chains.set(player.id, { count: count >= 3 ? 0 : count, tick: now });
  if (count >= 3) finisher(player, victim, damage, weapon.kind, weapon.element);
  else notify(player, `§7Combo ${"§f>".repeat(count)}${"§8>".repeat(3 - count)}`);

  // The gauge fills with the harm dealt; full, it waits for sneak + use.
  if (!isAwake(player)) {
    const before = gauges.get(player.id) ?? 0;
    const after = Math.min(AWAKEN_FULL, before + damage);
    gauges.set(player.id, after);
    if (before < AWAKEN_FULL && after >= AWAKEN_FULL) {
      notify(player, "§6Your weapon is ready to awaken §7(sneak + use)");
      fx.flash(d, fx.handOf(player), weapon.element, 1);
      sound(player, "beacon.activate", 1.6);
    }
  }
}

/**
 * The third blow of a chain.
 * @param {Player} player @param {Entity} victim @param {number} damage @param {Kind} kind @param {string} element
 */
export function finisher(player, victim, damage, kind, element) {
  const d = player.dimension;
  notify(player, `§6${FINISHERS[kind].name}!`);
  if (kind === "blade") {
    for (const foe of foesAhead(player, 3.5, 0.5)) {
      strike(player, foe, damage * 0.7);
      fx.slash(d, above(foe), element, 1.3);
    }
    for (let i = 0; i < 3; i++) system.runTimeout(() => fx.slash(d, fx.handOf(player, 1.6), element, 1.6 - i * 0.2), i * 2);
    fx.pose(player, "slash");
  } else if (kind === "greatsword") {
    for (const foe of foesNear(player, player.location, 3.5)) strike(player, foe, damage * 0.8);
    fx.ring(d, player.location, element, 3.5);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      fx.slash(d, { x: player.location.x + Math.cos(a) * 2, y: player.location.y + 1, z: player.location.z + Math.sin(a) * 2 }, element, 1.4);
    }
    fx.pose(player, "spin");
  } else if (kind === "heavy") {
    for (const foe of foesNear(player, victim.location, 4)) {
      strike(player, foe, damage * 0.7);
      lift(foe, 0.45, victim.location);
    }
    fx.nova(d, victim.location, element, 4);
    fx.shake(d, victim.location, 10, 0.35, 0.35);
    sound(player, "random.anvil_land", 0.6);
    fx.pose(player, "smash");
  } else if (kind === "dagger") {
    for (let i = 0; i < 4; i++) {
      system.runTimeout(() => {
        if (!victim.isValid) return;
        strike(player, victim, damage * 0.3);
        fx.slash(d, above(victim, 0.7 + i * 0.25), element, 0.8);
      }, 2 + i * 2);
    }
    try {
      victim.addEffect("wither", 3 * TICKS, { amplifier: 0 });
    } catch {
      // the target is gone
    }
    fx.pose(player, "thrust");
  } else if (kind === "polearm") {
    for (const foe of foesInLine(player, 6)) strike(player, foe, damage * 0.9);
    fx.beam(d, fx.handOf(player), add(above(player, 1.1), facing(player), 6), element, 1.3);
    fx.pose(player, "thrust");
  } else if (kind === "fist") {
    strike(player, victim, damage);
    lift(victim, 0.9);
    fx.spark(d, above(victim), element, 1.5);
    fx.rise(d, victim.location, element, 1);
    sound(player, "mob.irongolem.hit", 0.8);
    fx.pose(player, "uppercut");
  } else if (kind === "staff") {
    for (const foe of foesNear(player, victim.location, 3)) strike(player, foe, damage * 0.6);
    fx.nova(d, above(victim), element === "none" ? "arcane" : element, 3);
    restoreMana(player, 6);
    fx.pose(player, "point");
  } else {
    let from = victim;
    const struck = new Set([victim.id]);
    for (let hop = 0; hop < 3; hop++) {
      const next = foesNear(player, from.location, 5).find((f) => !struck.has(f.id));
      if (!next) break;
      struck.add(next.id);
      strike(player, next, damage * 0.6);
      fx.beam(d, above(from), above(next), element, 0.8);
      from = next;
    }
    fx.pose(player, "sweep");
  }
  fx.light(d, above(victim), 12, 6);
}

/**
 * Awakens the held weapon if its gauge is full. Returns whether it did.
 * @param {Player} player
 */
export function tryAwaken(player) {
  const key = heldWeapon(player);
  if (!key || (gauges.get(player.id) ?? 0) < AWAKEN_FULL || isAwake(player)) return false;
  const element = WEAPONS[key].element;
  gauges.set(player.id, 0);
  awake.set(player.id, system.currentTick + AWAKEN_TICKS);
  const d = player.dimension;
  fx.pillar(d, player.location, element, 5);
  fx.nova(d, above(player), element, 3);
  fx.spiral(d, () => (player.isValid ? player.location : undefined), element, 1.1, 2.6);
  fx.shake(d, player.location, 8, 0.3, 0.4);
  fx.pose(player, "awaken");
  sound(player, "beacon.activate", 0.7);
  notify(player, "§6§lWeapon Awakened! §r§7(12 s: +35% harm, bursts on every blow)");
  return true;
}

// ------------------------------------------------------------------ new weapon arts

/**
 * Uses the art of a weapon that had none before. Returns whether the item was one of them.
 * @param {Player} player @param {string} item full item id
 */
export function useWeaponArt(player, item) {
  const key = item.startsWith(`${NS}:`) ? item.slice(NS.length + 1) : item;
  const art = NEW_ARTS[key];
  if (!art) return false;
  if (!ready(player, art[0], art[1])) return true;
  const d = player.dimension;
  const element = WEAPONS[key].element;
  const dir = facing(player);
  const ahead = (/** @type {number} */ n) => add(above(player, 1.1), dir, n);
  if (key === "spuit_lance") {
    let drawn = 0;
    for (const foe of foesInLine(player, 8)) {
      strike(player, foe, 10);
      drawn += 10;
      fx.spark(d, above(foe), "dark", 1);
    }
    heal(player, drawn * 0.5);
    fx.beam(d, fx.handOf(player), ahead(8), "dark", 1.5);
    fx.pose(player, "thrust");
    sound(player, "item.trident.riptide_1", 0.8);
  } else if (key === "god_slaying_emperor_blade") {
    for (const foe of foesInLine(player, 6)) {
      strike(player, foe, 12);
      foe.addEffect("slowness", 4 * TICKS, { amplifier: 2 });
      fx.slash(d, above(foe), "ice", 1.4);
    }
    try {
      player.applyKnockback({ x: dir.x * 2.2, z: dir.z * 2.2 }, 0.15);
    } catch {
      // cannot be moved
    }
    fx.beam(d, above(player, 1), ahead(6), "ice", 1.2);
    fx.pose(player, "draw");
    sound(player, "item.trident.riptide_1", 1.3);
  } else if (key === "death_knight_sword") {
    for (const foe of foesNear(player, player.location, 4)) {
      strike(player, foe, 10);
      foe.addEffect("wither", 4 * TICKS, { amplifier: 1 });
    }
    fx.nova(d, player.location, "dark", 4);
    fx.skull(d, above(player, 2.2), 1.2);
    fx.shake(d, player.location, 8, 0.3, 0.3);
    fx.pose(player, "smash");
    sound(player, "mob.wither.shoot", 0.7);
  } else if (key === "dark_warrior_greatsword") {
    for (let turn = 0; turn < 2; turn++) {
      system.runTimeout(() => {
        if (!player.isValid) return;
        for (const foe of foesNear(player, player.location, 4)) strike(player, foe, 7);
        fx.ring(d, player.location, "dark", 4);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          fx.slash(d, { x: player.location.x + Math.cos(a) * 2.5, y: player.location.y + 1, z: player.location.z + Math.sin(a) * 2.5 }, "dark", 1.4);
        }
        fx.pose(player, "spin");
      }, turn * 8);
    }
    sound(player, "mob.irongolem.throw", 0.7);
  } else if (key === "razor_edge") {
    const foe = foesAhead(player, 5, 0.6)[0];
    if (!foe) {
      cooldowns.delete(`${player.id}|${art[0]}`);
      notify(player, "§7No foe before you");
      return true;
    }
    for (let i = 0; i < 4; i++) {
      system.runTimeout(() => {
        strike(player, foe, 6);
        if (foe.isValid) fx.slash(d, above(foe, 0.6 + i * 0.3), "none", 1.3);
      }, i * 3);
    }
    fx.pose(player, "slash");
    sound(player, "item.trident.riptide_1", 1.6);
  } else if (key === "stiletto") {
    const foe = aimed(player, 16);
    const at = foe ? foe.location : ahead(5);
    for (const other of foesNear(player, at, 2.5)) {
      strike(player, other, 12);
      other.setOnFire(5, true);
    }
    fx.beam(d, fx.handOf(player), foe ? above(foe) : at, "fire", 1);
    fx.nova(d, foe ? above(foe) : at, "fire", 2.5);
    fx.pose(player, "point");
    sound(player, "mob.blaze.shoot", 1);
  } else if (key === "iron_gauntlets") {
    for (const foe of foesInLine(player, 6)) {
      strike(player, foe, 12);
      lift(foe, 0.5, player.location);
    }
    fx.beam(d, fx.handOf(player), ahead(6), "none", 1.6);
    fx.spark(d, ahead(2), "none", 1.6);
    fx.shake(d, player.location, 6, 0.25, 0.25);
    fx.pose(player, "thrust");
    sound(player, "mob.irongolem.hit", 0.7);
  } else if (key === "fang_dagger") {
    const foe = aimed(player, 12);
    if (!foe) {
      cooldowns.delete(`${player.id}|${art[0]}`);
      notify(player, "§7Look at a foe to pounce on it");
      return true;
    }
    const dx = foe.location.x - player.location.x;
    const dz = foe.location.z - player.location.z;
    const length = Math.hypot(dx, dz) || 1;
    try {
      player.applyKnockback({ x: (dx / length) * Math.min(3, length * 0.35), z: (dz / length) * Math.min(3, length * 0.35) }, 0.35);
    } catch {
      // cannot be moved
    }
    system.runTimeout(() => {
      strike(player, foe, 10);
      heal(player, 5);
      if (foe.isValid) fx.slash(d, above(foe), "dark", 1.5);
    }, 6);
    fx.pose(player, "thrust");
    sound(player, "mob.ravager.ambient", 1.4);
  } else if (key === "angel_mace") {
    for (const foe of foesNear(player, player.location, 4)) {
      const undead = foe.matches({ families: ["undead"] });
      strike(player, foe, undead ? 20 : 10);
      fx.pillar(d, foe.location, "holy", 3);
    }
    fx.nova(d, player.location, "holy", 4);
    fx.pose(player, "smash");
    sound(player, "beacon.activate", 1.2);
  } else if (key === "blade_bug") {
    for (const foe of foesNear(player, player.location, 4)) {
      strike(player, foe, 4);
      foe.addEffect("poison", 6 * TICKS, { amplifier: 1 });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      fx.puff(d, "droplet", { x: player.location.x + Math.cos(a) * 2.5, y: player.location.y + 1, z: player.location.z + Math.sin(a) * 2.5 }, "acid", 1);
    }
    fx.ring(d, player.location, "acid", 4);
    fx.pose(player, "sweep");
    sound(player, "mob.spider.say", 1.4);
  } else if (key === "dragonbone_blade") {
    for (const foe of foesAhead(player, 5, 0.5)) {
      strike(player, foe, 14);
      lift(foe, 0.3, player.location);
      fx.slash(d, above(foe), "none", 1.5);
    }
    fx.slash(d, ahead(2), "none", 2.2);
    fx.shake(d, player.location, 8, 0.3, 0.3);
    fx.pose(player, "spin");
    sound(player, "mob.enderdragon.hit", 0.8);
  }
  fx.light(d, above(player, 1.2), 12, 6);
  return true;
}

/** The monster the player looks at, if any. @param {Player} player @param {number} reach */
function aimed(player, reach) {
  try {
    return player
      .getEntitiesFromViewDirection({ maxDistance: reach })
      .map((hit) => hit.entity)
      .find((e) => e.isValid && e.getComponent("minecraft:health") && !isFriend(e, player));
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ armour

/** Armour Art of a full set. Returns a message. @param {Player} player @param {string} set */
export function armourArt(player, set) {
  const info = SETS[set];
  if (!info) return "";
  const key = `${player.id}|armour_${set}`;
  const left = armourArtLeft(player, set);
  if (left > 0) return `§7${info.name} art ready in ${left}s`;
  cooldowns.set(key, system.currentTick + info.cooldown * TICKS);
  const d = player.dimension;
  const dir = facing(player);
  const element = info.element;
  const ahead = (/** @type {number} */ n) => add(above(player, 1.1), dir, n);
  if (set === "dark_warrior") {
    for (const foe of foesInLine(player, 6)) strike(player, foe, 10);
    try {
      player.applyKnockback({ x: dir.x * 3, z: dir.z * 3 }, 0.2);
    } catch {
      // cannot be moved
    }
    player.addEffect("resistance", 3 * TICKS, { amplifier: 1, showParticles: false });
    fx.beam(d, above(player, 1), ahead(6), "dark", 1.5);
    fx.pose(player, "thrust");
    sound(player, "mob.enderdragon.flap", 0.8);
  } else if (set === "world_champion") {
    for (const foe of foesInLine(player, 12)) strike(player, foe, 20);
    for (let n = 2; n <= 12; n += 2.5) fx.slash(d, ahead(n), "holy", 1.8);
    fx.beam(d, fx.handOf(player), ahead(12), "arcane", 2);
    fx.shake(d, player.location, 12, 0.4, 0.4);
    fx.pose(player, "slash");
    sound(player, "ambient.weather.thunder", 1.4);
  } else if (set === "regalia") {
    for (const foe of foesNear(player, player.location, 10)) {
      foe.addEffect("weakness", 8 * TICKS, { amplifier: 1 });
      foe.addEffect("slowness", 8 * TICKS, { amplifier: 0 });
    }
    restoreMana(player, 40);
    fx.dome(d, player.location, "dark");
    fx.pose(player, "raise");
    sound(player, "mob.wither.ambient", 0.6);
  } else if (set === "dragonscale") {
    for (const foe of foesAhead(player, 7, 0.7)) {
      strike(player, foe, 12);
      foe.addEffect("slowness", 5 * TICKS, { amplifier: 2 });
    }
    for (const spread of [-0.35, 0, 0.35]) {
      const turn = { x: dir.x * Math.cos(spread) - dir.z * Math.sin(spread), y: 0, z: dir.x * Math.sin(spread) + dir.z * Math.cos(spread) };
      fx.beam(d, fx.handOf(player), add(above(player, 1.1), turn, 7), "ice", 1.4);
    }
    fx.pose(player, "point");
    sound(player, "random.glass", 0.6);
  } else if (set === "infernal") {
    for (const foe of foesNear(player, player.location, 5)) {
      strike(player, foe, 12);
      foe.setOnFire(6, true);
    }
    fx.nova(d, player.location, "fire", 5);
    fx.shake(d, player.location, 8, 0.3, 0.3);
    fx.pose(player, "smash");
    sound(player, "random.explode", 1.2);
  } else if (set === "vestment") {
    for (const ally of [player, ...d.getPlayers({ location: player.location, maxDistance: 8 }).filter((o) => o.id !== player.id)]) {
      heal(ally, 8);
      ally.addEffect("regeneration", 6 * TICKS, { amplifier: 1, showParticles: false });
    }
    try {
      for (const e of d.getEntities({ type: id("retainer"), location: player.location, maxDistance: 8 })) heal(e, 8);
    } catch {
      // nothing near
    }
    fx.dome(d, player.location, "holy");
    fx.pose(player, "self");
    sound(player, "beacon.activate", 1.4);
  } else if (set === "ranger") {
    const target = aimed(player, 24)?.location ?? add(player.location, dir, 10);
    for (let wave = 0; wave < 5; wave++) {
      system.runTimeout(() => {
        for (const foe of foesNear(player, target, 4)) strike(player, foe, 4);
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 3.5;
          fx.fall(d, { x: target.x + Math.cos(a) * r, y: target.y, z: target.z + Math.sin(a) * r }, "acid", 6, 2);
        }
        sound(player, "random.bow", 0.8 + wave * 0.1);
      }, wave * 6);
    }
    fx.pose(player, "raise");
  } else if (set === "crimson") {
    frenzy.set(player.id, system.currentTick + 10 * TICKS);
    player.addEffect("strength", 10 * TICKS, { amplifier: 1, showParticles: false });
    fx.spiral(d, () => (player.isValid ? player.location : undefined), "fire", 1, 2.4);
    fx.pose(player, "self");
    sound(player, "mob.ravager.roar", 1.3);
  } else if (set === "platinum") {
    bulwark.set(player.id, system.currentTick + 8 * TICKS);
    player.addEffect("absorption", 10 * TICKS, { amplifier: 2, showParticles: false });
    player.addEffect("resistance", 4 * TICKS, { amplifier: 2, showParticles: false });
    fx.dome(d, player.location, "holy");
    fx.pose(player, "self");
    sound(player, "random.anvil_use", 0.8);
  } else if (set === "bonedragon") {
    for (const foe of foesNear(player, player.location, 6)) {
      strike(player, foe, 6);
      foe.addEffect("slowness", 4 * TICKS, { amplifier: 5 });
      foe.addEffect("weakness", 4 * TICKS, { amplifier: 1 });
      fx.rise(d, foe.location, "dark", 0.9);
    }
    fx.ring(d, player.location, "dark", 6);
    fx.skull(d, above(player, 2.3), 1.3);
    fx.pose(player, "summon");
    sound(player, "mob.skeleton.death", 0.6);
  } else if (set === "beasthide") {
    player.addEffect("speed", 12 * TICKS, { amplifier: 1, showParticles: false });
    player.addEffect("strength", 12 * TICKS, { amplifier: 0, showParticles: false });
    player.addEffect("jump_boost", 12 * TICKS, { amplifier: 1, showParticles: false });
    for (const foe of foesNear(player, player.location, 8)) foe.addEffect("slowness", 4 * TICKS, { amplifier: 1 });
    fx.ring(d, player.location, "acid", 8);
    fx.pose(player, "raise");
    sound(player, "mob.ravager.roar", 0.9);
  }
  fx.light(d, above(player, 1.2), 14, 8);
  return `§6${info.art.split(":")[0]}!`;
}

// Defences of the partial sets and the Platinum Bulwark.
world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const victim = event.hurtEntity;
    if (victim.typeId !== "minecraft:player" || !victim.isValid) return;
    const player = /** @type {Player} */ (victim);
    const health = player.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0) return;
    const sets = wornSets(player);
    const cause = String(event.damageSource.cause);
    const magical = ["magic", "fire", "lightning", "entityExplosion", "wither", "fireTick"].includes(cause);
    if (magical && (sets.bonedragon ?? 0) >= 2 && (sets.bonedragon ?? 0) < 4) heal(player, event.damage * 0.15);
    const attacker = event.damageSource.damagingEntity;
    if (attacker && attacker.isValid && attacker.typeId !== "minecraft:player" && system.currentTick < (bulwark.get(player.id) ?? 0)) {
      strike(player, attacker, event.damage * 0.5); // the Bulwark throws half of every blow back
      fx.flash(player.dimension, above(attacker), "holy", 0.8);
    }
  } catch {
    // the wearer left
  }
});

/** The effects two pieces of each set keep up. */
/** @type {Record<string, [string, number] | undefined>} */
const TWO_EFFECTS = {
  dark_warrior: ["resistance", 0],
  world_champion: ["speed", 0],
  dragonscale: ["fire_resistance", 0],
  infernal: ["fire_resistance", 0],
  ranger: ["jump_boost", 0],
  platinum: ["resistance", 0],
  beasthide: ["haste", 0],
};

/** Armour Art input: sneak tapped twice within half a second. */
/** @type {Map<string, { was: boolean, taps: number[] }>} */
const taps = new Map();

/**
 * One step of a player's arms: double-tap detection every two ticks, and every second the partial-set
 * bonuses, the armour's aura and the glow of an awakened or ready weapon.
 * @param {Player} player @param {number} tick
 */
export function step(player, tick) {
  const state = taps.get(player.id) ?? { was: false, taps: [] };
  taps.set(player.id, state);
  const sneaking = player.isSneaking === true;
  if (sneaking && !state.was) {
    state.taps = state.taps.filter((t) => tick - t <= 10);
    state.taps.push(tick);
    if (state.taps.length >= 2) {
      state.taps = [];
      const set = fullSet(player);
      if (set) notify(player, armourArt(player, set));
    }
  }
  state.was = sneaking;
  if (tick % TICKS !== 0) return;

  const d = player.dimension;
  const sets = wornSets(player);
  for (const [set, pieces] of Object.entries(sets)) {
    if (pieces >= 2 && pieces < 4) {
      const effect = TWO_EFFECTS[set];
      if (effect) player.addEffect(effect[0], 3 * TICKS, { amplifier: effect[1], showParticles: false });
      if (set === "vestment" || set === "regalia") restoreMana(player, 1);
    }
    if (pieces >= 4 && tick % (2 * TICKS) === 0) {
      // A full set wraps its wearer in its own particles.
      const info = SETS[set];
      const a = (tick / TICKS) * 1.3;
      fx.puff(d, info.particle, { x: player.location.x + Math.cos(a) * 0.6, y: player.location.y + 0.4 + (tick % 3) * 0.5, z: player.location.z + Math.sin(a) * 0.6 }, info.element, 0.7);
    }
  }
  const key = heldWeapon(player);
  if (!key) return;
  const element = WEAPONS[key].element;
  if (isAwake(player)) {
    fx.puff(d, "flame_linger", fx.handOf(player, 0.8), element, 0.8);
    fx.puff(d, "orbit", player.location, element, 0.9);
    fx.light(d, above(player, 1.2), 10, 22);
  } else if ((gauges.get(player.id) ?? 0) >= AWAKEN_FULL && tick % (2 * TICKS) === 0) {
    fx.puff(d, "spark", fx.handOf(player, 0.8), element, 0.6);
  }
}

system.runInterval(() => {
  const tick = system.currentTick;
  for (const player of world.getAllPlayers()) {
    try {
      step(player, tick);
    } catch {
      // the player is leaving
    }
  }
}, 2);

// ------------------------------------------------------------------ menu

/** @param {Player} player */
export function openArsenal(player) {
  const key = heldWeapon(player);
  const lines = [];
  if (key) {
    const w = WEAPONS[key];
    const gauge = gauges.get(player.id) ?? 0;
    lines.push(
      `§e§lIn hand§r: ${w.kind} of ${w.element === "none" ? "steel" : w.element}`,
      `Each blow: ${w.trait === "-" ? "a crescent of its colour" : w.trait}`,
      `Use: ${w.art}`,
      `Third blow of a chain: §6${FINISHERS[w.kind].name}§r - ${FINISHERS[w.kind].help}`,
      isAwake(player) ? "§6Awakened!§r" : `Awakening: ${Math.floor((gauge / AWAKEN_FULL) * 100)}%${gauge >= AWAKEN_FULL ? " §6- sneak + use to awaken§r" : ""}`,
      ""
    );
  } else lines.push("§7You hold none of the add-on's weapons.§r", "");
  const sets = Object.entries(wornSets(player));
  if (sets.length === 0) lines.push("§7You wear none of the add-on's armour sets.§r");
  for (const [set, pieces] of sets) {
    const info = SETS[set];
    lines.push(
      `§e§l${info.name}§r ${pieces}/4`,
      ` 2 pieces: ${pieces >= 2 ? "§a" : "§8"}${info.two}§r`,
      ` 4 pieces: ${pieces >= 4 ? "§a" : "§8"}${info.full}§r`,
      ` Armour Art (tap sneak twice): ${pieces >= 4 ? "§a" : "§8"}${info.art}§r${pieces >= 4 && armourArtLeft(player, set) > 0 ? ` §7(${armourArtLeft(player, set)}s)` : ""}`
    );
  }
  lines.push(
    "",
    "§7Every weapon belongs to a kind, and every third blow of a quick chain is that kind's finisher. Dealing harm fills the Awakening gauge; " +
      "with it full, sneak and use the weapon to awaken it for 12 seconds."
  );
  new ActionFormData()
    .title("Arsenal")
    .body(lines.join("\n"))
    .button("Close")
    .show(player)
    .catch(() => {});
}

registerMenu(() => "Arsenal: weapon and armour arts", openArsenal);

/** Reset a player's state when they leave. */
world.afterEvents.playerLeave.subscribe((event) => {
  for (const map of [chains, gauges, awake, frenzy, bulwark, taps]) map.delete(event.playerId); // gauges are not saved
});
