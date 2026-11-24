// Overlord: Tomb of Nazarick - the companions' arts (v11).
//
// Every art in classes.js is data: a kind and its numbers. This module turns each kind into an effect in the
// world (strike, bolt, nova, heal, summon, ...) and scores how useful an art is at this moment, so a companion
// uses the right art at the right time: heals when someone is hurt, a sweep when foes crowd in, a shield before
// a boss's blow lands. party.js lends it what it knows of the party through bind(); the old party's hand-made
// arts run through the "legacy" kind.
import { system } from "@minecraft/server";
import * as fx from "./vfx.js";

const TICKS = 20;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("./classes.js").Art} Art */
/**
 * What an art needs to know. party.js builds it each turn.
 * @typedef {{
 *   player: Player, entity: Entity, member: any, level: number, power: number, d: import("@minecraft/server").Dimension,
 *   hand: Vector3, foe: Entity | undefined, gap: number, masterShare: number,
 *   masterHealth: import("@minecraft/server").EntityHealthComponent | undefined, near: boolean, voc?: number, env?: Env,
 * }} Turn
 */
/**
 * What party.js lends the arts.
 * @typedef {{
 *   hit: (t: Turn, target: Entity, amount: number, cause?: "entityAttack" | "magic" | "fire") => boolean,
 *   foesNear: (player: Player, at: Vector3, radius: number) => Entity[],
 *   companions: (player: Player) => Entity[],
 *   stagger: (foe: Entity, seconds: number) => void,
 *   say: (player: Player, member: any, text: string, pause?: number, urgent?: boolean) => boolean,
 *   fallen: (player: Player) => number,
 *   revive: (player: Player, count: number) => number,
 *   inCombat: (player: Player) => boolean,
 *   healPlayer: (player: Player, amount: number) => boolean,
 *   isElite: (entity: Entity) => boolean,
 *   coins: (player: Player, count: number) => void,
 *   legacy: (key: string) => { use: (t: Turn) => boolean, urgent?: boolean, name: string } | undefined,
 *   danger: (at: Vector3) => { x: number, z: number } | undefined,
 *   wild?: boolean,
 * }} Env  wild: what an art summons is the foe's (an NPC's minions), not the party's
 */

/** @type {Env} */
const env = /** @type {any} */ ({});
/** The env a turn acts in: the party's, or the one an NPC's turn brings (v11.1). @param {Turn} t @returns {Env} */
const E = (t) => t.env ?? env;
/** party.js hands over what the arts may use. @param {Partial<Env>} parts */
export function bind(parts) {
  Object.assign(env, parts);
}

/** Element a foe is weak to. */
/** @type {Record<string, string>} */
export const WEAK_TO = {
  "overlord:cocytus": "fire", "overlord:soul_eater": "fire", "overlord:solution": "fire", "overlord:frost_dragon": "fire",
  "overlord:war_troll": "fire", "overlord:frost_giant": "fire", "overlord:treant_sapling": "fire", "overlord:zytl_qae": "fire",
  "overlord:wraith": "holy", "overlord:death_cavalier": "holy", "overlord:go_gin": "fire", "overlord:behemoth": "acid",
  "overlord:eight_edge_assassin": "holy", "overlord:platinum_dragon_lord": "dark", "overlord:dark_young": "fire",
  "overlord:jaldabaoth": "ice", "overlord:gigant_basilisk": "ice", "overlord:skeletal_dragon": "holy", "overlord:hellhound": "ice",
  "overlord:evil_lord_wrath": "ice", "overlord:shadow_demon": "holy", "overlord:archangel_flame": "dark",
  "overlord:dominion_authority": "dark", "overlord:demiurge": "ice", "overlord:fluder": "ice",
  "minecraft:blaze": "ice", "minecraft:stray": "fire", "minecraft:zombie": "holy", "minecraft:skeleton": "holy",
  "minecraft:husk": "holy", "minecraft:drowned": "lightning", "minecraft:magma_cube": "ice", "minecraft:slime": "fire",
  "minecraft:spider": "fire", "minecraft:cave_spider": "fire", "minecraft:wither_skeleton": "holy", "minecraft:phantom": "holy",
};

/** The pose each kind of art is drawn with, by vocation when it differs. */
const P = (/** @type {string} */ name) => `animation.overlord.${name}`;
const KIND_POSE = {
  strike: [P("weapon_slash"), P("party_draw"), P("cast_point"), P("weapon_slam"), P("weapon_thrust"), P("party_strum"), P("party_punch"), P("party_reap")],
  bolt: [P("weapon_thrust"), P("party_draw"), P("cast_point"), P("cast_point"), P("party_throw"), P("party_strum"), P("party_punch"), P("cast_point")],
  multi: [P("weapon_spin"), P("party_draw"), P("cast_sweep"), P("cast_sweep"), P("party_throw"), P("party_strum"), P("party_kick"), P("cast_sweep")],
  chain: [P("weapon_slash"), P("party_draw"), P("cast_point"), P("cast_point"), P("party_throw"), P("party_strum"), P("party_punch"), P("cast_point")],
  cleave: [P("weapon_spin"), P("weapon_spin"), P("cast_sweep"), P("weapon_slam"), P("weapon_spin"), P("party_dance"), P("party_kick"), P("party_reap")],
  nova: [P("weapon_slam"), P("party_skyshot"), P("cast_slam"), P("cast_slam"), P("party_throw"), P("party_strum"), P("party_kick"), P("cast_slam")],
  rain: [P("cast_raise"), P("party_skyshot"), P("cast_raise"), P("cast_raise"), P("party_throw"), P("party_strum"), P("cast_raise"), P("cast_raise")],
  dash: [P("weapon_thrust"), P("weapon_thrust"), P("weapon_thrust"), P("weapon_thrust"), P("weapon_thrust"), P("party_dance"), P("party_kick"), P("weapon_thrust")],
  blink: [P("weapon_thrust"), P("weapon_thrust"), P("weapon_thrust"), P("weapon_thrust"), P("weapon_thrust"), P("weapon_thrust"), P("party_punch"), P("weapon_thrust")],
  afflict: [P("party_taunt"), P("party_draw"), P("cast_sweep"), P("cast_point"), P("party_throw"), P("party_strum"), P("party_punch"), P("party_channel")],
  aura: [P("party_taunt"), P("cast_channel"), P("cast_channel"), P("party_pray"), P("cast_channel"), P("party_strum"), P("party_meditate"), P("party_channel")],
  pull: [P("cast_channel"), P("cast_channel"), P("cast_channel"), P("cast_channel"), P("cast_channel"), P("party_strum"), P("cast_channel"), P("party_channel")],
  heal: [P("cast_self"), P("cast_self"), P("cast_self"), P("cast_self"), P("cast_self"), P("party_strum"), P("party_meditate"), P("party_channel")],
  shield: [P("cast_raise"), P("cast_raise"), P("cast_raise"), P("cast_raise"), P("cast_raise"), P("party_strum"), P("party_meditate"), P("party_summon")],
  buff: [P("party_taunt"), P("cast_raise"), P("cast_raise"), P("party_pray"), P("cast_raise"), P("party_strum"), P("party_meditate"), P("party_channel")],
  summon: [P("cast_raise"), P("party_whistle"), P("party_summon"), P("party_pray"), P("party_summon"), P("party_strum"), P("party_summon"), P("party_summon")],
  revive: [P("party_pray"), P("party_pray"), P("party_pray"), P("party_pray"), P("party_pray"), P("party_strum"), P("party_pray"), P("party_summon")],
  cleanse: [P("party_pray"), P("party_pray"), P("party_pray"), P("party_pray"), P("party_pray"), P("party_strum"), P("party_meditate"), P("party_pray")],
  taunt: [P("party_taunt"), P("party_taunt"), P("party_taunt"), P("party_taunt"), P("party_taunt"), P("party_taunt"), P("party_taunt"), P("party_taunt")],
  escape: [P("party_roll"), P("party_roll"), P("party_roll"), P("party_roll"), P("party_roll"), P("party_roll"), P("party_roll"), P("party_roll")],
};
/** Poses an art can ask for by name. */
const NAMED_POSE = { punch: P("party_punch"), kick: P("party_kick"), point: P("cast_point") };

/** The pose an art is drawn with. @param {Art} art @param {number} voc */
export function poseOf(art, voc) {
  if (art.pose && art.pose in NAMED_POSE) return NAMED_POSE[/** @type {keyof typeof NAMED_POSE} */ (art.pose)];
  const kind = art.kind === "combo" ? art.parts?.[0]?.kind : art.kind;
  const row = KIND_POSE[/** @type {keyof typeof KIND_POSE} */ (kind)];
  return row ? row[voc] ?? row[0] : undefined;
}

// ---------------------------------------------------------------- state of the field

/** Foe id -> extra harm it takes from the party, and until when. */
/** @type {Map<string, { mult: number, until: number }>} */
const marks = new Map();
/** Companion id -> the foe that last struck it, and when. */
/** @type {Map<string, { id: string, tick: number }>} */
const struck = new Map();
/** Companion id -> how much harder its next arts land, and until when. */
/** @type {Map<string, { mult: number, until: number }>} */
const empowered = new Map();
/** Lasting fields (auras) now on the ground. */
let auras = 0;

/** How much harder a marked foe is hit. @param {Entity} foe */
export function markOf(foe) {
  const mark = marks.get(foe.id);
  if (!mark) return 1;
  if (system.currentTick > mark.until) {
    marks.delete(foe.id);
    return 1;
  }
  return mark.mult;
}

/** Notes who struck a companion, for counters. @param {string} victim @param {string} attacker */
export function noteHurt(victim, attacker) {
  struck.set(victim, { id: attacker, tick: system.currentTick });
}

/** Forgets a companion that has gone. @param {string} entityId */
export function forget(entityId) {
  struck.delete(entityId);
  empowered.delete(entityId);
}

// ---------------------------------------------------------------- helpers

/** @param {Entity} e @param {number} y */
const above = (e, y) => ({ x: e.location.x, y: e.location.y + y, z: e.location.z });
/** @param {Vector3} a @param {Vector3} b */
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** @param {string | undefined} el */
const fxEl = (el) => (el && ["fire", "ice", "lightning", "holy", "dark", "acid", "arcane"].includes(el) ? el : "none");
/** @param {string | undefined} el @returns {"entityAttack" | "magic" | "fire"} */
const causeOf = (el) => (el === "fire" ? "fire" : !el || el === "none" ? "entityAttack" : "magic");

/** The health share of an entity (1 when unreadable). @param {Entity} e */
function shareOf(e) {
  try {
    const h = e.getComponent("minecraft:health");
    return h && h.effectiveMax > 0 ? h.currentValue / h.effectiveMax : 1;
  } catch {
    return 1;
  }
}

/** Applies a list of [effect, seconds, amplifier] to an entity; "fire" sets it alight. @param {Entity} e @param {any[]} list */
function apply(e, list) {
  for (const [effect, seconds, amp] of list ?? []) {
    try {
      if (!e.isValid) return;
      if (effect === "fire") e.setOnFire(seconds, true);
      else e.addEffect(effect, Math.round(seconds * TICKS), { amplifier: amp, showParticles: effect !== "invisibility" });
    } catch {
      // immune, or not an effect in this version
    }
  }
}

/** Raw harm of an art at a level, before power. @param {Art | any} art @param {number} level */
export function harmOf(art, level) {
  const [base, per] = art.dmg ?? [0, 0];
  return base + per * level;
}

/**
 * Harm an art deals to one foe: its base, the element the foe fears, the undead, elites, the wounded, the
 * marked, the poisoned, and whatever struck the companion last.
 * @param {Turn} t @param {any} art @param {Entity} foe
 */
function harmTo(t, art, foe) {
  let amount = harmOf(art, t.level);
  if (art.el && WEAK_TO[foe.typeId] === art.el) amount *= 1.5;
  try {
    if (art.undead && foe.matches({ families: ["undead"] })) amount *= art.undead;
  } catch {
    // unreadable
  }
  try {
    if (art.elite && E(t).isElite(foe)) amount *= art.elite;
  } catch {
    // no mark
  }
  if (art.exec && shareOf(foe) < 0.35) amount *= art.exec;
  try {
    if (art.poisoned && (foe.getEffect("poison") || foe.getEffect("wither"))) amount *= art.poisoned;
  } catch {
    // none
  }
  if (art.counter) {
    const last = struck.get(t.entity.id);
    if (last && last.id === foe.id && system.currentTick - last.tick <= 3 * TICKS) amount *= art.counter;
  }
  const boost = empowered.get(t.entity.id);
  if (boost && system.currentTick <= boost.until) amount *= boost.mult;
  return amount; // a mark is counted where the blow lands (party.js), for the old arts as well
}

/**
 * Strikes one foe with an art: harm, effects, knockback, stagger, life drain and pickpocketing.
 * @param {Turn} t @param {any} art @param {Entity} foe @param {number} [scale]
 */
function strikeOne(t, art, foe, scale = 1) {
  if (!foe.isValid) return false;
  const amount = harmTo(t, art, foe) * scale;
  if (amount > 0) E(t).hit(t, foe, amount, causeOf(art.el));
  apply(foe, art.effects);
  if (art.knock || art.lift) {
    try {
      const len = flat(foe.location, t.entity.location) || 1;
      const k = art.knock ?? 0;
      if (foe.isValid) foe.applyKnockback({ x: ((foe.location.x - t.entity.location.x) / len) * k, z: ((foe.location.z - t.entity.location.z) / len) * k }, art.lift ?? 0.3);
    } catch {
      // immovable
    }
  }
  if (art.stagger) E(t).stagger(foe, art.stagger);
  if (art.drain && amount > 0) healEntity(t, t.entity, amount * t.power * art.drain);
  if (art.mark) marks.set(foe.id, { mult: art.mark, until: system.currentTick + 10 * TICKS });
  if (art.coins) {
    let found = 0;
    for (let i = 0; i < art.coins; i++) if ((system.currentTick * 31 + i * 17 + foe.id.length) % 3 === 0) found++;
    if (found > 0) E(t).coins(t.player, found);
  }
  return true;
}

/** Heals an ally (the master through the shared heal so other mods see it). @param {Turn} t @param {Entity} e @param {number} amount */
function healEntity(t, e, amount) {
  if (!(amount > 0)) return false;
  try {
    if (e.id === t.player.id) return E(t).healPlayer(t.player, amount);
    const h = e.getComponent("minecraft:health");
    if (!h || h.currentValue <= 0 || h.currentValue >= h.effectiveMax) return false;
    h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amount));
    return true;
  } catch {
    return false;
  }
}

/** The master and every companion within reach of an entity. @param {Turn} t @param {number} [reach] */
function allies(t, reach = 16) {
  return [t.player, ...env.companions(t.player)].filter((e) => {
    try {
      return e.isValid && flat(e.location, t.entity.location) <= reach;
    } catch {
      return false;
    }
  });
}

/** The ally in most need, if anyone is below the line. @param {Turn} t @param {number} [master] @param {number} [ally] */
function neediest(t, master = 0.85, ally = 0.6) {
  let worst;
  let low = 1;
  for (const e of allies(t, 14)) {
    const share = shareOf(e);
    if (share <= 0) continue;
    if (share < (e.id === t.player.id ? master : ally) && share < low) {
      low = share;
      worst = e;
    }
  }
  return worst;
}

/** The tag of a companion's own summons. @param {Turn} t */
const summonTag = (/** @type {Turn} */ t) => `ovs_${t.entity.id}`;

// ---------------------------------------------------------------- the kinds

/** @type {Record<string, (t: Turn, art: any) => boolean>} */
export const KINDS = {
  legacy(t, art) {
    const attack = E(t).legacy(art.key);
    return attack ? attack.use(t) : false;
  },

  strike(t, art) {
    if (!t.foe || t.gap > (art.reach ?? 4.5)) return false;
    const foe = t.foe;
    const hits = art.hits ?? 1;
    strikeOne(t, art, foe);
    fx.slash(t.d, above(foe, 1.1), fxEl(art.el), 1.4);
    for (let i = 1; i < hits; i++) {
      system.runTimeout(() => {
        if (!t.entity.isValid || !foe.isValid) return;
        strikeOne(t, { ...art, effects: undefined, stagger: undefined, coins: undefined, knock: undefined, lift: undefined }, foe);
        fx.slash(t.d, above(foe, 0.8 + (i % 3) * 0.3), fxEl(art.el), 1.1);
      }, i * 4);
    }
    if (art.reach && art.reach > 6) fx.beam(t.d, t.hand, above(foe, 1), fxEl(art.el), 1);
    return true;
  },

  bolt(t, art) {
    const range = art.range ?? 22;
    if (!t.foe || t.gap > range) return false;
    const from = art.from === "sky" ? above(t.foe, 9) : t.hand;
    if (art.pierce) {
      const len = t.gap || 1;
      const dir = { x: (t.foe.location.x - t.entity.location.x) / len, z: (t.foe.location.z - t.entity.location.z) / len };
      const line = E(t).foesNear(t.player, t.entity.location, range).filter((e) => {
        const along = (e.location.x - t.entity.location.x) * dir.x + (e.location.z - t.entity.location.z) * dir.z;
        if (along < 0 || along > range) return false;
        const off = Math.hypot(e.location.x - (t.entity.location.x + dir.x * along), e.location.z - (t.entity.location.z + dir.z * along));
        return off <= 1.6;
      });
      if (!line.some((e) => e.id === t.foe?.id)) line.push(t.foe);
      for (const e of line.slice(0, 8)) strikeOne(t, art, e);
      fx.beam(t.d, from, { x: t.entity.location.x + dir.x * range, y: t.foe.location.y + 1, z: t.entity.location.z + dir.z * range }, fxEl(art.el), 1.2);
    } else {
      strikeOne(t, art, t.foe);
      fx.beam(t.d, from, above(t.foe, 1), fxEl(art.el), 1);
    }
    fx.spark(t.d, above(t.foe, 1), fxEl(art.el), 1);
    return true;
  },

  multi(t, art) {
    if (!t.foe || t.gap > 22) return false;
    const foes = [t.foe, ...env.foesNear(t.player, t.entity.location, 14).filter((e) => e.id !== t.foe?.id)]
      .sort((a, b) => (a.id === t.foe?.id ? -1 : b.id === t.foe?.id ? 1 : flat(a.location, t.entity.location) - flat(b.location, t.entity.location)))
      .slice(0, art.count ?? 3);
    foes.forEach((foe, i) => {
      system.runTimeout(() => {
        if (!t.entity.isValid || !foe.isValid) return;
        strikeOne(t, art, foe);
        fx.beam(t.d, above(t.entity, 1.3), above(foe, 1), fxEl(art.el), 0.8);
      }, 1 + i * 2);
    });
    return true;
  },

  chain(t, art) {
    if (!t.foe || t.gap > 20) return false;
    /** @type {Entity[]} */
    const hops = [t.foe];
    for (let i = 0; i < (art.jumps ?? 3); i++) {
      const last = hops[hops.length - 1];
      const next = E(t).foesNear(t.player, last.location, 6).filter((e) => !hops.some((h) => h.id === e.id))
        .sort((a, b) => flat(a.location, last.location) - flat(b.location, last.location))[0];
      if (!next) break;
      hops.push(next);
    }
    let from = t.hand;
    hops.forEach((foe, i) => {
      const start = from;
      system.runTimeout(() => {
        if (!t.entity.isValid || !foe.isValid) return;
        strikeOne(t, art, foe, Math.pow(0.85, i));
        fx.beam(t.d, start, above(foe, 1), fxEl(art.el), 0.9);
      }, 1 + i * 3);
      from = above(foe, 1);
    });
    return true;
  },

  cleave(t, art) {
    const radius = art.radius ?? 3.5;
    const foes = E(t).foesNear(t.player, t.entity.location, radius);
    if (foes.length === 0) return false;
    const hits = art.hits ?? 1;
    for (let i = 0; i < hits; i++) {
      const round = () => {
        if (!t.entity.isValid) return;
        for (const foe of E(t).foesNear(t.player, t.entity.location, radius).slice(0, 12)) strikeOne(t, i === 0 ? art : { ...art, effects: undefined, knock: undefined }, foe);
        fx.ring(t.d, t.entity.location, fxEl(art.el), radius);
        fx.slash(t.d, above(t.entity, 1.1), fxEl(art.el), radius * 0.6);
      };
      if (i === 0) round();
      else system.runTimeout(round, i * 7);
    }
    return true;
  },

  nova(t, art) {
    const radius = art.radius ?? 4;
    const atSelf = art.on === "self";
    if (!atSelf && (!t.foe || t.gap > 22)) return false;
    const centre = atSelf ? { ...t.entity.location } : { .../** @type {Entity} */ (t.foe).location };
    const foes = E(t).foesNear(t.player, centre, radius);
    if (foes.length === 0) return false;
    fx.nova(t.d, { x: centre.x, y: centre.y + 0.6, z: centre.z }, fxEl(art.el), radius);
    for (const foe of foes.slice(0, 14)) strikeOne(t, art, foe);
    if (art.heal) for (const ally of allies(t, 14)) healEntity(t, ally, art.heal * t.power);
    if (radius >= 6) fx.shake(t.d, centre, radius + 4, 0.35, 0.3);
    return true;
  },

  rain(t, art) {
    if (!t.foe || t.gap > 24) return false;
    const centre = { ...t.foe.location };
    const radius = art.radius ?? 4;
    const waves = art.waves ?? 3;
    fx.circle(t.d, centre, fxEl(art.el), radius);
    for (let wave = 0; wave < waves; wave++) {
      system.runTimeout(() => {
        if (!t.entity.isValid || !t.player.isValid) return;
        fx.fall(t.d, centre, fxEl(art.el), 4, 2 - wave * 2);
        for (const foe of E(t).foesNear(t.player, centre, radius).slice(0, 14)) strikeOne(t, wave === 0 ? art : { ...art, effects: undefined }, foe);
      }, 6 + wave * 10);
    }
    return true;
  },

  dash(t, art) {
    const range = art.range ?? 12;
    if (!t.foe || t.gap > range) return false;
    const foe = t.foe;
    const len = t.gap || 1;
    const dir = { x: (foe.location.x - t.entity.location.x) / len, z: (foe.location.z - t.entity.location.z) / len };
    try {
      if (len > 2.5) t.entity.applyImpulse({ x: dir.x * Math.min(2.2, len * 0.22), y: 0.3, z: dir.z * Math.min(2.2, len * 0.22) });
    } catch {
      // rooted
    }
    fx.puff(t.d, "streak", above(t.entity, 0.6), fxEl(art.el), 1);
    for (let i = 0; i < (art.hits ?? 1); i++) {
      system.runTimeout(() => {
        if (!t.entity.isValid || !foe.isValid) return;
        const struckFoes = art.radius ? E(t).foesNear(t.player, foe.location, art.radius).slice(0, 10) : [foe];
        if (!struckFoes.some((e) => e.id === foe.id)) struckFoes.push(foe);
        for (const e of struckFoes) strikeOne(t, i === 0 ? art : { ...art, effects: undefined, stagger: undefined }, e);
        fx.ring(t.d, foe.location, fxEl(art.el), art.radius ?? 1.5);
      }, 6 + i * 6);
    }
    return true;
  },

  blink(t, art) {
    if (!t.foe || t.gap > (art.range ?? 16)) return false;
    const foe = t.foe;
    const len = t.gap || 1;
    const dir = { x: (foe.location.x - t.entity.location.x) / len, z: (foe.location.z - t.entity.location.z) / len };
    const behind = { x: foe.location.x + dir.x * 1.4, y: foe.location.y, z: foe.location.z + dir.z * 1.4 };
    const from = { ...t.entity.location };
    try {
      if (typeof t.entity.tryTeleport === "function") t.entity.tryTeleport(behind, { facingLocation: foe.location });
      else t.entity.teleport(behind, { facingLocation: foe.location });
    } catch {
      // nowhere to stand
    }
    fx.blink(t.d, from, behind, fxEl(art.el === undefined ? "dark" : art.el));
    strikeOne(t, { stagger: 1, ...art }, foe);
    fx.slash(t.d, above(foe, 1.1), fxEl(art.el), 1.6);
    return true;
  },

  afflict(t, art) {
    const atSelf = art.on === "self";
    if (!atSelf && (!t.foe || t.gap > 22)) return false;
    const centre = atSelf ? t.entity.location : /** @type {Entity} */ (t.foe).location;
    const foes = art.radius ? E(t).foesNear(t.player, centre, art.radius) : [/** @type {Entity} */ (t.foe)];
    if (!atSelf && t.foe && !foes.some((e) => e.id === t.foe?.id)) foes.unshift(t.foe);
    if (foes.length === 0) return false;
    // A foe that already suffers the art's first effect is not worth the art again.
    const first = art.effects?.[0]?.[0];
    if (first && first !== "fire" && foes.every((e) => {
      try {
        return Boolean(e.getEffect(first));
      } catch {
        return false;
      }
    })) return false;
    for (const foe of foes.slice(0, 12)) {
      strikeOne(t, art, foe);
      fx.spark(t.d, above(foe, 1.2), fxEl(art.el), 0.9);
    }
    if (art.radius) fx.circle(t.d, centre, fxEl(art.el), art.radius);
    else if (t.foe) fx.beam(t.d, t.hand, above(t.foe, 1), fxEl(art.el), 0.7);
    return true;
  },

  aura(t, art) {
    if (!E(t).inCombat(t.player) && !t.foe) return false;
    const radius = art.radius ?? 5;
    const onFoe = art.on === "foe";
    if (onFoe && (!t.foe || t.gap > 20)) return false;
    if (!onFoe && E(t).foesNear(t.player, t.entity.location, radius + 2).length === 0 && !art.heal && !art.allies) return false;
    if (auras >= 12) return false; // the field is full of them already
    const fixed = onFoe ? { .../** @type {Entity} */ (t.foe).location } : undefined;
    const seconds = art.sec ?? 8;
    auras++;
    let left = seconds;
    const pulse = () => {
      left--;
      if (left < 0 || !t.entity.isValid || !t.player.isValid) {
        auras = Math.max(0, auras - 1);
        return;
      }
      const centre = fixed ?? t.entity.location;
      fx.ring(t.d, centre, fxEl(art.el), radius);
      for (const foe of E(t).foesNear(t.player, centre, radius).slice(0, 14)) {
        if (art.dmg) strikeOne(t, { ...art, effects: undefined, mark: undefined }, foe);
        apply(foe, art.effects);
        if (art.pull) {
          try {
            const len = flat(foe.location, centre) || 1;
            if (len > 1) foe.applyKnockback({ x: ((centre.x - foe.location.x) / len) * 0.6, z: ((centre.z - foe.location.z) / len) * 0.6 }, 0.1);
          } catch {
            // immovable
          }
        }
      }
      if (art.heal || art.allies) {
        for (const ally of allies(t, 30)) {
          if (flat(ally.location, centre) > radius) continue;
          if (art.heal) healEntity(t, ally, art.heal * t.power);
          apply(ally, art.allies);
        }
      }
      system.runTimeout(pulse, TICKS);
    };
    pulse();
    fx.dome(t.d, fixed ?? t.entity.location, fxEl(art.el));
    return true;
  },

  pull(t, art) {
    const atSelf = art.on === "self";
    if (!atSelf && (!t.foe || t.gap > 22)) return false;
    const centre = atSelf ? { ...t.entity.location } : { .../** @type {Entity} */ (t.foe).location };
    const foes = E(t).foesNear(t.player, centre, art.radius ?? 7);
    if (foes.length < (atSelf ? 1 : 2)) return false; // one foe needs no gathering
    for (const foe of foes.slice(0, 14)) {
      const len = flat(foe.location, centre) || 1;
      try {
        if (len > 1) foe.applyKnockback({ x: ((centre.x - foe.location.x) / len) * Math.min(1.6, len * 0.3), z: ((centre.z - foe.location.z) / len) * Math.min(1.6, len * 0.3) }, 0.2);
      } catch {
        // immovable
      }
      E(t).stagger(foe, 1.5);
      if (art.dmg) strikeOne(t, art, foe);
    }
    fx.implode(t.d, { x: centre.x, y: centre.y + 1, z: centre.z }, fxEl(art.el), art.radius ?? 7);
    return true;
  },

  heal(t, art) {
    const amount = harmOf({ dmg: art.amount }, t.level) * t.power;
    if (art.self) {
      if (shareOf(t.entity) >= (art.low ?? 0.6)) return false;
      healEntity(t, t.entity, amount);
      if (art.hot) apply(t.entity, [["regeneration", art.hot, 1]]);
      fx.rise(t.d, t.entity.location, "holy", 0.7);
      return true;
    }
    if (art.party) {
      const hurt = allies(t, 14).filter((e) => shareOf(e) < (e.id === t.player.id ? 0.85 : 0.75) && shareOf(e) > 0);
      if (hurt.length === 0) return false;
      for (const ally of allies(t, 14)) {
        healEntity(t, ally, amount);
        if (art.hot) apply(ally, [["regeneration", art.hot, 1]]);
        fx.rise(t.d, ally.location, "holy", 0.6);
      }
      fx.ring(t.d, t.entity.location, "holy", 6);
      if (hurt.some((e) => e.id === t.player.id)) E(t).say(t.player, t.member, "Hold fast, everyone!", 25);
      return true;
    }
    const patient = neediest(t);
    if (!patient) return false;
    healEntity(t, patient, amount);
    if (art.hot) apply(patient, [["regeneration", art.hot, 1]]);
    fx.beam(t.d, t.hand, above(patient, 1), "holy");
    fx.rise(t.d, patient.location, "holy", 0.7);
    if (patient.id === t.player.id) E(t).say(t.player, t.member, "I have you, Master.", 30);
    return true;
  },

  shield(t, art) {
    if (!E(t).inCombat(t.player)) return false;
    const targets = art.party ? allies(t, 14) : [neediest(t, 0.7, 0.5) ?? (t.masterShare < 0.7 ? t.player : undefined)].filter((e) => e !== undefined);
    if (targets.length === 0) return false;
    const lead = /** @type {Entity} */ (targets[0]);
    try {
      if (lead.getEffect("absorption")) return false; // still shielded
    } catch {
      // unreadable
    }
    for (const ally of targets) {
      apply(/** @type {Entity} */ (ally), [["absorption", art.sec ?? 12, art.amp ?? 1]]);
      fx.dome(t.d, /** @type {Entity} */ (ally).location, "holy");
    }
    return true;
  },

  buff(t, art) {
    if (art.combat && !E(t).inCombat(t.player)) return false;
    const targets = art.self ? [t.entity] : art.party ? allies(t, 16) : [t.player, t.entity];
    const first = art.effects?.[0]?.[0];
    if (first) {
      try {
        if (targets[0].getEffect(first)) return false; // already under it
      } catch {
        // unreadable
      }
    }
    for (const ally of targets) apply(ally, art.effects);
    if (art.summons) {
      try {
        for (const tag of [`overlord_ally_${t.player.id}`, `overlord_party_ally_${t.player.id}`]) {
          for (const e of t.player.dimension.getEntities({ tags: [tag], location: t.entity.location, maxDistance: 24 })) apply(e, art.summons);
        }
      } catch {
        // none near
      }
    }
    if (art.power) empowered.set(t.entity.id, { mult: art.power, until: system.currentTick + 12 * TICKS });
    fx.ring(t.d, t.entity.location, "holy", art.party ? 5 : 2);
    fx.rise(t.d, t.entity.location, art.party ? "holy" : "arcane", 0.8);
    return true;
  },

  summon(t, art) {
    if (!t.foe || !E(t).inCombat(t.player)) return false;
    const tag = summonTag(t);
    let present = [];
    try {
      present = t.d.getEntities({ tags: [tag] });
    } catch {
      present = [];
    }
    const room = (art.count ?? 1) - present.length;
    if (room <= 0) return false;
    const until = Date.now() + (art.sec ?? 40) * 1000;
    /** @type {Entity[]} */
    const raised = [];
    for (let i = 0; i < room; i++) {
      const a = (i / room) * Math.PI * 2;
      const spot = { x: t.entity.location.x + Math.cos(a) * 1.8, y: t.entity.location.y, z: t.entity.location.z + Math.sin(a) * 1.8 };
      try {
        const wild = E(t).wild === true; // an NPC's minions fight for it, against the players
        const options = art.type.startsWith("overlord:") && !wild ? { spawnEvent: "overlord:become_summoned" } : undefined;
        const e = t.d.spawnEntity(art.type, spot, options);
        if (!wild) {
          e.addTag("overlord_summoned");
          e.addTag(`overlord_party_ally_${t.player.id}`); // not counted against the master's own summons
        }
        e.addTag(tag);
        e.addTag("overlord_art_summon");
        e.setDynamicProperty("overlord:until", until);
        raised.push(e);
        fx.pillar(t.d, spot, art.type.includes("wolf") ? "none" : "dark", 2.4, 0.8);
      } catch {
        // no room
      }
    }
    if (raised.length === 0) return false;
    system.runTimeout(() => {
      for (const e of raised) {
        try {
          if (!e.isValid || !t.player.isValid) continue;
          if (!E(t).wild) e.getComponent("minecraft:tameable")?.tame(/** @type {Player} */ (t.player));
          apply(e, art.buff);
        } catch {
          // it fights all the same
        }
      }
    }, 2);
    system.runTimeout(() => {
      for (const e of raised) {
        try {
          if (e.isValid) {
            fx.rise(e.dimension, e.location, "dark", 0.7);
            e.remove();
          }
        } catch {
          // already gone
        }
      }
    }, (art.sec ?? 40) * TICKS);
    return true;
  },

  revive(t, art) {
    if (E(t).fallen(t.player) === 0) return false;
    const back = E(t).revive(t.player, art.count ?? 1);
    if (back === 0) return false;
    fx.pillar(t.d, t.entity.location, "holy", 6);
    E(t).say(t.player, t.member, back > 1 ? "Rise, all of you!" : "Rise - we are not done yet!", 20, true);
    return true;
  },

  cleanse(t) {
    const bad = ["poison", "wither", "weakness", "slowness", "blindness", "nausea", "hunger", "mining_fatigue"];
    let washed = 0;
    for (const ally of allies(t, 14)) {
      for (const effect of bad) {
        try {
          if (ally.getEffect(effect)) {
            ally.removeEffect(effect);
            washed++;
          }
        } catch {
          // none
        }
      }
    }
    if (washed === 0) return false;
    fx.ring(t.d, t.entity.location, "holy", 5);
    return true;
  },

  taunt(t, art) {
    const radius = art.radius ?? 8;
    /** @type {Entity[]} */
    const drawn = [];
    for (const foe of E(t).foesNear(t.player, t.entity.location, radius)) {
      const far = flat(foe.location, t.entity.location);
      if (far > 2.5 && !drawn.some((d) => d.id === foe.id)) drawn.push(foe);
    }
    if (drawn.length === 0) return false;
    for (const foe of drawn.slice(0, 8)) {
      const len = flat(foe.location, t.entity.location) || 1;
      try {
        foe.applyKnockback({ x: ((t.entity.location.x - foe.location.x) / len) * 1.3, z: ((t.entity.location.z - foe.location.z) / len) * 1.3 }, 0.25);
      } catch {
        // immovable
      }
      apply(foe, [["weakness", 5, 0]]);
      fx.beam(t.d, above(foe, 1), above(t.entity, 1.2), "fire", 0.5);
    }
    fx.ring(t.d, t.entity.location, "fire", 3);
    E(t).say(t.player, t.member, "Over here! Face me!", 20);
    return true;
  },

  escape(t, art) {
    const close = E(t).foesNear(t.player, t.entity.location, 3.5)[0];
    if (!close) return false;
    const len = flat(close.location, t.entity.location) || 1;
    const dist = art.dist ?? 6;
    const to = {
      x: t.entity.location.x + ((t.entity.location.x - close.location.x) / len) * dist,
      y: t.entity.location.y,
      z: t.entity.location.z + ((t.entity.location.z - close.location.z) / len) * dist,
    };
    const from = { ...t.entity.location };
    let moved = false;
    try {
      moved = typeof t.entity.tryTeleport === "function" ? t.entity.tryTeleport(to) : (t.entity.teleport(to), true);
    } catch {
      moved = false;
    }
    if (!moved) {
      try {
        t.entity.applyImpulse({ x: ((to.x - from.x) / dist) * 1.4, y: 0.35, z: ((to.z - from.z) / dist) * 1.4 });
      } catch {
        return false;
      }
    }
    fx.blink(t.d, from, to, "arcane");
    apply(t.entity, art.effects);
    return true;
  },

  combo(t, art) {
    const parts = art.parts ?? [];
    if (parts.length === 0) return false;
    const first = KINDS[parts[0].kind];
    if (!first || !first(t, { ...parts[0], key: art.key })) return false;
    parts.slice(1).forEach((/** @type {any} */ part, /** @type {number} */ i) => {
      system.runTimeout(() => {
        if (!t.entity.isValid || !t.player.isValid) return;
        try {
          const foe = t.foe && t.foe.isValid ? t.foe : undefined;
          KINDS[part.kind]?.({ ...t, foe, gap: foe ? flat(foe.location, t.entity.location) : Infinity }, { ...part, key: art.key });
        } catch {
          // the field changed under it
        }
      }, (i + 1) * 10);
    });
    fx.pillar(t.d, t.entity.location, fxEl(parts[0].el ?? art.el), 4, 1);
    return true;
  },
};

/** Runs one art. @param {Turn} t @param {Art} art */
export function use(t, art) {
  const kind = KINDS[art.kind];
  if (!kind) return false;
  if (art.low && shareOf(t.entity) >= art.low && art.kind !== "heal") return false; // kept for when it is near death
  return kind(t, art);
}

// ---------------------------------------------------------------- choosing

const SUPPORT = new Set(["heal", "shield", "revive", "cleanse"]);
const AREA = { cleave: "self", nova: "foe", rain: "foe", aura: "foe", pull: "foe", chain: "foe", multi: "self", taunt: "self" };

/**
 * How worth using an art is now (higher is better). Need comes first: a healer heals the hurt before it does
 * anything else, a guardian shields the party before a boss's blow, and a sweep is worth more the more foes it
 * catches. The art used last is passed over while another is ready, so a companion mixes its arts.
 * @param {Turn} t @param {Art} art @param {{ last?: string, crowd: number, need: number, elite: boolean, danger: boolean, slot: number }} sense
 */
export function score(t, art, sense) {
  const kind = art.kind === "combo" ? art.parts?.[0]?.kind ?? "strike" : art.kind;
  let value = 10 + art.at * 0.4;
  if (art.kind === "legacy") {
    const legacy = E(t).legacy(art.key);
    if (legacy?.urgent) value += 25; // the old party's urgent arts check need themselves
  } else if (SUPPORT.has(kind)) {
    if (kind === "revive") value += E(t).fallen(t.player) > 0 ? 80 : -100;
    else if (kind === "cleanse") value += 15;
    else value += sense.need > 0 ? 40 + sense.need * 80 : -100;
    if (kind === "shield" && sense.danger) value += 50; // a boss is about to strike: shield first
  } else if (kind === "buff") {
    value += E(t).inCombat(t.player) ? 14 : -100;
    if (sense.elite) value += 10;
  } else if (kind === "summon") {
    value += E(t).inCombat(t.player) ? 18 + (sense.elite ? 15 : 0) + Math.min(3, sense.crowd) * 5 : -100;
  } else if (kind === "taunt") {
    value += t.masterShare < 0.5 ? 45 : sense.crowd >= 2 ? 12 : -20;
  } else if (kind === "escape") {
    value += t.masterShare < 0.3 ? 0 : 20;
  } else {
    if (!t.foe) value -= 100;
    if (kind in AREA) value += Math.min(4, Math.max(0, sense.crowd - 1)) * 9;
    if (kind === "afflict") value += sense.elite || sense.crowd >= 2 ? 10 : 0;
    value += harmOf(art, t.level) * 0.15;
  }
  if (art.urgent) value += 10;
  if (art.at === 100) value += sense.elite || sense.crowd >= 3 ? 25 : -5; // a capstone is kept for a real fight
  if (art.key === sense.last) value -= 30;
  return value + ((sense.slot * 7 + art.at) % 5) * 0.5; // a steady tie-break, not a dice roll
}

/** Everything a companion takes in before it chooses. @param {Turn} t @param {string | undefined} last */
export function senseOf(t, last) {
  const crowd = t.foe ? E(t).foesNear(t.player, t.foe.location, 4.5).length : E(t).foesNear(t.player, t.entity.location, 5).length;
  const needy = neediest(t);
  const need = needy ? 1 - shareOf(needy) : 0;
  let elite = false;
  try {
    elite = Boolean(t.foe && E(t).isElite(t.foe));
  } catch {
    elite = false;
  }
  let danger = false;
  try {
    danger = Boolean(E(t).danger(t.player.location));
  } catch {
    danger = false;
  }
  return { last, crowd, need, elite, danger, slot: t.entity.id.length };
}

/** Sweeps away summons whose time is up (after a reload, their timers are gone). @param {import("@minecraft/server").Dimension} d */
export function sweep(d) {
  for (const [id, mark] of marks) if (system.currentTick > mark.until) marks.delete(id);
  for (const [id, boost] of empowered) if (system.currentTick > boost.until) empowered.delete(id);
  for (const [id, last] of struck) if (system.currentTick - last.tick > 60 * TICKS) struck.delete(id);
  let found = [];
  try {
    found = d.getEntities({ tags: ["overlord_art_summon"] });
  } catch {
    return;
  }
  const now = Date.now();
  for (const e of found) {
    try {
      const until = e.getDynamicProperty("overlord:until");
      if (typeof until !== "number" || until < now) e.remove();
    } catch {
      // gone
    }
  }
}
