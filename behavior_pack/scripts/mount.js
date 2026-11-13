// Overlord: Tomb of Nazarick - Hamsuke, the Wise King of the Forest.
// A tamed Hamsuke grows with its rider: it gains hearts and strength from the rider's
// level, lashes nearby monsters with its tail while ridden (the kills count for the
// rider) and rests between fights.
import { world, system, EntityDamageCause } from "@minecraft/server";
import { notify, profileOf } from "./rpg.js";
import * as fx from "./vfx.js";

const HAMSUKE = "overlord:hamsuke";
const TICKS = 20;
const LONG = 20000000;
const LASH_EVERY = 3; // seconds between tail lashes
const LASH_RANGE = 4;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */

/** The Hamsuke a player is riding, if any. @param {Player} player @returns {Entity | undefined} */
export function steedOf(player) {
  try {
    const mount = player.getComponent("minecraft:riding")?.entityRidingOn;
    return mount && mount.isValid && mount.typeId === HAMSUKE ? mount : undefined;
  } catch {
    return undefined;
  }
}

/** Damage of one tail lash for a rider of this level. @param {number} level */
export function lashDamage(level) {
  return 4 + level * 0.2;
}

/** Hamsuke id -> tick of its next tail lash. */
const lashReady = new Map();
/** Players who have been told what a ridden Hamsuke does. */
const told = new Set();

/**
 * Keeps a ridden Hamsuke as strong as its rider and lets it fight. Returns how many monsters it struck.
 * @param {Player} player
 */
export function tendSteed(player) {
  const mount = steedOf(player);
  if (!mount) return 0;
  const level = profileOf(player).level;
  if (!told.has(player.id)) {
    told.add(player.id);
    notify(player, "§eHamsuke fights beneath you - its tail lashes monsters that come close");
  }
  // Every 6 rider levels is a tier of hearts; every 25 a tier of strength.
  const signature = `steed|${level}`;
  if (mount.getDynamicProperty("overlord:sig") !== signature) {
    mount.setDynamicProperty("overlord:sig", signature);
    const hearts = Math.floor(level / 6);
    const might = Math.floor(level / 25);
    if (hearts > 0) mount.addEffect("health_boost", LONG, { amplifier: hearts - 1, showParticles: false });
    if (might > 0) mount.addEffect("strength", LONG, { amplifier: might - 1, showParticles: false });
  }
  const now = system.currentTick;
  if (now < (lashReady.get(mount.id) ?? 0)) return 0;
  /** @type {Entity[]} */
  let foes = [];
  try {
    foes = mount.dimension.getEntities({ location: mount.location, maxDistance: LASH_RANGE, families: ["monster"] });
  } catch {
    // unloaded chunk
  }
  if (foes.length === 0) {
    // Nothing to fight: Hamsuke catches its breath.
    const health = mount.getComponent("minecraft:health");
    if (health && health.currentValue > 0 && health.currentValue < health.effectiveMax) {
      health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + 2));
    }
    return 0;
  }
  lashReady.set(mount.id, now + LASH_EVERY * TICKS);
  let struck = 0;
  for (const foe of foes) {
    try {
      foe.applyDamage(lashDamage(level), { cause: EntityDamageCause.entityAttack, damagingEntity: player });
      if (foe.isValid) {
        const dx = foe.location.x - mount.location.x;
        const dz = foe.location.z - mount.location.z;
        const len = Math.hypot(dx, dz) || 1;
        foe.applyKnockback({ x: (dx / len) * 1.0, z: (dz / len) * 1.0 }, 0.3);
      }
      struck++;
    } catch {
      // already dead
    }
  }
  fx.ring(mount.dimension, mount.location, "none", LASH_RANGE);
  return struck;
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      tendSteed(player);
    } catch {
      // player or mount is leaving
    }
  }
}, TICKS);

world.afterEvents.playerLeave.subscribe((event) => {
  told.delete(event.playerId);
});
