// Overlord: Tomb of Nazarick - the Creative Tome of Ascension, a testing aid.
//
// Works only for a player in creative mode (it cannot be crafted; take it from the creative inventory or
// with /give @s overlord:ascension_tome). Using it opens a menu to raise or reset your level, learn every
// spell, unlock god-tier magic, refill health and mana and clear spell recharges, or take a kit of the
// materials the add-on's systems use. Sneak + use is a quick +10 levels.
import { world, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { MAX_LEVEL, giveItem, notify, profileOf, restoreMana, setLevel, touch } from "./rpg.js";
import { learnAll, resetCooldowns } from "./spells.js";
import { CHAPTERS, completeStory } from "./campaign.js";
import { MAX_RACE_LEVEL, RACES, raceOf, setRaceLevel } from "./races.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
export const TOME = id("ascension_tome");

/** @typedef {import("@minecraft/server").Player} Player */

/** Whether a player is in creative mode. @param {Player} player */
export function inCreative(player) {
  try {
    return player.getGameMode() === GameMode.Creative;
  } catch {
    return false;
  }
}

/** Raises (or lowers) the player's level by some amount. Returns a message. @param {Player} player @param {number} by */
export function ascend(player, by) {
  const before = profileOf(player).level;
  const after = setLevel(player, before + by);
  try {
    fx.rise(player.dimension, player.location, "holy", 1);
    fx.flash(player.dimension, fx.handOf(player), "holy", 1);
    player.playSound("random.levelup", { volume: 1, pitch: 1 });
  } catch {
    // cosmetic only
  }
  return after === before ? `§7Already level ${after}` : `§aLevel ${before} → §6${after}§a (stat and skill points granted)`;
}

/** Everything the add-on's systems use, to try them at once. @param {Player} player */
export function testKit(player) {
  /** @type {[string, number][]} */
  const kit = [
    [id("data_crystal"), 64], [id("yggdrasil_gold_coin"), 64], [id("refining_stone"), 32], [id("adamantite_ingot"), 16],
    [id("codex_of_skills"), 10], [id("tomb_key"), 1], [id("guardian_crest"), 4], [id("blue_potion"), 8],
    ...["ruby", "sapphire", "topaz", "jade", "onyx", "sunstone"].map((g) => /** @type {[string, number]} */ ([id(`gem_${g}`), 4])),
  ];
  for (const [item, amount] of kit) giveItem(player, item, amount);
  return "§aTest kit given: crystals, coins, refining stones, ingots, codices, a Tomb key, crests, mana potions and gems";
}

/** Marks the Great Tomb conquered, which god-tier magic requires. @param {Player} player */
export function unlockGodTier(player) {
  const p = profileOf(player);
  if (!Array.isArray(p.bosses)) p.bosses = [];
  if (!p.bosses.includes("great_tomb")) p.bosses.push("great_tomb");
  touch(player);
  return "§5The Great Tomb counts as conquered: god-tier magic can now be learned";
}

/** Full health and mana, and every spell ready. @param {Player} player */
export function refresh(player) {
  try {
    const health = player.getComponent("minecraft:health");
    if (health) health.setCurrentValue(health.effectiveMax);
  } catch {
    // no health component
  }
  restoreMana(player, 100000);
  resetCooldowns(player);
  return "§bHealth and mana full; every spell is ready";
}

/** @param {Player} player */
export function openTome(player) {
  const p = profileOf(player);
  /** @type {[string, () => string][]} */
  const actions = [
    ["+1 level", () => ascend(player, 1)],
    ["+10 levels", () => ascend(player, 10)],
    [`Level ${MAX_LEVEL}`, () => ascend(player, MAX_LEVEL)],
    ["Learn every spell", () => `§dLearned ${learnAll(player)} new spell(s)`],
    ["Unlock god-tier magic\n(counts the Great Tomb as conquered)", () => unlockGodTier(player)],
    ["Full health and mana, spells ready", () => refresh(player)],
    ["Test kit\n(crystals, coins, stones, gems, codices...)", () => testKit(player)],
    ["Finish the campaign\n(crowned: the kingdom can be founded)", () => {
      const added = completeStory(player);
      giveItem(player, id("royal_seal"), 1);
      return added > 0 ? `§6${added} chapter(s) marked done: you are crowned. Seal given.` : `§7All ${CHAPTERS.length} chapters were already done. Seal given.`;
    }],
    ["Race to its top level\n(choose a race first; unlocks the true form)", () => {
      const race = raceOf(profileOf(player));
      if (race === "none") return "§7Choose a race on your Adventurer's Plate first";
      setRaceLevel(player, MAX_RACE_LEVEL);
      return `§dYou are ${RACES[race].ranks[2]}, race level ${MAX_RACE_LEVEL}`;
    }],
    ["Count every Floor Guardian defeated\n(they may be sworn to your court)", () => {
      const p = profileOf(player);
      if (!Array.isArray(p.bosses)) p.bosses = [];
      for (const key of ["albedo", "demiurge", "cocytus", "shalltear", "aura", "mare", "pandoras_actor"]) if (!p.bosses.includes(key)) p.bosses.push(key);
      touch(player);
      return "§dEvery Floor Guardian counts as defeated: swear them in from the Kingdom page";
    }],
    ["Back to level 1\n(refunds stat points, forgets skills)", () => {
      profileOf(player).skills = {};
      return ascend(player, -MAX_LEVEL);
    }],
  ];
  const form = new ActionFormData()
    .title("Creative Tome of Ascension")
    .body(`§7A testing aid for creative mode.§r\n\nLevel §6${p.level}§r, §d${p.points}§r stat points unspent.\nSneak + use the tome for a quick +10 levels.`);
  for (const [label] of actions) form.button(label);
  form.button("Close");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      const action = actions[response.selection];
      if (!action || !inCreative(player)) return;
      notify(player, action[1]());
      openTome(player);
    })
    .catch(() => {});
}

world.afterEvents.itemUse.subscribe((event) => {
  try {
    if (event.itemStack?.typeId !== TOME) return;
    const player = event.source;
    if (!inCreative(player)) {
      notify(player, "§7The Creative Tome of Ascension works only in creative mode");
      return;
    }
    if (player.isSneaking) notify(player, ascend(player, 10));
    else openTome(player);
  } catch (error) {
    console.warn(`[Overlord] the tome failed: ${error}`);
  }
});
