// Overlord: Tomb of Nazarick - gameplay script (spells, item abilities, set bonus).
// Uses only stable @minecraft/server 2.0.0 APIs.
import {
  world,
  system,
  Direction,
  EntityDamageCause,
  EquipmentSlot,
  GameMode,
} from "@minecraft/server";

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
};

/** @type {[EquipmentSlot, string][]} */
const DARK_WARRIOR_SET = [
  [EquipmentSlot.Head, id("dark_warrior_helmet")],
  [EquipmentSlot.Chest, id("dark_warrior_chestplate")],
  [EquipmentSlot.Legs, id("dark_warrior_leggings")],
  [EquipmentSlot.Feet, id("dark_warrior_boots")],
];

// ------------------------------------------------------------------ helpers

/** Own cooldown bookkeeping: `${playerId}|${category}` -> tick when usable again. */
const cooldowns = new Map();

/**
 * Returns true (and starts the cooldown) when the ability may be used now.
 * @param {import("@minecraft/server").Player} player
 * @param {string} category
 * @param {number} seconds
 */
function tryCooldown(player, category, seconds) {
  const key = `${player.id}|${category}`;
  const now = system.currentTick;
  const readyAt = cooldowns.get(key) ?? 0;
  if (now < readyAt) {
    const left = Math.ceil((readyAt - now) / TICKS);
    actionBar(player, `§7Recharging... §f${left}s`);
    return false;
  }
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
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {
    // player left mid-tick
  }
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
  if (!tryCooldown(player, "overlord_staff", 1.0)) return;
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
  if (!tryCooldown(player, "overlord_staff", 12.0)) return;
  const at = add(target.location, { x: 0, y: 1, z: 0 });
  target.applyDamage(40, { cause: EntityDamageCause.magic, damagingEntity: player });
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
  if (!tryCooldown(player, "overlord_ring", 3.0)) return;
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
  if (!tryCooldown(player, "overlord_ginnungagap", 8.0)) return;
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
  if (!tryCooldown(player, "overlord_tome", 30.0)) return;
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
    entityHit.applyDamage(12, { cause: EntityDamageCause.magic, damagingEntity: player });
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
    if (item === id("staff_of_ainz_ooal_gown")) {
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
    } else if (item in SIGILS) {
      useSigil(player, SIGILS[item]);
    }
  } catch (error) {
    console.warn(`[Overlord] ability failed: ${error}`);
  }
});

world.afterEvents.itemCompleteUse.subscribe((event) => {
  if (event.itemStack.typeId !== id("red_potion")) return;
  try {
    const player = event.source;
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

// Worn-item effects: Dark Warrior full-set bonus ("Perfect Warrior") and the Mask of Envy.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      const gear = player.getComponent("minecraft:equippable");
      if (!gear) continue;
      const complete = DARK_WARRIOR_SET.every(([slot, item]) => gear.getEquipment(slot)?.typeId === item);
      if (complete) {
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
