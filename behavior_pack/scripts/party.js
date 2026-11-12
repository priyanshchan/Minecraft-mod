// Overlord: Tomb of Nazarick - the party.
// Every player can raise one retainer of their own (name, look and vocation of their
// choice) and hire up to two mercenaries. Retainers follow a stance set by the player
// (Come / Go / Stay), level with their master, use a vocation skill on the master's
// target, call out what they know about foes, and return a minute after they fall.
import { world, system, EntityDamageCause } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { TIPS, creditedPlayer, notify, profileOf, registerMenu, standingOf, touch } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const LONG = 20000000;
const COIN = id("yggdrasil_gold_coin");
const RETAINER = id("retainer");

export const MAX_PARTY = 3;
export const MAX_GEAR = 5;
const RECOVERY = 60; // seconds before a fallen retainer returns
const STANCES = /** @type {const} */ (["come", "go", "stay"]);
const STANCE_HELP = {
  come: "Come - stay close and defend",
  go: "Go - range ahead and attack monsters on sight",
  stay: "Stay - hold this spot",
};

export const VOCATIONS = ["Fighter", "Archer", "Mage", "Healer"];
/** The eight looks; look N belongs to vocation floor(N / 2). */
export const LOOKS = ["Knight", "Swordsman", "Ranger", "Hunter", "Sorcerer", "Wizard", "Priest", "Acolyte"];
const NAMES = ["Aria", "Borin", "Celia", "Dain", "Elsa", "Fenn", "Gwen", "Hale", "Iris", "Joss", "Kara", "Lund", "Mira", "Nils", "Orla", "Penn"];

/** Element a mage retainer reaches for against particular foes. */
const WEAK_TO = {
  [id("cocytus")]: "fire",
  [id("soul_eater")]: "fire",
  [id("solution")]: "fire",
  [id("demiurge")]: "ice",
  [id("fluder")]: "ice",
  "minecraft:blaze": "ice",
  "minecraft:stray": "fire",
};

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {{ name: string, look: number, gear: number, hired: boolean, level: number, out: boolean }} Member */

// ------------------------------------------------------------------- roster

/**
 * The player's party, cleaned of anything malformed.
 * @param {Player} player
 * @returns {Member[]}
 */
export function partyOf(player) {
  const p = profileOf(player);
  p.party = p.party
    .filter((m) => m && typeof m.name === "string" && typeof m.look === "number")
    .slice(0, MAX_PARTY)
    .map((m) => ({
      name: String(m.name).slice(0, 16) || "Retainer",
      look: Math.min(LOOKS.length - 1, Math.max(0, Math.floor(m.look))),
      gear: Math.min(MAX_GEAR, Math.max(0, Math.floor(Number(m.gear) || 0))),
      hired: Boolean(m.hired),
      level: Math.max(1, Math.floor(Number(m.level) || 1)),
      out: Boolean(m.out),
    }));
  if (!STANCES.includes(/** @type {any} */ (p.stance))) p.stance = "come";
  return p.party;
}

/** @param {Player} player @param {Member} member */
export function levelOf(player, member) {
  return member.hired ? member.level : profileOf(player).level;
}

/** @param {Player} player @param {number} index */
function tagOf(player, index) {
  return `ovr_${player.id}_${index}`;
}

/** `${playerId}|${index}` -> tick at which a fallen retainer may return. */
const fallen = new Map();

/** Seconds until a fallen retainer returns (0 when ready). @param {Player} player @param {number} index */
export function recovering(player, index) {
  return Math.max(0, Math.ceil(((fallen.get(`${player.id}|${index}`) ?? 0) - system.currentTick) / TICKS));
}

/**
 * Creates (or re-styles) the player's own retainer in the first party slot.
 * @param {Player} player @param {string} name @param {number} look
 */
export function createMain(player, name, look) {
  const party = partyOf(player);
  const clean = name.trim().slice(0, 16) || "Retainer";
  const existing = party.find((m) => !m.hired);
  if (existing) {
    existing.name = clean;
    existing.look = look;
    refresh(player, party.indexOf(existing));
  } else {
    if (party.length >= MAX_PARTY) return false;
    party.unshift({ name: clean, look, gear: 0, hired: false, level: 1, out: true });
    retag(player);
  }
  touch(player);
  return true;
}

/**
 * Three mercenaries looking for work near the player's level.
 * @param {Player} player @param {() => number} [random]
 */
export function candidates(player, random = Math.random) {
  const level = profileOf(player).level;
  const discount = standingOf(profileOf(player), "adventurers") >= 30 ? 0.75 : 1; // friends of the guild pay less
  const list = [];
  for (let i = 0; i < 3; i++) {
    const hireLevel = Math.max(1, level + Math.floor(random() * 5) - 2);
    list.push({
      name: NAMES[Math.floor(random() * NAMES.length)],
      look: Math.floor(random() * LOOKS.length),
      level: hireLevel,
      cost: Math.round((10 + hireLevel * 2) * discount),
    });
  }
  return list;
}

/**
 * Hires a mercenary. Returns a message describing the outcome.
 * @param {Player} player @param {{ name: string, look: number, level: number, cost: number }} who
 */
export function hire(player, who) {
  const party = partyOf(player);
  if (party.length >= MAX_PARTY) return `§7Your party is full (${MAX_PARTY})`;
  if (countItem(player, COIN) < who.cost) return `§7${who.name} asks for ${who.cost} Gold Coins`;
  takeItem(player, COIN, who.cost);
  party.push({ name: who.name, look: who.look, gear: 0, hired: true, level: who.level, out: true });
  touch(player);
  return `§a${who.name} the ${LOOKS[who.look]} joins your party`;
}

/**
 * Removes a member from the party for good.
 * @param {Player} player @param {number} index
 */
export function release(player, index) {
  const party = partyOf(player);
  if (!party[index]) return;
  for (let i = 0; i < MAX_PARTY; i++) removeEntities(player, i);
  party.splice(index, 1);
  touch(player);
}

/**
 * Improves a member's gear by one rank for Gold Coins.
 * @param {Player} player @param {number} index
 */
export function upgrade(player, index) {
  const member = partyOf(player)[index];
  if (!member) return "§7No such party member";
  if (member.gear >= MAX_GEAR) return `§7${member.name}'s gear is already the best there is`;
  const cost = gearCost(member.gear);
  if (countItem(player, COIN) < cost) return `§7Better gear costs ${cost} Gold Coins`;
  takeItem(player, COIN, cost);
  member.gear += 1;
  touch(player);
  refresh(player, index);
  return `§a${member.name}'s gear is now rank ${member.gear}`;
}

/** @param {number} gear */
export function gearCost(gear) {
  return 20 * (gear + 1);
}

/**
 * @param {Player} player
 * @param {"come" | "go" | "stay"} stance
 */
export function setStance(player, stance) {
  profileOf(player).stance = stance;
  touch(player);
  for (let i = 0; i < MAX_PARTY; i++) {
    for (const entity of entitiesOf(player, i)) {
      try {
        entity.triggerEvent(`${NS}:stance_${stance}`);
      } catch {
        // entity is unloading
      }
    }
  }
  notify(player, `§eParty: §f${STANCE_HELP[stance]}`);
}

/** Switches to the next stance (sneak + use the Command Banner). @param {Player} player */
export function cycleStance(player) {
  partyOf(player);
  const current = STANCES.indexOf(/** @type {any} */ (profileOf(player).stance));
  setStance(player, STANCES[(current + 1) % STANCES.length]);
}

// ----------------------------------------------------------------- entities

/** @param {Player} player @param {number} index @returns {Entity[]} */
function entitiesOf(player, index) {
  try {
    return player.dimension.getEntities({ type: RETAINER, tags: [tagOf(player, index)] });
  } catch {
    return [];
  }
}

/** @param {Player} player @param {number} index */
function removeEntities(player, index) {
  for (const entity of entitiesOf(player, index)) {
    try {
      entity.remove();
    } catch {
      // already gone
    }
  }
}

/** After the roster order changes, entities are respawned so their slot tags match. @param {Player} player */
function retag(player) {
  for (let i = 0; i < MAX_PARTY; i++) removeEntities(player, i);
}

/** @param {Entity} entity @param {number} level @param {number} gear */
function applyStats(entity, level, gear) {
  const signature = `${level}|${gear}`;
  if (entity.getDynamicProperty("overlord:sig") === signature) return;
  entity.setDynamicProperty("overlord:sig", signature);
  const hearts = Math.floor(level / 8) + gear * 2; // each tier is two hearts
  const might = Math.floor(level / 30) + Math.floor(gear / 2);
  for (const effect of ["health_boost", "strength"]) {
    try {
      entity.removeEffect(effect);
    } catch {
      // not present
    }
  }
  if (hearts > 0) entity.addEffect("health_boost", LONG, { amplifier: hearts - 1, showParticles: false });
  if (might > 0) entity.addEffect("strength", LONG, { amplifier: might - 1, showParticles: false });
  const health = entity.getComponent("minecraft:health");
  if (health) health.setCurrentValue(health.effectiveMax);
}

/**
 * Brings a party member into the world next to the player.
 * @param {Player} player @param {number} index
 */
function spawn(player, index) {
  const member = partyOf(player)[index];
  const stance = profileOf(player).stance;
  const angle = (index / MAX_PARTY) * Math.PI * 2;
  const entity = player.dimension.spawnEntity(RETAINER, {
    x: player.location.x + Math.cos(angle) * 1.5,
    y: player.location.y,
    z: player.location.z + Math.sin(angle) * 1.5,
  });
  entity.addTag("overlord_retainer");
  entity.addTag("overlord_summoned");
  entity.addTag(tagOf(player, index));
  entity.setDynamicProperty("overlord:owner", player.id);
  entity.setDynamicProperty("overlord:slot", index);
  entity.nameTag = label(player, member);
  fx.circle(player.dimension, entity.location, "holy", 1.0);
  // Look, stance and ownership are applied once the entity has finished spawning.
  system.runTimeout(() => {
    try {
      if (!entity.isValid || !player.isValid) return;
      entity.triggerEvent(`${NS}:look_${member.look}`);
      entity.triggerEvent(`${NS}:stance_${stance}`);
      entity.getComponent("minecraft:tameable")?.tame(player);
      applyStats(entity, levelOf(player, member), member.gear);
    } catch (error) {
      console.warn(`[Overlord] could not ready a retainer: ${error}`);
    }
  }, 2);
  return entity;
}

/** @param {Player} player @param {Member} member */
function label(player, member) {
  return `${member.name} §7Lv.${levelOf(player, member)} ${VOCATIONS[Math.floor(member.look / 2)]}`;
}

/** Re-creates a member's entity after its look or gear changed. @param {Player} player @param {number} index */
function refresh(player, index) {
  removeEntities(player, index);
}

/**
 * Calls a member to the player's side (or all of them when no index is given).
 * @param {Player} player @param {number} [index]
 */
export function summon(player, index) {
  const party = partyOf(player);
  party.forEach((member, i) => {
    if (index === undefined || index === i) member.out = true;
  });
  touch(player);
  tend(player);
}

/**
 * Sends a member away (or all of them when no index is given).
 * @param {Player} player @param {number} [index]
 */
export function dismiss(player, index) {
  const party = partyOf(player);
  party.forEach((member, i) => {
    if (index !== undefined && index !== i) return;
    member.out = false;
    removeEntities(player, i);
  });
  touch(player);
}

// ------------------------------------------------------------------ chatter

/** Tick before which a player's retainers stay quiet. */
const quietUntil = new Map();
/** Foe types a player's retainers have already commented on this session. */
const remarked = new Map();

/**
 * @param {Player} player @param {Member} member @param {string} text @param {number} [pause] seconds of quiet afterwards
 */
function say(player, member, text, pause = 15) {
  if (system.currentTick < (quietUntil.get(player.id) ?? 0)) return false;
  quietUntil.set(player.id, system.currentTick + pause * TICKS);
  try {
    player.sendMessage(`§b<${member.name}>§f ${text}`);
  } catch {
    // player left
  }
  return true;
}

/** The mob each player last struck, with the tick it happened. */
/** @type {Map<string, { entity: Entity, tick: number }>} */
const targets = new Map();

world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    if (!attacker || attacker.typeId !== "minecraft:player" || !victim.isValid) return;
    if (victim.typeId === "minecraft:player" || victim.typeId === RETAINER) return;
    const player = /** @type {Player} */ (attacker);
    targets.set(player.id, { entity: victim, tick: system.currentTick });
    // The first time the master strikes a kind of foe, a retainer shares what it knows.
    const tip = TIPS[victim.typeId];
    const active = partyOf(player).filter((m, i) => m.out && recovering(player, i) === 0);
    if (!tip || active.length === 0) return;
    const seen = remarked.get(player.id) ?? new Set();
    remarked.set(player.id, seen);
    if (seen.has(victim.typeId)) return;
    if (say(player, active[Math.floor(Math.random() * active.length)], tip)) seen.add(victim.typeId);
  } catch {
    // someone vanished mid-hit
  }
});

// ------------------------------------------------------------------- skills

/** Entity id -> tick at which its vocation skill is ready again. */
const skillReady = new Map();

/**
 * Vocation skill of one retainer, used on the master's current target.
 * @param {Player} player @param {Entity} entity @param {Member} member
 */
function useSkill(player, entity, member) {
  if (system.currentTick < (skillReady.get(entity.id) ?? 0)) return;
  const vocation = Math.floor(member.look / 2);
  const level = levelOf(player, member);
  const hand = { x: entity.location.x, y: entity.location.y + 1.3, z: entity.location.z };
  const reach = (/** @type {Entity} */ other) =>
    Math.hypot(other.location.x - entity.location.x, other.location.z - entity.location.z);

  if (vocation === 3) {
    // Healer: mend the master, then the rest of the party.
    const health = player.getComponent("minecraft:health");
    if (health && health.currentValue > 0 && health.currentValue < health.effectiveMax * 0.6 && reach(player) <= 12) {
      health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + 4 + level * 0.1));
      fx.beam(player.dimension, hand, { x: player.location.x, y: player.location.y + 1, z: player.location.z }, "holy");
      fx.rise(player.dimension, player.location, "holy", 0.7);
      skillReady.set(entity.id, system.currentTick + 6 * TICKS);
      say(player, member, "Hold on, Master - I have you.", 30);
    }
    return;
  }

  if (profileOf(player).stance === "stay") return;
  const mark = targets.get(player.id);
  if (!mark || system.currentTick - mark.tick > 10 * TICKS || !mark.entity.isValid) return;
  const foe = mark.entity;
  const at = { x: foe.location.x, y: foe.location.y + 1, z: foe.location.z };
  const distance = reach(foe);
  if (vocation === 0 && distance <= 4) {
    // Fighter: shield bash - a heavy blow that staggers the target.
    foe.applyDamage(3 + level * 0.2, { cause: EntityDamageCause.entityAttack, damagingEntity: entity });
    if (foe.isValid) {
      foe.addEffect("slowness", 2 * TICKS, { amplifier: 3 });
      const len = distance || 1;
      foe.applyKnockback({ x: ((foe.location.x - entity.location.x) / len) * 1.2, z: ((foe.location.z - entity.location.z) / len) * 1.2 }, 0.3);
    }
    fx.ring(player.dimension, foe.location, "none", 1.5);
    skillReady.set(entity.id, system.currentTick + 8 * TICKS);
  } else if (vocation === 1 && distance <= 22) {
    // Archer: an aimed shot.
    foe.applyDamage(4 + level * 0.25, { cause: EntityDamageCause.entityAttack, damagingEntity: entity });
    fx.beam(player.dimension, hand, at, "none", 0.7);
    fx.spark(player.dimension, at, "none", 0.8);
    skillReady.set(entity.id, system.currentTick + 7 * TICKS);
  } else if (vocation === 2 && distance <= 18) {
    // Mage: a bolt of whatever element the foe likes least.
    const element = WEAK_TO[foe.typeId] ?? "arcane";
    const bonus = WEAK_TO[foe.typeId] ? 1.5 : 1;
    foe.applyDamage((5 + level * 0.3) * bonus, { cause: EntityDamageCause.magic, damagingEntity: entity });
    fx.circle(player.dimension, entity.location, element, 1.0);
    fx.beam(player.dimension, hand, at, element);
    fx.spark(player.dimension, at, element, 1.1);
    skillReady.set(entity.id, system.currentTick + 8 * TICKS);
  }
}

// --------------------------------------------------------------- upkeep loop

/**
 * Keeps a player's summoned retainers present, up to date and using their skills.
 * @param {Player} player
 */
export function tend(player) {
  const party = partyOf(player);
  const health = player.getComponent("minecraft:health");
  if (!health || health.currentValue <= 0) return; // nothing is called to a dead master
  party.forEach((member, index) => {
    if (!member.out || recovering(player, index) > 0) return;
    const found = entitiesOf(player, index);
    for (const extra of found.slice(1)) {
      try {
        extra.remove(); // a copy left behind in another place has caught up with us
      } catch {
        // already gone
      }
    }
    const entity = found[0] ?? spawn(player, index);
    if (found[0]) {
      try {
        applyStats(entity, levelOf(player, member), member.gear);
        const name = label(player, member);
        if (entity.nameTag !== name) entity.nameTag = name;
        useSkill(player, entity, member);
      } catch {
        // entity is unloading
      }
    }
  });
  if (party.some((m) => m.out) && health.currentValue < health.effectiveMax * 0.3) {
    const awake = party.filter((m, i) => m.out && recovering(player, i) === 0);
    if (awake.length > 0) say(player, awake[0], "Master, you are badly hurt - fall back!", 40);
  }
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      tend(player);
    } catch (error) {
      console.warn(`[Overlord] party upkeep failed: ${error}`);
    }
  }
}, 2 * TICKS);

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    if (dead.typeId !== RETAINER) return;
    const owner = creditedPlayer(dead);
    const slot = dead.getDynamicProperty("overlord:slot");
    if (!owner || typeof slot !== "number") return;
    const member = partyOf(owner)[slot];
    if (!member) return;
    fallen.set(`${owner.id}|${slot}`, system.currentTick + RECOVERY * TICKS);
    owner.sendMessage(`§6[Party] §c${member.name} has fallen§f and will return in ${RECOVERY} seconds.`);
  } catch {
    // owner is offline
  }
});

world.afterEvents.playerDimensionChange.subscribe((event) => {
  // Retainers do not cross dimensions on their own: the old ones are sent away and new ones appear.
  for (let i = 0; i < MAX_PARTY; i++) {
    try {
      for (const entity of event.fromDimension.getEntities({ type: RETAINER, tags: [tagOf(event.player, i)] })) entity.remove();
    } catch {
      // the old dimension has already unloaded; leftovers are removed when next seen
    }
  }
});

world.afterEvents.playerLeave.subscribe((event) => {
  quietUntil.delete(event.playerId);
  remarked.delete(event.playerId);
  targets.delete(event.playerId);
});

// -------------------------------------------------------------------- menus

/**
 * @param {ActionFormData} form @param {Player} player @param {(choice: number) => void} onChoice
 */
function show(form, player, onChoice) {
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      try {
        onChoice(response.selection);
      } catch (error) {
        console.warn(`[Overlord] party menu action failed: ${error}`);
      }
    })
    .catch((error) => console.warn(`[Overlord] party menu failed: ${error}`));
}

/** @param {Player} player @param {Member} member @param {number} index */
function describe(player, member, index) {
  const wait = recovering(player, index);
  const state = wait > 0 ? `§crecovering ${wait}s` : member.out ? "§awith you" : "§7dismissed";
  return `${member.name} - ${LOOKS[member.look]} (${VOCATIONS[Math.floor(member.look / 2)]}) Lv.${levelOf(player, member)}, gear ${member.gear}/${MAX_GEAR}${member.hired ? ", mercenary" : ""} - ${state}§r`;
}

/**
 * Opens the party menu (Adventurer's Plate entry or the Command Banner).
 * @param {Player} player
 */
export function openParty(player) {
  const party = partyOf(player);
  const p = profileOf(player);
  const hasMain = party.some((m) => !m.hired);
  const form = new ActionFormData()
    .title("Party")
    .body(
      (party.length > 0 ? party.map((m, i) => `${i + 1}. ${describe(player, m, i)}`).join("\n") : "You travel alone.") +
        `\n\nStance: §e${STANCE_HELP[/** @type {"come"} */ (p.stance)]}§r\nRetainers level with you; mercenaries keep the level they were hired at. A fallen member returns after ${RECOVERY} seconds.`
    );
  /** @type {(() => void)[]} */
  const actions = [];
  const add = (/** @type {string} */ text, /** @type {() => void} */ action) => {
    form.button(text);
    actions.push(action);
  };
  if (!hasMain) add("Create your retainer", () => openCreate(player));
  party.forEach((m, i) => add(`Manage ${m.name}`, () => openMember(player, i)));
  if (party.length > 0) {
    add("Call everyone", () => summon(player));
    add("Dismiss everyone", () => dismiss(player));
    for (const stance of STANCES) add(`Stance: ${STANCE_HELP[stance]}`, () => setStance(player, stance));
  }
  if (party.length < MAX_PARTY) add("Hire a mercenary", () => openHire(player));
  show(form, player, (choice) => actions[choice]?.());
}

/** @param {Player} player */
function openCreate(player) {
  const existing = partyOf(player).find((m) => !m.hired);
  const form = new ModalFormData()
    .title(existing ? "Restyle your retainer" : "Create your retainer")
    .textField("Name", "up to 16 letters", { defaultValue: existing?.name ?? "" })
    .dropdown("Look and vocation", LOOKS.map((look, n) => `${look} (${VOCATIONS[Math.floor(n / 2)]})`), {
      defaultValueIndex: existing?.look ?? 0,
    });
  form
    .show(player)
    .then((response) => {
      if (response.canceled || !response.formValues || !player.isValid) return;
      const [name, look] = response.formValues;
      if (createMain(player, String(name ?? ""), Number(look ?? 0))) {
        summon(player);
        notify(player, "§aYour retainer answers the call");
      } else notify(player, `§7Your party is full (${MAX_PARTY})`);
    })
    .catch((error) => console.warn(`[Overlord] retainer form failed: ${error}`));
}

/** @param {Player} player @param {number} index */
function openMember(player, index) {
  const member = partyOf(player)[index];
  if (!member) return openParty(player);
  const form = new ActionFormData().title(member.name).body(describe(player, member, index));
  /** @type {(() => void)[]} */
  const actions = [];
  const add = (/** @type {string} */ text, /** @type {() => void} */ action) => {
    form.button(text);
    actions.push(action);
  };
  add(member.out ? "Dismiss" : "Call to your side", () => (member.out ? dismiss(player, index) : summon(player, index)));
  if (member.gear < MAX_GEAR) {
    add(`Upgrade gear (${gearCost(member.gear)} Gold Coins)\n+4 hearts per rank, more damage every 2`, () => {
      notify(player, upgrade(player, index));
      openMember(player, index);
    });
  }
  if (!member.hired) add("Change name, look or vocation", () => openCreate(player));
  add(member.hired ? "End contract" : "Release retainer", () => {
    release(player, index);
    notify(player, `§7${member.name} has left your party`);
  });
  add("Back", () => openParty(player));
  show(form, player, (choice) => actions[choice]?.());
}

/** @param {Player} player */
function openHire(player) {
  const offers = candidates(player);
  const form = new ActionFormData()
    .title("Mercenaries for hire")
    .body(`Gold Coins: §6${countItem(player, COIN)}§r. Friends of the adventurers pay a quarter less.`);
  for (const offer of offers) {
    form.button(`${offer.name} - ${LOOKS[offer.look]} (${VOCATIONS[Math.floor(offer.look / 2)]}) Lv.${offer.level}\n${offer.cost} Gold Coins`);
  }
  form.button("Back");
  show(form, player, (choice) => {
    if (choice >= offers.length) return openParty(player);
    notify(player, hire(player, offers[choice]));
    summon(player);
  });
}

registerMenu((player) => `Party (${partyOf(player).length}/${MAX_PARTY})`, openParty);
