// Builds every site on a flat test world and writes the blocks of each, relative to its centre, as JSON.
// Used by tools/preview_sites.py to draw the sites without the game.
import { writeFileSync } from "node:fs";
import * as sites from "./structures.js";

const out = {};
for (const type of sites.SITES) {
  const placed = new Map();
  const key = (l) => `${Math.floor(l.x)},${l.y},${Math.floor(l.z)}`;
  const land = {
    id: "minecraft:overworld",
    getTopmostBlock: (l) => ({ location: { x: l.x, y: 63, z: l.z } }),
    getBlock: (l) => ({ typeId: placed.get(key(l)) ?? (l.y <= 63 ? "minecraft:grass_block" : "minecraft:air"), isLiquid: false, location: l, getComponent: () => undefined }),
    setBlockType: (l, t) => placed.set(key(l), t),
    fillBlocks(v, t) {
      for (let x = Math.min(v.from.x, v.to.x); x <= Math.max(v.from.x, v.to.x); x++)
        for (let y = Math.min(v.from.y, v.to.y); y <= Math.max(v.from.y, v.to.y); y++)
          for (let z = Math.min(v.from.z, v.to.z); z <= Math.max(v.from.z, v.to.z); z++) placed.set(`${x},${y},${z}`, t);
    },
    getEntities: () => [],
    spawnEntity: () => ({ addTag() {} }),
  };
  const camp = sites.buildSite(land, { x: 0, z: 0, type });
  if (!camp) throw new Error(`${type.key} was not built`);
  const blocks = [];
  for (const [k, block] of placed) {
    const [x, y, z] = k.split(",").map(Number);
    if (block === "minecraft:air" || y - camp.y < -1) continue;
    blocks.push([x, y - camp.y, z, block.replace("minecraft:", "")]);
  }
  out[type.key] = { name: type.name, radius: type.radius, height: type.height ?? 12, muster: type.muster ?? sites.MUSTER, garrison: [0, 1, 2].map((tier) => type.garrison(tier)), blocks };
}
// The five floors of the Great Tomb, each relative to its own floor.
const tomb = await import("./dungeon.js");
tomb.FLOORS.forEach((floor, i) => {
  const placed = new Map();
  const key = (l) => `${Math.floor(l.x)},${l.y},${Math.floor(l.z)}`;
  const land = {
    id: "minecraft:overworld",
    getBlock: () => undefined,
    setBlockType: (l, t) => placed.set(key(l), t),
    fillBlocks(v, t) {
      for (let x = Math.min(v.from.x, v.to.x); x <= Math.max(v.from.x, v.to.x); x++)
        for (let y = Math.min(v.from.y, v.to.y); y <= Math.max(v.from.y, v.to.y); y++)
          for (let z = Math.min(v.from.z, v.to.z); z <= Math.max(v.from.z, v.to.z); z++) placed.set(`${x},${y},${z}`, t);
    },
  };
  const at = { x: 0, y: 64, z: 0, top: 64 };
  tomb.buildFloor(land, at, i);
  const base = tomb.floorY(at, i);
  const blocks = [];
  for (const [k, block] of placed) {
    const [x, y, z] = k.split(",").map(Number);
    // the roof and the near walls are left out so the hall can be seen
    if (block === "minecraft:air" || y - base < -1 || y - base > 8 || z > 16 || x > 16) continue;
    blocks.push([x, y - base, z, block.replace("minecraft:", "")]);
  }
  out[`tomb_${floor.key}`] = { name: `Tomb ${i + 1}: ${floor.name}`, radius: 18, height: 12, muster: 0, garrison: [], blocks, tomb: true };
});
// The four tiers of a Sorcerer Kingdom's capital (kingdom.js).
const kingdom = await import("./kingdom.js");
kingdom.TIERS.forEach((tier, i) => {
  const placed = new Map();
  const key = (l) => `${Math.floor(l.x)},${l.y},${Math.floor(l.z)}`;
  const land = {
    id: "minecraft:overworld",
    getBlock: () => undefined,
    setBlockType: (l, t) => placed.set(key(l), t),
    fillBlocks(v, t) {
      for (let x = Math.min(v.from.x, v.to.x); x <= Math.max(v.from.x, v.to.x); x++)
        for (let y = Math.min(v.from.y, v.to.y); y <= Math.max(v.from.y, v.to.y); y++)
          for (let z = Math.min(v.from.z, v.to.z); z <= Math.max(v.from.z, v.to.z); z++) placed.set(`${x},${y},${z}`, t);
    },
  };
  if (!kingdom.layCapital(land, { x: 0, y: 64, z: 0 }, i + 1)) throw new Error(`capital tier ${i + 1} was not laid`);
  const blocks = [];
  for (const [k, block] of placed) {
    const [x, y, z] = k.split(",").map(Number);
    if (block === "minecraft:air" || y - 64 < -1) continue;
    blocks.push([x, y - 64, z, block.replace("minecraft:", "")]);
  }
  out[`capital_${i + 1}`] = { name: `Capital ${i + 1}: ${tier.name}`, radius: tier.radius, height: tier.height, muster: 0, garrison: [], blocks, capital: true };
});
// A whole kingdom: the Sorcerous Capital with all eight districts at level 3 (districts.js).
{
  const districts = await import("./districts.js");
  const placed = new Map();
  const key = (l) => `${Math.floor(l.x)},${l.y},${Math.floor(l.z)}`;
  const land = {
    id: "minecraft:overworld",
    getBlock: () => undefined,
    setBlockType: (l, t) => placed.set(key(l), t),
    fillBlocks(v, t) {
      for (let x = Math.min(v.from.x, v.to.x); x <= Math.max(v.from.x, v.to.x); x++)
        for (let y = Math.min(v.from.y, v.to.y); y <= Math.max(v.from.y, v.to.y); y++)
          for (let z = Math.min(v.from.z, v.to.z); z <= Math.max(v.from.z, v.to.z); z++) placed.set(`${x},${y},${z}`, t);
    },
  };
  kingdom.layCapital(land, { x: 0, y: 64, z: 0 }, 4);
  const realm = { x: 0, y: 64, z: 0, tier: 4 };
  for (const b of Object.keys(districts.BUILDINGS)) if (!districts.layBuilding(land, realm, b, 3)) throw new Error(`${b} was not laid`);
  const blocks = [];
  for (const [k, block] of placed) {
    const [x, y, z] = k.split(",").map(Number);
    if (block === "minecraft:air" || y - 64 < -1) continue;
    blocks.push([x, y - 64, z, block.replace("minecraft:", "")]);
  }
  out.kingdom_full = { name: "The Sorcerer Kingdom: capital and districts", radius: 40, height: 22, muster: 0, garrison: [], blocks, capital: true };
}
writeFileSync(process.argv[2], JSON.stringify(out));
