// Overlord: Tomb of Nazarick - world events.
//
// Every so often the world stirs. A world event is proclaimed to every player - the Battle of Katze Plains,
// the Theocracy's Crusade, the Demon Plague or the Dragon Descent - at a place out in the world, with a
// two-minute warning and directions from wherever each player stands. When a player reaches it, the event
// begins: waves of its foes (with allies, at Katze) and then its boss. Every foe slain there scores for the
// player who slew it (or whose party member or raised undead did); when the boss falls, everyone who fought
// is paid in XP, Gold Coins and Medals of Valor by their score, and the best of them earns more. Medals buy
// rare things at the World Events page of the Adventurer's Plate. An event nobody reaches in time, or that
// is not won within its time, passes.
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { giveItem, grantXp, notify, profileOf, registerMenu, touch } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
export const MEDAL = id("medal_of_valor");
export const EVENT_TAG = "overlord_event";
/** Ticks between events, at least and at most; the first comes after the shorter. */
export const GAP = [30 * 60 * TICKS, 45 * 60 * TICKS];
/** The warning before an event can begin, how long it waits to be reached, and how long it may run. */
export const WARNING = 120 * TICKS;
export const WAIT = 8 * 60 * TICKS;
export const RUN = 10 * 60 * TICKS;
/** A player this near the event's centre begins it and fights in it. */
export const REACH = 48;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {[string, number][]} Wave */

/**
 * The world events: their foes in waves, their boss, allies who fight beside the players, and the title
 * earned by those who see one through.
 * @type {Record<string, { name: string, element: string, tale: string, allies: Wave, waves: Wave[], boss: Wave, title: string }>}
 */
export const EVENTS = {
  katze: {
    name: "The Battle of Katze Plains", element: "dark", title: "Hero of Katze",
    tale: "The fog of Katze rolls out across the land, and the dead march in it. The Empire's knights ride to hold the line.",
    allies: [[id("imperial_knight"), 4]],
    waves: [[[id("ghoul"), 6], [id("skeleton_archer"), 3]], [[id("wraith"), 3], [id("ghoul"), 4], [id("death_cavalier"), 1]],
      [[id("death_cavalier"), 2], [id("skeleton_archer"), 4], [id("wraith"), 2]]],
    boss: [[id("skeletal_dragon"), 1], [id("death_cavalier"), 2]],
  },
  crusade: {
    name: "The Theocracy's Crusade", element: "holy", title: "Crusade Breaker",
    tale: "The Slane Theocracy has declared a crusade. Its priests and angels march to cleanse the land.",
    allies: [],
    waves: [[[id("theocracy_priest"), 5], [id("archangel_flame"), 2]], [[id("archangel_flame"), 4], [id("theocracy_priest"), 3]],
      [[id("nigun"), 1], [id("archangel_flame"), 3]]],
    boss: [[id("dominion_authority"), 1], [id("archangel_flame"), 2]],
  },
  plague: {
    name: "The Demon Plague", element: "fire", title: "Plaguebane",
    tale: "A rift to the abyss has torn open. Demons pour out of it in a burning tide.",
    allies: [],
    waves: [[[id("hellhound"), 6]], [[id("shadow_demon"), 4], [id("hellhound"), 3]], [[id("evil_lord_wrath"), 1], [id("shadow_demon"), 3]]],
    boss: [[id("jaldabaoth"), 1]],
  },
  dragons: {
    name: "The Dragon Descent", element: "ice", title: "Dragonwatch",
    tale: "Frost dragons descend from the mountains with the quagoa clans and the giants in their wake.",
    allies: [],
    waves: [[[id("quagoa"), 7]], [[id("frost_giant"), 2], [id("quagoa"), 4]]],
    boss: [[id("frost_dragon"), 2]],
  },
};
export const KINDS = Object.keys(EVENTS);

/** What medals buy at the World Events page: item, how many, price in medals. */
/** @type {[string, string, number, number][]} */
export const SHOP = [
  ["Data Crystals", id("data_crystal"), 16, 4],
  ["Refining Stones", id("refining_stone"), 4, 3],
  ["Sunstone", id("gem_sunstone"), 1, 5],
  ["Guardian Crest", id("guardian_crest"), 1, 6],
  ["Book of the Dead", id("book_of_the_dead"), 1, 8],
  ["Codex of the Supreme Beings", id("codex_of_skills"), 1, 12],
  ["Barding of Nazarick", id("nazarick_barding"), 1, 15],
  ["Whistle of the Nazarick Wyrm", id("wyrm_whistle"), 1, 20],
];

/**
 * The event in the world, if any.
 * @typedef {{
 *   kind: string, at: Vector3, dimension: Dimension, phase: "warning" | "waiting" | "battle" | "boss",
 *   since: number, began: number, wave: number, scores: Record<string, number>, names: Record<string, string>,
 * }} Event
 */
/** @type {{ current: Event | undefined, next: number, enabled: boolean, last: string }} */
export const state = { current: undefined, next: GAP[0], enabled: true, last: "" };

/** Turns the scheduler on or off (events already running go on). @param {boolean} on */
export function setEnabled(on) {
  state.enabled = on;
}

/** @param {Player} player */
function inOverworld(player) {
  return player.dimension.id === "minecraft:overworld";
}

/** "north-east", "south"... from one place to another. @param {Vector3} from @param {Vector3} to */
export function heading(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz) || 1;
  const ns = dz < -distance * 0.38 ? "north" : dz > distance * 0.38 ? "south" : "";
  const ew = dx > distance * 0.38 ? "east" : dx < -distance * 0.38 ? "west" : "";
  return ns && ew ? `${ns}-${ew}` : ns || ew || "here";
}

/** @param {string} text */
function tellAll(text) {
  try {
    world.sendMessage(text);
  } catch {
    // no chat
  }
}

/**
 * Proclaims an event near a player.
 * @param {Player} near @param {string} kind @param {number} now @param {() => number} [random]
 */
export function proclaim(near, kind, now, random = Math.random) {
  if (state.current) return undefined;
  const info = EVENTS[kind];
  const a = random() * Math.PI * 2;
  const r = 90 + random() * 70;
  /** @type {Event} */
  const event = {
    kind, at: { x: Math.floor(near.location.x + Math.cos(a) * r), y: near.location.y, z: Math.floor(near.location.z + Math.sin(a) * r) },
    dimension: near.dimension, phase: "warning", since: now, began: 0, wave: 0, scores: {}, names: {},
  };
  state.current = event;
  tellAll(`§6[World Event] §e${info.name}! §f${info.tale}`);
  for (const p of world.getAllPlayers()) {
    try {
      p.onScreenDisplay.setTitle(`§6${info.name}`, { subtitle: "§7A world event approaches", fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20 });
      p.playSound("raid.horn", { volume: 1, pitch: 0.7 });
      if (inOverworld(p)) p.sendMessage(`§6[World Event] §fIt gathers ${Math.round(Math.hypot(event.at.x - p.location.x, event.at.z - p.location.z))} blocks to the ${heading(p.location, event.at)}. It begins in two minutes.`);
    } catch {
      // the player left
    }
  }
  return event;
}

/** The event's foes still standing. @param {Event} event */
export function foesOf(event) {
  try {
    return event.dimension.getEntities({ tags: [EVENT_TAG] }).filter((e) => {
      try {
        if (!e.isValid || e.hasTag(`${EVENT_TAG}_ally`)) return false;
        const h = e.getComponent("minecraft:health");
        return !h || h.currentValue > 0;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/** A spot round the event's centre. @param {Event} event @param {number} angle @param {number} radius */
function spot(event, angle, radius) {
  const x = event.at.x + 0.5 + Math.cos(angle) * radius;
  const z = event.at.z + 0.5 + Math.sin(angle) * radius;
  try {
    const top = event.dimension.getTopmostBlock({ x, z });
    if (top && Math.abs(top.location.y + 1 - event.at.y) <= 12) return { x, y: top.location.y + 1, z };
  } catch {
    // not loaded
  }
  return { x, y: event.at.y, z };
}

/** Brings on a wave (or the boss's). @param {Event} event @param {Wave} wave @param {boolean} boss */
function spawnWave(event, wave, boss) {
  const total = wave.reduce((n, [, c]) => n + c, 0);
  let i = 0;
  for (const [type, count] of wave) {
    for (let k = 0; k < count; k++, i++) {
      const at = spot(event, (i / total) * Math.PI * 2 + event.wave, boss && k === 0 ? 8 : 12 + (i % 3) * 2);
      try {
        const foe = event.dimension.spawnEntity(type, at);
        foe.addTag(EVENT_TAG);
        if (boss && k === 0) foe.addTag(`${EVENT_TAG}_boss`);
        fx.pillar(event.dimension, at, EVENTS[event.kind].element, boss ? 8 : 3, boss ? 1.8 : 0.9);
      } catch {
        // not loaded
      }
    }
  }
}

/** Players fighting at the event. @param {Event} event */
export function fighters(event) {
  try {
    return event.dimension.getPlayers({ location: event.at, maxDistance: REACH + 16 });
  } catch {
    return [];
  }
}

/** Begins the battle. @param {Event} event @param {number} now */
export function begin(event, now) {
  const info = EVENTS[event.kind];
  event.phase = "battle";
  event.began = now;
  event.wave = 0;
  for (const [type, count] of info.allies) {
    for (let k = 0; k < count; k++) {
      const at = spot(event, (k / Math.max(1, count)) * Math.PI * 2, 4);
      try {
        const ally = event.dimension.spawnEntity(type, at);
        ally.addTag(EVENT_TAG);
        ally.addTag(`${EVENT_TAG}_ally`);
      } catch {
        // not loaded
      }
    }
  }
  spawnWave(event, info.waves[0], false);
  for (const p of fighters(event)) {
    try {
      p.onScreenDisplay.setTitle(`§c${info.name}`, { subtitle: `§7Wave 1/${info.waves.length}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
    } catch {
      // the player left
    }
  }
  fx.shake(event.dimension, event.at, 48, 0.4, 0.6);
}

/** Clears everything the event brought. @param {Event} event */
function clear(event) {
  try {
    for (const e of event.dimension.getEntities({ tags: [EVENT_TAG] })) {
      try {
        e.remove();
      } catch {
        // gone
      }
    }
  } catch {
    // unloaded
  }
}

/** What a score pays. @param {number} score */
export function payFor(score) {
  return { medals: Math.min(30, 3 + Math.floor(score / 10)), coins: Math.min(150, 10 + score), xp: 300 + score * 25 };
}

/** The event is won: everyone who fought is paid by their score. Returns the payouts. @param {Event} event */
export function win(event) {
  const info = EVENTS[event.kind];
  clear(event);
  state.current = undefined;
  for (const p of fighters(event)) if (!(p.id in event.scores)) event.scores[p.id] = 0;
  const ranked = Object.entries(event.scores).sort((a, b) => b[1] - a[1]);
  const best = ranked[0]?.[0];
  /** @type {Record<string, { medals: number, coins: number, xp: number }>} */
  const paid = {};
  for (const [pid, score] of ranked) {
    const player = world.getAllPlayers().find((p) => p.id === pid);
    if (!player) continue;
    const pay = payFor(score + 5);
    if (pid === best && score > 0) pay.medals += 5;
    giveItem(player, MEDAL, pay.medals);
    giveItem(player, id("yggdrasil_gold_coin"), pay.coins);
    grantXp(player, pay.xp, "world event");
    const p = profileOf(player);
    if (!Array.isArray(p.events)) p.events = [];
    if (!p.events.includes(event.kind)) p.events.push(event.kind);
    p.medalsEarned = (Number(p.medalsEarned) || 0) + pay.medals;
    touch(player);
    paid[pid] = pay;
    try {
      player.onScreenDisplay.setTitle(`§6${info.name}`, { subtitle: "§eVictory!", fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 });
      player.sendMessage(`§6[World Event] §fVictory! Your score: §e${score}§f${pid === best && score > 0 ? " §6(the best!)" : ""}. Reward: §6${pay.medals} Medals of Valor§f, §6${pay.coins} Gold Coins§f, §a${pay.xp} XP§f.`);
      player.playSound("random.totem", { volume: 1, pitch: 1 });
    } catch {
      // the player left
    }
  }
  const champion = best ? event.names[best] ?? world.getAllPlayers().find((p) => p.id === best)?.name : undefined;
  state.last = `${info.name}: won${champion ? `, ${champion} fought best` : ""}`;
  tellAll(`§6[World Event] §e${info.name}§f is over: victory!${champion ? ` §7${champion} fought best.` : ""}`);
  fx.pillar(event.dimension, event.at, "holy", 12, 2);
  return paid;
}

/** The event passes unfinished. @param {Event} event @param {string} why */
export function pass(event, why) {
  clear(event);
  state.current = undefined;
  state.last = `${EVENTS[event.kind].name}: ${why}`;
  tellAll(`§6[World Event] §7${EVENTS[event.kind].name} has passed: ${why}.`);
}

/** Who to credit for a kill: a player, or the master of a retainer or raised undead. @param {Entity | undefined} killer */
function creditFor(killer) {
  try {
    if (!killer || !killer.isValid) return undefined;
    if (killer.typeId === "minecraft:player") return /** @type {Player} */ (killer);
    const owner = killer.getDynamicProperty("overlord:owner");
    if (typeof owner !== "string") return undefined;
    return world.getAllPlayers().find((p) => p.id === owner);
  } catch {
    return undefined;
  }
}

/** Scores a kill at the event. Returns the points. @param {Entity} dead @param {Entity | undefined} killer */
export function score(dead, killer) {
  const event = state.current;
  if (!event || !dead.hasTag(EVENT_TAG) || dead.hasTag(`${EVENT_TAG}_ally`)) return 0;
  const player = creditFor(killer);
  if (!player) return 0;
  let points = 1;
  try {
    points = Math.max(1, Math.round((dead.getComponent("minecraft:health")?.effectiveMax ?? 10) / 10));
  } catch {
    // a body of no account
  }
  if (dead.hasTag(`${EVENT_TAG}_boss`)) points += 50;
  event.scores[player.id] = (event.scores[player.id] ?? 0) + points;
  event.names[player.id] = player.name;
  notify(player, `§6+${points} §7event score (${event.scores[player.id]})`);
  return points;
}

/**
 * Advances the world events.
 * @param {number} now @param {() => number} [random]
 */
export function tick(now, random = Math.random) {
  const event = state.current;
  if (!event) {
    if (!state.enabled || now < state.next) return;
    const ready = world.getAllPlayers().filter(inOverworld);
    if (ready.length === 0) return;
    state.next = now + GAP[0] + Math.floor(random() * (GAP[1] - GAP[0]));
    proclaim(ready[Math.floor(random() * ready.length) % ready.length], KINDS[Math.floor(random() * KINDS.length) % KINDS.length], now, random);
    return;
  }
  const info = EVENTS[event.kind];
  if (event.phase === "warning") {
    if (now - event.since >= WARNING) {
      event.phase = "waiting";
      event.since = now;
      tellAll(`§6[World Event] §e${info.name}§f has begun - go to it!`);
    }
    return;
  }
  if (event.phase === "waiting") {
    if (fighters(event).length > 0) begin(event, now);
    else if (now - event.since >= WAIT) pass(event, "nobody came");
    return;
  }
  if (now - event.began >= RUN) {
    pass(event, "time ran out");
    return;
  }
  if (foesOf(event).length > 0) return;
  if (event.phase === "boss") {
    win(event);
    return;
  }
  event.wave += 1;
  if (event.wave < info.waves.length) {
    spawnWave(event, info.waves[event.wave], false);
    for (const p of fighters(event)) notify(p, `§cWave ${event.wave + 1}/${info.waves.length}`);
  } else {
    event.phase = "boss";
    spawnWave(event, info.boss, true);
    for (const p of fighters(event)) {
      try {
        p.onScreenDisplay.setTitle("§4The final battle", { subtitle: `§7${info.name}`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
      } catch {
        // the player left
      }
    }
  }
}

/** Keeps players pointed at the event, and its beacon lit. @param {number} now */
function guide(now) {
  const event = state.current;
  if (!event) return;
  fx.pillar(event.dimension, event.at, EVENTS[event.kind].element, 16, 1.4);
  for (const p of world.getAllPlayers()) {
    if (!inOverworld(p)) continue;
    const distance = Math.hypot(event.at.x - p.location.x, event.at.z - p.location.z);
    if (distance <= REACH) continue;
    const left = event.phase === "warning" ? ` - begins in ${Math.ceil((WARNING - (now - event.since)) / TICKS)}s` : "";
    notify(p, `§6${EVENTS[event.kind].name}: §f${Math.round(distance)} blocks ${heading(p.location, event.at)}${left}`);
  }
}

let beat = 0;
system.runInterval(() => {
  const now = system.currentTick;
  try {
    tick(now);
    if (++beat % 10 === 0) guide(now);
  } catch (error) {
    console.warn(`[Overlord] world events failed: ${error}`);
  }
}, TICKS);

world.afterEvents.entityDie.subscribe((event) => {
  try {
    score(event.deadEntity, event.damageSource.damagingEntity);
  } catch {
    // unloaded
  }
});

// ---------------------------------------------------------------- the World Events page

/** Buys from the medal shop. Returns a message. @param {Player} player @param {number} index */
export function buy(player, index) {
  const offer = SHOP[index];
  if (!offer) return "§7Nothing like that is offered";
  const [name, item, count, price] = offer;
  if (countItem(player, MEDAL) < price) return `§7${name} costs ${price} Medals of Valor`;
  takeItem(player, MEDAL, price);
  giveItem(player, item, count);
  return `§6You bought ${count > 1 ? `${count} ` : ""}${name}`;
}

/** @param {Player} player */
export function openEvents(player) {
  const event = state.current;
  const p = profileOf(player);
  let status = "§7No world event is under way.";
  if (event) {
    const info = EVENTS[event.kind];
    const distance = Math.round(Math.hypot(event.at.x - player.location.x, event.at.z - player.location.z));
    const phase = event.phase === "warning" ? "gathering" : event.phase === "waiting" ? "waiting for heroes" : event.phase === "boss" ? "the final battle" : `wave ${event.wave + 1}/${info.waves.length}`;
    status = `§e${info.name}§f - ${phase}\n§7${info.tale}\n§f${distance} blocks to the ${heading(player.location, event.at)}. Your score: §e${event.scores[player.id] ?? 0}`;
  }
  const done = (Array.isArray(p.events) ? p.events : []).map((k) => EVENTS[k]?.name).filter(Boolean);
  const form = new ActionFormData()
    .title("World Events")
    .body(
      `${status}\n\n§7Events come every half hour or so. Reach one to begin it; every foe you (or your party and undead) slay there scores, and when its boss falls everyone who fought is paid in XP, Gold Coins and Medals of Valor - the best fighter most of all.§r\n\n` +
        `Medals of Valor: §6${countItem(player, MEDAL)}§r   (earned in all: ${Number(p.medalsEarned) || 0})\n` +
        `Events won: ${done.length > 0 ? done.join(", ") : "none yet"}` + (state.last ? `\n§8Last: ${state.last}` : "")
    );
  for (const [name, , count, price] of SHOP) form.button(`${count > 1 ? `${count} ` : ""}${name}\n§6${price} Medals`);
  form.button("Close");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      if (response.selection < SHOP.length) {
        notify(player, buy(player, response.selection));
        openEvents(player);
      }
    })
    .catch(() => {});
}

registerMenu((player) => {
  const event = state.current;
  return event ? `World Events\n§c${EVENTS[event.kind].name}!` : "World Events\n§8Medals and what they buy";
}, openEvents);
