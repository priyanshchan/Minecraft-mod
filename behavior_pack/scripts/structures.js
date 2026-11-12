// Overlord: Tomb of Nazarick - faction camps and outposts.
// The overworld is divided into regions; some regions hold one site (a camp, outpost
// or village of a faction), chosen deterministically from a per-world salt. A site is
// built from blocks the first time a player explores near it, and its garrison is
// posted - and later replenished - when a player comes close.
import { world, system, BlockVolume, ItemStack } from "@minecraft/server";
import { addRep, creditedPlayer, giveItem, grantXp, notify, profileOf } from "./rpg.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const mc = (/** @type {string} */ name) => `minecraft:${name}`;
const TICKS = 20;

export const REGION = 192; // blocks per region side
const SITE_CHANCE = 0.4; // share of regions that hold a site
const SPAWN_CLEARANCE = 120; // no sites this close to the world spawn
const BUILD_NEAR = 40; // a site is built when a player is between these distances...
const BUILD_FAR = 110;
const WAKE_RANGE = 44; // ...and garrisoned when a player comes this close
const REFILL_TICKS = 10 * 60 * TICKS; // a cleared camp is re-manned after ten minutes
const MAX_SLOPE = 4;

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {[string, number, number]} Loot item, min, max */
/**
 * @typedef {{
 *   key: string, name: string, weight: number, radius: number, pad: string,
 *   build: (b: Builder) => void, garrison: (tier: number) => [string, number][],
 * }} SiteType
 */

/** Blocks a site may stand on. Anything else (water, lava, leaves...) is not ground. */
const GROUND = new Set(
  ["grass_block", "dirt", "coarse_dirt", "podzol", "sand", "red_sand", "stone", "gravel", "snow", "mycelium", "mud",
    "moss_block", "sandstone", "red_sandstone", "grass_path", "packed_mud"].map(mc)
);

// ------------------------------------------------------------------ builder

/** Places blocks relative to a site's centre; y = 0 is the first layer above the ground. */
export class Builder {
  /** @param {Dimension} dimension @param {Vector3} origin */
  constructor(dimension, origin) {
    this.dimension = dimension;
    this.origin = origin;
    /** @type {{ at: Vector3, loot: Loot[] }[]} */
    this.chests = [];
  }

  /** @param {number} x @param {number} y @param {number} z */
  at(x, y, z) {
    return { x: this.origin.x + x, y: this.origin.y + y, z: this.origin.z + z };
  }

  /** @param {number} x @param {number} y @param {number} z @param {string} block */
  set(x, y, z, block) {
    this.dimension.setBlockType(this.at(x, y, z), block);
  }

  /** @param {number} x0 @param {number} y0 @param {number} z0 @param {number} x1 @param {number} y1 @param {number} z1 @param {string} block */
  fill(x0, y0, z0, x1, y1, z1, block) {
    this.dimension.fillBlocks(new BlockVolume(this.at(x0, y0, z0), this.at(x1, y1, z1)), block);
  }

  /** Hollow box: walls only. @param {number} x0 @param {number} y0 @param {number} z0 @param {number} x1 @param {number} y1 @param {number} z1 @param {string} block */
  walls(x0, y0, z0, x1, y1, z1, block) {
    this.fill(x0, y0, z0, x1, y1, z0, block);
    this.fill(x0, y0, z1, x1, y1, z1, block);
    this.fill(x0, y0, z0, x0, y1, z1, block);
    this.fill(x1, y0, z0, x1, y1, z1, block);
  }

  /** A-frame tent, 5 wide and 4 long, open towards -z. @param {number} x @param {number} z @param {string} cloth */
  tent(x, z, cloth) {
    for (let dz = 0; dz < 4; dz++) {
      this.set(x - 2, 0, z + dz, cloth);
      this.set(x + 2, 0, z + dz, cloth);
      this.set(x - 1, 1, z + dz, cloth);
      this.set(x + 1, 1, z + dz, cloth);
      this.set(x, 2, z + dz, cloth);
    }
    this.fill(x - 1, 0, z + 3, x + 1, 0, z + 3, cloth); // back wall
    this.set(x, 1, z + 3, cloth);
    this.set(x, 0, z + 2, mc("hay_block")); // bedroll
  }

  /** Campfire with two log seats. @param {number} x @param {number} z @param {string} [fire] */
  campfire(x, z, fire = mc("campfire")) {
    this.set(x, 0, z, fire);
    this.set(x - 2, 0, z, mc("oak_log"));
    this.set(x + 2, 0, z, mc("oak_log"));
  }

  /** Pole with a two-block flag. @param {number} x @param {number} z @param {string} cloth @param {string} [pole] */
  flag(x, z, cloth, pole = mc("oak_fence")) {
    this.fill(x, 0, z, x, 4, z, pole);
    this.fill(x + 1, 3, z, x + 2, 4, z, cloth);
  }

  /** Chest that is filled once the block exists. @param {number} x @param {number} y @param {number} z @param {Loot[]} loot */
  chest(x, y, z, loot) {
    this.set(x, y, z, mc("chest"));
    this.chests.push({ at: this.at(x, y, z), loot });
  }
}

// ---------------------------------------------------------------- site types

/** @type {SiteType[]} */
export const SITES = [
  {
    key: "goblin_camp", name: "Goblin Camp", weight: 22, radius: 7, pad: mc("coarse_dirt"),
    build(b) {
      for (let i = 0; i < 16; i++) { // ring of spikes with gaps
        if (i % 4 === 3) continue;
        const a = (i / 16) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * 7);
        const z = Math.round(Math.sin(a) * 7);
        b.fill(x, 0, z, x, 1 + (i % 2), z, mc("spruce_fence"));
      }
      b.tent(-3, 1, mc("brown_wool"));
      b.tent(3, 1, mc("green_wool"));
      b.campfire(0, -2);
      b.set(-4, 0, -3, mc("bone_block"));
      b.set(-4, 1, -3, mc("bone_block"));
      b.set(4, 0, -4, mc("hay_block"));
      b.chest(0, 0, 4, [[id("yggdrasil_gold_coin"), 2, 6], [mc("rotten_flesh"), 2, 5], [mc("bone"), 1, 4], [mc("iron_ingot"), 0, 2]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("goblin"), 5]] : [[id("goblin"), 5], [id("ogre"), tier]]),
  },
  {
    key: "bandit_camp", name: "Bandit Camp", weight: 18, radius: 6, pad: mc("coarse_dirt"),
    build(b) {
      b.tent(-3, 0, mc("black_wool"));
      b.tent(3, 0, mc("brown_wool"));
      b.campfire(0, -3);
      b.set(-5, 0, -4, mc("barrel"));
      b.set(-5, 1, -4, mc("barrel"));
      b.set(-4, 0, -4, mc("barrel"));
      b.set(5, 0, -4, mc("hay_block"));
      b.chest(0, 0, 3, [[id("yggdrasil_gold_coin"), 4, 10], [mc("bread"), 2, 5], [mc("iron_ingot"), 1, 3], [mc("gold_ingot"), 0, 2], [id("red_potion"), 0, 2]]);
    },
    garrison: (tier) => [[id("bandit"), 4 + tier]],
  },
  {
    key: "adventurer_camp", name: "Adventurers' Camp", weight: 15, radius: 5, pad: mc("grass_path"),
    build(b) {
      b.tent(0, 1, mc("green_wool"));
      b.campfire(0, -3);
      b.set(3, 0, -2, mc("crafting_table"));
      b.set(-3, 0, -2, mc("barrel"));
      b.chest(3, 0, 2, [[mc("bread"), 2, 4], [id("red_potion"), 1, 2], [mc("arrow"), 4, 12], [id("data_crystal"), 0, 1]]);
    },
    garrison: () => [[id("adventurer"), 3]],
  },
  {
    key: "kingdom_camp", name: "Kingdom Army Camp", weight: 15, radius: 8, pad: mc("grass_path"),
    build(b) {
      b.tent(-5, 1, mc("blue_wool"));
      b.tent(0, 2, mc("white_wool"));
      b.tent(5, 1, mc("blue_wool"));
      b.campfire(0, -3);
      b.flag(-6, -6, mc("blue_wool"));
      b.flag(6, -6, mc("blue_wool"));
      b.fill(-2, 0, -7, -1, 0, -7, mc("hay_block")); // training yard
      b.set(-2, 1, -7, mc("target"));
      b.set(4, 0, -5, mc("barrel"));
      b.set(5, 0, -5, mc("barrel"));
      b.chest(0, 0, 7, [[mc("bread"), 3, 6], [mc("iron_ingot"), 2, 4], [mc("arrow"), 8, 16], [id("red_potion"), 1, 3], [id("yggdrasil_gold_coin"), 2, 5]]);
    },
    garrison: () => [[id("soldier"), 4], [id("archer"), 2]],
  },
  {
    key: "empire_outpost", name: "Empire Outpost", weight: 12, radius: 7, pad: mc("gravel"),
    build(b) {
      b.walls(-2, 0, -2, 2, 6, 2, mc("stone_bricks")); // watchtower
      b.fill(-2, 4, -2, 2, 4, 2, mc("spruce_planks")); // upper floor
      b.fill(0, 0, -2, 0, 1, -2, mc("air")); // doorway
      for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2], [0, -2], [0, 2], [-2, 0], [2, 0]]) {
        b.set(x, 7, z, mc("stone_bricks")); // battlements
      }
      b.set(0, 5, 0, mc("lantern"));
      b.flag(-6, -6, mc("red_wool"), mc("spruce_fence"));
      b.fill(-7, 0, 5, 7, 0, 5, mc("cobblestone_wall")); // rear wall
      b.fill(-7, 0, 0, -7, 0, 5, mc("cobblestone_wall"));
      b.fill(7, 0, 0, 7, 0, 5, mc("cobblestone_wall"));
      b.campfire(4, -4);
      b.chest(0, 0, 1, [[mc("iron_ingot"), 2, 5], [mc("gold_ingot"), 1, 3], [mc("bread"), 2, 4], [id("yggdrasil_gold_coin"), 3, 8], [id("data_crystal"), 0, 2]]);
    },
    garrison: (tier) => [[id("imperial_knight"), 4 + tier]],
  },
  {
    key: "nazarick_outpost", name: "Nazarick Outpost", weight: 12, radius: 7, pad: id("nazarick_tiles"),
    build(b) {
      b.fill(-4, 0, -4, 4, 0, 4, id("nazarick_bricks")); // dais
      b.fill(-3, 0, -3, 3, 0, 3, id("nazarick_tiles"));
      for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
        b.fill(x, 1, z, x, 4, z, id("nazarick_pillar"));
        b.set(x, 5, z, id("nazarick_lamp"));
      }
      b.fill(-1, 1, -1, 1, 1, 1, id("gilded_nazarick_bricks")); // altar
      b.set(0, 2, 0, id("data_crystal_block"));
      b.set(-3, 1, 0, id("cracked_nazarick_bricks"));
      b.set(3, 1, -2, id("cracked_nazarick_bricks"));
      b.set(-6, 0, 5, mc("bone_block"));
      b.set(6, 0, -5, mc("bone_block"));
      b.set(5, 0, 6, mc("soul_campfire"));
      b.chest(0, 1, 3, [[id("data_crystal"), 3, 7], [id("yggdrasil_gold_coin"), 4, 10], [id("soul_fragment"), 0, 3], [mc("bone"), 2, 6], [id("scroll_of_lightning"), 0, 1]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("old_guarder"), 4], [id("skeleton_mage"), 1]]
        : tier === 1
          ? [[id("old_guarder"), 3], [id("skeleton_mage"), 2], [id("elder_lich"), 1], [id("death_knight"), 1]]
          : [[id("death_knight"), 2], [id("elder_lich"), 2], [id("soul_eater"), 1], [id("skeleton_mage"), 2]],
  },
  {
    key: "lizardman_village", name: "Lizardman Village", weight: 6, radius: 8, pad: mc("packed_mud"),
    build(b) {
      for (const [x, z] of [[-5, -4], [5, -4], [0, 4]]) { // three mud huts
        b.walls(x - 2, 0, z - 2, x + 2, 2, z + 2, mc("packed_mud"));
        b.fill(x - 2, 3, z - 2, x + 2, 3, z + 2, mc("moss_block"));
        b.fill(x, 0, z - 2, x, 1, z - 2, mc("air"));
        b.set(x, 0, z + 1, mc("hay_block"));
      }
      b.campfire(0, -3);
      b.flag(-7, 6, mc("green_wool"), mc("mangrove_log"));
      b.chest(1, 0, 5, [[mc("cod"), 3, 8], [mc("bone"), 1, 3], [id("yggdrasil_gold_coin"), 1, 4], [id("data_crystal"), 0, 1]]);
    },
    garrison: () => [[id("lizardman"), 5]],
  },
];

// ------------------------------------------------------------- site lookup

let salt = 0;
function worldSalt() {
  if (salt !== 0) return salt;
  const stored = world.getDynamicProperty("overlord:site_salt");
  if (typeof stored === "number" && stored !== 0) salt = stored;
  else {
    salt = 1 + Math.floor(Math.random() * 2147483000);
    world.setDynamicProperty("overlord:site_salt", salt);
  }
  return salt;
}

/** Deterministic 0..1 value for a region. @param {number} rx @param {number} rz @param {number} n @param {number} seed */
export function roll(rx, rz, n, seed) {
  let h = Math.imul(rx, 374761393) ^ Math.imul(rz, 668265263) ^ Math.imul(n + 1, 2246822519) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * The site planned for a region, or undefined when the region is empty.
 * @param {number} rx @param {number} rz @param {number} [seed]
 * @returns {{ x: number, z: number, type: SiteType } | undefined}
 */
export function siteOf(rx, rz, seed = worldSalt()) {
  if (roll(rx, rz, 0, seed) >= SITE_CHANCE) return undefined;
  const margin = 24;
  const x = rx * REGION + margin + Math.floor(roll(rx, rz, 1, seed) * (REGION - 2 * margin));
  const z = rz * REGION + margin + Math.floor(roll(rx, rz, 2, seed) * (REGION - 2 * margin));
  const total = SITES.reduce((n, s) => n + s.weight, 0);
  let pick = roll(rx, rz, 3, seed) * total;
  let type = SITES[0];
  for (const s of SITES) {
    type = s;
    pick -= s.weight;
    if (pick < 0) break;
  }
  return { x, z, type };
}

/** @typedef {{ x: number, y: number, z: number, type: SiteType, found: boolean }} Camp */
/** Region key -> built camp, or null when the region was rejected or is empty. */
/** @type {Map<string, Camp | null>} */
const camps = new Map();

/** @param {number} rx @param {number} rz */
function campIn(rx, rz) {
  const key = `${rx},${rz}`;
  if (camps.has(key)) return camps.get(key);
  const stored = world.getDynamicProperty(`overlord:site:${key}`);
  if (typeof stored !== "string") return undefined; // not processed yet
  /** @type {Camp | null} */
  let camp = null;
  const parts = stored.split("|");
  const type = SITES.find((s) => s.key === parts[0]);
  if (type && parts.length >= 4) {
    camp = { x: Number(parts[1]), y: Number(parts[2]), z: Number(parts[3]), type, found: parts[4] === "1" };
  }
  camps.set(key, camp);
  return camp;
}

/** @param {number} rx @param {number} rz @param {Camp | null} camp */
function remember(rx, rz, camp) {
  const key = `${rx},${rz}`;
  camps.set(key, camp);
  world.setDynamicProperty(
    `overlord:site:${key}`,
    camp ? `${camp.type.key}|${camp.x}|${camp.y}|${camp.z}|${camp.found ? 1 : 0}` : "-"
  );
}

// ----------------------------------------------------------------- building

/**
 * Height of the ground at a column: the y of the highest ground block, or undefined
 * when the column is unloaded, under water or has no ground near the surface.
 * @param {Dimension} dimension @param {number} x @param {number} z
 */
function groundAt(dimension, x, z) {
  const top = dimension.getTopmostBlock({ x, z });
  if (!top) return undefined;
  let y = top.location.y;
  for (let i = 0; i < 24; i++, y--) {
    const block = dimension.getBlock({ x, y, z });
    if (!block) return undefined;
    if (block.isLiquid) return null;
    if (GROUND.has(block.typeId)) return y;
  }
  return null;
}

/**
 * Tries to build the site. Returns the camp, null when the place is unsuitable, or
 * undefined when the area is not loaded yet (try again later).
 * @param {Dimension} dimension @param {{ x: number, z: number, type: SiteType }} site
 * @returns {Camp | null | undefined}
 */
export function buildSite(dimension, site) {
  const r = site.type.radius;
  const heights = [];
  for (const [dx, dz] of [[0, 0], [-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]]) {
    const y = groundAt(dimension, site.x + dx, site.z + dz);
    if (y === undefined) return undefined;
    if (y === null) return null;
    heights.push(y);
  }
  if (Math.max(...heights) - Math.min(...heights) > MAX_SLOPE) return null;

  const b = new Builder(dimension, { x: site.x, y: heights[0] + 1, z: site.z });
  b.fill(-r, -3, -r, r, -2, r, mc("dirt")); // foundation under the pad
  b.fill(-r, -1, -r, r, -1, r, site.type.pad);
  b.fill(-r, 0, -r, r, 8, r, mc("air"));
  site.type.build(b);

  // Chest contents are added a tick later, once the chest blocks exist.
  system.runTimeout(() => {
    for (const chest of b.chests) {
      try {
        const container = dimension.getBlock(chest.at)?.getComponent("minecraft:inventory")?.container;
        if (!container) continue;
        for (const [item, min, max] of chest.loot) {
          const amount = min + Math.floor(Math.random() * (max - min + 1));
          if (amount > 0) container.addItem(new ItemStack(item, amount));
        }
      } catch (error) {
        console.warn(`[Overlord] could not stock a camp chest: ${error}`);
      }
    }
  }, 2);
  return { x: site.x, y: heights[0] + 1, z: site.z, type: site.type, found: false };
}

// ----------------------------------------------------------------- garrison

/** Camp key -> tick of the last time its garrison was posted. */
const manned = new Map();
/** Camp key -> how many defenders were posted, their tier, and how many have been slain since. */
/** @type {Map<string, { size: number, tier: number, slain: number }>} */
const sieges = new Map();
/** Sites whose garrison is hostile: clearing them out is rewarded. */
const HOSTILE_SITES = new Set(["goblin_camp", "bandit_camp", "nazarick_outpost"]);

/** @param {number} level */
function tierFor(level) {
  return level >= 50 ? 2 : level >= 20 ? 1 : 0;
}

/**
 * Posts the missing members of a camp's garrison. Returns how many were spawned.
 * @param {Dimension} dimension @param {Camp} camp @param {number} tier
 */
export function garrison(dimension, camp, tier) {
  const center = { x: camp.x + 0.5, y: camp.y, z: camp.z + 0.5 };
  let spawned = 0;
  let slot = 0;
  for (const [type, wanted] of camp.type.garrison(tier)) {
    const present = dimension.getEntities({ type, location: center, maxDistance: 30 }).length;
    for (let i = present; i < wanted; i++, slot++) {
      const angle = (slot / 8) * Math.PI * 2;
      const reach = Math.max(2, camp.type.radius - 2);
      try {
        const mob = dimension.spawnEntity(type, { x: center.x + Math.cos(angle) * reach, y: camp.y, z: center.z + Math.sin(angle) * reach });
        mob.addTag("overlord_camp");
        spawned++;
      } catch {
        // spot not loaded
      }
    }
  }
  return spawned;
}

/**
 * Looks at the regions around a player: builds sites that came into range and wakes camps.
 * @param {Player} player
 */
export function explore(player) {
  if (player.dimension.id !== "minecraft:overworld") return;
  const px = player.location.x;
  const pz = player.location.z;
  const rx0 = Math.floor(px / REGION);
  const rz0 = Math.floor(pz / REGION);
  for (let rx = rx0 - 1; rx <= rx0 + 1; rx++) {
    for (let rz = rz0 - 1; rz <= rz0 + 1; rz++) {
      let camp = campIn(rx, rz);
      if (camp === undefined) {
        const site = siteOf(rx, rz);
        if (!site) {
          remember(rx, rz, null);
          continue;
        }
        const spawn = world.getDefaultSpawnLocation();
        if (Math.hypot(site.x - spawn.x, site.z - spawn.z) < SPAWN_CLEARANCE) {
          remember(rx, rz, null);
          continue;
        }
        const distance = Math.hypot(site.x - px, site.z - pz);
        if (distance < BUILD_NEAR || distance > BUILD_FAR) continue; // wait for a better moment
        const built = buildSite(player.dimension, site);
        if (built === undefined) continue; // chunks not loaded yet
        remember(rx, rz, built);
        camp = built;
      }
      if (!camp) continue;
      if (Math.hypot(camp.x - px, camp.z - pz) > WAKE_RANGE) continue;
      const key = `${rx},${rz}`;
      if (!camp.found) {
        camp.found = true;
        remember(rx, rz, camp);
        notify(player, `§6Discovered: §f${camp.type.name}`);
        grantXp(player, 80, "discovery");
      }
      const last = manned.get(key);
      if (last !== undefined && system.currentTick - last < REFILL_TICKS) continue;
      manned.set(key, system.currentTick);
      const tier = tierFor(profileOf(player).level);
      garrison(player.dimension, camp, tier);
      sieges.set(key, { size: camp.type.garrison(tier).reduce((n, [, count]) => n + count, 0), tier, slain: 0 });
    }
  }
}

// A hostile camp is cleared when as many of its defenders have been slain as were posted.
world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    if (!dead.hasTag("overlord_camp")) return;
    const player = creditedPlayer(event.damageSource.damagingEntity);
    if (!player) return;
    const rx0 = Math.floor(dead.location.x / REGION);
    const rz0 = Math.floor(dead.location.z / REGION);
    for (let rx = rx0 - 1; rx <= rx0 + 1; rx++) {
      for (let rz = rz0 - 1; rz <= rz0 + 1; rz++) {
        const camp = campIn(rx, rz);
        const key = `${rx},${rz}`;
        const siege = sieges.get(key);
        if (!camp || !siege || !HOSTILE_SITES.has(camp.type.key)) continue;
        if (Math.hypot(camp.x - dead.location.x, camp.z - dead.location.z) > 60) continue;
        siege.slain += 1;
        if (siege.slain < siege.size) return;
        sieges.delete(key);
        manned.set(key, system.currentTick + REFILL_TICKS); // a cleared camp stays quiet twice as long
        const coins = 8 * (siege.tier + 1);
        const xp = 150 * (siege.tier + 1);
        for (const hero of dead.dimension.getPlayers({ location: { x: camp.x, y: camp.y, z: camp.z }, maxDistance: 48 })) {
          giveItem(hero, id("yggdrasil_gold_coin"), coins);
          addRep(hero, "kingdom", 5);
          addRep(hero, "adventurers", 5);
          hero.sendMessage(`§6[Overlord] §f${camp.type.name} cleared! Reward: §6${coins} Gold Coins§f, §a${xp} XP§f. The Kingdom and the adventurers think better of you.`);
          grantXp(hero, xp, "camp cleared");
        }
        return;
      }
    }
  } catch {
    // the dead mob is already unloaded
  }
});

/**
 * A rumour about the nearest site the player has not found yet.
 * @param {Player} player
 */
export function rumour(player) {
  if (player.dimension.id !== "minecraft:overworld") return undefined;
  const rx0 = Math.floor(player.location.x / REGION);
  const rz0 = Math.floor(player.location.z / REGION);
  /** @type {{ distance: number, dx: number, dz: number, name: string } | undefined} */
  let best;
  for (let rx = rx0 - 2; rx <= rx0 + 2; rx++) {
    for (let rz = rz0 - 2; rz <= rz0 + 2; rz++) {
      const known = campIn(rx, rz);
      if (known === null || (known && known.found)) continue;
      const site = known ? { x: known.x, z: known.z, type: known.type } : siteOf(rx, rz);
      if (!site) continue;
      const dx = site.x - player.location.x;
      const dz = site.z - player.location.z;
      const distance = Math.hypot(dx, dz);
      if (!best || distance < best.distance) best = { distance, dx, dz, name: site.type.name };
    }
  }
  if (!best) return undefined;
  const ns = best.dz < -best.distance * 0.38 ? "north" : best.dz > best.distance * 0.38 ? "south" : "";
  const ew = best.dx > best.distance * 0.38 ? "east" : best.dx < -best.distance * 0.38 ? "west" : "";
  const heading = ns && ew ? `${ns}-${ew}` : ns || ew;
  const article = /^[AEIOU]/.test(best.name) ? "an" : "a";
  return `Word is there's ${article} ${best.name} about ${Math.round(best.distance / 10) * 10} blocks to the ${heading}.`;
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      explore(player);
    } catch (error) {
      console.warn(`[Overlord] site check failed: ${error}`);
    }
  }
}, 5 * TICKS);
