// Overlord: Tomb of Nazarick - the skill tree in play: its menus, and every effect of a node that
// acts on the world rather than on a number (blows that cleave or poison, dodges, auras, rewards
// for kills, reading a Codex). The nodes themselves and the arithmetic live in skills.js.
import { world, system, EntityDamageCause, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  applyPassives, creditedPlayer, giveItem, grantXp, healthShare, isElite, killXp, lastBlow, notify, openMenu,
  profileOf, registerMenu, restoreMana, touch,
} from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import * as skills from "./skills.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const COIN = id("yggdrasil_gold_coin");
const CRYSTAL = id("data_crystal");
export const CODEX = id("codex_of_skills");

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("./skills.js").TreeKey} TreeKey */

/** The colour of each path's effects. */
/** @type {Record<TreeKey, string>} */
const ELEMENT = { blade: "fire", arcane: "arcane", shadow: "dark", faith: "holy", dominion: "dark", fortune: "lightning" };

// ------------------------------------------------------------------ helpers

/** A cooldown per player and name: true (and starts it) when it is ready. */
/** @type {Map<string, number>} */
const cooldowns = new Map();
/** @param {Player} player @param {string} what @param {number} seconds */
function ready(player, what, seconds) {
  const key = `${player.id}|${what}`;
  if (system.currentTick < (cooldowns.get(key) ?? 0)) return false;
  cooldowns.set(key, system.currentTick + seconds * TICKS);
  return true;
}

/** @param {Entity} entity @param {number} amount */
function heal(entity, amount) {
  try {
    const health = entity.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0 || amount <= 0) return;
    health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));
  } catch {
    // unloading
  }
}

/** Whether an entity is one of the player's own: another player, a companion or a summon. @param {Entity} entity @param {Player} player */
function isFriend(entity, player) {
  try {
    if (entity.typeId === "minecraft:player") return true;
    if (entity.hasTag(`overlord_ally_${player.id}`) || entity.hasTag("overlord_summoned")) return true;
    if (entity.typeId === id("retainer")) return true;
    return entity.getComponent("minecraft:tameable")?.isTamed === true;
  } catch {
    return true;
  }
}

/** Monsters near a spot that may be struck. @param {Player} player @param {import("@minecraft/server").Vector3} at @param {number} radius */
function foesNear(player, at, radius) {
  try {
    return player.dimension
      .getEntities({ location: at, maxDistance: radius, families: ["monster"] })
      .filter((e) => e.isValid && !isFriend(e, player));
  } catch {
    return [];
  }
}

/** The player's companions and summons near a spot. @param {Player} player @param {number} radius */
function alliesNear(player, radius) {
  /** @type {Entity[]} */
  const out = [];
  try {
    out.push(...player.dimension.getEntities({ tags: [`overlord_ally_${player.id}`], location: player.location, maxDistance: radius }));
    for (const e of player.dimension.getEntities({ type: id("retainer"), location: player.location, maxDistance: radius })) {
      if (e.getDynamicProperty("overlord:owner") === player.id) out.push(e);
    }
  } catch {
    // dimension unloading
  }
  return out;
}

let striking = false;

/**
 * Takes health straight off a foe, as the melee bonus does, so a proc is not lost to the foe's
 * moment of invulnerability after a hit. A blow that would leave it with almost nothing kills it.
 * @param {Player} player @param {Entity} foe @param {number} amount
 */
function strike(player, foe, amount) {
  try {
    if (!foe.isValid || amount <= 0) return;
    const health = foe.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0) return;
    if (health.currentValue - amount > 0.5) health.setCurrentValue(health.currentValue - amount);
    else {
      striking = true;
      try {
        foe.applyDamage(health.effectiveMax * 4, { cause: EntityDamageCause.magic, damagingEntity: player });
      } finally {
        striking = false;
      }
    }
  } catch {
    // the foe vanished
  }
}

/** @param {Entity} entity */
function above(entity, dy = 1) {
  return { x: entity.location.x, y: entity.location.y + dy, z: entity.location.z };
}

// ---------------------------------------------------------- blows you deal

/** Melee hits each player has landed, for the Six Light Strikes. */
/** @type {Map<string, number>} */
const hits = new Map();

world.afterEvents.entityHurt.subscribe((event) => {
  if (striking) return;
  try {
    const attacker = event.damageSource.damagingEntity;
    const victim = event.hurtEntity;
    if (!attacker || attacker.typeId !== "minecraft:player" || event.damageSource.cause !== EntityDamageCause.entityAttack) return;
    if (!victim.isValid || victim.typeId === "minecraft:player") return;
    const player = /** @type {Player} */ (attacker);
    const p = profileOf(player);
    if (skills.spent(p) === 0) return;
    const blow = lastBlow.get(player.id) ?? { damage: event.damage, crit: false };
    const health = victim.getComponent("minecraft:health");
    const alive = health !== undefined && health.currentValue > 0;
    const d = player.dimension;

    // Healing from the blow.
    heal(player, (blow.damage * skills.value(p, "bloodthirst")) / 100);
    if (blow.crit) heal(player, skills.value(p, "cutthroat") * 2);
    if (!alive) return;

    const undead = victim.matches({ families: ["undead"] });
    const demon = victim.matches({ families: ["demon"] });
    if (Math.random() < skills.value(p, "venom_blade") / 100) {
      // The undead do not sicken, so the venom withers them instead.
      victim.addEffect(undead ? "wither" : "poison", 4 * TICKS, { amplifier: 1 });
      fx.puff(d, "droplet", above(victim), "acid", 0.8);
    }
    if ((undead || demon) && skills.value(p, "sanctified") > 0) {
      victim.setOnFire(skills.value(p, "sanctified"), true);
      fx.flash(d, above(victim), "holy", 0.8);
    }
    if (Math.random() < skills.value(p, "crushing_blow") / 100) {
      strike(player, victim, blow.damage * 0.5);
      victim.addEffect("slowness", 2 * TICKS, { amplifier: 3 });
      victim.addEffect("weakness", 2 * TICKS, { amplifier: 1 });
      fx.spark(d, above(victim), "none", 1.3);
      fx.shake(d, victim.location, 6, 0.2, 0.25);
      notify(player, "§cCrushing Blow!");
    }
    if (Math.random() < skills.value(p, "flurry") / 100) {
      system.runTimeout(() => {
        strike(player, victim, blow.damage * 0.6);
        if (victim.isValid) fx.slash(d, above(victim), "dark", 1);
      }, 4);
    }
    const cleave = skills.value(p, "cleave") / 100;
    if (cleave > 0) {
      for (const other of foesNear(player, victim.location, 2.5)) {
        if (other.id === victim.id) continue;
        strike(player, other, blow.damage * cleave);
        fx.slash(d, above(other), "none", 0.9);
      }
    }
    // Six Light Strikes: every sixth blow, six slashes fall on everything around.
    if (skills.rank(p, "six_light_strikes") > 0) {
      const count = (hits.get(player.id) ?? 0) + 1;
      hits.set(player.id, count % 6);
      if (count >= 6) {
        const targets = foesNear(player, player.location, 4);
        notify(player, "§6§lSix Light Strikes!");
        fx.nova(d, above(player), "fire", 4);
        fx.shake(d, player.location, 10, 0.35, 0.4);
        for (let i = 0; i < 6; i++) {
          system.runTimeout(() => {
            for (const foe of targets) {
              if (!foe.isValid) continue;
              strike(player, foe, blow.damage * 0.4);
              fx.slash(d, above(foe, 0.8 + (i % 3) * 0.3), i % 2 === 0 ? "fire" : "none", 1.3);
            }
          }, 1 + i * 2);
        }
      }
    }
    // Assassinate: a wounded foe may die outright - never a boss.
    if (skills.rank(p, "assassinate") > 0 && victim.isValid) {
      const now = victim.getComponent("minecraft:health");
      if (now && now.currentValue > 0 && now.currentValue / now.effectiveMax < 0.25 && now.effectiveMax <= 300 &&
          !victim.hasTag("overlord_worldboss") && Math.random() < 0.3) {
        fx.skull(d, above(victim, 1.6), 1.1);
        strike(player, victim, now.currentValue + 1000);
        notify(player, "§8§lAssassinated!");
      }
    }
  } catch {
    // the foe vanished mid-hit
  }
});

// ------------------------------------------------------- blows you take

/** Causes that are attacks, and can be dodged. */
const ATTACKS = new Set(["entityAttack", "projectile", "entityExplosion", "magic", "sonicBoom", "ramAttack", "thorns"]);
/** Causes that are never softened: the world taking its due rather than a foe. */
const UNSOFTENED = new Set(["void", "selfDestruct", "suicide", "starve", "override", "drowning", "suffocation"]);

world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const victim = event.hurtEntity;
    if (victim.typeId !== "minecraft:player" || !victim.isValid) return;
    const player = /** @type {Player} */ (victim);
    const p = profileOf(player);
    if (skills.spent(p) === 0) return;
    const health = player.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0) return; // too late for anything
    const cause = String(event.damageSource.cause);
    if (UNSOFTENED.has(cause)) return;
    let refund = 0;
    if (ATTACKS.has(cause) && Math.random() < skills.value(p, "evasion") / 100) {
      refund = event.damage;
      notify(player, "§7Dodged!");
      fx.blink(player.dimension, player.location, player.location, "dark");
    } else {
      refund += (event.damage * skills.value(p, "tough_skin")) / 100;
      const shield = (event.damage * skills.value(p, "mana_shield")) / 100;
      // Mana Shield: three mana for every heart the shield takes.
      if (shield > 0 && p.mana >= shield * 1.5) {
        p.mana -= shield * 1.5;
        refund += shield;
        fx.flash(player.dimension, above(player), "arcane", 0.6);
      }
    }
    if (refund > 0) heal(player, refund);
    const share = healthShare(player);
    if (share < 0.2 && skills.rank(p, "divine_grace") > 0 && ready(player, "grace", 300)) {
      health.setCurrentValue(Math.max(health.currentValue, health.effectiveMax * 0.5));
      player.addEffect("absorption", 10 * TICKS, { amplifier: 1, showParticles: false });
      fx.dome(player.dimension, player.location, "holy");
      fx.pillar(player.dimension, player.location, "holy", 4);
      player.sendMessage("§e[Divine Grace] §fThe Six Great Gods will not let you fall today.");
    } else if (share < 0.3 && skills.rank(p, "second_wind") > 0 && ready(player, "second_wind", 60)) {
      player.addEffect("regeneration", 5 * TICKS, { amplifier: 2, showParticles: false });
      fx.rise(player.dimension, player.location, "fire", 1);
      notify(player, "§cSecond Wind!");
    }
  } catch {
    // the player left mid-hit
  }
});

// ------------------------------------------------------------------ kills

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const player = creditedPlayer(event.damageSource.damagingEntity);
    const dead = event.deadEntity;
    if (!player || dead.typeId === "minecraft:player" || dead.typeId === id("retainer")) return;
    const p = profileOf(player);
    if (skills.spent(p) === 0) return;
    let at = player.location;
    try {
      at = dead.location;
    } catch {
      // gone already: rewards land at the player's feet
    }
    /** @param {string} item @param {number} amount */
    const drop = (item, amount) => {
      try {
        player.dimension.spawnItem(new ItemStack(item, amount), at);
      } catch {
        giveItem(player, item, amount);
      }
    };
    restoreMana(player, skills.value(p, "soul_harvest"));
    if (Math.random() < skills.value(p, "gold_sense") / 100) drop(COIN, 1);
    if (Math.random() < skills.value(p, "crystal_hunter") / 100) drop(CRYSTAL, 1);
    if (skills.rank(p, "midas") > 0) {
      if (Math.random() < 0.15) drop(COIN, 1 + Math.floor(Math.random() * 3));
      if (isElite(dead)) drop(COIN, 3 + Math.floor(Math.random() * 4)); // the elite purse, twice over
    }
    if (Math.random() < skills.value(p, "windfall") / 100) {
      grantXp(player, killXp(dead) * 2, "Windfall");
      fx.spark(player.dimension, at, "lightning", 1);
    }
  } catch {
    // the killer left
  }
});

// ------------------------------------------------------------------ auras

const LONG_AURA = 6 * TICKS;
let second = 0;

system.runInterval(() => {
  second += 1;
  for (const player of world.getAllPlayers()) {
    try {
      tick(player, second);
    } catch {
      // the player is respawning or leaving
    }
  }
}, TICKS);

/** One second of a player's standing skills. @param {Player} player @param {number} now seconds since start */
export function tick(player, now) {
  const p = profileOf(player);
  if (skills.spent(p) === 0) return;
  const d = player.dimension;
  const health = player.getComponent("minecraft:health");
  const share = healthShare(player);

  if (skills.rank(p, "purity") > 0) {
    for (const bane of ["poison", "wither", "nausea", "blindness"]) {
      if (player.getEffect(bane)) player.removeEffect(bane);
    }
  }
  const unyielding = skills.rank(p, "unyielding");
  if (unyielding > 0 && share < (30 + 20 * unyielding) / 100) player.addEffect("resistance", 2 * TICKS, { amplifier: 0, showParticles: false });
  if (skills.rank(p, "shadow_veil") > 0 && player.isSneaking) player.addEffect("invisibility", 2 * TICKS, { amplifier: 0, showParticles: false });

  if (now % 4 === 0) {
    if (health && health.currentValue > 0) heal(player, skills.value(p, "blessed_body"));
    const aura = skills.value(p, "guardian_aura");
    if (aura > 0) {
      for (const ally of [...d.getPlayers({ location: player.location, maxDistance: 8 }).filter((o) => o.id !== player.id), ...alliesNear(player, 8)]) {
        heal(ally, aura);
      }
    }
    if (skills.rank(p, "halo") > 0) {
      for (const ally of [player, ...d.getPlayers({ location: player.location, maxDistance: 10 }).filter((o) => o.id !== player.id), ...alliesNear(player, 10)]) {
        ally.addEffect("regeneration", LONG_AURA, { amplifier: 0, showParticles: false });
      }
      if (now % 8 === 0) fx.ring(d, player.location, "holy", 1.2);
    }
    const legion = skills.rank(p, "undying_legion");
    if (legion > 0) {
      for (const summon of d.getEntities({ tags: [`overlord_ally_${player.id}`] })) {
        summon.addEffect("strength", LONG_AURA, { amplifier: 0, showParticles: false });
        if (legion >= 2) summon.addEffect("resistance", LONG_AURA, { amplifier: 0, showParticles: false });
      }
    }
    if (skills.rank(p, "supreme_authority") > 0) {
      for (const ally of alliesNear(player, 16)) {
        ally.addEffect("strength", LONG_AURA, { amplifier: 0, showParticles: false });
        ally.addEffect("speed", LONG_AURA, { amplifier: 0, showParticles: false });
      }
    }
  }
  const despair = skills.rank(p, "despair_aura");
  if (despair > 0 && now % 3 === 0) {
    for (const foe of foesNear(player, player.location, 3 + 2 * despair)) foe.addEffect("weakness", 4 * TICKS, { amplifier: 0 });
  }
  if (skills.rank(p, "turn_undead") > 0 && now % 8 === 0) {
    const undead = foesNear(player, player.location, 6).filter((f) => f.matches({ families: ["undead"] }));
    for (const foe of undead) {
      foe.addEffect("slowness", 3 * TICKS, { amplifier: 1 });
      foe.addEffect("weakness", 3 * TICKS, { amplifier: 1 });
    }
    if (undead.length > 0) fx.ring(d, player.location, "holy", 6);
  }
  const provisions = skills.value(p, "provisions");
  if (provisions > 0 && now % 60 === 0) player.addEffect("saturation", 1, { amplifier: provisions - 1, showParticles: false });
}

// ------------------------------------------------------------------ codex

/**
 * Reads a Codex of the Supreme Beings: one more skill point, up to ten in all. Returns a message.
 * @param {Player} player
 */
export function readCodex(player) {
  const p = profileOf(player);
  if ((p.codex || 0) >= skills.MAX_CODEX) return `§7You have already learned all a Codex can teach (${skills.MAX_CODEX})`;
  if (countItem(player, CODEX) <= 0) return "§7You have no Codex to read";
  takeItem(player, CODEX, 1);
  p.codex = (p.codex || 0) + 1;
  touch(player);
  fx.tome(player, "arcane");
  try {
    player.playSound("random.levelup", { volume: 1, pitch: 0.7 });
  } catch {
    // cosmetic only
  }
  return `§5The Codex's knowledge is yours: §a+1 skill point §7(${p.codex}/${skills.MAX_CODEX} codices read)`;
}

world.afterEvents.itemUse.subscribe((event) => {
  try {
    if (event.itemStack?.typeId !== CODEX) return;
    notify(event.source, readCodex(event.source));
  } catch {
    // the player left
  }
});

// ------------------------------------------------------------------ menus

/** A bar of ten blocks showing a share. @param {number} share @param {string} color */
function bar(share, color) {
  const full = Math.max(0, Math.min(10, Math.round(share * 10)));
  return `${color}${"|".repeat(full)}§8${"|".repeat(10 - full)}§r`;
}

const TIER_NAMES = ["I", "II", "III", "IV", "V"];

/**
 * Learns one rank of a node, with a flourish. Returns a message.
 * @param {Player} player @param {string} key
 */
export function learnSkill(player, key) {
  const p = profileOf(player);
  const node = skills.BY_KEY.get(key);
  if (!node) return "§7No such skill";
  const reason = skills.learn(p, key);
  if (reason) return `§7${reason}`;
  touch(player);
  applyPassives(player);
  const element = ELEMENT[node.tree];
  try {
    fx.rise(player.dimension, player.location, element, 1);
    fx.spiral(player.dimension, () => (player.isValid ? player.location : undefined), element);
    if (node.tier === 4) {
      fx.pillar(player.dimension, player.location, element, 6);
      fx.nova(player.dimension, above(player), element, 3);
    }
    player.playSound("random.levelup", { volume: 0.8, pitch: node.tier === 4 ? 0.8 : 1.6 });
  } catch {
    // cosmetic only
  }
  if (node.tier === 4) {
    world.sendMessage(`§6[Skill Tree] §f${player.name} has mastered §e${node.name}§f, the summit of the ${skills.TREES.find((t) => t.key === node.tree)?.name}.`);
  }
  return `§aLearned ${node.name} ${skills.rank(p, key)}/${node.max}`;
}

/** @param {ActionFormData} form @param {Player} player @param {(choice: number) => void} onChoice */
function show(form, player, onChoice) {
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      try {
        onChoice(response.selection);
      } catch (error) {
        console.warn(`[Overlord] skill tree menu failed: ${error}`);
      }
    })
    .catch(() => {});
}

/** The front page: every path with the points in it. @param {Player} player */
export function openSkills(player) {
  const p = profileOf(player);
  const free = skills.available(p);
  const form = new ActionFormData()
    .title("Skill Tree")
    .body(
      `Skill points: §a${free}§r free of ${skills.earned(p)} earned ` +
        `(${skills.pointsForLevel(p.level)} from levels, ${Math.min(skills.MAX_CODEX, p.codex || 0)}/${skills.MAX_CODEX} from codices).\n` +
        `You earn one point a level and one more every tenth level.\n\n` +
        skills.TREES.map((t) => {
          const inTree = skills.spent(p, t.key);
          const most = skills.NODES.filter((n) => n.tree === t.key).reduce((sum, n) => sum + n.max, 0);
          return `${t.color}${t.name}§r ${bar(inTree / most, t.color)} ${inTree}/${most}`;
        }).join("\n")
    );
  for (const t of skills.TREES) {
    const inTree = skills.spent(p, t.key);
    const open = skills.openTier(p, t.key);
    const learnable = skills.NODES.some((n) => n.tree === t.key && skills.check(p, n.key).ok);
    form.button(`${t.color}${t.name}§r\n${inTree} points - tier ${TIER_NAMES[open]} open${learnable ? " §a(can learn)" : ""}`);
  }
  form.button("Your bonuses").button(`Unlearn everything\n${skills.unlearnCost(p)} Gold Coins`).button("How the skill tree works").button("Back");
  const n = skills.TREES.length;
  show(form, player, (choice) => {
    if (choice < n) openPath(player, skills.TREES[choice].key);
    else if (choice === n) openSummary(player);
    else if (choice === n + 1) openUnlearn(player);
    else if (choice === n + 2) openGuide(player);
    else openMenu(player);
  });
}

/** One path: its tiers and nodes. @param {Player} player @param {TreeKey} tree */
export function openPath(player, tree) {
  const p = profileOf(player);
  const info = skills.TREES.find((t) => t.key === tree);
  if (!info) return;
  const inTree = skills.spent(p, tree);
  const nodes = skills.NODES.filter((n) => n.tree === tree);
  const gates = skills.TIER_POINTS.map((points, t) => {
    const open = inTree >= points && p.level >= skills.TIER_LEVEL[t];
    return `${open ? "§a" : "§7"}Tier ${TIER_NAMES[t]}§r: ${points} points here, level ${skills.TIER_LEVEL[t]}${open ? " - open" : ""}`;
  });
  const form = new ActionFormData()
    .title(info.name)
    .body(`${info.color}${info.lore}§r\n\nPoints in this path: §e${inTree}§r   Free: §a${skills.available(p)}§r\n${gates.join("\n")}`);
  for (const node of nodes) {
    const r = skills.rank(p, node.key);
    const verdict = skills.check(p, node.key);
    const color = r >= node.max ? "§2" : verdict.ok ? "§a" : r > 0 ? "§e" : "§8";
    const capstone = node.tier === 4 ? "§6* " : "";
    const state = r >= node.max ? "mastered" : verdict.ok ? "can learn" : r > 0 ? verdict.reason : `locked: ${verdict.reason}`;
    form.button(`${capstone}${color}[${TIER_NAMES[node.tier]}] ${node.name} ${r}/${node.max}§r\n§8${state}`);
  }
  form.button("Back");
  show(form, player, (choice) => {
    const node = nodes[choice];
    if (node) openNode(player, node.key);
    else openSkills(player);
  });
}

/** One node: what it does now and at its next rank, and the button to learn it. @param {Player} player @param {string} key */
export function openNode(player, key) {
  const p = profileOf(player);
  const node = skills.BY_KEY.get(key);
  if (!node) return;
  const r = skills.rank(p, key);
  const verdict = skills.check(p, key);
  const needs = node.needs ? `\nRequires: §e${skills.BY_KEY.get(node.needs)?.name}§r` : "";
  const form = new ActionFormData()
    .title(node.name)
    .body(
      `${node.tier === 4 ? "§6Capstone§r - " : ""}Tier ${TIER_NAMES[node.tier]} of the ${skills.TREES.find((t) => t.key === node.tree)?.name} ` +
        `(${skills.TIER_POINTS[node.tier]} points in the path, level ${skills.TIER_LEVEL[node.tier]})${needs}\n\n` +
        `Rank: §e${r}/${node.max}§r\n` +
        (r > 0 ? `Now: §a${skills.describe(node, r)}§r\n` : "") +
        (r < node.max ? `${r > 0 ? "Next" : "Rank 1"}: §b${skills.describe(node, r + 1)}§r\n` : "") +
        (r < node.max && node.max > 1 ? `At rank ${node.max}: §d${skills.describe(node, node.max)}§r\n` : "") +
        `\nFree skill points: §a${skills.available(p)}§r` +
        (verdict.ok || r >= node.max ? "" : `\n§c${verdict.reason}§r`)
    );
  /** @type {(() => void)[]} */
  const actions = [];
  if (verdict.ok) {
    form.button(`Learn rank ${r + 1} (1 skill point)`);
    actions.push(() => {
      notify(player, learnSkill(player, key));
      openNode(player, key);
    });
    if (node.max - r > 1 && skills.available(p) > 1) {
      form.button(`Learn as many ranks as I can`);
      actions.push(() => {
        let message = "";
        while (skills.check(p, key).ok) message = learnSkill(player, key);
        notify(player, message);
        openNode(player, key);
      });
    }
  }
  form.button("Back");
  actions.push(() => openPath(player, node.tree));
  show(form, player, (choice) => actions[choice]?.());
}

/** Everything the player's skills add up to, in one page. @param {Player} player */
function openSummary(player) {
  const p = profileOf(player);
  const lines = [];
  for (const t of skills.TREES) {
    const learned = skills.NODES.filter((n) => n.tree === t.key && skills.rank(p, n.key) > 0);
    if (learned.length === 0) continue;
    lines.push(`${t.color}§l${t.name}§r`);
    for (const node of learned) lines.push(` ${node.tier === 4 ? "§6*§r " : ""}§f${node.name} ${skills.rank(p, node.key)}§r: §7${skills.describe(node, skills.rank(p, node.key))}§r`);
  }
  const form = new ActionFormData()
    .title("Your bonuses")
    .body(lines.length > 0 ? lines.join("\n") : "You have not learned any skills yet. Open a path and spend a skill point.")
    .button("Back");
  show(form, player, () => openSkills(player));
}

/** @param {Player} player */
function openUnlearn(player) {
  const p = profileOf(player);
  const cost = skills.unlearnCost(p);
  const spentPoints = skills.spent(p);
  const form = new ActionFormData()
    .title("Unlearn everything")
    .body(
      spentPoints === 0
        ? "You have not learned anything to unlearn."
        : `Forget every skill you have learned and get all ${spentPoints} points back to spend again, for §6${cost} Gold Coins§r.`
    );
  if (spentPoints > 0) form.button(`Unlearn (${cost} Gold Coins)`);
  form.button("Back");
  show(form, player, (choice) => {
    if (spentPoints > 0 && choice === 0) notify(player, unlearn(player));
    openSkills(player);
  });
}

/** Forgets every skill for a price. Returns a message. @param {Player} player */
export function unlearn(player) {
  const p = profileOf(player);
  const cost = skills.unlearnCost(p);
  if (skills.spent(p) === 0) return "§7Nothing to unlearn";
  if (countItem(player, COIN) < cost) return `§7Unlearning costs ${cost} Gold Coins`;
  takeItem(player, COIN, cost);
  const back = skills.unlearnAll(p);
  touch(player);
  applyPassives(player);
  try {
    fx.implode(player.dimension, above(player), "arcane");
  } catch {
    // cosmetic only
  }
  return `§dYou forget what you had learned: §a${back} skill points§d are free again`;
}

/** @param {Player} player */
function openGuide(player) {
  const form = new ActionFormData()
    .title("How the skill tree works")
    .body(
      "§eSkill points§r: one at every level from level 2, one more at every tenth level, and one for each " +
        `Codex of the Supreme Beings you read (up to ${skills.MAX_CODEX}). A Codex comes from world bosses, the three dragons and the deeper Tomb Raids. ` +
        "At level 100 that is 109 points, plus codices - enough to master about three of the six paths, so choose.\n\n" +
        "§eTiers§r: each path has five tiers. A tier opens when you have spent enough points in that path and reached its level: " +
        skills.TIER_POINTS.map((pts, t) => `${TIER_NAMES[t]} - ${pts} points, level ${skills.TIER_LEVEL[t]}`).join("; ") +
        ". Some skills also need an earlier skill of their path.\n\n" +
        "§eCapstones§r: the fifth tier of each path holds one great skill: Six Light Strikes, Maximize Magic, Assassinate, " +
        "Halo of the Six Gods, Authority of the Supreme Being and Midas Touch.\n\n" +
        "§eStat points and classes§r still work as before; skills add to them.\n\n" +
        "§eUnlearning§r: you can forget everything and spend your points again for Gold Coins (10, plus 2 for every point spent)."
    )
    .button("Back");
  show(form, player, () => openSkills(player));
}

registerMenu(
  (player) => {
    const free = skills.available(profileOf(player));
    return `Skill Tree${free > 0 ? ` §a(${free} SP)` : ""}`;
  },
  openSkills,
  true
);
