// Overlord: Tomb of Nazarick - Hardcore Survival (experimental): the New World does not forgive.
//
// A layer of hard survival in the spirit of the hardest modpacks, all of it this add-on's own:
// - Thirst. A water meter that empties as you go: faster when you sprint, in the heat, in the Nether and with
//   parasites. Sneak and look at water with an empty hand to sip from it (it may carry parasites). Fill a
//   Leather Waterskin at water and boil it over a campfire or in a furnace to drink it safely.
// - Body temperature. Snow and ice, high peaks, the End, the night, rain and water chill you; deserts, the
//   Nether, sprinting, fire and lava warm you. Too cold or too hot slows you and then hurts you. Campfires,
//   leather armour (warm, but not in a desert), the draughts of Cocytus and Demiurge, and fire resistance help.
// - Injuries. A heavy blow may open a bleeding wound; a bad fall may break a leg. Linen Bandages, Splints and
//   Pestonya's Field Kit mend them; parasites from dirty water pass with time, milk or Pestonya's cooking.
// - The price of resurrection. Each death takes a heart, down to three; a Crystal of Vitality restores one.
// - The wilds. The further from the world's spawn, the higher the monsters' levels and the more elites.
//
// Thirst, cold, heat and bleeding wear you down to half a heart but never kill you: the monsters do that.
// The races feel it differently: the Undead neither thirst nor feel heat and cold, and do not bleed; Vampires
// slake their thirst on the blows they strike; Demons cannot overheat; Dragonkin shrug off both heat and cold;
// Dark Elves cannot catch parasites. Players in creative or spectator mode are left alone. Each rule can be
// switched off for the whole world, from the Hardcore Survival page of the Adventurer's Plate, by a player
// in creative mode. Alongside an add-on with its own thirst, temperature, first aid or hearts (RSCraft), our
// versions of those start switched off.
import { world, system, EntityDamageCause, EquipmentSlot, GameMode, ItemTypes } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { creditedPlayer, giveItem, hooks, isElite, notify, profileOf, registerMenu, touch } from "./rpg.js";
import { raceOf } from "./races.js";
import { spawnHooks } from "./director.js";
import { wearsDivine } from "./divine.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const mc = (/** @type {string} */ name) => `minecraft:${name}`;
const TICKS = 20;
/** Ticks between two survival steps. */
export const STEP = 2 * TICKS;
const SECONDS = STEP / TICKS;

export const THIRST_MAX = 20;
export const PARCHED_AT = 6;
export const TEMP_MIN = 0;
export const TEMP_MAX = 30;
export const TEMP_MILD = 15;
export const COLD_AT = 6;
export const FREEZE_AT = 2;
export const HOT_AT = 24;
export const BURN_AT = 28;
/** How far body temperature moves toward its surroundings in one step. */
export const TEMP_RATE = 0.5;
export const MAX_LOST = 7; // hearts
export const MIN_HEALTH = 6; // a death never leaves fewer than three hearts
export const DANGER_STEP = 1000; // blocks from the world spawn for each step of danger
export const MAX_DANGER = 5;
export const LEVELS_PER_DANGER = 6;
export const ELITE_PER_DANGER = 0.03;
export const BLEED_SECONDS = 30;
export const LEG_SECONDS = 180;
export const PARASITE_SECONDS = 60;
export const DRAUGHT_SECONDS = 300;

export const WATERSKIN = id("waterskin");
export const MURKY = id("waterskin_murky");
export const PURE = id("waterskin_pure");
export const FROST = id("frost_draught");
export const EMBER = id("ember_draught");
export const BANDAGE = id("linen_bandage");
export const SPLINT = id("splint");
export const FIELD_KIT = id("field_kit");
export const CRYSTAL = id("vitality_crystal");

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/**
 * What a player's body is going through. Counters are in seconds so they survive a reload.
 * @typedef {{ thirst: number, temp: number, lost: number, bleed: number, leg: number, parasites: number,
 *   chill: number, warm: number, drain: number, died: boolean }} Body
 */
/**
 * What a player's surroundings are like, for body temperature.
 * @typedef {{ dimension: string, y: number, climate: "snowy" | "hot" | "mild", sky: boolean, night: boolean,
 *   raining: boolean, inWater: boolean, sprinting: boolean, heat: number, cold: number, leather: number }} Readings
 */

// --------------------------------------------------------------------- rules

/** The rules of a hardcore world. Each can be switched off for the whole world. */
export const RULES = {
  thirst: { name: "Thirst", help: "A water meter that empties as you go. Drink or you will waste away." },
  temperature: { name: "Body temperature", help: "Cold places freeze you and hot places cook you." },
  injuries: { name: "Injuries", help: "Heavy blows open bleeding wounds, bad falls break legs, dirty water carries parasites." },
  hearts: { name: "Price of resurrection", help: "Each death takes a heart, down to three. Crystals of Vitality restore them." },
  wilds: { name: "Dangerous wilds", help: "The further from the world spawn, the stronger the monsters and the more elites." },
};
/** @typedef {keyof typeof RULES} RuleKey */
const RULES_KEY = "overlord:hardcore_rules";

/**
 * Add-ons with their own versions of some of these rules. When one is installed in the world, our versions of the
 * rules it covers start switched off, so nobody has two water meters or two systems fighting over the health bar.
 * Each is recognised by an item only it has.
 */
export const COMPANIONS = [
  { name: "RSCraft", marker: "zc:noob_heart", covers: ["thirst", "temperature", "injuries", "hearts"] },
];

/** @type {Record<string, boolean> | undefined} */
let ruleCache;
/** @type {typeof COMPANIONS | undefined} */
let found;

/** The companion add-ons installed in this world. */
export function companions() {
  if (found) return found;
  found = COMPANIONS.filter((c) => {
    try {
      return ItemTypes.get(c.marker) !== undefined;
    } catch {
      return false;
    }
  });
  return found;
}

/** Forgets what was read, so the world's rules and add-ons are looked at afresh. */
export function forgetRules() {
  ruleCache = undefined;
  found = undefined;
}

/** Which rules are on in this world: all of them, except those a companion add-on covers, unless changed by hand. */
export function rules() {
  if (ruleCache) return ruleCache;
  /** @type {Record<string, boolean>} */
  const out = {};
  for (const key of Object.keys(RULES)) out[key] = !companions().some((c) => c.covers.includes(key));
  try {
    const raw = world.getDynamicProperty(RULES_KEY);
    if (typeof raw === "string") {
      const saved = JSON.parse(raw);
      for (const key of Object.keys(RULES)) if (typeof saved[key] === "boolean") out[key] = saved[key];
    }
  } catch {
    // unreadable: every rule stays on
  }
  ruleCache = out;
  return out;
}

/** Whether one rule is on. @param {RuleKey} key */
export function ruleOn(key) {
  return rules()[key] === true;
}

/** Switches a rule on or off for the world. @param {RuleKey} key @param {boolean} on */
export function setRule(key, on) {
  const all = { ...rules(), [key]: on };
  ruleCache = all;
  try {
    world.setDynamicProperty(RULES_KEY, JSON.stringify(all));
  } catch {
    // kept for this session only
  }
}

// ---------------------------------------------------------------------- body

const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Math.max(lo, Math.min(hi, v));
const num = (/** @type {any} */ v, /** @type {number} */ fallback) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** A player's body, read from (and kept in) their saved profile. @param {Player} player @returns {Body} */
export function bodyOf(player) {
  const p = profileOf(player);
  if (!p.hardcore || typeof p.hardcore !== "object" || Array.isArray(p.hardcore)) p.hardcore = {};
  const h = p.hardcore;
  h.thirst = clamp(num(h.thirst, THIRST_MAX), 0, THIRST_MAX);
  h.temp = clamp(num(h.temp, TEMP_MILD), TEMP_MIN, TEMP_MAX);
  h.lost = clamp(Math.floor(num(h.lost, 0)), 0, MAX_LOST);
  for (const key of ["bleed", "leg", "parasites", "chill", "warm", "drain"]) h[key] = Math.max(0, num(h[key], 0));
  h.died = h.died === true;
  return /** @type {Body} */ (h);
}

/** Whether the world leaves this player alone (creative or spectator mode). @param {Player} player */
export function exempt(player) {
  try {
    const mode = player.getGameMode();
    return mode === GameMode.Creative || mode === GameMode.Spectator;
  } catch {
    return false;
  }
}

/** The player's race key. @param {Player} player */
function race(player) {
  return raceOf(profileOf(player));
}

/** Whether a player feels thirst at all. @param {Player} player */
export function thirsts(player) {
  return ruleOn("thirst") && race(player) !== "undead";
}

/** Whether a player feels heat and cold at all. @param {Player} player */
export function feelsWeather(player) {
  return ruleOn("temperature") && race(player) !== "undead";
}

/** Adds (or takes) water. Returns the new thirst. @param {Player} player @param {number} amount */
export function quench(player, amount) {
  const body = bodyOf(player);
  body.thirst = clamp(body.thirst + amount, 0, THIRST_MAX);
  touch(player);
  return body.thirst;
}

/** A word for a body temperature, coloured. @param {number} temp */
export function tempWord(temp) {
  if (temp <= FREEZE_AT) return "§bFreezing";
  if (temp <= COLD_AT) return "§3Cold";
  if (temp >= BURN_AT) return "§4Heatstroke";
  if (temp >= HOT_AT) return "§cHot";
  if (temp <= COLD_AT + 3) return "§3Chilly";
  if (temp >= HOT_AT - 3) return "§6Warm";
  return "§aMild";
}

/**
 * Hurts a player by a little, never below half a heart: thirst, heat, cold and bleeding wear you down, the
 * monsters finish you. Returns whether it hurt.
 * @param {Player} player @param {number} amount @param {string} cause
 */
export function wear(player, amount, cause) {
  const health = player.getComponent("minecraft:health");
  if (!health || health.currentValue - amount < 1) return false;
  try {
    player.applyDamage(amount, { cause: /** @type {any} */ (cause) });
  } catch {
    health.setCurrentValue(health.currentValue - amount);
  }
  return true;
}

/** Lends effects for a little longer than one step, without particles. @param {Player} player @param {Map<string, number>} wanted */
function lend(player, wanted) {
  for (const [effect, amplifier] of wanted) {
    try {
      player.addEffect(effect, STEP + 10, { amplifier, showParticles: false });
    } catch {
      // no such effect here
    }
  }
}

// -------------------------------------------------------------- temperature

const SNOWY = new Set(["snow", "snow_layer", "powder_snow", "ice", "packed_ice", "blue_ice", "frosted_ice"].map(mc));
const HOT = new Set(["sand", "red_sand", "sandstone", "red_sandstone", "hardened_clay", "orange_terracotta", "red_terracotta",
  "yellow_terracotta", "brown_terracotta", "white_terracotta", "light_gray_terracotta"].map(mc));
/** Warmth given off by a block near the player. */
const HEAT = {
  [mc("lava")]: 6, [mc("flowing_lava")]: 6, [mc("fire")]: 4, [mc("soul_fire")]: 4, [mc("campfire")]: 4, [mc("soul_campfire")]: 3,
  [mc("lit_furnace")]: 3, [mc("lit_blast_furnace")]: 3, [mc("lit_smoker")]: 3, [mc("magma")]: 2,
  [mc("torch")]: 1, [mc("soul_torch")]: 1, [mc("lantern")]: 1, [mc("soul_lantern")]: 1, [mc("shroomlight")]: 1, [mc("glowstone")]: 1,
};
const COLD = new Set(["ice", "packed_ice", "blue_ice", "snow", "powder_snow"].map(mc));
const LEATHER = ["leather_helmet", "leather_chestplate", "leather_leggings", "leather_boots"].map(mc);

/**
 * The temperature a player's surroundings pull their body toward (0 freezing .. 30 burning, 15 mild).
 * @param {Readings} r
 */
export function ambient(r) {
  let t = r.dimension.endsWith("nether") ? 26 : r.dimension.endsWith("end") ? 7 : TEMP_MILD;
  if (r.climate === "snowy") t -= 8;
  else if (r.climate === "hot") t += 6;
  if (r.y > 110) t -= Math.min(6, (r.y - 110) / 15); // the thin cold air of the peaks
  if (r.y < 0 && !r.dimension.endsWith("nether")) t += 2; // the warmth of the deep earth
  if (r.sky) {
    if (r.night) t -= r.climate === "hot" ? 6 : 3; // deserts are cold at night
    else if (r.climate === "hot") t += 2; // and burning by day
    if (r.raining) t -= 3;
  }
  if (r.inWater) t -= 5;
  if (r.sprinting) t += 2;
  t += Math.min(8, r.heat);
  t -= Math.min(4, r.cold);
  t += r.leather * 1.5;
  return clamp(t, TEMP_MIN, TEMP_MAX);
}

/** The weather in each dimension, as last announced. @type {Map<string, string>} */
const weather = new Map();

/** What the game can tell of a player's surroundings. @param {Player} player @returns {Readings} */
export function sense(player) {
  const dim = player.dimension;
  const at = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  /** @type {Readings} */
  const r = { dimension: dim.id, y: player.location.y, climate: "mild", sky: false, night: false, raining: false, inWater: false, sprinting: false, heat: 0, cold: 0, leather: 0 };
  const typeAt = (/** @type {number} */ dx, /** @type {number} */ dy, /** @type {number} */ dz) => {
    try {
      return dim.getBlock({ x: at.x + dx, y: at.y + dy, z: at.z + dz })?.typeId;
    } catch {
      return undefined; // unloaded
    }
  };
  const feet = typeAt(0, 0, 0), ground = typeAt(0, -1, 0);
  if ((feet && SNOWY.has(feet)) || (ground && SNOWY.has(ground))) r.climate = "snowy";
  else if ((ground && HOT.has(ground)) || (feet && HOT.has(feet))) r.climate = "hot";
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        const type = typeAt(dx, dy, dz);
        if (!type) continue;
        r.heat += HEAT[type] ?? 0;
        if (COLD.has(type)) r.cold += 1;
      }
    }
  }
  try {
    const top = dim.getTopmostBlock({ x: at.x, z: at.z });
    r.sky = !top || top.location.y < player.location.y;
  } catch {
    r.sky = false;
  }
  try {
    const time = world.getTimeOfDay();
    r.night = time >= 13000 && time < 23000;
  } catch {
    // leave it day
  }
  r.raining = (weather.get(bare(dim.id)) ?? "Clear") !== "Clear";
  r.inWater = player.isInWater === true;
  r.sprinting = player.isSprinting === true;
  try {
    const gear = player.getComponent("minecraft:equippable");
    for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet]) {
      const item = gear?.getEquipment(slot)?.typeId;
      if (item && LEATHER.includes(item)) r.leather += 1;
    }
  } catch {
    // no armour to count
  }
  return r;
}

/** Where a player's body is heading: the surroundings, softened by gear, draughts and race. @param {Player} player @param {Body} body @param {Readings} r */
export function comfort(player, body, r) {
  let target = ambient(r);
  const kind = race(player);
  if (kind === "demon") target = Math.min(target, HOT_AT - 4) - (target < TEMP_MILD ? 2 : 0); // at home in fire, not in snow
  if (kind === "dragonkin") target = clamp(target, COLD_AT + 3, HOT_AT - 3);
  let fireproof = false;
  try {
    fireproof = Boolean(player.getEffect("fire_resistance"));
  } catch {
    // no effects to read
  }
  if (fireproof || body.chill > 0) target = Math.min(target, HOT_AT - 4);
  if (body.warm > 0) target = Math.max(target, COLD_AT + 4);
  if (wearsDivine(player, "seraph") || wearsDivine(player, "supreme")) target = TEMP_MILD;
  return clamp(target, TEMP_MIN, TEMP_MAX);
}

// ---------------------------------------------------------------- the step

/**
 * One step (two seconds) of hardcore life for a player: thirst, temperature, injuries. Returns what happened.
 * @param {Player} player @param {Readings} r
 */
export function endure(player, r) {
  /** @type {string[]} */
  const did = [];
  if (exempt(player)) return did;
  const body = bodyOf(player);
  const kind = race(player);
  const second = Math.floor(system.currentTick / STEP) % 2 === 0; // every other step: once in four seconds
  /** Effects this step calls for: the strongest of each wins. @type {Map<string, number>} */
  const wanted = new Map();
  const want = (/** @type {string} */ effect, amplifier = 0) => wanted.set(effect, Math.max(amplifier, wanted.get(effect) ?? -1));
  const before = gist(body);

  for (const key of /** @type {const} */ (["chill", "warm"])) body[key] = Math.max(0, body[key] - SECONDS);

  if (feelsWeather(player)) {
    const target = comfort(player, body, r);
    body.temp = body.temp < target ? Math.min(target, body.temp + TEMP_RATE) : Math.max(target, body.temp - TEMP_RATE);
    if (body.temp <= FREEZE_AT) {
      want("slowness", 1);
      want("mining_fatigue");
      if (second && wear(player, 1, EntityDamageCause.freezing)) did.push("freeze");
      did.push("freezing");
    } else if (body.temp <= COLD_AT) {
      want("slowness");
      did.push("cold");
    } else if (body.temp >= BURN_AT) {
      want("weakness");
      want("hunger");
      if (second && wear(player, 1, EntityDamageCause.temperature)) did.push("burn");
      did.push("heatstroke");
    } else if (body.temp >= HOT_AT) {
      want("weakness");
      did.push("hot");
    }
  } else {
    body.temp = TEMP_MILD;
  }

  if (thirsts(player)) {
    let rate = 1 / 45; // a point every 45 seconds at rest
    if (r.sprinting) rate += 1 / 25;
    if (body.temp >= HOT_AT && feelsWeather(player)) rate += 1 / 40;
    if (r.dimension.endsWith("nether")) rate += 1 / 60;
    if (body.parasites > 0) rate += 1 / 60;
    body.drain += rate * SECONDS;
    while (body.drain >= 1) {
      body.drain -= 1;
      body.thirst = Math.max(0, body.thirst - 1);
    }
    if (body.thirst <= 0) {
      want("slowness", 1);
      want("mining_fatigue");
      if (second && wear(player, 1, EntityDamageCause.starve)) did.push("dehydrate");
      did.push("dehydrated");
    } else if (body.thirst <= PARCHED_AT) {
      want("slowness");
      did.push("parched");
    }
  } else {
    body.thirst = THIRST_MAX;
    body.drain = 0;
  }

  if (ruleOn("injuries")) {
    if (body.bleed > 0) {
      body.bleed = Math.max(0, body.bleed - SECONDS);
      if (kind === "undead") body.bleed = 0;
      else {
        if (second && wear(player, 1, EntityDamageCause.override)) did.push("bleed");
        try {
          fx.puff(player.dimension, "droplet", { x: player.location.x, y: player.location.y + 0.7, z: player.location.z }, "blood", 0.8);
        } catch {
          // cosmetic only
        }
        did.push("bleeding");
      }
    }
    if (body.leg > 0) {
      body.leg = Math.max(0, body.leg - SECONDS);
      want("slowness", 1);
      did.push("broken_leg");
      if (body.leg === 0) notify(player, "§aYour broken leg has knit back together.");
    }
    if (body.parasites > 0) {
      body.parasites = Math.max(0, body.parasites - SECONDS);
      want("hunger");
      want("weakness");
      did.push("parasites");
    }
  } else {
    body.bleed = body.leg = body.parasites = 0;
  }
  lend(player, wanted);
  if (gist(body) !== before) touch(player); // saved when something shows, not on every quiet step
  return did;
}

/** What of a body is worth saving: whole points of water and temperature, and which ills there are. @param {Body} body */
function gist(body) {
  return [Math.floor(body.thirst), Math.round(body.temp), body.bleed > 0, body.leg > 0, body.parasites > 0, body.chill > 0, body.warm > 0].join("|");
}

// ----------------------------------------------------------------- injuries

/**
 * A blow or a fall landed on a player: perhaps a wound, perhaps a broken leg. Returns what it did.
 * @param {Player} player @param {string} cause @param {number} damage @param {number} [roll] 0..1, rolled only when needed
 */
export function wound(player, cause, damage, roll) {
  if (!ruleOn("injuries") || exempt(player)) return "";
  const body = bodyOf(player);
  if (cause === EntityDamageCause.fall && damage >= 6) {
    const fresh = body.leg === 0;
    body.leg = LEG_SECONDS;
    touch(player);
    if (fresh) notify(player, "§4You land badly and break your leg! §7A Splint sets it; otherwise it heals in three minutes.");
    return "leg";
  }
  if ((cause === EntityDamageCause.entityAttack || cause === EntityDamageCause.projectile) && damage >= 4 && race(player) !== "undead") {
    const chance = Math.min(0.5, 0.15 + (damage - 4) * 0.05);
    if ((roll ?? Math.random()) >= chance) return "";
    const fresh = body.bleed === 0;
    body.bleed = BLEED_SECONDS;
    touch(player);
    if (fresh) notify(player, "§4You are bleeding! §7A Linen Bandage stops it.");
    return "bleed";
  }
  return "";
}

/** Gives a player parasites from dirty water, unless they cannot catch them. Returns whether it did. @param {Player} player */
export function infect(player) {
  if (!ruleOn("injuries") || race(player) === "darkelf" || race(player) === "undead") return false;
  const body = bodyOf(player);
  const fresh = body.parasites === 0;
  body.parasites = PARASITE_SECONDS;
  touch(player);
  if (fresh) notify(player, "§2The water carried parasites. §7You feel weak and hungry; milk or Pestonya's cooking will purge them.");
  return true;
}

/** Heals a player a little. @param {Player} player @param {number} amount */
function heal(player, amount) {
  const health = player.getComponent("minecraft:health");
  if (health && health.currentValue > 0) health.setCurrentValue(Math.min(capOf(player), health.currentValue + amount));
}

/** Whether a player could use some healing. @param {Player} player */
function hurt(player) {
  const health = player.getComponent("minecraft:health");
  return Boolean(health && health.currentValue < capOf(player));
}

// ---------------------------------------------------------- lost hearts

/** The most health a player may have, after the hearts death has taken. @param {Player} player */
export function capOf(player) {
  const health = player.getComponent("minecraft:health");
  const max = health?.effectiveMax ?? 20;
  if (!ruleOn("hearts")) return max;
  return Math.max(Math.min(MIN_HEALTH, max), max - bodyOf(player).lost * 2);
}

/** Holds a player's health under their cap. Returns whether it had to. @param {Player} player */
export function holdCap(player) {
  if (exempt(player) || !ruleOn("hearts") || bodyOf(player).lost === 0) return false;
  const health = player.getComponent("minecraft:health");
  const cap = capOf(player);
  if (!health || health.currentValue <= cap) return false;
  health.setCurrentValue(cap);
  return true;
}

/** A player has died: death takes its price. @param {Player} player */
export function onDeath(player) {
  const body = bodyOf(player);
  body.bleed = body.leg = body.parasites = body.chill = body.warm = 0;
  body.temp = TEMP_MILD;
  body.thirst = Math.max(body.thirst, 14);
  if (ruleOn("hearts") && !exempt(player) && body.lost < MAX_LOST) {
    body.lost += 1;
    body.died = true;
  }
  touch(player);
}

/** Restores one lost heart. Returns a message, or "" when there was none to restore. @param {Player} player */
export function restoreHeart(player) {
  const body = bodyOf(player);
  if (body.lost === 0) return "";
  body.lost -= 1;
  touch(player);
  heal(player, 2);
  try {
    fx.rise(player.dimension, player.location, "holy", 0.8);
    fx.flash(player.dimension, fx.handOf(player), "holy", 1);
    player.playSound("random.levelup", { volume: 0.8, pitch: 1.4 });
  } catch {
    // cosmetic only
  }
  return body.lost === 0
    ? "§aThe Crystal of Vitality makes you whole: every heart is restored."
    : `§aThe Crystal of Vitality restores a heart. §7${body.lost} still lost.`;
}

// ------------------------------------------------------------------- wilds

/** The names of the six steps of danger, from the world spawn outward. */
export const ZONES = ["the Lands of Men", "the Borderlands", "the Wild Frontier", "the Untamed Wilds", "the Deadlands", "the Lands Beyond Reason"];

/** How dangerous a place is: 0 near the world spawn, up to 5. @param {string} dimension @param {{ x: number, z: number }} at */
export function dangerAt(dimension, at) {
  if (dimension.endsWith("end")) return MAX_DANGER;
  let spawn = { x: 0, z: 0 };
  try {
    spawn = world.getDefaultSpawnLocation();
  } catch {
    // assume the origin
  }
  const nether = dimension.endsWith("nether");
  const scale = nether ? 8 : 1; // a block in the Nether is eight in the Overworld
  const dx = at.x * scale - spawn.x, dz = at.z * scale - spawn.z;
  const tier = Math.floor(Math.sqrt(dx * dx + dz * dz) / DANGER_STEP) + (nether ? 1 : 0);
  return clamp(tier, 0, MAX_DANGER);
}

/** How dangerous the place a mob stands is, or 0 with the rule off. @param {Entity} mob */
function mobDanger(mob) {
  if (!ruleOn("wilds")) return 0;
  return dangerAt(mob.dimension.id, mob.location);
}

spawnHooks.level.push((mob) => mobDanger(mob) * LEVELS_PER_DANGER);
spawnHooks.elite.push((mob) => mobDanger(mob) * ELITE_PER_DANGER);

/** The zone each player was last told they are in. @type {Map<string, number>} */
const zoneOf = new Map();

/** Tells a player when they cross into a more (or less) dangerous zone. Returns the zone. @param {Player} player */
export function watchZone(player) {
  if (!ruleOn("wilds")) return 0;
  const zone = dangerAt(player.dimension.id, player.location);
  const was = zoneOf.get(player.id);
  zoneOf.set(player.id, zone);
  if (was === undefined || was === zone) return zone;
  try {
    const colour = zone >= 4 ? "§4" : zone >= 2 ? "§c" : zone === 1 ? "§6" : "§a";
    player.onScreenDisplay.setTitle(`${colour}${ZONES[zone]}`, {
      subtitle: zone > was ? `§7Danger ${zone} of ${MAX_DANGER}: the monsters here are stronger` : `§7Danger ${zone} of ${MAX_DANGER}: safer ground`,
      fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15,
    });
  } catch {
    // the player is leaving
  }
  return zone;
}

// ------------------------------------------------------------------ drinks

/** What each drink does: water, and anything else. */
export const DRINKS = {
  [MURKY]: { water: 6, dirty: 0.3 },
  [PURE]: { water: 8, cool: 2 },
  [FROST]: { water: 6, cool: 6, chill: DRAUGHT_SECONDS, text: "§bCocytus's Frost Draught: the heat cannot touch you for five minutes." },
  [EMBER]: { water: 6, heat: 6, warm: DRAUGHT_SECONDS, text: "§6Demiurge's Ember Draught: the cold cannot touch you for five minutes." },
  [mc("potion")]: { water: 3 },
  [mc("milk_bucket")]: { water: 4, purge: true },
  [mc("honey_bottle")]: { water: 3 },
  [mc("melon_slice")]: { water: 2 },
  [mc("sweet_berries")]: { water: 1 },
  [mc("apple")]: { water: 1 },
  [id("sebas_tea")]: { water: 6 },
  [id("pestonya_soup")]: { water: 4, purge: true },
  [id("red_potion")]: { water: 2 },
  [id("blue_potion")]: { water: 2 },
};

/**
 * A player finished drinking (or eating) something. Returns what it did, or "" when it was nothing to drink.
 * @param {Player} player @param {string} item @param {number} [roll] 0..1, rolled only when needed
 */
export function drink(player, item, roll) {
  /** @type {{ water: number, dirty?: number, cool?: number, heat?: number, chill?: number, warm?: number, purge?: boolean, text?: string } | undefined} */
  const d = DRINKS[item];
  if (!d) return "";
  const body = bodyOf(player);
  const vampire = race(player) === "vampire";
  if (thirsts(player)) body.thirst = clamp(body.thirst + (vampire ? Math.ceil(d.water / 2) : d.water), 0, THIRST_MAX);
  if (d.cool && body.temp > TEMP_MILD) body.temp = Math.max(TEMP_MILD, body.temp - d.cool); // back toward mild, never past it
  if (d.heat && body.temp < TEMP_MILD) body.temp = Math.min(TEMP_MILD, body.temp + d.heat);
  if (d.chill) body.chill = d.chill;
  if (d.warm) body.warm = d.warm;
  if (d.purge) body.parasites = 0;
  touch(player);
  if (d.dirty && (roll ?? Math.random()) < d.dirty && infect(player)) return "parasites";
  if (d.text) notify(player, d.text);
  return "drank";
}

/** Whether a player stands with an empty hand. @param {Player} player */
function emptyHanded(player) {
  try {
    return !player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return true;
  }
}

/** Whether a player is looking at water close by. @param {Player} player @param {number} reach */
export function facingWater(player, reach) {
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: reach, includeLiquidBlocks: true });
    const type = hit?.block?.typeId;
    return type === mc("water") || type === mc("flowing_water");
  } catch {
    return false;
  }
}

export const SIP_WATER = 1;
export const SIP_DIRTY = 0.08;
/** Tick of each player's last sip. @type {Map<string, number>} */
const lastSip = new Map();

/** A sneaking, empty-handed player looking at water drinks from it. Returns whether they did. @param {Player} player @param {number} [roll] */
export function sip(player, roll) {
  if (!thirsts(player) || exempt(player) || !player.isSneaking || !emptyHanded(player)) return false;
  if (system.currentTick - (lastSip.get(player.id) ?? -TICKS) < TICKS) return false;
  if (!facingWater(player, 3)) return false;
  lastSip.set(player.id, system.currentTick);
  const body = bodyOf(player);
  if (body.thirst >= THIRST_MAX) {
    notify(player, "§bYou are not thirsty.");
    return false;
  }
  quench(player, race(player) === "vampire" ? SIP_WATER / 2 : SIP_WATER);
  try {
    player.playSound("random.drink", { volume: 0.6, pitch: 1.1 });
  } catch {
    // cosmetic only
  }
  if ((roll ?? Math.random()) < SIP_DIRTY) infect(player);
  else notify(player, `§bYou drink from the water. §7Water ${Math.floor(bodyOf(player).thirst)}/${THIRST_MAX}`);
  return true;
}

// ---------------------------------------------------------------- the items

/** Takes one of the item a player holds. @param {Player} player */
function useUp(player) {
  if (exempt(player)) return;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  const slot = player.selectedSlotIndex ?? 0;
  const stack = container.getItem(slot);
  if (!stack) return;
  if (stack.amount > 1) {
    stack.amount -= 1;
    container.setItem(slot, stack);
  } else {
    container.setItem(slot, undefined);
  }
}

/** Tick each player last used a healing item. @type {Map<string, number>} */
const lastAid = new Map();
const AID_REST = TICKS;

/**
 * A player used one of the hardcore items. Returns a message, or "" when it was not one of them.
 * @param {Player} player @param {string} item
 */
export function useItem(player, item) {
  const body = bodyOf(player);
  if (item === WATERSKIN) {
    if (!facingWater(player, 4)) return "§7Look at water close by to fill the waterskin.";
    useUp(player);
    giveItem(player, MURKY, 1);
    try {
      player.playSound("bucket.fill_water", { volume: 0.7, pitch: 1.2 });
    } catch {
      // cosmetic only
    }
    return "§bYou fill the waterskin. §7River water may carry parasites: boil it over a campfire or in a furnace first.";
  }
  if (![BANDAGE, SPLINT, FIELD_KIT, CRYSTAL].includes(item)) return "";
  if (system.currentTick - (lastAid.get(player.id) ?? -AID_REST) < AID_REST) return "§7You are still tending to yourself.";
  if (item === CRYSTAL) {
    const said = restoreHeart(player);
    if (!said) return ruleOn("hearts") ? "§7You have lost no hearts: keep the crystal for when you do." : "§7Death takes no hearts in this world.";
    useUp(player);
    lastAid.set(player.id, system.currentTick);
    return said;
  }
  if (item === BANDAGE) {
    if (body.bleed === 0 && !hurt(player)) return "§7You have no wound to bind.";
    const was = body.bleed > 0;
    body.bleed = 0;
    heal(player, 2);
    useUp(player);
    touch(player);
    lastAid.set(player.id, system.currentTick);
    return was ? "§aYou bind the wound. The bleeding stops." : "§aYou bind your cuts.";
  }
  if (item === SPLINT) {
    if (body.leg === 0) return "§7No bone of yours is broken.";
    body.leg = 0;
    useUp(player);
    touch(player);
    lastAid.set(player.id, system.currentTick);
    return "§aYou set the bone and bind it to the splint. You can walk again.";
  }
  // Pestonya's Field Kit: everything at once
  if (body.bleed === 0 && body.leg === 0 && body.parasites === 0 && !hurt(player)) return "§7You are hale: keep the kit for when you are not.";
  body.bleed = body.leg = body.parasites = 0;
  heal(player, 6);
  try {
    player.addEffect("regeneration", 10 * TICKS, { amplifier: 0, showParticles: false });
    fx.rise(player.dimension, player.location, "holy", 0.7);
  } catch {
    // cosmetic only
  }
  useUp(player);
  touch(player);
  lastAid.set(player.id, system.currentTick);
  return "§aPestonya's Field Kit: wounds bound, bones set, parasites purged.";
}

// --------------------------------------------------------------------- HUD

/** The hardcore part of the status bar. @param {Player} player */
export function hud(player) {
  if (exempt(player)) return "";
  const body = bodyOf(player);
  let out = "";
  if (thirsts(player)) {
    const water = Math.floor(body.thirst);
    out += ` §7| ${water === 0 ? "§4" : water <= PARCHED_AT ? "§6" : "§b"}Water ${water}`;
  }
  if (feelsWeather(player)) out += ` §7| ${tempWord(body.temp)}`;
  if (ruleOn("injuries")) {
    if (body.bleed > 0) out += " §4Bleeding";
    if (body.leg > 0) out += " §4Broken leg";
    if (body.parasites > 0) out += " §2Parasites";
  }
  return out;
}

hooks.hud.push(hud);

// -------------------------------------------------------------------- menu

/** The page on the Adventurer's Plate. @param {Player} player */
export function status(player) {
  const body = bodyOf(player);
  const lines = [];
  if (exempt(player)) lines.push("§7You are in creative or spectator mode: the world leaves you alone.\n");
  for (const c of companions()) {
    const off = c.covers.filter((k) => !ruleOn(/** @type {RuleKey} */ (k)));
    if (off.length) lines.push(`§7${c.name} is installed and brings its own ${off.map((k) => RULES[/** @type {RuleKey} */ (k)].name.toLowerCase()).join(", ")}, so ours are off. Turn them on in World rules to have both.\n`);
  }
  if (thirsts(player)) lines.push(`§bWater: §f${Math.floor(body.thirst)}/${THIRST_MAX}`);
  else if (ruleOn("thirst")) lines.push("§5Water: §7your undead body needs none");
  if (feelsWeather(player)) lines.push(`§fBody temperature: ${tempWord(body.temp)}`);
  else if (ruleOn("temperature")) lines.push("§5Temperature: §7heat and cold mean nothing to the undead");
  if (ruleOn("injuries")) {
    const ills = [body.bleed > 0 ? `§4bleeding (${Math.ceil(body.bleed)}s)` : "", body.leg > 0 ? `§4a broken leg (${Math.ceil(body.leg)}s)` : "", body.parasites > 0 ? `§2parasites (${Math.ceil(body.parasites)}s)` : ""].filter(Boolean);
    lines.push(`§fInjuries: ${ills.length ? ills.join("§f, ") : "§anone"}`);
  }
  if (ruleOn("hearts")) lines.push(`§fHearts lost to death: ${body.lost ? `§c${body.lost}` : "§anone"}`);
  if (ruleOn("wilds")) {
    const zone = dangerAt(player.dimension.id, player.location);
    lines.push(`§fYou are in §e${ZONES[zone]}§f (danger ${zone}/${MAX_DANGER}).`);
  }
  if (body.chill > 0) lines.push(`§bFrost Draught: ${Math.ceil(body.chill)}s`);
  if (body.warm > 0) lines.push(`§6Ember Draught: ${Math.ceil(body.warm)}s`);
  return lines.join("\n");
}

export const GUIDE = [
  "§lWater§r: the status bar shows it. Sneak and look at water with an empty hand to sip (it may carry parasites). Fill a §fLeather Waterskin§r at water; cook the river water over a campfire or in a furnace to boil it safe.",
  "§lTemperature§r: snow, ice, peaks, night, rain and water chill you; deserts, the Nether, sprinting and fire warm you. Stand by a campfire to warm up. Leather armour keeps you warm. §bCocytus's Frost Draught§r (boiled water + ice) and §6Demiurge's Ember Draught§r (boiled water + blaze powder) guard you for five minutes; fire resistance stops the heat.",
  "§lInjuries§r: §fLinen Bandages§r stop bleeding, §fSplints§r set broken legs, §fPestonya's Field Kit§r mends everything. Milk and Pestonya's soup purge parasites.",
  "§lDeath§r: each death takes a heart, down to three. A §dCrystal of Vitality§r restores one. Elites sometimes carry them, world bosses always do, and they can be crafted from gold, Data Crystals and a golden apple.",
  "§lThe wilds§r: the further you travel from the world spawn, the stronger the monsters and the more elites - and the more XP they give.",
  "§lRaces§r: the Undead neither thirst nor feel heat and cold, and do not bleed; Vampires drink from the blows they strike; Demons cannot overheat; Dragonkin shrug off both heat and cold; Dark Elves cannot catch parasites.",
  "§lWith RSCraft§r: it has its own thirst, temperature, first aid and hearts, so ours start switched off and only the dangerous wilds stay on. Any of ours can be switched on in World rules.",
];

/** Opens the Hardcore Survival page. @param {Player} player */
export function openSurvival(player) {
  new ActionFormData()
    .title("Hardcore Survival")
    .body(status(player))
    .button("How to survive")
    .button("World rules")
    .button("Close")
    .show(player)
    .then((response) => {
      if (response.canceled || !player.isValid) return;
      if (response.selection === 0) openGuide(player);
      else if (response.selection === 1) openRules(player);
    })
    .catch(() => {});
}

/** @param {Player} player */
function openGuide(player) {
  new ActionFormData()
    .title("How to survive")
    .body(GUIDE.join("\n\n"))
    .button("Back")
    .show(player)
    .then((response) => {
      if (!response.canceled && player.isValid) openSurvival(player);
    })
    .catch(() => {});
}

/** @param {Player} player */
export function openRules(player) {
  const keys = /** @type {RuleKey[]} */ (Object.keys(RULES));
  const form = new ActionFormData()
    .title("World rules")
    .body(`${keys.map((k) => `§f${RULES[k].name}: §7${RULES[k].help}`).join("\n")}\n\n§7Only a player in creative mode can change these, for everyone in the world.`);
  for (const k of keys) form.button(`${RULES[k].name}: ${ruleOn(k) ? "§2ON" : "§4OFF"}`);
  form.button("Back");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      const key = keys[response.selection];
      if (!key) return openSurvival(player);
      if (!exempt(player)) {
        notify(player, "§7Only a player in creative mode can change the world's rules.");
        return;
      }
      setRule(key, !ruleOn(key));
      world.sendMessage(`§2[Hardcore] §f${player.name} turned §e${RULES[key].name}§f ${ruleOn(key) ? "§2on" : "§4off"}§f for this world.`);
      openRules(player);
    })
    .catch(() => {});
}

registerMenu(() => "§2Hardcore Survival", openSurvival);

// ------------------------------------------------------------------- events

/** Whether any rule is on at all. */
function anyRule() {
  return Object.values(rules()).some(Boolean);
}

/** A dimension's id without the namespace. @param {string} dimension */
const bare = (dimension) => dimension.replace(/^minecraft:/, "");

world.afterEvents.weatherChange.subscribe((event) => {
  weather.set(bare(event.dimension), String(event.newWeather));
});

world.afterEvents.itemCompleteUse.subscribe((event) => {
  try {
    const said = drink(event.source, event.itemStack.typeId);
    if (said === "drank" && thirsts(event.source) && !DRINKS[event.itemStack.typeId]?.text) {
      notify(event.source, `§bWater ${Math.floor(bodyOf(event.source).thirst)}/${THIRST_MAX}`);
    }
  } catch {
    // the drinker left
  }
});

world.afterEvents.itemUse.subscribe((event) => {
  try {
    const said = useItem(event.source, event.itemStack?.typeId ?? "");
    if (said) notify(event.source, said);
  } catch {
    // the player left
  }
});

world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const victim = event.hurtEntity;
    if (victim.typeId === "minecraft:player") {
      wound(/** @type {Player} */ (victim), event.damageSource.cause, event.damage);
      return;
    }
    // Vampires slake their thirst on the blows they strike.
    const striker = event.damageSource.damagingEntity;
    if (striker?.typeId !== "minecraft:player" || event.damage <= 0) return;
    const player = /** @type {Player} */ (striker);
    if (race(player) !== "vampire" || !thirsts(player)) return;
    if (victim.matches({ families: ["undead"] })) return; // there is no blood in the dead
    quench(player, 1);
  } catch {
    // someone vanished mid-blow
  }
});

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    if (dead.typeId === "minecraft:player") {
      onDeath(/** @type {Player} */ (dead));
      return;
    }
    if (!ruleOn("hearts")) return;
    const player = creditedPlayer(event.damageSource.damagingEntity);
    if (!player) return;
    // World bosses always carry a Crystal of Vitality; elites sometimes, more often in the dangerous wilds.
    const boss = dead.hasTag("overlord_worldboss");
    const chance = boss ? 1 : isElite(dead) ? 0.06 + dangerAt(dead.dimension.id, dead.location) * 0.02 : 0;
    if (chance > 0 && Math.random() < chance) {
      giveItem(player, CRYSTAL, 1);
      player.sendMessage("§d[Hardcore] §fA §dCrystal of Vitality§f! Use it to restore a heart lost to death.");
    }
  } catch {
    // the killer or the dead vanished
  }
});

world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  system.runTimeout(() => {
    try {
      if (!player.isValid) return;
      const body = bodyOf(player);
      if (event.initialSpawn && (ruleOn("thirst") || ruleOn("injuries")) && !player.hasTag("overlord_hardcore_kit")) {
        player.addTag("overlord_hardcore_kit");
        giveItem(player, PURE, 1);
        giveItem(player, WATERSKIN, 1);
        giveItem(player, BANDAGE, 3);
        player.sendMessage("§2[Hardcore] §fThe New World is unforgiving. Watch your §bWater§f and your §fTemperature§f on the status bar, and open §2Hardcore Survival§f on the Adventurer's Plate to learn how to live through it. A waterskin and bandages are in your pack.");
      }
      if (!event.initialSpawn && body.died) {
        body.died = false;
        touch(player);
        player.sendMessage(`§4[Hardcore] §fResurrection has a price: you return with §c${body.lost} heart${body.lost === 1 ? "" : "s"}§f fewer. A §dCrystal of Vitality§f restores one.`);
      }
    } catch {
      // the player left again
    }
  }, 40);
});

world.afterEvents.playerLeave.subscribe((event) => {
  zoneOf.delete(event.playerId);
  lastSip.delete(event.playerId);
  lastAid.delete(event.playerId);
});

// The step: thirst, temperature and injuries, and the zone the player is in.
system.runInterval(() => {
  if (!anyRule()) return;
  for (const player of world.getAllPlayers()) {
    try {
      endure(player, sense(player));
      watchZone(player);
    } catch {
      // the player is leaving
    }
  }
}, STEP);

// Quickly: sipping from water, and the cap on health that death has set.
system.runInterval(() => {
  if (!anyRule()) return;
  for (const player of world.getAllPlayers()) {
    try {
      sip(player);
      holdCap(player);
    } catch {
      // the player is leaving
    }
  }
}, 10);
