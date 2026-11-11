#!/usr/bin/env python3
"""Regenerates every generated file of the add-on (JSON, textures, geometry).

Usage:  python3 tools/gen/generate.py
The script is deterministic: running it twice produces identical output.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import content  # noqa: E402
import icons  # noqa: E402
import models  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
BP_GENERATED = ["entities", "items", "blocks", "recipes", "loot_tables", "spawn_rules", "trading", "texts"]
RP_GENERATED = ["entity", "models", "animations", "render_controllers", "attachables", "textures", "texts"]


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def save_png(path: Path, img: Image.Image):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)


def pack_icon(ainz) -> Image.Image:
    size = 256
    icon = Image.new("RGBA", (size, size))
    for y in range(size):
        for x in range(size):
            d = ((x - size / 2) ** 2 + (y - size * 0.42) ** 2) ** 0.5 / (size * 0.75)
            t = min(1.0, d)
            icon.putpixel((x, y), (int(86 - 62 * t), int(40 - 30 * t), int(128 - 88 * t), 255))
    render = ainz.render(yaw=-22, pitch=8, scale=11, size=(520, 620), bg=(0, 0, 0, 0))
    box = render.getbbox()
    w = box[2] - box[0]
    crop = render.crop((box[0], box[1], box[2], box[1] + w))
    crop = crop.resize((216, 216), Image.NEAREST)
    icon.alpha_composite(crop, (20, 28))
    gold, dark = (217, 169, 43, 255), (150, 112, 26, 255)
    for i in range(10):
        c = gold if i < 6 else dark
        for k in range(size):
            for x, y in ((k, i), (k, size - 1 - i), (i, k), (size - 1 - i, k)):
                icon.putpixel((x, y), c)
    return icon


def main():
    for base, names in ((BP, BP_GENERATED), (RP, RP_GENERATED)):
        for n in names:
            shutil.rmtree(base / n, ignore_errors=True)

    bp_manifest, rp_manifest = content.manifests()
    write_json(BP / "manifest.json", bp_manifest)
    write_json(RP / "manifest.json", rp_manifest)

    # ---------------------------------------------------------- behavior pack
    for group in (content.item_files(), content.block_files(), content.recipe_files(),
                  content.loot_files(), content.entity_files(), content.spawn_rule_files(),
                  content.trade_files()):
        for rel, data in group.items():
            write_json(BP / rel, data)
    write_text(BP / "texts/en_US.lang", content.lang_bp())
    write_json(BP / "texts/languages.json", ["en_US"])

    # ---------------------------------------------------------- resource pack
    built = {}
    for fn in models.ALL:
        m = fn()
        m.pack()
        built[m.name] = m
        write_json(RP / f"models/entity/{m.name}.geo.json", m.geometry())
        save_png(RP / f"textures/entity/{content.NS}/{m.name}.png", m.texture)

    item_icons = icons.all_item_icons()
    for name, img in item_icons.items():
        save_png(RP / f"textures/items/{content.NS}/{name}.png", img)
    assert set(icons.BLOCK_TEXTURES) == set(content.terrain_textures())
    for name, draw in icons.BLOCK_TEXTURES.items():
        save_png(RP / f"textures/blocks/{content.NS}/{name}.png", draw())
    save_png(RP / f"textures/models/armor/{content.NS}_mask_of_envy.png", icons.mask_layer())
    layer1, layer2 = icons.armor_layers()
    save_png(RP / f"textures/models/armor/{content.NS}_dark_warrior_1.png", layer1)
    save_png(RP / f"textures/models/armor/{content.NS}_dark_warrior_2.png", layer2)
    layer1, layer2 = icons.champion_layers()
    save_png(RP / f"textures/models/armor/{content.NS}_world_champion_1.png", layer1)
    save_png(RP / f"textures/models/armor/{content.NS}_world_champion_2.png", layer2)

    write_json(RP / "textures/item_texture.json", content.item_texture_json(item_icons))
    write_json(RP / "textures/terrain_texture.json", content.terrain_texture_json())
    write_json(RP / "blocks.json", content.blocks_json())
    write_json(RP / "sounds.json", content.sounds_json())
    write_json(RP / "animations/overlord.animation.json", content.animations_json())
    write_json(RP / "render_controllers/overlord.render_controllers.json",
               content.render_controllers_json())
    for group in (content.client_entity_files(), content.attachable_files()):
        for rel, data in group.items():
            write_json(RP / rel, data)
    write_text(RP / "texts/en_US.lang", content.lang_rp())
    write_json(RP / "texts/languages.json", ["en_US"])

    icon = pack_icon(built["ainz"])
    save_png(BP / "pack_icon.png", icon)
    save_png(RP / "pack_icon.png", icon)
    print(f"generated {sum(1 for _ in BP.rglob('*') if _.is_file())} behavior-pack files, "
          f"{sum(1 for _ in RP.rglob('*') if _.is_file())} resource-pack files")


if __name__ == "__main__":
    main()
