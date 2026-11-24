// Overlord: Tomb of Nazarick - the NPCs' arts (v11.1).
//
// The monsters and people of the world fight with more than their weapons now. Each kind has a few arts of
// its own, run by the companions' arts engine (arts.js): a lich calls up the dead and throws fire, a troll
// pounds the ground and closes its wounds, a skeleton archer looses a volley, a vampire bride drinks, a
// shadow demon steps through the dark. Monsters turn them on the players and their companions; guards,
// soldiers, adventurers and the summoned dead turn them on monsters. A boss in the middle of its fight keeps to
// its own moves (bosses.js).
import { world, system, EntityDamageCause } from "@minecraft/server";
import * as arts from "./arts.js";
import { isElite } from "./rpg.js";
import { fights } from "./bosses.js";

const TICKS = 20;
const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */

/**
 * One NPC art: as a companion's (classes.js), with plain numbers - its harm does not grow with a level.
 * @param {string} key @param {string} name @param {number} cd @param {string} kind @param {Record<string, any>} params
 */
const A = (key, name, cd, kind, params = {}) => ({ key, name, at: 1, cd, kind, help: name, ...params });

/**
 * The arts of each kind of NPC. voc: whose poses it borrows (0 fighter, 1 archer, 2 mage, 3 healer, 4 rogue,
 * 6 monk, 7 necromancer); named: it calls its arts out by name.
 * @type {Record<string, { voc: number, gap: number, named?: boolean, arts: any[] }>}
 */
export const KITS = {
  // ---- the dead
  [id("old_guarder")]: { voc: 0, gap: 5, arts: [
    A("ng_bash", "Shield Bash", 8, "strike", { dmg: [4, 0], knock: 1.0, stagger: 1 }),
    A("ng_rattle", "Rattling Bones", 14, "afflict", { radius: 4, on: "self", effects: [["weakness", 4, 0]] })] },
  [id("skeleton_archer")]: { voc: 1, gap: 5, arts: [
    A("ng_volley", "Volley", 10, "multi", { dmg: [3, 0], count: 3 }),
    A("ng_pierce", "Piercing Shot", 12, "bolt", { dmg: [5, 0], pierce: true, range: 20 })] },
  [id("skeleton_mage")]: { voc: 2, gap: 5, arts: [
    A("ng_frostbolt", "Frost Bolt", 7, "bolt", { dmg: [4, 0], el: "ice", effects: [["slowness", 3, 1]] }),
    A("ng_boneshield", "Bone Shield", 20, "shield", { amp: 0, sec: 8, party: true })] },
  [id("elder_lich")]: { voc: 7, gap: 4, named: true, arts: [
    A("ng_fireball", "Fireball", 9, "nova", { dmg: [6, 0], radius: 3, el: "fire", effects: [["fire", 3, 0]] }),
    A("ng_raise", "Raise the Dead", 30, "summon", { type: "overlord:old_guarder", count: 2, sec: 30 }),
    A("ng_lightning", "Lightning", 12, "chain", { dmg: [5, 0], jumps: 3, el: "lightning" })] },
  [id("wraith")]: { voc: 7, gap: 5, arts: [
    A("ng_lifedrain", "Life Drain", 9, "bolt", { dmg: [4, 0], el: "dark", drain: 1 }),
    A("ng_terror", "Terror", 16, "afflict", { radius: 5, on: "self", effects: [["slowness", 4, 1], ["weakness", 4, 0]], el: "dark" }),
    A("ng_phase", "Phase", 12, "blink", { dmg: [4, 0], el: "dark" })] },
  [id("ghoul")]: { voc: 4, gap: 5, arts: [
    A("ng_paralyse", "Paralysing Claw", 10, "strike", { dmg: [3, 0], effects: [["slowness", 2, 4]] }),
    A("ng_feast", "Feast", 12, "strike", { dmg: [4, 0], drain: 1, el: "dark" })] },
  [id("death_knight")]: { voc: 0, gap: 4, named: true, arts: [
    A("ng_rend", "Flamberge Rend", 9, "cleave", { dmg: [7, 0], radius: 4, el: "dark", effects: [["wither", 3, 0]] }),
    A("ng_chains", "Chains of Undeath", 16, "pull", { radius: 8, on: "self", dmg: [2, 0], el: "dark" }),
    A("ng_guard", "Undying Guard", 25, "shield", { amp: 1, sec: 10, party: false })] },
  [id("death_cavalier")]: { voc: 0, gap: 4, arts: [
    A("ng_charge", "Death Charge", 10, "dash", { dmg: [7, 0], range: 14, radius: 2.5, knock: 1.3 }),
    A("ng_sweep", "Lance Sweep", 12, "cleave", { dmg: [5, 0], radius: 3.5, knock: 0.8 })] },
  [id("brain_eater")]: { voc: 2, gap: 4, named: true, arts: [
    A("ng_mindblast", "Mind Blast", 12, "afflict", { radius: 5, on: "self", dmg: [4, 0], effects: [["nausea", 5, 0], ["weakness", 5, 1]], el: "arcane" }),
    A("ng_lance", "Psychic Lance", 8, "bolt", { dmg: [6, 0], el: "arcane", pierce: true }),
    A("ng_devour", "Devour Mind", 18, "strike", { dmg: [8, 0], drain: 1, reach: 6, el: "dark" })] },
  [id("vampire_bride")]: { voc: 4, gap: 5, arts: [
    A("ng_blood", "Blood Drain", 9, "strike", { dmg: [4, 0], drain: 1, el: "dark" }),
    A("ng_charm", "Charming Gaze", 16, "afflict", { effects: [["slowness", 4, 2], ["weakness", 4, 0]] }),
    A("ng_bats", "Bat Swarm", 14, "multi", { dmg: [3, 0], count: 3, el: "dark" })] },
  [id("soul_eater")]: { voc: 0, gap: 5, arts: [
    A("ng_wail", "Soul Wail", 14, "afflict", { radius: 6, on: "self", effects: [["weakness", 5, 1]], el: "dark" }),
    A("ng_trample", "Trample", 10, "dash", { dmg: [6, 0], range: 12, knock: 1.2 })] },
  // ---- goblins, brutes and beast-folk
  [id("goblin")]: { voc: 0, gap: 6, arts: [
    A("ng_rush", "Rabble Rush", 10, "dash", { dmg: [3, 0], range: 9 }),
    A("ng_rock", "Thrown Rock", 8, "bolt", { dmg: [3, 0], range: 14, knock: 0.6 })] },
  [id("ogre")]: { voc: 0, gap: 5, arts: [
    A("ng_pound", "Ground Pound", 12, "cleave", { dmg: [6, 0], radius: 3.5, knock: 1.2, effects: [["slowness", 2, 1]] }),
    A("ng_smash", "Club Smash", 9, "strike", { dmg: [8, 0], knock: 1.4, lift: 0.5 })] },
  [id("war_troll")]: { voc: 0, gap: 5, arts: [
    A("ng_tsweep", "Rending Sweep", 10, "cleave", { dmg: [7, 0], radius: 4 }),
    A("ng_regen", "Troll Blood", 20, "heal", { self: true, amount: [20, 0], hot: 6, low: 0.5 }),
    A("ng_troar", "Battle Roar", 24, "buff", { party: true, effects: [["strength", 8, 0]], combat: true })] },
  [id("frost_giant")]: { voc: 0, gap: 5, arts: [
    A("ng_frostomp", "Frost Stomp", 12, "nova", { dmg: [6, 0], radius: 4, on: "self", el: "ice", effects: [["slowness", 4, 2]] }),
    A("ng_iceshard", "Ice Shard", 9, "bolt", { dmg: [5, 0], el: "ice", range: 18, effects: [["slowness", 3, 1]] })] },
  [id("behemoth")]: { voc: 6, gap: 5, arts: [
    A("ng_quake", "Earthquake", 14, "cleave", { dmg: [7, 0], radius: 5, knock: 1.4, effects: [["slowness", 3, 2]] }),
    A("ng_boulder", "Hurled Boulder", 10, "bolt", { dmg: [7, 0], range: 18, knock: 1.0 })] },
  [id("lizardman")]: { voc: 0, gap: 5, arts: [
    A("ng_lunge", "Spear Lunge", 9, "dash", { dmg: [5, 0], range: 9 }),
    A("ng_tail", "Tail Sweep", 12, "cleave", { dmg: [4, 0], radius: 3.5, knock: 1.0 })] },
  [id("zaryusu")]: { voc: 0, gap: 4, named: true, arts: [
    A("ng_frostpain", "Frost Pain", 10, "bolt", { dmg: [6, 0], el: "ice", effects: [["slowness", 4, 2]] }),
    A("ng_iceburst", "Icy Burst", 18, "nova", { dmg: [6, 0], radius: 4, on: "self", el: "ice", effects: [["slowness", 3, 2]] })] },
  [id("beastman")]: { voc: 4, gap: 5, arts: [
    A("ng_pounce", "Pounce", 9, "dash", { dmg: [5, 0], range: 10 }),
    A("ng_savage", "Savage Claws", 10, "strike", { dmg: [2, 0], hits: 3 })] },
  [id("bafolk")]: { voc: 0, gap: 5, arts: [
    A("ng_horncharge", "Horn Charge", 10, "dash", { dmg: [5, 0], range: 11, knock: 1.4 }),
    A("ng_headbutt", "Headbutt", 9, "strike", { dmg: [5, 0], stagger: 1.5, knock: 1.0 })] },
  [id("quagoa")]: { voc: 6, gap: 5, arts: [
    A("ng_burrow", "Burrow Strike", 12, "blink", { dmg: [4, 0] }),
    A("ng_rake", "Claw Rake", 9, "strike", { dmg: [2, 0], hits: 2 })] },
  // ---- demons, angels, constructs and beasts
  [id("shadow_demon")]: { voc: 4, gap: 4, arts: [
    A("ng_shadowstep", "Shadow Step", 10, "blink", { dmg: [5, 0], el: "dark" }),
    A("ng_bind", "Shadow Bind", 14, "afflict", { effects: [["slowness", 3, 4]], el: "dark" })] },
  [id("archangel_flame")]: { voc: 3, gap: 4, arts: [
    A("ng_flamesword", "Flame Sword", 9, "strike", { dmg: [6, 0], el: "fire", effects: [["fire", 3, 0]], reach: 5 }),
    A("ng_smite", "Holy Smite", 12, "bolt", { dmg: [5, 0], el: "holy", undead: 1.5 })] },
  [id("treant_sapling")]: { voc: 3, gap: 5, arts: [
    A("ng_roots", "Root Snare", 14, "afflict", { radius: 3, effects: [["slowness", 4, 4]], el: "acid" }),
    A("ng_thorns", "Thorn Volley", 10, "multi", { dmg: [3, 0], count: 3, el: "acid", effects: [["poison", 3, 0]] })] },
  [id("hellhound")]: { voc: 0, gap: 4, arts: [
    A("ng_firebreath", "Fire Breath", 10, "nova", { dmg: [5, 0], radius: 2.5, el: "fire", effects: [["fire", 3, 0]] }),
    A("ng_hpounce", "Pounce", 9, "dash", { dmg: [5, 0], range: 10 })] },
  [id("gigant_basilisk")]: { voc: 0, gap: 5, arts: [
    A("ng_gaze", "Petrifying Gaze", 18, "afflict", { effects: [["slowness", 2, 255], ["mining_fatigue", 4, 2]], el: "arcane" }),
    A("ng_lash", "Tail Lash", 10, "cleave", { dmg: [6, 0], radius: 4, knock: 1.2 })] },
  [id("eight_edge_assassin")]: { voc: 4, gap: 4, arts: [
    A("ng_bladedance", "Blade Dance", 10, "cleave", { dmg: [3, 0], radius: 3, hits: 3 }),
    A("ng_eblink", "Shadow Blink", 12, "blink", { dmg: [5, 0], el: "dark" })] },
  // ---- people
  [id("bandit")]: { voc: 4, gap: 6, arts: [
    A("ng_dirty", "Dirty Trick", 14, "afflict", { effects: [["blindness", 2, 0], ["slowness", 2, 1]] }),
    A("ng_flurry", "Flurry", 9, "strike", { dmg: [2, 0], hits: 3 })] },
  [id("clementine")]: { voc: 4, gap: 4, named: true, arts: [
    A("ng_stiletto", "Stiletto Flurry", 8, "strike", { dmg: [3, 0], hits: 4 }),
    A("ng_flash", "Martial Art: Flow Acceleration", 12, "blink", { dmg: [6, 0] }),
    A("ng_evade", "Martial Art: Evasion", 16, "escape", { dist: 5 })] },
  [id("khajiit")]: { voc: 7, gap: 4, named: true, arts: [
    A("ng_kraise", "Animate Dead", 30, "summon", { type: "overlord:old_guarder", count: 2, sec: 30 }),
    A("ng_negative", "Negative Burst", 12, "nova", { dmg: [5, 0], radius: 4, on: "self", el: "dark" })] },
  [id("nigun")]: { voc: 3, gap: 4, named: true, arts: [
    A("ng_angel", "Summon Angel", 40, "summon", { type: "overlord:archangel_flame", count: 1, sec: 30 }),
    A("ng_nsmite", "Holy Smite", 10, "bolt", { dmg: [6, 0], el: "holy" })] },
  [id("theocracy_priest")]: { voc: 3, gap: 5, arts: [
    A("ng_mend", "Heal Wounds", 10, "heal", { amount: [10, 0], party: true }),
    A("ng_psmite", "Smite", 9, "bolt", { dmg: [4, 0], el: "holy", undead: 1.5 })] },
  // ---- the friendly: they turn their arts on monsters
  [id("guard")]: { voc: 0, gap: 5, arts: [
    A("ng_gbash", "Shield Bash", 8, "strike", { dmg: [4, 0], knock: 1.0, stagger: 1 }),
    A("ng_gthrust", "Spear Thrust", 9, "dash", { dmg: [5, 0], range: 6 })] },
  [id("soldier")]: { voc: 0, gap: 5, arts: [
    A("ng_sthrust", "Spear Thrust", 9, "dash", { dmg: [5, 0], range: 6 }),
    A("ng_wall", "Hold the Line", 20, "buff", { party: true, effects: [["resistance", 6, 0]], combat: true })] },
  [id("imperial_knight")]: { voc: 0, gap: 5, arts: [
    A("ng_kslash", "Martial Art: Slash", 9, "cleave", { dmg: [5, 0], radius: 3.5 }),
    A("ng_fortress", "Martial Art: Fortress", 20, "shield", { amp: 0, sec: 8 })] },
  [id("adventurer")]: { voc: 0, gap: 5, arts: [
    A("ng_power", "Power Strike", 9, "strike", { dmg: [6, 0], knock: 0.8 }),
    A("ng_potion", "Drink a Potion", 30, "heal", { self: true, amount: [10, 0], low: 0.5 })] },
  [id("archer")]: { voc: 1, gap: 5, arts: [
    A("ng_avolley", "Volley", 10, "multi", { dmg: [3, 0], count: 3 }),
    A("ng_aimed", "Aimed Shot", 8, "bolt", { dmg: [5, 0], range: 22 })] },
  [id("paladin")]: { voc: 3, gap: 5, arts: [
    A("ng_holystrike", "Holy Strike", 9, "strike", { dmg: [5, 0], el: "holy", undead: 1.5 }),
    A("ng_layhands", "Lay on Hands", 25, "heal", { amount: [12, 0], party: true })] },
  [id("gazef")]: { voc: 0, gap: 4, named: true, arts: [
    A("ng_sixlight", "Six Light Slash", 12, "strike", { dmg: [2, 0], hits: 6 }),
    A("ng_gfort", "Martial Art: Fortress", 20, "shield", { amp: 1, sec: 8 })] },
  [id("brain")]: { voc: 4, gap: 4, named: true, arts: [
    A("ng_domain", "Domain: Scythe of the Gods", 12, "cleave", { dmg: [6, 0], radius: 3.5 }),
    A("ng_iai", "Iai Slash", 9, "dash", { dmg: [7, 0], range: 8 })] },
  [id("climb")]: { voc: 0, gap: 5, named: true, arts: [
    A("ng_cslash", "Downward Slash", 9, "strike", { dmg: [6, 0], stagger: 1 })] },
  [id("lakyus")]: { voc: 3, gap: 4, named: true, arts: [
    A("ng_floating", "Floating Swords", 12, "multi", { dmg: [4, 0], count: 4, el: "arcane" }),
    A("ng_kilineyram", "Kilineyram: Super Tech", 20, "nova", { dmg: [8, 0], radius: 4, el: "dark" })] },
  [id("evileye")]: { voc: 2, gap: 4, named: true, arts: [
    A("ng_crystal", "Crystal Lance", 9, "bolt", { dmg: [6, 0], el: "arcane", pierce: true }),
    A("ng_swarm", "Insect Swarm", 16, "afflict", { radius: 4, effects: [["poison", 4, 1]], dmg: [3, 0], el: "acid" })] },
  [id("neia")]: { voc: 1, gap: 4, named: true, arts: [
    A("ng_nshot", "Aimed Shot", 8, "bolt", { dmg: [6, 0], range: 24 }),
    A("ng_nvolley", "Volley", 12, "multi", { dmg: [4, 0], count: 3 })] },
  [id("remedios")]: { voc: 0, gap: 4, named: true, arts: [
    A("ng_holyslash", "Holy Slash", 10, "cleave", { dmg: [6, 0], radius: 3.5, el: "holy", undead: 1.5 })] },
};

/** Neutral monsters the friendly leave alone unless angered, as the party does. */
const NEUTRAL = new Set(["minecraft:zombie_pigman", "minecraft:enderman", "minecraft:piglin"]);

/** Whether an entity fights for the monsters (against players). @param {Entity} e */
function hostile(e) {
  try {
    if (e.hasTag("overlord_summoned") || e.hasTag("overlord_guardian") || e.hasTag("overlord_raised")) return false;
    if (e.hasTag("overlord_hostile")) return true; // troops of a faction that hates the players
    return e.matches({ families: ["monster"] });
  } catch {
    return false;
  }
}

/**
 * The foes of an NPC near a spot: for a monster the players and all who fight beside them, else the monsters.
 * @param {Entity} npc @param {import("@minecraft/server").Vector3} at @param {number} radius @returns {Entity[]}
 */
function foesOf(npc, at, radius) {
  /** @type {Entity[]} */
  let near = [];
  try {
    near = npc.dimension.getEntities({ location: at, maxDistance: radius });
  } catch {
    return [];
  }
  const mine = hostile(npc);
  return near.filter((e) => {
    try {
      if (!e.isValid || e.id === npc.id) return false;
      if (e.typeId === "minecraft:player") {
        if (!mine) return false;
        const mode = String(/** @type {Player} */ (e).getGameMode?.() ?? "").toLowerCase();
        return mode !== "creative" && mode !== "spectator";
      }
      if (mine) return e.typeId === id("retainer") || e.hasTag("overlord_summoned") || e.hasTag("overlord_raised") || (e.hasTag("overlord_guardian"));
      return e.matches({ families: ["monster"] }) && !e.hasTag("overlord_summoned") && !NEUTRAL.has(e.typeId) && hostile(e);
    } catch {
      return false;
    }
  });
}

/** Those on an NPC's own side near it (for heals and battle cries). @param {Entity} npc */
function alliesOf(npc) {
  /** @type {Entity[]} */
  let near = [];
  try {
    near = npc.dimension.getEntities({ location: npc.location, maxDistance: 12 });
  } catch {
    return [];
  }
  const mine = hostile(npc);
  return near.filter((e) => {
    try {
      return e.isValid && e.id !== npc.id && e.typeId !== "minecraft:player" && e.getComponent("minecraft:health") && hostile(e) === mine;
    } catch {
      return false;
    }
  }).slice(0, 8);
}

/** NPC id -> tick before which it will not speak again. */
const spoke = new Map();

/** The world as an NPC's arts see it (arts.js Env). */
/** @type {any} */
const NPC_ENV = {
  wild: true,
  /** @param {any} t @param {Entity} target @param {number} amount @param {"entityAttack" | "magic" | "fire"} [cause] */
  hit(t, target, amount, cause = "entityAttack") {
    try {
      target.applyDamage(amount * t.power, { cause: EntityDamageCause[cause], damagingEntity: t.entity });
      return true;
    } catch {
      return false;
    }
  },
  foesNear: (/** @type {Entity} */ npc, /** @type {import("@minecraft/server").Vector3} */ at, /** @type {number} */ radius) => foesOf(npc, at, radius),
  companions: (/** @type {Entity} */ npc) => alliesOf(npc),
  stagger() {},
  /** @param {Entity} npc @param {{ name: string, named?: boolean }} member @param {string} text */
  say(npc, member, text) {
    if (!member.named) return false; // only the named call out their arts
    const now = system.currentTick;
    if (now < (spoke.get(npc.id) ?? 0)) return false;
    spoke.set(npc.id, now + 20 * TICKS);
    try {
      for (const pl of npc.dimension.getPlayers({ location: npc.location, maxDistance: 20 })) pl.sendMessage(`§c<${member.name}>§f ${text}`);
    } catch {
      // nobody near
    }
    return true;
  },
  fallen: () => 0,
  revive: () => 0,
  inCombat: () => true,
  /** @param {Entity} e @param {number} amount */
  healPlayer(e, amount) {
    try {
      const h = e.getComponent("minecraft:health");
      if (!h || h.currentValue <= 0 || h.currentValue >= h.effectiveMax) return false;
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amount));
      return true;
    } catch {
      return false;
    }
  },
  isElite: (/** @type {Entity} */ e) => {
    try {
      return isElite(e);
    } catch {
      return false;
    }
  },
  coins() {},
  legacy: () => undefined,
  danger: () => undefined,
};
/** The same, for those who fight monsters: what they call up is theirs, and fights for the players. */
const FRIEND_ENV = { ...NPC_ENV, wild: false };

/** NPC id -> art key -> tick it is ready again. */
const ready = new Map();
/** NPC id -> tick before which it uses no art. */
const busy = new Map();
/** NPC id -> the art it used last. */
const lastUsed = new Map();

/** A readable name for an NPC. @param {Entity} npc */
function nameOf(npc) {
  if (npc.nameTag) return npc.nameTag.replace(/§./g, "").split("\n")[0];
  return npc.typeId.split(":")[1].split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Lets one NPC act: if a foe is near and it is ready, it uses the best of its arts that has something to do.
 * Returns the art's name, if one was used.
 * @param {Entity} npc @param {number} [now]
 */
export function act(npc, now = system.currentTick) {
  const kit = KITS[npc.typeId];
  if (!kit || !npc.isValid) return undefined;
  if (fights.has(npc.id)) return undefined; // a boss in its fight keeps to its own moves
  if (now < (busy.get(npc.id) ?? 0)) return undefined;
  const foes = foesOf(npc, npc.location, 14).sort((a, b) => dist(a, npc) - dist(b, npc));
  const foe = foes[0];
  if (!foe) return undefined;
  const health = npc.getComponent("minecraft:health");
  /** @type {any} */
  const turn = {
    player: npc, entity: npc, member: { name: nameOf(npc), named: Boolean(kit.named) }, level: 0, power: 1, foe,
    d: npc.dimension,
    hand: { x: npc.location.x, y: npc.location.y + 1.3, z: npc.location.z },
    gap: dist(foe, npc),
    masterHealth: health,
    masterShare: health && health.effectiveMax > 0 ? health.currentValue / health.effectiveMax : 1,
    near: true,
    voc: kit.voc,
    env: hostile(npc) ? NPC_ENV : FRIEND_ENV,
  };
  let mine = ready.get(npc.id);
  if (!mine) {
    mine = new Map();
    ready.set(npc.id, mine);
  }
  const waiting = kit.arts.filter((art) => now >= (mine.get(art.key) ?? 0));
  if (waiting.length === 0) return undefined;
  const sense = arts.senseOf(turn, lastUsed.get(npc.id));
  const ranked = waiting.map((art) => ({ art, value: arts.score(turn, art, sense) })).sort((a, b) => b.value - a.value);
  for (const { art, value } of ranked) {
    if (value <= -50) break;
    let used = false;
    try {
      used = arts.use(turn, art);
    } catch {
      used = false;
    }
    if (!used) continue;
    mine.set(art.key, now + art.cd * TICKS);
    busy.set(npc.id, now + kit.gap * TICKS);
    lastUsed.set(npc.id, art.key);
    try {
      const pose = arts.poseOf(art, kit.voc);
      if (pose) npc.playAnimation(pose, { blendOutTime: 0.2 });
    } catch {
      // poses are cosmetic, and a beast has no arms to pose
    }
    if (kit.named) NPC_ENV.say(npc, turn.member, `${art.name}!`);
    return art.name;
  }
  return undefined;
}

/** @param {Entity} a @param {Entity} b */
function dist(a, b) {
  return Math.hypot(a.location.x - b.location.x, a.location.z - b.location.z);
}

// Once a second the NPCs near any player may use an art.
system.runInterval(() => {
  const seen = new Set();
  const now = system.currentTick;
  for (const player of world.getAllPlayers()) {
    let near = [];
    try {
      near = player.dimension.getEntities({ location: player.location, maxDistance: 28 });
    } catch {
      continue;
    }
    for (const npc of near) {
      if (seen.has(npc.id) || !(npc.typeId in KITS)) continue;
      seen.add(npc.id);
      try {
        act(npc, now);
      } catch {
        // it vanished mid-turn
      }
    }
  }
}, TICKS);

// The memory of NPCs that have gone is let go.
world.afterEvents.entityDie.subscribe((event) => {
  const gone = event.deadEntity?.id;
  if (!gone) return;
  ready.delete(gone);
  busy.delete(gone);
  lastUsed.delete(gone);
  spoke.delete(gone);
});
