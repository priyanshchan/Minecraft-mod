// Overlord: Tomb of Nazarick - the great dragons.
// The three dragons are the largest creatures in the add-on and are staged like it.
// Each one roars when it first sees a player, is wreathed in its own element, shakes the
// ground as it walks, beats its wings to throw back anyone who gets close, and looses a
// breath attack that is announced a moment before it lands so it can be dodged. At half
// health it becomes enraged and does all of this faster. Its death is a spectacle.
import { world, system, EntityDamageCause, GameMode } from "@minecraft/server";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const PASS = 10; // ticks between looks at each dragon
const SIGHT = 40; // a dragon acts against players this close
const BREATH_RANGE = 34;
const BREATH_EVERY = 9 * TICKS;
const BUFFET_EVERY = 14 * TICKS;
const BREATH_WARNING = 18; // ticks between the warning circle and the breath landing
const BUFFET_WARNING = 12;

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {{ name: string, element: string, size: number, breath: "frost" | "death" | "judgment", breathName: string }} Kind */
/** @typedef {{ roared: boolean, enraged: boolean, breathAt: number, buffetAt: number, stompAt: number, beat: number }} State */

/** The dragons: their element, how large they stand (the same factor the entity is scaled by) and their breath. */
/** @type {Record<string, Kind>} */
export const DRAGONS = {
  [id("frost_dragon")]: { name: "Frost Dragon", element: "ice", size: 2.6, breath: "frost", breathName: "Frost Breath" },
  [id("skeletal_dragon")]: { name: "Skeletal Dragon", element: "dark", size: 2.8, breath: "death", breathName: "Breath of Undeath" },
  [id("platinum_dragon_lord")]: { name: "Platinum Dragon Lord", element: "lightning", size: 3.4, breath: "judgment", breathName: "Judgment" },
};

/** @type {Map<string, State>} */
const states = new Map();

/** What a dragon has done so far. @param {Entity} dragon @returns {State} */
export function stateOf(dragon) {
  let state = states.get(dragon.id);
  if (!state) {
    state = { roared: false, enraged: false, breathAt: 0, buffetAt: 0, stompAt: 0, beat: 0 };
    states.set(dragon.id, state);
  }
  return state;
}

/** The way a dragon is facing, flat along the ground. @param {Entity} dragon */
function facing(dragon) {
  try {
    const view = dragon.getViewDirection();
    const len = Math.hypot(view.x, view.z);
    if (len > 0.01) return { x: view.x / len, z: view.z / len };
  } catch {
    // keep the default
  }
  return { x: 0, z: 1 };
}

/**
 * Places on a dragon's body, in blocks, for a dragon of the given size facing the given way.
 * @param {Entity} dragon @param {Kind} kind
 */
export function anatomy(dragon, kind) {
  const f = facing(dragon);
  const s = kind.size;
  const at = dragon.location;
  const point = (/** @type {number} */ ahead, /** @type {number} */ side, /** @type {number} */ up) => ({
    x: at.x + f.x * ahead * s - f.z * side * s,
    y: at.y + up * s,
    z: at.z + f.z * ahead * s + f.x * side * s,
  });
  return {
    mouth: point(3.3, 0, 2.5),
    chest: point(0.6, 0, 1.4),
    leftWing: point(0, 3.4, 2.2),
    rightWing: point(0, -3.4, 2.2),
    tail: point(-4.4, 0, 1.4),
    feet: point(0, 0, 0.1),
  };
}

/** Survival players near a point, nearest first. @param {Dimension} dimension @param {Vector3} at @param {number} range */
function playersNear(dimension, at, range) {
  try {
    return dimension
      .getPlayers({ location: at, maxDistance: range })
      .filter((p) => {
        try {
          const mode = p.getGameMode();
          return mode !== GameMode.Creative && mode !== GameMode.Spectator;
        } catch {
          return true;
        }
      })
      .sort((a, b) => Math.hypot(a.location.x - at.x, a.location.z - at.z) - Math.hypot(b.location.x - at.x, b.location.z - at.z));
  } catch {
    return [];
  }
}

/** Everything a dragon's attacks can hurt near a point: players and whatever fights for them. */
/** @param {Dimension} dimension @param {Vector3} at @param {number} range @returns {Entity[]} */
function victims(dimension, at, range) {
  /** @type {Entity[]} */
  const found = [...playersNear(dimension, at, range)];
  try {
    found.push(...dimension.getEntities({ location: at, maxDistance: range, families: ["nazarick_ally"] }));
  } catch {
    // unloaded chunk
  }
  return found;
}

/**
 * @param {Entity} dragon @param {Entity} victim @param {number} amount
 * @param {[string, number, number]} [effect] an effect, its seconds and its amplifier
 */
function strike(dragon, victim, amount, effect) {
  try {
    victim.applyDamage(amount, { cause: EntityDamageCause.magic, damagingEntity: dragon });
    if (effect && victim.isValid) victim.addEffect(effect[0], effect[1] * TICKS, { amplifier: effect[2] });
  } catch {
    // already dead, or immune
  }
}

/** @param {Dimension} dimension @param {string} sound @param {Vector3} at @param {number} pitch */
function sound(dimension, sound, at, pitch) {
  try {
    dimension.playSound(sound, at, { volume: 4, pitch });
  } catch {
    // cosmetic only
  }
}

/** Tells everyone near a dragon something. @param {Entity} dragon @param {string} text */
function announce(dragon, text) {
  for (const player of playersNear(dragon.dimension, dragon.location, 56)) {
    try {
      player.sendMessage(text);
    } catch {
      // that player is leaving
    }
  }
}

// ------------------------------------------------------------------ presence

/**
 * What hangs about a dragon at all times: its element along its wings and tail, more of it when enraged.
 * @param {Entity} dragon @param {Kind} kind @param {State} state
 */
function dress(dragon, kind, state) {
  const d = dragon.dimension;
  const body = anatomy(dragon, kind);
  const s = kind.size;
  state.beat += 1;
  const wing = state.beat % 2 === 0 ? body.leftWing : body.rightWing;
  if (kind.breath === "frost") {
    fx.puff(d, "ember", wing, "ice", s);
    fx.puff(d, "ember", body.tail, "ice", s * 0.7);
    if (state.beat % 3 === 0) fx.puff(d, "shard", wing, "ice", s * 0.5); // ice falls from its wings
    if (state.beat % 4 === 0) fx.puff(d, "dust", body.feet, "ice", s * 0.6); // and mist rolls off its flanks
  } else if (kind.breath === "death") {
    fx.puff(d, "ember", body.chest, "acid", s * 0.8); // the soul fire in its ribs
    fx.puff(d, "wisp", state.beat % 2 === 0 ? body.chest : body.tail, "dark", s);
    if (state.beat % 2 === 0) fx.puff(d, "flash", body.mouth, "acid", s * 0.35); // the light in its eye sockets
  } else {
    fx.puff(d, "arc", wing, "lightning", s * 0.7);
    if (state.beat % 2 === 0) fx.puff(d, "ray", body.feet, "holy", s);
    if (state.beat % 3 === 0) fx.puff(d, "glyph", body.mouth, "holy", s * 0.5); // runes about its crown
  }
  if (state.enraged) {
    fx.puff(d, "streak", body.chest, kind.element, s * 0.6);
    if (state.beat % 4 === 0) fx.ring(d, body.feet, kind.element, 2.2 * s);
  }
}

/** The roar that greets the first player a dragon sees. @param {Entity} dragon @param {Kind} kind */
function roar(dragon, kind) {
  const d = dragon.dimension;
  const body = anatomy(dragon, kind);
  sound(d, "mob.enderdragon.growl", dragon.location, 0.7);
  fx.flash(d, body.mouth, kind.element, 2 * kind.size);
  for (let i = 0; i < 3; i++) {
    system.runTimeout(() => {
      if (dragon.isValid) fx.ring(d, anatomy(dragon, kind).feet, kind.element, (3 + i * 2.5) * kind.size);
    }, i * 5);
  }
  fx.shake(d, dragon.location, 48, 0.9, 0.9);
}

/** Half dead and furious: from here on everything comes faster. @param {Entity} dragon @param {Kind} kind @param {State} state */
function enrage(dragon, kind, state) {
  state.enraged = true;
  const d = dragon.dimension;
  const body = anatomy(dragon, kind);
  try {
    dragon.addEffect("speed", 20000000, { amplifier: 0, showParticles: false });
    dragon.addEffect("strength", 20000000, { amplifier: 0, showParticles: false });
  } catch {
    // it fights on without them
  }
  sound(d, "mob.enderdragon.growl", dragon.location, 0.5);
  fx.nova(d, body.chest, kind.element, 3 * kind.size);
  fx.pillar(d, body.feet, kind.element, 5 * kind.size, kind.size);
  fx.shake(d, dragon.location, 48, 1.2, 1.0);
  state.breathAt = Math.min(state.breathAt, system.currentTick + 30);
  announce(dragon, `§6[Boss] §cThe ${kind.name} is enraged!`);
}

/** The ground shudders under a walking dragon. @param {Entity} dragon @param {Kind} kind */
function stomp(dragon, kind) {
  const feet = anatomy(dragon, kind).feet;
  fx.puff(dragon.dimension, "dust", feet, "none", kind.size * 0.7);
  fx.shake(dragon.dimension, dragon.location, 6 * kind.size, 0.12, 0.2);
}

// ------------------------------------------------------------------- attacks

/**
 * Wing buffet: the wings draw back, then a gale throws back everyone standing close.
 * @param {Entity} dragon @param {Kind} kind
 */
export function buffet(dragon, kind) {
  const d = dragon.dimension;
  const reach = 3.4 * kind.size;
  const body = anatomy(dragon, kind);
  fx.implode(d, body.leftWing, kind.element, 1.6 * kind.size);
  fx.implode(d, body.rightWing, kind.element, 1.6 * kind.size);
  sound(d, "mob.enderdragon.flap", dragon.location, 0.6);
  system.runTimeout(() => {
    if (!dragon.isValid) return;
    const centre = anatomy(dragon, kind).feet;
    fx.ring(d, centre, kind.element, reach);
    fx.ring(d, { x: centre.x, y: centre.y + 1.5, z: centre.z }, "none", reach * 0.7);
    fx.shake(d, dragon.location, reach * 2, 0.7, 0.4);
    sound(d, "mob.enderdragon.flap", dragon.location, 0.9);
    for (const victim of victims(d, dragon.location, reach)) {
      strike(dragon, victim, 6 + kind.size * 2);
      try {
        const dx = victim.location.x - dragon.location.x;
        const dz = victim.location.z - dragon.location.z;
        const len = Math.hypot(dx, dz) || 1;
        if (victim.isValid) victim.applyKnockback({ x: (dx / len) * 2.4, z: (dz / len) * 2.4 }, 0.7);
      } catch {
        // immovable, or gone
      }
    }
  }, BUFFET_WARNING);
}

/**
 * Breath: a circle marks where it will land and light gathers in the dragon's jaws; a moment
 * later the breath strikes that spot, whether or not the target is still standing on it.
 * @param {Entity} dragon @param {Kind} kind @param {Vector3} mark where the target stood when the dragon drew breath
 */
export function breathe(dragon, kind, mark) {
  const d = dragon.dimension;
  const element = kind.element;
  fx.circle(d, mark, element, 5);
  fx.ring(d, mark, element, 5);
  fx.implode(d, anatomy(dragon, kind).mouth, element, 1.4 * kind.size);
  sound(d, "mob.enderdragon.growl", dragon.location, 1.3);
  system.runTimeout(() => {
    if (!dragon.isValid) return;
    const mouth = anatomy(dragon, kind).mouth;
    const centre = { x: mark.x, y: mark.y + 1, z: mark.z };
    fx.beam(d, mouth, centre, element, 3);
    fx.flash(d, mouth, element, 2.5 * kind.size);
    fx.shake(d, mark, 24, 0.8, 0.5);
    if (kind.breath === "frost") {
      // a blast of cold that leaves the ground freezing for a moment afterwards
      fx.nova(d, centre, "ice", 6);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        fx.spark(d, { x: mark.x + Math.cos(a) * 3.5, y: mark.y + 0.6, z: mark.z + Math.sin(a) * 3.5 }, "ice", 1.4);
      }
      for (const victim of victims(d, mark, 5)) strike(dragon, victim, 14, ["slowness", 5, 2]);
      for (let i = 1; i <= 3; i++) {
        system.runTimeout(() => {
          fx.rise(d, mark, "ice", 4);
          for (const victim of victims(d, mark, 4)) strike(dragon, victim, 2, ["slowness", 3, 1]);
        }, i * 10);
      }
    } else if (kind.breath === "death") {
      // negative energy: it withers what it touches
      fx.nova(d, centre, "dark", 5);
      fx.skull(d, { x: mark.x, y: mark.y + 2.5, z: mark.z }, 2.4);
      fx.rise(d, mark, "dark", 4);
      for (const victim of victims(d, mark, 5)) strike(dragon, victim, 12, ["wither", 5, 1]);
    } else {
      // judgment: five bolts, one on the mark and four around it
      const bolts = [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]];
      bolts.forEach(([dx, dz], i) => {
        system.runTimeout(() => {
          const at = { x: mark.x + dx, y: mark.y, z: mark.z + dz };
          fx.pillar(d, at, "lightning", 12, 1.6);
          fx.nova(d, { x: at.x, y: at.y + 0.8, z: at.z }, "lightning", 3);
          sound(d, "ambient.weather.lightning.impact", at, 1);
          if (dragon.isValid) for (const victim of victims(d, at, 3)) strike(dragon, victim, 10, ["slowness", 1, 4]);
        }, i * 4);
      });
    }
  }, BREATH_WARNING);
}

// ---------------------------------------------------------------------- loop

/**
 * Looks at one dragon: dresses it, and lets it act against the nearest player.
 * @param {Entity} dragon
 */
export function tend(dragon) {
  const kind = DRAGONS[dragon.typeId];
  if (!kind) return;
  const state = stateOf(dragon);
  const now = system.currentTick;
  dress(dragon, kind, state);
  const foe = playersNear(dragon.dimension, dragon.location, SIGHT)[0];
  if (!foe) return;
  if (!state.roared) {
    state.roared = true;
    state.breathAt = now + 4 * TICKS;
    state.buffetAt = now + 7 * TICKS;
    roar(dragon, kind);
    return;
  }
  const health = dragon.getComponent("minecraft:health");
  if (!state.enraged && health && health.currentValue > 0 && health.currentValue <= health.effectiveMax * 0.5) enrage(dragon, kind, state);
  const haste = state.enraged ? 0.65 : 1;
  const gap = Math.hypot(foe.location.x - dragon.location.x, foe.location.z - dragon.location.z);
  if (now >= state.buffetAt && gap <= 3.2 * kind.size) {
    state.buffetAt = now + Math.round(BUFFET_EVERY * haste);
    buffet(dragon, kind);
  } else if (now >= state.breathAt && gap <= BREATH_RANGE && gap >= 4) {
    state.breathAt = now + Math.round(BREATH_EVERY * haste);
    breathe(dragon, kind, { ...foe.location });
  }
  try {
    const v = dragon.getVelocity();
    if (now >= state.stompAt && Math.hypot(v.x, v.z) > 0.03) {
      state.stompAt = now + 16;
      stomp(dragon, kind);
    }
  } catch {
    // velocity is not readable right now
  }
}

/** Looks at every dragon near a player. Returns how many there were. */
export function pass() {
  const seen = new Set();
  for (const player of world.getAllPlayers()) {
    /** @type {Entity[]} */
    let near = [];
    try {
      near = player.dimension.getEntities({ location: player.location, maxDistance: 72, families: ["dragon"] });
    } catch {
      continue; // the dimension is unloading
    }
    for (const dragon of near) {
      if (seen.has(dragon.id) || !DRAGONS[dragon.typeId]) continue;
      seen.add(dragon.id);
      try {
        tend(dragon);
      } catch (error) {
        console.warn(`[Overlord] dragon failed: ${error}`);
      }
    }
  }
  return seen.size;
}

system.runInterval(() => {
  try {
    pass();
  } catch (error) {
    console.warn(`[Overlord] dragons failed: ${error}`);
  }
}, PASS);

// A dragon does not simply fall: its element tears loose along the whole length of it.
world.afterEvents.entityDie.subscribe((event) => {
  try {
    const dragon = event.deadEntity;
    const kind = DRAGONS[dragon.typeId];
    if (!kind) return;
    states.delete(dragon.id);
    const d = dragon.dimension;
    const body = anatomy(dragon, kind);
    sound(d, "mob.enderdragon.death", dragon.location, 0.8);
    const spots = [body.mouth, body.leftWing, body.rightWing, body.tail, body.chest];
    spots.forEach((spot, i) => {
      system.runTimeout(() => {
        fx.pillar(d, { x: spot.x, y: body.feet.y, z: spot.z }, kind.element, 8 * kind.size, kind.size);
        fx.nova(d, spot, kind.element, 2.5 * kind.size);
        fx.shake(d, spot, 40, 0.8, 0.4);
      }, i * 7);
    });
    system.runTimeout(() => {
      fx.ring(d, body.feet, kind.element, 6 * kind.size);
      fx.dome(d, body.feet, kind.element);
    }, spots.length * 7);
    announce(dragon, `§6[Boss] §fThe ${kind.name} has fallen.`);
  } catch {
    // the dragon is already unloaded
  }
});
