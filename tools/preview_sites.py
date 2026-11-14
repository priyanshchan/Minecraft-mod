#!/usr/bin/env python3
"""Draws every site (camp, fort, village...) without the game.

The site builders in behavior_pack/scripts/structures.js are run against a mock world, and each
site is drawn as a small isometric picture plus a top-down text map.  It also reports anything
standing on a garrison post or reaching outside the cleared space.  Requires Node.js 18+ and Pillow.

Usage:  python3 tools/preview_sites.py [out_dir]     (default: dist/sites)
"""
from __future__ import annotations

import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SIM = ROOT / "tools" / "sim"

# Rough colours for the blocks sites are made of; anything else is drawn from its name.
COLOURS = {
    "grass_block": (106, 153, 72), "grass_path": (170, 140, 86), "coarse_dirt": (120, 88, 60), "dirt": (134, 96, 67),
    "podzol": (96, 70, 40), "gravel": (132, 127, 126), "sand": (219, 207, 163), "snow": (245, 250, 250),
    "packed_mud": (142, 106, 79), "mud": (60, 57, 60), "moss_block": (89, 109, 45), "netherrack": (110, 53, 51),
    "stone": (125, 125, 125), "cobblestone": (127, 127, 127), "mossy_cobblestone": (110, 125, 100),
    "stone_bricks": (122, 121, 122), "mossy_stone_bricks": (115, 121, 105), "cracked_stone_bricks": (118, 117, 118),
    "stone_brick_slab": (130, 130, 130), "smooth_stone": (160, 160, 160), "deepslate": (80, 80, 82),
    "deepslate_bricks": (70, 70, 72), "cobblestone_wall": (127, 127, 127), "stone_brick_wall": (122, 121, 122),
    "oak_planks": (162, 130, 78), "spruce_planks": (114, 84, 48), "dark_oak_planks": (66, 43, 20),
    "oak_log": (109, 85, 50), "spruce_log": (58, 37, 16), "dark_oak_log": (60, 46, 26), "mangrove_log": (84, 66, 41),
    "oak_fence": (150, 120, 72), "spruce_fence": (104, 76, 44), "acacia_fence": (168, 90, 50), "oak_leaves": (60, 110, 40),
    "oak_slab": (162, 130, 78), "spruce_slab": (114, 84, 48),
    "hay_block": (200, 170, 40), "barrel": (120, 90, 55), "chest": (190, 130, 40), "crafting_table": (130, 95, 60),
    "bookshelf": (150, 110, 70), "campfire": (230, 120, 30), "soul_campfire": (60, 200, 210), "lantern": (250, 210, 110),
    "soul_lantern": (90, 220, 230), "glowstone": (250, 220, 130), "sea_lantern": (200, 235, 230),
    "bone_block": (225, 220, 200), "iron_bars": (150, 150, 155), "glass_pane": (190, 225, 235),
    "white_wool": (235, 236, 237), "red_wool": (160, 39, 34), "blue_wool": (53, 57, 157), "green_wool": (84, 109, 27),
    "brown_wool": (114, 71, 40), "gray_wool": (62, 68, 71), "yellow_wool": (248, 197, 39), "orange_wool": (240, 118, 19),
    "purple_wool": (121, 42, 172), "lime_wool": (112, 185, 25), "black_wool": (20, 21, 25),
    "red_carpet": (160, 39, 34), "white_carpet": (235, 236, 237), "brown_carpet": (114, 71, 40), "moss_carpet": (89, 109, 45),
    "packed_ice": (141, 180, 250), "blue_ice": (116, 167, 253), "obsidian": (20, 18, 30), "crying_obsidian": (50, 10, 90),
    "blackstone": (42, 36, 41), "polished_blackstone": (53, 48, 56), "magma": (190, 90, 30), "nether_brick": (44, 21, 26),
    "gold_block": (246, 208, 61), "raw_gold_block": (221, 169, 46), "raw_iron_block": (166, 135, 107), "coal_block": (16, 15, 15),
    "emerald_block": (42, 203, 87), "lapis_block": (30, 67, 140), "amethyst_block": (133, 97, 191),
    "quartz_block": (235, 229, 222), "smooth_quartz": (235, 229, 222), "quartz_pillar": (235, 230, 224),
    "chiseled_quartz_block": (231, 226, 218), "yellow_stained_glass": (229, 229, 51),
    "furnace": (110, 110, 110), "blast_furnace": (80, 80, 85), "smoker": (95, 85, 75), "anvil": (68, 68, 68),
    "smithing_table": (57, 58, 70), "grindstone": (140, 140, 140), "cauldron": (72, 72, 72), "composter": (112, 70, 31),
    "bell": (253, 219, 91), "target": (226, 170, 158), "lectern": (173, 137, 83), "brewing_stand": (122, 100, 80), "web": (228, 233, 234),
    "overlord:nazarick_tiles": (52, 44, 66), "overlord:nazarick_bricks": (66, 56, 84), "overlord:gilded_nazarick_bricks": (150, 120, 60),
    "overlord:cracked_nazarick_bricks": (58, 50, 74), "overlord:nazarick_pillar": (78, 66, 100), "overlord:nazarick_lamp": (200, 160, 255),
    "overlord:data_crystal_block": (110, 220, 250),
}
THIN = ("fence", "wall", "bars", "pane", "lantern", "campfire", "carpet", "web", "bell", "brewing_stand", "lectern")


def colour(block):
    if block in COLOURS:
        return COLOURS[block]
    seed = sum(ord(ch) * (i + 7) for i, ch in enumerate(block))
    return (80 + seed % 120, 80 + (seed // 7) % 120, 80 + (seed // 49) % 120)


def shade(rgb, k):
    return tuple(max(0, min(255, int(v * k))) for v in rgb)


def draw_site(site, scale=10):
    """An isometric picture seen from the south-east, lit from above."""
    blocks = {(x, y, z): b for x, y, z, b in site["blocks"]}
    r = site["radius"] + 1
    top = max(y for _, y, _ in blocks) + 2
    w = int((4 * r + 4) * scale * 0.5 * 2)
    h = int((2 * r + 2) * scale * 0.5 * 2 + (top + 3) * scale)
    img = Image.new("RGB", (w, h), (24, 26, 32))
    d = ImageDraw.Draw(img)
    hx, hy = scale, scale * 0.5

    def project(x, y, z):
        return (w / 2 + (x - z) * hx, (top + 1) * scale + (x + z + 2 * r) * hy - y * scale)

    for (x, y, z) in sorted(blocks, key=lambda p: (p[1], p[0] + p[2], p[0])):
        block = blocks[(x, y, z)]
        base = colour(block)
        thin = any(word in block for word in THIN)
        slab = block.endswith("_slab") or block.endswith("carpet")
        height = 0.2 if block.endswith("carpet") else 0.5 if slab or block in ("campfire", "soul_campfire") else 1.0
        inset = 0.3 if thin and not block.endswith("carpet") else 0.0
        x0, x1, z0, z1 = x + inset, x + 1 - inset, z + inset, z + 1 - inset
        y0, y1 = y, y + height
        if (x, y + 1, z) not in blocks or thin or slab:
            d.polygon([project(x0, y1, z0), project(x1, y1, z0), project(x1, y1, z1), project(x0, y1, z1)], fill=shade(base, 1.08))
        if (x, y, z + 1) not in blocks or thin:
            d.polygon([project(x0, y1, z1), project(x1, y1, z1), project(x1, y0, z1), project(x0, y0, z1)], fill=shade(base, 0.82))
        if (x + 1, y, z) not in blocks or thin:
            d.polygon([project(x1, y1, z0), project(x1, y1, z1), project(x1, y0, z1), project(x1, y0, z0)], fill=shade(base, 0.64))
    d.text((8, 6), f"{site['name']}  ({2 * site['radius'] + 1} x {2 * site['radius'] + 1})", fill=(240, 240, 240))
    return img


def text_map(site):
    """Top-down: the first letter of the highest block in each column; '+' marks a garrison post."""
    r = site["radius"]
    tops = {}
    for x, y, z, b in site["blocks"]:
        if (x, z) not in tops or y > tops[(x, z)][0]:
            tops[(x, z)] = (y, b)
    posts = set(muster_posts(site))
    rows = []
    for z in range(-r, r + 1):
        row = ""
        for x in range(-r, r + 1):
            y, b = tops.get((x, z), (-9, " "))
            row += "+" if (x, z) in posts and y < 0 else "." if y < 0 else b.split(":")[-1][0].upper() if y > 1 else b.split(":")[-1][0]
        rows.append(row)
    return "\n".join(rows)


def muster_posts(site):
    """The eight blocks the garrison is posted on (see garrison() in structures.js)."""
    posts = []
    for slot in range(8):
        a = slot / 8 * math.pi * 2
        posts.append((math.floor(0.5 + math.cos(a) * site["muster"]), math.floor(0.5 + math.sin(a) * site["muster"])))
    return posts


def problems(key, site):
    found = []
    blocks = {(x, y, z): b for x, y, z, b in site["blocks"]}
    passable = ("carpet",)
    for (x, z) in muster_posts(site):
        for y in (0, 1):
            b = blocks.get((x, y, z))
            if b and not b.endswith(passable):
                found.append(f"{key}: {b} stands on the garrison post {x},{z} (y {y})")
    r = site["radius"]
    for (x, y, z), b in blocks.items():
        if abs(x) > r or abs(z) > r:
            found.append(f"{key}: {b} at {x},{y},{z} is outside the site")
        if y >= site["height"]:
            found.append(f"{key}: {b} at {x},{y},{z} is above the cleared space ({site['height']})")
    if not any(b == "chest" for b in blocks.values()):
        found.append(f"{key}: no chest")
    return found


def dump():
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        (work / "package.json").write_text('{"type":"module"}')
        for script in (ROOT / "behavior_pack" / "scripts").glob("*.js"):
            shutil.copy(script, work / script.name)
        shutil.copy(SIM / "sites_dump.js", work / "sites_dump.js")
        for module, source in (("server", "server.js"), ("server-ui", "server-ui.js")):
            target = work / "node_modules" / "@minecraft" / module
            target.mkdir(parents=True)
            shutil.copy(SIM / source, target / "index.js")
            (target / "package.json").write_text('{"name":"@minecraft/%s","type":"module","main":"index.js"}' % module)
        subprocess.check_call(["node", "sites_dump.js", "sites.json"], cwd=work, stdout=subprocess.DEVNULL)
        return json.loads((work / "sites.json").read_text())


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "sites"
    out.mkdir(parents=True, exist_ok=True)
    sites = dump()
    found = []
    pictures = []
    maps = []
    for key, site in sites.items():
        picture = draw_site(site)
        picture.save(out / f"{key}.png")
        pictures.append(picture)
        maps.append(f"== {site['name']} ({key}), {len(site['blocks'])} blocks\n{text_map(site)}\n")
        found += problems(key, site)
    (out / "maps.txt").write_text("\n".join(maps))
    # contact sheets of six
    for n in range(0, len(pictures), 6):
        group = pictures[n:n + 6]
        cw, ch = max(p.width for p in group), max(p.height for p in group)
        sheet = Image.new("RGB", (cw * 3, ch * ((len(group) + 2) // 3)), (24, 26, 32))
        for i, p in enumerate(group):
            sheet.paste(p, ((i % 3) * cw + (cw - p.width) // 2, (i // 3) * ch + (ch - p.height)))
        sheet.save(out / f"sheet_{n // 6 + 1}.png")
    for line in found:
        print("PROBLEM", line)
    print(f"{len(sites)} sites drawn to {out}; {len(found)} problems")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
