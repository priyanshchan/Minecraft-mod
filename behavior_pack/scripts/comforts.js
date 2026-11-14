// Overlord: Tomb of Nazarick - comforts of Nazarick: meals that strengthen, and rings worn in the off hand.
//
// Sebas's Black Tea quickens hand and foot and restores some mana; the Nazarick Feast Pie heals over time
// and adds two hearts for five minutes; the Spicy Dragon Skewer wards off fire and lends strength. A Ring of
// Sustenance in the off hand keeps its wearer fed and slowly mends them while they stand still; a Ring of
// the Fleet Foot lends Speed and Jump Boost.
import { world, system, EquipmentSlot } from "@minecraft/server";
import { notify, restoreMana } from "./rpg.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;

/** @typedef {import("@minecraft/server").Player} Player */

/** What each meal does: [effect, seconds, amplifier][], mana restored, and the message. */
export const MEALS = {
  [id("sebas_tea")]: { effects: /** @type {[string, number, number][]} */ ([["haste", 90, 1], ["speed", 90, 0]]), mana: 30, text: "§6A perfect cup. Your hands and feet feel quick." },
  [id("feast_pie")]: { effects: /** @type {[string, number, number][]} */ ([["regeneration", 30, 0], ["health_boost", 300, 0]]), mana: 0, text: "§6A feast fit for the Supreme Beings. +2 hearts for 5 minutes." },
  [id("dragon_skewer")]: { effects: /** @type {[string, number, number][]} */ ([["fire_resistance", 180, 0], ["strength", 60, 0]]), mana: 0, text: "§6Fiery! Flames cannot touch you for a while." },
};

/** Eats a meal: its effects, any mana, a glow and a word. Returns whether it was one. @param {Player} player @param {string} item */
export function eat(player, item) {
  const meal = MEALS[item];
  if (!meal) return false;
  for (const [effect, seconds, amplifier] of meal.effects) {
    try {
      player.addEffect(effect, seconds * TICKS, { amplifier, showParticles: false });
    } catch {
      // no such effect here
    }
  }
  if (meal.mana > 0) restoreMana(player, meal.mana);
  fx.rise(player.dimension, player.location, item === id("dragon_skewer") ? "fire" : "holy", 0.6);
  notify(player, meal.text);
  return true;
}

/** The ring in the player's off hand, if any. @param {Player} player */
export function ringOf(player) {
  try {
    const item = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Offhand)?.typeId;
    return item === id("ring_of_sustenance") || item === id("ring_of_fleet_foot") ? item : undefined;
  } catch {
    return undefined;
  }
}

/** Player id -> where they stood last check, for the Ring of Sustenance's mending. */
const stood = new Map();

/** One check of a player's ring. Returns what it did. @param {Player} player */
export function wear(player) {
  const ring = ringOf(player);
  if (!ring) return "";
  if (ring === id("ring_of_fleet_foot")) {
    player.addEffect("speed", 3 * TICKS, { amplifier: 0, showParticles: false });
    player.addEffect("jump_boost", 3 * TICKS, { amplifier: 0, showParticles: false });
    return "fleet";
  }
  player.addEffect("saturation", 2 * TICKS, { amplifier: 0, showParticles: false });
  try {
    if (player.getEffect("hunger")) player.removeEffect("hunger");
  } catch {
    // nothing to lift
  }
  const last = stood.get(player.id);
  const here = player.location;
  stood.set(player.id, { x: here.x, z: here.z });
  if (last && Math.hypot(last.x - here.x, last.z - here.z) < 0.2) {
    const health = player.getComponent("minecraft:health");
    if (health && health.currentValue > 0 && health.currentValue < health.effectiveMax) {
      health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + 1));
      return "mend";
    }
  }
  return "fed";
}

world.afterEvents.itemCompleteUse.subscribe((event) => {
  try {
    eat(event.source, event.itemStack.typeId);
  } catch (error) {
    console.warn(`[Overlord] a meal failed: ${error}`);
  }
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      wear(player);
    } catch {
      // the player is leaving
    }
  }
}, 2 * TICKS);

world.afterEvents.playerLeave.subscribe((event) => stood.delete(event.playerId));
