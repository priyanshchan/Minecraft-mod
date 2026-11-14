// Overlord: Tomb of Nazarick - races of Yggdrasil.
//
// Beside a class, every player may take a race: Human, Undead, Vampire, Demon, Angel or Dragonkin. A race
// levels on its own (a quarter of all XP earned feeds it), from 1 to MAX_RACE_LEVEL, and grows through
// three ranks - a Skeleton becomes an Elder Lich and then an Overlord. Each race has passives that grow
// with its level, a weakness, and from rank two a transformation: hold sneak and jump to take your true
// form for half a minute. The race page of the Adventurer's Plate chooses, explains and, for a price,
// changes the race (Reincarnation starts the new one from level 1).
import { world, system, EntityDamageCause } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { hooks, notify, profileOf, registerMenu, restoreMana, spendMana, touch } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import { foesNear, strike } from "./arms.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
export const MAX_RACE_LEVEL = 15;
/** The share of every XP gain that feeds the race. */
export const RACE_SHARE = 0.25;
/** The race level of each rank. */
export const RANK_LEVELS = [1, 5, 10];
/** Seconds a transformation lasts (plus one per race level) and seconds before it can be taken again. */
export const FORM_SECONDS = 30;
export const FORM_COOLDOWN = 180;
export const FORM_MANA = 30;
/** Gold Coins to be reincarnated as another race. */
export const REBIRTH_COST = 100;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("./rpg.js").Profile} Profile */
/**
 * @typedef {{
 *   name: string, ranks: [string, string, string], element: string, color: string,
 *   blurb: string, passives: string, weakness: string, form: string, formHelp: string,
 * }} Race
 */

/** @type {Record<string, Race>} */
export const RACES = {
  human: {
    name: "Human", ranks: ["Human", "Hero", "Godkin"], element: "holy", color: "§e",
    blurb: "The weakest race of Yggdrasil, and the quickest to learn. No gift, and no flaw.",
    passives: "XP +10% (+1% a race level); melee +1% a race level; at rank 2, Regeneration while below half health",
    weakness: "None",
    form: "Heroic Spirit", formHelp: "Strength II, Speed I, Resistance I and Regeneration I",
  },
  undead: {
    name: "Undead", ranks: ["Skeleton", "Elder Lich", "Overlord"], element: "dark", color: "§5",
    blurb: "A body of bone and negative energy. It needs no food or air, and poison has nothing to poison.",
    passives: "Immune to poison and wither; never hungry; Night Vision; at rank 2, Water Breathing; melee +20% against the living",
    weakness: "Fire burns it 30% harder",
    form: "Overlord Form", formHelp: "Resistance II and an Aura of Despair: monsters within 8 blocks are weakened and slowed, and you regain mana",
  },
  vampire: {
    name: "Vampire", ranks: ["Lesser Vampire", "Vampire", "True Vampire"], element: "fire", color: "§c",
    blurb: "A creature of the night that drinks the life of what it strikes.",
    passives: "Blows drink 5% of their harm (+0.5% a race level); Strength I and Speed I at night",
    weakness: "Under the open sky by day it is weakened and slowed",
    form: "Bloodfallen", formHelp: "Strength II, Speed II and blows that drink 35% of their harm",
  },
  demon: {
    name: "Demon", ranks: ["Imp", "Demon", "Arch-Devil"], element: "fire", color: "§6",
    blurb: "A spawn of the abyss, at home in fire.",
    passives: "Fire Resistance; blows may set foes alight (3% a race level); melee +1% a race level",
    weakness: "Water saps it: slowed and weakened while in water",
    form: "Demonic Form", formHelp: "Strength II, Jump Boost II and a ring of hellfire that burns every monster within 4 blocks",
  },
  angel: {
    name: "Angel", ranks: ["Angel", "Archangel", "Seraph"], element: "holy", color: "§f",
    blurb: "A being of light from the heavens. It glides on its wings and heals in the sun.",
    passives: "Sneak in the air to glide; Regeneration I in daylight; melee +25% against undead and demons",
    weakness: "In the Nether it is weakened and slowed",
    form: "Seraph", formHelp: "Regeneration II, Slow Falling, and every player within 8 blocks is healed each second",
  },
  dragonkin: {
    name: "Dragonkin", ranks: ["Dragonkin", "Drake-blood", "Heir of the Dragon Lords"], element: "fire", color: "§a",
    blurb: "Blood of the dragons: a hide like armour and a lord's strength.",
    passives: "Health Boost (a tier every 5 race levels); Resistance I from rank 2; melee +1% a race level",
    weakness: "Heavy as a dragon: slowed in water",
    form: "Dragon Form", formHelp: "Strength II, Resistance II, Fire Resistance, and fire breath every 3 seconds at what you face",
  },
};

// ---------------------------------------------------------------- progress

/** XP from one race level to the next. @param {number} level */
export function raceXpFor(level) {
  return 300 * level * level;
}

/** The race key of a profile, or "none". @param {Profile} p */
export function raceOf(p) {
  return typeof p.race === "string" && p.race in RACES ? p.race : "none";
}

/** 0, 1 or 2: the rank of a race level. @param {number} level */
export function rankOf(level) {
  return level >= RANK_LEVELS[2] ? 2 : level >= RANK_LEVELS[1] ? 1 : 0;
}

/** The rank name, such as "Elder Lich". @param {Profile} p */
export function rankName(p) {
  const race = raceOf(p);
  return race === "none" ? "No race" : RACES[race].ranks[rankOf(p.raceLv)];
}

/**
 * Feeds the race with XP. Returns how many race levels were gained.
 * @param {Player} player @param {number} amount character XP earned
 */
export function feedRace(player, amount) {
  const p = profileOf(player);
  const race = raceOf(p);
  if (race === "none" || p.raceLv >= MAX_RACE_LEVEL || amount <= 0) return 0;
  p.raceXp += Math.round(amount * RACE_SHARE);
  let gained = 0;
  const rankBefore = rankOf(p.raceLv);
  while (p.raceLv < MAX_RACE_LEVEL && p.raceXp >= raceXpFor(p.raceLv)) {
    p.raceXp -= raceXpFor(p.raceLv);
    p.raceLv += 1;
    gained++;
  }
  if (p.raceLv >= MAX_RACE_LEVEL) p.raceXp = 0;
  touch(player);
  if (gained > 0) {
    const info = RACES[race];
    const rank = rankOf(p.raceLv);
    try {
      if (rank > rankBefore) {
        player.onScreenDisplay.setTitle(`${info.color}${info.ranks[rank]}`, { subtitle: `§7Your ${info.name} blood awakens`, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
        player.sendMessage(`§6[Race] §fYou became ${info.color}${info.ranks[rank]}§f!${rank === 1 ? ` §7Hold sneak and jump to take your ${info.form}.` : ""}`);
        fx.pillar(player.dimension, player.location, info.element, 6);
      } else {
        player.sendMessage(`§6[Race] §f${info.name} level §6${p.raceLv}§f.`);
      }
    } catch {
      // the player left
    }
  }
  return gained;
}

/**
 * Takes a race. The first is free; changing it later costs Gold Coins and starts the new race at level 1.
 * Returns a message describing the outcome.
 * @param {Player} player @param {string} race
 */
export function chooseRace(player, race) {
  if (!(race in RACES)) return "§7No such race";
  const p = profileOf(player);
  const current = raceOf(p);
  if (current === race) return `§7You are already ${RACES[race].name}`;
  if (current !== "none") {
    if (countItem(player, id("yggdrasil_gold_coin")) < REBIRTH_COST) return `§7Reincarnation costs ${REBIRTH_COST} Gold Coins`;
    takeItem(player, id("yggdrasil_gold_coin"), REBIRTH_COST);
    p.reborn += 1;
    endForm(player, false);
  }
  p.race = race;
  p.raceLv = 1;
  p.raceXp = 0;
  touch(player);
  const info = RACES[race];
  fx.rise(player.dimension, player.location, info.element, 1);
  fx.pillar(player.dimension, player.location, info.element, 4);
  return `${info.color}You are now ${info.ranks[0]}`;
}

// ---------------------------------------------------------------- passives

/** Keeps an effect up for a little while; refreshed each second it holds. @param {Player} player @param {string} effect @param {number} amplifier @param {number} [seconds] */
function keep(player, effect, amplifier, seconds = 3) {
  try {
    const current = player.getEffect(effect);
    if (current && current.amplifier > amplifier) return; // something stronger is already there
    player.addEffect(effect, seconds * TICKS, { amplifier, showParticles: false });
  } catch {
    // no such effect here
  }
}

/** @param {Player} player @param {string} effect */
function lift(player, effect) {
  try {
    if (player.getEffect(effect)) player.removeEffect(effect);
  } catch {
    // nothing to lift
  }
}

/** Whether the sun is up. */
function daytime() {
  try {
    const t = world.getTimeOfDay();
    return t < 12500 || t > 23500;
  } catch {
    return true;
  }
}

/** Whether nothing stands between the player and the sky. @param {Player} player */
function underSky(player) {
  try {
    const top = player.dimension.getTopmostBlock({ x: player.location.x, z: player.location.z });
    return !top || top.location.y < player.location.y + 1;
  } catch {
    return false;
  }
}

/** @param {Player} player */
function inWater(player) {
  try {
    return player.isInWater === true;
  } catch {
    return false;
  }
}

/** @param {Player} player */
function healthShare(player) {
  try {
    const h = player.getComponent("minecraft:health");
    return h && h.effectiveMax > 0 ? h.currentValue / h.effectiveMax : 1;
  } catch {
    return 1;
  }
}

/** @param {Player} player @param {number} amount */
function heal(player, amount) {
  try {
    const h = player.getComponent("minecraft:health");
    if (h && h.currentValue > 0) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amount));
  } catch {
    // no health
  }
}

/**
 * One second of a player's race: passives, weakness and the form's pulse. Returns the weakness felt, if any.
 * @param {Player} player @param {number} now
 */
export function tick(player, now) {
  const p = profileOf(player);
  const race = raceOf(p);
  if (race === "none") return "";
  const r = p.raceLv;
  const rank = rankOf(r);
  const dim = player.dimension.id;
  let weak = "";
  if (race === "human") {
    if (rank >= 1 && healthShare(player) < 0.5) keep(player, "regeneration", 0);
  } else if (race === "undead") {
    lift(player, "poison");
    lift(player, "wither");
    lift(player, "hunger");
    keep(player, "saturation", 0, 2);
    keep(player, "night_vision", 0, 16);
    if (rank >= 1) keep(player, "water_breathing", 0);
  } else if (race === "vampire") {
    if (!daytime()) {
      keep(player, "strength", 0);
      keep(player, "speed", 0);
    } else if (underSky(player) && dim.endsWith("overworld") && !forms.has(player.id)) {
      keep(player, "weakness", 0);
      keep(player, "slowness", 0);
      weak = "the sun";
    }
  } else if (race === "demon") {
    keep(player, "fire_resistance", 0);
    if (inWater(player)) {
      keep(player, "slowness", 0);
      keep(player, "weakness", 0);
      weak = "water";
    }
  } else if (race === "angel") {
    if (daytime() && underSky(player) && dim.endsWith("overworld")) keep(player, "regeneration", 0);
    if (dim.endsWith("nether")) {
      keep(player, "weakness", 0);
      keep(player, "slowness", 0);
      weak = "the Nether";
    }
  } else if (race === "dragonkin") {
    keep(player, "health_boost", Math.floor(r / 5), 4);
    if (rank >= 1) keep(player, "resistance", 0);
    if (inWater(player)) {
      keep(player, "slowness", 1);
      weak = "water";
    }
  }
  pulseForm(player, race, now);
  return weak;
}

/** Angels glide: sneaking in the air slows the fall. @param {Player} player */
export function glide(player) {
  if (raceOf(profileOf(player)) !== "angel") return false;
  try {
    if (!player.isSneaking || player.isOnGround) return false;
    if (player.getVelocity().y >= -0.1) return false;
    keep(player, "slow_falling", 0, 1);
    return true;
  } catch {
    return false;
  }
}

/** What the race adds to a melee blow. @param {Player} player @param {Profile} p @param {Entity} victim */
export function meleeBonus(player, p, victim) {
  const race = raceOf(p);
  if (race === "none") return 0;
  const r = p.raceLv;
  let bonus = 0;
  if (race === "human" || race === "demon" || race === "dragonkin") bonus += r * 0.01;
  try {
    if (race === "undead" && !victim.matches({ families: ["undead"] })) bonus += 0.2;
    if (race === "angel" && (victim.matches({ families: ["undead"] }) || victim.matches({ families: ["demon"] }))) bonus += 0.25;
  } catch {
    // no families
  }
  if (forms.has(player.id) && race === "human") bonus += 0.2;
  return bonus;
}

/** XP multiplier of the race. @param {Profile} p */
export function xpFactor(p) {
  return raceOf(p) === "human" ? 1.1 + p.raceLv * 0.01 : 1;
}

// ---------------------------------------------------------------- the forms

/** Player id -> when the form ends. */
/** @type {Map<string, number>} */
export const forms = new Map();
/** Player id -> when the form can be taken again. */
/** @type {Map<string, number>} */
export const rested = new Map();
/** Player id -> the next dragon breath. */
const breaths = new Map();

/**
 * Takes the race's true form. Returns a message describing the outcome.
 * @param {Player} player @param {number} [now]
 */
export function transform(player, now = system.currentTick) {
  const p = profileOf(player);
  const race = raceOf(p);
  if (race === "none") return "§7You have no race yet: choose one on your Adventurer's Plate";
  const info = RACES[race];
  if (rankOf(p.raceLv) < 1) return `§7${info.form} awakens at race level ${RANK_LEVELS[1]}`;
  if (forms.has(player.id)) return `§7You are already in your ${info.form}`;
  const ready = rested.get(player.id) ?? 0;
  if (now < ready) return `§7Your ${info.form} returns in ${Math.ceil((ready - now) / TICKS)}s`;
  if (!spendMana(player, FORM_MANA)) return `§7${info.form} needs ${FORM_MANA} mana`;
  const seconds = FORM_SECONDS + p.raceLv;
  forms.set(player.id, now + seconds * TICKS);
  rested.set(player.id, now + (seconds + FORM_COOLDOWN) * TICKS);
  fx.pose(player, "awaken");
  fx.pillar(player.dimension, player.location, info.element, 7, 1.8);
  fx.nova(player.dimension, { x: player.location.x, y: player.location.y + 1, z: player.location.z }, info.element, 4);
  fx.shake(player.dimension, player.location, 10, 0.25, 0.4);
  try {
    player.onScreenDisplay.setTitle(`${info.color}${info.form}`, { subtitle: `§7${seconds} seconds`, fadeInDuration: 3, stayDuration: 30, fadeOutDuration: 10 });
    player.playSound(race === "angel" ? "beacon.activate" : "mob.wither.spawn", { volume: 0.7, pitch: race === "angel" ? 1.2 : 1.6 });
  } catch {
    // cosmetic only
  }
  return `${info.color}${info.form}!`;
}

/** @param {Player} player @param {boolean} [tell] */
function endForm(player, tell = true) {
  if (!forms.delete(player.id)) return;
  if (tell) notify(player, "§7Your true form fades");
}

/** Each second of a form: its effects, its aura and what it does. @param {Player} player @param {string} race @param {number} now */
function pulseForm(player, race, now) {
  const until = forms.get(player.id);
  if (until === undefined) return;
  if (now >= until) {
    endForm(player);
    return;
  }
  const info = RACES[race];
  const at = player.location;
  fx.rise(player.dimension, at, info.element, 0.9);
  if (race === "human") {
    keep(player, "strength", 1);
    keep(player, "speed", 0);
    keep(player, "resistance", 0);
    keep(player, "regeneration", 0);
  } else if (race === "undead") {
    keep(player, "resistance", 1);
    restoreMana(player, 3);
    for (const foe of foesNear(player, at, 8)) {
      try {
        foe.addEffect("weakness", 40, { amplifier: 1 });
        foe.addEffect("slowness", 40, { amplifier: 1 });
      } catch {
        // gone
      }
    }
    fx.ring(player.dimension, at, "dark", 8);
  } else if (race === "vampire") {
    keep(player, "strength", 1);
    keep(player, "speed", 1);
  } else if (race === "demon") {
    keep(player, "strength", 1);
    keep(player, "jump_boost", 1);
    for (const foe of foesNear(player, at, 4)) {
      try {
        foe.setOnFire(3, true);
        strike(player, foe, 2);
      } catch {
        // gone
      }
    }
    fx.ring(player.dimension, at, "fire", 4);
  } else if (race === "angel") {
    keep(player, "regeneration", 1);
    keep(player, "slow_falling", 0);
    try {
      for (const ally of player.dimension.getPlayers({ location: at, maxDistance: 8 })) heal(ally, 1);
    } catch {
      // alone
    }
    fx.circle(player.dimension, at, "holy", 8);
  } else if (race === "dragonkin") {
    keep(player, "strength", 1);
    keep(player, "resistance", 1);
    keep(player, "fire_resistance", 0);
    if (now >= (breaths.get(player.id) ?? 0)) {
      breaths.set(player.id, now + 3 * TICKS);
      breathe(player);
    }
  }
}

/** Dragon Form's breath: a cone of fire six blocks ahead. Returns how many it caught. @param {Player} player */
export function breathe(player) {
  let view = { x: 0, y: 0, z: 1 };
  try {
    view = player.getViewDirection();
  } catch {
    // facing on
  }
  const length = Math.hypot(view.x, view.z) || 1;
  const dir = { x: view.x / length, z: view.z / length };
  const from = { x: player.location.x, y: player.location.y + 1.4, z: player.location.z };
  fx.beam(player.dimension, from, { x: from.x + dir.x * 6, y: from.y, z: from.z + dir.z * 6 }, "fire", 1.4);
  let caught = 0;
  const p = profileOf(player);
  for (const foe of foesNear(player, { x: from.x + dir.x * 3.5, y: player.location.y, z: from.z + dir.z * 3.5 }, 4)) {
    const dx = foe.location.x - player.location.x;
    const dz = foe.location.z - player.location.z;
    const ahead = dx * dir.x + dz * dir.z;
    if (ahead < 0 || ahead > 7 || Math.abs(dx * dir.z - dz * dir.x) > 1 + ahead * 0.45) continue;
    strike(player, foe, 6 + p.raceLv * 0.8);
    try {
      foe.setOnFire(4, true);
    } catch {
      // gone
    }
    caught++;
  }
  return caught;
}

// ---------------------------------------------------------------- hooks

hooks.melee.push(meleeBonus);
hooks.xpFactor.push(xpFactor);
hooks.xp.push(feedRace);

/** Sneak + jump: the true form. Player id -> whether the combo was already used this press. */
const combos = new Map();

system.runInterval(() => {
  const now = system.currentTick;
  const second = now % TICKS === 0;
  for (const player of world.getAllPlayers()) {
    try {
      glide(player);
      const both = player.isSneaking && player.isJumping;
      if (both && !combos.get(player.id)) {
        const p = profileOf(player);
        if (raceOf(p) !== "none" && rankOf(p.raceLv) >= 1) notify(player, transform(player, now));
      }
      combos.set(player.id, both);
      if (second) tick(player, now);
    } catch {
      // the player is leaving
    }
  }
}, 2);

// Blows that drink, blows that burn, and the weakness to fire.
let striking = false;
world.afterEvents.entityHurt.subscribe((event) => {
  if (striking) return;
  try {
    const victim = event.hurtEntity;
    const source = event.damageSource;
    if (victim.typeId === "minecraft:player") {
      const p = profileOf(/** @type {Player} */ (victim));
      if (raceOf(p) === "undead" && [EntityDamageCause.fire, EntityDamageCause.fireTick, EntityDamageCause.lava].includes(/** @type {any} */ (source.cause))) {
        const h = victim.getComponent("minecraft:health");
        if (h && h.currentValue - event.damage * 0.3 > 0.5) h.setCurrentValue(h.currentValue - event.damage * 0.3);
      }
      return;
    }
    const attacker = source.damagingEntity;
    if (!attacker || attacker.typeId !== "minecraft:player" || source.cause !== EntityDamageCause.entityAttack) return;
    const player = /** @type {Player} */ (attacker);
    const p = profileOf(player);
    const race = raceOf(p);
    if (race === "vampire") {
      const share = forms.has(player.id) ? 0.35 : 0.05 + p.raceLv * 0.005;
      heal(player, event.damage * share);
    } else if (race === "demon" && Math.random() < p.raceLv * 0.03) {
      victim.setOnFire(3, true);
    }
  } catch {
    // the foe vanished
  }
});

world.afterEvents.playerLeave.subscribe((event) => {
  forms.delete(event.playerId);
  combos.delete(event.playerId);
  breaths.delete(event.playerId);
});

world.afterEvents.entityDie.subscribe((event) => {
  if (event.deadEntity.typeId === "minecraft:player") forms.delete(event.deadEntity.id);
});

// ---------------------------------------------------------------- the race page

/** @param {Player} player */
export function openRaces(player) {
  const p = profileOf(player);
  const race = raceOf(p);
  const form = new ActionFormData().title("Race");
  /** @type {(() => void)[]} */
  const actions = [];
  if (race === "none") {
    form.body("§7Beside your class, take a race of Yggdrasil. It levels on its own from a quarter of all the XP you earn, grows through three ranks, and from the second rank grants a true form: hold §fsneak and jump§7 to take it.\n\nYour first race is free.");
  } else {
    const info = RACES[race];
    const now = system.currentTick;
    const ready = rested.get(player.id) ?? 0;
    const next = p.raceLv >= MAX_RACE_LEVEL ? "§6max level" : `${p.raceXp}/${raceXpFor(p.raceLv)} race XP`;
    form.body(
      `${info.color}${rankName(p)}§r (${info.name}), race level §6${p.raceLv}§r/${MAX_RACE_LEVEL} - ${next}\n` +
        `§7Ranks: ${info.ranks.map((n, i) => `${i === rankOf(p.raceLv) ? "§f" : "§8"}${n} (${RANK_LEVELS[i]})`).join("§7 > ")}\n\n` +
        `§aGifts: §f${info.passives}\n§cWeakness: §f${info.weakness}\n` +
        `§dTrue form: §f${info.form} - ${info.formHelp}. ` +
        (rankOf(p.raceLv) < 1 ? `§7Awakens at race level ${RANK_LEVELS[1]}.` : forms.has(player.id) ? "§aActive now." : now < ready ? `§7Ready in ${Math.ceil((ready - now) / TICKS)}s.` : "§aReady: hold sneak and jump.")
    );
    if (rankOf(p.raceLv) >= 1) {
      form.button(`§dTake your ${info.form}\n§r${FORM_MANA} mana`);
      actions.push(() => notify(player, transform(player)));
    }
  }
  for (const [key, info] of Object.entries(RACES)) {
    if (key === race) continue;
    form.button(`${race === "none" ? "Become" : "Reincarnate as"} ${info.color}${info.name}\n§8${info.ranks.join(" > ")}`);
    actions.push(() => confirmRace(player, key));
  }
  form.button("Close");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      actions[response.selection]?.();
    })
    .catch(() => {});
}

/** @param {Player} player @param {string} key */
function confirmRace(player, key) {
  const info = RACES[key];
  const p = profileOf(player);
  const current = raceOf(p);
  const form = new ActionFormData()
    .title(info.name)
    .body(
      `§f${info.blurb}\n\n§7Ranks: §f${info.ranks.join(" > ")} §7(race levels ${RANK_LEVELS.join(", ")})\n` +
        `§aGifts: §f${info.passives}\n§cWeakness: §f${info.weakness}\n§dTrue form: §f${info.form} - ${info.formHelp}` +
        (current !== "none" ? `\n\n§cReincarnation costs ${REBIRTH_COST} Gold Coins, and your ${RACES[current].name} levels are lost.` : "")
    )
    .button(current === "none" ? `§6Become ${info.name}` : `§6Reincarnate (${REBIRTH_COST} coins)`)
    .button("Back");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      if (response.selection === 0) notify(player, chooseRace(player, key));
      else openRaces(player);
    })
    .catch(() => {});
}

registerMenu((player) => {
  const p = profileOf(player);
  const race = raceOf(p);
  return race === "none" ? "Race\n§8Choose a race of Yggdrasil" : `Race: ${RACES[race].color}${rankName(p)}\n§8${RACES[race].name}, race level ${p.raceLv}`;
}, openRaces);

/** Sets a race's level outright (the creative tome). @param {Player} player @param {number} level */
export function setRaceLevel(player, level) {
  const p = profileOf(player);
  p.raceLv = Math.max(1, Math.min(MAX_RACE_LEVEL, Math.floor(level)));
  p.raceXp = 0;
  touch(player);
  return p.raceLv;
}

/** Whether a player wears their true form. @param {Player} player */
export function inForm(player) {
  return forms.has(player.id);
}

