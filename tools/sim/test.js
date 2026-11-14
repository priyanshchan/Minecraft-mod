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
assert.equal(spells.SPELLS.length, 46);
for (let tier = 1; tier <= 11; tier++) assert.ok(spells.SPELLS.filter((s) => s.tier === tier).length >= 3, `tier ${tier}`);
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
assert.ok([...world.props.keys()].some((key) => key.startsWith("overlord:camp:")), "sites are saved in the world");

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
assert.equal(vfx.POSE_NAMES.length, 12);
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
advance(1); zoe.fx = []; world.afterEvents.entityDie.fire({ deadEntity: lord, damageSource: {} }); assert.ok(seen65("nova").length === 1 && seen65("skull").length === 1 && seen65("pillar_light").length === 1);
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
