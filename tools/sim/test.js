import assert from "node:assert";
import { world, system, players, advance, ItemStack } from "@minecraft/server";
import { script, shown } from "@minecraft/server-ui";
import * as rpg from "./rpg.js";
import * as raid from "./raid.js";
import * as spells from "./spells.js";
await import("./main.js"); // must load without touching the world

function mkPlayer(name) {
  const props = new Map(), effects = new Map(), msgs = [], inv = [];
  const p = { id: name, name, typeId: "minecraft:player", isValid: true, location: { x: 0, y: 64, z: 0 }, msgs, inv, effects, bar: "",
    tags: new Set(), hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); },
    getDynamicProperty: (k) => props.get(k), setDynamicProperty: (k, v) => props.set(k, v), props,
    onScreenDisplay: { setActionBar(t) { p.bar = t; }, setTitle(t) { p.title = t; } }, sendMessage: (m) => msgs.push(m), playSound() {},
    getEffect: (e) => effects.get(e), addEffect(e, d, o = {}) { effects.set(e, { duration: d, amplifier: o.amplifier ?? 0 }); }, removeEffect: (e) => effects.delete(e),
    health: { currentValue: 20, effectiveMax: 20, setCurrentValue(v) { this.currentValue = v; return true; } },
    getComponent(c) { if (c === "minecraft:health") return p.health; if (c === "minecraft:inventory") return { container: {
      addItem(s) { inv.push(s); }, get size() { return inv.length; }, getItem: (i) => inv[i], setItem(i, s) { if (s) inv[i] = s; else inv[i] = undefined; } } }; },
    aimed: [], getEntitiesFromViewDirection: () => p.aimed.map((entity) => ({ entity })), getBlockFromViewDirection: () => undefined,
    getHeadLocation: () => ({ x: 0, y: 65.6, z: 0 }), getViewDirection: () => ({ x: 0, y: 0, z: 1 }),
    dimension: { id: "overworld", mobs: [], spawnParticle() {}, spawnItem() {}, getPlayers: () => players, playSound() {},
      getBlock: () => ({ isAir: true }),
      spawnEntity(typeId) { const e = { typeId, tags: new Set(), isValid: true, addTag(t) { this.tags.add(t); }, remove: () => { p.dimension.mobs = p.dimension.mobs.filter((m) => m !== e); } }; p.dimension.mobs.push(e); return e; },
      getEntities: (q) => p.dimension.mobs.filter((m) => (q.tags ?? []).every((t) => m.tags.has(t))) } };
  players.push(p); return p;
}
const mob = (typeId, hp = 20, fam = []) => ({ typeId, isValid: true, location: { x: 1, y: 64, z: 1 }, health: { currentValue: hp, effectiveMax: hp, setCurrentValue(v) { this.currentValue = v; } },
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
assert.equal(spells.castSelected(c), true); assert.deepEqual(dummy.damaged, [7]);
assert.equal(spells.castSelected(c), false, "cooldown blocks an immediate recast");
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
assert.equal(spells.SPELLS.length, 32);
for (let tier = 1; tier <= 11; tier++) assert.ok(spells.SPELLS.filter((s) => s.tier === tier).length >= 2, `tier ${tier}`);
// dark magic is weak against undead: Death (52) on an undead dummy deals a quarter
pc.level = 100; c.inv.push(new ItemStack("overlord:data_crystal", 64)); assert.ok(spells.learnSpell(c, "death").includes("Learned"));
pc.slots[3] = "death"; pc.slot = 3; rpg.restoreMana(c, 1e6); dummy.damaged = []; assert.equal(spells.castSelected(c), true);
assert.deepEqual(dummy.damaged, [13]);
for (const s of spells.SPELLS) assert.ok(s.mana > 0 && s.cooldown > 0 && s.tier >= 1 && typeof s.cast === "function", s.key);
// death penalty
pc.xp = 100; world.afterEvents.entityDie.fire({ deadEntity: c, damageSource: {} }); assert.equal(pc.xp, 90);

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
