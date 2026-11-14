// Overlord: Tomb of Nazarick - steeds: the Nazarick Wyrm, the Soul Eater, and barding for mounts.
//
// A Whistle of the Nazarick Wyrm or the Reins of the Soul Eater calls the player's own steed to their side
// (spawning it the first time); sneak + use sends it away. Each player has one of each.
//
// The wyrm flies. Jump while riding to take off; in the air it goes where the rider looks while they press
// forward, climbs while they hold jump, hovers when they let go and lands when it touches the ground.
// Sprinting flies faster. Using the whistle while riding breathes fire ahead. The Soul Eater runs: it is
// steered like a horse, tramples monsters it runs into and, with the reins used while riding, charges.
//
// Barding is armour for a mount: use it on your wyrm, your Soul Eater or a tamed Hamsuke. Adamantite gives
// Resistance I; the Barding of Nazarick Resistance II, Fire Resistance and Regeneration. Using a second
// barding hands the first back.
import { world, system, EquipmentSlot } from "@minecraft/server";
import { giveItem, notify, profileOf } from "./rpg.js";
import { foesNear, strike } from "./arms.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const LONG = 20000000;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** The steeds, by the item that calls them. */
export const STEEDS = {
  [id("wyrm_whistle")]: { kind: "wyrm", type: id("wyrm_steed"), name: "Nazarick Wyrm", flies: true },
  [id("soul_reins")]: { kind: "soul", type: id("soul_steed"), name: "Soul Eater", flies: false },
};
/** Armour for mounts: tier, and what it grants. */
export const BARDING = {
  [id("adamantite_barding")]: { tier: 1, name: "Adamantite Barding" },
  [id("nazarick_barding")]: { tier: 2, name: "Barding of Nazarick" },
};
/** Blocks a tick the wyrm flies, and with the rider sprinting. */
export const FLY_SPEED = 0.6;
export const SPRINT_SPEED = 1.0;
/** Blocks a tick the wyrm walks on the ground. */
export const WALK_SPEED = 0.28;
/** Blocks a tick the wyrm climbs while the rider holds jump. */
export const CLIMB = 0.35;
/** Seconds between two breaths of the wyrm and two charges of the Soul Eater. */
export const BREATH_COOLDOWN = 4;
export const CHARGE_COOLDOWN = 6;
/** Seconds before a slain steed can be called again. */
export const MOURNING = 60;

// ------------------------------------------------------------------ ownership

/** @param {Player} player @param {string} kind */
function ownerTag(player, kind) {
  return `overlord_steed_${kind}_${player.id}`;
}

/** The player's steed of a kind, if it is loaded. @param {Player} player @param {string} kind */
export function steedOf(player, kind) {
  try {
    return player.dimension.getEntities({ tags: [ownerTag(player, kind)] }).find((e) => e.isValid);
  } catch {
    return undefined;
  }
}

/** Player id + kind -> tick before which the steed cannot be called (it was slain). */
const mourning = new Map();

/**
 * Calls the player's steed to their side, raising it the first time. Returns a message.
 * @param {Player} player @param {string} item @param {number} [now]
 */
export function call(player, item, now = system.currentTick) {
  const steed = STEEDS[item];
  if (!steed) return "§7Nothing answers";
  const key = `${player.id}|${steed.kind}`;
  if (now < (mourning.get(key) ?? 0)) return `§7Your ${steed.name} was slain: it returns in ${Math.ceil(((mourning.get(key) ?? 0) - now) / TICKS)}s`;
  const at = beside(player);
  const existing = steedOf(player, steed.kind);
  if (existing) {
    try {
      existing.teleport(at);
    } catch {
      // stays where it is
    }
    fx.blink(player.dimension, existing.location, at, steed.flies ? "dark" : "acid");
    return `§dYour ${steed.name} comes to you`;
  }
  try {
    const mount = player.dimension.spawnEntity(steed.type, at);
    mount.addTag(ownerTag(player, steed.kind));
    mount.addTag("overlord_steed");
    mount.setDynamicProperty("overlord:owner", player.id);
    fx.pillar(player.dimension, at, steed.flies ? "dark" : "acid", 4);
    fx.nova(player.dimension, at, steed.flies ? "dark" : "acid", 2);
    return `§dYour ${steed.name} answers the call`;
  } catch {
    return "§7There is no room for it here";
  }
}

/** Sends the player's steed away. @param {Player} player @param {string} item */
export function dismiss(player, item) {
  const steed = STEEDS[item];
  const mount = steed && steedOf(player, steed.kind);
  if (!steed || !mount) return "§7Your steed is not here";
  fx.rise(player.dimension, mount.location, steed.flies ? "dark" : "acid", 1);
  try {
    mount.remove();
  } catch {
    // already gone
  }
  return `§7Your ${steed.name} departs`;
}

/** A spot two blocks in front of the player. @param {Player} player */
function beside(player) {
  let view = { x: 0, y: 0, z: 1 };
  try {
    view = player.getViewDirection();
  } catch {
    // facing on
  }
  const length = Math.hypot(view.x, view.z) || 1;
  return { x: player.location.x + (view.x / length) * 2, y: player.location.y, z: player.location.z + (view.z / length) * 2 };
}

/** What the player rides, if it is one of the add-on's mounts. @param {Player} player */
export function mountOf(player) {
  try {
    const mount = player.getComponent("minecraft:riding")?.entityRidingOn;
    return mount && mount.isValid ? mount : undefined;
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ flight

/** Wyrm id -> whether it is in the air. */
/** @type {Map<string, boolean>} */
export const aloft = new Map();

/** @param {Entity} wyrm @param {boolean} up */
function setAloft(wyrm, up) {
  if ((aloft.get(wyrm.id) ?? false) === up) return;
  aloft.set(wyrm.id, up);
  try {
    wyrm.triggerEvent(up ? `${NS}:take_off` : `${NS}:land`);
  } catch {
    // the event is cosmetic if missing
  }
}

/**
 * One tick of a ridden wyrm: the rider's look and keys become its flight. Returns the velocity set, if any.
 * @param {Player} player @param {Entity} wyrm
 */
export function fly(player, wyrm) {
  const up = aloft.get(wyrm.id) ?? false;
  let forward = 0;
  let side = 0;
  try {
    const move = player.inputInfo.getMovementVector();
    forward = move.y;
    side = move.x;
  } catch {
    forward = 0;
  }
  const view = player.getViewDirection();
  if (!up) {
    if (!player.isJumping) {
      // on the ground it walks where the rider looks
      if (Math.abs(forward) < 0.05) return undefined;
      const length = Math.hypot(view.x, view.z) || 1;
      const walk = { x: (view.x / length) * forward * WALK_SPEED, y: -0.08, z: (view.z / length) * forward * WALK_SPEED };
      try {
        wyrm.clearVelocity();
        wyrm.applyImpulse(walk);
        wyrm.setRotation({ x: 0, y: player.getRotation().y });
      } catch {
        // unloading
      }
      return walk;
    }
    setAloft(wyrm, true);
    fx.ring(wyrm.dimension, wyrm.location, "dark", 2.5);
  }
  const speed = player.isSprinting ? SPRINT_SPEED : FLY_SPEED;
  const flat = Math.hypot(view.x, view.z) || 1;
  // the rider's right, on the ground
  const right = { x: -view.z / flat, z: view.x / flat };
  const v = {
    x: view.x * forward * speed + right.x * side * speed * 0.6,
    y: view.y * forward * speed + (player.isJumping ? CLIMB : 0),
    z: view.z * forward * speed + right.z * side * speed * 0.6,
  };
  // touching down: it lands
  if (wyrm.isOnGround && v.y <= 0.01 && up) {
    setAloft(wyrm, false);
    return undefined;
  }
  try {
    wyrm.clearVelocity();
    wyrm.applyImpulse(v);
    wyrm.setRotation({ x: 0, y: player.getRotation().y });
  } catch {
    // unloading
  }
  return v;
}

/** An unridden wyrm in the air sinks to the ground and lands. @param {Entity} wyrm */
function settle(wyrm) {
  if (!(aloft.get(wyrm.id) ?? false)) return;
  if (wyrm.isOnGround) {
    setAloft(wyrm, false);
    return;
  }
  try {
    wyrm.clearVelocity();
    wyrm.applyImpulse({ x: 0, y: -0.35, z: 0 });
  } catch {
    // unloading
  }
}

/** Player id -> the next breath or charge. */
const ready = new Map();

/**
 * The wyrm breathes fire ahead of its rider: everything in a cone ten blocks long. Returns how many it caught.
 * @param {Player} player @param {Entity} wyrm @param {number} [now]
 */
export function breathe(player, wyrm, now = system.currentTick) {
  if (now < (ready.get(player.id) ?? 0)) return -1;
  ready.set(player.id, now + BREATH_COOLDOWN * TICKS);
  const view = player.getViewDirection();
  const from = { x: wyrm.location.x, y: wyrm.location.y + 1, z: wyrm.location.z };
  const to = { x: from.x + view.x * 10, y: from.y + view.y * 10, z: from.z + view.z * 10 };
  fx.beam(wyrm.dimension, from, to, "fire", 1.6);
  fx.nova(wyrm.dimension, to, "fire", 2);
  const level = profileOf(player).level;
  let caught = 0;
  for (const foe of foesNear(player, { x: from.x + view.x * 5, y: from.y + view.y * 5, z: from.z + view.z * 5 }, 6)) {
    const d = { x: foe.location.x - from.x, y: foe.location.y - from.y, z: foe.location.z - from.z };
    const ahead = d.x * view.x + d.y * view.y + d.z * view.z;
    if (ahead < 0 || ahead > 11) continue;
    const off = Math.hypot(d.x - view.x * ahead, d.y - view.y * ahead, d.z - view.z * ahead);
    if (off > 1.2 + ahead * 0.3) continue;
    strike(player, foe, 8 + level * 0.25);
    try {
      foe.setOnFire(4, true);
    } catch {
      // gone
    }
    caught++;
  }
  try {
    player.playSound("mob.enderdragon.growl", { volume: 0.6, pitch: 1.4 });
  } catch {
    // cosmetic only
  }
  return caught;
}

/**
 * The Soul Eater charges: a burst forward that bowls over the monsters in its path. Returns how many it struck.
 * @param {Player} player @param {Entity} mount @param {number} [now]
 */
export function charge(player, mount, now = system.currentTick) {
  if (now < (ready.get(player.id) ?? 0)) return -1;
  ready.set(player.id, now + CHARGE_COOLDOWN * TICKS);
  const view = player.getViewDirection();
  const flat = Math.hypot(view.x, view.z) || 1;
  const dir = { x: view.x / flat, z: view.z / flat };
  try {
    mount.applyImpulse({ x: dir.x * 2.2, y: 0.15, z: dir.z * 2.2 });
  } catch {
    // unloading
  }
  const level = profileOf(player).level;
  let struck = 0;
  for (const foe of foesNear(player, { x: mount.location.x + dir.x * 4, y: mount.location.y, z: mount.location.z + dir.z * 4 }, 5)) {
    const dx = foe.location.x - mount.location.x;
    const dz = foe.location.z - mount.location.z;
    const ahead = dx * dir.x + dz * dir.z;
    if (ahead < -1 || ahead > 9 || Math.abs(dx * dir.z - dz * dir.x) > 2) continue;
    strike(player, foe, 6 + level * 0.2);
    try {
      foe.applyKnockback({ x: dir.x * 1.6, z: dir.z * 1.6 }, 0.5);
    } catch {
      // gone
    }
    struck++;
  }
  fx.slash(mount.dimension, { x: mount.location.x + dir.x * 2, y: mount.location.y + 1, z: mount.location.z + dir.z * 2 }, "acid", 1.6);
  return struck;
}

/** Monsters the running Soul Eater runs into are trampled. @param {Player} player @param {Entity} mount */
export function trample(player, mount) {
  let struck = 0;
  const level = profileOf(player).level;
  for (const foe of foesNear(player, mount.location, 1.8)) {
    strike(player, foe, 3 + level * 0.1);
    struck++;
  }
  fx.rise(mount.dimension, mount.location, "acid", 0.6);
  return struck;
}

// ------------------------------------------------------------------ barding

/** The barding a mount wears: 0, 1 or 2. @param {Entity} mount */
export function bardingOf(mount) {
  try {
    return Number(mount.getDynamicProperty("overlord:barding") ?? 0);
  } catch {
    return 0;
  }
}

/** Whether a player may armour this mount. @param {Player} player @param {Entity} mount */
export function mayArmour(player, mount) {
  try {
    if (mount.typeId === id("hamsuke")) return mount.getComponent("minecraft:is_tamed") !== undefined;
    return mount.hasTag("overlord_steed") && mount.getDynamicProperty("overlord:owner") === player.id;
  } catch {
    return false;
  }
}

/**
 * Puts barding on a mount, handing back any it wore. Returns a message.
 * @param {Player} player @param {Entity} mount @param {string} item
 */
export function armour(player, mount, item) {
  const barding = BARDING[item];
  if (!barding) return "§7That is not barding";
  if (!mayArmour(player, mount)) return "§7Only your own steed or a tamed Hamsuke can wear barding";
  const old = bardingOf(mount);
  if (old === barding.tier) return "§7It already wears that";
  if (old > 0) {
    const back = Object.entries(BARDING).find(([, b]) => b.tier === old);
    if (back) giveItem(player, back[0], 1);
  }
  mount.setDynamicProperty("overlord:barding", barding.tier);
  mount.setDynamicProperty("overlord:barding_sig", "");
  fx.circle(mount.dimension, mount.location, barding.tier === 2 ? "dark" : "holy", 1.4);
  return `§aYour mount wears the ${barding.name}`;
}

/** Keeps a barded mount's protection up. @param {Entity} mount */
export function tendBarding(mount) {
  const tier = bardingOf(mount);
  if (tier <= 0) return false;
  try {
    if (mount.getDynamicProperty("overlord:barding_sig") === `b${tier}` && mount.getEffect("resistance")) return false;
    mount.setDynamicProperty("overlord:barding_sig", `b${tier}`);
    mount.addEffect("resistance", LONG, { amplifier: tier - 1, showParticles: false });
    if (tier >= 2) {
      mount.addEffect("fire_resistance", LONG, { amplifier: 0, showParticles: false });
      mount.addEffect("regeneration", LONG, { amplifier: 0, showParticles: false });
    }
    return true;
  } catch {
    return false;
  }
}

/** Takes one of the item from the player's hand. @param {Player} player */
function useUp(player) {
  try {
    const gear = player.getComponent("minecraft:equippable");
    const stack = gear?.getEquipment(EquipmentSlot.Mainhand);
    if (!gear || !stack) return;
    if (stack.amount > 1) {
      stack.amount -= 1;
      gear.setEquipment(EquipmentSlot.Mainhand, stack);
    } else {
      gear.setEquipment(EquipmentSlot.Mainhand, undefined);
    }
  } catch {
    // nothing in hand
  }
}

// ------------------------------------------------------------------ events

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const item = event.itemStack?.typeId;
  if (!item || !(item in BARDING)) return;
  event.cancel = true; // armouring, not mounting
  const player = event.player;
  const mount = event.target;
  system.run(() => {
    try {
      const message = armour(player, mount, item);
      if (message.startsWith("§a")) useUp(player);
      notify(player, message);
    } catch {
      // the mount left
    }
  });
});

world.afterEvents.itemUse.subscribe((event) => {
  try {
    const item = event.itemStack?.typeId;
    if (!item || !(item in STEEDS)) return;
    const player = event.source;
    const steed = STEEDS[item];
    const mount = mountOf(player);
    if (mount && mount.typeId === steed.type) {
      if (steed.flies) {
        const caught = breathe(player, mount);
        if (caught < 0) notify(player, "§7The wyrm draws breath...");
      } else if (charge(player, mount) < 0) notify(player, "§7The Soul Eater gathers itself...");
      return;
    }
    notify(player, player.isSneaking ? dismiss(player, item) : call(player, item));
  } catch (error) {
    console.warn(`[Overlord] the steed call failed: ${error}`);
  }
});

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    if (!dead.hasTag("overlord_steed")) return;
    const owner = String(dead.getDynamicProperty("overlord:owner") ?? "");
    const kind = dead.typeId === id("wyrm_steed") ? "wyrm" : "soul";
    mourning.set(`${owner}|${kind}`, system.currentTick + MOURNING * TICKS);
    aloft.delete(dead.id);
  } catch {
    // unloaded
  }
});

let beat = 0;
system.runInterval(() => {
  beat++;
  const second = beat % TICKS === 0;
  /** @type {Set<string>} */
  const ridden = new Set();
  for (const player of world.getAllPlayers()) {
    try {
      const mount = mountOf(player);
      if (!mount) continue;
      ridden.add(mount.id);
      if (mount.typeId === id("wyrm_steed")) fly(player, mount);
      else if (second && mount.typeId === id("soul_steed")) trample(player, mount);
      if (second) tendBarding(mount);
    } catch {
      // the player is leaving
    }
  }
  // wyrms nobody rides come down; barded mounts nobody rides keep their armour
  if (beat % 5 !== 0) return;
  for (const [wyrmId, up] of [...aloft]) {
    if (!up || ridden.has(wyrmId)) continue;
    const wyrm = world.getEntity(wyrmId);
    if (!wyrm || !wyrm.isValid) {
      aloft.delete(wyrmId);
      continue;
    }
    settle(wyrm);
  }
  if (!second) return;
  for (const player of world.getAllPlayers()) {
    try {
      for (const mount of player.dimension.getEntities({ location: player.location, maxDistance: 24, tags: ["overlord_steed"] })) tendBarding(mount);
      for (const mount of player.dimension.getEntities({ location: player.location, maxDistance: 24, type: id("hamsuke") })) tendBarding(mount);
    } catch {
      // unloaded
    }
  }
}, 1);

/** The steeds' kinds and what calls them, for the help text. */
export const HELP = "Whistle: call or send away your wyrm; while riding, jump to fly and use it to breathe fire. Reins: call your Soul Eater; while riding, use them to charge.";

