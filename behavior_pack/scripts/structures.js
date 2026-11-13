// Overlord: Tomb of Nazarick - faction camps and outposts.
// The overworld is divided into regions; some regions hold one site (a camp, outpost
// or village of a faction), chosen deterministically from a per-world salt. A site is
// built from blocks the first time a player explores near it, and its garrison is
// posted - and later replenished - when a player comes close.
import { world, system, BlockVolume, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { addRep, creditedPlayer, giveItem, grantXp, notify, profileOf, questEvent, registerMenu, touch } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";

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
    // From level 50 the camp is led by Zero of the Six Arms.
    garrison: (tier) => (tier === 2 ? [[id("zero"), 1], [id("bandit"), 5]] : [[id("bandit"), 4 + tier]]),
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
  {
    key: "theocracy_camp", name: "Sunlight Scripture Camp", weight: 8, radius: 7, pad: mc("grass_path"),
    build(b) {
      b.tent(-4, 1, mc("white_wool"));
      b.tent(4, 1, mc("white_wool"));
      b.fill(-1, 0, -5, 1, 0, -5, mc("smooth_stone")); // field altar
      b.set(0, 1, -5, mc("lantern"));
      b.flag(-6, -6, mc("yellow_wool"));
      b.flag(6, -6, mc("yellow_wool"));
      b.campfire(0, -1);
      b.chest(0, 0, 5, [[id("blessed_cloth"), 1, 4], [mc("gold_ingot"), 1, 4], [id("red_potion"), 1, 3], [id("yggdrasil_gold_coin"), 3, 8], [id("scroll_of_heavy_recover"), 0, 1]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("theocracy_priest"), 3]]
        : [[id("theocracy_priest"), 3], [id("archangel_flame"), 1 + tier], [id("nigun"), 1]],
  },
  {
    key: "demon_gate", name: "Demon Gate", weight: 7, radius: 7, pad: mc("netherrack"),
    build(b) {
      b.fill(-2, 0, 0, 2, 0, 0, mc("obsidian")); // a dead gate frame
      b.fill(-2, 1, 0, -2, 4, 0, mc("obsidian"));
      b.fill(2, 1, 0, 2, 4, 0, mc("obsidian"));
      b.fill(-2, 5, 0, 2, 5, 0, mc("crying_obsidian"));
      for (let i = 0; i < 8; i++) { // ritual ring
        const a = (i / 8) * Math.PI * 2;
        b.set(Math.round(Math.cos(a) * 6), 0, Math.round(Math.sin(a) * 6), i % 2 ? mc("magma") : mc("obsidian"));
      }
      b.set(-4, 0, -3, mc("soul_campfire"));
      b.set(4, 0, -3, mc("soul_campfire"));
      b.set(3, 0, 3, mc("bone_block"));
      b.chest(0, 0, -4, [[mc("blaze_powder"), 2, 6], [mc("gold_ingot"), 1, 4], [id("data_crystal"), 2, 5], [id("yggdrasil_gold_coin"), 4, 10], [id("demon_heart"), 0, 1]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("shadow_demon"), 3]]
        : tier === 1
          ? [[id("hellhound"), 3], [id("shadow_demon"), 2]]
          : [[id("evil_lord_wrath"), 1], [id("hellhound"), 2]],
  },
  {
    key: "graveyard", name: "Katze Graveyard", weight: 8, radius: 7, pad: mc("coarse_dirt"),
    build(b) {
      for (const x of [-5, -2, 1, 4]) { // rows of graves
        for (const z of [-4, 0, 4]) {
          b.set(x, 0, z, mc("mossy_cobblestone"));
          b.set(x, 0, z - 1, mc("cobblestone_wall")); // headstone
        }
      }
      b.fill(-7, 0, -7, 7, 0, -7, mc("cobblestone_wall"));
      b.fill(-7, 0, 7, -1, 0, 7, mc("cobblestone_wall"));
      b.fill(1, 0, 7, 7, 0, 7, mc("cobblestone_wall"));
      b.set(-7, 1, -7, mc("soul_lantern"));
      b.set(7, 1, -7, mc("soul_lantern"));
      b.set(6, 0, 2, mc("bone_block"));
      b.chest(6, 0, -5, [[mc("bone"), 3, 8], [id("soul_fragment"), 0, 3], [id("data_crystal"), 1, 4], [id("yggdrasil_gold_coin"), 3, 8], [id("vampire_fang"), 0, 2]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("old_guarder"), 4], [id("skeleton_mage"), 1]]
        : tier === 1
          ? [[id("old_guarder"), 3], [id("elder_lich"), 1], [id("vampire_bride"), 2]]
          : [[id("death_knight"), 2], [id("vampire_bride"), 2], [id("elder_lich"), 2]],
  },
  {
    key: "carne_village", name: "Carne Village", weight: 7, radius: 9, pad: mc("grass_path"),
    build(b) {
      for (const x of [-7, 3]) { // two cottages with doorways facing the green
        b.walls(x, 0, -7, x + 4, 2, -3, mc("oak_planks"));
        b.fill(x, 3, -7, x + 4, 3, -3, mc("spruce_planks"));
        b.fill(x + 2, 0, -3, x + 2, 1, -3, mc("air"));
        b.set(x + 1, 0, -6, mc("crafting_table"));
      }
      b.fill(-8, 0, 6, -5, 0, 7, mc("hay_block"));
      b.set(-6, 1, 6, mc("hay_block"));
      b.set(6, 0, 6, mc("composter"));
      b.set(7, 0, 6, mc("barrel"));
      b.set(0, 0, 3, mc("oak_fence")); // the village bell
      b.set(0, 1, 3, mc("bell"));
      b.fill(-9, 0, -9, 9, 0, -9, mc("oak_fence"));
      b.campfire(0, -1);
      b.chest(0, 0, 6, [[mc("bread"), 2, 6], [mc("wheat"), 3, 8], [id("red_potion"), 1, 3], [id("yggdrasil_gold_coin"), 2, 6]]);
    },
    garrison: (tier) => [[id("enri"), 1], [id("nfirea"), 1], [id("guard"), 2 + tier]],
  },
  {
    key: "great_tomb", name: "Mausoleum of Nazarick", weight: 5, radius: 9, pad: id("nazarick_tiles"),
    build(b) {
      b.walls(-8, 0, -8, 8, 1, 8, id("nazarick_bricks"));
      b.fill(-1, 0, 8, 1, 1, 8, mc("air")); // the gate
      b.fill(-8, 0, -1, -8, 1, 1, id("cracked_nazarick_bricks"));
      for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
        b.fill(x, 0, z, x, 3, z, id("nazarick_pillar"));
        b.set(x, 4, z, id("nazarick_lamp"));
      }
      b.fill(-2, 0, -4, 2, 0, 0, id("gilded_nazarick_bricks")); // the dais
      b.set(0, 1, -4, id("data_crystal_block"));
      b.chest(0, 1, -2, [[id("data_crystal"), 4, 8], [id("yggdrasil_gold_coin"), 8, 16], [id("soul_fragment"), 1, 3], [id("guardian_crest"), 0, 1], [id("scroll_of_time_stop"), 0, 1]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("old_guarder"), 4], [id("skeleton_mage"), 2], [id("elder_lich"), 1]]
        : tier === 1
          ? [[id("lupusregina"), 1], [id("death_knight"), 2], [id("elder_lich"), 2]]
          : [[id("shalltear"), 1], [id("vampire_bride"), 2], [id("death_knight"), 2]],
  },
  {
    key: "zurrernorn_shrine", name: "Zurrernorn Shrine", weight: 6, radius: 7, pad: mc("polished_blackstone"),
    build(b) {
      b.fill(-1, 0, -4, 1, 0, -3, mc("bone_block")); // the altar
      b.set(0, 1, -4, mc("soul_lantern"));
      for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
        b.fill(x, 0, z, x, 2, z, mc("obsidian"));
        b.set(x, 3, z, mc("soul_lantern"));
      }
      b.flag(-3, -6, mc("purple_wool"));
      b.flag(3, -6, mc("purple_wool"));
      b.set(-3, 0, 2, mc("soul_campfire"));
      b.set(3, 0, 2, mc("soul_campfire"));
      b.chest(0, 0, 4, [[mc("bone"), 3, 8], [id("soul_fragment"), 1, 4], [id("data_crystal"), 2, 5], [id("yggdrasil_gold_coin"), 4, 10], [id("tome_create_undead"), 0, 1]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("skeleton_mage"), 3], [id("old_guarder"), 2]]
        : tier === 1
          ? [[id("khajiit"), 1], [id("old_guarder"), 3], [id("skeleton_mage"), 1]]
          : [[id("skeletal_dragon"), 1], [id("khajiit"), 1], [id("old_guarder"), 2]],
  },
  {
    key: "beastman_camp", name: "Beastman Warcamp", weight: 8, radius: 7, pad: mc("coarse_dirt"),
    build(b) {
      b.tent(-4, 2, mc("orange_wool"));
      b.tent(4, 2, mc("orange_wool"));
      b.tent(0, -5, mc("brown_wool"));
      for (let i = 0; i < 10; i++) { // a ring of stakes
        const a = (i / 10) * Math.PI * 2;
        b.set(Math.round(Math.cos(a) * 7), 0, Math.round(Math.sin(a) * 7), mc("acacia_fence"));
      }
      b.flag(6, -6, mc("orange_wool"), mc("acacia_fence"));
      b.set(-6, 0, -5, mc("bone_block"));
      b.campfire(0, 0);
      b.chest(0, 0, 5, [[id("beast_hide"), 1, 4], [mc("cooked_beef"), 2, 5], [mc("leather"), 1, 3], [id("yggdrasil_gold_coin"), 3, 8], [id("basilisk_eye"), 0, 1]]);
    },
    garrison: (tier) =>
      tier === 0
        ? [[id("beastman"), 4]]
        : tier === 1
          ? [[id("beastman"), 5], [id("gigant_basilisk"), 1]]
          : [[id("beastman"), 6], [id("gigant_basilisk"), 2]],
  },
  {
    key: "dwarven_forge", name: "Dwarven Forge", weight: 8, radius: 6, pad: mc("smooth_stone"),
    build(b) {
      b.walls(-3, 0, -3, 3, 3, 3, mc("deepslate_bricks"));
      b.fill(-3, 4, -3, 3, 4, 3, mc("stone_bricks")); // roof
      b.fill(0, 0, -3, 0, 1, -3, mc("air")); // doorway
      b.fill(-3, 1, 0, -3, 2, 0, mc("iron_bars")); // windows
      b.fill(3, 1, 0, 3, 2, 0, mc("iron_bars"));
      b.set(-2, 0, 2, mc("furnace"));
      b.set(-1, 0, 2, mc("furnace"));
      b.set(2, 0, 2, mc("anvil"));
      b.set(2, 0, 0, mc("barrel"));
      b.set(0, 3, 0, mc("lantern"));
      b.set(-5, 0, -4, mc("cobblestone")); // ore pile
      b.set(-5, 0, -5, mc("cobblestone"));
      b.set(-4, 0, -5, mc("cobblestone"));
      b.chest(0, 0, 2, [[mc("iron_ingot"), 3, 7], [mc("coal"), 4, 10], [mc("gold_ingot"), 0, 3], [id("adamantite_ingot"), 0, 2]]);
    },
    garrison: () => [[id("dwarf"), 1]],
  },
  {
    key: "troll_den", name: "Troll Den", weight: 8, radius: 7, pad: mc("coarse_dirt"),
    build(b) {
      for (let i = 0; i < 12; i++) { // ring of boulders with a gap at the front
        if (i === 9) continue;
        const a = (i / 12) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * 6);
        const z = Math.round(Math.sin(a) * 6);
        b.fill(x, 0, z, x, i % 3 === 0 ? 2 : 1, z, i % 2 ? mc("mossy_cobblestone") : mc("cobblestone"));
      }
      b.campfire(0, 0);
      for (const [x, z] of [[-3, 2], [3, -2], [2, 3], [-2, -3]]) b.set(x, 0, z, mc("bone_block"));
      b.set(-3, 1, 2, mc("bone_block"));
      b.chest(0, 0, 4, [[id("yggdrasil_gold_coin"), 4, 10], [mc("leather"), 2, 5], [mc("bone"), 2, 6], [mc("iron_ingot"), 1, 4], [id("troll_blood"), 0, 1]]);
    },
    garrison: (tier) => (tier === 0 ? [[id("war_troll"), 1]] : [[id("war_troll"), tier], [id("ogre"), 2]]),
  },
  {
    key: "dragon_hoard", name: "Dragon's Hoard", weight: 4, radius: 8, pad: mc("packed_ice"),
    build(b) {
      for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, -7], [0, 7], [-7, 0], [7, 0]]) {
        b.fill(x, 0, z, x, 2 + ((x + z) & 1) * 2, z, mc("blue_ice")); // ring of ice spires
      }
      b.fill(-1, 0, -1, 1, 0, 1, mc("gold_block")); // the hoard
      b.set(0, 1, 0, mc("gold_block"));
      b.set(-2, 0, 1, id("data_crystal_block"));
      b.set(2, 0, -1, id("glacier_bricks"));
      b.set(3, 0, 2, mc("bone_block"));
      b.chest(0, 0, 3, [[mc("diamond"), 2, 5], [mc("gold_ingot"), 4, 10], [id("data_crystal"), 4, 8], [id("adamantite_ingot"), 1, 4], [id("yggdrasil_gold_coin"), 10, 24]]);
    },
    // The dragon only stirs for those strong enough to be worth its attention.
    garrison: (tier) => (tier === 0 ? [[id("skeleton_mage"), 3]] : [[id("frost_dragon"), 1]]),
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
const HOSTILE_SITES = new Set(["goblin_camp", "bandit_camp", "nazarick_outpost", "troll_den", "dragon_hoard", "theocracy_camp", "demon_gate",
  "graveyard", "great_tomb", "zurrernorn_shrine", "beastman_camp"]);
/** Sites a player can travel back to once discovered. */
const FRIENDLY_SITES = new Set(["adventurer_camp", "kingdom_camp", "empire_outpost", "dwarven_forge", "lizardman_village", "carne_village"]);
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
}, 5 * TICKS);

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
  if (countItem(player, id("yggdrasil_gold_coin")) < TRAVEL_COST) return `§7Travel costs ${TRAVEL_COST} Gold Coins`;
  takeItem(player, id("yggdrasil_gold_coin"), TRAVEL_COST);
  player.teleport({ x: to.x + 0.5, y: to.y, z: to.z - 0.5 });
  return `§dYou arrive at the ${to.name}`;
}

registerMenu(
  (player) => `Travel (${waypoints(player).length})`,
  (player) => {
    const places = waypoints(player);
    const form = new ActionFormData()
      .title("Travel")
      .body(
        places.length > 0
          ? `Return to a friendly camp you have discovered for ${TRAVEL_COST} Gold Coins. Your party follows.`
          : "You have not discovered any friendly camps yet. Adventurers' camps, Kingdom and Empire army posts, Dwarven Forges, Lizardman villages and Carne Village can be travelled to once found."
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
