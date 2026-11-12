// Overlord: Tomb of Nazarick - RPG layer.
// Levels and XP, stat points, mana, classes, guild quests with adventurer ranks,
// an action-bar HUD, party XP sharing and a level tag under player names.
// Uses only stable @minecraft/server 2.0.0 and @minecraft/server-ui 2.0.0 APIs.
import { world, system, DisplaySlotId, EntityDamageCause, ItemStack } from "@minecraft/server";
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
  { key: "goblins", title: "Goblin Raiders", target: id("goblin"), what: "Goblins", count: 12, coins: 8, xp: 90, rank: 0 },
  { key: "ogres", title: "Ogre Trouble", target: id("ogre"), what: "Ogres", count: 5, coins: 12, xp: 160, rank: 1 },
  { key: "elder_liches", title: "Silence the Liches", target: id("elder_lich"), what: "Elder Liches", count: 5, coins: 14, xp: 200, rank: 1 },
  { key: "death_knights", title: "Knights of Death", target: id("death_knight"), what: "Death Knights", count: 5, coins: 20, xp: 350, rank: 2 },
  { key: "clementine", title: "The Fallen Scripture", target: id("clementine"), what: "Clementine", count: 1, coins: 24, xp: 400, rank: 2 },
  { key: "narberal", title: "Storm Maid", target: id("narberal"), what: "Narberal Gamma", count: 1, coins: 32, xp: 700, rank: 3 },
  { key: "cz_delta", title: "Silent Sniper", target: id("cz_delta"), what: "CZ2128 Delta", count: 1, coins: 32, xp: 700, rank: 3 },
  { key: "lupusregina", title: "The Laughing Wolf", target: id("lupusregina"), what: "Lupusregina Beta", count: 1, coins: 32, xp: 700, rank: 3 },
  { key: "entoma", title: "Spider's Whisper", target: id("entoma"), what: "Entoma Vasilissa Zeta", count: 1, coins: 32, xp: 700, rank: 3 },
  { key: "solution", title: "The Hungry Slime", target: id("solution"), what: "Solution Epsilon", count: 1, coins: 32, xp: 700, rank: 3 },
  { key: "yuri", title: "Captain of the Pleiades", target: id("yuri"), what: "Yuri Alpha", count: 1, coins: 36, xp: 800, rank: 4 },
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

// ------------------------------------------------------------------ storage

/** @type {Map<string, Profile>} */
const profiles = new Map();
/** Players whose profile changed since the last save. */
const dirty = new Set();

/** @returns {Profile} */
function freshProfile() {
  return { level: 1, xp: 0, points: 0, str: 0, vit: 0, int: 0, agi: 0, cls: "none", mana: 50, done: 0, hud: true, quest: null };
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
        if (saved[key] !== undefined && typeof saved[key] === typeof profile[key]) {
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

/** @param {import("@minecraft/server").Player} player */
function touch(player) {
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

/** Mana recovered per second. @param {Profile} p */
function manaRegen(p) {
  return (1 + p.int * 0.1) * (p.cls === "caster" ? 1.5 : 1);
}

/**
 * Multiplier for spell damage.
 * @param {import("@minecraft/server").Player} player
 */
export function spellPower(player) {
  const p = profileOf(player);
  return 1 + p.int * 0.02 + (p.cls === "caster" ? 0.3 : 0);
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
      `§6Lv.${p.level} §f${CLASSES[p.cls].name} §7| §bMP ${Math.floor(p.mana)}/${maxMana(p)} §7| §aXP ${percent}${questText}${points}`
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

/** @param {import("@minecraft/server").Entity} dead */
function killXp(dead) {
  const fixed = KILL_XP[dead.typeId];
  if (fixed !== undefined) return fixed;
  try {
    const health = dead.getComponent("minecraft:health");
    if (health) return Math.max(1, Math.round(health.effectiveMax / 2));
  } catch {
    // entity data is gone
  }
  return 5;
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
function giveItem(player, itemId, amount) {
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
    const killer = event.damageSource.damagingEntity;
    if (!killer || !killer.isValid || killer.typeId !== "minecraft:player") return;
    const player = /** @type {import("@minecraft/server").Player} */ (killer);
    const dead = event.deadEntity;
    if (dead.typeId === "minecraft:player") return;
    const typeId = dead.typeId;
    const xp = killXp(dead);
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

    let factor = p.str * 0.02 + (p.cls === "warrior" ? 0.2 : 0);
    if (p.cls === "cleric" && victim.matches({ families: ["undead"] })) factor += 0.3;
    let crit = false;
    if (p.cls === "assassin" && Math.random() < 0.25) {
      factor += 0.5;
      crit = true;
    }
    const bonus = event.damage * factor;
    if (bonus < 0.5) return;

    const health = victim.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0) return;
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
  if (current && current.amplifier === tier - 1 && current.duration > LONG / 2) return;
  if (current && current.amplifier > tier - 1) return; // a stronger source is active
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
    .button("How it works");
  show(form, player, (choice) => {
    if (choice === 0) openStats(player);
    else if (choice === 1) openClasses(player);
    else if (choice === 2) openQuests(player);
    else if (choice === 3) {
      p.hud = !p.hud;
      save(player);
      notify(player, p.hud ? "§7Status bar shown" : "§7Status bar hidden");
    } else if (choice === 4) openHelp(player);
  });
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
        `§eClasses§r: each class gives a permanent bonus and an active skill - sneak and use the plate to trigger it (${SKILL_COOLDOWN} s cooldown).\n\n` +
        "§eGuild quests§r: accept a request, defeat the targets and earn Gold Coins and XP. Completed quests raise your adventurer rank from Copper to Adamantite and unlock harder requests.\n\n" +
        `§eParty§r: players within ${PARTY_RANGE} blocks of a kill receive half its XP and quest credit.`
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
      if (p.mana < cap) p.mana = Math.min(cap, p.mana + manaRegen(p) / 2);
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
