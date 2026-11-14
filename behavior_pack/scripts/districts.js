// Overlord: Tomb of Nazarick - a living Sorcerer Kingdom: districts, citizens, trade and envoys.
//
// Outside the capital's walls (kingdom.js) lie eight district plots, one for each kind of building: a
// Market, a Smithy, an Alchemist, Barracks, an Academy, a Temple, Farms and Houses. Each is raised and
// improved to level 3 for coins and crystals, is built from blocks on its plot, and does something real:
// workshops make wares into the treasury each kingdom day, the Market lifts taxes and opens trade, the
// Academy speeds learning, the Barracks posts more guards.
//
// Citizens settle as the kingdom grows: the population rises each kingdom day towards what houses and
// farms can hold, pays a share of taxes, and walks the capital's streets as villagers. Trade routes from
// the Market to outposts pay each day, unless bandits raid the caravans. Envoys of the neighbouring powers
// come to the throne: ally with them for gifts, demand tribute, or send them away. A Theocracy made an
// enemy marches more often; one made an ally never does.
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { giveItem, hooks, notify, touch } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import { Builder } from "./structures.js";
import { INVADERS, realmHooks, realmOf } from "./kingdom.js";
import { atCourt } from "./court.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const mc = (/** @type {string} */ name) => `minecraft:${name}`;
const TICKS = 20;
const COIN = id("yggdrasil_gold_coin");
const CRYSTAL = id("data_crystal");
const CREST = id("guardian_crest");
export const MAX_BUILDING = 3;
/** Half the width of a district plot. */
export const PLOT = 6;
/** Height cleared above a plot. */
const PLOT_HEIGHT = 16;
/** Citizens walk the capital while the ruler is this close; at most this many at once. */
const CITIZEN_RANGE = 40;
export const MAX_CITIZENS = 10;
/** Chance that a caravan is raided on a given day, and what each hostile power adds to it. */
export const RAID_CHANCE = 0.12;
/** Chance an envoy arrives on a kingdom day; at most this many wait at once. */
export const ENVOY_CHANCE = 0.4;
export const MAX_ENVOYS = 3;
/** Gold Coins to open a trade route. */
export const ROUTE_COST = 50;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./kingdom.js").Realm} Realm */
/** @typedef {[string, number][]} Wares */

/**
 * The district buildings: the plot each stands on (from the capital's centre), and what a level does.
 * @type {Record<string, { name: string, plot: [number, number], help: (level: number) => string }>}
 */
export const BUILDINGS = {
  market: { name: "Market", plot: [0, 34], help: (l) => `taxes +${15 * l}%; ${2 * l} trade routes` },
  smithy: { name: "Dwarven Smithy", plot: [34, 0], help: (l) => `${l} Refining Stone(s) a day` },
  alchemist: { name: "Alchemist's Workshop", plot: [-34, 0], help: (l) => `${l} mana potion(s) a day` },
  barracks: { name: "Barracks", plot: [0, -34], help: (l) => `${l} more guard(s) at the capital` },
  academy: { name: "Magic Academy", plot: [31, -31], help: (l) => `everything you learn: +${4 * l}% XP` },
  temple: { name: "Temple of the Supreme Beings", plot: [-31, -31], help: (l) => `${2 * l} more Data Crystals a day` },
  farms: { name: "Farms", plot: [31, 31], help: (l) => `room for ${10 * l} more citizens; they settle ${25 * l}% faster` },
  houses: { name: "Houses", plot: [-31, 31], help: (l) => `room for ${15 * l} more citizens` },
};

/** What raising a building to a level costs. @param {number} level */
export function buildCost(level) {
  return { coins: 100 * level * level + 50, crystals: 20 * level, crests: level >= 3 ? 2 : 0 };
}

/** The neighbouring powers whose envoys come to the throne. */
export const POWERS = {
  kingdom: { name: "Re-Estize Kingdom", gift: /** @type {Wares} */ ([[COIN, 25]]), tribute: /** @type {Wares} */ ([[COIN, 90]]) },
  empire: { name: "Baharuth Empire", gift: /** @type {Wares} */ ([[id("refining_stone"), 2]]), tribute: /** @type {Wares} */ ([[COIN, 60], [id("refining_stone"), 4]]) },
  theocracy: { name: "Slane Theocracy", gift: /** @type {Wares} */ ([[id("gem_sunstone"), 1]]), tribute: /** @type {Wares} */ ([[COIN, 50], [id("gem_sunstone"), 2]]) },
  dwarves: { name: "Dwarven Kingdom", gift: /** @type {Wares} */ ([[id("adamantite_ingot"), 2]]), tribute: /** @type {Wares} */ ([[id("adamantite_ingot"), 6]]) },
  lizardmen: { name: "Lizardman Tribes", gift: /** @type {Wares} */ ([[CRYSTAL, 3]]), tribute: /** @type {Wares} */ ([[CRYSTAL, 9]]) },
  holy: { name: "Roble Holy Kingdom", gift: /** @type {Wares} */ ([[id("blue_potion"), 2]]), tribute: /** @type {Wares} */ ([[COIN, 40], [id("blue_potion"), 4]]) },
};
/** Relations at or above this are an alliance; at or below the negative, enmity. */
export const ALLIED = 50;

// ---------------------------------------------------------------- state

/** @param {Realm} realm */
export function buildings(realm) {
  if (!realm.buildings || typeof realm.buildings !== "object") realm.buildings = {};
  return /** @type {Record<string, number>} */ (realm.buildings);
}
/** @param {Realm} realm @param {string} key */
export function levelOf(realm, key) {
  return Number(buildings(realm)[key] ?? 0);
}
/** @param {Realm} realm */
export function relations(realm) {
  if (!realm.relations || typeof realm.relations !== "object") realm.relations = {};
  return /** @type {Record<string, number>} */ (realm.relations);
}
/** @param {Realm} realm @param {string} power */
export function standing(realm, power) {
  const r = Number(relations(realm)[power] ?? 0);
  return r >= ALLIED ? "allied" : r <= -ALLIED ? "hostile" : "neutral";
}
/** @param {Realm} realm @param {string} item @param {number} count */
function addGoods(realm, item, count) {
  if (!realm.goods || typeof realm.goods !== "object") realm.goods = {};
  const goods = /** @type {Record<string, number>} */ (realm.goods);
  goods[item] = (goods[item] ?? 0) + count;
}

// ---------------------------------------------------------------- citizens

/** How many citizens the kingdom can hold. @param {Realm} realm */
export function capacity(realm) {
  return 20 + 20 * realm.tier + 15 * levelOf(realm, "houses") + 10 * levelOf(realm, "farms") + (atCourt(realm, "mare") ? 20 : 0);
}

/** How many settle in a day. @param {Realm} realm */
export function growth(realm) {
  return Math.max(2, Math.ceil(capacity(realm) * 0.1 * (1 + 0.25 * levelOf(realm, "farms")) * (atCourt(realm, "mare") ? 2 : 1)));
}

/** @param {Realm} realm */
export function population(realm) {
  return Math.max(0, Math.floor(Number(realm.population ?? 0)));
}

// ---------------------------------------------------------------- building

/**
 * Lays a building on its plot at a level. Returns false when part of it is not loaded yet.
 * @param {import("@minecraft/server").Dimension} dimension @param {Realm} realm @param {string} key @param {number} level
 */
export function layBuilding(dimension, realm, key, level) {
  const [px, pz] = BUILDINGS[key].plot;
  const b = new Builder(dimension, { x: realm.x + px, y: realm.y, z: realm.z + pz });
  const r = PLOT;
  const brick = id("nazarick_bricks");
  try {
    for (let y = -4; y <= -2; y++) b.fill(-r, y, -r, r, y, r, mc("dirt"));
    b.fill(-r, -1, -r, r, -1, r, id("nazarick_tiles"));
    for (let y = 0; y < PLOT_HEIGHT; y++) b.fill(-r, y, -r, r, y, r, mc("air"));
    b.walls(-r, 0, -r, r, 0, r, mc("stone_brick_wall"));
    // the way in faces the capital
    const [gx, gz] = Math.abs(px) >= Math.abs(pz) ? [px > 0 ? -r : r, 0] : [0, pz > 0 ? -r : r];
    if (gx !== 0) b.fill(gx, 0, -1, gx, 0, 1, mc("air"));
    else b.fill(-1, 0, gz, 1, 0, gz, mc("air"));
    for (const [x, z] of [[-r, -r], [r, -r], [-r, r], [r, r]]) b.column(x, z, 2, id("nazarick_pillar"), id("nazarick_lamp"));
    DESIGNS[key](b, level);
  } catch {
    return false;
  }
  return true;
}

/** @type {Record<string, (b: Builder, level: number) => void>} */
const DESIGNS = {
  market(b, level) {
    b.well(0, 0);
    const stalls = [[-5, -5, "red_wool"], [2, -5, "blue_wool"], [-5, 3, "yellow_wool"], [2, 3, "green_wool"]];
    for (const [x, z, cloth] of stalls.slice(0, level + 1)) b.stall(Number(x), Number(z), mc(String(cloth)));
    if (level >= 3) b.set(0, 0, -4, mc("bell"));
    b.lamp(-3, 0, mc("dark_oak_fence"), mc("lantern"));
    b.lamp(3, 0, mc("dark_oak_fence"), mc("lantern"));
  },
  smithy(b, level) {
    b.house(-4, -4, 9, 7, { wall: mc("stone_bricks"), roof: mc("deepslate_bricks"), floor: mc("smooth_stone"), height: 4, door: "s" });
    b.set(-2, 0, -3, mc("anvil"));
    b.set(0, 0, -3, mc("furnace"));
    b.column(3, -3, 8, mc("cobblestone"), mc("campfire"));
    if (level >= 2) {
      b.set(1, 0, -3, mc("blast_furnace"));
      b.set(-3, 0, 0, mc("smithing_table"));
    }
    if (level >= 3) {
      b.set(-3, 0, -3, id("adamantite_block"));
      b.set(2, 0, 0, mc("grindstone"));
    }
  },
  alchemist(b, level) {
    b.house(-4, -4, 9, 7, { wall: mc("oak_planks"), roof: mc("spruce_planks"), floor: mc("oak_planks"), height: 4, door: "s" });
    b.set(-1, 0, -3, mc("brewing_stand"));
    b.set(1, 0, -3, mc("cauldron"));
    if (level >= 2) {
      b.set(-3, 0, -3, mc("bookshelf"));
      b.set(3, 0, -3, mc("bookshelf"));
      for (const x of [-4, -2, 2, 4]) b.set(x, 0, 4, mc("moss_block"));
    }
    if (level >= 3) b.set(0, 0, 0, mc("amethyst_block"));
  },
  barracks(b, level) {
    b.palisade(5, mc("spruce_log"), 2);
    b.tent(-2, -4, mc("black_wool"));
    if (level >= 2) b.tent(2, -4, mc("purple_wool"));
    for (const x of [-3, 0, 3]) b.set(x, 0, 2, mc("target"));
    if (level >= 3) b.tower(-4, 1, 3, 7, id("nazarick_bricks"), id("nazarick_lamp"));
    b.flag(3, 3, mc("purple_wool"), mc("dark_oak_fence"));
  },
  academy(b, level) {
    const h = 5 + 3 * level;
    b.tower(-3, -3, 7, h, mc("stone_bricks"), mc("sea_lantern"));
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2]]) b.set(x, 0, z, mc("bookshelf"));
    b.set(0, 0, -1, mc("lectern"));
    if (level >= 2) b.set(0, 0, 1, mc("enchanting_table"));
    if (level >= 3) b.spire(0, 0, 4, mc("purple_stained_glass"), id("data_crystal_block"));
  },
  temple(b, level) {
    b.disc(0, -1, 0, 5, id("gilded_nazarick_bricks"));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.column(Math.round(Math.cos(a) * 4), Math.round(Math.sin(a) * 4), 4 + level, id("nazarick_pillar"), id("nazarick_lamp"));
    }
    b.set(0, 0, 0, id("data_crystal_block"));
    if (level >= 2) b.disc(0, 4 + level, 0, 4.4, id("gilded_nazarick_bricks"), true);
    if (level >= 3) b.spire(0, 0, 11, id("nazarick_bricks"), id("data_crystal_block"));
  },
  farms(b, level) {
    for (let row = 0; row < 1 + level; row++) {
      const z = -4 + row * 3;
      b.fill(-4, -1, z, 4, -1, z + 1, mc("moss_block"));
      for (let x = -4; x <= 4; x += 2) b.set(x, 0, z, (x + row) % 4 === 0 ? mc("pumpkin") : mc("hay_block"));
    }
    b.set(5 - 1, 0, 4, mc("composter"));
    if (level >= 3) b.set(-4, 0, 4, mc("melon_block"));
  },
  houses(b, level) {
    const look = { wall: mc("oak_planks"), roof: mc("spruce_planks"), floor: mc("oak_planks") };
    const spots = [[-5, -5], [1, -5], [-5, 1]];
    for (const [x, z] of spots.slice(0, level)) b.house(x, z, 5, 5, { ...look, door: "s" });
    if (level >= 3) b.lamp(3, 3);
  },
};

/**
 * Raises a building one level, paid from the inventory. Returns a message.
 * @param {Player} player @param {string} key
 */
export function build(player, key) {
  const realm = realmOf(player);
  const info = BUILDINGS[key];
  if (!realm || !info) return "§7You rule no kingdom";
  const level = levelOf(realm, key) + 1;
  if (level > MAX_BUILDING) return `§7The ${info.name} is complete`;
  if (Math.hypot(player.location.x - realm.x, player.location.z - realm.z) > 24) return "§7Stand in your capital to build its districts";
  const cost = buildCost(level);
  if (countItem(player, COIN) < cost.coins || countItem(player, CRYSTAL) < cost.crystals || countItem(player, CREST) < cost.crests) {
    return `§7Level ${level} costs ${cost.coins} Gold Coins, ${cost.crystals} Data Crystals${cost.crests ? ` and ${cost.crests} Guardian Crests` : ""}`;
  }
  if (!layBuilding(player.dimension, realm, key, level)) return "§7Part of the plot is not loaded yet: stand still a moment and try again";
  takeItem(player, COIN, cost.coins);
  takeItem(player, CRYSTAL, cost.crystals);
  if (cost.crests) takeItem(player, CREST, cost.crests);
  buildings(realm)[key] = level;
  touch(player);
  const [px, pz] = info.plot;
  fx.pillar(player.dimension, { x: realm.x + px, y: realm.y, z: realm.z + pz }, "holy", 8);
  return `§6The ${info.name} rises to level ${level}`;
}

// ---------------------------------------------------------------- trade

/** The trade routes still running (to outposts the realm holds). @param {Realm} realm */
export function routes(realm) {
  if (!Array.isArray(realm.routes)) realm.routes = [];
  const held = new Set(realm.outposts.map((o) => o.key));
  realm.routes = realm.routes.filter((key) => held.has(key));
  return realm.routes;
}

/** What a route to an outpost pays a day. @param {Realm} realm @param {string} key */
export function routeValue(realm, key) {
  const o = realm.outposts.find((x) => x.key === key);
  if (!o) return 0;
  const base = 5 + Math.floor(Math.hypot(o.x - realm.x, o.z - realm.z) / 30);
  return Math.round(base * (atCourt(realm, "pandoras_actor") ? 1.5 : 1));
}

/** Opens a trade route from the Market to an outpost. Returns a message. @param {Player} player @param {string} key */
export function openRoute(player, key) {
  const realm = realmOf(player);
  if (!realm) return "§7You rule no kingdom";
  const market = levelOf(realm, "market");
  if (market < 1) return "§7Build a Market first";
  const list = routes(realm);
  if (list.includes(key)) return "§7A caravan already runs there";
  if (list.length >= 2 * market) return `§7A level ${market} Market runs ${2 * market} routes: improve it for more`;
  const outpost = realm.outposts.find((o) => o.key === key);
  if (!outpost) return "§7No such outpost";
  if (countItem(player, COIN) < ROUTE_COST) return `§7Opening a route costs ${ROUTE_COST} Gold Coins`;
  takeItem(player, COIN, ROUTE_COST);
  list.push(key);
  touch(player);
  return `§6Caravans now run to the ${outpost.name}: ${routeValue(realm, key)} coins a day`;
}

/** The chance that a caravan is raided today. @param {Realm} realm */
export function raidChance(realm) {
  if (atCourt(realm, "demiurge")) return 0;
  const enemies = Object.keys(POWERS).filter((k) => standing(realm, k) === "hostile").length;
  return RAID_CHANCE + 0.1 * enemies;
}

// ---------------------------------------------------------------- envoys

/** Envoys waiting at the throne. @param {Realm} realm */
export function envoys(realm) {
  if (!Array.isArray(realm.envoys)) realm.envoys = [];
  return realm.envoys;
}

/**
 * Answers an envoy. `answer` is "ally", "tribute" or "dismiss". Returns a message.
 * @param {Player} player @param {string} power @param {string} answer
 */
export function answer(player, power, answer) {
  const realm = realmOf(player);
  const info = POWERS[/** @type {keyof typeof POWERS} */ (power)];
  if (!realm || !info) return "§7No such envoy";
  const waiting = envoys(realm);
  const at = waiting.indexOf(power);
  if (at < 0) return "§7No such envoy waits";
  waiting.splice(at, 1);
  const rel = relations(realm);
  const before = standing(realm, power);
  let message;
  if (answer === "ally") {
    rel[power] = Math.min(100, (rel[power] ?? 0) + 40);
    message = `§aYou offer the ${info.name} your friendship`;
  } else if (answer === "tribute") {
    rel[power] = Math.max(-100, (rel[power] ?? 0) - 35);
    for (const [item, count] of info.tribute) giveItem(player, item, count);
    message = `§6The ${info.name} pays tribute, and will remember it`;
  } else {
    rel[power] = Math.max(-100, (rel[power] ?? 0) - 10);
    message = `§7The envoy of the ${info.name} is sent away`;
  }
  const after = standing(realm, power);
  if (after !== before) message += after === "allied" ? `. §aThe ${info.name} is now your ally!` : after === "hostile" ? `. §cThe ${info.name} is now your enemy!` : "";
  touch(player);
  return message;
}

// ---------------------------------------------------------------- each kingdom day

/**
 * The day's life of the realm: citizens settle, workshops make wares, caravans run, allies send gifts and
 * envoys arrive. Returns what happened, for messages and tests.
 * @param {Player} player @param {Realm} realm @param {() => number} [random]
 */
export function day(player, realm, random = Math.random) {
  const report = { settled: 0, trade: 0, raided: 0, envoy: "", gifts: 0 };
  const before = population(realm);
  realm.population = Math.min(capacity(realm), before + growth(realm));
  report.settled = population(realm) - before;
  const extra = atCourt(realm, "pandoras_actor") ? 1 : 0;
  const smithy = levelOf(realm, "smithy");
  const alchemist = levelOf(realm, "alchemist");
  if (smithy > 0) addGoods(realm, id("refining_stone"), smithy + extra);
  if (alchemist > 0) addGoods(realm, id("blue_potion"), alchemist + extra);
  const chance = raidChance(realm);
  for (const key of routes(realm)) {
    if (random() < chance) {
      report.raided++;
      continue;
    }
    report.trade += routeValue(realm, key);
  }
  realm.treasury += report.trade;
  for (const [power, info] of Object.entries(POWERS)) {
    if (standing(realm, power) !== "allied") continue;
    for (const [item, count] of info.gift) addGoods(realm, item, count);
    report.gifts++;
  }
  const waiting = envoys(realm);
  if (waiting.length < MAX_ENVOYS && random() < ENVOY_CHANCE) {
    const free = Object.keys(POWERS).filter((k) => !waiting.includes(k));
    if (free.length > 0) {
      report.envoy = free[Math.floor(random() * free.length) % free.length];
      waiting.push(report.envoy);
    }
  }
  try {
    const parts = [];
    if (report.settled > 0) parts.push(`§a${report.settled} citizens settled§f (${population(realm)}/${capacity(realm)})`);
    if (report.trade > 0) parts.push(`§6caravans brought ${report.trade} coins`);
    if (report.raided > 0) parts.push(`§c${report.raided} caravan(s) raided by bandits`);
    if (report.gifts > 0) parts.push(`§b${report.gifts} ally gift(s) arrived`);
    if (parts.length > 0) player.sendMessage(`§6[Kingdom] §f${parts.join("§f, ")}.`);
    if (report.envoy) {
      const name = POWERS[/** @type {keyof typeof POWERS} */ (report.envoy)].name;
      player.sendMessage(`§6[Kingdom] §fAn envoy of the §e${name}§f waits in your throne room. §7(Kingdom page: Envoys)`);
    }
  } catch {
    // the player left
  }
  return report;
}

// ---------------------------------------------------------------- hooks

realmHooks.income.push((realm, pay) => {
  pay.coins *= 1 + 0.15 * levelOf(realm, "market");
  pay.coins += Math.floor(population(realm) / 4);
  pay.crystals += 2 * levelOf(realm, "temple");
});
realmHooks.day.push((player, realm) => {
  day(player, realm);
});
realmHooks.guards.push((realm, capital) => (capital ? levelOf(realm, "barracks") : 0));
realmHooks.invader.push((realm, pick) => {
  const theocracy = INVADERS.findIndex((i) => i.name.includes("Theocracy"));
  if (theocracy < 0) return undefined;
  const stance = standing(realm, "theocracy");
  if (stance === "hostile" && pick < 0.6) return theocracy;
  if (stance === "allied") {
    const others = INVADERS.map((_, i) => i).filter((i) => i !== theocracy);
    return others[Math.floor(pick * others.length) % others.length];
  }
  return undefined;
});
realmHooks.body.push((_player, realm) => {
  const built = Object.values(buildings(realm)).filter((l) => l > 0).length;
  return `\n§fCitizens: §a${population(realm)}/${capacity(realm)}§f   Districts built: §e${built}/8§f   Trade routes: §6${routes(realm).length}` +
    (envoys(realm).length > 0 ? `\n§e${envoys(realm).length} envoy(s) wait in your throne room.` : "");
});
realmHooks.menu.push(
  { label: (_p, realm) => `Districts\n§8${Object.values(buildings(realm)).filter((l) => l > 0).length}/8 built`, open: (player) => openDistricts(player) },
  { label: (_p, realm) => `Trade routes\n§8${routes(realm).length} running`, open: (player) => openTrade(player) },
  { label: (_p, realm) => `Envoys${envoys(realm).length > 0 ? ` §e(${envoys(realm).length} waiting)` : ""}\n§8Your neighbours`, open: (player) => openEnvoys(player) },
);
// The Magic Academy: everything the ruler learns comes a little faster.
hooks.xpFactor.push((p) => {
  const realm = /** @type {any} */ (p.realm);
  const level = realm && typeof realm.x === "number" ? Number(realm.buildings?.academy ?? 0) : 0;
  return 1 + 0.04 * level;
});

// ---------------------------------------------------------------- the citizens in the streets

/** Keeps citizens walking the capital while the ruler is there. Returns how many were brought out. @param {Player} player */
export function populate(player) {
  const realm = realmOf(player);
  if (!realm) return 0;
  if (player.dimension.id !== "minecraft:overworld" && player.dimension.id !== "overworld") return 0;
  if (Math.hypot(player.location.x - realm.x, player.location.z - realm.z) > CITIZEN_RANGE) return 0;
  const wanted = Math.min(MAX_CITIZENS, Math.floor(population(realm) / 8));
  const tag = `overlord_citizen_${player.id}`;
  let present = 0;
  try {
    present = player.dimension.getEntities({ tags: [tag], location: { x: realm.x, y: realm.y, z: realm.z }, maxDistance: 60 }).length;
  } catch {
    return 0;
  }
  let out = 0;
  for (let i = present; i < wanted; i++) {
    const a = (i / Math.max(1, wanted)) * Math.PI * 2;
    try {
      const citizen = player.dimension.spawnEntity(mc("villager_v2"), { x: realm.x + 0.5 + Math.cos(a) * 6, y: realm.y, z: realm.z + 6.5 + Math.sin(a) * 3 });
      citizen.addTag(tag);
      out++;
    } catch {
      // not loaded
    }
  }
  return out;
}

let beat = 0;
system.runInterval(() => {
  if (++beat % 10 !== 0) return;
  for (const player of world.getAllPlayers()) {
    try {
      populate(player);
    } catch {
      // the player is leaving
    }
  }
}, TICKS);

// ---------------------------------------------------------------- pages

/** @param {Player} player */
export function openDistricts(player) {
  const realm = realmOf(player);
  if (!realm) return;
  const keys = Object.keys(BUILDINGS);
  const form = new ActionFormData()
    .title("Districts")
    .body(
      "§7Eight plots lie outside your capital's walls, one for each building. Raise one from your capital: it is laid on its plot, and each level does more. Anything built on a plot is replaced.§r\n\n" +
        keys.map((k) => {
          const level = levelOf(realm, k);
          return `§e${BUILDINGS[k].name}§f ${level > 0 ? `level ${level}: ${BUILDINGS[k].help(level)}` : "§8not built"}`;
        }).join("\n")
    );
  for (const k of keys) {
    const level = levelOf(realm, k);
    if (level >= MAX_BUILDING) form.button(`§7${BUILDINGS[k].name}\ncomplete`);
    else {
      const cost = buildCost(level + 1);
      form.button(`${level === 0 ? "Build" : "Improve"} ${BUILDINGS[k].name}\n§8${cost.coins} coins, ${cost.crystals} crystals${cost.crests ? `, ${cost.crests} crests` : ""}`);
    }
  }
  form.button("Close");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      const key = keys[response.selection];
      if (!key) return;
      const level = levelOf(realm, key) + 1;
      if (level > MAX_BUILDING) {
        openDistricts(player);
        return;
      }
      const confirm = new ActionFormData()
        .title(`${BUILDINGS[key].name}, level ${level}`)
        .body(`§fLevel ${level}: ${BUILDINGS[key].help(level)}.\n\n§cThe plot ${BUILDINGS[key].plot[0] === 0 ? (BUILDINGS[key].plot[1] > 0 ? "south" : "north") : BUILDINGS[key].plot[0] > 0 ? "east" : "west"} of your capital is cleared and built anew.`)
        .button("§6Build")
        .button("Back");
      confirm
        .show(player)
        .then((r) => {
          if (r.canceled || r.selection === undefined || !player.isValid) return;
          if (r.selection === 0) notify(player, build(player, key));
          else openDistricts(player);
        })
        .catch(() => {});
    })
    .catch(() => {});
}

/** @param {Player} player */
export function openTrade(player) {
  const realm = realmOf(player);
  if (!realm) return;
  const list = routes(realm);
  const market = levelOf(realm, "market");
  const form = new ActionFormData()
    .title("Trade routes")
    .body(
      `§7Caravans run from your Market to your outposts and pay each kingdom day. Bandits raid a caravan now and then (§c${Math.round(raidChance(realm) * 100)}%§7 a day); Demiurge at court stops them.§r\n\n` +
        (market < 1 ? "§cBuild a Market first.\n" : `Routes: §6${list.length}/${2 * market}\n`) +
        list.map((k) => `§6${realm.outposts.find((o) => o.key === k)?.name}§f: ${routeValue(realm, k)} coins a day`).join("\n")
    );
  const open = realm.outposts.filter((o) => !list.includes(o.key));
  for (const o of open) form.button(`Open a route to the ${o.name}\n§8${ROUTE_COST} coins, ${routeValue(realm, o.key)} a day`);
  form.button("Close");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      const o = open[response.selection];
      if (o) notify(player, openRoute(player, o.key));
    })
    .catch(() => {});
}

/** @param {Player} player */
export function openEnvoys(player) {
  const realm = realmOf(player);
  if (!realm) return;
  const waiting = envoys(realm);
  const form = new ActionFormData()
    .title("Envoys")
    .body(
      "§7The powers of the New World send envoys to your throne. Allies send gifts each day; enemies harry your caravans, and an enemy Theocracy marches on you more often.§r\n\n" +
        Object.entries(POWERS).map(([k, info]) => {
          const s = standing(realm, k);
          return `${s === "allied" ? "§a" : s === "hostile" ? "§c" : "§7"}${info.name}: ${s} (${relations(realm)[k] ?? 0})`;
        }).join("\n")
    );
  for (const k of waiting) form.button(`Receive the envoy of the\n${POWERS[/** @type {keyof typeof POWERS} */ (k)].name}`);
  form.button("Close");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      const power = waiting[response.selection];
      if (!power) return;
      const info = POWERS[/** @type {keyof typeof POWERS} */ (power)];
      const ask = new ActionFormData()
        .title(info.name)
        .body(`§fThe envoy of the ${info.name} bows before your throne.\n\n§aAlliance§f: friendship grows; an ally sends gifts each day.\n§6Tribute§f: they pay now (${info.tribute.map(([i, n]) => `${n} ${i.split(":")[1].replace(/_/g, " ")}`).join(", ")}), but resent it.\n§7Dismiss§f: they leave, a little offended.`)
        .button("§aOffer an alliance")
        .button("§6Demand tribute")
        .button("§7Dismiss them");
      ask
        .show(player)
        .then((r) => {
          if (r.canceled || r.selection === undefined || !player.isValid) return;
          notify(player, answer(player, power, ["ally", "tribute", "dismiss"][r.selection]));
        })
        .catch(() => {});
    })
    .catch(() => {});
}
