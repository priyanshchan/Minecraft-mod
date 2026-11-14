// Overlord: Tomb of Nazarick - weapon reinforcement.
// Near a Dwarf Runesmith a player can have the weapon in their hand reinforced, up to
// +5. Each level adds 6% melee damage (applied in rpg.js) and is written on the item.
import { ActionFormData } from "@minecraft/server-ui";
import { notify, profileOf, registerMenu } from "./rpg.js";
import * as skills from "./skills.js";
import { countItem, takeItem } from "./spells.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const COIN = id("yggdrasil_gold_coin");
const INGOT = id("adamantite_ingot");

export const MAX_PLUS = 5;
export const PLUS_KEY = "overlord:plus";
const SMITH_RANGE = 10;

/** Weapons that can be reinforced. */
const WEAPONS = new Set(
  [id("staff_of_ainz_ooal_gown"), id("spuit_lance"), id("ginnungagap"), id("god_slaying_emperor_blade"),
    id("death_knight_sword"), id("dark_warrior_greatsword"), id("razor_edge"), id("stiletto"), id("shadow_of_yggdrasil"),
    id("aura_whip"), id("frost_pain"), id("brain_katana"), id("iron_gauntlets"), id("holy_staff"), id("blade_bug"),
    id("fluder_staff"), id("golem_fist"), id("runic_hammer"), id("fang_dagger"), id("kilineyram"), id("safarlisia"),
    id("takemikazuchi"), id("fell_iron"), id("charons_guidance"), id("angel_mace"), id("hellfire_blade"),
    id("giants_maul"), id("dragonbone_blade"), id("six_arms_knuckles"), id("martial_lord_club"),
    id("elf_kings_staff"), id("cavalier_lance"), id("ghoulfang_sickle"), id("heartwood_staff"), id("runeblade")]
);

/** Runes a runesmith can inscribe on a weapon; a weapon holds one at a time. */
/** @type {Record<string, { name: string, item: string, help: string }>} */
export const RUNES = {
  fire: { name: "Rune of Fire", item: id("rune_of_fire"), help: "sets whatever it strikes alight" },
  frost: { name: "Rune of Frost", item: id("rune_of_frost"), help: "slows whatever it strikes" },
  storm: { name: "Rune of Storm", item: id("rune_of_storm"), help: "a second jolt of lightning after every blow" },
  life: { name: "Rune of Life", item: id("rune_of_life"), help: "heals you for 8% of the damage dealt" },
};
export const RUNE_KEY = "overlord:rune";

/** @typedef {import("@minecraft/server").Player} Player */

/** The rune inscribed on an item, if any. @param {import("@minecraft/server").ItemStack | undefined} item */
export function runeOf(item) {
  try {
    const rune = item?.getDynamicProperty(RUNE_KEY);
    return typeof rune === "string" && RUNES[rune] ? rune : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes an item's lore from its properties. gear.js installs a writer that also knows quality and
 * gems; until then (and in tests without it) reinforcement and rune are written.
 * @type {(item: import("@minecraft/server").ItemStack) => string[]}
 */
let writeLore = (item) => {
  const raw = item.getDynamicProperty(PLUS_KEY);
  return loreFor(typeof raw === "number" ? raw : 0, runeOf(item));
};

/** @param {(item: import("@minecraft/server").ItemStack) => string[]} writer */
export function setLoreWriter(writer) {
  writeLore = writer;
}

/** The lines written on a worked weapon. @param {number} plus @param {string | undefined} rune */
function loreFor(plus, rune) {
  const lines = [];
  if (plus > 0) lines.push(`§6Reinforced +${plus}`, `§7+${plus * 6}% melee damage`);
  if (rune) lines.push(`§b${RUNES[rune].name}`, `§7${RUNES[rune].help}`);
  return lines;
}

/**
 * Gold Coins and adamantite ingots needed for the next level; a Haggler pays fewer coins.
 * @param {number} plus current level @param {Player} [player]
 */
export function reinforceCost(plus, player) {
  const coins = 15 * (plus + 1);
  return { coins: player ? skills.haggle(profileOf(player), coins) : coins, ingots: plus + 1 };
}

/**
 * Reinforces the weapon in the player's hand by one level. Returns a message describing the outcome.
 * @param {Player} player
 */
export function reinforce(player) {
  const container = player.getComponent("minecraft:inventory")?.container;
  const held = container?.getItem(player.selectedSlotIndex);
  if (!container || !held || !WEAPONS.has(held.typeId)) return "§7Hold one of the add-on's weapons to reinforce it";
  const smiths = player.dimension.getEntities({ type: id("dwarf"), location: player.location, maxDistance: SMITH_RANGE });
  if (smiths.length === 0) return "§7Only a Dwarf Runesmith can do this work - find one at a Dwarven Forge";
  const current = held.getDynamicProperty(PLUS_KEY);
  const plus = typeof current === "number" ? current : 0;
  if (plus >= MAX_PLUS) return `§7This weapon is already +${MAX_PLUS}`;
  const cost = reinforceCost(plus, player);
  if (countItem(player, COIN) < cost.coins || countItem(player, INGOT) < cost.ingots) {
    return `§7+${plus + 1} costs ${cost.coins} Gold Coins and ${cost.ingots} Adamantite Ingot${cost.ingots === 1 ? "" : "s"}`;
  }
  // Mark the weapon first, so nothing is charged if the item cannot be changed.
  try {
    held.setDynamicProperty(PLUS_KEY, plus + 1);
    held.setLore(writeLore(held));
    container.setItem(player.selectedSlotIndex, held);
  } catch {
    return "§7This weapon cannot be reinforced";
  }
  takeItem(player, COIN, cost.coins);
  takeItem(player, INGOT, cost.ingots);
  try {
    player.playSound("random.anvil_use", { volume: 1, pitch: 1 });
  } catch {
    // cosmetic only
  }
  return `§aThe runesmith reinforces your weapon to +${plus + 1}`;
}

/**
 * Inscribes a rune from the player's inventory on the weapon in their hand, replacing any rune already there.
 * @param {Player} player @param {string} rune
 */
export function inscribe(player, rune) {
  const kind = RUNES[rune];
  if (!kind) return "§7No such rune";
  const container = player.getComponent("minecraft:inventory")?.container;
  const held = container?.getItem(player.selectedSlotIndex);
  if (!container || !held || !WEAPONS.has(held.typeId)) return "§7Hold one of the add-on's weapons to inscribe it";
  const smiths = player.dimension.getEntities({ type: id("dwarf"), location: player.location, maxDistance: SMITH_RANGE });
  if (smiths.length === 0) return "§7Only a Dwarf Runesmith can inscribe runes - find one at a Dwarven Forge";
  if (runeOf(held) === rune) return `§7This weapon already bears the ${kind.name}`;
  if (countItem(player, kind.item) < 1) return `§7You have no ${kind.name}`;
  const current = held.getDynamicProperty(PLUS_KEY);
  try {
    held.setDynamicProperty(RUNE_KEY, rune);
    held.setLore(writeLore(held));
    container.setItem(player.selectedSlotIndex, held);
  } catch {
    return "§7This weapon cannot be inscribed";
  }
  takeItem(player, kind.item, 1);
  try {
    player.playSound("random.anvil_use", { volume: 1, pitch: 1.4 });
  } catch {
    // cosmetic only
  }
  return `§aThe runesmith inscribes the ${kind.name}: it ${kind.help}`;
}

registerMenu(
  () => "Forge: reinforce and runes",
  (player) => {
    const held = player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
    const workable = held !== undefined && WEAPONS.has(held.typeId);
    const current = workable ? held.getDynamicProperty(PLUS_KEY) : undefined;
    const plus = typeof current === "number" ? current : 0;
    const cost = reinforceCost(plus, player);
    const rune = workable ? runeOf(held) : undefined;
    const owned = Object.keys(RUNES).filter((key) => countItem(player, RUNES[key].item) > 0);
    const form = new ActionFormData()
      .title("Forge")
      .body(
        `Stand within ${SMITH_RANGE} blocks of a Dwarf Runesmith with a weapon in your hand.\n\n` +
          `§eReinforcing§r adds 6% melee damage a level, up to +${MAX_PLUS}. ` +
          (workable
            ? plus >= MAX_PLUS
              ? `Your weapon is already +${MAX_PLUS}.`
              : `Your weapon is +${plus}; the next level costs ${cost.coins} Gold Coins and ${cost.ingots} Adamantite Ingot(s).`
            : "You are not holding a weapon that can be worked.") +
          `\n\n§eRunes§r: a weapon bears one rune at a time, and a new one replaces the old. ` +
          (rune ? `Your weapon bears the ${RUNES[rune].name}.` : "Your weapon bears no rune.") +
          "\n" +
          Object.values(RUNES).map((r) => `${r.name}: ${r.help}`).join("\n")
      )
      .button("Reinforce");
    for (const key of owned) form.button(`Inscribe the ${RUNES[key].name}`);
    form.button("Close");
    form
      .show(player)
      .then((response) => {
        if (response.canceled || response.selection === undefined || !player.isValid) return;
        if (response.selection === 0) notify(player, reinforce(player));
        else if (response.selection <= owned.length) notify(player, inscribe(player, owned[response.selection - 1]));
      })
      .catch(() => {});
  }
);
