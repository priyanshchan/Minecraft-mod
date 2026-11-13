// Overlord: Tomb of Nazarick - spell visuals.
// Every spell, scroll and weapon skill draws through this file. Effects are built in
// layers from the add-on's own tintable particles: a simple base layer (motes, sparks,
// rings, the magic circle) and, on top of it, richer layers - a counter-turning inner
// circle, flashes, streaks, shock waves with dust, and a signature for each element
// (flames and embers, ice shards, lightning arcs, shafts of holy light, wisps of shadow,
// acid droplets, drifting runes). The decorative layers are dropped first when a great
// deal is being drawn in the same tick.
import { MolangVariableMap, system } from "@minecraft/server";

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {"point" | "raise" | "self" | "sweep" | "slam" | "channel" | "summon" | "super" | "scroll" | "tome" | "slash" | "smash"} Pose */

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

/** @type {Record<Pose, string>} */
const POSES = {
  point: "animation.overlord.cast_point",
  raise: "animation.overlord.cast_raise",
  self: "animation.overlord.cast_self",
  sweep: "animation.overlord.cast_sweep",
  slam: "animation.overlord.cast_slam",
  channel: "animation.overlord.cast_channel",
  summon: "animation.overlord.cast_summon",
  super: "animation.overlord.cast_super",
  scroll: "animation.overlord.use_scroll",
  tome: "animation.overlord.use_tome",
  slash: "animation.overlord.weapon_slash",
  smash: "animation.overlord.weapon_slam",
};

/** The particle each element adds to an impact. */
/** @type {Record<string, string>} */
const ACCENT = { arcane: "glyph", fire: "flame", ice: "shard", lightning: "arc", holy: "ray", acid: "droplet", dark: "wisp", none: "streak" };
/** The particle each element adds to light rising from the ground. */
/** @type {Record<string, string>} */
const RISING = { arcane: "glyph", fire: "ember", holy: "ray", dark: "wisp" };
/** The particle each element scatters along a beam, and how many blocks apart. */
/** @type {Record<string, [string, number]>} */
const TRAIL = { fire: ["ember", 2.5], lightning: ["arc", 2], dark: ["wisp", 3.5], ice: ["shard", 5], acid: ["droplet", 4] };

/** Emitters drawn so far this tick, and how many may be drawn before decoration is skipped. */
let drawn = 0;
let drawnTick = -1;
export const DECORATION_BUDGET = 260;

/**
 * Spawns one of the add-on's particles tinted for an element.
 * @param {Dimension} dimension @param {string} effect @param {Vector3} location @param {string} element @param {number} scale
 * @param {{ height?: number, length?: number, direction?: Vector3 }} [shape]
 */
function emit(dimension, effect, location, element, scale, shape) {
  if (system.currentTick !== drawnTick) {
    drawnTick = system.currentTick;
    drawn = 0;
  }
  drawn++;
  try {
    const vars = new MolangVariableMap();
    vars.setColorRGB("variable.color", COLORS[element] ?? COLORS.none);
    vars.setFloat("variable.scale", scale);
    if (shape?.height !== undefined) vars.setFloat("variable.height", shape.height);
    if (shape?.length !== undefined) vars.setFloat("variable.length", shape.length);
    if (shape?.direction) vars.setVector3("variable.direction", shape.direction);
    dimension.spawnParticle(`overlord:${effect}`, location, vars);
  } catch {
    // unloaded chunk or the dimension is gone
  }
}

/**
 * A decorative layer: drawn only while this tick still has room for it.
 * @param {Dimension} dimension @param {string} effect @param {Vector3} location @param {string} element @param {number} scale
 * @param {{ height?: number, length?: number, direction?: Vector3 }} [shape]
 */
function adorn(dimension, effect, location, element, scale, shape) {
  if (system.currentTick === drawnTick && drawn >= DECORATION_BUDGET) return;
  emit(dimension, effect, location, element, scale, shape);
}

/**
 * One decorative puff of any of the add-on's particles (used for what hangs in the air around creatures).
 * @param {Dimension} dimension @param {string} effect @param {Vector3} at @param {string} element @param {number} [scale]
 */
export function puff(dimension, effect, at, element, scale = 1) {
  adorn(dimension, effect, at, element, scale);
}

/** @param {Vector3} v @param {number} dy */
function up(v, dy) {
  return { x: v.x, y: v.y + dy, z: v.z };
}

/**
 * Magic circle of the given radius lying on the ground: an outer ring of runes and an inner
 * figure turning against it, with runes drifting up from the larger ones.
 * @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} radius
 */
export function circle(dimension, at, element, radius) {
  emit(dimension, "magic_circle", up(at, 0.08), element, radius);
  adorn(dimension, "magic_circle_inner", up(at, 0.1), element, radius * 0.74);
  if (radius >= 2.2) adorn(dimension, "glyph", up(at, 0.2), element, radius * 0.9);
}

/**
 * Flat ring expanding to the given radius; the larger ones roll out as a shock wave with dust.
 * @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} radius
 */
export function ring(dimension, at, element, radius) {
  emit(dimension, "ring", up(at, 0.12), element, radius);
  if (radius >= 2) {
    adorn(dimension, "shockwave", up(at, 0.06), element, radius);
    adorn(dimension, "dust", up(at, 0.2), element, Math.min(3, radius * 0.35));
  }
}

/** A flash of light. @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} [scale] */
export function flash(dimension, at, element, scale = 1) {
  adorn(dimension, "flash", at, element, scale);
}

/**
 * An impact: a burst of sparkles and a flash, with the element's own signature on top.
 * @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} [scale]
 */
export function spark(dimension, at, element, scale = 1) {
  emit(dimension, "spark", at, element, scale);
  flash(dimension, at, element, 0.8 * scale);
  const accent = ACCENT[element] ?? ACCENT.none;
  // Shafts of light and runes rise from below the point of impact; the rest burst from it.
  adorn(dimension, accent, accent === "ray" || accent === "glyph" ? up(at, -0.7) : at, element, accent === "ray" || accent === "glyph" ? 0.6 * scale : scale);
  if (accent === "flame") adorn(dimension, "ember", at, element, scale);
}

/**
 * Sparkles rising from a disc on the ground, with what the element sends up beside them.
 * @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} [radius]
 */
export function rise(dimension, at, element, radius = 0.8) {
  emit(dimension, "rise", up(at, 0.1), element, radius);
  const extra = RISING[element];
  if (extra) adorn(dimension, extra, up(at, 0.15), element, radius);
}

/**
 * Beam between two points: a row of motes around a bright core, a flash where it leaves the
 * caster and the element's own trail along it.
 * @param {Dimension} dimension @param {Vector3} from @param {Vector3} to @param {string} element @param {number} [scale]
 */
export function beam(dimension, from, to, element, scale = 1) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dy, dz);
  const steps = Math.min(70, Math.max(1, Math.round(length / 0.5)));
  for (let i = 0; i <= steps; i++) {
    emit(dimension, "mote", { x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps, z: from.z + (dz * i) / steps }, element, scale);
  }
  if (length < 0.5) return;
  adorn(dimension, "beam_core", { x: from.x + dx / 2, y: from.y + dy / 2, z: from.z + dz / 2 }, element, scale, {
    length,
    direction: { x: dx / length, y: dy / length, z: dz / length },
  });
  flash(dimension, from, element, 0.45 * scale);
  const trail = TRAIL[element];
  if (!trail) return;
  for (let d = trail[1] / 2; d < length; d += trail[1]) {
    adorn(dimension, trail[0], { x: from.x + (dx * d) / length, y: from.y + (dy * d) / length, z: from.z + (dz * d) / length }, element, 0.6 * scale);
  }
}

/**
 * Column of light standing on the ground, wrapped in sparks.
 * @param {Dimension} dimension @param {Vector3} base @param {string} element @param {number} height @param {number} [scale]
 */
export function pillar(dimension, base, element, height, scale = 1.5) {
  beam(dimension, base, up(base, height), element, scale * 1.6);
  adorn(dimension, "pillar_light", up(base, height / 2), element, scale, { height });
  for (let h = 0.5; h <= height; h += 2) spark(dimension, up(base, h), element, scale);
  flash(dimension, up(base, 0.4), element, 1.6 * scale);
}

/**
 * Light spiralling up around a moving centre for about a second (buffs).
 * @param {Dimension} dimension @param {() => Vector3 | undefined} center @param {string} element @param {number} [radius] @param {number} [height]
 */
export function spiral(dimension, center, element, radius = 0.9, height = 2.2) {
  const start = center();
  if (start) adorn(dimension, "aura", up(start, 0.1), element, radius);
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
 * It lands with a flash.
 * @param {Dimension} dimension @param {Vector3} target @param {string} element @param {number} ticks @param {number} [lean]
 */
export function fall(dimension, target, element, ticks, lean = 6) {
  const top = { x: target.x + lean, y: target.y + 22, z: target.z + lean * 0.5 };
  const segments = Math.max(1, Math.min(10, ticks));
  for (let i = 0; i < segments; i++) {
    system.runTimeout(() => {
      const a = i / segments;
      const b = (i + 1) / segments;
      const head = { x: top.x + (target.x - top.x) * b, y: top.y + (target.y - top.y) * b, z: top.z + (target.z - top.z) * b };
      beam(dimension, { x: top.x + (target.x - top.x) * a, y: top.y + (target.y - top.y) * a, z: top.z + (target.z - top.z) * a }, head, element, 2.2);
      adorn(dimension, ACCENT[element] ?? ACCENT.none, head, element, 1.4);
    }, Math.round((i * ticks) / segments));
  }
  system.runTimeout(() => flash(dimension, up(target, 0.5), element, 4), ticks);
}

/** Sparkles rushing in to a point: a spell gathering power. @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} [radius] */
export function implode(dimension, at, element, radius = 1.6) {
  adorn(dimension, "implode", at, element, radius);
}

/**
 * An explosion of light: streaks thrown out to about the given radius, a great flash and a shock wave.
 * @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} radius
 */
export function nova(dimension, at, element, radius) {
  emit(dimension, "nova", at, element, Math.max(1, radius * 0.55));
  flash(dimension, at, element, Math.max(1.5, radius * 0.9));
  adorn(dimension, "streak", at, element, Math.max(1, radius * 0.4));
  ring(dimension, up(at, -0.5), element, radius);
}

/** The crescent a blade leaves in the air. @param {Dimension} dimension @param {Vector3} at @param {string} element @param {number} [scale] */
export function slash(dimension, at, element, scale = 1.2) {
  emit(dimension, "slash", at, element, scale);
  adorn(dimension, "streak", at, element, 0.6 * scale);
}

/** A skull rising from the slain - the mark of death magic. @param {Dimension} dimension @param {Vector3} at @param {number} [scale] */
export function skull(dimension, at, scale = 1) {
  emit(dimension, "skull", at, "dark", scale);
  adorn(dimension, "wisp", at, "dark", scale);
}

/** Stacked magic circles - the dome that surrounds a super-tier caster. @param {Dimension} dimension @param {Vector3} at @param {string} element */
export function dome(dimension, at, element) {
  circle(dimension, at, element, 4.5);
  circle(dimension, up(at, 1.4), element, 3.6);
  circle(dimension, up(at, 2.8), element, 2.6);
  circle(dimension, up(at, 4.0), element, 1.4);
  rise(dimension, at, element, 3.5);
  implode(dimension, up(at, 1.2), element, 4.5);
}

/**
 * Vanishing in one place and appearing in another.
 * @param {Dimension} dimension @param {Vector3} from @param {Vector3} to @param {string} element
 */
export function blink(dimension, from, to, element) {
  implode(dimension, up(from, 1), element, 1.5);
  ring(dimension, from, element, 1.2);
  circle(dimension, to, element, 1.3);
  pillar(dimension, to, element, 2.4, 1);
  ring(dimension, to, element, 2);
}

/**
 * Shakes the view of every player near a heavy impact.
 * @param {Dimension} dimension @param {Vector3} at @param {number} radius @param {number} [intensity] 0-4 @param {number} [seconds]
 */
export function shake(dimension, at, radius, intensity = 0.3, seconds = 0.35) {
  try {
    for (const player of dimension.getPlayers({ location: at, maxDistance: radius })) {
      try {
        player.runCommand(`camerashake add @s ${Math.min(4, intensity).toFixed(2)} ${seconds.toFixed(2)} positional`);
      } catch {
        // purely cosmetic
      }
    }
  } catch {
    // dimension unloading
  }
}

/**
 * Washes a player's view with a colour for a moment (time magic, teleporting).
 * @param {Player} player @param {{ red: number, green: number, blue: number }} color @param {number} [seconds]
 */
export function wash(player, color, seconds = 0.4) {
  try {
    player.camera.fade({ fadeColor: color, fadeTime: { fadeInTime: 0.05, holdTime: 0.05, fadeOutTime: seconds } });
  } catch {
    // purely cosmetic
  }
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

/** Where a player's casting hand is: in front of the chest. @param {Player} player @param {number} [reach] */
export function handOf(player, reach = 0.7) {
  let view = { x: 0, y: 0, z: 1 };
  try {
    view = player.getViewDirection();
  } catch {
    // keep the default
  }
  return { x: player.location.x + view.x * reach, y: player.location.y + 1.3 + view.y * reach * 0.5, z: player.location.z + view.z * reach };
}

/**
 * The flourish every cast starts with: a magic circle under the caster, light gathering in the
 * hand and a casting pose - more of each the higher the tier.
 * @param {Player} player @param {string} element @param {number} tier 1-10, 11 for super-tier @param {Pose} how
 */
export function castFx(player, element, tier, how) {
  const dimension = player.dimension;
  const feet = player.location;
  if (tier >= 11) {
    dome(dimension, feet, element);
    system.runTimeout(() => {
      if (player.isValid) dome(dimension, player.location, element);
    }, 24);
    pose(player, "super");
    return;
  }
  circle(dimension, feet, element, 1.1 + tier * 0.14);
  flash(dimension, handOf(player), element, 0.35 + tier * 0.05);
  if (tier >= 4) rise(dimension, feet, element, 0.7 + tier * 0.05);
  if (tier >= 6) implode(dimension, up(feet, 1.1), element, 1.4 + tier * 0.1);
  if (tier >= 7) circle(dimension, up(feet, 1.2), element, 0.8 + tier * 0.08);
  if (tier >= 9) adorn(dimension, "glyph", up(feet, 0.3), element, 2);
  pose(player, how);
}

/**
 * Reading a scroll: it is held open, runes lift off the page and it burns away in the element's colour.
 * @param {Player} player @param {string} element
 */
export function scroll(player, element) {
  const hand = handOf(player, 0.6);
  circle(player.dimension, player.location, element, 1.0);
  emit(player.dimension, "glyph", up(hand, -0.4), element, 0.35);
  flash(player.dimension, hand, element, 0.5);
  system.runTimeout(() => {
    if (player.isValid) spark(player.dimension, handOf(player, 0.6), element, 0.7);
  }, 10);
  pose(player, "scroll");
}

/**
 * Casting from a tome: the book is held open while runes rise from it.
 * @param {Player} player @param {string} element @param {number} [tier]
 */
export function tome(player, element, tier = 6) {
  const hand = handOf(player, 0.6);
  circle(player.dimension, player.location, element, 1.1 + tier * 0.12);
  emit(player.dimension, "glyph", up(hand, -0.5), element, 0.45);
  implode(player.dimension, hand, element, 1.2);
  pose(player, tier >= 11 ? "super" : "tome");
}

/**
 * A weapon skill: the swing itself, drawn as a crescent in front of the wielder.
 * @param {Player} player @param {string} element @param {"slash" | "smash"} how @param {number} [scale]
 */
export function swing(player, element, how, scale = 1.3) {
  if (how === "slash") slash(player.dimension, handOf(player, 1.3), element, scale);
  else ring(player.dimension, player.location, element, scale * 1.2);
  pose(player, how);
}

/** Every pose this file can play, for tests. */
export const POSE_NAMES = /** @type {Pose[]} */ (Object.keys(POSES));

/**
 * Plays one of each effect around a player, a little apart, so the visuals can be checked at a glance.
 * @param {Player} player
 */
export function showcase(player) {
  const elements = Object.keys(COLORS);
  const origin = { ...player.location };
  const dimension = player.dimension;
  elements.forEach((element, i) => {
    system.runTimeout(() => {
      if (!player.isValid) return;
      const angle = (i / elements.length) * Math.PI * 2;
      const spot = { x: origin.x + Math.cos(angle) * 6, y: origin.y, z: origin.z + Math.sin(angle) * 6 };
      circle(dimension, spot, element, 2.4);
      beam(dimension, up(origin, 1.4), up(spot, 1), element, 1.2);
      spark(dimension, up(spot, 1), element, 1.3);
      ring(dimension, spot, element, 2.5);
      rise(dimension, spot, element, 1.2);
      system.runTimeout(() => pillar(dimension, spot, element, 6, 1.2), 14);
      system.runTimeout(() => nova(dimension, up(spot, 1), element, 3), 28);
    }, i * 12);
  });
}
