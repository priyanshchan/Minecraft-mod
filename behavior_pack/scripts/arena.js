// Overlord: Tomb of Nazarick - the Imperial Arena.
// Speaking to an Arena Master starts five rounds of single combat on the sand. The
// champions follow the challenger's level; at the highest tier the last of them is
// Go Gin, the Martial Lord. Winning pays Gold Coins and XP.
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { giveItem, grantXp, notify, profileOf, questEvent } from "./rpg.js";
import { countItem } from "./spells.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const MASTER = id("arena_master");
const MASTER_RANGE = 14; // a bout can only be started this close to an Arena Master
const LEAVE_RANGE = 32; // walking this far from the sand forfeits
const ROUND_SECONDS = 150;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/** Champions by tier and round: each round is a list of [entity, count]. */
/** @type {[string, number][][][]} */
export const ROUNDS = [
  [[[id("goblin"), 3]], [[id("bandit"), 2]], [[id("ogre"), 1]], [[id("beastman"), 2]], [[id("war_troll"), 1]]],
  [[[id("ogre"), 2]], [[id("bafolk"), 3]], [[id("war_troll"), 1], [id("ogre"), 1]], [[id("gigant_basilisk"), 1]], [[id("frost_giant"), 1], [id("war_troll"), 1]]],
  [[[id("war_troll"), 2]], [[id("gigant_basilisk"), 1], [id("bafolk"), 2]], [[id("frost_giant"), 2]], [[id("zero"), 1]], [[id("go_gin"), 1]]],
];
/** Purse per tier. */
export const PURSES = [
  { coins: 20, xp: 500, crests: 0 },
  { coins: 45, xp: 1800, crests: 0 },
  { coins: 90, xp: 5000, crests: 1 },
];

/** @param {number} level */
export function tierFor(level) {
  return level >= 50 ? 2 : level >= 20 ? 1 : 0;
}

/**
 * @typedef {{ tier: number, round: number, tag: string, origin: Vector3, dimension: import("@minecraft/server").Dimension,
 *   deadline: number, resting: number }} Bout
 */
/** @type {Map<string, Bout>} */
const bouts = new Map();

/** Whether the player is fighting in the arena. @param {Player} player */
export function inArena(player) {
  return bouts.has(player.id);
}

/** @param {Bout} bout */
function champions(bout) {
  try {
    return bout.dimension.getEntities({ tags: [bout.tag] });
  } catch {
    return [];
  }
}

/** @param {Player} player @param {Bout} bout */
function sendOut(player, bout) {
  const round = ROUNDS[bout.tier][bout.round];
  let slot = 0;
  const total = round.reduce((n, [, count]) => n + count, 0);
  for (const [type, count] of round) {
    for (let i = 0; i < count; i++, slot++) {
      const angle = (slot / total) * Math.PI * 2;
      const spot = { x: bout.origin.x + Math.cos(angle) * 5, y: bout.origin.y, z: bout.origin.z + Math.sin(angle) * 5 };
      try {
        const champion = bout.dimension.spawnEntity(type, spot);
        champion.addTag("overlord_arena");
        champion.addTag(bout.tag);
        fx.circle(bout.dimension, spot, "fire", 1.2);
        fx.pillar(bout.dimension, spot, "fire", 2.4, 0.8);
      } catch (error) {
        console.warn(`[Overlord] could not send out ${type}: ${error}`);
      }
    }
  }
  bout.deadline = system.currentTick + ROUND_SECONDS * TICKS;
  try {
    player.onScreenDisplay.setTitle(`§6Round ${bout.round + 1}/${ROUNDS[bout.tier].length}`, { fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
    player.playSound("raid.horn", { volume: 1, pitch: 1.1 });
  } catch {
    // cosmetic only
  }
}

/**
 * Ends a bout without a purse and clears the sand.
 * @param {Player | undefined} player @param {string} playerId @param {string} why
 */
function forfeit(player, playerId, why) {
  const bout = bouts.get(playerId);
  if (!bout) return;
  bouts.delete(playerId);
  for (const champion of champions(bout)) {
    try {
      champion.remove();
    } catch {
      // already gone
    }
  }
  try {
    player?.sendMessage(`§6[Arena] §fThe bout is over: ${why}.`);
  } catch {
    // player left
  }
}

/** @param {Player} player @param {Bout} bout */
function win(player, bout) {
  bouts.delete(player.id);
  const purse = PURSES[bout.tier];
  giveItem(player, id("yggdrasil_gold_coin"), purse.coins);
  if (purse.crests > 0) giveItem(player, id("guardian_crest"), purse.crests);
  // The Emperor's own prize for whoever fells the Martial Lord: a World Item, once.
  const prize = bout.tier === 2 && countItem(player, id("depiction_of_nature")) === 0;
  if (prize) giveItem(player, id("depiction_of_nature"), 1);
  fx.dome(bout.dimension, bout.origin, "holy");
  try {
    player.onScreenDisplay.setTitle("§6Victory!", { subtitle: `§e${purse.coins} Gold Coins, ${purse.xp} XP`, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 10 });
    player.sendMessage(
      `§6[Arena] §fThe crowd roars! Purse: §6${purse.coins} Gold Coins§f, §a${purse.xp} XP§f${purse.crests ? ", a Guardian Crest" : ""}${prize ? " - and the Emperor's prize, the §dDepiction of Nature and Society§f" : ""}.`
    );
    player.playSound("random.totem", { volume: 1, pitch: 1 });
  } catch {
    // cosmetic only
  }
  grantXp(player, purse.xp, "arena");
  questEvent(player, "arena");
}

/**
 * Starts a bout for the player. Returns a message describing the outcome.
 * @param {Player} player
 */
export function enter(player) {
  if (inArena(player)) return "§7You are already fighting";
  let masters = [];
  try {
    masters = player.dimension.getEntities({ type: MASTER, location: player.location, maxDistance: MASTER_RANGE });
  } catch {
    // dimension unloading
  }
  if (masters.length === 0) return "§7Only an Arena Master can open the gates - find an Imperial Arena";
  const tier = tierFor(profileOf(player).level);
  /** @type {Bout} */
  const bout = {
    tier,
    round: 0,
    tag: `overlord_arena_${player.id}`,
    origin: { x: Math.floor(player.location.x) + 0.5, y: player.location.y, z: Math.floor(player.location.z) + 0.5 },
    dimension: player.dimension,
    deadline: 0,
    resting: 0,
  };
  bouts.set(player.id, bout);
  sendOut(player, bout);
  return `§6The gates open: five rounds, tier ${tier + 1}`;
}

/** Moves every bout along: next round when the sand is clear, forfeit when the challenger leaves or runs out of time. */
export function referee() {
  for (const [playerId, bout] of bouts) {
    const player = world.getAllPlayers().find((p) => p.id === playerId);
    if (!player) {
      forfeit(undefined, playerId, "the challenger left");
      continue;
    }
    if (player.dimension.id !== bout.dimension.id || Math.hypot(player.location.x - bout.origin.x, player.location.z - bout.origin.z) > LEAVE_RANGE) {
      forfeit(player, playerId, "you left the sand");
      continue;
    }
    if (bout.resting > 0) {
      if (system.currentTick < bout.resting) continue;
      bout.resting = 0;
      sendOut(player, bout);
      continue;
    }
    if (champions(bout).length > 0) {
      if (system.currentTick > bout.deadline) forfeit(player, playerId, "the round ran out of time");
      continue;
    }
    bout.round += 1;
    if (bout.round >= ROUNDS[bout.tier].length) win(player, bout);
    else {
      bout.resting = system.currentTick + 3 * TICKS; // a breath between rounds
      notify(player, `§6Round ${bout.round} won - the next champion is coming`);
    }
  }
}

system.runInterval(() => {
  try {
    referee();
  } catch (error) {
    console.warn(`[Overlord] arena referee failed: ${error}`);
  }
}, TICKS);

world.afterEvents.entityDie.subscribe((event) => {
  const dead = event.deadEntity;
  if (dead.typeId === "minecraft:player" && bouts.has(dead.id)) forfeit(/** @type {Player} */ (dead), dead.id, "you fell");
});

world.afterEvents.playerLeave.subscribe((event) => forfeit(undefined, event.playerId, "the challenger left"));

/** Opens the arena menu. @param {Player} player */
export function openArena(player) {
  const tier = tierFor(profileOf(player).level);
  const purse = PURSES[tier];
  const last = ROUNDS[tier][ROUNDS[tier].length - 1].map(([type]) => type.split(":")[1].split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")).join(" and ");
  new ActionFormData()
    .title("Imperial Arena")
    .body(
      `§e<Arena Master>§r Five rounds on the sand, challenger. Win them all and the purse is yours; fall, flee or dawdle and you get nothing.\n\n` +
        `Your tier: §6${tier + 1}§r (tiers follow your level: 1-19, 20-49, 50+)\n` +
        `Last round: §c${last}§r\n` +
        `Purse: §6${purse.coins} Gold Coins§r, §a${purse.xp} XP§r${purse.crests ? ", a Guardian Crest" : ""}` +
        (tier === 2 ? "\nWhoever fells the Martial Lord also receives a World Item from the Emperor, once." : "")
    )
    .button(inArena(player) ? "You are already fighting" : "Enter the arena")
    .button("Not today")
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection !== 0 || !player.isValid) return;
      notify(player, enter(player));
    })
    .catch(() => {});
}

// Speaking to an Arena Master opens the arena menu.
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  if (event.target.typeId !== MASTER) return;
  const player = event.player;
  system.run(() => {
    if (player.isValid) openArena(player);
  });
});
