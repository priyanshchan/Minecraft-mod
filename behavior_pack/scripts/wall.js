// Overlord: Tomb of Nazarick - the Siege of the Great Wall: a third dungeon, the Holy Kingdom in flames (v9.6).
//
// Jaldabaoth's demons and the demi-human tribes of the Abelion Hills have broken the Great Wall of the Holy
// Kingdom. The way down opens the first time someone stands at the heart of a Demon Gate's ritual circle, or
// uses a Seal of the Great Wall. It is run by the dungeon engine (delve.js).
//
// The Breached Wall is held by the bafolk and their king, Buser; the Burning City by hellhounds and shadow
// demons, and then by two Evil Lords at once, Envy and Greed; Jaldabaoth's Pyre - a hall tall and wide enough for
// him to fight in - by Evil Lord Wrath and the hounds, and then by Jaldabaoth himself. Burning pitch is poured
// on the wall, and brands of hellfire wait in the city and the pyre. Breaking the siege saves the Holy Kingdom:
// the first party to do so is given the Demonbane Halberd of the Holy Kingdom.
import { world } from "@minecraft/server";
import { giveItem, grantXp, profileOf } from "./rpg.js";
import { Dungeon } from "./delve.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const mc = (/** @type {string} */ name) => `minecraft:${name}`;
export const KEY = id("wall_seal");
export const HALBERD = id("demonbane_halberd");
const COIN = id("yggdrasil_gold_coin");

/** @typedef {import("@minecraft/server").Player} Player */

/** @type {import("./delve.js").Floor[]} */
export const FLOORS = [
  {
    key: "breach", name: "The Breached Wall", sub: "Where the demi-human tribes broke through", element: "fire", half: 16, height: 10,
    shell: mc("stone_bricks"), floor: mc("cobblestone"), accent: mc("mossy_stone_bricks"), light: mc("glowstone"),
    wave: [[id("bafolk"), 5], [id("beastman"), 2]], stages: [[id("buser")]],
    trap: "pitch", traps: [[-2, 9], [2, 9], [-5, 3], [5, 3], [0, -2], [-3, -8], [3, -8]],
    loot: [[COIN, 12, 22], [id("blessed_cloth"), 1, 3], [id("red_potion"), 1, 3], [id("refining_stone"), 1, 2], [id("beast_hide"), 1, 3]],
    decorate(b) {
      const rampart = [mc("stone_bricks"), mc("cracked_stone_bricks"), mc("mossy_stone_bricks")];
      for (const [z0, z1] of [[-14, -3], [3, 14]]) { // the broken rampart, open where the treasure lies
        b.ruin(-16, z0, -14, z1, 9, rampart);
        b.ruin(14, z0, 16, z1, 9, rampart);
      }
      for (const [x, z] of [[-9, 8], [9, -6], [-7, -5], [8, 7]]) b.mound(x, z, 2, mc("cracked_stone_bricks")); // fallen blocks
      for (const z of [-10, 0, 10]) { // the defenders' banners, still hung
        b.fill(-13, 4, z, -13, 7, z, mc("white_wool"));
        b.fill(13, 4, z, 13, 7, z, mc("white_wool"));
        b.set(-13, 6, z, mc("gold_block"));
        b.set(13, 6, z, mc("gold_block"));
      }
      for (const [x, z] of [[-4, 11], [5, -11]]) { // a broken ballista
        b.fill(x - 1, 0, z, x + 1, 0, z, mc("oak_fence"));
        b.set(x, 1, z, mc("oak_planks"));
      }
      for (const [x, z] of [[-10, 2], [10, -2]]) b.set(x, 0, z, mc("campfire"));
    },
  },
  {
    key: "city", name: "The Burning City", sub: "The capital of the Holy Kingdom, put to the torch", element: "fire", half: 16, height: 10,
    shell: mc("stone_bricks"), floor: mc("smooth_stone"), accent: mc("red_nether_brick"), light: mc("glowstone"),
    wave: [[id("hellhound"), 3], [id("shadow_demon"), 3]], stages: [[id("evil_lord_envy"), id("evil_lord_greed")]],
    trap: "brimstone", traps: [[-3, 9], [3, 9], [-8, 2], [8, 2], [-2, -4], [2, -4], [0, -9]],
    loot: [[COIN, 18, 30], [id("demon_heart"), 0, 1], [id("data_crystal"), 3, 6], [id("refining_stone"), 1, 3], [mc("gold_ingot"), 1, 4]],
    decorate(b) {
      for (const [x0, z0] of [[-15, -12], [-15, 4], [10, -12], [10, 4]]) { // burned-out houses
        b.ruin(x0, z0, x0 + 4, z0, 5, [mc("stone_bricks"), mc("cracked_stone_bricks"), mc("blackstone")]);
        b.ruin(x0, z0 + 6, x0 + 4, z0 + 6, 4, [mc("stone_bricks"), mc("cracked_stone_bricks"), mc("blackstone")]);
        b.set(x0 + 2, 0, z0 + 3, mc("campfire"));
      }
      // the shattered chapel in the square
      for (const [x, z] of [[-4, -1], [4, -1], [-4, 5], [4, 5]]) b.column(x, z, 6, mc("quartz_pillar"), mc("smooth_quartz"));
      b.fill(-1, 0, 6, 1, 1, 6, mc("smooth_quartz"));
      b.set(0, 2, 6, mc("gold_block"));
      for (const [x, z] of [[-9, -6], [9, 8], [-11, 11], [11, -9]]) b.disc(x, -1, z, 1.5, mc("magma"));
      for (const [x, z] of [[-6, 9], [6, -8]]) b.set(x, 0, z, mc("soul_campfire"));
    },
  },
  {
    key: "pyre", name: "Jaldabaoth's Pyre", sub: "The Demon Emperor's throne of fire", element: "fire", half: 20, height: 16,
    shell: mc("blackstone"), floor: mc("polished_blackstone"), accent: mc("nether_brick"), light: mc("shroomlight"),
    wave: [[id("evil_lord_wrath"), 1], [id("hellhound"), 3]], stages: [[id("jaldabaoth")]],
    trap: "brimstone", traps: [[-3, 12], [3, 12], [-9, 5], [9, 5], [-6, -5], [6, -5], [0, -9]],
    loot: [[COIN, 30, 50], [id("demon_heart"), 1, 2], [id("data_crystal"), 6, 10], [id("guardian_crest"), 0, 1], [id("gem_ruby"), 0, 1]],
    decorate(b) {
      for (const x of [-12, 12]) for (const z of [-12, -4, 4, 12]) b.column(x, z, 16, mc("basalt"), mc("shroomlight")); // pillars of basalt
      for (const x of [-16, -15, 15, 16]) b.fill(x, -1, -18, x, -1, 18, mc("magma")); // channels of embers
      for (let i = 0; i < 8; i++) { // spires of bone round the pyre
        const a = (i / 8) * Math.PI * 2;
        b.spire(Math.round(Math.cos(a) * 8), Math.round(Math.sin(a) * 8) + 2, 5 + (i % 2) * 2, mc("bone_block"), mc("soul_lantern"));
      }
      b.disc(0, -1, 2, 5, mc("netherrack"), true); // the pyre itself
      b.disc(0, -1, 2, 3, mc("crying_obsidian"));
      for (const [x, z] of [[-2, 0], [2, 0], [0, 4], [-2, 4], [2, 4]]) b.set(x, 0, z, mc("campfire"));
      b.fill(-3, 0, -13, 3, 0, -11, mc("polished_blackstone")); // the Demon Emperor's dais, before the gate
      b.fill(-1, 1, -13, 1, 4, -13, mc("blackstone"));
      b.set(0, 5, -13, mc("gold_block"));
    },
  },
];

/** Where the heart of the ritual lies in a Demon Gate, relative to the site. */
export const STONE = { x: 0, z: 0 };

/** The siege broken: the reward, and the Halberd the first time. Returns the reward line. @param {Player} player */
function reward(player) {
  const p = profileOf(player);
  if (!Array.isArray(p.bosses)) p.bosses = [];
  const first = !p.bosses.includes("great_wall");
  giveItem(player, COIN, 180);
  giveItem(player, id("demon_heart"), 6);
  giveItem(player, id("data_crystal"), 14);
  giveItem(player, id("angel_feather"), 6);
  giveItem(player, id("gem_ruby"), 1);
  grantXp(player, 8500, "the Great Wall");
  const halberd = first || Math.random() < 0.25;
  if (halberd) giveItem(player, HALBERD, 1);
  if (first) {
    p.bosses.push("great_wall");
    world.sendMessage(`§c[Great Wall] §6${player.name}§f has broken Jaldabaoth's siege and saved the Holy Kingdom!`);
  }
  p.wallRuns = (typeof p.wallRuns === "number" ? p.wallRuns : 0) + 1;
  return `§c[Great Wall] §fThe siege is broken. §6180 Gold Coins§f, §c6 Demon's Hearts§f, §b14 Data Crystals§f, §f6 Angel Feathers§f, §da ruby§f${halberd ? ", §6the Demonbane Halberd§f" : ""}.`;
}

export const wall = new Dungeon({
  key: "wall", name: "the Great Wall of the Holy Kingdom", tag: "overlord_wall", colour: "§c", item: KEY,
  site: "demon_gate", stone: STONE, first: 20, spacing: 26, floors: FLOORS,
  lords: {
    [id("buser")]: "Buser, King of the Bafolk",
    [id("evil_lord_envy")]: "Evil Lord Envy",
    [id("evil_lord_greed")]: "Evil Lord Greed",
    [id("jaldabaoth")]: "Jaldabaoth, the Demon Emperor",
  },
  lastSub: "§4The Demon Emperor rises from the flames",
  hint: "§cThe ritual circle burns: §fstand at its heart to descend to the Great Wall",
  wash: { red: 0.14, green: 0.04, blue: 0.02 },
  floorPay: { coins: 20, xp: 550, items: [[id("refining_stone"), 1]] },
  reward,
});
