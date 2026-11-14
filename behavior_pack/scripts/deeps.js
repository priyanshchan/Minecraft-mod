// Overlord: Tomb of Nazarick - the Dwarven Royal Capital: a second dungeon, three floors under the mountains.
//
// The old capital of the dwarves fell to the quagoa clans and the Frost Dragon long ago. It opens the first
// time someone steps onto the rune stone at the back of a Besieged Mine, or uses a Rune Key of the Royal
// Capital: its floors are built far beneath that spot and the party is taken down to the first. Every later
// entrance leads to the same Capital.
//
// The Abandoned Mines are held by the quagoa and their Warlord; the Rune Forge by the golem the dwarves
// built to guard it; the Frozen Throne - a hall tall enough for a dragon to fly in - by the Frost Dragon that
// sleeps on the dwarf king's hoard. Each floor works as the Great Tomb's do (dungeon.js): its garrison wakes,
// then its lord comes, then the gate at the far end opens. Traps are set into the floors - cave-ins, rune
// glyphs and frost - and each hall holds treasure. Clearing the Throne frees the Capital: the first party to do
// so is given the Runeblade of the Dwarf King. Entering later, with nobody inside, finds the Capital restored.
import { world, system, EntityDamageCause, GameMode } from "@minecraft/server";
import { giveItem, grantXp, notify, profileOf, touch } from "./rpg.js";
import { Builder, campAt, stockChests } from "./structures.js";
import { tombOf, floorAt as tombFloorAt } from "./dungeon.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const mc = (/** @type {string} */ name) => `minecraft:${name}`;
const TICKS = 20;
export const KEY = id("rune_key");
export const BLADE = id("runeblade");
export const RUNE = id("royal_rune");
const SAVE = "overlord:deeps";
const RETURN = "overlord:deeps_return";
const SPACING = 26; // blocks between one floor and the next
const FIRST = 18; // the first floor lies this far below the entrance
const COIN = id("yggdrasil_gold_coin");
const MAX_FILL = 32000; // the game fills at most 32768 blocks at once

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {"cave_in" | "rune" | "frost"} Trap */
/**
 * @typedef {{
 *   key: string, name: string, sub: string, element: string, half: number, height: number,
 *   shell: string, floor: string, accent: string, light: string,
 *   wave: [string, number][], stages: string[][], trap: Trap, traps: [number, number][], loot: [string, number, number][],
 *   decorate: (b: Builder) => void,
 * }} Floor
 */

/** @type {Floor[]} */
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

// ------------------------------------------------------------------ where the Capital is

/** @typedef {{ x: number, y: number, z: number, top: number }} Capital */

/** @returns {Capital | undefined} */
export function capitalOf() {
  try {
    const raw = world.getDynamicProperty(SAVE);
    if (typeof raw !== "string") return undefined;
    const t = JSON.parse(raw);
    return typeof t.x === "number" && typeof t.top === "number" ? t : undefined;
  } catch {
    return undefined;
  }
}

/** The y of a floor's first air layer. @param {Capital} cap @param {number} index */
export function floorY(cap, index) {
  return cap.top - index * SPACING;
}

/** The floor a spot lies on, if any. @param {Capital} cap @param {Vector3} at */
export function floorAt(cap, at) {
  for (let i = 0; i < FLOORS.length; i++) {
    const f = FLOORS[i];
    if (Math.abs(at.x - (cap.x + 0.5)) > f.half + 1.5 || Math.abs(at.z - (cap.z + 0.5)) > f.half + 1.5) continue;
    const y = floorY(cap, i);
    if (at.y >= y - 1 && at.y <= y + f.height + 1) return i;
  }
  return undefined;
}

/** Where the party arrives on a floor. @param {Capital} cap @param {number} index */
export function arrival(cap, index) {
  return { x: cap.x + 0.5, y: floorY(cap, index), z: cap.z + FLOORS[index].half - 2.5 };
}

/** The gate pad at the far end of a floor. @param {Capital} cap @param {number} index */
export function exitPad(cap, index) {
  return { x: cap.x + 0.5, y: floorY(cap, index), z: cap.z - FLOORS[index].half + 3.5 };
}

/** The z (relative to the Capital) of a floor's barred gate. @param {number} index */
function gateZ(index) {
  return -FLOORS[index].half + 5;
}

// ------------------------------------------------------------------ building

/** Fills a large box a few layers at a time, as the game will not fill more than 32768 blocks at once. */
function bigFill(/** @type {Builder} */ b, /** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ z0,
  /** @type {number} */ x1, /** @type {number} */ y1, /** @type {number} */ z1, /** @type {string} */ block) {
  const per = Math.max(1, Math.floor(MAX_FILL / ((x1 - x0 + 1) * (z1 - z0 + 1))));
  for (let y = y0; y <= y1; y += per) b.fill(x0, y, z0, x1, Math.min(y1, y + per - 1), z1, block);
}

/**
 * Raises one floor: a sealed hall, its decoration, its arrival pad, its gate (barred), its traps and treasure.
 * @param {Dimension} dimension @param {Capital} cap @param {number} index
 */
export function buildFloor(dimension, cap, index) {
  const f = FLOORS[index];
  const H = f.half;
  const T = f.height;
  const b = new Builder(dimension, { x: cap.x, y: floorY(cap, index), z: cap.z });
  bigFill(b, -H - 2, -2, -H - 2, H + 2, T + 2, H + 2, f.shell); // a shell that seals out caves, water and lava
  bigFill(b, -H, 0, -H, H, T, H, mc("air"));
  b.fill(-H, -1, -H, H, -1, H, f.floor);
  const step = Math.round(H * 0.7);
  for (const x of [-step, 0, step]) for (const z of [-step, 0, step]) b.set(x, T + 1, z, f.light);
  f.decorate(b);
  // arrival
  b.disc(0, -1, H - 3, 2, f.accent);
  for (const x of [-3, 3]) b.column(x, H - 2, 3, f.accent, f.light);
  // the gate: an alcove at the north end, barred until the floor is cleared
  const g = gateZ(index);
  b.fill(-4, 0, -H, 4, 5, g, f.shell);
  b.fill(-3, 0, -H + 1, 3, 4, g - 1, mc("air"));
  b.disc(0, -1, -H + 3, 2, f.accent);
  b.set(0, -1, -H + 3, f.floor);
  b.set(0, 4, -H + 2, f.light);
  b.fill(-1, 0, g, 1, 2, g, mc("iron_bars"));
  for (const [x, z] of f.traps) b.set(x, -1, z, TRAP_MARK[f.trap]);
  b.chest(-H + 1, 0, 0, f.loot);
  b.chest(H - 1, 0, 0, f.loot);
  stockChests(dimension, b.chests);
}

/** The block that marks a trap in the floor. */
const TRAP_MARK = { cave_in: mc("gravel"), rune: mc("chiseled_deepslate"), frost: mc("blue_ice") };

/** Builds (or restores) every floor. @param {Dimension} dimension @param {Capital} cap */
export function buildCapital(dimension, cap) {
  for (let i = 0; i < FLOORS.length; i++) buildFloor(dimension, cap, i);
}

/** Opens a floor's gate. @param {Dimension} dimension @param {Capital} cap @param {number} index */
function openGate(dimension, cap, index) {
  const b = new Builder(dimension, { x: cap.x, y: floorY(cap, index), z: cap.z });
  const g = gateZ(index);
  b.fill(-1, 0, g, 1, 2, g, mc("air"));
  b.set(0, -1, -FLOORS[index].half + 3, mc("sea_lantern"));
  fx.pillar(dimension, exitPad(cap, index), FLOORS[index].element, 5);
  fx.circle(dimension, exitPad(cap, index), FLOORS[index].element, 2.2);
}

// ------------------------------------------------------------------ a run

/**
 * @typedef {{ status: "idle" | "wave" | "boss" | "cleared", stage: number, mobs: Entity[] }} FloorState
 */
/** @type {FloorState[]} */
export const floors = FLOORS.map(() => ({ status: "idle", stage: 0, mobs: [] }));
let lastInside = 0;
let restore = false;
/** Trap cooldowns: `${floor}|${x}|${z}` -> tick. */
/** @type {Map<string, number>} */
const traps = new Map();
/** Players who just left, and cannot step straight back onto the rune stone. */
/** @type {Map<string, number>} */
const leftAt = new Map();
const EMPTY_FOR = 10 * 60 * TICKS;

/** Survival players in a floor. @param {Dimension} dimension @param {Capital} cap @param {number} index */
function playersOn(dimension, cap, index) {
  const f = FLOORS[index];
  try {
    return dimension
      .getPlayers({ location: { x: cap.x + 0.5, y: floorY(cap, index) + f.height / 2, z: cap.z + 0.5 }, maxDistance: f.half * 1.6 + 2 })
      .filter((p) => floorAt(cap, p.location) === index);
  } catch {
    return [];
  }
}

/** @param {Player[]} players @param {string} text @param {string} sub */
function title(players, text, sub) {
  for (const p of players) {
    try {
      p.onScreenDisplay.setTitle(text, { subtitle: sub, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
    } catch {
      // the player left
    }
  }
}

/** Whether a player stands inside the Great Tomb (and so cannot be taken from it). @param {Player} player */
function inTomb(player) {
  const tomb = tombOf();
  return !!tomb && tombFloorAt(tomb, player.location) !== undefined;
}

/**
 * Where a new Capital goes: under the player, unless that would cut into the Great Tomb.
 * @param {Player} player
 */
export function siteFor(player) {
  let x = Math.floor(player.location.x);
  const z = Math.floor(player.location.z);
  const tomb = tombOf();
  if (tomb && Math.abs(x - tomb.x) < 60 && Math.abs(z - tomb.z) < 60) x = tomb.x + (x >= tomb.x ? 64 : -64);
  const top = Math.max(Math.floor(player.location.y) - FIRST, -63 + 2 + (FLOORS.length - 1) * SPACING + 2);
  return { x, y: Math.floor(player.location.y), z, top };
}

/**
 * Takes a player (and whoever stands beside them) down into the Capital, opening it the first time.
 * Returns a message.
 * @param {Player} player
 */
export function enter(player) {
  if (player.dimension.id !== "minecraft:overworld") return "§7The Royal Capital lies under the mountains of the overworld";
  if (inTomb(player)) return "§7Leave the Great Tomb first";
  let cap = capitalOf();
  const anyone = cap ? world.getAllPlayers().some((p) => p.dimension.id === "minecraft:overworld" && floorAt(/** @type {Capital} */ (cap), p.location) !== undefined) : false;
  if (!cap) {
    cap = siteFor(player);
    try {
      buildCapital(player.dimension, cap);
    } catch (error) {
      return `§7The way down will not open here: ${error}`;
    }
    world.setDynamicProperty(SAVE, JSON.stringify(cap));
    world.sendMessage(`§b[Royal Capital] §f${player.name} has found the way into the lost Dwarven Royal Capital.`);
    resetRun();
  } else if (!anyone) {
    restore = true;
    resetRun();
  }
  const party = [player, ...player.dimension.getPlayers({ location: player.location, maxDistance: 6 }).filter((p) => p.id !== player.id)];
  for (const p of party) {
    try {
      if (floorAt(cap, p.location) === undefined) p.setDynamicProperty(RETURN, JSON.stringify({ x: p.location.x, y: p.location.y, z: p.location.z + 3 }));
      p.teleport(arrival(cap, 0), { facingLocation: exitPad(cap, 0) });
      p.addEffect("resistance", 3 * TICKS, { amplifier: 4, showParticles: false });
      fx.wash(p, { red: 0.05, green: 0.08, blue: 0.12 }, 0.8);
    } catch {
      // that player could not be moved
    }
  }
  lastInside = system.currentTick;
  return "§bYou descend into the Dwarven Royal Capital...";
}

/** Takes a player back to where they came in. Returns a message. @param {Player} player */
export function leave(player) {
  /** @type {Vector3 | undefined} */
  let back;
  try {
    const raw = player.getDynamicProperty(RETURN);
    if (typeof raw === "string") back = JSON.parse(raw);
  } catch {
    // no record
  }
  const cap = capitalOf();
  back ??= cap ? { x: cap.x + 0.5, y: cap.y + 1, z: cap.z + 3.5 } : world.getDefaultSpawnLocation();
  try {
    player.teleport(back);
    player.addEffect("resistance", 3 * TICKS, { amplifier: 4, showParticles: false });
  } catch {
    return "§7You cannot leave just now";
  }
  leftAt.set(player.id, system.currentTick);
  return "§bYou climb back up into the daylight.";
}

/** Forgets the state of the last run. */
export function resetRun() {
  for (const f of floors) {
    f.status = "idle";
    f.stage = 0;
    f.mobs = [];
  }
  traps.clear();
}

/** Spawns a group on a floor. @param {Dimension} dimension @param {Capital} cap @param {number} index @param {[string, number][]} group @param {number} radius */
function spawnGroup(dimension, cap, index, group, radius) {
  /** @type {Entity[]} */
  const out = [];
  const total = group.reduce((n, [, c]) => n + c, 0);
  let slot = 0;
  for (const [type, count] of group) {
    for (let i = 0; i < count; i++, slot++) {
      const a = (slot / Math.max(1, total)) * Math.PI * 2;
      const at = { x: cap.x + 0.5 + Math.cos(a) * radius, y: floorY(cap, index), z: cap.z + 0.5 - 2 + Math.sin(a) * radius };
      try {
        const mob = dimension.spawnEntity(type, at);
        mob.addTag("overlord_deeps");
        mob.addTag(`overlord_deeps_${index}`);
        fx.rise(dimension, at, FLOORS[index].element, 0.8);
        out.push(mob);
      } catch {
        // no room
      }
    }
  }
  return out;
}

/** @param {Entity} e */
function alive(e) {
  try {
    if (!e.isValid) return false;
    const health = e.getComponent("minecraft:health");
    return !health || health.currentValue > 0;
  } catch {
    return false;
  }
}

/**
 * Moves a floor's run along: the garrison wakes, then its lord comes, then the gate opens.
 * @param {Dimension} dimension @param {Capital} cap @param {number} index @param {Player[]} here
 */
export function advance(dimension, cap, index, here) {
  const state = floors[index];
  const f = FLOORS[index];
  if (state.status === "idle") {
    try {
      const gate = dimension.getBlock({ x: cap.x, y: floorY(cap, index), z: cap.z + gateZ(index) });
      if (gate && gate.typeId === mc("air") && !restore) {
        state.status = "cleared";
        return;
      }
    } catch {
      return; // not loaded yet
    }
    /** @type {Entity[]} */
    let found = [];
    try {
      found = dimension.getEntities({ tags: [`overlord_deeps_${index}`], location: { x: cap.x, y: floorY(cap, index), z: cap.z }, maxDistance: 34 });
    } catch {
      // none
    }
    state.mobs = found.length > 0 ? found : spawnGroup(dimension, cap, index, f.wave, 7);
    state.status = "wave";
    title(here, `§b${f.name}`, `§7${f.sub}`);
    return;
  }
  state.mobs = state.mobs.filter(alive);
  if (state.status === "wave" && state.mobs.length === 0) {
    state.status = "boss";
    state.stage = 0;
    summonStage(dimension, cap, index, here);
    return;
  }
  if (state.status === "boss" && state.mobs.length === 0) {
    state.stage += 1;
    if (state.stage < f.stages.length) {
      summonStage(dimension, cap, index, here);
      return;
    }
    state.status = "cleared";
    openGate(dimension, cap, index);
    const last = index === FLOORS.length - 1;
    title(here, "§6Floor cleared", last ? "§eThe gate leads back to the surface" : "§eThe gate to the next floor is open");
    for (const p of here) {
      giveItem(p, COIN, 18 * (index + 1));
      giveItem(p, RUNE, 1);
      grantXp(p, 500 * (index + 1), f.name);
    }
  }
}

/** A floor's lord appears. @param {Dimension} dimension @param {Capital} cap @param {number} index @param {Player[]} here */
function summonStage(dimension, cap, index, here) {
  const f = FLOORS[index];
  const group = f.stages[floors[index].stage];
  floors[index].mobs = spawnGroup(dimension, cap, index, group.map((type) => /** @type {[string, number]} */ ([type, 1])), group.length > 1 ? 3 : 0.01);
  const centre = { x: cap.x + 0.5, y: floorY(cap, index), z: cap.z - 1.5 };
  fx.pillar(dimension, centre, f.element, 8);
  fx.nova(dimension, { x: centre.x, y: centre.y + 1, z: centre.z }, f.element, 5);
  fx.shake(dimension, centre, 30, 0.6, 0.6);
  const names = group.map((type) => LORDS[type] ?? type).join(" and ");
  title(here, `§c${names}`, index === FLOORS.length - 1 ? "§4It wakes upon the dwarf king's hoard" : "§7Lord of this floor");
}

/** The names the lords are announced by. */
/** @type {Record<string, string>} */
const LORDS = {
  [id("quagoa_warlord")]: "Quagoa Warlord",
  [id("rune_golem")]: "Rune Golem of the Royal Forge",
  [id("frost_dragon")]: "Olasird'arc, the Frost Dragon",
};

/**
 * Traps: a marked tile shifts under a player, and a moment later it strikes whoever is on it - stone falls
 * from the roof of the mines, a rune flares in the forge, the ice of the throne hall bites.
 * @param {Dimension} dimension @param {Capital} cap @param {number} index @param {Player[]} here @param {number} now
 */
export function springTraps(dimension, cap, index, here, now) {
  const f = FLOORS[index];
  const kind = f.trap;
  for (const [x, z] of f.traps) {
    const at = { x: cap.x + x + 0.5, y: floorY(cap, index), z: cap.z + z + 0.5 };
    const key = `${index}|${x}|${z}`;
    if (now < (traps.get(key) ?? 0)) continue;
    if (!here.some((p) => Math.hypot(p.location.x - at.x, p.location.z - at.z) < 0.9)) continue;
    traps.set(key, now + 3 * TICKS);
    fx.flash(dimension, at, f.element, 0.6);
    if (kind === "cave_in") fx.fall(dimension, at, "none", 8, 0);
    system.runTimeout(() => {
      try {
        for (const p of dimension.getPlayers({ location: at, maxDistance: 1.6 })) {
          if (kind === "cave_in") {
            p.applyDamage(6, { cause: EntityDamageCause.fallingBlock });
            p.addEffect("slowness", 2 * TICKS, { amplifier: 2 });
            p.addEffect("mining_fatigue", 4 * TICKS, { amplifier: 1 });
          } else if (kind === "rune") {
            p.applyDamage(5, { cause: EntityDamageCause.magic });
            p.addEffect("levitation", 1 * TICKS, { amplifier: 2 });
          } else {
            p.applyDamage(4, { cause: EntityDamageCause.magic });
            p.addEffect("slowness", 3 * TICKS, { amplifier: 2 });
          }
        }
        if (kind === "cave_in") {
          fx.puff(dimension, "shard", { x: at.x, y: at.y + 0.4, z: at.z }, "none", 1.2);
          fx.shake(dimension, at, 6, 0.3, 0.3);
        } else if (kind === "rune") fx.pillar(dimension, at, "lightning", 3, 0.8);
        else fx.nova(dimension, at, "ice", 1.6);
      } catch {
        // the floor is unloading
      }
    }, 8);
  }
}

/** Everyone on a cleared floor's gate pad goes on - down, or out with the Capital's reward. @param {Dimension} dimension @param {Capital} cap @param {number} index @param {Player[]} here */
export function takeGate(dimension, cap, index, here) {
  const pad = exitPad(cap, index);
  if (!here.some((p) => Math.hypot(p.location.x - pad.x, p.location.z - pad.z) < 1.3)) return false;
  if (index === FLOORS.length - 1) {
    for (const p of here) liberate(p);
    return true;
  }
  for (const p of here) {
    try {
      p.teleport(arrival(cap, index + 1), { facingLocation: exitPad(cap, index + 1) });
      fx.wash(p, { red: 0.04, green: 0.06, blue: 0.12 }, 0.6);
    } catch {
      // that player could not be moved
    }
  }
  return true;
}

/** The Capital freed: the reward, the Runeblade the first time, and the way out. Returns the reward line. @param {Player} player */
export function liberate(player) {
  const p = profileOf(player);
  if (!Array.isArray(p.bosses)) p.bosses = [];
  const first = !p.bosses.includes("royal_capital");
  giveItem(player, COIN, 150);
  giveItem(player, RUNE, 4);
  giveItem(player, id("data_crystal"), 12);
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
  touch(player);
  const line = `§b[Royal Capital] §fThe Capital is free. §6150 Gold Coins§f, §b4 Royal Runes§f, §b12 Data Crystals§f, §b6 Frost Dragon Scales§f, §da sapphire§f${blade ? ", §6the Runeblade of the Dwarf King§f" : ""}.`;
  player.sendMessage(line);
  notify(player, leave(player));
  return line;
}

// ------------------------------------------------------------------ the loop

/** Where the rune stone lies in a Besieged Mine, relative to the site. */
export const STONE = { x: 0, z: -6 };

/**
 * One look at the Capital and its gates: players stepping onto the rune stone at the back of a Besieged Mine
 * descend, and every floor with players on it moves along.
 * @param {number} now
 */
export function tick(now) {
  const cap = capitalOf();
  for (const player of world.getAllPlayers()) {
    try {
      if (player.dimension.id !== "minecraft:overworld") continue;
      try {
        if (player.getGameMode() === GameMode.Spectator) continue;
      } catch {
        // assume a player
      }
      if (cap && floorAt(cap, player.location) !== undefined) continue;
      const camp = campAt(player.location);
      if (!camp || camp.type.key !== "besieged_mine") continue;
      const stone = { x: camp.x + STONE.x + 0.5, y: camp.y, z: camp.z + STONE.z + 0.5 };
      const off = Math.hypot(player.location.x - stone.x, player.location.z - stone.z);
      if (off < 0.9 && Math.abs(player.location.y - stone.y) < 1.5 && now - (leftAt.get(player.id) ?? -1e9) > 10 * TICKS) {
        notify(player, enter(player));
      } else if (off < 5 && now % (6 * TICKS) < 10) {
        notify(player, "§bA dwarven rune stone: §fstand on it to descend to the Royal Capital");
      }
    } catch {
      // the player is changing dimension
    }
  }
  if (!cap) return;
  const dimension = world.getDimension("overworld");
  let inside = false;
  for (let i = 0; i < FLOORS.length; i++) {
    const here = playersOn(dimension, cap, i);
    if (here.length === 0) continue;
    inside = true;
    if (restore && i === 0) {
      try {
        for (const old of dimension.getEntities({ tags: ["overlord_deeps"], location: { x: cap.x, y: floorY(cap, 1), z: cap.z }, maxDistance: 70 })) old.remove();
      } catch {
        // already gone
      }
      buildCapital(dimension, cap);
      restore = false;
    }
    try {
      advance(dimension, cap, i, here);
      springTraps(dimension, cap, i, here, now);
      if (floors[i].status === "cleared") takeGate(dimension, cap, i, here);
    } catch (error) {
      console.warn(`[Overlord] the Royal Capital failed on floor ${i + 1}: ${error}`);
    }
  }
  if (inside) lastInside = now;
  else if (now - lastInside > EMPTY_FOR && lastInside > 0) {
    restore = true;
    resetRun();
    lastInside = 0;
  }
}

system.runInterval(() => {
  try {
    tick(system.currentTick);
  } catch (error) {
    console.warn(`[Overlord] the Royal Capital failed: ${error}`);
  }
}, 10);

// The Rune Key: outside, it opens the way down; inside, it leads back up.
world.afterEvents.itemUse.subscribe((event) => {
  try {
    if (event.itemStack?.typeId !== KEY) return;
    const player = event.source;
    const cap = capitalOf();
    if (cap && floorAt(cap, player.location) !== undefined) notify(player, leave(player));
    else notify(player, enter(player));
  } catch (error) {
    console.warn(`[Overlord] the rune key failed: ${error}`);
  }
});
