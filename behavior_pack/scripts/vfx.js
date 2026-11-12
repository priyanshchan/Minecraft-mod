// Overlord: Tomb of Nazarick - spell visuals.
// Draws magic circles, beams, shock rings, sparks and rising motes with the add-on's
// own tintable particles, and plays the casting poses on the player.
import { MolangVariableMap, system } from "@minecraft/server";

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {"point" | "raise" | "self"} Pose */

/** Element colours (0-1 RGB). */
/** @type {Record<string, { red: number, green: number, blue: number }>} */
const COLORS = {
  arcane: { red: 0.75, green: 0.45, blue: 1.0 },
  fire: { red: 1.0, green: 0.45, blue: 0.1 },
  ice: { red: 0.55, green: 0.85, blue: 1.0 },
  lightning: { red: 1.0, green: 0.95, blue: 0.4 },
  holy: { red: 1.0, green: 0.9, blue: 0.6 },
  acid: { red: 0.5, green: 0.9, blue: 0.25 },
  dark: { red: 0.6, green: 0.15, blue: 0.75 },
  none: { red: 0.85, green: 0.85, blue: 0.95 },
};

const POSES = {
  point: "animation.overlord.cast_point",
  raise: "animation.overlord.cast_raise",
  self: "animation.overlord.cast_self",
};

/**
 * Spawns one of the add-on's particles tinted for an element.
 * @param {Dimension} dimension @param {string} effect @param {Vector3} location @param {string} element @param {number} scale
 */
function emit(dimension, effect, location, element, scale) {
  try {
    const vars = new MolangVariableMap();
    vars.setColorRGB("variable.color", COLORS[element] ?? COLORS.none);
    vars.setFloat("variable.scale", scale);
    dimension.spawnParticle(`overlord:${effect}`, location, vars);
  } catch {
    // unloaded chunk or the dimension is gone
  }
}

/** @param {Vector3} v @param {number} dy */
function up(v, dy) {
  return { x: v.x, y: v.y + dy, z: v.z };
}

/** Flat rotating magic circle of the given radius. @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} radius */
export function circle(dimension, at, element, radius) {
  emit(dimension, "magic_circle", up(at, 0.08), element, radius);
}

/** Flat ring expanding to the given radius. @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} radius */
export function ring(dimension, at, element, radius) {
  emit(dimension, "ring", up(at, 0.12), element, radius);
}

/** Burst of sparks. @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} [scale] */
export function spark(dimension, at, element, scale = 1) {
  emit(dimension, "spark", at, element, scale);
}

/** Motes rising from a disc on the ground. @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} [radius] */
export function rise(dimension, at, element, radius = 0.8) {
  emit(dimension, "rise", up(at, 0.1), element, radius);
}

/**
 * Beam between two points, drawn as a row of motes.
 * @param {Dimension} dimension @param {Vector3} from @param {Vector3} to @param {string} element @param {number} [scale]
 */
export function beam(dimension, from, to, element, scale = 1) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const steps = Math.min(70, Math.max(1, Math.round(Math.hypot(dx, dy, dz) / 0.5)));
  for (let i = 0; i <= steps; i++) {
    emit(dimension, "mote", { x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps, z: from.z + (dz * i) / steps }, element, scale);
  }
}

/** Column of light and sparks. @param {Dimension} dimension @param {Vector3} base @param {string} element @param {number} height @param {number} [scale] */
export function pillar(dimension, base, element, height, scale = 1.5) {
  beam(dimension, base, up(base, height), element, scale * 1.6);
  for (let h = 0.5; h <= height; h += 2) spark(dimension, up(base, h), element, scale);
}

/**
 * Motes spiralling up around a moving centre over about a second (buffs).
 * @param {Dimension} dimension @param {() => Vector3 | undefined} center @param {string} element @param {number} [radius] @param {number} [height]
 */
export function spiral(dimension, center, element, radius = 0.9, height = 2.2) {
  const steps = 18;
  for (let i = 0; i < steps; i++) {
    system.runTimeout(() => {
      const c = center();
      if (!c) return;
      const angle = (i / steps) * Math.PI * 4;
      for (const side of [0, Math.PI]) {
        emit(dimension, "mote", { x: c.x + Math.cos(angle + side) * radius, y: c.y + (i / steps) * height, z: c.z + Math.sin(angle + side) * radius }, element, 0.9);
      }
    }, i);
  }
}

/**
 * Something falling from the sky onto a point over `ticks` ticks (meteors, blades, pillars of light).
 * @param {Dimension} dimension @param {Vector3} target @param {string} element @param {number} ticks @param {number} [lean]
 */
export function fall(dimension, target, element, ticks, lean = 6) {
  const top = { x: target.x + lean, y: target.y + 22, z: target.z + lean * 0.5 };
  const segments = Math.max(1, Math.min(10, ticks));
  for (let i = 0; i < segments; i++) {
    system.runTimeout(() => {
      const a = i / segments;
      const b = (i + 1) / segments;
      beam(
        dimension,
        { x: top.x + (target.x - top.x) * a, y: top.y + (target.y - top.y) * a, z: top.z + (target.z - top.z) * a },
        { x: top.x + (target.x - top.x) * b, y: top.y + (target.y - top.y) * b, z: top.z + (target.z - top.z) * b },
        element,
        2.2
      );
    }, Math.round((i * ticks) / segments));
  }
}

/** Stacked magic circles - the dome that surrounds a super-tier caster. @param {Dimension} dimension @param {Vector3} at @param {string} element */
export function dome(dimension, at, element) {
  circle(dimension, at, element, 4.5);
  circle(dimension, up(at, 1.4), element, 3.6);
  circle(dimension, up(at, 2.8), element, 2.6);
  circle(dimension, up(at, 4.0), element, 1.4);
  rise(dimension, at, element, 3.5);
}

/**
 * Plays a casting pose on the player.
 * @param {Player} player @param {Pose} pose
 */
export function pose(player, pose) {
  try {
    player.playAnimation(POSES[pose], { blendOutTime: 0.2 });
  } catch {
    // animation support is cosmetic
  }
}

/**
 * The flourish every cast starts with: a magic circle under the caster and a casting pose.
 * @param {Player} player @param {string} element @param {number} tier 1-10, 11 for super-tier @param {Pose} how
 */
export function castFx(player, element, tier, how) {
  const feet = player.location;
  if (tier >= 11) {
    dome(player.dimension, feet, element);
    system.runTimeout(() => {
      if (player.isValid) dome(player.dimension, player.location, element);
    }, 24);
  } else {
    circle(player.dimension, feet, element, 1.1 + tier * 0.14);
    if (tier >= 7) circle(player.dimension, up(feet, 1.2), element, 0.8 + tier * 0.08);
  }
  pose(player, tier >= 11 ? "raise" : how);
}
