// Overlord: Tomb of Nazarick - faction camps and outposts.
// The overworld is divided into regions; some regions hold one site (a camp, outpost
// or village of a faction), chosen deterministically from a per-world salt. A site is
// built from blocks the first time a player comes near it, and its garrison is
// posted - and later replenished - when a player comes close.
//
// Blocks can only be read and placed in chunks that are loaded and ticking, which with a
// low simulation distance is little more than 60 blocks around a player, and the game
// raises an error for anything further out. Every block query here is therefore guarded,
// a site that cannot be surveyed yet is simply tried again a moment later, and one
// region failing never stops the others from being looked at.
import { world, system, BlockVolume, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { addRep, creditedPlayer, giveItem, grantXp, notify, profileOf, questEvent, registerMenu, touch } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import * as skills from "./skills.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const mc = (/** @type {string} */ name) => `minecraft:${name}`;
const TICKS = 20;

export const REGION = 160; // blocks per region side
const SITE_CHANCE = 0.65; // share of regions that hold a site
const SPAWN_CLEARANCE = 64; // no sites this close to the world spawn
export const BUILD_FAR = 72; // a site is built once a player is this close...
const KEEP_CLEAR = 6; // ...but not while they stand this near its edge, so nobody is walled in
const WAKE_RANGE = 44; // the garrison is posted when a player comes this close
const REFILL_TICKS = 10 * 60 * TICKS; // a cleared camp is re-manned after ten minutes
const MAX_SLOPE = 8; // the ground under a site may differ this much in height; the pad evens it out
/** If the planned spot is unsuitable, these offsets around it are tried in turn. */
const SHIFTS = [[0, 0], [24, 0], [-24, 0], [0, 24], [0, -24], [24, 24], [-24, 24], [24, -24], [-24, -24]];
/**
 * World property prefix for processed regions. Versions before 5.1 used "overlord:site:" and versions
 * before 7.0 "overlord:camp:"; neither is read any more, so sites laid by those versions are found and
 * raised again in their new form.
 */
const STORE = "overlord:site7:";
/** The prefix used by versions 5.1 to 6.x; its sites are rebuilt in place in their new form. */
const OLD_STORE = "overlord:camp:";
/** How many layers above the ground a site clears unless it asks for more. */
const CLEAR_HEIGHT = 12;
/** How far from its centre a site posts its garrison unless it says otherwise. */
export const MUSTER = 4;

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {[string, number, number]} Loot item, min, max */
/**
 * @typedef {{
 *   key: string, name: string, weight: number, radius: number, pad: string,
 *   build: (b: Builder) => void, garrison: (tier: number) => [string, number][],
 *   height?: number, muster?: number,
 * }} SiteType
 * `height` is how many layers above the ground are cleared before building (12 unless given) and
 * `muster` how far from the centre the garrison is posted (4 unless given).
 */

/** Blocks a site may stand on: soil, sand, stone, snow and the like. Leaves, logs, plants and liquids are not ground. */
const GROUND = /(grass_block|dirt|dirt_with_roots|podzol|mycelium|sand|sandstone|stone|gravel|clay|terracotta|snow|ice|mud|moss_block|grass_path|deepslate|andesite|diorite|granite|tuff|calcite|basalt)$/;

/** @param {string} typeId */
export function isGround(typeId) {
  return GROUND.test(typeId) && !typeId.endsWith("snow_layer");
}

/** Whether an error means "that chunk is not loaded yet" rather than a real fault. @param {unknown} error */
function isUnloaded(error) {
  const text = `${/** @type {any} */ (error)?.name ?? ""} ${error}`;
  return /unloaded|not loaded|outside of the world|out of world/i.test(text);
}

// ------------------------------------------------------------------ builder

/**
 * Places blocks relative to a site's centre; y = 0 is the first layer above the ground and
 * y = -1 the ground itself. +x is east and +z is south. Besides single blocks and boxes it
 * knows how to raise the pieces sites are made of: houses with pitched roofs, towers, walls
 * with battlements and gates, palisades, market stalls, wells, trees and the like.
 */
export class Builder {
  /** @param {Dimension} dimension @param {Vector3} origin */
  constructor(dimension, origin) {
    this.dimension = dimension;
    this.origin = origin;
    /** @type {{ at: Vector3, loot: Loot[] }[]} */
    this.chests = [];
    // Each site is laid out the same way every time it is built: its dice are thrown from its position.
    this.state = (Math.imul(Math.floor(origin.x), 73856093) ^ Math.imul(Math.floor(origin.z), 19349663)) >>> 0 || 1;
  }

  /** A repeatable number from 0 to 1. */
  random() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** @template T @param {T[]} list @returns {T} */
  pick(list) {
    return list[Math.floor(this.random() * list.length)];
  }

  /** @param {number} x @param {number} y @param {number} z */
  at(x, y, z) {
    return { x: this.origin.x + x, y: this.origin.y + y, z: this.origin.z + z };
  }

  /**
   * Runs one placement. An unloaded chunk stops the build (it is tried again later); any other
   * fault - such as a block this game version does not have - only skips that one placement.
   * @param {() => void} place @param {string} block
   */
  guard(place, block) {
    try {
      place();
    } catch (error) {
      if (isUnloaded(error)) throw error;
      console.warn(`[Overlord] could not place ${block}: ${error}`);
    }
  }

  /** @param {number} x @param {number} y @param {number} z @param {string} block */
  set(x, y, z, block) {
    this.guard(() => this.dimension.setBlockType(this.at(x, y, z), block), block);
  }

  /** @param {number} x0 @param {number} y0 @param {number} z0 @param {number} x1 @param {number} y1 @param {number} z1 @param {string} block */
  fill(x0, y0, z0, x1, y1, z1, block) {
    this.guard(() => this.dimension.fillBlocks(new BlockVolume(this.at(x0, y0, z0), this.at(x1, y1, z1)), block), block);
  }

  /** Hollow box: walls only. @param {number} x0 @param {number} y0 @param {number} z0 @param {number} x1 @param {number} y1 @param {number} z1 @param {string} block */
  walls(x0, y0, z0, x1, y1, z1, block) {
    this.fill(x0, y0, z0, x1, y1, z0, block);
    this.fill(x0, y0, z1, x1, y1, z1, block);
    this.fill(x0, y0, z0, x0, y1, z1, block);
    this.fill(x1, y0, z0, x1, y1, z1, block);
  }

  /** A strip of ground - a path or a floor. @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {string} [block] */
  path(x0, z0, x1, z1, block = mc("grass_path")) {
    this.fill(x0, -1, z0, x1, -1, z1, block);
  }

  /**
   * A disc of blocks, or only its rim.
   * @param {number} cx @param {number} y @param {number} cz @param {number} radius @param {string} block @param {boolean} [rim]
   */
  disc(cx, y, cz, radius, block, rim = false) {
    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
      for (let dz = -Math.ceil(radius); dz <= Math.ceil(radius); dz++) {
        const d = Math.hypot(dx, dz);
        if (d > radius + 0.35 || (rim && d < radius - 0.65)) continue;
        this.set(cx + dx, y, cz + dz, block);
      }
    }
  }

  /**
   * A round wall with a gate on its south side.
   * @param {number} radius @param {number} height @param {string} block @param {number} [gate] half-width of the gate, -1 for none
   */
  roundWall(radius, height, block, gate = 1) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > radius + 0.35 || d < radius - 0.65) continue;
        if (gate >= 0 && dz > 0 && Math.abs(dx) <= gate) continue;
        this.fill(dx, 0, dz, dx, height - 1, dz, block);
      }
    }
  }

  /** Every other block along the top of a rectangle of wall. @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {number} y @param {string} block */
  battlements(x0, z0, x1, z1, y, block) {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
        if ((x + z) % 2 === 0) this.set(x, y, z, block);
      }
    }
  }

  /**
   * A house: walls, a floor, a doorway, windows and a pitched roof with its ridge along the longer side.
   * @param {number} x west edge @param {number} z north edge @param {number} w @param {number} d
   * @param {{ wall: string, roof: string, floor?: string, height?: number, door?: "n" | "s" | "e" | "w", windows?: boolean }} look
   */
  house(x, z, w, d, look) {
    const h = look.height ?? 3;
    const x1 = x + w - 1;
    const z1 = z + d - 1;
    this.fill(x, -1, z, x1, -1, z1, look.floor ?? mc("oak_planks"));
    this.fill(x, 0, z, x1, h - 1, z1, mc("air"));
    this.walls(x, 0, z, x1, h - 1, z1, look.wall);
    const mx = x + Math.floor(w / 2);
    const mz = z + Math.floor(d / 2);
    const door = look.door ?? "s";
    const [dx, dz] = door === "n" ? [mx, z] : door === "s" ? [mx, z1] : door === "w" ? [x, mz] : [x1, mz];
    this.fill(dx, 0, dz, dx, 1, dz, mc("air"));
    if (look.windows !== false && h >= 3) {
      for (const [wx, wz] of [[mx, z], [mx, z1], [x, mz], [x1, mz]]) {
        if (wx === dx && wz === dz) continue;
        this.set(wx, 1, wz, mc("glass_pane"));
      }
    }
    // The roof steps in from both long sides until it meets at the ridge, and overhangs the walls by one.
    if (w <= d) {
      for (let i = 0; x - 1 + i <= x1 + 1 - i; i++) this.fill(x - 1 + i, h + i, z - 1, x1 + 1 - i, h + i, z1 + 1, look.roof);
    } else {
      for (let i = 0; z - 1 + i <= z1 + 1 - i; i++) this.fill(x - 1, h + i, z - 1 + i, x1 + 1, h + i, z1 + 1 - i, look.roof);
    }
    this.set(x + 1, 0, z + 1, mc("lantern"));
  }

  /**
   * A square tower with a doorway to the south, a floor at the top and battlements.
   * @param {number} x west edge @param {number} z north edge @param {number} size @param {number} height @param {string} block @param {string} [light]
   */
  tower(x, z, size, height, block, light = mc("lantern")) {
    const x1 = x + size - 1;
    const z1 = z + size - 1;
    this.walls(x, 0, z, x1, height - 1, z1, block);
    this.fill(x, height - 1, z, x1, height - 1, z1, block);
    this.battlements(x, z, x1, z1, height, block);
    const mx = x + Math.floor(size / 2);
    this.fill(mx, 0, z1, mx, 1, z1, mc("air"));
    this.set(mx, height, z + Math.floor(size / 2), light);
    for (let y = 2; y < height - 2; y += 3) this.set(mx, y, z1, mc("iron_bars")); // arrow slits
  }

  /**
   * A square curtain wall with battlements, a gate to the south and, if wanted, a tower at each corner.
   * @param {number} half @param {number} height @param {string} block @param {{ towers?: number, gate?: number, towerBlock?: string }} [look]
   */
  fort(half, height, block, look = {}) {
    this.walls(-half, 0, -half, half, height - 1, half, block);
    this.battlements(-half, -half, half, half, height, block);
    const gate = look.gate ?? 1;
    this.fill(-gate, 0, half, gate, Math.min(height - 1, 2), half, mc("air"));
    this.fill(-gate, height, half, gate, height, half, block); // the lintel over the gate keeps its teeth
    const size = look.towers ?? 0;
    if (size > 0) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = sx < 0 ? -half - 1 : half - size + 2;
        const z = sz < 0 ? -half - 1 : half - size + 2;
        this.tower(x, z, size, height + 3, look.towerBlock ?? block);
      }
    }
  }

  /**
   * A square palisade of upright logs with pointed posts at the corners and a gate to the south.
   * @param {number} half @param {string} log @param {number} [height]
   */
  palisade(half, log, height = 2) {
    this.walls(-half, 0, -half, half, height - 1, half, log);
    this.fill(-1, 0, half, 1, height - 1, half, mc("air"));
    for (const [x, z] of [[-half, -half], [half, -half], [-half, half], [half, half], [-2, half], [2, half]]) this.fill(x, height, z, x, height, z, log);
  }

  /** A ring of single posts. @param {number} radius @param {string} block @param {number} count @param {number} [height] */
  stakes(radius, block, count, height = 1) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.1;
      const x = Math.round(Math.cos(a) * radius);
      const z = Math.round(Math.sin(a) * radius);
      if (z > 0 && Math.abs(x) <= 1) continue; // the way in
      this.fill(x, 0, z, x, height - 1, z, block);
    }
  }

  /**
   * A-frame tent, 5 wide and 4 long (from z to z + 3), with its open end towards the middle of the site.
   * @param {number} x @param {number} z @param {string} cloth
   */
  tent(x, z, cloth) {
    for (let dz = 0; dz < 4; dz++) {
      this.set(x - 2, 0, z + dz, cloth);
      this.set(x + 2, 0, z + dz, cloth);
      this.set(x - 1, 1, z + dz, cloth);
      this.set(x + 1, 1, z + dz, cloth);
      this.set(x, 2, z + dz, cloth);
    }
    const back = z < 0 ? z : z + 3; // the closed end is the one away from the middle
    this.fill(x - 1, 0, back, x + 1, 0, back, cloth);
    this.set(x, 1, back, cloth);
    this.set(x, 0, z < 0 ? z + 1 : z + 2, mc("hay_block")); // bedroll
  }

  /**
   * A large pavilion, 7 wide and 6 long (from z to z + 5), carpeted, with its open end towards the middle of the site.
   * @param {number} x @param {number} z @param {string} cloth @param {string} [carpet]
   */
  pavilion(x, z, cloth, carpet = mc("red_carpet")) {
    for (let dz = 0; dz < 6; dz++) {
      for (const [dx, y] of [[-3, 0], [-3, 1], [-2, 2], [-1, 3], [0, 3], [1, 3], [2, 2], [3, 1], [3, 0]]) this.set(x + dx, y, z + dz, cloth);
    }
    const north = z < 0;
    const back = north ? z : z + 5;
    this.fill(x - 2, 0, back, x + 2, 2, back, cloth);
    this.fill(x - 2, 0, north ? z + 1 : z, x + 2, 0, north ? z + 4 : z + 4, carpet);
    this.set(x, 0, north ? z + 1 : z + 4, mc("crafting_table"));
    this.set(x - 2, 0, north ? z + 1 : z + 4, mc("lantern"));
  }

  /** A round hut of mud with a thatched roof and a doorway towards the middle of the site. @param {number} x @param {number} z */
  roundHut(x, z) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        if (edge && !corner) this.fill(x + dx, 0, z + dz, x + dx, 1, z + dz, mc("packed_mud"));
        if (!corner) this.set(x + dx, 2, z + dz, mc("hay_block"));
        if (!edge) this.set(x + dx, 3, z + dz, mc("hay_block"));
      }
    }
    this.fill(x, 0, z < 0 ? z + 2 : z - 2, x, 1, z < 0 ? z + 2 : z - 2, mc("air"));
    this.set(x + 1, 0, z, mc("hay_block")); // bedding
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

  /** A lamp post. @param {number} x @param {number} z @param {string} [post] @param {string} [light] */
  lamp(x, z, post = mc("oak_fence"), light = mc("lantern")) {
    this.fill(x, 0, z, x, 1, z, post);
    this.set(x, 2, z, light);
  }

  /** A column with a cap. @param {number} x @param {number} z @param {number} height @param {string} block @param {string} [cap] */
  column(x, z, height, block, cap) {
    this.fill(x, 0, z, x, height - 1, z, block);
    if (cap) this.set(x, height, z, cap);
  }

  /** A market stall: four posts, a cloth roof and goods beneath it. @param {number} x @param {number} z @param {string} cloth */
  stall(x, z, cloth) {
    for (const [dx, dz] of [[0, 0], [2, 0], [0, 1], [2, 1]]) this.fill(x + dx, 0, z + dz, x + dx, 1, z + dz, mc("oak_fence"));
    this.fill(x, 2, z, x + 2, 2, z + 1, cloth);
    this.set(x + 1, 0, z, mc("barrel"));
  }

  /** A covered well. @param {number} x @param {number} z */
  well(x, z) {
    this.walls(x - 1, 0, z - 1, x + 1, 0, z + 1, mc("cobblestone"));
    this.set(x, 0, z, mc("cauldron"));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.fill(x + dx, 1, z + dz, x + dx, 2, z + dz, mc("oak_fence"));
    this.fill(x - 1, 3, z - 1, x + 1, 3, z + 1, mc("spruce_slab"));
  }

  /** A tree: a trunk under a crown of leaves. @param {number} x @param {number} z @param {number} height @param {string} [log] @param {string} [leaves] */
  tree(x, z, height, log = mc("oak_log"), leaves = mc("oak_leaves")) {
    this.fill(x - 2, height - 2, z - 2, x + 2, height - 1, z + 2, leaves);
    this.fill(x - 1, height, z - 1, x + 1, height, z + 1, leaves);
    this.fill(x, 0, z, x, height - 1, z, log);
  }

  /** A grave: a mound with a headstone to its north. @param {number} x @param {number} z */
  grave(x, z) {
    this.set(x, 0, z, mc("mossy_cobblestone"));
    this.set(x, 0, z - 1, this.random() < 0.5 ? mc("cobblestone_wall") : mc("stone_brick_wall"));
  }

  /** A spire that narrows to a point. @param {number} x @param {number} z @param {number} height @param {string} block @param {string} [tip] */
  spire(x, z, height, block, tip) {
    const base = Math.max(1, Math.floor(height / 3));
    this.fill(x - 1, 0, z - 1, x + 1, base - 1, z + 1, block);
    this.fill(x, base, z, x, height - 1, z, block);
    if (tip) this.set(x, height, z, tip);
  }

  /** A rounded mound. @param {number} x @param {number} z @param {number} radius @param {string} block */
  mound(x, z, radius, block) {
    for (let y = 0; y < radius; y++) this.disc(x, y, z, Math.sqrt(radius * radius - y * y), block);
  }

  /**
   * Loose blocks scattered over the site, away from its middle. Call it first: whatever is built afterwards replaces it.
   * @param {number} count @param {number} radius @param {string[]} blocks
   */
  rubble(count, radius, blocks) {
    for (let i = 0; i < count; i++) {
      const a = this.random() * Math.PI * 2;
      const d = 5.5 + this.random() * (radius - 5.5);
      this.set(Math.round(Math.cos(a) * d), 0, Math.round(Math.sin(a) * d), this.pick(blocks));
    }
  }

  /** A length of wall that has partly fallen. @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {number} height @param {string[]} blocks */
  ruin(x0, z0, x1, z1, height, blocks) {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const tall = Math.floor(this.random() * (height + 1));
        for (let y = 0; y < tall; y++) this.set(x, y, z, this.pick(blocks));
      }
    }
  }

  /** Chest that is filled once the block exists. @param {number} x @param {number} y @param {number} z @param {Loot[]} loot */
  chest(x, y, z, loot) {
    this.set(x, y, z, mc("chest"));
    this.chests.push({ at: this.at(x, y, z), loot });
  }
}

// ---------------------------------------------------------------- site types

const COIN = id("yggdrasil_gold_coin");
const OAK = { wall: mc("oak_planks"), roof: mc("spruce_planks") };
const STONE = { wall: mc("stone_bricks"), roof: mc("deepslate_bricks"), floor: mc("smooth_stone") };

/**
 * Every kind of site. The middle of each (about four blocks around the centre) is left open: that
 * is where its people are posted.
 * @type {SiteType[]}
 */
export const SITES = [
  // ================================================================ the wilds
  {
    key: "goblin_camp", name: "Goblin Camp", weight: 20, radius: 10, pad: mc("coarse_dirt"),
    build(b) {
      b.rubble(8, 8, [mc("bone_block"), mc("hay_block"), mc("barrel")]);
      b.stakes(9.4, mc("spruce_fence"), 30, 2);
      b.tent(0, -9, mc("brown_wool")); // the chief's
      b.tent(-7, -2, mc("green_wool"));
      b.tent(7, -2, mc("green_wool"));
      b.campfire(0, 0);
      b.column(5, 6, 3, mc("bone_block"), mc("lantern")); // a totem
      b.walls(-6, 0, 5, -4, 1, 7, mc("iron_bars")); // a cage for what they have stolen
      b.fill(-4, 0, 6, -4, 1, 6, mc("air"));
      b.chest(-5, 0, 6, [[mc("iron_ingot"), 1, 4], [mc("emerald"), 0, 2], [mc("bread"), 1, 3], [COIN, 2, 6]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("goblin"), 5]] : tier === 1 ? [[id("goblin"), 6], [id("ogre"), 1]] : [[id("goblin"), 6], [id("ogre"), 2]]),
  },
  {
    key: "bandit_camp", name: "Bandit Camp", weight: 16, radius: 10, pad: mc("coarse_dirt"),
    build(b) {
      b.palisade(9, mc("spruce_log"), 3);
      b.house(-8, -8, 7, 5, { wall: mc("spruce_planks"), roof: mc("dark_oak_planks"), door: "s" }); // the boss's hut
      b.tent(6, -8, mc("gray_wool"));
      b.tent(6, 2, mc("gray_wool"));
      b.stall(-8, 2, mc("red_wool")); // where the takings are shared out
      b.fill(-8, 0, 6, -6, 0, 7, mc("barrel"));
      b.campfire(0, 0);
      b.lamp(-3, 8);
      b.lamp(3, 8);
      b.chest(-6, 0, -6, [[mc("gold_ingot"), 1, 4], [mc("iron_ingot"), 1, 4], [id("red_potion"), 0, 2], [COIN, 4, 10]]);
      b.chest(-7, 1, 7, [[mc("bread"), 2, 5], [mc("arrow"), 4, 12], [COIN, 1, 4]]);
    },
    // From level 50 the camp is led by Zero of the Six Arms.
    garrison: (tier) => (tier === 2 ? [[id("zero"), 1], [id("bandit"), 5]] : [[id("bandit"), 4 + tier]]),
  },
  {
    key: "troll_den", name: "Troll Den", weight: 7, radius: 11, pad: mc("coarse_dirt"),
    build(b) {
      b.rubble(10, 10, [mc("bone_block"), mc("mossy_cobblestone")]);
      b.mound(0, -7, 4, mc("stone")); // the den itself, hollowed out
      b.fill(-2, 0, -9, 2, 2, -5, mc("air"));
      b.fill(-1, 0, -4, 1, 2, -3, mc("air"));
      for (const [x, z] of [[-8, -1], [8, -2], [-7, 6], [7, 6], [1, 9]]) b.mound(x, z, 2, b.pick([mc("cobblestone"), mc("mossy_cobblestone")]));
      b.campfire(0, 0);
      b.chest(0, 0, -9, [[mc("leather"), 2, 5], [mc("iron_ingot"), 1, 4], [id("troll_blood"), 0, 2], [COIN, 4, 10]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("war_troll"), 1]] : tier === 1 ? [[id("war_troll"), 2]] : [[id("war_troll"), 2], [id("ogre"), 2]]),
  },
  {
    key: "beastman_camp", name: "Beastman Warcamp", weight: 7, radius: 11, pad: mc("coarse_dirt"),
    build(b) {
      b.stakes(10, mc("acacia_fence"), 34, 2);
      b.pavilion(0, -9, mc("orange_wool"), mc("brown_carpet")); // the chieftain's tent
      b.tent(-6, -5, mc("brown_wool"));
      b.tent(6, -5, mc("brown_wool"));
      b.tent(-6, 2, mc("orange_wool"));
      b.tent(6, 2, mc("orange_wool"));
      b.campfire(0, 0);
      for (const x of [-3, 3]) { // trophy racks
        b.fill(x, 0, 7, x, 2, 7, mc("acacia_fence"));
        b.set(x, 3, 7, mc("bone_block"));
      }
      b.flag(5, 7, mc("orange_wool"), mc("acacia_fence"));
      b.chest(0, 0, -7, [[id("beast_hide"), 1, 4], [mc("cooked_beef"), 2, 5], [mc("leather"), 1, 3], [COIN, 3, 8], [id("basilisk_eye"), 0, 1]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("beastman"), 4]] : tier === 1 ? [[id("beastman"), 5], [id("gigant_basilisk"), 1]] : [[id("beastman"), 6], [id("gigant_basilisk"), 2]]),
  },
  {
    key: "bafolk_camp", name: "Bafolk Raid Camp", weight: 7, radius: 11, pad: mc("coarse_dirt"),
    build(b) {
      b.stakes(10, mc("spruce_fence"), 28, 2);
      b.tent(0, -9, mc("brown_wool"));
      b.tent(-7, -2, mc("brown_wool"));
      b.walls(5, 0, -2, 9, 0, 2, mc("oak_fence")); // a pen for stolen livestock
      b.set(5, 0, 0, mc("air"));
      b.fill(6, 0, -1, 8, 0, -1, mc("hay_block"));
      for (const [x, z] of [[-4, -8], [4, -8], [-6, 6], [6, 6]]) b.column(x, z, 2, mc("bone_block"));
      b.flag(-3, 8, mc("brown_wool"));
      b.campfire(0, 0);
      b.chest(0, 0, -7, [[id("beast_hide"), 1, 4], [mc("leather"), 1, 3], [mc("iron_ingot"), 0, 3], [COIN, 3, 8]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("bafolk"), 4]] : tier === 1 ? [[id("bafolk"), 5], [id("ogre"), 1]] : [[id("bafolk"), 6], [id("war_troll"), 1]]),
  },
  {
    key: "frost_giant_hold", name: "Frost Giant Hold", weight: 5, radius: 11, pad: mc("snow"), height: 14,
    build(b) {
      b.rubble(8, 8, [mc("snow"), mc("bone_block"), mc("packed_ice")]);
      b.roundWall(10, 3, mc("packed_ice"), 2);
      for (let i = 0; i < 8; i++) { // teeth of blue ice along the wall
        const a = (i / 8) * Math.PI * 2 + 0.4;
        b.spire(Math.round(Math.cos(a) * 10), Math.round(Math.sin(a) * 10), 5 + (i % 3), mc("packed_ice"), mc("blue_ice"));
      }
      b.pavilion(0, -9, mc("white_wool"), mc("white_carpet"));
      b.campfire(0, 0);
      b.fill(-8, 0, 2, -7, 1, 4, mc("spruce_log")); // a woodpile
      b.chest(7, 0, 3, [[mc("packed_ice"), 2, 6], [mc("iron_ingot"), 2, 5], [mc("gold_ingot"), 1, 3], [COIN, 5, 12], [id("data_crystal"), 1, 4]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("frost_giant"), 1]] : tier === 1 ? [[id("frost_giant"), 2]] : [[id("frost_giant"), 3], [id("war_troll"), 1]]),
  },
  {
    key: "wise_kings_den", name: "Den of the Wise King", weight: 4, radius: 9, pad: mc("podzol"),
    build(b) {
      b.rubble(6, 8, [mc("hay_block"), mc("moss_block")]);
      b.mound(0, -6, 3, mc("moss_block"));
      b.fill(-1, 0, -8, 1, 1, -5, mc("air")); // the burrow
      b.fill(-1, 0, -4, 1, 1, -3, mc("air"));
      b.fill(-1, 0, -8, 1, 0, -8, mc("hay_block"));
      for (const [x, z] of [[-6, -1], [6, -2], [-5, 6], [6, 6]]) b.tree(x, z, 5 + Math.floor(b.random() * 2));
      b.chest(0, 0, -7, [[mc("wheat_seeds"), 4, 10], [mc("golden_carrot"), 1, 3], [mc("apple"), 2, 5], [COIN, 2, 6]]);
    },
    garrison: () => [[id("hamsuke"), 1]],
  },
  // ============================================================ the Kingdom
  {
    key: "adventurer_camp", name: "Adventurers' Camp", weight: 14, radius: 9, pad: mc("grass_block"),
    build(b) {
      b.path(-1, -8, 1, 8);
      b.path(-8, -1, 8, 1);
      b.tent(-6, -7, mc("blue_wool"));
      b.tent(6, -7, mc("red_wool"));
      b.tent(-6, 4, mc("white_wool"));
      b.stall(5, 5, mc("yellow_wool")); // the quartermaster
      b.set(5, 0, 4, mc("crafting_table"));
      b.set(7, 0, 4, mc("anvil"));
      b.campfire(0, 0);
      b.fill(-1, 0, -8, 1, 1, -8, mc("bookshelf")); // the notice board
      for (const [x, z] of [[-2, -5], [2, -5], [-2, 5], [2, 5]]) b.lamp(x, z);
      b.chest(6, 0, 6, [[mc("bread"), 2, 5], [id("red_potion"), 1, 3], [mc("arrow"), 4, 12], [COIN, 2, 6]]);
    },
    garrison: (tier) => [[id("adventurer"), 3 + tier]],
  },
  {
    key: "kingdom_camp", name: "Kingdom Army Camp", weight: 13, radius: 11, pad: mc("grass_block"),
    build(b) {
      b.palisade(10, mc("oak_log"), 2);
      b.path(-1, -3, 1, 9);
      b.path(-9, -1, 9, 1);
      b.pavilion(0, -9, mc("blue_wool"), mc("red_carpet")); // the command tent
      b.tent(-7, -7, mc("white_wool"));
      b.tent(7, -7, mc("white_wool"));
      b.tent(-7, 2, mc("white_wool"));
      b.tower(-9, 7, 3, 6, mc("oak_log")); // a watchtower by the gate
      for (const z of [3, 5, 7]) { // the training yard
        b.set(8, 0, z, mc("hay_block"));
        b.set(8, 1, z, mc("target"));
      }
      b.campfire(4, 5);
      b.flag(-3, 9, mc("blue_wool"));
      b.flag(3, 9, mc("blue_wool"));
      for (const [x, z] of [[-2, 6], [2, 6]]) b.lamp(x, z);
      b.chest(2, 0, -7, [[mc("iron_ingot"), 2, 5], [mc("bread"), 3, 6], [mc("arrow"), 6, 16], [id("red_potion"), 1, 3], [COIN, 3, 8]]);
    },
    garrison: (tier) => [[id("soldier"), 4 + tier], [id("archer"), 2 + tier]],
  },
  {
    key: "carne_village", name: "Carne Village", weight: 7, radius: 12, pad: mc("grass_block"),
    build(b) {
      b.walls(-12, 0, -12, 12, 0, 12, mc("oak_fence")); // the village fence, with a gate on each road
      for (const [x, z] of [[0, -12], [0, 12], [-12, 0], [12, 0]]) b.fill(x - (z ? 1 : 0), 0, z - (x ? 1 : 0), x + (z ? 1 : 0), 0, z + (x ? 1 : 0), mc("air"));
      b.path(-1, -12, 1, 12);
      b.path(-12, -1, 12, 1);
      b.disc(0, -1, 0, 4, mc("grass_path"));
      b.house(-10, -10, 7, 6, { ...OAK, door: "s" });
      b.house(4, -10, 7, 6, { ...OAK, door: "s" });
      b.house(-10, 4, 6, 7, { ...OAK, door: "e" });
      b.house(5, 5, 6, 6, { wall: mc("cobblestone"), roof: mc("spruce_planks"), floor: mc("smooth_stone"), door: "w" }); // the smithy
      b.set(6, 0, 9, mc("furnace"));
      b.set(7, 0, 9, mc("anvil"));
      b.well(3, 7);
      b.fill(-9, 0, -3, -7, 0, -3, mc("hay_block"));
      b.set(-8, 1, -3, mc("hay_block"));
      b.set(7, 0, -3, mc("composter"));
      b.set(8, 0, -3, mc("barrel"));
      b.column(5, -2, 2, mc("oak_fence"), mc("bell"));
      for (const [x, z] of [[-2, -6], [2, -6], [-2, 6], [-6, 2], [6, 2]]) b.lamp(x, z);
      b.chest(-8, 0, -8, [[mc("bread"), 2, 6], [mc("wheat"), 3, 8], [id("red_potion"), 1, 3], [COIN, 2, 6]]);
      b.chest(8, 0, 7, [[mc("iron_ingot"), 1, 4], [mc("coal"), 2, 6], [COIN, 1, 4]]);
    },
    garrison: (tier) => [[id("enri"), 1], [id("nfirea"), 1], [id("guard"), 2 + tier]],
  },
  {
    key: "roadside_inn", name: "Roadside Inn", weight: 6, radius: 10, pad: mc("grass_block"), height: 13,
    build(b) {
      b.path(-1, -4, 1, 10);
      b.disc(0, -1, 0, 3, mc("grass_path"));
      b.house(-6, -9, 13, 5, { wall: mc("oak_planks"), roof: mc("dark_oak_planks"), height: 4, door: "s" }); // the inn
      b.fill(-4, 0, -8, -2, 0, -8, mc("barrel")); // the bar
      b.set(4, 0, -8, mc("smoker"));
      b.set(5, 0, -8, mc("cauldron"));
      b.fill(2, 0, -6, 3, 0, -6, mc("oak_fence")); // a table
      b.fill(2, 1, -6, 3, 1, -6, mc("oak_slab"));
      b.fill(-9, 2, 2, -5, 2, 6, mc("spruce_slab")); // the stable
      for (const [x, z] of [[-9, 2], [-5, 2], [-9, 6], [-5, 6]]) b.fill(x, 0, z, x, 1, z, mc("oak_fence"));
      b.fill(-8, 0, 5, -6, 0, 5, mc("hay_block"));
      b.stall(5, 4, mc("green_wool"));
      b.column(2, -3, 3, mc("oak_fence"), mc("lantern")); // the sign
      b.lamp(-3, 8);
      b.lamp(3, 8);
      b.chest(-5, 0, -6, [[mc("bread"), 3, 6], [mc("cooked_beef"), 2, 5], [id("red_potion"), 1, 3], [id("blue_potion"), 0, 2], [COIN, 3, 8]]);
    },
    garrison: (tier) => [[id("adventurer"), 3], [id("guard"), 1 + tier]],
  },
  // ============================================================= the Empire
  {
    key: "empire_outpost", name: "Empire Outpost", weight: 10, radius: 10, pad: mc("gravel"), height: 14,
    build(b) {
      b.fort(8, 3, mc("stone_bricks"), { towers: 3 });
      b.tower(-2, -9, 5, 9, mc("stone_bricks")); // the keep, astride the north wall
      b.fill(-1, 5, -5, 1, 6, -5, mc("red_wool")); // the Empire's colours
      b.fill(-1, 0, -8, -1, 8, -8, mc("scaffolding")); // the way up
      b.tent(-5, 4, mc("red_wool"));
      b.tent(5, 4, mc("red_wool"));
      b.path(-1, -4, 1, 8, mc("stone_bricks"));
      b.campfire(0, 0);
      b.set(-6, 0, -6, mc("anvil"));
      b.fill(5, 0, -6, 6, 0, -6, mc("barrel"));
      b.chest(0, 0, -8, [[mc("iron_ingot"), 2, 6], [mc("gold_ingot"), 1, 3], [mc("arrow"), 6, 16], [id("red_potion"), 1, 3], [COIN, 4, 10]]);
    },
    garrison: (tier) => [[id("imperial_knight"), 4 + tier]],
  },
  {
    key: "imperial_arena", name: "Imperial Arena", weight: 6, radius: 12, pad: mc("sand"), height: 13,
    build(b) {
      b.roundWall(11, 4, mc("stone_bricks"), 1);
      b.disc(0, 0, 0, 10, mc("stone_brick_slab"), true); // a tier of seats inside the wall
      b.fill(-1, 0, 9, 1, 0, 10, mc("air")); // the way in
      for (let i = 0; i < 8; i++) { // banners round the top
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const x = Math.round(Math.cos(a) * 11);
        const z = Math.round(Math.sin(a) * 11);
        b.fill(x, 4, z, x, 5, z, mc("red_wool"));
      }
      b.fill(-2, 0, -9, 2, 0, -8, mc("smooth_stone")); // the master's dais
      b.fill(-2, 0, -10, 2, 1, -10, mc("red_wool"));
      b.chest(6, 0, -6, [[mc("bread"), 2, 5], [id("red_potion"), 1, 3], [mc("iron_ingot"), 1, 4], [COIN, 3, 8]]);
    },
    garrison: (tier) => [[id("arena_master"), 1], [id("imperial_knight"), 2 + tier]],
  },
  {
    // The tower stands in the middle of its plot; whoever holds it is posted around it.
    key: "mage_tower", name: "Mage Tower", weight: 5, radius: 9, pad: mc("cobblestone"), height: 22, muster: 6,
    build(b) {
      b.disc(0, -1, 0, 8, mc("stone_bricks"), true);
      b.tower(-3, -3, 7, 16, mc("stone_bricks"), mc("glowstone"));
      for (const y of [5, 10]) b.fill(-2, y, -2, 2, y, 2, mc("spruce_planks")); // upper floors
      b.fill(-2, 0, -1, -2, 2, 2, mc("bookshelf"));
      b.fill(2, 0, -2, 2, 2, 2, mc("bookshelf"));
      b.set(0, 0, -2, mc("lectern"));
      b.set(1, 0, -2, mc("brewing_stand"));
      b.set(0, 0, 0, id("data_crystal_block")); // a mana font for whoever takes the tower
      b.fill(-2, 0, -2, -2, 15, -2, mc("scaffolding")); // the way up to the roof
      for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) b.column(x, z, 3, mc("stone_bricks"), mc("amethyst_block"));
      b.path(-1, 4, 1, 9, mc("stone_bricks"));
      b.chest(-1, 0, -2, [[id("data_crystal"), 4, 8], [id("blue_potion"), 1, 3], [id("scroll_of_explosion"), 0, 2], [id("scroll_of_time_stop"), 0, 1], [COIN, 4, 10]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("skeleton_mage"), 3]] : tier === 1 ? [[id("fluder"), 1], [id("skeleton_mage"), 2]] : [[id("fluder"), 1], [id("elder_lich"), 2]]),
  },
  // ====================================================== the Holy Kingdom
  {
    key: "paladin_fort", name: "Holy Kingdom Fort", weight: 6, radius: 11, pad: mc("cobblestone"), height: 14,
    build(b) {
      b.fort(9, 3, mc("stone_bricks"), { towers: 3 });
      b.house(-7, -8, 6, 5, { ...STONE, door: "s" }); // the barracks
      b.house(2, -8, 5, 5, { wall: mc("smooth_quartz"), roof: mc("quartz_block"), floor: mc("smooth_stone"), height: 4, door: "s" }); // the chapel
      b.set(4, 0, -7, mc("gold_block"));
      b.tent(-5, 4, mc("white_wool"));
      b.tent(5, 4, mc("white_wool"));
      b.flag(-3, 8, mc("white_wool"));
      b.flag(3, 8, mc("white_wool"));
      b.path(-1, -3, 1, 9, mc("stone_bricks"));
      b.campfire(0, 0);
      b.chest(-5, 0, -6, [[id("blessed_cloth"), 1, 3], [id("red_potion"), 1, 3], [mc("iron_ingot"), 2, 5], [COIN, 3, 8]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("paladin"), 4], [id("neia"), 1]] : [[id("paladin"), 4 + tier], [id("neia"), 1], [id("remedios"), 1]]),
  },
  // ============================================================== the elves
  {
    key: "elven_grove", name: "Elven Grove", weight: 6, radius: 11, pad: mc("moss_block"), height: 14,
    build(b) {
      for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8], [-9, 0], [9, 0]]) { // great trees with a lookout in each
        b.tree(x, z, 9);
        b.fill(x - 1, 4, z - 1, x + 1, 4, z + 1, mc("oak_planks"));
        b.set(x + 1, 5, z, mc("lantern"));
      }
      b.pavilion(0, -9, mc("green_wool"), mc("moss_carpet"));
      b.tent(-5, 4, mc("lime_wool"));
      b.tent(5, 4, mc("lime_wool"));
      b.disc(0, -1, 0, 3, mc("grass_path"));
      b.campfire(0, 0);
      for (const [x, z] of [[-2, 9], [2, 9]]) b.lamp(x, z);
      b.chest(0, 0, -7, [[mc("arrow"), 4, 12], [mc("golden_apple"), 0, 1], [mc("emerald"), 1, 3], [COIN, 2, 6]]);
    },
    garrison: (tier) => [[id("elf_ranger"), 4 + tier]],
  },
  // ========================================================== the lizardmen
  {
    key: "lizardman_village", name: "Lizardman Village", weight: 6, radius: 10, pad: mc("packed_mud"),
    build(b) {
      for (const [x, z] of [[-6, -6], [6, -6], [-7, 5], [7, 5]]) b.roundHut(x, z); // huts of mud under thatch
      b.disc(0, -1, 0, 4, mc("mud"));
      b.campfire(0, 0);
      for (const x of [-2, 2]) b.fill(x, 0, 8, x, 1, 8, mc("mangrove_log")); // a rack of drying fish
      b.fill(-2, 2, 8, 2, 2, 8, mc("oak_fence"));
      b.column(0, -8, 4, mc("mangrove_log"), mc("lantern")); // the tribe's totem
      b.chest(-6, 0, -6, [[mc("cod"), 3, 8], [mc("emerald"), 0, 2], [mc("iron_ingot"), 0, 3], [COIN, 2, 6]]);
    },
    garrison: (tier) => [[id("lizardman"), 5 + tier]],
  },
  // ============================================================= the dwarves
  {
    key: "dwarven_forge", name: "Dwarven Forge", weight: 8, radius: 10, pad: mc("smooth_stone"), height: 13,
    build(b) {
      b.house(-5, -9, 11, 5, { wall: mc("deepslate_bricks"), roof: mc("stone_bricks"), floor: mc("smooth_stone"), height: 4, door: "s" });
      b.fill(-4, 0, -8, -2, 0, -8, mc("furnace"));
      b.set(-1, 0, -8, mc("blast_furnace"));
      b.set(2, 0, -8, mc("anvil"));
      b.set(4, 0, -8, mc("smithing_table"));
      b.set(4, 0, -6, mc("grindstone"));
      b.set(-4, 0, -6, mc("lantern"));
      b.fill(3, 5, -8, 4, 8, -7, mc("stone_bricks")); // the chimney, smoking
      b.fill(3, 9, -8, 4, 9, -7, mc("campfire"));
      b.fill(-8, 0, 3, -7, 0, 4, mc("raw_iron_block")); // ore waiting for the furnace
      b.set(-8, 1, 3, mc("coal_block"));
      b.fill(7, 0, 3, 8, 0, 3, mc("coal_block"));
      b.set(7, 0, 4, mc("raw_gold_block"));
      b.path(-1, -4, 1, 9, mc("stone_bricks"));
      b.lamp(-3, 5, mc("cobblestone_wall"));
      b.lamp(3, 5, mc("cobblestone_wall"));
      b.chest(-4, 0, -7, [[mc("iron_ingot"), 3, 8], [mc("coal"), 4, 10], [id("adamantite_ingot"), 0, 2], [mc("diamond"), 0, 1], [COIN, 3, 8]]);
    },
    garrison: () => [[id("dwarf"), 1]],
  },
  {
    key: "besieged_mine", name: "Besieged Mine", weight: 5, radius: 11, pad: mc("gravel"),
    build(b) {
      b.rubble(8, 10, [mc("cobblestone"), mc("gravel"), mc("deepslate")]);
      b.mound(0, -7, 4, mc("stone")); // the hillside the mine runs into
      b.fill(-1, 0, -10, 1, 2, -3, mc("air"));
      for (const z of [-3, -5, -7]) { // pit props
        b.fill(-2, 0, z, -2, 2, z, mc("spruce_log"));
        b.fill(2, 0, z, 2, 2, z, mc("spruce_log"));
        b.fill(-2, 3, z, 2, 3, z, mc("spruce_planks"));
      }
      b.fill(-8, 0, 2, -6, 1, 3, mc("deepslate")); // spoil heaps
      b.fill(6, 0, 2, 7, 0, 4, mc("raw_iron_block"));
      b.set(7, 1, 3, mc("coal_block"));
      b.tent(-6, 6, mc("brown_wool")); // the miners' camp, overrun
      b.tent(6, 6, mc("brown_wool"));
      b.campfire(0, 0);
      b.chest(0, 0, -10, [[mc("raw_iron"), 3, 8], [mc("coal"), 4, 10], [mc("diamond"), 0, 2], [id("adamantite_ingot"), 0, 1], [COIN, 3, 8]]);
    },
    garrison: (tier) => [[id("quagoa"), 4 + tier * 2]],
  },
  // ================================================================ Nazarick
  {
    key: "nazarick_outpost", name: "Nazarick Outpost", weight: 11, radius: 10, pad: id("nazarick_tiles"), height: 13,
    build(b) {
      b.walls(-9, 0, -9, 9, 0, 9, id("nazarick_bricks")); // a low wall round the court
      b.fill(-1, 0, 9, 1, 0, 9, mc("air"));
      b.path(-1, -4, 1, 9, id("gilded_nazarick_bricks"));
      b.fill(-3, 0, -8, 3, 0, -5, id("gilded_nazarick_bricks")); // the altar, on two steps
      b.fill(-2, 1, -8, 2, 1, -6, id("gilded_nazarick_bricks"));
      b.set(0, 2, -7, id("nazarick_lamp"));
      for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7], [-7, 0], [7, 0]]) b.column(x, z, 5, id("nazarick_pillar"), id("nazarick_lamp"));
      for (const x of [-4, 4]) b.set(x, 0, 6, mc("soul_campfire"));
      b.chest(0, 2, -6, [[id("data_crystal"), 2, 6], [id("soul_fragment"), 0, 2], [mc("bone"), 3, 8], [COIN, 4, 10]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("old_guarder"), 4], [id("skeleton_mage"), 1]]
        : tier === 1
          ? [[id("death_knight"), 1], [id("old_guarder"), 3], [id("elder_lich"), 1]]
          : [[id("death_knight"), 2], [id("elder_lich"), 2], [id("soul_eater"), 1]],
  },
  {
    key: "great_tomb", name: "Mausoleum of Nazarick", weight: 5, radius: 12, pad: id("nazarick_tiles"), height: 16,
    build(b) {
      b.fort(11, 3, id("nazarick_bricks"), { gate: 2 });
      b.house(-5, -10, 11, 6, { wall: id("nazarick_bricks"), roof: id("gilded_nazarick_bricks"), floor: id("nazarick_tiles"), height: 5, door: "s", windows: false });
      for (const x of [-4, -2, 2, 4]) b.column(x, -3, 5, id("nazarick_pillar")); // the portico
      b.fill(-5, 5, -3, 5, 5, -3, id("gilded_nazarick_bricks"));
      b.set(0, 0, -8, id("data_crystal_block"));
      for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) b.column(x, z, 4, id("nazarick_pillar"), id("nazarick_lamp"));
      b.fill(-11, 0, -1, -11, 1, 1, id("cracked_nazarick_bricks"));
      b.path(-2, -2, 2, 11, id("gilded_nazarick_bricks"));
      for (const x of [-6, 6]) b.set(x, 0, 6, mc("soul_campfire"));
      b.chest(0, 0, -9, [[id("data_crystal"), 4, 8], [COIN, 8, 16], [id("soul_fragment"), 1, 3], [id("guardian_crest"), 0, 1], [id("scroll_of_time_stop"), 0, 1], [id("tomb_key"), 1, 1]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("old_guarder"), 4], [id("skeleton_mage"), 2], [id("elder_lich"), 1]]
        : tier === 1
          ? [[id("lupusregina"), 1], [id("death_knight"), 2], [id("elder_lich"), 2]]
          : [[id("shalltear"), 1], [id("vampire_bride"), 2], [id("death_knight"), 2]],
  },
  // =============================================================== the undead
  {
    key: "graveyard", name: "Katze Graveyard", weight: 8, radius: 10, pad: mc("coarse_dirt"),
    build(b) {
      b.rubble(6, 8, [mc("bone_block"), mc("mossy_cobblestone")]);
      b.walls(-9, 0, -9, 9, 0, 9, mc("cobblestone_wall"));
      b.fill(-1, 0, 9, 1, 0, 9, mc("air"));
      b.path(-1, -4, 1, 9, mc("gravel"));
      for (const x of [-7, -4, 4, 7]) for (const z of [-5, -1, 3, 7]) b.grave(x, z);
      b.house(-2, -9, 5, 5, { wall: mc("mossy_stone_bricks"), roof: mc("stone_bricks"), floor: mc("smooth_stone"), door: "s", windows: false }); // a mausoleum
      b.fill(-7, 0, -8, -7, 4, -8, mc("dark_oak_log")); // a dead tree
      b.set(-8, 4, -8, mc("dark_oak_log"));
      b.set(-6, 3, -8, mc("dark_oak_log"));
      for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) b.column(x, z, 2, mc("cobblestone_wall"), mc("soul_lantern"));
      b.chest(0, 0, -7, [[mc("bone"), 3, 8], [id("soul_fragment"), 0, 3], [id("data_crystal"), 1, 4], [COIN, 3, 8], [id("vampire_fang"), 0, 2]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("old_guarder"), 4], [id("skeleton_mage"), 1]]
        : tier === 1
          ? [[id("old_guarder"), 3], [id("elder_lich"), 1], [id("vampire_bride"), 2]]
          : [[id("death_knight"), 2], [id("vampire_bride"), 2], [id("elder_lich"), 2]],
  },
  {
    key: "ruined_keep", name: "Ruined Keep", weight: 6, radius: 11, pad: mc("coarse_dirt"), height: 14,
    build(b) {
      const stones = [mc("stone_bricks"), mc("mossy_stone_bricks"), mc("cracked_stone_bricks"), mc("cobblestone")];
      b.rubble(14, 9, stones);
      b.ruin(-10, -10, 10, -10, 4, stones); // what is left of the curtain wall
      b.ruin(-10, 10, -3, 10, 3, stones);
      b.ruin(3, 10, 10, 10, 3, stones);
      b.ruin(-10, -9, -10, 9, 4, stones);
      b.ruin(10, -9, 10, 9, 4, stones);
      b.tower(-10, -10, 4, 8, mc("mossy_stone_bricks"), mc("soul_lantern")); // one tower still stands
      b.fill(-3, 0, -8, 3, 3, -6, mc("air"));
      b.walls(-4, 0, -9, 4, 3, -5, mc("cracked_stone_bricks")); // the roofless hall
      b.fill(0, 0, -5, 0, 1, -5, mc("air"));
      b.fill(-3, 4, -9, 0, 4, -7, mc("stone_brick_slab"));
      for (const [x, z] of [[-3, -8], [3, -8], [7, 7], [-7, 6]]) b.set(x, 0, z, mc("web"));
      b.set(0, 0, 0, mc("soul_campfire"));
      b.chest(0, 0, -8, [[mc("gold_ingot"), 2, 5], [id("data_crystal"), 2, 5], [id("soul_fragment"), 0, 3], [COIN, 5, 12], [id("tome_create_undead"), 0, 1]]);
      b.chest(-9, 0, -9, [[mc("iron_ingot"), 2, 5], [mc("arrow"), 4, 12], [COIN, 2, 6]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("old_guarder"), 5]]
        : tier === 1
          ? [[id("vampire_bride"), 3], [id("old_guarder"), 3]]
          : [[id("death_knight"), 2], [id("vampire_bride"), 3], [id("soul_eater"), 1]],
  },
  {
    key: "zurrernorn_shrine", name: "Zurrernorn Shrine", weight: 6, radius: 12, pad: mc("polished_blackstone"), height: 16,
    build(b) {
      b.disc(0, -1, 0, 8, mc("crying_obsidian"), true); // the ritual circle
      b.fill(-2, 0, -11, 2, 0, -8, mc("blackstone")); // the altar, at the north end
      b.fill(-1, 1, -11, 1, 1, -9, mc("bone_block"));
      b.set(0, 2, -10, mc("soul_lantern"));
      for (let i = 0; i < 8; i++) { // a ring of obsidian fangs round an open floor
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        b.spire(Math.round(Math.cos(a) * 10), Math.round(Math.sin(a) * 10), 6 + (i % 2) * 2, mc("obsidian"), mc("soul_lantern"));
      }
      b.flag(-6, -10, mc("purple_wool"));
      b.flag(5, -10, mc("purple_wool"));
      for (const x of [-6, 6]) b.set(x, 0, 6, mc("soul_campfire"));
      b.chest(0, 1, -8, [[mc("bone"), 3, 8], [id("soul_fragment"), 1, 4], [id("data_crystal"), 2, 5], [COIN, 4, 10], [id("tome_create_undead"), 0, 1]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("skeleton_mage"), 3], [id("old_guarder"), 2]]
        : tier === 1
          ? [[id("khajiit"), 1], [id("old_guarder"), 3], [id("skeleton_mage"), 1]]
          : [[id("skeletal_dragon"), 1], [id("khajiit"), 1], [id("old_guarder"), 2]],
  },
  // =========================================================== the Theocracy
  {
    key: "theocracy_camp", name: "Sunlight Scripture Camp", weight: 7, radius: 10, pad: mc("grass_block"),
    build(b) {
      b.path(-1, -3, 1, 9);
      b.pavilion(0, -9, mc("white_wool"), mc("white_carpet")); // the captain's tent
      for (const x of [-6, 6]) for (const z of [-5, 2]) b.tent(x, z, mc("white_wool"));
      b.fill(-1, 0, 7, 1, 0, 8, mc("smooth_stone")); // a field altar
      b.set(0, 1, 7, mc("glowstone"));
      for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) b.flag(x, z, mc("yellow_wool"));
      b.campfire(0, 0);
      b.chest(2, 0, -7, [[id("blessed_cloth"), 1, 4], [mc("gold_ingot"), 1, 4], [id("red_potion"), 1, 3], [COIN, 3, 8], [id("scroll_of_heavy_recover"), 0, 1]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("theocracy_priest"), 3]] : [[id("theocracy_priest"), 3], [id("archangel_flame"), 1 + tier], [id("nigun"), 1]]),
  },
  {
    key: "angel_sanctum", name: "Angel Sanctum", weight: 5, radius: 12, pad: mc("smooth_quartz"), height: 16,
    build(b) {
      for (const x of [-8, 8]) for (const z of [-8, -4, 0, 4, 8]) b.column(x, z, 6, mc("quartz_pillar")); // a colonnade
      b.fill(-8, 6, -8, -8, 6, 8, mc("smooth_quartz"));
      b.fill(8, 6, -8, 8, 6, 8, mc("smooth_quartz"));
      for (const x of [-8, 8]) for (const z of [-6, -2, 2, 6]) b.set(x, 7, z, mc("glowstone"));
      b.fill(-3, 0, -11, 3, 0, -8, mc("quartz_block")); // the high altar
      b.fill(-2, 1, -11, 2, 1, -9, mc("chiseled_quartz_block"));
      b.set(0, 2, -10, mc("sea_lantern"));
      b.fill(-1, 2, -11, 1, 7, -11, mc("yellow_stained_glass")); // a window of gold behind it
      b.disc(0, -1, 0, 6, mc("quartz_block"), true);
      b.disc(0, -1, 0, 2, mc("glowstone"), true);
      b.path(-1, 7, 1, 12, mc("quartz_block"));
      for (const [x, z] of [[-4, 10], [4, 10]]) b.flag(x, z, mc("yellow_wool"));
      b.chest(0, 1, -8, [[id("angel_feather"), 2, 5], [id("blessed_cloth"), 2, 5], [mc("gold_ingot"), 2, 6], [COIN, 5, 12], [id("sealing_crystal"), 0, 1]]);
    },
    garrison: (tier) =>
      tier === 0 ? [[id("archangel_flame"), 3]] : tier === 1 ? [[id("archangel_flame"), 4], [id("theocracy_priest"), 2]] : [[id("dominion_authority"), 1], [id("archangel_flame"), 3]],
  },
  // ================================================================== demons
  {
    key: "demon_gate", name: "Demon Gate", weight: 7, radius: 10, pad: mc("netherrack"), height: 14,
    build(b) {
      b.rubble(8, 8, [mc("bone_block"), mc("basalt"), mc("blackstone")]);
      b.disc(0, -1, 0, 7, mc("red_nether_brick"), true); // the ritual rings
      b.disc(0, -1, 0, 4, mc("nether_brick"), true);
      b.fill(-3, 0, -9, 3, 7, -9, mc("obsidian")); // a dead gate, eight high
      b.fill(-2, 1, -9, 2, 6, -9, mc("air"));
      b.fill(-3, 7, -9, 3, 7, -9, mc("crying_obsidian"));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        b.spire(Math.round(Math.cos(a) * 9), Math.round(Math.sin(a) * 9), 4 + (i % 2) * 2, mc("blackstone"), mc("soul_lantern"));
      }
      for (const x of [-5, 5]) b.set(x, 0, -6, mc("soul_campfire"));
      b.chest(0, 1, -9, [[mc("blaze_powder"), 2, 6], [mc("gold_ingot"), 1, 4], [id("data_crystal"), 2, 5], [COIN, 4, 10], [id("demon_heart"), 0, 1]]);
    },
    garrison: (tier) =>
      tier === 0 ? [[id("shadow_demon"), 3]] : tier === 1 ? [[id("hellhound"), 3], [id("shadow_demon"), 2]] : [[id("evil_lord_wrath"), 1], [id("hellhound"), 2]],
  },
  // ================================================================= dragons
  {
    key: "dragon_hoard", name: "Dragon's Hoard", weight: 4, radius: 13, pad: mc("packed_ice"), height: 18,
    build(b) {
      b.rubble(10, 11, [mc("bone_block"), mc("blue_ice"), mc("snow")]);
      for (let i = 0; i < 10; i++) { // spires of ice round the rim; the middle is left clear for the dragon
        const a = (i / 10) * Math.PI * 2 + 0.2;
        b.spire(Math.round(Math.cos(a) * 12), Math.round(Math.sin(a) * 12), 6 + (i % 4) * 2, mc("packed_ice"), mc("blue_ice"));
      }
      b.fill(-3, 0, -12, 3, 0, -9, mc("gold_block")); // the hoard, heaped against the north side
      b.fill(-2, 1, -12, 2, 1, -10, mc("gold_block"));
      b.fill(-1, 2, -12, 1, 2, -11, mc("raw_gold_block"));
      b.set(-4, 0, -10, mc("emerald_block"));
      b.set(4, 0, -11, mc("lapis_block"));
      b.chest(0, 2, -10, [[mc("diamond"), 2, 5], [mc("gold_ingot"), 4, 10], [mc("emerald"), 2, 6], [id("data_crystal"), 4, 8], [COIN, 10, 20], [id("guardian_crest"), 0, 1]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("skeleton_mage"), 4]] : [[id("frost_dragon"), 1]]),
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
  const stored = world.getDynamicProperty(`${STORE}${key}`);
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
    `${STORE}${key}`,
    camp ? `${camp.type.key}|${camp.x}|${camp.y}|${camp.z}|${camp.found ? 1 : 0}` : "-"
  );
}

// ----------------------------------------------------------------- building

/**
 * Height of the ground at a column: the y of the highest ground block, null when the column
 * is under water or has no ground near the surface, or undefined when it cannot be read yet
 * (the chunk is not loaded and ticking).
 * @param {Dimension} dimension @param {number} x @param {number} z
 * @returns {number | null | undefined}
 */
function groundAt(dimension, x, z) {
  try {
    const top = dimension.getTopmostBlock({ x, z });
    if (!top) return undefined;
    let y = top.location.y;
    for (let i = 0; i < 40; i++, y--) { // down through tree tops, plants and snow cover
      const block = dimension.getBlock({ x, y, z });
      if (!block) return undefined;
      if (block.isLiquid) return null;
      if (isGround(block.typeId)) return y;
    }
    return null;
  } catch {
    return undefined; // the game raises an error for chunks that are not loaded and ticking
  }
}

/**
 * Looks at the ground under a would-be site. Returns the y of its floor, null when the place
 * is unsuitable (water or too steep), or undefined when the area cannot be read yet.
 * @param {Dimension} dimension @param {number} x @param {number} z @param {number} r
 * @returns {number | null | undefined}
 */
function survey(dimension, x, z, r) {
  const heights = [];
  for (const [dx, dz] of [[0, 0], [-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]]) {
    const y = groundAt(dimension, x + dx, z + dz);
    if (y === undefined) return undefined;
    if (y === null) return null;
    heights.push(y);
  }
  if (Math.max(...heights) - Math.min(...heights) > MAX_SLOPE) return null;
  heights.sort((a, b) => a - b);
  return heights[4] + 1; // the pad sits on the median height, so as little as possible is dug or filled
}

/**
 * Tries to build the site at its planned spot or, failing that, a little to one side. Returns
 * the camp, null when nowhere around is suitable, or undefined when the area is not loaded
 * yet (try again later).
 * @param {Dimension} dimension @param {{ x: number, z: number, type: SiteType }} site
 * @returns {Camp | null | undefined}
 */
export function buildSite(dimension, site) {
  const r = site.type.radius;
  let waiting = false;
  for (const [ox, oz] of SHIFTS) {
    const x = site.x + ox;
    const z = site.z + oz;
    const y = survey(dimension, x, z, r);
    if (y === undefined) {
      if (ox === 0 && oz === 0) return undefined; // the planned spot comes first: wait until it can be read
      waiting = true;
      continue;
    }
    if (y === null) continue;

    if (!raise(dimension, { x, y, z }, site.type)) return undefined; // part of the footprint is not ticking yet: laid again later
    return { x, y, z, type: site.type, found: false };
  }
  return waiting ? undefined : null;
}

/**
 * Lays a site at a known spot: foundation, pad, cleared space, the site itself, then its chests are
 * stocked. Returns false when part of it is not loaded yet (the whole site is laid again later).
 * @param {Dimension} dimension @param {Vector3} at @param {SiteType} type
 */
export function raise(dimension, at, type) {
  const r = type.radius;
  const b = new Builder(dimension, at);
  try {
    b.fill(-r, -6, -r, r, -2, r, mc("dirt")); // foundation under the pad
    b.fill(-r, -1, -r, r, -1, r, type.pad);
    b.fill(-r, 0, -r, r, (type.height ?? CLEAR_HEIGHT) - 1, r, mc("air"));
    type.build(b);
  } catch (error) {
    if (!isUnloaded(error)) console.warn(`[Overlord] could not build ${type.name}: ${error}`);
    return false;
  }
  stockChests(dimension, b.chests);
  return true;
}

/**
 * Fills chests a moment after they were placed, once the chest blocks exist.
 * @param {Dimension} dimension @param {{ at: Vector3, loot: Loot[] }[]} chests
 */
export function stockChests(dimension, chests) {
  system.runTimeout(() => {
    for (const chest of chests) {
      try {
        const container = dimension.getBlock(chest.at)?.getComponent("minecraft:inventory")?.container;
        if (!container) continue;
        for (const [item, min, max] of chest.loot) {
          const amount = min + Math.floor(Math.random() * (max - min + 1));
          if (amount > 0) container.addItem(new ItemStack(item, amount));
        }
      } catch (error) {
        console.warn(`[Overlord] could not stock a chest: ${error}`);
      }
    }
  }, 2);
}

/** The built site whose region holds a spot, if any. @param {Vector3} at */
export function campAt(at) {
  return campIn(Math.floor(at.x / REGION), Math.floor(at.z / REGION)) ?? undefined;
}

/**
 * What an earlier version left in a region: undefined when it never looked there, null when it
 * found nothing to build, or the site it built.
 * @param {number} rx @param {number} rz
 * @returns {Camp | null | undefined}
 */
function oldCampIn(rx, rz) {
  const stored = world.getDynamicProperty(`${OLD_STORE}${rx},${rz}`);
  if (typeof stored !== "string") return undefined;
  const parts = stored.split("|");
  const type = SITES.find((s) => s.key === parts[0]);
  if (!type || parts.length < 4) return null;
  return { x: Number(parts[1]), y: Number(parts[2]), z: Number(parts[3]), type, found: parts[4] === "1" };
}

// ----------------------------------------------------------------- garrison

/** Camp key -> tick of the last time its garrison was posted. */
const manned = new Map();
/** Camp key -> how many defenders were posted, their tier, and how many have been slain since. */
/** @type {Map<string, { size: number, tier: number, slain: number }>} */
const sieges = new Map();
/** Sites whose garrison is hostile: clearing them out is rewarded. */
const HOSTILE_SITES = new Set(["goblin_camp", "bandit_camp", "nazarick_outpost", "troll_den", "dragon_hoard", "theocracy_camp", "demon_gate",
  "graveyard", "great_tomb", "zurrernorn_shrine", "beastman_camp", "bafolk_camp", "frost_giant_hold", "mage_tower", "besieged_mine",
  "ruined_keep", "angel_sanctum"]);
/** Sites a player can travel back to once discovered. */
const FRIENDLY_SITES = new Set(["adventurer_camp", "kingdom_camp", "empire_outpost", "dwarven_forge", "lizardman_village", "carne_village", "imperial_arena", "paladin_fort",
  "elven_grove", "roadside_inn"]);
export const TRAVEL_COST = 5;

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
      const reach = camp.type.muster ?? MUSTER;
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
  const rx0 = Math.floor(player.location.x / REGION);
  const rz0 = Math.floor(player.location.z / REGION);
  for (let rx = rx0 - 1; rx <= rx0 + 1; rx++) {
    for (let rz = rz0 - 1; rz <= rz0 + 1; rz++) {
      try {
        visit(player, rx, rz);
      } catch (error) {
        // One region in trouble must never keep the others from being looked at.
        if (!isUnloaded(error)) console.warn(`[Overlord] site check failed for region ${rx},${rz}: ${error}`);
      }
    }
  }
}

/**
 * One region as seen by one player: builds its site if it came into range, discovers it and posts its garrison.
 * @param {Player} player @param {number} rx @param {number} rz
 */
function visit(player, rx, rz) {
  const px = player.location.x;
  const pz = player.location.z;
  let camp = campIn(rx, rz);
  if (camp === undefined) {
    // A region an earlier version already dealt with keeps what it had: an empty one stays empty (so
    // nothing new is dropped onto ground players may have built on) and a site is raised again, on
    // the same spot, in its new form.
    const old = oldCampIn(rx, rz);
    if (old === null) {
      remember(rx, rz, null);
      return;
    }
    if (old) {
      const distance = Math.hypot(old.x - px, old.z - pz);
      if (distance > BUILD_FAR || distance < old.type.radius + KEEP_CLEAR) return;
      if (!raise(player.dimension, old, old.type)) return;
      remember(rx, rz, old);
      camp = old;
    }
  }
  if (camp === undefined) {
    const site = siteOf(rx, rz);
    if (!site) {
      remember(rx, rz, null);
      return;
    }
    const spawn = world.getDefaultSpawnLocation();
    if (Math.hypot(site.x - spawn.x, site.z - spawn.z) < SPAWN_CLEARANCE) {
      remember(rx, rz, null);
      return;
    }
    const distance = Math.hypot(site.x - px, site.z - pz);
    if (distance > BUILD_FAR) return; // too far to be loaded
    if (distance < site.type.radius + KEEP_CLEAR) return; // standing on the spot: wait until they step away
    const built = buildSite(player.dimension, site);
    if (built === undefined) return; // not loaded yet: tried again in a moment
    remember(rx, rz, built);
    camp = built;
  }
  if (!camp) return;
  if (Math.hypot(camp.x - px, camp.z - pz) > WAKE_RANGE) return;
  const key = `${rx},${rz}`;
  if (!camp.found) {
    camp.found = true;
    remember(rx, rz, camp);
    notify(player, `§6Discovered: §f${camp.type.name}`);
    grantXp(player, 80, "discovery");
    const finder = skills.value(profileOf(player), "treasure_hunter"); // Treasure Hunter
    if (finder > 0) giveItem(player, id("yggdrasil_gold_coin"), finder);
    questEvent(player, "site");
  }
  // Everyone who visits a friendly camp can travel back to it later.
  if (FRIENDLY_SITES.has(camp.type.key)) {
    const known = profileOf(player).sites;
    const entry = `${camp.type.key}|${camp.x}|${camp.y}|${camp.z}`;
    if (!known.includes(entry)) {
      known.push(entry);
      if (known.length > 24) known.shift();
      touch(player);
    }
  }
  const last = manned.get(key);
  if (last !== undefined && system.currentTick - last < REFILL_TICKS) return;
  manned.set(key, system.currentTick);
  const tier = tierFor(profileOf(player).level);
  garrison(player.dimension, camp, tier);
  sieges.set(key, { size: camp.type.garrison(tier).reduce((n, [, count]) => n + count, 0), tier, slain: 0 });
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
        const xp = 150 * (siege.tier + 1);
        for (const hero of dead.dimension.getPlayers({ location: { x: camp.x, y: camp.y, z: camp.z }, maxDistance: 48 })) {
          const coins = skills.bounty(profileOf(hero), 8 * (siege.tier + 1)); // Bounty Hunter
          giveItem(hero, id("yggdrasil_gold_coin"), coins);
          addRep(hero, "kingdom", 5);
          addRep(hero, "adventurers", 5);
          hero.sendMessage(`§6[Overlord] §f${camp.type.name} cleared! Reward: §6${coins} Gold Coins§f, §a${xp} XP§f. The Kingdom and the adventurers think better of you.`);
          grantXp(hero, xp, "camp cleared");
          questEvent(hero, "camp");
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
}, 2 * TICKS);

// ------------------------------------------------------------------- travel

/**
 * Friendly sites the player has discovered and may travel to.
 * @param {Player} player
 */
export function waypoints(player) {
  return profileOf(player)
    .sites.map((entry) => {
      const [key, x, y, z] = entry.split("|");
      const type = SITES.find((s) => s.key === key);
      return type && FRIENDLY_SITES.has(key) ? { name: type.name, x: Number(x), y: Number(y), z: Number(z) } : undefined;
    })
    .filter((w) => w !== undefined);
}

/**
 * Travels to a discovered friendly site for a few Gold Coins. Returns a message describing the outcome.
 * @param {Player} player @param {{ name: string, x: number, y: number, z: number }} to
 */
export function travel(player, to) {
  if (player.dimension.id !== "minecraft:overworld") return "§7You can only travel within the overworld";
  const fare = skills.haggle(profileOf(player), TRAVEL_COST); // Haggler
  if (countItem(player, id("yggdrasil_gold_coin")) < fare) return `§7Travel costs ${fare} Gold Coins`;
  takeItem(player, id("yggdrasil_gold_coin"), fare);
  player.teleport({ x: to.x + 0.5, y: to.y, z: to.z - 0.5 });
  return `§dYou arrive at the ${to.name}`;
}

registerMenu(
  (player) => `Travel (${waypoints(player).length})`,
  (player) => {
    const places = waypoints(player);
    const lead = rumour(player);
    const form = new ActionFormData()
      .title("Travel")
      .body(
        (lead ? `${lead.replace("Word is there's", "Nearest site nobody has found yet:")}\n\n` : "") +
          (places.length > 0
          ? `Return to a friendly camp you have discovered for ${skills.haggle(profileOf(player), TRAVEL_COST)} Gold Coins. Your party follows.`
          : "You have not discovered any friendly camps yet. Adventurers' camps, Kingdom and Empire army posts, Dwarven Forges, Lizardman villages, Carne Village, Roadside Inns, Imperial Arenas, Holy Kingdom Forts and Elven Groves can be travelled to once found.")
      );
    for (const place of places) {
      const distance = Math.round(Math.hypot(place.x - player.location.x, place.z - player.location.z));
      form.button(`${place.name}\n${distance} blocks away`);
    }
    form.button("Close");
    form
      .show(player)
      .then((response) => {
        if (response.canceled || response.selection === undefined || !player.isValid) return;
        const place = places[response.selection];
        if (place) notify(player, travel(player, place));
      })
      .catch(() => {});
  }
);
