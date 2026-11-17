// Overlord: Tomb of Nazarick - familiars: small companions that follow their master and learn tricks (v9.6).
//
// Four familiars can be bound, each by using its token: a Frost Dragonling Egg (from Frost Dragons, or made from
// their scales), Hanzo's Contract (from Eight-Edge Assassins, or written), a Shadow Demon's Contract (from Shadow
// Demons, or written with a demon's heart) and a Cherub's Halo (from Archangel Flames, or made of feathers). One
// familiar may be out at a time: the Familiar's Bell calls it or sends it home, and sneak + the Bell (or the
// Familiars page on the Adventurer's Plate) chooses which, renames it and shows what it knows.
//
// A familiar cannot be harmed. It follows its master, and comes to them when left far behind. It grows with
// the foes its master fells while it is out - ten levels - and learns a trick at levels 1, 4 and 8:
//   Frost Dragonling - Frost Breath, Frost Ward, Winter Gale
//   Hanzo             - Venom Fang, Pickpocket, Shadow Mark
//   Shadow Demon      - Darkvision, Scout, Shadow Bind
//   Cherub            - Mending, Purify, Guardian Light
//   Wise King's Cub   - Tail Whip, Forager, Great Charge (v10)
import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { creditedPlayer, giveItem, notify, profileOf, registerMenu, touch } from "./rpg.js";
import { foesNear, strike } from "./arms.js";
import { rumour } from "./structures.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
export const BELL = id("familiar_bell");
export const MAX_LEVEL = 10;
/** The levels at which the three tricks are learned. */
export const TRICK_AT = [1, 4, 8];
const COIN = id("yggdrasil_gold_coin");

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {{ level: number, xp: number, name: string }} Bond */
/** @typedef {{ owned: Record<string, Bond>, active: string }} Familiars */
/** @typedef {{ key: string, type: string, token: string, name: string, element: string, colour: string, tricks: [string, string][] }} Kind */

/** @type {Kind[]} */
export const KINDS = [
  {
    key: "dragonling", type: id("familiar_dragonling"), token: id("dragonling_egg"), name: "Frost Dragonling", element: "ice", colour: "§b",
    tricks: [
      ["Frost Breath", "breathes frost at the nearest foe every few seconds, slowing it"],
      ["Frost Ward", "when you fall below 40% health, wraps you in ice: Resistance II and absorption (once a minute)"],
      ["Winter Gale", "a gust of winter strikes and throws back every foe close around you"],
    ],
  },
  {
    key: "hanzo", type: id("familiar_hanzo"), token: id("hanzo_contract"), name: "Hanzo", element: "dark", colour: "§8",
    tricks: [
      ["Venom Fang", "darts at the nearest foe, poisoning it"],
      ["Pickpocket", "a chance of extra gold from every foe you fell"],
      ["Shadow Mark", "marks the strongest foe nearby, weakening and slowing it"],
    ],
  },
  {
    key: "shadow", type: id("familiar_shadow"), token: id("shadow_contract"), name: "Shadow Demon", element: "dark", colour: "§5",
    tricks: [
      ["Darkvision", "you see in the dark"],
      ["Scout", "every so often it brings word of an undiscovered place nearby"],
      ["Shadow Bind", "whatever strikes you is bound in shadow and hurt"],
    ],
  },
  {
    key: "cherub", type: id("familiar_cherub"), token: id("cherub_halo"), name: "Cherub", element: "holy", colour: "§e",
    tricks: [
      ["Mending", "slowly heals your wounds"],
      ["Purify", "lifts poison, wither, weakness and slowness from you"],
      ["Guardian Light", "when you fall below a quarter of your health, a burst of healing light (once every 90 seconds)"],
    ],
  },
  {
    key: "cub", type: id("familiar_cub"), token: id("wise_kings_acorn"), name: "Wise King's Cub", element: "acid", colour: "§6",
    tricks: [
      ["Tail Whip", "lashes the nearest foe with its long tail, knocking it back"],
      ["Forager", "every so often it digs up something to eat - or something shiny"],
      ["Great Charge", "rolls into the foes before you, bowling them over, and lends you its speed"],
    ],
  },
];
/** @type {Record<string, Kind>} */
export const BY_KEY = Object.fromEntries(KINDS.map((k) => [k.key, k]));

// ------------------------------------------------------------------ the bond

/** A player's familiars. @param {Player} player @returns {Familiars} */
export function familiarsOf(player) {
  const p = profileOf(player);
  if (!p.familiars || typeof p.familiars !== "object") p.familiars = { owned: {}, active: "" };
  const f = /** @type {Familiars} */ (p.familiars);
  if (!f.owned || typeof f.owned !== "object") f.owned = {};
  if (typeof f.active !== "string") f.active = "";
  return f;
}

/** XP a familiar needs to reach the next level. @param {number} level */
export function xpFor(level) {
  return 40 + level * 30;
}

/** How many tricks a familiar knows at a level. @param {number} level */
export function tricksAt(level) {
  return TRICK_AT.filter((at) => level >= at).length;
}

/** Whether the active familiar knows its n-th trick (0, 1 or 2). @param {Player} player @param {number} n */
export function knows(player, n) {
  const f = familiarsOf(player);
  const bond = f.owned[f.active];
  return !!bond && tricksAt(bond.level) > n;
}

/** Binds a familiar from its token. Returns a message. @param {Player} player @param {string} key */
export function bind(player, key) {
  const kind = BY_KEY[key];
  if (!kind) return "";
  const f = familiarsOf(player);
  if (f.owned[key]) return `§7Your ${kind.name} is already bound to you`;
  f.owned[key] = { level: 1, xp: 0, name: kind.name };
  if (Object.keys(f.owned).length === 1) giveItem(player, BELL, 1);
  touch(player);
  return `${kind.colour}A ${kind.name} is bound to you. §7Ring the Familiar's Bell to call it.`;
}

/** Grows the active familiar. Returns whether it rose a level. @param {Player} player @param {number} amount */
export function feed(player, amount) {
  const f = familiarsOf(player);
  const bond = f.owned[f.active];
  if (!bond || bond.level >= MAX_LEVEL) return false;
  bond.xp += amount;
  let rose = false;
  while (bond.level < MAX_LEVEL && bond.xp >= xpFor(bond.level)) {
    bond.xp -= xpFor(bond.level);
    bond.level += 1;
    rose = true;
    const kind = BY_KEY[f.active];
    const learned = TRICK_AT.indexOf(bond.level);
    notify(player, `${kind.colour}${bond.name} reached level ${bond.level}!${learned >= 0 ? ` §fIt learned §e${kind.tricks[learned][0]}§f.` : ""}`);
  }
  if (bond.level >= MAX_LEVEL) bond.xp = 0;
  touch(player);
  return rose;
}

// ------------------------------------------------------------------ out in the world

/** The tag every one of a player's familiars carries. @param {Player} player */
function tagOf(player) {
  return `overlord_familiar_${player.id}`;
}

/** The player's familiar in the world, if it is out and near enough to find. @param {Player} player */
export function bodyOf(player) {
  try {
    return player.dimension.getEntities({ tags: [tagOf(player)] }).find((e) => e.isValid);
  } catch {
    return undefined;
  }
}

/** Sends home any familiar of the player's that is out. @param {Player} player */
function recall(player) {
  for (const dim of ["overworld", "nether", "the_end"]) {
    try {
      for (const e of world.getDimension(dim).getEntities({ tags: [tagOf(player)] })) e.remove();
    } catch {
      // that dimension is not loaded
    }
  }
}

/** Brings the active familiar out beside the player. @param {Player} player */
function appear(player) {
  const f = familiarsOf(player);
  const kind = BY_KEY[f.active];
  if (!kind) return undefined;
  recall(player);
  const at = { x: player.location.x + 1, y: player.location.y, z: player.location.z + 1 };
  const body = player.dimension.spawnEntity(kind.type, at);
  body.addTag(tagOf(player));
  body.setDynamicProperty("overlord:owner", player.id);
  body.nameTag = `${kind.colour}${f.owned[f.active].name} §7Lv.${f.owned[f.active].level}`;
  system.runTimeout(() => {
    try {
      if (body.isValid && player.isValid) body.getComponent("minecraft:tameable")?.tame(player);
    } catch {
      // it follows all the same
    }
  }, 1);
  fx.rise(player.dimension, at, kind.element, 0.7);
  return body;
}

/** Calls a familiar out (the one given, or the active one). Returns a message. @param {Player} player @param {string} [key] */
export function summon(player, key) {
  const f = familiarsOf(player);
  const which = key ?? (f.active || Object.keys(f.owned)[0] || "");
  if (!f.owned[which]) return "§7You have no familiar bound to you";
  f.active = which;
  appear(player);
  touch(player);
  return `${BY_KEY[which].colour}${f.owned[which].name} comes to your side.`;
}

/** Sends the familiar home. Returns a message. @param {Player} player */
export function dismiss(player) {
  const f = familiarsOf(player);
  if (!f.active) return "§7No familiar is out";
  const name = f.owned[f.active]?.name ?? "Your familiar";
  f.active = "";
  recall(player);
  touch(player);
  return `§7${name} returns home.`;
}

/** Renames a familiar. @param {Player} player @param {string} key @param {string} name */
export function rename(player, key, name) {
  const bond = familiarsOf(player).owned[key];
  const clean = name.replace(/§./g, "").trim().slice(0, 24);
  if (!bond || !clean) return false;
  bond.name = clean;
  const body = familiarsOf(player).active === key ? bodyOf(player) : undefined;
  if (body) body.nameTag = `${BY_KEY[key].colour}${clean} §7Lv.${bond.level}`;
  touch(player);
  return true;
}

// ------------------------------------------------------------------ tricks

/** Ticks before which each player's familiar may use each trick again: `${player}|${trick}` -> tick. */
const ready = new Map();

/** Whether a trick is ready, and if so starts its wait. @param {Player} player @param {string} trick @param {number} seconds @param {number} now */
function due(player, trick, seconds, now) {
  const key = `${player.id}|${trick}`;
  if (now < (ready.get(key) ?? 0)) return false;
  ready.set(key, now + seconds * TICKS);
  return true;
}

/** @param {Player} player */
function healthOf(player) {
  return player.getComponent("minecraft:health");
}

/**
 * One turn of the active familiar's tricks. Returns the tricks it used.
 * @param {Player} player @param {Entity} body @param {number} now
 */
export function act(player, body, now) {
  const f = familiarsOf(player);
  const bond = f.owned[f.active];
  if (!bond) return [];
  const kind = BY_KEY[f.active];
  const known = tricksAt(bond.level);
  const d = player.dimension;
  const power = bond.level;
  /** @type {string[]} */
  const used = [];
  const health = healthOf(player);
  const share = health ? health.currentValue / health.effectiveMax : 1;
  const nearest = () => foesNear(player, body.location, 10).sort((a, b) => dist(a, body) - dist(b, body))[0];
  if (kind.key === "dragonling") {
    if (known >= 1 && due(player, "breath", 5, now)) {
      const foe = nearest();
      if (foe) {
        strike(player, foe, 3 + power);
        foe.addEffect("slowness", 3 * TICKS, { amplifier: 1 });
        fx.beam(d, { x: body.location.x, y: body.location.y + 0.5, z: body.location.z }, { x: foe.location.x, y: foe.location.y + 1, z: foe.location.z }, "ice", 0.8);
        used.push("Frost Breath");
      } else ready.delete(`${player.id}|breath`);
    }
    if (known >= 2 && share < 0.4 && due(player, "ward", 60, now)) {
      player.addEffect("resistance", 6 * TICKS, { amplifier: 1, showParticles: false });
      player.addEffect("absorption", 10 * TICKS, { amplifier: 1, showParticles: false });
      fx.dome(d, player.location, "ice");
      used.push("Frost Ward");
    }
    if (known >= 3 && due(player, "gale", 12, now)) {
      const foes = foesNear(player, player.location, 5);
      if (foes.length > 0) {
        for (const foe of foes) {
          strike(player, foe, 6 + power);
          try {
            const dx = foe.location.x - player.location.x;
            const dz = foe.location.z - player.location.z;
            const n = Math.hypot(dx, dz) || 1;
            foe.applyKnockback({ x: (dx / n) * 1.5, z: (dz / n) * 1.5 }, 0.4);
          } catch {
            // too heavy to move
          }
        }
        fx.nova(d, player.location, "ice", 5);
        used.push("Winter Gale");
      } else ready.delete(`${player.id}|gale`);
    }
  } else if (kind.key === "hanzo") {
    if (known >= 1 && due(player, "fang", 4, now)) {
      const foe = nearest();
      if (foe) {
        strike(player, foe, 2 + power);
        foe.addEffect("poison", 3 * TICKS, { amplifier: 0 });
        fx.slash(d, { x: foe.location.x, y: foe.location.y + 1, z: foe.location.z }, "acid", 0.8);
        used.push("Venom Fang");
      } else ready.delete(`${player.id}|fang`);
    }
    if (known >= 3 && due(player, "mark", 10, now)) {
      const foes = foesNear(player, player.location, 20);
      const strongest = foes.sort((a, b) => maxOf(b) - maxOf(a))[0];
      if (strongest) {
        strongest.addEffect("weakness", 8 * TICKS, { amplifier: 1 });
        strongest.addEffect("slowness", 4 * TICKS, { amplifier: 1 });
        fx.skull(d, { x: strongest.location.x, y: strongest.location.y + 2.5, z: strongest.location.z }, 0.8);
        used.push("Shadow Mark");
      } else ready.delete(`${player.id}|mark`);
    }
  } else if (kind.key === "shadow") {
    if (known >= 1) {
      player.addEffect("night_vision", 15 * TICKS, { amplifier: 0, showParticles: false });
      used.push("Darkvision");
    }
    if (known >= 2 && due(player, "scout", 90, now)) {
      const word = rumour(player);
      if (word) {
        notify(player, `§5${bond.name} whispers: §f${word}`);
        used.push("Scout");
      }
    }
  } else if (kind.key === "cub") {
    if (known >= 1 && due(player, "whip", 4, now)) {
      const foe = nearest();
      if (foe) {
        strike(player, foe, 3 + power);
        try {
          const dx = foe.location.x - body.location.x;
          const dz = foe.location.z - body.location.z;
          const n = Math.hypot(dx, dz) || 1;
          foe.applyKnockback({ x: (dx / n) * 1.2, z: (dz / n) * 1.2 }, 0.3);
        } catch {
          // too heavy to move
        }
        fx.slash(d, { x: foe.location.x, y: foe.location.y + 0.8, z: foe.location.z }, "acid", 0.8);
        used.push("Tail Whip");
      } else ready.delete(`${player.id}|whip`);
    }
    if (known >= 2 && due(player, "forage", 120, now)) {
      const finds = /** @type {[string, number][]} */ ([["minecraft:bread", 3], ["minecraft:golden_carrot", 2], [COIN, 4], [id("data_crystal"), 1]]);
      const [item, n] = finds[Math.floor(Math.random() * finds.length) % finds.length];
      giveItem(player, item, n);
      notify(player, `§6${bond.name} digs up something for you!`);
      used.push("Forager");
    }
    if (known >= 3 && due(player, "charge", 15, now)) {
      const foes = foesNear(player, player.location, 6);
      if (foes.length > 0) {
        for (const foe of foes) {
          strike(player, foe, 8 + power);
          try {
            foe.applyKnockback({ x: foe.location.x - player.location.x, z: foe.location.z - player.location.z }, 0.4);
          } catch {
            // too heavy to move
          }
        }
        player.addEffect("speed", 6 * TICKS, { amplifier: 1, showParticles: false });
        fx.ring(d, player.location, "acid", 6);
        used.push("Great Charge");
      } else ready.delete(`${player.id}|charge`);
    }
  } else if (kind.key === "cherub" && health) {
    if (known >= 1 && share < 1 && due(player, "mend", 4, now)) {
      health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + (power >= 5 ? 2 : 1)));
      fx.rise(d, player.location, "holy", 0.5);
      used.push("Mending");
    }
    if (known >= 2 && due(player, "purify", 4, now)) {
      let lifted = false;
      for (const e of ["poison", "wither", "weakness", "slowness"]) {
        try {
          if (player.getEffect(e)) {
            player.removeEffect(e);
            lifted = true;
          }
        } catch {
          // no such effect
        }
      }
      if (lifted) used.push("Purify");
      else ready.delete(`${player.id}|purify`);
    }
    if (known >= 3 && share < 0.25 && due(player, "light", 90, now)) {
      health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + 10));
      player.addEffect("regeneration", 5 * TICKS, { amplifier: 1, showParticles: false });
      fx.crown(d, player.location, "holy", 5);
      used.push("Guardian Light");
    }
  }
  return used;
}

/** @param {Entity} a @param {Entity} b */
function dist(a, b) {
  return Math.hypot(a.location.x - b.location.x, a.location.z - b.location.z);
}

/** @param {Entity} e */
function maxOf(e) {
  try {
    return e.getComponent("minecraft:health")?.effectiveMax ?? 0;
  } catch {
    return 0;
  }
}

/** Keeps a player's familiar with them, and lets it act. @param {Player} player @param {number} now */
export function tend(player, now) {
  const f = familiarsOf(player);
  if (!f.active || !f.owned[f.active]) return [];
  let body = bodyOf(player);
  if (!body) body = appear(player);
  if (!body) return [];
  if (dist(body, player) > 20 || Math.abs(body.location.y - player.location.y) > 10) {
    try {
      body.teleport({ x: player.location.x + 1, y: player.location.y, z: player.location.z + 1 });
    } catch {
      // it will catch up
    }
  }
  return act(player, body, now);
}

// ------------------------------------------------------------------ the menu

/** The Familiars page. @param {Player} player */
export function openFamiliars(player) {
  const f = familiarsOf(player);
  const owned = KINDS.filter((k) => f.owned[k.key]);
  const lines = KINDS.map((k) => {
    const bond = f.owned[k.key];
    if (!bond) return `§8${k.name} - not yet bound (${k.token.split(":")[1].replace(/_/g, " ")})`;
    const tricks = k.tricks.map(([name], i) => (bond.level >= TRICK_AT[i] ? `§a${name}` : `§8${name} (Lv.${TRICK_AT[i]})`)).join("§7, ");
    return `${k.colour}${bond.name}§7 - Lv.${bond.level}${bond.level < MAX_LEVEL ? ` (${bond.xp}/${xpFor(bond.level)} XP)` : " (max)"}${f.active === k.key ? " §a[out]" : ""}\n  ${tricks}`;
  });
  /** @type {(() => void)[]} */
  const choices = [];
  const form = new ActionFormData().title("Familiars").body(`${lines.join("\n")}\n\n§7Your familiar grows with every foe you fell while it is out.`);
  for (const k of owned) {
    form.button(f.active === k.key ? `Send ${f.owned[k.key].name} home` : `Call ${f.owned[k.key].name}`);
    choices.push(() => notify(player, f.active === k.key ? dismiss(player) : summon(player, k.key)));
  }
  for (const k of owned) {
    form.button(`§7Rename ${f.owned[k.key].name}`);
    choices.push(() => askName(player, k.key));
  }
  form.button("Close");
  choices.push(() => {});
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      choices[response.selection]?.();
    })
    .catch(() => {});
}

/** @param {Player} player @param {string} key */
function askName(player, key) {
  new ModalFormData()
    .title(`Rename ${familiarsOf(player).owned[key]?.name ?? "your familiar"}`)
    .textField("New name", "a name")
    .show(player)
    .then((response) => {
      if (response.canceled || !player.isValid) return;
      const name = String(response.formValues?.[0] ?? "");
      if (rename(player, key, name)) notify(player, `§aYour familiar is now called ${name.trim()}.`);
    })
    .catch(() => {});
}

// ------------------------------------------------------------------ events

world.afterEvents.itemUse.subscribe((event) => {
  try {
    const player = event.source;
    const item = event.itemStack?.typeId;
    if (item === BELL) {
      if (player.isSneaking) openFamiliars(player);
      else notify(player, familiarsOf(player).active ? dismiss(player) : summon(player));
      return;
    }
    const kind = KINDS.find((k) => k.token === item);
    if (!kind) return;
    const said = bind(player, kind.key);
    notify(player, said);
    if (said.includes("bound to you.")) {
      // the token is spent
      const inv = player.getComponent("minecraft:inventory")?.container;
      if (inv) {
        for (let i = 0; i < inv.size; i++) {
          const stack = inv.getItem(i);
          if (stack?.typeId !== item) continue;
          if (stack.amount > 1) {
            stack.amount -= 1;
            inv.setItem(i, stack);
          } else inv.setItem(i, undefined);
          break;
        }
      }
    }
  } catch (error) {
    console.warn(`[Overlord] a familiar failed: ${error}`);
  }
});

// Foes felled while a familiar is out make it grow; Hanzo picks their pockets.
world.afterEvents.entityDie.subscribe((event) => {
  try {
    const player = creditedPlayer(event.damageSource?.damagingEntity);
    if (!player) return;
    const f = familiarsOf(player);
    if (!f.active || !f.owned[f.active]) return;
    const dead = event.deadEntity;
    let max = 20;
    try {
      max = dead.getComponent("minecraft:health")?.effectiveMax ?? 20;
    } catch {
      // the body is gone
    }
    feed(player, Math.max(5, Math.min(60, Math.round(max / 4))));
    if (f.active === "hanzo" && knows(player, 1) && Math.random() < 0.3) {
      const coins = 1 + Math.floor(Math.random() * 3);
      giveItem(player, COIN, coins);
      notify(player, `§8Hanzo lifts §6${coins} gold§8 from the fallen.`);
    }
  } catch {
    // the corpse is gone
  }
});

// Shadow Bind: whatever strikes the master of a Shadow Demon is bound.
world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const player = event.hurtEntity;
    if (player.typeId !== "minecraft:player") return;
    const p = /** @type {Player} */ (player);
    const f = familiarsOf(p);
    if (f.active !== "shadow" || !knows(p, 2)) return;
    const foe = event.damageSource?.damagingEntity;
    if (!foe || foe.typeId === "minecraft:player" || !due(p, "bind", 8, system.currentTick)) return;
    foe.addEffect("slowness", 3 * TICKS, { amplifier: 3 });
    strike(p, foe, 4);
    fx.implode(p.dimension, foe.location, "dark", 1.2);
  } catch {
    // no binding it
  }
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      tend(player, system.currentTick);
    } catch {
      // the player is changing dimension
    }
  }
}, TICKS);

world.afterEvents.playerLeave.subscribe((event) => {
  for (const dim of ["overworld", "nether", "the_end"]) {
    try {
      for (const e of world.getDimension(dim).getEntities({ tags: [`overlord_familiar_${event.playerId}`] })) e.remove();
    } catch {
      // that dimension is not loaded
    }
  }
});

registerMenu((player) => {
  const f = familiarsOf(player);
  const out = f.active ? f.owned[f.active] : undefined;
  return `Familiars (${Object.keys(f.owned).length}/${KINDS.length})\n§8${out ? `${out.name} is out` : "Bind and call your companions"}`;
}, openFamiliars);
