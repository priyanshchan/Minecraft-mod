// Overlord: Tomb of Nazarick - the restless dead of the Katze Plains.
//
// A Wraith that has a player in reach does not walk to them: now and then it vanishes and steps out of the
// air behind them, where it is hard to see coming.
import { world, system } from "@minecraft/server";
import * as fx from "./vfx.js";

const WRAITH = "overlord:wraith";
const TICKS = 20;
/** Seconds between two blinks of one Wraith, and the reach within which it blinks at a player. */
export const BLINK_REST = 6;
export const BLINK_REACH = 14;
/** Wraith id -> tick of its next blink. */
const rest = new Map();

/**
 * A Wraith near the player may step behind them. Returns the Wraiths that blinked.
 * @param {import("@minecraft/server").Player} player @param {number} now @param {() => number} [random]
 */
export function haunt(player, now, random = Math.random) {
  /** @type {import("@minecraft/server").Entity[]} */
  let near = [];
  try {
    near = player.dimension.getEntities({ type: WRAITH, location: player.location, maxDistance: BLINK_REACH });
  } catch {
    return [];
  }
  const moved = [];
  for (const wraith of near) {
    if (!wraith.isValid || wraith.typeId !== WRAITH || now < (rest.get(wraith.id) ?? 0) || random() > 0.35) continue;
    rest.set(wraith.id, now + BLINK_REST * TICKS);
    let view = { x: 0, y: 0, z: 1 };
    try {
      view = player.getViewDirection();
    } catch {
      // facing on
    }
    const length = Math.hypot(view.x, view.z) || 1;
    const to = { x: player.location.x - (view.x / length) * 2, y: player.location.y, z: player.location.z - (view.z / length) * 2 };
    const from = { ...wraith.location };
    try {
      wraith.teleport(to, { facingLocation: player.location });
    } catch {
      continue;
    }
    fx.blink(player.dimension, from, to, "dark");
    moved.push(wraith);
  }
  return moved;
}

system.runInterval(() => {
  const now = system.currentTick;
  for (const player of world.getAllPlayers()) {
    try {
      haunt(player, now);
    } catch {
      // the player is leaving
    }
  }
}, 3 * TICKS);

world.afterEvents.entityDie.subscribe((event) => {
  if (event.deadEntity.typeId === WRAITH) rest.delete(event.deadEntity.id);
});
