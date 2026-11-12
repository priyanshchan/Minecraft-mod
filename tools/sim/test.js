import assert from "node:assert";
import { world, system, players, advance, ItemStack } from "@minecraft/server";
import { script, shown } from "@minecraft/server-ui";
import * as rpg from "./rpg.js";
import * as raid from "./raid.js";
import * as spells from "./spells.js";
import * as director from "./director.js";
import * as sites from "./structures.js";
import * as party from "./party.js";
await import("./main.js"); // must load without touching the world

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
    dimension: { id: "overworld", mobs: [], spawnParticle(effect, loc, vars) { p.fx.push({ effect, scale: vars?.v?.["variable.scale"], color: vars?.v?.["variable.color"] }); }, spawnItem() {}, getPlayers: () => players, playSound() {},
      getBlock: () => ({ isAir: true }), getTopmostBlock: ({ x, z }) => ({ location: { x, y: 63, z } }),
      spawnEntity(typeId) { const e = { typeId, tags: new Set(), isValid: true, addTag(t) { this.tags.add(t); }, remove: () => { p.dimension.mobs = p.dimension.mobs.filter((m) => m !== e); } }; p.dimension.mobs.push(e); return e; },
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
assert.equal(a.effects.get("health_boost").amplifier, 1, "vit 5 + warrior = 2 tiers");
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

// melee bonus: warrior with 3 STR = +26%
const target = mob("minecraft:cow", 100);
world.afterEvents.entityHurt.fire({ hurtEntity: target, damage: 10, damageSource: { damagingEntity: a, cause: "entityAttack" } });
assert.ok(Math.abs(target.health.currentValue - 97.4) < 1e-6, String(target.health.currentValue));
const weak = mob("minecraft:cow", 2);
world.afterEvents.entityHurt.fire({ hurtEntity: weak, damage: 10, damageSource: { damagingEntity: a, cause: "entityAttack" } });
assert.equal(weak.damaged.length, 1, "lethal bonus goes through applyDamage");
world.afterEvents.entityHurt.fire({ hurtEntity: target, damage: 10, damageSource: { damagingEntity: a, cause: "magic" } });
assert.ok(Math.abs(target.health.currentValue - 97.4) < 1e-6, "no bonus on spells");

// class skill (warrior) with cooldown, and Shooting Star level grant
rpg.useClassSkill(a); assert.equal(a.effects.get("resistance").amplifier, 1);
a.effects.delete("resistance"); rpg.useClassSkill(a); assert.ok(!a.effects.has("resistance"), "skill on cooldown");
assert.equal(rpg.grantLevel(a), false, "no level past the cap");
const lvl = pb.level; assert.equal(rpg.grantLevel(b), true); assert.equal(pb.level, lvl + 1);

// Scroll: Rebirth refunds stat points
const spentBefore = pa.str + pa.vit + pa.int + pa.agi, pointsBefore = pa.points;
assert.equal(rpg.resetStats(a), spentBefore); assert.equal(pa.points, pointsBefore + spentBefore); assert.equal(pa.str, 0);
assert.ok(!a.effects.has("health_boost") || a.effects.get("health_boost").amplifier === 0, "only the warrior heart remains");

// Tomb Raid: level 100 -> tier 3, five waves, rewards on clear
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
assert.equal(a.inv.filter((s) => s.typeId === "overlord:yggdrasil_gold_coin").reduce((n, s) => n + s.amount, 0) - coinsBefore, 96);
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
assert.equal(spells.SPELLS.length, 43);
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
c.dimension.getEntities = () => [dummy]; c.dimension.spawnEntity = () => ({ getComponent: () => ({ shoot() {} }), applyImpulse() {} });
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
pd.level = 40; const dk = spawnMob("overlord:death_knight", 80, d);
const dkLevel = rpg.mobLevel(dk); assert.ok(dkLevel >= 28 && dkLevel <= 48, String(dkLevel));
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
assert.equal(d.dimension.mobs.length, 5, "tier 2 patrol: death knight, 3 guarders, elder lich");
assert.ok(d.dimension.mobs.every((m) => m.tags.has("overlord_patrol")) && d.msgs.some((m) => m.includes("patrol")));
advance(400); assert.equal(d.dimension.mobs.length, 5, "one roll per night");
world.clock.day = 4; advance(200); assert.equal(d.dimension.mobs.length, 10); Math.random = realRandom; world.clock.time = 6000;
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
assert.ok(planned > 900 * 0.3 && planned < 900 * 0.5, `planned ${planned}`); assert.equal(kinds.size, sites.SITES.length);
// a flat grassy test world that records every block placed
const makeLand = (opts = {}) => {
  const placed = new Map(); const chests = new Map(); const k = (l) => `${Math.floor(l.x)},${l.y},${Math.floor(l.z)}`;
  const land = { id: "minecraft:overworld", mobs: [], placed, chests, spawnParticle() {}, playSound() {}, spawnItem() {}, getPlayers: () => players,
    heightAt: opts.heightAt ?? (() => 63),
    getTopmostBlock: ({ x, z }) => (opts.unloaded ? undefined : { location: { x, y: land.heightAt(x, z), z } }),
    getBlock(l) { const typeId = placed.get(k(l)) ?? (l.y <= land.heightAt(l.x, l.z) ? (opts.water ? "minecraft:water" : "minecraft:grass_block") : "minecraft:air");
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
    getEntities: (q) => land.mobs.filter((m) => (!q.type || m.typeId === q.type) && (q.tags ?? []).every((t) => m.tags.has(t))) };
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
assert.equal(sites.buildSite(makeLand({ heightAt: (x) => 63 + Math.floor(x / 2) }), { x: 0, z: 0, type: camp0 }), null, "too steep");
// exploring: find a planned site, walk up to it, discover it once, garrison it once, and hear a rumour before
let goal; for (let rx = 2; rx < 40 && !goal; rx++) { const site = sites.siteOf(rx, 2); if (site) goal = site; }
assert.ok(goal, "a site exists somewhere east");
const e = mkPlayer("eve"); const pe = rpg.profileOf(e); e.dimension = makeLand();
e.location = { x: goal.x - 300, y: 64, z: goal.z }; const heard = sites.rumour(e);
assert.ok(heard && /blocks to the/.test(heard), String(heard));
e.location = { x: goal.x - 80, y: 64, z: goal.z }; sites.explore(e);
assert.ok([...e.dimension.placed.values()].includes("minecraft:chest"), "built when in range"); assert.equal(e.dimension.mobs.length, 0, "not garrisoned yet");
const built = e.dimension.placed.size; sites.explore(e); assert.equal(e.dimension.placed.size, built, "built once");
e.location = { x: goal.x - 20, y: 64, z: goal.z }; const xpE = pe.xp; sites.explore(e);
assert.ok(e.dimension.mobs.length >= 3 && e.bar.includes("Discovered"), e.bar); assert.ok(pe.level === 2 && pe.xp === xpE + 80 - rpg.xpForNext(1), "discovery XP (enough for level 2)");
const manned = e.dimension.mobs.length; sites.explore(e); assert.equal(e.dimension.mobs.length, manned, "no refill before ten minutes");
assert.ok([...world.props.keys()].some((key) => key.startsWith("overlord:site:")), "sites are saved in the world");

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
assert.ok(party.hire(f, offer).includes("full")); assert.equal(party.partyOf(f).length, 3);
assert.equal(f.inv.filter((s) => s && s.typeId === "overlord:yggdrasil_gold_coin").reduce((n, s) => n + s.amount, 0), 32);
party.summon(f); advance(45); assert.equal(f.dimension.mobs.filter((m) => m.typeId === "overlord:retainer").length, 3);
assert.equal(party.candidates(f, () => 0.5).length, 3); assert.equal(party.levelOf(f, party.partyOf(f)[1]), 3, "mercenaries keep their level");
// gear upgrades cost coins and strengthen the retainer
assert.ok(party.upgrade(f, 0).includes("rank 1")); advance(45);
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
assert.ok(party.recovering(f, 1) > 50); advance(200); assert.ok(!f.dimension.mobs.some((m) => m.nameTag.startsWith("Borin")), "still recovering");
advance(60 * 20); assert.ok(f.dimension.mobs.some((m) => m.nameTag.startsWith("Borin")), "back after a minute");
party.dismiss(f); assert.equal(f.dimension.mobs.filter((m) => m.typeId === "overlord:retainer").length, 0);
party.release(f, 2); assert.equal(party.partyOf(f).length, 2);
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
f.dimension = makeLand(); f.dimension.getPlayers = () => [f]; f.location = { x: lair.x - 80, y: 64, z: lair.z }; sites.explore(f);
f.location = { x: lair.x - 20, y: 64, z: lair.z }; sites.explore(f);
const defenders = f.dimension.mobs.filter((m) => m.tags.has("overlord_camp")); assert.equal(defenders.length, 5);
const purse = () => f.inv.filter((s) => s && s.typeId === "overlord:yggdrasil_gold_coin").reduce((n, s) => n + s.amount, 0); const purseBefore = purse();
defenders.slice(0, 4).forEach((m) => world.afterEvents.entityDie.fire({ deadEntity: m, damageSource: { damagingEntity: f } })); assert.equal(purse(), purseBefore, "not cleared yet");
world.afterEvents.entityDie.fire({ deadEntity: defenders[4], damageSource: { damagingEntity: f } });
assert.equal(purse(), purseBefore + 8); assert.ok(f.msgs.some((m) => m.includes("Goblin Camp cleared")));

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
