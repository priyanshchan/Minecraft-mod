// Overlord: Tomb of Nazarick - the Sorcerer Kingdom.
//
// A player crowned at the end of the campaign (campaign.js) may found a kingdom: a capital raised
// from Nazarick's own stone where they stand, in four tiers, each grander and better defended than the
// last. Hostile camps they have cleared out (structures.js) can be claimed as outposts; a claimed camp
// posts no garrison of its own again. While the ruler is near, Death Knights stand guard at the capital
// and the outposts. The realm pays its ruler every kingdom day (twenty minutes of play) into a treasury
// collected from the Kingdom page or the Seal of the Sorcerer Kingdom, and its enemies come for it: an
// invasion strikes a holding the ruler is at, and an outpost that is not defended is lost.
//
// The realm lives in the ruler's profile (`realm`); which camps are claimed is kept by structures.js
// for the whole world, so two rulers can never hold the same camp.
import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { giveItem, grantXp, notify, profileOf, registerMenu, touch } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import { Builder, campAt, claim, claimOf, defendersLeft, isHostile, regionKey, stockChests, unclaim } from "./structures.js";
import { crowned } from "./campaign.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const mc = (/** @type {string} */ name) => `minecraft:${name}`;
const TICKS = 20;
const COIN = id("yggdrasil_gold_coin");
const CRYSTAL = id("data_crystal");
const CREST = id("guardian_crest");
export const SEAL = id("royal_seal");

/** Seconds of the ruler's play that make one kingdom day, when the realm pays out. */
export const DAY_SECONDS = 20 * 60;
/** The treasury holds at most this many days of income. */
export const TREASURY_DAYS = 5;
/** Seconds between the realm's checks (guards, income, invasions). */
export const PULSE = 5;
/** Guards are posted at a holding while the ruler is this close to it. */
const GUARD_RANGE = 64;
/** An invasion strikes only while the ruler is this close to the holding. */
const WATCH_RANGE = 48;
/** Seconds an invasion lasts before an undefended holding falls. */
export const SIEGE_SECONDS = 6 * 60;
/** Seconds between invasions, at least and at most. */
const RAID_GAP = [22 * 60, 36 * 60];
/** Blocks from a holding the ruler may go before an invasion there counts as abandoned. */
const SIEGE_LEASH = 96;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {{ key: string, name: string, x: number, y: number, z: number }} Outpost */
/**
 * @typedef {{
 *   name: string, x: number, y: number, z: number, tier: number, treasury: number, vault: number,
 *   clock: number, days: number, outposts: Outpost[], invasions: boolean, raidIn: number, renown: number,
 *   defended: number, lost: number,
 *   goods?: Record<string, number>, guardians?: Record<string, { loyalty: number }>, companion?: string,
 *   buildings?: Record<string, number>, population?: number, routes?: string[], relations?: Record<string, number>,
 *   envoys?: string[], raids?: number,
 * }} Realm
 * The fields marked ? belong to the court (court.js) and the districts (districts.js), added as they are used.
 */

/** The four tiers of a capital: its size, its price, what it pays, how many guard it and how many outposts it can hold. */
export const TIERS = [
  { name: "Throne Keep", radius: 11, height: 12, cost: { coins: 0, crystals: 0, crests: 0 }, income: 12, guards: 2, outposts: 3 },
  { name: "Walled Town", radius: 15, height: 12, cost: { coins: 200, crystals: 40, crests: 0 }, income: 24, guards: 3, outposts: 5 },
  { name: "Fortress City", radius: 19, height: 16, cost: { coins: 500, crystals: 100, crests: 2 }, income: 40, guards: 4, outposts: 7 },
  { name: "Sorcerous Capital", radius: 23, height: 22, cost: { coins: 1200, crystals: 250, crests: 4 }, income: 64, guards: 6, outposts: 10 },
];
/** What each outpost adds to a kingdom day's pay. */
const OUTPOST_INCOME = { coins: 8, crystals: 1 };
/** Guards at each outpost. */
const OUTPOST_GUARDS = 2;

/**
 * Who comes for the kingdom: three waves each.
 * @type {{ name: string, element: string, waves: [string, number][][] }[]}
 */
export const INVADERS = [
  {
    name: "The Slane Theocracy", element: "holy",
    waves: [[[id("theocracy_priest"), 4], [id("archangel_flame"), 3]], [[id("archangel_flame"), 4], [id("nigun"), 1]], [[id("dominion_authority"), 1], [id("theocracy_priest"), 2]]],
  },
  {
    name: "Jaldabaoth's Remnant", element: "fire",
    waves: [[[id("hellhound"), 5], [id("shadow_demon"), 2]], [[id("evil_lord_wrath"), 1], [id("shadow_demon"), 3]], [[id("evil_lord_wrath"), 1], [id("hellhound"), 4]]],
  },
  {
    name: "The Beastman Horde", element: "none",
    waves: [[[id("beastman"), 6]], [[id("beastman"), 5], [id("war_troll"), 2]], [[id("gigant_basilisk"), 1], [id("beastman"), 4]]],
  },
  {
    name: "The Quagoa and the Giants", element: "ice",
    waves: [[[id("quagoa"), 8]], [[id("frost_giant"), 2], [id("quagoa"), 4]], [[id("frost_dragon"), 1]]],
  },
];

// ------------------------------------------------------------------ the realm

/** The realm a player rules, or undefined. @param {Player} player @returns {Realm | undefined} */
export function realmOf(player) {
  const realm = /** @type {any} */ (profileOf(player).realm);
  return realm && typeof realm.x === "number" ? realm : undefined;
}

/** @param {Realm} realm */
function tierOf(realm) {
  return TIERS[Math.max(0, Math.min(TIERS.length, realm.tier) - 1)];
}

/**
 * Hooks through which the court (court.js) and the districts (districts.js) shape the realm without this
 * module importing them.
 * @type {{
 *   income: ((realm: Realm, pay: { coins: number, crystals: number }) => void)[],
 *   day: ((player: Player, realm: Realm) => void)[],
 *   capDays: ((realm: Realm) => number)[],
 *   guards: ((realm: Realm, capital: boolean) => number)[],
 *   guardPosted: ((realm: Realm, guard: import("@minecraft/server").Entity) => void)[],
 *   invader: ((realm: Realm, pick: number) => number | undefined)[],
 *   siege: ((realm: Realm, siege: Siege) => void)[],
 *   spoils: ((realm: Realm, spoils: number) => number)[],
 *   loot: ((realm: Realm, share: number) => number)[],
 *   repelled: ((player: Player, realm: Realm) => void)[],
 *   body: ((player: Player, realm: Realm) => string)[],
 *   menu: { label: (player: Player, realm: Realm) => string, open: (player: Player) => void }[],
 * }}
 */
export const realmHooks = { income: [], day: [], capDays: [], guards: [], guardPosted: [], invader: [], siege: [], spoils: [], loot: [], repelled: [], body: [], menu: [] };

/** What one kingdom day pays. @param {Realm} realm */
export function income(realm) {
  const pay = {
    coins: tierOf(realm).income + OUTPOST_INCOME.coins * realm.outposts.length,
    crystals: realm.tier + OUTPOST_INCOME.crystals * realm.outposts.length,
  };
  for (const hook of realmHooks.income) hook(realm, pay);
  pay.coins = Math.round(pay.coins);
  pay.crystals = Math.round(pay.crystals);
  return pay;
}

/** How many days of pay the treasury holds. @param {Realm} realm */
export function treasuryDays(realm) {
  return TREASURY_DAYS + realmHooks.capDays.reduce((n, hook) => n + hook(realm), 0);
}

/** The capital, and each outpost, as places. @param {Realm} realm */
export function holdings(realm) {
  return [{ name: `${realm.name} (capital)`, x: realm.x, y: realm.y, z: realm.z, outpost: -1 }, ...realm.outposts.map((o, i) => ({ name: o.name, x: o.x, y: o.y, z: o.z, outpost: i }))];
}

/** @param {Vector3} a @param {{ x: number, z: number }} b */
function flat(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** @param {Player} player */
function inOverworld(player) {
  return player.dimension.id === "minecraft:overworld" || player.dimension.id === "overworld";
}

// ------------------------------------------------------------------ the capital

/**
 * Lays the capital, tier by tier. Everything of a lower tier stands within a higher one, so an upgrade
 * lays the whole capital again, larger. Returns false when part of it is not loaded yet.
 * @param {Dimension} dimension @param {Vector3} at @param {number} tier
 */
export function layCapital(dimension, at, tier) {
  const t = TIERS[tier - 1];
  const r = t.radius;
  const b = new Builder(dimension, at);
  const brick = id("nazarick_bricks");
  const gilded = id("gilded_nazarick_bricks");
  const pillar = id("nazarick_pillar");
  const lamp = id("nazarick_lamp");
  const tiles = id("nazarick_tiles");
  try {
    // one layer at a time keeps every fill well inside the game's limit
    for (let y = -6; y <= -2; y++) b.fill(-r, y, -r, r, y, r, mc("dirt"));
    b.fill(-r, -1, -r, r, -1, r, tiles);
    for (let y = 0; y < t.height; y++) b.fill(-r, y, -r, r, y, r, mc("air"));

    // ----- tier 1: the Throne Keep
    b.house(-5, -9, 11, 9, { wall: brick, roof: gilded, floor: tiles, height: 5, door: "s", windows: false });
    b.fill(-1, 0, -8, 1, 0, -7, gilded); // the dais
    b.fill(0, 1, -8, 0, 2, -8, gilded); // the throne's back
    b.set(0, 3, -8, id("data_crystal_block"));
    b.set(0, 1, -7, mc("purple_carpet")); // the seat
    b.fill(0, 0, -6, 0, 0, -1, mc("purple_carpet")); // the runner to the door
    for (const x of [-3, 3]) for (const z of [-6, -3]) b.column(x, z, 3, pillar, lamp);
    for (const x of [-4, 4]) b.fill(x, 1, -8, x, 3, -8, mc("purple_wool")); // banners on the back wall
    b.path(-1, 0, 1, r, gilded);
    for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) b.column(x, z, 3, pillar, lamp);
    b.flag(-6, 3, mc("purple_wool"), mc("dark_oak_fence"));
    b.flag(4, 3, mc("purple_wool"), mc("dark_oak_fence"));
    for (const x of [-4, 4]) b.set(x, 0, 9, mc("soul_campfire"));
    b.chest(4, 0, -2, [[CRYSTAL, 2, 4], [COIN, 4, 8]]);
    if (tier === 1) {
      b.walls(-r, 0, -r, r, 0, r, brick);
      b.fill(-1, 0, r, 1, 0, r, mc("air"));
      stockChests(dimension, b.chests);
      return true;
    }

    // ----- tier 2: the Walled Town
    for (const [x, door] of /** @type {[number, "e" | "w"][]} */ ([[-13, "e"], [9, "w"]])) {
      b.house(x, -5, 5, 5, { wall: mc("stone_bricks"), roof: mc("deepslate_bricks"), floor: mc("smooth_stone"), door });
      b.house(x, 3, 5, 5, { wall: mc("stone_bricks"), roof: mc("deepslate_bricks"), floor: mc("smooth_stone"), door });
    }
    b.stall(-7, 8, mc("purple_wool"));
    b.stall(5, 8, mc("black_wool"));
    b.well(-6, 1);
    if (tier === 2) {
      b.fort(14, 4, brick, { gate: 2 });
      stockChests(dimension, b.chests);
      return true;
    }

    // ----- tier 3: the Fortress City
    b.fort(14, 4, brick, { gate: 2 });
    for (const x of [-7, 7]) b.spire(x, -7, 11, brick, lamp);
    if (tier === 3) {
      b.fort(18, 6, brick, { gate: 2, towers: 4 });
      stockChests(dimension, b.chests);
      return true;
    }

    // ----- tier 4: the Sorcerous Capital
    b.fort(18, 6, brick, { gate: 2, towers: 4, towerBlock: gilded });
    b.spire(0, -12, 20, brick, id("data_crystal_block"));
    b.fill(-1, 0, -12, 1, 0, -10, gilded);
    for (let t = -18; t <= 18; t += 6) {
      // a colonnade outside the walls, open at the approach
      for (const [x, z] of [[t, -21], [-21, t], [21, t], [t, 21]]) {
        if (z === 21 && Math.abs(x) <= 4) continue;
        b.column(x, z, 4, pillar, lamp);
      }
    }
    for (const x of [-3, 3]) b.column(x, 21, 6, gilded, mc("soul_lantern")); // the gate pylons
    stockChests(dimension, b.chests);
    return true;
  } catch {
    return false; // part of it is not loaded yet
  }
}

/**
 * Founds the kingdom where the player stands. Returns a message describing the outcome.
 * @param {Player} player @param {string} [name]
 */
export function found(player, name) {
  if (!crowned(player)) return "§7Only one crowned at the end of the campaign may found a kingdom";
  if (realmOf(player)) return "§7You already rule a kingdom";
  if (!inOverworld(player)) return "§7A kingdom can only be founded in the overworld";
  const at = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const camp = campAt(at);
  if (camp && flat(at, camp) < camp.type.radius + TIERS[3].radius + 4) return `§7Too close to the ${camp.type.name}: find open land`;
  if (!layCapital(player.dimension, at, 1)) return "§7Part of the land is not loaded yet: stand still a moment and try again";
  /** @type {Realm} */
  const realm = {
    name: (name ?? "").trim().slice(0, 32) || `Sorcerer Kingdom of ${player.name}`, ...at, tier: 1, treasury: 0, vault: 0,
    clock: 0, days: 0, outposts: [], invasions: true, raidIn: RAID_GAP[0], renown: 0, defended: 0, lost: 0,
  };
  profileOf(player).realm = realm;
  touch(player);
  try {
    player.teleport({ x: at.x + 0.5, y: at.y, z: at.z + 3.5 });
  } catch {
    // stays where they are
  }
  fx.nova(player.dimension, { x: at.x + 0.5, y: at.y + 1, z: at.z + 0.5 }, "dark", 10);
  fx.pillar(player.dimension, { x: at.x + 0.5, y: at.y, z: at.z - 6.5 }, "holy", 9);
  try {
    player.onScreenDisplay.setTitle(`§5${realm.name}`, { subtitle: "§6A new kingdom rises", fadeInDuration: 5, stayDuration: 70, fadeOutDuration: 15 });
    player.playSound("random.totem", { volume: 1, pitch: 0.8 });
  } catch {
    // cosmetic only
  }
  world.sendMessage(`§6[Overlord] §e${player.name} §ffounded §5${realm.name}§f!`);
  return `§5${realm.name} is founded`;
}

/** What raising the capital to its next tier costs, or undefined at the top. @param {Realm} realm */
export function nextTier(realm) {
  return TIERS[realm.tier];
}

/**
 * Raises the capital one tier, rebuilding it larger. Returns a message describing the outcome.
 * @param {Player} player
 */
export function upgrade(player) {
  const realm = realmOf(player);
  if (!realm) return "§7You rule no kingdom";
  const next = nextTier(realm);
  if (!next) return "§7Your capital is already a Sorcerous Capital";
  if (!inOverworld(player) || flat(player.location, realm) > 16) return "§7Stand in your capital's courtyard to raise it";
  const { coins, crystals, crests } = next.cost;
  if (countItem(player, COIN) < coins || countItem(player, CRYSTAL) < crystals || countItem(player, CREST) < crests) {
    return `§7Raising it to a ${next.name} costs ${coins} Gold Coins, ${crystals} Data Crystals${crests ? ` and ${crests} Guardian Crests` : ""}`;
  }
  if (!layCapital(player.dimension, realm, realm.tier + 1)) return "§7Part of the land is not loaded yet: stand still a moment and try again";
  takeItem(player, COIN, coins);
  takeItem(player, CRYSTAL, crystals);
  if (crests) takeItem(player, CREST, crests);
  realm.tier += 1;
  touch(player);
  try {
    player.teleport({ x: realm.x + 0.5, y: realm.y, z: realm.z + 3.5 });
  } catch {
    // stays where they are
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    fx.pillar(player.dimension, { x: realm.x + Math.cos(a) * next.radius * 0.6, y: realm.y, z: realm.z + Math.sin(a) * next.radius * 0.6 }, "dark", 8);
  }
  try {
    player.onScreenDisplay.setTitle(`§5${next.name}`, { subtitle: `§6${realm.name} grows`, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
  } catch {
    // cosmetic only
  }
  return `§5Your capital is now a ${next.name}`;
}

// ------------------------------------------------------------------ outposts

/**
 * Claims the cleared hostile camp the player stands in as an outpost. Returns a message.
 * @param {Player} player
 */
export function claimHere(player) {
  const realm = realmOf(player);
  if (!realm) return "§7You rule no kingdom";
  if (!inOverworld(player)) return "§7Outposts can only be claimed in the overworld";
  const camp = campAt(player.location);
  if (!camp || flat(player.location, camp) > camp.type.radius + 8) return "§7Stand in a camp you have cleared to claim it";
  if (!isHostile(camp.type)) return `§7The ${camp.type.name} is friendly: only enemy camps can be taken`;
  const key = regionKey(camp);
  const holder = claimOf(key);
  if (holder) return holder === player.id ? "§7This camp is already yours" : "§7Another ruler holds this camp";
  const left = defendersLeft(player.dimension, camp);
  if (left > 0) return `§c${left} defender(s) still hold the ${camp.type.name}`;
  const most = tierOf(realm).outposts;
  if (realm.outposts.length >= most) return `§7A ${tierOf(realm).name} can hold ${most} outposts: raise your capital for more`;
  claim(key, player.id);
  realm.outposts.push({ key, name: camp.type.name, x: camp.x, y: camp.y, z: camp.z });
  touch(player);
  try {
    const b = new Builder(player.dimension, camp);
    b.flag(1, 1, mc("purple_wool"), mc("dark_oak_fence"));
  } catch {
    // the banner is a courtesy
  }
  fx.ring(player.dimension, { x: camp.x + 0.5, y: camp.y, z: camp.z + 0.5 }, "dark", 6);
  fx.pillar(player.dimension, { x: camp.x + 0.5, y: camp.y, z: camp.z + 0.5 }, "dark", 7);
  return `§5The ${camp.type.name} is now an outpost of ${realm.name}`;
}

/** Gives up an outpost. @param {Player} player @param {number} index */
export function abandon(player, index) {
  const realm = realmOf(player);
  const outpost = realm?.outposts[index];
  if (!realm || !outpost) return "§7No such outpost";
  realm.outposts.splice(index, 1);
  if (claimOf(outpost.key) === player.id) unclaim(outpost.key);
  touch(player);
  return `§7You gave up the ${outpost.name}`;
}

// ------------------------------------------------------------------ the treasury

/** Hands the treasury to the ruler. @param {Player} player */
export function collect(player) {
  const realm = realmOf(player);
  if (!realm) return "§7You rule no kingdom";
  const goods = /** @type {Record<string, number>} */ (realm.goods ?? {});
  const wares = Object.values(goods).reduce((n, v) => n + v, 0);
  if (realm.treasury <= 0 && realm.vault <= 0 && wares <= 0) return "§7The treasury is empty";
  const coins = realm.treasury;
  const crystals = realm.vault;
  if (coins > 0) giveItem(player, COIN, coins);
  if (crystals > 0) giveItem(player, CRYSTAL, crystals);
  for (const [item, count] of Object.entries(goods)) if (count > 0) giveItem(player, item, count);
  realm.treasury = 0;
  realm.vault = 0;
  realm.goods = {};
  touch(player);
  return `§6Collected ${coins} Gold Coins and ${crystals} Data Crystals${wares > 0 ? ` and ${wares} goods` : ""}`;
}

/** Counts the ruler's time and pays each kingdom day. @param {Player} player @param {Realm} realm @param {number} seconds */
export function accrue(player, realm, seconds) {
  realm.clock += seconds;
  let paid = false;
  while (realm.clock >= DAY_SECONDS) {
    realm.clock -= DAY_SECONDS;
    const pay = income(realm);
    const days = treasuryDays(realm);
    realm.treasury = Math.min(pay.coins * days, realm.treasury + pay.coins);
    realm.vault = Math.min(pay.crystals * days, realm.vault + pay.crystals);
    realm.days += 1;
    paid = true;
    for (const hook of realmHooks.day) {
      try {
        hook(player, realm);
      } catch (error) {
        console.warn(`[Overlord] a kingdom day hook failed: ${error}`);
      }
    }
  }
  if (paid) {
    touch(player);
    try {
      player.sendMessage(`§6[Kingdom] §fTaxes from ${realm.name} have reached the treasury: §6${realm.treasury} Gold Coins§f, §b${realm.vault} Data Crystals§f waiting. §7(Kingdom page or the Seal)`);
    } catch {
      // the player left
    }
  }
  return paid;
}

// ------------------------------------------------------------------ guards

/** @param {Player} player */
function guardTag(player) {
  return `overlord_realm_${player.id}`;
}

/**
 * Tops up the guards at one holding. Returns how many were posted.
 * @param {Player} player @param {Vector3} at @param {number} wanted @param {number} tier
 * @param {boolean} [courtyard] the capital's guards stand in its courtyard, an outpost's round its middle
 * @param {Realm} [realm]
 */
export function postGuards(player, at, wanted, tier, courtyard = false, realm = undefined) {
  const tag = guardTag(player);
  const center = { x: at.x + 0.5, y: at.y, z: at.z + 0.5 };
  let present = 0;
  try {
    present = player.dimension.getEntities({ tags: [tag], location: center, maxDistance: 32 }).length;
  } catch {
    return 0;
  }
  let posted = 0;
  for (let i = present; i < wanted; i++) {
    const angle = (i / Math.max(wanted, 1)) * Math.PI * 2;
    const spot = courtyard
      ? { x: center.x + Math.cos(angle) * 5, y: at.y, z: center.z + 4 + Math.sin(angle) * 3 }
      : { x: center.x + Math.cos(angle) * 3, y: at.y, z: center.z + Math.sin(angle) * 3 };
    const type = tier >= 4 && i === wanted - 1 ? id("behemoth") : id("death_knight");
    try {
      const guard = player.dimension.spawnEntity(type, spot, { spawnEvent: `${NS}:become_summoned` });
      guard.addTag(tag);
      guard.addTag("overlord_guard");
      if (realm) for (const hook of realmHooks.guardPosted) hook(realm, guard);
      fx.rise(player.dimension, spot, "dark", 0.7);
      posted++;
    } catch {
      // not loaded
    }
  }
  return posted;
}

// ------------------------------------------------------------------ invasions

/**
 * @typedef {{
 *   ruler: Player, rulerId: string, holding: number, at: Vector3, name: string, foe: typeof INVADERS[number],
 *   wave: number, until: number, tag: string, scale: number,
 * }} Siege
 */
/** @type {Map<string, Siege>} */
export const sieges = new Map();

/** @param {Siege} siege */
function invaders(siege) {
  try {
    return siege.ruler.dimension.getEntities({ tags: [siege.tag] }).filter((e) => {
      try {
        const health = e.getComponent("minecraft:health");
        return e.isValid && (!health || health.currentValue > 0);
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/** A spot on the ground near a height. @param {Dimension} dimension @param {number} x @param {number} z @param {number} y */
function ground(dimension, x, z, y) {
  try {
    const top = dimension.getTopmostBlock({ x, z });
    if (top && Math.abs(top.location.y + 1 - y) <= 8) return { x, y: top.location.y + 1, z };
  } catch {
    // not loaded
  }
  return { x, y, z };
}

/** @param {Siege} siege */
function spawnWave(siege) {
  const wave = siege.foe.waves[siege.wave];
  const total = wave.reduce((n, [, count]) => n + count, 0);
  let index = 0;
  for (const [type, count] of wave) {
    for (let i = 0; i < Math.max(1, Math.round(count * siege.scale)); i++, index++) {
      const angle = (index / total) * Math.PI * 2 + siege.wave;
      const spot = ground(siege.ruler.dimension, siege.at.x + 0.5 + Math.cos(angle) * 12, siege.at.z + 0.5 + 16 + Math.sin(angle) * 4, siege.at.y);
      try {
        const foe = siege.ruler.dimension.spawnEntity(type, spot);
        foe.addTag(siege.tag);
        foe.addTag("overlord_invader");
        fx.pillar(siege.ruler.dimension, spot, siege.foe.element, 3, 0.9);
      } catch {
        // not loaded
      }
    }
  }
  try {
    siege.ruler.onScreenDisplay.setTitle(`§c${siege.foe.name}`, { subtitle: `§7Wave ${siege.wave + 1}/${siege.foe.waves.length} at ${siege.name}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
    siege.ruler.playSound("raid.horn", { volume: 1, pitch: 0.9 });
  } catch {
    // cosmetic only
  }
}

/** Who marches: the hooks may choose (diplomacy), else chance. @param {Realm} realm @param {number} pick */
function chooseInvader(realm, pick) {
  for (const hook of realmHooks.invader) {
    const chosen = hook(realm, pick);
    if (chosen !== undefined && INVADERS[chosen]) return chosen;
  }
  return Math.floor(pick * INVADERS.length) % INVADERS.length;
}

/**
 * Sends an invasion against one of the ruler's holdings.
 * @param {Player} player @param {Realm} realm @param {number} holding -1 for the capital, else the outpost's index @param {number} now @param {number} [pick]
 */
export function invade(player, realm, holding, now, pick = Math.random()) {
  const place = holdings(realm)[holding + 1];
  if (!place || sieges.has(player.id)) return undefined;
  /** @type {Siege} */
  const siege = {
    ruler: player, rulerId: player.id, holding, at: { x: place.x, y: place.y, z: place.z }, name: holding < 0 ? realm.name : `the ${place.name}`,
    foe: INVADERS[chooseInvader(realm, pick)], wave: 0, until: now + SIEGE_SECONDS * TICKS, tag: `overlord_siege_${player.id}`, scale: 1,
  };
  for (const hook of realmHooks.siege) hook(realm, siege);
  sieges.set(player.id, siege);
  player.sendMessage(`§6[Kingdom] §c${siege.foe.name} march on ${siege.name}! §fDefeat three waves within ${SIEGE_SECONDS / 60} minutes${holding >= 0 ? " or the outpost is lost" : ""}.`);
  spawnWave(siege);
  return siege;
}

/** @param {Siege} siege */
function clearSiege(siege) {
  sieges.delete(siege.rulerId);
  for (const e of invaders(siege)) {
    try {
      e.remove();
    } catch {
      // already gone
    }
  }
}

/** @param {Siege} siege @param {string} reason */
export function loseSiege(siege, reason) {
  clearSiege(siege);
  const player = siege.ruler;
  if (!player.isValid) return;
  const realm = realmOf(player);
  if (!realm) return;
  realm.lost += 1;
  let what;
  if (siege.holding < 0) {
    const share = realmHooks.loot.reduce((s, hook) => hook(realm, s), 0.3);
    const looted = Math.floor(realm.treasury * share);
    realm.treasury -= looted;
    what = `They looted ${looted} Gold Coins from the treasury.`;
  } else {
    const outpost = realm.outposts[siege.holding];
    if (outpost) abandon(player, siege.holding);
    what = `The ${outpost?.name ?? "outpost"} is lost.`;
  }
  touch(player);
  try {
    player.onScreenDisplay.setTitle("§4The invaders prevail", { subtitle: `§7${reason}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
    player.sendMessage(`§6[Kingdom] §c${siege.foe.name} prevailed at ${siege.name}: ${reason}. ${what}`);
  } catch {
    // the player left
  }
}

/** @param {Siege} siege */
function winSiege(siege) {
  clearSiege(siege);
  const player = siege.ruler;
  const realm = realmOf(player);
  if (!realm) return;
  const spoils = Math.round(realmHooks.spoils.reduce((n, hook) => hook(realm, n), 20 + 10 * realm.tier));
  realm.renown += 1;
  realm.defended += 1;
  realm.treasury += spoils;
  touch(player);
  try {
    player.onScreenDisplay.setTitle("§6The realm stands", { subtitle: `§e${siege.foe.name} are routed`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
    player.sendMessage(`§6[Kingdom] §f${siege.name} held against ${siege.foe.name}! §6+${spoils} Gold Coins§f to the treasury, §d+1 renown§f.`);
    player.playSound("random.totem", { volume: 1, pitch: 1.1 });
  } catch {
    // the player left
  }
  grantXp(player, 2500 * realm.tier, "invasion repelled");
  for (const hook of realmHooks.repelled) hook(player, realm);
}

/** Advances an invasion. @param {Siege} siege @param {number} now */
export function stepSiege(siege, now) {
  const player = siege.ruler;
  if (!player.isValid) {
    clearSiege(siege);
    return;
  }
  if (flat(player.location, siege.at) > SIEGE_LEASH) {
    loseSiege(siege, "you abandoned it");
    return;
  }
  if (invaders(siege).length > 0) {
    if (now > siege.until) loseSiege(siege, "time ran out");
    return;
  }
  siege.wave += 1;
  if (siege.wave >= siege.foe.waves.length) winSiege(siege);
  else spawnWave(siege);
}

// ------------------------------------------------------------------ the pulse

/**
 * One check of a ruler's realm: guards, income and invasions.
 * @param {Player} player @param {number} now @param {() => number} [random]
 */
export function pulse(player, now, random = Math.random) {
  const realm = realmOf(player);
  if (!realm) return;
  accrue(player, realm, PULSE);
  if (!inOverworld(player)) return;
  const tier = tierOf(realm);
  const places = holdings(realm);
  let near = -2;
  for (const place of places) {
    const distance = flat(player.location, place);
    if (distance > GUARD_RANGE) continue;
    const extra = realmHooks.guards.reduce((n, hook) => n + hook(realm, place.outpost < 0), 0);
    postGuards(player, place, (place.outpost < 0 ? tier.guards : OUTPOST_GUARDS) + extra, realm.tier, place.outpost < 0, realm);
    if (distance <= WATCH_RANGE && near === -2) near = place.outpost;
  }
  if (!realm.invasions || sieges.has(player.id) || near === -2) return;
  realm.raidIn -= PULSE;
  if (realm.raidIn > 0) return;
  realm.raidIn = RAID_GAP[0] + Math.floor(random() * (RAID_GAP[1] - RAID_GAP[0]));
  touch(player);
  invade(player, realm, near, now, random());
}

let beat = 0;
system.runInterval(() => {
  const now = system.currentTick;
  for (const siege of [...sieges.values()]) {
    try {
      stepSiege(siege, now);
    } catch (error) {
      console.warn(`[Overlord] the invasion tick failed: ${error}`);
    }
  }
  if (++beat % PULSE !== 0) return;
  for (const player of world.getAllPlayers()) {
    try {
      pulse(player, now);
    } catch (error) {
      console.warn(`[Overlord] the kingdom tick failed: ${error}`);
    }
  }
}, TICKS);

world.afterEvents.entityDie.subscribe((event) => {
  try {
    if (event.deadEntity.typeId !== "minecraft:player") return;
    const siege = sieges.get(event.deadEntity.id);
    if (siege) loseSiege(siege, "the ruler fell");
  } catch {
    // nothing to do
  }
});

world.afterEvents.playerLeave.subscribe((event) => {
  const siege = sieges.get(event.playerId);
  if (siege) clearSiege(siege);
});

// ------------------------------------------------------------------ the Kingdom page

/** @param {number} seconds */
function clockText(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** @param {Player} player */
export function openKingdom(player) {
  const realm = realmOf(player);
  if (!realm) {
    openFounding(player);
    return;
  }
  const tier = tierOf(realm);
  const next = nextTier(realm);
  const pay = income(realm);
  const siege = sieges.get(player.id);
  const form = new ActionFormData()
    .title(realm.name)
    .body(
      `§fCapital: §5${tier.name}§f (tier ${realm.tier}/4) at ${realm.x}, ${realm.y}, ${realm.z}\n` +
        `§fOutposts: §e${realm.outposts.length}/${tier.outposts}§f   Guards at the capital: §7${tier.guards}\n` +
        `§fTreasury: §6${realm.treasury} Gold Coins§f, §b${realm.vault} Data Crystals\n` +
        `§fEach kingdom day pays §6${pay.coins}§f coins and §b${pay.crystals}§f crystals; next in §e${clockText(DAY_SECONDS - realm.clock)}§f of play.\n` +
        `§fRenown: §d${realm.renown}§f   Invasions repelled: §a${realm.defended}§f, lost: §c${realm.lost}\n` +
        `§fInvasions: ${realm.invasions ? "§con" : "§7off"}` +
        realmHooks.body.map((hook) => hook(player, realm)).join("") +
        (siege ? `\n\n§c${siege.foe.name} are attacking ${siege.name}! Wave ${siege.wave + 1}/${siege.foe.waves.length}.` : "")
    );
  /** @type {[string, () => void][]} */
  const actions = [
    [`Collect the treasury\n§6${realm.treasury} coins, ${realm.vault} crystals`, () => notify(player, collect(player))],
    [
      next ? `Raise the capital: ${next.name}\n§7${next.cost.coins} coins, ${next.cost.crystals} crystals${next.cost.crests ? `, ${next.cost.crests} crests` : ""}` : "§7The capital is complete",
      () => (next ? confirmUpgrade(player) : openKingdom(player)),
    ],
    ["Claim this camp as an outpost", () => notify(player, claimHere(player))],
    [`Holdings and travel (${realm.outposts.length + 1})`, () => openHoldings(player)],
    [realm.invasions ? "Turn invasions off" : "Turn invasions on", () => {
      realm.invasions = !realm.invasions;
      touch(player);
      notify(player, realm.invasions ? "§cYour enemies will test your kingdom" : "§7Your kingdom is left in peace");
      openKingdom(player);
    }],
    ...realmHooks.menu.map((m) => /** @type {[string, () => void]} */ ([m.label(player, realm), () => m.open(player)])),
    ["Rename the kingdom", () => openRename(player)],
    ["How it works", () => openKingdomHelp(player)],
  ];
  for (const [label] of actions) form.button(label);
  form.button("Close");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      actions[response.selection]?.[1]();
    })
    .catch(() => {});
}

/** @param {Player} player */
function openFounding(player) {
  const ready = crowned(player);
  const form = new ActionFormData()
    .title("The Sorcerer Kingdom")
    .body(
      ready
        ? `§fYou were crowned Sorcerer King. Found your kingdom: a ${TIERS[0].name} of Nazarick's stone rises where you stand, clearing about ${TIERS[0].radius * 2 + 1} by ${TIERS[0].radius * 2 + 1} blocks (up to ${TIERS[3].radius * 2 + 1} by ${TIERS[3].radius * 2 + 1} once fully raised).\n\n§cAnything built there now is replaced. §fChoose open, flat land away from camps.`
        : "§7Only one crowned at the end of the campaign may found a kingdom. Finish all ten chapters of the Chronicle, Rise of the Sorcerer King."
    );
  form.button(ready ? "§5Found the kingdom here" : "Back");
  form.button("Close");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection !== 0 || !player.isValid || !ready) return;
      notify(player, found(player));
    })
    .catch(() => {});
}

/** @param {Player} player */
function confirmUpgrade(player) {
  const realm = realmOf(player);
  const next = realm && nextTier(realm);
  if (!realm || !next) return;
  const form = new ActionFormData()
    .title(`Raise to ${next.name}`)
    .body(
      `§fYour capital is laid again, larger: ${next.radius * 2 + 1} by ${next.radius * 2 + 1} blocks around its centre. §cAnything you built inside that square is replaced.\n\n` +
        `§fCost: §6${next.cost.coins} Gold Coins§f, §b${next.cost.crystals} Data Crystals§f${next.cost.crests ? `, §d${next.cost.crests} Guardian Crests` : ""}§f.\n` +
        `§fA ${next.name} pays §6${next.income}§f coins a day, posts ${next.guards} guards and holds ${next.outposts} outposts.\n\n§7Stand in your capital's courtyard.`
    )
    .button("§5Raise it")
    .button("Back");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      if (response.selection === 0) notify(player, upgrade(player));
      else openKingdom(player);
    })
    .catch(() => {});
}

/** @param {Player} player */
function openHoldings(player) {
  const realm = realmOf(player);
  if (!realm) return;
  const places = holdings(realm);
  const form = new ActionFormData().title("Holdings").body("§7Travel to any of your holdings for free, or give up an outpost.");
  for (const place of places) form.button(`${place.name}\n${Math.round(flat(player.location, place))} blocks away`);
  if (realm.outposts.length > 0) form.button("§cGive up an outpost");
  form.button("Back");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      const place = places[response.selection];
      if (place) {
        if (!inOverworld(player)) {
          notify(player, "§7You can only travel within the overworld");
          return;
        }
        player.teleport({ x: place.x + 0.5, y: place.y, z: place.z + 3.5 });
        fx.wash(player, { red: 0.4, green: 0.1, blue: 0.6 }, 0.6);
        notify(player, `§5You arrive at ${place.name}`);
      } else if (response.selection === places.length && realm.outposts.length > 0) openAbandon(player);
      else openKingdom(player);
    })
    .catch(() => {});
}

/** @param {Player} player */
function openAbandon(player) {
  const realm = realmOf(player);
  if (!realm) return;
  const form = new ActionFormData().title("Give up an outpost").body("§7The camp returns to the wild, and its old garrison with it.");
  for (const o of realm.outposts) form.button(o.name);
  form.button("Back");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      if (response.selection < realm.outposts.length) notify(player, abandon(player, response.selection));
      else openHoldings(player);
    })
    .catch(() => {});
}

/** @param {Player} player */
function openRename(player) {
  const realm = realmOf(player);
  if (!realm) return;
  new ModalFormData()
    .title("Rename the kingdom")
    .textField("Name", "Sorcerer Kingdom", { defaultValue: realm.name })
    .show(player)
    .then((response) => {
      if (response.canceled || !response.formValues || !player.isValid) return;
      const name = String(response.formValues[0] ?? "").trim().slice(0, 32);
      if (!name) return;
      realm.name = name;
      touch(player);
      notify(player, `§5Your kingdom is now ${name}`);
    })
    .catch(() => {});
}

/** @param {Player} player */
function openKingdomHelp(player) {
  const form = new ActionFormData()
    .title("Ruling a kingdom")
    .body(
      [
        "§6Capital§f: four tiers - Throne Keep, Walled Town, Fortress City, Sorcerous Capital. Each tier is larger, pays more and holds more outposts. Raise it from its courtyard.",
        `§6Outposts§f: clear an enemy camp, stand in it and claim it. It never posts an enemy garrison again and adds ${OUTPOST_INCOME.coins} coins and ${OUTPOST_INCOME.crystals} crystal to each day's pay.`,
        `§6Treasury§f: every ${DAY_SECONDS / 60} minutes of play is a kingdom day and pays into the treasury, which holds ${TREASURY_DAYS} days. Collect it here or with the Seal of the Sorcerer Kingdom.`,
        "§6Guards§f: while you are near, Death Knights stand guard at the capital and at each outpost.",
        `§6Invasions§f: now and then an enemy marches on the holding you are at. Beat three waves within ${SIEGE_SECONDS / 60} minutes for coins, XP and renown. Fail and an outpost is lost, or the capital's treasury looted. They can be turned off.`,
      ].join("\n\n")
    )
    .button("Back");
  form
    .show(player)
    .then((response) => {
      if (!response.canceled && player.isValid) openKingdom(player);
    })
    .catch(() => {});
}

registerMenu((player) => {
  const realm = realmOf(player);
  return realm ? `Kingdom\n§5${realm.name}` : crowned(player) ? "Kingdom\n§5Found your kingdom" : "Kingdom\n§8Finish the campaign";
}, openKingdom);

world.afterEvents.itemUse.subscribe((event) => {
  try {
    if (event.itemStack?.typeId !== SEAL) return;
    const player = event.source;
    if (player.isSneaking && realmOf(player)) notify(player, collect(player));
    else openKingdom(player);
  } catch (error) {
    console.warn(`[Overlord] the seal failed: ${error}`);
  }
});
