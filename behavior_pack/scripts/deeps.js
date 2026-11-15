// Overlord: Tomb of Nazarick - the Dwarven Royal Capital: a second dungeon, three floors under the mountains.
//
// The old capital of the dwarves fell to the quagoa clans and the Frost Dragon long ago. It opens the first
// time someone steps onto the rune stone at the back of a Besieged Mine, or uses a Rune Key of the Royal
// Capital: its floors are built far beneath that spot and the party is taken down to the first. Every later
// entrance leads to the same Capital.
//
// The Abandoned Mines are held by the quagoa and their Warlord; the Rune Forge by the golem the dwarves
// built to guard it; the Frozen Throne - a hall tall enough for a dragon to fly in - by the Frost Dragon that
// sleeps on the dwarf king's hoard. It is run by the dungeon engine (delve.js): each floor's garrison wakes,
// then its lord comes, then the gate at the far end opens. Traps are set into the floors - cave-ins, rune
// glyphs and frost - and each hall holds treasure. Clearing the Throne frees the Capital: the first party to do
// so is given the Runeblade of the Dwarf King. Entering later, with nobody inside, finds the Capital restored.
import { world } from "@minecraft/server";
import { giveItem, grantXp, profileOf } from "./rpg.js";
import { Dungeon } from "./delve.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const mc = (/** @type {string} */ name) => `minecraft:${name}`;
export const KEY = id("rune_key");
export const BLADE = id("runeblade");
export const RUNE = id("royal_rune");
const COIN = id("yggdrasil_gold_coin");

/** @typedef {import("@minecraft/server").Player} Player */

/** @type {import("./delve.js").Floor[]} */
export const FLOORS = [
  {
    key: "mines", name: "The Abandoned Mines", sub: "Where the quagoa broke through", element: "none", half: 16, height: 8,
    shell: mc("deepslate"), floor: mc("cobbled_deepslate"), accent: mc("tuff"), light: mc("shroomlight"),
    wave: [[id("quagoa"), 7]], stages: [[id("quagoa_warlord")]],
    trap: "cave_in", traps: [[-2, 9], [2, 9], [0, 5], [-6, -1], [6, -1], [0, -7]],
    loot: [[COIN, 10, 20], [mc("raw_gold"), 1, 4], [RUNE, 0, 1], [id("refining_stone"), 1, 2], [mc("diamond"), 0, 1]],
    decorate(b) {
      for (const z of [-8, -2, 4, 10]) { // pit props down both sides
        for (const x of [-12, -6, 6, 12]) b.fill(x, 0, z, x, 5, z, mc("spruce_log"));
        b.fill(-12, 6, z, -6, 6, z, mc("spruce_planks"));
        b.fill(6, 6, z, 12, 6, z, mc("spruce_planks"));
        b.set(-9, 5, z, mc("lantern"));
        b.set(9, 5, z, mc("lantern"));
      }
      b.fill(-9, 0, -10, -9, 0, 10, mc("rail")); // the old ore-cart lines
      b.fill(9, 0, -10, 9, 0, 10, mc("rail"));
      for (const [x, y, z, ore] of /** @type {[number, number, number, string][]} */ ([
        [-16, 1, -6, mc("deepslate_gold_ore")], [-16, 2, 7, mc("deepslate_diamond_ore")], [16, 1, 2, mc("deepslate_gold_ore")],
        [16, 3, -9, mc("deepslate_gold_ore")], [-16, 4, 0, mc("raw_iron_block")], [16, 2, 9, mc("deepslate_diamond_ore")],
      ])) b.set(x, y, z, ore);
      for (const [x, z] of [[-14, -12], [14, -12], [-14, 12], [14, 12]]) b.mound(x, z, 2, mc("gravel")); // spoil heaps
      for (const [x, z] of [[-4, 3], [5, -4], [-3, -9], [8, 7]]) b.set(x, -1, z, mc("tuff"));
    },
  },
  {
    key: "forge", name: "The Rune Forge", sub: "The furnaces of the old runesmiths", element: "lightning", half: 16, height: 8,
    shell: mc("deepslate_bricks"), floor: mc("polished_deepslate"), accent: mc("deepslate_tiles"), light: mc("sea_lantern"),
    wave: [[id("quagoa"), 5], [id("frost_giant"), 1]], stages: [[id("rune_golem")]],
    trap: "rune", traps: [[-3, 8], [3, 8], [-7, 2], [7, 2], [-4, -5], [4, -5], [0, -8]],
    loot: [[COIN, 14, 26], [RUNE, 1, 2], [id("adamantite_ingot"), 0, 2], [id("refining_stone"), 1, 3], [id("data_crystal"), 2, 5]],
    decorate(b) {
      for (const x of [-12, 12]) for (const z of [-9, -3, 3, 9]) b.column(x, z, 8, mc("deepslate_tiles"), mc("sea_lantern"));
      for (const side of [-1, 1]) { // the forges: furnaces either side of an anvil, over a bed of embers
        for (const z of [-6, 0, 6]) {
          b.set(side * 15, 0, z - 1, mc("blast_furnace"));
          b.set(side * 15, 0, z + 1, mc("blast_furnace"));
          b.set(side * 14, 0, z, mc("anvil"));
          b.set(side * 15, -1, z, mc("magma"));
        }
      }
      for (const [x, z] of [[-6, 10], [6, 10], [-6, -10], [6, -10]]) b.set(x, 0, z, mc("smithing_table"));
      for (const [x, z] of [[-9, 6], [9, -6]]) b.fill(x, 0, z, x + 1, 0, z + 1, mc("raw_iron_block"));
      for (const x of [-16, 16]) for (const z of [-12, -6, 0, 6, 12]) b.set(x, 3, z, mc("chiseled_deepslate")); // carved runes
      b.disc(0, -1, 0, 4, mc("deepslate_tiles"), true); // the runesmith's circle
      b.set(0, -1, 0, mc("chiseled_deepslate"));
    },
  },
  {
    key: "throne", name: "The Frozen Throne", sub: "The Frost Dragon's lair in the hall of kings", element: "ice", half: 20, height: 20,
    shell: mc("packed_ice"), floor: mc("polished_deepslate"), accent: mc("blue_ice"), light: mc("sea_lantern"),
    wave: [[id("frost_giant"), 2], [id("quagoa"), 4]], stages: [[id("frost_dragon")]],
    trap: "frost", traps: [[-3, 12], [3, 12], [-8, 4], [8, 4], [-5, -6], [5, -6]],
    loot: [[COIN, 30, 50], [RUNE, 2, 3], [id("frost_dragon_scale"), 1, 3], [mc("diamond"), 1, 2], [id("gem_sapphire"), 0, 1]],
    decorate(b) {
      for (const x of [-10, 10]) for (const z of [-12, -4, 4, 12]) b.column(x, z, 20, mc("deepslate_tiles"), mc("blue_ice")); // the great columns
      for (const [x, z] of [[-17, -15], [17, -15], [-17, 15], [17, 15], [-18, 0], [18, 0]]) b.spire(x, z, 9, mc("packed_ice"), mc("blue_ice"));
      // the king's hoard, heaped in the corners
      for (const [x, z] of [[-15, -10], [15, -10], [-15, 10], [15, 10]]) {
        b.mound(x, z, 2, mc("raw_gold_block"));
        b.set(x, 2, z, mc("gold_block"));
      }
      // the throne of the dwarf king, on a dais before the gate
      b.fill(-3, 0, -13, 3, 0, -11, mc("deepslate_tiles"));
      b.fill(-1, 1, -13, 1, 1, -13, mc("gold_block"));
      b.fill(-1, 2, -13, 1, 4, -13, mc("deepslate_tiles"));
      b.set(0, 5, -13, mc("gold_block"));
      for (const x of [-2, 2]) b.set(x, 1, -12, mc("gold_block"));
      b.fill(-1, -1, -10, 1, -1, 16, mc("blue_ice")); // a frozen aisle up to it
      for (const [x, z] of [[-6, 8], [7, -2], [-4, -4], [5, 10]]) b.disc(x, -1, z, 1.5, mc("snow"));
    },
  },
];

/** Where the rune stone lies in a Besieged Mine, relative to the site. */
export const STONE = { x: 0, z: -6 };

/** The Capital freed: the reward, and the Runeblade the first time. Returns the reward line. @param {Player} player */
function reward(player) {
  const p = profileOf(player);
  if (!Array.isArray(p.bosses)) p.bosses = [];
  const first = !p.bosses.includes("royal_capital");
  giveItem(player, COIN, 150);
  giveItem(player, RUNE, 4);
  giveItem(player, id("data_crystal"), 12);
  giveItem(player, id("world_fragment"), 1);
  giveItem(player, id("frost_dragon_scale"), 6);
  giveItem(player, id("gem_sapphire"), 1);
  grantXp(player, 7000, "the Royal Capital");
  const blade = first || Math.random() < 0.25;
  if (blade) giveItem(player, BLADE, 1);
  if (first) {
    p.bosses.push("royal_capital");
    world.sendMessage(`§b[Royal Capital] §6${player.name}§f has freed the Dwarven Royal Capital and claimed the Runeblade of the Dwarf King!`);
  }
  p.capitalRuns = (typeof p.capitalRuns === "number" ? p.capitalRuns : 0) + 1;
  return `§b[Royal Capital] §fThe Capital is free. §6150 Gold Coins§f, §b4 Royal Runes§f, §b12 Data Crystals§f, §b6 Frost Dragon Scales§f, §da sapphire§f, §5a World Item fragment§f${blade ? ", §6the Runeblade of the Dwarf King§f" : ""}.`;
}

export const capital = new Dungeon({
  key: "deeps", name: "the Dwarven Royal Capital", tag: "overlord_deeps", colour: "§b", item: KEY,
  site: "besieged_mine", stone: STONE, first: 18, spacing: 26, floors: FLOORS,
  lords: {
    [id("quagoa_warlord")]: "Quagoa Warlord",
    [id("rune_golem")]: "Rune Golem of the Royal Forge",
    [id("frost_dragon")]: "Olasird'arc, the Frost Dragon",
  },
  lastSub: "§4It wakes upon the dwarf king's hoard",
  hint: "§bA dwarven rune stone: §fstand on it to descend to the Royal Capital",
  wash: { red: 0.05, green: 0.08, blue: 0.12 },
  floorPay: { coins: 18, xp: 500, items: [[RUNE, 1]] },
  reward,
});

// The engine's workings, under the names the rest of the add-on (and its tests) use.
export const floors = capital.state;
export const capitalOf = () => capital.place();
export const floorY = (/** @type {import("./delve.js").Place} */ at, /** @type {number} */ i) => capital.floorY(at, i);
export const floorAt = (/** @type {import("./delve.js").Place} */ at, /** @type {import("@minecraft/server").Vector3} */ spot) => capital.floorAt(at, spot);
export const arrival = (/** @type {import("./delve.js").Place} */ at, /** @type {number} */ i) => capital.arrival(at, i);
export const exitPad = (/** @type {import("./delve.js").Place} */ at, /** @type {number} */ i) => capital.exitPad(at, i);
export const siteFor = (/** @type {Player} */ player) => capital.siteFor(player);
export const enter = (/** @type {Player} */ player) => capital.enter(player);
export const leave = (/** @type {Player} */ player) => capital.leave(player);
export const liberate = (/** @type {Player} */ player) => capital.conquer(player);
export const resetRun = () => capital.resetRun();
export const tick = (/** @type {number} */ now) => capital.tick(now);
export const buildFloor = (/** @type {import("@minecraft/server").Dimension} */ d, /** @type {import("./delve.js").Place} */ at, /** @type {number} */ i) => capital.buildFloor(d, at, i);
export const springTraps = (/** @type {import("@minecraft/server").Dimension} */ d, /** @type {import("./delve.js").Place} */ at, /** @type {number} */ i,
  /** @type {Player[]} */ here, /** @type {number} */ now) => capital.springTraps(d, at, i, here, now);
