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
writeFileSync(process.argv[2], JSON.stringify(out));
