// Overlord: Tomb of Nazarick - the engine of the deep dungeons (since 9.6).
//
// The Dwarven Royal Capital (deeps.js) and the Siege of the Great Wall (wall.js) are both built and run by
// this one engine; the Great Tomb (dungeon.js) is older and keeps its own. A dungeon is a stack of sealed
// halls far beneath the spot where it was first opened - from a marked stone at one kind of site, or with a
// key item. Arriving on a floor wakes its garrison; when the garrison has fallen its lord (or lords) come; when
// they fall, the gate at the far end opens and standing on it takes everyone on the floor down to the next.
// Traps are set into the floors and each hall holds treasure. Clearing the last floor ends the run with the
// dungeon's own reward and leads back up. Entering again later, with nobody inside, finds it restored. No
// two dungeons are ever built over one another, and none can be entered from inside another.
import { world, system, EntityDamageCause, GameMode } from "@minecraft/server";
import { giveItem, grantXp, notify, touch } from "./rpg.js";
import { Builder, campAt, stockChests } from "./structures.js";
import { tombOf, floorAt as tombFloorAt } from "./dungeon.js";
import * as fx from "./vfx.js";

const mc = (/** @type {string} */ name) => `minecraft:${name}`;
const TICKS = 20;
const MAX_FILL = 32000; // the game fills at most 32768 blocks at once
const EMPTY_FOR = 10 * 60 * TICKS; // a dungeon nobody has been in for ten minutes is restored for the next party
const COIN = "overlord:yggdrasil_gold_coin";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/**
 * @typedef {{
 *   key: string, name: string, sub: string, element: string, half: number, height: number,
 *   shell: string, floor: string, accent: string, light: string,
 *   wave: [string, number][], stages: string[][], trap: string, traps: [number, number][], loot: [string, number, number][],
 *   decorate: (b: Builder) => void,
 * }} Floor
 * @typedef {{ x: number, y: number, z: number, top: number }} Place
 * @typedef {{ status: "idle" | "wave" | "boss" | "cleared", stage: number, mobs: Entity[] }} FloorState
 * @typedef {{
 *   key: string, name: string, tag: string, colour: string, item: string, site: string, stone: { x: number, z: number },
 *   first: number, spacing: number, floors: Floor[], lords: Record<string, string>, lastSub: string,
 *   hint: string, wash: { red: number, green: number, blue: number },
 *   floorPay: { coins: number, xp: number, items: [string, number][] },
 *   reward: (player: Player) => string,
 * }} Config
 */

/**
 * The traps: the block that marks one, what shows when it is stepped on, what it does to whoever is still on it a
 * moment later, and what shows then.
 * @type {Record<string, { mark: string, warn?: (d: Dimension, at: Vector3) => void, hit: (p: Player) => void, after: (d: Dimension, at: Vector3) => void }>}
 */
export const TRAPS = {
  cave_in: {
    mark: mc("gravel"),
    warn: (d, at) => fx.fall(d, at, "none", 8, 0),
    hit(p) {
      p.applyDamage(6, { cause: EntityDamageCause.fallingBlock });
      p.addEffect("slowness", 2 * TICKS, { amplifier: 2 });
      p.addEffect("mining_fatigue", 4 * TICKS, { amplifier: 1 });
    },
    after(d, at) {
      fx.puff(d, "shard", { x: at.x, y: at.y + 0.4, z: at.z }, "none", 1.2);
      fx.shake(d, at, 6, 0.3, 0.3);
    },
  },
  rune: {
    mark: mc("chiseled_deepslate"),
    hit(p) {
      p.applyDamage(5, { cause: EntityDamageCause.magic });
      p.addEffect("levitation", 1 * TICKS, { amplifier: 2 });
    },
    after: (d, at) => fx.pillar(d, at, "lightning", 3, 0.8),
  },
  frost: {
    mark: mc("blue_ice"),
    hit(p) {
      p.applyDamage(4, { cause: EntityDamageCause.magic });
      p.addEffect("slowness", 3 * TICKS, { amplifier: 2 });
    },
    after: (d, at) => fx.nova(d, at, "ice", 1.6),
  },
  pitch: { // burning pitch poured from the wall
    mark: mc("blackstone"),
    hit(p) {
      p.applyDamage(4, { cause: EntityDamageCause.fire });
      p.setOnFire(4, true);
      p.addEffect("slowness", 2 * TICKS, { amplifier: 1 });
    },
    after: (d, at) => fx.pillar(d, at, "fire", 2, 0.7),
  },
  brimstone: { // a brand of hellfire that bursts from the ground
    mark: mc("crying_obsidian"),
    hit(p) {
      p.applyDamage(6, { cause: EntityDamageCause.fire });
      p.setOnFire(3, true);
      p.addEffect("weakness", 4 * TICKS, { amplifier: 0 });
    },
    after(d, at) {
      fx.pillar(d, at, "fire", 4, 1);
      fx.nova(d, at, "dark", 1.4);
    },
  },
};

/** Every dungeon run by this engine. @type {Dungeon[]} */
export const DUNGEONS = [];

/** Fills a large box a few layers at a time. */
function bigFill(/** @type {Builder} */ b, /** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ z0,
  /** @type {number} */ x1, /** @type {number} */ y1, /** @type {number} */ z1, /** @type {string} */ block) {
  const per = Math.max(1, Math.floor(MAX_FILL / ((x1 - x0 + 1) * (z1 - z0 + 1))));
  for (let y = y0; y <= y1; y += per) b.fill(x0, y, z0, x1, Math.min(y1, y + per - 1), z1, block);
}

/** @param {Entity} e */
function alive(e) {
  try {
    if (!e.isValid) return false;
    const health = e.getComponent("minecraft:health");
    return !health || health.currentValue > 0;
  } catch {
    return false;
  }
}

/** @param {Player[]} players @param {string} text @param {string} sub */
function title(players, text, sub) {
  for (const p of players) {
    try {
      p.onScreenDisplay.setTitle(text, { subtitle: sub, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
    } catch {
      // the player left
    }
  }
}

export class Dungeon {
  /** @param {Config} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    this.FLOORS = cfg.floors;
    /** @type {FloorState[]} */
    this.state = cfg.floors.map(() => ({ status: "idle", stage: 0, mobs: [] }));
    this.lastInside = 0;
    this.restore = false;
    /** @type {Map<string, number>} trap cooldowns: `${floor}|${x}|${z}` -> tick */
    this.traps = new Map();
    /** @type {Map<string, number>} players who just left, and cannot step straight back onto the stone */
    this.leftAt = new Map();
    this.save = `overlord:${cfg.key}`;
    this.ret = `overlord:${cfg.key}_return`;
    DUNGEONS.push(this);
  }

  // ---------------------------------------------------------------- where it is

  /** @returns {Place | undefined} */
  place() {
    try {
      const raw = world.getDynamicProperty(this.save);
      if (typeof raw !== "string") return undefined;
      const t = JSON.parse(raw);
      return typeof t.x === "number" && typeof t.top === "number" ? t : undefined;
    } catch {
      return undefined;
    }
  }

  /** The y of a floor's first air layer. @param {Place} at @param {number} index */
  floorY(at, index) {
    return at.top - index * this.cfg.spacing;
  }

  /** The floor a spot lies on, if any. @param {Place} at @param {Vector3} spot */
  floorAt(at, spot) {
    for (let i = 0; i < this.FLOORS.length; i++) {
      const f = this.FLOORS[i];
      if (Math.abs(spot.x - (at.x + 0.5)) > f.half + 1.5 || Math.abs(spot.z - (at.z + 0.5)) > f.half + 1.5) continue;
      const y = this.floorY(at, i);
      if (spot.y >= y - 1 && spot.y <= y + f.height + 1) return i;
    }
    return undefined;
  }

  /** Whether a spot lies inside this dungeon. @param {Vector3} spot */
  holds(spot) {
    const at = this.place();
    return !!at && this.floorAt(at, spot) !== undefined;
  }

  /** @param {Place} at @param {number} index */
  arrival(at, index) {
    return { x: at.x + 0.5, y: this.floorY(at, index), z: at.z + this.FLOORS[index].half - 2.5 };
  }

  /** @param {Place} at @param {number} index */
  exitPad(at, index) {
    return { x: at.x + 0.5, y: this.floorY(at, index), z: at.z - this.FLOORS[index].half + 3.5 };
  }

  /** @param {number} index */
  gateZ(index) {
    return -this.FLOORS[index].half + 5;
  }

  // ---------------------------------------------------------------- building

  /** @param {Dimension} dimension @param {Place} at @param {number} index */
  buildFloor(dimension, at, index) {
    const f = this.FLOORS[index];
    const H = f.half;
    const T = f.height;
    const b = new Builder(dimension, { x: at.x, y: this.floorY(at, index), z: at.z });
    bigFill(b, -H - 2, -2, -H - 2, H + 2, T + 2, H + 2, f.shell); // a shell that seals out caves, water and lava
    bigFill(b, -H, 0, -H, H, T, H, mc("air"));
    b.fill(-H, -1, -H, H, -1, H, f.floor);
    const step = Math.round(H * 0.7);
    for (const x of [-step, 0, step]) for (const z of [-step, 0, step]) b.set(x, T + 1, z, f.light);
    f.decorate(b);
    b.disc(0, -1, H - 3, 2, f.accent);
    for (const x of [-3, 3]) b.column(x, H - 2, 3, f.accent, f.light);
    const g = this.gateZ(index);
    b.fill(-4, 0, -H, 4, 5, g, f.shell);
    b.fill(-3, 0, -H + 1, 3, 4, g - 1, mc("air"));
    b.disc(0, -1, -H + 3, 2, f.accent);
    b.set(0, -1, -H + 3, f.floor);
    b.set(0, 4, -H + 2, f.light);
    b.fill(-1, 0, g, 1, 2, g, mc("iron_bars"));
    for (const [x, z] of f.traps) b.set(x, -1, z, TRAPS[f.trap].mark);
    b.chest(-H + 1, 0, 0, f.loot);
    b.chest(H - 1, 0, 0, f.loot);
    stockChests(dimension, b.chests);
  }

  /** @param {Dimension} dimension @param {Place} at */
  buildAll(dimension, at) {
    for (let i = 0; i < this.FLOORS.length; i++) this.buildFloor(dimension, at, i);
  }

  /** @param {Dimension} dimension @param {Place} at @param {number} index */
  openGate(dimension, at, index) {
    const b = new Builder(dimension, { x: at.x, y: this.floorY(at, index), z: at.z });
    const g = this.gateZ(index);
    b.fill(-1, 0, g, 1, 2, g, mc("air"));
    b.set(0, -1, -this.FLOORS[index].half + 3, mc("sea_lantern"));
    fx.pillar(dimension, this.exitPad(at, index), this.FLOORS[index].element, 5);
    fx.circle(dimension, this.exitPad(at, index), this.FLOORS[index].element, 2.2);
  }

  // ---------------------------------------------------------------- a run

  /** @param {Dimension} dimension @param {Place} at @param {number} index */
  playersOn(dimension, at, index) {
    const f = this.FLOORS[index];
    try {
      return dimension
        .getPlayers({ location: { x: at.x + 0.5, y: this.floorY(at, index) + f.height / 2, z: at.z + 0.5 }, maxDistance: f.half * 1.6 + 2 })
        .filter((p) => this.floorAt(at, p.location) === index);
    } catch {
      return [];
    }
  }

  /**
   * Where a new dungeon goes: under the player, unless that would cut into the Great Tomb or another dungeon.
   * @param {Player} player
   */
  siteFor(player) {
    let x = Math.floor(player.location.x);
    const z = Math.floor(player.location.z);
    /** @type {{ x: number, z: number }[]} */
    const taken = [];
    const tomb = tombOf();
    if (tomb) taken.push(tomb);
    for (const d of DUNGEONS) {
      const at = d !== this ? d.place() : undefined;
      if (at) taken.push(at);
    }
    for (let tries = 0; tries < 8; tries++) {
      const clash = taken.find((t) => Math.abs(x - t.x) < 60 && Math.abs(z - t.z) < 60);
      if (!clash) break;
      x = clash.x + (x >= clash.x ? 64 : -64);
    }
    const top = Math.max(Math.floor(player.location.y) - this.cfg.first, -63 + 2 + (this.FLOORS.length - 1) * this.cfg.spacing + 2);
    return { x, y: Math.floor(player.location.y), z, top };
  }

  /** Whether a player stands in the Great Tomb or another dungeon. @param {Player} player */
  elsewhere(player) {
    const tomb = tombOf();
    if (tomb && tombFloorAt(tomb, player.location) !== undefined) return true;
    return DUNGEONS.some((d) => d !== this && d.holds(player.location));
  }

  /** Takes a player (and whoever stands beside them) down, opening the dungeon the first time. @param {Player} player */
  enter(player) {
    const c = this.cfg;
    if (player.dimension.id !== "minecraft:overworld") return `§7${c.name} lies in the overworld`;
    if (this.elsewhere(player)) return "§7Leave the dungeon you are in first";
    let at = this.place();
    const anyone = at ? world.getAllPlayers().some((p) => p.dimension.id === "minecraft:overworld" && this.floorAt(/** @type {Place} */ (at), p.location) !== undefined) : false;
    if (!at) {
      at = this.siteFor(player);
      try {
        this.buildAll(player.dimension, at);
      } catch (error) {
        return `§7The way down will not open here: ${error}`;
      }
      world.setDynamicProperty(this.save, JSON.stringify(at));
      world.sendMessage(`${c.colour}[${c.name}] §f${player.name} has found the way into ${c.name}.`);
      this.resetRun();
    } else if (!anyone) {
      this.restore = true;
      this.resetRun();
    }
    const party = [player, ...player.dimension.getPlayers({ location: player.location, maxDistance: 6 }).filter((p) => p.id !== player.id)];
    for (const p of party) {
      try {
        if (this.floorAt(at, p.location) === undefined) p.setDynamicProperty(this.ret, JSON.stringify({ x: p.location.x, y: p.location.y, z: p.location.z + 3 }));
        p.teleport(this.arrival(at, 0), { facingLocation: this.exitPad(at, 0) });
        p.addEffect("resistance", 3 * TICKS, { amplifier: 4, showParticles: false });
        fx.wash(p, c.wash, 0.8);
      } catch {
        // that player could not be moved
      }
    }
    this.lastInside = system.currentTick;
    return `${c.colour}You descend into ${c.name}...`;
  }

  /** Takes a player back to where they came in. @param {Player} player */
  leave(player) {
    /** @type {Vector3 | undefined} */
    let back;
    try {
      const raw = player.getDynamicProperty(this.ret);
      if (typeof raw === "string") back = JSON.parse(raw);
    } catch {
      // no record
    }
    const at = this.place();
    back ??= at ? { x: at.x + 0.5, y: at.y + 1, z: at.z + 3.5 } : world.getDefaultSpawnLocation();
    try {
      player.teleport(back);
      player.addEffect("resistance", 3 * TICKS, { amplifier: 4, showParticles: false });
    } catch {
      return "§7You cannot leave just now";
    }
    this.leftAt.set(player.id, system.currentTick);
    return `${this.cfg.colour}You climb back up into the daylight.`;
  }

  resetRun() {
    for (const f of this.state) {
      f.status = "idle";
      f.stage = 0;
      f.mobs = [];
    }
    this.traps.clear();
  }

  /** @param {Dimension} dimension @param {Place} at @param {number} index @param {[string, number][]} group @param {number} radius */
  spawnGroup(dimension, at, index, group, radius) {
    /** @type {Entity[]} */
    const out = [];
    const total = group.reduce((n, [, c]) => n + c, 0);
    let slot = 0;
    for (const [type, count] of group) {
      for (let i = 0; i < count; i++, slot++) {
        const a = (slot / Math.max(1, total)) * Math.PI * 2;
        const spot = { x: at.x + 0.5 + Math.cos(a) * radius, y: this.floorY(at, index), z: at.z + 0.5 - 2 + Math.sin(a) * radius };
        try {
          const mob = dimension.spawnEntity(type, spot);
          mob.addTag(this.cfg.tag);
          mob.addTag(`${this.cfg.tag}_${index}`);
          fx.rise(dimension, spot, this.FLOORS[index].element, 0.8);
          out.push(mob);
        } catch {
          // no room
        }
      }
    }
    return out;
  }

  /** Moves a floor's run along. @param {Dimension} dimension @param {Place} at @param {number} index @param {Player[]} here */
  advance(dimension, at, index, here) {
    const state = this.state[index];
    const f = this.FLOORS[index];
    const c = this.cfg;
    if (state.status === "idle") {
      try {
        const gate = dimension.getBlock({ x: at.x, y: this.floorY(at, index), z: at.z + this.gateZ(index) });
        if (gate && gate.typeId === mc("air") && !this.restore) {
          state.status = "cleared";
          return;
        }
      } catch {
        return; // not loaded yet
      }
      /** @type {Entity[]} */
      let found = [];
      try {
        found = dimension.getEntities({ tags: [`${c.tag}_${index}`], location: { x: at.x, y: this.floorY(at, index), z: at.z }, maxDistance: 34 });
      } catch {
        // none
      }
      state.mobs = found.length > 0 ? found : this.spawnGroup(dimension, at, index, f.wave, 7);
      state.status = "wave";
      title(here, `${c.colour}${f.name}`, `§7${f.sub}`);
      return;
    }
    state.mobs = state.mobs.filter(alive);
    if (state.status === "wave" && state.mobs.length === 0) {
      state.status = "boss";
      state.stage = 0;
      this.summonStage(dimension, at, index, here);
      return;
    }
    if (state.status === "boss" && state.mobs.length === 0) {
      state.stage += 1;
      if (state.stage < f.stages.length) {
        this.summonStage(dimension, at, index, here);
        return;
      }
      state.status = "cleared";
      this.openGate(dimension, at, index);
      const last = index === this.FLOORS.length - 1;
      title(here, "§6Floor cleared", last ? "§eThe gate leads back to the surface" : "§eThe gate to the next floor is open");
      for (const p of here) {
        giveItem(p, COIN, c.floorPay.coins * (index + 1));
        for (const [item, n] of c.floorPay.items) giveItem(p, item, n);
        grantXp(p, c.floorPay.xp * (index + 1), f.name);
      }
    }
  }

  /** @param {Dimension} dimension @param {Place} at @param {number} index @param {Player[]} here */
  summonStage(dimension, at, index, here) {
    const f = this.FLOORS[index];
    const group = f.stages[this.state[index].stage];
    this.state[index].mobs = this.spawnGroup(dimension, at, index, group.map((type) => /** @type {[string, number]} */ ([type, 1])), group.length > 1 ? 3 : 0.01);
    const centre = { x: at.x + 0.5, y: this.floorY(at, index), z: at.z - 1.5 };
    fx.pillar(dimension, centre, f.element, 8);
    fx.nova(dimension, { x: centre.x, y: centre.y + 1, z: centre.z }, f.element, 5);
    fx.shake(dimension, centre, 30, 0.6, 0.6);
    const names = group.map((type) => this.cfg.lords[type] ?? type).join(" and ");
    title(here, `§c${names}`, index === this.FLOORS.length - 1 && this.state[index].stage === f.stages.length - 1 ? this.cfg.lastSub : "§7Lord of this floor");
  }

  /** @param {Dimension} dimension @param {Place} at @param {number} index @param {Player[]} here @param {number} now */
  springTraps(dimension, at, index, here, now) {
    const f = this.FLOORS[index];
    const trap = TRAPS[f.trap];
    if (!trap) return;
    for (const [x, z] of f.traps) {
      const spot = { x: at.x + x + 0.5, y: this.floorY(at, index), z: at.z + z + 0.5 };
      const key = `${index}|${x}|${z}`;
      if (now < (this.traps.get(key) ?? 0)) continue;
      if (!here.some((p) => Math.hypot(p.location.x - spot.x, p.location.z - spot.z) < 0.9)) continue;
      this.traps.set(key, now + 3 * TICKS);
      fx.flash(dimension, spot, f.element, 0.6);
      trap.warn?.(dimension, spot);
      system.runTimeout(() => {
        try {
          for (const p of dimension.getPlayers({ location: spot, maxDistance: 1.6 })) trap.hit(p);
          trap.after(dimension, spot);
        } catch {
          // the floor is unloading
        }
      }, 8);
    }
  }

  /** @param {Dimension} dimension @param {Place} at @param {number} index @param {Player[]} here */
  takeGate(dimension, at, index, here) {
    const pad = this.exitPad(at, index);
    if (!here.some((p) => Math.hypot(p.location.x - pad.x, p.location.z - pad.z) < 1.3)) return false;
    if (index === this.FLOORS.length - 1) {
      for (const p of here) this.conquer(p);
      return true;
    }
    for (const p of here) {
      try {
        p.teleport(this.arrival(at, index + 1), { facingLocation: this.exitPad(at, index + 1) });
        fx.wash(p, this.cfg.wash, 0.6);
      } catch {
        // that player could not be moved
      }
    }
    return true;
  }

  /** The dungeon's reward, and the way out. @param {Player} player */
  conquer(player) {
    const line = this.cfg.reward(player);
    touch(player);
    player.sendMessage(line);
    notify(player, this.leave(player));
    return line;
  }

  /** One look at the entrance stones and every floor with players on it. @param {number} now */
  tick(now) {
    const c = this.cfg;
    const at = this.place();
    for (const player of world.getAllPlayers()) {
      try {
        if (player.dimension.id !== "minecraft:overworld") continue;
        try {
          if (player.getGameMode() === GameMode.Spectator) continue;
        } catch {
          // assume a player
        }
        if (at && this.floorAt(at, player.location) !== undefined) continue;
        const camp = campAt(player.location);
        if (!camp || camp.type.key !== c.site) continue;
        const stone = { x: camp.x + c.stone.x + 0.5, y: camp.y, z: camp.z + c.stone.z + 0.5 };
        const off = Math.hypot(player.location.x - stone.x, player.location.z - stone.z);
        if (off < 0.9 && Math.abs(player.location.y - stone.y) < 1.5 && now - (this.leftAt.get(player.id) ?? -1e9) > 10 * TICKS) {
          notify(player, this.enter(player));
        } else if (off < 5 && now % (6 * TICKS) < 10) {
          notify(player, c.hint);
        }
      } catch {
        // the player is changing dimension
      }
    }
    if (!at) return;
    const dimension = world.getDimension("overworld");
    let inside = false;
    for (let i = 0; i < this.FLOORS.length; i++) {
      const here = this.playersOn(dimension, at, i);
      if (here.length === 0) continue;
      inside = true;
      if (this.restore && i === 0) {
        try {
          for (const old of dimension.getEntities({ tags: [c.tag], location: { x: at.x, y: this.floorY(at, 1), z: at.z }, maxDistance: 70 })) old.remove();
        } catch {
          // already gone
        }
        this.buildAll(dimension, at);
        this.restore = false;
      }
      try {
        this.advance(dimension, at, i, here);
        this.springTraps(dimension, at, i, here, now);
        if (this.state[i].status === "cleared") this.takeGate(dimension, at, i, here);
      } catch (error) {
        console.warn(`[Overlord] ${c.name} failed on floor ${i + 1}: ${error}`);
      }
    }
    if (inside) this.lastInside = now;
    else if (now - this.lastInside > EMPTY_FOR && this.lastInside > 0) {
      this.restore = true;
      this.resetRun();
      this.lastInside = 0;
    }
  }
}

system.runInterval(() => {
  for (const d of DUNGEONS) {
    try {
      d.tick(system.currentTick);
    } catch (error) {
      console.warn(`[Overlord] ${d.cfg.name} failed: ${error}`);
    }
  }
}, 10);

// A dungeon's key: outside, it opens the way down; inside, it leads back up.
world.afterEvents.itemUse.subscribe((event) => {
  try {
    const d = DUNGEONS.find((x) => x.cfg.item === event.itemStack?.typeId);
    if (!d) return;
    const player = event.source;
    notify(player, d.holds(player.location) ? d.leave(player) : d.enter(player));
  } catch (error) {
    console.warn(`[Overlord] a dungeon key failed: ${error}`);
  }
});
