// Overlord: Tomb of Nazarick - the skill tree: what each node is, and the rules for learning it.
//
// This module is data and arithmetic only: it reads a profile and never touches the world, so
// rpg.js, spells.js, party.js and the rest can all ask it for their bonuses without import cycles.
// The menus and the effects that act on the world (procs, auras, kill rewards) live in skilltree.js.
//
// Rules:
// - One skill point per level from level 2, one more at every tenth level, and one for every Codex
//   of the Supreme Beings read (at most MAX_CODEX). At level 100 that is 109 points, plus codices -
//   about enough to master three of the six paths.
// - Each path has five tiers. A tier opens once enough points are spent in that path and the player
//   has reached its level; some nodes also need another node of their path learned first.
// - The fifth tier of each path holds a single capstone.

/**
 * @typedef {"blade" | "arcane" | "shadow" | "faith" | "dominion" | "fortune"} TreeKey
 * @typedef {{
 *   key: string, tree: TreeKey, tier: number, name: string, max: number, per: number,
 *   text: string, needs?: string, unit?: string,
 * }} SkillNode
 * `text` describes the node at a rank: every {v} in it becomes `per` times the rank.
 */

/** @type {{ key: TreeKey, name: string, color: string, lore: string }[]} */
export const TREES = [
  { key: "blade", name: "Path of the Blade", color: "§c", lore: "The martial arts of Gazef Stronoff and the warrior-captains of the Kingdom: harder blows, a tougher body and the Six Light Strikes." },
  { key: "arcane", name: "Path of Tier Magic", color: "§b", lore: "Fluder Paradyne's lifelong study of the tiers: more mana, cheaper and faster spells, and Maximize Magic." },
  { key: "shadow", name: "Path of Shadow", color: "§7", lore: "The killing arts of the Eight Fingers and Clementine: critical hits, evasion, poison and the killing blow." },
  { key: "faith", name: "Path of Faith", color: "§e", lore: "The miracles of the priests of the Six Great Gods: a body that mends itself, holy light, and protection for your allies." },
  { key: "dominion", name: "Path of Dominion", color: "§5", lore: "The authority of a Supreme Being over servants and the undead: stronger companions, more summons and an aura of despair." },
  { key: "fortune", name: "Path of Fortune", color: "§6", lore: "An adventurer's craft: faster growth, gold and crystals from your foes, and cheaper roads." },
];

/** Points that must be spent in a path to open each of its tiers, and the level each needs. */
export const TIER_POINTS = [0, 3, 8, 14, 20];
export const TIER_LEVEL = [1, 10, 20, 35, 50];
export const MAX_CODEX = 10;

/** @type {SkillNode[]} */
export const NODES = [
  // ======================================================================= Blade
  { key: "weapon_mastery", tree: "blade", tier: 0, name: "Weapon Mastery", max: 5, per: 3, text: "+{v}% melee damage" },
  { key: "iron_body", tree: "blade", tier: 0, name: "Iron Body", max: 2, per: 2, text: "+{v} hearts" },
  { key: "cleave", tree: "blade", tier: 1, name: "Cleave", max: 3, per: 15, text: "Melee hits also strike other foes within 2.5 blocks for {v}% of the damage" },
  { key: "tough_skin", tree: "blade", tier: 1, name: "Tough Skin", max: 5, per: 3, text: "Shrug off {v}% of the damage you take" },
  { key: "executioner", tree: "blade", tier: 2, name: "Executioner", max: 3, per: 10, text: "+{v}% melee damage against foes below 30% health", needs: "weapon_mastery" },
  { key: "battle_fury", tree: "blade", tier: 2, name: "Battle Fury", max: 3, per: 8, text: "+{v}% melee damage while you are below half health" },
  { key: "bloodthirst", tree: "blade", tier: 2, name: "Bloodthirst", max: 3, per: 3, text: "Heal for {v}% of the melee damage you deal" },
  { key: "second_wind", tree: "blade", tier: 3, name: "Second Wind", max: 1, per: 1, text: "Falling below 30% health gives Regeneration III for 5 seconds (once a minute)", needs: "tough_skin" },
  { key: "unyielding", tree: "blade", tier: 3, name: "Unyielding", max: 2, per: 20, text: "Resistance I while you are below {w}% health" },
  { key: "crushing_blow", tree: "blade", tier: 3, name: "Crushing Blow", max: 3, per: 6, text: "{v}% chance a melee hit deals +50% damage and staggers the foe" },
  { key: "six_light_strikes", tree: "blade", tier: 4, name: "Six Light Strikes", max: 1, per: 1, text: "Every sixth melee hit unleashes six slashes on every foe within 4 blocks, each for 40% of the blow", needs: "cleave" },
  // ====================================================================== Arcane
  { key: "arcane_study", tree: "arcane", tier: 0, name: "Arcane Study", max: 5, per: 3, text: "+{v}% spell power" },
  { key: "deep_reserves", tree: "arcane", tier: 0, name: "Deep Reserves", max: 5, per: 12, text: "+{v} maximum mana" },
  { key: "mana_flow", tree: "arcane", tier: 1, name: "Mana Flow", max: 5, per: 10, text: "+{v}% mana recovery" },
  { key: "efficient_casting", tree: "arcane", tier: 1, name: "Efficient Casting", max: 3, per: 6, text: "Spells cost {v}% less mana" },
  { key: "quick_chant", tree: "arcane", tier: 2, name: "Quick Chant", max: 3, per: 6, text: "Spell cooldowns are {v}% shorter" },
  { key: "flame_thunder", tree: "arcane", tier: 2, name: "Flame and Thunder", max: 3, per: 8, text: "+{v}% power for fire and lightning spells" },
  { key: "frost_venom", tree: "arcane", tier: 2, name: "Frost and Venom", max: 3, per: 8, text: "+{v}% power for ice and acid spells" },
  { key: "overcast", tree: "arcane", tier: 3, name: "Overcast", max: 3, per: 5, text: "{v}% chance a spell costs no mana", needs: "efficient_casting" },
  { key: "spell_surge", tree: "arcane", tier: 3, name: "Spell Surge", max: 3, per: 6, text: "{v}% chance a spell is cast at +60% power" },
  { key: "mana_shield", tree: "arcane", tier: 3, name: "Mana Shield", max: 2, per: 15, text: "{v}% of the damage you take is paid in mana instead (3 mana a heart)" },
  { key: "maximize_magic", tree: "arcane", tier: 4, name: "Maximize Magic", max: 1, per: 1, text: "Every fourth spell you cast is maximized: +80% power and no mana", needs: "arcane_study" },
  // ====================================================================== Shadow
  { key: "keen_edge", tree: "shadow", tier: 0, name: "Keen Edge", max: 5, per: 2, text: "+{v}% critical hit chance" },
  { key: "fleet_foot", tree: "shadow", tier: 0, name: "Fleet of Foot", max: 2, per: 1, text: "One more tier of Speed{jump}" },
  { key: "lethal_strikes", tree: "shadow", tier: 1, name: "Lethal Strikes", max: 5, per: 10, text: "Critical hits deal +{v}% more damage" },
  { key: "evasion", tree: "shadow", tier: 1, name: "Evasion", max: 3, per: 4, text: "{v}% chance to dodge an attack completely" },
  { key: "backstab", tree: "shadow", tier: 2, name: "Backstab", max: 3, per: 15, text: "+{v}% melee damage against a foe that is looking away from you" },
  { key: "venom_blade", tree: "shadow", tier: 2, name: "Venom Blade", max: 3, per: 8, text: "{v}% chance a melee hit poisons the foe" },
  { key: "night_eyes", tree: "shadow", tier: 2, name: "Eyes of the Night", max: 1, per: 1, text: "Permanent Night Vision" },
  { key: "shadow_veil", tree: "shadow", tier: 3, name: "Shadow Veil", max: 1, per: 1, text: "You turn invisible while you sneak", needs: "fleet_foot" },
  { key: "flurry", tree: "shadow", tier: 3, name: "Flurry", max: 3, per: 5, text: "{v}% chance a hit strikes again at once for 60% of its damage" },
  { key: "cutthroat", tree: "shadow", tier: 3, name: "Cutthroat", max: 2, per: 1, text: "Critical hits heal you for {v} heart(s)" },
  { key: "assassinate", tree: "shadow", tier: 4, name: "Assassinate", max: 1, per: 1, text: "Hits on foes below 25% health have a 30% chance to slay them outright (not bosses)", needs: "backstab" },
  // ======================================================================= Faith
  { key: "blessed_body", tree: "faith", tier: 0, name: "Blessed Body", max: 5, per: 0.5, text: "Regain {v} health every 4 seconds" },
  { key: "holy_light", tree: "faith", tier: 0, name: "Holy Light", max: 5, per: 5, text: "+{v}% power for holy spells (healing and Holy Ray)" },
  { key: "smite", tree: "faith", tier: 1, name: "Smite the Undead", max: 5, per: 6, text: "+{v}% melee damage against the undead" },
  { key: "purity", tree: "faith", tier: 1, name: "Purity", max: 1, per: 1, text: "Poison, Wither, Nausea and Blindness are cleansed within seconds" },
  { key: "guardian_aura", tree: "faith", tier: 2, name: "Guardian Aura", max: 3, per: 1, text: "Every 4 seconds, other players and your companions within 8 blocks regain {v} health" },
  { key: "sacred_vow", tree: "faith", tier: 2, name: "Sacred Vow", max: 2, per: 2, text: "+{v} hearts" },
  { key: "sanctified", tree: "faith", tier: 2, name: "Sanctified Weapon", max: 3, per: 2, text: "Your melee hits set the undead and demons alight for {v} seconds" },
  { key: "divine_grace", tree: "faith", tier: 3, name: "Divine Grace", max: 1, per: 1, text: "Falling below 20% health heals you to half and gives Absorption II (once every 5 minutes)", needs: "blessed_body" },
  { key: "radiance", tree: "faith", tier: 3, name: "Radiance", max: 2, per: 2, text: "Each holy spell you cast also heals allies within 6 blocks for {v} hearts" },
  { key: "turn_undead", tree: "faith", tier: 3, name: "Turn Undead", max: 1, per: 1, text: "Every 8 seconds the undead within 6 blocks are weakened and slowed" },
  { key: "halo", tree: "faith", tier: 4, name: "Halo of the Six Gods", max: 1, per: 1, text: "You and your allies within 10 blocks keep Regeneration I, and holy spells gain +30% power", needs: "guardian_aura" },
  // ==================================================================== Dominion
  { key: "commander", tree: "dominion", tier: 0, name: "Commander", max: 5, per: 4, text: "Your companions' attacks are {v}% stronger" },
  { key: "dark_arts", tree: "dominion", tier: 0, name: "Dark Arts", max: 5, per: 4, text: "+{v}% power for dark spells" },
  { key: "veterans", tree: "dominion", tier: 1, name: "Veteran Retainers", max: 3, per: 2, text: "Your companions have +{v} hearts" },
  { key: "soul_harvest", tree: "dominion", tier: 1, name: "Soul Harvest", max: 5, per: 1, text: "Every kill restores {v} mana" },
  { key: "legion", tree: "dominion", tier: 2, name: "Legion", max: 2, per: 1, text: "Command {v} more summoned creature(s)", needs: "dark_arts" },
  { key: "war_drums", tree: "dominion", tier: 2, name: "War Drums", max: 3, per: 5, text: "Your companions attack {v}% more often" },
  { key: "despair_aura", tree: "dominion", tier: 2, name: "Despair Aura", max: 3, per: 1, text: "Monsters within {r} blocks of you are weakened" },
  { key: "loyalty", tree: "dominion", tier: 3, name: "Bonds of Loyalty", max: 2, per: 50, text: "Your bond with companions grows {v}% faster" },
  { key: "undying_legion", tree: "dominion", tier: 3, name: "Undying Legion", max: 2, per: 1, text: "Your summoned creatures gain {legion}" },
  { key: "presence", tree: "dominion", tier: 3, name: "Overlord's Presence", max: 3, per: 4, text: "+{v}% melee and spell damage while a companion or summon is within 12 blocks" },
  { key: "supreme_authority", tree: "dominion", tier: 4, name: "Authority of the Supreme Being", max: 1, per: 1, text: "Companions and summons within 16 blocks keep Strength I and Speed I, and companions' attacks are 25% stronger", needs: "commander" },
  // ===================================================================== Fortune
  { key: "quick_study", tree: "fortune", tier: 0, name: "Quick Study", max: 5, per: 4, text: "+{v}% XP" },
  { key: "gold_sense", tree: "fortune", tier: 0, name: "Gold Sense", max: 5, per: 5, text: "{v}% chance a kill drops a Gold Coin" },
  { key: "haggler", tree: "fortune", tier: 1, name: "Haggler", max: 3, per: 10, text: "Travel and weapon reinforcement cost {v}% less" },
  { key: "crystal_hunter", tree: "fortune", tier: 1, name: "Crystal Hunter", max: 3, per: 2, text: "{v}% chance a kill yields a Data Crystal" },
  { key: "bounty_hunter", tree: "fortune", tier: 2, name: "Bounty Hunter", max: 3, per: 15, text: "Cleared camps and daily bounties pay {v}% more gold" },
  { key: "provisions", tree: "fortune", tier: 2, name: "Well Provisioned", max: 2, per: 1, text: "Every minute you are fed a little ({v} hunger)" },
  { key: "scholar", tree: "fortune", tier: 2, name: "Scholar", max: 3, per: 25, text: "{v}% chance a cast counts twice towards spell mastery" },
  { key: "treasure_hunter", tree: "fortune", tier: 3, name: "Treasure Hunter", max: 2, per: 5, text: "Discovering a site gives {v} Gold Coins" },
  { key: "deaths_bargain", tree: "fortune", tier: 3, name: "Death's Bargain", max: 1, per: 1, text: "You lose no XP when you die" },
  { key: "windfall", tree: "fortune", tier: 3, name: "Windfall", max: 3, per: 2, text: "{v}% chance a kill gives triple XP" },
  { key: "midas", tree: "fortune", tier: 4, name: "Midas Touch", max: 1, per: 1, text: "Every kill has a 15% chance to drop 1-3 Gold Coins, and elites drop twice the gold", needs: "gold_sense" },
];

/** @type {Map<string, SkillNode>} */
export const BY_KEY = new Map(NODES.map((n) => [n.key, n]));

// ----------------------------------------------------------------- points

/** @typedef {{ level: number, skills: Record<string, number>, codex: number }} SkillHolder */

/** Rank of a node (0 when not learned). @param {SkillHolder} p @param {string} key */
export function rank(p, key) {
  const node = BY_KEY.get(key);
  const r = Number(p.skills?.[key]) || 0;
  return node ? Math.max(0, Math.min(node.max, Math.floor(r))) : 0;
}

/** The node's value at its current rank: `per` times the rank. @param {SkillHolder} p @param {string} key */
export function value(p, key) {
  const node = BY_KEY.get(key);
  return node ? node.per * rank(p, key) : 0;
}

/** Skill points earned from levels. @param {number} level */
export function pointsForLevel(level) {
  return Math.max(0, level - 1) + Math.floor(level / 10);
}

/** All skill points earned. @param {SkillHolder} p */
export function earned(p) {
  return pointsForLevel(p.level) + Math.min(MAX_CODEX, Math.max(0, p.codex || 0));
}

/** Points spent, in one path or in all. @param {SkillHolder} p @param {TreeKey} [tree] */
export function spent(p, tree) {
  let total = 0;
  for (const node of NODES) if (!tree || node.tree === tree) total += rank(p, node.key);
  return total;
}

/** Points free to spend (never below 0: levels lost to Longinus do not take learned skills away). @param {SkillHolder} p */
export function available(p) {
  return Math.max(0, earned(p) - spent(p));
}

/** Highest open tier of a path. @param {SkillHolder} p @param {TreeKey} tree */
export function openTier(p, tree) {
  const inTree = spent(p, tree);
  let tier = 0;
  for (let t = 0; t < TIER_POINTS.length; t++) if (inTree >= TIER_POINTS[t] && p.level >= TIER_LEVEL[t]) tier = t;
  return tier;
}

/**
 * Whether the next rank of a node can be learned now, and if not, why.
 * @param {SkillHolder} p @param {string} key
 * @returns {{ ok: boolean, reason: string }}
 */
export function check(p, key) {
  const node = BY_KEY.get(key);
  if (!node) return { ok: false, reason: "No such skill" };
  if (rank(p, key) >= node.max) return { ok: false, reason: "Mastered" };
  if (p.level < TIER_LEVEL[node.tier]) return { ok: false, reason: `Needs level ${TIER_LEVEL[node.tier]}` };
  const inTree = spent(p, node.tree);
  if (inTree < TIER_POINTS[node.tier]) return { ok: false, reason: `Needs ${TIER_POINTS[node.tier]} points in this path (${inTree} so far)` };
  if (node.needs && rank(p, node.needs) === 0) return { ok: false, reason: `Needs ${BY_KEY.get(node.needs)?.name}` };
  if (available(p) <= 0) return { ok: false, reason: "No skill points left" };
  return { ok: true, reason: "" };
}

/** Learns one rank of a node. Returns the reason it could not, or "" on success. @param {SkillHolder} p @param {string} key */
export function learn(p, key) {
  const verdict = check(p, key);
  if (!verdict.ok) return verdict.reason;
  if (!p.skills || typeof p.skills !== "object") p.skills = {};
  p.skills[key] = rank(p, key) + 1;
  return "";
}

/** Gold Coins it costs to unlearn everything. @param {SkillHolder} p */
export function unlearnCost(p) {
  return 10 + 2 * spent(p);
}

/** Forgets every node. Returns how many points came back. @param {SkillHolder} p */
export function unlearnAll(p) {
  const back = spent(p);
  p.skills = {};
  return back;
}

/** The description of a node at a rank, with its numbers filled in. @param {SkillNode} node @param {number} r */
export function describe(node, r) {
  const v = Math.round(node.per * r * 10) / 10;
  return node.text
    .replace("{v}", String(v))
    .replace("{w}", String(30 + 20 * r)) // Unyielding: 50% at rank 1, 70% at rank 2
    .replace("{r}", String(3 + 2 * r)) // Despair Aura: 5, 7 and 9 blocks
    .replace("{jump}", r >= 2 ? ", and Jump Boost I" : "")
    .replace("{legion}", r >= 2 ? "Strength I and Resistance I" : "Strength I");
}

// --------------------------------------------------------------- bonuses

/**
 * Extra melee damage, as a fraction of the blow.
 * @param {SkillHolder} p
 * @param {{ undead: boolean, foeHealth: number, ownHealth: number, behind: boolean, allies: boolean }} at
 */
export function meleeBonus(p, at) {
  let bonus = value(p, "weapon_mastery") / 100;
  if (at.foeHealth < 0.3) bonus += value(p, "executioner") / 100;
  if (at.ownHealth < 0.5) bonus += value(p, "battle_fury") / 100;
  if (at.undead) bonus += value(p, "smite") / 100;
  if (at.behind) bonus += value(p, "backstab") / 100;
  if (at.allies) bonus += value(p, "presence") / 100;
  return bonus;
}

/** Extra critical hit chance (0..1). @param {SkillHolder} p */
export function critChance(p) {
  return value(p, "keen_edge") / 100;
}

/** Extra damage a critical hit deals on top of the usual +50%. @param {SkillHolder} p */
export function critBonus(p) {
  return value(p, "lethal_strikes") / 100;
}

/** Tiers of Health Boost (two hearts each). @param {SkillHolder} p */
export function heartTiers(p) {
  return (value(p, "iron_body") + value(p, "sacred_vow")) / 2;
}

/** Extra tiers of Speed. @param {SkillHolder} p */
export function speedTiers(p) {
  return rank(p, "fleet_foot") > 0 ? 1 : 0;
}

/** @param {SkillHolder} p */
export function manaBonus(p) {
  return value(p, "deep_reserves");
}

/** Multiplier for mana recovery. @param {SkillHolder} p */
export function regenFactor(p) {
  return 1 + value(p, "mana_flow") / 100;
}

/** Extra spell power for every spell. @param {SkillHolder} p */
export function spellBonus(p) {
  return value(p, "arcane_study") / 100;
}

/** Extra spell power for one element. @param {SkillHolder} p @param {string} element */
export function elementBonus(p, element) {
  if (element === "fire" || element === "lightning") return value(p, "flame_thunder") / 100;
  if (element === "ice" || element === "acid") return value(p, "frost_venom") / 100;
  if (element === "holy") return value(p, "holy_light") / 100 + (rank(p, "halo") > 0 ? 0.3 : 0);
  if (element === "dark") return value(p, "dark_arts") / 100;
  return 0;
}

/** Multiplier for a spell's mana cost. @param {SkillHolder} p */
export function manaCostFactor(p) {
  return 1 - value(p, "efficient_casting") / 100;
}

/** Multiplier for a spell's cooldown. @param {SkillHolder} p */
export function cooldownFactor(p) {
  return 1 - value(p, "quick_chant") / 100;
}

/** Multiplier for XP earned. @param {SkillHolder} p */
export function xpFactor(p) {
  return 1 + value(p, "quick_study") / 100;
}

/** Multiplier for companions' attacks. @param {SkillHolder} p */
export function companionPower(p) {
  return (1 + value(p, "commander") / 100) * (rank(p, "supreme_authority") > 0 ? 1.25 : 1);
}

/** Multiplier for the time between companions' attacks. @param {SkillHolder} p */
export function companionHaste(p) {
  return 1 / (1 + value(p, "war_drums") / 100);
}

/** Tiers of Health Boost for companions (two hearts each). @param {SkillHolder} p */
export function companionHearts(p) {
  return value(p, "veterans") / 2;
}

/** Multiplier for how fast bonds grow. @param {SkillHolder} p */
export function bondFactor(p) {
  return 1 + value(p, "loyalty") / 100;
}

/** How many more summoned creatures may be commanded. @param {SkillHolder} p */
export function extraAllies(p) {
  return value(p, "legion");
}

/** A price after haggling (never below 1). @param {SkillHolder} p @param {number} price */
export function haggle(p, price) {
  return Math.max(1, Math.round(price * (1 - value(p, "haggler") / 100)));
}

/** Gold reward after Bounty Hunter. @param {SkillHolder} p @param {number} coins */
export function bounty(p, coins) {
  return Math.round(coins * (1 + value(p, "bounty_hunter") / 100));
}
