// Overlord: Tomb of Nazarick - RPG layer.
// Levels and XP, stat points, mana, classes, guild quests with adventurer ranks,
// an action-bar HUD, party XP sharing and a level tag under player names.
// Uses only stable @minecraft/server 2.0.0 and @minecraft/server-ui 2.0.0 APIs.
import { world, system, DisplaySlotId, EntityDamageCause, EquipmentSlot, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const SAVE_KEY = "overlord:rpg";
const LEVEL_OBJECTIVE = "overlord_level";

export const MAX_LEVEL = 100;
const POINTS_PER_LEVEL = 3;
const STAT_CAP = 50;
const PARTY_RANGE = 24;
const PARTY_SHARE = 0.5;

/**
 * @typedef {"str" | "vit" | "int" | "agi"} StatKey
 * @typedef {"none" | "warrior" | "caster" | "assassin" | "cleric"} ClassKey
 * @typedef {{ quest: string, progress: number }} ActiveQuest
 * @typedef {{
 *   level: number, xp: number, points: number,
 *   str: number, vit: number, int: number, agi: number,
 *   cls: ClassKey, mana: number, done: number, hud: boolean,
 *   quest: ActiveQuest | null,
 *   spells: string[], slots: string[], slot: number, casts: Record<string, number>,
 *   party: any[], stance: string, kills: Record<string, number>, rep: Record<string, number>,
 *   daily: object, title: string, titles: string[], sites: string[], supply: boolean,
 * }} Profile
 */

/** @type {Record<StatKey, { name: string, color: string, help: string }>} */
const STATS = {
  str: { name: "Strength", color: "§c", help: "+2% melee damage per point" },
  vit: { name: "Vitality", color: "§a", help: "+2 hearts per 5 points" },
  int: { name: "Intelligence", color: "§b", help: "+2% spell power, +5 mana per point" },
  agi: { name: "Agility", color: "§e", help: "Speed I at 10 points, Speed II at 25, Speed III at 45" },
};
const STAT_KEYS = /** @type {StatKey[]} */ (Object.keys(STATS));

/** @type {Record<ClassKey, { name: string, help: string, skill: string }>} */
const CLASSES = {
  none: { name: "Adventurer", help: "No class chosen yet.", skill: "" },
  warrior: { name: "Warrior", help: "+20% melee damage and +2 hearts, but 30% less mana.", skill: "Fortress: Resistance II for 8 seconds" },
  caster: { name: "Magic Caster", help: "+30% spell power, +50% mana and faster mana recovery.", skill: "Mana Surge: refills your mana" },
  assassin: { name: "Assassin", help: "25% chance of a critical hit (+50% damage) and one extra tier of Speed.", skill: "Shadow Step: invisible and very fast for 6 seconds" },
  cleric: { name: "Cleric", help: "Slowly regenerates health and deals +30% melee damage to the undead.", skill: "Sanctuary: heals you and players within 8 blocks" },
};
const SKILL_COOLDOWN = 45;
const CLASS_KEYS = /** @type {ClassKey[]} */ (["warrior", "caster", "assassin", "cleric"]);

/** Adventurer ranks, unlocked by the number of completed guild quests. */
const RANKS = [
  { quests: 0, name: "Copper", color: "§6" },
  { quests: 2, name: "Iron", color: "§7" },
  { quests: 4, name: "Silver", color: "§f" },
  { quests: 7, name: "Gold", color: "§e" },
  { quests: 10, name: "Platinum", color: "§b" },
  { quests: 14, name: "Mithril", color: "§3" },
  { quests: 18, name: "Orichalcum", color: "§d" },
  { quests: 24, name: "Adamantite", color: "§5" },
];

/** Guild quests: kill `count` of `target`; `rank` is the index into RANKS needed to accept. */
const QUESTS = [
  { key: "zombies", title: "Restless Dead", target: "minecraft:zombie", what: "Zombies", count: 10, coins: 6, xp: 60, rank: 0 },
  { key: "skeletons", title: "Bone Collectors", target: "minecraft:skeleton", what: "Skeletons", count: 10, coins: 6, xp: 60, rank: 0 },
  { key: "old_guarders", title: "Guards of the Tomb", target: id("old_guarder"), what: "Nazarick Old Guarders", count: 8, coins: 10, xp: 120, rank: 0 },
  { key: "bandits", title: "Clear the Roads", target: id("bandit"), what: "Bandits", count: 8, coins: 10, xp: 110, rank: 0 },
  { key: "goblins", title: "Goblin Raiders", target: id("goblin"), what: "Goblins", count: 12, coins: 8, xp: 90, rank: 0 },
  { key: "ogres", title: "Ogre Trouble", target: id("ogre"), what: "Ogres", count: 5, coins: 12, xp: 160, rank: 1 },
  { key: "quagoa", title: "Claws in the Dark", target: id("quagoa"), what: "Quagoa", count: 8, coins: 12, xp: 160, rank: 1 },
  { key: "skeleton_mages", title: "Arcane Bones", target: id("skeleton_mage"), what: "Skeleton Mages", count: 6, coins: 12, xp: 160, rank: 1 },
  { key: "elder_liches", title: "Silence the Liches", target: id("elder_lich"), what: "Elder Liches", count: 5, coins: 14, xp: 200, rank: 1 },
  { key: "death_knights", title: "Knights of Death", target: id("death_knight"), what: "Death Knights", count: 5, coins: 20, xp: 350, rank: 2 },
  { key: "soul_eaters", title: "Devourers of Souls", target: id("soul_eater"), what: "Soul Eaters", count: 5, coins: 22, xp: 400, rank: 2 },
  { key: "shadow_demons", title: "Things in the Dark", target: id("shadow_demon"), what: "Shadow Demons", count: 8, coins: 16, xp: 260, rank: 1 },
  { key: "hellhounds", title: "Hounds of the Pit", target: id("hellhound"), what: "Hellhounds", count: 6, coins: 22, xp: 380, rank: 2 },
  { key: "priests", title: "The Sunlight Scripture", target: id("theocracy_priest"), what: "Sunlight Scripture Priests", count: 6, coins: 22, xp: 380, rank: 2 },
  { key: "vampire_brides", title: "Brides of the Night", target: id("vampire_bride"), what: "Vampire Brides", count: 5, coins: 24, xp: 420, rank: 2 },
  { key: "clementine", title: "The Fallen Scripture", target: id("clementine"), what: "Clementine", count: 1, coins: 24, xp: 400, rank: 2 },
  { key: "narberal", title: "Storm Maid", target: id("narberal"), what: "Narberal Gamma", count: 1, coins: 32, xp: 700, rank: 3 },
  { key: "cz_delta", title: "Silent Sniper", target: id("cz_delta"), what: "CZ2128 Delta", count: 1, coins: 32, xp: 700, rank: 3 },
  { key: "lupusregina", title: "The Laughing Wolf", target: id("lupusregina"), what: "Lupusregina Beta", count: 1, coins: 32, xp: 700, rank: 3 },
  { key: "entoma", title: "Spider's Whisper", target: id("entoma"), what: "Entoma Vasilissa Zeta", count: 1, coins: 32, xp: 700, rank: 3 },
  { key: "solution", title: "The Hungry Slime", target: id("solution"), what: "Solution Epsilon", count: 1, coins: 32, xp: 700, rank: 3 },
  { key: "yuri", title: "Captain of the Pleiades", target: id("yuri"), what: "Yuri Alpha", count: 1, coins: 36, xp: 800, rank: 4 },
  { key: "war_trolls", title: "Troll Hunt", target: id("war_troll"), what: "War Trolls", count: 3, coins: 36, xp: 800, rank: 3 },
  { key: "nigun", title: "Captain of the Scripture", target: id("nigun"), what: "Nigun Grid Luin", count: 1, coins: 36, xp: 800, rank: 3 },
  { key: "fluder", title: "The Triad Caster", target: id("fluder"), what: "Fluder Paradyne", count: 1, coins: 36, xp: 800, rank: 3 },
  { key: "gargantua", title: "The Stone Colossus", target: id("gargantua"), what: "Gargantua", count: 1, coins: 56, xp: 1500, rank: 5 },
  { key: "dominion", title: "The Highest Angel", target: id("dominion_authority"), what: "Dominion Authority", count: 1, coins: 52, xp: 1400, rank: 4 },
  { key: "evil_lord", title: "Lord of Wrath", target: id("evil_lord_wrath"), what: "Evil Lord Wrath", count: 1, coins: 60, xp: 1800, rank: 5 },
  { key: "zesshi", title: "Certain Death", target: id("zesshi"), what: "Zesshi Zetsumei", count: 1, coins: 64, xp: 2400, rank: 6 },
  { key: "frost_dragon", title: "Lord of the White Peaks", target: id("frost_dragon"), what: "the Frost Dragon", count: 1, coins: 60, xp: 1800, rank: 5 },
  { key: "cocytus", title: "Ruler of the Frozen Glacier", target: id("cocytus"), what: "Cocytus", count: 1, coins: 48, xp: 1200, rank: 4 },
  { key: "shalltear", title: "The Bloody Valkyrie", target: id("shalltear"), what: "Shalltear Bloodfallen", count: 1, coins: 48, xp: 1200, rank: 4 },
  { key: "demiurge", title: "Jaldabaoth", target: id("demiurge"), what: "Demiurge", count: 1, coins: 48, xp: 1200, rank: 5 },
  { key: "albedo", title: "Guardian Overseer", target: id("albedo"), what: "Albedo", count: 1, coins: 56, xp: 1500, rank: 5 },
  { key: "ainz", title: "The Sorcerer King", target: id("ainz"), what: "Ainz Ooal Gown", count: 1, coins: 64, xp: 4000, rank: 6 },
];

/** XP for kills that should not simply follow the mob's health. */
const KILL_XP = {
  [id("ainz")]: 1500,
  [id("albedo")]: 500,
  [id("shalltear")]: 500,
  [id("cocytus")]: 500,
  [id("demiurge")]: 450,
  [id("sebas")]: 400,
  [id("aura")]: 400,
  [id("mare")]: 400,
  [id("pandoras_actor")]: 450,
  [id("narberal")]: 300,
  [id("cz_delta")]: 300,
  [id("gargantua")]: 700,
  [id("frost_dragon")]: 900,
  [id("evil_lord_wrath")]: 900,
  [id("zesshi")]: 1000,
  [id("dominion_authority")]: 700,
  [id("nigun")]: 250,
  [id("war_troll")]: 90,
  [id("fluder")]: 250,
  [id("evileye")]: 250,
  [id("soul_eater")]: 40,
  [id("lupusregina")]: 300,
  [id("entoma")]: 300,
  [id("solution")]: 300,
  [id("yuri")]: 300,
  [id("death_knight")]: 60,
  [id("elder_lich")]: 30,
  [id("old_guarder")]: 15,
  [id("clementine")]: 120,
  "minecraft:ender_dragon": 1500,
  "minecraft:wither": 800,
  "minecraft:warden": 800,
};

/** What veterans know about each foe: shown in the Bestiary and called out by retainers. */
export const TIPS = {
  [id("goblin")]: "Goblins lose heart when wounded - press the attack and they flee.",
  [id("ogre")]: "Ogres are slow. Strike, step back, strike again.",
  [id("bandit")]: "Bandits fight as a gang; hit one and the rest come running.",
  [id("old_guarder")]: "Old Guarders fight as a pack and burn in sunlight.",
  [id("skeleton_mage")]: "Skeleton Mages back away from blades - rush them or answer with arrows.",
  [id("elder_lich")]: "An Elder Lich keeps its distance and hurls fire. Close the gap quickly.",
  [id("death_knight")]: "A Death Knight's shield turns arrows aside. Use magic or get in close.",
  [id("soul_eater")]: "Soul Eaters leap. Keep moving, and bring fire.",
  [id("quagoa")]: "Quagoa hunt in the dark in threes. Light is your friend.",
  [id("clementine")]: "Clementine is fast and her blade is poisoned. Do not trade blows.",
  [id("fluder")]: "Fluder shrugs off fire. Use ice or steel.",
  [id("narberal")]: "Narberal commands lightning and barely feels it herself.",
  [id("cz_delta")]: "CZ Delta shoots fast from afar. Break her line of sight.",
  [id("solution")]: "Solution halves arrow damage but burns well.",
  [id("entoma")]: "Entoma's strikes are poisonous.",
  [id("cocytus")]: "Cocytus ignores ice. Fire is his weakness.",
  [id("demiurge")]: "Demiurge is one with flame. Ice hurts him most.",
  [id("shalltear")]: "Shalltear drains life with every blow - end it quickly.",
  [id("albedo")]: "Albedo's armour swallows two fifths of every hit and she cannot be knocked back.",
  [id("gargantua")]: "Gargantua barely feels arrows or lightning. Stay out of its reach.",
  [id("war_troll")]: "War Trolls heal their wounds as you watch. Hit hard and do not let up.",
  [id("vampire_bride")]: "Vampire Brides drink back the blood they spill. Holy magic burns them.",
  [id("frost_dragon")]: "The Frost Dragon breathes ice from afar and shrugs off the cold. Fight it up close with fire.",
  [id("hellhound")]: "Hellhounds leap and set you alight. Ice and holy magic hurt them; fire does nothing.",
  [id("shadow_demon")]: "Shadow Demons are quick but frail. Holy magic tears them apart.",
  [id("evil_lord_wrath")]: "Evil Lord Wrath is wreathed in flame. Bring ice, and keep moving between his fireballs.",
  [id("theocracy_priest")]: "Scripture priests call angels to fight for them. Kill the priest first.",
  [id("archangel_flame")]: "Angels shrug off holy magic and fire. Darkness is what they fear.",
  [id("nigun")]: "Nigun hides behind his angels. Reach him and the rest falls apart.",
  [id("dominion_authority")]: "Dominion Authority smites from afar. Dark magic wounds it most.",
  [id("zesshi")]: "Zesshi turns aside nearly a third of every blow and never tires. There is no trick - only strength.",
  [id("ainz")]: "Ainz raises Death Knights and withers what he touches. Holy magic bites deepest.",
  "minecraft:zombie": "Zombies burn in daylight. Holy magic hurts all undead.",
  "minecraft:skeleton": "Skeletons keep their distance. A shield or a charge ends it.",
  "minecraft:creeper": "Creepers. Back off the moment they hiss.",
};

const KNOWLEDGE = [5, 15, 40]; // kills needed for knowledge ranks 1-3

/**
 * How well a player knows a kind of foe (0-3). Each rank adds 5% damage against it.
 * @param {Profile} p @param {string} typeId
 */
export function knowledgeOf(p, typeId) {
  const kills = p.kills[typeId] ?? 0;
  let rank = 0;
  for (let i = 0; i < KNOWLEDGE.length; i++) if (kills >= KNOWLEDGE[i]) rank = i + 1;
  return rank;
}

/** @param {string} typeId */
export function prettyName(typeId) {
  return typeId.split(":")[1].split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** @type {Record<string, string>} */
export const FACTIONS = { kingdom: "Re-Estize Kingdom", empire: "Baharuth Empire", adventurers: "Adventurers' Guild", lizardmen: "Lizardman Tribes" };

/**
 * A player's standing with a faction, from -100 (hated) to 100.
 * @param {Profile} p @param {string} faction
 */
export function standingOf(p, faction) {
  const value = p.rep[faction];
  return typeof value === "number" ? value : 0;
}

/**
 * Changes a player's standing with a faction.
 * @param {import("@minecraft/server").Player} player @param {string} faction @param {number} amount
 */
export function addRep(player, faction, amount) {
  const p = profileOf(player);
  p.rep[faction] = Math.max(-100, Math.min(100, standingOf(p, faction) + amount));
  touch(player);
}

/** Extra entries other modules add to the Adventurer's Plate menu. */
/** @type {{ label: (player: import("@minecraft/server").Player) => string, open: (player: import("@minecraft/server").Player) => void }[]} */
const extraMenus = [];

/**
 * Adds a button to the Adventurer's Plate menu.
 * @param {(player: import("@minecraft/server").Player) => string} label
 * @param {(player: import("@minecraft/server").Player) => void} open
 */
export function registerMenu(label, open) {
  extraMenus.push({ label, open });
}

/**
 * The player credited with something an entity did: the player itself, or the owner of a retainer.
 * @param {import("@minecraft/server").Entity | undefined} entity
 * @returns {import("@minecraft/server").Player | undefined}
 */
export function creditedPlayer(entity) {
  try {
    if (!entity || !entity.isValid) return undefined;
    if (entity.typeId === "minecraft:player") return /** @type {import("@minecraft/server").Player} */ (entity);
    if (entity.typeId !== id("retainer")) return undefined;
    const owner = entity.getDynamicProperty("overlord:owner");
    return world.getAllPlayers().find((p) => p.id === owner);
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ storage

/** @type {Map<string, Profile>} */
const profiles = new Map();
/** Players whose profile changed since the last save. */
const dirty = new Set();

/** @returns {Profile} */
function freshProfile() {
  return { level: 1, xp: 0, points: 0, str: 0, vit: 0, int: 0, agi: 0, cls: "none", mana: 50, done: 0, hud: true, quest: null, spells: [], slots: [], slot: 0, casts: {}, party: [], stance: "come", kills: {}, rep: {}, daily: {}, title: "", titles: [], sites: [], supply: true };
}

/**
 * @param {import("@minecraft/server").Player} player
 * @returns {Profile}
 */
export function profileOf(player) {
  const cached = profiles.get(player.id);
  if (cached) return cached;
  const profile = freshProfile();
  try {
    const raw = player.getDynamicProperty(SAVE_KEY);
    if (typeof raw === "string") {
      const saved = JSON.parse(raw);
      for (const key of /** @type {(keyof Profile)[]} */ (Object.keys(profile))) {
        if (saved[key] !== undefined && saved[key] !== null && typeof saved[key] === typeof profile[key] &&
            Array.isArray(saved[key]) === Array.isArray(profile[key])) {
          /** @type {any} */ (profile)[key] = saved[key];
        }
      }
      if (saved.quest && QUESTS.some((q) => q.key === saved.quest.quest)) {
        profile.quest = { quest: String(saved.quest.quest), progress: Number(saved.quest.progress) || 0 };
      }
      if (!(profile.cls in CLASSES)) profile.cls = "none";
      profile.level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(profile.level)));
    }
  } catch {
    // corrupt save: start over rather than break the player
  }
  profiles.set(player.id, profile);
  return profile;
}

/** @param {import("@minecraft/server").Player} player */
function save(player) {
  try {
    player.setDynamicProperty(SAVE_KEY, JSON.stringify(profileOf(player)));
    dirty.delete(player.id);
  } catch {
    // player left the world
  }
}

/**
 * Marks the profile as changed so it is saved soon.
 * @param {import("@minecraft/server").Player} player
 */
export function touch(player) {
  dirty.add(player.id);
}

// ------------------------------------------------------------------ formulas

/** XP needed to go from `level` to the next one. @param {number} level */
export function xpForNext(level) {
  return 40 + level * level * 6;
}

/** @param {Profile} p */
export function maxMana(p) {
  const base = 50 + p.level * 2 + p.int * 5;
  const factor = p.cls === "caster" ? 1.5 : p.cls === "warrior" ? 0.7 : 1;
  return Math.round(base * factor);
}

/** Players currently wearing the full Overlord's Regalia (set by main.js). */
const regalia = new Set();

/**
 * @param {import("@minecraft/server").Player} player
 * @param {boolean} wearing
 */
export function setRegalia(player, wearing) {
  if (wearing) regalia.add(player.id);
  else regalia.delete(player.id);
}

/**
 * Mana recovered per second.
 * @param {Profile} p
 * @param {string} playerId
 */
function manaRegen(p, playerId) {
  return (1 + p.int * 0.1) * (p.cls === "caster" ? 1.5 : 1) * (regalia.has(playerId) ? 1.5 : 1);
}

/**
 * Multiplier for spell damage.
 * @param {import("@minecraft/server").Player} player
 */
export function spellPower(player) {
  const p = profileOf(player);
  return 1 + p.int * 0.02 + (p.cls === "caster" ? 0.3 : 0) + (regalia.has(player.id) ? 0.25 : 0);
}

/** @param {Profile} p */
function rankOf(p) {
  let rank = 0;
  for (let i = 0; i < RANKS.length; i++) if (p.done >= RANKS[i].quests) rank = i;
  return rank;
}

// ---------------------------------------------------------------------- HUD

/** Tick until which the HUD stays out of the way of a message. */
const hudHold = new Map();

/**
 * Shows a short message on the action bar (and pauses the HUD so it stays readable).
 * @param {import("@minecraft/server").Player} player
 * @param {string} text
 */
export function notify(player, text) {
  try {
    hudHold.set(player.id, system.currentTick + 2 * TICKS);
    player.onScreenDisplay.setActionBar(text);
  } catch {
    // player left mid-tick
  }
}

/** Extra status-bar text per player (the selected spell, set by spells.js). */
const hudExtra = new Map();

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} text
 */
export function setHudExtra(player, text) {
  hudExtra.set(player.id, text);
}

/** @param {import("@minecraft/server").Player} player */
function drawHud(player) {
  const p = profileOf(player);
  if (!p.hud || system.currentTick < (hudHold.get(player.id) ?? 0)) return;
  const percent = p.level >= MAX_LEVEL ? "MAX" : `${Math.floor((p.xp / xpForNext(p.level)) * 100)}%`;
  const quest = p.quest ? QUESTS.find((q) => q.key === p.quest?.quest) : undefined;
  const questText = quest && p.quest ? ` §7| §e${quest.what} ${p.quest.progress}/${quest.count}` : "";
  const points = p.points > 0 ? ` §7| §d+${p.points} pts` : "";
  try {
    player.onScreenDisplay.setActionBar(
      `§6Lv.${p.level} §f${CLASSES[p.cls].name} §7| §bMP ${Math.floor(p.mana)}/${maxMana(p)} §7| §aXP ${percent}${hudExtra.get(player.id) ?? ""}${questText}${points}`
    );
  } catch {
    // player left mid-tick
  }
}

// --------------------------------------------------------------------- mana

/**
 * Takes mana for a spell. Returns false (and tells the player) when there is not enough.
 * @param {import("@minecraft/server").Player} player
 * @param {number} cost
 */
export function spendMana(player, cost) {
  if (cost <= 0) return true;
  const p = profileOf(player);
  if (p.mana < cost) {
    notify(player, `§9Not enough mana §7(${Math.floor(p.mana)}/${cost})`);
    return false;
  }
  p.mana -= cost;
  return true;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {number} amount
 */
export function restoreMana(player, amount) {
  const p = profileOf(player);
  p.mana = Math.min(maxMana(p), p.mana + amount);
}

// ------------------------------------------------------------- levels and XP

/** @param {import("@minecraft/server").Player} player */
function updateLevelTag(player) {
  try {
    const objective =
      world.scoreboard.getObjective(LEVEL_OBJECTIVE) ?? world.scoreboard.addObjective(LEVEL_OBJECTIVE, "§6Level");
    objective.setScore(player, profileOf(player).level);
  } catch {
    // scoreboard not ready yet; the next refresh will set it
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {number} amount
 * @param {string} [reason]
 */
export function grantXp(player, amount, reason) {
  const p = profileOf(player);
  if (amount <= 0) return;
  if (p.level >= MAX_LEVEL) {
    p.xp = 0;
    return;
  }
  p.xp += Math.round(amount);
  let gained = 0;
  while (p.level < MAX_LEVEL && p.xp >= xpForNext(p.level)) {
    p.xp -= xpForNext(p.level);
    p.level += 1;
    p.points += POINTS_PER_LEVEL;
    gained += 1;
  }
  touch(player);
  if (gained > 0) {
    p.mana = maxMana(p);
    updateLevelTag(player);
    try {
      player.sendMessage(
        `§6[Overlord] §eLevel up! §fYou are now level §6${p.level}§f. §d+${gained * POINTS_PER_LEVEL} stat points §7(open your Adventurer's Plate)`
      );
      player.playSound("random.levelup", { volume: 1, pitch: 1 });
      player.dimension.spawnParticle("minecraft:totem_particle", {
        x: player.location.x,
        y: player.location.y + 1,
        z: player.location.z,
      });
      player.addEffect("instant_health", 1, { amplifier: 3, showParticles: false });
    } catch {
      // cosmetic only
    }
    save(player);
  } else {
    notify(player, `§a+${Math.round(amount)} XP${reason ? ` §7(${reason})` : ""}`);
  }
}

/**
 * Raises the player by exactly one level (Shooting Star). Returns false at the level cap.
 * @param {import("@minecraft/server").Player} player
 */
export function grantLevel(player) {
  const p = profileOf(player);
  if (p.level >= MAX_LEVEL) return false;
  grantXp(player, xpForNext(p.level) - p.xp);
  return true;
}

/**
 * Refunds every spent stat point (Scroll: Rebirth). Returns how many were refunded.
 * @param {import("@minecraft/server").Player} player
 */
export function resetStats(player) {
  const p = profileOf(player);
  const spent = p.str + p.vit + p.int + p.agi;
  if (spent === 0) return 0;
  p.points += spent;
  p.str = p.vit = p.int = p.agi = 0;
  p.mana = Math.min(p.mana, maxMana(p));
  save(player);
  applyPassives(player);
  return spent;
}

/** Tick at which each player's class skill is ready again. */
const skillReady = new Map();

/**
 * Uses the active skill of the player's class (sneak + use the Adventurer's Plate).
 * @param {import("@minecraft/server").Player} player
 */
export function useClassSkill(player) {
  const p = profileOf(player);
  if (p.cls === "none") {
    notify(player, "§7Choose a class first to gain a class skill");
    return;
  }
  const left = Math.ceil(((skillReady.get(player.id) ?? 0) - system.currentTick) / TICKS);
  if (left > 0) {
    notify(player, `§7Class skill ready in §f${left}s`);
    return;
  }
  skillReady.set(player.id, system.currentTick + SKILL_COOLDOWN * TICKS);
  if (p.cls === "warrior") {
    player.addEffect("resistance", 8 * TICKS, { amplifier: 1 });
    notify(player, "§cFortress!");
  } else if (p.cls === "caster") {
    p.mana = maxMana(p);
    notify(player, "§bMana Surge!");
  } else if (p.cls === "assassin") {
    player.addEffect("invisibility", 6 * TICKS, { showParticles: false });
    player.addEffect("speed", 6 * TICKS, { amplifier: 3, showParticles: false });
    notify(player, "§8Shadow Step!");
  } else {
    for (const ally of player.dimension.getPlayers({ location: player.location, maxDistance: 8 })) {
      ally.addEffect("instant_health", 1, { amplifier: 1 });
      ally.addEffect("regeneration", 6 * TICKS, { amplifier: 1 });
    }
    notify(player, "§aSanctuary!");
  }
  try {
    player.playSound("random.orb", { volume: 1, pitch: 1.4 });
  } catch {
    // cosmetic only
  }
}

/**
 * Level the world director gave a mob (0 when it has none).
 * @param {import("@minecraft/server").Entity} mob
 */
export function mobLevel(mob) {
  try {
    const level = mob.getDynamicProperty("overlord:lvl");
    return typeof level === "number" ? level : 0;
  } catch {
    return 0;
  }
}

/**
 * Reinforcement level (+0 to +5) of the weapon a player is holding.
 * @param {import("@minecraft/server").Player} player
 */
export function heldPlus(player) {
  try {
    const held = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
    const plus = held?.getDynamicProperty("overlord:plus");
    return typeof plus === "number" ? plus : 0;
  } catch {
    return 0;
  }
}

/**
 * Whether the world director made this mob an elite.
 * @param {import("@minecraft/server").Entity} mob
 */
export function isElite(mob) {
  try {
    return mob.getDynamicProperty("overlord:elite") === true;
  } catch {
    return false;
  }
}

/** XP a kill is worth. @param {import("@minecraft/server").Entity} dead */
export function killXp(dead) {
  const bonus = (1 + mobLevel(dead) * 0.03) * (isElite(dead) ? 3 : 1); // levelled mobs are worth more, elites triple
  const fixed = KILL_XP[dead.typeId];
  if (fixed !== undefined) return Math.round(fixed * bonus);
  try {
    const health = dead.getComponent("minecraft:health");
    // health boosts from levelling are not counted twice: use the base value
    if (health) return Math.max(1, Math.round((health.defaultValue / 2) * bonus));
  } catch {
    // entity data is gone
  }
  return Math.round(5 * bonus);
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} typeId
 */
function advanceQuest(player, typeId) {
  const p = profileOf(player);
  if (!p.quest) return;
  const quest = QUESTS.find((q) => q.key === p.quest?.quest);
  if (!quest || quest.target !== typeId) return;
  p.quest.progress += 1;
  touch(player);
  if (p.quest.progress < quest.count) return;

  const before = rankOf(p);
  p.quest = null;
  p.done += 1;
  addRep(player, "adventurers", 3); // the guild remembers finished work
  giveItem(player, id("yggdrasil_gold_coin"), quest.coins);
  try {
    player.sendMessage(`§6[Guild] §fQuest complete: §e${quest.title}§f. Reward: §6${quest.coins} Gold Coins§f, §a${quest.xp} XP§f.`);
    player.playSound("random.orb", { volume: 1, pitch: 0.8 });
  } catch {
    // cosmetic only
  }
  grantXp(player, quest.xp, "quest");
  const after = rankOf(p);
  if (after > before) {
    try {
      player.sendMessage(`§6[Guild] §fYou have been promoted to ${RANKS[after].color}${RANKS[after].name}§f rank!`);
    } catch {
      // cosmetic only
    }
  }
  save(player);
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} itemId
 * @param {number} amount
 */
export function giveItem(player, itemId, amount) {
  try {
    let left = amount;
    const container = player.getComponent("minecraft:inventory")?.container;
    while (left > 0) {
      const stack = new ItemStack(itemId, Math.min(64, left));
      left -= stack.amount;
      const overflow = container ? container.addItem(stack) : stack;
      if (overflow) player.dimension.spawnItem(overflow, player.location);
    }
  } catch (error) {
    console.warn(`[Overlord] could not give ${itemId}: ${error}`);
  }
}

world.afterEvents.entityDie.subscribe((event) => {
  try {
    // Kills by a retainer count for its master.
    const player = creditedPlayer(event.damageSource.damagingEntity);
    if (!player) return;
    const dead = event.deadEntity;
    if (dead.typeId === "minecraft:player" || dead.typeId === id("retainer")) return;
    const typeId = dead.typeId;
    const xp = killXp(dead);
    const p = profileOf(player);
    const before = knowledgeOf(p, typeId);
    p.kills[typeId] = (p.kills[typeId] ?? 0) + 1;
    const after = knowledgeOf(p, typeId);
    if (isElite(dead)) {
      // Elites carry a purse and are counted on their own line of the bestiary.
      p.kills[id("elite_foes")] = (p.kills[id("elite_foes")] ?? 0) + 1;
      giveItem(player, id("yggdrasil_gold_coin"), 3 + Math.floor(Math.random() * 4));
      giveItem(player, id("data_crystal"), 1);
      player.sendMessage(`§6[Overlord] §fElite §e${prettyName(typeId)}§f slain! Triple XP, Gold Coins and a Data Crystal.`);
    }
    if (after > before) {
      player.sendMessage(`§6[Bestiary] §fYou now know the §e${prettyName(typeId)}§f better (rank ${after}): §a+${after * 5}% damage§f against it.`);
    }
    grantXp(player, xp);
    advanceQuest(player, typeId);
    // Party play: nearby adventurers share in the kill.
    for (const mate of player.dimension.getPlayers({ location: player.location, maxDistance: PARTY_RANGE })) {
      if (mate.id === player.id) continue;
      grantXp(mate, xp * PARTY_SHARE, "party");
      advanceQuest(mate, typeId);
    }
  } catch {
    // killer or victim vanished between the kill and this callback
  }
});

// ------------------------------------------------------------ combat bonuses

/**
 * Target frame: shows the name and remaining health of the mob the player just hit.
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity} victim
 * @param {number} health
 * @param {number} max
 */
export function showTarget(player, victim, health, max) {
  let name = victim.nameTag;
  if (!name) {
    name = victim.typeId.split(":")[1].split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  const level = mobLevel(victim);
  if (level > 0) name = `§7Lv.${level} §f${name}`;
  if (isElite(victim)) name = `§6* Elite §f${name}`;
  const ratio = max > 0 ? health / max : 0;
  const color = ratio > 0.5 ? "§a" : ratio > 0.2 ? "§e" : "§c";
  notify(player, `§f${name} ${color}${Math.ceil(health)}§7/${Math.round(max)} HP`);
}

// Death penalty: lose a tenth of the XP gathered towards the next level.
world.afterEvents.entityDie.subscribe((event) => {
  try {
    if (event.deadEntity.typeId !== "minecraft:player") return;
    const player = /** @type {import("@minecraft/server").Player} */ (event.deadEntity);
    const p = profileOf(player);
    const lost = Math.floor(p.xp * 0.1);
    if (lost <= 0) return;
    p.xp -= lost;
    touch(player);
    player.sendMessage(`§6[Overlord] §7You lost §c${lost} XP§7 on death.`);
  } catch {
    // player data unavailable during the death tick
  }
});

let applyingBonus = false;

world.afterEvents.entityHurt.subscribe((event) => {
  if (applyingBonus) return;
  try {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    if (!attacker || !attacker.isValid || attacker.typeId !== "minecraft:player") return;
    if (event.damageSource.cause !== EntityDamageCause.entityAttack || !victim.isValid) return;
    const player = /** @type {import("@minecraft/server").Player} */ (attacker);
    const p = profileOf(player);

    let factor = p.str * 0.02 + (p.cls === "warrior" ? 0.2 : 0) + knowledgeOf(p, victim.typeId) * 0.05 + heldPlus(player) * 0.06;
    if (p.cls === "cleric" && victim.matches({ families: ["undead"] })) factor += 0.3;
    let crit = false;
    // Agility gives everyone a small critical chance; assassins add 25% on top.
    if (Math.random() < p.agi * 0.004 + (p.cls === "assassin" ? 0.25 : 0)) {
      factor += 0.5;
      crit = true;
    }
    const bonus = event.damage * factor;
    const health = victim.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0) return;
    if (bonus < 0.5) {
      showTarget(player, victim, health.currentValue, health.effectiveMax);
      return;
    }
    showTarget(player, victim, Math.max(0, health.currentValue - bonus), health.effectiveMax);
    if (health.currentValue - bonus > 0.5) {
      // The hit has already landed, so the extra damage is taken straight off the target's health.
      health.setCurrentValue(health.currentValue - bonus);
    } else {
      applyingBonus = true;
      try {
        victim.applyDamage(health.effectiveMax * 4, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
      } finally {
        applyingBonus = false;
      }
    }
    if (crit) {
      player.dimension.spawnParticle("minecraft:critical_hit_emitter", {
        x: victim.location.x,
        y: victim.location.y + 1,
        z: victim.location.z,
      });
      notify(player, "§eCritical hit!");
    }
  } catch {
    // entity vanished between the hit and this callback
  }
});

// ---------------------------------------------------------- passive effects

const LONG = 20000000;

/**
 * Keeps a permanent effect at the wanted tier (or removes it when tier is 0).
 * @param {import("@minecraft/server").Player} player
 * @param {string} effect
 * @param {number} tier
 */
function holdEffect(player, effect, tier) {
  const current = player.getEffect(effect);
  if (tier <= 0) {
    // Only clear effects this system created (they are the only ones that last this long).
    if (current && current.duration > LONG / 2) player.removeEffect(effect);
    return;
  }
  const ours = current !== undefined && current.duration > LONG / 2;
  if (ours && current.amplifier === tier - 1) return;
  if (current && !ours && current.amplifier > tier - 1) return; // a stronger outside source is active
  if (ours) player.removeEffect(effect); // our own tier changed (e.g. stats were reset)
  player.addEffect(effect, LONG, { amplifier: tier - 1, showParticles: false });
}

/** @param {import("@minecraft/server").Player} player */
function applyPassives(player) {
  const p = profileOf(player);
  const hearts = Math.floor(p.vit / 5) + (p.cls === "warrior" ? 1 : 0);
  holdEffect(player, "health_boost", hearts);
  const speed = (p.agi >= 45 ? 3 : p.agi >= 25 ? 2 : p.agi >= 10 ? 1 : 0) + (p.cls === "assassin" ? 1 : 0);
  holdEffect(player, "speed", speed);
}

// --------------------------------------------------------------------- menu

/**
 * Opens the Adventurer's Plate menu.
 * @param {import("@minecraft/server").Player} player
 */
export function openMenu(player) {
  const p = profileOf(player);
  const rank = RANKS[rankOf(p)];
  const next = p.level >= MAX_LEVEL ? "max level" : `${p.xp}/${xpForNext(p.level)} XP`;
  const form = new ActionFormData()
    .title("Adventurer's Plate")
    .body(
      `§l${player.name}§r\n` +
        `Rank: ${rank.color}${rank.name}§r  (${p.done} quests)\n` +
        `Class: §f${CLASSES[p.cls].name}§r\n` +
        `Level: §6${p.level}§r  (${next})\n` +
        `Mana: §b${Math.floor(p.mana)}/${maxMana(p)}§r\n` +
        STAT_KEYS.map((k) => `${STATS[k].color}${STATS[k].name}: ${p[k]}§r`).join("   ") +
        `\nUnspent stat points: §d${p.points}§r`
    )
    .button(`Spend stat points (${p.points})`)
    .button("Choose class")
    .button(p.quest ? "Guild quest (in progress)" : "Guild quests")
    .button(p.hud ? "Hide status bar" : "Show status bar")
    .button("How it works")
    .button("Bestiary");
  for (const extra of extraMenus) form.button(extra.label(player));
  show(form, player, (choice) => {
    if (choice === 0) openStats(player);
    else if (choice === 1) openClasses(player);
    else if (choice === 2) openQuests(player);
    else if (choice === 3) {
      p.hud = !p.hud;
      save(player);
      notify(player, p.hud ? "§7Status bar shown" : "§7Status bar hidden");
    } else if (choice === 4) openHelp(player);
    else if (choice === 5) openBestiary(player);
    else extraMenus[choice - 6]?.open(player);
  });
}

/** @param {import("@minecraft/server").Player} player */
function openBestiary(player) {
  const p = profileOf(player);
  const entries = Object.entries(p.kills).sort((a, b) => b[1] - a[1]).slice(0, 24);
  const lines = entries.map(([typeId, kills]) => {
    const rank = knowledgeOf(p, typeId);
    const next = KNOWLEDGE[rank];
    const tip = rank >= 1 && TIPS[typeId] ? `\n  §7${TIPS[typeId]}§r` : "";
    return `§e${prettyName(typeId)}§r - ${kills} slain, rank ${rank}/3${rank > 0 ? ` (§a+${rank * 5}%§r)` : ""}${next ? `, next at ${next}` : ""}${tip}`;
  });
  const form = new ActionFormData()
    .title("Bestiary")
    .body(
      "Every kind of foe you slay is recorded. Ranks at 5, 15 and 40 kills each add 5% damage against it; rank 1 also reveals what veterans know.\n\n" +
        (lines.length > 0 ? lines.join("\n") : "Nothing recorded yet.")
    )
    .button("Back");
  show(form, player, () => openMenu(player));
}

/**
 * @param {ActionFormData} form
 * @param {import("@minecraft/server").Player} player
 * @param {(choice: number) => void} onChoice
 */
function show(form, player, onChoice) {
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      try {
        onChoice(response.selection);
      } catch (error) {
        console.warn(`[Overlord] menu action failed: ${error}`);
      }
    })
    .catch((error) => console.warn(`[Overlord] menu failed: ${error}`));
}

/** @param {import("@minecraft/server").Player} player */
function openStats(player) {
  const p = profileOf(player);
  const form = new ActionFormData()
    .title("Stat points")
    .body(`Unspent points: §d${p.points}§r\nEach stat can be raised to ${STAT_CAP}.`);
  for (const key of STAT_KEYS) {
    form.button(`${STATS[key].name}  ${p[key]}/${STAT_CAP}\n${STATS[key].help}`);
  }
  form.button("Back");
  show(form, player, (choice) => {
    if (choice >= STAT_KEYS.length) return openMenu(player);
    const key = STAT_KEYS[choice];
    if (p.points <= 0) notify(player, "§7No stat points to spend - level up first");
    else if (p[key] >= STAT_CAP) notify(player, `§7${STATS[key].name} is already at its limit`);
    else {
      p[key] += 1;
      p.points -= 1;
      save(player);
      applyPassives(player);
    }
    openStats(player);
  });
}

/** @param {import("@minecraft/server").Player} player */
function openClasses(player) {
  const p = profileOf(player);
  const form = new ActionFormData()
    .title("Choose a class")
    .body(`Current class: §f${CLASSES[p.cls].name}§r\nYou can change class at any time.`);
  form.body(
    `Current class: §f${CLASSES[p.cls].name}§r\nYou can change class at any time.\n\n` +
      CLASS_KEYS.map((k) => `§e${CLASSES[k].name}§r skill - ${CLASSES[k].skill}`).join("\n") +
      `\n\nSneak and use the plate to trigger your class skill (${SKILL_COOLDOWN} s cooldown).`
  );
  for (const key of CLASS_KEYS) form.button(`${CLASSES[key].name}\n${CLASSES[key].help}`);
  form.button("Back");
  show(form, player, (choice) => {
    if (choice >= CLASS_KEYS.length) return openMenu(player);
    p.cls = CLASS_KEYS[choice];
    p.mana = Math.min(p.mana, maxMana(p));
    save(player);
    applyPassives(player);
    player.sendMessage(`§6[Overlord] §fYou are now a §e${CLASSES[p.cls].name}§f. §7${CLASSES[p.cls].help}`);
  });
}

/** @param {import("@minecraft/server").Player} player */
function openQuests(player) {
  const p = profileOf(player);
  const active = p.quest ? QUESTS.find((q) => q.key === p.quest?.quest) : undefined;
  if (active && p.quest) {
    const form = new ActionFormData()
      .title("Guild quest")
      .body(
        `§e${active.title}§r\nDefeat ${active.count} × ${active.what}.\n` +
          `Progress: §a${p.quest.progress}/${active.count}§r\n` +
          `Reward: §6${active.coins} Gold Coins§r, §a${active.xp} XP§r`
      )
      .button("Keep going")
      .button("Abandon quest");
    show(form, player, (choice) => {
      if (choice === 1) {
        p.quest = null;
        save(player);
        notify(player, "§7Quest abandoned");
      }
    });
    return;
  }
  const rank = rankOf(p);
  const form = new ActionFormData()
    .title("Adventurers' Guild")
    .body(`Your rank: ${RANKS[rank].color}${RANKS[rank].name}§r. Pick a request; you can hold one at a time.`);
  for (const quest of QUESTS) {
    const locked = quest.rank > rank;
    form.button(
      locked
        ? `§8${quest.title}\nRequires ${RANKS[quest.rank].name} rank`
        : `${quest.title}\n${quest.count} × ${quest.what} - ${quest.coins} coins, ${quest.xp} XP`
    );
  }
  form.button("Back");
  show(form, player, (choice) => {
    if (choice >= QUESTS.length) return openMenu(player);
    const quest = QUESTS[choice];
    if (quest.rank > rank) {
      notify(player, `§7That request needs ${RANKS[quest.rank].name} rank`);
      return openQuests(player);
    }
    p.quest = { quest: quest.key, progress: 0 };
    save(player);
    player.sendMessage(`§6[Guild] §fQuest accepted: §e${quest.title}§f - defeat ${quest.count} × ${quest.what}.`);
  });
}

/** @param {import("@minecraft/server").Player} player */
function openHelp(player) {
  const form = new ActionFormData()
    .title("How it works")
    .body(
      "§eLevels§r: defeating mobs gives XP. Each level grants " +
        `${POINTS_PER_LEVEL} stat points (max level ${MAX_LEVEL}).\n\n` +
        STAT_KEYS.map((k) => `${STATS[k].color}${STATS[k].name}§r: ${STATS[k].help}`).join("\n") +
        "\n\n§eMana§r: staff, ring, tome and weapon abilities cost mana, which recovers over time. Scrolls and potions cost none; Healing Potions also restore mana.\n\n" +
        "§eWorld§r: monsters that spawn near you take a level close to yours (more health, harder hits, more XP). The most dangerous ones only appear once someone nearby is strong enough, and from level 5 Nazarick may send a patrol after you at night.\n\n" +
        "§eParty§r: create a retainer and hire up to two mercenaries from the Party entry of this menu. Set their stance with the Command Banner (sneak + use switches Come / Go / Stay). Their kills count as yours.\n\n" +
        "§eBestiary§r: every 5, 15 and 40 kills of a kind of foe add 5% damage against it.\n\n" +
        "§eReputation§r: factions remember what you do. Kill their people and they turn on you until the grudge fades.\n\n" +
        "§eElites§r: about one monster in twenty spawns as an elite - tougher, five levels higher, worth triple XP and carrying coins and a Data Crystal.\n\n" +
        "§eDaily bounty§r: every in-game day the guild posts one bounty for everyone. Finish bounties on consecutive days to build a streak worth up to +50%.\n\n" +
        "§eTitles§r: great deeds earn titles; wear one in front of your name from this menu.\n\n" +
        "§eWorld bosses§r: some mornings a great foe appears near a strong adventurer and the whole world is told. Everyone nearby when it falls is rewarded.\n\n" +
        "§eReinforcing§r: stand near a Dwarf Runesmith and choose Reinforce weapon to raise the weapon in your hand up to +5 (6% melee damage each) for Gold Coins and adamantite.\n\n" +
        "§eTravel§r: friendly camps you have discovered can be returned to from the Travel entry for 5 Gold Coins.\n\n" +
        "§eCamps§r: the wilds hold camps and outposts of the factions - Kingdom, Empire, goblins, bandits, adventurers, lizardmen and Nazarick. Finding one gives XP; adventurers, guards and soldiers may tell you where the nearest lies. Cleared camps are re-manned after ten minutes.\n\n" +
        "§eCombat§r: hitting a mob shows its remaining health. Agility adds a 0.4% critical chance per point (+50% damage). Dying costs a tenth of the XP gathered towards your next level.\n\n" +
        "§eSpells§r: open the Grimoire to learn tier magic with Data Crystals and assign up to four spells; cast them with the Magic Wand (sneak + use switches spell). Each spell grows stronger with use.\n\n" +
        `§eClasses§r: each class gives a permanent bonus and an active skill - sneak and use the plate to trigger it (${SKILL_COOLDOWN} s cooldown).\n\n` +
        "§eGuild quests§r: accept a request, defeat the targets and earn Gold Coins and XP. Completed quests raise your adventurer rank from Copper to Adamantite and unlock harder requests.\n\n" +
        `§eParty§r: players within ${PARTY_RANGE} blocks of a kill receive half its XP and quest credit.\n\n` +
        "§eCompanions§r: your retainer levels with you and mercenaries earn XP from your kills. Fighting together builds a bond with each companion that strengthens its skills, every companion learns a second skill at level 20, and each can be given a tactic. Hurt companions fall back, drink your healing potions and recover between fights. Hold the Command Banner to see everyone's health.\n\n" +
        "§eTomb Raid§r: blow a Horn of the Tomb Raid to fight five waves. The raid tier follows your level (1-19, 20-49, 50+) and pays coins, crystals and XP."
    )
    .button("Back");
  show(form, player, () => openMenu(player));
}

// -------------------------------------------------------------------- loops

world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  system.runTimeout(() => {
    try {
      if (!player.isValid) return;
      const p = profileOf(player);
      updateLevelTag(player);
      applyPassives(player);
      if (event.initialSpawn && !player.hasTag("overlord_plate_given")) {
        player.addTag("overlord_plate_given");
        giveItem(player, id("adventurer_plate"), 1);
        player.sendMessage("§6[Overlord] §fYou received an §eAdventurer's Plate§f. Use it to see your level, spend stat points, pick a class and take guild quests.");
      }
      if (event.initialSpawn) p.mana = Math.min(p.mana, maxMana(p));
    } catch {
      // player left before setup
    }
  }, 2 * TICKS);
});

world.afterEvents.playerLeave.subscribe((event) => {
  profiles.delete(event.playerId);
  dirty.delete(event.playerId);
  hudHold.delete(event.playerId);
  hudExtra.delete(event.playerId);
  regalia.delete(event.playerId);
  skillReady.delete(event.playerId);
});

world.afterEvents.worldLoad.subscribe(() => {
  try {
    const objective =
      world.scoreboard.getObjective(LEVEL_OBJECTIVE) ?? world.scoreboard.addObjective(LEVEL_OBJECTIVE, "§6Level");
    world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.BelowName, { objective });
  } catch (error) {
    console.warn(`[Overlord] could not set up the level display: ${error}`);
  }
});

// HUD and mana recovery, twice a second.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      const p = profileOf(player);
      const cap = maxMana(p);
      if (p.mana < cap) p.mana = Math.min(cap, p.mana + manaRegen(p, player.id) / 2);
      drawHud(player);
    } catch {
      // player is leaving
    }
  }
}, TICKS / 2);

// Passive effects, cleric regeneration and saving, every 4 seconds.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      const p = profileOf(player);
      applyPassives(player);
      if (p.cls === "cleric") {
        const health = player.getComponent("minecraft:health");
        if (health && health.currentValue > 0 && health.currentValue < health.effectiveMax) {
          health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + 1));
        }
      }
      if (dirty.has(player.id) || p.mana < maxMana(p)) save(player);
    } catch {
      // player is leaving
    }
  }
}, 4 * TICKS);
