#!/usr/bin/env python3
"""Draws every 3D weapon in the hand: one sheet in third person and one in first person.

Usage:  python3 tools/preview_weapons.py [out_dir]     (default: dist/weapons)
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "tools" / "gen"))

import weapon_view as wv  # noqa: E402
import weapons3d  # noqa: E402


def sheet(images, cols, cell):
    rows = (len(images) + cols - 1) // cols
    out = Image.new("RGB", (cols * cell[0], rows * cell[1]), (24, 26, 32))
    for i, (name, img) in enumerate(images):
        out.paste(img, ((i % cols) * cell[0], (i // cols) * cell[1]))
        ImageDraw.Draw(out).text(((i % cols) * cell[0] + 6, (i // cols) * cell[1] + 4), name, fill=(255, 255, 255))
    return out


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "weapons"
    out.mkdir(parents=True, exist_ok=True)
    weapons = weapons3d.build_all()
    third, first = [], []
    for key, w in weapons.items():
        (tp, fp) = weapons3d.HOLDS[w.kind]
        third.append((key, wv.third_person(w.model, {"weapon": tp}, size=(260, 300), yaw=-90, scale=5.5)))
        first.append((key, wv.first_person(w.model, {"weapon": fp}, size=(320, 200))))
    sheet(third, 8, (260, 300)).save(out / "third_person.png")
    sheet(first, 6, (320, 200)).save(out / "first_person.png")
    print(f"{len(weapons)} weapons drawn to {out}")


if __name__ == "__main__":
    main()
