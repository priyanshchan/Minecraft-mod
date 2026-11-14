#!/usr/bin/env python3
"""Draws every 3D armour set worn by a plain player model, front and back, without the game.

Each set's four pieces (tools/gen/armour3d.py) are put on one mannequin with the player's proportions and
rendered with the same renderer as the mob previews. One picture per set and a contact sheet are written.

Usage:  python3 tools/armour_view.py [out_dir]     (default: dist/armour)
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "gen"))

import armour3d  # noqa: E402
from modelkit import Model  # noqa: E402
from weapons3d import SKELETON  # noqa: E402

SKIN, SHIRT, PANTS = "#c4966e", "#3c8ca0", "#3c3c78"
BODY = {
    "head": ((-4, 24, -4), (8, 8, 8), SKIN),
    "body": ((-4, 12, -2), (8, 12, 4), SHIRT),
    "rightArm": ((-8, 12, -2), (4, 12, 4), SKIN),
    "leftArm": ((4, 12, -2), (4, 12, 4), SKIN),
    "rightLeg": ((-3.9, 0, -2), (4, 12, 4), PANTS),
    "leftLeg": ((-0.1, 0, -2), (4, 12, 4), PANTS),
}


def dressed(key, pieces):
    """One model: the mannequin with every piece of the set on it."""
    m = Model(f"view_{key}", bounds=(3, 3, 1))
    bones = {}
    for name, parent, pivot in SKELETON:
        bones[name] = m.bone(name, pivot, parent)
    for name, (origin, size, colour) in BODY.items():
        c = bones[name].cube(origin, size)
        c.fill(colour, noise=4)
        c.front.fill("#2a2a2a", 1, 3, 3, 4) if name == "head" else None
        if name == "head":
            c.front.fill("#2a2a2a", 5, 3, 7, 4)
    for piece in pieces.values():
        for b in piece.model.bones:
            if not b.cubes:
                continue
            nb = m.bone(f"{piece.piece}_{b.name}", b.pivot, b.parent)
            nb.cubes.extend(b.cubes)
    return m


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "armour"
    out.mkdir(parents=True, exist_ok=True)
    sets = armour3d.build_all()
    tiles = []
    for key, pieces in sets.items():
        m = dressed(key, pieces)
        front = m.render(-30, 12, 9, (330, 420))
        back = m.render(150, 12, 9, (330, 420))
        tile = Image.new("RGBA", (660, 440), (58, 62, 74, 255))
        tile.paste(front, (0, 20))
        tile.paste(back, (330, 20))
        ImageDraw.Draw(tile).text((8, 4), key.replace("_", " ").title(), fill=(240, 240, 240))
        tile.save(out / f"{key}.png")
        tiles.append(tile)
    cols = 3
    sheet = Image.new("RGBA", (660 * cols, 440 * ((len(tiles) + cols - 1) // cols)), (40, 42, 50, 255))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * 660, (i // cols) * 440))
    sheet.save(out / "sheet.png")
    print(f"{len(tiles)} sets drawn to {out}")


if __name__ == "__main__":
    main()
