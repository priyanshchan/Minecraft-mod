// Overlord: Tomb of Nazarick - the party.
// Every player can raise one retainer of their own (name, look and vocation of their
// choice) and hire up to three mercenaries. Retainers follow a stance set by the player
// (Come / Go / Stay) and a tactic of their own, use vocation skills, call out what they
// know about foes, and return a while after they fall. The player's own retainer levels
// with its master; mercenaries earn XP. Fighting together builds a bond with each member
// that strengthens its skills and shortens its recovery. Hurt members fall back, drink the
// master's potions and rest between fights; archers scout for camps.
//
// v11: eight vocations and thirty-two looks, men and women (classes.js); a path at level 30 and a mastery at 60,
// with a new art every ten levels to 100 (arts.js); companions defend their master unbidden, choose their arts by
// need, and can be talked to, gifted, ordered and high-fived by using them.
import { world, system, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { creditedPlayer, giveItem, healPlayer, isElite, killXp, MAX_LEVEL, notify, profileOf, registerMenu, standingOf, TIPS, touch, xpForNext } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import { rumour } from "./structures.js";
import * as fx from "./vfx.js";
import * as skills from "./skills.js";
import { fights, hazards } from "./bosses.js";
import * as classes from "./classes.js";
import * as arts from "./arts.js";

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
export const TACTICS = ["Vanguard", "Guardian", "Free hand", "Hold fire"];
const TACTIC_HELP = [
  "strikes the foe you are fighting, and on its own any monster that comes near you",
  "strikes whatever last hurt you or the party first, then anything near you",
  "picks its own foe: whatever hurts you, elites and staggered foes first",
  "starts no fights: strikes only what attacks you or the party",
];
const STANCES = /** @type {const} */ (["come", "go", "stay"]);
const STANCE_HELP = {
  come: "Come - stay close and defend",
  go: "Go - range ahead and attack monsters on sight",
  stay: "Stay - hold this spot",
};

export const VOCATIONS = classes.VOCATIONS.map((v) => v.name);
const VOC_KEYS = classes.VOCATIONS.map((v) => v.key);
/** The thirty-two looks (v11: women of every vocation, Monks and Necromancers); each belongs to one vocation. */
export const LOOKS = classes.LOOKS.map((look) => look.name);
/** Gold Coins to unlearn a companion's path and mastery and choose again. */
export const RETRAIN_COST = 25;

/** Traits a member can be given: one from level 10 and a second from level 30. */
export const TRAITS = [
  { key: "sturdy", name: "Sturdy", help: "+4 hearts" },
  { key: "keen", name: "Keen", help: "skills hit 15% harder" },
  { key: "swift", name: "Swift", help: "skills recharge 15% faster" },
  { key: "devoted", name: "Devoted", help: "the bond grows twice as fast" },
  { key: "scavenger", name: "Scavenger", help: "one kill in ten turns up a Gold Coin" },
  { key: "resolute", name: "Resolute", help: "returns in half the time after falling" },
  { key: "lucky", name: "Lucky", help: "one kill in twenty-five turns up a Data Crystal" }, // v10
  { key: "studious", name: "Studious", help: "a hired member learns twice as fast" }, // v10
];
export const GIFT_COST = 5; // Gold Coins for a gift, once a day per member
const GIFT_BOND = 5;
export const UNISON_COOLDOWN = 45; // seconds between Unison orders
const UNISON_POWER = 1.25;
const NAMES = ["Aria", "Borin", "Celia", "Dain", "Elsa", "Fenn", "Gwen", "Hale", "Iris", "Joss", "Kara", "Lund", "Mira", "Nils", "Orla", "Penn"];
/** Names for hired companions, by the look's sex (v11). */
const MEN = ["Borin", "Dain", "Fenn", "Hale", "Joss", "Lund", "Nils", "Penn", "Aldo", "Bram", "Cael", "Doran", "Edric", "Garr", "Ivo", "Kestrel"];
const WOMEN = ["Aria", "Celia", "Elsa", "Gwen", "Iris", "Kara", "Mira", "Orla", "Brenna", "Dagny", "Freya", "Ilse", "Lyra", "Nessa", "Runa", "Sigrid"];

/** Element a mage retainer reaches for against particular foes. */
const WEAK_TO = arts.WEAK_TO;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/**
 * @typedef {{ name: string, look: number, gear: number, hired: boolean, level: number, out: boolean, xp: number, bond: number,
 *   tactic: number, traits: string[], gift: number, persona?: string, branch?: number, mastery?: number, talk?: number }} Member
 * branch and mastery: the path (level 30) and mastery (level 60) chosen, -1 for none yet; talk: the day it was last talked to.
 */

// ------------------------------------------------------------------- v8.7: who they are and how they fight

/** Each member's temper colours what they say in battle. */
export const PERSONAS = {
  brave: { name: "Brave", start: ["For the Master!", "Stand fast - they will break on us!", "Here they come. Good."], elite: ["A worthy foe, felled!", "That one fought well. Not well enough."], low: ["It is only a scratch!", "I will not fall here!"],
    win: ["Another battle won for Nazarick!", "Is that all they had?", "Victory, Master!"], greet: ["At your side, Master.", "I am here. Point me at the enemy."],
    idle: ["My blade grows restless, Master.", "I could march all night.", "Every day at your side is a day well spent."], learn: ["A new art! Let them come.", "I am stronger than yesterday."],
    talk: ["I trained before dawn again. One day I will stand beside the Floor Guardians.", "They say the Warrior-Captain fought with six blades of light. I mean to see it.", "If the Master asked, I would charge a dragon. Please do not ask."] },
  cautious: { name: "Cautious", start: ["Careful, Master - more than one.", "Stay close. Watch the flanks.", "I count several. Let us be wise."], elite: ["Done. Let us not meet another like it.", "We were lucky there, Master."], low: ["Too close - I am pulling back!", "I need a moment!"],
    win: ["That is the last of them, I think.", "Clear. Let us catch our breath.", "We came through. Good."], greet: ["Ah, Master. I was keeping watch.", "Here. I have checked the way ahead."],
    idle: ["Something is watching us. Or I am tired.", "We should rest before nightfall.", "I counted our potions. We could use more."], learn: ["A new art. I will practise it before I trust it.", "Another trick learned. Good to have."],
    talk: ["I keep a map of every road we have walked. Just in case.", "The Theocracy has eyes everywhere, Master. I would rather not meet them.", "Thank you for not charging into that last cave. I appreciated it."] },
  cheerful: { name: "Cheerful", start: ["Oh, company! Let us say hello!", "Ready when you are, Master!", "This should be fun!"], elite: ["Ha! Did you see that, Master?", "And that is how it is done!"], low: ["Ouch, ouch, ouch!", "That one stung!"],
    win: ["We did it! High five!", "Ha! Too easy!", "That was amazing, Master!"], greet: ["Master! I missed you!", "Hello hello! Where are we off to?"],
    idle: ["Do you think the maids of Nazarick ever get a day off?", "I could go for a meat pie right now.", "Look at that sky, Master!"], learn: ["Oh! Oh! I learned something new!", "Watch this, Master - a brand new art!"],
    talk: ["I tried to cook stew yesterday. The stew won.", "If I ever meet Lady Shalltear I am asking where she got that dress.", "You are the best master anyone ever had. I mean it!"] },
  stoic: { name: "Stoic", start: ["Engaging.", "As you command.", "Hostiles ahead."], elite: ["It is finished.", "Threat removed."], low: ["Wounded. Continuing.", "Pain is irrelevant."],
    win: ["Area secure.", "Enemies neutralised.", "Done."], greet: ["Present.", "Awaiting orders."],
    idle: ["...", "All quiet.", "I am listening, Master."], learn: ["Art acquired.", "Ready to apply it."],
    talk: ["I do not talk much. I listen.", "Your orders have been sound. I will follow them.", "There is a stillness in fighting well. You know it too."] },
};
const PERSONA_KEYS = Object.keys(PERSONAS);
/** How each vocation fights: front holds the line, back keeps its distance, support stays by the master, flank goes behind. */
export const ROLES = classes.VOCATIONS.map((v) => v.role);
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
const VOC_ELEMENT = classes.VOCATIONS.map((v) => v.element);
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

/** The vocation a member belongs to (from its look). @param {{ look: number }} member */
export function vocOf(member) {
  return classes.LOOKS[member.look]?.voc ?? 0;
}

/** The path (-1 for none) and mastery (-1 for none) a member has chosen. @param {{ branch?: number, mastery?: number }} member */
function pathOf(member) {
  const branch = member.branch === 0 || member.branch === 1 ? member.branch : -1;
  const mastery = branch >= 0 && (member.mastery === 0 || member.mastery === 1) ? member.mastery : -1;
  return { branch, mastery };
}

/** The role a member fights in, by its vocation and path. @param {{ look: number, branch?: number, mastery?: number }} member */
export function roleOf(member) {
  const { branch, mastery } = pathOf(member);
  return classes.roleOf(vocOf(member), branch, mastery);
}

/** The class a member goes by: its mastery's, its path's or its vocation's name. @param {{ look: number, branch?: number, mastery?: number }} member */
export function classOf(member) {
  const { branch, mastery } = pathOf(member);
  return classes.className(vocOf(member), branch, mastery);
}

/** A member's temper; older members are given one from their name. @param {Member} member */
export function personaOf(member) {
  if (member.persona && member.persona in PERSONAS) return member.persona;
  let h = 0;
  for (const ch of member.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSONA_KEYS[h % PERSONA_KEYS.length];
}

/** One of a member's lines for a moment. @param {Member} member @param {"start" | "elite" | "low" | "win" | "greet" | "idle" | "learn" | "talk"} moment @param {() => number} [random] */
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
    const path = pathOf(m); // v11: a path from level 30 and a mastery from 60
    m.branch = path.branch;
    m.mastery = path.mastery;
    m.talk = Number.isFinite(Number(m.talk)) ? Math.floor(Number(m.talk)) : -1;
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
  const vocations = active.map((m) => vocOf(m));
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
  const lookNo = Math.min(LOOKS.length - 1, Math.max(0, Math.floor(look) || 0));
  if (existing) {
    if (vocOf(existing) !== vocOf({ look: lookNo })) {
      existing.branch = -1; // a new vocation starts its paths afresh
      existing.mastery = -1;
    }
    existing.name = clean;
    existing.look = lookNo;
    refresh(player, party.indexOf(existing));
  } else {
    if (party.length >= MAX_PARTY) return false;
    party.unshift({ name: clean, look: lookNo, gear: 0, hired: false, level: 1, out: true, xp: 0, bond: 0, tactic: 0, traits: [], gift: -1, branch: -1, mastery: -1, talk: -1 });
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
    const hireLevel = Math.min(MAX_LEVEL, Math.max(1, level + Math.floor(random() * 5) - 2));
    const look = Math.floor(random() * LOOKS.length) % LOOKS.length;
    const names = classes.LOOKS[look].sex === "f" ? WOMEN : MEN;
    // A seasoned mercenary has already walked a path, and past 60 mastered it.
    const roll = Math.floor(random() * 4) % 4;
    list.push({
      name: names[Math.floor(random() * names.length) % names.length],
      look,
      level: hireLevel,
      cost: Math.round((10 + hireLevel * 2) * discount),
      branch: hireLevel >= classes.BRANCH_AT ? roll % 2 : -1,
      mastery: hireLevel >= classes.MASTERY_AT ? Math.floor(roll / 2) : -1,
    });
  }
  return list;
}

/**
 * Hires a mercenary. Returns a message describing the outcome.
 * @param {Player} player @param {{ name: string, look: number, level: number, cost: number, branch?: number, mastery?: number }} who
 */
export function hire(player, who) {
  const party = partyOf(player);
  if (party.length >= MAX_PARTY) return `§7Your party is full (${MAX_PARTY})`;
  if (countItem(player, COIN) < who.cost) return `§7${who.name} asks for ${who.cost} Gold Coins`;
  takeItem(player, COIN, who.cost);
  const level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(who.level)));
  const branch = level >= classes.BRANCH_AT && (who.branch === 0 || who.branch === 1) ? who.branch : -1;
  const mastery = branch >= 0 && level >= classes.MASTERY_AT && (who.mastery === 0 || who.mastery === 1) ? who.mastery : -1;
  party.push({ name: who.name, look: who.look, gear: 0, hired: true, level, out: true, xp: 0, bond: 0, tactic: 0, traits: [], gift: -1, branch, mastery, talk: -1 });
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
 * Sets a member on one of its vocation's two paths (from level 30), or - once on a path - one of the path's two
 * masteries (from level 60). Returns a message describing the outcome.
 * @param {Player} player @param {number} index @param {number} choice 0 or 1
 */
export function choosePath(player, index, choice) {
  const member = partyOf(player)[index];
  if (!member) return "§7No such party member";
  if (choice !== 0 && choice !== 1) return "§7No such path";
  const level = levelOf(player, member);
  const voc = classes.VOCATIONS[vocOf(member)];
  const branch = member.branch ?? -1;
  if (branch < 0) {
    if (level < classes.BRANCH_AT) return `§7${member.name} can choose a path from level ${classes.BRANCH_AT}`;
    member.branch = choice;
    member.mastery = -1;
    touch(player);
    const path = voc.branches[choice];
    announceLearned(player, member, `§a${member.name} walks the path of the §e${path.name}§a: ${path.help}`);
    return `§a${member.name} is now a ${path.name}`;
  }
  if ((member.mastery ?? -1) >= 0) return `§7${member.name} has already mastered a path - retrain to choose again`;
  if (level < classes.MASTERY_AT) return `§7${member.name} can master the path from level ${classes.MASTERY_AT}`;
  member.mastery = choice;
  touch(player);
  const mastery = voc.branches[branch].masteries[choice];
  announceLearned(player, member, `§a${member.name} becomes a §e${mastery.name}§a: ${mastery.help}`);
  return `§a${member.name} is now a ${mastery.name}`;
}

/**
 * Unlearns a member's path and mastery for Gold Coins so they can be chosen again.
 * @param {Player} player @param {number} index
 */
export function retrain(player, index) {
  const member = partyOf(player)[index];
  if (!member) return "§7No such party member";
  if ((member.branch ?? -1) < 0) return `§7${member.name} has not chosen a path yet`;
  if (countItem(player, COIN) < RETRAIN_COST) return `§7Retraining costs ${RETRAIN_COST} Gold Coins`;
  takeItem(player, COIN, RETRAIN_COST);
  member.branch = -1;
  member.mastery = -1;
  touch(player);
  return `§a${member.name} is ready to choose a path again`;
}

/** Tells the master and has the member cheer. @param {Player} player @param {Member} member @param {string} text */
function announceLearned(player, member, text) {
  player.sendMessage(`§6[Party] §f${text}`);
  const index = partyOf(player).indexOf(member);
  for (const entity of index >= 0 ? entitiesOf(player, index) : []) emote(entity, "cheer");
}

/**
 * The arts a member knows at its level, by its path (v11). Hand-made arts of the old party keep their effects.
 * @param {number} vocation @param {number} level @param {number} [branch] @param {number} [mastery]
 */
export function attacksKnown(vocation, level, branch = -1, mastery = -1) {
  return classes.artsFor(vocation, branch, mastery, level);
}

/** The arts a member knows now. @param {Player} player @param {Member} member */
export function artsOf(player, member) {
  const { branch, mastery } = pathOf(member);
  return attacksKnown(vocOf(member), levelOf(player, member), branch, mastery);
}

/** An art's name and description, the old party's hand-made ones included. @param {classes.Art} art */
export function artInfo(art) {
  if (art.kind !== "legacy") return { name: art.name, help: art.help, cd: art.cd };
  const legacy = legacyArt(art.key);
  return { name: legacy?.name ?? art.key, help: legacy?.help ?? "", cd: legacy?.cooldown ?? 10 };
}

/** The old party's arts that help rather than harm. */
const HELPING = new Set(["mend", "purify", "sanctuary", "blessing", "aegis", "cry", "ballad", "haste"]);
const HELPING_KINDS = new Set(["heal", "shield", "buff", "revive", "cleanse", "escape"]);

/** Whether an art does harm (and so needs a foe). @param {classes.Art} art */
function offensive(art) {
  if (art.kind === "legacy") return !HELPING.has(art.key);
  const kind = art.kind === "combo" ? art.parts?.[0]?.kind : art.kind;
  return !HELPING_KINDS.has(kind);
}

/** One of the old party's hand-made arts, by key. @param {string} key */
function legacyArt(key) {
  for (const kit of ATTACKS) {
    const found = kit.find((a) => a.key === key);
    if (found) return found;
  }
  return undefined;
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
  // v11: a wave on arriving, and now and then a word.
  system.runTimeout(() => {
    if (!entity.isValid || !player.isValid) return;
    emote(entity, "wave");
    if (system.currentTick - (greeted.get(player.id) ?? -1e9) > 120 * TICKS) {
      greeted.set(player.id, system.currentTick);
      say(player, member, lineFor(member, "greet"), 0); // a greeting never holds up a warning
    }
  }, 12);
  return entity;
}

/** @param {Player} player @param {Member} member */
function label(player, member) {
  return `${member.name} §7Lv.${levelOf(player, member)} ${classOf(member)}`;
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
/** The mob that last hurt one of each player's companions (v11). */
/** @type {Map<string, { entity: Entity, tick: number }>} */
const partyThreats = new Map();
/** `${playerId}|${foeId}` of neutral monsters that have turned on the master or the party. */
const angry = new Set();
/** Player id -> the foe the party is pressing hardest, so members pile onto one target. */
/** @type {Map<string, { id: string, tick: number }>} */
const focus = new Map();
/** Player id -> tick of their party's last greeting. */
const greeted = new Map();

/** Whether the player has fought within the last ten seconds. @param {Player} player */
function inCombat(player) {
  const now = system.currentTick;
  return now - (targets.get(player.id)?.tick ?? -1e9) <= FRESH || now - (threats.get(player.id)?.tick ?? -1e9) <= FRESH;
}

/**
 * The foe a member turns its skills on, according to its tactic (v11: every tactic but Hold fire also defends the
 * master on its own - any monster that comes near is fought without waiting to be told).
 * @param {Player} player @param {Entity} entity @param {Member} member
 * @returns {Entity | undefined}
 */
function pickFoe(player, entity, member) {
  const current = (/** @type {{ entity: Entity, tick: number } | undefined} */ mark) =>
    mark && system.currentTick - mark.tick <= FRESH && mark.entity.isValid ? mark.entity : undefined;
  const ordered = current(orders.get(player.id)); // a Unison order outranks every tactic
  if (ordered) return ordered;
  const target = current(targets.get(player.id));
  const threat = current(threats.get(player.id));
  const harmed = current(partyThreats.get(player.id));
  if (member.tactic === 3) return threat ?? harmed; // Hold fire
  if (member.tactic === 2) return bestFoe(player, entity, member) ?? threat ?? target;
  if (member.tactic === 1) return threat ?? harmed ?? target ?? bestFoe(player, entity, member);
  return target ?? threat ?? harmed ?? bestFoe(player, entity, member);
}

/**
 * A free hand weighs its choice (v8.7): whatever is hurting the master first, then elites and foes the party
 * has staggered; a Rogue or an Archer goes for the wounded it can finish; a Fighter for what is nearest the
 * master; and nearer is always better.
 * @param {Player} player @param {Entity} entity @param {Member} member
 * @returns {Entity | undefined}
 */
export function bestFoe(player, entity, member) {
  const near = monstersNear(player, entity.location, 12);
  if (near.length === 0) return undefined;
  const threat = threats.get(player.id);
  const hunting = threat && system.currentTick - threat.tick <= FRESH ? threat.entity : undefined;
  const harm = partyThreats.get(player.id);
  const harming = harm && system.currentTick - harm.tick <= FRESH ? harm.entity : undefined;
  const role = roleOf(member);
  const vocation = vocOf(member);
  const pressed = focus.get(player.id);
  const leash = profileOf(player).stance === "go" ? 26 : 16; // foes far from the master are left be
  let best;
  let bestScore = -Infinity;
  for (const foe of near) {
    if (!foe.isValid) continue;
    const fromMaster = Math.hypot(foe.location.x - player.location.x, foe.location.z - player.location.z);
    if (fromMaster > leash && !(hunting && foe.id === hunting.id) && !(harming && foe.id === harming.id)) continue;
    let score = -Math.hypot(foe.location.x - entity.location.x, foe.location.z - entity.location.z);
    if (hunting && foe.id === hunting.id) score += 30;
    if (harming && foe.id === harming.id) score += 12;
    if (pressed && pressed.id === foe.id && system.currentTick - pressed.tick <= FRESH) score += 10; // pile on together
    try {
      if (isElite(foe)) score += 20;
    } catch {
      // no mark
    }
    if (isStaggered(foe)) score += 15;
    if (vocation === 1 || vocation === 4 || role === "flank") {
      try {
        const health = foe.getComponent("minecraft:health");
        if (health && health.effectiveMax > 0 && health.currentValue / health.effectiveMax < 0.35) score += 20;
      } catch {
        // unreadable
      }
    }
    if (role === "front" || role === "support") score -= fromMaster;
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
    return player.dimension.getEntities({ location: at, maxDistance: radius, families: ["monster"] }).filter((e) => isFoe(player, e));
  } catch {
    return [];
  }
}

/** Monsters the party leaves alone unless they start it: striking them would turn a whole crowd on the master. */
const NEUTRAL = new Set(["minecraft:zombie_pigman", "minecraft:enderman", "minecraft:piglin"]);

/** Whether the party should fight an entity of the monster family (v11). @param {Player} player @param {Entity} e */
function isFoe(player, e) {
  try {
    if (!e.isValid) return false;
    if (e.hasTag("overlord_summoned") || e.hasTag("overlord_retainer") || e.hasTag("overlord_raised")) return false;
    if (NEUTRAL.has(e.typeId)) return angry.has(`${player.id}|${e.id}`);
    return true;
  } catch {
    return false;
  }
}

world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    if (attacker && attacker.isValid && victim.typeId === "minecraft:player" && attacker.typeId !== "minecraft:player" && attacker.typeId !== RETAINER) {
      if (attacker.hasTag("overlord_summoned")) return; // a stray blow from an ally
      threats.set(victim.id, { entity: attacker, tick: system.currentTick }); // Guardians answer this
      if (NEUTRAL.has(attacker.typeId)) angry.add(`${victim.id}|${attacker.id}`);
      return;
    }
    if (victim.typeId === RETAINER && victim.isValid) {
      // v11: whatever hurts a companion is the whole party's foe, and the companion flinches.
      const owner = victim.getDynamicProperty("overlord:owner");
      if (attacker && attacker.isValid && attacker.typeId !== "minecraft:player" && attacker.typeId !== RETAINER && typeof owner === "string" && !attacker.hasTag("overlord_summoned")) {
        partyThreats.set(owner, { entity: attacker, tick: system.currentTick });
        arts.noteHurt(victim.id, attacker.id);
        if (NEUTRAL.has(attacker.typeId)) angry.add(`${owner}|${attacker.id}`);
      }
      if (event.damage >= 2 && system.currentTick >= (flinchReady.get(victim.id) ?? 0)) {
        flinchReady.set(victim.id, system.currentTick + 2 * TICKS);
        emote(victim, "hurt");
      }
      return;
    }
    if (!attacker || attacker.typeId !== "minecraft:player" || !victim.isValid) return;
    if (victim.typeId === "minecraft:player" || victim.typeId === RETAINER) return;
    const player = /** @type {Player} */ (attacker);
    targets.set(player.id, { entity: victim, tick: system.currentTick });
    if (NEUTRAL.has(victim.typeId)) angry.add(`${player.id}|${victim.id}`); // the master started it
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
/** Entity id -> which of its arts it used last, so the next one is a different one. */
/** @type {Map<string, string>} */
const lastUsed = new Map();
/** Entity id -> tick before which it will not call out another great art. */
const shoutReady = new Map();
/** Entity id -> tick before which it will not flinch again. */
const flinchReady = new Map();

/** @param {Entity} entity @param {number} y */
function above(entity, y) {
  return { x: entity.location.x, y: entity.location.y + y, z: entity.location.z };
}

/** A healer mends its master below this share of their health, and other companions below the second. */
export const MEND_MASTER_AT = 0.85;
export const MEND_ALLY_AT = 0.6;

/**
 * The ally a healer should mend: whoever of the master and the rest of the party has lost the largest share of their
 * health, if the master has lost more than a seventh (healers keep their master topped up) or a companion two fifths.
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
      const at = ally.id === player.id ? MEND_MASTER_AT : MEND_ALLY_AT;
      if (share < at && (!worst || share < worst.share)) worst = { entity: ally, health, share };
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
 *   masterHealth: import("@minecraft/server").EntityHealthComponent | undefined, near: boolean, voc?: number,
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
    target.applyDamage(amount * t.power * (open ? OPENING : 1) * arts.markOf(target), { cause: EntityDamageCause[cause], damagingEntity: t.entity });
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
      const amount = (6 + t.level * 0.15) * t.power;
      if (patient.entity.id === t.player.id) healPlayer(t.player, amount);
      else patient.health.setCurrentValue(Math.min(patient.health.effectiveMax, patient.health.currentValue + amount));
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
      healPlayer(t.player, (12 + t.level * 0.25) * t.power);
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
 * @param {Player} player @param {Entity} entity @param {Member} member @param {classes.Art} art @param {number} vocation @param {number} now
 */
function perform(player, entity, member, art, vocation, now) {
  const pose = art.kind === "legacy" ? POSES[art.key] : arts.poseOf(art, vocation);
  try {
    if (pose) entity.playAnimation(pose, { blendOutTime: 0.2 });
  } catch {
    // poses are cosmetic
  }
  if (art.kind !== "legacy" && art.at >= 60 && system.currentTick >= (shoutReady.get(entity.id) ?? 0)) {
    shoutReady.set(entity.id, system.currentTick + 20 * TICKS); // the great arts are called out by name
    say(player, member, `${art.name}!`, 4, art.at === 100);
  }
  fx.flash(player.dimension, above(entity, 1.3), VOC_ELEMENT[vocation] ?? "none", 0.7);
  if (now - (lastBattle.get(player.id) ?? -1e9) > 30 * TICKS) say(player, member, lineFor(member, "start"), 10);
  lastBattle.set(player.id, now);
}

/**
 * Lets one retainer act (v11): it weighs every art it knows that is ready - need first (the hurt healed, the party
 * shielded before a boss's blow), then how many foes an art would catch and how strong it is - and uses the best
 * one that has something to do. Returns the name of the art used, if any.
 * @param {Player} player @param {Entity} entity @param {Member} member
 */
export function useSkill(player, entity, member) {
  const now = system.currentTick;
  if (now < (busy.get(entity.id) ?? 0)) return undefined;
  const vocation = vocOf(member);
  const level = levelOf(player, member);
  const known = artsOf(player, member);
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
    voc: vocation,
  };
  let mine = ready.get(entity.id);
  if (!mine) {
    mine = new Map();
    ready.set(entity.id, mine);
  }
  // With no foe of its own to fight (Hold fire, a quiet road), a member keeps to arts that help, so a sweep
  // or a burst does not start a fight the master did not want.
  const waiting = known.filter((art) => now >= (mine.get(art.key) ?? 0) && (foe || !offensive(art)));
  if (waiting.length === 0) return undefined;
  const sense = arts.senseOf(turn, lastUsed.get(entity.id));
  const ranked = waiting.map((art) => ({ art, value: arts.score(turn, art, sense) })).sort((a, b) => b.value - a.value);
  for (const { art, value } of ranked.slice(0, 6)) {
    if (value <= -50) break; // nothing left worth trying
    let used = false;
    try {
      used = arts.use(turn, art);
    } catch {
      used = false; // the target vanished mid-attack
    }
    if (!used) continue;
    const info = artInfo(art);
    mine.set(art.key, now + Math.round(info.cd * haste * TICKS));
    busy.set(entity.id, now + Math.round(ATTACK_GAP * haste));
    perform(player, entity, member, art, vocation, now);
    lastUsed.set(entity.id, art.key);
    if (foe) focus.set(player.id, { id: foe.id, tick: now });
    return info.name;
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
  fightKills.set(player.id, (fightKills.get(player.id) ?? 0) + 1);
  const xp = killXp(dead);
  const bond = isElite(dead) ? 3 : 1;
  let changed = false;
  let coins = 0;
  let crystals = 0;
  party.forEach((member, index) => {
    if (!member.out || recovering(player, index) > 0) return;
    changed = true;
    const growth = bond * (hasTrait(player, member, "devoted") ? 2 : 1) * skills.bondFactor(profileOf(player)); // Bonds of Loyalty
    addBond(player, member, Math.floor(growth) + (random() < growth % 1 ? 1 : 0));
    if (hasTrait(player, member, "scavenger") && random() < 0.1) coins += 1;
    if (hasTrait(player, member, "lucky") && random() < 0.04) crystals += 1;
    if (vocOf(member) === 4 && levelOf(player, member) >= CUTPURSE_LEVEL && random() < 0.2) coins += 1; // Cutpurse
    if (member.hired && member.level < MAX_LEVEL) {
      member.xp += Math.round(xp * MERC_SHARE * (hasTrait(player, member, "studious") ? 2 : 1));
      const start = member.level;
      while (member.level < MAX_LEVEL && member.xp >= xpForNext(member.level)) {
        member.xp -= xpForNext(member.level);
        member.level += 1;
      }
      if (member.level >= MAX_LEVEL) member.xp = 0;
      if (member.level > start) {
        player.sendMessage(`§6[Party] §b${member.name}§f has reached level §6${member.level}§f.`);
        for (const entity of entitiesOf(player, index)) emote(entity, "cheer");
      }
    }
  });
  if (crystals > 0) {
    giveItem(player, id("data_crystal"), crystals);
    notify(player, "§bYour lucky companion found a Data Crystal");
  }
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
        growth(player, entity, member, index);
      } catch {
        // entity is unloading
      }
    }
  });
  scout(player);
  nightfall(player);
  afterBattle(player);
  idle(player);
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
    if (roleOf(member) === "back") out.push(...entitiesOf(player, index));
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
  const role = roleOf(member);
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
  } else if (role === "flank") {
    // v11: a flanker slips round to the far side of the foe the master is facing, where it is open.
    const mark = targets.get(player.id) ?? threats.get(player.id);
    const foe = mark && now - mark.tick <= FRESH && mark.entity.isValid ? mark.entity : undefined;
    if (foe) {
      const fx0 = foe.location.x - player.location.x;
      const fz0 = foe.location.z - player.location.z;
      const flen = Math.hypot(fx0, fz0) || 1;
      const spot = { x: foe.location.x + (fx0 / flen) * 2, z: foe.location.z + (fz0 / flen) * 2 };
      const gap = Math.hypot(spot.x - at.x, spot.z - at.z);
      if (gap > 2.5 && gap < 16) {
        dashReady.set(entity.id, now + 3 * TICKS);
        dash(entity, { x: (spot.x - at.x) / gap, z: (spot.z - at.z) / gap }, Math.min(1.4, gap * 0.16));
        return "flank";
      }
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
  if (!back && share < 0.3 && roleOf(member) !== "front") {
    entity.setDynamicProperty("overlord:back", true);
    entity.triggerEvent(`${NS}:fall_back`);
    say(player, member, `${lineFor(member, "low")} §7(falling back)`, 20);
  } else if (back && share >= 0.6) {
    entity.setDynamicProperty("overlord:back", false);
    entity.triggerEvent(`${NS}:rally_${VOC_KEYS[vocOf(member)]}`); // back to the vocation's own way of fighting
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
  const archer = partyOf(player).find((m, i) => m.out && vocOf(m) === 1 && recovering(player, i) === 0);
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

// ------------------------------------------------------------------- v11: life with the party

/** The emotes a companion can make, and the pose each one plays. */
export const EMOTES = {
  wave: { name: "Wave", pose: "animation.overlord.party_wave" },
  bow: { name: "Bow", pose: "animation.overlord.party_bow" },
  cheer: { name: "Cheer", pose: "animation.overlord.party_cheer" },
  dance: { name: "Dance", pose: "animation.overlord.party_dance" },
  laugh: { name: "Laugh", pose: "animation.overlord.party_laugh" },
  salute: { name: "Salute", pose: "animation.overlord.party_salute" },
  sit: { name: "Sit and rest", pose: "animation.overlord.party_sit" },
  highfive: { name: "High five", pose: "animation.overlord.party_highfive" },
  victory: { name: "Victory", pose: "animation.overlord.party_victory" },
  hurt: { name: "Flinch", pose: "animation.overlord.party_hurt" },
  think: { name: "Think", pose: "animation.overlord.party_think" },
};
const EMOTE_MENU = /** @type {const} */ (["wave", "bow", "cheer", "dance", "laugh", "salute", "sit", "think"]);

/** Plays an emote on a companion; sitting lasts until it moves. @param {Entity} entity @param {keyof typeof EMOTES} key */
export function emote(entity, key) {
  const pose = EMOTES[key]?.pose;
  if (!pose) return false;
  try {
    if (key === "sit") entity.playAnimation(pose, { blendOutTime: 0.3, stopExpression: "query.ground_speed > 0.4 || query.is_on_fire" });
    else entity.playAnimation(pose, { blendOutTime: 0.25 });
    return true;
  } catch {
    return false; // cosmetic only
  }
}

/** `${playerId}|${index}` -> how many arts a member knew when last seen, to announce new ones. */
const knownCount = new Map();
/** `${playerId}|${index}` -> the path reminder already given (30 or 60). */
const pathNagged = new Map();

/**
 * A member's growth, seen each pass: a new art is announced with a cheer, and a member who has reached level 30
 * or 60 without choosing its path is reminded once.
 * @param {Player} player @param {Entity} entity @param {Member} member @param {number} index
 */
function growth(player, entity, member, index) {
  const key = `${player.id}|${index}|${member.name}`;
  const known = artsOf(player, member);
  const before = knownCount.get(key);
  knownCount.set(key, known.length);
  if (before !== undefined && known.length > before) {
    const fresh = known.slice(before).map((art) => artInfo(art).name);
    player.sendMessage(`§6[Party] §b${member.name}§f has learned §e${fresh.join("§f, §e")}§f.`);
    emote(entity, "cheer");
    say(player, member, lineFor(member, "learn"), 8, true);
  }
  const level = levelOf(player, member);
  const { branch, mastery } = pathOf(member);
  const due = branch < 0 && level >= classes.BRANCH_AT ? classes.BRANCH_AT : branch >= 0 && mastery < 0 && level >= classes.MASTERY_AT ? classes.MASTERY_AT : 0;
  if (due > 0 && pathNagged.get(key) !== due) {
    pathNagged.set(key, due);
    player.sendMessage(`§6[Party] §b${member.name}§f is ready to choose ${due === classes.BRANCH_AT ? "a path" : "a mastery"}: open the party menu (or use them) and pick one - it brings new arts.`);
  }
}

/** Player id -> kills made since the party went into battle. */
const fightKills = new Map();
/** Player id -> whether the party was in battle at the last pass. */
const wasFighting = new Map();

/** When a fight ends in victory the party celebrates. @param {Player} player */
function afterBattle(player) {
  const fighting = inCombat(player);
  const was = wasFighting.get(player.id) ?? false;
  wasFighting.set(player.id, fighting);
  if (fighting || !was) return;
  const kills = fightKills.get(player.id) ?? 0;
  fightKills.set(player.id, 0);
  if (kills < 2) return; // a single stray mob is no victory worth the name
  const awake = partyOf(player).filter((m, i) => m.out && recovering(player, i) === 0);
  if (awake.length === 0) return;
  partyOf(player).forEach((member, index) => {
    if (!member.out || recovering(player, index) > 0) return;
    for (const entity of entitiesOf(player, index)) emote(entity, index % 2 === 0 ? "victory" : "cheer");
  });
  say(player, awake[system.currentTick % awake.length], lineFor(awake[system.currentTick % awake.length], "win"), 10);
}

/** Player id -> tick of the party's next idle moment. */
const idleAt = new Map();
/** Players whose party has sat down while they sleep. */
const asleep = new Set();
const IDLE_EVERY = 240; // seconds between quiet moments on the road

/**
 * On a quiet road a member now and then speaks its mind or stretches; when the master sleeps or stands still at
 * night, the party sits down to rest.
 * @param {Player} player
 */
function idle(player) {
  const now = system.currentTick;
  const due = idleAt.get(player.id);
  if (due === undefined) {
    idleAt.set(player.id, now + IDLE_EVERY * TICKS);
    return;
  }
  if (inCombat(player)) {
    idleAt.set(player.id, Math.max(due, now + 30 * TICKS));
    return;
  }
  let sleeping = false;
  try {
    sleeping = player.isSleeping === true;
  } catch {
    sleeping = false;
  }
  const party = partyOf(player);
  const wasSleeping = asleep.has(player.id);
  if (sleeping) {
    if (!wasSleeping) {
      asleep.add(player.id); // sat down once, and they stay sat until they move
      party.forEach((member, index) => {
        if (member.out) for (const entity of entitiesOf(player, index)) emote(entity, "sit");
      });
    }
    return;
  }
  asleep.delete(player.id);
  if (now < due) return;
  idleAt.set(player.id, now + IDLE_EVERY * TICKS);
  const awake = party.filter((m, i) => m.out && recovering(player, i) === 0);
  if (awake.length === 0) return;
  const pick = (now / TICKS) % awake.length | 0;
  const member = awake[pick];
  const entity = entitiesOf(player, party.indexOf(member))[0];
  if (!entity) return;
  const night = world.getTimeOfDay() > 13000 && world.getTimeOfDay() < 23000;
  emote(entity, night ? "sit" : /** @type {const} */ (["think", "laugh", "dance"])[pick % 3]);
  say(player, member, lineFor(member, "idle"), 20);
}

/** Talks with a member: a word from it, and the bond grows a little once a day. @param {Player} player @param {number} index */
export function talk(player, index) {
  const member = partyOf(player)[index];
  if (!member) return "§7No such party member";
  const lines = [...PERSONAS[/** @type {keyof typeof PERSONAS} */ (personaOf(member))].talk];
  const level = levelOf(player, member);
  const { branch, mastery } = pathOf(member);
  const health = player.getComponent("minecraft:health");
  if (health && health.currentValue < health.effectiveMax * 0.5) lines.push("You are hurt, Master. Let me watch the road while you rest.");
  if (branch < 0 && level >= classes.BRANCH_AT) lines.push(`I have been thinking about my path, Master. ${classes.VOCATIONS[vocOf(member)].branches.map((b) => `The ${b.name}`).join(" or the ")}?`);
  if (mastery >= 0) lines.push(`Being a ${classOf(member)} suits me. Thank you for believing in me.`);
  if (bondRank(member) >= 3) lines.push("I would follow you into the Great Tomb itself. I think I already have.");
  if (world.getTimeOfDay() > 13000 && world.getTimeOfDay() < 23000) lines.push("The stars are bright tonight. Do they look the same from Nazarick?");
  const line = lines[(system.currentTick + member.name.length) % lines.length];
  player.sendMessage(`§b<${member.name}>§f ${line}`);
  for (const entity of entitiesOf(player, index)) {
    try {
      entity.playAnimation("animation.overlord.party_talk", { blendOutTime: 0.2 });
    } catch {
      // cosmetic only
    }
  }
  const day = world.getDay();
  if (member.talk !== day) {
    member.talk = day;
    addBond(player, member, 1);
    touch(player);
  }
  return "";
}

/** Player|member -> tick of the next high five that counts towards the bond. */
const fiveReady = new Map();

/** A high five with a member: both hands up, a cheer, and a little bond now and then. @param {Player} player @param {number} index */
export function highFive(player, index) {
  const member = partyOf(player)[index];
  if (!member) return "§7No such party member";
  for (const entity of entitiesOf(player, index)) {
    emote(entity, "highfive");
    fx.spark(player.dimension, above(entity, 1.9), "holy", 0.8);
  }
  try {
    player.playAnimation("animation.overlord.party_highfive", { blendOutTime: 0.2 });
    player.playSound("random.orb", { volume: 0.8, pitch: 1.4 });
  } catch {
    // cosmetic only
  }
  const key = `${player.id}|${index}`;
  if (system.currentTick >= (fiveReady.get(key) ?? 0)) {
    fiveReady.set(key, system.currentTick + 300 * TICKS);
    addBond(player, member, 1);
    touch(player);
  }
  return "§aHigh five!";
}

/** Has every member at the master's side make an emote. @param {Player} player @param {keyof typeof EMOTES} key */
export function emoteAll(player, key) {
  partyOf(player).forEach((member, index) => {
    if (member.out) for (const entity of entitiesOf(player, index)) emote(entity, key);
  });
}

// Using one of your own companions opens its menu; sneaking while you do gives it a high five.
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const target = event.target;
  if (target.typeId !== RETAINER) return;
  const player = event.player;
  let owner;
  let slot;
  try {
    owner = target.getDynamicProperty("overlord:owner");
    slot = target.getDynamicProperty("overlord:slot");
  } catch {
    return;
  }
  if (owner !== player.id || typeof slot !== "number") return;
  const held = event.itemStack?.typeId;
  if (held === POTION || held === "minecraft:bread") return; // feeding heals it, as before
  event.cancel = true;
  const sneaking = player.isSneaking;
  system.run(() => {
    try {
      if (!player.isValid) return;
      if (sneaking) notify(player, highFive(player, slot));
      else openCompanion(player, slot);
    } catch (error) {
      console.warn(`[Overlord] companion interaction failed: ${error}`);
    }
  });
});

/** Fallen members of a player's party, for arts that call them back. @param {Player} player */
function fallenCount(player) {
  return partyOf(player).filter((m, i) => m.out && recovering(player, i) > 0).length;
}

/** Calls up to `count` fallen members back at once (an art's doing, so free). @param {Player} player @param {number} count */
function reviveFallen(player, count) {
  let back = 0;
  partyOf(player).forEach((member, index) => {
    if (back >= count || !member.out || recovering(player, index) === 0) return;
    fallen.delete(`${player.id}|${index}`);
    back++;
  });
  if (back > 0) system.run(() => {
    try {
      if (player.isValid) tend(player);
    } catch {
      // player left
    }
  });
  return back;
}

/** Player id -> the companions found this tick, so the arts do not search the world again and again. */
/** @type {Map<string, { tick: number, list: Entity[] }>} */
const companionCache = new Map();

/** Every companion entity of a player now in the world. @param {Player} player */
function companionsOf(player) {
  const cached = companionCache.get(player.id);
  if (cached && cached.tick === system.currentTick) return cached.list.filter((e) => e.isValid);
  /** @type {Entity[]} */
  const out = [];
  for (let i = 0; i < MAX_PARTY; i++) out.push(...entitiesOf(player, i));
  companionCache.set(player.id, { tick: system.currentTick, list: out });
  return out;
}

arts.bind({
  hit: (t, target, amount, cause) => hit(/** @type {Turn} */ (t), target, amount, cause),
  foesNear: (player, at, radius) => monstersNear(player, at, radius),
  companions: companionsOf,
  stagger,
  say: (player, member, text, pause, urgent) => say(player, member, text, pause, urgent),
  fallen: fallenCount,
  revive: reviveFallen,
  inCombat,
  healPlayer,
  isElite: (e) => {
    try {
      if (isElite(e)) return true;
      const h = e.getComponent("minecraft:health");
      return Boolean(h && h.effectiveMax >= 200); // bosses count as elites too
    } catch {
      return false;
    }
  },
  coins: (player, count) => {
    giveItem(player, COIN, count);
    notify(player, `§6${count} Gold Coin${count === 1 ? "" : "s"} lifted from a foe`);
  },
  legacy: (key) => legacyArt(key),
  danger,
});

// Summons of the companions whose time ran out while the world was closed are swept away.
system.runInterval(() => {
  const seen = new Set();
  for (const player of world.getAllPlayers()) {
    try {
      if (seen.has(player.dimension.id)) continue;
      seen.add(player.dimension.id);
      arts.sweep(player.dimension);
    } catch {
      // player is leaving
    }
  }
}, 30 * TICKS);

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
    const tended = partyOf(owner).some((m, i) => i !== slot && m.out && vocOf(m) === 3 && recovering(owner, i) === 0);
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
  partyThreats.delete(event.playerId);
  focus.delete(event.playerId);
  greeted.delete(event.playerId);
  fightKills.delete(event.playerId);
  wasFighting.delete(event.playerId);
  idleAt.delete(event.playerId);
  asleep.delete(event.playerId);
  companionCache.delete(event.playerId);
  for (const key of [...angry]) if (key.startsWith(`${event.playerId}|`)) angry.delete(key);
  for (const key of [...knownCount.keys()]) if (key.startsWith(`${event.playerId}|`)) knownCount.delete(key);
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
  return `${member.name} - ${classOf(member)} (${LOOKS[member.look]}) Lv.${levelOf(player, member)}, gear ${member.gear}/${MAX_GEAR}${member.hired ? ", mercenary" : ""}, ${BOND_RANKS[bondRank(member)]}, ${TACTICS[member.tactic]} - ${state}§r`;
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
        `\nYour retainer levels with you; mercenaries earn half of your kill XP. Every companion learns a new art each ten levels up to 100, chooses a path at level ${classes.BRANCH_AT} and masters it at ${classes.MASTERY_AT}. ` +
        `Companions defend you on their own; set a member to Hold fire to keep it out of fights it did not start. Fighting together builds a bond that strengthens skills and shortens recovery. ` +
        `Three different vocations recharge skills a fifth faster; two of the same strike 15% harder. A Healer halves the time a fallen member is away, and an Archer scouts for camps. Use a companion to talk, give orders or emote (sneak to high five). Hold the Command Banner to see everyone's health; use it on a foe to order Unison - everyone strikes that foe at once (${UNISON_COOLDOWN} s).`
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
    add("Party emote\nEveryone at your side", () => openEmotes(player, -1));
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
    .dropdown("Look and vocation", classes.LOOKS.map((look) => `${look.name} (${VOCATIONS[look.voc]}, ${look.sex === "f" ? "woman" : "man"})`), {
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

/** Every art a member's vocation teaches, marked known, next, or on another path. @param {Player} player @param {Member} member */
function artList(player, member) {
  const level = levelOf(player, member);
  const { branch, mastery } = pathOf(member);
  const voc = classes.VOCATIONS[vocOf(member)];
  const lines = [];
  for (const { art, branch: b, mastery: m } of classes.treeOf(vocOf(member))) {
    const onPath = b < 0 || (b === branch && (m < 0 || m === mastery));
    const open = b < 0 ? true : branch < 0 ? true : b === branch && (m < 0 || mastery < 0 || m === mastery);
    if (!open) continue; // another path's arts are left out once a path is chosen
    const info = artInfo(art);
    const where = b < 0 ? "" : m < 0 ? ` §8[${voc.branches[b].name}]` : ` §8[${voc.branches[b].masteries[m].name}]`;
    const known = onPath && level >= art.at && (b < 0 || branch >= 0) && (m < 0 || mastery >= 0);
    lines.push(`${known ? "§a" : "§8"}Lv.${art.at} ${info.name}§r${where} - ${info.help}`);
  }
  return lines.join("\n");
}

/** @param {Player} player @param {number} index */
function openMember(player, index) {
  const member = partyOf(player)[index];
  if (!member) return openParty(player);
  const level = levelOf(player, member);
  const rank = bondRank(member);
  const vocation = vocOf(member);
  const { branch, mastery } = pathOf(member);
  const voc = classes.VOCATIONS[vocation];
  const pathLine =
    branch < 0
      ? level >= classes.BRANCH_AT ? "§eready to choose a path§r" : `chooses a path at level ${classes.BRANCH_AT}`
      : `${voc.branches[branch].name}${mastery >= 0 ? ` > ${voc.branches[branch].masteries[mastery].name}` : level >= classes.MASTERY_AT ? " §e(ready to choose a mastery)§r" : ` (mastery at level ${classes.MASTERY_AT})`}`;
  const form = new ActionFormData().title(member.name).body(
    describe(player, member, index) +
      `\n\nVocation: §e${voc.name}§r - ${voc.blurb}` +
      `\nPath: ${pathLine}` +
      `\nBond: §e${BOND_RANKS[rank]}§r (${member.bond}/${MAX_BOND}) - skills +${Math.round(rank * BOND_POWER * 100)}%, returns ${recoveryOf(member)} s after falling` +
      (member.hired ? `\nXP: ${level >= MAX_LEVEL ? "max level" : `${member.xp}/${xpForNext(level)}`}` : "") +
      `\nRole: §e${ROLE_NAMES[/** @type {keyof typeof ROLE_NAMES} */ (roleOf(member))]}§r` +
      `\nTemper: §e${PERSONAS[/** @type {keyof typeof PERSONAS} */ (personaOf(member))].name}§r` +
      `\nTactic: §e${TACTICS[member.tactic]}§r - ${TACTIC_HELP[member.tactic]}` +
      `\nTraits: ${member.traits.length > 0 ? member.traits.map((key) => TRAITS.find((t) => t.key === key)?.name).join(", ") : "none"} (${member.traits.length}/${traitSlots(level)}; slots open at levels 10 and 30)` +
      `\nArts (${artsOf(player, member).length} known):\n` +
      artList(player, member) +
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
  if ((branch < 0 && level >= classes.BRANCH_AT) || (branch >= 0 && mastery < 0 && level >= classes.MASTERY_AT)) {
    add(branch < 0 ? "§2Choose a path§r\nnew arts at levels 30, 40 and 50" : "§2Choose a mastery§r\nnew arts at levels 60 to 100", () => openPath(player, index));
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
  if (branch >= 0) {
    add(`Retrain path (${RETRAIN_COST} Gold Coins)\nchoose path and mastery again`, () => {
      notify(player, retrain(player, index));
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

/** Choosing a path (level 30) or a mastery (level 60). @param {Player} player @param {number} index */
function openPath(player, index) {
  const member = partyOf(player)[index];
  if (!member) return openParty(player);
  const voc = classes.VOCATIONS[vocOf(member)];
  const { branch } = pathOf(member);
  const options = branch < 0 ? voc.branches : voc.branches[branch].masteries;
  const lines = options.map((o) => {
    const list = o.arts.map((art) => `  Lv.${art.at} ${artInfo(art).name} - ${artInfo(art).help}`).join("\n");
    return `§e${o.name}§r - ${o.help}\n${list}`;
  });
  const form = new ActionFormData()
    .title(branch < 0 ? `${member.name}: choose a path` : `${member.name}: choose a mastery`)
    .body(`${lines.join("\n\n")}\n\n§7You can retrain later for ${RETRAIN_COST} Gold Coins.`);
  for (const o of options) form.button(`${o.name}\n${o.help}`);
  form.button("Back");
  show(form, player, (choice) => {
    if (choice >= options.length) return openMember(player, index);
    notify(player, choosePath(player, index, choice));
    openMember(player, index);
  });
}

/**
 * What using a companion opens: talk, orders, emotes and the way to its full page.
 * @param {Player} player @param {number} index
 */
export function openCompanion(player, index) {
  const member = partyOf(player)[index];
  if (!member) return;
  const entity = entitiesOf(player, index)[0];
  let hp = "";
  try {
    const health = entity?.getComponent("minecraft:health");
    if (health) hp = ` - ${Math.ceil(health.currentValue)}/${Math.ceil(health.effectiveMax)} HP`;
  } catch {
    hp = "";
  }
  const { branch, mastery } = pathOf(member);
  const level = levelOf(player, member);
  const ready = (branch < 0 && level >= classes.BRANCH_AT) || (branch >= 0 && mastery < 0 && level >= classes.MASTERY_AT);
  const form = new ActionFormData()
    .title(member.name)
    .body(`${classOf(member)} Lv.${level}${hp}\nBond: ${BOND_RANKS[bondRank(member)]} (${member.bond}/${MAX_BOND}) - Temper: ${PERSONAS[/** @type {keyof typeof PERSONAS} */ (personaOf(member))].name}${ready ? "\n§eReady to choose a new path!§r" : ""}`);
  /** @type {(() => void)[]} */
  const actions = [];
  const add = (/** @type {string} */ text, /** @type {() => void} */ action) => {
    form.button(text);
    actions.push(action);
  };
  add(`Talk${member.talk === world.getDay() ? "" : "\n+1 bond today"}`, () => talk(player, index));
  add("High five", () => notify(player, highFive(player, index)));
  add("Emotes", () => openEmotes(player, index));
  if (ready) add("§2Choose a path§r", () => openPath(player, index));
  add("Follow me", () => setStance(player, "come"));
  add("Wait here", () => setStance(player, "stay"));
  add("Go ahead and clear the way", () => setStance(player, "go"));
  if (member.bond < MAX_BOND && member.gift !== world.getDay()) add(`Give a gift (${GIFT_COST} Gold Coins)`, () => notify(player, gift(player, index)));
  add("Manage (arts, tactic, traits, gear)", () => openMember(player, index));
  show(form, player, (choice) => actions[choice]?.());
}

/** Emotes for one member, or for everyone at the master's side (index -1). @param {Player} player @param {number} index */
function openEmotes(player, index) {
  const form = new ActionFormData().title(index < 0 ? "Party emote" : `${partyOf(player)[index]?.name ?? "Companion"}: emote`);
  for (const key of EMOTE_MENU) form.button(EMOTES[key].name);
  form.button("Back");
  show(form, player, (choice) => {
    if (choice >= EMOTE_MENU.length) return index < 0 ? openParty(player) : openCompanion(player, index);
    const key = EMOTE_MENU[choice];
    if (index < 0) emoteAll(player, key);
    else for (const entity of entitiesOf(player, index)) emote(entity, key);
  });
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
    form.button(`${offer.name} - ${classOf(offer)} (${LOOKS[offer.look]}) Lv.${offer.level}\n${offer.cost} Gold Coins`);
  }
  form.button("Back");
  show(form, player, (choice) => {
    if (choice >= offers.length) return openParty(player);
    notify(player, hire(player, offers[choice]));
    summon(player);
  });
}

registerMenu((player) => `Party (${partyOf(player).length}/${MAX_PARTY})`, openParty);
