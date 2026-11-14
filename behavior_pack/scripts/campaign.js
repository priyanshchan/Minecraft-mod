// Overlord: Tomb of Nazarick - the story campaign, "Rise of the Sorcerer King".
//
// Ten chapters retell the road from Carne Village to the throne. A chapter is begun from the Chronicle
// (a page of the Adventurer's Plate) and is played where the player stands: the camera pulls back while
// its characters speak, allies arrive, then its foes come in stages, the last of them the chapter's boss
// (whose fight bosses.js and dragons.js run as anywhere else). Clearing every stage tells the end of the
// chapter and pays its reward; dying, straying more than LEASH blocks or running out of time fails it,
// and it can be tried again at once. Chapters open one after another and each asks for a level.
// Finishing the tenth crowns the player and lets them found the Sorcerer Kingdom (kingdom.js).
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { giveItem, grantXp, notify, profileOf, registerMenu, touch } from "./rpg.js";
import { inRaid } from "./raid.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
export const STORY_TAG = "overlord_story";
/** How far the player may stray from where the chapter began. */
export const LEASH = 60;
/** Seconds allowed for each stage. */
export const STAGE_TIME = 300;
/** Ticks between two lines of dialogue. */
export const LINE_TICKS = 70;
/** A chapter played again pays this share of its XP and coins, and none of its items. */
const REPLAY_SHARE = 0.25;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {[string, string]} Line speaker, words */
/** @typedef {{ name: string, foes: [string, number][], boss?: boolean }} Stage */
/**
 * @typedef {{
 *   key: string, name: string, level: number, element: string, blurb: string,
 *   intro: Line[], allies: [string, number][], stages: Stage[], outro: Line[],
 *   reward: { xp: number, coins: number, crystals: number, items: [string, number][] },
 * }} Chapter
 */

const NARRATOR = "§7";
const AINZ = "§5Ainz";

/** @type {Chapter[]} */
export const CHAPTERS = [
  {
    key: "carne", name: "The Battle of Carne Village", level: 5, element: "holy",
    blurb: "Knights in Empire colours burn a frontier village. Behind them waits the Sunlight Scripture, hunting the Warrior Captain.",
    intro: [
      [NARRATOR, "You wake in a strange world, far from Yggdrasil. Smoke rises over the hills."],
      ["§eEnri", "Please... they are killing everyone in Carne Village!"],
      ["§6Gazef", "I am Gazef Stronoff, Warrior Captain of the Kingdom. Stand with me, traveller."],
      ["§fNigun", "Surrender the Captain. The Sunlight Scripture does not bargain."],
    ],
    allies: [[id("gazef"), 1], [id("soldier"), 2]],
    stages: [
      { name: "Priests of the Sunlight Scripture", foes: [[id("theocracy_priest"), 3]] },
      { name: "The Summoned Angels", foes: [[id("theocracy_priest"), 2], [id("archangel_flame"), 2]] },
      { name: "Nigun Grid Luin", foes: [[id("nigun"), 1], [id("archangel_flame"), 1]], boss: true },
    ],
    outro: [
      ["§fNigun", "Impossible... who ARE you?"],
      [AINZ, "Remember this name: Ainz Ooal Gown. A name you will hear again."],
      ["§6Gazef", "Carne Village owes you its life. So do I."],
    ],
    reward: { xp: 400, coins: 20, crystals: 4, items: [[id("blue_potion"), 3]] },
  },
  {
    key: "graveyard", name: "Night of the Undead", level: 15, element: "dark",
    blurb: "The dead rise in E-Rantel's graveyard. A cult of Zurrernorn is turning the city into a necropolis.",
    intro: [
      [NARRATOR, "E-Rantel, city of three walls. Tonight the graveyard gate is breaking."],
      ["§aNfirea", "They took me before... Khajiit wants a Death Spiral over the whole city!"],
      ["§fKhajiit", "Rise, my children. Rise and feed."],
      ["§cClementine", "Ooh, a new toy. Try not to break too fast, okay?"],
    ],
    allies: [[id("adventurer"), 3]],
    stages: [
      { name: "The Graveyard Horde", foes: [[id("old_guarder"), 6]] },
      { name: "The Cult's Casters", foes: [[id("skeleton_mage"), 3], [id("old_guarder"), 3]] },
      { name: "The Elder Lich", foes: [[id("elder_lich"), 1], [id("old_guarder"), 4]] },
      { name: "Khajiit and Clementine", foes: [[id("khajiit"), 1], [id("clementine"), 1], [id("skeletal_dragon"), 1]], boss: true },
    ],
    outro: [
      ["§cClementine", "That's... not... fair..."],
      ["§aNfirea", "The graveyard is quiet. You saved E-Rantel."],
      [NARRATOR, "The Adventurers' Guild raises you to Adamantite, the highest rank."],
    ],
    reward: { xp: 1600, coins: 40, crystals: 8, items: [[id("soul_fragment"), 4]] },
  },
  {
    key: "bloody_valkyrie", name: "The Bloody Valkyrie", level: 25, element: "dark",
    blurb: "A World Item has bound the mind of Shalltear Bloodfallen. Only her master can bring her home.",
    intro: [
      [NARRATOR, "A forest clearing. Blood on the grass, and a silence that is far too deep."],
      ["§cShalltear", "..."],
      [AINZ, "Shalltear. A World Item has seized your mind. Then I will be the one to free you."],
      ["§cShalltear", "Brides! Feast on the intruder!"],
    ],
    allies: [],
    stages: [
      { name: "The Vampire Brides", foes: [[id("vampire_bride"), 4]] },
      { name: "The Brides' Second Wave", foes: [[id("vampire_bride"), 3], [id("soul_eater"), 1]] },
      { name: "Shalltear Bloodfallen", foes: [[id("shalltear"), 1]], boss: true },
    ],
    outro: [
      ["§cShalltear", "Ainz-sama...? What... what have I done?"],
      [AINZ, "Nothing that cannot be forgiven. Come home, Shalltear."],
      [NARRATOR, "Somewhere, a hidden enemy holds a World Item. Nazarick will remember."],
    ],
    reward: { xp: 4000, coins: 60, crystals: 12, items: [[id("guardian_crest"), 1]] },
  },
  {
    key: "lizardmen", name: "The Lizardmen War", level: 35, element: "ice",
    blurb: "Cocytus leads Nazarick's undead against five lizardman tribes. Zaryusu asks for one more blade at the marsh.",
    intro: [
      [NARRATOR, "The great lake. Mist over the reeds, and the cold of an approaching army."],
      ["§2Zaryusu", "Five tribes stand together today. Will you stand with us?"],
      ["§bCocytus", "Warriors. I Shall Give You An Honourable Death."],
    ],
    allies: [[id("zaryusu"), 1], [id("lizardman"), 3]],
    stages: [
      { name: "The Undead Vanguard", foes: [[id("old_guarder"), 6], [id("skeleton_mage"), 2]] },
      { name: "The Liches", foes: [[id("elder_lich"), 2], [id("old_guarder"), 4]] },
      { name: "Cocytus", foes: [[id("cocytus"), 1]], boss: true },
    ],
    outro: [
      ["§bCocytus", "Magnificent. Such Warriors Deserve To Live."],
      ["§2Zaryusu", "The tribes are free... and will remember who stood beside them."],
      [NARRATOR, "The lizardmen pledge themselves to a new protector."],
    ],
    reward: { xp: 7000, coins: 80, crystals: 16, items: [[id("refining_stone"), 6]] },
  },
  {
    key: "six_arms", name: "The Six Arms", level: 45, element: "none",
    blurb: "The Eight Fingers rule the capital's underworld. Their guard, the Six Arms, answers to Zero.",
    intro: [
      [NARRATOR, "Re-Estize's capital. Behind a brothel's doors, the Eight Fingers count their gold."],
      ["§7Brain", "Sebas went in alone. We won't let him do it twice."],
      ["§eClimb", "For Princess Renner, and for the people they've crushed!"],
      ["§fZero", "Six Arms! Show them why the underworld fears us!"],
    ],
    allies: [[id("brain"), 1], [id("climb"), 1]],
    stages: [
      { name: "The Eight Fingers' Thugs", foes: [[id("bandit"), 6]] },
      { name: "Enforcers and Brutes", foes: [[id("bandit"), 4], [id("war_troll"), 1]] },
      { name: "Zero, Leader of the Six Arms", foes: [[id("zero"), 1], [id("bandit"), 2]], boss: true },
    ],
    outro: [
      ["§fZero", "The Six Arms... beaten..."],
      ["§7Brain", "Not bad. Not bad at all."],
      [NARRATOR, "The capital breathes easier. For one night."],
    ],
    reward: { xp: 11000, coins: 100, crystals: 20, items: [[id("codex_of_skills"), 1]] },
  },
  {
    key: "gehenna", name: "Gehenna", level: 55, element: "fire",
    blurb: "A wall of flame splits the capital. The demon emperor Jaldabaoth claims the city as his own.",
    intro: [
      [NARRATOR, "The capital burns. Behind the fire wall, demons drag citizens into the dark."],
      ["§bLakyus", "Blue Rose, hold the line! Adventurer, the demons pour from the centre!"],
      ["§cEvileye", "That masked demon... he is beyond anything I have faced."],
      ["§4Jaldabaoth", "Welcome to Gehenna. Do try to entertain me."],
    ],
    allies: [[id("lakyus"), 1], [id("evileye"), 1]],
    stages: [
      { name: "Hounds of the Fire Wall", foes: [[id("hellhound"), 4], [id("shadow_demon"), 2]] },
      { name: "The Evil Lord of Wrath", foes: [[id("evil_lord_wrath"), 1], [id("shadow_demon"), 3]] },
      { name: "Jaldabaoth", foes: [[id("jaldabaoth"), 1]], boss: true },
    ],
    outro: [
      ["§4Jaldabaoth", "A worthy foe. We will meet again... perhaps."],
      ["§bLakyus", "The flames are dying. The capital is saved."],
      [NARRATOR, "In the shadows, a certain demon smiles. Everything went to plan."],
    ],
    reward: { xp: 16000, coins: 130, crystals: 26, items: [[id("guardian_crest"), 2]] },
  },
  {
    key: "dwarves", name: "The Dwarven Kingdom", level: 65, element: "ice",
    blurb: "The dwarves lost their royal capital to the quagoa and a white dragon. They will trade runecraft for it.",
    intro: [
      [NARRATOR, "The Azerlisia Mountains. Snow, stone and the echo of picks."],
      ["§6Gondo", "Take back the royal capital and the runesmiths are yours, Your Majesty."],
      ["§fPe Riyuro", "Quagoa clans! Bury the surface-dwellers!"],
    ],
    allies: [[id("dwarf"), 3]],
    stages: [
      { name: "The Quagoa Clans", foes: [[id("quagoa"), 8]] },
      { name: "The Frost Giant", foes: [[id("quagoa"), 6], [id("frost_giant"), 1]] },
      { name: "Olasird'arc, the Frost Dragon", foes: [[id("frost_dragon"), 1]], boss: true },
    ],
    outro: [
      [NARRATOR, "The white dragon falls from the sky with a sound like a glacier breaking."],
      ["§6Gondo", "The royal capital is ours again! The runesmiths will forge for you."],
    ],
    reward: { xp: 22000, coins: 160, crystals: 32, items: [[id("adamantite_ingot"), 8], [id("gem_sapphire"), 2]] },
  },
  {
    key: "black_scripture", name: "The Black Scripture", level: 75, element: "holy",
    blurb: "The Slane Theocracy sends its strongest: the Black Scripture, and the girl who has never lost.",
    intro: [
      [NARRATOR, "A plain of white stone. Banners of the Six Great Gods snap in the wind."],
      ["§fCaptain", "By the will of the Six, the undead king and his servants end here."],
      ["§dZesshi", "Finally, someone who might be strong. Don't disappoint me."],
    ],
    allies: [],
    stages: [
      { name: "The Theocracy's Host", foes: [[id("theocracy_priest"), 4], [id("archangel_flame"), 3]] },
      { name: "The Dominion Authority", foes: [[id("dominion_authority"), 1]] },
      { name: "Zesshi Zetsumei", foes: [[id("zesshi"), 1]], boss: true },
    ],
    outro: [
      ["§dZesshi", "I lost...? Ha. Ahaha! So this is what losing feels like."],
      [NARRATOR, "The Theocracy's trump card is spent. Its gods are silent."],
    ],
    reward: { xp: 30000, coins: 200, crystals: 40, items: [[id("codex_of_skills"), 1], [id("gem_sunstone"), 2]] },
  },
  {
    key: "dragon_lord", name: "The Platinum Dragon Lord", level: 85, element: "lightning",
    blurb: "Tsaindorcus Vaision, last of the true Dragon Lords, comes to judge whether this world can survive you.",
    intro: [
      [NARRATOR, "Storm clouds gather over the Argland Council State."],
      ["§bTsa", "Another player. Another storm. I watched the Eight Greed Kings burn this world."],
      ["§bTsa", "Show me you are different, or fall like they did."],
    ],
    allies: [],
    stages: [
      { name: "The Dragon Lord's Vassal", foes: [[id("frost_dragon"), 1]] },
      { name: "Tsaindorcus Vaision", foes: [[id("platinum_dragon_lord"), 1]], boss: true },
    ],
    outro: [
      ["§bTsa", "...You held back. Interesting. Perhaps this world can bear you after all."],
      [NARRATOR, "The last Dragon Lord withdraws. No power in the world now stands against you."],
    ],
    reward: { xp: 42000, coins: 260, crystals: 52, items: [[id("guardian_crest"), 3], [id("codex_of_skills"), 1]] },
  },
  {
    key: "coronation", name: "Coronation of the Sorcerer King", level: 90, element: "dark",
    blurb: "Nazarick's strongest, Rubedo, wakes to test the one who would wear the crown. Win, and rule.",
    intro: [
      [NARRATOR, "The Throne Room of Nazarick. Forty-one banners hang in silence."],
      ["§dAlbedo", "Every Floor Guardian awaits. But one more must give her blessing."],
      ["§cRubedo", "...The strongest decides who rules. Prove it."],
    ],
    allies: [],
    stages: [
      { name: "Nazarick's Honour Guard", foes: [[id("death_knight"), 3], [id("soul_eater"), 2]] },
      { name: "Rubedo, the Strongest", foes: [[id("rubedo"), 1]], boss: true },
    ],
    outro: [
      ["§cRubedo", "...Acceptable. I kneel."],
      ["§dAlbedo", "All hail the Sorcerer King! Glory to the Sorcerer Kingdom!"],
      [AINZ, "Then let the world know: a new king rules. Found your kingdom, Your Majesty."],
    ],
    reward: { xp: 60000, coins: 400, crystals: 80, items: [[id("royal_seal"), 1], [id("codex_of_skills"), 2]] },
  },
];

/** Story-earned titles, granted by guild.js once the chapter is done. */
export const STORY_TITLES = [
  { key: "saviour_of_carne", name: "Saviour of Carne", how: "Finish Chapter 1 of the campaign", chapter: "carne" },
  { key: "dark_hero_momon", name: "Dark Hero Momon", how: "Finish Chapter 2 of the campaign", chapter: "graveyard" },
  { key: "hero_of_gehenna", name: "Hero of Gehenna", how: "Finish Chapter 6 of the campaign", chapter: "gehenna" },
  { key: "dragon_lords_equal", name: "Equal of the Dragon Lord", how: "Finish Chapter 9 of the campaign", chapter: "dragon_lord" },
  { key: "sorcerer_king", name: "Sorcerer King", how: "Finish the campaign and be crowned", chapter: "coronation" },
];

// ---------------------------------------------------------------- progress

/** The chapters a profile has finished. @param {import("./rpg.js").Profile} p */
export function storyOf(p) {
  if (!Array.isArray(p.story)) p.story = [];
  return p.story;
}

/** Whether the player has been crowned (finished the campaign). @param {Player} player */
export function crowned(player) {
  return storyOf(profileOf(player)).includes("coronation");
}

/** The first chapter the player has not finished, or undefined when the story is done. @param {Player} player */
export function nextChapter(player) {
  const done = storyOf(profileOf(player));
  return CHAPTERS.find((c) => !done.includes(c.key));
}

/**
 * Whether a chapter can be begun now: an empty string if so, or the reason why not.
 * @param {Player} player @param {Chapter} chapter
 */
export function blocked(player, chapter) {
  const p = profileOf(player);
  const done = storyOf(p);
  const index = CHAPTERS.indexOf(chapter);
  if (index > 0 && !done.includes(CHAPTERS[index - 1].key)) return `Finish "${CHAPTERS[index - 1].name}" first`;
  if (p.level < chapter.level) return `Reach level ${chapter.level} first`;
  if (runs.has(player.id)) return "You are already playing a chapter";
  if (inRaid(player)) return "Finish your Tomb Raid first";
  if (player.dimension.id !== "minecraft:overworld" && player.dimension.id !== "overworld") return "Chapters are played in the overworld";
  return "";
}

// ---------------------------------------------------------------- a chapter in play

/**
 * @typedef {{
 *   chapter: Chapter, player: Player, playerId: string, phase: "intro" | "fight" | "outro",
 *   line: number, next: number, stage: number, deadline: number, origin: Vector3, dimension: Dimension,
 *   tag: string, replay: boolean, helpers: number,
 * }} Run
 */
/** @type {Map<string, Run>} */
export const runs = new Map();

/** @param {Entity} e */
function alive(e) {
  try {
    if (!e.isValid) return false;
    const health = e.getComponent("minecraft:health");
    return !health || health.currentValue > 0;
  } catch {
    return false;
  }
}

/** The run's living foes. @param {Run} run */
export function foesOf(run) {
  try {
    return run.dimension.getEntities({ tags: [run.tag] }).filter(alive);
  } catch {
    return [];
  }
}

/** @param {Player} player @param {string} title @param {string} subtitle @param {number} [stay] */
function banner(player, title, subtitle, stay = 50) {
  try {
    player.onScreenDisplay.setTitle(title, { subtitle, fadeInDuration: 5, stayDuration: stay, fadeOutDuration: 10 });
  } catch {
    // the player left mid-tick
  }
}

/** @param {Player} player @param {string} sound @param {number} [pitch] */
function sound(player, sound, pitch = 1) {
  try {
    player.playSound(sound, { volume: 1, pitch });
  } catch {
    // cosmetic only
  }
}

/** A spot on the ground near `at`, for someone to stand on. @param {Run} run @param {number} angle @param {number} radius */
function spotAround(run, angle, radius) {
  const x = run.origin.x + Math.cos(angle) * radius;
  const z = run.origin.z + Math.sin(angle) * radius;
  try {
    const top = run.dimension.getTopmostBlock({ x, z });
    if (top && Math.abs(top.location.y + 1 - run.origin.y) <= 6) return { x, y: top.location.y + 1, z };
  } catch {
    // not loaded or no such call: fall back to the player's height
  }
  try {
    const feet = run.dimension.getBlock({ x, y: run.origin.y, z });
    const head = run.dimension.getBlock({ x, y: run.origin.y + 1, z });
    if (feet && head && feet.isAir && head.isAir) return { x, y: run.origin.y, z };
  } catch {
    // not loaded
  }
  return { ...run.origin };
}

/** The camera circles the battlefield while the characters speak. @param {Run} run */
function frame(run) {
  try {
    const angle = run.line * 0.9 + 0.6;
    const location = { x: run.origin.x + Math.cos(angle) * 9, y: run.origin.y + 5, z: run.origin.z + Math.sin(angle) * 9 };
    run.player.camera.setCamera("minecraft:free", {
      location, facingLocation: { x: run.origin.x, y: run.origin.y + 1.2, z: run.origin.z },
      easeOptions: { easeTime: LINE_TICKS / TICKS, easeType: /** @type {any} */ ("InOutSine") },
    });
  } catch {
    // no camera control here: the chapter goes on without it
  }
}

/** @param {Player} player */
function release(player) {
  try {
    if (player.isValid) player.camera.clear();
  } catch {
    // the player left
  }
}

/** Speaks one line. @param {Run} run @param {Line} line */
function say(run, [speaker, words]) {
  const name = speaker === NARRATOR ? "" : `${speaker}§r: `;
  try {
    run.player.sendMessage(`§6[${run.chapter.name}] §r${name}§f${words}`);
  } catch {
    // the player left
  }
  banner(run.player, speaker === NARRATOR ? "" : speaker, `§f${words}`, LINE_TICKS - 15);
}

/** Calls the chapter's allies to the player's side. @param {Run} run */
function callAllies(run) {
  let index = 0;
  for (const [type, count] of run.chapter.allies) {
    for (let i = 0; i < count; i++, index++) {
      const spot = spotAround(run, Math.PI * 0.5 + (index - 1) * 0.5, 3);
      try {
        const ally = run.dimension.spawnEntity(type, spot);
        ally.addTag(STORY_TAG);
        ally.addTag(`${run.tag}_ally`); // allies are not counted among the foes
        fx.rise(run.dimension, spot, "holy", 0.7);
      } catch (error) {
        console.warn(`[Overlord] story ally ${type} failed: ${error}`);
      }
    }
  }
}

/** Brings on the run's current stage. @param {Run} run @param {number} now */
export function spawnStage(run, now) {
  const stage = run.chapter.stages[run.stage];
  const total = stage.foes.reduce((n, [, count]) => n + count, 0);
  let index = 0;
  for (const [type, base] of stage.foes) {
    // friends who came along make every stage but the boss's a little bigger
    const count = stage.boss ? base : Math.round(base * (1 + 0.5 * run.helpers));
    for (let i = 0; i < count; i++, index++) {
      const angle = (index / Math.max(total, count)) * Math.PI * 2 + run.stage * 0.7;
      const spot = spotAround(run, angle, stage.boss && i === 0 ? 9 : 8 + (index % 3) * 2);
      try {
        const foe = run.dimension.spawnEntity(type, spot);
        foe.addTag(STORY_TAG);
        foe.addTag(run.tag);
        fx.pillar(run.dimension, spot, run.chapter.element, stage.boss ? 6 : 2.5, stage.boss ? 1.6 : 0.8);
      } catch (error) {
        console.warn(`[Overlord] story spawn ${type} failed: ${error}`);
      }
    }
  }
  run.deadline = now + STAGE_TIME * TICKS;
  const of = `${run.stage + 1}/${run.chapter.stages.length}`;
  if (stage.boss) {
    banner(run.player, `§4${stage.name}`, `§7The final battle of ${run.chapter.name}`, 60);
    fx.shake(run.dimension, run.origin, 24, 0.4, 0.8);
    sound(run.player, "mob.wither.spawn", 1.2);
  } else {
    banner(run.player, `§c${stage.name}`, `§7Stage ${of}`);
    sound(run.player, "raid.horn");
  }
}

/** Removes everyone the run brought into the world. @param {Run} run */
function clearField(run) {
  for (const tag of [run.tag, `${run.tag}_ally`]) {
    try {
      for (const e of run.dimension.getEntities({ tags: [tag] })) {
        try {
          e.remove();
        } catch {
          // already gone
        }
      }
    } catch {
      // the dimension is unloading
    }
  }
}

/**
 * Begins a chapter where the player stands. Returns a message describing the outcome.
 * @param {Player} player @param {Chapter} chapter @param {number} [now]
 */
export function begin(player, chapter, now = system.currentTick) {
  const why = blocked(player, chapter);
  if (why) return `§7${why}`;
  const replay = storyOf(profileOf(player)).includes(chapter.key);
  /** @type {Run} */
  const run = {
    chapter, player, playerId: player.id, phase: "intro", line: 0, next: now, stage: -1, deadline: 0,
    origin: { x: player.location.x, y: player.location.y, z: player.location.z }, dimension: player.dimension,
    tag: `${STORY_TAG}_${player.id}`, replay, helpers: 0,
  };
  try {
    run.helpers = player.dimension.getPlayers({ location: player.location, maxDistance: 24 }).filter((p) => p.id !== player.id).length;
  } catch {
    // alone
  }
  runs.set(player.id, run);
  const number = CHAPTERS.indexOf(chapter) + 1;
  banner(player, `§6Chapter ${number}`, `§e${chapter.name}`, 70);
  player.sendMessage(`§6[Campaign] §fChapter ${number}: §e${chapter.name}§f${replay ? " §7(replay)" : ""}. Stay within ${LEASH} blocks. §7Sneak to skip the dialogue.`);
  fx.ring(run.dimension, run.origin, chapter.element, 6);
  sound(player, "ambient.weather.thunder", 0.7);
  callAllies(run);
  run.next = now + 50;
  return `§6Chapter ${number} begins`;
}

/** @param {Run} run @param {string} reason */
export function fail(run, reason) {
  runs.delete(run.playerId);
  clearField(run);
  release(run.player);
  try {
    if (run.player.isValid) {
      banner(run.player, "§4Chapter failed", `§7${reason}`);
      run.player.sendMessage(`§6[Campaign] §c${run.chapter.name} failed: ${reason}. §7Begin it again from the Chronicle.`);
    }
  } catch {
    // the player left
  }
}

/** Pays the chapter's reward and records it. @param {Run} run */
function finish(run) {
  runs.delete(run.playerId);
  clearField(run);
  release(run.player);
  const player = run.player;
  const p = profileOf(player);
  const reward = run.chapter.reward;
  const share = run.replay ? REPLAY_SHARE : 1;
  const coins = Math.round(reward.coins * share);
  const xp = Math.round(reward.xp * share);
  giveItem(player, id("yggdrasil_gold_coin"), coins);
  if (!run.replay) {
    giveItem(player, id("data_crystal"), reward.crystals);
    for (const [item, count] of reward.items) giveItem(player, item, count);
    storyOf(p).push(run.chapter.key);
    touch(player);
  }
  const number = CHAPTERS.indexOf(run.chapter) + 1;
  const crown = run.chapter.key === "coronation" && !run.replay;
  banner(player, crown ? "§6§lLong live the Sorcerer King" : `§6Chapter ${number} complete`, `§e${run.chapter.name}`, 80);
  player.sendMessage(
    `§6[Campaign] §fChapter ${number} complete! Reward: §6${coins} Gold Coins§f, §a${xp} XP§f` +
      (run.replay ? " §7(replay)" : `, §b${reward.crystals} Data Crystals§f${reward.items.length > 0 ? " and more" : ""}`) + "."
  );
  sound(player, "random.totem");
  for (let i = 0; i < (crown ? 8 : 3); i++) {
    const a = (i / (crown ? 8 : 3)) * Math.PI * 2;
    const at = { x: run.origin.x + Math.cos(a) * 4, y: run.origin.y, z: run.origin.z + Math.sin(a) * 4 };
    fx.pillar(run.dimension, at, crown ? "holy" : run.chapter.element, crown ? 9 : 5);
  }
  if (crown) {
    fx.nova(run.dimension, { x: run.origin.x, y: run.origin.y + 1, z: run.origin.z }, "dark", 8);
    fx.wash(player, { red: 0.85, green: 0.7, blue: 0.2 }, 1.5);
    world.sendMessage(`§6[Overlord] §e${player.name} has been crowned Sorcerer King! §7A new kingdom will rise.`);
    player.sendMessage("§6[Campaign] §fThe story is done. Use the §eSeal of the Sorcerer Kingdom§f (or the Kingdom page) to found your capital.");
  } else if (!run.replay) {
    const next = CHAPTERS[number];
    if (next) player.sendMessage(`§6[Campaign] §7Next: Chapter ${number + 1}, ${next.name} (level ${next.level}).`);
  }
  grantXp(player, xp, "story");
  // whoever fought beside the player shares in the glory
  try {
    for (const friend of run.dimension.getPlayers({ location: run.origin, maxDistance: LEASH })) {
      if (friend.id === player.id) continue;
      grantXp(friend, Math.round(xp / 2), "story");
      giveItem(friend, id("yggdrasil_gold_coin"), Math.round(coins / 2));
      friend.sendMessage(`§6[Campaign] §fYou helped ${player.name} through ${run.chapter.name}: §a${Math.round(xp / 2)} XP§f.`);
    }
  } catch {
    // nobody else
  }
}

/**
 * Advances every chapter in play.
 * @param {number} now
 */
export function tick(now) {
  for (const run of [...runs.values()]) {
    try {
      step(run, now);
    } catch (error) {
      console.warn(`[Overlord] the campaign tick failed: ${error}`);
    }
  }
}

/** @param {Run} run @param {number} now */
function step(run, now) {
  const player = run.player;
  if (!player.isValid) {
    runs.delete(run.playerId);
    clearField(run);
    return;
  }
  if (player.dimension.id !== run.dimension.id || Math.hypot(player.location.x - run.origin.x, player.location.z - run.origin.z) > LEASH) {
    fail(run, "you left the battlefield");
    return;
  }
  if (run.phase === "intro") {
    if (player.isSneaking && run.line > 0) run.line = run.chapter.intro.length; // skip the dialogue
    if (now < run.next) return;
    if (run.line < run.chapter.intro.length) {
      frame(run);
      say(run, run.chapter.intro[run.line++]);
      run.next = now + LINE_TICKS;
      return;
    }
    release(player);
    run.phase = "fight";
    run.stage = 0;
    spawnStage(run, now);
    return;
  }
  if (run.phase === "fight") {
    if (foesOf(run).length > 0) {
      if (now > run.deadline) fail(run, "time ran out");
      else if (run.deadline - now === 60 * TICKS) notify(player, "§c1 minute left for this stage");
      return;
    }
    run.stage += 1;
    if (run.stage < run.chapter.stages.length) {
      spawnStage(run, now);
      return;
    }
    run.phase = "outro";
    run.line = 0;
    run.next = now + 20;
    return;
  }
  // the outro
  if (now < run.next) return;
  if (run.line < run.chapter.outro.length) {
    say(run, run.chapter.outro[run.line++]);
    run.next = now + LINE_TICKS;
    return;
  }
  finish(run);
}

/** Whether a player is playing a chapter. @param {Player} player */
export function inStory(player) {
  return runs.has(player.id);
}

// ---------------------------------------------------------------- the Chronicle

/** @param {Player} player */
export function openChronicle(player) {
  const done = storyOf(profileOf(player));
  const next = nextChapter(player);
  const lines = CHAPTERS.map((c, i) => {
    const mark = done.includes(c.key) ? "§a✔" : c === next ? "§e➤" : "§8•";
    return `${mark} §fChapter ${i + 1}: ${c.name} §7(level ${c.level})`;
  });
  const form = new ActionFormData()
    .title("Chronicle: Rise of the Sorcerer King")
    .body(
      `§7Ten chapters, from a burning village to the throne. Each is played where you stand: allies come, foes arrive in stages, and the last is the chapter's boss. Finish all ten to be crowned and found your kingdom.§r\n\n${lines.join("\n")}` +
        (runs.has(player.id) ? "\n\n§cA chapter is in progress." : "")
    );
  /** @type {(() => void)[]} */
  const actions = [];
  if (runs.has(player.id)) {
    form.button("§cAbandon the chapter");
    actions.push(() => {
      const run = runs.get(player.id);
      if (run) fail(run, "you abandoned it");
    });
  } else if (next) {
    form.button(`§6Begin Chapter ${CHAPTERS.indexOf(next) + 1}\n§r${next.name}`);
    actions.push(() => confirmChapter(player, next));
  }
  const replays = CHAPTERS.filter((c) => done.includes(c.key));
  if (replays.length > 0 && !runs.has(player.id)) {
    form.button(`Replay a chapter (${replays.length})`);
    actions.push(() => openReplays(player));
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

/** @param {Player} player @param {Chapter} chapter */
function confirmChapter(player, chapter) {
  const why = blocked(player, chapter);
  const number = CHAPTERS.indexOf(chapter) + 1;
  const foes = chapter.stages.map((s, i) => `${s.boss ? "§4" : "§c"}${i + 1}. ${s.name}`).join("\n");
  const form = new ActionFormData()
    .title(`Chapter ${number}: ${chapter.name}`)
    .body(
      `§f${chapter.blurb}§r\n\n§7Recommended level ${chapter.level}. Stages:\n${foes}§r\n\n` +
        `§7Reward: ${chapter.reward.xp} XP, ${chapter.reward.coins} Gold Coins, ${chapter.reward.crystals} Data Crystals and more.` +
        (why ? `\n\n§c${why}.` : "\n\nThe battle happens around you, here. Find open ground.")
    )
    .button(why ? "Back" : "§6Begin")
    .button("Back");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      if (response.selection === 0 && !why) notify(player, begin(player, chapter));
      else openChronicle(player);
    })
    .catch(() => {});
}

/** @param {Player} player */
function openReplays(player) {
  const done = storyOf(profileOf(player));
  const replays = CHAPTERS.filter((c) => done.includes(c.key));
  const form = new ActionFormData()
    .title("Replay a chapter")
    .body(`§7Play a finished chapter again for ${Math.round(REPLAY_SHARE * 100)}% of its XP and coins.`);
  for (const c of replays) form.button(`Chapter ${CHAPTERS.indexOf(c) + 1}\n${c.name}`);
  form.button("Back");
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      const chapter = replays[response.selection];
      if (chapter) confirmChapter(player, chapter);
      else openChronicle(player);
    })
    .catch(() => {});
}

/** Marks every chapter finished (the creative tome's shortcut). @param {Player} player */
export function completeStory(player) {
  const done = storyOf(profileOf(player));
  let added = 0;
  for (const c of CHAPTERS) {
    if (done.includes(c.key)) continue;
    done.push(c.key);
    added++;
  }
  touch(player);
  return added;
}

registerMenu(
  (player) => {
    const done = storyOf(profileOf(player)).length;
    return `Chronicle (${Math.min(done, CHAPTERS.length)}/${CHAPTERS.length})\n§8Rise of the Sorcerer King`;
  },
  openChronicle,
  true
);

system.runInterval(() => tick(system.currentTick), 10);

world.afterEvents.entityDie.subscribe((event) => {
  try {
    if (event.deadEntity.typeId !== "minecraft:player") return;
    const run = runs.get(event.deadEntity.id);
    if (run) fail(run, "you fell in battle");
  } catch {
    // nothing to do
  }
});

world.afterEvents.playerLeave.subscribe((event) => {
  const run = runs.get(event.playerId);
  if (!run) return;
  runs.delete(event.playerId);
  clearField(run);
});
