// Overlord: Tomb of Nazarick - soulbound tools.
//
// The Adventurer's Plate, the Grimoire and the Magic Wand stay with their owner through death: they are not dropped
// where you fall, and they are still in your inventory when you respawn. The game keeps any item marked "keep on
// death"; Overlord marks these three wherever they are carried (inventory, hotbar or off hand), every couple of
// seconds and as soon as it hands one out. The mark is set on the slot itself, so the item in your hand is not
// swapped out and back (which would replay the hand's draw animation).
import { world, system, EquipmentSlot } from "@minecraft/server";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;

/** The tools that stay with their owner through death. */
export const SOULBOUND = new Set(["adventurer_plate", "grimoire", "magic_wand"].map(id));

/** @typedef {import("@minecraft/server").Player} Player */

/**
 * Marks one inventory slot's item to be kept on death, if it is a soulbound tool. Returns whether it marked it.
 * @param {import("@minecraft/server").Container} container @param {number} index
 */
function bindSlot(container, index) {
  if (typeof container.getSlot === "function") {
    const slot = container.getSlot(index);
    if (!slot.hasItem() || !SOULBOUND.has(slot.typeId) || slot.keepOnDeath) return false;
    slot.keepOnDeath = true;
    return true;
  }
  const stack = container.getItem(index); // older or simpler containers: rewrite the stack
  if (!stack || !SOULBOUND.has(stack.typeId) || stack.keepOnDeath) return false;
  stack.keepOnDeath = true;
  container.setItem(index, stack);
  return true;
}

/** Marks every soulbound tool a player carries. Returns how many it marked. @param {Player} player */
export function bindAll(player) {
  let bound = 0;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (container) {
    for (let i = 0; i < container.size; i++) {
      try {
        if (bindSlot(container, i)) bound++;
      } catch {
        // an empty or locked slot
      }
    }
  }
  try {
    const off = player.getComponent("minecraft:equippable")?.getEquipmentSlot(EquipmentSlot.Offhand);
    if (off && off.hasItem() && SOULBOUND.has(off.typeId) && !off.keepOnDeath) {
      off.keepOnDeath = true;
      bound++;
    }
  } catch {
    // nothing in the off hand
  }
  return bound;
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      bindAll(player);
    } catch {
      // the player is leaving
    }
  }
}, 40);
