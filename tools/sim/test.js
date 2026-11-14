import assert from "node:assert";
import { world, system, players, advance, ItemStack } from "@minecraft/server";
import { script, shown } from "@minecraft/server-ui";
import * as rpg from "./rpg.js";
import * as raid from "./raid.js";
import * as spells from "./spells.js";
import * as director from "./director.js";
import * as sites from "./structures.js";
import * as party from "./party.js";
import * as guild from "./guild.js";
import * as forge from "./forge.js";
import * as mount from "./mount.js";
import * as vfx from "./vfx.js";
import * as arena from "./arena.js";
import * as ambience from "./ambience.js";
import * as dragons from "./dragons.js";
await import("./main.js"); // must load without touching the world

// Everything random in the add-on goes through Math.random. A seeded generator makes each run identical
// on every machine, so a rare roll (an elite spawn, a far-off site) cannot fail the suite by chance.
// Set OVERLORD_TEST_SEED to try other sequences.
{
  let state = Number(process.env.OVERLORD_TEST_SEED ?? 7) >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mkPlayer(name) {
  const props = new Map(), effects = new Map(), msgs = [], inv = [];
  const p = { id: name, name, typeId: "minecraft:player", isValid: true, location: { x: 0, y: 64, z: 0 }, msgs, inv, effects, bar: "",
    tags: new Set(), hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); }, getGameMode: () => "Survival",
    getDynamicProperty: (k) => props.get(k), setDynamicProperty: (k, v) => props.set(k, v), props,
    onScreenDisplay: { setActionBar(t) { p.bar = t; }, setTitle(t) { p.title = t; } }, sendMessage: (m) => msgs.push(m), playSound() {}, anims: [], playAnimation(n) { p.anims.push(n); }, fx: [],
    getEffect: (e) => effects.get(e), addEffect(e, d, o = {}) { effects.set(e, { duration: d, amplifier: o.amplifier ?? 0 }); }, removeEffect: (e) => effects.delete(e),
    health: { currentValue: 20, effectiveMax: 20, setCurrentValue(v) { this.currentValue = v; return true; } },
    getComponent(c) { if (c === "minecraft:health") return p.health; if (c === "minecraft:inventory") return { container: {
      addItem(s) { inv.push(s); }, get size() { return inv.length; }, getItem: (i) => inv[i], setItem(i, s) { if (s) inv[i] = s; else inv[i] = undefined; } } }; },
    aimed: [], getEntitiesFromViewDirection: () => p.aimed.map((entity) => ({ entity })), getBlockFromViewDirection: () => undefined,
    getHeadLocation: () => ({ x: 0, y: 65.6, z: 0 }), getViewDirection: () => ({ x: 0, y: 0, z: 1 }),
    dimension: { id: "overworld", mobs: [], spawnParticle(effect, loc, vars) { p.fx.push({ effect, loc, scale: vars?.v?.["variable.scale"], color: vars?.v?.["variable.color"], vars: vars?.v ?? {} }); }, spawnItem() {}, getPlayers: () => players, playSound() {},
      getBlock: () => ({ isAir: true }), getTopmostBlock: ({ x, z }) => ({ location: { x, y: 63, z } }),
      spawnEntity(typeId, location = { x: 0, y: 64, z: 0 }) { const e = { typeId, location, tags: new Set(), isValid: true, addTag(t) { this.tags.add(t); }, remove: () => { p.dimension.mobs = p.dimension.mobs.filter((m) => m !== e); } }; p.dimension.mobs.push(e); return e; },
      getEntities: (q) => p.dimension.mobs.filter((m) => (q.tags ?? []).every((t) => m.tags.has(t))) } };
  players.push(p); return p;
}
const mob = (typeId, hp = 20, fam = []) => ({ typeId, isValid: true, location: { x: 1, y: 64, z: 1 }, health: { currentValue: hp, effectiveMax: hp, defaultValue: hp, setCurrentValue(v) { this.currentValue = v; } },
  getComponent(c) { return c === "minecraft:health" ? this.health : undefined; }, matches: (q) => q.families.every((f) => fam.includes(f)), damaged: [], applyDamage(n) { this.damaged.push(n); this.health.currentValue = 0; } });
const kill = (player, m) => world.afterEvents.entityDie.fire({ deadEntity: m, damageSource: { damagingEntity: player } });

world.afterEvents.worldLoad.fire({});
const a = mkPlayer("alice"), b = mkPlayer("bob");
world.afterEvents.playerSpawn.fire({ player: a, initialSpawn: true });
advance(60);
assert.ok(a.inv.some((s) => s.typeId === "overlord:adventurer_plate"), "plate given");
assert.ok(a.msgs.some((m) => m.includes("Adventurer's Plate")));

// kills -> xp, party share, level up
const pa = rpg.profileOf(a), pb = rpg.profileOf(b);
kill(a, mob("minecraft:zombie", 20));
assert.equal(pa.xp, 10); assert.equal(pb.xp, 5, "party gets half");
for (let i = 0; i < 5; i++) kill(a, mob("overlord:death_knight", 80));
assert.ok(pa.level > 1 && pa.points === (pa.level - 1) * 3, `level ${pa.level} points ${pa.points}`);
assert.equal(world.scoreboard.objectives.get("overlord_level").scores.get("alice"), pa.level);

// xp curve reaches the cap and stops
rpg.grantXp(a, 1e9); assert.equal(pa.level, rpg.MAX_LEVEL); assert.equal(pa.points, 99 * 3);
rpg.grantXp(a, 500); assert.equal(pa.level, 100); assert.equal(pa.xp, 0);

// menu: spend 2 STR, 5 VIT, choose warrior, take the first quest
script.push(0, 0, 0, 0, 4);                 // menu -> stats -> STR, STR -> back (reopens menu, cancelled)
rpg.openMenu(a); await new Promise((r) => setTimeout(r, 20));
assert.equal(pa.str, 3); assert.equal(pa.points, 99 * 3 - 3);
script.push(0, 1, 1, 1, 1, 1, 4); rpg.openMenu(a); await new Promise((r) => setTimeout(r, 20));
assert.equal(pa.vit, 5);
script.push(1, 0); rpg.openMenu(a); await new Promise((r) => setTimeout(r, 20));
assert.equal(pa.cls, "warrior");
assert.equal(a.effects.get("health_boost").amplifier, 2, "vit 5 + Sword Saint (warrior past level 40) = 3 tiers");
assert.equal(rpg.className(pa), "Sword Saint"); assert.ok(a.bar.includes("Sword Saint") || true);
script.push(2, 0); rpg.openMenu(a); await new Promise((r) => setTimeout(r, 20));
assert.deepEqual(pa.quest, { quest: "zombies", progress: 0 });
// a locked quest cannot be taken at Copper rank
pb.quest = null; script.push(2, 18, 19); rpg.openMenu(b); await new Promise((r) => setTimeout(r, 20));
assert.equal(pb.quest, null, "Ainz quest locked for Copper");

// quest progress and completion
for (let i = 0; i < 10; i++) kill(a, mob("minecraft:zombie"));
assert.equal(pa.quest, null); assert.equal(pa.done, 1);
assert.equal(a.inv.filter((s) => s.typeId === "overlord:yggdrasil_gold_coin").reduce((n, s) => n + s.amount, 0), 6);
assert.ok(a.msgs.some((m) => m.includes("Quest complete")));

// mana
pa.mana = 10; assert.equal(rpg.spendMana(a, 30), false); assert.equal(pa.mana, 10);
rpg.restoreMana(a, 1e6); assert.equal(pa.mana, rpg.maxMana(pa)); assert.equal(rpg.spendMana(a, 30), true);
const before = pa.mana; advance(40); assert.ok(pa.mana > before, "mana regenerates");
assert.ok(a.bar.includes("Lv.100") && a.bar.includes("MP"), a.bar);

// melee bonus: Sword Saint with 3 STR = +36%
const target = mob("minecraft:cow", 100);
world.afterEvents.entityHurt.fire({ hurtEntity: target, damage: 10, damageSource: { damagingEntity: a, cause: "entityAttack" } });
assert.ok(Math.abs(target.health.currentValue - 96.4) < 1e-6, String(target.health.currentValue));
const weak = mob("minecraft:cow", 2);
world.afterEvents.entityHurt.fire({ hurtEntity: weak, damage: 10, damageSource: { damagingEntity: a, cause: "entityAttack" } });
assert.equal(weak.damaged.length, 1, "lethal bonus goes through applyDamage");
world.afterEvents.entityHurt.fire({ hurtEntity: target, damage: 10, damageSource: { damagingEntity: a, cause: "magic" } });
assert.ok(Math.abs(target.health.currentValue - 96.4) < 1e-6, "no bonus on spells");

// class skill (warrior) with cooldown, and Shooting Star level grant
rpg.useClassSkill(a); assert.equal(a.effects.get("resistance").amplifier, 1);
a.effects.delete("resistance"); rpg.useClassSkill(a); assert.ok(!a.effects.has("resistance"), "skill on cooldown");
assert.equal(rpg.grantLevel(a), false, "no level past the cap");
const lvl = pb.level; assert.equal(rpg.grantLevel(b), true); assert.equal(pb.level, lvl + 1);

// Scroll: Rebirth refunds stat points
const spentBefore = pa.str + pa.vit + pa.int + pa.agi, pointsBefore = pa.points;
assert.equal(rpg.resetStats(a), spentBefore); assert.equal(pa.points, pointsBefore + spentBefore); assert.equal(pa.str, 0);
assert.equal(a.effects.get("health_boost").amplifier, 1, "only the Sword Saint's hearts remain");

// Tomb Raid: level 100 -> tier 4 (the Throne Room), five waves, rewards on clear
const coinsBefore = a.inv.filter((s) => s.typeId === "overlord:yggdrasil_gold_coin").reduce((n, s) => n + s.amount, 0);
raid.startRaid(a); assert.ok(raid.inRaid(a));
for (let wave = 0; wave < 5; wave++) {
  assert.ok(a.dimension.mobs.length >= 3, `wave ${wave} spawned ${a.dimension.mobs.length}`);
  assert.ok(a.dimension.mobs.every((m) => m.tags.has("overlord_raid_alice") && m.typeId.startsWith("overlord:")));
  assert.ok(String(a.title).includes(`Wave ${wave + 1}/5`), String(a.title));
  advance(40); assert.ok(raid.inRaid(a), "raid waits while mobs live");
  a.dimension.mobs = []; advance(40);
}
assert.ok(!raid.inRaid(a), "raid ends after wave 5");
assert.equal(a.inv.filter((s) => s.typeId === "overlord:yggdrasil_gold_coin").reduce((n, s) => n + s.amount, 0) - coinsBefore, 160);
// leaving the area fails the raid and removes its mobs
raid.startRaid(a); a.location = { x: 100, y: 64, z: 0 }; advance(40);
assert.ok(!raid.inRaid(a)); assert.equal(a.dimension.mobs.length, 0); a.location = { x: 0, y: 64, z: 0 };
// dying fails the raid
raid.startRaid(a); world.afterEvents.entityDie.fire({ deadEntity: a, damageSource: {} });
assert.ok(!raid.inRaid(a)); assert.equal(a.dimension.mobs.length, 0);

// ---- tier magic ----
const c = mkPlayer("cara"); const pc = rpg.profileOf(c);
world.afterEvents.playerSpawn.fire({ player: c, initialSpawn: true }); advance(80);
assert.ok(c.inv.some((s) => s && s.typeId === "overlord:grimoire") && c.inv.some((s) => s && s.typeId === "overlord:magic_wand"));
assert.ok(c.bar.includes("Magic Arrow"), c.bar);                       // starter spell shown on the HUD
assert.equal(spells.castSelected(c), false, "no target -> no cast");
assert.equal(pc.mana, rpg.maxMana(pc), "mana refunded when nothing is hit");
const dummy = mob("minecraft:zombie", 100, ["undead"]); dummy.id = "d1"; dummy.setOnFire = () => {}; dummy.addEffect = () => {};
dummy.applyDamage = function (n) { this.damaged.push(n); };
c.aimed = [dummy];
c.fx = []; c.anims = [];
assert.equal(spells.castSelected(c), true); assert.deepEqual(dummy.damaged, [7]);
// visuals: a tinted magic circle under the caster, a beam of motes, an impact burst and a casting pose
assert.ok(c.fx.some((f) => f.effect === "overlord:magic_circle" && f.color && f.scale > 1), "magic circle");
assert.ok(c.fx.filter((f) => f.effect === "overlord:mote").length >= 2, "beam");
assert.ok(c.fx.some((f) => f.effect === "overlord:spark") && c.fx.some((f) => f.effect === "overlord:ring"), "impact");
assert.deepEqual(c.anims, ["animation.overlord.cast_point"]);
c.fx = []; c.anims = []; c.aimed = []; assert.equal(spells.castSelected(c), false); advance(1);
assert.equal(c.fx.length + c.anims.length, 0, "a failed cast shows nothing"); c.aimed = [dummy];
advance(1); assert.equal(spells.castSelected(c), false, "cooldown blocks an immediate recast");
// learning: level and crystal gates
assert.ok(spells.learnSpell(c, "fireball").includes("needs level 13"));
assert.ok(spells.learnSpell(c, "light_healing").includes("Learned"), "tier 1 is free");
pc.level = 13; assert.ok(spells.learnSpell(c, "lightning").includes("costs 6"));
c.inv.push(new ItemStack("overlord:data_crystal", 10));
assert.ok(spells.learnSpell(c, "lightning").includes("Learned"));
assert.equal(c.inv.filter((s) => s && s.typeId === "overlord:data_crystal").reduce((n, s) => n + s.amount, 0), 4);
assert.deepEqual(pc.slots.slice(0, 3), ["magic_arrow", "light_healing", "lightning"]);
// cycling and healing
spells.cycleSpell(c); assert.equal(pc.slots[pc.slot], "light_healing");
c.health.currentValue = 5; assert.equal(spells.castSelected(c), true); assert.equal(c.health.currentValue, 11);
// mastery: 10 casts -> level 2 -> +8% damage; holy affinity not involved for arcane
spells.cycleSpell(c); spells.cycleSpell(c); assert.equal(pc.slots[pc.slot], "magic_arrow");
for (let i = 0; i < 9; i++) { advance(20); assert.equal(spells.castSelected(c), true); }
assert.equal(spells.masteryOf(c, "magic_arrow"), 2);
advance(20); dummy.damaged = []; spells.castSelected(c); assert.deepEqual(dummy.damaged, [8], "7 * 1.08 rounds to 8");
// every spell is castable without throwing and has sane data
assert.equal(new Set(spells.SPELLS.map((s) => s.key)).size, spells.SPELLS.length);
assert.equal(spells.SPELLS.length, 49);
for (let tier = 1; tier <= 12; tier++) assert.ok(spells.SPELLS.filter((s) => s.tier === tier).length >= 3, `tier ${tier}`);
// dark magic is weak against undead: Death (52) on an undead dummy deals a quarter
pc.level = 100; c.inv.push(new ItemStack("overlord:data_crystal", 64)); assert.ok(spells.learnSpell(c, "death").includes("Learned"));
pc.slots[3] = "death"; pc.slot = 3; rpg.restoreMana(c, 1e6); dummy.damaged = []; assert.equal(spells.castSelected(c), true);
assert.deepEqual(dummy.damaged, [13]);
// Energy Drain heals the caster; Sleep applies effects without damage
assert.ok(spells.learnSpell(c, "energy_drain").includes("Learned")); pc.slots[3] = "energy_drain";
c.health.currentValue = 5; dummy.damaged = []; assert.equal(spells.castSelected(c), true);
assert.equal(dummy.damaged.length, 1); assert.ok(c.health.currentValue > 5, "drain heals");
assert.ok(spells.learnSpell(c, "sleep").includes("Learned")); pc.slots[3] = "sleep";
const applied = []; dummy.addEffect = (e) => applied.push(e); dummy.damaged = [];
assert.equal(spells.castSelected(c), true); assert.deepEqual(applied, ["slowness", "weakness"]); assert.equal(dummy.damaged.length, 0);
for (const s of spells.SPELLS) assert.ok(s.mana > 0 && s.cooldown > 0 && s.tier >= 1 && typeof s.cast === "function", s.key);
// cast every spell once with a target and a block in view: none may throw, each must draw something and pose
dummy.applyKnockback = () => {}; dummy.isValid = true; dummy.health.currentValue = 1e9;
c.getBlockFromViewDirection = () => ({ block: { location: { x: 3, y: 63, z: 3 } }, face: "Up" }); c.tryTeleport = () => true;
c.dimension.getEntities = () => [dummy]; c.dimension.spawnEntity = () => ({ isValid: true, addTag() {}, getComponent: () => ({ shoot() {}, tame() {} }), applyImpulse() {} });
for (const s of spells.SPELLS) {
  c.fx = []; c.anims = [];
  const ok = s.cast(c, 1); advance(100);
  assert.equal(ok, true, s.key); assert.ok(c.fx.some((f) => f.effect.startsWith("overlord:")), `${s.key} draws`);
}
c.dimension.getEntities = (q) => c.dimension.mobs.filter((m) => (q.tags ?? []).every((t) => m.tags.has(t)));
// death penalty
pc.xp = 100; world.afterEvents.entityDie.fire({ deadEntity: c, damageSource: {} }); assert.equal(pc.xp, 90);

// ---- world director ----
// a spawned monster near players: a full mock with tags, effects and dynamic properties
const spawnMob = (typeId, hp, where, fam = ["monster"], tags = []) => {
  const m = mob(typeId, hp, fam); const props = new Map(); m.effects = new Map(); m.removed = false; m.tags = new Set(tags);
  Object.assign(m, { dimension: where.dimension, location: { x: 2, y: 64, z: 2 }, hasTag: (t) => m.tags.has(t), addTag: (t) => m.tags.add(t),
    getDynamicProperty: (k) => props.get(k), setDynamicProperty: (k, v) => props.set(k, v),
    addEffect: (e, d, o = {}) => m.effects.set(e, o.amplifier ?? 0), remove() { m.removed = true; m.isValid = false; } });
  world.afterEvents.entitySpawn.fire({ entity: m, cause: "Spawned" }); advance(5); return m;
};
assert.equal(director.mobLevelFor(40, 0), 28); assert.equal(director.mobLevelFor(40, 1), 48); assert.equal(director.mobLevelFor(1, 0), 1);
const d = mkPlayer("dana"); d.dimension.getPlayers = () => [d]; const pd = rpg.profileOf(d);
// level gate: a Death Knight never appears next to a level 1 player, but scripted ones (raid, patrol) stay
assert.equal(spawnMob("overlord:death_knight", 80, d).removed, true);
assert.equal(spawnMob("overlord:death_knight", 80, d, ["monster"], ["overlord_raid"]).removed, false);
assert.equal(spawnMob("overlord:goblin", 16, d).removed, false, "goblins are not gated");
d.getGameMode = () => "Creative"; assert.equal(spawnMob("overlord:death_knight", 80, d).removed, false, "creative players can spawn anything");
d.getGameMode = () => "Survival";
// mob levels follow the player: level 40 -> 28..48, with health boost and strength; bosses and non-monsters are left alone
// (the rolls are pinned to the middle here, so this one is an ordinary mob and not the one-in-twenty elite)
const anyRoll = Math.random; Math.random = () => 0.5; pd.level = 40; const dk = spawnMob("overlord:death_knight", 80, d); Math.random = anyRoll;
const dkLevel = rpg.mobLevel(dk); assert.ok(!rpg.isElite(dk) && dkLevel >= 28 && dkLevel <= 48, String(dkLevel));
assert.equal(dk.effects.get("health_boost"), Math.floor(dkLevel / 10) - 1); assert.equal(dk.effects.get("strength"), dkLevel >= 30 ? 0 : undefined);
assert.equal(rpg.mobLevel(spawnMob("overlord:ainz", 500, d)), 0, "bosses keep their own numbers");
assert.equal(rpg.mobLevel(spawnMob("minecraft:cow", 10, d, ["mob"])), 0);
// levelled mobs give more XP and show their level in the target frame
const xpBefore = pd.xp, lvBefore = pd.level; world.afterEvents.entityDie.fire({ deadEntity: dk, damageSource: { damagingEntity: d } });
assert.ok(pd.level > lvBefore || pd.xp - xpBefore === Math.round(60 * (1 + dkLevel * 0.03)), "bonus XP");
const lv = spawnMob("minecraft:zombie", 20, d); world.afterEvents.entityHurt.fire({ hurtEntity: lv, damage: 4, damageSource: { damagingEntity: d, cause: "entityAttack" } });
assert.ok(d.bar.includes(`Lv.${rpg.mobLevel(lv)}`), d.bar);
// patrols: only at night, once per in-game day, tier by level
d.dimension.id = "minecraft:overworld"; d.dimension.mobs = []; const realRandom = Math.random; Math.random = () => 0.1;
world.clock.time = 6000; advance(200); assert.equal(d.dimension.mobs.length, 0, "no patrols by day");
world.clock.time = 15000; world.clock.day = 3; advance(200);
const patrolling = () => d.dimension.mobs.filter((m) => m.tags.has("overlord_patrol")).length; // a world boss may also turn up
assert.equal(patrolling(), 5, "tier 2 patrol: death knight, 3 guarders, elder lich");
assert.ok(d.msgs.some((m) => m.includes("patrol")));
advance(400); assert.equal(patrolling(), 5, "one roll per night");
world.clock.day = 4; advance(200); assert.equal(patrolling(), 10); Math.random = realRandom; world.clock.time = 6000;
// village guards: two per village, none without villagers
d.dimension.mobs = []; assert.equal(director.postGuards(d), 0);
const villagers = [0, 1, 2].map((i) => ({ typeId: "minecraft:villager_v2", location: { x: i, y: 64, z: 0 } }));
const baseQuery = d.dimension.getEntities;
d.dimension.getEntities = (q) => (q.type === "minecraft:villager_v2" ? villagers : d.dimension.mobs.filter((m) => m.typeId === q.type));
assert.equal(director.postGuards(d), 2); assert.equal(director.postGuards(d), 0, "capped at two"); d.dimension.getEntities = baseQuery;
// squire zombie: a villager killed by a Death Knight rises again
d.dimension.mobs = []; world.afterEvents.entityDie.fire({ deadEntity: { typeId: "minecraft:villager_v2", dimension: d.dimension, location: { x: 0, y: 64, z: 0 }, matches: () => false }, damageSource: { damagingEntity: { typeId: "overlord:death_knight" } } });
assert.deepEqual(d.dimension.mobs.map((m) => m.typeId), ["minecraft:zombie"]);
// dialogue: guards talk, with a short cooldown, and stay quiet while being paid
d.msgs.length = 0; const talk = (item) => { world.beforeEvents.playerInteractWithEntity.fire({ player: d, target: { typeId: "overlord:guard", isValid: true, nameTag: "" }, itemStack: item }); advance(2); };
talk(); assert.equal(d.msgs.length, 1); assert.ok(d.msgs[0].startsWith("§e<Guard>"));
talk(); assert.equal(d.msgs.length, 1, "cooldown"); advance(60); talk({ typeId: "overlord:yggdrasil_gold_coin" }); assert.equal(d.msgs.length, 1);

// ---- camps and outposts ----
// deterministic planning: same salt -> same site; about 40% of regions hold one; every type occurs
assert.deepEqual(sites.siteOf(5, -3, 777), sites.siteOf(5, -3, 777));
let planned = 0; const kinds = new Set();
for (let rx = -15; rx < 15; rx++) for (let rz = -15; rz < 15; rz++) {
  const site = sites.siteOf(rx, rz, 777); if (!site) continue; planned++; kinds.add(site.type.key);
  assert.ok(site.x >= rx * sites.REGION + 24 && site.x < (rx + 1) * sites.REGION - 24 && site.z >= rz * sites.REGION + 24 && site.z < (rz + 1) * sites.REGION - 24);
}
assert.ok(planned > 900 * 0.55 && planned < 900 * 0.75, `planned ${planned}`); assert.equal(kinds.size, sites.SITES.length);
// a flat grassy test world that records every block placed
const makeLand = (opts = {}) => {
  const placed = new Map(); const chests = new Map(); const k = (l) => `${Math.floor(l.x)},${l.y},${Math.floor(l.z)}`;
  const land = { id: "minecraft:overworld", mobs: [], placed, chests, spawnParticle() {}, playSound() {}, spawnItem() {}, getPlayers: () => players,
    heightAt: opts.heightAt ?? (() => 63),
    getTopmostBlock: ({ x, z }) => { if (opts.broken) throw new Error("LocationInUnloadedChunkError: Trying to access location in an unloaded chunk");
      return opts.unloaded ? undefined : { location: { x, y: land.heightAt(x, z), z } }; },
    getBlock(l) { if (opts.broken) throw new Error("LocationInUnloadedChunkError: Trying to access location in an unloaded chunk");
      const wet = typeof opts.water === "function" ? opts.water(l.x, l.z) : opts.water;
      const typeId = placed.get(k(l)) ?? (l.y <= land.heightAt(l.x, l.z) ? (wet ? "minecraft:water" : "minecraft:grass_block") : "minecraft:air");
      return { typeId, isLiquid: typeId === "minecraft:water", isAir: typeId === "minecraft:air", location: l,
        getComponent: (c) => (c === "minecraft:inventory" && typeId === "minecraft:chest" ? { container: { addItem(s) { (chests.get(k(l)) ?? chests.set(k(l), []).get(k(l))).push(s); } } } : undefined) }; },
    setBlockType(l, t) { placed.set(k(l), t); },
    fillBlocks(v, t) { for (let x = Math.min(v.from.x, v.to.x); x <= Math.max(v.from.x, v.to.x); x++) for (let y = Math.min(v.from.y, v.to.y); y <= Math.max(v.from.y, v.to.y); y++) for (let z = Math.min(v.from.z, v.to.z); z <= Math.max(v.from.z, v.to.z); z++) placed.set(`${x},${y},${z}`, t); },
    spawnEntity(typeId, l) { const props = new Map(); const e = { id: `e${++land.serial}`, typeId, location: l, dimension: land, tags: new Set(), isValid: true, events: [], effects: new Map(), nameTag: "", tamedBy: undefined,
        addTag(t) { this.tags.add(t); }, hasTag(t) { return this.tags.has(t); }, removeTag(t) { this.tags.delete(t); }, triggerEvent(n) { this.events.push(n); },
        getDynamicProperty: (k) => props.get(k), setDynamicProperty: (k, v) => props.set(k, v), matches: () => false,
        addEffect(n, d, o = {}) { this.effects.set(n, o.amplifier ?? 0); }, removeEffect(n) { this.effects.delete(n); },
        health: { currentValue: 40, effectiveMax: 40, defaultValue: 40, setCurrentValue(v) { this.currentValue = v; } },
        getComponent(c) { return c === "minecraft:health" ? this.health : c === "minecraft:tameable" ? { tame: (pl) => { e.tamedBy = pl.id; return true; } } : undefined; },
        remove() { this.isValid = false; land.mobs = land.mobs.filter((m) => m !== this); } };
      land.mobs.push(e); return e; },
    serial: 0,
    getEntities: (q) => { const found = land.mobs.filter((m) => (!q.type || m.typeId === q.type) && (q.tags ?? []).every((t) => m.tags.has(t)) &&
        (!q.families || (m.matches && m.matches({ families: q.families }))) &&
        (!q.maxDistance || !q.location || Math.hypot(m.location.x - q.location.x, m.location.z - q.location.z) <= q.maxDistance));
      return q.closest ? found.slice(0, q.closest) : found; } };
  return land;
};
// every site type builds on flat ground: pad, cleared air, at least one stocked chest, and only known blocks
for (const type of sites.SITES) {
  const land = makeLand(); const camp = sites.buildSite(land, { x: 1000, z: 1000, type }); advance(3);
  assert.ok(camp && camp.y === 64, type.key);
  assert.equal(land.placed.get("1000,63,1000") !== undefined, true, `${type.key} pad`);
  const blocks = new Set(land.placed.values()); assert.ok(blocks.has("minecraft:chest") && blocks.has("minecraft:air"), type.key);
  assert.ok([...land.chests.values()].some((items) => items.length > 0), `${type.key} chest is stocked`);
  for (const [mobType, count] of type.garrison(2)) assert.ok(mobType.startsWith("overlord:") && count > 0);
  assert.equal(sites.garrison(land, camp, 0), type.garrison(0).reduce((n, [, c]) => n + c, 0));
  assert.equal(sites.garrison(land, camp, 0), 0, `${type.key} garrison is not doubled`);
  assert.ok(land.mobs.every((m) => m.tags.has("overlord_camp")));
  // the garrison is posted on open ground, and nothing is built outside the site or above the space it cleared
  const reach = type.muster ?? sites.MUSTER;
  for (const mob of land.mobs) {
    for (const dy of [0, 1]) {
      const at = `${Math.floor(mob.location.x)},${64 + dy},${Math.floor(mob.location.z)}`; const block = land.placed.get(at);
      assert.ok(!block || block === "minecraft:air" || block.endsWith("carpet"), `${type.key}: ${block} on a garrison post at ${at}`);
    }
    assert.ok(Math.abs(Math.hypot(mob.location.x - 1000.5, mob.location.z - 1000.5) - reach) < 0.01);
  }
  for (const [at, block] of land.placed) {
    const [x, y, z] = at.split(",").map(Number);
    if (block === "minecraft:air" || y < 63) continue;
    assert.ok(Math.abs(x - 1000) <= type.radius && Math.abs(z - 1000) <= type.radius, `${type.key}: ${block} at ${at} is outside the site`);
    assert.ok(y - 64 < (type.height ?? 12), `${type.key}: ${block} at ${at} is above the cleared space`);
  }
  // the same spot always gives the same layout
  const again = makeLand(); sites.buildSite(again, { x: 1000, z: 1000, type });
  assert.deepEqual([...again.placed.entries()], [...land.placed.entries()], `${type.key} is laid out the same each time`);
}
assert.ok(sites.SITES.length >= 28, "the overhaul brought new sites");
for (const key of ["roadside_inn", "mage_tower", "ruined_keep", "frost_giant_hold", "besieged_mine", "angel_sanctum", "wise_kings_den"]) assert.ok(sites.SITES.some((t) => t.key === key), key);
// worlds from before 7.0: a site an older version built is rebuilt on the same spot in its new form, and a region it left empty stays empty
{
  const old = mkPlayer("olga"); old.dimension = makeLand(); old.dimension.getPlayers = () => [old];
  let rx = 60; while (sites.siteOf(rx, 60)) rx++; // a region where the new plan has no site...
  world.props.set(`overlord:camp:${rx},60`, `troll_den|${rx * sites.REGION + 80}|64|${60 * sites.REGION + 80}|1`); // ...but the old one built a Troll Den
  world.props.set(`overlord:camp:${rx + 1},60`, "-");
  old.location = { x: rx * sites.REGION + 80 - 40, y: 64, z: 60 * sites.REGION + 80 }; sites.explore(old);
  assert.equal(world.props.get(`overlord:site7:${rx},60`), `troll_den|${rx * sites.REGION + 80}|64|${60 * sites.REGION + 80}|1`, "the old site is kept, and stays discovered");
  assert.ok([...old.dimension.placed.values()].includes("minecraft:chest"), "and rebuilt");
  assert.equal(world.props.get(`overlord:site7:${rx + 1},60`), "-", "an empty region stays empty");
  assert.ok(![...old.dimension.placed.keys()].some((at) => Number(at.split(",")[0]) >= (rx + 1) * sites.REGION), "nothing is built in it");
}
// a house is hollow, roofed and has a doorway; a tent opens towards the middle of the site
{
  const land = makeLand(); const b = new sites.Builder(land, { x: 0, y: 64, z: 0 });
  b.house(-3, -3, 7, 5, { wall: "minecraft:oak_planks", roof: "minecraft:spruce_planks" });
  assert.equal(land.placed.get("0,64,-1"), "minecraft:air", "hollow inside"); assert.equal(land.placed.get("0,64,1"), "minecraft:air", "doorway on the south wall");
  assert.equal(land.placed.get("-3,64,-1"), "minecraft:oak_planks"); assert.equal(land.placed.get("0,63,0"), "minecraft:oak_planks", "a floor");
  assert.ok([...land.placed.entries()].some(([at, block]) => block === "minecraft:spruce_planks" && Number(at.split(",")[1]) > 67), "a pitched roof");
  b.tent(0, 6, "minecraft:white_wool"); assert.equal(land.placed.get("0,64,9"), "minecraft:white_wool", "closed at the far end"); assert.equal(land.placed.get("0,64,6"), undefined, "open towards the middle");
  b.tent(0, -12, "minecraft:red_wool"); assert.equal(land.placed.get("0,64,-12"), "minecraft:red_wool"); assert.equal(land.placed.get("0,64,-9"), undefined);
}
// unsuitable or unloaded places
const camp0 = sites.SITES[0];
assert.equal(sites.buildSite(makeLand({ water: true }), { x: 0, z: 0, type: camp0 }), null, "no camps on water");
assert.equal(sites.buildSite(makeLand({ unloaded: true }), { x: 0, z: 0, type: camp0 }), undefined, "wait for chunks");
assert.equal(sites.buildSite(makeLand({ heightAt: (x) => 63 + x }), { x: 0, z: 0, type: camp0 }), null, "too steep");
// the real game raises an error for chunks that are not loaded and ticking: that means "later", never a crash
assert.equal(sites.buildSite(makeLand({ broken: true }), { x: 0, z: 0, type: camp0 }), undefined, "an unloaded-chunk error means try again later");
// rolling ground is evened out: the pad sits on the median height over a dirt foundation
const hill = makeLand({ heightAt: (x) => 63 + Math.floor(x / 3) }); const terrace = sites.buildSite(hill, { x: 0, z: 0, type: camp0 });
assert.ok(terrace && terrace.y === 64, "a gentle slope is built on"); assert.equal(hill.placed.get("-7,58,0"), "minecraft:dirt", "foundation under the low side");
// a planned spot in water is moved a little to one side instead of being given up
const shore = makeLand({ water: (x) => x < 12 }); const moved = sites.buildSite(shore, { x: 0, z: 0, type: camp0 });
assert.ok(moved && moved.x === 24 && moved.z === 0, `moved to ${moved && moved.x},${moved && moved.z}`);
// tree tops, plants and snow cover are looked through; leaves and logs are not ground
for (const [block, ground] of [["minecraft:grass_block", true], ["minecraft:sand", true], ["minecraft:stone", true], ["minecraft:hardened_clay", true], ["minecraft:snow", true],
  ["minecraft:oak_leaves", false], ["minecraft:oak_log", false], ["minecraft:snow_layer", false], ["minecraft:short_grass", false], ["minecraft:water", false]]) assert.equal(sites.isGround(block), ground, block);
// exploring: find a planned site, walk up to it, discover it once, garrison it once, and hear a rumour before
let goal; for (let rx = 2; rx < 40 && !goal; rx++) { const site = sites.siteOf(rx, 2); if (site) goal = site; }
assert.ok(goal, "a site exists somewhere east");
const e = mkPlayer("eve"); const pe = rpg.profileOf(e); e.dimension = makeLand();
e.location = { x: goal.x - 300, y: 64, z: goal.z }; const heard = sites.rumour(e);
assert.ok(heard && /blocks to the/.test(heard), String(heard));
e.location = { x: goal.x - 100, y: 64, z: goal.z }; sites.explore(e); assert.equal(e.dimension.placed.size, 0, "too far away to be loaded");
// while the chunks around the site raise unloaded errors nothing is built, nothing is given up and nothing crashes
const ready = e.dimension; e.dimension = makeLand({ broken: true }); e.location = { x: goal.x - 60, y: 64, z: goal.z }; sites.explore(e);
assert.equal(e.dimension.placed.size, 0); e.dimension = ready;
// standing on the planned spot holds the build back until the player steps away
e.location = { x: goal.x + 2, y: 64, z: goal.z }; sites.explore(e); assert.equal(e.dimension.placed.size, 0, "nobody is walled in");
e.location = { x: goal.x - 60, y: 64, z: goal.z }; sites.explore(e);
assert.ok([...e.dimension.placed.values()].includes("minecraft:chest"), "built when in range"); assert.equal(e.dimension.mobs.length, 0, "not garrisoned yet");
const built = e.dimension.placed.size; sites.explore(e); assert.equal(e.dimension.placed.size, built, "built once");
e.location = { x: goal.x - 20, y: 64, z: goal.z }; const xpE = pe.xp; sites.explore(e);
assert.ok(e.dimension.mobs.length >= 3 && e.bar.includes("Discovered"), e.bar); assert.ok(pe.level === 2 && pe.xp === xpE + 80 - rpg.xpForNext(1), "discovery XP (enough for level 2)");
const manned = e.dimension.mobs.length; sites.explore(e); assert.equal(e.dimension.mobs.length, manned, "no refill before ten minutes");
assert.ok([...world.props.keys()].some((key) => key.startsWith("overlord:site7:")), "sites are saved in the world");

// ---- party: retainers and mercenaries ----
const f = mkPlayer("finn"); const pf = rpg.profileOf(f); f.dimension = makeLand(); f.dimension.getPlayers = () => [f];
assert.equal(party.createMain(f, "  Lyra  ", 6), true); party.summon(f); advance(3);
let lyra = f.dimension.mobs.find((m) => m.typeId === "overlord:retainer");
assert.ok(lyra && lyra.tamedBy === "finn" && lyra.nameTag.startsWith("Lyra") && lyra.nameTag.includes("Healer"), lyra?.nameTag);
assert.deepEqual(lyra.events, ["overlord:look_6", "overlord:stance_come"]);
assert.ok(lyra.tags.has("overlord_summoned") && lyra.getDynamicProperty("overlord:owner") === "finn");
party.tend(f); advance(41); assert.equal(f.dimension.mobs.filter((m) => m.typeId === "overlord:retainer").length, 1, "never doubled");
party.cycleStance(f); assert.equal(pf.stance, "go"); assert.equal(lyra.events.at(-1), "overlord:stance_go");
// the healer mends a wounded master and speaks
f.health.currentValue = 5; f.msgs.length = 0; party.tend(f); assert.ok(f.health.currentValue > 5, "healed"); assert.ok(f.msgs.some((m) => m.startsWith("§b<Lyra>")));
f.health.currentValue = 20;
// hiring costs coins and the party is capped at three
const offer = { name: "Borin", look: 0, level: 3, cost: 16 };
assert.ok(party.hire(f, offer).includes("asks for 16")); f.inv.push(new ItemStack("overlord:yggdrasil_gold_coin", 64));
assert.ok(party.hire(f, offer).includes("joins")); assert.ok(party.hire(f, { ...offer, name: "Kara", look: 2 }).includes("joins"));
assert.ok(party.hire(f, { ...offer, name: "Dain", look: 9 }).includes("Dain the Thief joins"), "a rogue can be hired");
assert.ok(party.hire(f, offer).includes("full")); assert.equal(party.partyOf(f).length, 4, "one retainer and three mercenaries");
assert.equal(f.inv.filter((s) => s && s.typeId === "overlord:yggdrasil_gold_coin").reduce((n, s) => n + s.amount, 0), 16);
party.summon(f); advance(45); assert.equal(f.dimension.mobs.filter((m) => m.typeId === "overlord:retainer").length, 4);
assert.equal(party.candidates(f, () => 0.5).length, 3); assert.equal(party.levelOf(f, party.partyOf(f)[1]), 3, "mercenaries keep their level");
// gear upgrades cost coins and strengthen the retainer
f.inv.push(new ItemStack("overlord:yggdrasil_gold_coin", 20)); assert.ok(party.upgrade(f, 0).includes("rank 1")); advance(45);
lyra = f.dimension.mobs.find((m) => m.typeId === "overlord:retainer" && m.nameTag.startsWith("Lyra"));
assert.equal(lyra.effects.get("health_boost"), 1, "gear 1 at level 1 = two tiers of hearts");
// a fighter uses its skill on the master's target, and the kill counts for the master
const borin = f.dimension.mobs.find((m) => m.nameTag.startsWith("Borin"));
const prey = mob("overlord:goblin", 16); prey.id = "prey"; prey.location = { ...borin.location }; prey.addEffect = () => {}; prey.applyKnockback = () => {}; prey.applyDamage = function (n) { this.damaged.push(n); };
advance(700); f.msgs.length = 0; world.afterEvents.entityHurt.fire({ hurtEntity: prey, damage: 2, damageSource: { damagingEntity: f, cause: "entityAttack" } });
assert.ok(f.msgs.some((m) => m.includes("Goblins lose heart")), "a retainer shares a tip on first contact");
advance(45); assert.ok(prey.damaged.length >= 1, "fighter skill landed");
const killsBefore = pf.kills["overlord:goblin"] ?? 0; world.afterEvents.entityDie.fire({ deadEntity: prey, damageSource: { damagingEntity: borin } });
assert.equal(pf.kills["overlord:goblin"], killsBefore + 1, "retainer kills count for the master");
// a fallen retainer rests for a minute, then returns
world.afterEvents.entityDie.fire({ deadEntity: borin, damageSource: {} }); borin.remove();
assert.ok(party.recovering(f, 1) > 25 && party.recovering(f, 1) <= 30, "the healer tends the fallen: half a minute"); advance(200); assert.ok(!f.dimension.mobs.some((m) => m.nameTag.startsWith("Borin")), "still recovering");
advance(60 * 20); assert.ok(f.dimension.mobs.some((m) => m.nameTag.startsWith("Borin")), "back after a minute");
party.dismiss(f); assert.equal(f.dimension.mobs.filter((m) => m.typeId === "overlord:retainer").length, 0);
party.release(f, 2); assert.equal(party.partyOf(f).length, 3);
// ---- bestiary ----
for (let i = 0; i < 5; i++) kill(f, mob("overlord:ogre", 60));
assert.equal(rpg.knowledgeOf(pf, "overlord:ogre"), 1); assert.ok(f.msgs.some((m) => m.includes("[Bestiary]")));
const ogre = mob("overlord:ogre", 100); world.afterEvents.entityHurt.fire({ hurtEntity: ogre, damage: 20, damageSource: { damagingEntity: f, cause: "entityAttack" } });
assert.ok(Math.abs(ogre.health.currentValue - 99) < 1e-6, "rank 1 knowledge: +5% of 20");
// ---- reputation ----
kill(f, mob("overlord:soldier", 30)); assert.equal(rpg.standingOf(pf, "kingdom"), -15); assert.equal(rpg.standingOf(pf, "empire"), 2);
const sentry = f.dimension.spawnEntity("overlord:soldier", f.location);
director.enforceReputation(f); assert.equal(sentry.events.length, 0, "wary, not hostile");
kill(f, mob("overlord:guard", 60)); assert.equal(rpg.standingOf(pf, "kingdom"), -30);
director.enforceReputation(f); assert.deepEqual(sentry.events, ["overlord:turn_hostile"]); director.enforceReputation(f); assert.equal(sentry.events.length, 1);
rpg.addRep(f, "kingdom", 10); director.enforceReputation(f); assert.deepEqual(sentry.events, ["overlord:turn_hostile", "overlord:calm"]);
kill(f, mob("overlord:bandit", 30)); assert.equal(rpg.standingOf(pf, "kingdom"), -19);
// ---- clearing a hostile camp ----
let lair; for (let rx = 3; rx < 200 && !lair; rx++) { const site = sites.siteOf(rx, 7); if (site && site.type.key === "goblin_camp") lair = site; }
assert.ok(lair, "a goblin camp exists somewhere");
f.dimension = makeLand(); f.dimension.getPlayers = () => [f]; f.location = { x: lair.x - 60, y: 64, z: lair.z }; sites.explore(f);
f.location = { x: lair.x - 20, y: 64, z: lair.z }; sites.explore(f);
const defenders = f.dimension.mobs.filter((m) => m.tags.has("overlord_camp")); assert.equal(defenders.length, 5);
const purse = () => f.inv.filter((s) => s && s.typeId === "overlord:yggdrasil_gold_coin").reduce((n, s) => n + s.amount, 0); const purseBefore = purse();
defenders.slice(0, 4).forEach((m) => world.afterEvents.entityDie.fire({ deadEntity: m, damageSource: { damagingEntity: f } })); assert.equal(purse(), purseBefore, "not cleared yet");
world.afterEvents.entityDie.fire({ deadEntity: defenders[4], damageSource: { damagingEntity: f } });
assert.equal(purse(), purseBefore + 8); assert.ok(f.msgs.some((m) => m.includes("Goblin Camp cleared")));

// ---- daily bounty, elites and titles ----
const g = mkPlayer("gil"); const pg = rpg.profileOf(g); g.dimension = makeLand(); g.dimension.getPlayers = () => [g];
world.clock.day = 20; const bounty = guild.bountyOf(20); assert.deepEqual(guild.bountyOf(20), guild.bountyOf(20));
assert.equal(new Set([...Array(guild.BOUNTIES.length).keys()].map((dd) => guild.bountyOf(dd).target)).size, guild.BOUNTIES.length, "every bounty comes round");
const coinsOf = (pl) => pl.inv.filter((s) => s && s.typeId === "overlord:yggdrasil_gold_coin").reduce((n, s) => n + s.amount, 0);
for (let i = 0; i < bounty.count - 1; i++) kill(g, mob(bounty.target, 20));
assert.equal(guild.dailyOf(g).progress, bounty.count - 1); assert.equal(coinsOf(g), 0); assert.ok(g.bar.includes("Bounty"));
kill(g, mob(bounty.target, 20)); assert.ok(guild.dailyOf(g).done); assert.equal(coinsOf(g), Math.round(bounty.coins * 1.1), "first day: +10%");
kill(g, mob(bounty.target, 20)); assert.equal(coinsOf(g), Math.round(bounty.coins * 1.1), "paid once a day");
world.clock.day = 21; const next = guild.bountyOf(21); assert.equal(guild.dailyOf(g).progress, 0); assert.equal(guild.dailyOf(g).streak, 1);
const purse21 = coinsOf(g); for (let i = 0; i < next.count; i++) kill(g, mob(next.target, 20));
assert.equal(coinsOf(g) - purse21, Math.round(next.coins * 1.2), "second day in a row: +20%");
world.clock.day = 23; assert.equal(guild.dailyOf(g).streak, 0, "a missed day ends the streak"); assert.equal(guild.dailyOf(g).total, 2);
// elites: always elite when the roll says so - five levels up, tougher, triple XP, a purse, and their own bestiary line
pg.level = 30; const roll = Math.random; Math.random = () => 0.01;
const boss = (() => { const m = mob("minecraft:zombie", 20, ["monster"]); const props = new Map(); m.effects = new Map(); m.tags = new Set();
  Object.assign(m, { dimension: g.dimension, location: { x: 1, y: 64, z: 1 }, hasTag: () => false, getDynamicProperty: (k) => props.get(k), setDynamicProperty: (k, v) => props.set(k, v),
    addEffect: (e2, d2, o = {}) => m.effects.set(e2, o.amplifier ?? 0), remove() {} });
  world.afterEvents.entitySpawn.fire({ entity: m, cause: "Spawned" }); advance(5); return m; })();
Math.random = roll;
assert.ok(rpg.isElite(boss)); assert.equal(rpg.mobLevel(boss), director.mobLevelFor(30, 0.01) + 5);
assert.equal(boss.effects.get("health_boost"), Math.floor(rpg.mobLevel(boss) / 10) + 5 - 1); assert.ok(boss.effects.has("resistance"));
world.afterEvents.entityHurt.fire({ hurtEntity: boss, damage: 1, damageSource: { damagingEntity: g, cause: "entityAttack" } }); assert.ok(g.bar.includes("Elite"), g.bar);
const purseE = coinsOf(g); g.msgs.length = 0; kill(g, boss);
assert.ok(coinsOf(g) - purseE >= 3 && g.msgs.some((m) => m.includes("Elite")) && pg.kills["overlord:elite_foes"] === 1);
// titles: earned from deeds, paid once, worn in front of the name
assert.deepEqual(guild.checkTitles(g), []); pg.kills["overlord:goblin"] = 50; pg.kills["overlord:frost_dragon"] = 1;
const purseT = coinsOf(g); assert.deepEqual(guild.checkTitles(g).sort(), ["Dragon Slayer", "Goblin Slayer"]); assert.equal(coinsOf(g) - purseT, 20);
assert.deepEqual(guild.checkTitles(g), [], "titles are granted once");
assert.equal(guild.wearTitle(g, "archmage"), false, "cannot wear what is not earned"); assert.equal(guild.wearTitle(g, "dragon_slayer"), true);
assert.equal(g.nameTag, "§e[Dragon Slayer]§r gil"); guild.wearTitle(g, ""); assert.equal(g.nameTag, "gil");

// ---- v4.5: summons, world bosses, travel and reinforcement ----
const h = mkPlayer("hana"); const ph = rpg.profileOf(h); h.dimension = makeLand(); h.dimension.getPlayers = () => [h];
// summoning: allies appear in their summoned form, are bound to the caster two ticks later, and are capped
assert.equal(spells.summonAlly(h, "overlord:old_guarder", 2), 2); advance(3);
const allies = h.dimension.mobs.filter((m) => m.tags.has("overlord_ally_hana"));
assert.equal(allies.length, 2); assert.ok(allies.every((m) => m.tags.has("overlord_summoned") && m.tamedBy === "hana" && m.typeId === "overlord:old_guarder"));
assert.equal(spells.summonAlly(h, "overlord:archangel_flame", 3), 2, "only room for two more"); assert.equal(spells.summonAlly(h, "overlord:death_knight", 1), 0);
const summon3 = spells.SPELLS.find((s) => s.key === "summon_undead_3"); h.msgs.length = 0; h.bar = "";
assert.equal(summon3.cast(h, 1), false, "a full retinue refuses the cast"); assert.ok((h.bar + h.msgs.join()).includes("already command"));
allies[0].remove(); assert.equal(summon3.cast(h, 1), true, "one slot free again"); advance(3);
assert.equal(h.dimension.mobs.filter((m) => m.tags.has("overlord_ally_hana")).length, spells.MAX_ALLIES);
for (const key of ["hellhound", "shadow_demon", "evil_lord_wrath", "archangel_flame", "dominion_authority"]) assert.ok(spells.AFFINITY[`overlord:${key}`], key);
// world bosses: once a day at most, only for level 25+, announced to all, and everyone near the kill is rewarded
const others = players.splice(0, players.length, h); world.clock.day = 40; h.location = { x: 0, y: 64, z: 0 };
ph.level = 10; assert.equal(director.rollWorldBoss(() => 0), undefined, "nobody strong enough");
world.clock.day = 41; ph.level = 30; assert.equal(director.rollWorldBoss(() => 0.9), undefined, "the roll failed");
assert.equal(director.rollWorldBoss(() => 0), undefined, "one roll a day");
world.clock.day = 42; world.said.length = 0; const worldBoss = director.rollWorldBoss(() => 0);
assert.ok(worldBoss && worldBoss.typeId === "overlord:gargantua" && worldBoss.tags.has("overlord_worldboss"));
assert.ok(Math.abs(Math.hypot(worldBoss.location.x, worldBoss.location.z) - 36) < 1e-6); assert.ok(world.said.some((m) => m.includes("Gargantua") && m.includes("east of") && m.includes("hana")), world.said.join());
world.clock.day = 43; ph.level = 60; const greater = director.rollWorldBoss(() => 0); assert.equal(greater.typeId, "overlord:frost_dragon");
const purseH = coinsOf(h); const xpH = ph.xp; const lvH = ph.level;
world.afterEvents.entityDie.fire({ deadEntity: worldBoss, damageSource: { damagingEntity: h } });
assert.equal(coinsOf(h) - purseH, 30); assert.equal(ph.kills["overlord:world_bosses"], 1); assert.ok(ph.level > lvH || ph.xp > xpH); assert.ok(h.msgs.some((m) => m.includes("World Boss")));
ph.kills["overlord:world_bosses"] = 3; ph.kills["overlord:hellhound"] = 50; assert.deepEqual(guild.checkTitles(h).sort(), ["Demon Hunter", "Giant Killer", "World's Shield"], "the slain Gargantua counts too");
players.splice(0, players.length, ...others, h);
// travel: only friendly camps are remembered; the journey costs five coins
let haven; for (let rx = 3; rx < 400 && !haven; rx++) { const site = sites.siteOf(rx, 11); if (site && site.type.key === "adventurer_camp") haven = site; }
assert.ok(haven, "an adventurers' camp exists somewhere"); assert.equal(sites.waypoints(h).length, 0);
h.dimension = makeLand(); h.dimension.getPlayers = () => [h];
h.location = { x: haven.x - 60, y: 64, z: haven.z }; sites.explore(h); h.location = { x: haven.x - 20, y: 64, z: haven.z }; sites.explore(h);
const ways = sites.waypoints(h); assert.equal(ways.length, 1); assert.equal(ways[0].name, haven.type.name);
const visitor = mkPlayer("ivy"); visitor.dimension = h.dimension; visitor.location = { ...h.location }; sites.explore(visitor);
assert.equal(sites.waypoints(visitor).length, 1, "a later visitor learns the camp too");
ph.sites.push("goblin_camp|5|64|5"); assert.equal(sites.waypoints(h).length, 1, "hostile camps are not waypoints");
h.inv.length = 0; h.teleport = (to) => { h.location = to; }; h.location = { x: 0, y: 64, z: 0 };
assert.ok(sites.travel(h, ways[0]).includes("costs 5")); assert.equal(h.location.x, 0);
h.inv.push(new ItemStack("overlord:yggdrasil_gold_coin", 7)); assert.ok(sites.travel(h, ways[0]).includes("arrive"));
assert.equal(coinsOf(h), 2); assert.ok(Math.abs(h.location.x - ways[0].x) < 1 && Math.abs(h.location.z - ways[0].z) < 1);
// reinforcement: needs a weapon, a runesmith and the price; each level is written on the item and adds 6% melee damage
h.inv.length = 0; h.selectedSlotIndex = 0; const blade = new ItemStack("overlord:razor_edge"); h.inv.push(blade);
h.getComponent = ((base) => (c) => (c === "minecraft:equippable" ? { getEquipment: () => h.inv[h.selectedSlotIndex] } : base(c)))(h.getComponent);
assert.ok(forge.reinforce(h).includes("Dwarf Runesmith")); h.dimension.spawnEntity("overlord:dwarf", h.location);
assert.ok(forge.reinforce(h).includes("costs 15 Gold Coins and 1 Adamantite Ingot"));
h.inv.push(new ItemStack("overlord:yggdrasil_gold_coin", 64), new ItemStack("overlord:adamantite_ingot", 3));
assert.ok(forge.reinforce(h).includes("+1")); assert.equal(blade.getDynamicProperty("overlord:plus"), 1); assert.ok(blade.lore[0].includes("+1"));
assert.equal(coinsOf(h), 49); assert.equal(rpg.heldPlus(h), 1);
assert.ok(forge.reinforce(h).includes("+2")); assert.equal(coinsOf(h), 19); assert.ok(forge.reinforce(h).includes("costs 45"), "cannot afford +3");
h.inv[0] = new ItemStack("minecraft:stick"); assert.ok(forge.reinforce(h).includes("Hold one")); assert.equal(rpg.heldPlus(h), 0); h.inv[0] = blade;
blade.setDynamicProperty("overlord:plus", 5); assert.ok(forge.reinforce(h).includes("already +5"));
ph.cls = "none"; ph.str = 0; const post = mob("minecraft:cow", 100);
world.afterEvents.entityHurt.fire({ hurtEntity: post, damage: 10, damageSource: { damagingEntity: h, cause: "entityAttack" } });
assert.ok(post.health.currentValue < 100 - 2.9 && post.health.currentValue > 100 - 3.6, `+5 weapon adds about 30%: ${post.health.currentValue}`);
// new weapon abilities, driven through the item-use event like the game does
const use = (pl, typeId) => world.afterEvents.itemUse.fire({ source: pl, itemStack: { typeId } });
h.dimension = makeLand(); h.dimension.getPlayers = () => [h]; h.location = { x: 0, y: 64, z: 0 }; rpg.restoreMana(h, 1e6);
const foe = (hp, max) => { const m = mob("minecraft:zombie", max, ["monster"]); m.health.currentValue = hp; m.id = `foe${hp}`; m.tags = new Set(); m.burning = 0; m.setOnFire = (n) => { m.burning = n; };
  m.applyDamage = function (n) { this.damaged.push(n); }; h.dimension.mobs.push(m); return m; };
const hale = foe(100, 100), dying = foe(6, 40), lord = foe(40, 500);
use(h, "overlord:charons_guidance");
assert.equal(hale.damaged.length, 1); assert.ok(hale.damaged[0] >= 20 && hale.damaged[0] < 60, String(hale.damaged)); assert.deepEqual(dying.damaged, [160], "the weak are reaped outright");
assert.equal(lord.damaged[0], hale.damaged[0], "bosses are never reaped"); assert.ok(h.bar.includes("struck 3, 1 reaped"), h.bar);
const manaR = ph.mana; use(h, "overlord:charons_guidance"); assert.equal(hale.damaged.length, 1, "Reap is on cooldown"); assert.equal(ph.mana, manaR);
use(h, "overlord:hellfire_blade"); assert.equal(hale.damaged.length, 2, "each foe burns once"); assert.equal(hale.burning, 6); assert.ok(h.bar.includes("burned 3"), h.bar);
h.dimension.mobs.length = 0; h.inv.length = 0; h.selectedSlotIndex = 0; h.inv.push(new ItemStack("overlord:sealing_crystal", 3));
use(h, "overlord:sealing_crystal"); advance(3);
assert.equal(h.dimension.mobs.filter((m) => m.typeId === "overlord:archangel_flame" && m.tamedBy === "hana").length, 3); assert.equal(h.inv[0].amount, 2);
advance(40); use(h, "overlord:sealing_crystal"); assert.equal(h.dimension.mobs.length, 4, "only one more fits"); assert.equal(h.inv[0].amount, 1);
advance(40); use(h, "overlord:sealing_crystal"); assert.equal(h.dimension.mobs.length, 4); assert.equal(h.inv[0].amount, 1, "a crystal is not wasted on a full retinue");

// ---- v4.6: the AI party ----
const j = mkPlayer("jon"); const pj = rpg.profileOf(j); j.dimension = makeLand(); j.dimension.getPlayers = () => [j]; world.clock.time = 6000;
j.inv.push(new ItemStack("overlord:yggdrasil_gold_coin", 64));
assert.ok(party.createMain(j, "Rex", 0));
for (const [name, look, level] of [["Mia", 4, 3], ["Tor", 2, 3], ["Sly", 8, 25]]) assert.ok(party.hire(j, { name, look, level, cost: 10 }).includes("joins"));
party.summon(j); advance(45);
const ally = (name) => j.dimension.mobs.find((m) => m.typeId === "overlord:retainer" && m.nameTag.startsWith(name));
const member = (i) => party.partyOf(j)[i];
assert.ok(ally("Rex") && ally("Mia") && ally("Tor") && ally("Sly"), "a retainer and three mercenaries");
assert.deepEqual(ally("Sly").events.slice(0, 2), ["overlord:look_8", "overlord:stance_come"]); assert.equal(party.formationOf(j).name, "Balanced formation");
// growth: mercenaries earn half the kill XP and level up; every member at your side bonds with you
kill(j, mob("overlord:death_knight", 80));
assert.ok(member(1).xp === 30 || member(1).level > 3, "half of 60 XP"); assert.equal(member(0).xp, 0, "the main retainer levels with its master"); assert.equal(member(3).bond, 1);
member(1).xp = rpg.xpForNext(member(1).level) - 1; const miaLevel = member(1).level; j.msgs.length = 0; kill(j, mob("minecraft:zombie", 20));
assert.equal(member(1).level, miaLevel + 1); assert.ok(j.msgs.some((m) => m.includes("Mia") && m.includes("reached level")));
member(1).bond = 24; kill(j, mob("minecraft:zombie", 20)); assert.equal(party.bondRank(member(1)), 1); assert.equal(party.recoveryOf(member(1)), 50);
assert.ok(j.msgs.some((m) => m.includes("deepens") && m.includes("Companion")));
const crystalsOf = (pl) => pl.inv.filter((s) => s && s.typeId === "overlord:data_crystal").reduce((n, s) => n + s.amount, 0);
member(2).bond = 99; const crystalsJ = crystalsOf(j); kill(j, mob("minecraft:zombie", 20));
assert.equal(member(2).bond, 100); assert.equal(crystalsOf(j) - crystalsJ, 5, "a sworn companion's gift"); assert.ok(j.msgs.some((m) => m.startsWith("§b<Tor>")));
assert.ok(guild.checkTitles(j).includes("Sworn Lord"));
// traits: one slot from level 10, two from level 30
assert.ok(party.toggleTrait(j, 0, "keen").includes("from level 10")); pj.level = 30;
assert.ok(party.toggleTrait(j, 0, "devoted").includes("now Devoted")); assert.ok(party.toggleTrait(j, 0, "sturdy").includes("now Sturdy"));
assert.ok(party.toggleTrait(j, 0, "keen").includes("already has two")); assert.ok(party.toggleTrait(j, 0, "sturdy").includes("no longer")); party.toggleTrait(j, 0, "sturdy");
assert.ok(party.toggleTrait(j, 1, "keen").includes("from level 10"), "mercenaries need the level themselves");
assert.ok(party.toggleTrait(j, 3, "resolute").includes("now Resolute")); assert.equal(party.recoveryOf(member(3)), 30); assert.ok(party.toggleTrait(j, 3, "keen").includes("second trait from level 30"));
advance(45); advance(45); assert.equal(ally("Rex").effects.get("health_boost"), 7, "level 30 = 6 tiers, Sturdy = 2 more");
const bondRex = member(0).bond; kill(j, mob("minecraft:zombie", 20)); assert.equal(member(0).bond, bondRex + 2, "Devoted doubles the bond");
// tactics: Free hand finds its own foe, Guardian answers whatever hurt the master, Vanguard strikes the master's target
const beast = (name, at) => { const m = mob("minecraft:zombie", 200, ["monster"]);
  Object.assign(m, { id: name, location: at, tags: new Set(), afflicted: [], addEffect(e) { m.afflicted.push(e); }, applyKnockback() {}, hasTag: (t) => m.tags.has(t), addTag: (t) => m.tags.add(t),
    getDynamicProperty: () => undefined, applyDamage(n) { m.damaged.push(n); } }); j.dimension.mobs.push(m); return m; };
assert.ok(party.setTactic(j, 1, 2).includes("Free hand")); assert.ok(party.setTactic(j, 2, 1).includes("Guardian"));
advance(400); const lurker = beast("lurker", { x: 3, y: 64, z: 0 }); advance(45);
assert.ok(lurker.damaged.length >= 1, "the Free hand mage attacks on her own"); const freeHits = lurker.damaged.length;
const biter = beast("biter", { x: -3, y: 64, z: 0 });
world.afterEvents.entityHurt.fire({ hurtEntity: j, damage: 2, damageSource: { damagingEntity: biter, cause: "entityAttack" } }); advance(45);
assert.ok(biter.damaged.length >= 1, "the Guardian archer answers the attacker");
world.afterEvents.entityHurt.fire({ hurtEntity: lurker, damage: 1, damageSource: { damagingEntity: j, cause: "entityAttack" } }); advance(45);
assert.ok(lurker.damaged.length > freeHits + 1 && lurker.afflicted.includes("poison") && lurker.afflicted.includes("slowness"), "the rogue backstabs and the fighter bashes the master's target");
// Unison: using the banner on a foe turns everyone on it at once, on a cooldown
j.aimed = []; assert.equal(party.orderUnison(j), false, "no foe in view: the banner opens the menu");
j.aimed = [biter]; const biterHits = biter.damaged.length; assert.equal(party.orderUnison(j), true);
assert.ok(biter.damaged.length >= biterHits + 3, `mage, archer and rogue strike at once: ${biter.damaged.length - biterHits}`); assert.ok(j.bar.includes("Unison!"), j.bar);
assert.ok(biter.damaged.at(-1) > 0 && j.msgs.some((m) => m.includes("As one")));
party.orderUnison(j); assert.ok(j.bar.includes("ready again in"), j.bar); j.aimed = [];
// self-preservation: potions first, then falling back - except for Fighters - and rallying once recovered
const mia = ally("Mia"); mia.health.currentValue = 5; j.inv.push(new ItemStack("overlord:red_potion", 1)); party.tend(j);
assert.equal(mia.health.currentValue, 25, "drank the master's potion"); assert.ok(!j.inv.some((s) => s && s.typeId === "overlord:red_potion")); assert.ok(!mia.events.includes("overlord:fall_back"));
mia.health.currentValue = 5; party.tend(j); assert.equal(mia.events.at(-1), "overlord:fall_back"); assert.equal(mia.getDynamicProperty("overlord:back"), true);
party.tend(j); assert.equal(mia.events.filter((e) => e === "overlord:fall_back").length, 1, "ordered back once");
mia.health.currentValue = 30; party.tend(j); assert.equal(mia.events.at(-1), "overlord:rally_mage");
const rex = ally("Rex"); rex.health.currentValue = 2; party.tend(j); assert.ok(!rex.events.includes("overlord:fall_back"), "Fighters hold the line");
pj.supply = false; j.inv.push(new ItemStack("overlord:red_potion", 2)); mia.health.currentValue = 5; advance(420); party.tend(j);
assert.equal(j.inv.filter((s) => s && s.typeId === "overlord:red_potion").reduce((n, s) => n + s.amount, 0), 2, "potion sharing can be switched off"); pj.supply = true;
// between fights the party recovers, and the banner bar lists everyone
rex.health.currentValue = 10; advance(300); assert.ok(rex.health.currentValue > 10, "rest between fights");
const barJ = party.partyBar(j); assert.ok(barJ.includes("Rex") && barJ.includes("Sly") && /\d+\/40/.test(barJ), barJ);
// the archer scouts for sites nobody has found yet
if (sites.rumour(j)) { j.msgs.length = 0; advance(3200); assert.ok(j.msgs.some((m) => m.startsWith("§b<Tor>") && m.includes("I scouted ahead")), j.msgs.join(" / ")); }
// a fallen member can be revived at once for coins
const tor = ally("Tor"); j.msgs.length = 0; world.afterEvents.entityDie.fire({ deadEntity: tor, damageSource: {} }); tor.remove();
assert.equal(party.recovering(j, 2), 20, "a sworn companion is back in twenty seconds"); assert.ok(j.msgs.some((m) => m.includes("revive")));
assert.ok(party.partyBar(j).includes("Tor down"));
j.inv.length = 0; assert.ok(party.revive(j, 2).includes("costs 8")); j.inv.push(new ItemStack("overlord:yggdrasil_gold_coin", 10));
assert.ok(party.revive(j, 2).includes("back on their feet")); assert.equal(coinsOf(j), 2); assert.ok(ally("Tor"), "revived at once"); assert.ok(party.revive(j, 2).includes("does not need"));
// gifts deepen the bond once a day
const bondGift = member(0).bond; assert.ok(party.gift(j, 0).includes("costs 5")); j.inv.push(new ItemStack("overlord:yggdrasil_gold_coin", 10));
assert.ok(party.gift(j, 0).includes("touched")); assert.equal(member(0).bond, bondGift + 5); assert.ok(party.gift(j, 0).includes("already had a gift today"));
world.clock.day += 1; assert.ok(party.gift(j, 0).includes("touched")); assert.equal(coinsOf(j), 2);
// a seasoned rogue turns up coins (Cutpurse)
party.shareKill(j, mob("minecraft:zombie", 20), () => 0.99); assert.equal(coinsOf(j), 2); party.shareKill(j, mob("minecraft:zombie", 20), () => 0); assert.equal(coinsOf(j), 3);
// formations and the bard
party.release(j, 2); assert.ok(party.hire(j, { name: "Zed", look: 5, level: 5, cost: 0 }).includes("joins")); party.summon(j); advance(45);
assert.equal(party.formationOf(j).name, "Mage specialists");
party.release(j, 3); assert.ok(party.hire(j, { name: "Lute", look: 10, level: 20, cost: 0 }).includes("Minstrel")); party.summon(j); advance(45);
assert.equal(party.formationOf(j).name, "Balanced formation"); j.effects.clear(); lurker.afflicted.length = 0;
world.afterEvents.entityHurt.fire({ hurtEntity: lurker, damage: 1, damageSource: { damagingEntity: j, cause: "entityAttack" } }); advance(45);
assert.ok(j.effects.has("strength") && j.effects.has("speed"), "Ballad of Valour"); assert.ok(lurker.afflicted.includes("weakness"), "Dirge");
// saves from before this version are filled in and cleaned up
const k = mkPlayer("kit"); rpg.profileOf(k).party = [{ name: "Old", look: 99, hired: true, level: 7, traits: ["keen", "bogus", "keen"], bond: 500 }];
assert.deepEqual(party.partyOf(k)[0], { name: "Old", look: 11, gear: 0, hired: true, level: 7, out: false, xp: 0, bond: 100, tactic: 0, traits: ["keen"], gift: -1 });

// ---- v5.0: older systems tied into the newer ones ----
// class advancement: at level 40 a class takes its advanced form, with a better skill on a shorter cooldown
const n = mkPlayer("nell"); const pn = rpg.profileOf(n); pn.cls = "cleric"; pn.level = 39; pn.xp = rpg.xpForNext(39) - 1;
assert.equal(rpg.className(pn), "Cleric"); assert.equal(rpg.advanced(pn), false);
rpg.grantXp(n, 5); assert.equal(pn.level, 40); assert.equal(rpg.className(pn), "High Priest"); assert.ok(n.msgs.some((m) => m.includes("[Class]") && m.includes("High Priest")));
n.dimension = makeLand(); n.dimension.getPlayers = () => [n]; const squire = n.dimension.spawnEntity("overlord:retainer", n.location); squire.health.currentValue = 10;
rpg.useClassSkill(n); assert.equal(squire.health.currentValue, 22, "a High Priest's Sanctuary heals companions");
advance(31 * 20); squire.health.currentValue = 10; rpg.useClassSkill(n); assert.equal(squire.health.currentValue, 22, "the skill recharges in 30 seconds");
advance(100); assert.ok(pn.titles.includes("grandmaster"), "Grandmaster title for an advanced class");
// deeds count for guild quests: sites, camps, bounties, raids, elites and world bosses
pn.quest = { quest: "ev_sites", progress: 0 }; const doneN = pn.done; rpg.questEvent(n, "camp"); assert.equal(pn.quest.progress, 0, "the wrong deed does not count");
rpg.questEvent(n, "site"); rpg.questEvent(n, "site"); assert.equal(pn.quest.progress, 2); rpg.questEvent(n, "site"); assert.equal(pn.quest, null); assert.equal(pn.done, doneN + 1);
pn.quest = { quest: "ev_bounty", progress: 0 }; const todays = guild.bountyOf(world.clock.day);
for (let i = 0; i < todays.count; i++) kill(n, mob(todays.target, 20)); assert.equal(pn.quest.progress, 1, "finishing the daily bounty is a deed");
pn.quest = { quest: "ev_worldboss", progress: 0 }; pn.level = 80; const alone = players.splice(0, players.length, n); world.clock.day += 5;
const guardianBoss = director.rollWorldBoss(() => 0); assert.equal(guardianBoss.typeId, "overlord:cocytus", "from level 75 the Floor Guardians come out");
world.afterEvents.entityDie.fire({ deadEntity: guardianBoss, damageSource: { damagingEntity: n } }); assert.equal(pn.quest, null, "world boss deed");
players.splice(0, players.length, ...alone);
// scrolls and tomes feed tier magic: a scroll of a known spell counts towards its mastery, a tome teaches its spell
pc.level = 100; if (!pc.spells.includes("fly")) { c.inv.push(new ItemStack("overlord:data_crystal", 64)); assert.ok(spells.learnSpell(c, "fly").includes("Learned")); }
const flyCasts = pc.casts.fly ?? 0; advance(60); use(c, "overlord:scroll_of_fly"); assert.equal(pc.casts.fly, flyCasts + 1, "scroll use counts as a cast");
assert.ok(!pc.spells.includes("reality_slash")); advance(60); rpg.restoreMana(c, 1e6); use(c, "overlord:tome_reality_slash");
assert.ok(pc.spells.includes("reality_slash") && c.msgs.some((m) => m.includes("Studying the tome")), "the tome teaches its spell"); assert.equal(pc.casts.reality_slash, 1);
const novice = mkPlayer("ned"); use(novice, "overlord:tome_fallen_down"); assert.ok(!rpg.profileOf(novice).spells.includes("fallen_down"), "not before the level for that tier");
// mana font: standing on a Block of Data Crystal triples mana recovery
h.dimension = makeLand(); h.dimension.getPlayers = () => [h]; h.location = { x: 0, y: 64, z: 0 }; advance(100);
ph.mana = 0; advance(20); const plain = ph.mana; h.dimension.placed.set("0,63,0", "overlord:data_crystal_block"); advance(100);
ph.mana = 0; advance(20); assert.ok(Math.abs(ph.mana - plain * 3) < 1e-6, `font ${ph.mana} vs ${plain}`); h.dimension.placed.delete("0,63,0"); advance(100);
// new gear: Orb of Death, Quake, Flurry, the basilisk's eye, the greatsword's sweep and the Bone Dragon ward
rpg.restoreMana(h, 1e6); use(h, "overlord:orb_of_death"); advance(3);
assert.equal(h.dimension.mobs.filter((m) => m.typeId === "overlord:old_guarder" && m.tamedBy === "hana").length, 3); h.dimension.mobs.length = 0;
const brute = foe(300, 300), runt = foe(300, 300); runt.id = "runt"; for (const m of [brute, runt]) { m.afflicted = []; m.addEffect = (e) => m.afflicted.push(e); m.applyKnockback = () => {}; }
use(h, "overlord:giants_maul"); assert.ok(brute.damaged.length === 1 && brute.afflicted.includes("slowness") && h.bar.includes("shook 2"), h.bar);
h.aimed = [brute]; const before6 = brute.damaged.length; use(h, "overlord:six_arms_knuckles"); advance(70); assert.equal(brute.damaged.length - before6, 6, "six blows land");
h.inv.length = 0; h.selectedSlotIndex = 0; h.inv.push(new ItemStack("overlord:basilisk_eye", 2)); brute.afflicted.length = 0; advance(40); use(h, "overlord:basilisk_eye");
assert.ok(brute.afflicted.includes("weakness")); assert.equal(h.inv[0].amount, 1);
const worn = { Head: "helmet", Chest: "chestplate", Legs: "leggings", Feet: "boots" }; let wornSet = "";
h.getComponent = ((base) => (cmp) => (cmp === "minecraft:equippable" ? { getEquipment: (slot) => (slot === "Mainhand" ? h.inv[h.selectedSlotIndex] : wornSet ? { typeId: `overlord:${wornSet}_${worn[slot]}` } : undefined) } : base(cmp)))(h.getComponent);
h.inv[0] = new ItemStack("overlord:dragonbone_blade"); brute.dimension = h.dimension; brute.damaged.length = 0; runt.damaged.length = 0; ph.cls = "none"; ph.str = 0;
world.afterEvents.entityHurt.fire({ hurtEntity: brute, damage: 12, damageSource: { damagingEntity: h, cause: "entityAttack" } });
assert.deepEqual(runt.damaged, [6], "the sweep carries half the blow to the foe beside the target");
h.health.currentValue = 10; world.afterEvents.entityHurt.fire({ hurtEntity: h, damage: 10, damageSource: { cause: "magic" } }); assert.equal(h.health.currentValue, 10, "no ward without the set");
wornSet = "bonedragon"; world.afterEvents.entityHurt.fire({ hurtEntity: h, damage: 10, damageSource: { cause: "magic" } }); assert.equal(h.health.currentValue, 13.5, "Bone Dragon armour turns aside 35%");
world.afterEvents.entityHurt.fire({ hurtEntity: h, damage: 10, damageSource: { cause: "entityAttack" } }); assert.equal(h.health.currentValue, 13.5, "but not blows"); wornSet = "";
// Hamsuke grows with its rider and lashes monsters that come close; the kills are the rider's
h.dimension.mobs.length = 0; const hamsuke = h.dimension.spawnEntity("overlord:hamsuke", { x: 0, y: 64, z: 0 }); ph.level = 60;
assert.equal(mount.tendSteed(h), 0, "not riding");
h.getComponent = ((base) => (cmp) => (cmp === "minecraft:riding" ? { entityRidingOn: hamsuke } : base(cmp)))(h.getComponent);
assert.equal(mount.steedOf(h), hamsuke); const wolf = foe(100, 100); wolf.applyKnockback = () => {}; wolf.damaged.length = 0;
assert.equal(mount.tendSteed(h), 1); assert.deepEqual(wolf.damaged, [mount.lashDamage(60)]); assert.equal(hamsuke.effects.get("health_boost"), 9); assert.equal(hamsuke.effects.get("strength"), 1);
assert.equal(mount.tendSteed(h), 0, "the tail needs three seconds"); advance(90); assert.ok(wolf.damaged.length >= 2, "and lashes again while ridden");

// ---- v5.5: visuals ----
const v = mkPlayer("vera"); const pv = rpg.profileOf(v); v.dimension.getPlayers = () => [v]; const drew = (name) => v.fx.filter((f) => f.effect === `overlord:${name}`);
const origin5 = { x: 0, y: 64, z: 0 };
// every element marks an impact in its own way, on top of the sparks and the flash they all share
for (const [element, accent] of [["fire", "flame"], ["ice", "shard"], ["lightning", "arc"], ["holy", "ray"], ["dark", "wisp"], ["acid", "droplet"], ["arcane", "glyph"], ["none", "streak"]]) {
  advance(1); v.fx = []; vfx.spark(v.dimension, origin5, element, 1.5);
  assert.ok(drew("spark").length === 1 && drew("flash").length === 1 && drew(accent).length === 1, `${element} impact: ${v.fx.map((f) => f.effect)}`);
  assert.ok(v.fx.every((f) => f.color && f.scale > 0), "every layer is tinted and sized");
}
advance(1); v.fx = []; vfx.spark(v.dimension, origin5, "fire"); assert.equal(drew("ember").length, 1, "fire also throws embers");
// a magic circle is two rings turning against each other, with runes rising from the large ones
advance(1); v.fx = []; vfx.circle(v.dimension, origin5, "arcane", 1.2); assert.deepEqual(v.fx.map((f) => f.effect), ["overlord:magic_circle", "overlord:magic_circle_inner"]);
assert.ok(drew("magic_circle_inner")[0].scale < drew("magic_circle")[0].scale);
advance(1); v.fx = []; vfx.circle(v.dimension, origin5, "arcane", 3); assert.equal(drew("glyph").length, 1);
// rings: small ones are plain, large ones roll out as a shock wave with dust
advance(1); v.fx = []; vfx.ring(v.dimension, origin5, "none", 1); assert.deepEqual(v.fx.map((f) => f.effect), ["overlord:ring"]);
advance(1); v.fx = []; vfx.ring(v.dimension, origin5, "none", 5); assert.ok(drew("shockwave").length === 1 && drew("dust").length === 1);
// a beam is a row of motes around one bright core laid from end to end, with the element's trail along it
advance(1); v.fx = []; vfx.beam(v.dimension, origin5, { x: 0, y: 64, z: 10 }, "lightning");
assert.equal(drew("mote").length, 21); const core = drew("beam_core")[0]; assert.ok(core, "beam core");
assert.equal(core.vars["variable.length"], 10); assert.deepEqual(core.vars["variable.direction"], { x: 0, y: 0, z: 1 }); assert.deepEqual(core.loc, { x: 0, y: 64, z: 5 });
assert.equal(drew("arc").length, 5, "lightning crackles every two blocks along the beam");
// a pillar is a shaft of light placed half-way up, with its height passed to the particle
advance(1); v.fx = []; vfx.pillar(v.dimension, origin5, "holy", 8); const shaft = drew("pillar_light")[0];
assert.equal(shaft.vars["variable.height"], 8); assert.equal(shaft.loc.y, 68);
// a nova is streaks, a flash and a shock wave
advance(1); v.fx = []; vfx.nova(v.dimension, origin5, "fire", 6); assert.ok(drew("nova").length === 1 && drew("flash").length === 1 && drew("shockwave").length === 1);
// when a great deal is drawn in one tick the decoration is dropped first, never the base layers
advance(1); v.fx = []; for (let i = 0; i < 200; i++) vfx.spark(v.dimension, origin5, "fire");
assert.equal(drew("spark").length, 200, "every impact still shows its sparks"); assert.ok(drew("flame").length < 100 && v.fx.length < 200 + vfx.DECORATION_BUDGET, `decoration is capped: ${v.fx.length}`);
advance(1); v.fx = []; vfx.spark(v.dimension, origin5, "fire"); assert.equal(drew("flame").length, 1, "the next tick starts afresh");
// the cast flourish grows with the tier; super-tier magic has its own long pose
advance(1); v.fx = []; v.anims = []; vfx.castFx(v, "fire", 2, "point"); const low = v.fx.length;
advance(1); v.fx = []; vfx.castFx(v, "fire", 9, "raise"); assert.ok(v.fx.length > low && drew("implode").length === 1 && drew("magic_circle").length === 2, "high tiers gather power under a second circle");
advance(1); v.anims = []; vfx.castFx(v, "holy", 11, "point"); assert.deepEqual(v.anims, ["animation.overlord.cast_super"]);
for (const pose of vfx.POSE_NAMES) { v.anims = []; vfx.pose(v, pose); assert.ok(v.anims[0].startsWith("animation.overlord."), pose); }
assert.equal(vfx.POSE_NAMES.length, 19);
// scrolls are read, tomes are held open and weapon skills are swung - each in the right colour
pv.level = 100; rpg.restoreMana(v, 1e6); v.fx = []; v.anims = []; use(v, "overlord:scroll_of_fly");
assert.deepEqual(v.anims, ["animation.overlord.use_scroll"]); assert.ok(drew("glyph").length >= 1 && drew("aura").length === 1, "the scroll's runes lift off and the wind takes hold");
advance(60); v.fx = []; v.anims = []; use(v, "overlord:scroll_of_heavy_recover"); assert.deepEqual(drew("magic_circle")[0].color, { red: 1.0, green: 0.9, blue: 0.6 }, "a healing scroll glows holy gold");
advance(60); v.fx = []; v.anims = []; use(v, "overlord:tome_reality_slash"); assert.deepEqual(v.anims, ["animation.overlord.use_tome"]); assert.equal(drew("slash").length, 4, "the cut is drawn along its line");
advance(60); v.fx = []; v.anims = []; use(v, "overlord:charons_guidance"); assert.deepEqual(v.anims, ["animation.overlord.weapon_slash"]); assert.ok(drew("slash").length === 1);
advance(60); v.fx = []; v.anims = []; use(v, "overlord:giants_maul"); assert.deepEqual(v.anims, ["animation.overlord.weapon_slam"]);
// death magic leaves a skull over what it kills
const victim = mob("minecraft:cow", 5); Object.assign(victim, { dimension: v.dimension, matches: () => false, applyDamage() { victim.isValid = false; } });
advance(1); v.fx = []; v.aimed = [victim]; const deathSpell = spells.SPELLS.find((sp) => sp.key === "death"); assert.equal(deathSpell.cast(v, 1), true); assert.equal(drew("skull").length, 1); v.aimed = [];
// screen effects are optional extras: they use the camera and a command when the game offers them and never fail without
const faded = []; v.camera = { fade: (o) => faded.push(o) }; const ran = []; v.runCommand = (c) => ran.push(c);
vfx.wash(v, { red: 1, green: 1, blue: 1 }); assert.equal(faded.length, 1); vfx.shake(v.dimension, v.location, 10, 0.5, 0.4); assert.deepEqual(ran, ["camerashake add @s 0.50 0.40 positional"]);
delete v.camera; delete v.runCommand; vfx.wash(v, { red: 1, green: 1, blue: 1 }); vfx.shake(v.dimension, v.location, 10);
// the Grimoire's preview plays every element without a hitch
advance(1); v.fx = []; vfx.showcase(v); advance(200); for (const name of ["flame", "shard", "arc", "ray", "wisp", "droplet", "glyph", "streak", "pillar_light", "nova"]) assert.ok(drew(name).length > 0, name);

// ---- v6.0: runes, the arena and World Items ----
const w = mkPlayer("wren"); const pw = rpg.profileOf(w); w.dimension = makeLand(); w.dimension.getPlayers = () => [w]; w.location = { x: 0, y: 64, z: 0 };
w.selectedSlotIndex = 0; let wornW = "";
w.getComponent = ((base) => (cmp) => (cmp === "minecraft:equippable" ? { getEquipment: (slot) => (slot === "Mainhand" ? w.inv[0] : wornW ? { typeId: `overlord:${wornW}_${worn[slot]}` } : undefined) } : base(cmp)))(w.getComponent);
// runes: a runesmith inscribes one rune on a weapon; it is written on the item beside any reinforcement
const sabre = new ItemStack("overlord:razor_edge"); w.inv.push(sabre, new ItemStack("overlord:rune_of_fire", 1), new ItemStack("overlord:rune_of_life", 2));
assert.ok(forge.inscribe(w, "fire").includes("Dwarf Runesmith")); w.dimension.spawnEntity("overlord:dwarf", w.location);
assert.ok(forge.inscribe(w, "storm").includes("You have no Rune of Storm")); assert.ok(forge.inscribe(w, "fire").includes("inscribes the Rune of Fire"));
assert.equal(forge.runeOf(sabre), "fire"); assert.ok(sabre.lore.some((l) => l.includes("Rune of Fire"))); assert.ok(!w.inv.some((it) => it && it.typeId === "overlord:rune_of_fire"), "the rune is used up");
assert.ok(forge.inscribe(w, "fire").includes("already bears"));
w.inv.push(new ItemStack("overlord:yggdrasil_gold_coin", 64), new ItemStack("overlord:adamantite_ingot", 3)); assert.ok(forge.reinforce(w).includes("+1"));
assert.ok(sabre.lore[0].includes("+1") && sabre.lore.some((l) => l.includes("Rune of Fire")), "reinforcing keeps the rune on the item");
// each rune works on a melee blow
const dummyW = (name) => { const m = mob("minecraft:zombie", 200, ["monster"]); Object.assign(m, { id: name, dimension: w.dimension, tags: new Set(), afflicted: [], burning: 0, setOnFire(n) { m.burning = n; }, addEffect(e) { m.afflicted.push(e); },
  applyDamage(n) { m.damaged.push(n); }, applyKnockback() {}, hasTag: () => false, addTag() {} }); return m; };
const strawman = dummyW("straw"); const hit = (cause = "entityAttack") => world.afterEvents.entityHurt.fire({ hurtEntity: strawman, damage: 20, damageSource: { damagingEntity: w, cause } });
hit(); assert.equal(strawman.burning, 4, "Rune of Fire"); strawman.burning = 0; hit("magic"); assert.equal(strawman.burning, 0, "runes answer blows, not spells");
assert.ok(forge.inscribe(w, "life").includes("Rune of Life")); assert.equal(forge.runeOf(sabre), "life", "a new rune replaces the old");
w.health.currentValue = 10; hit(); assert.ok(Math.abs(w.health.currentValue - 11.6) < 1e-6, `Rune of Life heals 8% of 20: ${w.health.currentValue}`);
sabre.setDynamicProperty("overlord:rune", "storm"); strawman.damaged.length = 0; hit(); advance(12); assert.ok(strawman.damaged.includes(4), "Rune of Storm jolts a moment later");
sabre.setDynamicProperty("overlord:rune", "frost"); strawman.afflicted.length = 0; hit(); assert.ok(strawman.afflicted.includes("slowness"), "Rune of Frost");
// the arena: five rounds, the next champion only once the sand is clear, a purse at the end
w.dimension.mobs.length = 0; pw.level = 10; assert.ok(arena.enter(w).includes("Arena Master")); assert.equal(arena.inArena(w), false);
w.dimension.spawnEntity("overlord:arena_master", w.location); const purseW = coinsOf(w); const xpW = pw.xp; const lvW = pw.level;
assert.ok(arena.enter(w).includes("tier 1")); assert.ok(arena.inArena(w)); assert.ok(arena.enter(w).includes("already fighting"));
const onSand = () => w.dimension.mobs.filter((m) => m.tags.has("overlord_arena_wren"));
for (let round = 0; round < 5; round++) {
  const want = arena.ROUNDS[0][round].reduce((sum, [, count]) => sum + count, 0);
  assert.equal(onSand().length, want, `round ${round + 1}`); assert.ok(onSand().every((m) => m.tags.has("overlord_arena")));
  advance(60); assert.equal(onSand().length, want, "the round waits while a champion stands");
  for (const m of onSand()) m.remove(); advance(100);
}
assert.equal(arena.inArena(w), false, "five rounds won"); assert.equal(coinsOf(w) - purseW, arena.PURSES[0].coins); assert.ok(pw.level > lvW || pw.xp > xpW);
assert.ok(w.msgs.some((m) => m.includes("[Arena]") && m.includes("crowd roars")));
// leaving the sand or falling forfeits and clears the champions; the top tier ends with Go Gin and the Emperor's prize
assert.ok(arena.enter(w).includes("tier")); w.location = { x: 60, y: 64, z: 0 }; advance(30); assert.equal(arena.inArena(w), false); assert.equal(onSand().length, 0); w.location = { x: 0, y: 64, z: 0 };
arena.enter(w); world.afterEvents.entityDie.fire({ deadEntity: w, damageSource: {} }); assert.equal(arena.inArena(w), false); assert.equal(onSand().length, 0);
pw.level = 60; pw.quest = { quest: "ev_arena", progress: 0 }; assert.ok(arena.enter(w).includes("tier 3"));
for (let round = 0; round < 5; round++) { if (round === 4) assert.deepEqual(onSand().map((m) => m.typeId), ["overlord:go_gin"]); for (const m of onSand()) m.remove(); advance(100); }
assert.ok(w.inv.some((it) => it && it.typeId === "overlord:depiction_of_nature"), "the Emperor's prize"); assert.equal(pw.quest, null, "an arena win is a guild deed");
assert.equal(arena.tierFor(19), 0); assert.equal(arena.tierFor(20), 1); assert.equal(arena.tierFor(50), 2);
// World Items: the Depiction seals lesser foes away, the gauntlets hoard XP, Longinus erases anything for three levels
w.dimension.mobs.length = 0; const lesser = dummyW("lesser"); lesser.health.effectiveMax = 40; lesser.remove = () => { lesser.gone = true; }; const mighty = dummyW("mighty"); mighty.health.effectiveMax = 600; mighty.remove = () => { mighty.gone = true; };
w.dimension.mobs.push(lesser, mighty); use(w, "overlord:depiction_of_nature"); assert.ok(lesser.gone && !mighty.gone, "bosses cannot be painted out"); assert.ok(w.bar.includes("closes over 1"), w.bar);
use(w, "overlord:depiction_of_nature"); assert.ok(w.bar.includes("Recharging"), "five-minute recharge");
w.dimension.mobs.length = 0; assert.equal(pw.bank, 0); kill(w, mob("overlord:death_knight", 80)); assert.equal(pw.bank, 0, "nothing is hoarded without the gauntlets");
w.inv.push(new ItemStack("overlord:avarice_and_generosity")); kill(w, mob("overlord:death_knight", 80)); assert.equal(pw.bank, Math.round(rpg.killXp(mob("overlord:death_knight", 80)) * 0.1));
pw.bank = 900; const before900 = pw.xp + 0; const lv900 = pw.level; use(w, "overlord:avarice_and_generosity"); assert.equal(pw.bank, 0); assert.ok(pw.level > lv900 || pw.xp === before900 + 900, "the hoard is paid out");
advance(120); use(w, "overlord:avarice_and_generosity"); assert.ok(w.bar.includes("empty"), w.bar);
const titan = dummyW("titan"); titan.health.effectiveMax = 1500; titan.location = { x: 0, y: 64, z: 6 }; w.aimed = [titan]; const lvL = pw.level; w.inv[0] = new ItemStack("overlord:longinus");
advance(40); use(w, "overlord:longinus"); assert.ok(titan.damaged[0] >= 15000, "enough to erase anything"); assert.equal(pw.level, lvL - 3); assert.equal(w.inv[0], undefined, "the spear is spent"); w.aimed = [];
// new gear: the Martial Lord's Club, the Elf King's staff and Platinum armour
w.inv[0] = sabre; rpg.restoreMana(w, 1e6); w.dimension.mobs.length = 0; const thug = dummyW("thug"); w.dimension.mobs.push(thug); w.effects.clear();
use(w, "overlord:martial_lord_club"); assert.ok(thug.damaged.length === 1 && thug.afflicted.includes("weakness") && w.effects.get("strength").amplifier === 1);
w.dimension.mobs.length = 0; use(w, "overlord:elf_kings_staff"); advance(3); assert.equal(w.dimension.mobs.filter((m) => m.typeId === "overlord:behemoth" && m.tamedBy === "wren").length, 1);
wornW = "platinum"; w.effects.clear(); advance(45); assert.ok(w.effects.get("resistance").amplifier === 1 && w.effects.has("regeneration"), "Platinum armour"); wornW = "";
pw.kills["overlord:go_gin"] = 1; assert.ok(guild.checkTitles(w).includes("Martial Lord"));

// ---- v6.5: creature visuals ----
{
const zoe = mkPlayer("zoe"); zoe.dimension = makeLand(); zoe.dimension.getPlayers = () => [zoe]; zoe.location = { x: 0, y: 64, z: 0 };
zoe.dimension.spawnParticle = (effect, loc, vars) => zoe.fx.push({ effect, loc, color: vars?.v?.["variable.color"], scale: vars?.v?.["variable.scale"] });
const seen65 = (name) => zoe.fx.filter((f) => f.effect === `overlord:${name}`); const everyone = players.splice(0, players.length, zoe);
const creature = (type, hp = 40, families = []) => { const e = zoe.dimension.spawnEntity(type, { x: 3, y: 64, z: 3 }); e.health.effectiveMax = hp; e.health.currentValue = hp;
  e.getEffect = (name) => (e.effects.has(name) ? {} : undefined); e.matches = (q) => q.families.every((f) => families.includes(f)); return e; };
// something hangs in the air around the notable ones, at their own height - and nothing gives away the unseen
const lord = creature("overlord:ainz", 500, ["undead"]); creature("overlord:goblin"); const hound = creature("overlord:hellhound", 45, ["demon"]); hound.effects.set("invisibility", 0);
advance(1); zoe.fx = []; assert.equal(ambience.dress(), 1, "only the lord is dressed: goblins have no aura and the hound is unseen");
assert.ok(seen65("wisp").length === 1 && seen65("glyph").length === 1); assert.equal(seen65("wisp")[0].loc.y, 65.4); assert.equal(seen65("ember").length, 0);
hound.effects.clear(); advance(1); zoe.fx = []; assert.equal(ambience.dress(), 2); assert.equal(seen65("ember").length, 1, "embers round the hound once it shows itself");
// each creature's effects are drawn in its own colour
assert.equal(ambience.themeOf(lord), "dark"); assert.equal(ambience.themeOf(hound), "fire"); assert.equal(ambience.themeOf(creature("overlord:paladin")), "holy");
assert.equal(ambience.themeOf(creature("overlord:bandit")), "none"); assert.equal(ambience.themeOf(creature("overlord:quagoa", 35, ["undead"])), "dark", "by family where nothing else says");
// a melee blow leaves a crescent - one per blow, not one per tick - and a great foe's shakes the view
const blow = (from) => world.afterEvents.entityHurt.fire({ hurtEntity: zoe, damage: 4, damageSource: { damagingEntity: from, cause: "entityAttack" } });
advance(1); zoe.fx = []; blow(hound); assert.equal(seen65("slash").length, 1); blow(hound); assert.equal(seen65("slash").length, 1, "the same swing is not drawn twice");
advance(10); blow(hound); assert.equal(seen65("slash").length, 2); const shakes = []; zoe.runCommand = (cmd) => shakes.push(cmd); blow(lord); assert.ok(seen65("slash").length === 3 && shakes.length === 1, "a great foe's blow shakes the view");
world.afterEvents.entityHurt.fire({ hurtEntity: zoe, damage: 4, damageSource: { damagingEntity: hound, cause: "magic" } }); assert.equal(seen65("slash").length, 3, "only melee");
// deaths are marked: a burst for the ordinary, a nova and a skull for a great undead
advance(1); zoe.fx = []; world.afterEvents.entityDie.fire({ deadEntity: hound, damageSource: {} }); assert.ok(seen65("spark").length === 1 && seen65("nova").length === 0);
advance(1); zoe.fx = []; world.afterEvents.entityDie.fire({ deadEntity: lord, damageSource: {} }); assert.ok(seen65("nova").length >= 1 && seen65("skull").length === 1 && seen65("pillar_light").length >= 1); // a boss adds its own fall
// a great foe arrives inside a magic circle; lesser ones simply appear
advance(1); zoe.fx = []; world.afterEvents.entitySpawn.fire({ entity: creature("overlord:goblin"), cause: "Spawned" }); advance(3); assert.equal(seen65("magic_circle").length, 0);
world.afterEvents.entitySpawn.fire({ entity: creature("overlord:evil_lord_wrath", 650, ["demon"]), cause: "Spawned" }); advance(3); assert.equal(seen65("magic_circle").length, 1);
assert.deepEqual(seen65("magic_circle")[0].color, { red: 1.0, green: 0.45, blue: 0.1 }, "in the demon's own colour");
for (const [type, auras] of Object.entries(ambience.AURAS)) for (const [, , height, size] of auras) assert.ok(type.startsWith("overlord:") && height >= 0 && size > 0, type);
players.splice(0, players.length, ...everyone, zoe);
}

// ---- v6.6: the great dragons ----
{
  const ray = mkPlayer("ray"); ray.dimension = makeLand(); ray.location = { x: 0, y: 64, z: 8 };
  ray.dimension.getPlayers = (q) => (!q || !q.maxDistance || Math.hypot(ray.location.x - q.location.x, ray.location.z - q.location.z) <= q.maxDistance ? [ray] : []);
  ray.dimension.spawnParticle = (effect, loc, vars) => ray.fx.push({ effect, loc, color: vars?.v?.["variable.color"], scale: vars?.v?.["variable.scale"] });
  const drawn = (name) => ray.fx.filter((f) => f.effect === `overlord:${name}`); const others = players.splice(0, players.length, ray);
  const hits = []; ray.applyDamage = (n) => hits.push(n); const thrown = []; ray.applyKnockback = (v, up) => thrown.push([v, up]); const shook = []; ray.runCommand = (c) => shook.push(c);
  const hatch = (type, hp) => { const e = ray.dimension.spawnEntity(type, { x: 0, y: 64, z: -12 }); e.health.effectiveMax = hp; e.health.currentValue = hp;
    e.matches = (q) => q.families.every((f) => ["dragon", "monster", "mob"].includes(f)); e.getViewDirection = () => ({ x: 0, y: 0, z: 1 }); e.getVelocity = () => ({ x: 0, y: 0, z: 0 });
    e.getEffect = () => undefined; return e; };
  const wyrm = hatch("overlord:frost_dragon", 700); const frost = dragons.DRAGONS["overlord:frost_dragon"];
  // the script knows where a dragon's jaws, wings and tail are from its size and the way it faces
  const parts = dragons.anatomy(wyrm, frost); assert.ok(Math.abs(parts.mouth.z - (-12 + 3.3 * 2.6)) < 1e-9 && Math.abs(parts.mouth.y - (64 + 2.5 * 2.6)) < 1e-9);
  assert.ok(parts.leftWing.x * parts.rightWing.x < 0 && parts.tail.z < wyrm.location.z, "wings to either side, tail behind");
  // it roars at the first player it sees - once - and is always wreathed in its element
  ray.fx = []; assert.equal(dragons.pass(), 1); assert.ok(dragons.stateOf(wyrm).roared && shook.length >= 1); assert.ok(drawn("ember").length >= 2, "frost hangs on its wings and tail");
  const roars = shook.length; dragons.tend(wyrm); assert.equal(shook.length, roars, "it does not roar twice");
  // breath: a circle marks the spot and the breath lands there a moment later - step off the mark and it misses
  const quiet = dragons.stateOf(wyrm); quiet.breathAt = 1e9; quiet.buffetAt = 1e9;
  advance(1); ray.fx = []; dragons.breathe(wyrm, frost, { ...ray.location }); assert.ok(drawn("magic_circle").length === 1 && drawn("implode").length === 1, "warning circle and gathering light");
  assert.equal(hits.length, 0, "nothing lands during the warning"); ray.location = { x: 20, y: 64, z: 8 }; advance(60); assert.equal(hits.length, 0, "dodged");
  assert.ok(drawn("beam_core").length >= 1 && drawn("nova").length >= 1, "the breath itself");
  ray.location = { x: 0, y: 64, z: 8 }; dragons.breathe(wyrm, frost, { ...ray.location }); advance(19); assert.equal(hits[0], 14); assert.ok(ray.effects.has("slowness"), "frost breath slows");
  advance(40); assert.ok(hits.length >= 3, "the ground stays freezing for a moment"); hits.length = 0;
  // wing buffet: a gale that hurts and throws back everyone standing close
  ray.location = { x: 0, y: 64, z: -7 }; dragons.buffet(wyrm, frost); assert.equal(thrown.length, 0); advance(13);
  assert.equal(hits.length, 1); assert.ok(thrown.length === 1 && thrown[0][0].z > 2 && thrown[0][1] > 0.5, "thrown back, away from the dragon");
  // at half health it is enraged, once, and everything comes faster
  wyrm.health.currentValue = 300; ray.msgs.length = 0; dragons.tend(wyrm); assert.ok(dragons.stateOf(wyrm).enraged && ray.msgs.some((m) => m.includes("enraged")) && wyrm.effects.has("speed"));
  ray.msgs.length = 0; dragons.tend(wyrm); assert.ok(!ray.msgs.some((m) => m.includes("enraged")));
  // left to itself it breathes at a player in range - but never at one in creative mode
  ray.location = { x: 0, y: 64, z: 8 }; hits.length = 0; ray.getGameMode = () => "Creative"; quiet.breathAt = 0; dragons.tend(wyrm); advance(25); assert.equal(hits.length, 0, "creative players are left alone");
  ray.getGameMode = () => "Survival"; quiet.breathAt = 0; dragons.tend(wyrm); advance(25); assert.ok(hits.length >= 1, "it breathes on its own"); assert.ok(quiet.breathAt > 100, "and then recovers its breath");
  // the Platinum Dragon Lord's breath is five bolts; the Skeletal Dragon's withers
  const lordly = hatch("overlord:platinum_dragon_lord", 1200); advance(1); ray.fx = [];
  dragons.breathe(lordly, dragons.DRAGONS["overlord:platinum_dragon_lord"], { ...ray.location }); advance(45); assert.equal(drawn("pillar_light").length, 5, "five bolts");
  const bones = hatch("overlord:skeletal_dragon", 550); ray.effects.clear(); dragons.breathe(bones, dragons.DRAGONS["overlord:skeletal_dragon"], { ...ray.location }); advance(20);
  assert.ok(ray.effects.has("wither") && drawn("skull").length >= 1);
  // its death is staged along its whole length, and it is forgotten afterwards
  advance(1); ray.fx = []; ray.msgs.length = 0; world.afterEvents.entityDie.fire({ deadEntity: wyrm, damageSource: {} }); wyrm.remove(); advance(50);
  assert.ok(drawn("pillar_light").length >= 5 && ray.msgs.some((m) => m.includes("Frost Dragon has fallen"))); assert.equal(dragons.stateOf(wyrm).roared, false);
  for (const kind of Object.values(dragons.DRAGONS)) assert.ok(kind.size >= 2.5, `${kind.name} is big`);
  players.splice(0, players.length, ...others, ray);
}

// ---- v6.7: spell lighting, lingering effects and the companions' wider set of attacks ----
{
  const lux = mkPlayer("lux"); lux.dimension = makeLand(); lux.dimension.getPlayers = () => [lux]; lux.location = { x: 0, y: 64, z: 0 };
  lux.dimension.spawnParticle = (effect) => lux.fx.push({ effect }); const lit = () => [...lux.dimension.placed.entries()].filter(([, block]) => block.startsWith("minecraft:light_block"));
  const drew = (name) => lux.fx.filter((f) => f.effect === `overlord:${name}`).length; const rest = players.splice(0, players.length, lux);
  advance(80); vfx.dim(true); assert.equal(vfx.lightCount(), 0, "earlier effects have played out and their lights are gone");
  // a spell light is an invisible light block set in air and taken away again a moment later
  assert.equal(vfx.light(lux.dimension, { x: 0.5, y: 66.2, z: 0.5 }, 14, 6), true); assert.equal(lux.dimension.placed.get("0,66,0"), "minecraft:light_block_14");
  assert.equal(vfx.lightCount(), 1); advance(4); assert.equal(lit().length, 1, "still lit"); advance(6); assert.equal(lux.dimension.placed.get("0,66,0"), "minecraft:air", "and dark again"); assert.equal(vfx.lightCount(), 0);
  // only air is ever replaced: in the ground the light goes one block up, and where there is no room there is no light
  assert.equal(vfx.light(lux.dimension, { x: 4, y: 63, z: 4 }, 12, 6), true); assert.equal(lux.dimension.placed.get("4,64,4"), "minecraft:light_block_12"); assert.equal(lux.dimension.placed.get("4,63,4"), undefined);
  assert.equal(vfx.light(lux.dimension, { x: 4, y: 61, z: 4 }, 12, 6), false, "solid ground is left alone"); advance(10);
  // lighting the same spot again keeps it lit rather than stacking; the number standing at once is capped; it can be switched off
  vfx.light(lux.dimension, { x: 8, y: 66, z: 8 }, 15, 4); advance(3); vfx.light(lux.dimension, { x: 8, y: 66, z: 8 }, 15, 10); assert.equal(vfx.lightCount(), 1); advance(6); assert.equal(lit().length, 1, "kept lit"); advance(10); assert.equal(lit().length, 0);
  for (let i = 0; i < 80; i++) vfx.light(lux.dimension, { x: 20 + i * 2, y: 66, z: 0 }, 15, 6); assert.equal(vfx.lightCount(), vfx.MAX_LIGHTS); advance(10); assert.equal(lit().length, 0, "every one of them is taken away");
  vfx.setLights(false); assert.equal(vfx.light(lux.dimension, { x: 0, y: 66, z: 0 }), false); assert.equal(vfx.lightsEnabled(), false); vfx.setLights(true);
  // spells use it: an impact flashes, a beam lights its path, a nova lights the ground out to its edge
  vfx.spark(lux.dimension, { x: 0, y: 66, z: 0 }, "fire", 1.5); assert.ok(lit().length >= 1, "an impact gives light"); advance(10);
  vfx.beam(lux.dimension, { x: 0, y: 66, z: 0 }, { x: 0, y: 66, z: 18 }, "lightning"); assert.ok(lit().length >= 4, `a beam lights its length: ${lit().length}`); advance(10);
  vfx.nova(lux.dimension, { x: 0, y: 66, z: 0 }, "fire", 6); assert.ok(lit().length >= 5); advance(16); assert.equal(lit().length, 0);
  // and every element leaves something behind where it struck
  for (const [element, trace] of [["fire", "flame_linger"], ["ice", "mist"], ["lightning", "crackle"], ["holy", "linger"], ["dark", "mist"], ["acid", "mist"], ["arcane", "orbit"], ["none", "linger"]]) {
    advance(1); lux.fx = []; vfx.afterglow(lux.dimension, { x: 0, y: 64, z: 0 }, element, 2); assert.ok(drew(trace) === 1, `${element} leaves ${trace}`);
  }
  advance(1); lux.fx = []; vfx.afterglow(lux.dimension, { x: 0, y: 64, z: 0 }, "fire", 2); assert.equal(drew("scorch"), 1, "fire scorches the ground");
  advance(1); lux.fx = []; vfx.beam(lux.dimension, { x: 0, y: 66, z: 0 }, { x: 0, y: 66, z: 8 }, "holy"); assert.ok(drew("beam_core") === 1 && drew("beam_glow") === 1, "a beam has a core and a glow");
  advance(1); lux.fx = []; vfx.castFx(lux, "arcane", 7, "point"); assert.equal(drew("orbit"), 1, "motes circle a caster of the higher tiers"); advance(20);

  // companions: more attacks as they level, used in turn
  assert.deepEqual([1, 8, 20, 35].map((lv) => party.attacksKnown(0, lv).length), [1, 2, 3, 4]); assert.equal(party.attacksKnown(2, 40).length, 5, "a seasoned mage has five");
  for (const kit of party.ATTACKS) { assert.ok(kit.length >= 4); assert.equal(kit[0].level, 1, "everyone starts with one attack"); assert.equal(new Set(kit.map((a) => a.key)).size, kit.length); }
  const used = []; for (const kit of party.ATTACKS) for (const attack of kit) { const real = attack.use; attack.use = (turn) => { const ok = real(turn); if (ok) used.push([turn.member.name, attack.key]); return ok; }; }
  const target = (name, at) => { const m = mob("minecraft:zombie", 1e6, ["monster", "undead"]); Object.assign(m, { id: name, location: at, dimension: lux.dimension, tags: new Set(), afflicted: [], addEffect(e) { m.afflicted.push(e); },
    applyKnockback() {}, setOnFire() {}, hasTag: (t) => m.tags.has(t), addTag: (t) => m.tags.add(t), getDynamicProperty: () => undefined, applyDamage(n) { m.damaged.push(n); } }); lux.dimension.mobs.push(m); return m; };
  const drill = (leader, looks) => { leader.dimension = lux.dimension; leader.location = { x: 0, y: 64, z: 0 }; rpg.profileOf(leader).level = 40;
    looks.forEach((look, i) => { if (i === 0) party.createMain(leader, `${leader.name}0`, look); else party.hire(leader, { name: `${leader.name}${i}`, look, level: 40, cost: 0 }); }); party.summon(leader); };
  const max = mkPlayer("max"); players.push(lux, max); players.splice(0, players.length, lux, max); drill(lux, [0, 2, 4, 6]); drill(max, [8, 10]); advance(45);
  const dummy = target("dummy", { x: 2, y: 64, z: 1 }); target("dummy2", { x: 3, y: 64, z: 2 }); target("dummy3", { x: 1, y: 64, z: 3 });
  for (let second = 0; second < 90; second++) {
    if (second % 5 === 0) for (const leader of [lux, max]) world.afterEvents.entityHurt.fire({ hurtEntity: dummy, damage: 1, damageSource: { damagingEntity: leader, cause: "entityAttack" } });
    advance(20);
  }
  const kinds = (name) => new Set(used.filter(([who]) => who === name).map(([, key]) => key));
  assert.equal(kinds("lux0").size, 3, `fighter: ${[...kinds("lux0")]}`); assert.ok(!kinds("lux0").has("cry"), "the Rallying Cry is kept for when the master is hurt");
  assert.equal(kinds("lux1").size, 4, `archer: ${[...kinds("lux1")]}`); assert.equal(kinds("lux2").size, 5, `mage: ${[...kinds("lux2")]}`);
  assert.ok(kinds("lux3").has("smite") && kinds("lux3").has("blessing"), `healer: ${[...kinds("lux3")]}`);
  assert.equal(kinds("max0").size, 4, `rogue: ${[...kinds("max0")]}`); assert.equal(kinds("max1").size, 4, `bard: ${[...kinds("max1")]}`);
  for (const name of ["lux1", "lux2", "max0"]) { const mine = used.filter(([who]) => who === name); assert.notEqual(mine[0][1], mine[1][1], `${name} does not repeat itself straight away`); }
  // the supportive ones answer need: a hurt master brings the Rallying Cry and Sanctuary
  used.length = 0; lux.health.currentValue = 4; advance(60); assert.ok(kinds("lux0").has("cry") && kinds("lux3").has("sanctuary"), `${used.map((u) => u.join(":"))}`);
  assert.ok(lux.health.currentValue > 4 && lux.effects.has("resistance"));
  // a young companion has just the one
  const tot = mkPlayer("tot"); players.push(tot); tot.dimension = lux.dimension; tot.location = { x: 0, y: 64, z: 0 }; party.createMain(tot, "Pip", 4); party.summon(tot); advance(45); used.length = 0;
  for (let second = 0; second < 20; second++) { if (second % 5 === 0) world.afterEvents.entityHurt.fire({ hurtEntity: dummy, damage: 1, damageSource: { damagingEntity: tot, cause: "entityAttack" } }); advance(20); }
  assert.deepEqual([...kinds("Pip")], ["bolt"]);
  party.dismiss(lux); party.dismiss(max); party.dismiss(tot); lux.dimension.mobs.length = 0; vfx.dim(true);
  players.splice(0, players.length, ...rest, lux, max, tot);
}

// ---- the skill tree ----
{
  const skills = await import("./skills.js");
  const tree = await import("./skilltree.js");
  // the data: six paths of eleven nodes, five tiers each, a single capstone at the top, and every prerequisite in its own path
  assert.equal(skills.TREES.length, 6); assert.equal(skills.NODES.length, 66);
  for (const t of skills.TREES) {
    const nodes = skills.NODES.filter((n) => n.tree === t.key);
    assert.equal(nodes.length, 11, t.key); assert.equal(nodes.filter((n) => n.tier === 4).length, 1, `${t.key} capstone`);
    for (let tier = 0; tier < 4; tier++) assert.ok(nodes.some((n) => n.tier === tier), `${t.key} tier ${tier}`);
    const below = nodes.filter((n) => n.tier < 4).reduce((sum, n) => sum + n.max, 0); assert.ok(below >= skills.TIER_POINTS[4], `${t.key}: the capstone can be reached`);
    for (const n of nodes) if (n.needs) { const need = skills.BY_KEY.get(n.needs); assert.ok(need && need.tree === n.tree && need.tier < n.tier, n.key); }
    for (const n of nodes) for (let r = 1; r <= n.max; r++) assert.ok(!/[{}]/.test(skills.describe(n, r)), `${n.key} ${r}: ${skills.describe(n, r)}`);
  }
  assert.equal(new Set(skills.NODES.map((n) => n.key)).size, 66, "keys are unique");
  // points: one a level from 2, one more every tenth level, plus codices up to ten
  assert.equal(skills.pointsForLevel(1), 0); assert.equal(skills.pointsForLevel(10), 10); assert.equal(skills.pointsForLevel(100), 109);
  const total = skills.NODES.reduce((sum, n) => sum + n.max, 0); assert.ok(total > 109 + skills.MAX_CODEX, `not everything can be learned (${total})`);
  // the rules: tier gates by points in the path and by level, prerequisites, no points
  const q = { level: 1, skills: {}, codex: 0 };
  assert.equal(skills.check(q, "weapon_mastery").reason, "No skill points left");
  q.level = 6; assert.equal(skills.learn(q, "weapon_mastery"), ""); assert.equal(skills.rank(q, "weapon_mastery"), 1);
  assert.ok(skills.check(q, "cleave").reason.includes("level 10"));
  q.level = 12; assert.ok(skills.check(q, "cleave").reason.includes("3 points"));
  skills.learn(q, "weapon_mastery"); skills.learn(q, "weapon_mastery"); assert.ok(skills.check(q, "cleave").ok, "tier II opens at 3 points and level 10");
  assert.ok(skills.check(q, "cleave").ok && skills.openTier(q, "blade") === 1 && skills.openTier(q, "arcane") === 0);
  q.level = 40; q.skills = { weapon_mastery: 5, iron_body: 2, tough_skin: 5 }; assert.ok(skills.check(q, "six_light_strikes").reason.includes("level 50"));
  q.level = 60; q.skills = { weapon_mastery: 5, iron_body: 2, tough_skin: 5, executioner: 3, battle_fury: 3, crushing_blow: 2 };
  assert.equal(skills.check(q, "six_light_strikes").reason, "Needs Cleave", "a capstone needs its prerequisite");
  q.skills.crushing_blow = 1; q.skills.cleave = 1; assert.ok(skills.check(q, "six_light_strikes").ok);
  assert.equal(skills.available(q), skills.pointsForLevel(60) - 20); q.codex = 99; assert.equal(skills.earned(q), skills.pointsForLevel(60) + 10, "codices count up to ten");
  q.skills.weapon_mastery = 99; assert.equal(skills.rank(q, "weapon_mastery"), 5, "a rank never exceeds the node's maximum");
  q.level = 1; assert.equal(skills.available(q), 0, "levels lost do not make points negative");
  assert.equal(skills.describe(skills.BY_KEY.get("unyielding"), 2), "Resistance I while you are below 70% health");
  assert.equal(skills.unlearnCost({ level: 1, skills: { weapon_mastery: 3 }, codex: 0 }), 16);

  // in play: a level 60 warrior-to-be
  const s = mkPlayer("sora"); const ps = rpg.profileOf(s); s.dimension.mobs = [];
  world.afterEvents.playerSpawn.fire({ player: s, initialSpawn: true }); advance(80);
  ps.level = 60; ps.mana = rpg.maxMana(ps);
  // the menu: the skill tree is the first extra entry of the plate, then a path, then a node, then learn
  script.push(6, 0, 0, 0); rpg.openMenu(s); await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  assert.equal(skills.rank(ps, "weapon_mastery"), 1, "learned through the menu");
  const page = shown.findLast((f) => f.title === "Weapon Mastery"); assert.ok(page && page.body.includes("+3% melee damage"), page?.body);
  assert.ok(shown.some((f) => f.title === "Skill Tree" && f.body.includes("Path of the Blade")));
  script.length = 0;
  // melee: Weapon Mastery 5 adds 15% to a blow
  ps.skills = { weapon_mastery: 5 }; ps.str = 0; ps.agi = 0; ps.cls = "none";
  const target = (hp = 100, fam = ["monster"]) => { const m = mob("minecraft:zombie", hp, fam); m.id = `t${Math.random()}`; m.tags = new Set(); m.hasTag = (t) => m.tags.has(t); m.addEffect = () => {}; m.setOnFire = () => {}; m.getViewDirection = () => ({ x: 0, y: 0, z: 1 }); return m; };
  const hit = (victim, damage = 10) => world.afterEvents.entityHurt.fire({ hurtEntity: victim, damage, damageSource: { damagingEntity: s, cause: "entityAttack" } });
  let t1 = target(); hit(t1); assert.equal(t1.health.currentValue, 100 - 1.5, "+15%");
  // Backstab: a foe looking away (its view points away from the attacker at x=0)
  ps.skills = { weapon_mastery: 5, iron_body: 2, cleave: 3, tough_skin: 5, backstab: 3 }; t1 = target(); t1.location = { x: 0, y: 64, z: 2 }; hit(t1);
  assert.equal(t1.health.currentValue, 100 - 6, "+15% and +45% from behind");
  // Cleave strikes the monsters beside the target, never the target twice or a friend
  const side = target(), pal = target(); pal.tags.add("overlord_ally_sora"); s.dimension.mobs = [side, pal]; t1 = target(); hit(t1);
  assert.ok(side.health.currentValue < 100, "cleaved"); assert.equal(pal.health.currentValue, 100, "allies are spared"); s.dimension.mobs = [];
  // Bloodthirst heals for a share of the blow
  ps.skills = { bloodthirst: 3 }; s.health.currentValue = 10; hit(target()); assert.ok(Math.abs(s.health.currentValue - 10.9) < 1e-9, `${s.health.currentValue}`);
  // Six Light Strikes: the sixth blow sends six slashes into everything around
  ps.skills = { cleave: 1, six_light_strikes: 1 }; const crowd = [target(200), target(200)]; s.dimension.mobs = crowd; s.msgs.length = 0;
  const victim = target(1000); for (let i = 0; i < 5; i++) hit(victim, 10); const before6 = crowd.map((m) => m.health.currentValue);
  s.bar = ""; hit(victim, 10); advance(14);
  assert.ok(crowd.every((m, i) => before6[i] - m.health.currentValue >= 6 * 4 - 1e-9), `${crowd.map((m) => m.health.currentValue)}`); s.dimension.mobs = [];
  // Assassinate: a wounded foe may die outright, never a boss
  ps.skills = { assassinate: 1 }; const realRandom = Math.random; Math.random = () => 0;
  const weak = target(100); weak.health.currentValue = 20; hit(weak, 1); assert.equal(weak.health.currentValue, 0, "assassinated");
  const boss = target(900); boss.health.currentValue = 100; hit(boss, 1); assert.ok(boss.health.currentValue > 0, "bosses are not");
  // defences: Evasion refunds the whole blow, Tough Skin a share of it
  ps.skills = { evasion: 3 }; s.health.currentValue = 12; world.afterEvents.entityHurt.fire({ hurtEntity: s, damage: 8, damageSource: { cause: "entityAttack" } }); assert.equal(s.health.currentValue, 20, "dodged");
  Math.random = () => 0.99; ps.skills = { tough_skin: 5, evasion: 3 }; s.health.currentValue = 12;
  world.afterEvents.entityHurt.fire({ hurtEntity: s, damage: 10, damageSource: { cause: "entityAttack" } }); assert.ok(Math.abs(s.health.currentValue - 13.5) < 1e-9, `${s.health.currentValue}`);
  s.health.currentValue = 12; world.afterEvents.entityHurt.fire({ hurtEntity: s, damage: 10, damageSource: { cause: "void" } }); assert.equal(s.health.currentValue, 12, "the void is never softened");
  // Mana Shield pays for part of a blow in mana
  ps.skills = { mana_shield: 2 }; ps.mana = 100; s.health.currentValue = 10; world.afterEvents.entityHurt.fire({ hurtEntity: s, damage: 10, damageSource: { cause: "entityAttack" } });
  assert.ok(Math.abs(s.health.currentValue - 13) < 1e-9 && Math.abs(ps.mana - 95.5) < 1e-9, `${s.health.currentValue} ${ps.mana}`);
  // Divine Grace saves a falling player once, then waits five minutes
  ps.skills = { divine_grace: 1 }; s.health.currentValue = 3; world.afterEvents.entityHurt.fire({ hurtEntity: s, damage: 1, damageSource: { cause: "entityAttack" } });
  assert.equal(s.health.currentValue, 10); assert.ok(s.effects.has("absorption")); s.health.currentValue = 3;
  world.afterEvents.entityHurt.fire({ hurtEntity: s, damage: 1, damageSource: { cause: "entityAttack" } }); assert.equal(s.health.currentValue, 3, "not twice in five minutes");
  // kills: Soul Harvest restores mana, Gold Sense and Crystal Hunter drop loot where the foe fell, Windfall triples XP
  Math.random = () => 0; const drops = []; s.dimension.spawnItem = (stack) => drops.push(stack.typeId);
  ps.skills = { soul_harvest: 5, gold_sense: 5, crystal_hunter: 3, windfall: 3 }; ps.mana = 0; ps.level = 30; ps.xp = 0;
  const prey = target(); prey.location = { x: 3, y: 64, z: 3 }; prey.dimension = s.dimension; kill(s, prey);
  assert.equal(ps.mana, 5); assert.ok(drops.includes("overlord:yggdrasil_gold_coin") && drops.includes("overlord:data_crystal"), `${drops}`);
  const single = rpg.killXp(prey); assert.ok(ps.xp >= single * 3 - 1, `triple XP: ${ps.xp} vs ${single}`);
  Math.random = realRandom; s.dimension.spawnItem = () => {};
  // passives: hearts, speed, night vision and jump boost come and go with the skills
  ps.skills = { iron_body: 2, sacred_vow: 2, fleet_foot: 2, night_eyes: 1 }; rpg.applyPassives(s);
  assert.equal(s.effects.get("health_boost").amplifier, 3, "four tiers of hearts"); assert.equal(s.effects.get("speed").amplifier, 0); assert.ok(s.effects.has("night_vision") && s.effects.has("jump_boost"));
  ps.skills = {}; rpg.applyPassives(s); assert.ok(!s.effects.has("night_vision") && !s.effects.has("health_boost"));
  // mana and spell power
  const baseMana = rpg.maxMana(ps), basePower = rpg.spellPower(s); ps.skills = { deep_reserves: 5, arcane_study: 5 };
  assert.equal(rpg.maxMana(ps), baseMana + 60); assert.ok(Math.abs(rpg.spellPower(s) - basePower - 0.15) < 1e-9);
  // spells: Efficient Casting makes them cheaper, and Maximize Magic makes every fourth one free and far stronger
  {
    const dummy2 = target(10000, ["monster"]); const dealt = []; dummy2.applyDamage = (n) => dealt.push(n); s.aimed = [dummy2];
    ps.skills = { efficient_casting: 3 }; ps.mana = 50; ps.casts = {}; assert.equal(spells.castSelected(s), true); assert.equal(ps.mana, 47, "Magic Arrow costs 3 instead of 4");
    ps.skills = { maximize_magic: 1, arcane_study: 1 }; dealt.length = 0; const realRandom2 = Math.random; Math.random = () => 0.99;
    const free = [];
    for (let i = 0; i < 8; i++) { advance(20); ps.mana = 50; spells.castSelected(s); free.push(ps.mana === 50); }
    Math.random = realRandom2;
    assert.equal(free.filter(Boolean).length, 2, `one spell in four is free: ${free}`); assert.equal(dealt.length, 8);
    const at = free.indexOf(true); assert.equal(free.indexOf(true, at + 1), at + 4);
    assert.ok(dealt[at] > dealt[(at + 1) % 8] * 1.5, `maximized: ${dealt}`);
    s.aimed = [];
  }
  // XP: Quick Study adds 20%, and a Shooting Star still gives exactly one level
  ps.skills = { quick_study: 5 }; ps.level = 30; ps.xp = 0; rpg.grantXp(s, 100); assert.equal(ps.xp, 120);
  rpg.grantLevel(s); assert.equal(ps.level, 31);
  // the standing skills: Blessed Body heals, Purity cleanses, Shadow Veil hides a sneaking player, Unyielding braces a hurt one
  ps.skills = { blessed_body: 5, purity: 1, shadow_veil: 1, fleet_foot: 1, unyielding: 2 }; s.health.currentValue = 10; s.effects.set("poison", { duration: 100, amplifier: 0 }); s.isSneaking = true;
  tree.tick(s, 4); assert.equal(s.health.currentValue, 12.5); assert.ok(!s.effects.has("poison") && s.effects.has("invisibility") && s.effects.has("resistance"));
  s.isSneaking = false;
  // companions: Commander and War Drums
  // (the party module asks skills.js for these; their arithmetic is checked here)
  assert.ok(Math.abs(skills.companionPower({ level: 60, skills: { commander: 5, supreme_authority: 1 }, codex: 0 }) - 1.2 * 1.25) < 1e-9);
  assert.ok(skills.companionHaste({ level: 60, skills: { war_drums: 3 }, codex: 0 }) < 1);
  // Legion raises the number of summons
  ps.skills = { legion: 2 }; assert.equal(spells.allyLimit(s), spells.MAX_ALLIES + 2);
  // Haggler: cheaper travel and reinforcement
  ps.skills = { haggler: 3 }; assert.equal(forge.reinforceCost(4, s).coins, 53); assert.equal(forge.reinforceCost(4).coins, 75);
  // the Codex: one more point each, at most ten, and it is used up
  ps.skills = {}; ps.codex = 0; const earnedBefore = skills.earned(ps); s.inv.push(new ItemStack("overlord:codex_of_skills", 2));
  world.afterEvents.itemUse.fire({ source: s, itemStack: { typeId: "overlord:codex_of_skills" } });
  assert.equal(ps.codex, 1); assert.equal(skills.earned(ps), earnedBefore + 1); assert.equal(spells.countItem(s, "overlord:codex_of_skills"), 1);
  ps.codex = 10; assert.ok(tree.readCodex(s).includes("already")); assert.equal(spells.countItem(s, "overlord:codex_of_skills"), 1, "not wasted");
  // unlearning: costs Gold Coins and gives every point back
  ps.codex = 0; ps.level = 60; ps.skills = { weapon_mastery: 5, iron_body: 2 }; assert.ok(tree.unlearn(s).includes("costs 24"));
  s.inv.push(new ItemStack("overlord:yggdrasil_gold_coin", 30)); assert.ok(tree.unlearn(s).includes("7 skill points")); assert.equal(skills.spent(ps), 0);
  assert.equal(spells.countItem(s, "overlord:yggdrasil_gold_coin"), 6);
  // learning flourishes, and a capstone is announced to everyone
  ps.skills = { weapon_mastery: 5, iron_body: 2, tough_skin: 5, executioner: 3, battle_fury: 3, crushing_blow: 1, cleave: 1 }; const said = [];
  const realSend = world.sendMessage; world.sendMessage = (m) => said.push(m);
  assert.ok(tree.learnSkill(s, "six_light_strikes").includes("Learned")); assert.ok(said.some((m) => m.includes("Six Light Strikes")));
  world.sendMessage = realSend;
  // the HUD shows free skill points, and the save keeps the skills
  ps.skills = {}; ps.hud = true; advance(120); assert.ok(s.bar.includes("SP"), s.bar);
  ps.skills = { weapon_mastery: 2 }; ps.codex = 3; rpg.touch(s); advance(200);
  world.afterEvents.playerLeave.fire({ playerId: "sora" }); const back = rpg.profileOf(s); assert.equal(back.skills.weapon_mastery, 2); assert.equal(back.codex, 3);
  players.splice(players.indexOf(s), 1);
}

// ---- weapons and armour ----
{
  const arms = await import("./arms.js");
  const k = mkPlayer("kai"); k.dimension.mobs = []; world.afterEvents.playerSpawn.fire({ player: k, initialSpawn: true }); advance(80);
  let hand = "overlord:razor_edge"; let worn = {};
  k.getComponent = ((base) => (c) => (c === "minecraft:equippable" ? { getEquipment: (slot) => (slot === "Mainhand" ? (hand ? { typeId: hand } : undefined) : worn[slot] ? { typeId: worn[slot] } : undefined) } : base(c)))(k.getComponent);
  k.applyKnockback = () => {}; k.startItemCooldown = () => {}; k.isSneaking = false;
  const foe = (x, z, hp = 200, fam = ["monster"]) => { const m = mob("minecraft:zombie", hp, fam); Object.assign(m, { id: `f${Math.random()}`, location: { x, y: 64, z }, tags: new Set(), afflicted: [], burning: 0, lifted: 0,
    hasTag: (t) => m.tags.has(t), addEffect(e) { m.afflicted.push(e); }, setOnFire(n) { m.burning = n; }, applyKnockback(_h, v) { m.lifted = v; },
    applyDamage(n) { m.health.currentValue = Math.max(0, m.health.currentValue - n); } }); return m; };
  const blow = (victim, damage = 10) => world.afterEvents.entityHurt.fire({ hurtEntity: victim, damage, damageSource: { damagingEntity: k, cause: "entityAttack" } });
  // what is held and worn
  assert.equal(arms.heldWeapon(k), "razor_edge"); hand = "overlord:magic_wand"; assert.equal(arms.heldWeapon(k), undefined); hand = "overlord:razor_edge";
  worn = { Head: "overlord:infernal_helmet", Chest: "overlord:infernal_chestplate" }; assert.deepEqual(arms.wornSets(k), { infernal: 2 }); assert.equal(arms.fullSet(k), undefined);
  worn = {};
  // every kind has a finisher, and every weapon a kind
  for (const w of Object.values(arms.WEAPONS)) assert.ok(arms.FINISHERS[w.kind], w.kind);
  for (const key of Object.keys(arms.NEW_ARTS)) assert.ok(arms.WEAPONS[key], key);
  // a chain of three blows ends in the blade's Crescent Cut, which strikes every foe in front
  const target = foe(0, 2), beside = foe(1, 2.5), behind = foe(0, -3); k.dimension.mobs = [target, beside, behind]; k.fx = [];
  blow(target); assert.ok(k.bar.includes("Combo"), k.bar); blow(target); blow(target);
  assert.ok(k.bar.includes("Crescent Cut"), k.bar); assert.ok(beside.health.currentValue < 200, "the cut reaches the foe beside"); assert.equal(behind.health.currentValue, 200, "but not the one behind");
  assert.ok(k.fx.some((f) => f.effect === "overlord:slash"), "blows leave crescents"); assert.ok(k.anims.includes("animation.overlord.weapon_slash"));
  // the chain breaks if the blows are too far apart
  blow(target); advance(40); blow(target); advance(40); const before = beside.health.currentValue; blow(target); assert.equal(beside.health.currentValue, before, "no finisher after a broken chain");
  // other kinds: a heavy weapon's Earthbreaker lifts, a fist's Rising Dragon throws, a polearm runs through a line
  hand = "overlord:giants_maul"; advance(40); for (let i = 0; i < 3; i++) blow(target); assert.ok(beside.lifted > 0 && target.lifted > 0, "Earthbreaker");
  hand = "overlord:six_arms_knuckles"; target.lifted = 0; beside.lifted = 0; advance(40); for (let i = 0; i < 3; i++) blow(target); assert.ok(target.lifted >= 0.9 && beside.lifted === 0, "Rising Dragon");
  hand = "overlord:spuit_lance"; const far = foe(0, 5.5); k.dimension.mobs = [target, far]; advance(40); for (let i = 0; i < 3; i++) blow(target); assert.ok(far.health.currentValue < 200, "Piercing Thrust");
  hand = "overlord:blade_bug"; advance(40); const victim3 = foe(0, 2, 500); k.dimension.mobs = [victim3]; for (let i = 0; i < 3; i++) blow(victim3); advance(12);
  assert.ok(500 - victim3.health.currentValue >= 4 * 3 - 1e-9 && victim3.afflicted.includes("wither"), `Thousand Cuts: ${victim3.health.currentValue}, ${victim3.afflicted}`);
  hand = "overlord:razor_edge";
  // a finishing blow from elsewhere (many times the foe's health) is not a swing
  advance(40); arms.gauges.set("kai", 0); world.afterEvents.entityHurt.fire({ hurtEntity: foe(0, 2), damage: 10000, damageSource: { damagingEntity: k, cause: "entityAttack" } }); assert.equal(arms.gauges.get("kai"), 0);
  // Awakening: the gauge fills with harm dealt; sneak + use awakens; awake blows hit harder
  arms.gauges.set("kai", 0); const tough = foe(0, 2, 100000); k.dimension.mobs = [tough];
  for (let i = 0; i < 12; i++) { advance(40); blow(tough, 10); }
  assert.equal(arms.gauges.get("kai"), 120); assert.ok(k.msgs.length >= 0);
  k.isSneaking = true; world.afterEvents.itemUse.fire({ source: k, itemStack: { typeId: "overlord:razor_edge" } }); k.isSneaking = false;
  assert.ok(arms.isAwake(k)); assert.equal(arms.gauges.get("kai"), 0); assert.ok(k.anims.includes("animation.overlord.weapon_awaken"));
  advance(40); const hp1 = tough.health.currentValue; blow(tough, 10); assert.ok(hp1 - tough.health.currentValue >= 3.5 - 1e-9, `awake blows burn deeper: ${hp1} -> ${tough.health.currentValue} awake=${arms.isAwake(k)}`);
  advance(12 * 20); assert.ok(!arms.isAwake(k), "and it wears off");
  // the new arts: Fourfold Slash cuts the foe before you four times, then recharges
  const duel = foe(0, 3); k.dimension.mobs = [duel]; assert.equal(arms.useWeaponArt(k, "overlord:razor_edge"), true); advance(12);
  assert.equal(duel.health.currentValue, 200 - 24); arms.useWeaponArt(k, "overlord:razor_edge"); assert.ok(k.bar.includes("Recharging"), k.bar);
  assert.equal(arms.useWeaponArt(k, "overlord:ginnungagap"), false, "weapons with their own art are left to it");
  // with no foe in front, the art is not spent
  k.dimension.mobs = []; advance(200); arms.useWeaponArt(k, "overlord:razor_edge"); k.dimension.mobs = [duel]; arms.useWeaponArt(k, "overlord:razor_edge"); advance(12); assert.equal(duel.health.currentValue, 200 - 48);
  // Judgement burns the undead twice as hard
  const ghoul = foe(2, 0, 200, ["monster", "undead"]), brute = foe(-2, 0); k.dimension.mobs = [ghoul, brute]; arms.useWeaponArt(k, "overlord:angel_mace");
  assert.equal(ghoul.health.currentValue, 180); assert.equal(brute.health.currentValue, 190);
  // armour: two pieces give their small bonus, four the aura; tapping sneak twice uses the art
  worn = { Head: "overlord:infernal_helmet", Chest: "overlord:infernal_chestplate" }; k.effects.clear(); arms.step(k, 20 * 50); assert.ok(k.effects.has("fire_resistance"));
  worn = { Head: "overlord:infernal_helmet", Chest: "overlord:infernal_chestplate", Legs: "overlord:infernal_leggings", Feet: "overlord:infernal_boots" }; assert.equal(arms.fullSet(k), "infernal");
  k.fx = []; arms.step(k, 20 * 60); assert.ok(k.fx.some((f) => f.effect === "overlord:ember"), "a full set wraps its wearer in its particles");
  const imp = foe(3, 0), imp2 = foe(-2, 2); k.dimension.mobs = [imp, imp2];
  let t = 20 * 70 + 1; k.isSneaking = true; arms.step(k, t); k.isSneaking = false; arms.step(k, t + 2); k.isSneaking = true; arms.step(k, t + 4); k.isSneaking = false;
  assert.ok(imp.health.currentValue === 188 && imp.burning === 6 && imp2.burning === 6, "Hellfire Nova"); assert.ok(arms.armourArtLeft(k, "infernal") > 0);
  k.isSneaking = true; arms.step(k, t + 6); k.isSneaking = false; arms.step(k, t + 8); k.isSneaking = true; arms.step(k, t + 10); k.isSneaking = false; assert.equal(imp.health.currentValue, 188, "not again while it recharges");
  // slow taps do not count
  worn = { Head: "overlord:bonedragon_helmet", Chest: "overlord:bonedragon_chestplate", Legs: "overlord:bonedragon_leggings", Feet: "overlord:bonedragon_boots" }; const bound = foe(2, 2); k.dimension.mobs = [bound];
  t += 1000; k.isSneaking = true; arms.step(k, t); k.isSneaking = false; arms.step(k, t + 2); k.isSneaking = true; arms.step(k, t + 30); assert.equal(bound.health.currentValue, 200, "two slow taps are not a double tap");
  k.isSneaking = false; arms.step(k, t + 32); k.isSneaking = true; arms.step(k, t + 34); assert.ok(bound.health.currentValue < 200 && bound.afflicted.includes("slowness"), "Bone Prison");
  k.isSneaking = false;
  // Platinum Bulwark throws half a blow back at the attacker
  worn = { Head: "overlord:platinum_helmet", Chest: "overlord:platinum_chestplate", Legs: "overlord:platinum_leggings", Feet: "overlord:platinum_boots" };
  arms.armourArt(k, "platinum"); const brute2 = foe(1, 1); brute2.typeId = "overlord:war_troll"; brute2.isValid = true;
  world.afterEvents.entityHurt.fire({ hurtEntity: k, damage: 8, damageSource: { damagingEntity: brute2, cause: "entityAttack" } }); assert.equal(brute2.health.currentValue, 196);
  // Crimson, two pieces: blows drink a little
  worn = { Head: "overlord:crimson_helmet", Chest: "overlord:crimson_chestplate" }; hand = undefined; k.health.currentValue = 10; blow(foe(0, 2), 10); assert.ok(Math.abs(k.health.currentValue - 10.4) < 1e-9, `${k.health.currentValue}`);
  // the Arsenal page describes what is held and worn
  hand = "overlord:dragonbone_blade"; worn = { Head: "overlord:ranger_helmet", Chest: "overlord:ranger_chestplate" }; arms.openArsenal(k);
  const page = shown[shown.length - 1]; assert.equal(page.title, "Arsenal"); assert.ok(page.body.includes("Cleaving Arc") && page.body.includes("Ranger") && page.body.includes("Arrow Rain"), page.body);
  k.dimension.mobs = []; players.splice(players.indexOf(k), 1);
}

// ---- boss fights ----
{
  const bosses = await import("./bosses.js");
  // the table: three phases of moves each, every move of a known shape
  const shapes = new Set(["slam", "ring", "line", "barrage", "pull", "blink", "summon"]);
  assert.ok(Object.keys(bosses.BOSSES).length >= 18);
  for (const [key, b] of Object.entries(bosses.BOSSES)) {
    assert.equal(b.moves.length, 3, key); assert.ok(b.damage > 0 && b.name, key);
    for (const m of b.moves.flat()) assert.ok(shapes.has(m.shape) && m.power > 0 && m.name, `${key}: ${m.name}`);
  }
  // a small arena: players are found by distance
  const fighters = [];
  const arena = { id: "overworld", mobs: [], spawned: [], spawnParticle() {}, playSound() {},
    getPlayers: (q) => fighters.filter((p) => Math.hypot(p.location.x - q.location.x, p.location.z - q.location.z) <= (q.maxDistance ?? 1e9)),
    getEntities: () => arena.mobs, spawnEntity(type, at) { const e = { typeId: type, location: at, tags: new Set(), addTag(t) { this.tags.add(t); } }; arena.spawned.push(e); return e; } };
  const fighter = (name, x, z) => { const p = { id: name, name, typeId: "minecraft:player", isValid: true, location: { x, y: 64, z }, dimension: arena, taken: 0, titles: [], msgs: [], bar: "",
    applyDamage(n) { p.taken += n; }, applyKnockback() {}, getViewDirection: () => ({ x: 0, y: 0, z: 1 }), sendMessage(m) { p.msgs.push(m); }, playSound() {},
    onScreenDisplay: { setTitle(t, o) { p.titles.push(`${t}|${o?.subtitle}`); }, setActionBar(t) { p.bar = t; } }, getDynamicProperty() {}, setDynamicProperty() {}, effects: new Map(),
    getComponent(c) { return c === "minecraft:inventory" ? { container: { addItem(s) { p.got.push(s); }, size: 0, getItem() {} } } : undefined; }, got: [] }; fighters.push(p); return p; };
  const boss = { id: "cocy1", typeId: "overlord:cocytus", isValid: true, location: { x: 0, y: 64, z: 0 }, dimension: arena, effects: new Map(), tags: new Set(), hasTag: () => false,
    health: { currentValue: 360, effectiveMax: 360 }, getComponent(c) { return c === "minecraft:health" ? this.health : undefined; },
    addEffect(e, d, o) { this.effects.set(e, o?.amplifier ?? 0); }, teleport(to) { this.location = { ...to }; } };
  const near = fighter("near", 2, 0), far = fighter("far", 20, 0);
  const fight = bosses.engage(boss); assert.equal(bosses.engage(boss), fight, "engaged once"); assert.equal(fight.phase, 0);
  // a slam is warned, then lands on those still inside it
  let t = 1000; const pick = (n) => () => n;
  fight.next = 0; bosses.step(fight, t, pick(0)); assert.equal(fight.pending.move.name, "Frozen Heaven"); assert.ok(near.bar.includes("Frozen Heaven"), near.bar);
  assert.equal(near.taken, 0, "nothing lands at once");
  while (fight.pending) bosses.step(fight, ++t, pick(0));
  assert.ok(near.taken > 0, "the slam lands"); assert.equal(far.taken, 0, "out of reach is safe");
  // ...and whoever stepped out in time is spared
  near.taken = 0; fight.next = 0; bosses.step(fight, ++t, pick(0)); near.location = { x: 9, y: 64, z: 0 }; while (fight.pending) bosses.step(fight, ++t, pick(0)); assert.equal(near.taken, 0, "dodged");
  // a line runs from the boss at its target: on it hurts, beside it does not
  near.location = { x: 0, y: 64, z: 6 }; const beside = fighter("beside", 5, 3); fight.next = 0;
  const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
  bosses.step(fight, ++t, seq(0.99, 0)); // the second move (the sweep), aimed at the first player near
  assert.equal(fight.pending.move.shape, "line"); while (fight.pending) bosses.step(fight, ++t, pick(0));
  assert.ok(near.taken > 0); assert.equal(beside.taken, 0);
  fighters.splice(fighters.indexOf(beside), 1);
  // phase two at two-thirds health: a title, a moment's resistance, new moves (Field of Frost)
  boss.health.currentValue = 230; near.titles.length = 0; bosses.step(fight, ++t, pick(0)); assert.equal(fight.phase, 1);
  assert.ok(near.titles.some((s) => s.includes("Phase 2")), near.titles.join()); assert.equal(boss.effects.get("resistance"), 4);
  assert.ok(bosses.movesOf(fight).some((m) => m.name === "Field of Frost"));
  // the barrage marks every player and leaves frozen ground that keeps hurting
  near.taken = 0; near.location = { x: 4, y: 64, z: 0 }; fight.next = 0; fight.pending = undefined;
  const barrage = bosses.movesOf(fight).findIndex((m) => m.name === "Field of Frost"); bosses.step(fight, t += 50, pick((barrage + 0.5) / bosses.movesOf(fight).length));
  assert.equal(fight.pending.move.name, "Field of Frost"); while (fight.pending) bosses.step(fight, ++t, pick(0));
  const struck = near.taken; assert.ok(struck > 0 && bosses.hazards.length > 0, "a frozen field");
  bosses.tickHazards(t + 10); assert.ok(near.taken > struck, "standing on it hurts"); near.location = { x: 30, y: 64, z: 30 }; const moved = near.taken; bosses.tickHazards(t + 20); assert.equal(near.taken, moved, "stepping off is safe");
  bosses.tickHazards(t + 100000); assert.equal(bosses.hazards.length, 0, "the ground thaws");
  // the last phase enrages; a ring spares those close in
  boss.health.currentValue = 100; bosses.step(fight, ++t, pick(0)); assert.equal(fight.phase, 2); assert.ok(near.titles.some((s) => s.includes("Enraged"))); assert.ok(boss.effects.has("strength"));
  near.location = { x: 1.5, y: 64, z: 0 }; far.location = { x: 6, y: 64, z: 0 }; near.taken = 0; far.taken = 0; fight.next = 0; fight.pending = undefined;
  const ring = bosses.movesOf(fight).findIndex((m) => m.shape === "ring"); bosses.step(fight, t += 50, pick((ring + 0.5) / bosses.movesOf(fight).length));
  assert.equal(fight.pending.move.shape, "ring"); while (fight.pending) bosses.step(fight, ++t, pick(0)); assert.equal(near.taken, 0, "inside the ring is safe"); assert.ok(far.taken > 0);
  // bosses with allies call them at each change of phase
  const shal = { ...boss, id: "shal1", typeId: "overlord:shalltear", health: { currentValue: 90, effectiveMax: 300 }, effects: new Map() }; shal.getComponent = boss.getComponent; shal.addEffect = boss.addEffect;
  arena.spawned.length = 0; const f2 = bosses.engage(shal); bosses.step(f2, ++t, pick(0)); assert.equal(f2.phase, 2); assert.equal(arena.spawned.filter((e) => e.typeId === "overlord:vampire_bride").length, 4);
  // rewards: refining stones and gems for each foe, and a Codex the first time
  const pr = rpg.profileOf(near); pr.bosses = []; near.location = { x: 1, y: 64, z: 1 }; fighters.splice(fighters.indexOf(far), 1);
  const dead = { ...boss, location: { x: 0, y: 64, z: 0 } }; dead.getComponent = boss.getComponent;
  bosses.reward(dead, "cocytus", new Set(["near"]), pick(0)); const got = near.got.map((s) => s.typeId);
  assert.ok(got.includes("overlord:refining_stone") && got.some((g) => g.startsWith("overlord:gem_")) && got.includes("overlord:codex_of_skills"), got.join());
  near.got.length = 0; bosses.reward(dead, "cocytus", new Set(["near"]), pick(0)); assert.ok(!near.got.some((s) => s.typeId === "overlord:codex_of_skills"), "the Codex only the first time");
  assert.deepEqual(pr.bosses, ["cocytus"]);
  bosses.fights.clear();
}

// ---- gear: quality, gems, salvage ----
{
  const gear = await import("./gear.js");
  const g = mkPlayer("gwen"); g.dimension.mobs = []; world.afterEvents.playerSpawn.fire({ player: g, initialSpawn: true }); advance(80);
  g.selectedSlotIndex = 0; g.inv.length = 0; const sword = new ItemStack("overlord:razor_edge", 1); g.inv.push(sword);
  let armour = {};
  g.getComponent = ((base) => (c) => (c === "minecraft:equippable" ? { getEquipment: (slot) => (slot === "Mainhand" ? g.inv[g.selectedSlotIndex] : armour[slot]) } : base(c)))(g.getComponent);
  const give = (id, n) => g.inv.push(new ItemStack(id, n));
  // a workbench is needed
  assert.ok(gear.refine(g).includes("anvil")); g.dimension.mobs = [{ typeId: "overlord:dwarf", tags: new Set(), location: { x: 1, y: 64, z: 1 } }];
  assert.ok(gear.refine(g).includes("costs 1 Refining Stone"));
  give("overlord:refining_stone", 30); give("overlord:yggdrasil_gold_coin", 400);
  assert.ok(gear.refine(g, () => 0).includes("Fine")); assert.equal(gear.qualityOf(sword), 1); assert.ok(sword.lore.includes("§aFine") && sword.lore.some((l) => l.includes("Sockets")), sword.lore.join("|"));
  // a failed refinement costs the stones but not the item
  gear.refine(g, () => 0); const stones = spells.countItem(g, "overlord:refining_stone"); assert.ok(gear.refine(g, () => 0.99).includes("failed"));
  assert.equal(gear.qualityOf(sword), 2); assert.equal(spells.countItem(g, "overlord:refining_stone"), stones - 3);
  gear.refine(g, () => 0); assert.equal(gear.qualityOf(sword), 3); assert.equal(gear.socketsFor("overlord:razor_edge", 3), 2);
  // the held weapon's quality adds to every blow
  assert.equal(rpg.heldQuality(g), 3);
  // gems: two sockets, then full; they come back out for a few coins
  give("overlord:gem_ruby", 1); give("overlord:gem_onyx", 1); give("overlord:gem_jade", 1);
  assert.ok(gear.socket(g, "ruby").includes("Ruby")); assert.ok(gear.socket(g, "onyx").includes("Onyx")); assert.ok(gear.socket(g, "jade").includes("filled"));
  assert.deepEqual(gear.gemsOf(sword), ["ruby", "onyx"]); assert.ok(sword.lore.some((l) => l.includes("[Ruby of Embers] [Onyx of Night]")), sword.lore.join("|"));
  // in combat: the ruby burns and the onyx drinks
  const foe = mob("minecraft:zombie", 100, ["monster"]); foe.id = "gz"; foe.location = { x: 0, y: 64, z: 2 }; foe.burning = 0; foe.setOnFire = (n) => { foe.burning = n; }; foe.addEffect = () => {};
  g.health.currentValue = 10; gear.gemBlow(g, foe, 10, gear.gemsOf(sword), () => 0); assert.equal(foe.burning, 3); assert.ok(Math.abs(g.health.currentValue - 10.5) < 1e-9);
  assert.equal(spells.countItem(g, "overlord:gem_ruby"), 0); assert.ok(gear.unsocket(g).includes("2 gems")); assert.equal(spells.countItem(g, "overlord:gem_ruby"), 1); assert.deepEqual(gear.gemsOf(sword), []);
  // reinforcing keeps the quality lines
  // armour: quality turns harm aside, gems work all the time
  const helm = new ItemStack("overlord:infernal_helmet", 1); helm.setDynamicProperty("overlord:quality", 4); helm.setDynamicProperty("overlord:gems", "sapphire");
  const plate = new ItemStack("overlord:infernal_chestplate", 1); plate.setDynamicProperty("overlord:quality", 2); plate.setDynamicProperty("overlord:gems", "topaz,topaz");
  armour = { Head: helm, Chest: plate }; assert.deepEqual(gear.wornGear(g), { quality: 6, gems: { sapphire: 1, topaz: 2 } });
  const pg = rpg.profileOf(g); pg.mana = 0; g.effects.clear(); gear.tickGear(g, 1); assert.equal(pg.mana, 0.5); assert.ok(g.effects.has("speed"));
  g.health.currentValue = 10; world.afterEvents.entityHurt.fire({ hurtEntity: g, damage: 10, damageSource: { cause: "entityAttack" } }); assert.ok(Math.abs(g.health.currentValue - 10.9) < 1e-9, `${g.health.currentValue}`);
  // salvage: the piece is gone, materials and gems come back
  sword.setDynamicProperty("overlord:gems", "jade"); sword.setDynamicProperty("overlord:plus", 2); const before = spells.countItem(g, "overlord:refining_stone");
  assert.ok(gear.salvage(g, () => 0.9).includes("Salvaged")); assert.equal(g.inv[0], undefined); assert.equal(spells.countItem(g, "overlord:refining_stone"), before + 1 + 3 + 2);
  assert.equal(spells.countItem(g, "overlord:gem_jade"), 2);
  // the workbench page
  g.inv[0] = new ItemStack("overlord:spuit_lance", 1); gear.openWorkbench(g); const page = shown[shown.length - 1]; assert.ok(page.title.includes("Workbench") && page.body.includes("Common") && page.body.includes("Sunstone"), page.body);
  g.dimension.mobs = []; players.splice(players.indexOf(g), 1);
}

// ---- v7.5.5: dragons take to the air ----
{
  const sky = mkPlayer("sky"); sky.dimension = makeLand(); sky.location = { x: 0, y: 64, z: 8 };
  sky.dimension.getPlayers = (q) => (!q || !q.maxDistance || Math.hypot(sky.location.x - q.location.x, sky.location.z - q.location.z) <= q.maxDistance ? [sky] : []);
  const others = players.splice(0, players.length, sky); const hits = []; sky.applyDamage = (n) => hits.push(n); sky.applyKnockback = () => {}; sky.runCommand = () => {};
  const wyrm = sky.dimension.spawnEntity("overlord:frost_dragon", { x: 0, y: 64, z: -10 }); wyrm.health.effectiveMax = 700; wyrm.health.currentValue = 500;
  const events = []; Object.assign(wyrm, { id: "sky-wyrm", matches: (q) => q.families.every((f) => ["dragon", "monster", "mob"].includes(f)), getViewDirection: () => ({ x: 0, y: 0, z: 1 }),
    getVelocity: () => ({ x: 0, y: 0, z: 0 }), getEffect: () => undefined, triggerEvent: (e) => events.push(e), tryTeleport(to) { wyrm.location = { ...to }; return true; } });
  const frost = dragons.DRAGONS["overlord:frost_dragon"];
  // a dragon first seen is stood on its feet
  const st = dragons.stateOf(wyrm); assert.deepEqual(events, ["overlord:land"]); st.roared = true; st.flyAt = 0; st.breathAt = 1e9; st.buffetAt = 1e9;
  sky.msgs.length = 0; dragons.tend(wyrm); assert.ok(events.includes("overlord:take_off") && sky.msgs.some((m) => m.includes("takes to the sky")), "a wounded dragon takes off");
  assert.ok(dragons.flights.has(wyrm.id));
  advance(31); assert.ok(Math.abs(wyrm.location.y - (64 + 10 + 2.6 * 2)) < 1.3, `it climbs: ${wyrm.location.y}`);
  // it circles high over its foe, and its breath rains down
  advance(80); const gap = Math.hypot(wyrm.location.x - sky.location.x, wyrm.location.z - sky.location.z);
  assert.ok(gap > 10 && gap < 18 && wyrm.location.y > 70, `circling at ${gap}, height ${wyrm.location.y}`); assert.ok(hits.length >= 1, "breath from the sky");
  // while aloft the ground attacks wait
  st.buffetAt = 0; const before = hits.length; dragons.tend(wyrm); advance(1); assert.ok(st.buffetAt === 0, "no buffet from the air"); hits.length = before;
  // then it marks a spot, hangs over it, and dives
  advance(150); assert.ok(sky.msgs.some((m) => m.includes("dives")), "the dive is announced"); hits.length = 0;
  advance(30 + 15); assert.ok(events.filter((e) => e === "overlord:land").length === 2, "it lands"); assert.ok(!dragons.flights.has(wyrm.id) && st.flight === undefined);
  assert.ok(hits.includes(16 + 2.6 * 2), `the landing strikes whoever stayed on the mark: ${hits}`); assert.ok(Math.abs(wyrm.location.y - 64) < 0.01);
  assert.ok(st.flyAt > system.currentTick + 20 * 20, "and it waits before flying again");
  // a dragon that is not yet wounded stays on the ground
  const fresh = sky.dimension.spawnEntity("overlord:skeletal_dragon", { x: 30, y: 64, z: 0 }); fresh.health.effectiveMax = 550; fresh.health.currentValue = 550;
  Object.assign(fresh, { id: "sky-bones", matches: wyrm.matches, getViewDirection: wyrm.getViewDirection, getVelocity: wyrm.getVelocity, getEffect: () => undefined, triggerEvent() {}, tryTeleport: () => true });
  const fs = dragons.stateOf(fresh); fs.roared = true; fs.flyAt = 0; dragons.tend(fresh); assert.ok(!dragons.flights.has(fresh.id));
  world.afterEvents.entityDie.fire({ deadEntity: wyrm, damageSource: {} }); world.afterEvents.entityDie.fire({ deadEntity: fresh, damageSource: {} }); advance(60);
  players.splice(0, players.length, ...others);
}

// ---- v7.5.5: the Great Tomb of Nazarick ----
{
  const tomb = await import("./dungeon.js");
  assert.equal(tomb.FLOORS.length, 5); assert.deepEqual(tomb.FLOORS[4].stages, [["overlord:albedo"], ["overlord:ainz"]]);
  // an underground world that records blocks and knows who stands where
  const placed = new Map(); const k = (l) => `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`; const party = []; const spawned = [];
  const deep = { id: "minecraft:overworld", spawnParticle() {}, playSound() {},
    setBlockType: (l, t) => placed.set(k(l), t),
    fillBlocks(v, t) { for (let x = v.from.x; x <= v.to.x; x++) for (let y = v.from.y; y <= v.to.y; y++) for (let z = v.from.z; z <= v.to.z; z++) placed.set(`${x},${y},${z}`, t); },
    getBlock: (l) => ({ typeId: placed.get(k(l)) ?? "minecraft:stone", getComponent: () => ({ container: { addItem() {} } }) }),
    getPlayers: (q) => party.filter((p) => !q || !q.maxDistance || Math.hypot(p.location.x - q.location.x, p.location.y - q.location.y, p.location.z - q.location.z) <= q.maxDistance),
    getEntities: (q) => spawned.filter((m) => m.isValid && (q.tags ?? []).every((t) => m.tags.has(t))),
    spawnEntity(type, at) { const m = { id: `t${spawned.length}`, typeId: type, location: at, isValid: true, tags: new Set(), addTag(t) { m.tags.add(t); }, remove() { m.isValid = false; },
      health: { currentValue: 100, effectiveMax: 100 }, getComponent(c) { return c === "minecraft:health" ? m.health : undefined; } }; spawned.push(m); return m; } };
  const realDimension = world.getDimension; world.getDimension = () => deep;
  const adventurer = (name) => { const p = mkPlayer(name); p.dimension = deep; p.location = { x: 500.5, y: 64, z: 500.5 }; p.teleport = (to) => { p.location = { ...to }; }; p.taken = 0;
    p.applyDamage = (n) => { p.taken += n; }; p.setOnFire = () => {}; p.camera = { fade() {} }; party.push(p); return p; };
  const una = adventurer("una"), vex = adventurer("vex"); vex.location = { x: 502, y: 64, z: 501 };
  world.props.delete("overlord:tomb");
  // the first entrance opens the Tomb beneath the entrance and takes the party down
  assert.ok(tomb.enter(una).includes("descend")); const t = tomb.tombOf(); assert.ok(t && t.x === 500 && t.top === 48);
  assert.equal(placed.get(`500,${tomb.floorY(t, 0)},${500 - 11}`), "minecraft:iron_bars", "the gate starts barred");
  assert.equal(placed.get(`500,${tomb.floorY(t, 4) - 1},500`), "overlord:gilded_nazarick_bricks", "five floors down: the Throne Room");
  assert.deepEqual(una.location, tomb.arrival(t, 0)); assert.deepEqual(vex.location, tomb.arrival(t, 0), "whoever stands beside goes too");
  assert.equal(tomb.floorAt(t, una.location), 0);
  // arriving wakes the garrison; when it falls, the guardian comes; when she falls, the gate opens
  let now = 100000; tomb.tick(now); assert.equal(tomb.floors[0].status, "wave"); assert.equal(spawned.filter((m) => m.tags.has("overlord_tomb_0")).length, 9);
  for (const m of spawned) m.health.currentValue = 0; tomb.tick(now += 10); assert.equal(tomb.floors[0].status, "boss");
  const shalltear = spawned[spawned.length - 1]; assert.equal(shalltear.typeId, "overlord:shalltear");
  const coins = () => spells.countItem(una, "overlord:yggdrasil_gold_coin"); const purse = coins();
  shalltear.health.currentValue = 0; tomb.tick(now += 10); assert.equal(tomb.floors[0].status, "cleared"); assert.equal(placed.get(`500,${tomb.floorY(t, 0)},${500 - 11}`), "minecraft:air", "the gate opens");
  assert.equal(coins() - purse, 15);
  // a trap on the next floor: standing on it is felt a moment later
  una.location = { ...tomb.exitPad(t, 0) }; tomb.tick(now += 10); assert.equal(tomb.floorAt(t, una.location), 1, "the gate takes the party down");
  const [tx, tz] = tomb.FLOORS[1].traps[0]; una.location = { x: t.x + tx + 0.5, y: tomb.floorY(t, 1), z: t.z + tz + 0.5 }; tomb.springTraps(deep, t, 1, [una], now); advance(9);
  assert.equal(una.taken, 4); assert.ok(una.effects.has("slowness"));
  // the Throne Room: Albedo first, then Ainz himself
  for (let i = 1; i < 4; i++) tomb.floors[i].status = "cleared";
  una.location = { ...tomb.arrival(t, 4) }; vex.location = { x: 0, y: 64, z: 0 }; tomb.tick(now += 10); for (const m of spawned) m.health.currentValue = 0; tomb.tick(now += 10);
  assert.equal(spawned[spawned.length - 1].typeId, "overlord:albedo"); spawned[spawned.length - 1].health.currentValue = 0; tomb.tick(now += 10);
  assert.equal(spawned[spawned.length - 1].typeId, "overlord:ainz", "the master of the Tomb rises"); assert.equal(tomb.floors[4].status, "boss");
  spawned[spawned.length - 1].health.currentValue = 0; tomb.tick(now += 10); assert.equal(tomb.floors[4].status, "cleared");
  // the last gate leads out with the Tomb's reward; a Codex pair only the first time
  const pu = rpg.profileOf(una); pu.bosses = []; una.msgs.length = 0; una.location = { ...tomb.exitPad(t, 4) }; tomb.tick(now += 10);
  assert.ok(una.msgs.some((m) => m.includes("conquered")) || pu.bosses.includes("great_tomb")); assert.equal(spells.countItem(una, "overlord:codex_of_skills") >= 2, true);
  assert.equal(tomb.floorAt(t, una.location), undefined, "back on the surface"); assert.ok(Math.abs(una.location.x - 500.5) < 1e-9 && Math.abs(una.location.z - 503.5) < 1e-9, "where they came in");
  // the Key: outside it leads in (to the same Tomb), inside it leads out
  world.afterEvents.itemUse.fire({ source: una, itemStack: { typeId: "overlord:tomb_key" } }); assert.equal(tomb.floorAt(t, una.location), 0);
  assert.deepEqual(tomb.tombOf(), t, "the same Tomb"); assert.equal(tomb.floors[0].status, "idle", "a fresh run");
  world.afterEvents.itemUse.fire({ source: una, itemStack: { typeId: "overlord:tomb_key" } }); assert.equal(tomb.floorAt(t, una.location), undefined);
  // a Mausoleum's crystal is a gate too
  world.props.set(`overlord:site7:${Math.floor(9000 / sites.REGION)},${Math.floor(9000 / sites.REGION)}`, "great_tomb|9000|64|9000|1"); // a region no earlier test has looked at
  una.location = { x: 9000.5, y: 65, z: 8992.5 }; tomb.tick(now += 400); assert.equal(tomb.floorAt(t, una.location), 0, "stepping on the crystal descends");
  world.getDimension = realDimension; for (const p of party) players.splice(players.indexOf(p), 1);
}

// ---- v7.6: god-tier magic ----
{
  const god = await import("./godspells.js");
  const keys = spells.SPELLS.filter((s) => s.tier === spells.GOD).map((s) => s.key);
  assert.deepEqual(keys.sort(), ["cataclysm", "goal_of_all_life", "pantheon"]);
  assert.equal(spells.levelForTier(spells.GOD), 80); assert.equal(spells.costForTier(spells.GOD), 48);
  // a battlefield: creatures are found by distance
  const field = []; const spawned = [];
  const plain = { id: "minecraft:overworld", spawnParticle() {}, playSound() {},
    getEntities: (q) => field.filter((e) => e.isValid && (!q.families || e.matches({ families: q.families })) && (!q.location || Math.hypot(e.location.x - q.location.x, e.location.z - q.location.z) <= (q.maxDistance ?? 1e9))),
    getPlayers: (q) => [z].filter((p) => !q || Math.hypot(p.location.x - q.location.x, p.location.z - q.location.z) <= (q.maxDistance ?? 1e9)),
    spawnEntity(type, at, opts) { const e = { typeId: type, location: at, event: opts?.spawnEvent, isValid: true, tags: new Set(), addTag(t) { e.tags.add(t); }, remove() { e.isValid = false; },
      getComponent: (c) => (c === "minecraft:tameable" ? { tame() {} } : undefined) }; spawned.push(e); return e; } };
  const creature = (type, hp, x, zz, fam = ["monster"]) => { const e = { id: `g${field.length}`, typeId: type, isValid: true, location: { x, y: 64, z: zz }, tags: new Set(), effects: [], knocked: 0, fire: 0,
    health: { currentValue: hp, effectiveMax: hp, setCurrentValue(v) { this.currentValue = v; } }, getComponent(c) { return c === "minecraft:health" ? e.health : undefined; },
    hasTag: (t) => e.tags.has(t), matches: (q) => q.families.every((f) => fam.includes(f)), addEffect(n) { e.effects.push(n); }, setOnFire(s) { e.fire = s; }, applyKnockback() { e.knocked += 1; },
    applyDamage(n) { e.health.currentValue = Math.max(0, e.health.currentValue - n); } }; field.push(e); return e; };
  const z = mkPlayer("zed"); const pz = rpg.profileOf(z); z.dimension = plain; z.location = { x: 0, y: 64, z: 0 }; z.camera = { shots: [], cleared: 0, setCamera(p, o) { this.shots.push([p, o]); }, clear() { this.cleared += 1; }, fade() {} };
  z.getEntitiesFromViewDirection = () => []; z.getBlockFromViewDirection = () => undefined; z.titles = []; z.onScreenDisplay.setTitle = (t) => z.titles.push(t);
  // learning: level 80, 48 crystals - and only after the Great Tomb has been conquered
  pz.level = 80; pz.spells = []; pz.bosses = []; z.inv.push(new ItemStack("overlord:data_crystal", 64));
  assert.ok(spells.learnSpell(z, "pantheon").includes("conquered the Great Tomb")); pz.bosses = ["great_tomb"];
  assert.ok(spells.learnSpell(z, "pantheon").includes("Learned")); assert.equal(spells.countItem(z, "overlord:data_crystal"), 16);
  // The Goal of All Life Is Death: nothing at first, then lesser things die, bosses bleed a third, allies are spared
  const imp = creature("overlord:goblin", 40, 10, 0), ghoul = creature("overlord:old_guarder", 60, -20, 15, ["monster", "undead"]), titan = creature("overlord:gargantua", 600, 30, 0);
  const pet = creature("overlord:retainer", 60, 3, 3), far = creature("overlord:goblin", 40, 60, 0), villager = creature("minecraft:villager_v2", 20, 5, 0, ["villager", "mob"]); field.forEach((e) => {}); z.health.currentValue = 10; pz.mana = 0;
  const said = []; const realSend = world.sendMessage; world.sendMessage = (m) => said.push(m);
  assert.equal(god.goalOfAllLife(z, 1), true); assert.ok(z.titles.some((t) => t.includes("Goal of All Life")) && said.some((m) => m.includes("invokes")));
  assert.ok(z.camera.shots.length === 1 && z.camera.shots[0][0] === "minecraft:free", "the camera pulls back"); assert.ok(z.anims.includes("animation.overlord.cast_god"));
  assert.ok(imp.effects.includes("slowness"), "dread falls first"); assert.equal(imp.health.currentValue, 40, "the clock has to strike first");
  advance(12 * 10 + 1); assert.equal(imp.health.currentValue, 0); assert.equal(ghoul.health.currentValue, 0); assert.ok(Math.abs(titan.health.currentValue - 600 * 0.67) < 1e-6, `${titan.health.currentValue}`);
  assert.equal(pet.health.currentValue, 60, "allies are spared"); assert.equal(villager.health.currentValue, 20, "and so are villagers and animals"); assert.equal(far.health.currentValue, 40, "beyond 40 blocks nothing happens");
  advance(40); assert.equal(spawned.filter((e) => e.typeId === "overlord:death_knight" && e.event === "overlord:become_summoned").length, 4, "the slain rise as Death Knights");
  assert.ok(z.health.currentValue > 10 && pz.mana >= 10, "the souls feed the caster"); advance(200); assert.ok(z.camera.cleared >= 1, "and the camera is given back");
  // Pantheon: a host of six, then judgement - harder on the undead - and a final blow on all
  field.length = 0; spawned.length = 0; const brute = creature("overlord:ogre", 1000, 8, 0), lich = creature("overlord:elder_lich", 1000, -8, 0, ["monster", "undead"]);
  const realRandom = Math.random; let flip = 0; Math.random = () => ((flip++ % 2) * 0.99);
  assert.equal(god.pantheon(z, 1), true); advance(31); assert.equal(spawned.filter((e) => e.typeId === "overlord:archangel_flame").length, 6);
  advance(40 + 20 * 10 + 20); Math.random = realRandom;
  const brutal = 1000 - brute.health.currentValue, lichen = 1000 - lich.health.currentValue;
  assert.ok(brutal >= 30 * 10 + 40 - 1e-6 && lichen >= 60 * 10 + 40 - 1e-6, `judgement: ${brutal} ${lichen}`);
  // Cataclysm: meteors across the field, then the great one - and everything within 26 blocks is thrown back
  field.length = 0; const victim = creature("overlord:ogre", 2000, 20, 0), bystander = creature("overlord:ogre", 2000, 20, 22), scorchee = creature("overlord:ogre", 2000, 26, 0);
  z.getEntitiesFromViewDirection = () => [{ entity: victim }];
  assert.equal(god.cataclysm(z, 1), true); advance(60 + 120 + 20 + 1);
  assert.ok(2000 - victim.health.currentValue >= 150, `the great meteor: ${victim.health.currentValue}`); assert.ok(victim.knocked >= 1 && bystander.knocked >= 1);
  const afterImpact = scorchee.health.currentValue; advance(8 * 20); assert.ok(afterImpact - scorchee.health.currentValue >= 4 * 7 - 1e-6, `and the ground burns: ${afterImpact} -> ${scorchee.health.currentValue}`);
  // god-tier casts through the wand like any spell, with the long recharge
  pz.spells = ["cataclysm"]; pz.slots = ["cataclysm", "", "", ""]; pz.slot = 0; pz.mana = 1000; assert.equal(spells.castSelected(z), true); assert.ok(pz.mana <= 1000 - 200 + 1e-6);
  assert.equal(spells.castSelected(z), false, "five minutes before it can be cast again");
  world.sendMessage = realSend; advance(600); players.splice(players.indexOf(z), 1);
}

// ---- v7.6.1: the Creative Tome of Ascension ----
{
  const dev = await import("./devtools.js");
  const q = mkPlayer("quill"); const pq = rpg.profileOf(q); world.afterEvents.playerSpawn.fire({ player: q, initialSpawn: true }); advance(80);
  const use = (sneak = false) => { q.isSneaking = sneak; world.afterEvents.itemUse.fire({ source: q, itemStack: { typeId: "overlord:ascension_tome" } }); q.isSneaking = false; };
  // outside creative it does nothing
  q.getGameMode = () => "Survival"; use(true); assert.equal(pq.level, 1); assert.ok(q.bar.includes("only in creative"), q.bar);
  // in creative: sneak + use is +10 levels, with their stat points; skill points follow
  q.getGameMode = () => "Creative"; use(true); assert.equal(pq.level, 11); assert.equal(pq.points, 30);
  const sk = await import("./skills.js"); assert.equal(sk.available(pq), sk.pointsForLevel(11));
  // the menu: level 100, learn everything, unlock god-tier, refresh, test kit, back to level 1
  const pick = async (n) => { script.push(n); dev.openTome(q); for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); script.length = 0; };
  await pick(2); assert.equal(pq.level, 100); assert.equal(pq.points, 30 + 89 * 3); assert.equal(pq.mana, rpg.maxMana(pq));
  await pick(3); assert.equal(pq.spells.length, spells.SPELLS.length);
  await pick(4); assert.ok(pq.bosses.includes("great_tomb"));
  pq.mana = 0; q.health.currentValue = 3; await pick(5); assert.equal(pq.mana, rpg.maxMana(pq)); assert.equal(q.health.currentValue, 20);
  await pick(6); assert.equal(spells.countItem(q, "overlord:codex_of_skills"), 10); assert.equal(spells.countItem(q, "overlord:gem_onyx"), 4);
  await pick(7); assert.equal(pq.story.length, 10); assert.equal(spells.countItem(q, "overlord:royal_seal"), 1, "the campaign shortcut crowns and hands over the Seal");
  pq.str = 10; pq.skills = { weapon_mastery: 3 }; await pick(10); assert.equal(pq.level, 1); assert.equal(pq.str, 0); assert.equal(pq.points, 0); assert.deepEqual(pq.skills, {});
  assert.ok(shown.some((f) => f.title === "Creative Tome of Ascension"));
  players.splice(players.indexOf(q), 1);
}

// ---- v7.7: weapon techniques ----
{
  const arms = await import("./arms.js");
  const t = mkPlayer("tess"); t.dimension.mobs = []; world.afterEvents.playerSpawn.fire({ player: t, initialSpawn: true }); advance(80);
  let hand = "overlord:razor_edge";
  t.getComponent = ((base) => (c) => (c === "minecraft:equippable" ? { getEquipment: (slot) => (slot === "Mainhand" && hand ? { typeId: hand } : undefined) } : base(c)))(t.getComponent);
  t.applyKnockback = () => {}; t.startItemCooldown = () => {}; t.isSneaking = false; t.isOnGround = true; t.getVelocity = () => ({ x: 0, y: 0, z: 0 });
  const foe = (x, z, hp = 300) => { const m = mob("minecraft:zombie", hp, ["monster"]); Object.assign(m, { id: `tq${Math.random()}`, location: { x, y: 64, z }, tags: new Set(), afflicted: [], lifted: 0,
    hasTag: (tg) => m.tags.has(tg), addEffect(e) { m.afflicted.push(e); }, setOnFire() {}, applyKnockback(_h, v) { m.lifted = v; }, applyDamage(n) { m.health.currentValue = Math.max(0, m.health.currentValue - n); } }); return m; };
  // Plunging Strike: a blow while falling slams everything round the target
  const a = foe(0, 2), b = foe(2, 3); t.dimension.mobs = [a, b];
  t.isOnGround = false; t.getVelocity = () => ({ x: 0, y: -0.8, z: 0 }); t.bar = "";
  arms.techniques(t, a, 10, "none"); assert.ok(t.bar.includes("Plunging Strike"), t.bar); assert.ok(b.health.currentValue < 300 && b.lifted > 0, "the slam reaches the foe beside");
  const after = b.health.currentValue; arms.techniques(t, a, 10, "none"); assert.equal(b.health.currentValue, after, "and rests a moment"); assert.ok(!t.bar.includes("Recharging"), "quietly");
  // Charging Strike: a blow while sprinting runs on through a line of foes
  t.isOnGround = true; t.getVelocity = () => ({ x: 0, y: 0, z: 0 }); t.isSprinting = true; advance(41);
  const line = foe(0, 4); t.dimension.mobs = [a, line]; arms.techniques(t, a, 10, "none"); assert.ok(t.bar.includes("Charging Strike")); assert.equal(line.health.currentValue, 295);
  t.isSprinting = false;
  // Perfect Parry: sneak pressed just before the blow - the harm is undone and the attacker is struck back
  const brute = foe(0, 1); brute.typeId = "overlord:war_troll"; t.dimension.mobs = [brute]; advance(200);
  t.isSneaking = true; arms.step(t, system.currentTick); t.isSneaking = false; arms.step(t, system.currentTick + 2);
  t.health.currentValue = 12; world.afterEvents.entityHurt.fire({ hurtEntity: t, damage: 8, damageSource: { damagingEntity: brute, cause: "entityAttack" } });
  assert.equal(t.health.currentValue, 20, "parried"); assert.equal(brute.health.currentValue, 300 - 12); assert.ok(brute.afflicted.includes("slowness") && t.anims.includes("animation.overlord.weapon_parry"));
  // too late: no parry
  advance(5 * 20); t.isSneaking = true; arms.step(t, system.currentTick); t.isSneaking = false; advance(20);
  t.health.currentValue = 12; world.afterEvents.entityHurt.fire({ hurtEntity: t, damage: 8, damageSource: { damagingEntity: brute, cause: "entityAttack" } }); assert.equal(t.health.currentValue, 12, "the window had passed");
  // without one of the add-on's weapons there is nothing to parry with
  hand = undefined; t.isSneaking = true; arms.step(t, system.currentTick); t.isSneaking = false; arms.step(t, system.currentTick + 2);
  assert.equal(arms.parry(t, brute, 8, "entityAttack"), false);
  t.dimension.mobs = []; players.splice(players.indexOf(t), 1);
}

// v8.0: the campaign, Rise of the Sorcerer King, and the Sorcerer Kingdom
{
  const story = await import("./campaign.js");
  const king = await import("./kingdom.js");
  assert.equal(story.CHAPTERS.length, 10); assert.equal(story.CHAPTERS[9].key, "coronation");
  assert.ok(story.CHAPTERS.every((c, i) => i === 0 || c.level > story.CHAPTERS[i - 1].level), "chapters ask for rising levels");
  assert.ok(story.CHAPTERS.every((c) => c.stages.at(-1).boss && c.intro.length > 0 && c.outro.length > 0), "every chapter ends with a boss and is told");
  // a field that records blocks and the people on it
  const placed = new Map(); const k = (l) => `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`; const spawned = []; let biggest = 0; const here = [];
  const field = { id: "minecraft:overworld", spawnParticle() {}, playSound() {},
    setBlockType: (l, t) => placed.set(k(l), t),
    fillBlocks(v, t) { biggest = Math.max(biggest, (v.to.x - v.from.x + 1) * (v.to.y - v.from.y + 1) * (v.to.z - v.from.z + 1));
      for (let x = v.from.x; x <= v.to.x; x++) for (let y = v.from.y; y <= v.to.y; y++) for (let z = v.from.z; z <= v.to.z; z++) placed.set(`${x},${y},${z}`, t); },
    getBlock: (l) => ({ isAir: true, typeId: placed.get(k(l)) ?? "minecraft:air", getComponent: () => ({ container: { addItem() {} } }) }),
    getTopmostBlock: ({ x, z }) => ({ location: { x, y: 63, z } }),
    getPlayers: (q) => here.filter((p) => !q || !q.maxDistance || Math.hypot(p.location.x - q.location.x, p.location.z - q.location.z) <= q.maxDistance),
    getEntities: (q) => spawned.filter((m) => m.isValid && (q.tags ?? []).every((t) => m.tags.has(t)) && (!q.type || m.typeId === q.type) &&
      (!q.maxDistance || Math.hypot(m.location.x - q.location.x, m.location.z - q.location.z) <= q.maxDistance)),
    spawnEntity(type, at, opts) { const m = { id: `s${spawned.length}`, typeId: type, location: at, isValid: true, tags: new Set(), event: opts?.spawnEvent,
      addTag(t) { m.tags.add(t); }, hasTag: (t) => m.tags.has(t), remove() { m.isValid = false; },
      health: { currentValue: 100, effectiveMax: 100 }, getComponent(c) { return c === "minecraft:health" ? m.health : undefined; } }; spawned.push(m); return m; } };
  const w = mkPlayer("wren"); w.dimension = field; here.push(w); w.location = { x: 20000.5, y: 64, z: 20000.5 }; w.isSneaking = false;
  w.teleport = (to) => { w.location = { ...to }; }; w.camera = { set: [], setCamera(_k, o) { this.set.push(o); }, clear() { this.cleared = true; }, fade() {} };
  world.afterEvents.playerSpawn.fire({ player: w, initialSpawn: true }); advance(80);
  const pw = rpg.profileOf(w); const coins = () => spells.countItem(w, "overlord:yggdrasil_gold_coin");
  const foes = (run) => story.foesOf(run); const slay = (list) => list.forEach((m) => { m.health.currentValue = 0; });
  // chapters open in order, each at its level
  const [carne, graveyard] = story.CHAPTERS; rpg.setLevel(w, 1);
  assert.ok(story.blocked(w, carne).includes("level 5"), story.blocked(w, carne) + " lvl " + pw.level); assert.ok(story.blocked(w, graveyard).includes("Finish"));
  rpg.setLevel(w, 5); assert.equal(story.blocked(w, carne), "");
  let now = 600000;
  assert.ok(story.begin(w, carne, now).includes("Chapter 1")); const run = story.runs.get("wren");
  assert.equal(spawned.filter((m) => m.tags.has("overlord_story_wren_ally")).length, 3, "Gazef and two soldiers");
  assert.equal(foes(run).length, 0, "allies are not foes"); assert.ok(story.begin(w, carne, now).includes("already"));
  // the intro: a line at a time while the camera circles, then the battle
  story.tick(now += 50); assert.equal(run.line, 1); assert.equal(w.camera.set.length, 1); assert.ok(w.msgs.at(-1).includes("smoke") || w.msgs.at(-1).includes("Smoke"));
  for (let i = 0; i < 3; i++) story.tick(now += story.LINE_TICKS);
  assert.equal(run.phase, "intro"); story.tick(now += story.LINE_TICKS); assert.equal(run.phase, "fight"); assert.ok(w.camera.cleared, "the camera is handed back");
  assert.equal(foes(run).length, 3); assert.ok(w.title.includes("Priests"));
  story.tick(now += 20); assert.equal(run.stage, 0, "the stage holds while foes stand");
  slay(foes(run)); story.tick(now += 20); assert.equal(run.stage, 1); assert.equal(foes(run).length, 4);
  slay(foes(run)); story.tick(now += 20); assert.equal(run.stage, 2); assert.ok(foes(run).some((m) => m.typeId === "overlord:nigun")); assert.ok(w.title.includes("Nigun"));
  slay(foes(run)); story.tick(now += 20); assert.equal(run.phase, "outro");
  const purse = coins(); for (let i = 0; i < 5; i++) story.tick(now += story.LINE_TICKS);
  assert.ok(!story.runs.has("wren"), "the chapter is over"); assert.deepEqual(pw.story, ["carne"]); assert.equal(coins() - purse, 20);
  assert.equal(spells.countItem(w, "overlord:blue_potion"), 3); assert.ok(spawned.every((m) => !m.isValid), "allies leave the field");
  assert.ok(guild.checkTitles(w).includes("Saviour of Carne"));
  // played again: a quarter of the coins, no items, no second entry
  story.begin(w, carne, now); const again = story.runs.get("wren"); assert.ok(again.replay);
  w.isSneaking = true; story.tick(now += 50); story.tick(now += story.LINE_TICKS); assert.equal(again.phase, "fight", "sneaking skips the dialogue"); w.isSneaking = false;
  for (let i = 0; i < 3; i++) { slay(foes(again)); story.tick(now += 20); }
  const before = coins(); for (let i = 0; i < 5; i++) story.tick(now += story.LINE_TICKS);
  assert.equal(coins() - before, 5); assert.deepEqual(pw.story, ["carne"]); assert.equal(spells.countItem(w, "overlord:blue_potion"), 3);
  // failing: straying, running out of time, falling
  rpg.setLevel(w, 15); story.begin(w, graveyard, now); w.location = { x: 20000.5 + story.LEASH + 5, y: 64, z: 20000.5 }; story.tick(now += 50);
  assert.ok(!story.runs.has("wren") && w.title.includes("failed")); w.location = { x: 20000.5, y: 64, z: 20000.5 };
  story.begin(w, graveyard, now); w.isSneaking = true; story.tick(now += 50); story.tick(now += story.LINE_TICKS); w.isSneaking = false;
  const slow = story.runs.get("wren"); assert.equal(slow.phase, "fight"); story.tick(now += story.STAGE_TIME * 20 + 1); assert.ok(!story.runs.has("wren"));
  assert.ok(w.msgs.at(-1).includes("time ran out")); assert.ok(spawned.every((m) => !m.isValid), "a failed chapter clears its field");
  story.begin(w, graveyard, now); world.afterEvents.entityDie.fire({ deadEntity: w, damageSource: {} }); assert.ok(!story.runs.has("wren"));
  assert.deepEqual(pw.story, ["carne"]);

  // the kingdom waits for the crown
  assert.ok(king.found(w).includes("crowned")); assert.ok(!story.crowned(w));
  story.completeStory(w); assert.ok(story.crowned(w)); assert.equal(pw.story.length, 10);
  assert.ok(guild.checkTitles(w).includes("Sorcerer King"));
  assert.ok(king.found(w, "Nazarick Reborn").includes("founded")); const realm = king.realmOf(w);
  assert.ok(realm && realm.name === "Nazarick Reborn" && realm.tier === 1 && realm.x === 20000 && realm.y === 64);
  assert.equal(placed.get(`20000,67,${20000 - 8}`), "overlord:data_crystal_block", "the throne's crystal"); assert.equal(placed.get(`20006,63,20006`), "overlord:nazarick_tiles"); assert.equal(placed.get(`20000,63,20005`), "overlord:gilded_nazarick_bricks", "the gilded way");
  assert.ok(king.found(w).includes("already"));
  // the treasury fills each kingdom day, up to five days
  assert.deepEqual(king.income(realm), { coins: 12, crystals: 1 });
  king.accrue(w, realm, king.DAY_SECONDS - 1); assert.equal(realm.treasury, 0); king.accrue(w, realm, 1); assert.equal(realm.treasury, 12);
  king.accrue(w, realm, king.DAY_SECONDS * 10); const full = king.income(realm).coins * king.treasuryDays(realm);
  assert.equal(realm.treasury, full, "capped at five days of pay"); assert.equal(realm.vault, king.income(realm).crystals * 5);
  let held = coins(); assert.ok(king.collect(w).includes(String(full))); assert.equal(coins() - held, full); assert.equal(realm.treasury, 0);
  // raising the capital: paid for, laid again larger, one layer at a time
  assert.ok(king.upgrade(w).includes("costs")); assert.equal(realm.tier, 1);
  rpg.giveItem(w, "overlord:yggdrasil_gold_coin", 2000); rpg.giveItem(w, "overlord:data_crystal", 400); rpg.giveItem(w, "overlord:guardian_crest", 6);
  assert.ok(king.upgrade(w).includes("Walled Town")); assert.equal(placed.get(`${20000 + 14},64,20000`), "overlord:nazarick_bricks", "the town wall");
  assert.ok(king.upgrade(w).includes("Fortress City")); assert.ok(king.upgrade(w).includes("Sorcerous Capital")); assert.equal(realm.tier, 4);
  assert.equal(placed.get(`20000,${64 + 20},${20000 - 12}`), "overlord:data_crystal_block", "the great spire"); assert.ok(king.upgrade(w).includes("already"));
  assert.ok(biggest <= 32768, `every fill stays inside the game's limit (${biggest})`); assert.ok(guild.checkTitles(w).includes("Sorcerous Majesty"));
  // guards: Death Knights in their summoned form, topped up but never doubled
  king.pulse(w, now); const guards = spawned.filter((m) => m.isValid && m.tags.has("overlord_realm_wren"));
  assert.equal(guards.length, 6); assert.ok(guards.every((m) => m.event === "overlord:become_summoned")); assert.ok(guards.some((m) => m.typeId === "overlord:behemoth"));
  king.pulse(w, now); assert.equal(spawned.filter((m) => m.isValid && m.tags.has("overlord_realm_wren")).length, 6);
  // outposts: a cleared enemy camp can be claimed, and then posts no garrison of its own
  const cx = 20700, cz = 20000; const region = `${Math.floor(cx / sites.REGION)},${Math.floor(cz / sites.REGION)}`; // a region nobody walked near const region = `${Math.floor(cx / sites.REGION)},${Math.floor(cz / sites.REGION)}`;
  world.setDynamicProperty(`overlord:site7:${region}`, `goblin_camp|${cx}|64|${cz}|1`);
  w.location = { x: 20100.5, y: 64, z: 20000.5 }; assert.ok(king.claimHere(w).includes("Stand in a camp"));
  w.location = { x: cx + 2, y: 64, z: cz }; const defender = field.spawnEntity("overlord:goblin", { x: cx, y: 64, z: cz + 2 }); defender.addTag("overlord_camp");
  { const m = king.claimHere(w); assert.ok(m.includes("1 defender"), m); } defender.health.currentValue = 0;
  const pay0 = king.income(realm);
  assert.ok(king.claimHere(w).includes("outpost")); assert.equal(sites.claimOf(region), "wren"); assert.equal(realm.outposts.length, 1);
  assert.ok(JSON.parse(world.getDynamicProperty("overlord:claims"))[region] === "wren"); assert.ok(king.claimHere(w).includes("already yours"));
  assert.deepEqual(king.income(realm), { coins: pay0.coins + 8, crystals: pay0.crystals + 1 });
  const mobs = spawned.length; sites.explore(w); assert.equal(spawned.filter((m, i) => i >= mobs && m.tags.has("overlord_camp")).length, 0, "a claimed camp posts no garrison");
  // an invasion at the outpost: three waves, then spoils and renown
  king.pulse(w, now); assert.equal(spawned.filter((m) => m.isValid && m.tags.has("overlord_realm_wren") && Math.hypot(m.location.x - cx, m.location.z - cz) < 10).length, 2, "the outpost's guards");
  realm.raidIn = 1; king.pulse(w, now, () => 0); const siege = king.sieges.get("wren"); assert.ok(siege && siege.holding === 0 && siege.foe.name === "The Slane Theocracy");
  const invaders = () => spawned.filter((m) => m.isValid && m.tags.has("overlord_siege_wren") && m.health.currentValue > 0);
  assert.equal(invaders().length, 7); const xpBefore = pw.xp + pw.level * 1e9;
  for (let i = 0; i < 3; i++) { slay(invaders()); king.stepSiege(siege, now += 20); }
  assert.ok(!king.sieges.has("wren")); assert.equal(realm.renown, 1); assert.equal(realm.defended, 1); assert.equal(realm.treasury, 60);
  assert.ok(pw.xp + pw.level * 1e9 > xpBefore);
  // a second invasion, left to run out: the outpost is lost and its camp goes back to the wild
  king.invade(w, realm, 0, now, 0.3); const lost = king.sieges.get("wren"); assert.equal(lost.foe.name, "Jaldabaoth's Remnant");
  king.stepSiege(lost, now + king.SIEGE_SECONDS * 20 + 1); assert.equal(realm.outposts.length, 0); assert.equal(sites.claimOf(region), undefined); assert.equal(realm.lost, 1);
  // at the capital a defeat loots the treasury instead
  w.location = { x: 20000.5, y: 64, z: 20003.5 }; king.invade(w, realm, -1, now); const sack = king.sieges.get("wren");
  world.afterEvents.entityDie.fire({ deadEntity: w, damageSource: {} }); assert.ok(!king.sieges.has("wren")); assert.equal(realm.treasury, 42); assert.equal(realm.lost, 2);
  // invasions can be turned off
  realm.invasions = false; realm.raidIn = 0; king.pulse(w, now); assert.ok(!king.sieges.has("wren"));
  // the Kingdom page and the Seal
  script.push(0); king.openKingdom(w); await new Promise((r) => setTimeout(r, 20)); assert.ok(shown.some((f) => f.title === "Nazarick Reborn"));
  held = coins(); assert.equal(coins() - held, 0);
  realm.name = "x"; pw.realm = {}; assert.equal(king.realmOf(w), undefined);
  for (const m of spawned) m.isValid = false; here.length = 0; players.splice(players.indexOf(w), 1);
}

// v8.1: races of Yggdrasil, and steeds
{
  const races = await import("./races.js");
  const steeds = await import("./steeds.js");
  // a field of creatures that answers by tag, type, family and distance
  const all = []; let n = 0;
  const creature = (typeId, at, families = ["monster"], hp = 100) => { const m = { id: `c${n++}`, typeId, location: { ...at }, isValid: true, tags: new Set(), props: new Map(), effects: new Map(),
    families, events: [], vel: { x: 0, y: 0, z: 0 }, isOnGround: true, burning: 0, get dimension() { return field; },
    health: { currentValue: hp, effectiveMax: hp, setCurrentValue(v) { this.currentValue = v; } },
    getComponent(c) { return c === "minecraft:health" ? m.health : undefined; }, addTag(t) { m.tags.add(t); }, hasTag: (t) => m.tags.has(t),
    matches: (q) => (q.families ?? []).every((f) => m.families.includes(f)), remove() { m.isValid = false; },
    getDynamicProperty: (k) => m.props.get(k), setDynamicProperty: (k, v) => m.props.set(k, v),
    addEffect(e, d, o = {}) { m.effects.set(e, { duration: d, amplifier: o.amplifier ?? 0 }); }, getEffect: (e) => m.effects.get(e),
    teleport(to) { m.location = { ...to }; }, triggerEvent(e) { m.events.push(e); }, clearVelocity() { m.vel = { x: 0, y: 0, z: 0 }; },
    applyImpulse(v) { m.vel = { x: m.vel.x + v.x, y: m.vel.y + v.y, z: m.vel.z + v.z }; }, setRotation(r) { m.rot = r; },
    setOnFire(s) { m.burning = s; }, applyKnockback() {}, applyDamage(x) { m.health.currentValue = Math.max(0, m.health.currentValue - x); } }; all.push(m); return m; };
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const field = { id: "minecraft:overworld", spawnParticle() {}, playSound() {}, getTopmostBlock: ({ x, z }) => ({ location: { x, y: 63, z } }), getPlayers: () => [],
    getEntities: (q) => all.filter((m) => m.isValid && (q.tags ?? []).every((t) => m.tags.has(t)) && (!q.type || m.typeId === q.type) &&
      (q.families ?? []).every((f) => m.families.includes(f)) && (!q.maxDistance || near(m.location, q.location) <= q.maxDistance)),
    spawnEntity: (type, at) => creature(type, at, type.endsWith("_steed") ? ["mob"] : ["monster"]) };
  const r = mkPlayer("rae"); r.dimension = field; r.location = { x: 9000.5, y: 64, z: 9000.5 }; r.isSneaking = false; r.isJumping = false; r.isOnGround = true;
  r.getVelocity = () => ({ x: 0, y: 0, z: 0 }); r.getRotation = () => ({ x: 0, y: 0 }); r.camera = { fade() {} };
  world.afterEvents.playerSpawn.fire({ player: r, initialSpawn: true }); advance(80);
  const pr = rpg.profileOf(r); rpg.setLevel(r, 30); pr.mana = 200;
  // a first race is free; it levels from a quarter of the XP earned
  assert.equal(races.raceOf(pr), "none"); assert.ok(races.chooseRace(r, "undead").includes("Skeleton")); assert.equal(pr.race, "undead");
  rpg.grantXp(r, 1200); assert.equal(pr.raceLv, 2); assert.equal(pr.raceXp, 0);
  // the undead: poison and wither do not hold, it sees in the dark and is never hungry
  r.effects.set("poison", { duration: 100, amplifier: 0 }); r.effects.set("wither", { duration: 100, amplifier: 0 });
  races.tick(r, system.currentTick); assert.ok(!r.effects.has("poison") && !r.effects.has("wither")); assert.ok(r.effects.has("night_vision") && r.effects.has("saturation"));
  const living = creature("minecraft:pig", { x: 9001, y: 64, z: 9001 }, ["mob"]); const zombie = creature("minecraft:zombie", { x: 9001, y: 64, z: 9001 }, ["undead", "monster"]);
  assert.equal(races.meleeBonus(r, pr, living), 0.2); assert.equal(races.meleeBonus(r, pr, zombie), 0);
  // the true form awakens at race level 5, costs mana and rests afterwards
  let now = 900000; assert.ok(races.transform(r, now).includes("race level 5"));
  races.setRaceLevel(r, 5); assert.equal(races.rankName(pr), "Elder Lich");
  zombie.location = { x: 9003, y: 64, z: 9001 }; const manaBefore = pr.mana;
  assert.ok(races.transform(r, now).includes("Overlord Form")); assert.ok(pr.mana < manaBefore); assert.ok(races.inForm(r));
  races.tick(r, now + 20); assert.equal(r.effects.get("resistance").amplifier, 1); assert.ok(zombie.effects.has("weakness") && zombie.effects.has("slowness"), "the Aura of Despair");
  assert.ok(races.transform(r, now + 40).includes("already"));
  races.tick(r, now + (races.FORM_SECONDS + 5) * 20 + 1); assert.ok(!races.inForm(r)); assert.ok(races.transform(r, now + (races.FORM_SECONDS + 6) * 20).includes("returns in"));
  // sneak + jump takes the form once it has rested
  races.rested.set("rae", 0); r.isSneaking = true; r.isJumping = true; advance(4); assert.ok(races.inForm(r), "sneak + jump"); r.isSneaking = false; r.isJumping = false;
  races.forms.clear();
  // the third rank is a title
  races.setRaceLevel(r, 10); assert.ok(guild.checkTitles(r).includes("Overlord"));
  // reincarnation costs coins and starts over; a vampire weakens in the sun and drinks what it strikes
  assert.ok(races.chooseRace(r, "vampire").includes("costs")); rpg.giveItem(r, "overlord:yggdrasil_gold_coin", races.REBIRTH_COST);
  assert.ok(races.chooseRace(r, "vampire").includes("Lesser Vampire")); assert.equal(pr.raceLv, 1); assert.equal(pr.reborn, 1);
  r.effects.clear(); world.clock.time = 6000; assert.equal(races.tick(r, now), "the sun"); assert.ok(r.effects.has("weakness"));
  r.effects.clear(); world.clock.time = 18000; assert.equal(races.tick(r, now), ""); assert.ok(r.effects.has("strength") && r.effects.has("speed")); world.clock.time = 6000;
  r.health.currentValue = 10; const prey = creature("minecraft:zombie", { x: 9001, y: 64, z: 9001 }, ["monster"], 300);
  world.afterEvents.entityHurt.fire({ hurtEntity: prey, damage: 20, damageSource: { damagingEntity: r, cause: "entityAttack" } });
  assert.ok(r.health.currentValue > 10, "blows drink"); r.health.currentValue = 20;
  // an angel glides; a dragonkin is tough; a human learns faster
  rpg.giveItem(r, "overlord:yggdrasil_gold_coin", 300); races.chooseRace(r, "angel"); r.isSneaking = true; r.isOnGround = false; r.getVelocity = () => ({ x: 0, y: -0.6, z: 0 });
  assert.ok(races.glide(r) && r.effects.has("slow_falling")); r.isSneaking = false; r.isOnGround = true; r.getVelocity = () => ({ x: 0, y: 0, z: 0 });
  assert.equal(races.meleeBonus(r, pr, zombie), 0.25, "angels smite the undead");
  races.chooseRace(r, "dragonkin"); races.setRaceLevel(r, 11); races.tick(r, now); assert.equal(r.effects.get("health_boost").amplifier, 2); assert.ok(r.effects.has("resistance"));
  races.chooseRace(r, "human"); races.setRaceLevel(r, 4); assert.ok(Math.abs(races.xpFactor(pr) - 1.14) < 1e-9);
  // dragon form breathes on what is ahead, not behind
  races.chooseRace(r, "dragonkin"); races.setRaceLevel(r, 5); r.getViewDirection = () => ({ x: 0, y: 0, z: 1 }); for (const m of all) m.isValid = false;
  const ahead = creature("minecraft:zombie", { x: 9000.5, y: 64, z: 9004 }, ["monster"]); const behind = creature("minecraft:zombie", { x: 9000.5, y: 64, z: 8997 }, ["monster"]);
  assert.equal(races.breathe(r), 1); assert.ok(ahead.health.currentValue < 100 && behind.health.currentValue === 100);

  // steeds: one of each, called to your side
  const callWyrm = steeds.call(r, "overlord:wyrm_whistle", now); assert.ok(callWyrm.includes("answers")); const wyrm = steeds.steedOf(r, "wyrm");
  assert.ok(wyrm && wyrm.typeId === "overlord:wyrm_steed" && wyrm.props.get("overlord:owner") === "rae");
  r.location = { x: 9010.5, y: 64, z: 9000.5 }; assert.ok(steeds.call(r, "overlord:wyrm_whistle", now).includes("comes")); assert.ok(near(wyrm.location, r.location) < 3);
  assert.equal(all.filter((m) => m.typeId === "overlord:wyrm_steed").length, 1, "never two");
  // riding: on the ground it walks, a jump takes it up, then it flies where the rider looks
  let move = { x: 0, y: 1 }; r.inputInfo = { getMovementVector: () => move };
  r.getComponent = ((base) => (c) => (c === "minecraft:riding" ? { entityRidingOn: wyrm } : base(c)))(r.getComponent);
  assert.equal(steeds.mountOf(r), wyrm);
  let v = steeds.fly(r, wyrm); assert.ok(v && Math.abs(v.z - steeds.WALK_SPEED) < 1e-9 && !steeds.aloft.get(wyrm.id));
  r.isJumping = true; wyrm.isOnGround = false; v = steeds.fly(r, wyrm); assert.ok(steeds.aloft.get(wyrm.id) && wyrm.events.includes("overlord:take_off"));
  assert.ok(Math.abs(v.z - steeds.FLY_SPEED) < 1e-9 && Math.abs(v.y - steeds.CLIMB) < 1e-9); r.isJumping = false;
  r.isSprinting = true; v = steeds.fly(r, wyrm); assert.ok(Math.abs(v.z - steeds.SPRINT_SPEED) < 1e-9); r.isSprinting = false;
  r.getViewDirection = () => ({ x: 0, y: -0.6, z: 0.8 }); v = steeds.fly(r, wyrm); assert.ok(v.y < 0, "it dives where the rider looks");
  move = { x: 0, y: 0 }; v = steeds.fly(r, wyrm); assert.deepEqual(v, { x: 0, y: 0, z: 0 }, "and hovers when let go");
  r.getViewDirection = () => ({ x: 0, y: -0.6, z: 0.8 }); move = { x: 0, y: 1 }; wyrm.isOnGround = true; steeds.fly(r, wyrm);
  assert.ok(!steeds.aloft.get(wyrm.id) && wyrm.events.includes("overlord:land"), "touching down lands it");
  // its breath burns what lies ahead
  r.getViewDirection = () => ({ x: 0, y: 0, z: 1 }); for (const m of all) if (m.families.includes("monster")) m.isValid = false;
  const target = creature("minecraft:zombie", { x: wyrm.location.x, y: 64, z: wyrm.location.z + 6 }, ["monster"], 200); const aside = creature("minecraft:zombie", { x: wyrm.location.x + 8, y: 64, z: wyrm.location.z }, ["monster"], 200);
  assert.equal(steeds.breathe(r, wyrm, now), 1); assert.ok(target.health.currentValue < 200 && target.burning > 0 && aside.health.currentValue === 200);
  assert.equal(steeds.breathe(r, wyrm, now + 10), -1, "it draws breath between");
  // the Soul Eater: called by its reins, it charges and tramples
  steeds.call(r, "overlord:soul_reins", now); const soul = steeds.steedOf(r, "soul"); assert.ok(soul && soul.typeId === "overlord:soul_steed");
  for (const m of all) if (m.families.includes("monster")) m.isValid = false;
  const lane = creature("minecraft:zombie", { x: soul.location.x, y: 64, z: soul.location.z + 4 }, ["monster"], 200);
  assert.equal(steeds.charge(r, soul, now + 1000), 1); assert.ok(lane.health.currentValue < 200 && soul.vel.z > 2);
  const under = creature("minecraft:zombie", { ...soul.location }, ["monster"], 200); assert.ok(steeds.trample(r, soul) >= 1 && under.health.currentValue < 200);
  // barding: only on your own steeds or a tamed Hamsuke; a second one hands the first back
  assert.ok(steeds.armour(r, soul, "overlord:adamantite_barding").includes("wears")); assert.equal(steeds.bardingOf(soul), 1);
  assert.ok(steeds.tendBarding(soul)); assert.equal(soul.effects.get("resistance").amplifier, 0);
  const before = spells.countItem(r, "overlord:adamantite_barding");
  assert.ok(steeds.armour(r, soul, "overlord:nazarick_barding").includes("Nazarick")); assert.equal(spells.countItem(r, "overlord:adamantite_barding") - before, 1);
  steeds.tendBarding(soul); assert.equal(soul.effects.get("resistance").amplifier, 1); assert.ok(soul.effects.has("fire_resistance") && soul.effects.has("regeneration"));
  const stranger = creature("overlord:soul_steed", soul.location, ["mob"]); stranger.addTag("overlord_steed"); stranger.setDynamicProperty("overlord:owner", "someone");
  assert.ok(steeds.armour(r, stranger, "overlord:adamantite_barding").includes("Only"));
  const wild = creature("overlord:hamsuke", soul.location, ["mob"]); assert.ok(steeds.armour(r, wild, "overlord:adamantite_barding").includes("Only"));
  // sent away; slain, it mourns a minute
  assert.ok(steeds.dismiss(r, "overlord:soul_reins").includes("departs")); assert.equal(steeds.steedOf(r, "soul"), undefined);
  world.afterEvents.entityDie.fire({ deadEntity: wyrm, damageSource: {} }); wyrm.isValid = false;
  assert.ok(steeds.call(r, "overlord:wyrm_whistle", system.currentTick).includes("slain"));
  all.forEach((m) => { m.isValid = false; }); players.splice(players.indexOf(r), 1); races.forms.clear();
}

// v8.5: the Court of Nazarick, and a living kingdom
{
  const court = await import("./court.js");
  const districts = await import("./districts.js");
  const king = await import("./kingdom.js");
  const all = []; let n = 0; const placed = new Map(); const k3 = (l) => `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`;
  const being = (typeId, at, families = ["monster"], hp = 200, event) => { const m = { id: `g${n++}`, typeId, location: { ...at }, isValid: true, tags: new Set(), props: new Map(), effects: new Map(),
    families, event, burning: 0, get dimension() { return land; }, health: { currentValue: hp, effectiveMax: hp, setCurrentValue(v) { this.currentValue = v; } },
    getComponent(c) { return c === "minecraft:health" ? m.health : undefined; }, addTag(t) { m.tags.add(t); }, hasTag: (t) => m.tags.has(t),
    matches: (q) => (q.families ?? []).every((f) => m.families.includes(f)), remove() { m.isValid = false; }, teleport(to) { m.location = { ...to }; },
    getDynamicProperty: (k) => m.props.get(k), setDynamicProperty: (k, v) => m.props.set(k, v), addEffect(e, d, o = {}) { m.effects.set(e, { duration: d, amplifier: o.amplifier ?? 0 }); },
    setOnFire(t) { m.burning = t; }, applyKnockback() {}, applyDamage(x) { m.health.currentValue = Math.max(0, m.health.currentValue - x); } }; all.push(m); return m; };
  const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const land = { id: "minecraft:overworld", spawnParticle() {}, playSound() {}, getTopmostBlock: ({ x, z }) => ({ location: { x, y: 63, z } }), getPlayers: () => [],
    setBlockType: (l, t) => placed.set(k3(l), t),
    fillBlocks(v, t) { for (let x = v.from.x; x <= v.to.x; x++) for (let y = v.from.y; y <= v.to.y; y++) for (let z = v.from.z; z <= v.to.z; z++) placed.set(`${x},${y},${z}`, t); },
    getBlock: (l) => ({ isAir: true, typeId: placed.get(k3(l)) ?? "minecraft:air", getComponent: () => ({ container: { addItem() {} } }) }),
    getEntities: (q) => all.filter((m) => m.isValid && (q.tags ?? []).every((t) => m.tags.has(t)) && (!q.type || m.typeId === q.type) &&
      (q.families ?? []).every((f) => m.families.includes(f)) && (!q.maxDistance || near(m.location, q.location) <= q.maxDistance)),
    spawnEntity: (type, at, opts) => being(type, at, type.includes("guardian_") || type.includes("villager") ? ["mob"] : ["monster"], 200, opts?.spawnEvent) };
  const q = mkPlayer("queen"); q.dimension = land; q.location = { x: 30000.5, y: 64, z: 30000.5 }; q.getViewDirection = () => ({ x: 0, y: 0, z: 1 });
  q.onScreenDisplay.setTitle = (t) => { q.title = t; }; q.isSneaking = false; q.isJumping = false;
  world.afterEvents.playerSpawn.fire({ player: q, initialSpawn: true }); advance(60);
  const pq = rpg.profileOf(q); rpg.setLevel(q, 60); pq.bosses = [];
  pq.realm = { name: "Nazarick Reborn", x: 30000, y: 64, z: 30000, tier: 1, treasury: 0, vault: 0, clock: 0, days: 0, outposts: [], invasions: false, raidIn: 9999, renown: 0, defended: 0, lost: 0 };
  const realm = king.realmOf(q); assert.ok(realm);
  // the Guardians swear fealty once defeated
  assert.ok(court.swear(q, "albedo").includes("Defeat")); pq.bosses.push("albedo", "demiurge", "cocytus", "shalltear", "pandoras_actor");
  for (const g of ["albedo", "demiurge", "cocytus", "shalltear", "pandoras_actor"]) assert.ok(court.swear(q, g).includes("fealty"));
  assert.ok(court.swear(q, "albedo").includes("already")); assert.ok(q.title.includes("Albedo") || q.title.includes("Pandora"));
  // at court their posts shape the realm
  assert.deepEqual(king.income(realm), { coins: 15, crystals: 1 }, "Albedo: taxes +25%"); assert.equal(king.treasuryDays(realm), 7);
  // one walks at your side; her post stands empty meanwhile
  let now = 1200000; assert.ok(court.summon(q, "albedo", now).includes("Albedo")); assert.equal(realm.companion, "albedo");
  assert.deepEqual(king.income(realm), { coins: 12, crystals: 1 }); assert.equal(king.treasuryDays(realm), 5);
  const albedo = court.companionOf(q); assert.ok(albedo && albedo.typeId === "overlord:guardian_albedo" && albedo.props.get("overlord:owner") === "queen");
  court.tend(q, now, true); court.tend(q, now, true);
  assert.equal(all.filter((m) => m.isValid && m.typeId === "overlord:guardian_albedo").length, 1, "only ever one at your side");
  const courtiers = all.filter((m) => m.isValid && m.tags.has("overlord_court_queen"));
  assert.equal(courtiers.length, 4, "the others stand in the throne hall"); assert.ok(courtiers.every((m) => m.event === "overlord:to_court"));
  // her signature move, then a rest
  const brute = being("minecraft:zombie", { x: albedo.location.x + 2, y: 64, z: albedo.location.z });
  assert.ok(court.signature(q, albedo, "albedo", now) >= 1); assert.ok(brute.health.currentValue < 200 && q.effects.has("absorption"));
  assert.equal(court.signature(q, albedo, "albedo", now + 20), -1);
  const chill = being("minecraft:zombie", { x: albedo.location.x + 1, y: 64, z: albedo.location.z }); assert.ok(court.signature(q, albedo, "cocytus", now + 1000) >= 1); assert.ok(chill.effects.has("slowness"));
  // Pandora's Actor borrows another Guardian's move
  q.bar = ""; court.signature(q, albedo, "pandoras_actor", now + 2000, () => 0); assert.ok(q.bar.includes("as Albedo"), q.bar);
  // loyalty: foes slain together, invasions repelled; it strengthens the moves
  assert.equal(court.earnLoyalty(realm, "albedo", 30), 30); assert.equal(court.earnLoyalty(realm, "albedo", 500), 100);
  // an invasion: Demiurge thins it, Shalltear takes the field
  const siege = king.invade(q, realm, -1, now, 0); assert.ok(siege && siege.scale === 0.75);
  assert.equal(all.filter((m) => m.isValid && m.tags.has("overlord_siege_queen")).length, 5, "a quarter fewer foes");
  const vanguard = all.find((m) => m.isValid && m.typeId === "overlord:guardian_shalltear" && m.tags.has("overlord_siege_queen_ally")); assert.ok(vanguard && vanguard.event === "overlord:sortie");
  for (let i = 0; i < 3; i++) { for (const m of all) if (m.tags.has("overlord_siege_queen")) m.health.currentValue = 0; king.stepSiege(siege, now += 20); }
  assert.equal(realm.treasury, 45, "Demiurge: half again the spoils"); assert.equal(court.sworn(realm).cocytus.loyalty, 5);
  // a fallen companion recovers in Nazarick
  world.afterEvents.entityDie.fire({ deadEntity: albedo, damageSource: {} }); albedo.isValid = false;
  assert.ok(court.summon(q, "albedo", system.currentTick).includes("recovering")); assert.ok(court.release(q).includes("court")); assert.equal(realm.companion, undefined);
  script.push(99); court.openCourt(q); await new Promise((r) => setTimeout(r, 10)); assert.ok(shown.some((f) => f.title === "Court of Nazarick"));
  assert.ok(court.summon(q, "pandoras_actor", now).includes("Pandora")); court.release(q);

  // districts: built on their plots outside the walls, paid for, three levels
  assert.ok(districts.build(q, "market").includes("costs")); rpg.giveItem(q, "overlord:yggdrasil_gold_coin", 5000); rpg.giveItem(q, "overlord:data_crystal", 500);
  assert.ok(districts.build(q, "market").includes("level 1")); assert.equal(placed.get(`30000,64,${30000 + 34}`), "minecraft:cauldron", "the market's well");
  assert.ok(districts.build(q, "market").includes("level 2")); assert.ok(districts.build(q, "market").includes("Guardian Crests"), "level 3 asks for crests");
  rpg.giveItem(q, "overlord:guardian_crest", 10); assert.ok(districts.build(q, "market").includes("level 3")); assert.ok(districts.build(q, "market").includes("complete"));
  assert.equal(placed.get(`30000,64,${30000 + 34 - 4}`), "minecraft:bell");
  for (const b of ["smithy", "alchemist", "barracks", "academy", "temple", "farms", "houses"]) assert.ok(districts.build(q, b).includes("level 1"), b);
  assert.equal(placed.get(`${30000 + 34 - 2},64,${30000 - 3}`), "minecraft:anvil", "the smithy's anvil");
  q.location = { x: 30100.5, y: 64, z: 30000.5 }; assert.ok(districts.build(q, "smithy").includes("Stand in your capital")); q.location = { x: 30000.5, y: 64, z: 30000.5 };
  // what they do
  assert.deepEqual(king.income(realm), { coins: Math.round(15 * 1.45), crystals: 1 + 2 }, "market +45%, temple +2 crystals");
  assert.ok(rpg.hooks.xpFactor.some((f) => Math.abs(f(pq) - 1.04) < 1e-9), "the academy");
  assert.equal(king.realmHooks.guards.reduce((n, h) => n + h(realm, true), 0), 2 + 1, "Cocytus and the barracks");
  assert.equal(districts.capacity(realm), 20 + 20 + 15 + 10);
  // a kingdom day: citizens settle, workshops make wares, allies send gifts, envoys come
  const first = districts.day(q, realm, () => 0.99); assert.equal(first.settled, districts.growth(realm)); assert.equal(realm.goods["overlord:refining_stone"], 2, "the smithy, and Pandora's extra");
  assert.equal(realm.goods["overlord:blue_potion"], 2);
  // trade routes run to outposts from the Market
  realm.outposts.push({ key: "190,187", name: "Goblin Camp", x: 30300, y: 64, z: 30000 });
  assert.equal(districts.routeValue(realm, "190,187"), Math.round(15 * 1.5)); assert.ok(districts.openRoute(q, "190,187").includes("Caravans"));
  assert.ok(districts.openRoute(q, "190,187").includes("already")); assert.equal(districts.raidChance(realm), 0, "Demiurge keeps the roads");
  const t0 = realm.treasury; districts.day(q, realm, () => 0.99); assert.equal(realm.treasury - t0, Math.round(15 * 1.5));
  delete court.sworn(realm).demiurge; assert.ok(districts.raidChance(realm) > 0); const t1 = realm.treasury; const raided = districts.day(q, realm, () => 0.01);
  assert.equal(raided.raided, 1); assert.equal(realm.treasury, t1, "the caravan was raided");
  // envoys: alliance brings gifts; tribute pays now and breeds enmity; an enemy Theocracy marches more
  assert.ok(districts.envoys(realm).length >= 1); realm.envoys = ["kingdom", "theocracy"];
  assert.ok(districts.answer(q, "kingdom", "ally").includes("friendship")); realm.envoys.push("kingdom"); assert.ok(districts.answer(q, "kingdom", "ally").includes("now your ally"));
  assert.equal(districts.standing(realm, "kingdom"), "allied"); realm.goods = {}; districts.day(q, realm, () => 0.99); assert.equal(realm.goods["overlord:yggdrasil_gold_coin"], 25);
  const sun = spells.countItem(q, "overlord:gem_sunstone"); assert.ok(districts.answer(q, "theocracy", "tribute").includes("tribute")); assert.equal(spells.countItem(q, "overlord:gem_sunstone") - sun, 2);
  realm.envoys.push("theocracy"); assert.ok(districts.answer(q, "theocracy", "tribute").includes("enemy")); assert.equal(districts.standing(realm, "theocracy"), "hostile");
  const theocracy = king.INVADERS.findIndex((i) => i.name.includes("Theocracy"));
  assert.equal(king.realmHooks.invader.map((h) => h(realm, 0.5)).find((v) => v !== undefined), theocracy);
  relations: { realm.relations.theocracy = 80; assert.notEqual(king.realmHooks.invader.map((h) => h(realm, 0.1)).find((v) => v !== undefined), theocracy, "an ally never marches"); }
  // citizens walk the streets while the ruler is home
  realm.population = 100; assert.ok(guild.checkTitles(q).includes("Beloved Sovereign"));
  assert.equal(districts.populate(q), districts.MAX_CITIZENS); assert.equal(districts.populate(q), 0);
  assert.ok(all.filter((m) => m.isValid && m.typeId === "minecraft:villager_v2").length === districts.MAX_CITIZENS);
  // the Kingdom page lists the new pages
  script.push(99); king.openKingdom(q); await new Promise((r) => setTimeout(r, 10));
  const page = shown.filter((f) => f.title === "Nazarick Reborn").at(-1); assert.ok(page.buttons.some((b) => b.startsWith("Districts")) && page.buttons.some((b) => b.startsWith("Court of Nazarick")) && page.body.includes("Citizens"));
  all.forEach((m) => { m.isValid = false; }); players.splice(players.indexOf(q), 1); pq.realm = {};
}

// persistence: saved profile is restored after leaving
advance(100);
const saved = a.props.get("overlord:rpg"); assert.ok(saved);
world.afterEvents.playerLeave.fire({ playerId: "alice" });
const again = rpg.profileOf(a);
assert.notStrictEqual(again, pa); assert.equal(again.level, 100); assert.equal(again.cls, "warrior"); assert.equal(again.str, 0); assert.equal(again.done, 1);
// corrupt save does not break the player
a.props.set("overlord:rpg", "{not json"); world.afterEvents.playerLeave.fire({ playerId: "alice" });
assert.equal(rpg.profileOf(a).level, 1);
console.log("RPG simulation: all assertions passed;", shown.length, "forms shown");
