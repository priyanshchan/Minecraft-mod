// Overlord: Tomb of Nazarick - the Court of Nazarick: the Floor Guardians serve a crowned player.
//
// A Guardian the player has defeated (anywhere: the Great Tomb, a raid, the wilds) may be sworn into the
// service of their Sorcerer Kingdom (kingdom.js). A sworn Guardian holds a post at court, which shapes the
// realm (Albedo keeps the treasury, Demiurge plans against invasions, Cocytus drills the guards...), and
// while the ruler is in the capital the Guardians stand in the throne hall. One Guardian at a time may
// instead walk at the ruler's side: a strong companion with a signature move, who leaves the court post
// empty meanwhile. A Guardian who falls returns to Nazarick to recover. Loyalty grows with every foe slain
// together and every invasion repelled, and makes a companion's move stronger.
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { notify, profileOf, touch } from "./rpg.js";
import { realmHooks, realmOf } from "./kingdom.js";
import { foesNear, strike } from "./arms.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
/** Seconds between two signature moves of a companion. */
export const MOVE_EVERY = 8;
/** Seconds a fallen Guardian needs to recover. */
export const RECOVERY = 300;
/** Court Guardians stand in the throne hall while the ruler is this close to the capital. */
const COURT_RANGE = 40;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("./kingdom.js").Realm} Realm */
/**
 * @typedef {{
 *   name: string, title: string, element: string, role: string, roleHelp: string, move: string, moveHelp: string,
 *   oath: string, post: [number, number],
 * }} Guardian
 */

/** @type {Record<string, Guardian>} */
export const GUARDIANS = {
  albedo: {
    name: "Albedo", title: "Overseer of the Floor Guardians", element: "dark", post: [1.5, -5.5],
    role: "Overseer", roleHelp: "taxes fill the treasury 25% faster, and it holds 2 more days",
    move: "Wall of Iron", moveHelp: "you gain Absorption and Resistance; foes beside her are struck and thrown back",
    oath: "I am yours, body and soul, Your Majesty. Command me.",
  },
  demiurge: {
    name: "Demiurge", title: "Guardian of the Seventh Floor", element: "fire", post: [-1.5, -5.5],
    role: "Strategist", roleHelp: "invasions bring a quarter fewer foes and half again the spoils, looting is capped at 15%, and caravans are never raided",
    move: "Hellfire Wall", moveHelp: "every foe within 7 blocks burns",
    oath: "A splendid move, Your Majesty. Allow me to make it flawless.",
  },
  cocytus: {
    name: "Cocytus", title: "Guardian of the Fifth Floor", element: "ice", post: [2.5, -3.5],
    role: "General", roleHelp: "two more guards at every holding, and every guard fights with Strength",
    move: "Frozen Heaven", moveHelp: "a blast of cold strikes and slows every foe within 6 blocks",
    oath: "My Blade Is Yours, My King. Point Me At Your Enemies.",
  },
  shalltear: {
    name: "Shalltear Bloodfallen", title: "Guardian of the First to Third Floors", element: "dark", post: [-2.5, -3.5],
    role: "Vanguard", roleHelp: "she takes the field in every invasion of your holdings",
    move: "Purification Lance", moveHelp: "a lance of light pierces the strongest foe in sight",
    oath: "My lord! Shalltear Bloodfallen lives only to serve you!",
  },
  aura: {
    name: "Aura Bella Fiora", title: "Guardian of the Sixth Floor", element: "acid", post: [-1, -2],
    role: "Beastmaster", roleHelp: "each outpost pays 4 more coins and 1 more crystal a day",
    move: "Breath of Fear", moveHelp: "every foe within 10 blocks is weakened and slowed",
    oath: "Leave the forests and the beasts to me, Your Majesty!",
  },
  mare: {
    name: "Mare Bello Fiore", title: "Guardian of the Sixth Floor", element: "acid", post: [1, -2],
    role: "Druid", roleHelp: "the population grows twice as fast and the land feeds 20 more",
    move: "Earth Surge", moveHelp: "the ground heaves: foes within 6 blocks are struck and thrown up",
    oath: "U-um... I'll do my very best for you, Your Majesty...",
  },
  pandoras_actor: {
    name: "Pandora's Actor", title: "Treasurer of the Vault", element: "arcane", post: [0, -4],
    role: "Treasurer", roleHelp: "trade routes pay half again as much, and every workshop makes one more ware a day",
    move: "Doppelganger", moveHelp: "takes the shape of another Guardian and uses their move",
    oath: "Wenn es meines Gottes Wille ist! Your treasurer stands ready!",
  },
};
export const KEYS = Object.keys(GUARDIANS);

// ---------------------------------------------------------------- the court

/** The Guardians sworn to a realm. @param {Realm} realm */
export function sworn(realm) {
  if (!realm.guardians || typeof realm.guardians !== "object") realm.guardians = {};
  return /** @type {Record<string, { loyalty: number }>} */ (realm.guardians);
}

/** Whether a Guardian holds their post at court (sworn, and not away at the ruler's side). @param {Realm} realm @param {string} key */
export function atCourt(realm, key) {
  return key in sworn(realm) && realm.companion !== key;
}

/** Whether the player has defeated a Guardian. @param {Player} player @param {string} key */
export function defeated(player, key) {
  const p = profileOf(player);
  return Array.isArray(p.bosses) && p.bosses.includes(key);
}

/**
 * Swears a defeated Guardian into the ruler's service. Returns a message.
 * @param {Player} player @param {string} key
 */
export function swear(player, key) {
  const realm = realmOf(player);
  const g = GUARDIANS[key];
  if (!g) return "§7No such Guardian";
  if (!realm) return "§7Found your kingdom first: the Guardians serve a sovereign";
  if (key in sworn(realm)) return `§7${g.name} already serves you`;
  if (!defeated(player, key)) return `§7Defeat ${g.name} first to earn their fealty`;
  sworn(realm)[key] = { loyalty: 0 };
  touch(player);
  try {
    player.onScreenDisplay.setTitle(`§d${g.name}`, { subtitle: `§f"${g.oath}"`, fadeInDuration: 5, stayDuration: 80, fadeOutDuration: 15 });
    player.sendMessage(`§6[Court] §d${g.name}§f, ${g.title}, kneels: §7"${g.oath}" §fPost: §e${g.role}§f - ${g.roleHelp}.`);
    player.playSound("random.totem", { volume: 0.8, pitch: 1.2 });
  } catch {
    // the player left
  }
  fx.pillar(player.dimension, player.location, g.element, 7);
  return `§d${g.name} swears fealty`;
}

/** @param {Player} player */
function companionTag(player) {
  return `overlord_guardian_${player.id}`;
}
/** @param {Player} player */
function courtTag(player) {
  return `overlord_court_${player.id}`;
}

/** Player id -> tick when a fallen companion has recovered. */
/** @type {Map<string, number>} */
export const recovering = new Map();

/**
 * Brings a sworn Guardian to the ruler's side (sending any other back to court). Returns a message.
 * @param {Player} player @param {string} key @param {number} [now]
 */
export function summon(player, key, now = system.currentTick) {
  const realm = realmOf(player);
  const g = GUARDIANS[key];
  if (!realm || !g || !(key in sworn(realm))) return "§7That Guardian does not serve you";
  if (now < (recovering.get(`${player.id}|${key}`) ?? 0)) {
    return `§7${g.name} is recovering in Nazarick for ${Math.ceil(((recovering.get(`${player.id}|${key}`) ?? 0) - now) / TICKS)}s`;
  }
  release(player);
  realm.companion = key;
  touch(player);
  const at = companionOf(player) ? undefined : call(player, key);
  return at ? `§d${g.name} is at your side` : `§7${g.name} will join you shortly`;
}

/** Sends the companion back to court. @param {Player} player */
export function release(player) {
  const realm = realmOf(player);
  for (const e of mine(player)) {
    fx.rise(e.dimension, e.location, "arcane", 0.8);
    try {
      e.remove();
    } catch {
      // gone
    }
  }
  if (!realm || !realm.companion) return "§7No Guardian walks with you";
  const name = GUARDIANS[realm.companion]?.name ?? "Your Guardian";
  delete realm.companion;
  touch(player);
  return `§7${name} returns to court`;
}

/** The companion entities of a player that are loaded. @param {Player} player */
function mine(player) {
  try {
    const tag = companionTag(player);
    return player.dimension.getEntities({ tags: [tag] }).filter((e) => e.isValid && e.hasTag(tag));
  } catch {
    return [];
  }
}

/** @param {Entity} e */
function vanish(e) {
  try {
    e.remove();
  } catch {
    // already gone
  }
}

/** The player's companion, if loaded. @param {Player} player */
export function companionOf(player) {
  return mine(player)[0];
}

/** Raises the companion beside the player. @param {Player} player @param {string} key */
function call(player, key) {
  const g = GUARDIANS[key];
  let view = { x: 0, y: 0, z: 1 };
  try {
    view = player.getViewDirection();
  } catch {
    // facing on
  }
  const length = Math.hypot(view.x, view.z) || 1;
  const at = { x: player.location.x - (view.z / length) * 2, y: player.location.y, z: player.location.z + (view.x / length) * 2 };
  try {
    const e = player.dimension.spawnEntity(id(`guardian_${key}`), at);
    e.addTag(companionTag(player));
    e.addTag("overlord_guardian");
    e.setDynamicProperty("overlord:owner", player.id);
    fx.pillar(player.dimension, at, g.element, 5);
    system.runTimeout(() => {
      try {
        if (e.isValid && player.isValid) e.getComponent("minecraft:tameable")?.tame(player);
      } catch {
        // it still fights at the ruler's side
      }
    }, 2);
    return e;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- signature moves

/** Player id -> tick of the companion's next move. */
const nextMove = new Map();

/**
 * The companion's signature move, if foes are near and it is ready. Returns how many foes it touched, or -1.
 * @param {Player} player @param {Entity} guardian @param {string} key @param {number} now @param {() => number} [random]
 */
export function signature(player, guardian, key, now, random = Math.random) {
  if (now < (nextMove.get(player.id) ?? 0)) return -1;
  const foes = foesNear(player, guardian.location, 10);
  if (foes.length === 0) return -1;
  nextMove.set(player.id, now + MOVE_EVERY * TICKS);
  const realm = realmOf(player);
  const loyalty = realm ? sworn(realm)[key]?.loyalty ?? 0 : 0;
  const power = (1 + profileOf(player).level / 100) * (1 + loyalty / 100);
  let move = key;
  if (key === "pandoras_actor") move = KEYS.filter((k) => k !== "pandoras_actor")[Math.floor(random() * (KEYS.length - 1))];
  const g = GUARDIANS[move];
  const d = guardian.dimension;
  const at = guardian.location;
  const within = (/** @type {number} */ r) => foes.filter((f) => Math.hypot(f.location.x - at.x, f.location.z - at.z) <= r);
  let touched = 0;
  if (move === "albedo") {
    try {
      player.addEffect("absorption", 10 * TICKS, { amplifier: 1 });
      player.addEffect("resistance", 10 * TICKS, { amplifier: 0 });
    } catch {
      // effects are a bonus
    }
    for (const f of within(4)) {
      strike(player, f, 10 * power);
      try {
        f.applyKnockback({ x: f.location.x - at.x, z: f.location.z - at.z }, 0.4);
      } catch {
        // gone
      }
      touched++;
    }
    fx.dome(d, at, "dark");
  } else if (move === "demiurge") {
    for (const f of within(7)) {
      strike(player, f, 12 * power);
      try {
        f.setOnFire(5, true);
      } catch {
        // gone
      }
      touched++;
    }
    fx.ring(d, at, "fire", 7);
    fx.nova(d, at, "fire", 5);
  } else if (move === "cocytus") {
    for (const f of within(6)) {
      strike(player, f, 15 * power);
      try {
        f.addEffect("slowness", 6 * TICKS, { amplifier: 2 });
      } catch {
        // gone
      }
      touched++;
    }
    fx.nova(d, at, "ice", 6);
  } else if (move === "shalltear") {
    const strongest = foes.reduce((best, f) => {
      const h = f.getComponent("minecraft:health")?.currentValue ?? 0;
      const bh = best.getComponent("minecraft:health")?.currentValue ?? 0;
      return h > bh ? f : best;
    }, foes[0]);
    fx.beam(d, { x: at.x, y: at.y + 1.5, z: at.z }, { x: strongest.location.x, y: strongest.location.y + 1, z: strongest.location.z }, "holy", 1.6);
    strike(player, strongest, 30 * power);
    touched = 1;
  } else if (move === "aura") {
    for (const f of foes) {
      try {
        f.addEffect("weakness", 6 * TICKS, { amplifier: 1 });
        f.addEffect("slowness", 6 * TICKS, { amplifier: 1 });
      } catch {
        // gone
      }
      strike(player, f, 5 * power);
      touched++;
    }
    fx.circle(d, at, "acid", 10);
  } else if (move === "mare") {
    for (const f of within(6)) {
      strike(player, f, 14 * power);
      try {
        f.applyKnockback({ x: 0, z: 0 }, 0.9);
      } catch {
        // gone
      }
      touched++;
    }
    fx.shake(d, at, 10, 0.4, 0.6);
    fx.ring(d, at, "acid", 6);
  }
  notify(player, `§d${GUARDIANS[key].name}: §f${g.move}!${key === "pandoras_actor" ? ` §7(as ${g.name})` : ""}`);
  return touched;
}

/** Loyalty grows. @param {Realm} realm @param {string} key @param {number} by */
export function earnLoyalty(realm, key, by) {
  const entry = sworn(realm)[key];
  if (!entry) return 0;
  entry.loyalty = Math.min(100, Math.round((entry.loyalty + by) * 100) / 100);
  return entry.loyalty;
}

// ---------------------------------------------------------------- each second

/**
 * Keeps a ruler's companion beside them and fighting, and the court in the throne hall.
 * @param {Player} player @param {number} now @param {boolean} [court] also post the court in the throne hall
 */
export function tend(player, now, court = false) {
  const realm = realmOf(player);
  if (!realm) return;
  const key = realm.companion;
  const out = mine(player);
  if (key && GUARDIANS[key]) {
    // only ever one
    for (const extra of out.slice(1)) vanish(extra);
    /** @type {Entity | undefined} */
    let guardian = out[0];
    if (guardian && guardian.typeId !== id(`guardian_${key}`)) {
      vanish(guardian);
      guardian = undefined;
    }
    if (!guardian && now >= (recovering.get(`${player.id}|${key}`) ?? 0)) guardian = call(player, key);
    if (guardian && guardian.isValid) {
      if (Math.hypot(guardian.location.x - player.location.x, guardian.location.z - player.location.z) > 24) {
        try {
          guardian.teleport({ x: player.location.x + 1.5, y: player.location.y, z: player.location.z });
        } catch {
          // not loaded there
        }
      }
      signature(player, guardian, key, now);
    }
  } else {
    for (const e of out) vanish(e);
  }
  if (court) holdCourt(player, realm);
}

/** The Guardians at court stand in the throne hall while the ruler is in the capital. @param {Player} player @param {Realm} realm */
export function holdCourt(player, realm) {
  if (player.dimension.id !== "minecraft:overworld" && player.dimension.id !== "overworld") return 0;
  if (Math.hypot(player.location.x - realm.x, player.location.z - realm.z) > COURT_RANGE) return 0;
  let posted = 0;
  for (const key of Object.keys(sworn(realm))) {
    if (!atCourt(realm, key)) continue;
    const type = id(`guardian_${key}`);
    let present = [];
    try {
      present = player.dimension.getEntities({ type, tags: [courtTag(player)], location: { x: realm.x, y: realm.y, z: realm.z }, maxDistance: 30 });
    } catch {
      continue;
    }
    if (present.length > 0) continue;
    const [dx, dz] = GUARDIANS[key].post;
    try {
      const e = player.dimension.spawnEntity(type, { x: realm.x + 0.5 + dx, y: realm.y, z: realm.z + 0.5 + dz }, { spawnEvent: `${NS}:to_court` });
      e.addTag(courtTag(player));
      e.addTag("overlord_guardian");
      posted++;
    } catch {
      // not loaded
    }
  }
  return posted;
}

// ---------------------------------------------------------------- the posts

realmHooks.income.push((realm, pay) => {
  if (atCourt(realm, "albedo")) pay.coins *= 1.25;
  if (atCourt(realm, "aura")) {
    pay.coins += 4 * realm.outposts.length;
    pay.crystals += realm.outposts.length;
  }
});
realmHooks.capDays.push((realm) => (atCourt(realm, "albedo") ? 2 : 0));
realmHooks.guards.push((realm) => (atCourt(realm, "cocytus") ? 2 : 0));
realmHooks.guardPosted.push((realm, guard) => {
  if (!atCourt(realm, "cocytus")) return;
  try {
    guard.addEffect("strength", 20000000, { amplifier: 0, showParticles: false });
  } catch {
    // no effects
  }
});
realmHooks.siege.push((realm, siege) => {
  if (atCourt(realm, "demiurge")) siege.scale *= 0.75;
  if (!atCourt(realm, "shalltear")) return;
  try {
    const at = { x: siege.at.x + 0.5, y: siege.at.y, z: siege.at.z + 6.5 };
    const e = siege.ruler.dimension.spawnEntity(id("guardian_shalltear"), at, { spawnEvent: `${NS}:sortie` });
    e.addTag(`${siege.tag}_ally`);
    e.addTag("overlord_guardian");
    fx.pillar(siege.ruler.dimension, at, "dark", 6);
    siege.ruler.sendMessage("§6[Court] §dShalltear§f takes the field: §7\"Leave them to me~\"");
  } catch {
    // not loaded
  }
});
realmHooks.spoils.push((realm, spoils) => (atCourt(realm, "demiurge") ? spoils * 1.5 : spoils));
realmHooks.loot.push((realm, share) => (atCourt(realm, "demiurge") ? Math.min(share, 0.15) : share));
realmHooks.repelled.push((player, realm) => {
  for (const key of Object.keys(sworn(realm))) earnLoyalty(realm, key, 5);
  touch(player);
});
realmHooks.menu.push({
  label: (_player, realm) => `Court of Nazarick\n§5${Object.keys(sworn(realm)).length}/${KEYS.length} Guardians sworn`,
  open: (player) => openCourt(player),
});

// ---------------------------------------------------------------- events

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    if (dead.hasTag("overlord_guardian")) {
      const owner = String(dead.getDynamicProperty("overlord:owner") ?? "");
      const key = dead.typeId.replace(`${NS}:guardian_`, "");
      if (owner) {
        recovering.set(`${owner}|${key}`, system.currentTick + RECOVERY * TICKS);
        const player = world.getAllPlayers().find((p) => p.id === owner);
        if (player) player.sendMessage(`§6[Court] §d${GUARDIANS[key]?.name ?? "Your Guardian"}§f falls, and returns to Nazarick to recover (${RECOVERY / 60} minutes).`);
      }
      return;
    }
    // a foe slain with a Guardian beside the ruler: loyalty
    const killer = event.damageSource.damagingEntity;
    if (!killer || !dead.matches({ families: ["monster"] })) return;
    const player = killer.typeId === "minecraft:player" ? /** @type {Player} */ (killer)
      : killer.hasTag("overlord_guardian") ? world.getAllPlayers().find((p) => p.id === killer.getDynamicProperty("overlord:owner")) : undefined;
    if (!player) return;
    const realm = realmOf(player);
    if (!realm || !realm.companion) return;
    earnLoyalty(realm, realm.companion, 0.5);
    touch(player);
  } catch {
    // unloaded
  }
});

let beat = 0;
system.runInterval(() => {
  const now = system.currentTick;
  const court = ++beat % 5 === 0;
  for (const player of world.getAllPlayers()) {
    try {
      tend(player, now, court);
    } catch (error) {
      console.warn(`[Overlord] the court failed: ${error}`);
    }
  }
}, TICKS);

// ---------------------------------------------------------------- the court page

/** @param {Player} player */
export function openCourt(player) {
  const realm = realmOf(player);
  if (!realm) return;
  const lines = KEYS.map((key) => {
    const g = GUARDIANS[key];
    const entry = sworn(realm)[key];
    if (!entry) return defeated(player, key) ? `§e${g.name}§7 - defeated: may be sworn in` : `§8${g.name} - defeat them to earn their fealty`;
    const where = realm.companion === key ? "§bat your side" : `§aat court as ${g.role}`;
    return `§d${g.name}§f - ${where}§7, loyalty ${Math.floor(entry.loyalty)}/100`;
  });
  const form = new ActionFormData()
    .title("Court of Nazarick")
    .body(
      `§7Guardians you have defeated may be sworn to your kingdom. At court each holds a post that shapes the realm; one at a time may walk at your side instead, and their post stands empty meanwhile.§r\n\n${lines.join("\n")}`
    );
  /** @type {(() => void)[]} */
  const actions = [];
  for (const key of KEYS) {
    const g = GUARDIANS[key];
    const entry = sworn(realm)[key];
    if (!entry && defeated(player, key)) {
      form.button(`§6Swear in ${g.name}\n§r${g.role}`);
      actions.push(() => notify(player, swear(player, key)));
    } else if (entry && realm.companion !== key) {
      form.button(`Bring ${g.name} to your side\n§8${g.move}`);
      actions.push(() => notify(player, summon(player, key)));
    } else if (entry) {
      form.button(`Send ${g.name} back to court\n§8${g.role}`);
      actions.push(() => notify(player, release(player)));
    }
  }
  form.button("Their posts and moves");
  actions.push(() => openPosts(player));
  form.button("Close");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      actions[response.selection]?.();
    })
    .catch(() => {});
}

/** @param {Player} player */
function openPosts(player) {
  const form = new ActionFormData()
    .title("The Guardians' posts")
    .body(KEYS.map((key) => {
      const g = GUARDIANS[key];
      return `§d${g.name}§r\n§eAt court, ${g.role}:§f ${g.roleHelp}.\n§bAt your side, ${g.move}:§f ${g.moveHelp}.`;
    }).join("\n\n"))
    .button("Back");
  form
    .show(player)
    .then((response) => {
      if (!response.canceled && player.isValid) openCourt(player);
    })
    .catch(() => {});
}
