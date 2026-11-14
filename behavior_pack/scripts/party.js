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
import * as skills from "./skills.js";
import { fights, hazards } from "./bosses.js";

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
const CUTPURSE_LEVEL = 20; // from this level a Rogue's kills now and then turn up a coin
const ATTACK_GAP = 18; // ticks a member waits between two attacks
const POTION = id("red_potion");
const POTION_HEAL = 20;
const SCOUT_FIRST = 120; // seconds before an archer first reports what lies ahead
const SCOUT_EVERY = 360;
/** How a member chooses the foe for its skills. */
export const TACTICS = ["Vanguard", "Guardian", "Free hand"];
const TACTIC_HELP = ["strikes the foe you are fighting", "strikes whatever last hurt you", "picks its own foe within 12 blocks: whatever hurts you, elites and staggered foes first"];
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

/** Element a mage retainer reaches for against particular foes. */
const WEAK_TO = {
  [id("cocytus")]: "fire",
  [id("soul_eater")]: "fire",
  [id("solution")]: "fire",
  [id("frost_dragon")]: "fire",
  [id("war_troll")]: "fire",
  [id("frost_giant")]: "fire",
  [id("treant_sapling")]: "fire",
  [id("zytl_qae")]: "fire",
  [id("wraith")]: "holy",
  [id("death_cavalier")]: "holy",
  [id("go_gin")]: "fire",
  [id("behemoth")]: "acid",
  [id("eight_edge_assassin")]: "holy",
  [id("platinum_dragon_lord")]: "dark",
  [id("dark_young")]: "fire",
  [id("jaldabaoth")]: "ice",
  [id("gigant_basilisk")]: "ice",
  [id("skeletal_dragon")]: "holy",
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
/** @typedef {{ name: string, look: number, gear: number, hired: boolean, level: number, out: boolean, xp: number, bond: number, tactic: number, traits: string[], gift: number, persona?: string }} Member */

// ------------------------------------------------------------------- v8.7: who they are and how they fight

/** Each member's temper colours what they say in battle. */
export const PERSONAS = {
  brave: { name: "Brave", start: ["For the Master!", "Stand fast - they will break on us!", "Here they come. Good."], elite: ["A worthy foe, felled!", "That one fought well. Not well enough."], low: ["It is only a scratch!", "I will not fall here!"] },
  cautious: { name: "Cautious", start: ["Careful, Master - more than one.", "Stay close. Watch the flanks.", "I count several. Let us be wise."], elite: ["Done. Let us not meet another like it.", "We were lucky there, Master."], low: ["Too close - I am pulling back!", "I need a moment!"] },
  cheerful: { name: "Cheerful", start: ["Oh, company! Let us say hello!", "Ready when you are, Master!", "This should be fun!"], elite: ["Ha! Did you see that, Master?", "And that is how it is done!"], low: ["Ouch, ouch, ouch!", "That one stung!"] },
  stoic: { name: "Stoic", start: ["Engaging.", "As you command.", "Hostiles ahead."], elite: ["It is finished.", "Threat removed."], low: ["Wounded. Continuing.", "Pain is irrelevant."] },
};
const PERSONA_KEYS = Object.keys(PERSONAS);
/** How each vocation fights: front holds the line, back keeps its distance, support stays by the master, flank goes behind. */
export const ROLES = ["front", "back", "back", "support", "flank", "back"];
const ROLE_NAMES = { front: "Vanguard - holds the line and draws foes off you", back: "Back line - keeps its distance and steps away from foes that close in", support: "Support - stays at your side and keeps everyone standing", flank: "Flanker - slips behind foes and strikes where they are open" };
/**
 * The pose each attack is drawn with: the casting and weapon animations the player uses, and the party's own.
 * @type {Record<string, string>}
 */
export const POSES = {
  bash: "animation.overlord.party_bash", cleave: "animation.overlord.weapon_slash", taunt: "animation.overlord.party_taunt",
  cry: "animation.overlord.cast_raise", quake: "animation.overlord.weapon_slam", tempest: "animation.overlord.weapon_spin",
  shot: "animation.overlord.party_draw", volley: "animation.overlord.party_draw", pin: "animation.overlord.party_draw",
  fire_arrow: "animation.overlord.party_draw", rain: "animation.overlord.party_skyshot", starfall: "animation.overlord.party_skyshot",
  bolt: "animation.overlord.cast_point", burst: "animation.overlord.cast_sweep", chain: "animation.overlord.cast_point",
  frost: "animation.overlord.cast_slam", meteor: "animation.overlord.cast_raise", rift: "animation.overlord.cast_channel",
  mend: "animation.overlord.cast_self", smite: "animation.overlord.cast_point", purify: "animation.overlord.party_pray",
  sanctuary: "animation.overlord.cast_raise", blessing: "animation.overlord.party_pray", aegis: "animation.overlord.cast_raise",
  backstab: "animation.overlord.weapon_thrust", flask: "animation.overlord.party_throw", shadowstep: "animation.overlord.weapon_thrust",
  knives: "animation.overlord.party_throw", flurry: "animation.overlord.weapon_slash", lotus: "animation.overlord.weapon_spin",
  ballad: "animation.overlord.party_strum", dissonance: "animation.overlord.party_strum", haste: "animation.overlord.party_strum",
  dirge: "animation.overlord.party_strum", crescendo: "animation.overlord.party_strum", requiem: "animation.overlord.party_strum",
};
/** The element of each vocation's attacks, for the flash at the hand. */
const VOC_ELEMENT = ["none", "none", "arcane", "holy", "dark", "arcane"];
/** Foe id -> tick until which it is staggered and open to the party's blows. */
/** @type {Map<string, number>} */
export const staggered = new Map();
/** How much harder blows land on a staggered foe. */
export const OPENING = 1.4;
/** Entity id -> tick of its next dash (a dodge, a step back, an interception). */
/** @type {Map<string, number>} */
const dashReady = new Map();
/** Player id -> tick of the last time the party went into battle. */
const lastBattle = new Map();

/** A member's temper; older members are given one from their name. @param {Member} member */
export function personaOf(member) {
  if (member.persona && member.persona in PERSONAS) return member.persona;
  let h = 0;
  for (const ch of member.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSONA_KEYS[h % PERSONA_KEYS.length];
}

/** One of a member's lines for a moment. @param {Member} member @param {"start" | "elite" | "low"} moment @param {() => number} [random] */
export function lineFor(member, moment, random = Math.random) {
  const lines = PERSONAS[/** @type {keyof typeof PERSONAS} */ (personaOf(member))][moment];
  return lines[Math.floor(random() * lines.length) % lines.length];
}

/** Marks a foe staggered for a while. @param {Entity} foe @param {number} seconds */
function stagger(foe, seconds) {
  staggered.set(foe.id, system.currentTick + Math.round(seconds * TICKS));
}

/** Whether a foe is open to an exploiting blow. @param {Entity} foe */
export function isStaggered(foe) {
  return system.currentTick < (staggered.get(foe.id) ?? 0);
}

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
    m.persona = personaOf(m);
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

/** @param {Entity} entity @param {number} level @param {number} gear @param {boolean} [sturdy] @param {number} [veteran] extra Health Boost tiers from the skill tree */
function applyStats(entity, level, gear, sturdy = false, veteran = 0) {
  const signature = `${level}|${gear}|${sturdy ? 1 : 0}|${veteran}`;
  if (entity.getDynamicProperty("overlord:sig") === signature) return;
  entity.setDynamicProperty("overlord:sig", signature);
  const hearts = Math.floor(level / 5) + gear * 2 + (sturdy ? 2 : 0) + veteran; // each tier is two hearts
  const might = Math.floor(level / 20) + Math.floor(gear / 2);
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
      applyStats(entity, levelOf(player, member), member.gear, hasTrait(player, member, "sturdy"), skills.companionHearts(profileOf(player)));
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
    const chosen = bestFoe(player, entity, member);
    if (chosen) return chosen;
  }
  if (member.tactic === 1) return current(threats.get(player.id)) ?? current(targets.get(player.id));
  return current(targets.get(player.id));
}

/**
 * A free hand weighs its choice (v8.7): whatever is hurting the master first, then elites and foes the party
 * has staggered; a Rogue or an Archer goes for the wounded it can finish; a Fighter for what is nearest the
 * master; and nearer is always better.
 * @param {Player} player @param {Entity} entity @param {Member} member
 * @returns {Entity | undefined}
 */
export function bestFoe(player, entity, member) {
  /** @type {Entity[]} */
  let near = [];
  try {
    near = player.dimension.getEntities({ location: entity.location, maxDistance: 12, families: ["monster"] });
  } catch {
    return undefined;
  }
  const threat = threats.get(player.id);
  const hunting = threat && system.currentTick - threat.tick <= FRESH ? threat.entity : undefined;
  const role = ROLES[Math.floor(member.look / 2)];
  const vocation = Math.floor(member.look / 2);
  let best;
  let bestScore = -Infinity;
  for (const foe of near) {
    if (!foe.isValid) continue;
    let score = -Math.hypot(foe.location.x - entity.location.x, foe.location.z - entity.location.z);
    if (hunting && foe.id === hunting.id) score += 30;
    try {
      if (isElite(foe)) score += 20;
    } catch {
      // no mark
    }
    if (isStaggered(foe)) score += 15;
    if (vocation === 1 || vocation === 4) {
      try {
        const health = foe.getComponent("minecraft:health");
        if (health && health.effectiveMax > 0 && health.currentValue / health.effectiveMax < 0.35) score += 20;
      } catch {
        // unreadable
      }
    }
    if (role === "front") score -= Math.hypot(foe.location.x - player.location.x, foe.location.z - player.location.z);
    if (score > bestScore) {
      bestScore = score;
      best = foe;
    }
  }
  return best;
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

/** Entity id -> attack key -> tick at which that attack is ready again. */
/** @type {Map<string, Map<string, number>>} */
const ready = new Map();
/** Player id -> tick before which no member calls out another opening. */
const openingCalled = new Map();
/** Entity id -> tick before which it will not attack again. */
const busy = new Map();
/** Entity id -> which of its attacks it used last, so the next one is a different one. */
const lastUsed = new Map();

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
 * @typedef {{
 *   player: Player, entity: Entity, member: Member, level: number, power: number, d: import("@minecraft/server").Dimension,
 *   hand: import("@minecraft/server").Vector3, foe: Entity | undefined, gap: number, masterShare: number,
 *   masterHealth: import("@minecraft/server").EntityHealthComponent | undefined, near: boolean,
 * }} Turn everything an attack needs to know: who is acting, on whom, how hard
 */
/**
 * @typedef {{ key: string, name: string, level: number, cooldown: number, help: string, urgent?: boolean,
 *   use: (t: Turn) => boolean }} Attack an urgent attack answers need (a hurt master, a wounded ally) and is tried before the rest
 */

/**
 * @param {Turn} t @param {Entity} target @param {number} amount @param {"entityAttack" | "magic" | "fire"} [cause]
 */
function hit(t, target, amount, cause = "entityAttack") {
  try {
    // A foe the party has staggered is open: every blow on it lands harder.
    const open = isStaggered(target);
    target.applyDamage(amount * t.power * (open ? OPENING : 1), { cause: EntityDamageCause[cause], damagingEntity: t.entity });
    if (open && system.currentTick >= (openingCalled.get(t.player.id) ?? 0)) {
      openingCalled.set(t.player.id, system.currentTick + 12 * TICKS);
      fx.spark(t.d, above(target, 1.6), "holy", 1.2);
      say(t.player, t.member, "An opening - strike now!", 6);
    }
    return true;
  } catch {
    return false; // already dead
  }
}

/** @param {Entity} target @param {string} effect @param {number} seconds @param {number} amplifier */
function afflict(target, effect, seconds, amplifier) {
  try {
    if (target.isValid) target.addEffect(effect, Math.round(seconds * TICKS), { amplifier });
  } catch {
    // immune, or gone
  }
}

/** The foe and every monster within a radius of it. @param {Turn} t @param {number} radius @param {number} [most] */
function around(t, radius, most = 12) {
  const foe = /** @type {Entity} */ (t.foe);
  return [foe, ...monstersNear(t.player, foe.location, radius).filter((m) => m.id !== foe.id)].slice(0, most);
}

/**
 * The attacks of each vocation, in the order they are learned. A member cycles through the
 * ones it knows, so two attacks in a row are never the same while another is ready.
 * @type {Attack[][]}
 */
export const ATTACKS = [
  // ------------------------------------------------------------------ Fighter
  [
    { key: "bash", name: "Shield Bash", level: 1, cooldown: 6, help: "a heavy blow that staggers the foe", use: (t) => {
      if (!t.foe || t.gap > 4) return false;
      hit(t, t.foe, 5 + t.level * 0.3);
      afflict(t.foe, "slowness", 2, 3);
      try {
        const len = t.gap || 1;
        if (t.foe.isValid) t.foe.applyKnockback({ x: ((t.foe.location.x - t.entity.location.x) / len) * 1.2, z: ((t.foe.location.z - t.entity.location.z) / len) * 1.2 }, 0.3);
      } catch {
        // immovable
      }
      fx.ring(t.d, t.foe.location, "none", 1.5);
      return true;
    } },
    { key: "cleave", name: "Cleave", level: 8, cooldown: 9, help: "a sweep through every foe within reach", use: (t) => {
      const foes = monstersNear(t.player, t.entity.location, 3.5);
      if (foes.length === 0) return false;
      for (const foe of foes) hit(t, foe, 4 + t.level * 0.25);
      fx.slash(t.d, above(t.entity, 1.1), "none", 2);
      return true;
    } },
    { key: "taunt", name: "Taunt", level: 14, cooldown: 16, urgent: true, help: "draws monsters menacing you or the back line onto itself, weakened", use: (t) => {
      const menaced = [t.player, ...backLine(t.player)];
      /** @type {Entity[]} */
      const drawn = [];
      for (const ally of menaced) {
        for (const foe of monstersNear(t.player, ally.location, 5)) {
          const far = Math.hypot(foe.location.x - t.entity.location.x, foe.location.z - t.entity.location.z);
          if (far > 3 && far < 14 && !drawn.some((d) => d.id === foe.id)) drawn.push(foe);
        }
      }
      if (drawn.length === 0) return false;
      for (const foe of drawn.slice(0, 5)) {
        const dx = t.entity.location.x - foe.location.x;
        const dz = t.entity.location.z - foe.location.z;
        const len = Math.hypot(dx, dz) || 1;
        try {
          foe.applyKnockback({ x: (dx / len) * 1.4, z: (dz / len) * 1.4 }, 0.25);
        } catch {
          // immovable
        }
        afflict(foe, "weakness", 5, 0);
        fx.beam(t.d, above(foe, 1), above(t.entity, 1.2), "fire", 0.6);
      }
      fx.ring(t.d, t.entity.location, "fire", 3);
      say(t.player, t.member, "Face me, you cowards!", 20);
      return true;
    } },
    { key: "cry", name: "Rallying Cry", level: 20, cooldown: 30, urgent: true, help: "Resistance for you below half health", use: (t) => {
      if (t.masterShare >= 0.5 || !t.near) return false;
      t.player.addEffect("resistance", 6 * TICKS, { amplifier: 0 });
      fx.ring(t.d, t.entity.location, "holy", 3);
      say(t.player, t.member, "Behind me, Master!", 30);
      return true;
    } },
    { key: "quake", name: "Earthshatter", level: 35, cooldown: 18, help: "the ground bursts under every foe near", use: (t) => {
      const foes = monstersNear(t.player, t.entity.location, 5);
      if (foes.length === 0) return false;
      for (const foe of foes) {
        hit(t, foe, 6 + t.level * 0.3);
        afflict(foe, "slowness", 3, 2);
        try {
          if (foe.isValid) foe.applyKnockback({ x: 0, z: 0 }, 0.55);
        } catch {
          // immovable
        }
      }
      fx.ring(t.d, t.entity.location, "none", 5);
      fx.shake(t.d, t.entity.location, 8, 0.3, 0.3);
      return true;
    } },
    { key: "tempest", name: "Blade Tempest", level: 45, cooldown: 28, help: "three whirling turns that cut every foe within 4.5 blocks", use: (t) => {
      if (monstersNear(t.player, t.entity.location, 4.5).length === 0) return false;
      for (let turn = 0; turn < 3; turn++) {
        system.runTimeout(() => {
          if (!t.entity.isValid || !t.player.isValid) return;
          for (const foe of monstersNear(t.player, t.entity.location, 4.5)) hit(t, foe, 6 + t.level * 0.3);
          fx.ring(t.d, t.entity.location, "none", 4.5);
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + turn;
            fx.slash(t.d, { x: t.entity.location.x + Math.cos(a) * 2.5, y: t.entity.location.y + 1.1, z: t.entity.location.z + Math.sin(a) * 2.5 }, "none", 1.5);
          }
          try {
            t.entity.playAnimation(POSES.tempest);
          } catch {
            // cosmetic
          }
        }, turn * 9);
      }
      say(t.player, t.member, "Blade Tempest!", 25);
      return true;
    } },
  ],
  // ------------------------------------------------------------------- Archer
  [
    { key: "shot", name: "Aimed Shot", level: 1, cooldown: 5, help: "one arrow, placed", use: (t) => {
      if (!t.foe || t.gap > 24) return false;
      hit(t, t.foe, 6 + t.level * 0.35);
      fx.beam(t.d, t.hand, above(t.foe, 1), "none", 0.7);
      fx.spark(t.d, above(t.foe, 1), "none", 0.8);
      return true;
    } },
    { key: "volley", name: "Volley", level: 8, cooldown: 12, help: "three foes at once", use: (t) => {
      if (!t.foe || t.gap > 24) return false;
      for (const foe of around(t, 5, 3)) {
        hit(t, foe, 4 + t.level * 0.25);
        fx.beam(t.d, t.hand, above(foe, 1), "none", 0.7);
      }
      return true;
    } },
    { key: "pin", name: "Pinning Shot", level: 14, cooldown: 10, help: "an arrow through the foot: the foe is pinned and staggered", use: (t) => {
      if (!t.foe || t.gap > 24 || isStaggered(t.foe)) return false;
      hit(t, t.foe, 5 + t.level * 0.3);
      afflict(t.foe, "slowness", 3, 6);
      stagger(t.foe, 3);
      fx.beam(t.d, t.hand, above(t.foe, 0.3), "none", 0.8);
      fx.circle(t.d, t.foe.location, "none", 1);
      return true;
    } },
    { key: "fire_arrow", name: "Fire Arrow", level: 20, cooldown: 14, help: "an arrow that bursts into flame", use: (t) => {
      if (!t.foe || t.gap > 24) return false;
      fx.beam(t.d, t.hand, above(t.foe, 1), "fire", 0.9);
      fx.nova(t.d, above(t.foe, 0.8), "fire", 3);
      for (const foe of around(t, 3)) {
        hit(t, foe, 6 + t.level * 0.3, "fire");
        try {
          if (foe.isValid) foe.setOnFire(4, true);
        } catch {
          // gone
        }
      }
      return true;
    } },
    { key: "rain", name: "Rain of Arrows", level: 35, cooldown: 22, help: "three flights of arrows over an area", use: (t) => {
      if (!t.foe || t.gap > 24) return false;
      const centre = { ...t.foe.location };
      for (let wave = 0; wave < 3; wave++) {
        system.runTimeout(() => {
          if (!t.entity.isValid || !t.player.isValid) return;
          fx.fall(t.d, centre, "none", 4, 2 - wave * 2);
          for (const foe of monstersNear(t.player, centre, 4)) hit(t, foe, 3 + t.level * 0.15);
        }, wave * 10);
      }
      fx.circle(t.d, centre, "none", 4);
      return true;
    } },
    { key: "starfall", name: "Starfall Arrow", level: 45, cooldown: 30, help: "an arrow loosed at the sky comes down as a rain of light over the foe", use: (t) => {
      if (!t.foe || t.gap > 26) return false;
      const centre = { ...t.foe.location };
      fx.beam(t.d, t.hand, { x: t.entity.location.x, y: t.entity.location.y + 14, z: t.entity.location.z }, "holy", 0.8);
      fx.circle(t.d, centre, "holy", 5);
      system.runTimeout(() => {
        if (!t.entity.isValid || !t.player.isValid) return;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          fx.fall(t.d, { x: centre.x + Math.cos(a) * 2.5, y: centre.y, z: centre.z + Math.sin(a) * 2.5 }, "holy", 6, 1);
        }
        fx.nova(t.d, { x: centre.x, y: centre.y + 0.6, z: centre.z }, "holy", 5);
        for (const foe of monstersNear(t.player, centre, 5)) hit(t, foe, 10 + t.level * 0.45, "magic");
      }, 24);
      return true;
    } },
  ],
  // --------------------------------------------------------------------- Mage
  [
    { key: "bolt", name: "Elemental Bolt", level: 1, cooldown: 6, help: "a bolt in the element the foe likes least", use: (t) => {
      if (!t.foe || t.gap > 18) return false;
      const element = WEAK_TO[t.foe.typeId] ?? "arcane";
      hit(t, t.foe, (8 + t.level * 0.45) * (WEAK_TO[t.foe.typeId] ? 1.5 : 1), "magic");
      fx.circle(t.d, t.entity.location, element, 1.0);
      fx.beam(t.d, t.hand, above(t.foe, 1), element);
      fx.spark(t.d, above(t.foe, 1), element, 1.1);
      return true;
    } },
    { key: "burst", name: "Flame Burst", level: 8, cooldown: 14, help: "fire over everything around the foe", use: (t) => {
      if (!t.foe || t.gap > 18) return false;
      for (const foe of around(t, 3.5)) {
        hit(t, foe, 6 + t.level * 0.35, "fire");
        try {
          if (foe.isValid) foe.setOnFire(3, true);
        } catch {
          // gone
        }
      }
      fx.circle(t.d, t.entity.location, "fire", 1.2);
      fx.nova(t.d, above(t.foe, 0.8), "fire", 3.5);
      return true;
    } },
    { key: "chain", name: "Chain Lightning", level: 20, cooldown: 12, help: "lightning that leaps to four foes", use: (t) => {
      if (!t.foe || t.gap > 18) return false;
      let from = t.hand;
      for (const foe of around(t, 6, 4)) {
        hit(t, foe, 6 + t.level * 0.35, "magic");
        afflict(foe, "slowness", 1, 5);
        fx.beam(t.d, from, above(foe, 1), "lightning");
        fx.spark(t.d, above(foe, 1), "lightning", 1);
        from = above(foe, 1);
      }
      return true;
    } },
    { key: "frost", name: "Frost Nova", level: 28, cooldown: 16, help: "a ring of cold that slows every foe near the caster", use: (t) => {
      const foes = monstersNear(t.player, t.entity.location, 5);
      if (foes.length === 0) return false;
      for (const foe of foes) {
        hit(t, foe, 5 + t.level * 0.3, "magic");
        afflict(foe, "slowness", 4, 2);
      }
      fx.nova(t.d, above(t.entity, 0.8), "ice", 5);
      return true;
    } },
    { key: "meteor", name: "Meteor", level: 35, cooldown: 26, help: "a burning stone from the sky", use: (t) => {
      if (!t.foe || t.gap > 20) return false;
      const centre = { ...t.foe.location };
      fx.circle(t.d, centre, "fire", 5);
      fx.fall(t.d, centre, "fire", 16);
      system.runTimeout(() => {
        if (!t.entity.isValid || !t.player.isValid) return;
        fx.pillar(t.d, centre, "fire", 6, 1.6);
        fx.nova(t.d, { x: centre.x, y: centre.y + 0.8, z: centre.z }, "fire", 5);
        fx.shake(t.d, centre, 14, 0.5, 0.4);
        for (const foe of monstersNear(t.player, centre, 5)) hit(t, foe, 12 + t.level * 0.5, "fire");
      }, 16);
      return true;
    } },
    { key: "rift", name: "Arcane Rift", level: 45, cooldown: 30, help: "a rift drags every foe near the target into one point, then bursts", use: (t) => {
      if (!t.foe || t.gap > 20) return false;
      const centre = { ...t.foe.location };
      const caught = monstersNear(t.player, centre, 7);
      for (const foe of caught) {
        const dx = centre.x - foe.location.x;
        const dz = centre.z - foe.location.z;
        const len = Math.hypot(dx, dz) || 1;
        try {
          foe.applyKnockback({ x: (dx / len) * 1.2, z: (dz / len) * 1.2 }, 0.2);
        } catch {
          // immovable
        }
        stagger(foe, 3);
      }
      fx.implode(t.d, { x: centre.x, y: centre.y + 1, z: centre.z }, "arcane", 3);
      system.runTimeout(() => {
        if (!t.entity.isValid || !t.player.isValid) return;
        fx.nova(t.d, { x: centre.x, y: centre.y + 1, z: centre.z }, "arcane", 4);
        fx.shake(t.d, centre, 10, 0.4, 0.3);
        for (const foe of monstersNear(t.player, centre, 4)) hit(t, foe, 14 + t.level * 0.5, "magic");
      }, 14);
      return true;
    } },
  ],
  // ------------------------------------------------------------------- Healer
  [
    { key: "mend", name: "Mend", level: 1, cooldown: 5, urgent: true, help: "heals the most wounded of you and the party", use: (t) => {
      const patient = mostWounded(t.player, t.entity);
      if (!patient) return false;
      patient.health.setCurrentValue(Math.min(patient.health.effectiveMax, patient.health.currentValue + (6 + t.level * 0.15) * t.power));
      fx.beam(t.d, t.hand, above(patient.entity, 1), "holy");
      fx.rise(t.d, patient.entity.location, "holy", 0.7);
      if (patient.entity.id === t.player.id) say(t.player, t.member, "Hold on, Master - I have you.", 30);
      return true;
    } },
    { key: "smite", name: "Smite", level: 8, cooldown: 7, help: "a bolt of holy light, half as strong again against the undead", use: (t) => {
      if (!t.foe || t.gap > 18) return false;
      let undead = false;
      try {
        undead = t.foe.matches({ families: ["undead"] });
      } catch {
        // not readable
      }
      hit(t, t.foe, (5 + t.level * 0.3) * (undead ? 1.5 : 1), "magic");
      fx.beam(t.d, t.hand, above(t.foe, 1), "holy");
      fx.spark(t.d, above(t.foe, 1), "holy", 1);
      return true;
    } },
    { key: "purify", name: "Purify", level: 14, cooldown: 18, urgent: true, help: "washes poison, wither, weakness and slowness from you and the party", use: (t) => {
      const bad = ["poison", "wither", "weakness", "slowness", "blindness", "nausea", "hunger"];
      /** @type {Entity[]} */
      const allies = [t.player];
      for (let i = 0; i < MAX_PARTY; i++) allies.push(...entitiesOf(t.player, i));
      let washed = 0;
      for (const ally of allies) {
        if (Math.hypot(ally.location.x - t.entity.location.x, ally.location.z - t.entity.location.z) > 12) continue;
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
      fx.rise(t.d, t.player.location, "holy", 1);
      fx.ring(t.d, t.entity.location, "holy", 4);
      return true;
    } },
    { key: "sanctuary", name: "Sanctuary", level: 20, cooldown: 40, urgent: true, help: "a great heal when you are near death", use: (t) => {
      if (!t.masterHealth || t.masterShare >= 0.3 || !t.near) return false;
      t.masterHealth.setCurrentValue(Math.min(t.masterHealth.effectiveMax, t.masterHealth.currentValue + (12 + t.level * 0.25) * t.power));
      t.player.addEffect("regeneration", 5 * TICKS, { amplifier: 1 });
      fx.dome(t.d, t.player.location, "holy");
      say(t.player, t.member, "Sanctuary! You will not fall here, Master.", 30);
      return true;
    } },
    { key: "blessing", name: "Blessing", level: 35, cooldown: 45, help: "Regeneration and Resistance for you, and healing for the party, in battle", use: (t) => {
      if (!inCombat(t.player) || !t.near) return false;
      t.player.addEffect("regeneration", 8 * TICKS, { amplifier: 0 });
      t.player.addEffect("resistance", 8 * TICKS, { amplifier: 0 });
      for (let i = 0; i < MAX_PARTY; i++) {
        for (const ally of entitiesOf(t.player, i)) {
          try {
            const health = ally.getComponent("minecraft:health");
            if (health && health.currentValue > 0) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + 10 * t.power));
            fx.rise(t.d, ally.location, "holy", 0.6);
          } catch {
            // that ally is unloading
          }
        }
      }
      fx.ring(t.d, t.player.location, "holy", 6);
      return true;
    } },
    { key: "aegis", name: "Divine Aegis", level: 45, cooldown: 50, urgent: true, help: "a shield of light over you and the party when the fight turns against you", use: (t) => {
      if (!inCombat(t.player) || !t.near || t.masterShare >= 0.6) return false;
      t.player.addEffect("absorption", 12 * TICKS, { amplifier: 2 });
      for (let i = 0; i < MAX_PARTY; i++) {
        for (const ally of entitiesOf(t.player, i)) {
          try {
            ally.addEffect("absorption", 12 * TICKS, { amplifier: 1 });
            fx.dome(t.d, ally.location, "holy");
          } catch {
            // that ally is unloading
          }
        }
      }
      fx.pillar(t.d, t.player.location, "holy", 6);
      fx.dome(t.d, t.player.location, "holy");
      say(t.player, t.member, "Divine Aegis - the light protects us!", 30);
      return true;
    } },
  ],
  // -------------------------------------------------------------------- Rogue
  [
    { key: "backstab", name: "Backstab", level: 1, cooldown: 5, help: "a poisoned strike", use: (t) => {
      if (!t.foe || t.gap > 3.5) return false;
      hit(t, t.foe, 7 + t.level * 0.4);
      afflict(t.foe, "poison", 4, 1);
      fx.spark(t.d, above(t.foe, 1), "dark", 0.9);
      return true;
    } },
    { key: "flask", name: "Poison Flask", level: 8, cooldown: 12, help: "a flask of poison over the foe and those beside it", use: (t) => {
      if (!t.foe || t.gap > 12) return false;
      for (const foe of around(t, 3)) {
        hit(t, foe, 3 + t.level * 0.2, "magic");
        afflict(foe, "poison", 5, 1);
      }
      fx.beam(t.d, t.hand, above(t.foe, 0.5), "acid", 0.6);
      fx.nova(t.d, above(t.foe, 0.6), "acid", 3);
      return true;
    } },
    { key: "shadowstep", name: "Shadowstep", level: 14, cooldown: 12, help: "slips through the shadows to behind the foe and strikes at its back", use: (t) => {
      if (!t.foe || t.gap > 12 || t.gap < 2) return false;
      let view = { x: 0, z: 1 };
      try {
        const v = t.foe.getViewDirection();
        const len = Math.hypot(v.x, v.z) || 1;
        view = { x: v.x / len, z: v.z / len };
      } catch {
        // a foe with no facing: step behind it from where the rogue stands
        const len = t.gap || 1;
        view = { x: (t.foe.location.x - t.entity.location.x) / len, z: (t.foe.location.z - t.entity.location.z) / len };
      }
      const from = { ...t.entity.location };
      const to = { x: t.foe.location.x - view.x * 1.5, y: t.foe.location.y, z: t.foe.location.z - view.z * 1.5 };
      try {
        t.entity.teleport(to, { facingLocation: t.foe.location });
      } catch {
        return false;
      }
      fx.blink(t.d, from, to, "dark");
      hit(t, t.foe, (8 + t.level * 0.45) * 1.5);
      stagger(t.foe, 2);
      fx.slash(t.d, above(t.foe, 1), "dark", 1.4);
      return true;
    } },
    { key: "knives", name: "Throwing Knives", level: 20, cooldown: 8, help: "three knives from a distance", use: (t) => {
      if (!t.foe || t.gap > 14) return false;
      for (let knife = 0; knife < 3; knife++) hit(t, t.foe, 2 + t.level * 0.12);
      fx.beam(t.d, t.hand, above(t.foe, 1), "none", 0.6);
      fx.spark(t.d, above(t.foe, 1), "none", 0.7);
      return true;
    } },
    { key: "flurry", name: "Shadow Flurry", level: 35, cooldown: 16, help: "four cuts faster than the eye", use: (t) => {
      if (!t.foe || t.gap > 4) return false;
      const foe = t.foe;
      for (let cut = 0; cut < 4; cut++) {
        // Spaced past the target's hurt cooldown so every cut lands.
        system.runTimeout(() => {
          if (!foe.isValid || !t.entity.isValid) return;
          hit(t, foe, 5 + t.level * 0.25, "magic");
          fx.slash(t.d, above(foe, 1), "dark", 1.2);
        }, cut * 11);
      }
      return true;
    } },
    { key: "lotus", name: "Death Lotus", level: 45, cooldown: 26, help: "a whirl of blades: four cuts at every foe within 4 blocks", use: (t) => {
      if (monstersNear(t.player, t.entity.location, 4).length === 0) return false;
      for (let cut = 0; cut < 4; cut++) {
        system.runTimeout(() => {
          if (!t.entity.isValid || !t.player.isValid) return;
          for (const foe of monstersNear(t.player, t.entity.location, 4)) {
            hit(t, foe, 4 + t.level * 0.2, "magic");
            fx.slash(t.d, above(foe, 1), "dark", 1.1);
          }
          fx.ring(t.d, t.entity.location, "dark", 4);
        }, cut * 11);
      }
      say(t.player, t.member, "Death Lotus.", 25);
      return true;
    } },
  ],
  // --------------------------------------------------------------------- Bard
  [
    { key: "ballad", name: "Ballad of Valour", level: 1, cooldown: 16, help: "Strength and Speed for you in battle", use: (t) => {
      if (!inCombat(t.player) || Math.hypot(t.player.location.x - t.entity.location.x, t.player.location.z - t.entity.location.z) > 16) return false;
      t.player.addEffect("strength", Math.round(8 * t.power * TICKS), { amplifier: 0 });
      t.player.addEffect("speed", Math.round(8 * t.power * TICKS), { amplifier: 0 });
      fx.ring(t.d, t.player.location, "holy", 2.5);
      fx.rise(t.d, t.entity.location, "holy", 0.6);
      return true;
    } },
    { key: "dissonance", name: "Dissonance", level: 8, cooldown: 7, help: "a jarring chord that hurts and weakens one foe", use: (t) => {
      if (!t.foe || t.gap > 18) return false;
      hit(t, t.foe, 5 + t.level * 0.3, "magic");
      afflict(t.foe, "weakness", 3, 0);
      fx.beam(t.d, t.hand, above(t.foe, 1), "arcane", 0.8);
      fx.ring(t.d, t.foe.location, "arcane", 1.4);
      return true;
    } },
    { key: "haste", name: "Song of Swiftness", level: 14, cooldown: 24, help: "Speed and Haste for you and the party in battle", use: (t) => {
      if (!inCombat(t.player) || !t.near) return false;
      t.player.addEffect("speed", Math.round(10 * t.power * TICKS), { amplifier: 1 });
      t.player.addEffect("haste", Math.round(10 * t.power * TICKS), { amplifier: 1 });
      for (let i = 0; i < MAX_PARTY; i++) {
        for (const ally of entitiesOf(t.player, i)) {
          try {
            ally.addEffect("speed", 10 * TICKS, { amplifier: 1 });
          } catch {
            // unloading
          }
        }
      }
      fx.ring(t.d, t.player.location, "lightning", 3);
      fx.rise(t.d, t.entity.location, "lightning", 1);
      return true;
    } },
    { key: "dirge", name: "Dirge", level: 20, cooldown: 20, help: "slows and weakens foes around the target", use: (t) => {
      if (!t.foe || t.gap > 18) return false;
      for (const foe of around(t, 6)) {
        afflict(foe, "slowness", 6 * t.power, 1);
        afflict(foe, "weakness", 6 * t.power, 0);
      }
      fx.ring(t.d, t.foe.location, "dark", 6);
      return true;
    } },
    { key: "crescendo", name: "Crescendo", level: 35, cooldown: 24, help: "a wall of sound that hurts and stuns every foe around the target", use: (t) => {
      if (!t.foe || t.gap > 18) return false;
      for (const foe of around(t, 5)) {
        hit(t, foe, 6 + t.level * 0.3, "magic");
        afflict(foe, "slowness", 1.5, 6);
      }
      fx.nova(t.d, above(t.foe, 0.8), "none", 5);
      return true;
    } },
    { key: "requiem", name: "Requiem", level: 45, cooldown: 30, help: "a song for the dead: four waves of sorrow that hurt and slow every foe near the target", use: (t) => {
      if (!t.foe || t.gap > 18) return false;
      const centre = { ...t.foe.location };
      for (let wave = 0; wave < 4; wave++) {
        system.runTimeout(() => {
          if (!t.entity.isValid || !t.player.isValid) return;
          for (const foe of monstersNear(t.player, centre, 7)) {
            hit(t, foe, 4 + t.level * 0.2, "magic");
            afflict(foe, "slowness", 2, 1);
          }
          fx.ring(t.d, centre, "dark", 3 + wave * 1.3);
        }, wave * 12);
      }
      say(t.player, t.member, "Requiem...", 25);
      return true;
    } },
  ],
];

/**
 * How an attack looks: the member's pose, a flash at its hand, and - on the first blow of a fight -
 * a word that suits its temper.
 * @param {Player} player @param {Entity} entity @param {Member} member @param {string} key @param {number} vocation @param {number} now
 */
function perform(player, entity, member, key, vocation, now) {
  try {
    if (POSES[key]) entity.playAnimation(POSES[key], { blendOutTime: 0.2 });
  } catch {
    // poses are cosmetic
  }
  fx.flash(player.dimension, above(entity, 1.3), VOC_ELEMENT[vocation] ?? "none", 0.7);
  if (now - (lastBattle.get(player.id) ?? -1e9) > 30 * TICKS) say(player, member, lineFor(member, "start"), 10);
  lastBattle.set(player.id, now);
}

/** The attacks a member of this vocation knows at this level. @param {number} vocation @param {number} level */
export function attacksKnown(vocation, level) {
  return (ATTACKS[vocation] ?? []).filter((attack) => level >= attack.level);
}

/**
 * Lets one retainer act: it uses the next attack in its cycle that is ready and has something
 * to do. Returns the name of the attack used, if any.
 * @param {Player} player @param {Entity} entity @param {Member} member
 */
export function useSkill(player, entity, member) {
  const now = system.currentTick;
  if (now < (busy.get(entity.id) ?? 0)) return undefined;
  const vocation = Math.floor(member.look / 2);
  const level = levelOf(player, member);
  const known = attacksKnown(vocation, level);
  if (known.length === 0) return undefined;
  const formation = formationOf(player);
  const unison = now - (orders.get(player.id)?.tick ?? -1e9) <= FRESH;
  // A strong bond, fighting beside one's own kind, a keen edge and a Unison order all make an attack hit harder.
  const power =
    (1 + BOND_POWER * bondRank(member)) *
    (formation.doubled.has(vocation) ? 1.15 : 1) *
    (hasTrait(player, member, "keen") ? 1.15 : 1) *
    (unison ? UNISON_POWER : 1) *
    skills.companionPower(profileOf(player)); // Commander, Authority of the Supreme Being
  const haste = (formation.balanced ? 0.8 : 1) * (hasTrait(player, member, "swift") ? 0.85 : 1) * skills.companionHaste(profileOf(player));
  const masterHealth = player.getComponent("minecraft:health");
  let foe = pickFoe(player, entity, member);
  const reach = (/** @type {Entity} */ other) => Math.hypot(other.location.x - entity.location.x, other.location.z - entity.location.z);
  // A member told to hold its ground only fights what comes to it.
  if (foe && profileOf(player).stance === "stay" && reach(foe) > 10) foe = undefined;
  /** @type {Turn} */
  const turn = {
    player, entity, member, level, power, foe,
    d: player.dimension,
    hand: above(entity, 1.3),
    gap: foe ? reach(foe) : Infinity,
    masterHealth,
    masterShare: masterHealth && masterHealth.currentValue > 0 ? masterHealth.currentValue / masterHealth.effectiveMax : 1,
    near: reach(player) <= 12,
  };
  let mine = ready.get(entity.id);
  if (!mine) {
    mine = new Map();
    ready.set(entity.id, mine);
  }
  // What answers need comes first; after that the member takes the next attack in its cycle.
  const start = ((lastUsed.get(entity.id) ?? -1) + 1) % known.length;
  const cycle = known.map((_, step) => (start + step) % known.length);
  const order = [...cycle.filter((i) => known[i].urgent).sort((a, b) => known[b].level - known[a].level), ...cycle.filter((i) => !known[i].urgent)];
  for (const index of order) {
    const attack = known[index];
    if (now < (mine.get(attack.key) ?? 0)) continue;
    let used = false;
    try {
      used = attack.use(turn);
    } catch {
      used = false; // the target vanished mid-attack
    }
    if (!used) continue;
    mine.set(attack.key, now + Math.round(attack.cooldown * haste * TICKS));
    busy.set(entity.id, now + Math.round(ATTACK_GAP * haste));
    perform(player, entity, member, attack.key, vocation, now);
    if (!attack.urgent) lastUsed.set(entity.id, index);
    return attack.name;
  }
  return undefined;
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
    const growth = bond * (hasTrait(player, member, "devoted") ? 2 : 1) * skills.bondFactor(profileOf(player)); // Bonds of Loyalty
    addBond(player, member, Math.floor(growth) + (random() < growth % 1 ? 1 : 0));
    if (hasTrait(player, member, "scavenger") && random() < 0.1) coins += 1;
    if (Math.floor(member.look / 2) === 4 && levelOf(player, member) >= CUTPURSE_LEVEL && random() < 0.2) coins += 1; // Cutpurse
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
  if (isElite(dead)) {
    const awake = party.filter((m, i) => m.out && recovering(player, i) === 0);
    if (awake.length > 0) say(player, awake[Math.floor(random() * awake.length) % awake.length], lineFor(awake[0], "elite", random), 10);
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
    ready.delete(entity.id);
    busy.delete(entity.id);
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
        applyStats(entity, levelOf(player, member), member.gear, hasTrait(player, member, "sturdy"), skills.companionHearts(profileOf(player)));
        const name = label(player, member);
        if (entity.nameTag !== name) entity.nameTag = name;
        lookAfter(player, entity, member);
        brain(player, entity, member);
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

// ------------------------------------------------------------------- v8.7: battle sense

/** The party members out at the back of the line (archers, mages, bards). @param {Player} player */
function backLine(player) {
  /** @type {Entity[]} */
  const out = [];
  partyOf(player).forEach((member, index) => {
    if (ROLES[Math.floor(member.look / 2)] === "back") out.push(...entitiesOf(player, index));
  });
  return out;
}

/** @param {import("@minecraft/server").Vector3} p @param {import("@minecraft/server").Vector3} from @param {{ x: number, z: number }} dir @param {number} length */
function offLine(p, from, dir, length) {
  const t = Math.max(0, Math.min(length, (p.x - from.x) * dir.x + (p.z - from.z) * dir.z));
  return Math.hypot(p.x - (from.x + dir.x * t), p.z - (from.z + dir.z * t));
}

/**
 * Whether a spot lies where a boss's telegraphed blow or a hazard on the ground is about to hurt, and if so
 * which way is out (a flat unit vector).
 * @param {import("@minecraft/server").Vector3} at
 * @returns {{ x: number, z: number } | undefined}
 */
export function danger(at) {
  const away = (/** @type {{ x: number, z: number }} */ from) => {
    const dx = at.x - from.x;
    const dz = at.z - from.z;
    const len = Math.hypot(dx, dz);
    return len < 0.01 ? { x: 1, z: 0 } : { x: dx / len, z: dz / len };
  };
  for (const fight of fights.values()) {
    const pending = fight.pending;
    if (!pending) continue;
    let boss;
    try {
      boss = fight.entity.location;
    } catch {
      continue;
    }
    const move = pending.move;
    const dist = Math.hypot(at.x - boss.x, at.z - boss.z);
    if ((move.shape === "slam" || move.shape === "pull") && dist <= (move.radius ?? 6) + 0.5) return away(boss);
    if (move.shape === "ring" && dist >= (move.inner ?? 2.5) - 0.5 && dist <= (move.radius ?? 8) + 0.5) {
      const out = away(boss);
      return dist < ((move.inner ?? 2.5) + (move.radius ?? 8)) / 2 ? { x: -out.x, z: -out.z } : out; // into the safe middle, or out
    }
    if (move.shape === "barrage" || move.shape === "blink") {
      for (const spot of pending.spots) if (Math.hypot(at.x - spot.x, at.z - spot.z) <= (move.radius ?? 3) + 0.5) return away(spot);
    }
    if (move.shape === "line") {
      for (const line of pending.lines) {
        if (offLine(at, line.from, line.dir, move.length ?? 12) <= 1.8) return { x: -line.dir.z, z: line.dir.x }; // sidestep
      }
    }
  }
  for (const hazard of hazards) {
    if (Math.hypot(at.x - hazard.at.x, at.z - hazard.at.z) <= hazard.radius + 0.5) return away(hazard.at);
  }
  return undefined;
}

/** A quick dash in a direction. @param {Entity} entity @param {{ x: number, z: number }} dir @param {number} strength */
function dash(entity, dir, strength) {
  try {
    entity.applyImpulse({ x: dir.x * strength, y: 0.25, z: dir.z * strength });
    return true;
  } catch {
    return false;
  }
}

/**
 * A member's sense of the battle, each second: it gets out of a boss's blow before it falls, and takes the
 * place its vocation fights from - the back line steps away from foes that close in, the vanguard throws
 * itself between the master and what threatens them, and the healer keeps to the master's side. Returns
 * what it did, if anything.
 * @param {Player} player @param {Entity} entity @param {Member} member @param {number} [now]
 */
export function brain(player, entity, member, now = system.currentTick) {
  if (now < (dashReady.get(entity.id) ?? 0)) return "";
  const role = ROLES[Math.floor(member.look / 2)];
  const out = danger(entity.location);
  if (out) {
    dashReady.set(entity.id, now + 2 * TICKS);
    dash(entity, out, 1.1);
    fx.puff(entity.dimension, "streak", above(entity, 0.5), "none", 0.8);
    return "dodge";
  }
  if (!inCombat(player)) return "";
  const at = entity.location;
  const flat = (/** @type {Entity} */ e) => Math.hypot(e.location.x - at.x, e.location.z - at.z);
  if (role === "back") {
    const close = monstersNear(player, at, 3.5);
    if (close.length > 0) {
      const foe = close[0];
      const len = flat(foe) || 1;
      dashReady.set(entity.id, now + 3 * TICKS);
      dash(entity, { x: (at.x - foe.location.x) / len, z: (at.z - foe.location.z) / len }, 0.9);
      return "kite";
    }
  } else if (role === "front") {
    const guarded = [player, ...backLine(player)];
    for (const ally of guarded) {
      const threat = monstersNear(player, ally.location, 4).find((foe) => flat(foe) > 3 && flat(foe) < 14);
      if (!threat) continue;
      const len = flat(threat) || 1;
      dashReady.set(entity.id, now + 4 * TICKS);
      dash(entity, { x: (threat.location.x - at.x) / len, z: (threat.location.z - at.z) / len }, Math.min(1.6, len * 0.18));
      return "intercept";
    }
  } else if (role === "support") {
    const gap = Math.hypot(player.location.x - at.x, player.location.z - at.z);
    if (gap > 8) {
      dashReady.set(entity.id, now + 3 * TICKS);
      dash(entity, { x: (player.location.x - at.x) / gap, z: (player.location.z - at.z) / gap }, Math.min(1.5, gap * 0.12));
      return "regroup";
    }
  }
  return "";
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
    say(player, member, `${lineFor(member, "low")} §7(falling back)`, 20);
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

// Between upkeep passes the party gets another chance to act, so attacks come about once a second.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      partyOf(player).forEach((member, index) => {
        if (!member.out || recovering(player, index) > 0) return;
        const entity = entitiesOf(player, index)[0];
        if (entity) useSkill(player, entity, member);
      });
    } catch {
      // player is leaving
    }
  }
}, TICKS);

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
      `\nRole: §e${ROLE_NAMES[/** @type {keyof typeof ROLE_NAMES} */ (ROLES[vocation])]}§r` +
      `\nTemper: §e${PERSONAS[/** @type {keyof typeof PERSONAS} */ (personaOf(member))].name}§r` +
      `\nTactic: §e${TACTICS[member.tactic]}§r - ${TACTIC_HELP[member.tactic]}` +
      `\nTraits: ${member.traits.length > 0 ? member.traits.map((key) => TRAITS.find((t) => t.key === key)?.name).join(", ") : "none"} (${member.traits.length}/${traitSlots(level)}; slots open at levels 10 and 30)` +
      `\nAttacks:\n` +
      (ATTACKS[vocation] ?? []).map((a) => `${level >= a.level ? "§a" : "§8"}${a.name}§r - ${a.help}${level >= a.level ? "" : ` §8(level ${a.level})§r`}`).join("\n") +
      (vocation === 4 ? `\n${level >= CUTPURSE_LEVEL ? "§a" : "§8"}Cutpurse§r - one kill in five turns up a Gold Coin${level >= CUTPURSE_LEVEL ? "" : ` §8(level ${CUTPURSE_LEVEL})§r`}` : "")
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
