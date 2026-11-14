// Overlord: Tomb of Nazarick - world director.
// Controls how the world fights back: mob levels that follow nearby players,
// level-gated spawns, Nazarick night patrols, guards for villages, Death Knight
// squire zombies and small talk from the human NPCs.
import { world, system, EntityInitializationCause, GameMode } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { FACTIONS, addRep, creditedPlayer, giveItem, grantXp, profileOf, questEvent, registerMenu, standingOf, touch } from "./rpg.js";
import { rumour } from "./structures.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const LONG = 20000000;
export const LEVEL_KEY = "overlord:lvl";
export const ELITE_CHANCE = 0.05;

/** Tags of mobs the add-on spawned on purpose; they are never removed by the level gate. */
const SCRIPTED_TAGS = ["overlord_raid", "overlord_patrol", "overlord_summoned", "overlord_guard", "overlord_camp", "overlord_worldboss", "overlord_arena"];

/** Naturally spawning mobs that only appear once a nearby player has reached this level. */
export const SPAWN_GATE = {
  [id("skeleton_mage")]: 3,
  [id("ogre")]: 4,
  [id("elder_lich")]: 5,
  [id("death_knight")]: 8,
  [id("clementine")]: 10,
  [id("vampire_bride")]: 10,
  [id("shadow_demon")]: 8,
  [id("beastman")]: 6,
  [id("frost_giant")]: 14,
  [id("gigant_basilisk")]: 15,
  [id("bafolk")]: 10,
  [id("eight_edge_assassin")]: 25,
  [id("theocracy_priest")]: 10,
  [id("hellhound")]: 12,
  [id("war_troll")]: 14,
  [id("soul_eater")]: 12,
  [id("fluder")]: 15,
};

/** Night patrols by tier (player level 5+, 20+, 50+): [entity, count]. */
const PATROLS = [
  [[id("old_guarder"), 3], [id("skeleton_mage"), 1]],
  [[id("death_knight"), 1], [id("old_guarder"), 3], [id("elder_lich"), 1]],
  [[id("death_knight"), 2], [id("soul_eater"), 1], [id("elder_lich"), 2]],
];
const PATROL_MIN_LEVEL = 5;
const PATROL_CHANCE = 0.35; // per player, once per night
const PATROL_DISTANCE = 28;

const VILLAGER = "minecraft:villager_v2";
const GUARDS_PER_VILLAGE = 2;

/** Things the human NPCs say when a player talks to them. */
const DIALOGUE = {
  [id("adventurer")]: [
    "Offer me YGGDRASIL gold and my sword is yours for a while.",
    "They say a Death Knight was seen on the plains at night. Don't go alone.",
    "Goblins run once you bloody them. Ogres don't.",
    "Skeleton mages back away when you get close. Rush them or bring a bow.",
    "Copper plate, eh? Take guild requests from your plate to climb the ranks.",
  ],
  [id("guard")]: [
    "Stay inside the village after dark. Patrols from the Tomb have been seen nearby.",
    "We hold the line for the villagers. Monsters won't get past us.",
    "If you see undead marching in formation, that is no ordinary pack. Run or fight well.",
  ],
  [id("soldier")]: [
    "Kingdom army, on campaign. Keep clear of the Empire's outposts unless you want trouble.",
    "Bandits have been raiding the roads. Put a few down and the captain will be grateful.",
    "We drill with spears all day and still the undead scare me more than the Empire does.",
  ],
  [id("archer")]: ["Stay out of my line of fire and we'll get along.", "I can drop a goblin at forty paces. An ogre takes a few more arrows."],
  [id("imperial_knight")]: [
    "This post belongs to the Baharuth Empire. State your business or move along.",
    "The Emperor's knights do not fear the Kingdom's rabble.",
  ],
  [id("neia")]: ["My eyes frighten people. My arrows frighten demons - that will have to do.", "Justice needs strength behind it. I learned that from the Sorcerer King."],
  [id("remedios")]: ["A paladin does not think. A paladin strikes what is evil.", "If you see demi-humans in the hills, cut them down before they reach the wall."],
  [id("paladin")]: ["The Holy Kingdom stands while its wall stands.", "Bafolk have been raiding out of the hills again. Watch the ridgelines."],
  [id("elf_ranger")]: ["The forest hears you long before we do, human.", "The Theocracy burns our groves. If you fight their priests, you are welcome here."],
  [id("lakyus")]: ["Blue Roses takes the jobs nobody else dares to. If you see a demon gate, do not go in alone.", "My sword? Kilineyram drinks darkness. Sometimes I worry what it gives back."],
  [id("enri")]: ["Welcome to Carne. We are a small village, but we look after our friends.", "The goblins answer the horn. I still cannot quite believe they call me General."],
  [id("climb")]: ["I will become strong enough to protect the Princess. Until then, I train.", "Sir Gazef says a blade is only as true as the arm behind it."],
  [id("eclair")]: ["One day I, Eclair Ecleir Eicler, shall rule the Great Tomb of Nazarick!", "You there - polish something. A clean tomb is a conquered tomb."],
  [id("gazef")]: ["I am Gazef Stronoff, Warrior-Captain of the Kingdom. These lands are under my protection."],
  [id("brain")]: ["I am looking for an opponent worth my blade. You are not there yet."],
  [id("zaryusu")]: ["The tribes stand together now. Leave our swamp in peace and we will do the same."],
  [id("evileye")]: ["Hmph. Do not get in my way, and do not die where I have to see it."],
};

// ------------------------------------------------------------- mob levels

/**
 * Level given to a mob that spawns near a player of the given level.
 * @param {number} playerLevel @param {number} roll 0..1
 */
export function mobLevelFor(playerLevel, roll) {
  return Math.max(1, Math.min(100, Math.round(playerLevel * (0.7 + roll * 0.5))));
}

/**
 * @param {import("@minecraft/server").Entity} mob
 * @param {number} level
 */
function applyLevel(mob, level) {
  // About one in twenty is an elite: five levels higher, much tougher, harder hitting.
  const elite = Math.random() < ELITE_CHANCE;
  if (elite) {
    level = Math.min(100, level + 5);
    mob.setDynamicProperty("overlord:elite", true);
    mob.addEffect("resistance", LONG, { amplifier: 0, showParticles: true });
  }
  mob.setDynamicProperty(LEVEL_KEY, level);
  const hearts = Math.floor(level / 10) + (elite ? 5 : 0); // +2 hearts per 10 levels, +10 for elites
  const might = Math.floor(level / 30) + (elite ? 1 : 0); // Strength I at 30, II at 60, III at 90
  if (hearts > 0) mob.addEffect("health_boost", LONG, { amplifier: hearts - 1, showParticles: false });
  if (might > 0) mob.addEffect("strength", LONG, { amplifier: might - 1, showParticles: false });
  if (hearts > 0) {
    system.runTimeout(() => {
      try {
        const health = mob.isValid ? mob.getComponent("minecraft:health") : undefined;
        if (health) health.setCurrentValue(health.effectiveMax);
      } catch {
        // mob is gone
      }
    }, 2);
  }
}

/** @param {import("@minecraft/server").Entity} mob */
function onSpawn(mob) {
  try {
    if (!mob.isValid || mob.typeId === "minecraft:player") return;
    if (mob.getDynamicProperty(LEVEL_KEY) !== undefined) return;
    if (!mob.matches({ families: ["monster"] })) return;
    const health = mob.getComponent("minecraft:health");
    if (!health) return;
    const players = mob.dimension.getPlayers({ location: mob.location, maxDistance: 64 });
    if (players.length === 0) return;
    const levels = players.map((p) => profileOf(p).level);
    const scripted = SCRIPTED_TAGS.some((tag) => mob.hasTag(tag));

    const needed = SPAWN_GATE[mob.typeId];
    if (needed && !scripted && Math.max(...levels) < needed && !players.some((p) => p.getGameMode() === GameMode.Creative)) {
      mob.remove(); // too dangerous for everyone nearby: it never appears
      return;
    }
    if (mob.typeId === id("war_troll")) mob.addEffect("regeneration", LONG, { amplifier: 1, showParticles: false }); // trolls knit themselves back together
    if (health.effectiveMax >= 200) return; // bosses keep their own numbers
    applyLevel(mob, mobLevelFor(Math.max(...levels), Math.random()));
  } catch {
    // the mob vanished while we were looking at it
  }
}

world.afterEvents.entitySpawn.subscribe((event) => {
  if (event.cause !== EntityInitializationCause.Spawned) return;
  const mob = event.entity;
  // Wait two ticks so tags added by raids, patrols and summons are already in place.
  system.runTimeout(() => onSpawn(mob), 2);
});

// --------------------------------------------------------------- patrols

/** Last in-game day a patrol roll was made for each player. */
const patrolDay = new Map();

/** @param {number} level */
function patrolTier(level) {
  return level >= 50 ? 2 : level >= 20 ? 1 : 0;
}

/**
 * Sends a Nazarick patrol towards the player. Returns how many mobs were spawned.
 * @param {import("@minecraft/server").Player} player
 */
export function spawnPatrol(player) {
  const angle = Math.random() * Math.PI * 2;
  const x = player.location.x + Math.cos(angle) * PATROL_DISTANCE;
  const z = player.location.z + Math.sin(angle) * PATROL_DISTANCE;
  const ground = player.dimension.getTopmostBlock({ x, z });
  if (!ground) return 0;
  const tier = patrolTier(profileOf(player).level);
  let count = 0;
  for (const [type, amount] of PATROLS[tier]) {
    for (let i = 0; i < Number(amount); i++) {
      try {
        const mob = player.dimension.spawnEntity(String(type), { x: x + (count % 3) - 1, y: ground.location.y + 1, z: z + Math.floor(count / 3) - 1 });
        mob.addTag("overlord_patrol");
        count++;
      } catch {
        // that spot is not loaded; skip this member
      }
    }
  }
  if (count > 0) {
    player.sendMessage("§6[Overlord] §cA patrol from the Great Tomb of Nazarick has been sighted nearby.");
    try {
      player.playSound("mob.wither.ambient", { volume: 0.7, pitch: 0.6 });
    } catch {
      // cosmetic only
    }
  }
  return count;
}

system.runInterval(() => {
  let time = 0;
  let day = 0;
  try {
    time = world.getTimeOfDay();
    day = world.getDay();
  } catch {
    return; // world not ready
  }
  if (time < 13500 || time > 22000) return; // night only
  for (const player of world.getAllPlayers()) {
    try {
      if (patrolDay.get(player.id) === day) continue;
      patrolDay.set(player.id, day);
      if (player.dimension.id !== "minecraft:overworld") continue;
      if (profileOf(player).level < PATROL_MIN_LEVEL || Math.random() > PATROL_CHANCE) continue;
      spawnPatrol(player);
    } catch {
      // player is leaving
    }
  }
}, 10 * TICKS);

// Eight-Edge Assassins arrive unseen and only show themselves once their veil wears off.
world.afterEvents.entitySpawn.subscribe((event) => {
  try {
    if (event.entity.typeId === id("eight_edge_assassin")) event.entity.addEffect("invisibility", 20 * TICKS, { showParticles: false });
  } catch {
    // it is already gone
  }
});

// -------------------------------------------------------------- world bosses

const WORLD_BOSS_LEVEL = 25;
const WORLD_BOSS_CHANCE = 0.3; // per in-game day
/** Bosses that may appear, for players below level 50, from level 50 and from level 75. */
const WORLD_BOSSES = [
  [id("gargantua"), id("dominion_authority"), id("evil_lord_wrath"), id("skeletal_dragon"), id("behemoth")],
  [id("frost_dragon"), id("evil_lord_wrath"), id("zesshi"), id("dark_young"), id("jaldabaoth"), id("decem")],
  // The strongest adventurers draw out the Floor Guardians themselves.
  [id("cocytus"), id("shalltear"), id("albedo"), id("demiurge"), id("sebas"), id("dark_young"), id("jaldabaoth"),
    id("platinum_dragon_lord")],
];
export const WORLD_BOSS_KEY = id("world_bosses");
let bossDay = -1;

/** @param {number} dx @param {number} dz */
function heading(dx, dz) {
  const d = Math.hypot(dx, dz) || 1;
  const ns = dz < -d * 0.38 ? "north" : dz > d * 0.38 ? "south" : "";
  const ew = dx > d * 0.38 ? "east" : dx < -d * 0.38 ? "west" : "";
  return ns && ew ? `${ns}-${ew}` : ns || ew;
}

/**
 * Once a day, perhaps sends a world boss against one of the stronger players. Returns the boss, if any.
 * @param {() => number} [random]
 */
export function rollWorldBoss(random = Math.random) {
  const day = world.getDay();
  if (day === bossDay) return undefined;
  bossDay = day;
  if (random() > WORLD_BOSS_CHANCE) return undefined;
  const heroes = world.getAllPlayers().filter((p) => p.dimension.id === "minecraft:overworld" && profileOf(p).level >= WORLD_BOSS_LEVEL);
  if (heroes.length === 0) return undefined;
  const hero = heroes[Math.floor(random() * heroes.length)];
  const heroLevel = profileOf(hero).level;
  const pool = WORLD_BOSSES[heroLevel >= 75 ? 2 : heroLevel >= 50 ? 1 : 0];
  const type = pool[Math.floor(random() * pool.length)];
  const angle = random() * Math.PI * 2;
  const x = hero.location.x + Math.cos(angle) * 36;
  const z = hero.location.z + Math.sin(angle) * 36;
  const ground = hero.dimension.getTopmostBlock({ x, z });
  if (!ground) return undefined;
  const boss = hero.dimension.spawnEntity(type, { x, y: ground.location.y + 1, z });
  boss.addTag("overlord_worldboss");
  const name = type.split(":")[1].split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  world.sendMessage(`§6[World Boss] §c${name}§f has appeared ${heading(x - hero.location.x, z - hero.location.z)} of §e${hero.name}§f! All who are near when it falls will be rewarded.`);
  return boss;
}

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dead = event.deadEntity;
    if (!dead.hasTag("overlord_worldboss")) return;
    for (const hero of dead.dimension.getPlayers({ location: dead.location, maxDistance: 64 })) {
      const p = profileOf(hero);
      p.kills[WORLD_BOSS_KEY] = (p.kills[WORLD_BOSS_KEY] ?? 0) + 1;
      touch(hero);
      giveItem(hero, id("yggdrasil_gold_coin"), 30);
      giveItem(hero, id("data_crystal"), 6);
      giveItem(hero, id("codex_of_skills"), 1);
      hero.sendMessage("§6[World Boss] §fThe world boss has fallen! Reward: §630 Gold Coins§f, §b6 Data Crystals§f, a §5Codex of the Supreme Beings§f, §a1500 XP§f.");
      grantXp(hero, 1500, "world boss");
      questEvent(hero, "world_boss");
    }
  } catch {
    // the boss is already unloaded
  }
});

system.runInterval(() => {
  try {
    rollWorldBoss();
  } catch (error) {
    console.warn(`[Overlord] world boss roll failed: ${error}`);
  }
}, 30 * TICKS);

// ---------------------------------------------------------- village guards

/**
 * Posts guards near villagers around the player. Returns how many were spawned.
 * @param {import("@minecraft/server").Player} player
 */
export function postGuards(player) {
  const dimension = player.dimension;
  const villagers = dimension.getEntities({ type: VILLAGER, location: player.location, maxDistance: 48 });
  if (villagers.length < 3) return 0;
  const guards = dimension.getEntities({ type: id("guard"), location: villagers[0].location, maxDistance: 64 });
  let spawned = 0;
  for (let i = guards.length; i < GUARDS_PER_VILLAGE; i++) {
    const post = villagers[(i * 2) % villagers.length].location;
    const guard = dimension.spawnEntity(id("guard"), post);
    guard.addTag("overlord_guard");
    spawned++;
  }
  return spawned;
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      postGuards(player);
    } catch {
      // villagers unloaded mid-check
    }
  }
}, 30 * TICKS);

// ----------------------------------------------------- squires and dialogue

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const killer = event.damageSource.damagingEntity;
    const dead = event.deadEntity;
    if (!killer || killer.typeId !== id("death_knight")) return;
    if (dead.typeId !== VILLAGER && !dead.matches({ families: ["human"] })) return;
    // Those slain by a Death Knight rise again as its squire zombies.
    const squire = dead.dimension.spawnEntity("minecraft:zombie", dead.location);
    squire.addTag("overlord_summoned");
  } catch {
    // the corpse is already gone
  }
});

/** Tick before which a player will not get another line of dialogue. */
const talkReady = new Map();

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const lines = DIALOGUE[event.target.typeId];
  if (!lines) return;
  const player = event.player;
  const speaker = event.target;
  if (event.itemStack?.typeId === id("yggdrasil_gold_coin")) return; // paying, not chatting
  if (system.currentTick < (talkReady.get(player.id) ?? 0)) return;
  talkReady.set(player.id, system.currentTick + 2 * TICKS);
  let line = lines[Math.floor(Math.random() * lines.length)];
  const gossips = speaker.typeId === id("adventurer") || speaker.typeId === id("guard") || speaker.typeId === id("soldier");
  system.run(() => {
    try {
      if (!player.isValid || !speaker.isValid) return;
      if (gossips && Math.random() < 0.5) line = rumour(player) ?? line; // half the time they share where a camp lies
      const name = speaker.nameTag || speaker.typeId.split(":")[1].split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      player.sendMessage(`§e<${name}>§f ${line}`);
    } catch {
      // someone left
    }
  });
});

// --------------------------------------------------------------- reputation

/** Faction each NPC belongs to. */
const FACTION_OF = {
  [id("soldier")]: "kingdom",
  [id("archer")]: "kingdom",
  [id("guard")]: "kingdom",
  [id("gazef")]: "kingdom",
  [id("imperial_knight")]: "empire",
  [id("adventurer")]: "adventurers",
  [id("lizardman")]: "lizardmen",
  [id("zaryusu")]: "lizardmen",
};
/** NPC types that can be told to turn on players. */
const TROOPS = {
  kingdom: [id("soldier"), id("archer"), id("guard")],
  empire: [id("imperial_knight")],
  adventurers: [id("adventurer")],
  lizardmen: [id("lizardman")],
};
export const HOSTILE_AT = -30;
const MURDER = -15;

/** @param {number} value */
export function standingName(value) {
  return value <= HOSTILE_AT ? "§cHostile" : value < 0 ? "§6Wary" : value < 30 ? "§fNeutral" : value < 60 ? "§aFriendly" : "§bHonoured";
}

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const player = creditedPlayer(event.damageSource.damagingEntity);
    if (!player) return;
    const type = event.deadEntity.typeId;
    const faction = FACTION_OF[type];
    if (faction) {
      addRep(player, faction, MURDER);
      if (faction === "kingdom") addRep(player, "empire", 2);
      if (faction === "empire") addRep(player, "kingdom", 2);
      const standing = standingOf(profileOf(player), faction);
      player.sendMessage(`§6[Reputation] §f${FACTIONS[faction]}: ${standingName(standing)}§f (${standing}). ${standing <= HOSTILE_AT ? "Their people will attack you on sight." : "They will not forget this."}`);
    } else if (type === id("bandit")) {
      addRep(player, "kingdom", 1);
      addRep(player, "adventurers", 1);
    }
  } catch {
    // killer left
  }
});

/**
 * Tells faction troops near a player whether to treat players as enemies.
 * @param {import("@minecraft/server").Player} player
 */
export function enforceReputation(player) {
  const p = profileOf(player);
  for (const [faction, types] of Object.entries(TROOPS)) {
    const hated = standingOf(p, faction) <= HOSTILE_AT;
    for (const type of types) {
      for (const troop of player.dimension.getEntities({ type, location: player.location, maxDistance: 24 })) {
        try {
          const angry = troop.hasTag("overlord_hostile");
          if (hated && !angry) {
            troop.addTag("overlord_hostile");
            troop.triggerEvent(id("turn_hostile"));
          } else if (!hated && angry) {
            troop.removeTag("overlord_hostile");
            troop.triggerEvent(id("calm"));
          }
        } catch {
          // troop is unloading
        }
      }
    }
  }
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      enforceReputation(player);
    } catch {
      // player is leaving
    }
  }
}, 5 * TICKS);

// Grudges fade: one point back towards neutral every minute.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      const p = profileOf(player);
      for (const faction of Object.keys(FACTIONS)) if (standingOf(p, faction) < 0) addRep(player, faction, 1);
    } catch {
      // player is leaving
    }
  }
}, 60 * TICKS);

registerMenu(
  () => "Reputation",
  (player) => {
    const p = profileOf(player);
    const form = new ActionFormData()
      .title("Reputation")
      .body(
        Object.entries(FACTIONS).map(([key, name]) => `${name}: ${standingName(standingOf(p, key))}§r (${standingOf(p, key)})`).join("\n") +
          `\n\nKilling a faction's people costs ${-MURDER} standing; at ${HOSTILE_AT} or below they attack on sight. Grudges fade by 1 a minute. Guild quests, slain bandits and cleared camps raise your standing; friends of the adventurers hire mercenaries for a quarter less.`
      )
      .button("Close");
    form.show(player).catch(() => {});
  }
);

world.afterEvents.playerLeave.subscribe((event) => {
  patrolDay.delete(event.playerId);
  talkReady.delete(event.playerId);
});
