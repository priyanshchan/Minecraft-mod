// Overlord: Tomb of Nazarick - Tomb Raid.
// Blowing the Horn of the Tomb Raid starts five waves of Nazarick's forces around the
// player. Clearing them all pays out coins, crystals and XP; dying, leaving the area
// or running out of time fails the raid.
import { world, system } from "@minecraft/server";
import { giveItem, grantXp, notify, profileOf } from "./rpg.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const RAID_TAG = "overlord_raid";
const LEASH = 48; // blocks the player may stray from where the raid began
const WAVE_TIME = 240; // seconds allowed per wave

/** Final-wave bosses per tier. */
const BOSSES = [
  [id("death_knight")],
  [id("narberal"), id("lupusregina"), id("entoma"), id("solution"), id("yuri"), id("cz_delta")],
  [id("shalltear"), id("cocytus"), id("albedo"), id("demiurge"), id("aura"), id("mare")],
];

/** Waves per tier: each wave is a list of [entity, count]. "boss" is replaced by a random tier boss. */
const WAVES = [
  [
    [[id("old_guarder"), 4]],
    [[id("old_guarder"), 3], [id("goblin"), 4]],
    [[id("skeleton_mage"), 2], [id("old_guarder"), 3]],
    [[id("elder_lich"), 2], [id("ogre"), 1]],
    [["boss", 2], [id("skeleton_mage"), 2]],
  ],
  [
    [[id("old_guarder"), 5], [id("skeleton_mage"), 2]],
    [[id("elder_lich"), 3], [id("ogre"), 2]],
    [[id("death_knight"), 2], [id("soul_eater"), 1]],
    [[id("soul_eater"), 3], [id("elder_lich"), 2]],
    [["boss", 1], [id("death_knight"), 2]],
  ],
  [
    [[id("death_knight"), 3], [id("skeleton_mage"), 3]],
    [[id("soul_eater"), 4], [id("elder_lich"), 3]],
    [[id("death_knight"), 4], [id("soul_eater"), 2]],
    [[id("narberal"), 1], [id("cz_delta"), 1], [id("death_knight"), 2]],
    [["boss", 1], [id("death_knight"), 3]],
  ],
];

/** Rewards per tier. */
const REWARDS = [
  { coins: 24, crystals: 6, xp: 600, bonus: [] },
  { coins: 48, crystals: 12, xp: 2000, bonus: [[id("guardian_crest"), 1]] },
  { coins: 96, crystals: 24, xp: 6000, bonus: [[id("guardian_crest"), 2], [id("soul_fragment"), 8]] },
];

/**
 * @typedef {{
 *   tier: number, wave: number, tag: string, deadline: number,
 *   origin: import("@minecraft/server").Vector3, dimension: import("@minecraft/server").Dimension,
 * }} Raid
 */
/** @type {Map<string, Raid>} */
const raids = new Map();

/** @param {number} level */
function tierFor(level) {
  return level >= 50 ? 2 : level >= 20 ? 1 : 0;
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} title
 * @param {string} subtitle
 */
function banner(player, title, subtitle) {
  try {
    player.onScreenDisplay.setTitle(title, { subtitle, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 10 });
  } catch {
    // player left mid-tick
  }
}

/** @param {Raid} raid */
function raidMobs(raid) {
  try {
    return raid.dimension.getEntities({ tags: [raid.tag] });
  } catch {
    return [];
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {Raid} raid
 */
function spawnWave(player, raid) {
  const wave = WAVES[raid.tier][raid.wave];
  const total = wave.reduce((n, [, count]) => n + Number(count), 0);
  let index = 0;
  for (const [kind, count] of wave) {
    for (let i = 0; i < Number(count); i++) {
      const bosses = BOSSES[raid.tier];
      const type = kind === "boss" ? bosses[Math.floor(Math.random() * bosses.length)] : String(kind);
      const angle = (index++ / total) * Math.PI * 2 + raid.wave;
      const radius = 6 + (index % 3) * 2;
      let spot = { x: raid.origin.x + Math.cos(angle) * radius, y: raid.origin.y, z: raid.origin.z + Math.sin(angle) * radius };
      try {
        const feet = raid.dimension.getBlock(spot);
        const head = raid.dimension.getBlock({ x: spot.x, y: spot.y + 1, z: spot.z });
        if (!feet || !head || !feet.isAir || !head.isAir) spot = raid.origin; // no room there: appear at the centre
        const mob = raid.dimension.spawnEntity(type, spot);
        mob.addTag(RAID_TAG);
        mob.addTag(raid.tag);
      } catch (error) {
        console.warn(`[Overlord] raid spawn failed for ${type}: ${error}`);
      }
    }
  }
  raid.deadline = system.currentTick + WAVE_TIME * TICKS;
  banner(player, `§cWave ${raid.wave + 1}/${WAVES[raid.tier].length}`, "§7Defeat the forces of Nazarick");
  try {
    player.playSound("raid.horn", { volume: 1, pitch: 1 });
  } catch {
    // cosmetic only
  }
}

/**
 * @param {string} playerId
 * @param {import("@minecraft/server").Player | undefined} player
 * @param {string} reason
 */
function failRaid(playerId, player, reason) {
  const raid = raids.get(playerId);
  if (!raid) return;
  raids.delete(playerId);
  for (const mob of raidMobs(raid)) {
    try {
      mob.remove();
    } catch {
      // already gone
    }
  }
  if (player && player.isValid) {
    banner(player, "§4Raid failed", `§7${reason}`);
    player.sendMessage(`§6[Raid] §cThe raid has failed: ${reason}.`);
  }
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {Raid} raid
 */
function winRaid(player, raid) {
  raids.delete(player.id);
  const reward = REWARDS[raid.tier];
  giveItem(player, id("yggdrasil_gold_coin"), reward.coins);
  giveItem(player, id("data_crystal"), reward.crystals);
  for (const [item, count] of reward.bonus) giveItem(player, String(item), Number(count));
  banner(player, "§6Raid cleared!", `§e${reward.coins} coins, ${reward.crystals} crystals, ${reward.xp} XP`);
  player.sendMessage(`§6[Raid] §fTier ${raid.tier + 1} raid cleared! Reward: §6${reward.coins} Gold Coins§f, §b${reward.crystals} Data Crystals§f, §a${reward.xp} XP§f.`);
  try {
    player.playSound("random.totem", { volume: 1, pitch: 1 });
  } catch {
    // cosmetic only
  }
  grantXp(player, reward.xp, "raid");
}

/**
 * Starts a raid for the player (Horn of the Tomb Raid).
 * @param {import("@minecraft/server").Player} player
 */
export function startRaid(player) {
  if (raids.has(player.id)) {
    const raid = /** @type {Raid} */ (raids.get(player.id));
    notify(player, `§7Raid in progress - wave ${raid.wave + 1}, ${raidMobs(raid).length} foes left`);
    return;
  }
  const tier = tierFor(profileOf(player).level);
  /** @type {Raid} */
  const raid = {
    tier,
    wave: 0,
    tag: `${RAID_TAG}_${player.id}`,
    deadline: 0,
    origin: { x: player.location.x, y: player.location.y, z: player.location.z },
    dimension: player.dimension,
  };
  raids.set(player.id, raid);
  player.sendMessage(`§6[Raid] §fA tier ${tier + 1} Tomb Raid begins: 5 waves. Stay within ${LEASH} blocks and survive.`);
  spawnWave(player, raid);
}

/** True while the player has a raid running. @param {import("@minecraft/server").Player} player */
export function inRaid(player) {
  return raids.has(player.id);
}

system.runInterval(() => {
  for (const [playerId, raid] of [...raids]) {
    const player = world.getAllPlayers().find((p) => p.id === playerId);
    try {
      if (!player || !player.isValid) {
        failRaid(playerId, undefined, "the raider left");
        continue;
      }
      const dx = player.location.x - raid.origin.x;
      const dz = player.location.z - raid.origin.z;
      if (player.dimension.id !== raid.dimension.id || Math.hypot(dx, dz) > LEASH) {
        failRaid(playerId, player, "you left the battlefield");
        continue;
      }
      if (system.currentTick > raid.deadline) {
        failRaid(playerId, player, "time ran out");
        continue;
      }
      const left = raidMobs(raid).length;
      if (left > 0) continue;
      raid.wave += 1;
      if (raid.wave >= WAVES[raid.tier].length) winRaid(player, raid);
      else spawnWave(player, raid);
    } catch (error) {
      console.warn(`[Overlord] raid tick failed: ${error}`);
    }
  }
}, 2 * TICKS);

world.afterEvents.entityDie.subscribe((event) => {
  if (event.deadEntity.typeId !== "minecraft:player") return;
  failRaid(event.deadEntity.id, /** @type {import("@minecraft/server").Player} */ (event.deadEntity), "you fell in battle");
});

world.afterEvents.playerLeave.subscribe((event) => failRaid(event.playerId, undefined, "the raider left"));
