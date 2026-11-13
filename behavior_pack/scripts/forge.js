// Overlord: Tomb of Nazarick - weapon reinforcement.
// Near a Dwarf Runesmith a player can have the weapon in their hand reinforced, up to
// +5. Each level adds 6% melee damage (applied in rpg.js) and is written on the item.
import { ActionFormData } from "@minecraft/server-ui";
import { notify, registerMenu } from "./rpg.js";
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
    id("takemikazuchi"), id("fell_iron"), id("charons_guidance"), id("angel_mace"), id("hellfire_blade")]
);

/** @typedef {import("@minecraft/server").Player} Player */

/** Gold Coins and adamantite ingots needed for the next level. @param {number} plus current level */
export function reinforceCost(plus) {
  return { coins: 15 * (plus + 1), ingots: plus + 1 };
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
  const cost = reinforceCost(plus);
  if (countItem(player, COIN) < cost.coins || countItem(player, INGOT) < cost.ingots) {
    return `§7+${plus + 1} costs ${cost.coins} Gold Coins and ${cost.ingots} Adamantite Ingot${cost.ingots === 1 ? "" : "s"}`;
  }
  // Mark the weapon first, so nothing is charged if the item cannot be changed.
  try {
    held.setDynamicProperty(PLUS_KEY, plus + 1);
    held.setLore([`§6Reinforced +${plus + 1}`, `§7+${(plus + 1) * 6}% melee damage`]);
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

registerMenu(
  () => "Reinforce weapon",
  (player) => {
    const held = player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
    const current = held && WEAPONS.has(held.typeId) ? held.getDynamicProperty(PLUS_KEY) : undefined;
    const plus = typeof current === "number" ? current : 0;
    const cost = reinforceCost(plus);
    const form = new ActionFormData()
      .title("Reinforce weapon")
      .body(
        `Stand within ${SMITH_RANGE} blocks of a Dwarf Runesmith with a weapon in your hand. Each level adds 6% melee damage, up to +${MAX_PLUS}.\n\n` +
          (held && WEAPONS.has(held.typeId)
            ? plus >= MAX_PLUS
              ? `Your weapon is already +${MAX_PLUS}.`
              : `Your weapon is +${plus}. Next level: ${cost.coins} Gold Coins and ${cost.ingots} Adamantite Ingot(s).`
            : "You are not holding a weapon that can be reinforced.")
      )
      .button("Reinforce")
      .button("Close");
    form
      .show(player)
      .then((response) => {
        if (response.canceled || response.selection !== 0 || !player.isValid) return;
        notify(player, reinforce(player));
      })
      .catch(() => {});
  }
);
