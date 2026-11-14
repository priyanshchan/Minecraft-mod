// Overlord: Tomb of Nazarick - daily bounty and titles.
// Each in-game day the guild posts one bounty for everyone; finishing bounties on
// consecutive days builds a streak that raises the reward. Deeds also earn titles,
// one of which can be worn in front of the player's name.
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import * as skills from "./skills.js";
import { ADVANCE_LEVEL, creditedPlayer, giveItem, grantXp, notify, profileOf, questEvent, registerMenu, touch } from "./rpg.js";
import { partyOf } from "./party.js";
import { STORY_TITLES } from "./campaign.js";
import { RACES } from "./races.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const COIN = id("yggdrasil_gold_coin");
/** Bestiary key under which slain elites are counted. */
export const ELITE_KEY = id("elite_foes");

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./rpg.js").Profile} Profile */

// ------------------------------------------------------------- daily bounty

/** The bounty board: one of these is posted each day. */
export const BOUNTIES = [
  { target: "minecraft:zombie", what: "Zombies", count: 10, coins: 8, xp: 120 },
  { target: id("goblin"), what: "Goblins", count: 10, coins: 10, xp: 140 },
  { target: "minecraft:skeleton", what: "Skeletons", count: 10, coins: 8, xp: 120 },
  { target: id("bandit"), what: "Bandits", count: 8, coins: 12, xp: 160 },
  { target: "minecraft:spider", what: "Spiders", count: 8, coins: 8, xp: 120 },
  { target: id("old_guarder"), what: "Nazarick Old Guarders", count: 8, coins: 12, xp: 160 },
  { target: "minecraft:creeper", what: "Creepers", count: 5, coins: 10, xp: 140 },
  { target: id("skeleton_mage"), what: "Skeleton Mages", count: 6, coins: 12, xp: 180 },
  { target: id("quagoa"), what: "Quagoa", count: 6, coins: 12, xp: 180 },
  { target: id("ogre"), what: "Ogres", count: 4, coins: 14, xp: 200 },
  { target: id("beastman"), what: "Beastman Warriors", count: 8, coins: 12, xp: 180 },
  { target: id("shadow_demon"), what: "Shadow Demons", count: 6, coins: 14, xp: 200 },
  { target: id("vampire_bride"), what: "Vampire Brides", count: 4, coins: 14, xp: 220 },
];
const MAX_STREAK = 5; // each day of streak adds 10% to the reward, up to +50%

/** The bounty posted on a given day. @param {number} day */
export function bountyOf(day) {
  return BOUNTIES[(((day * 7 + 3) % BOUNTIES.length) + BOUNTIES.length) % BOUNTIES.length]; // 7 is coprime with the list length, so every bounty comes round
}

/**
 * The player's bounty record, rolled over to today.
 * @param {Player} player @param {number} [today]
 * @returns {{ day: number, progress: number, done: boolean, streak: number, last: number, total: number }}
 */
export function dailyOf(player, today = world.getDay()) {
  const p = profileOf(player);
  const d = /** @type {any} */ (p.daily);
  const record = {
    day: Number(d.day ?? -1),
    progress: Number(d.progress ?? 0),
    done: Boolean(d.done),
    streak: Number(d.streak ?? 0),
    last: Number(d.last ?? -10),
    total: Number(d.total ?? 0),
  };
  if (record.day !== today) {
    record.day = today;
    record.progress = 0;
    record.done = false;
    if (record.last < today - 1) record.streak = 0; // a missed day ends the streak
  }
  p.daily = record;
  return record;
}

/** @param {Player} player @param {string} typeId */
function advanceBounty(player, typeId) {
  const today = world.getDay();
  const bounty = bountyOf(today);
  if (typeId !== bounty.target) return;
  const record = dailyOf(player, today);
  if (record.done) return;
  record.progress += 1;
  touch(player);
  if (record.progress < bounty.count) {
    notify(player, `§6Bounty: §f${bounty.what} ${record.progress}/${bounty.count}`);
    return;
  }
  record.done = true;
  record.streak = Math.min(MAX_STREAK, record.streak + 1);
  record.last = today;
  record.total += 1;
  const bonus = 1 + record.streak * 0.1;
  const coins = skills.bounty(profileOf(player), Math.round(bounty.coins * bonus)); // Bounty Hunter
  const xp = Math.round(bounty.xp * bonus * (1 + profileOf(player).level / 20));
  giveItem(player, COIN, coins);
  player.sendMessage(`§6[Bounty] §fDaily bounty complete! §6${coins} Gold Coins§f, §a${xp} XP§f. Streak: §e${record.streak} day${record.streak === 1 ? "" : "s"}§f (+${record.streak * 10}%).`);
  grantXp(player, xp, "bounty");
  questEvent(player, "bounty");
}

/** Day on which each player was last told about the bounty. */
const announced = new Map();

/** @param {Player} player */
function announce(player) {
  const today = world.getDay();
  if (announced.get(player.id) === today) return;
  announced.set(player.id, today);
  const bounty = bountyOf(today);
  const record = dailyOf(player, today);
  if (record.done) return;
  player.sendMessage(`§6[Bounty] §fToday's bounty: defeat §e${bounty.count} ${bounty.what}§f for ${bounty.coins} Gold Coins and bonus XP.${record.streak > 0 ? ` Your streak: ${record.streak}.` : ""}`);
}

// ------------------------------------------------------------------- titles

const UNDEAD = ["minecraft:zombie", "minecraft:skeleton", id("old_guarder"), id("skeleton_mage"), id("elder_lich"), id("death_knight"), id("soul_eater"), id("vampire_bride")];
const GUARDIANS = [id("albedo"), id("shalltear"), id("cocytus"), id("demiurge"), id("aura"), id("mare")];
/** @param {Profile} p @param {string[]} types */
const slain = (p, types) => types.reduce((n, t) => n + (p.kills[t] ?? 0), 0);

/** @type {{ key: string, name: string, how: string, earned: (p: Profile, player: Player) => boolean }[]} */
export const TITLES = [
  { key: "goblin_slayer", name: "Goblin Slayer", how: "Slay 50 Goblins", earned: (p) => slain(p, [id("goblin")]) >= 50 },
  { key: "undead_bane", name: "Undead Bane", how: "Slay 100 undead", earned: (p) => slain(p, UNDEAD) >= 100 },
  { key: "elite_hunter", name: "Elite Hunter", how: "Slay 10 elite foes", earned: (p) => slain(p, [ELITE_KEY]) >= 10 },
  { key: "bounty_hunter", name: "Bounty Hunter", how: "Complete 7 daily bounties", earned: (p) => Number(/** @type {any} */ (p.daily).total ?? 0) >= 7 },
  { key: "commander", name: "Commander", how: "Lead a party of three companions", earned: (_p, player) => partyOf(player).length >= 3 },
  { key: "sworn_lord", name: "Sworn Lord", how: "Reach the Sworn bond with a companion", earned: (_p, player) => partyOf(player).some((m) => m.bond >= 100) },
  { key: "archmage", name: "Archmage", how: "Learn 30 spells", earned: (p) => p.spells.length >= 30 },
  { key: "demon_hunter", name: "Demon Hunter", how: "Slay 50 demons", earned: (p) => slain(p, [id("hellhound"), id("shadow_demon"), id("evil_lord_wrath")]) >= 50 },
  { key: "worlds_shield", name: "World's Shield", how: "Help defeat 3 world bosses", earned: (p) => slain(p, [id("world_bosses")]) >= 3 },
  { key: "martial_lord", name: "Martial Lord", how: "Defeat Go Gin in the Imperial Arena", earned: (p) => slain(p, [id("go_gin")]) >= 1 },
  { key: "giant_killer", name: "Giant Killer", how: "Defeat Gargantua", earned: (p) => slain(p, [id("gargantua")]) >= 1 },
  { key: "dragon_slayer", name: "Dragon Slayer", how: "Defeat a dragon", earned: (p) => slain(p, [id("frost_dragon"), id("skeletal_dragon"), id("platinum_dragon_lord"), "minecraft:ender_dragon"]) >= 1 },
  { key: "demon_emperors_bane", name: "Demon Emperor's Bane", how: "Defeat Jaldabaoth", earned: (p) => slain(p, [id("jaldabaoth")]) >= 1 },
  { key: "grandmaster", name: "Grandmaster", how: `Bring a class to its advanced form (level ${ADVANCE_LEVEL})`, earned: (p) => p.cls !== "none" && p.level >= ADVANCE_LEVEL },
  { key: "guardians_bane", name: "Guardian's Bane", how: "Defeat a Floor Guardian", earned: (p) => slain(p, GUARDIANS) >= 1 },
  { key: "adamantite", name: "Adamantite Adventurer", how: "Complete 24 guild quests", earned: (p) => p.done >= 24 },
  { key: "rival_of_the_king", name: "Rival of the Sorcerer King", how: "Defeat Ainz Ooal Gown", earned: (p) => slain(p, [id("ainz")]) >= 1 },
  // v8.0: titles of the campaign and of the Sorcerer Kingdom
  ...STORY_TITLES.map((t) => ({ key: t.key, name: t.name, how: t.how, earned: (/** @type {Profile} */ p) => Array.isArray(p.story) && p.story.includes(t.chapter) })),
  { key: "lord_of_many_lands", name: "Lord of Many Lands", how: "Rule a kingdom with 5 outposts", earned: (p) => Array.isArray(p.realm?.outposts) && p.realm.outposts.length >= 5 },
  // v8.5: the court and the living kingdom
  { key: "master_of_guardians", name: "Master of the Guardians", how: "Swear all seven Floor Guardians to your court",
    earned: (p) => Object.keys(p.realm?.guardians ?? {}).length >= 7 },
  { key: "beloved_sovereign", name: "Beloved Sovereign", how: "Rule 100 citizens", earned: (p) => Number(p.realm?.population ?? 0) >= 100 },
  { key: "merchant_king", name: "Merchant King", how: "Run 4 trade routes", earned: (p) => Array.isArray(p.realm?.routes) && p.realm.routes.length >= 4 },
  // v8.1: the third rank of each race
  ...Object.entries(RACES).map(([race, info]) => ({ key: `race_${race}`, name: info.ranks[2], how: `Reach race level 10 as a ${info.name}`,
    earned: (/** @type {Profile} */ p) => p.race === race && Number(p.raceLv) >= 10 })),
  { key: "sorcerous_majesty", name: "Sorcerous Majesty", how: "Raise your capital to its fourth tier", earned: (p) => Number(p.realm?.tier ?? 0) >= 4 },
];
const TITLE_REWARD = 10;

/**
 * Grants any titles the player has newly earned. Returns their names.
 * @param {Player} player
 */
export function checkTitles(player) {
  const p = profileOf(player);
  const fresh = [];
  for (const title of TITLES) {
    if (p.titles.includes(title.key) || !title.earned(p, player)) continue;
    p.titles.push(title.key);
    fresh.push(title.name);
    giveItem(player, COIN, TITLE_REWARD);
    player.sendMessage(`§6[Title] §fYou earned the title §e${title.name}§f! (+${TITLE_REWARD} Gold Coins) Wear it from your Adventurer's Plate.`);
  }
  if (fresh.length > 0) touch(player);
  return fresh;
}

/** Shows the worn title in front of the player's name. @param {Player} player */
export function showTitle(player) {
  const p = profileOf(player);
  const title = TITLES.find((t) => t.key === p.title && p.titles.includes(t.key));
  try {
    const wanted = title ? `§e[${title.name}]§r ${player.name}` : player.name;
    if (player.nameTag !== wanted) player.nameTag = wanted;
  } catch {
    // name tags are cosmetic
  }
}

/**
 * @param {Player} player @param {string} key "" for no title
 */
export function wearTitle(player, key) {
  const p = profileOf(player);
  if (key !== "" && !p.titles.includes(key)) return false;
  p.title = key;
  touch(player);
  showTitle(player);
  return true;
}

// ------------------------------------------------------------------- events

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const player = creditedPlayer(event.damageSource.damagingEntity);
    if (!player || event.deadEntity.typeId === "minecraft:player") return;
    advanceBounty(player, event.deadEntity.typeId);
    // Titles are checked a moment later, once the kill has been written to the bestiary.
    system.runTimeout(() => {
      if (player.isValid) checkTitles(player);
    }, 1);
  } catch {
    // killer left
  }
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      announce(player);
      checkTitles(player);
      showTitle(player);
    } catch {
      // player is leaving
    }
  }
}, 10 * TICKS);

world.afterEvents.playerLeave.subscribe((event) => announced.delete(event.playerId));

// -------------------------------------------------------------------- menus

registerMenu(
  (player) => (dailyOf(player).done ? "Daily bounty (done)" : "Daily bounty"),
  (player) => {
    const bounty = bountyOf(world.getDay());
    const record = dailyOf(player);
    const form = new ActionFormData()
      .title("Daily bounty")
      .body(
        `Today: defeat §e${bounty.count} ${bounty.what}§r\n` +
          `Progress: ${record.done ? "§acomplete§r" : `§a${record.progress}/${bounty.count}§r`}\n` +
          `Reward: §6${bounty.coins} Gold Coins§r and XP that grows with your level\n` +
          `Streak: §e${record.streak}§r day(s) - each adds 10% to the reward, up to +${MAX_STREAK * 10}%\n` +
          `Bounties completed: ${record.total}\n\nA new bounty is posted every in-game day. Missing a day ends the streak.`
      )
      .button("Close");
    form.show(player).catch(() => {});
  }
);

registerMenu(
  (player) => `Titles (${profileOf(player).titles.length}/${TITLES.length})`,
  (player) => {
    const p = profileOf(player);
    const form = new ActionFormData()
      .title("Titles")
      .body("A worn title is shown in front of your name. Each title also pays 10 Gold Coins when first earned.");
    for (const title of TITLES) {
      const owned = p.titles.includes(title.key);
      form.button(`${owned ? "" : "§8"}${title.name}${p.title === title.key ? " (worn)" : ""}\n${owned ? "Tap to wear" : title.how}`);
    }
    form.button("Wear no title");
    form
      .show(player)
      .then((response) => {
        if (response.canceled || response.selection === undefined || !player.isValid) return;
        const title = TITLES[response.selection];
        if (!title) wearTitle(player, "");
        else if (!wearTitle(player, title.key)) notify(player, `§7Not earned yet: ${title.how}`);
        else notify(player, `§eYou now bear the title ${title.name}`);
      })
      .catch(() => {});
  }
);
