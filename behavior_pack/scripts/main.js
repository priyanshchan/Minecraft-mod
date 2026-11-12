// Overlord: Tomb of Nazarick - gameplay script (spells, item abilities, set bonus).
// Uses only stable @minecraft/server 2.0.0 APIs. Levels, mana, classes and quests live in rpg.js.
import {
  world,
  system,
  Direction,
  EntityDamageCause,
  EquipmentSlot,
  GameMode,
} from "@minecraft/server";
import {
  grantLevel,
  notify,
  openMenu,
  resetStats,
  restoreMana,
  setRegalia,
  spellPower,
  spendMana,
  useClassSkill,
} from "./rpg.js";
import { startRaid } from "./raid.js";
import { castSelected, cycleSpell, openGrimoire } from "./spells.js";
import * as fx from "./vfx.js";
import "./director.js";
import "./structures.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;

const TICKS = 20;
const SUMMON_TAG = "overlord_summoned";
const MAX_SUMMONS = 3;

/** Item id -> entity summoned by that sigil. */
const SIGILS = {
  [id("sigil_of_ainz")]: id("ainz"),
  [id("sigil_of_albedo")]: id("albedo"),
  [id("sigil_of_shalltear")]: id("shalltear"),
  [id("sigil_of_cocytus")]: id("cocytus"),
  [id("sigil_of_demiurge")]: id("demiurge"),
  [id("sigil_of_sebas")]: id("sebas"),
  [id("sigil_of_narberal")]: id("narberal"),
  [id("sigil_of_pandoras_actor")]: id("pandoras_actor"),
  [id("sigil_of_aura")]: id("aura"),
  [id("sigil_of_mare")]: id("mare"),
  [id("sigil_of_cz_delta")]: id("cz_delta"),
  [id("sigil_of_lupusregina")]: id("lupusregina"),
  [id("sigil_of_entoma")]: id("entoma"),
  [id("sigil_of_solution")]: id("solution"),
  [id("sigil_of_yuri")]: id("yuri"),
  [id("sigil_of_gargantua")]: id("gargantua"),
};

/** @type {[EquipmentSlot, string][]} */
const ARMOR_SLOTS = [
  [EquipmentSlot.Head, "helmet"],
  [EquipmentSlot.Chest, "chestplate"],
  [EquipmentSlot.Legs, "leggings"],
  [EquipmentSlot.Feet, "boots"],
];

/**
 * True when all four armour slots hold pieces of the given set.
 * @param {import("@minecraft/server").EntityEquippableComponent} gear
 * @param {string} set
 */
function wearsFullSet(gear, set) {
  return ARMOR_SLOTS.every(([slot, piece]) => gear.getEquipment(slot)?.typeId === id(`${set}_${piece}`));
}

// ------------------------------------------------------------------ helpers

/**
 * Visual flourish for item abilities, by cooldown category: [element, tier-like size, pose].
 * Categories that are not listed (sigils, the rifle, the whip...) cast nothing visible.
 * @type {Record<string, [string, number, fx.Pose]>}
 */
const FLOURISH = {
  overlord_staff: ["fire", 3, "point"],
  overlord_ring: ["arcane", 5, "self"],
  overlord_ginnungagap: ["arcane", 6, "raise"],
  overlord_tome: ["dark", 7, "raise"],
  overlord_scroll: ["arcane", 4, "raise"],
  overlord_sustenance: ["holy", 2, "self"],
  overlord_yggdrasil: ["acid", 6, "raise"],
  overlord_slash: ["arcane", 10, "point"],
  overlord_fallen: ["holy", 11, "raise"],
  overlord_frost: ["ice", 4, "point"],
  overlord_lance: ["ice", 4, "point"],
  overlord_fluder: ["fire", 5, "point"],
  overlord_slam: ["none", 5, "raise"],
  overlord_holy: ["holy", 5, "self"],
  overlord_goblins: ["acid", 3, "raise"],
};

/** Own cooldown bookkeeping: `${playerId}|${category}` -> tick when usable again. */
const cooldowns = new Map();

/**
 * Returns true (and starts the cooldown) when the ability may be used now.
 * @param {import("@minecraft/server").Player} player
 * @param {string} category
 * @param {number} seconds
 * @param {number} [mana] mana the ability costs (0 for scrolls and passive items)
 */
function tryCooldown(player, category, seconds, mana = 0) {
  const key = `${player.id}|${category}`;
  const now = system.currentTick;
  const readyAt = cooldowns.get(key) ?? 0;
  if (now < readyAt) {
    const left = Math.ceil((readyAt - now) / TICKS);
    actionBar(player, `§7Recharging... §f${left}s`);
    return false;
  }
  if (!spendMana(player, mana)) return false;
  const flourish = FLOURISH[category];
  if (flourish) fx.castFx(player, flourish[0], flourish[1], flourish[2]);
  cooldowns.set(key, now + Math.round(seconds * TICKS));
  try {
    player.startItemCooldown(category, Math.round(seconds * TICKS));
  } catch {
    // purely visual, never fatal
  }
  return true;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} text
 */
function actionBar(player, text) {
  notify(player, text);
}

/**
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {string} sound
 * @param {import("@minecraft/server").Vector3} location
 * @param {number} [pitch]
 */
function playSound(dimension, sound, location, pitch = 1) {
  try {
    dimension.playSound(sound, location, { volume: 1, pitch });
  } catch {
    // location may be in an unloaded chunk
  }
}

/**
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {string} particle
 * @param {import("@minecraft/server").Vector3} location
 */
function particle(dimension, particle, location) {
  try {
    dimension.spawnParticle(particle, location);
  } catch {
    // location may be in an unloaded chunk
  }
}

/**
 * @param {import("@minecraft/server").Vector3} a
 * @param {import("@minecraft/server").Vector3} b
 * @param {number} [scale]
 */
function add(a, b, scale = 1) {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale };
}

/** @param {import("@minecraft/server").Player} player */
function isCreative(player) {
  return player.getGameMode() === GameMode.Creative;
}

/**
 * Removes one item from the stack the player is holding.
 * @param {import("@minecraft/server").Player} player
 */
function consumeHeldItem(player) {
  if (isCreative(player)) return;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  const slot = player.selectedSlotIndex;
  const stack = container.getItem(slot);
  if (!stack) return;
  if (stack.amount > 1) {
    stack.amount -= 1;
    container.setItem(slot, stack);
  } else {
    container.setItem(slot, undefined);
  }
}

/**
 * @param {import("@minecraft/server").Entity} entity
 * @param {number} amount
 */
function heal(entity, amount) {
  const health = entity.getComponent("minecraft:health");
  if (!health || health.currentValue <= 0) return;
  health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));
}

/** @param {import("@minecraft/server").Player} player */
function heldItemId(player) {
  return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId;
}

/**
 * Spot in front of the player where something can be placed.
 * @param {import("@minecraft/server").Player} player
 * @param {number} reach
 */
function placementSpot(player, reach) {
  const hit = player.getBlockFromViewDirection({ maxDistance: reach });
  if (hit) {
    const face = FACE_OFFSET[hit.face] ?? FACE_OFFSET[Direction.Up];
    const b = hit.block.location;
    return { x: b.x + 0.5 + face.x, y: b.y + face.y, z: b.z + 0.5 + face.z };
  }
  const dir = player.getViewDirection();
  const p = add(player.location, { x: dir.x, y: 0, z: dir.z }, 3);
  return { x: p.x, y: player.location.y, z: p.z };
}

const FACE_OFFSET = {
  [Direction.Up]: { x: 0, y: 1, z: 0 },
  [Direction.Down]: { x: 0, y: -2, z: 0 },
  [Direction.North]: { x: 0, y: 0, z: -1 },
  [Direction.South]: { x: 0, y: 0, z: 1 },
  [Direction.West]: { x: -1, y: 0, z: 0 },
  [Direction.East]: { x: 1, y: 0, z: 0 },
};

// ------------------------------------------------------------------- spells

/** Staff of Ainz Ooal Gown: Fireball. @param {import("@minecraft/server").Player} player */
function castFireball(player) {
  if (!tryCooldown(player, "overlord_staff", 1.0, 6)) return;
  const dir = player.getViewDirection();
  const origin = add(player.getHeadLocation(), dir, 1.4);
  const fireball = player.dimension.spawnEntity(id("fireball"), origin);
  const projectile = fireball.getComponent("minecraft:projectile");
  if (projectile) {
    projectile.owner = player;
    projectile.shoot({ x: dir.x * 1.8, y: dir.y * 1.8, z: dir.z * 1.8 }, { uncertainty: 0 });
  } else {
    fireball.applyImpulse({ x: dir.x * 1.8, y: dir.y * 1.8, z: dir.z * 1.8 });
  }
  playSound(player.dimension, "mob.ghast.fireball", origin, 1.1);
  actionBar(player, "§6Fireball!");
}

/** Staff of Ainz Ooal Gown (sneaking): Grasp Heart. @param {import("@minecraft/server").Player} player */
function castGraspHeart(player) {
  const hits = player.getEntitiesFromViewDirection({ maxDistance: 24 });
  const target = hits.map((h) => h.entity).find((e) => e.isValid && e.getComponent("minecraft:health"));
  if (!target) {
    actionBar(player, "§7Grasp Heart: no target in sight");
    return;
  }
  if (!tryCooldown(player, "overlord_staff", 12.0, 30)) return;
  const at = add(target.location, { x: 0, y: 1, z: 0 });
  target.applyDamage(Math.round(40 * spellPower(player)), { cause: EntityDamageCause.magic, damagingEntity: player });
  if (target.isValid) {
    target.addEffect("slowness", 3 * TICKS, { amplifier: 3 });
  }
  particle(player.dimension, "minecraft:critical_hit_emitter", at);
  particle(player.dimension, "minecraft:soul_particle", at);
  playSound(player.dimension, "mob.wither.hurt", at, 0.6);
  actionBar(player, "§5Grasp Heart!");
}

/** Ring of Ainz Ooal Gown: teleport. @param {import("@minecraft/server").Player} player */
function castTeleport(player) {
  const from = player.location;
  const hit = player.getBlockFromViewDirection({ maxDistance: 48 });
  /** @type {import("@minecraft/server").Vector3} */
  let destination;
  if (hit) {
    const face = FACE_OFFSET[hit.face] ?? FACE_OFFSET[Direction.Up];
    const b = hit.block.location;
    destination = { x: b.x + 0.5 + face.x, y: b.y + face.y, z: b.z + 0.5 + face.z };
  } else {
    destination = add(player.getHeadLocation(), player.getViewDirection(), 16);
  }
  if (!tryCooldown(player, "overlord_ring", 3.0, 15)) return;
  let moved = player.tryTeleport(destination, { checkForBlocks: true, keepVelocity: false });
  if (!moved) {
    moved = player.tryTeleport(add(destination, { x: 0, y: 1, z: 0 }), {
      checkForBlocks: true,
      keepVelocity: false,
    });
  }
  if (!moved) {
    cooldowns.delete(`${player.id}|overlord_ring`);
    actionBar(player, "§7Gate: no room to appear there");
    return;
  }
  particle(player.dimension, "minecraft:totem_particle", add(from, { x: 0, y: 1, z: 0 }));
  particle(player.dimension, "minecraft:totem_particle", add(destination, { x: 0, y: 1, z: 0 }));
  playSound(player.dimension, "mob.endermen.portal", destination, 1);
  player.addEffect("slow_falling", 3 * TICKS, { showParticles: false });
  actionBar(player, "§dGate!");
}

/** Ginnungagap: shockwave around the wielder. @param {import("@minecraft/server").Player} player */
function castShockwave(player) {
  if (!tryCooldown(player, "overlord_ginnungagap", 8.0, 20)) return;
  const center = player.location;
  const victims = player.dimension.getEntities({
    location: center,
    maxDistance: 6,
    excludeTypes: ["minecraft:player"],
    excludeFamilies: ["nazarick_ally", "inanimate"],
  });
  let count = 0;
  for (const victim of victims) {
    try {
      if (!victim.getComponent("minecraft:health")) continue;
      if (victim.getComponent("minecraft:is_tamed")) continue;
      const dx = victim.location.x - center.x;
      const dz = victim.location.z - center.z;
      const len = Math.hypot(dx, dz) || 1;
      victim.applyDamage(14, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
      if (victim.isValid) {
        victim.applyKnockback({ x: (dx / len) * 1.6, z: (dz / len) * 1.6 }, 0.5);
      }
      count++;
    } catch {
      // entity died or left the world while we were iterating
    }
  }
  particle(player.dimension, "minecraft:knockback_roar_particle", add(center, { x: 0, y: 1, z: 0 }));
  playSound(player.dimension, "random.explode", center, 0.7);
  actionBar(player, count > 0 ? `§2Ginnungagap struck ${count} foe${count === 1 ? "" : "s"}!` : "§2Ginnungagap!");
}

/** Tome: Create Undead. @param {import("@minecraft/server").Player} player */
function castCreateUndead(player) {
  const existing = player.dimension.getEntities({
    type: id("death_knight"),
    tags: [SUMMON_TAG, ownerTag(player)],
  });
  if (existing.length >= MAX_SUMMONS) {
    actionBar(player, `§7You already command ${MAX_SUMMONS} Death Knights`);
    return;
  }
  if (!tryCooldown(player, "overlord_tome", 30.0, 40)) return;
  const spot = placementSpot(player, 5);
  const knight = player.dimension.spawnEntity(id("death_knight"), spot, {
    spawnEvent: id("become_summoned"),
  });
  knight.addTag(SUMMON_TAG);
  knight.addTag(ownerTag(player));
  knight.nameTag = `${player.name}'s Death Knight`;
  // The tameable component only exists once the spawn event has been applied.
  system.runTimeout(() => {
    try {
      if (knight.isValid && player.isValid) {
        knight.getComponent("minecraft:tameable")?.tame(player);
      }
    } catch {
      // the knight still fights monsters even if it could not be bound
    }
  }, 2);
  particle(player.dimension, "minecraft:soul_particle", add(spot, { x: 0, y: 1, z: 0 }));
  particle(player.dimension, "minecraft:knockback_roar_particle", add(spot, { x: 0, y: 1, z: 0 }));
  playSound(player.dimension, "mob.wither.spawn", spot, 1.6);
  actionBar(player, "§5Create Undead: a Death Knight rises!");
}

/** Scroll: Call Greater Thunder. @param {import("@minecraft/server").Player} player */
function castLightning(player) {
  const entityHit = player
    .getEntitiesFromViewDirection({ maxDistance: 40 })
    .map((h) => h.entity)
    .find((e) => e.isValid && e.getComponent("minecraft:health"));
  const blockHit = entityHit ? undefined : player.getBlockFromViewDirection({ maxDistance: 40 });
  if (!entityHit && !blockHit) {
    actionBar(player, "§7Call Greater Thunder: nothing in range");
    return;
  }
  if (!tryCooldown(player, "overlord_scroll", 1.5)) return;
  /** @type {import("@minecraft/server").Vector3} */
  let strike;
  if (entityHit) {
    strike = entityHit.location;
  } else {
    const b = /** @type {import("@minecraft/server").BlockRaycastHit} */ (blockHit).block.location;
    strike = { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 };
  }
  player.dimension.spawnEntity("minecraft:lightning_bolt", strike);
  if (entityHit && entityHit.isValid) {
    entityHit.applyDamage(Math.round(12 * spellPower(player)), { cause: EntityDamageCause.magic, damagingEntity: player });
  }
  consumeHeldItem(player);
  actionBar(player, "§eCall Greater Thunder!");
}

/** Scroll: Fly. @param {import("@minecraft/server").Player} player */
function castFly(player) {
  if (!tryCooldown(player, "overlord_scroll", 1.5)) return;
  player.addEffect("levitation", 6 * TICKS, { amplifier: 2, showParticles: false });
  player.addEffect("slow_falling", 25 * TICKS, { showParticles: false });
  consumeHeldItem(player);
  particle(player.dimension, "minecraft:totem_particle", add(player.location, { x: 0, y: 1, z: 0 }));
  playSound(player.dimension, "mob.bat.takeoff", player.location, 0.8);
  actionBar(player, "§bFly!");
}

/** Ring of Sustenance: refills hunger. @param {import("@minecraft/server").Player} player */
function useSustenance(player) {
  if (!tryCooldown(player, "overlord_sustenance", 60.0)) return;
  player.addEffect("saturation", 10, { amplifier: 9, showParticles: false });
  player.addEffect("regeneration", 5 * TICKS, { amplifier: 0 });
  playSound(player.dimension, "random.burp", player.location, 1);
  actionBar(player, "§aRing of Sustenance: hunger restored");
}

/** Scroll: Invisibility. @param {import("@minecraft/server").Player} player */
function castInvisibility(player) {
  if (!tryCooldown(player, "overlord_scroll", 1.5)) return;
  player.addEffect("invisibility", 45 * TICKS, { showParticles: false });
  consumeHeldItem(player);
  playSound(player.dimension, "random.fizz", player.location, 1.4);
  actionBar(player, "§7Invisibility!");
}

/** Scroll: Greater Teleportation - back to the respawn point. @param {import("@minecraft/server").Player} player */
function castGreaterTeleportation(player) {
  const home = player.getSpawnPoint();
  if (!home) {
    actionBar(player, "§7Greater Teleportation: set a respawn point (bed) first");
    return;
  }
  if (!tryCooldown(player, "overlord_scroll", 1.5)) return;
  const from = player.location;
  const fromDimension = player.dimension;
  player.teleport({ x: home.x + 0.5, y: home.y, z: home.z + 0.5 }, { dimension: home.dimension });
  consumeHeldItem(player);
  particle(fromDimension, "minecraft:totem_particle", add(from, { x: 0, y: 1, z: 0 }));
  playSound(home.dimension, "mob.endermen.portal", home, 1);
  actionBar(player, "§dGreater Teleportation!");
}

/** Beast Tamer's Whip: drag the targeted mob towards the wielder. @param {import("@minecraft/server").Player} player */
function castLash(player) {
  const target = player
    .getEntitiesFromViewDirection({ maxDistance: 12 })
    .map((h) => h.entity)
    .find((e) => e.isValid && e.getComponent("minecraft:health"));
  if (!target) {
    actionBar(player, "§7Lash: no target in reach");
    return;
  }
  if (!tryCooldown(player, "overlord_whip", 3.0, 8)) return;
  const dx = player.location.x - target.location.x;
  const dz = player.location.z - target.location.z;
  const len = Math.hypot(dx, dz) || 1;
  target.applyDamage(6, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
  if (target.isValid) {
    target.applyKnockback({ x: (dx / len) * 2.2, z: (dz / len) * 2.2 }, 0.4);
    target.addEffect("slowness", 2 * TICKS, { amplifier: 1 });
  }
  playSound(player.dimension, "mob.irongolem.throw", player.location, 1.6);
  actionBar(player, "§6Lash!");
}

/** Shadow of Yggdrasil: a wave of earth magic along the ground. @param {import("@minecraft/server").Player} player */
function castEarthSurge(player) {
  if (!tryCooldown(player, "overlord_yggdrasil", 6.0, 20)) return;
  const view = player.getViewDirection();
  const len = Math.hypot(view.x, view.z) || 1;
  const dir = { x: view.x / len, y: 0, z: view.z / len };
  const struck = new Set();
  for (let step = 2; step <= 12; step += 2) {
    const point = add(player.location, dir, step);
    particle(player.dimension, "minecraft:villager_happy", add(point, { x: 0, y: 0.5, z: 0 }));
    particle(player.dimension, "minecraft:critical_hit_emitter", add(point, { x: 0, y: 0.5, z: 0 }));
    const victims = player.dimension.getEntities({
      location: point,
      maxDistance: 2.2,
      excludeTypes: ["minecraft:player"],
      excludeFamilies: ["nazarick_ally", "inanimate"],
    });
    for (const victim of victims) {
      try {
        if (struck.has(victim.id) || !victim.getComponent("minecraft:health")) continue;
        if (victim.getComponent("minecraft:is_tamed")) continue;
        struck.add(victim.id);
        victim.applyDamage(Math.round(10 * spellPower(player)), { cause: EntityDamageCause.magic, damagingEntity: player });
        if (victim.isValid) victim.applyKnockback({ x: 0, z: 0 }, 0.9);
      } catch {
        // entity died or left the world while we were iterating
      }
    }
  }
  playSound(player.dimension, "mob.evocation_fangs.attack", add(player.location, dir, 4), 0.8);
  playSound(player.dimension, "dig.grass", player.location, 0.6);
  actionBar(player, struck.size > 0 ? `§2Earth Surge struck ${struck.size}!` : "§2Earth Surge!");
}

/** Bell of Nazarick: calls a maid who trades for YGGDRASIL gold. @param {import("@minecraft/server").Player} player */
function ringBell(player) {
  if (!tryCooldown(player, "overlord_sigil", 1.0)) return;
  const spot = placementSpot(player, 5);
  player.dimension.spawnEntity(id("nazarick_maid"), spot);
  consumeHeldItem(player);
  particle(player.dimension, "minecraft:totem_particle", add(spot, { x: 0, y: 1, z: 0 }));
  playSound(player.dimension, "note.bell", spot, 1.2);
  actionBar(player, "§eA maid of Nazarick answers the bell");
}

/**
 * Mobs a spell may hurt around a point: living, not a player, not an ally or pet.
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Vector3} location
 * @param {number} radius
 */
function foesNear(dimension, location, radius) {
  const found = [];
  try {
    const entities = dimension.getEntities({
      location,
      maxDistance: radius,
      excludeTypes: ["minecraft:player"],
      excludeFamilies: ["nazarick_ally", "inanimate"],
    });
    for (const entity of entities) {
      try {
        if (!entity.getComponent("minecraft:health")) continue;
        if (entity.getComponent("minecraft:is_tamed")) continue;
        found.push(entity);
      } catch {
        // entity left the world
      }
    }
  } catch {
    // location is in an unloaded chunk
  }
  return found;
}

/**
 * Damages every foe along a straight line once. Returns how many were hit.
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Vector3} origin
 * @param {import("@minecraft/server").Vector3} dir
 * @param {number} length
 * @param {number} damage
 * @param {EntityDamageCause} cause
 * @param {string} trail
 */
function strikeLine(player, origin, dir, length, damage, cause, trail) {
  const struck = new Set();
  for (let step = 1; step <= length; step += 1.5) {
    const point = add(origin, dir, step);
    particle(player.dimension, trail, point);
    for (const victim of foesNear(player.dimension, point, 1.8)) {
      if (struck.has(victim.id)) continue;
      struck.add(victim.id);
      try {
        victim.applyDamage(damage, { cause, damagingEntity: player });
      } catch {
        // already dead
      }
    }
  }
  return struck.size;
}

/**
 * Where the player is aiming: a mob, else a block, else undefined.
 * @param {import("@minecraft/server").Player} player
 * @param {number} reach
 * @returns {import("@minecraft/server").Vector3 | undefined}
 */
function aimPoint(player, reach) {
  const entity = player
    .getEntitiesFromViewDirection({ maxDistance: reach })
    .map((h) => h.entity)
    .find((e) => e.isValid && e.getComponent("minecraft:health"));
  if (entity) return entity.location;
  const hit = player.getBlockFromViewDirection({ maxDistance: reach });
  if (!hit) return undefined;
  const b = hit.block.location;
  return { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 };
}

/** Scroll: Explosion. @param {import("@minecraft/server").Player} player */
function castExplosion(player) {
  const target = aimPoint(player, 32);
  if (!target) {
    actionBar(player, "§7Explosion: nothing in range");
    return;
  }
  if (!tryCooldown(player, "overlord_scroll", 1.5)) return;
  player.dimension.createExplosion(target, 4, { breaksBlocks: false, causesFire: false, source: player });
  consumeHeldItem(player);
  actionBar(player, "§6Explosion!");
}

/** Scroll: Time Stop - freezes nearby foes. @param {import("@minecraft/server").Player} player */
function castTimeStop(player) {
  if (!tryCooldown(player, "overlord_scroll", 1.5)) return;
  let count = 0;
  for (const foe of foesNear(player.dimension, player.location, 12)) {
    try {
      foe.addEffect("slowness", 6 * TICKS, { amplifier: 6 });
      foe.addEffect("weakness", 6 * TICKS, { amplifier: 5 });
      count++;
    } catch {
      // immune or gone
    }
  }
  consumeHeldItem(player);
  playSound(player.dimension, "beacon.activate", player.location, 0.5);
  actionBar(player, `§8Time Stop! §7(${count} frozen)`);
}

/** Scroll: Heavy Recover - heals the caster and nearby pets. @param {import("@minecraft/server").Player} player */
function castHeavyRecover(player) {
  if (!tryCooldown(player, "overlord_scroll", 1.5)) return;
  player.addEffect("instant_health", 1, { amplifier: 3 });
  player.addEffect("regeneration", 10 * TICKS, { amplifier: 2 });
  for (const ally of player.dimension.getEntities({ location: player.location, maxDistance: 8 })) {
    try {
      if (ally.getComponent("minecraft:is_tamed")) {
        heal(ally, 30);
        particle(player.dimension, "minecraft:heart_particle", add(ally.location, { x: 0, y: 1.5, z: 0 }));
      }
    } catch {
      // entity left the world
    }
  }
  consumeHeldItem(player);
  particle(player.dimension, "minecraft:heart_particle", add(player.location, { x: 0, y: 2, z: 0 }));
  playSound(player.dimension, "random.levelup", player.location, 1.4);
  actionBar(player, "§aHeavy Recover!");
}

/** Tome: Reality Slash - a piercing cut through everything ahead. @param {import("@minecraft/server").Player} player */
function castRealitySlash(player) {
  if (!tryCooldown(player, "overlord_slash", 10.0, 30)) return;
  const hits = strikeLine(player, player.getHeadLocation(), player.getViewDirection(), 18, Math.round(22 * spellPower(player)),
    EntityDamageCause.magic, "minecraft:critical_hit_emitter");
  playSound(player.dimension, "item.trident.riptide_1", player.location, 1.4);
  actionBar(player, hits > 0 ? `§bReality Slash cut ${hits}!` : "§bReality Slash!");
}

/** Tome: Fallen Down - a pillar of light after a short charge. @param {import("@minecraft/server").Player} player */
function castFallenDown(player) {
  const target = aimPoint(player, 40);
  if (!target) {
    actionBar(player, "§7Fallen Down: nothing in range");
    return;
  }
  if (!tryCooldown(player, "overlord_fallen", 60.0, 80)) return;
  const dimension = player.dimension;
  actionBar(player, "§eSuper-tier magic: Fallen Down...");
  playSound(dimension, "beacon.activate", target, 1.2);
  for (let i = 0; i < 3; i++) {
    system.runTimeout(() => particle(dimension, "minecraft:totem_particle", add(target, { x: 0, y: 1, z: 0 })), i * TICKS);
  }
  system.runTimeout(() => {
    try {
      for (let h = 0; h <= 8; h += 2) {
        particle(dimension, "minecraft:knockback_roar_particle", add(target, { x: 0, y: h, z: 0 }));
      }
      particle(dimension, "minecraft:totem_particle", add(target, { x: 0, y: 1, z: 0 }));
      playSound(dimension, "ambient.weather.thunder", target, 0.7);
      playSound(dimension, "random.explode", target, 0.5);
      const caster = player.isValid ? player : undefined;
      const damage = Math.round(60 * (caster ? spellPower(caster) : 1));
      for (const foe of foesNear(dimension, target, 7)) {
        try {
          foe.applyDamage(damage, { cause: EntityDamageCause.magic, damagingEntity: caster });
        } catch {
          // already dead
        }
      }
    } catch (error) {
      console.warn(`[Overlord] Fallen Down failed: ${error}`);
    }
  }, 3 * TICKS);
}

/** Frost Pain: Icy Burst - a cone of frost. @param {import("@minecraft/server").Player} player */
function castIcyBurst(player) {
  if (!tryCooldown(player, "overlord_frost", 6.0, 15)) return;
  const view = player.getViewDirection();
  let count = 0;
  for (const foe of foesNear(player.dimension, player.location, 6)) {
    const dx = foe.location.x - player.location.x;
    const dz = foe.location.z - player.location.z;
    const len = Math.hypot(dx, dz) || 1;
    if ((dx / len) * view.x + (dz / len) * view.z < 0.3) continue; // behind or beside the wielder
    try {
      foe.applyDamage(Math.round(8 * spellPower(player)), { cause: EntityDamageCause.magic, damagingEntity: player });
      if (foe.isValid) {
        foe.addEffect("slowness", 5 * TICKS, { amplifier: 4 });
        particle(player.dimension, "minecraft:blue_flame_particle", add(foe.location, { x: 0, y: 1, z: 0 }));
      }
      count++;
    } catch {
      // already dead
    }
  }
  playSound(player.dimension, "random.glass", player.location, 0.7);
  actionBar(player, count > 0 ? `§bIcy Burst froze ${count}!` : "§bIcy Burst!");
}

/** Brain's Katana: God Flash - dash forward, cutting everything on the way. @param {import("@minecraft/server").Player} player */
function castGodFlash(player) {
  if (!tryCooldown(player, "overlord_flash", 5.0, 12)) return;
  const view = player.getViewDirection();
  const len = Math.hypot(view.x, view.z) || 1;
  const dir = { x: view.x / len, y: 0, z: view.z / len };
  const hits = strikeLine(player, add(player.location, { x: 0, y: 1, z: 0 }), dir, 7, 14,
    EntityDamageCause.entityAttack, "minecraft:critical_hit_emitter");
  try {
    player.applyKnockback({ x: dir.x * 2.6, z: dir.z * 2.6 }, 0.15);
  } catch {
    // dash is cosmetic
  }
  playSound(player.dimension, "item.trident.riptide_1", player.location, 1.8);
  actionBar(player, hits > 0 ? `§fGod Flash cut ${hits}!` : "§fGod Flash!");
}

/** CZ's Magic Rifle: fires a magic bullet. @param {import("@minecraft/server").Player} player */
function fireRifle(player) {
  if (!tryCooldown(player, "overlord_rifle", 0.6, 3)) return;
  const dir = player.getViewDirection();
  const origin = add(player.getHeadLocation(), dir, 1.2);
  const bullet = player.dimension.spawnEntity(id("magic_bullet"), origin);
  const projectile = bullet.getComponent("minecraft:projectile");
  if (projectile) {
    projectile.owner = player;
    projectile.shoot({ x: dir.x * 3, y: dir.y * 3, z: dir.z * 3 }, { uncertainty: 0 });
  } else {
    bullet.applyImpulse({ x: dir.x * 3, y: dir.y * 3, z: dir.z * 3 });
  }
  playSound(player.dimension, "crossbow.shoot", origin, 1.5);
}

/** Lupusregina's Holy Staff: heals the wielder and nearby players. @param {import("@minecraft/server").Player} player */
function castHolyLight(player) {
  if (!tryCooldown(player, "overlord_holy", 12.0, 25)) return;
  for (const ally of player.dimension.getPlayers({ location: player.location, maxDistance: 8 })) {
    ally.addEffect("instant_health", 1, { amplifier: 1 });
    ally.addEffect("regeneration", 8 * TICKS, { amplifier: 1 });
    particle(player.dimension, "minecraft:heart_particle", add(ally.location, { x: 0, y: 2, z: 0 }));
  }
  playSound(player.dimension, "random.levelup", player.location, 1.6);
  actionBar(player, "§eHoly Light!");
}

/** Shooting Star: a wish that grants one level. @param {import("@minecraft/server").Player} player */
function useShootingStar(player) {
  if (!tryCooldown(player, "overlord_sigil", 1.0)) return;
  if (!grantLevel(player)) {
    actionBar(player, "§7You are already at the highest level");
    return;
  }
  consumeHeldItem(player);
  player.addEffect("instant_health", 1, { amplifier: 5 });
  particle(player.dimension, "minecraft:totem_particle", add(player.location, { x: 0, y: 1, z: 0 }));
  playSound(player.dimension, "beacon.activate", player.location, 1.6);
}

/**
 * Spawns a projectile owned by the player and launches it.
 * @param {import("@minecraft/server").Player} player
 * @param {string} type
 * @param {import("@minecraft/server").Vector3} dir
 * @param {number} speed
 */
function launch(player, type, dir, speed) {
  const origin = add(player.getHeadLocation(), dir, 1.3);
  const shot = player.dimension.spawnEntity(type, origin);
  const velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
  const projectile = shot.getComponent("minecraft:projectile");
  if (projectile) {
    projectile.owner = player;
    projectile.shoot(velocity, { uncertainty: 0 });
  } else {
    shot.applyImpulse(velocity);
  }
  return origin;
}

/** Tome: Crystal Lance. @param {import("@minecraft/server").Player} player */
function castCrystalLance(player) {
  if (!tryCooldown(player, "overlord_lance", 1.5, 10)) return;
  const origin = launch(player, id("crystal_shard"), player.getViewDirection(), 2.6);
  playSound(player.dimension, "random.glass", origin, 1.6);
  actionBar(player, "§bCrystal Lance!");
}

/** Fluder's Staff: three fireballs in a fan. @param {import("@minecraft/server").Player} player */
function castTripleFireball(player) {
  if (!tryCooldown(player, "overlord_fluder", 4.0, 18)) return;
  const view = player.getViewDirection();
  let origin = player.location;
  for (const turn of [-0.18, 0, 0.18]) {
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    origin = launch(player, id("fireball"), { x: view.x * cos - view.z * sin, y: view.y, z: view.x * sin + view.z * cos }, 1.8);
  }
  playSound(player.dimension, "mob.ghast.fireball", origin, 0.9);
  actionBar(player, "§6Triple Fireball!");
}

/** Gargantua's Fist: Ground Slam. @param {import("@minecraft/server").Player} player */
function castGroundSlam(player) {
  if (!tryCooldown(player, "overlord_slam", 8.0, 20)) return;
  let count = 0;
  for (const foe of foesNear(player.dimension, player.location, 5)) {
    try {
      foe.applyDamage(12, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
      if (foe.isValid) {
        foe.addEffect("slowness", 4 * TICKS, { amplifier: 5 });
        foe.applyKnockback({ x: 0, z: 0 }, 0.7);
      }
      count++;
    } catch {
      // already dead
    }
  }
  particle(player.dimension, "minecraft:knockback_roar_particle", add(player.location, { x: 0, y: 0.5, z: 0 }));
  playSound(player.dimension, "random.explode", player.location, 0.5);
  actionBar(player, count > 0 ? `§7Ground Slam stunned ${count}!` : "§7Ground Slam!");
}

/** Scroll: Rebirth - refunds all stat points. @param {import("@minecraft/server").Player} player */
function castRebirth(player) {
  if (!tryCooldown(player, "overlord_scroll", 1.5)) return;
  const refunded = resetStats(player);
  if (refunded === 0) {
    actionBar(player, "§7Rebirth: you have no spent stat points");
    return;
  }
  consumeHeldItem(player);
  playSound(player.dimension, "random.levelup", player.location, 0.7);
  actionBar(player, `§dRebirth: ${refunded} stat points refunded`);
}

/** Horn of the Goblin General: three goblin soldiers fight for you. @param {import("@minecraft/server").Player} player */
function callGoblins(player) {
  if (!tryCooldown(player, "overlord_goblins", 120.0, 30)) return;
  const spot = placementSpot(player, 4);
  /** @type {import("@minecraft/server").Entity[]} */
  const troop = [];
  for (let i = 0; i < 3; i++) {
    const goblin = player.dimension.spawnEntity(id("goblin"), add(spot, { x: (i - 1) * 0.8, y: 0, z: 0 }), {
      spawnEvent: id("become_summoned"),
    });
    goblin.addTag(SUMMON_TAG);
    goblin.nameTag = `${player.name}'s Goblin`;
    troop.push(goblin);
  }
  system.runTimeout(() => {
    for (const goblin of troop) {
      try {
        if (goblin.isValid && player.isValid) goblin.getComponent("minecraft:tameable")?.tame(player);
      } catch {
        // the goblin still fights monsters even if it could not be bound
      }
    }
  }, 2);
  playSound(player.dimension, "horn.call.0", player.location, 1);
  actionBar(player, "§aThe goblin troop answers the horn!");
}

/** @param {import("@minecraft/server").Player} player */
function ownerTag(player) {
  return `overlord_owner_${player.id}`;
}

/**
 * Guardian sigils: summon the matching boss.
 * @param {import("@minecraft/server").Player} player
 * @param {string} entityId
 */
function useSigil(player, entityId) {
  if (!tryCooldown(player, "overlord_sigil", 1.0)) return;
  const spot = placementSpot(player, 6);
  player.dimension.spawnEntity(entityId, spot);
  consumeHeldItem(player);
  particle(player.dimension, "minecraft:totem_particle", add(spot, { x: 0, y: 1, z: 0 }));
  particle(player.dimension, "minecraft:knockback_roar_particle", add(spot, { x: 0, y: 1, z: 0 }));
  playSound(player.dimension, "mob.wither.spawn", spot, 0.8);
  actionBar(player, "§cA guardian of Nazarick answers the summons!");
}

// ------------------------------------------------------------------- events

world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack?.typeId;
  if (!item || !item.startsWith(`${NS}:`)) return;
  try {
    if (item === id("adventurer_plate")) {
      if (player.isSneaking) useClassSkill(player);
      else openMenu(player);
    } else if (item === id("magic_wand")) {
      if (player.isSneaking) cycleSpell(player);
      else castSelected(player);
    } else if (item === id("grimoire")) {
      openGrimoire(player);
    } else if (item === id("raid_horn")) {
      startRaid(player);
    } else if (item === id("goblin_horn")) {
      callGoblins(player);
    } else if (item === id("tome_crystal_lance")) {
      castCrystalLance(player);
    } else if (item === id("fluder_staff")) {
      castTripleFireball(player);
    } else if (item === id("golem_fist")) {
      castGroundSlam(player);
    } else if (item === id("scroll_of_rebirth")) {
      castRebirth(player);
    } else if (item === id("holy_staff")) {
      castHolyLight(player);
    } else if (item === id("shooting_star")) {
      useShootingStar(player);
    } else if (item === id("staff_of_ainz_ooal_gown")) {
      if (player.isSneaking) castGraspHeart(player);
      else castFireball(player);
    } else if (item === id("ring_of_ainz_ooal_gown")) {
      castTeleport(player);
    } else if (item === id("ginnungagap")) {
      castShockwave(player);
    } else if (item === id("tome_create_undead")) {
      castCreateUndead(player);
    } else if (item === id("scroll_of_lightning")) {
      castLightning(player);
    } else if (item === id("scroll_of_fly")) {
      castFly(player);
    } else if (item === id("ring_of_sustenance")) {
      useSustenance(player);
    } else if (item === id("scroll_of_invisibility")) {
      castInvisibility(player);
    } else if (item === id("scroll_of_teleportation")) {
      castGreaterTeleportation(player);
    } else if (item === id("aura_whip")) {
      castLash(player);
    } else if (item === id("shadow_of_yggdrasil")) {
      castEarthSurge(player);
    } else if (item === id("maid_bell")) {
      ringBell(player);
    } else if (item === id("scroll_of_explosion")) {
      castExplosion(player);
    } else if (item === id("scroll_of_time_stop")) {
      castTimeStop(player);
    } else if (item === id("scroll_of_heavy_recover")) {
      castHeavyRecover(player);
    } else if (item === id("tome_reality_slash")) {
      castRealitySlash(player);
    } else if (item === id("tome_fallen_down")) {
      castFallenDown(player);
    } else if (item === id("frost_pain")) {
      castIcyBurst(player);
    } else if (item === id("brain_katana")) {
      castGodFlash(player);
    } else if (item === id("magic_rifle")) {
      fireRifle(player);
    } else if (item in SIGILS) {
      useSigil(player, SIGILS[item]);
    }
  } catch (error) {
    console.warn(`[Overlord] ability failed: ${error}`);
  }
});

world.afterEvents.itemCompleteUse.subscribe((event) => {
  if (event.itemStack.typeId === id("blue_potion")) {
    restoreMana(event.source, 80);
    playSound(event.source.dimension, "random.orb", event.source.location, 1.2);
    actionBar(event.source, "§b+80 mana");
    return;
  }
  if (event.itemStack.typeId !== id("red_potion")) return;
  try {
    const player = event.source;
    restoreMana(player, 20);
    player.addEffect("instant_health", 1, { amplifier: 1, showParticles: true });
    player.addEffect("regeneration", 8 * TICKS, { amplifier: 1 });
    playSound(player.dimension, "random.orb", player.location, 0.8);
  } catch (error) {
    console.warn(`[Overlord] potion failed: ${error}`);
  }
});

world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    if (!attacker || !attacker.isValid || event.damageSource.cause !== EntityDamageCause.entityAttack) return;

    if (attacker.typeId === id("shalltear")) {
      heal(attacker, Math.max(2, event.damage * 0.5)); // blood drain
      return;
    }
    if (attacker.typeId !== "minecraft:player") return;
    const held = heldItemId(/** @type {import("@minecraft/server").Player} */ (attacker));
    if (held === id("spuit_lance")) {
      heal(attacker, Math.max(1, event.damage * 0.25));
      if (victim.isValid) particle(victim.dimension, "minecraft:heart_particle", add(attacker.location, { x: 0, y: 2, z: 0 }));
    } else if (held === id("god_slaying_emperor_blade") && victim.isValid) {
      victim.addEffect("slowness", 4 * TICKS, { amplifier: 2 });
      particle(victim.dimension, "minecraft:blue_flame_particle", add(victim.location, { x: 0, y: 1, z: 0 }));
    } else if (held === id("frost_pain") && victim.isValid) {
      victim.addEffect("slowness", 3 * TICKS, { amplifier: 1 });
    } else if (held === id("iron_gauntlets") && victim.isValid) {
      const dx = victim.location.x - attacker.location.x;
      const dz = victim.location.z - attacker.location.z;
      const len = Math.hypot(dx, dz) || 1;
      victim.applyKnockback({ x: (dx / len) * 2.4, z: (dz / len) * 2.4 }, 0.55); // dragon-fist punch
    } else if (held === id("blade_bug") && victim.isValid) {
      victim.addEffect("poison", 5 * TICKS, { amplifier: 1 });
    } else if (held === id("stiletto") && victim.isValid) {
      victim.setOnFire(4, true); // the stiletto carries a stored fire spell
    } else if (held === id("razor_edge") && victim.isValid) {
      // A second, armour-ignoring cut lands once the target's hurt cooldown has passed.
      system.runTimeout(() => {
        try {
          if (victim.isValid && attacker.isValid) {
            victim.applyDamage(5, { cause: EntityDamageCause.magic, damagingEntity: attacker });
            particle(victim.dimension, "minecraft:critical_hit_emitter", add(victim.location, { x: 0, y: 1, z: 0 }));
          }
        } catch {
          // target is gone
        }
      }, 11);
    }
  } catch {
    // entity vanished between the hit and this callback
  }
});

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  const player = event.player;
  system.runTimeout(() => {
    try {
      if (!player.isValid || player.hasTag("overlord_welcomed")) return;
      player.addTag("overlord_welcomed");
      player.sendMessage(
        "§6[Overlord] §fThe Great Tomb of Nazarick stirs. §7Death Knights and Elder Liches roam the night - " +
          "gather their §bData Crystals§7 to forge guardian sigils and challenge the Floor Guardians."
      );
    } catch {
      // player left before the greeting
    }
  }, 5 * TICKS);
});

// Narberal's lightning: flash and crack where the bolt lands.
/**
 * @param {import("@minecraft/server").Entity} projectile
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Vector3} location
 */
function lightningImpact(projectile, dimension, location) {
  try {
    if (projectile.typeId !== id("lightning_bolt")) return;
    particle(dimension, "minecraft:electric_spark_particle", location);
    particle(dimension, "minecraft:critical_hit_emitter", location);
    playSound(dimension, "ambient.weather.lightning.impact", location, 1.6);
  } catch {
    // projectile already removed
  }
}
world.afterEvents.projectileHitEntity.subscribe((e) => lightningImpact(e.projectile, e.dimension, e.location));
world.afterEvents.projectileHitBlock.subscribe((e) => lightningImpact(e.projectile, e.dimension, e.location));

// Worn-item effects: armour full-set bonuses and the Mask of Envy.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      const gear = player.getComponent("minecraft:equippable");
      if (!gear) continue;
      setRegalia(player, wearsFullSet(gear, "regalia"));
      if (wearsFullSet(gear, "world_champion")) {
        player.addEffect("strength", 3 * TICKS, { amplifier: 1, showParticles: false });
        player.addEffect("resistance", 3 * TICKS, { amplifier: 0, showParticles: false });
        player.addEffect("speed", 3 * TICKS, { amplifier: 0, showParticles: false });
      } else if (wearsFullSet(gear, "dark_warrior")) {
        player.addEffect("strength", 3 * TICKS, { amplifier: 0, showParticles: false });
        player.addEffect("resistance", 3 * TICKS, { amplifier: 0, showParticles: false });
      }
      if (gear.getEquipment(EquipmentSlot.Head)?.typeId === id("mask_of_envy")) {
        player.addEffect("night_vision", 15 * TICKS, { amplifier: 0, showParticles: false });
      }
    } catch {
      // player is mid-teleport or leaving
    }
  }
}, 2 * TICKS);
