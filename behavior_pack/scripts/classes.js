// Overlord: Tomb of Nazarick - the companions' classes (v11).
//
// Eight vocations. Each teaches three core arts (levels 1, 10, 20); at level 30 a companion takes one of two paths
// (arts at 30, 40 and 50), and at level 60 one of that path's two masteries (arts at 60, 70, 80, 90 and a capstone
// at 100). A new art every ten levels, thirty-two classes in all. Arts are data: a kind (how it works, arts.js)
// and its numbers. The thirty-six arts of the old party keep their keys and their hand-made effects (party.js).
//
// Looks: the twelve old looks keep their numbers (two men per old vocation); twenty more follow, women for every
// vocation and the Monks and Necromancers. A look belongs to one vocation.

/** @typedef {"m" | "f"} Sex */
/** @typedef {{ name: string, voc: number, sex: Sex }} Look */
/**
 * @typedef {{ key: string, name: string, at: number, cd: number, kind: string, help: string, urgent?: boolean,
 *   [param: string]: any }} Art
 * @typedef {{ key: string, name: string, help: string, role?: string, arts: Art[] }} Mastery
 * @typedef {{ key: string, name: string, help: string, role?: string, arts: Art[], masteries: [Mastery, Mastery] }} Branch
 * @typedef {{ key: string, name: string, role: string, element: string, blurb: string, core: Art[], branches: [Branch, Branch] }} Vocation
 */

export const BRANCH_AT = 30;
export const MASTERY_AT = 60;
export const TOP_LEVEL = 100;

/** Every look a companion can take. Index = look number (saved with the member). */
/** @type {Look[]} */
export const LOOKS = [
  { name: "Knight", voc: 0, sex: "m" }, { name: "Swordsman", voc: 0, sex: "m" },
  { name: "Ranger", voc: 1, sex: "m" }, { name: "Hunter", voc: 1, sex: "m" },
  { name: "Sorcerer", voc: 2, sex: "m" }, { name: "Wizard", voc: 2, sex: "m" },
  { name: "Priest", voc: 3, sex: "m" }, { name: "Acolyte", voc: 3, sex: "m" },
  { name: "Assassin", voc: 4, sex: "m" }, { name: "Thief", voc: 4, sex: "m" },
  { name: "Minstrel", voc: 5, sex: "m" }, { name: "Skald", voc: 5, sex: "m" },
  // v11: women of every old vocation
  { name: "Valkyrie", voc: 0, sex: "f" }, { name: "Shieldmaiden", voc: 0, sex: "f" },
  { name: "Huntress", voc: 1, sex: "f" }, { name: "Windrunner", voc: 1, sex: "f" },
  { name: "Witch", voc: 2, sex: "f" }, { name: "Enchantress", voc: 2, sex: "f" },
  { name: "Priestess", voc: 3, sex: "f" }, { name: "Battle Sister", voc: 3, sex: "f" },
  { name: "Shadow Dancer", voc: 4, sex: "f" }, { name: "Nightblade", voc: 4, sex: "f" },
  { name: "Songstress", voc: 5, sex: "f" }, { name: "Blade Dancer", voc: 5, sex: "f" },
  // v11: the Monks and the Necromancers
  { name: "Martial Monk", voc: 6, sex: "m" }, { name: "Ascetic", voc: 6, sex: "m" },
  { name: "Wind Disciple", voc: 6, sex: "f" }, { name: "Lotus Fist", voc: 6, sex: "f" },
  { name: "Necromancer", voc: 7, sex: "m" }, { name: "Bone Sage", voc: 7, sex: "m" },
  { name: "Death Witch", voc: 7, sex: "f" }, { name: "Grave Maiden", voc: 7, sex: "f" },
];

/** The looks of one vocation. @param {number} voc */
export function looksOf(voc) {
  return LOOKS.map((look, index) => ({ ...look, index })).filter((look) => look.voc === voc);
}

/**
 * One art. `kind` and the remaining fields go to arts.js; `dmg` is [base, per level].
 * @param {string} key @param {string} name @param {number} at @param {number} cd @param {string} kind
 * @param {Record<string, any>} params @param {string} help
 * @returns {Art}
 */
const A = (key, name, at, cd, kind, params, help) => ({ key, name, at, cd, kind, help, ...params });
/** One of the old party's hand-made arts, now learned at a new level. @param {string} key @param {number} at */
const OLD = (key, at) => ({ key, at, kind: "legacy", name: "", cd: 0, help: "" });

/** @type {Vocation[]} */
export const VOCATIONS = [
  // ===================================================================================== Fighter
  {
    key: "fighter", name: "Fighter", role: "front", element: "none",
    blurb: "Plate, shield and blade: holds the line and keeps the foe off you.",
    core: [OLD("bash", 1), OLD("cleave", 10), OLD("taunt", 20)],
    branches: [
      {
        key: "knight", name: "Knight", role: "front", help: "the shield of the party: draws foes and shelters everyone",
        arts: [OLD("cry", 30),
          A("shield_wall", "Shield Wall", 40, 30, "buff", { effects: [["resistance", 8, 0]], party: true, combat: true, urgent: true }, "Resistance for the whole party in battle"),
          A("bulwark", "Bulwark Charge", 50, 14, "dash", { dmg: [8, 0.3], radius: 3, effects: [["slowness", 2, 2]], stagger: 2 }, "charges the foe nearest you and throws it back")],
        masteries: [
          {
            key: "paladin", name: "Paladin", help: "a holy knight who heals as it fights",
            arts: [
              A("holy_slam", "Holy Slam", 60, 14, "nova", { dmg: [12, 0.35], radius: 4, on: "self", el: "holy", heal: 6 }, "smites every foe around it and heals the party"),
              A("faith_aegis", "Aegis of Faith", 70, 40, "shield", { amp: 2, sec: 15, party: true, urgent: true }, "a holy shield over the whole party"),
              A("judgement", "Judgement", 80, 12, "bolt", { dmg: [18, 0.4], el: "holy", undead: 2 }, "a pillar of judgement, doubly cruel to the undead"),
              A("consecrate", "Consecration", 90, 30, "aura", { sec: 8, radius: 5, dmg: [4, 0.08], heal: 2, el: "holy" }, "hallowed ground: burns foes and mends friends for eight seconds"),
              A("divine_bastion", "Divine Bastion", 100, 90, "combo", { urgent: true, parts: [{ kind: "taunt", radius: 12 }, { kind: "buff", effects: [["resistance", 10, 2]], party: true }, { kind: "heal", amount: [20, 0.2], party: true }] }, "draws every foe, and the party stands nearly unbreakable")],
          },
          {
            key: "dark_knight", name: "Dark Knight", help: "Nazarick's own: feeds on the life it takes",
            arts: [
              A("soul_drain", "Soul Drain", 60, 10, "strike", { dmg: [12, 0.35], el: "dark", drain: 0.5 }, "a blow that heals it by half the harm done"),
              A("shadow_chains", "Shadow Chains", 70, 22, "afflict", { radius: 5, effects: [["slowness", 4, 4], ["weakness", 6, 1]], el: "dark" }, "chains of shadow bind every foe near the target"),
              A("dread_aura", "Aura of Dread", 80, 30, "aura", { sec: 10, radius: 6, effects: [["weakness", 2, 1], ["slowness", 2, 0]], el: "dark" }, "foes near it are weakened and slowed for ten seconds"),
              A("abyssal_rend", "Abyssal Rend", 90, 16, "cleave", { dmg: [20, 0.45], radius: 4.5, el: "dark", drain: 0.2 }, "a sweep of darkness that drinks from every foe it cuts"),
              A("undying", "Undying Rage", 100, 120, "combo", { urgent: true, low: 0.35, parts: [{ kind: "heal", self: true, amount: [40, 0.4] }, { kind: "buff", self: true, effects: [["strength", 12, 2], ["resistance", 12, 1]] }, { kind: "cleave", dmg: [16, 0.4], radius: 5, el: "dark" }] }, "near death, rises in fury: healed, stronger and harder to kill")],
          },
        ],
      },
      {
        key: "berserker", name: "Berserker", role: "front", help: "the axe of the party: harm above all",
        arts: [OLD("quake", 30), OLD("tempest", 40),
          A("frenzy", "Blood Frenzy", 50, 35, "buff", { self: true, effects: [["strength", 10, 1], ["speed", 10, 1]], combat: true }, "a red rage: stronger and faster for ten seconds")],
        masteries: [
          {
            key: "warlord", name: "Warlord", help: "leads from the front and lifts the whole party",
            arts: [
              A("war_cry", "War Cry", 60, 35, "buff", { effects: [["strength", 10, 1]], party: true, combat: true }, "the whole party strikes harder"),
              A("leap", "Leaping Strike", 70, 14, "dash", { dmg: [16, 0.4], radius: 3.5, range: 14 }, "leaps on a foe and crushes all around it"),
              A("execution", "Execution", 80, 12, "strike", { dmg: [16, 0.4], exec: 2.5 }, "a beheading blow, far deadlier to the wounded"),
              A("standard", "Battle Standard", 90, 50, "aura", { sec: 12, radius: 8, allies: [["strength", 2, 1], ["regeneration", 2, 0]] }, "plants a standard: strength and healing for all near it"),
              A("conqueror", "Conqueror's Wrath", 100, 70, "combo", { parts: [{ kind: "cleave", dmg: [30, 0.6], radius: 6 }, { kind: "buff", effects: [["strength", 10, 2]], party: true }] }, "a great blow that shakes the field, and a roar that drives the party on")],
          },
          {
            key: "sword_saint", name: "Sword Saint", help: "the way of the blade, like the Warrior-Captain",
            arts: [
              A("six_light", "Six Light Slash", 60, 12, "strike", { dmg: [6, 0.18], hits: 6 }, "six cuts faster than the eye"),
              A("flash_step", "Flash Step", 70, 10, "blink", { dmg: [14, 0.35] }, "steps through space to strike from behind"),
              A("domain", "Martial Domain", 80, 40, "buff", { self: true, effects: [["resistance", 10, 1], ["haste", 10, 2]], combat: true }, "a sphere of perfect awareness: harder to hurt, quicker to strike"),
              A("thousand_cuts", "Thousand Cuts", 90, 20, "cleave", { dmg: [8, 0.2], radius: 5, hits: 4 }, "a storm of blades around it"),
              A("severing", "Severing Light", 100, 60, "strike", { dmg: [60, 1.0], exec: 1.5, el: "holy" }, "one perfect cut")],
          },
        ],
      },
    ],
  },
  // ===================================================================================== Archer
  {
    key: "archer", name: "Archer", role: "back", element: "none",
    blurb: "Bow and quiver: strikes from afar and keeps out of reach.",
    core: [OLD("shot", 1), OLD("volley", 10), OLD("pin", 20)],
    branches: [
      {
        key: "sharpshooter", name: "Sharpshooter", help: "one arrow, one kill",
        arts: [OLD("fire_arrow", 30), OLD("starfall", 40),
          A("headshot", "Headshot", 50, 12, "bolt", { dmg: [14, 0.35], elite: 2 }, "aimed at the head: twice as hard on elites and bosses")],
        masteries: [
          {
            key: "sniper", name: "Sniper", help: "reaches farther and hits harder than any other",
            arts: [
              A("deadeye", "Deadeye", 60, 10, "bolt", { dmg: [18, 0.4], range: 28 }, "a shot from far beyond a bowshot"),
              A("explosive", "Explosive Arrow", 70, 14, "nova", { dmg: [14, 0.35], radius: 3.5, el: "fire" }, "an arrow that bursts where it lands"),
              A("marked", "Marked for Death", 80, 25, "afflict", { effects: [["weakness", 10, 2]], mark: 1.3 }, "marks a foe: the party strikes it harder"),
              A("ballista", "Ballista Bolt", 90, 18, "bolt", { dmg: [28, 0.5], pierce: true, knock: 1.2 }, "a bolt that pierces every foe in its line"),
              A("shooting_star", "Ultimate Shooting Star", 100, 70, "rain", { dmg: [30, 0.6], radius: 5, waves: 3, el: "holy" }, "Neia's own: three falling stars")],
          },
          {
            key: "arcane_archer", name: "Arcane Archer", help: "arrows dipped in magic",
            arts: [
              A("frost_arrow", "Frost Arrow", 60, 10, "bolt", { dmg: [12, 0.3], el: "ice", effects: [["slowness", 4, 2]] }, "chills and slows"),
              A("thunder_arrow", "Thunder Arrow", 70, 14, "chain", { dmg: [12, 0.3], jumps: 4, el: "lightning" }, "lightning leaps from foe to foe"),
              A("seekers", "Seeking Arrows", 80, 16, "multi", { dmg: [10, 0.28], count: 5, el: "arcane" }, "five arrows that find five foes"),
              A("element_storm", "Elemental Storm", 90, 28, "rain", { dmg: [14, 0.32], radius: 5, waves: 4, el: "arcane" }, "a storm of enchanted arrows"),
              A("rainbow", "Rainbow Quiver", 100, 60, "combo", { parts: [{ kind: "bolt", dmg: [16, 0.4], el: "fire" }, { kind: "bolt", dmg: [16, 0.4], el: "ice", effects: [["slowness", 4, 3]] }, { kind: "chain", dmg: [16, 0.4], jumps: 5, el: "lightning" }, { kind: "nova", dmg: [16, 0.4], radius: 4, el: "arcane" }] }, "every element at once")],
          },
        ],
      },
      {
        key: "ranger", name: "Ranger", help: "the wilds are its ally",
        arts: [OLD("rain", 30),
          A("snare", "Snare Trap", 40, 18, "afflict", { radius: 3.5, effects: [["slowness", 5, 5]] }, "a trap that roots the foe and those beside it"),
          A("hawk", "Hawk Strike", 50, 12, "bolt", { dmg: [12, 0.3], from: "sky", effects: [["blindness", 3, 0]] }, "its hawk dives on a foe's eyes")],
        masteries: [
          {
            key: "beastmaster", name: "Beastmaster", help: "fights beside a pack of wolves",
            arts: [
              A("wolves", "Call the Pack", 60, 45, "summon", { type: "minecraft:wolf", count: 2, sec: 40 }, "two wolves come to its whistle"),
              A("howl", "Pack Howl", 70, 30, "buff", { effects: [["speed", 10, 1], ["strength", 10, 0]], party: true, combat: true }, "the party moves and strikes like wolves"),
              A("roar", "Primal Roar", 80, 25, "afflict", { radius: 6, on: "self", effects: [["slowness", 3, 5], ["weakness", 5, 1]] }, "a roar that freezes every foe near it"),
              A("stampede", "Stampede", 90, 24, "cleave", { dmg: [18, 0.4], radius: 6, knock: 1.4 }, "beasts trample every foe around it"),
              A("wild_king", "King of the Wild", 100, 90, "summon", { type: "minecraft:wolf", count: 4, sec: 60, buff: [["strength", 60, 1], ["resistance", 60, 0]] }, "a great pack answers, stronger than any wolves")],
          },
          {
            key: "warden", name: "Warden", help: "the forest's guardian: thorn and spring",
            arts: [
              A("thorns", "Thorn Volley", 60, 10, "multi", { dmg: [10, 0.28], count: 4, el: "acid", effects: [["poison", 4, 1]] }, "thorns that poison"),
              A("entangle", "Entangle", 70, 22, "afflict", { radius: 5, effects: [["slowness", 5, 5], ["poison", 4, 0]], el: "acid" }, "roots burst up and bind"),
              A("spring", "Healing Spring", 80, 30, "heal", { amount: [14, 0.2], party: true, hot: 6 }, "a spring wells up and heals the party"),
              A("verdant", "Verdant Barrage", 90, 24, "rain", { dmg: [14, 0.32], radius: 4.5, waves: 3, el: "acid" }, "a rain of thorns"),
              A("forest_wrath", "Wrath of the Forest", 100, 70, "combo", { parts: [{ kind: "afflict", radius: 7, effects: [["slowness", 6, 6]] }, { kind: "nova", dmg: [30, 0.6], radius: 7, el: "acid" }, { kind: "heal", amount: [20, 0.2], party: true }] }, "the forest rises: foes held, crushed, and friends mended")],
          },
        ],
      },
    ],
  },
  // ===================================================================================== Mage
  {
    key: "mage", name: "Mage", role: "back", element: "arcane",
    blurb: "Tier magic from a distance: fire, ice and stranger things.",
    core: [OLD("bolt", 1), OLD("burst", 10), OLD("chain", 20)],
    branches: [
      {
        key: "elementalist", name: "Elementalist", help: "masters of the elements",
        arts: [OLD("frost", 30), OLD("meteor", 40),
          A("attune", "Elemental Attunement", 50, 40, "buff", { self: true, effects: [["strength", 12, 1]], combat: true, power: 1.25 }, "its next spells strike a quarter harder")],
        masteries: [
          {
            key: "pyromancer", name: "Pyromancer", help: "fire, and more fire",
            arts: [
              A("flame_pillar", "Flame Pillar", 60, 12, "nova", { dmg: [14, 0.35], radius: 2.5, el: "fire", effects: [["fire", 4, 0]] }, "a pillar of fire on the foe"),
              A("inferno", "Inferno Wave", 70, 18, "cleave", { dmg: [14, 0.35], radius: 6, el: "fire", effects: [["fire", 3, 0]] }, "a wave of flame rolls out from it"),
              A("phoenix", "Phoenix Flame", 80, 40, "combo", { parts: [{ kind: "nova", dmg: [16, 0.4], radius: 4, el: "fire" }, { kind: "heal", amount: [12, 0.15], party: true }] }, "a firebird that burns foes and warms friends back to health"),
              A("hellfire", "Hellfire", 90, 26, "rain", { dmg: [18, 0.4], radius: 5, waves: 3, el: "fire" }, "fire from the sky"),
              A("nuclear", "Nuclear Blast", 100, 75, "nova", { dmg: [45, 0.8], radius: 8, el: "fire", effects: [["fire", 6, 0], ["weakness", 6, 1]] }, "the eighth tier's sun, cast at the foe")],
          },
          {
            key: "cryomancer", name: "Cryomancer", help: "ice and the stillness of winter",
            arts: [
              A("ice_lance", "Ice Lance", 60, 10, "bolt", { dmg: [16, 0.38], el: "ice", pierce: true, effects: [["slowness", 3, 2]] }, "a lance of ice through every foe in line"),
              A("blizzard", "Blizzard", 70, 26, "aura", { sec: 8, radius: 6, on: "foe", dmg: [5, 0.1], effects: [["slowness", 2, 3]], el: "ice" }, "a blizzard on the foe for eight seconds"),
              A("prison", "Frozen Prison", 80, 22, "afflict", { effects: [["slowness", 5, 255], ["weakness", 5, 2]], el: "ice" }, "encases a foe in ice"),
              A("absolute", "Absolute Cold", 90, 28, "nova", { dmg: [22, 0.45], radius: 5, el: "ice", effects: [["slowness", 6, 4]] }, "the air itself freezes"),
              A("ice_age", "Ice Age", 100, 75, "combo", { parts: [{ kind: "afflict", radius: 9, effects: [["slowness", 8, 6], ["mining_fatigue", 8, 2]] }, { kind: "rain", dmg: [24, 0.5], radius: 7, waves: 3, el: "ice" }] }, "a field frozen still and shattered")],
          },
        ],
      },
      {
        key: "arcanist", name: "Arcanist", help: "space, time and the void",
        arts: [OLD("rift", 30),
          A("blink", "Blink", 40, 16, "escape", { dist: 7 }, "vanishes from danger and reappears a short way off"),
          A("mana_shield", "Mana Shield", 50, 35, "shield", { amp: 1, sec: 12, party: true }, "a shimmering shield over the party")],
        masteries: [
          {
            key: "chronomancer", name: "Chronomancer", help: "bends time for friend and foe",
            arts: [
              A("time_slow", "Slow Time", 60, 20, "afflict", { radius: 6, effects: [["slowness", 6, 3], ["mining_fatigue", 6, 2]], el: "arcane" }, "time drags for every foe near the target"),
              A("haste_field", "Haste", 70, 35, "buff", { effects: [["speed", 12, 2], ["haste", 12, 2]], party: true, combat: true }, "the party moves at double time"),
              A("rewind", "Rewind", 80, 40, "heal", { amount: [24, 0.3], party: true }, "turns back the wounds of the last moments"),
              A("time_stop", "Time Stop", 90, 60, "afflict", { radius: 10, on: "self", effects: [["slowness", 6, 255], ["weakness", 6, 4]], el: "arcane" }, "every foe near it stands frozen in time"),
              A("collapse", "Time Collapse", 100, 75, "combo", { parts: [{ kind: "afflict", radius: 10, on: "self", effects: [["slowness", 5, 255]] }, { kind: "rain", dmg: [26, 0.55], radius: 8, waves: 4, el: "arcane" }] }, "the moment breaks, and everything in it")],
          },
          {
            key: "void_caller", name: "Void Caller", help: "calls on the empty dark between worlds",
            arts: [
              A("void_bolt", "Void Bolt", 60, 8, "bolt", { dmg: [16, 0.38], el: "dark", effects: [["wither", 3, 0]] }, "a bolt of nothing that withers"),
              A("gravity", "Gravity Well", 70, 22, "pull", { radius: 7, dmg: [10, 0.25], el: "dark" }, "drags every foe near the target together"),
              A("black_hole", "Black Hole", 80, 30, "aura", { sec: 6, radius: 5, on: "foe", dmg: [8, 0.18], pull: true, el: "dark" }, "a black hole that drags and crushes for six seconds"),
              A("negative", "Negative Burst", 90, 24, "nova", { dmg: [24, 0.5], radius: 5, on: "self", el: "dark" }, "negative energy bursts out from it"),
              A("reality", "Reality Rend", 100, 70, "combo", { parts: [{ kind: "pull", radius: 10, dmg: [10, 0.2] }, { kind: "nova", dmg: [40, 0.75], radius: 6, el: "dark" }] }, "tears the world open where the foes stand")],
          },
        ],
      },
    ],
  },
  // ===================================================================================== Healer
  {
    key: "healer", name: "Healer", role: "support", element: "holy",
    blurb: "Keeps you and the party standing, and smites what threatens them.",
    core: [OLD("mend", 1), OLD("smite", 10), OLD("purify", 20)],
    branches: [
      {
        key: "priest", name: "Priest", help: "the light that heals",
        arts: [OLD("sanctuary", 30), OLD("blessing", 40), OLD("aegis", 50)],
        masteries: [
          {
            key: "saint", name: "Saint", help: "the greatest of healers",
            arts: [
              A("greater_heal", "Greater Heal", 60, 8, "heal", { amount: [20, 0.3], urgent: true }, "a great heal on the most wounded"),
              A("mass_heal", "Mass Heal", 70, 20, "heal", { amount: [14, 0.2], party: true, urgent: true }, "heals the whole party"),
              A("resurrection", "Resurrection", 80, 60, "revive", { count: 4, urgent: true }, "calls fallen companions back at once"),
              A("holy_ground", "Holy Ground", 90, 30, "aura", { sec: 10, radius: 6, heal: 3, allies: [["resistance", 2, 0]], el: "holy" }, "ground where friends heal and stand firm"),
              A("miracle", "Miracle", 100, 120, "combo", { urgent: true, parts: [{ kind: "revive", count: 4 }, { kind: "heal", amount: [60, 0.5], party: true }, { kind: "shield", amp: 4, sec: 15, party: true }, { kind: "cleanse" }] }, "every wound closed, every friend back, every harm washed away")],
          },
          {
            key: "templar", name: "Templar", help: "a priest who wields the light as a weapon",
            arts: [
              A("holy_lance", "Holy Lance", 60, 10, "bolt", { dmg: [16, 0.38], el: "holy", undead: 1.5, pierce: true }, "a lance of light through the foes in line"),
              A("hammer", "Hammer of Judgement", 70, 16, "strike", { dmg: [18, 0.4], el: "holy", stagger: 2, reach: 5 }, "a falling hammer that staggers"),
              A("radiant", "Radiant Armour", 80, 40, "buff", { effects: [["resistance", 12, 1], ["fire_resistance", 12, 0]], party: true, combat: true }, "light like armour on the whole party"),
              A("heaven_wrath", "Wrath of Heaven", 90, 26, "rain", { dmg: [18, 0.4], radius: 5, waves: 3, el: "holy", undead: 1.5 }, "pillars of light fall on the foes"),
              A("avatar", "Avatar of Light", 100, 90, "combo", { parts: [{ kind: "buff", self: true, effects: [["strength", 15, 2], ["resistance", 15, 2], ["regeneration", 15, 1]] }, { kind: "nova", dmg: [32, 0.6], radius: 7, el: "holy", undead: 1.5 }, { kind: "heal", amount: [24, 0.25], party: true }] }, "becomes light itself for fifteen seconds")],
          },
        ],
      },
      {
        key: "druid", name: "Druid", help: "the slow, sure healing of growing things",
        arts: [
          A("regrowth", "Regrowth", 30, 14, "heal", { amount: [8, 0.12], hot: 8, urgent: true }, "heals at once and over the next eight seconds"),
          A("barkskin", "Barkskin", 40, 30, "buff", { effects: [["resistance", 10, 0]], party: true, combat: true }, "skin like bark for the party"),
          A("moonfire", "Moonfire", 50, 10, "bolt", { dmg: [12, 0.3], el: "arcane", effects: [["wither", 4, 0]] }, "a beam of moonlight that burns on")],
        masteries: [
          {
            key: "grove_keeper", name: "Grove Keeper", help: "healing that grows",
            arts: [
              A("rejuvenate", "Rejuvenation", 60, 12, "heal", { amount: [10, 0.15], party: true, hot: 10 }, "the whole party heals over ten seconds"),
              A("thornskin", "Thornskin", 70, 30, "buff", { effects: [["resistance", 10, 1], ["absorption", 10, 1]], party: true, combat: true }, "thorny bark that turns blows"),
              A("lifebloom", "Lifebloom", 80, 35, "aura", { sec: 10, radius: 7, heal: 3, el: "acid" }, "flowers bloom and heal all near it"),
              A("tranquility", "Tranquility", 90, 50, "heal", { amount: [30, 0.35], party: true, hot: 10, urgent: true }, "a great calm that heals everyone"),
              A("embrace", "Nature's Embrace", 100, 110, "combo", { urgent: true, parts: [{ kind: "revive", count: 4 }, { kind: "heal", amount: [40, 0.4], party: true, hot: 15 }, { kind: "cleanse" }] }, "the green world gives back every friend")],
          },
          {
            key: "oracle", name: "Oracle", help: "sees blows before they fall",
            arts: [
              A("foresight", "Foresight", 60, 30, "buff", { effects: [["resistance", 10, 1]], party: true, combat: true }, "the party sees blows coming"),
              A("divine_shield", "Divine Shield", 70, 35, "shield", { amp: 3, sec: 12, urgent: true }, "a great shield on whoever is hurt most"),
              A("fate_chain", "Chains of Fate", 80, 24, "afflict", { radius: 6, effects: [["slowness", 5, 4], ["weakness", 5, 2]], el: "holy" }, "fate binds the foes"),
              A("prophecy", "Prophecy", 90, 45, "combo", { parts: [{ kind: "shield", amp: 2, sec: 15, party: true }, { kind: "buff", effects: [["speed", 15, 1]], party: true }] }, "the party knows what comes and is ready"),
              A("destiny", "Destiny", 100, 120, "combo", { urgent: true, parts: [{ kind: "heal", amount: [60, 0.5], party: true }, { kind: "shield", amp: 4, sec: 20, party: true }, { kind: "afflict", radius: 10, on: "self", effects: [["slowness", 5, 255]] }] }, "fate itself turns: friends whole, foes held")],
          },
        ],
      },
    ],
  },
  // ===================================================================================== Rogue
  {
    key: "rogue", name: "Rogue", role: "flank", element: "dark",
    blurb: "Daggers and poison: strikes from behind and finishes the wounded.",
    core: [OLD("backstab", 1), OLD("flask", 10), OLD("shadowstep", 20)],
    branches: [
      {
        key: "assassin", name: "Assassin", help: "kills before it is seen",
        arts: [OLD("knives", 30), OLD("flurry", 40),
          A("death_mark", "Mark of Death", 50, 25, "afflict", { effects: [["weakness", 8, 1]], mark: 1.35, el: "dark" }, "a mark that makes the foe bleed more from every blow")],
        masteries: [
          {
            key: "shadow", name: "Shadow", help: "one with the dark",
            arts: [
              A("shadow_clone", "Shadow Clone", 60, 40, "summon", { type: "overlord:ghoul", count: 1, sec: 30 }, "a shadow of itself fights beside it"),
              A("smoke", "Smoke Bomb", 70, 22, "afflict", { radius: 5, effects: [["blindness", 5, 0], ["slowness", 4, 2]] }, "smoke that blinds every foe near"),
              OLD("lotus", 80),
              A("night_veil", "Night Veil", 90, 50, "buff", { effects: [["invisibility", 6, 0], ["speed", 6, 1]], party: true }, "the party vanishes for a moment"),
              A("thousand_shadows", "Thousand Shadows", 100, 70, "combo", { parts: [{ kind: "blink", dmg: [20, 0.45] }, { kind: "multi", dmg: [16, 0.4], count: 8 }, { kind: "cleave", dmg: [16, 0.4], radius: 5 }] }, "it is everywhere at once")],
          },
          {
            key: "venomblade", name: "Venomblade", help: "every cut poisons",
            arts: [
              A("toxic_blade", "Toxic Blade", 60, 8, "strike", { dmg: [12, 0.3], el: "acid", effects: [["poison", 6, 1]] }, "a cut that poisons deep"),
              A("plague_cloud", "Plague Cloud", 70, 22, "aura", { sec: 8, radius: 4, on: "foe", effects: [["poison", 2, 1]], dmg: [3, 0.06], el: "acid" }, "a poison cloud on the foe"),
              A("venom_burst", "Venom Burst", 80, 18, "nova", { dmg: [16, 0.36], radius: 4, el: "acid", poisoned: 2 }, "poison bursts from the foe, doubly cruel to the poisoned"),
              A("wither_strike", "Wither Strike", 90, 14, "strike", { dmg: [18, 0.4], el: "dark", effects: [["wither", 6, 1]] }, "a blade that withers"),
              A("black_death", "Black Death", 100, 70, "combo", { parts: [{ kind: "afflict", radius: 8, effects: [["poison", 10, 2], ["wither", 10, 1]] }, { kind: "nova", dmg: [28, 0.55], radius: 8, el: "acid" }] }, "a plague on every foe")],
          },
        ],
      },
      {
        key: "duelist", name: "Duelist", help: "a fencer's grace",
        arts: [
          A("riposte", "Riposte", 30, 8, "strike", { dmg: [10, 0.28], counter: 1.6 }, "turns a blow back, harder on whatever just struck it"),
          A("lunge", "Lunge", 40, 10, "dash", { dmg: [12, 0.3], range: 9 }, "a long lunge that closes the gap"),
          A("disarm", "Disarm", 50, 18, "afflict", { effects: [["weakness", 8, 3]] }, "knocks the foe's weapon aside")],
        masteries: [
          {
            key: "swashbuckler", name: "Swashbuckler", help: "fights with flair",
            arts: [
              A("blade_dance", "Blade Dance", 60, 14, "cleave", { dmg: [10, 0.25], radius: 4, hits: 3 }, "a dance of blades around it"),
              A("flourish", "Taunting Flourish", 70, 20, "taunt", { radius: 8 }, "draws the foes with a flourish"),
              A("feint", "Feint", 80, 10, "strike", { dmg: [16, 0.38], stagger: 2 }, "a feint that leaves the foe open"),
              A("waltz", "Crimson Waltz", 90, 20, "dash", { dmg: [16, 0.38], radius: 4, range: 12, hits: 2 }, "dances through the foes"),
              A("final_curtain", "Final Curtain", 100, 60, "strike", { dmg: [50, 0.9], exec: 2 }, "the last bow")],
          },
          {
            key: "trickster", name: "Trickster", help: "dirty tricks and good fortune",
            arts: [
              A("caltrops", "Caltrops", 60, 18, "afflict", { radius: 4, effects: [["slowness", 6, 3]], dmg: [6, 0.12] }, "spikes underfoot"),
              A("mirrors", "Smoke and Mirrors", 70, 30, "escape", { dist: 6, effects: [["invisibility", 4, 0]] }, "is gone in a puff of smoke"),
              A("pickpocket", "Pickpocket", 80, 20, "strike", { dmg: [12, 0.3], coins: 2 }, "a quick hand: hurts, and turns up coins"),
              A("bombs", "Bomb Barrage", 90, 22, "rain", { dmg: [16, 0.36], radius: 4, waves: 3, el: "fire" }, "a fistful of bombs"),
              A("grand_heist", "Grand Heist", 100, 80, "combo", { parts: [{ kind: "multi", dmg: [20, 0.45], count: 6, coins: 1 }, { kind: "escape", dist: 6 }] }, "robs a whole fight blind")],
          },
        ],
      },
    ],
  },
  // ===================================================================================== Bard
  {
    key: "bard", name: "Bard", role: "back", element: "arcane",
    blurb: "Songs that hearten the party and break the foe's will.",
    core: [OLD("ballad", 1), OLD("dissonance", 10), OLD("haste", 20)],
    branches: [
      {
        key: "skald", name: "Skald", help: "songs of war",
        arts: [OLD("dirge", 30), OLD("crescendo", 40),
          A("war_drums", "Drums of War", 50, 35, "buff", { effects: [["strength", 10, 1], ["speed", 10, 0]], party: true, combat: true }, "drums that drive the party on")],
        masteries: [
          {
            key: "warchanter", name: "Warchanter", help: "its voice is a weapon",
            arts: [
              A("shout", "Thunderous Shout", 60, 14, "cleave", { dmg: [14, 0.35], radius: 6, el: "lightning", knock: 1 }, "a shout that hurls foes back"),
              A("anthem", "Heroic Anthem", 70, 40, "buff", { effects: [["strength", 12, 2]], party: true, combat: true }, "a hero's song: the party strikes far harder"),
              OLD("requiem", 80),
              A("saga", "Saga of Heroes", 90, 50, "aura", { sec: 12, radius: 8, allies: [["strength", 2, 1], ["resistance", 2, 0]] }, "a saga sung: the party fights as legends"),
              A("ragnarok", "Ragnarok", 100, 80, "combo", { parts: [{ kind: "cleave", dmg: [30, 0.6], radius: 8, el: "lightning" }, { kind: "buff", effects: [["strength", 15, 2], ["speed", 15, 1]], party: true }] }, "the song of the world's end")],
          },
          {
            key: "siren", name: "Siren", help: "a voice that charms and binds",
            arts: [
              A("lullaby", "Lullaby", 60, 22, "afflict", { radius: 6, effects: [["slowness", 6, 5]] }, "foes nod and stumble"),
              A("charm", "Charm", 70, 30, "afflict", { effects: [["weakness", 10, 3], ["slowness", 10, 2]] }, "a foe forgets to fight"),
              A("echo", "Echoing Song", 80, 16, "chain", { dmg: [14, 0.32], jumps: 5, el: "arcane" }, "a note that leaps from foe to foe"),
              A("siren_call", "Siren's Call", 90, 30, "pull", { radius: 9, dmg: [8, 0.18] }, "draws every foe to one spot"),
              A("swan_song", "Swan Song", 100, 80, "combo", { parts: [{ kind: "afflict", radius: 10, on: "self", effects: [["slowness", 8, 5], ["weakness", 8, 2]] }, { kind: "heal", amount: [30, 0.3], party: true }, { kind: "chain", dmg: [24, 0.5], jumps: 8, el: "arcane" }] }, "a last song no foe can bear")],
          },
        ],
      },
      {
        key: "minstrel", name: "Minstrel", help: "songs of comfort",
        arts: [
          A("hymn", "Healing Hymn", 30, 16, "heal", { amount: [10, 0.15], party: true, urgent: true }, "a hymn that heals the party"),
          A("march", "Marching Song", 40, 30, "buff", { effects: [["speed", 12, 1], ["jump_boost", 12, 0]], party: true }, "the party moves quick and light"),
          A("lament", "Lament", 50, 20, "afflict", { radius: 5, effects: [["weakness", 6, 1], ["slowness", 6, 1]] }, "a sad song that saps the foe")],
        masteries: [
          {
            key: "troubadour", name: "Troubadour", help: "the heart of the party",
            arts: [
              A("serenade", "Serenade", 60, 12, "heal", { amount: [14, 0.2], party: true, hot: 6, urgent: true }, "heals the party, and keeps healing"),
              A("rest_song", "Song of Rest", 70, 40, "shield", { amp: 2, sec: 15, party: true }, "a gentle shield on everyone"),
              A("courage", "Courage", 80, 40, "buff", { effects: [["resistance", 12, 1], ["strength", 12, 0]], party: true, combat: true }, "no fear in the party"),
              A("chorus", "Grand Chorus", 90, 40, "aura", { sec: 12, radius: 8, heal: 3, allies: [["speed", 2, 0]] }, "a chorus that heals all near it"),
              A("finale", "Finale", 100, 110, "combo", { urgent: true, parts: [{ kind: "revive", count: 4 }, { kind: "heal", amount: [50, 0.45], party: true }, { kind: "buff", effects: [["strength", 15, 1], ["resistance", 15, 1]], party: true }] }, "the last movement: everyone stands up again")],
          },
          {
            key: "dancer", name: "Sword Dancer", help: "dances with blades as well as feet",
            arts: [
              A("sword_dance", "Sword Dance", 60, 12, "cleave", { dmg: [12, 0.3], radius: 4, hits: 2 }, "blades whirl as it dances"),
              A("tempo", "Tempo", 70, 30, "buff", { effects: [["haste", 12, 2], ["speed", 12, 1]], party: true, combat: true }, "the party keeps its rhythm"),
              A("veil_dance", "Veil Dance", 80, 25, "escape", { dist: 5, effects: [["resistance", 4, 2]] }, "dances out of reach"),
              A("whirling", "Whirling Blades", 90, 18, "dash", { dmg: [16, 0.36], radius: 4, range: 12, hits: 2 }, "spins through the foes"),
              A("dance_of_death", "Dance of Death", 100, 70, "combo", { parts: [{ kind: "cleave", dmg: [16, 0.36], radius: 6, hits: 3 }, { kind: "buff", effects: [["speed", 10, 2]], party: true }] }, "no foe survives the last dance")],
          },
        ],
      },
    ],
  },
  // ===================================================================================== Monk (v11)
  {
    key: "monk", name: "Monk", role: "front", element: "none",
    blurb: "Fists, feet and ki: fast, hard to pin down, and harder to stop.",
    core: [
      A("palm", "Palm Strike", 1, 5, "strike", { dmg: [5, 0.3], knock: 1, pose: "punch" }, "a palm that throws the foe back"),
      A("flurry_blows", "Flurry of Blows", 10, 9, "strike", { dmg: [3, 0.15], hits: 4, pose: "punch" }, "four blows in a heartbeat"),
      A("ki_burst", "Ki Burst", 20, 14, "cleave", { dmg: [6, 0.3], radius: 3.5, knock: 1, pose: "kick" }, "ki bursts from it and hurls foes back")],
    branches: [
      {
        key: "ki_master", name: "Ki Master", help: "ki as a weapon and a shield",
        arts: [
          A("ki_wave", "Ki Wave", 30, 12, "bolt", { dmg: [10, 0.3], pierce: true, el: "arcane", pose: "punch" }, "a wave of ki through every foe in line"),
          A("iron_skin", "Iron Skin", 40, 30, "buff", { self: true, effects: [["resistance", 10, 1]], combat: true }, "skin hard as iron"),
          A("chi_heal", "Inner Peace", 50, 25, "heal", { self: true, amount: [12, 0.25], urgent: true, low: 0.5 }, "heals itself with a breath")],
        masteries: [
          {
            key: "dragon_fist", name: "Dragon Fist", help: "the strength of dragons in its hands",
            arts: [
              A("dragon_fist_art", "Dragon Fist", 60, 10, "strike", { dmg: [18, 0.4], el: "fire", knock: 1.2, pose: "punch" }, "a burning fist"),
              A("rising_dragon", "Rising Dragon", 70, 14, "strike", { dmg: [16, 0.38], lift: 0.8, el: "fire", pose: "kick" }, "a kick that hurls the foe into the air"),
              A("dragon_roar", "Dragon's Roar", 80, 24, "cleave", { dmg: [14, 0.32], radius: 6, el: "fire", effects: [["weakness", 5, 1]] }, "a roar of ki that scorches"),
              A("hundred_fists", "Hundred Fists", 90, 18, "strike", { dmg: [4, 0.1], hits: 10, pose: "punch" }, "a hundred blows"),
              A("dragon_ascend", "Dragon Ascendant", 100, 70, "combo", { parts: [{ kind: "buff", self: true, effects: [["strength", 15, 2], ["speed", 15, 1]] }, { kind: "dash", dmg: [34, 0.65], radius: 5, range: 14, el: "fire" }] }, "becomes the dragon")],
          },
          {
            key: "iron_body", name: "Iron Body", help: "nothing harms it",
            arts: [
              A("stone_stance", "Stone Stance", 60, 30, "taunt", { radius: 10 }, "a stance that dares the foes to strike"),
              A("counter_palm", "Counter Palm", 70, 8, "strike", { dmg: [14, 0.34], counter: 1.8, pose: "punch" }, "turns any blow back on its maker"),
              A("diamond_body", "Diamond Body", 80, 45, "buff", { self: true, effects: [["resistance", 12, 3]], combat: true, urgent: true, low: 0.5 }, "a body like diamond"),
              A("quake_stomp", "Quaking Stomp", 90, 18, "cleave", { dmg: [18, 0.4], radius: 6, effects: [["slowness", 3, 3]], pose: "kick" }, "a stomp that shakes the ground"),
              A("vajra", "Vajra", 100, 90, "combo", { urgent: true, parts: [{ kind: "taunt", radius: 12 }, { kind: "buff", self: true, effects: [["resistance", 15, 4], ["regeneration", 15, 2]] }, { kind: "shield", amp: 2, sec: 15, party: true }] }, "the unbreakable: it takes every blow so no one else does")],
          },
        ],
      },
      {
        key: "wind_walker", name: "Wind Walker", role: "flank", help: "swift as the wind",
        arts: [
          A("gale_kick", "Gale Kick", 30, 10, "dash", { dmg: [10, 0.3], range: 10, pose: "kick" }, "a flying kick"),
          A("wind_step", "Wind Step", 40, 25, "buff", { self: true, effects: [["speed", 10, 2], ["jump_boost", 10, 1]], combat: true }, "light as the wind"),
          A("cyclone", "Cyclone Kick", 50, 14, "cleave", { dmg: [10, 0.28], radius: 4, hits: 2, pose: "kick" }, "a spinning kick")],
        masteries: [
          {
            key: "storm_dancer", name: "Storm Dancer", help: "the storm in human shape",
            arts: [
              A("thunder_palm", "Thunder Palm", 60, 10, "chain", { dmg: [14, 0.32], jumps: 3, el: "lightning", pose: "punch" }, "lightning leaps from its palm"),
              A("tempest_step", "Tempest Step", 70, 12, "blink", { dmg: [16, 0.38], el: "lightning" }, "steps through the storm"),
              A("storm_call", "Call the Storm", 80, 28, "rain", { dmg: [16, 0.36], radius: 5, waves: 3, el: "lightning" }, "lightning on every foe"),
              A("eye", "Eye of the Storm", 90, 40, "aura", { sec: 8, radius: 5, dmg: [6, 0.12], el: "lightning", allies: [["speed", 2, 1]] }, "a calm centre and a storm around it"),
              A("heaven_thunder", "Heaven's Thunder", 100, 70, "combo", { parts: [{ kind: "chain", dmg: [26, 0.55], jumps: 8, el: "lightning" }, { kind: "nova", dmg: [26, 0.55], radius: 6, el: "lightning" }] }, "the sky breaks open")],
          },
          {
            key: "shadow_fist", name: "Shadow Fist", help: "strikes from the dark",
            arts: [
              A("shade_strike", "Shade Strike", 60, 8, "blink", { dmg: [16, 0.38], el: "dark" }, "appears behind a foe"),
              A("pressure", "Pressure Point", 70, 18, "strike", { dmg: [12, 0.3], stagger: 3, effects: [["slowness", 4, 255]], pose: "punch" }, "a touch that leaves the foe unable to move"),
              A("shade_flurry", "Shade Flurry", 80, 16, "multi", { dmg: [12, 0.3], count: 5, el: "dark" }, "shadow blows on five foes"),
              A("death_touch", "Touch of Death", 90, 30, "strike", { dmg: [20, 0.45], exec: 3, el: "dark" }, "deadly to the wounded"),
              A("void_fist", "Void Fist", 100, 70, "combo", { parts: [{ kind: "blink", dmg: [30, 0.6], el: "dark" }, { kind: "nova", dmg: [24, 0.5], radius: 5, el: "dark" }] }, "a blow from nowhere that empties everything near")],
          },
        ],
      },
    ],
  },
  // ===================================================================================== Necromancer (v11)
  {
    key: "necromancer", name: "Necromancer", role: "back", element: "dark",
    blurb: "Raises the dead to fight and drains the living, as Nazarick's own do.",
    core: [
      A("death_bolt", "Death Bolt", 1, 6, "bolt", { dmg: [5, 0.3], el: "dark", pose: "point" }, "a bolt of negative energy"),
      A("raise_skeleton", "Raise Skeleton", 10, 40, "summon", { type: "overlord:old_guarder", count: 1, sec: 45 }, "a skeleton claws out of the ground to fight"),
      A("corpse_burst", "Corpse Burst", 20, 14, "nova", { dmg: [8, 0.3], radius: 3.5, el: "dark" }, "the foe's own death bursts around it")],
    branches: [
      {
        key: "lich", name: "Lich", help: "dark magic at its purest",
        arts: [
          A("life_drain", "Life Drain", 30, 10, "bolt", { dmg: [10, 0.3], el: "dark", drain: 0.6 }, "drinks a foe's life"),
          A("curse", "Curse of Weakness", 40, 20, "afflict", { radius: 5, effects: [["weakness", 8, 1], ["wither", 4, 0]], el: "dark" }, "curses every foe near the target"),
          A("bone_spear", "Bone Spear", 50, 12, "bolt", { dmg: [14, 0.35], pierce: true, el: "dark" }, "a spear of bone through the foes in line")],
        masteries: [
          {
            key: "soul_reaper", name: "Soul Reaper", help: "harvests souls",
            arts: [
              A("reap", "Reap", 60, 10, "cleave", { dmg: [14, 0.34], radius: 4, el: "dark", drain: 0.25 }, "a scythe of shadow that drinks"),
              A("soul_rend", "Soul Rend", 70, 14, "bolt", { dmg: [18, 0.4], el: "dark", effects: [["wither", 5, 1]] }, "tears at the soul"),
              A("soul_harvest", "Soul Harvest", 80, 30, "nova", { dmg: [16, 0.36], radius: 6, on: "self", el: "dark", heal: 8 }, "takes souls and gives the party their strength"),
              A("despair", "Aura of Despair", 90, 45, "aura", { sec: 10, radius: 7, effects: [["weakness", 2, 2], ["slowness", 2, 1]], el: "dark" }, "the Overlord's own aura"),
              A("grasp_heart", "Grasp Heart", 100, 75, "strike", { dmg: [70, 1.2], el: "dark", reach: 20, exec: 1.5 }, "crushes a foe's heart from afar, as Ainz does")],
          },
          {
            key: "plague_lord", name: "Plague Lord", help: "sickness and rot",
            arts: [
              A("rot", "Rot", 60, 10, "afflict", { effects: [["poison", 8, 2], ["wither", 6, 0]], dmg: [8, 0.2], el: "acid" }, "rot spreads through a foe"),
              A("pestilence", "Pestilence", 70, 24, "aura", { sec: 8, radius: 5, on: "foe", effects: [["poison", 2, 1]], dmg: [4, 0.08], el: "acid" }, "a cloud of disease"),
              A("contagion", "Contagion", 80, 16, "chain", { dmg: [12, 0.3], jumps: 6, el: "acid", effects: [["poison", 5, 1]] }, "sickness leaps from foe to foe"),
              A("decay", "Decay", 90, 26, "nova", { dmg: [20, 0.42], radius: 6, el: "acid", poisoned: 2 }, "the poisoned crumble"),
              A("death_tide", "Tide of Death", 100, 75, "combo", { parts: [{ kind: "afflict", radius: 10, effects: [["poison", 10, 3], ["wither", 10, 2]] }, { kind: "rain", dmg: [22, 0.48], radius: 8, waves: 3, el: "acid" }] }, "death washes over the field")],
          },
        ],
      },
      {
        key: "bone_lord", name: "Bone Lord", help: "commands armies of the dead",
        arts: [
          A("bone_army", "Bone Army", 30, 50, "summon", { type: "overlord:old_guarder", count: 3, sec: 45 }, "three skeletons rise"),
          A("ghoul_pack", "Ghoul Pack", 40, 50, "summon", { type: "overlord:ghoul", count: 2, sec: 45 }, "ghouls claw up from the earth"),
          A("command_dead", "Command the Dead", 50, 30, "buff", { summons: [["strength", 20, 1], ["speed", 20, 1]], effects: [["strength", 10, 0]], party: true, combat: true }, "its dead fight harder and faster")],
        masteries: [
          {
            key: "death_commander", name: "Death Commander", help: "Death Knights at its call",
            arts: [
              A("death_knight", "Create Death Knight", 60, 80, "summon", { type: "overlord:death_knight", count: 1, sec: 60 }, "a Death Knight rises to serve"),
              A("bone_wall", "Bone Wall", 70, 35, "shield", { amp: 2, sec: 12, party: true }, "a wall of bone shields the party"),
              A("legion", "Undead Legion", 80, 90, "summon", { type: "overlord:old_guarder", count: 5, sec: 50 }, "a legion of skeletons"),
              A("dark_pact", "Dark Pact", 90, 45, "buff", { summons: [["strength", 30, 2], ["resistance", 30, 1]], effects: [["resistance", 10, 0]], party: true }, "its dead become terrible"),
              A("army_of_death", "Army of Death", 100, 120, "combo", { parts: [{ kind: "summon", type: "overlord:death_knight", count: 2, sec: 60 }, { kind: "summon", type: "overlord:old_guarder", count: 4, sec: 60 }] }, "Death Knights and skeletons in their ranks")],
          },
          {
            key: "soul_binder", name: "Soul Binder", help: "binds greater souls to its will",
            arts: [
              A("wraith_call", "Bind Wraith", 60, 60, "summon", { type: "overlord:ghoul", count: 2, sec: 50 }, "bound spirits fight for it"),
              A("soul_link", "Soul Link", 70, 30, "heal", { amount: [16, 0.2], party: true }, "souls mend the party"),
              A("soul_storm", "Soul Storm", 80, 26, "rain", { dmg: [16, 0.36], radius: 5, waves: 3, el: "dark" }, "a storm of shrieking souls"),
              A("behemoth_call", "Summon Behemoth", 90, 120, "summon", { type: "overlord:behemoth", count: 1, sec: 45 }, "a Behemoth answers"),
              A("lord_of_souls", "Lord of Souls", 100, 120, "combo", { parts: [{ kind: "summon", type: "overlord:behemoth", count: 1, sec: 60 }, { kind: "summon", type: "overlord:ghoul", count: 3, sec: 60 }, { kind: "heal", amount: [30, 0.3], party: true }] }, "souls great and small at its command")],
          },
        ],
      },
    ],
  },
];

/** Index of each vocation by key. */
export const VOC_INDEX = Object.fromEntries(VOCATIONS.map((v, i) => [v.key, i]));

/**
 * The arts a companion knows: its vocation's core, its path's and its mastery's, up to its level.
 * @param {number} voc @param {number} branch -1 for none @param {number} mastery -1 for none @param {number} level
 * @returns {Art[]}
 */
export function artsFor(voc, branch, mastery, level) {
  const v = VOCATIONS[voc];
  if (!v) return [];
  /** @type {Art[]} */
  const out = [...v.core];
  const b = branch >= 0 ? v.branches[branch] : undefined;
  if (b) {
    out.push(...b.arts);
    const m = mastery >= 0 ? b.masteries[mastery] : undefined;
    if (m) out.push(...m.arts);
  }
  return out.filter((art) => level >= art.at);
}

/** Every art a vocation can ever learn, in order, with the path it belongs to. @param {number} voc */
export function treeOf(voc) {
  const v = VOCATIONS[voc];
  /** @type {{ art: Art, branch: number, mastery: number }[]} */
  const out = v.core.map((art) => ({ art, branch: -1, mastery: -1 }));
  v.branches.forEach((b, bi) => {
    for (const art of b.arts) out.push({ art, branch: bi, mastery: -1 });
    b.masteries.forEach((m, mi) => {
      for (const art of m.arts) out.push({ art, branch: bi, mastery: mi });
    });
  });
  return out;
}

/** The class name a companion goes by: its mastery's, else its path's, else its vocation's. @param {number} voc @param {number} branch @param {number} mastery */
export function className(voc, branch, mastery) {
  const v = VOCATIONS[voc];
  if (!v) return "Retainer";
  const b = branch >= 0 ? v.branches[branch] : undefined;
  const m = b && mastery >= 0 ? b.masteries[mastery] : undefined;
  return m?.name ?? b?.name ?? v.name;
}

/** The role a companion fights in: its mastery's, path's or vocation's. @param {number} voc @param {number} branch @param {number} mastery */
export function roleOf(voc, branch, mastery) {
  const v = VOCATIONS[voc];
  if (!v) return "front";
  const b = branch >= 0 ? v.branches[branch] : undefined;
  const m = b && mastery >= 0 ? b.masteries[mastery] : undefined;
  return m?.role ?? b?.role ?? v.role;
}
