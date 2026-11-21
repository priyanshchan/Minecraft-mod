// Overlord: Tomb of Nazarick - the divine arms (v9.7): what super-tier and god-tier armour does when worn in full,
// and the spell power of the Staff of the Eight Elements.
//
// The weapons' arts and traits, the sets' two-piece bonuses and arts, and the rule that each piece answers only to
// a bearer of level 70 (super-tier) or 80 (god-tier), live with the other arms in arms.js.
//
// - Seraph's Holy Plate, in full: Resistance II, Regeneration I and Fire Resistance; sneaking in the air glides.
// - Raiment of the Supreme Beings, in full: Strength II, Resistance II, Regeneration I and Fire Resistance; poison
//   and wither cannot take hold; +25% spell power; and Last Stand - once every five minutes, falling below a fifth
//   of your health restores all of it and shields you.
import { world, system } from "@minecraft/server";
import { healPlayer, hooks, notify } from "./rpg.js";
import { heldWeapon, wornSets, worthy } from "./arms.js";
import * as fx from "./vfx.js";

const TICKS = 20;
export const LAST_STAND_EVERY = 300; // seconds
export const LAST_STAND_AT = 0.2; // share of health

/** @typedef {import("@minecraft/server").Player} Player */

/** Tick at which each player's Last Stand is ready again. @type {Map<string, number>} */
export const lastStand = new Map();

/** Whether a player wears a whole divine set and is worthy of it. @param {Player} player @param {string} set */
export function wearsDivine(player, set) {
  return (wornSets(player)[set] ?? 0) >= 4 && worthy(player, set);
}

/**
 * One look at a player's divine armour. Returns what it did.
 * @param {Player} player @param {number} now
 */
export function grace(player, now) {
  /** @type {string[]} */
  const did = [];
  const lend = (/** @type {string} */ effect, amplifier = 0) => player.addEffect(effect, 3 * TICKS, { amplifier, showParticles: false });
  if (wearsDivine(player, "seraph")) {
    lend("resistance", 1);
    lend("regeneration");
    lend("fire_resistance");
    let aloft = false;
    try {
      aloft = player.isOnGround === false;
    } catch {
      // assume on the ground
    }
    if (aloft && player.isSneaking) {
      lend("slow_falling");
      did.push("glide");
    }
    did.push("seraph");
  }
  if (wearsDivine(player, "supreme")) {
    lend("strength", 1);
    lend("resistance", 1);
    lend("regeneration");
    lend("fire_resistance");
    for (const e of ["poison", "wither"]) {
      try {
        if (player.getEffect(e)) player.removeEffect(e);
      } catch {
        // no such effect
      }
    }
    did.push("supreme");
    const health = player.getComponent("minecraft:health");
    if (health && health.currentValue > 0 && health.currentValue <= health.effectiveMax * LAST_STAND_AT && now >= (lastStand.get(player.id) ?? 0)) {
      lastStand.set(player.id, now + LAST_STAND_EVERY * TICKS);
      healPlayer(player, health.effectiveMax);
      player.addEffect("absorption", 15 * TICKS, { amplifier: 3, showParticles: false });
      player.addEffect("resistance", 5 * TICKS, { amplifier: 3, showParticles: false });
      try {
        fx.crown(player.dimension, player.location, "dark", 8, 1.6);
        fx.nova(player.dimension, player.location, "holy", 5);
      } catch {
        // cosmetic only
      }
      notify(player, "§6Last Stand! §fThe Supreme Beings will not let you fall.");
      did.push("last_stand");
    }
  }
  return did;
}

// The Staff of the Eight Elements, and the Raiment worn in full, strengthen every spell.
hooks.power.push((player) => {
  let bonus = 0;
  if (heldWeapon(player) === "eight_elements_staff" && worthy(player, "eight_elements_staff")) bonus += 0.3;
  if (wearsDivine(player, "supreme")) bonus += 0.25;
  return bonus;
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      grace(player, system.currentTick);
    } catch {
      // the player is leaving
    }
  }
}, 10);

world.afterEvents.playerLeave.subscribe((event) => lastStand.delete(event.playerId));
