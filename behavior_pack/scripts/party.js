// Overlord: Tomb of Nazarick - the party.
// Every player can raise one retainer of their own (name, look and vocation of their
// choice) and hire up to three mercenaries. Retainers follow a stance set by the player
// (Come / Go / Stay) and a tactic of their own, use vocation skills, call out what they
// know about foes, and return a while after they fall. The player's own retainer levels
// with its master; mercenaries earn XP. Fighting together builds a bond with each member
// that strengthens its skills and shortens its recovery. Hurt members fall back, drink the
// master's potions and rest between fights; archers scout for camps.
import { world, system, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { MAX_LEVEL, TIPS, creditedPlayer, giveItem, isElite, killXp, notify, profileOf, registerMenu, standingOf, touch, xpForNext } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import { rumour } from "./structures.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const LONG = 20000000;
const COIN = id("yggdrasil_gold_coin");
const RETAINER = id("retainer");

export const MAX_PARTY = 4;
export const MAX_GEAR = 5;
const RECOVERY = 60; // seconds before a fallen retainer returns (less as the bond grows)
export const REVIVE_COST = 8; // Gold Coins to bring a fallen member back at once
export const MAX_BOND = 100;
/** Bond ranks, one for every 25 points. */
export const BOND_RANKS = ["Stranger", "Companion", "Trusted", "Loyal", "Sworn"];
const BOND_POWER = 0.08; // skill power per bond rank
const MERC_SHARE = 0.5; // share of the master's kill XP a mercenary earns
const SECOND_SKILL_LEVEL = 20;
const POTION = id("red_potion");
const POTION_HEAL = 20;
const SCOUT_FIRST = 120; // seconds before an archer first reports what lies ahead
const SCOUT_EVERY = 360;
/** How a member chooses the foe for its skills. */
export const TACTICS = ["Vanguard", "Guardian", "Free hand"];
const TACTIC_HELP = ["strikes the foe you are fighting", "strikes whatever last hurt you", "picks its own foe within 12 blocks"];
const STANCES = /** @type {const} */ (["come", "go", "stay"]);
const STANCE_HELP = {
  come: "Come - stay close and defend",
  go: "Go - range ahead and attack monsters on sight",
  stay: "Stay - hold this spot",
};

export const VOCATIONS = ["Fighter", "Archer", "Mage", "Healer", "Rogue", "Bard"];
const VOC_KEYS = ["fighter", "archer", "mage", "healer", "rogue", "bard"];
/** The twelve looks; look N belongs to vocation floor(N / 2). */
export const LOOKS = ["Knight", "Swordsman", "Ranger", "Hunter", "Sorcerer", "Wizard", "Priest", "Acolyte", "Assassin", "Thief", "Minstrel", "Skald"];

/** Traits a member can be given: one from level 10 and a second from level 30. */
export const TRAITS = [
  { key: "sturdy", name: "Sturdy", help: "+4 hearts" },
  { key: "keen", name: "Keen", help: "skills hit 15% harder" },
  { key: "swift", name: "Swift", help: "skills recharge 15% faster" },
  { key: "devoted", name: "Devoted", help: "the bond grows twice as fast" },
  { key: "scavenger", name: "Scavenger", help: "one kill in ten turns up a Gold Coin" },
  { key: "resolute", name: "Resolute", help: "returns in half the time after falling" },
];
export const GIFT_COST = 5; // Gold Coins for a gift, once a day per member
const GIFT_BOND = 5;
export const UNISON_COOLDOWN = 45; // seconds between Unison orders
const UNISON_POWER = 1.25;
const NAMES = ["Aria", "Borin", "Celia", "Dain", "Elsa", "Fenn", "Gwen", "Hale", "Iris", "Joss", "Kara", "Lund", "Mira", "Nils", "Orla", "Penn"];

/** The two skills of each vocation; the second is learned at level 20. */
const SKILLS = [
  ["Shield Bash (staggers the foe)", "Rallying Cry (Resistance for you below half health)"],
  ["Aimed Shot", "Volley (three foes at once)"],
  ["Elemental Bolt (the foe's weakness)", "Burst (everything around the foe)"],
  ["Mend (the most wounded ally)", "Sanctuary (a great heal when you are near death)"],
  ["Backstab (a poisoned strike)", "Cutpurse (one kill in five turns up a Gold Coin)"],
  ["Ballad of Valour (Strength and Speed for you in battle)", "Dirge (slows and weakens foes around the target)"],
];

/** Element a mage retainer reaches for against particular foes. */
const WEAK_TO = {
  [id("cocytus")]: "fire",
  [id("soul_eater")]: "fire",
  [id("solution")]: "fire",
  [id("frost_dragon")]: "fire",
  [id("war_troll")]: "fire",
  [id("hellhound")]: "ice",
  [id("evil_lord_wrath")]: "ice",
  [id("shadow_demon")]: "holy",
  [id("archangel_flame")]: "dark",
  [id("dominion_authority")]: "dark",
  [id("demiurge")]: "ice",
  [id("fluder")]: "ice",
  "minecraft:blaze": "ice",
  "minecraft:stray": "fire",
};

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {{ name: string, look: number, gear: number, hired: boolean, level: number, out: boolean, xp: number, bond: number, tactic: number, traits: string[], gift: number }} Member */

// ------------------------------------------------------------------- roster

/**
 * The player's party, cleaned of anything malformed.
 * @param {Player} player
 * @returns {Member[]}
 */
export function partyOf(player) {
  const p = profileOf(player);
  // Members are cleaned in place, so a member someone is already holding stays the one in the party.
  p.party = p.party.filter((m) => m && typeof m.name === "string" && typeof m.look === "number").slice(0, MAX_PARTY);
  for (const m of p.party) {
    m.name = String(m.name).slice(0, 16) || "Retainer";
    m.look = Math.min(LOOKS.length - 1, Math.max(0, Math.floor(m.look)));
    m.gear = Math.min(MAX_GEAR, Math.max(0, Math.floor(Number(m.gear) || 0)));
    m.hired = Boolean(m.hired);
    m.level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(m.level) || 1)));
    m.out = Boolean(m.out);
    m.xp = Math.max(0, Math.floor(Number(m.xp) || 0));
    m.bond = Math.min(MAX_BOND, Math.max(0, Math.floor(Number(m.bond) || 0)));
    m.tactic = Math.min(TACTICS.length - 1, Math.max(0, Math.floor(Number(m.tactic) || 0)));
    m.traits = [...new Set(Array.isArray(m.traits) ? m.traits : [])].filter((key) => TRAITS.some((t) => t.key === key)).slice(0, 2);
    m.gift = Number.isFinite(Number(m.gift)) ? Math.floor(Number(m.gift)) : -1;
  }
  if (!STANCES.includes(/** @type {any} */ (p.stance))) p.stance = "come";
  return p.party;
}

/** @param {Player} player @param {Member} member */
export function levelOf(player, member) {
  return member.hired ? member.level : profileOf(player).level;
}

/** Bond rank 0-4 of a member. @param {Member} member */
export function bondRank(member) {
  return Math.min(BOND_RANKS.length - 1, Math.floor(member.bond / 25));
}

/** How many traits a member of this level can hold. @param {number} level */
export function traitSlots(level) {
  return level >= 30 ? 2 : level >= 10 ? 1 : 0;
}

/**
 * Whether a member has a trait and is of a level to use it.
 * @param {Player} player @param {Member} member @param {string} key
 */
export function hasTrait(player, member, key) {
  return member.traits.slice(0, traitSlots(levelOf(player, member))).includes(key);
}

/** Seconds a member needs to return after falling: ten fewer for every bond rank, halved for the Resolute. */
/** @param {Member} member */
export function recoveryOf(member) {
  return Math.ceil((RECOVERY - 10 * bondRank(member)) * (member.traits.includes("resolute") ? 0.5 : 1));
}

/**
 * The formation the members now at the player's side make up.
 * Three different vocations recharge skills a fifth faster; members who share a vocation strike 15% harder.
 * @param {Player} player
 */
export function formationOf(player) {
  const active = partyOf(player).filter((m, i) => m.out && recovering(player, i) === 0);
  const vocations = active.map((m) => Math.floor(m.look / 2));
  const balanced = active.length >= 3 && new Set(vocations).size === active.length;
  const doubled = new Set(vocations.filter((v, i) => vocations.indexOf(v) !== i));
  const name = balanced ? "Balanced formation" : doubled.size > 0 ? `${VOCATIONS[[...doubled][0]]} specialists` : "";
  return { name, balanced, doubled };
}

/** @param {Player} player @param {number} index */
function tagOf(player, index) {
  return `ovr_${player.id}_${index}`;
}

/** `${playerId}|${index}` -> tick at which a fallen retainer may return. */
const fallen = new Map();

/** Seconds until a fallen retainer returns (0 when ready). @param {Player} player @param {number} index */
export function recovering(player, index) {
  return Math.max(0, Math.ceil(((fallen.get(`${player.id}|${index}`) ?? 0) - system.currentTick) / TICKS));
}

/**
 * Creates (or re-styles) the player's own retainer in the first party slot.
 * @param {Player} player @param {string} name @param {number} look
 */
export function createMain(player, name, look) {
  const party = partyOf(player);
  const clean = name.trim().slice(0, 16) || "Retainer";
  const existing = party.find((m) => !m.hired);
  if (existing) {
    existing.name = clean;
    existing.look = look;
    refresh(player, party.indexOf(existing));
  } else {
    if (party.length >= MAX_PARTY) return false;
    party.unshift({ name: clean, look, gear: 0, hired: false, level: 1, out: true, xp: 0, bond: 0, tactic: 0, traits: [], gift: -1 });
    retag(player);
  }
  touch(player);
  return true;
}

/**
 * Three mercenaries looking for work near the player's level.
 * @param {Player} player @param {() => number} [random]
 */
export function candidates(player, random = Math.random) {
  const level = profileOf(player).level;
  const discount = standingOf(profileOf(player), "adventurers") >= 30 ? 0.75 : 1; // friends of the guild pay less
  const list = [];
  for (let i = 0; i < 3; i++) {
    const hireLevel = Math.max(1, level + Math.floor(random() * 5) - 2);
    list.push({
      name: NAMES[Math.floor(random() * NAMES.length)],
      look: Math.floor(random() * LOOKS.length),
      level: hireLevel,
      cost: Math.round((10 + hireLevel * 2) * discount),
    });
  }
  return list;
}

/**
 * Hires a mercenary. Returns a message describing the outcome.
 * @param {Player} player @param {{ name: string, look: number, level: number, cost: number }} who
 */
export function hire(player, who) {
  const party = partyOf(player);
  if (party.length >= MAX_PARTY) return `§7Your party is full (${MAX_PARTY})`;
  if (countItem(player, COIN) < who.cost) return `§7${who.name} asks for ${who.cost} Gold Coins`;
  takeItem(player, COIN, who.cost);
  party.push({ name: who.name, look: who.look, gear: 0, hired: true, level: who.level, out: true, xp: 0, bond: 0, tactic: 0, traits: [], gift: -1 });
  touch(player);
  return `§a${who.name} the ${LOOKS[who.look]} joins your party`;
}

/**
 * Removes a member from the party for good.
 * @param {Player} player @param {number} index
 */
export function release(player, index) {
  const party = partyOf(player);
  if (!party[index]) return;
  for (let i = 0; i < MAX_PARTY; i++) removeEntities(player, i);
  party.splice(index, 1);
  touch(player);
}

/**
 * Improves a member's gear by one rank for Gold Coins.
 * @param {Player} player @param {number} index
 */
export function upgrade(player, index) {
  const member = partyOf(player)[index];
  if (!member) return "§7No such party member";
  if (member.gear >= MAX_GEAR) return `§7${member.name}'s gear is already the best there is`;
  const cost = gearCost(member.gear);
  if (countItem(player, COIN) < cost) return `§7Better gear costs ${cost} Gold Coins`;
  takeItem(player, COIN, cost);
  member.gear += 1;
  touch(player);
  refresh(player, index);
  return `§a${member.name}'s gear is now rank ${member.gear}`;
}

/** @param {number} gear */
export function gearCost(gear) {
  return 20 * (gear + 1);
}

/**
 * Changes how a member chooses its foes.
 * @param {Player} player @param {number} index @param {number} tactic
 */
export function setTactic(player, index, tactic) {
  const member = partyOf(player)[index];
  if (!member || !TACTICS[tactic]) return "§7No such party member";
  member.tactic = tactic;
  touch(player);
  return `§e${member.name}§f: ${TACTICS[tactic]} - ${TACTIC_HELP[tactic]}`;
}

/**
 * Gives a member a trait, or takes it away again if it already has it.
 * @param {Player} player @param {number} index @param {string} key
 */
export function toggleTrait(player, index, key) {
  const member = partyOf(player)[index];
  const trait = TRAITS.find((t) => t.key === key);
  if (!member || !trait) return "§7No such trait";
  if (member.traits.includes(key)) {
    member.traits = member.traits.filter((k) => k !== key);
    touch(player);
    return `§7${member.name} is no longer ${trait.name}`;
  }
  const slots = traitSlots(levelOf(player, member));
  if (slots === 0) return `§7${member.name} can take a trait from level 10`;
  if (member.traits.length >= slots) return slots < 2 ? `§7${member.name} can take a second trait from level 30` : `§7${member.name} already has two traits - remove one first`;
  member.traits.push(key);
  touch(player);
  return `§a${member.name} is now ${trait.name}: ${trait.help}`;
}

/**
 * Raises the bond with a member, announcing new ranks and the gift of a sworn companion.
 * @param {Player} player @param {Member} member @param {number} amount
 */
function addBond(player, member, amount) {
  if (member.bond >= MAX_BOND) return;
  const before = bondRank(member);
  member.bond = Math.min(MAX_BOND, member.bond + amount);
  const after = bondRank(member);
  if (after <= before) return;
  player.sendMessage(`§6[Party] §fYour bond with §b${member.name}§f deepens: §e${BOND_RANKS[after]}§f (skills +${Math.round(after * BOND_POWER * 100)}%, returns after ${recoveryOf(member)} s).`);
  if (member.bond >= MAX_BOND) {
    // A sworn companion marks the day with a gift of their own.
    giveItem(player, id("data_crystal"), 5);
    player.sendMessage(`§b<${member.name}>§f I have kept these for you, Master. We have come a long way together.`);
  }
}

/**
 * Gives a member a small gift once a day, which deepens the bond.
 * @param {Player} player @param {number} index
 */
export function gift(player, index) {
  const member = partyOf(player)[index];
  if (!member) return "§7No such party member";
  if (member.bond >= MAX_BOND) return `§7${member.name} is already sworn to you`;
  const day = world.getDay();
  if (member.gift === day) return `§7${member.name} has already had a gift today`;
  if (countItem(player, COIN) < GIFT_COST) return `§7A gift costs ${GIFT_COST} Gold Coins`;
  takeItem(player, COIN, GIFT_COST);
  member.gift = day;
  addBond(player, member, GIFT_BOND);
  touch(player);
  return `§a${member.name} is touched by your gift (bond ${member.bond}/${MAX_BOND})`;
}

/**
 * Brings a fallen member back at once for Gold Coins.
 * @param {Player} player @param {number} index
 */
export function revive(player, index) {
  const member = partyOf(player)[index];
  if (!member) return "§7No such party member";
  if (recovering(player, index) === 0) return `§7${member.name} does not need reviving`;
  if (countItem(player, COIN) < REVIVE_COST) return `§7Reviving ${member.name} costs ${REVIVE_COST} Gold Coins`;
  takeItem(player, COIN, REVIVE_COST);
  fallen.delete(`${player.id}|${index}`);
  member.out = true;
  touch(player);
  tend(player);
  return `§a${member.name} is back on their feet`;
}

/**
 * @param {Player} player
 * @param {"come" | "go" | "stay"} stance
 */
export function setStance(player, stance) {
  profileOf(player).stance = stance;
  touch(player);
  for (let i = 0; i < MAX_PARTY; i++) {
    for (const entity of entitiesOf(player, i)) {
      try {
        entity.triggerEvent(`${NS}:stance_${stance}`);
      } catch {
        // entity is unloading
      }
    }
  }
  notify(player, `§eParty: §f${STANCE_HELP[stance]}`);
}

/** Switches to the next stance (sneak + use the Command Banner). @param {Player} player */
export function cycleStance(player) {
  partyOf(player);
  const current = STANCES.indexOf(/** @type {any} */ (profileOf(player).stance));
  setStance(player, STANCES[(current + 1) % STANCES.length]);
}

// ----------------------------------------------------------------- entities

/** @param {Player} player @param {number} index @returns {Entity[]} */
function entitiesOf(player, index) {
  try {
    return player.dimension.getEntities({ type: RETAINER, tags: [tagOf(player, index)] });
  } catch {
    return [];
  }
}

/** @param {Player} player @param {number} index */
function removeEntities(player, index) {
  for (const entity of entitiesOf(player, index)) {
    try {
      entity.remove();
    } catch {
      // already gone
    }
  }
}

/** After the roster order changes, entities are respawned so their slot tags match. @param {Player} player */
function retag(player) {
  for (let i = 0; i < MAX_PARTY; i++) removeEntities(player, i);
}

/** @param {Entity} entity @param {number} level @param {number} gear @param {boolean} [sturdy] */
function applyStats(entity, level, gear, sturdy = false) {
  const signature = `${level}|${gear}|${sturdy ? 1 : 0}`;
  if (entity.getDynamicProperty("overlord:sig") === signature) return;
  entity.setDynamicProperty("overlord:sig", signature);
  const hearts = Math.floor(level / 8) + gear * 2 + (sturdy ? 2 : 0); // each tier is two hearts
  const might = Math.floor(level / 30) + Math.floor(gear / 2);
  for (const effect of ["health_boost", "strength"]) {
    try {
      entity.removeEffect(effect);
    } catch {
      // not present
    }
  }
  if (hearts > 0) entity.addEffect("health_boost", LONG, { amplifier: hearts - 1, showParticles: false });
  if (might > 0) entity.addEffect("strength", LONG, { amplifier: might - 1, showParticles: false });
  const health = entity.getComponent("minecraft:health");
  if (health) health.setCurrentValue(health.effectiveMax);
}

/**
 * Brings a party member into the world next to the player.
 * @param {Player} player @param {number} index
 */
function spawn(player, index) {
  const member = partyOf(player)[index];
  const stance = profileOf(player).stance;
  const angle = (index / MAX_PARTY) * Math.PI * 2;
  const entity = player.dimension.spawnEntity(RETAINER, {
    x: player.location.x + Math.cos(angle) * 1.5,
    y: player.location.y,
    z: player.location.z + Math.sin(angle) * 1.5,
  });
  entity.addTag("overlord_retainer");
  entity.addTag("overlord_summoned");
  entity.addTag(tagOf(player, index));
  entity.setDynamicProperty("overlord:owner", player.id);
  entity.setDynamicProperty("overlord:slot", index);
  entity.nameTag = label(player, member);
  fx.circle(player.dimension, entity.location, "holy", 1.0);
  // Look, stance and ownership are applied once the entity has finished spawning.
  system.runTimeout(() => {
    try {
      if (!entity.isValid || !player.isValid) return;
      entity.triggerEvent(`${NS}:look_${member.look}`);
      entity.triggerEvent(`${NS}:stance_${stance}`);
      entity.getComponent("minecraft:tameable")?.tame(player);
      applyStats(entity, levelOf(player, member), member.gear, hasTrait(player, member, "sturdy"));
    } catch (error) {
      console.warn(`[Overlord] could not ready a retainer: ${error}`);
    }
  }, 2);
  return entity;
}

/** @param {Player} player @param {Member} member */
function label(player, member) {
  return `${member.name} §7Lv.${levelOf(player, member)} ${VOCATIONS[Math.floor(member.look / 2)]}`;
}

/** Re-creates a member's entity after its look or gear changed. @param {Player} player @param {number} index */
function refresh(player, index) {
  removeEntities(player, index);
}

/**
 * Calls a member to the player's side (or all of them when no index is given).
 * @param {Player} player @param {number} [index]
 */
export function summon(player, index) {
  const party = partyOf(player);
  party.forEach((member, i) => {
    if (index === undefined || index === i) member.out = true;
  });
  touch(player);
  tend(player);
}

/**
 * Sends a member away (or all of them when no index is given).
 * @param {Player} player @param {number} [index]
 */
export function dismiss(player, index) {
  const party = partyOf(player);
  party.forEach((member, i) => {
    if (index !== undefined && index !== i) return;
    member.out = false;
    removeEntities(player, i);
  });
  touch(player);
}

// ------------------------------------------------------------------ chatter

/** Tick before which a player's retainers stay quiet. */
const quietUntil = new Map();
/** Foe types a player's retainers have already commented on this session. */
const remarked = new Map();

/**
 * @param {Player} player @param {Member} member @param {string} text @param {number} [pause] seconds of quiet afterwards
 * @param {boolean} [urgent] said even if someone has just spoken
 */
function say(player, member, text, pause = 15, urgent = false) {
  if (!urgent && system.currentTick < (quietUntil.get(player.id) ?? 0)) return false;
  quietUntil.set(player.id, system.currentTick + pause * TICKS);
  try {
    player.sendMessage(`§b<${member.name}>§f ${text}`);
  } catch {
    // player left
  }
  return true;
}

/** The mob each player last struck, with the tick it happened. */
/** @type {Map<string, { entity: Entity, tick: number }>} */
const targets = new Map();
/** The mob that last hurt each player. */
/** @type {Map<string, { entity: Entity, tick: number }>} */
const threats = new Map();
const FRESH = 10 * TICKS; // how long a target or threat stays current

/** The foe each player has ordered the whole party to strike (Unison). */
/** @type {Map<string, { entity: Entity, tick: number }>} */
const orders = new Map();

/** Whether the player has fought within the last ten seconds. @param {Player} player */
function inCombat(player) {
  const now = system.currentTick;
  return now - (targets.get(player.id)?.tick ?? -1e9) <= FRESH || now - (threats.get(player.id)?.tick ?? -1e9) <= FRESH;
}

/**
 * The foe a member turns its skills on, according to its tactic.
 * @param {Player} player @param {Entity} entity @param {Member} member
 * @returns {Entity | undefined}
 */
function pickFoe(player, entity, member) {
  const current = (/** @type {{ entity: Entity, tick: number } | undefined} */ mark) =>
    mark && system.currentTick - mark.tick <= FRESH && mark.entity.isValid ? mark.entity : undefined;
  const ordered = current(orders.get(player.id)); // a Unison order outranks every tactic
  if (ordered) return ordered;
  if (member.tactic === 2) {
    try {
      const near = player.dimension.getEntities({ location: entity.location, maxDistance: 12, families: ["monster"], closest: 1 });
      if (near[0]) return near[0];
    } catch {
      // unloaded chunk
    }
  }
  if (member.tactic === 1) return current(threats.get(player.id)) ?? current(targets.get(player.id));
  return current(targets.get(player.id));
}

/**
 * Monsters around a point, for skills that strike several foes.
 * @param {Player} player @param {import("@minecraft/server").Vector3} at @param {number} radius
 * @returns {Entity[]}
 */
function monstersNear(player, at, radius) {
  try {
    return player.dimension.getEntities({ location: at, maxDistance: radius, families: ["monster"] });
  } catch {
    return [];
  }
}

world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    if (attacker && attacker.isValid && victim.typeId === "minecraft:player" && attacker.typeId !== "minecraft:player" && attacker.typeId !== RETAINER) {
      threats.set(victim.id, { entity: attacker, tick: system.currentTick }); // Guardians answer this
      return;
    }
    if (!attacker || attacker.typeId !== "minecraft:player" || !victim.isValid) return;
    if (victim.typeId === "minecraft:player" || victim.typeId === RETAINER) return;
    const player = /** @type {Player} */ (attacker);
    targets.set(player.id, { entity: victim, tick: system.currentTick });
    if (isElite(victim) && !victim.hasTag("overlord_called")) {
      victim.addTag("overlord_called");
      const awake = partyOf(player).filter((m, i) => m.out && recovering(player, i) === 0);
      if (awake.length > 0) say(player, awake[Math.floor(Math.random() * awake.length)], "That one is no common beast, Master - an elite. Strike together!");
    }
    // The first time the master strikes a kind of foe, a retainer shares what it knows.
    const tip = TIPS[victim.typeId];
    const active = partyOf(player).filter((m, i) => m.out && recovering(player, i) === 0);
    if (!tip || active.length === 0) return;
    const seen = remarked.get(player.id) ?? new Set();
    remarked.set(player.id, seen);
    if (seen.has(victim.typeId)) return;
    if (say(player, active[Math.floor(Math.random() * active.length)], tip, 15, true)) seen.add(victim.typeId);
  } catch {
    // someone vanished mid-hit
  }
});

// ------------------------------------------------------------------- skills

/** Entity id -> tick at which its vocation skill is ready again. */
const skillReady = new Map();
/** Entity id -> tick at which its second skill (from level 20) is ready again. */
const secondReady = new Map();

/** @param {Entity} entity @param {number} y */
function above(entity, y) {
  return { x: entity.location.x, y: entity.location.y + y, z: entity.location.z };
}

/**
 * The ally a healer should mend: whoever of the master and the rest of the party has lost
 * the largest share of their health, if that is at least two fifths.
 * @param {Player} player @param {Entity} healer
 */
function mostWounded(player, healer) {
  /** @type {Entity[]} */
  const allies = [player];
  for (let i = 0; i < MAX_PARTY; i++) allies.push(...entitiesOf(player, i));
  /** @type {{ entity: Entity, health: import("@minecraft/server").EntityHealthComponent, share: number } | undefined} */
  let worst;
  for (const ally of allies) {
    try {
      if (ally.id === healer.id || !ally.isValid) continue;
      if (Math.hypot(ally.location.x - healer.location.x, ally.location.z - healer.location.z) > 12) continue;
      const health = ally.getComponent("minecraft:health");
      if (!health || health.currentValue <= 0) continue;
      const share = health.currentValue / health.effectiveMax;
      if (share < 0.6 && (!worst || share < worst.share)) worst = { entity: ally, health, share };
    } catch {
      // that ally is unloading
    }
  }
  return worst;
}

/**
 * Vocation skills of one retainer.
 * @param {Player} player @param {Entity} entity @param {Member} member
 */
function useSkill(player, entity, member) {
  const now = system.currentTick;
  const vocation = Math.floor(member.look / 2);
  const level = levelOf(player, member);
  const formation = formationOf(player);
  // A strong bond and fighting beside one's own kind make every skill hit harder.
  const unison = now - (orders.get(player.id)?.tick ?? -1e9) <= FRESH;
  const power =
    (1 + BOND_POWER * bondRank(member)) *
    (formation.doubled.has(vocation) ? 1.15 : 1) *
    (hasTrait(player, member, "keen") ? 1.15 : 1) *
    (unison ? UNISON_POWER : 1);
  const haste = (formation.balanced ? 0.8 : 1) * (hasTrait(player, member, "swift") ? 0.85 : 1);
  const firstReady = now >= (skillReady.get(entity.id) ?? 0);
  const secondOpen = level >= SECOND_SKILL_LEVEL && now >= (secondReady.get(entity.id) ?? 0);
  const rest = (/** @type {number} */ seconds) => skillReady.set(entity.id, now + Math.round(seconds * haste * TICKS));
  const restSecond = (/** @type {number} */ seconds) => secondReady.set(entity.id, now + Math.round(seconds * haste * TICKS));
  const hand = above(entity, 1.3);
  const reach = (/** @type {Entity} */ other) =>
    Math.hypot(other.location.x - entity.location.x, other.location.z - entity.location.z);
  const masterHealth = player.getComponent("minecraft:health");
  const masterShare = masterHealth && masterHealth.currentValue > 0 ? masterHealth.currentValue / masterHealth.effectiveMax : 1;

  if (vocation === 3) {
    // Healer. Sanctuary: a great heal when the master is close to death.
    if (secondOpen && masterHealth && masterShare < 0.3 && reach(player) <= 12) {
      masterHealth.setCurrentValue(Math.min(masterHealth.effectiveMax, masterHealth.currentValue + (10 + level * 0.2) * power));
      player.addEffect("regeneration", 5 * TICKS, { amplifier: 1 });
      fx.dome(player.dimension, player.location, "holy");
      restSecond(45);
      rest(6);
      say(player, member, "Sanctuary! You will not fall here, Master.", 30);
      return;
    }
    // Mend whoever needs it most: the master or another member of the party.
    if (!firstReady) return;
    const patient = mostWounded(player, entity);
    if (!patient) return;
    patient.health.setCurrentValue(Math.min(patient.health.effectiveMax, patient.health.currentValue + (4 + level * 0.1) * power));
    fx.beam(player.dimension, hand, above(patient.entity, 1), "holy");
    fx.rise(player.dimension, patient.entity.location, "holy", 0.7);
    rest(6);
    if (patient.entity.id === player.id) say(player, member, "Hold on, Master - I have you.", 30);
    return;
  }

  // Fighter. Rallying Cry: stands between the master and harm when things turn bad.
  if (vocation === 0 && secondOpen && masterShare < 0.5 && reach(player) <= 12) {
    player.addEffect("resistance", 6 * TICKS, { amplifier: 0 });
    fx.ring(player.dimension, entity.location, "holy", 3);
    restSecond(30);
    say(player, member, "Behind me, Master!", 30);
  }

  // Bard. Ballad of Valour: a song that puts heart into the master while the fight lasts.
  if (vocation === 5 && firstReady && inCombat(player) && reach(player) <= 16) {
    player.addEffect("strength", Math.round(8 * power * TICKS), { amplifier: 0 });
    player.addEffect("speed", Math.round(8 * power * TICKS), { amplifier: 0 });
    fx.ring(player.dimension, player.location, "holy", 2.5);
    fx.rise(player.dimension, entity.location, "holy", 0.6);
    rest(16);
  }

  if (profileOf(player).stance === "stay") return;
  const foe = pickFoe(player, entity, member);
  if (!foe) return;
  const at = above(foe, 1);
  const distance = reach(foe);

  // Second skills that strike several foes around the target.
  if (vocation === 1 && secondOpen && distance <= 22) {
    // Archer. Volley: up to three monsters around the target.
    const struck = [foe, ...monstersNear(player, foe.location, 5).filter((m) => m.id !== foe.id)].slice(0, 3);
    for (const mob of struck) {
      try {
        mob.applyDamage((3 + level * 0.2) * power, { cause: EntityDamageCause.entityAttack, damagingEntity: entity });
        fx.beam(player.dimension, hand, above(mob, 1), "none", 0.7);
      } catch {
        // already dead
      }
    }
    restSecond(16);
    return;
  }
  if (vocation === 2 && secondOpen && distance <= 18) {
    // Mage. Burst: everything within a few blocks of the target.
    const element = WEAK_TO[foe.typeId] ?? "arcane";
    const struck = [foe, ...monstersNear(player, foe.location, 3.5).filter((m) => m.id !== foe.id)];
    for (const mob of struck) {
      try {
        mob.applyDamage((4 + level * 0.25) * (WEAK_TO[mob.typeId] === element ? 1.5 : 1) * power, { cause: EntityDamageCause.magic, damagingEntity: entity });
      } catch {
        // already dead
      }
    }
    fx.circle(player.dimension, entity.location, element, 1.2);
    fx.ring(player.dimension, foe.location, element, 3.5);
    restSecond(18);
    return;
  }

  if (vocation === 5 && secondOpen && distance <= 18) {
    // Bard. Dirge: a mournful air that slows and weakens everything around the target.
    for (const mob of [foe, ...monstersNear(player, foe.location, 6).filter((m) => m.id !== foe.id)]) {
      try {
        mob.addEffect("slowness", Math.round(6 * power * TICKS), { amplifier: 1 });
        mob.addEffect("weakness", Math.round(6 * power * TICKS), { amplifier: 0 });
      } catch {
        // already dead
      }
    }
    fx.ring(player.dimension, foe.location, "dark", 6);
    restSecond(20);
    return;
  }

  if (!firstReady) return;
  if (vocation === 4 && distance <= 3.5) {
    // Rogue: backstab - a poisoned strike on a short recharge.
    foe.applyDamage((5 + level * 0.3) * power, { cause: EntityDamageCause.entityAttack, damagingEntity: entity });
    if (foe.isValid) foe.addEffect("poison", 4 * TICKS, { amplifier: 1 });
    fx.spark(player.dimension, at, "dark", 0.9);
    rest(6);
  } else if (vocation === 0 && distance <= 4) {
    // Fighter: shield bash - a heavy blow that staggers the target.
    foe.applyDamage((3 + level * 0.2) * power, { cause: EntityDamageCause.entityAttack, damagingEntity: entity });
    if (foe.isValid) {
      foe.addEffect("slowness", 2 * TICKS, { amplifier: 3 });
      const len = distance || 1;
      foe.applyKnockback({ x: ((foe.location.x - entity.location.x) / len) * 1.2, z: ((foe.location.z - entity.location.z) / len) * 1.2 }, 0.3);
    }
    fx.ring(player.dimension, foe.location, "none", 1.5);
    rest(8);
  } else if (vocation === 1 && distance <= 22) {
    // Archer: an aimed shot.
    foe.applyDamage((4 + level * 0.25) * power, { cause: EntityDamageCause.entityAttack, damagingEntity: entity });
    fx.beam(player.dimension, hand, at, "none", 0.7);
    fx.spark(player.dimension, at, "none", 0.8);
    rest(7);
  } else if (vocation === 2 && distance <= 18) {
    // Mage: a bolt of whatever element the foe likes least.
    const element = WEAK_TO[foe.typeId] ?? "arcane";
    const bonus = WEAK_TO[foe.typeId] ? 1.5 : 1;
    foe.applyDamage((5 + level * 0.3) * bonus * power, { cause: EntityDamageCause.magic, damagingEntity: entity });
    fx.circle(player.dimension, entity.location, element, 1.0);
    fx.beam(player.dimension, hand, at, element);
    fx.spark(player.dimension, at, element, 1.1);
    rest(8);
  }
}

// ------------------------------------------------------------------- growth

/**
 * A kill made by the player or the party: mercenaries earn XP, every member at the
 * player's side grows closer to them, and light-fingered members may turn up a coin.
 * @param {Player} player @param {Entity} dead @param {() => number} [random]
 */
export function shareKill(player, dead, random = Math.random) {
  const party = partyOf(player);
  if (party.length === 0) return;
  const xp = killXp(dead);
  const bond = isElite(dead) ? 3 : 1;
  let changed = false;
  let coins = 0;
  party.forEach((member, index) => {
    if (!member.out || recovering(player, index) > 0) return;
    changed = true;
    addBond(player, member, bond * (hasTrait(player, member, "devoted") ? 2 : 1));
    if (hasTrait(player, member, "scavenger") && random() < 0.1) coins += 1;
    if (Math.floor(member.look / 2) === 4 && levelOf(player, member) >= SECOND_SKILL_LEVEL && random() < 0.2) coins += 1; // Cutpurse
    if (member.hired && member.level < MAX_LEVEL) {
      member.xp += Math.round(xp * MERC_SHARE);
      const start = member.level;
      while (member.level < MAX_LEVEL && member.xp >= xpForNext(member.level)) {
        member.xp -= xpForNext(member.level);
        member.level += 1;
      }
      if (member.level >= MAX_LEVEL) member.xp = 0;
      if (member.level > start) player.sendMessage(`§6[Party] §b${member.name}§f has reached level §6${member.level}§f.`);
    }
  });
  if (coins > 0) {
    giveItem(player, COIN, coins);
    notify(player, `§6Your party turned up ${coins} Gold Coin${coins === 1 ? "" : "s"}`);
  }
  if (changed) touch(player);
}

// ------------------------------------------------------------------- unison

/** Player id -> tick at which Unison may be ordered again. */
const unisonReady = new Map();

/**
 * Unison: every member at the player's side turns on one foe at once, skills readied
 * and striking a quarter harder for ten seconds.
 * @param {Player} player @param {Entity} foe
 */
export function unison(player, foe) {
  const party = partyOf(player);
  const active = party.filter((m, i) => m.out && recovering(player, i) === 0);
  if (active.length === 0) return "§7Nobody is at your side to answer the order";
  const left = Math.ceil(((unisonReady.get(player.id) ?? 0) - system.currentTick) / TICKS);
  if (left > 0) return `§7Unison is ready again in ${left}s`;
  unisonReady.set(player.id, system.currentTick + UNISON_COOLDOWN * TICKS);
  orders.set(player.id, { entity: foe, tick: system.currentTick });
  targets.set(player.id, { entity: foe, tick: system.currentTick });
  party.forEach((member, index) => {
    if (!member.out || recovering(player, index) > 0) return;
    const entity = entitiesOf(player, index)[0];
    if (!entity) return;
    skillReady.delete(entity.id);
    secondReady.delete(entity.id);
    try {
      useSkill(player, entity, member);
    } catch {
      // that member is unloading
    }
  });
  fx.ring(player.dimension, player.location, "holy", 4);
  try {
    player.playSound("horn.call.0", { volume: 1, pitch: 1.3 });
  } catch {
    // cosmetic only
  }
  say(player, active[Math.floor(Math.random() * active.length)], "As one! Strike now!", 10, true);
  return "§eUnison! §fThe party strikes as one";
}

/**
 * Using the Command Banner while looking at a foe orders Unison against it.
 * Returns false when there is no foe in view, so the banner can open the party menu instead.
 * @param {Player} player
 */
export function orderUnison(player) {
  let foe;
  try {
    foe = player
      .getEntitiesFromViewDirection({ maxDistance: 24 })
      .map((hit) => hit.entity)
      .find((entity) => entity.typeId !== "minecraft:player" && entity.typeId !== RETAINER && entity.getComponent("minecraft:health") !== undefined);
  } catch {
    return false;
  }
  if (!foe || !partyOf(player).some((m) => m.out)) return false;
  notify(player, unison(player, foe));
  return true;
}

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    if (dead.typeId === "minecraft:player" || dead.typeId === RETAINER) return;
    const player = creditedPlayer(event.damageSource.damagingEntity);
    if (player) shareKill(player, dead);
  } catch {
    // killer or victim vanished between the kill and this callback
  }
});

// --------------------------------------------------------------- upkeep loop

/**
 * Keeps a player's summoned retainers present, up to date and using their skills.
 * @param {Player} player
 */
export function tend(player) {
  const party = partyOf(player);
  const health = player.getComponent("minecraft:health");
  if (!health || health.currentValue <= 0) return; // nothing is called to a dead master
  party.forEach((member, index) => {
    if (!member.out || recovering(player, index) > 0) return;
    const found = entitiesOf(player, index);
    for (const extra of found.slice(1)) {
      try {
        extra.remove(); // a copy left behind in another place has caught up with us
      } catch {
        // already gone
      }
    }
    const entity = found[0] ?? spawn(player, index);
    if (found[0]) {
      try {
        applyStats(entity, levelOf(player, member), member.gear, hasTrait(player, member, "sturdy"));
        const name = label(player, member);
        if (entity.nameTag !== name) entity.nameTag = name;
        lookAfter(player, entity, member);
        useSkill(player, entity, member);
      } catch {
        // entity is unloading
      }
    }
  });
  scout(player);
  nightfall(player);
  if (party.some((m) => m.out) && health.currentValue < health.effectiveMax * 0.3) {
    const awake = party.filter((m, i) => m.out && recovering(player, i) === 0);
    if (awake.length > 0) say(player, awake[0], "Master, you are badly hurt - fall back!", 40);
  }
}

/** Entity id -> tick at which it may drink another of the master's potions. */
const potionReady = new Map();

/**
 * Self-preservation: a member rests between fights, drinks one of the master's potions when
 * badly hurt, and - unless it is a Fighter, who holds the line - falls back from monsters
 * until it has recovered.
 * @param {Player} player @param {Entity} entity @param {Member} member
 */
function lookAfter(player, entity, member) {
  const own = entity.getComponent("minecraft:health");
  if (!own || own.currentValue <= 0) return;
  if (!inCombat(player) && own.currentValue < own.effectiveMax) {
    own.setCurrentValue(Math.min(own.effectiveMax, own.currentValue + 2 + own.effectiveMax * 0.05));
  }
  let share = own.currentValue / own.effectiveMax;
  if (share < 0.3 && profileOf(player).supply && system.currentTick >= (potionReady.get(entity.id) ?? 0) && countItem(player, POTION) > 0) {
    takeItem(player, POTION, 1);
    own.setCurrentValue(Math.min(own.effectiveMax, own.currentValue + POTION_HEAL));
    potionReady.set(entity.id, system.currentTick + 20 * TICKS);
    fx.rise(player.dimension, entity.location, "holy", 0.6);
    say(player, member, "I took one of your potions, Master. Thank you.", 20);
    share = own.currentValue / own.effectiveMax;
  }
  const back = entity.getDynamicProperty("overlord:back") === true;
  if (!back && share < 0.3 && Math.floor(member.look / 2) !== 0) {
    entity.setDynamicProperty("overlord:back", true);
    entity.triggerEvent(`${NS}:fall_back`);
    say(player, member, "I am hurt - falling back!", 20);
  } else if (back && share >= 0.6) {
    entity.setDynamicProperty("overlord:back", false);
    entity.triggerEvent(`${NS}:rally_${VOC_KEYS[Math.floor(member.look / 2)]}`); // back to the vocation's own way of fighting
  }
}

/** Player id -> tick of the next scouting report. */
const scoutAt = new Map();

/**
 * An archer at the player's side reports the nearest undiscovered site every few minutes.
 * @param {Player} player
 */
function scout(player) {
  const now = system.currentTick;
  const due = scoutAt.get(player.id);
  if (due === undefined) {
    scoutAt.set(player.id, now + SCOUT_FIRST * TICKS);
    return;
  }
  if (now < due || inCombat(player)) return;
  const archer = partyOf(player).find((m, i) => m.out && Math.floor(m.look / 2) === 1 && recovering(player, i) === 0);
  if (!archer) return;
  const word = rumour(player);
  if (!word) {
    scoutAt.set(player.id, now + SCOUT_EVERY * TICKS);
    return;
  }
  if (say(player, archer, `I scouted ahead, Master. ${word.replace("Word is there's", "There is")}`)) scoutAt.set(player.id, now + SCOUT_EVERY * TICKS);
}

/** Player id -> the in-game day whose nightfall the party has already remarked on. */
const nightSeen = new Map();

/** Once each evening a member warns that night is coming. @param {Player} player */
function nightfall(player) {
  const time = world.getTimeOfDay();
  const day = world.getDay();
  if (time < 12500 || time > 14000 || nightSeen.get(player.id) === day) return;
  const awake = partyOf(player).filter((m, i) => m.out && recovering(player, i) === 0);
  if (awake.length === 0 || player.dimension.id !== "minecraft:overworld") return;
  if (say(player, awake[Math.floor(Math.random() * awake.length)], "Night is falling, Master. The undead will be abroad - stay close.")) nightSeen.set(player.id, day);
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      tend(player);
    } catch (error) {
      console.warn(`[Overlord] party upkeep failed: ${error}`);
    }
  }
}, 2 * TICKS);

/**
 * One line with the health of every member at the player's side.
 * @param {Player} player
 */
export function partyBar(player) {
  /** @type {string[]} */
  const parts = [];
  const hp = (/** @type {Entity} */ entity) => {
    const health = entity.getComponent("minecraft:health");
    if (!health) return "";
    const share = health.currentValue / health.effectiveMax;
    return `${share < 0.3 ? "§c" : share < 0.6 ? "§e" : "§a"}${Math.ceil(health.currentValue)}/${Math.ceil(health.effectiveMax)}`;
  };
  partyOf(player).forEach((member, index) => {
    if (!member.out) return;
    const wait = recovering(player, index);
    const entity = entitiesOf(player, index)[0];
    if (wait > 0) parts.push(`§7${member.name} down ${wait}s`);
    else if (entity) parts.push(`§f${member.name} ${hp(entity)}`);
  });
  return parts.join(" §7| ");
}

// Holding the Command Banner shows the party's health above the hotbar.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      const held = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
      if (held?.typeId !== id("command_banner")) continue;
      const bar = partyBar(player);
      if (bar) notify(player, bar);
    } catch {
      // player is leaving
    }
  }
}, TICKS);

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    if (dead.typeId !== RETAINER) return;
    const owner = creditedPlayer(dead);
    const slot = dead.getDynamicProperty("overlord:slot");
    if (!owner || typeof slot !== "number") return;
    const member = partyOf(owner)[slot];
    if (!member) return;
    // A Healer still on their feet tends the fallen, halving the wait.
    const tended = partyOf(owner).some((m, i) => i !== slot && m.out && Math.floor(m.look / 2) === 3 && recovering(owner, i) === 0);
    const wait = Math.ceil(recoveryOf(member) / (tended ? 2 : 1));
    fallen.set(`${owner.id}|${slot}`, system.currentTick + wait * TICKS);
    owner.sendMessage(`§6[Party] §c${member.name} has fallen§f and will return in ${wait} seconds. You can revive them at once from the party menu for ${REVIVE_COST} Gold Coins.`);
  } catch {
    // owner is offline
  }
});

world.afterEvents.playerDimensionChange.subscribe((event) => {
  // Retainers do not cross dimensions on their own: the old ones are sent away and new ones appear.
  for (let i = 0; i < MAX_PARTY; i++) {
    try {
      for (const entity of event.fromDimension.getEntities({ type: RETAINER, tags: [tagOf(event.player, i)] })) entity.remove();
    } catch {
      // the old dimension has already unloaded; leftovers are removed when next seen
    }
  }
});

world.afterEvents.playerLeave.subscribe((event) => {
  quietUntil.delete(event.playerId);
  remarked.delete(event.playerId);
  targets.delete(event.playerId);
  threats.delete(event.playerId);
  scoutAt.delete(event.playerId);
  nightSeen.delete(event.playerId);
  orders.delete(event.playerId);
  unisonReady.delete(event.playerId);
});

// -------------------------------------------------------------------- menus

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
        console.warn(`[Overlord] party menu action failed: ${error}`);
      }
    })
    .catch((error) => console.warn(`[Overlord] party menu failed: ${error}`));
}

/** @param {Player} player @param {Member} member @param {number} index */
function describe(player, member, index) {
  const wait = recovering(player, index);
  const state = wait > 0 ? `§crecovering ${wait}s` : member.out ? "§awith you" : "§7dismissed";
  return `${member.name} - ${LOOKS[member.look]} (${VOCATIONS[Math.floor(member.look / 2)]}) Lv.${levelOf(player, member)}, gear ${member.gear}/${MAX_GEAR}${member.hired ? ", mercenary" : ""}, ${BOND_RANKS[bondRank(member)]}, ${TACTICS[member.tactic]} - ${state}§r`;
}

/**
 * Opens the party menu (Adventurer's Plate entry or the Command Banner).
 * @param {Player} player
 */
export function openParty(player) {
  const party = partyOf(player);
  const p = profileOf(player);
  const hasMain = party.some((m) => !m.hired);
  const form = new ActionFormData()
    .title("Party")
    .body(
      (party.length > 0 ? party.map((m, i) => `${i + 1}. ${describe(player, m, i)}`).join("\n") : "You travel alone.") +
        `\n\nStance: §e${STANCE_HELP[/** @type {"come"} */ (p.stance)]}§r` +
        (formationOf(player).name ? `\nFormation: §e${formationOf(player).name}§r` : "") +
        `\nYour retainer levels with you; mercenaries earn half of your kill XP. Fighting together builds a bond that strengthens skills and shortens recovery. ` +
        `Three different vocations recharge skills a fifth faster; two of the same strike 15% harder. A Healer halves the time a fallen member is away, and an Archer scouts for camps. Hold the Command Banner to see everyone's health; use it on a foe to order Unison - everyone strikes that foe at once (${UNISON_COOLDOWN} s).`
    );
  /** @type {(() => void)[]} */
  const actions = [];
  const add = (/** @type {string} */ text, /** @type {() => void} */ action) => {
    form.button(text);
    actions.push(action);
  };
  if (!hasMain) add("Create your retainer", () => openCreate(player));
  party.forEach((m, i) => add(`Manage ${m.name}`, () => openMember(player, i)));
  if (party.length > 0) {
    add("Call everyone", () => summon(player));
    add("Dismiss everyone", () => dismiss(player));
    for (const stance of STANCES) add(`Stance: ${STANCE_HELP[stance]}`, () => setStance(player, stance));
  }
  if (party.length > 0) {
    add(`Share potions: ${p.supply ? "on" : "off"}\nBadly hurt members drink your Minor Healing Potions`, () => {
      p.supply = !p.supply;
      touch(player);
      notify(player, p.supply ? "§aYour party may drink your healing potions" : "§7Your party will leave your potions alone");
    });
  }
  if (party.length < MAX_PARTY) add("Hire a mercenary", () => openHire(player));
  show(form, player, (choice) => actions[choice]?.());
}

/** @param {Player} player */
function openCreate(player) {
  const existing = partyOf(player).find((m) => !m.hired);
  const form = new ModalFormData()
    .title(existing ? "Restyle your retainer" : "Create your retainer")
    .textField("Name", "up to 16 letters", { defaultValue: existing?.name ?? "" })
    .dropdown("Look and vocation", LOOKS.map((look, n) => `${look} (${VOCATIONS[Math.floor(n / 2)]})`), {
      defaultValueIndex: existing?.look ?? 0,
    });
  form
    .show(player)
    .then((response) => {
      if (response.canceled || !response.formValues || !player.isValid) return;
      const [name, look] = response.formValues;
      if (createMain(player, String(name ?? ""), Number(look ?? 0))) {
        summon(player);
        notify(player, "§aYour retainer answers the call");
      } else notify(player, `§7Your party is full (${MAX_PARTY})`);
    })
    .catch((error) => console.warn(`[Overlord] retainer form failed: ${error}`));
}

/** @param {Player} player @param {number} index */
function openMember(player, index) {
  const member = partyOf(player)[index];
  if (!member) return openParty(player);
  const level = levelOf(player, member);
  const rank = bondRank(member);
  const vocation = Math.floor(member.look / 2);
  const form = new ActionFormData().title(member.name).body(
    describe(player, member, index) +
      `\n\nBond: §e${BOND_RANKS[rank]}§r (${member.bond}/${MAX_BOND}) - skills +${Math.round(rank * BOND_POWER * 100)}%, returns ${recoveryOf(member)} s after falling` +
      (member.hired ? `\nXP: ${level >= MAX_LEVEL ? "max level" : `${member.xp}/${xpForNext(level)}`}` : "") +
      `\nTactic: §e${TACTICS[member.tactic]}§r - ${TACTIC_HELP[member.tactic]}` +
      `\nTraits: ${member.traits.length > 0 ? member.traits.map((key) => TRAITS.find((t) => t.key === key)?.name).join(", ") : "none"} (${member.traits.length}/${traitSlots(level)}; slots open at levels 10 and 30)` +
      `\nSkills: ${SKILLS[vocation][0]}; ${SKILLS[vocation][1]} ${level >= SECOND_SKILL_LEVEL ? "" : `(from level ${SECOND_SKILL_LEVEL})`}`
  );
  /** @type {(() => void)[]} */
  const actions = [];
  const add = (/** @type {string} */ text, /** @type {() => void} */ action) => {
    form.button(text);
    actions.push(action);
  };
  if (recovering(player, index) > 0) {
    add(`Revive now (${REVIVE_COST} Gold Coins)`, () => notify(player, revive(player, index)));
  }
  add(member.out ? "Dismiss" : "Call to your side", () => (member.out ? dismiss(player, index) : summon(player, index)));
  add(`Tactic: ${TACTICS[member.tactic]}\n(tap to change)`, () => {
    notify(player, setTactic(player, index, (member.tactic + 1) % TACTICS.length));
    openMember(player, index);
  });
  add(`Traits (${member.traits.length}/${traitSlots(level)})`, () => openTraits(player, index));
  if (member.bond < MAX_BOND) {
    add(`Give a gift (${GIFT_COST} Gold Coins)\n+${GIFT_BOND} bond, once a day`, () => {
      notify(player, gift(player, index));
      openMember(player, index);
    });
  }
  if (member.gear < MAX_GEAR) {
    add(`Upgrade gear (${gearCost(member.gear)} Gold Coins)\n+4 hearts per rank, more damage every 2`, () => {
      notify(player, upgrade(player, index));
      openMember(player, index);
    });
  }
  if (!member.hired) add("Change name, look or vocation", () => openCreate(player));
  add(member.hired ? "End contract" : "Release retainer", () => {
    release(player, index);
    notify(player, `§7${member.name} has left your party`);
  });
  add("Back", () => openParty(player));
  show(form, player, (choice) => actions[choice]?.());
}

/** @param {Player} player @param {number} index */
function openTraits(player, index) {
  const member = partyOf(player)[index];
  if (!member) return openParty(player);
  const slots = traitSlots(levelOf(player, member));
  const form = new ActionFormData()
    .title(`${member.name}'s traits`)
    .body(`Traits shape how a companion fights. ${member.name} can hold ${slots} (one from level 10, two from level 30). Tap a trait to give it or take it away; changing costs nothing.`);
  for (const trait of TRAITS) form.button(`${member.traits.includes(trait.key) ? "§2[x] §r" : ""}${trait.name}\n${trait.help}`);
  form.button("Back");
  show(form, player, (choice) => {
    if (choice >= TRAITS.length) return openMember(player, index);
    notify(player, toggleTrait(player, index, TRAITS[choice].key));
    openTraits(player, index);
  });
}

/** @param {Player} player */
function openHire(player) {
  const offers = candidates(player);
  const form = new ActionFormData()
    .title("Mercenaries for hire")
    .body(`Gold Coins: §6${countItem(player, COIN)}§r. Friends of the adventurers pay a quarter less.`);
  for (const offer of offers) {
    form.button(`${offer.name} - ${LOOKS[offer.look]} (${VOCATIONS[Math.floor(offer.look / 2)]}) Lv.${offer.level}\n${offer.cost} Gold Coins`);
  }
  form.button("Back");
  show(form, player, (choice) => {
    if (choice >= offers.length) return openParty(player);
    notify(player, hire(player, offers[choice]));
    summon(player);
  });
}

registerMenu((player) => `Party (${partyOf(player).length}/${MAX_PARTY})`, openParty);
