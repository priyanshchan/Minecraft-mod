// Overlord: Tomb of Nazarick - necromancy: the dead rise to serve.
//
// Whatever falls near a player leaves a corpse for half a minute, marked by drifting souls. Using the Book
// of the Dead raises every corpse within eight blocks as an undead servant - a Skeleton from a weak body, an
// Elder Lich, a Soul Eater or, from the strongest, a Death Knight - as far as the raiser's level allows and
// their mana and the size of their army permit. The raised serve for good: they follow, or hold their
// ground when told, fight what threatens their master, and grow stronger with every kill. The Undead race
// commands more of them, raises them for half the mana, and raises them stronger. Sneak + use the Book (or
// the Plate's Undead Army page) to command them.
import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { notify, profileOf, registerMenu, spendMana, touch } from "./rpg.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
export const BOOK = id("book_of_the_dead");
/** Seconds a corpse lies before it is beyond raising, and how near the raiser must stand. */
export const CORPSE_LIFE = 30;
export const RAISE_REACH = 8;
const MAX_CORPSES = 80;
/** Kills for each rank a raised undead earns, and the highest rank. */
export const KILLS_PER_RANK = 5;
export const MAX_RANK = 5;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {{ id: string, kind: number, name: string, kills: number }} Servant */

/** What a corpse can become, from the weakest body up: the strength of body it needs, the level to raise it, the mana. */
export const KINDS = [
  { type: id("old_guarder"), name: "Skeleton", body: 0, level: 1, mana: 10 },
  { type: id("elder_lich"), name: "Elder Lich", body: 40, level: 10, mana: 20 },
  { type: id("soul_eater"), name: "Soul Eater", body: 100, level: 25, mana: 35 },
  { type: id("death_knight"), name: "Death Knight", body: 250, level: 45, mana: 50 },
];
const NAMES = ["Grim", "Hollow", "Marrow", "Ash", "Rattle", "Gloom", "Dirge", "Shade", "Vesper", "Mort", "Knell", "Pale"];

/** @type {{ at: Vector3, dimension: string, body: number, tick: number }[]} */
export const corpses = [];

// ---------------------------------------------------------------- the army

/** A player's servants, cleaned of anything malformed. @param {Player} player @returns {Servant[]} */
export function armyOf(player) {
  const p = profileOf(player);
  if (!Array.isArray(p.army)) p.army = [];
  // cleaned in place, so a list someone already holds stays the army
  for (let i = p.army.length - 1; i >= 0; i--) {
    const s = p.army[i];
    if (!s || typeof s.id !== "string" || !Number.isInteger(s.kind) || !KINDS[s.kind]) p.army.splice(i, 1);
  }
  for (const s of p.army) {
    s.name = String(s.name ?? "Servant").slice(0, 16);
    s.kills = Math.max(0, Math.floor(Number(s.kills) || 0));
  }
  return p.army;
}

/** The race's rank, if the player is Undead: -1 otherwise. @param {Player} player */
function undeadRank(player) {
  const p = profileOf(player);
  if (p.race !== "undead") return -1;
  const lv = Number(p.raceLv) || 1;
  return lv >= 10 ? 2 : lv >= 5 ? 1 : 0;
}

/** How many undead a player can command. @param {Player} player */
export function capacity(player) {
  const level = profileOf(player).level;
  const rank = undeadRank(player);
  return Math.min(16, 2 + Math.floor(level / 10) + (rank >= 0 ? 2 * (rank + 1) : 0));
}

/** A servant's rank from its kills (Undead raisers' servants start one higher). @param {Player} player @param {Servant} s */
export function rankOf(player, s) {
  return Math.min(MAX_RANK, Math.floor(s.kills / KILLS_PER_RANK) + (undeadRank(player) >= 0 ? 1 : 0));
}

/** What a body of this strength rises as, for a raiser of this level. @param {number} body @param {number} level */
export function kindFor(body, level) {
  let best = 0;
  KINDS.forEach((k, i) => {
    if (body >= k.body && level >= k.level) best = i;
  });
  return best;
}

/** @param {Player} player */
function tagOf(player) {
  return `overlord_raised_${player.id}`;
}

/** The player's raised undead that are loaded, by id. @param {Player} player @returns {Map<string, Entity>} */
export function loaded(player) {
  const out = new Map();
  try {
    for (const e of player.dimension.getEntities({ tags: [tagOf(player)] })) if (e.isValid) out.set(e.id, e);
  } catch {
    // unloaded
  }
  return out;
}

// ---------------------------------------------------------------- raising

/**
 * Raises the corpses near the player. Returns how many rose.
 * @param {Player} player @param {number} [now] @param {() => number} [random]
 */
export function raise(player, now = system.currentTick, random = Math.random) {
  const p = profileOf(player);
  const army = armyOf(player);
  const room = capacity(player) - army.length;
  if (room <= 0) {
    notify(player, `§7Your army is full (${army.length}/${capacity(player)}) - release some first`);
    return 0;
  }
  const here = player.location;
  const fresh = corpses.filter((c) => c.dimension === player.dimension.id && now - c.tick <= CORPSE_LIFE * TICKS &&
    Math.hypot(c.at.x - here.x, c.at.z - here.z) <= RAISE_REACH);
  if (fresh.length === 0) {
    notify(player, "§7There are no fresh corpses near");
    return 0;
  }
  const discount = undeadRank(player) >= 0 ? 0.5 : 1;
  let risen = 0;
  for (const corpse of fresh.sort((a, b) => b.body - a.body)) {
    if (risen >= room) break;
    const kind = kindFor(corpse.body, p.level);
    if (!spendMana(player, Math.round(KINDS[kind].mana * discount))) {
      if (risen === 0) notify(player, `§7Raising a ${KINDS[kind].name} needs ${Math.round(KINDS[kind].mana * discount)} mana`);
      break;
    }
    try {
      const undead = player.dimension.spawnEntity(KINDS[kind].type, corpse.at, { spawnEvent: `${NS}:become_raised` });
      undead.addTag("overlord_raised");
      undead.addTag(tagOf(player));
      undead.setDynamicProperty("overlord:owner", player.id);
      const name = `${NAMES[Math.floor(random() * NAMES.length) % NAMES.length]} the ${KINDS[kind].name}`;
      undead.nameTag = `§5${name}`;
      army.push({ id: undead.id, kind, name, kills: 0 });
      system.runTimeout(() => {
        try {
          if (undead.isValid && player.isValid) undead.getComponent("minecraft:tameable")?.tame(player);
        } catch {
          // it serves all the same
        }
      }, 2);
      fx.pillar(player.dimension, corpse.at, "dark", 4, 1.2);
      fx.rise(player.dimension, corpse.at, "dark", 0.9);
      fx.skull(player.dimension, { x: corpse.at.x, y: corpse.at.y + 2, z: corpse.at.z }, 0.8);
      corpses.splice(corpses.indexOf(corpse), 1);
      risen++;
    } catch {
      // no room there
    }
  }
  if (risen > 0) {
    p.raisedTotal = (Number(p.raisedTotal) || 0) + risen;
    touch(player);
    fx.pose(player, "summon");
    try {
      player.playSound("mob.wither.spawn", { volume: 0.6, pitch: 1.4 });
    } catch {
      // cosmetic only
    }
    notify(player, `§5${risen} undead rise to serve you §7(${army.length}/${capacity(player)})`);
  }
  return risen;
}

// ---------------------------------------------------------------- orders

/**
 * Commands the army: "follow", "hold" (stay where they stand), "gather" (to the player's side) or "release" (all).
 * Returns how many heard it.
 * @param {Player} player @param {"follow" | "hold" | "gather" | "release"} order
 */
export function command(player, order) {
  const army = armyOf(player);
  const here = loaded(player);
  let heard = 0;
  for (const s of [...army]) {
    const e = here.get(s.id);
    if (order === "release") {
      if (e) {
        fx.rise(e.dimension, e.location, "dark", 0.7);
        try {
          e.remove();
        } catch {
          // gone
        }
      }
      army.splice(army.indexOf(s), 1);
      heard++;
      continue;
    }
    if (!e) continue;
    try {
      if (order === "hold") e.triggerEvent(`${NS}:order_hold`);
      else if (order === "follow") e.triggerEvent(`${NS}:order_follow`);
      else {
        e.teleport({ x: player.location.x + (Math.random() - 0.5) * 3, y: player.location.y, z: player.location.z + (Math.random() - 0.5) * 3 });
        e.triggerEvent(`${NS}:order_follow`);
      }
      heard++;
    } catch {
      // unloading
    }
  }
  touch(player);
  return heard;
}

/** Releases one servant. @param {Player} player @param {number} index */
export function release(player, index) {
  const army = armyOf(player);
  const s = army[index];
  if (!s) return "§7No such servant";
  const e = loaded(player).get(s.id);
  if (e) {
    fx.rise(e.dimension, e.location, "dark", 0.7);
    try {
      e.remove();
    } catch {
      // gone
    }
  }
  army.splice(index, 1);
  touch(player);
  return `§7${s.name} returns to dust`;
}

// ---------------------------------------------------------------- upkeep

/** Keeps a servant as strong as its rank. Returns its rank. @param {Player} player @param {Servant} s @param {Entity} e */
export function strengthen(player, s, e) {
  const rank = rankOf(player, s);
  const sig = `r${rank}`;
  try {
    if (e.getDynamicProperty("overlord:rank") === sig) return rank;
    e.setDynamicProperty("overlord:rank", sig);
    if (rank > 0) {
      e.addEffect("health_boost", 20000000, { amplifier: rank - 1, showParticles: false });
      if (rank >= 2) e.addEffect("strength", 20000000, { amplifier: Math.floor(rank / 2) - 1, showParticles: false });
      if (rank >= 4) e.addEffect("resistance", 20000000, { amplifier: 0, showParticles: false });
    }
    const name = `§5${s.name}${rank > 0 ? ` §6${"*".repeat(rank)}` : ""}`;
    if (e.nameTag !== name) e.nameTag = name;
  } catch {
    // unloading
  }
  return rank;
}

/** A servant has slain something: its kills grow. @param {Player} player @param {string} servantId */
export function credit(player, servantId) {
  const s = armyOf(player).find((x) => x.id === servantId);
  if (!s) return undefined;
  const before = rankOf(player, s);
  s.kills += 1;
  touch(player);
  const after = rankOf(player, s);
  if (after > before) notify(player, `§5${s.name} grows stronger §6(${"*".repeat(after)})`);
  return s;
}

/** @param {Entity} e */
function bodyOf(e) {
  try {
    return e.getComponent("minecraft:health")?.effectiveMax ?? 0;
  } catch {
    return 0;
  }
}

/** Whether a dead creature leaves a corpse that can be raised. @param {Entity} dead */
export function leavesCorpse(dead) {
  if (dead.typeId === "minecraft:player") return false;
  try {
    if (dead.hasTag("overlord_raised") || dead.hasTag("overlord_summoned") || dead.hasTag("overlord_guardian")) return false;
    if (dead.matches({ families: ["raised"] }) || dead.matches({ families: ["nazarick_ally"] })) return false;
    return dead.matches({ families: ["monster"] }) || dead.matches({ families: ["mob"] });
  } catch {
    return false;
  }
}

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    // a servant fell
    if (dead.hasTag("overlord_raised")) {
      const owner = String(dead.getDynamicProperty("overlord:owner") ?? "");
      const player = world.getAllPlayers().find((pl) => pl.id === owner);
      if (player) {
        const army = armyOf(player);
        const s = army.find((x) => x.id === dead.id);
        if (s) {
          army.splice(army.indexOf(s), 1);
          touch(player);
          notify(player, `§7${s.name} has fallen`);
        }
      }
      return;
    }
    // a kill by a servant
    const killer = event.damageSource.damagingEntity;
    if (killer && killer.hasTag?.("overlord_raised")) {
      const owner = String(killer.getDynamicProperty("overlord:owner") ?? "");
      const player = world.getAllPlayers().find((pl) => pl.id === owner);
      if (player) credit(player, killer.id);
    }
    if (!leavesCorpse(dead)) return;
    const near = dead.dimension.getPlayers({ location: dead.location, maxDistance: 32 });
    if (near.length === 0) return;
    corpses.push({ at: { ...dead.location }, dimension: dead.dimension.id, body: bodyOf(dead), tick: system.currentTick });
    if (corpses.length > MAX_CORPSES) corpses.shift();
  } catch {
    // unloaded
  }
});

world.afterEvents.itemUse.subscribe((event) => {
  try {
    if (event.itemStack?.typeId !== BOOK) return;
    const player = event.source;
    if (player.isSneaking) openArmy(player);
    else raise(player);
  } catch (error) {
    console.warn(`[Overlord] the Book of the Dead failed: ${error}`);
  }
});

let beat = 0;
system.runInterval(() => {
  const now = system.currentTick;
  beat++;
  // corpses fade; the fresh ones smoulder with souls where a player can see them
  for (let i = corpses.length - 1; i >= 0; i--) if (now - corpses[i].tick > CORPSE_LIFE * TICKS) corpses.splice(i, 1);
  for (const player of world.getAllPlayers()) {
    try {
      if (beat % 2 === 0) {
        for (const c of corpses) {
          if (c.dimension === player.dimension.id && Math.hypot(c.at.x - player.location.x, c.at.z - player.location.z) <= 24) {
            fx.puff(player.dimension, "wisp", { x: c.at.x, y: c.at.y + 0.3, z: c.at.z }, "dark", 0.7);
          }
        }
      }
      const army = armyOf(player);
      if (army.length === 0) continue;
      const here = loaded(player);
      for (const s of army) {
        const e = here.get(s.id);
        if (e) strengthen(player, s, e);
      }
    } catch {
      // the player is leaving
    }
  }
}, TICKS);

// ---------------------------------------------------------------- the army page

/** @param {Player} player */
export function openArmy(player) {
  const army = armyOf(player);
  const here = loaded(player);
  const now = system.currentTick;
  const near = corpses.filter((c) => c.dimension === player.dimension.id && now - c.tick <= CORPSE_LIFE * TICKS &&
    Math.hypot(c.at.x - player.location.x, c.at.z - player.location.z) <= RAISE_REACH).length;
  const form = new ActionFormData()
    .title("Undead Army")
    .body(
      `§7Fallen creatures leave corpses for ${CORPSE_LIFE} seconds. Use the Book of the Dead near them to raise them: weak bodies rise as Skeletons, stronger ones as Elder Liches, Soul Eaters and - from the mightiest - Death Knights, as your level allows. Each servant grows a rank every ${KILLS_PER_RANK} kills.${undeadRank(player) >= 0 ? " §5As one of the Undead you command more of them, for half the mana, and they rise a rank stronger." : ""}§r\n\n` +
        `Army: §5${army.length}/${capacity(player)}§r   Corpses near: §e${near}\n\n` +
        (army.length > 0
          ? army.map((s) => `§5${s.name}§r - ${KINDS[s.kind].name}, ${"*".repeat(rankOf(player, s)) || "rank 0"}, ${s.kills} kills${here.has(s.id) ? "" : " §8(far away)"}`).join("\n")
          : "§8No servants yet.")
    );
  /** @type {(() => void)[]} */
  const actions = [];
  const add = (/** @type {string} */ label, /** @type {() => void} */ action) => {
    form.button(label);
    actions.push(action);
  };
  add(`§5Raise the dead here (${near})`, () => raise(player));
  if (army.length > 0) {
    add("Follow me", () => notify(player, `§5${command(player, "follow")} servants follow you`));
    add("Hold your ground", () => notify(player, `§5${command(player, "hold")} servants hold where they stand`));
    add("Gather to me", () => notify(player, `§5${command(player, "gather")} servants gather to you`));
    add("Rename a servant", () => openPick(player, "Rename", (i) => openRename(player, i)));
    add("Release a servant", () => openPick(player, "Release", (i) => notify(player, release(player, i))));
    add("§cRelease them all", () => notify(player, `§7${command(player, "release")} servants return to dust`));
  }
  form.button("Close");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      actions[response.selection]?.();
    })
    .catch(() => {});
}

/** @param {Player} player @param {string} verb @param {(index: number) => void} then */
function openPick(player, verb, then) {
  const army = armyOf(player);
  const form = new ActionFormData().title(`${verb} a servant`);
  for (const s of army) form.button(`${s.name}\n§8${KINDS[s.kind].name}, ${s.kills} kills`);
  form.button("Back");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      if (response.selection < army.length) then(response.selection);
      else openArmy(player);
    })
    .catch(() => {});
}

/** @param {Player} player @param {number} index */
function openRename(player, index) {
  const s = armyOf(player)[index];
  if (!s) return;
  new ModalFormData()
    .title("Rename a servant")
    .textField("Name", "up to 16 letters", { defaultValue: s.name })
    .show(player)
    .then((response) => {
      if (response.canceled || !response.formValues || !player.isValid) return;
      const name = String(response.formValues[0] ?? "").trim().slice(0, 16);
      if (!name) return;
      s.name = name;
      const e = loaded(player).get(s.id);
      if (e) e.setDynamicProperty("overlord:rank", ""); // the name tag is redrawn with the rank
      touch(player);
      notify(player, `§5Your servant is now ${name}`);
    })
    .catch(() => {});
}

registerMenu((player) => `Undead Army (${armyOf(player).length}/${capacity(player)})\n§8Raise and command the dead`, openArmy);
