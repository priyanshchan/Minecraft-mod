// Overlord: Tomb of Nazarick - the Great Tomb itself: a dungeon of five floors deep underground.
//
// The Tomb opens the first time someone steps onto the crystal inside a Mausoleum of Nazarick, or
// uses a Key of the Great Tomb: its floors are built far beneath that spot, one under another, and
// the party is taken down to the first. Every later entrance, from any Mausoleum or with any key,
// leads to the same Tomb.
//
// Each floor is a hall of its own (the Catacombs, the Glacier, the Amphitheater, the Lava Floor and
// the Throne Room). Arriving wakes its garrison; when the garrison has fallen its Floor Guardian
// appears (the boss fights of bosses.js); when the guardian falls the gate at the far end opens and
// standing on it takes everyone on the floor down to the next. Traps are set into the floors, and
// each hall holds treasure. Clearing the Throne Room - Albedo, then Ainz himself - leads back to the
// surface with the Tomb's rewards. Entering again later, with nobody inside, finds the Tomb restored.
import { world, system, EntityDamageCause, GameMode } from "@minecraft/server";
import { giveItem, grantXp, notify, profileOf, touch } from "./rpg.js";
import { Builder, campAt, stockChests } from "./structures.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const mc = (/** @type {string} */ name) => `minecraft:${name}`;
const TICKS = 20;
export const KEY = id("tomb_key");
const SAVE = "overlord:tomb";
const RETURN = "overlord:tomb_return";
const HALF = 16; // the halls are 33 blocks across
const SPACING = 14; // blocks between one floor and the next
const FIRST = 16; // the first floor lies this far below the entrance
const COIN = id("yggdrasil_gold_coin");

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {"spikes" | "frost" | "thorns" | "flame"} Trap */
/**
 * @typedef {{
 *   key: string, name: string, sub: string, element: string, shell: string, floor: string, accent: string, light: string,
 *   wave: [string, number][], stages: string[][], trap?: Trap, traps: [number, number][], loot: [string, number, number][],
 *   decorate: (b: Builder) => void,
 * }} Floor
 */

/** @type {Floor[]} */
export const FLOORS = [
  {
    key: "catacombs", name: "The Catacombs", sub: "Floors 1 to 3 - Shalltear's domain", element: "dark",
    shell: id("nazarick_bricks"), floor: id("nazarick_tiles"), accent: id("gilded_nazarick_bricks"), light: id("nazarick_lamp"),
    wave: [[id("old_guarder"), 5], [id("skeleton_mage"), 2], [id("vampire_bride"), 2]], stages: [[id("shalltear")]],
    trap: "spikes", traps: [[-2, 9], [2, 9], [0, 6], [-5, -2], [5, -2], [0, -7]],
    loot: [[COIN, 10, 20], [id("data_crystal"), 3, 6], [id("soul_fragment"), 1, 3], [id("refining_stone"), 1, 2]],
    decorate(b) {
      for (const x of [-12, 12]) for (const z of [-8, 0, 8]) b.column(x, z, 8, id("nazarick_pillar"), id("nazarick_lamp"));
      for (const x of [-14, 14]) for (const z of [-10, -5, 4, 9]) b.grave(x, z);
      for (const [x, z] of [[-15, -10], [15, -10], [-15, 10], [15, 10]]) b.set(x, 8, z, mc("web"));
      for (const [x, z] of [[-6, 4], [7, -5], [-3, -10], [9, 6]]) b.set(x, -1, z, id("cracked_nazarick_bricks"));
      for (const x of [-7, 7]) b.set(x, 0, 11, mc("soul_campfire"));
    },
  },
  {
    key: "glacier", name: "The Glacier", sub: "Floor 5 - Cocytus's domain", element: "ice",
    shell: mc("packed_ice"), floor: mc("snow"), accent: mc("blue_ice"), light: mc("sea_lantern"),
    wave: [[id("frost_giant"), 1], [id("old_guarder"), 4]], stages: [[id("cocytus")]],
    trap: "frost", traps: [[-3, 8], [3, 8], [-6, 0], [6, 0], [0, -6]],
    loot: [[COIN, 14, 26], [id("data_crystal"), 4, 8], [mc("diamond"), 0, 2], [id("refining_stone"), 1, 3], [id("gem_sapphire"), 0, 1]],
    decorate(b) {
      for (const [x, z] of [[-12, -10], [12, -10], [-13, 0], [13, 0], [-12, 9], [12, 9]]) b.spire(x, z, 7, mc("packed_ice"), mc("blue_ice"));
      for (const [x, z] of [[-8, 5], [9, -4], [-5, -9], [4, 10]]) b.disc(x, -1, z, 1.5, mc("blue_ice"));
      for (const x of [-14, 14]) for (const z of [-5, 5]) b.set(x, 0, z, mc("blue_ice"));
    },
  },
  {
    key: "amphitheater", name: "The Amphitheater", sub: "Floor 6 - the twins' domain", element: "acid",
    shell: mc("stone_bricks"), floor: mc("grass_block"), accent: mc("moss_block"), light: mc("glowstone"),
    wave: [[id("beastman"), 3], [id("gigant_basilisk"), 1]], stages: [[id("aura"), id("mare")]],
    trap: "thorns", traps: [[-4, 7], [4, 7], [-8, -3], [8, -3]],
    loot: [[COIN, 18, 30], [id("data_crystal"), 4, 8], [mc("golden_apple"), 0, 2], [id("refining_stone"), 2, 3], [id("gem_jade"), 0, 1]],
    decorate(b) {
      // tiers of seats along the east and west walls, as round a real arena
      for (const side of [-1, 1]) {
        for (let tier = 0; tier < 3; tier++) b.fill(side * (13 + tier), 0, -8, side * (13 + tier), tier, 8, tier === 2 ? mc("stone_brick_slab") : mc("stone_bricks"));
      }
      for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) b.tree(x, z, 6);
      b.disc(0, -1, 0, 7, mc("grass_path"), true);
    },
  },
  {
    key: "lava", name: "The Lava Floor", sub: "Floor 7 - Demiurge's domain", element: "fire",
    shell: mc("blackstone"), floor: mc("polished_blackstone"), accent: mc("red_nether_brick"), light: mc("glowstone"),
    wave: [[id("hellhound"), 3], [id("shadow_demon"), 2]], stages: [[id("demiurge")]],
    trap: "flame", traps: [[-3, 8], [3, 8], [0, 4], [-7, -4], [7, -4]],
    loot: [[COIN, 22, 36], [id("data_crystal"), 5, 9], [mc("blaze_powder"), 2, 5], [id("refining_stone"), 2, 4], [id("gem_ruby"), 0, 1]],
    decorate(b) {
      for (const [x, z] of [[-11, -8], [11, -8], [-11, 8], [11, 8]]) b.disc(x, -1, z, 2, mc("magma"));
      for (const x of [-13, 13]) for (const z of [-3, 3]) b.column(x, z, 8, mc("nether_brick"), mc("glowstone"));
      for (const [x, z] of [[-6, 11], [6, 11], [-14, 0], [14, 0]]) b.set(x, 0, z, mc("soul_campfire"));
      for (const [x, z] of [[-9, 0], [9, 0]]) b.set(x, -1, z, mc("crying_obsidian"));
    },
  },
  {
    key: "throne", name: "The Throne Room", sub: "Floors 9 and 10 - the Supreme Being's hall", element: "holy",
    shell: id("nazarick_bricks"), floor: id("gilded_nazarick_bricks"), accent: mc("gold_block"), light: mc("sea_lantern"),
    wave: [[id("death_knight"), 2], [id("elder_lich"), 2]], stages: [[id("albedo")], [id("ainz")]],
    traps: [],
    loot: [[COIN, 30, 50], [id("data_crystal"), 6, 12], [id("guardian_crest"), 1, 1], [id("refining_stone"), 3, 5], [id("gem_sunstone"), 0, 1]],
    decorate(b) {
      b.fill(-1, 0, -6, 1, 0, 11, mc("red_carpet")); // the aisle up to the throne
      for (const x of [-6, 6]) for (const z of [-4, 1, 6, 11]) b.column(x, z, 8, id("nazarick_pillar"), mc("gold_block"));
      for (const x of [-16, 16]) for (const z of [-9, -3, 3, 9]) b.fill(x, 2, z, x, 6, z, z % 2 === 0 ? mc("black_wool") : mc("red_wool"));
      b.fill(-2, 0, -9, 2, 0, -8, mc("gold_block")); // the throne, on a step of gold
      b.fill(-1, 1, -9, 1, 3, -9, mc("gold_block"));
      b.set(0, 1, -8, mc("red_wool"));
      b.set(0, 4, -9, id("nazarick_lamp"));
    },
  },
];

// ------------------------------------------------------------------ where the Tomb is

/** @typedef {{ x: number, y: number, z: number, top: number }} Tomb */

/** @returns {Tomb | undefined} */
export function tombOf() {
  try {
    const raw = world.getDynamicProperty(SAVE);
    if (typeof raw !== "string") return undefined;
    const t = JSON.parse(raw);
    return typeof t.x === "number" && typeof t.top === "number" ? t : undefined;
  } catch {
    return undefined;
  }
}

/** The y of a floor's first air layer. @param {Tomb} tomb @param {number} index */
export function floorY(tomb, index) {
  return tomb.top - index * SPACING;
}

/** The floor a spot lies on, if any. @param {Tomb} tomb @param {Vector3} at */
export function floorAt(tomb, at) {
  if (Math.abs(at.x - (tomb.x + 0.5)) > HALF + 1.5 || Math.abs(at.z - (tomb.z + 0.5)) > HALF + 1.5) return undefined;
  for (let i = 0; i < FLOORS.length; i++) {
    const y = floorY(tomb, i);
    if (at.y >= y - 1 && at.y <= y + 9) return i;
  }
  return undefined;
}

/** Where the party arrives on a floor. @param {Tomb} tomb @param {number} index */
export function arrival(tomb, index) {
  return { x: tomb.x + 0.5, y: floorY(tomb, index), z: tomb.z + 13.5 };
}

/** The gate pad at the far end of a floor. @param {Tomb} tomb @param {number} index */
export function exitPad(tomb, index) {
  return { x: tomb.x + 0.5, y: floorY(tomb, index), z: tomb.z - 12.5 };
}

// ------------------------------------------------------------------ building

/**
 * Raises one floor: a sealed hall, its decoration, its arrival pad, its gate (barred), its traps and treasure.
 * @param {Dimension} dimension @param {Tomb} tomb @param {number} index
 */
export function buildFloor(dimension, tomb, index) {
  const f = FLOORS[index];
  const b = new Builder(dimension, { x: tomb.x, y: floorY(tomb, index), z: tomb.z });
  b.fill(-HALF - 2, -2, -HALF - 2, HALF + 2, 10, HALF + 2, f.shell); // a shell that seals out caves, water and lava
  b.fill(-HALF, 0, -HALF, HALF, 8, HALF, mc("air"));
  b.fill(-HALF, -1, -HALF, HALF, -1, HALF, f.floor);
  for (const x of [-11, 0, 11]) for (const z of [-11, 0, 11]) b.set(x, 9, z, f.light);
  f.decorate(b);
  // arrival
  b.disc(0, -1, 13, 2, f.accent);
  for (const x of [-3, 3]) b.column(x, 14, 3, f.accent, f.light);
  // the gate: an alcove at the north end, barred until the floor is cleared
  b.fill(-4, 0, -HALF, 4, 5, -11, f.shell);
  b.fill(-3, 0, -15, 3, 4, -12, mc("air"));
  b.disc(0, -1, -13, 2, f.accent);
  b.set(0, -1, -13, f.floor);
  b.set(0, 4, -14, f.light);
  b.fill(-1, 0, -11, 1, 2, -11, mc("iron_bars"));
  for (const [x, z] of f.traps) b.set(x, -1, z, TRAP_MARK[f.trap ?? "spikes"]);
  b.chest(-15, 0, 0, f.loot);
  b.chest(15, 0, 0, f.loot);
  stockChests(dimension, b.chests);
}

/** The block that marks a trap in the floor. */
const TRAP_MARK = { spikes: id("cracked_nazarick_bricks"), frost: mc("blue_ice"), thorns: mc("moss_block"), flame: mc("crying_obsidian") };

/** Builds (or restores) every floor. @param {Dimension} dimension @param {Tomb} tomb */
export function buildTomb(dimension, tomb) {
  for (let i = 0; i < FLOORS.length; i++) buildFloor(dimension, tomb, i);
}

/** Opens a floor's gate. @param {Dimension} dimension @param {Tomb} tomb @param {number} index */
function openGate(dimension, tomb, index) {
  const b = new Builder(dimension, { x: tomb.x, y: floorY(tomb, index), z: tomb.z });
  b.fill(-1, 0, -11, 1, 2, -11, mc("air"));
  b.set(0, -1, -13, mc("sea_lantern"));
  fx.pillar(dimension, exitPad(tomb, index), FLOORS[index].element, 5);
  fx.circle(dimension, exitPad(tomb, index), FLOORS[index].element, 2.2);
}

// ------------------------------------------------------------------ a run

/**
 * @typedef {{ status: "idle" | "wave" | "boss" | "cleared", stage: number, mobs: Entity[], announced: boolean }} FloorState
 */
/** @type {FloorState[]} */
export const floors = FLOORS.map(() => ({ status: "idle", stage: 0, mobs: [], announced: false }));
/** Tick at which a player was last seen inside, and whether the Tomb must be restored before the next run. */
let lastInside = 0;
let restore = false;
/** Trap cooldowns: `${floor}|${x}|${z}` -> tick. */
/** @type {Map<string, number>} */
const traps = new Map();
/** Players who just left, and cannot step straight back through the gate. */
/** @type {Map<string, number>} */
const leftAt = new Map();
const EMPTY_FOR = 10 * 60 * TICKS; // a Tomb nobody has been in for ten minutes is restored for the next party

/** Survival players in a floor. @param {Dimension} dimension @param {Tomb} tomb @param {number} index */
function playersOn(dimension, tomb, index) {
  try {
    return dimension.getPlayers({ location: { x: tomb.x + 0.5, y: floorY(tomb, index) + 3, z: tomb.z + 0.5 }, maxDistance: 26 }).filter((p) => floorAt(tomb, p.location) === index);
  } catch {
    return [];
  }
}

/** Shows a title to everyone on a floor. @param {Player[]} players @param {string} title @param {string} sub */
function title(players, title, sub) {
  for (const p of players) {
    try {
      p.onScreenDisplay.setTitle(title, { subtitle: sub, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
    } catch {
      // the player left
    }
  }
}

/**
 * Takes a player (and whoever stands beside them) into the Tomb, opening it the first time.
 * Returns a message.
 * @param {Player} player
 */
export function enter(player) {
  if (player.dimension.id !== "minecraft:overworld") return "§7The Great Tomb lies in the overworld";
  let tomb = tombOf();
  const anyone = tomb ? world.getAllPlayers().some((p) => p.dimension.id === "minecraft:overworld" && floorAt(/** @type {Tomb} */ (tomb), p.location) !== undefined) : false;
  if (!tomb) {
    const x = Math.floor(player.location.x);
    const z = Math.floor(player.location.z);
    const top = Math.max(Math.floor(player.location.y) - FIRST, -63 + 2 + (FLOORS.length - 1) * SPACING + 2);
    tomb = { x, y: Math.floor(player.location.y), z, top };
    try {
      buildTomb(player.dimension, tomb);
    } catch (error) {
      return `§7The Tomb will not open here: ${error}`;
    }
    world.setDynamicProperty(SAVE, JSON.stringify(tomb));
    world.sendMessage(`§5[Nazarick] §f${player.name} has opened the Great Tomb of Nazarick.`);
    resetRun();
  } else if (!anyone) {
    // A fresh party finds the Tomb as it was: it is restored as soon as they arrive.
    restore = true;
    resetRun();
  }
  const party = [player, ...player.dimension.getPlayers({ location: player.location, maxDistance: 6 }).filter((p) => p.id !== player.id)];
  for (const p of party) {
    try {
      if (floorAt(tomb, p.location) === undefined) p.setDynamicProperty(RETURN, JSON.stringify({ x: p.location.x, y: p.location.y, z: p.location.z + 3 }));
      p.teleport(arrival(tomb, 0), { facingLocation: exitPad(tomb, 0) });
      p.addEffect("resistance", 3 * TICKS, { amplifier: 4, showParticles: false });
      fx.wash(p, { red: 0.08, green: 0.02, blue: 0.12 }, 0.8);
    } catch {
      // that player could not be moved
    }
  }
  lastInside = system.currentTick;
  return "§5You descend into the Great Tomb of Nazarick...";
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
  const tomb = tombOf();
  back ??= tomb ? { x: tomb.x + 0.5, y: tomb.y + 1, z: tomb.z + 3.5 } : world.getDefaultSpawnLocation();
  try {
    player.teleport(back);
    player.addEffect("resistance", 3 * TICKS, { amplifier: 4, showParticles: false });
  } catch {
    return "§7You cannot leave just now";
  }
  leftAt.set(player.id, system.currentTick);
  return "§5You climb back into the daylight.";
}

/** Forgets the state of the last run. */
function resetRun() {
  for (const f of floors) {
    f.status = "idle";
    f.stage = 0;
    f.mobs = [];
    f.announced = false;
  }
  traps.clear();
}

/** Spawns a group on a floor. @param {Dimension} dimension @param {Tomb} tomb @param {number} index @param {[string, number][]} group @param {number} radius */
function spawnGroup(dimension, tomb, index, group, radius) {
  /** @type {Entity[]} */
  const out = [];
  const total = group.reduce((n, [, c]) => n + c, 0);
  let slot = 0;
  for (const [type, count] of group) {
    for (let i = 0; i < count; i++, slot++) {
      const a = (slot / Math.max(1, total)) * Math.PI * 2;
      const at = { x: tomb.x + 0.5 + Math.cos(a) * radius, y: floorY(tomb, index), z: tomb.z + 0.5 - 2 + Math.sin(a) * radius };
      try {
        const mob = dimension.spawnEntity(type, at);
        mob.addTag("overlord_tomb");
        mob.addTag(`overlord_tomb_${index}`);
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
 * Moves a floor's run along: the garrison wakes, then the guardian comes, then the gate opens.
 * @param {Dimension} dimension @param {Tomb} tomb @param {number} index @param {Player[]} here
 */
export function advance(dimension, tomb, index, here) {
  const state = floors[index];
  const f = FLOORS[index];
  if (state.status === "idle") {
    // A floor whose gate already stands open was cleared before a reload.
    try {
      const gate = dimension.getBlock({ x: tomb.x, y: floorY(tomb, index), z: tomb.z - 11 });
      if (gate && gate.typeId === mc("air") && !restore) {
        state.status = "cleared";
        return;
      }
    } catch {
      // not loaded yet
      return;
    }
    /** @type {Entity[]} */
    let found = [];
    try {
      found = dimension.getEntities({ tags: [`overlord_tomb_${index}`], location: { x: tomb.x, y: floorY(tomb, index), z: tomb.z }, maxDistance: 30 });
    } catch {
      // none
    }
    state.mobs = found.length > 0 ? found : spawnGroup(dimension, tomb, index, f.wave, 7);
    state.status = "wave";
    title(here, `§5${f.name}`, `§7${f.sub}`);
    return;
  }
  state.mobs = state.mobs.filter(alive);
  if (state.status === "wave" && state.mobs.length === 0) {
    state.status = "boss";
    state.stage = 0;
    summonStage(dimension, tomb, index, here);
    return;
  }
  if (state.status === "boss" && state.mobs.length === 0) {
    state.stage += 1;
    if (state.stage < f.stages.length) {
      summonStage(dimension, tomb, index, here);
      return;
    }
    state.status = "cleared";
    openGate(dimension, tomb, index);
    const last = index === FLOORS.length - 1;
    title(here, "§6Floor cleared", last ? "§eThe gate leads back to the surface" : "§eThe gate to the next floor is open");
    for (const p of here) {
      giveItem(p, COIN, 15 * (index + 1));
      grantXp(p, 400 * (index + 1), f.name);
    }
  }
}

/** The floor's guardian - or the next of them - appears. @param {Dimension} dimension @param {Tomb} tomb @param {number} index @param {Player[]} here */
function summonStage(dimension, tomb, index, here) {
  const f = FLOORS[index];
  const group = f.stages[floors[index].stage];
  floors[index].mobs = spawnGroup(dimension, tomb, index, group.map((type) => /** @type {[string, number]} */ ([type, 1])), group.length > 1 ? 3 : 0.01);
  const centre = { x: tomb.x + 0.5, y: floorY(tomb, index), z: tomb.z - 1.5 };
  fx.pillar(dimension, centre, f.element, 8);
  fx.nova(dimension, { x: centre.x, y: centre.y + 1, z: centre.z }, f.element, 5);
  fx.shake(dimension, centre, 30, 0.6, 0.6);
  const names = group.map((type) => type.split(":")[1].split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")).join(" and ");
  title(here, `§c${names}`, floors[index].stage > 0 ? "§4The master of the Tomb rises" : "§7Guardian of this floor");
}

/**
 * Traps: a marked tile clicks under a player, and a moment later it strikes whoever is on it.
 * @param {Dimension} dimension @param {Tomb} tomb @param {number} index @param {Player[]} here @param {number} now
 */
export function springTraps(dimension, tomb, index, here, now) {
  const f = FLOORS[index];
  if (!f.trap) return;
  const kind = f.trap;
  for (const [x, z] of f.traps) {
    const at = { x: tomb.x + x + 0.5, y: floorY(tomb, index), z: tomb.z + z + 0.5 };
    const key = `${index}|${x}|${z}`;
    if (now < (traps.get(key) ?? 0)) continue;
    if (!here.some((p) => Math.hypot(p.location.x - at.x, p.location.z - at.z) < 0.9)) continue;
    traps.set(key, now + 3 * TICKS);
    fx.flash(dimension, at, f.element, 0.6);
    system.runTimeout(() => {
      try {
        for (const p of dimension.getPlayers({ location: at, maxDistance: 1.6 })) {
          if (kind === "spikes") {
            p.applyDamage(5, { cause: EntityDamageCause.magic });
            p.addEffect("slowness", 1 * TICKS, { amplifier: 2 });
          } else if (kind === "frost") {
            p.applyDamage(4, { cause: EntityDamageCause.magic });
            p.addEffect("slowness", 3 * TICKS, { amplifier: 2 });
          } else if (kind === "thorns") {
            p.applyDamage(3, { cause: EntityDamageCause.magic });
            p.addEffect("poison", 3 * TICKS, { amplifier: 0 });
          } else {
            p.applyDamage(5, { cause: EntityDamageCause.magic });
            p.setOnFire(3, true);
          }
        }
        if (kind === "spikes") fx.puff(dimension, "shard", { x: at.x, y: at.y + 0.4, z: at.z }, "none", 1);
        else if (kind === "frost") fx.nova(dimension, at, "ice", 1.6);
        else if (kind === "thorns") fx.rise(dimension, at, "acid", 1);
        else fx.pillar(dimension, at, "fire", 3, 0.8);
      } catch {
        // the floor is unloading
      }
    }, 8);
  }
}

/** Everyone on a cleared floor's gate pad goes on - down to the next floor, or out with the Tomb's reward. @param {Dimension} dimension @param {Tomb} tomb @param {number} index @param {Player[]} here */
export function takeGate(dimension, tomb, index, here) {
  const pad = exitPad(tomb, index);
  if (!here.some((p) => Math.hypot(p.location.x - pad.x, p.location.z - pad.z) < 1.3)) return false;
  if (index === FLOORS.length - 1) {
    for (const p of here) conquer(p);
    return true;
  }
  for (const p of here) {
    try {
      p.teleport(arrival(tomb, index + 1), { facingLocation: exitPad(tomb, index + 1) });
      fx.wash(p, { red: 0.05, green: 0.02, blue: 0.1 }, 0.6);
    } catch {
      // that player could not be moved
    }
  }
  return true;
}

/** The Tomb conquered: the reward, and the way out. @param {Player} player */
export function conquer(player) {
  const p = profileOf(player);
  if (!Array.isArray(p.bosses)) p.bosses = [];
  const first = !p.bosses.includes("great_tomb");
  giveItem(player, COIN, 120);
  giveItem(player, id("data_crystal"), 16);
  giveItem(player, id("refining_stone"), 6);
  const gems = ["ruby", "sapphire", "topaz", "jade", "onyx", "sunstone"];
  for (let i = 0; i < 2; i++) giveItem(player, id(`gem_${gems[Math.floor(Math.random() * gems.length)]}`), 1);
  grantXp(player, 6000, "the Great Tomb");
  if (first) {
    p.bosses.push("great_tomb");
    giveItem(player, id("codex_of_skills"), 2);
    world.sendMessage(`§5[Nazarick] §6${player.name}§f has conquered the Great Tomb of Nazarick!`);
  }
  touch(player);
  player.sendMessage(`§5[Nazarick] §fThe Tomb is conquered. §6120 Gold Coins§f, §b16 Data Crystals§f, §b6 Refining Stones§f, §d2 gems§f${first ? ", §5two Codices of the Supreme Beings§f" : ""}.`);
  notify(player, leave(player));
}

// ------------------------------------------------------------------ the loop

/**
 * One look at the Tomb and its gates: players stepping onto a Mausoleum's crystal descend, and
 * every floor with players on it moves along.
 * @param {number} now
 */
export function tick(now) {
  const tomb = tombOf();
  for (const player of world.getAllPlayers()) {
    try {
      if (player.dimension.id !== "minecraft:overworld") continue;
      try {
        const mode = player.getGameMode();
        if (mode === GameMode.Spectator) continue;
      } catch {
        // assume a player
      }
      if (tomb && floorAt(tomb, player.location) !== undefined) continue;
      const camp = campAt(player.location);
      if (!camp || camp.type.key !== "great_tomb") continue;
      const gate = { x: camp.x + 0.5, y: camp.y + 1, z: camp.z - 7.5 };
      const off = Math.hypot(player.location.x - gate.x, player.location.z - gate.z);
      if (off < 0.9 && Math.abs(player.location.y - gate.y) < 1.5 && now - (leftAt.get(player.id) ?? -1e9) > 10 * TICKS) {
        notify(player, enter(player));
      } else if (off < 5 && now % (6 * TICKS) < 10) {
        notify(player, "§5The Gate of Nazarick: §fstand on the crystal to descend");
      }
    } catch {
      // the player is changing dimension
    }
  }
  if (!tomb) return;
  const dimension = world.getDimension("overworld");
  let inside = false;
  for (let i = 0; i < FLOORS.length; i++) {
    const here = playersOn(dimension, tomb, i);
    if (here.length === 0) continue;
    inside = true;
    if (restore && i === 0) {
      try {
        for (const old of dimension.getEntities({ tags: ["overlord_tomb"], location: { x: tomb.x, y: floorY(tomb, 2), z: tomb.z }, maxDistance: 60 })) old.remove();
      } catch {
        // already gone
      }
      buildTomb(dimension, tomb);
      restore = false;
    }
    try {
      advance(dimension, tomb, i, here);
      springTraps(dimension, tomb, i, here, now);
      if (floors[i].status === "cleared") takeGate(dimension, tomb, i, here);
    } catch (error) {
      console.warn(`[Overlord] the Tomb failed on floor ${i + 1}: ${error}`);
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
    console.warn(`[Overlord] the Tomb failed: ${error}`);
  }
}, 10);

// The Key: outside, it opens the way down; inside, it leads back up.
world.afterEvents.itemUse.subscribe((event) => {
  try {
    if (event.itemStack?.typeId !== KEY) return;
    const player = event.source;
    const tomb = tombOf();
    if (tomb && floorAt(tomb, player.location) !== undefined) notify(player, leave(player));
    else notify(player, enter(player));
  } catch (error) {
    console.warn(`[Overlord] the key failed: ${error}`);
  }
});

