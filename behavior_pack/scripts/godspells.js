// Overlord: Tomb of Nazarick - god-tier magic.
//
// Three spells beyond super-tier, taught only to those who have conquered the Great Tomb (spells.js
// holds their entries and the rules for learning them). Each is a spectacle staged over several
// seconds: the caster's camera pulls back to watch, everyone near sees the spell's name, the sky and
// the ground are covered in its magic, and it ends in something far beyond what the world was made to
// withstand.
//
// - The Goal of All Life Is Death: a clock of twelve marks forms round the caster and ticks down;
//   when it strikes, every lesser creature within 40 blocks dies, bosses lose a third of their
//   health, the souls stream into the caster and the slain rise as four Death Knights.
// - Pantheon: the heavens open in a halo, six Archangel Flames descend to fight, pillars of judgement
//   fall on the caster's foes for ten seconds while allies are healed, then on all of them at once.
// - Cataclysm: the sky darkens over the place the caster points at, thirty meteors rain down across
//   it, and then one colossal meteor falls, leaving burning ground and a shockwave out to 26 blocks.
import { world, system, EntityDamageCause } from "@minecraft/server";
import { notify, restoreMana } from "./rpg.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */

/** @param {Vector3} a @param {number} [dy] */
const up = (a, dy = 1) => ({ x: a.x, y: a.y + dy, z: a.z });

/** @param {Dimension} dimension @param {string} sound @param {Vector3} at @param {number} pitch @param {number} [volume] */
function sound(dimension, sound, at, pitch, volume = 3) {
  try {
    dimension.playSound(sound, at, { volume, pitch });
  } catch {
    // cosmetic only
  }
}

/** Whether an entity is on the caster's side. @param {Entity} e @param {Player} caster */
function friendly(e, caster) {
  try {
    if (e.typeId === "minecraft:player" || e.typeId === id("retainer")) return true;
    if (e.hasTag("overlord_summoned") || e.hasTag(`overlord_ally_${caster.id}`)) return true;
    return e.getComponent("minecraft:tameable")?.isTamed === true;
  } catch {
    return true;
  }
}

/**
 * The caster's foes near a point: monsters that are not on their side. Villagers, animals and the
 * friendly folk of the world are never caught in god-tier magic.
 * @param {Player} caster @param {Vector3} at @param {number} radius
 */
export function foesNear(caster, at, radius) {
  try {
    return caster.dimension
      .getEntities({ location: at, maxDistance: radius, families: ["monster"] })
      .filter((e) => {
        if (!e.isValid || friendly(e, caster)) return false;
        const health = e.getComponent("minecraft:health");
        return health !== undefined && health.currentValue > 0;
      });
  } catch {
    return [];
  }
}

/** Whether a creature counts as a boss here: a boss bar creature, a world boss, or anything very strong. @param {Entity} e */
export function isBoss(e) {
  try {
    if (e.hasTag("overlord_worldboss")) return true;
    const health = e.getComponent("minecraft:health");
    return (health?.effectiveMax ?? 0) > 300;
  } catch {
    return false;
  }
}

let dealing = false;

/** Harm from the caster, ending the target outright when little would be left. @param {Player} caster @param {Entity} foe @param {number} amount */
function smite(caster, foe, amount) {
  try {
    if (!foe.isValid) return;
    const health = foe.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0) return;
    if (health.currentValue - amount > 0.5) {
      health.setCurrentValue(health.currentValue - amount);
      return;
    }
    dealing = true;
    try {
      foe.applyDamage(health.effectiveMax * 4, { cause: EntityDamageCause.magic, damagingEntity: caster });
    } finally {
      dealing = false;
    }
  } catch {
    // the foe vanished
  }
}

/** Whether god-tier harm is being dealt right now (so other systems can leave it alone). */
export function isDealing() {
  return dealing;
}

/** Players near a point. @param {Dimension} dimension @param {Vector3} at @param {number} radius */
function playersNear(dimension, at, radius) {
  try {
    return dimension.getPlayers({ location: at, maxDistance: radius });
  } catch {
    return [];
  }
}

/**
 * The name of the spell in great letters for everyone near, and a line for the whole world.
 * @param {Player} caster @param {string} name @param {string} line @param {string} [rank]
 */
function proclaim(caster, name, line, rank = "God-tier") {
  for (const p of playersNear(caster.dimension, caster.location, 72)) {
    try {
      p.onScreenDisplay.setTitle(name, { subtitle: line, fadeInDuration: 6, stayDuration: 50, fadeOutDuration: 20 });
    } catch {
      // the player left
    }
  }
  try {
    world.sendMessage(`§5[${rank}] §6${caster.name}§f invokes §e${name.replace(/§./g, "")}§f!`);
  } catch {
    // no chat
  }
}

/**
 * The caster's camera pulls back and up to watch `at`, then returns. Always handed back, even if the
 * spell is cut short.
 * @param {Player} caster @param {Vector3} at @param {number} seconds @param {number} back @param {number} height
 */
function cinematic(caster, at, seconds, back, height) {
  try {
    const view = caster.getViewDirection();
    const length = Math.hypot(view.x, view.z) || 1;
    const location = { x: caster.location.x - (view.x / length) * back, y: caster.location.y + height, z: caster.location.z - (view.z / length) * back };
    caster.camera.setCamera("minecraft:free", { location, facingLocation: up(at, 2), easeOptions: { easeTime: 1.2, easeType: /** @type {any} */ ("InOutSine") } });
  } catch {
    return; // no camera control here: the spell goes on without it
  }
  system.runTimeout(() => {
    try {
      if (caster.isValid) caster.camera.clear();
    } catch {
      // the player left
    }
  }, Math.round(seconds * TICKS));
}

/** Summons allies that fight for the caster for a minute, however many it already commands. @param {Player} caster @param {string} type @param {Vector3[]} spots */
function host(caster, type, spots) {
  /** @type {Entity[]} */
  const allies = [];
  for (const spot of spots) {
    try {
      const ally = caster.dimension.spawnEntity(type, spot, { spawnEvent: `${NS}:become_summoned` });
      ally.addTag("overlord_summoned");
      ally.addTag(`overlord_ally_${caster.id}`);
      allies.push(ally);
    } catch {
      // no room there
    }
  }
  system.runTimeout(() => {
    for (const ally of allies) {
      try {
        if (ally.isValid && caster.isValid) ally.getComponent("minecraft:tameable")?.tame(caster);
      } catch {
        // it fights all the same
      }
    }
  }, 2);
  system.runTimeout(() => {
    for (const ally of allies) {
      try {
        if (ally.isValid) {
          fx.rise(ally.dimension, ally.location, "holy", 0.8);
          ally.remove();
        }
      } catch {
        // already gone
      }
    }
  }, 60 * TICKS);
  return allies;
}

/** The grand opening every god-tier spell shares. @param {Player} caster @param {string} element */
export function invocation(caster, element) {
  const d = caster.dimension;
  const feet = caster.location;
  for (const [i, r] of [[0, 4], [1, 8], [2, 12]]) system.runTimeout(() => fx.circle(d, feet, element, r), i * 6);
  fx.pillar(d, feet, element, 14, 2.2);
  fx.spiral(d, () => (caster.isValid ? caster.location : undefined), element, 1.4, 3.2);
  fx.dome(d, feet, element);
  fx.light(d, up(feet, 2), 15, 60);
  fx.pose(caster, "god");
  sound(d, "beacon.activate", feet, 0.5, 4);
  sound(d, "ambient.weather.thunder", feet, 0.6, 4);
  for (const p of playersNear(d, feet, 48)) fx.shake(d, p.location, 2, 0.35, 1.2);
  try {
    caster.addEffect("resistance", 6 * TICKS, { amplifier: 3, showParticles: false });
  } catch {
    // no effects
  }
}

// --------------------------------------------------- The Goal of All Life Is Death

const CLOCK_MARKS = 12;
const CLOCK_TICK = 10; // ticks between marks: six seconds in all

/**
 * The Goal of All Life Is Death.
 * @param {Player} caster @param {number} power
 */
export function goalOfAllLife(caster, power) {
  const d = caster.dimension;
  const centre = { ...caster.location };
  invocation(caster, "dark");
  proclaim(caster, "§0§lThe Goal of All Life Is Death", "§7The clock has begun to turn");
  cinematic(caster, centre, CLOCK_MARKS * CLOCK_TICK / TICKS + 4, 14, 10);
  // Dread falls on everything that will die.
  for (const foe of foesNear(caster, centre, 40)) {
    try {
      foe.addEffect("slowness", 8 * TICKS, { amplifier: 2 });
      foe.addEffect("weakness", 8 * TICKS, { amplifier: 2 });
    } catch {
      // immune
    }
  }
  try {
    caster.addEffect("slowness", (CLOCK_MARKS * CLOCK_TICK) + 10, { amplifier: 1, showParticles: false });
  } catch {
    // no effects
  }
  // The clock: twelve marks round the caster, lit one by one.
  for (let i = 0; i < CLOCK_MARKS; i++) {
    system.runTimeout(() => {
      const a = (i / CLOCK_MARKS) * Math.PI * 2 - Math.PI / 2;
      const mark = { x: centre.x + Math.cos(a) * 10, y: centre.y, z: centre.z + Math.sin(a) * 10 };
      fx.pillar(d, mark, "dark", 9, 1.2);
      fx.circle(d, mark, "arcane", 1.4);
      fx.beam(d, up(centre, 0.2), up(mark, 0.2), "dark", 0.8); // the hand of the clock sweeps round
      if (i % 2 === 0) fx.circle(d, centre, "dark", 10);
      if (i % 3 === 0) fx.ring(d, centre, "arcane", 10.5);
      sound(d, "note.bell", centre, 1.6 - i * 0.08, 4);
    }, i * CLOCK_TICK);
  }
  // The strike.
  system.runTimeout(() => {
    if (!caster.isValid) return;
    sound(d, "mob.wither.spawn", centre, 0.5, 6);
    sound(d, "mob.wither.death", centre, 0.6, 6);
    for (const p of playersNear(d, centre, 48)) fx.wash(p, { red: 0, green: 0, blue: 0 }, 1.2);
    fx.dome(d, centre, "dark");
    for (let r = 4; r <= 40; r += 6) system.runTimeout(() => fx.ring(d, centre, "dark", r), r / 2);
    fx.shake(d, centre, 64, 1.4, 1.2);
    /** @type {Vector3[]} */
    const fallen = [];
    for (const foe of foesNear(caster, centre, 40)) {
      const at = up(foe.location, 1);
      if (isBoss(foe)) {
        const health = foe.getComponent("minecraft:health");
        smite(caster, foe, (health?.effectiveMax ?? 0) * 0.33 * Math.min(1.5, power));
        fx.pillar(d, foe.location, "dark", 12, 2);
      } else {
        smite(caster, foe, 100000);
        fallen.push(at);
      }
      fx.skull(d, up(at, 1.2), 1.4);
      fx.puff(d, "wisp", at, "dark", 1.4);
    }
    // The souls stream into the caster.
    fallen.slice(0, 24).forEach((at, i) => {
      system.runTimeout(() => {
        if (!caster.isValid) return;
        fx.beam(d, at, up(caster.location, 1.2), "dark", 1);
        fx.flash(d, up(caster.location, 1.2), "dark", 0.8);
      }, 10 + i * 2);
    });
    system.runTimeout(() => {
      if (!caster.isValid) return;
      try {
        const health = caster.getComponent("minecraft:health");
        if (health && health.currentValue > 0) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + fallen.length * 2));
      } catch {
        // gone
      }
      restoreMana(caster, fallen.length * 5);
      // The slain rise as Death Knights.
      const ring = [0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return { x: caster.location.x + Math.cos(a) * 3, y: caster.location.y, z: caster.location.z + Math.sin(a) * 3 };
      });
      for (const spot of ring) {
        fx.rise(d, spot, "dark", 1);
        fx.pillar(d, spot, "dark", 6, 1.2);
      }
      host(caster, id("death_knight"), ring);
      notify(caster, `§5${fallen.length} soul${fallen.length === 1 ? "" : "s"} harvested; four Death Knights rise to serve you`);
    }, 10 + Math.min(24, fallen.length) * 2 + 6);
  }, CLOCK_MARKS * CLOCK_TICK);
  return true;
}

// ---------------------------------------------------------------------------- Pantheon

const JUDGEMENTS = 20; // pillars, one every half second

/**
 * Pantheon.
 * @param {Player} caster @param {number} power
 */
export function pantheon(caster, power) {
  const d = caster.dimension;
  const centre = { ...caster.location };
  const sky = up(centre, 22);
  invocation(caster, "holy");
  proclaim(caster, "§e§lPantheon", "§fThe heavens open");
  cinematic(caster, centre, 13, 16, 12);
  try {
    caster.addEffect("regeneration", 20 * TICKS, { amplifier: 1, showParticles: false });
    caster.addEffect("absorption", 20 * TICKS, { amplifier: 3, showParticles: false });
  } catch {
    // no effects
  }
  // The halo in the sky, and light pouring down from it.
  for (let i = 0; i < 6; i++) {
    system.runTimeout(() => {
      fx.circle(d, sky, "holy", 16);
      fx.circle(d, up(sky, 0.5), "lightning", 10);
      fx.ring(d, sky, "holy", 18);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + i * 0.3;
        fx.pillar(d, { x: centre.x + Math.cos(a) * 14, y: centre.y, z: centre.z + Math.sin(a) * 14 }, "holy", 22, 1.4);
      }
    }, i * 40);
  }
  sound(d, "beacon.activate", centre, 1.2, 5);
  // The host descends.
  system.runTimeout(() => {
    if (!caster.isValid) return;
    const spots = [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return { x: centre.x + Math.cos(a) * 6, y: centre.y + 1, z: centre.z + Math.sin(a) * 6 };
    });
    for (const spot of spots) {
      fx.pillar(d, spot, "holy", 18, 1.6);
      fx.nova(d, up(spot, 0.5), "holy", 2.5);
    }
    host(caster, id("archangel_flame"), spots);
    sound(d, "random.totem", centre, 0.8, 5);
  }, 30);
  // Judgement: a pillar of light on a foe every half second, healing for allies with each.
  for (let i = 0; i < JUDGEMENTS; i++) {
    system.runTimeout(() => {
      if (!caster.isValid) return;
      const foes = foesNear(caster, centre, 32);
      const foe = foes[Math.floor(Math.random() * foes.length)];
      if (foe) {
        const holyBane = foe.matches({ families: ["undead"] }) || foe.matches({ families: ["demon"] });
        fx.pillar(d, foe.location, "holy", 24, 2.2);
        fx.nova(d, up(foe.location, 0.6), "holy", 3.5);
        fx.light(d, up(foe.location, 1), 15, 10);
        smite(caster, foe, 30 * power * (holyBane ? 2 : 1));
        sound(d, "ambient.weather.lightning.impact", foe.location, 1.4, 4);
      }
      for (const ally of playersNear(d, centre, 32)) {
        try {
          const health = ally.getComponent("minecraft:health");
          if (health && health.currentValue > 0) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + 2));
        } catch {
          // gone
        }
      }
    }, 40 + i * 10);
  }
  // Final Judgement: on all of them at once.
  system.runTimeout(() => {
    if (!caster.isValid) return;
    for (const foe of foesNear(caster, centre, 32)) {
      fx.pillar(d, foe.location, "holy", 26, 2.6);
      smite(caster, foe, 40 * power);
    }
    fx.dome(d, centre, "holy");
    for (let r = 6; r <= 32; r += 6) system.runTimeout(() => fx.ring(d, centre, "holy", r), r / 2);
    for (const p of playersNear(d, centre, 48)) fx.wash(p, { red: 1, green: 0.95, blue: 0.75 }, 1);
    fx.shake(d, centre, 48, 1, 0.8);
    sound(d, "ambient.weather.thunder", centre, 1.2, 6);
  }, 40 + JUDGEMENTS * 10 + 10);
  return true;
}

// --------------------------------------------------------------------------- Cataclysm

const METEORS = 30;
const STORM = 120; // ticks over which the meteors fall

/** Where the caster points, up to 48 blocks away; straight ahead if at nothing. @param {Player} caster */
function aimed(caster) {
  try {
    const hit = caster.getEntitiesFromViewDirection({ maxDistance: 48 })[0];
    if (hit?.entity?.isValid) return { ...hit.entity.location };
  } catch {
    // nothing there
  }
  try {
    const block = caster.getBlockFromViewDirection({ maxDistance: 48 });
    if (block) return { x: block.block.location.x + 0.5, y: block.block.location.y + 1, z: block.block.location.z + 0.5 };
  } catch {
    // nothing there
  }
  const view = caster.getViewDirection();
  const length = Math.hypot(view.x, view.z) || 1;
  return { x: caster.location.x + (view.x / length) * 20, y: caster.location.y, z: caster.location.z + (view.z / length) * 20 };
}

/**
 * Cataclysm.
 * @param {Player} caster @param {number} power
 */
export function cataclysm(caster, power) {
  const d = caster.dimension;
  const target = aimed(caster);
  invocation(caster, "fire");
  proclaim(caster, "§c§lCataclysm", "§6The sky is falling");
  cinematic(caster, target, 14, 18, 14);
  for (const p of playersNear(d, target, 64)) fx.wash(p, { red: 0.35, green: 0.05, blue: 0 }, 2.5);
  sound(d, "mob.enderdragon.growl", target, 0.4, 6);
  // The warning: the place is marked, and the sky above it burns.
  for (let i = 0; i < 6; i++) {
    system.runTimeout(() => {
      fx.circle(d, target, "fire", 22);
      fx.ring(d, target, "fire", 22);
      fx.circle(d, up(target, 30), "fire", 18);
      sound(d, "ambient.weather.thunder", target, 0.5 + i * 0.05, 5);
    }, i * 10);
  }
  // The storm.
  for (let i = 0; i < METEORS; i++) {
    const tick = 60 + Math.floor((i / METEORS) * STORM);
    system.runTimeout(() => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 20;
      const spot = { x: target.x + Math.cos(a) * r, y: target.y, z: target.z + Math.sin(a) * r };
      fx.fall(d, spot, "fire", 8, 10);
      system.runTimeout(() => {
        fx.nova(d, up(spot, 0.4), "fire", 4);
        fx.afterglow(d, spot, "fire", 2);
        fx.light(d, up(spot, 1), 15, 8);
        sound(d, "random.explode", spot, 0.7 + Math.random() * 0.4, 4);
        for (const foe of foesNear(caster, spot, 4)) {
          smite(caster, foe, 40 * power);
          try {
            foe.setOnFire(5, true);
          } catch {
            // fireproof
          }
        }
      }, 8);
    }, tick);
  }
  // The great one.
  const finale = 60 + STORM + 20;
  for (let i = 0; i < 5; i++) system.runTimeout(() => fx.fall(d, target, "fire", 20 - i * 2, 14 - i), finale - 20 + i * 2);
  system.runTimeout(() => {
    if (!caster.isValid) return;
    for (let layer = 0; layer < 3; layer++) system.runTimeout(() => fx.nova(d, up(target, 0.5 + layer * 2), "fire", 12 - layer * 3), layer * 3);
    for (let r = 6; r <= 30; r += 6) system.runTimeout(() => fx.ring(d, target, "fire", r), r / 3);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      fx.pillar(d, { x: target.x + Math.cos(a) * 7, y: target.y, z: target.z + Math.sin(a) * 7 }, "fire", 20, 2.4);
    }
    fx.dome(d, target, "fire");
    fx.shake(d, target, 80, 1.8, 1.5);
    for (const p of playersNear(d, target, 64)) fx.wash(p, { red: 1, green: 0.55, blue: 0.1 }, 1.4);
    sound(d, "random.explode", target, 0.4, 8);
    sound(d, "ambient.weather.thunder", target, 0.4, 8);
    for (const foe of foesNear(caster, target, 12)) smite(caster, foe, 150 * power);
    for (const e of [...foesNear(caster, target, 26), ...playersNear(d, target, 26)]) {
      try {
        if (!e.isValid) continue;
        const dx = e.location.x - target.x;
        const dz = e.location.z - target.z;
        const length = Math.hypot(dx, dz) || 1;
        e.applyKnockback({ x: (dx / length) * 2.5, z: (dz / length) * 2.5 }, 0.7);
      } catch {
        // immovable
      }
    }
    // The ground burns where it struck.
    const scorched = [0, 1, 2, 3, 4, 5].map((k) => {
      const a = (k / 6) * Math.PI * 2;
      return { x: target.x + Math.cos(a) * 6, y: target.y, z: target.z + Math.sin(a) * 6 };
    });
    for (let s = 0; s < 8; s++) {
      system.runTimeout(() => {
        for (const spot of scorched) {
          fx.afterglow(d, spot, "fire", 2.5);
          for (const foe of foesNear(caster, spot, 3)) smite(caster, foe, 4 * power);
        }
      }, s * TICKS);
    }
  }, finale);
  return true;
}

// ----------------------------------------------------------------- v8.9: more of the highest magic

const NAMES_OF_THE_41 = 41; // a beam for each of the Supreme Beings of Ainz Ooal Gown
const BEAM_EVERY = 4; // ticks between beams

/**
 * Requiem of the Forty-One (god-tier): the banners of Ainz Ooal Gown unfurl in the sky, and one beam for each
 * of the forty-one Supreme Beings falls on the caster's foes; then all of them are struck together. Allies
 * near fight under the guild's banner for twenty seconds.
 * @param {Player} caster @param {number} power
 */
export function requiemOfFortyOne(caster, power) {
  const d = caster.dimension;
  const centre = { ...caster.location };
  const sky = up(centre, 20);
  invocation(caster, "dark");
  proclaim(caster, "§5§lRequiem of the Forty-One", "§7The Supreme Beings answer");
  cinematic(caster, centre, NAMES_OF_THE_41 * BEAM_EVERY / TICKS + 4, 16, 12);
  for (const ally of playersNear(d, centre, 36)) {
    try {
      ally.addEffect("strength", 20 * TICKS, { amplifier: 1, showParticles: false });
      ally.addEffect("resistance", 20 * TICKS, { amplifier: 0, showParticles: false });
    } catch {
      // gone
    }
  }
  // the forty-one banners: a ring of dark and gold standards high above
  for (let i = 0; i < 4; i++) {
    system.runTimeout(() => {
      fx.circle(d, sky, "dark", 18);
      fx.ring(d, up(sky, 0.5), "holy", 14);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + i * 0.2;
        fx.pillar(d, { x: centre.x + Math.cos(a) * 18, y: centre.y + 6, z: centre.z + Math.sin(a) * 18 }, k % 2 ? "dark" : "holy", 14, 1.2);
      }
    }, i * 40);
  }
  for (let i = 0; i < NAMES_OF_THE_41; i++) {
    system.runTimeout(() => {
      if (!caster.isValid) return;
      const foes = foesNear(caster, centre, 36);
      const foe = foes[Math.floor(Math.random() * foes.length)];
      if (!foe) return;
      const element = i % 2 ? "dark" : "holy";
      const a = (i / NAMES_OF_THE_41) * Math.PI * 2;
      fx.beam(d, { x: centre.x + Math.cos(a) * 18, y: centre.y + 20, z: centre.z + Math.sin(a) * 18 }, up(foe.location, 1), element, 1.8);
      fx.nova(d, up(foe.location, 0.6), element, 2.5);
      smite(caster, foe, 22 * power);
      if (i % 4 === 0) sound(d, "ambient.weather.lightning.impact", foe.location, 1.1, 3);
    }, 30 + i * BEAM_EVERY);
  }
  system.runTimeout(() => {
    if (!caster.isValid) return;
    for (const foe of foesNear(caster, centre, 36)) {
      fx.pillar(d, foe.location, "dark", 22, 2.2);
      smite(caster, foe, 30 * power);
      try {
        foe.addEffect("weakness", 10 * TICKS, { amplifier: 2 });
      } catch {
        // gone
      }
    }
    fx.dome(d, centre, "dark");
    for (let r = 6; r <= 36; r += 6) system.runTimeout(() => fx.ring(d, centre, "holy", r), r / 2);
    fx.shake(d, centre, 48, 1, 0.8);
    sound(d, "mob.wither.death", centre, 0.6, 5);
  }, 30 + NAMES_OF_THE_41 * BEAM_EVERY + 10);
  return true;
}

const COILS = 10; // the serpent's coils: ten heartbeats of crushing time

/**
 * Ouroboros (god-tier): the world serpent coils round the battlefield and turns time back for the caster's
 * side - every ally near is restored to full health and cleansed - while time stands almost still for their
 * foes, who are crushed by the tightening coils for ten seconds.
 * @param {Player} caster @param {number} power
 */
export function ouroboros(caster, power) {
  const d = caster.dimension;
  const centre = { ...caster.location };
  invocation(caster, "arcane");
  proclaim(caster, "§b§lOuroboros", "§7Time coils back upon itself");
  cinematic(caster, centre, COILS + 3, 14, 10);
  for (const ally of playersNear(d, centre, 32)) {
    try {
      const health = ally.getComponent("minecraft:health");
      if (health && health.currentValue > 0) health.setCurrentValue(health.effectiveMax);
      for (const bad of ["poison", "wither", "weakness", "slowness", "blindness", "nausea", "hunger", "mining_fatigue"]) {
        if (ally.getEffect(bad)) ally.removeEffect(bad);
      }
      fx.wash(ally, { red: 0.5, green: 0.85, blue: 1 }, 1.2);
      fx.rise(d, ally.location, "arcane", 1);
    } catch {
      // gone
    }
  }
  const caught = foesNear(caster, centre, 32);
  for (const foe of caught) {
    try {
      foe.addEffect("slowness", (COILS + 1) * TICKS, { amplifier: 6 });
      foe.addEffect("weakness", (COILS + 1) * TICKS, { amplifier: 2 });
    } catch {
      // gone
    }
  }
  for (let beat = 0; beat < COILS; beat++) {
    system.runTimeout(() => {
      if (!caster.isValid) return;
      // the serpent's body turning round the field, one way and then back
      const turn = beat % 2 ? -1 : 1;
      for (let k = 0; k < 16; k++) {
        const a = turn * ((k / 16) * Math.PI * 2 + beat * 0.4);
        fx.puff(d, "orbit", { x: centre.x + Math.cos(a) * 24, y: centre.y + 1 + Math.sin(k) * 0.5, z: centre.z + Math.sin(a) * 24 }, "arcane", 1.4);
      }
      fx.ring(d, centre, "arcane", 24 - beat * 1.5);
      for (const foe of foesNear(caster, centre, 32)) smite(caster, foe, 15 * power);
      sound(d, "block.bell.hit", centre, 0.5 + beat * 0.05, 3);
    }, 20 + beat * TICKS);
  }
  return true;
}

/**
 * Creation (super-tier): reshapes the world where the caster points - the ground freezes over twelve
 * blocks and everything on it is locked in ice for eight seconds, the cold biting each second.
 * @param {Player} caster @param {number} power
 */
export function creation(caster, power) {
  const at = aimed(caster);
  if (!at) return false;
  const d = caster.dimension;
  proclaim(caster, "§b§lCreation", "§fThe land is remade", "Super-tier");
  fx.pose(caster, "super");
  for (const [i, r] of [[0, 4], [1, 8], [2, 12]]) system.runTimeout(() => fx.circle(d, at, "ice", r), i * 5);
  sound(d, "random.glass", at, 0.6, 4);
  system.runTimeout(() => {
    if (!caster.isValid) return;
    fx.nova(d, up(at, 0.5), "ice", 12);
    fx.dome(d, at, "ice");
    for (const foe of foesNear(caster, at, 12)) {
      try {
        foe.addEffect("slowness", 8 * TICKS, { amplifier: 10 });
        foe.addEffect("mining_fatigue", 8 * TICKS, { amplifier: 3 });
        foe.addEffect("weakness", 8 * TICKS, { amplifier: 3 });
      } catch {
        // gone
      }
      fx.pillar(d, foe.location, "ice", 4, 1.2);
    }
    for (let s = 1; s <= 8; s++) {
      system.runTimeout(() => {
        if (!caster.isValid) return;
        for (const foe of foesNear(caster, at, 12)) smite(caster, foe, 8 * power);
        fx.ring(d, at, "ice", 12);
      }, s * TICKS);
    }
  }, 30);
  return true;
}

/**
 * Summon Behemoth (super-tier): two great elementals rise from pillars of fire to fight for the caster for
 * a minute, beyond the usual number of summoned allies.
 * @param {Player} caster
 */
export function summonBehemoth(caster) {
  const d = caster.dimension;
  const spots = [-1, 1].map((side) => {
    const view = caster.getViewDirection();
    const length = Math.hypot(view.x, view.z) || 1;
    return { x: caster.location.x + (view.x / length) * 3 - (view.z / length) * 2.5 * side, y: caster.location.y, z: caster.location.z + (view.z / length) * 3 + (view.x / length) * 2.5 * side };
  });
  fx.pose(caster, "summon");
  for (const spot of spots) {
    fx.pillar(d, spot, "fire", 10, 1.8);
    fx.nova(d, up(spot, 0.5), "fire", 3);
  }
  sound(d, "mob.blaze.shoot", caster.location, 0.5, 4);
  host(caster, id("behemoth"), spots);
  return true;
}
