// Overlord: Tomb of Nazarick - sagas: the named people of the New World talk with you and ask for your help.
//
// Six of them have a saga, a chain of three tasks that tells a small story: Gazef Stronoff, Enri Emmot,
// Nfirea Bareare, Lakyus Alvein Dale Aindra, Zaryusu Shasha and Pinison Pole Perlia. Talking to them opens a
// conversation: ask about the things they care about, offer a gift they like, and take up or report on
// their task. Gazef, Lakyus and Zaryusu are spoken to directly; Enri, Nfirea and Pinison trade when spoken to,
// so to talk to them you sneak as you do.
//
// Tasks ask you to slay some foe, bring something, visit a place, or defeat a great enemy. Each one done
// raises the teller's affinity; asking about their life and bringing gifts raise it too. As a Friend they give
// you something each day; as a Sworn Ally they bless you each day as well. The last task of each saga is
// rewarded with a keepsake that only they can give - worn in the off hand (comforts.js) - and its title.
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { creditedPlayer, giveItem, grantXp, notify, profileOf, registerMenu, restoreMana, touch } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import { campAt } from "./structures.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const mc = (/** @type {string} */ name) => `minecraft:${name}`;
const TICKS = 20;
const COIN = id("yggdrasil_gold_coin");

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/**
 * @typedef {{ kind: "kill", types: string[], count: number }
 *   | { kind: "bring", item: string, count: number }
 *   | { kind: "visit", site: string }} Goal
 * @typedef {{ title: string, ask: string, done: string, goal: Goal, label: string, coins: number, xp: number, items: [string, number][] }} Step
 * @typedef {{
 *   key: string, type: string, name: string, saga: string, sneak: boolean, element: string,
 *   greet: [string, string, string, string], topics: [string, string][],
 *   likes: [string, number, string], daily: [string, number, string], blessing: [string, number, number, string],
 *   keepsake: string, steps: [Step, Step, Step],
 * }} Saga
 * @typedef {{ step: number, active: boolean, progress: number, affinity: number, topics: number[], gift: number, daily: number }} Record_
 */

/** Affinity thresholds: [at least, name]. */
export const TIERS = /** @type {[number, string][]} */ ([[0, "Stranger"], [15, "Acquaintance"], [40, "Friend"], [75, "Sworn Ally"]]);
export const FRIEND = 40;
export const SWORN = 75;
const STEP_AFFINITY = 15;
const TOPIC_AFFINITY = 3;
const GIFT_AFFINITY = 5;

/** @type {Saga[]} */
export const SAGAS = [
  {
    key: "gazef", type: id("gazef"), name: "Gazef Stronoff", saga: "The Warrior-Captain", sneak: false, element: "holy",
    greet: [
      "I am Gazef Stronoff, Warrior-Captain of the Kingdom. State your business.",
      "Ah, you again. The roads are a little safer with you on them.",
      "Friend! Sit, if you have the time. A soldier rarely gets to talk.",
      "Whatever you are, you have my sword. That is not a thing I say lightly.",
    ],
    topics: [
      ["Ask about the King", "His Majesty is old and his court is full of vultures. I serve him anyway. Someone must."],
      ["Ask about his sword", "Razor Edge cuts through armour as if it were cloth. A treasure of the crown - lent, not given."],
      ["Ask about Carne Village", "I owe that village, and the masked magic caster who saved it, more than I can repay."],
    ],
    likes: [mc("iron_ingot"), 4, "4 Iron Ingots"], daily: [mc("iron_ingot"), 3, "3 Iron Ingots"],
    blessing: ["strength", 300, 0, "Gazef claps your shoulder: §cStrength§f for 5 minutes"],
    keepsake: id("warrior_captains_sigil"),
    steps: [
      { title: "Bandits on the King's Road", ask: "Bandits prey on the roads between the villages. My men are spread thin. Cut down eight of them.",
        done: "Eight fewer cutthroats. The merchants will sleep easier.", goal: { kind: "kill", types: [id("bandit")], count: 8 }, label: "Bandits slain",
        coins: 20, xp: 800, items: [[id("red_potion"), 2]] },
      { title: "Smoke on the Horizon", ask: "Scouts saw strange banners in the hills - the Slane Theocracy's Sunlight Scripture. Find their camp and tell me what you see.",
        done: "Angels and Theocracy priests on Kingdom soil... So they truly mean to see me dead.", goal: { kind: "visit", site: "theocracy_camp" }, label: "Find the Sunlight Scripture's camp",
        coins: 30, xp: 1200, items: [[id("refining_stone"), 2]] },
      { title: "The Sunlight Scripture", ask: "Their commander, Nigun Grid Luin, leads the hunt. I cannot reach him with my men. Can you?",
        done: "Nigun is beaten? Then I owe you my life as surely as I owe it to the man in the mask. Take this - my sigil. Any soldier of the Kingdom will know it.",
        goal: { kind: "kill", types: [id("nigun")], count: 1 }, label: "Defeat Nigun Grid Luin",
        coins: 60, xp: 2500, items: [[id("guardian_crest"), 1]] },
    ],
  },
  {
    key: "enri", type: id("enri"), name: "Enri Emmot", saga: "The Village of Carne", sneak: true, element: "acid",
    greet: [
      "Oh! A visitor. Welcome to Carne. Please, mind the goblins - they are friendly.",
      "Hello again! Nemu keeps asking when you'll come back.",
      "You're always welcome at our table. Carne doesn't forget its friends.",
      "General Enri of Carne, at your service - or so the goblins insist. For you, just Enri.",
    ],
    topics: [
      ["Ask about the goblins", "Ainz-sama's horn called them. Now they farm, they fight and they call me General. I still blush."],
      ["Ask about Nfirea", "Nfirea? He... he's an old friend. A good one. Why are you smiling like that?"],
      ["Ask about the attack", "Knights burned half the village. Then the masked caster came. I will never forget that day."],
    ],
    likes: [mc("bread"), 6, "6 Bread"], daily: [mc("bread"), 4, "4 Bread"],
    blessing: ["regeneration", 60, 0, "Enri presses a warm loaf into your hands: §aRegeneration§f for a minute"],
    keepsake: id("carne_charm"),
    steps: [
      { title: "Ogres of the Tob Forest", ask: "Ogres have been coming out of the Great Forest of Tob and stealing our sheep. Could you drive off four of them?",
        done: "Four ogres! The goblins are already singing about it. Badly, but they are singing.", goal: { kind: "kill", types: [id("ogre")], count: 4 }, label: "Ogres slain",
        coins: 15, xp: 700, items: [[mc("bread"), 6]] },
      { title: "The Harvest", ask: "Half our fields burned in the attack. If you could bring us sixteen sheaves of wheat, we could last the winter.",
        done: "Sixteen sheaves! Nemu, come and see! Thank you - truly.", goal: { kind: "bring", item: mc("wheat"), count: 16 }, label: "Wheat for the village",
        coins: 20, xp: 900, items: [[id("goblin_horn"), 1]] },
      { title: "The Troll of the East", ask: "Go Gin, the troll they call the Giant of the East, has started raiding the forest edge. The goblins are brave, but not that brave.",
        done: "Go Gin is gone? Then Carne is safe. Please, take this charm - every family in the village put a thread in it.",
        goal: { kind: "kill", types: [id("go_gin")], count: 1 }, label: "Defeat Go Gin",
        coins: 50, xp: 2200, items: [[id("feast_pie"), 2]] },
    ],
  },
  {
    key: "nfirea", type: id("nfirea"), name: "Nfirea Bareare", saga: "The Bareare Apothecary", sneak: true, element: "arcane",
    greet: [
      "Potions? Herbs? Oh - you want to talk. Sorry, I was thinking about a recipe.",
      "Welcome back! I've nearly worked out the blue potion. Nearly.",
      "Ah, my favourite customer! Come, see what's bubbling.",
      "If grandmother could see us now... You've done more for my work than any guild.",
    ],
    topics: [
      ["Ask about the blue potion", "A true potion of healing is blue - the colour of the gods' own. Ainz-sama showed me one. I've been chasing it since."],
      ["Ask about his talent", "I can use any magic item, even ones meant for other races. People have tried to kidnap me for it. Twice."],
      ["Ask about Enri", "E-Enri? What about her? She's... she's doing well. Very well. Why?"],
    ],
    likes: [mc("glistering_melon_slice"), 2, "2 Glistering Melon Slices"], daily: [id("blue_potion"), 1, "a Blue Potion"],
    blessing: ["regeneration", 30, 1, "Nfirea hands you a tonic: §aRegeneration II§f and mana restored"],
    keepsake: id("bareare_ring"),
    steps: [
      { title: "Nether Wart for the Cauldron", ask: "The new recipe wants nether wart - eight of them. I would go myself, but... the Nether.",
        done: "Perfect specimens! The brew is already turning violet.", goal: { kind: "bring", item: mc("nether_wart"), count: 8 }, label: "Nether wart for Nfirea",
        coins: 15, xp: 700, items: [[id("blue_potion"), 2]] },
      { title: "Herbs of the Dryad's Spring", ask: "They say a dryad tends a spring where the rarest herbs grow. Find it and tell me where it lies.",
        done: "A dryad! Then the herbs must be real. I'll have to bring Enri. For... safety.", goal: { kind: "visit", site: "dryad_spring" }, label: "Find the Dryad's Spring",
        coins: 25, xp: 1100, items: [[id("refining_stone"), 2]] },
      { title: "Bone Dust of the Katze Plains", ask: "The last ingredient is ghoul bone, ground fine. Ten ghouls should do it. I'm sorry - it's grim work.",
        done: "It's... blue. It's blue! Grandmother! Here - this ring was hers. It's yours now; it'll keep your mana flowing.",
        goal: { kind: "kill", types: [id("ghoul")], count: 10 }, label: "Ghouls slain",
        coins: 45, xp: 2200, items: [[id("blue_potion"), 4]] },
    ],
  },
  {
    key: "lakyus", type: id("lakyus"), name: "Lakyus Alvein Dale Aindra", saga: "The Blue Rose", sneak: false, element: "dark",
    greet: [
      "Blue Rose, adamantite rank. If you're here for an autograph, Gagaran will have words with you.",
      "You again. Evileye says you're 'tolerable'. That's high praise from her.",
      "Good to see you. Blue Rose could use someone like you on the hard jobs.",
      "You're one of us now, whatever your plate says. Blue Rose doesn't forget.",
    ],
    topics: [
      ["Ask about Kilineyram", "My sword drinks darkness. Sometimes I hear it whisper. I tell people I'm joking about that."],
      ["Ask about Blue Rose", "Gagaran, Evileye, Tia and Tina. The strongest adventurers in the Kingdom - and the loudest."],
      ["Ask about Princess Renner", "Renner is my dearest friend. She sees things no one else does. Sometimes that frightens me."],
    ],
    likes: [mc("diamond"), 1, "a Diamond"], daily: [COIN, 10, "10 Gold Coins"],
    blessing: ["resistance", 300, 0, "Lakyus prays over you: §9Resistance§f for 5 minutes"],
    keepsake: id("blue_rose_brooch"),
    steps: [
      { title: "A Gate to Hell", ask: "There are reports of a demon gate torn open in the wilds. Find it, and don't go in.",
        done: "So it's true. If a gate stands open, something bigger is coming through.", goal: { kind: "visit", site: "demon_gate" }, label: "Find a Demon Gate",
        coins: 20, xp: 900, items: [[id("red_potion"), 3]] },
      { title: "Hounds of the Pit", ask: "Hellhounds are spilling out of the gates and hunting travellers. Six of them, and the roads will breathe.",
        done: "Six hellhounds. Gagaran owes me a drink - she said you'd stop at four.", goal: { kind: "kill", types: [id("hellhound")], count: 6 }, label: "Hellhounds slain",
        coins: 30, xp: 1300, items: [[id("refining_stone"), 2]] },
      { title: "The Evil Lord", ask: "Behind the gates stands an Evil Lord - Wrath. Blue Rose couldn't take it alone. Together, perhaps.",
        done: "It's dead. It's really dead. Take this brooch - every member of Blue Rose wears one. Now so do you.",
        goal: { kind: "kill", types: [id("evil_lord_wrath")], count: 1 }, label: "Defeat Evil Lord Wrath",
        coins: 70, xp: 2800, items: [[id("guardian_crest"), 1]] },
    ],
  },
  {
    key: "zaryusu", type: id("zaryusu"), name: "Zaryusu Shasha", saga: "The Four Tribes", sneak: false, element: "ice",
    greet: [
      "A traveller in the marsh? Speak carefully. The tribes remember the last outsiders.",
      "You return. Crusch said you would. She is rarely wrong.",
      "Welcome, friend of the Green Claw. The fish are good this season.",
      "Brother of the tribes. Our swamp is your home whenever you need one.",
    ],
    topics: [
      ["Ask about Frost Pain", "One of the four treasures of the tribes. Its blade is never warm. I carry it for those who fell."],
      ["Ask about Crusch", "Crusch Lulu of the Red Eye. She is... the reason I fight. Do not tell her I said that."],
      ["Ask about the war", "We fought the undead of Nazarick and lost. Now we live under its protection. Strange, how the world turns."],
    ],
    likes: [mc("cod"), 6, "6 Cod"], daily: [id("red_potion"), 2, "2 Red Potions"],
    blessing: ["speed", 300, 0, "Zaryusu teaches you the marsh-stride: §bSpeed§f for 5 minutes"],
    keepsake: id("four_tribes_ring"),
    steps: [
      { title: "The Village in the Reeds", ask: "If you wish to help the tribes, first see how we live. Visit one of our villages.",
        done: "You have seen our homes. Now you understand what we protect.", goal: { kind: "visit", site: "lizardman_village" }, label: "Visit a Lizardman Village",
        coins: 15, xp: 700, items: [[mc("cod"), 6]] },
      { title: "Fish for the Lean Season", ask: "The fish farms failed this year. Ten cod would feed a family until the waters recover.",
        done: "Ten cod. The little ones will eat tonight. You have my thanks, and theirs.", goal: { kind: "bring", item: mc("cod"), count: 10 }, label: "Cod for the tribes",
        coins: 20, xp: 900, items: [[id("refining_stone"), 2]] },
      { title: "The Basilisk in the Marsh", ask: "A gigant basilisk has made the deep marsh its hunting ground. Its gaze turns our hunters to stone. End it.",
        done: "The basilisk is dead! The four tribes owe you a debt. Wear this ring - one stone from each tribe. In water, you will breathe as we do.",
        goal: { kind: "kill", types: [id("gigant_basilisk")], count: 1 }, label: "Defeat the Gigant Basilisk",
        coins: 55, xp: 2400, items: [[id("frost_pain"), 1]] },
    ],
  },
  {
    key: "pinison", type: id("pinison"), name: "Pinison Pole Perlia", saga: "The Dryad's Promise", sneak: true, element: "acid",
    greet: [
      "Ooh, a visitor! Do you like trees? Everyone should like trees.",
      "You're back! The saplings remember your footsteps, you know.",
      "Friend! Sit in the shade with me. The shade here is the best shade.",
      "The forest sings when you walk in it now. I made sure of it.",
    ],
    topics: [
      ["Ask about the Destroyer Tree", "Zy'tl Q'ae sleeps in the deep forest. When it wakes, it eats the forest. I've been waiting a very long time for someone to stop it."],
      ["Ask about her tree", "My tree is my home and my heart. If it dies, I die. So please don't cut it down. Please."],
      ["Ask about the forest", "Elves, treants, the twins of Nazarick... the forest has had a lot of visitors lately. Most of them step on things."],
    ],
    likes: [mc("bone_meal"), 8, "8 Bone Meal"], daily: [mc("golden_apple"), 1, "a Golden Apple"],
    blessing: ["health_boost", 300, 1, "Pinison weaves a garland for you: §a+4 hearts§f for 5 minutes"],
    keepsake: id("dryad_blossom"),
    steps: [
      { title: "Where the Destroyer Sleeps", ask: "Will you look upon the Destroyer Tree's grove? Just look! Don't touch anything!",
        done: "You saw it... it's waking, isn't it? I can feel it in my roots.", goal: { kind: "visit", site: "destroyer_grove" }, label: "Find the Destroyer Tree's Grove",
        coins: 15, xp: 800, items: [[mc("bone_meal"), 8]] },
      { title: "The Restless Saplings", ask: "Its saplings are wandering out of the grove and choking the other trees. Six of them, please - gently. Well, not gently.",
        done: "Six! The old oaks can breathe again. Thank you, thank you!", goal: { kind: "kill", types: [id("treant_sapling")], count: 6 }, label: "Treant saplings felled",
        coins: 25, xp: 1200, items: [[id("heartwood"), 2]] },
      { title: "The Fall of Zy'tl Q'ae", ask: "It's awake. Zy'tl Q'ae is awake. If it isn't stopped, there won't be a forest left. Please.",
        done: "The forest is safe... I promised I'd give my blossom to whoever saved it. Here. Stand on grass and it'll heal you, the way it heals me.",
        goal: { kind: "kill", types: [id("zytl_qae")], count: 1 }, label: "Defeat Zy'tl Q'ae",
        coins: 80, xp: 3000, items: [[id("heartwood"), 4]] },
    ],
  },
];

/** @type {Record<string, Saga>} */
export const BY_TYPE = Object.fromEntries(SAGAS.map((s) => [s.type, s]));
/** @type {Record<string, Saga>} */
export const BY_KEY = Object.fromEntries(SAGAS.map((s) => [s.key, s]));

// ------------------------------------------------------------------ records

/** Today's number, for things that happen once a day. */
export function today() {
  try {
    return world.getDay();
  } catch {
    return Math.floor(system.currentTick / 24000);
  }
}

/** A player's record with one teller, made on first use. @param {Player} player @param {string} key @returns {Record_} */
export function recordOf(player, key) {
  const p = profileOf(player);
  if (!p.sagas || typeof p.sagas !== "object") p.sagas = {};
  const all = /** @type {Record<string, Record_>} */ (p.sagas);
  const r = all[key] ?? { step: 0, active: false, progress: 0, affinity: 0, topics: [], gift: -1, daily: -1 };
  if (!Array.isArray(r.topics)) r.topics = [];
  all[key] = r;
  return r;
}

/** The name of an affinity. @param {number} affinity */
export function tierOf(affinity) {
  let name = TIERS[0][1];
  for (const [at, tier] of TIERS) if (affinity >= at) name = tier;
  return name;
}

/** Raises affinity, and says so when it crosses into a new tier. @param {Player} player @param {Saga} saga @param {number} amount */
export function befriend(player, saga, amount) {
  const r = recordOf(player, saga.key);
  const before = tierOf(r.affinity);
  r.affinity = Math.min(100, r.affinity + amount);
  const after = tierOf(r.affinity);
  if (after !== before) {
    notify(player, `§d${saga.name} now counts you a §f${after}§d.`);
    if (after === "Friend") player.sendMessage(`§d[Saga] §f${saga.name} will give you §e${saga.daily[2]}§f each day you visit.`);
    if (after === "Sworn Ally") player.sendMessage(`§d[Saga] §f${saga.name} will bless you each day you visit.`);
  }
  touch(player);
  return r.affinity;
}

/** How many sagas a player has finished. @param {Player} player */
export function finished(player) {
  return SAGAS.filter((s) => recordOf(player, s.key).step >= s.steps.length).length;
}

/** How many tellers count a player a Sworn Ally. @param {Player} player */
export function sworn(player) {
  return SAGAS.filter((s) => recordOf(player, s.key).affinity >= SWORN).length;
}

/** The current step of a saga, if any remains. @param {Saga} saga @param {Record_} r */
export function stepOf(saga, r) {
  return r.step < saga.steps.length ? saga.steps[r.step] : undefined;
}

/** How far along the current step is, as text. @param {Player} player @param {Saga} saga */
export function progressText(player, saga) {
  const r = recordOf(player, saga.key);
  const step = stepOf(saga, r);
  if (!step) return "§aComplete";
  if (!r.active) return "§7Not yet taken up";
  const g = step.goal;
  if (g.kind === "kill") return `${step.label}: ${Math.min(r.progress, g.count)}/${g.count}`;
  if (g.kind === "bring") return `${step.label}: ${Math.min(countItem(player, g.item), g.count)}/${g.count} carried`;
  return `${step.label}: ${r.progress > 0 ? "§afound" : "§7not yet found"}`;
}

/** Whether the current step is ready to report. @param {Player} player @param {Saga} saga */
export function ready(player, saga) {
  const r = recordOf(player, saga.key);
  const step = stepOf(saga, r);
  if (!step || !r.active) return false;
  const g = step.goal;
  if (g.kind === "kill") return r.progress >= g.count;
  if (g.kind === "bring") return countItem(player, g.item) >= g.count;
  return r.progress > 0;
}

// ------------------------------------------------------------------ the conversation

/** Takes up the current step. Returns a message. @param {Player} player @param {Saga} saga */
export function accept(player, saga) {
  const r = recordOf(player, saga.key);
  const step = stepOf(saga, r);
  if (!step) return `§7${saga.name} has nothing more to ask of you`;
  if (r.active) return `§7You are already on "${step.title}"`;
  r.active = true;
  r.progress = 0;
  touch(player);
  return `§e[Saga] §f${saga.saga}: §6${step.title}§f - ${step.label.toLowerCase()}.`;
}

/** Reports on the current step: done, it is rewarded and the next one opens. Returns a message. @param {Player} player @param {Saga} saga */
export function report(player, saga) {
  const r = recordOf(player, saga.key);
  const step = stepOf(saga, r);
  if (!step || !r.active) return `§7There is nothing to report to ${saga.name}`;
  if (!ready(player, saga)) return `§7${progressText(player, saga)}`;
  if (step.goal.kind === "bring") takeItem(player, step.goal.item, step.goal.count);
  r.active = false;
  r.progress = 0;
  r.step += 1;
  giveItem(player, COIN, step.coins);
  for (const [item, n] of step.items) giveItem(player, item, n);
  grantXp(player, step.xp, saga.saga);
  befriend(player, saga, STEP_AFFINITY);
  const last = r.step >= saga.steps.length;
  if (last) {
    giveItem(player, saga.keepsake, 1);
    world.sendMessage(`§d[Saga] §6${player.name}§f has completed §e${saga.saga}§f for ${saga.name}.`);
  }
  try {
    fx.rise(player.dimension, player.location, saga.element, 0.8);
  } catch {
    // no room for sparkle
  }
  touch(player);
  player.sendMessage(`§e<${saga.name}>§f ${step.done}`);
  return `§e[Saga] §f"${step.title}" done: §6${step.coins} Gold Coins§f${last ? ", §dand a keepsake§f" : ""}.`;
}

/** Asks about a topic: the answer, and a little affinity the first time. @param {Player} player @param {Saga} saga @param {number} index */
export function ask(player, saga, index) {
  const topic = saga.topics[index];
  if (!topic) return "";
  const r = recordOf(player, saga.key);
  if (!r.topics.includes(index)) {
    r.topics.push(index);
    befriend(player, saga, TOPIC_AFFINITY);
  }
  return topic[1];
}

/** Offers the gift they like, once a day. Returns a message. @param {Player} player @param {Saga} saga */
export function gift(player, saga) {
  const r = recordOf(player, saga.key);
  if (r.gift === today()) return `§7${saga.name} has had a gift from you today`;
  const [item, n, what] = saga.likes;
  if (countItem(player, item) < n) return `§7${saga.name} would love ${what}`;
  takeItem(player, item, n);
  r.gift = today();
  befriend(player, saga, GIFT_AFFINITY);
  return `§d${saga.name} is delighted with ${what}.`;
}

/** The day's gift and blessing for a Friend or Sworn Ally, given when they talk. Returns what was given. @param {Player} player @param {Saga} saga */
export function greet(player, saga) {
  const r = recordOf(player, saga.key);
  if (r.affinity < FRIEND || r.daily === today()) return "";
  r.daily = today();
  const [item, n, what] = saga.daily;
  giveItem(player, item, n);
  let text = `§d${saga.name} gives you ${what}.`;
  if (r.affinity >= SWORN) {
    const [effect, seconds, amplifier, line] = saga.blessing;
    try {
      player.addEffect(effect, seconds * TICKS, { amplifier, showParticles: false });
    } catch {
      // no such effect here
    }
    if (saga.key === "nfirea") restoreMana(player, 50);
    text += ` §f${line}`;
  }
  touch(player);
  return text;
}

/** What they say first, by how well they know you. @param {Player} player @param {Saga} saga */
export function greeting(player, saga) {
  const a = recordOf(player, saga.key).affinity;
  return saga.greet[a >= SWORN ? 3 : a >= FRIEND ? 2 : a >= 15 ? 1 : 0];
}

/** Opens the conversation. @param {Player} player @param {Saga} saga */
export function talk(player, saga) {
  const given = greet(player, saga);
  if (given) player.sendMessage(given);
  const r = recordOf(player, saga.key);
  const step = stepOf(saga, r);
  /** @type {(() => void)[]} */
  const choices = [];
  const form = new ActionFormData().title(saga.name);
  form.body(`§f${greeting(player, saga)}\n\n§dAffinity: §f${tierOf(r.affinity)} §7(${r.affinity}/100)\n§e${saga.saga}: §f${step ? `${r.step + 1}/3 - ${step.title}` : "§acomplete"}${r.active ? `\n§7${progressText(player, saga)}` : ""}`);
  if (step && !r.active) {
    form.button(`§6Saga: ${step.title}`);
    choices.push(() => offer(player, saga));
  } else if (step) {
    form.button(ready(player, saga) ? `§aReport: ${step.title}` : `§7${step.title}`);
    choices.push(() => notify(player, report(player, saga)));
  }
  saga.topics.forEach(([label], i) => {
    form.button(`${r.topics.includes(i) ? "§7" : "§f"}${label}`);
    choices.push(() => reply(player, saga, ask(player, saga, i)));
  });
  form.button(`§dOffer a gift §7(${saga.likes[2]})`);
  choices.push(() => notify(player, gift(player, saga)));
  form.button("Farewell");
  choices.push(() => {});
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      choices[response.selection]?.();
    })
    .catch(() => {});
}

/** Their answer, with a way back. @param {Player} player @param {Saga} saga @param {string} text */
function reply(player, saga, text) {
  new ActionFormData()
    .title(saga.name)
    .body(text)
    .button("Back")
    .button("Farewell")
    .show(player)
    .then((response) => {
      if (!response.canceled && response.selection === 0 && player.isValid) talk(player, saga);
    })
    .catch(() => {});
}

/** The current task, asked: take it up or not. @param {Player} player @param {Saga} saga */
function offer(player, saga) {
  const step = stepOf(saga, recordOf(player, saga.key));
  if (!step) return;
  new ActionFormData()
    .title(step.title)
    .body(`§f${step.ask}\n\n§eReward: §6${step.coins} Gold Coins§f, §b${step.xp} XP${step.items.length > 0 ? "§f, and more" : ""}`)
    .button("§aI'll do it")
    .button("Not now")
    .show(player)
    .then((response) => {
      if (!response.canceled && response.selection === 0 && player.isValid) notify(player, accept(player, saga));
    })
    .catch(() => {});
}

/** The journal of every saga. @param {Player} player */
export function openSagas(player) {
  const lines = SAGAS.map((s) => {
    const r = recordOf(player, s.key);
    return `§e${s.saga} §7- ${s.name}${s.sneak ? " §8(sneak to talk)" : ""}\n  §d${tierOf(r.affinity)} §7(${r.affinity})  §f${r.step >= 3 ? "§acomplete" : `step ${r.step + 1}/3: ${progressText(player, s)}`}`;
  });
  new ActionFormData()
    .title("Sagas of the New World")
    .body(`${lines.join("\n")}\n\n§7Find them in their villages and camps, and talk to them.`)
    .button("Close")
    .show(player)
    .catch(() => {});
}

// ------------------------------------------------------------------ deeds

/** A kill counts towards every active kill step it fits. Returns the sagas it moved. @param {Player} player @param {string} typeId */
export function credit(player, typeId) {
  const moved = [];
  for (const saga of SAGAS) {
    const r = recordOf(player, saga.key);
    const step = stepOf(saga, r);
    if (!step || !r.active || step.goal.kind !== "kill" || !step.goal.types.includes(typeId)) continue;
    if (r.progress >= step.goal.count) continue;
    r.progress += 1;
    moved.push(saga.key);
    notify(player, r.progress >= step.goal.count ? `§a[Saga] ${step.title}: done - return to ${saga.name}` : `§e[Saga] ${step.label}: ${r.progress}/${step.goal.count}`);
  }
  if (moved.length > 0) touch(player);
  return moved;
}

/** Standing at a site counts towards every active visit step for it. @param {Player} player @param {string} site */
export function visit(player, site) {
  const moved = [];
  for (const saga of SAGAS) {
    const r = recordOf(player, saga.key);
    const step = stepOf(saga, r);
    if (!step || !r.active || step.goal.kind !== "visit" || step.goal.site !== site || r.progress > 0) continue;
    r.progress = 1;
    moved.push(saga.key);
    notify(player, `§a[Saga] ${step.title}: found - return to ${saga.name}`);
  }
  if (moved.length > 0) touch(player);
  return moved;
}

/** Who has been told, this session, how to talk to a trader. */
const hinted = new Set();

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const saga = BY_TYPE[event.target.typeId];
  if (!saga) return;
  const player = event.player;
  if (saga.sneak && !player.isSneaking) {
    const key = `${player.id}|${saga.key}`;
    if (!hinted.has(key)) {
      hinted.add(key);
      system.run(() => {
        if (player.isValid) notify(player, `§7Sneak as you talk to ${saga.name.split(" ")[0]} to hear their saga`);
      });
    }
    return;
  }
  event.cancel = true; // a conversation, not a trade
  system.run(() => {
    try {
      if (player.isValid) talk(player, saga);
    } catch (error) {
      console.warn(`[Overlord] a conversation failed: ${error}`);
    }
  });
});

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const player = creditedPlayer(event.damageSource?.damagingEntity);
    if (player) credit(player, event.deadEntity.typeId);
  } catch {
    // the corpse is gone
  }
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      if (player.dimension.id !== "minecraft:overworld") continue;
      const camp = campAt(player.location);
      if (!camp) continue;
      if (Math.hypot(player.location.x - camp.x, player.location.z - camp.z) > camp.type.radius + 4) continue;
      visit(player, camp.type.key);
    } catch {
      // the player is changing dimension
    }
  }
}, 2 * TICKS);

registerMenu((player) => `Sagas (${finished(player)}/${SAGAS.length} complete)\n§8Gazef, Enri, Nfirea, Lakyus, Zaryusu, Pinison`, openSagas);
