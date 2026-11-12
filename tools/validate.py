#!/usr/bin/env python3
"""Static validation of the add-on: every cross-reference must resolve.

Checks JSON syntax, manifests, icons, textures, geometry/UV bounds, animations,
render controllers, loot tables, recipes, spawn rules, sounds, language keys and
the identifiers used by the gameplay script.  Exits non-zero on any error.

Usage:  python3 tools/validate.py
"""
from __future__ import annotations

import json
import re
import sys
import uuid
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
NS = "overlord"

# Definitions shipped with the vanilla game that this add-on references.
VANILLA = {
    "geometry": {f"geometry.{kind}.armor.{p}" for kind in ("player", "humanoid")
                 for p in ("helmet", "chestplate", "leggings", "boots")},
    "animation": {f"animation.armor.{p}.offset" for p in ("helmet", "chestplate", "leggings", "boots")},
    "render_controller": {"controller.render.armor"},
    "material": {"entity_alphatest", "armor", "armor_enchanted"},
    "texture": {"textures/misc/enchanted_actor_glint"},
    "entity": {"minecraft:small_fireball", "minecraft:player", "minecraft:lightning_bolt",
               "minecraft:arrow", "minecraft:evocation_fang", "minecraft:zombie",
               "minecraft:villager_v2"},
    "block_geometry": {"minecraft:geometry.full_block"},
    "quest_target": {"minecraft:zombie", "minecraft:skeleton"},
    # verified against @minecraft/vanilla-data 1.26.60 (MinecraftBlockTypes)
    "script_block": {
        "air", "dirt", "coarse_dirt", "grass_block", "grass_path", "podzol", "sand", "red_sand", "stone", "gravel",
        "snow", "mycelium", "mud", "moss_block", "sandstone", "red_sandstone", "packed_mud", "hay_block",
        "oak_log", "oak_fence", "spruce_fence", "spruce_planks", "mangrove_log", "campfire", "soul_campfire",
        "chest", "barrel", "crafting_table", "target", "lantern", "bone_block", "stone_bricks",
        "cobblestone_wall", "white_wool", "blue_wool", "red_wool", "brown_wool", "green_wool", "black_wool",
    },
    "script_entity": {"minecraft:villager_v2", "minecraft:zombie", "minecraft:lightning_bolt"},
    # verified against @minecraft/vanilla-data 1.26.60
    "item": {
        "minecraft:iron_ingot", "minecraft:diamond", "minecraft:redstone", "minecraft:glass_bottle",
        "minecraft:bone", "minecraft:book", "minecraft:obsidian", "minecraft:stone_bricks",
        "minecraft:diamond_block", "minecraft:redstone_block", "minecraft:packed_ice", "minecraft:magma",
        "minecraft:iron_block", "minecraft:wheat_seeds", "minecraft:pumpkin_seeds",
        "minecraft:melon_seeds", "minecraft:beetroot_seeds", "minecraft:wheat", "minecraft:apple",
        "minecraft:carrot", "minecraft:golden_carrot", "minecraft:blaze_rod", "minecraft:grass_block",
        "minecraft:paper", "minecraft:stick", "minecraft:copper_ingot", "minecraft:feather",
        "minecraft:copper_block", "minecraft:gold_block", "minecraft:glowstone",
        "minecraft:gold_ingot", "minecraft:fermented_spider_eye", "minecraft:ender_pearl",
        "minecraft:oak_log", "minecraft:moss_block", "minecraft:golden_apple",
        "minecraft:gunpowder", "minecraft:clock", "minecraft:glistering_melon_slice",
        "minecraft:amethyst_shard", "minecraft:nether_wart", "minecraft:lapis_lazuli",
        "minecraft:bone_block", "minecraft:string", "minecraft:slime_ball", "minecraft:leather",
        "minecraft:rotten_flesh", "minecraft:emerald", "minecraft:stone", "minecraft:raw_iron",
        "minecraft:cod", "minecraft:bread", "minecraft:arrow", "minecraft:red_wool",
    },
    # verified against the vanilla sound_definitions.json (1.26.60)
    "sound": {
        "mob.wither.ambient", "mob.wither.death", "mob.wither.shoot", "mob.wither.hurt", "mob.wither.spawn",
        "mob.skeleton.hurt", "mob.skeleton.step", "mob.evocation_illager.cast_spell",
        "mob.evocation_illager.prepare_summon", "game.player.hurt", "game.player.die", "mob.zombie.step",
        "mob.spider.say", "mob.irongolem.hit", "mob.irongolem.death", "mob.irongolem.walk",
        "mob.blaze.shoot", "mob.husk.ambient", "mob.husk.hurt", "mob.husk.death", "mob.stray.ambient",
        "mob.stray.hurt", "mob.stray.death", "mob.stray.step", "mob.rabbit.idle", "mob.rabbit.hurt",
        "mob.rabbit.death", "mob.polarbear.step", "mob.ghast.fireball", "mob.endermen.portal",
        "random.explode", "random.orb", "mob.skeleton.say", "mob.skeleton.death", "mob.shulker.shoot",
        "ambient.weather.lightning.impact", "item.book.page_turn", "mob.bat.takeoff", "random.burp",
        "random.bow", "mob.evocation_illager.prepare_attack", "mob.villager.hit", "mob.villager.death",
        "mob.villager.haggle", "mob.villager.yes", "mob.villager.no", "mob.evocation_fangs.attack",
        "note.bell", "mob.irongolem.throw", "dig.grass", "random.fizz", "crossbow.shoot",
        "beacon.activate", "item.trident.riptide_1", "ambient.weather.thunder", "random.glass",
        "random.levelup", "mob.zombie.say", "mob.wither.shoot", "mob.ravager.ambient", "raid.horn",
        "mob.ravager.roar", "random.totem", "horn.call.0", "random.anvil_land",
    },
    # verified against the vanilla particle definitions
    "particle": {
        "minecraft:critical_hit_emitter", "minecraft:soul_particle", "minecraft:totem_particle",
        "minecraft:knockback_roar_particle", "minecraft:heart_particle", "minecraft:blue_flame_particle",
        "minecraft:electric_spark_particle", "minecraft:villager_happy", "minecraft:basic_flame_particle",
    },
    "effect": {"slowness", "slow_falling", "instant_health", "regeneration", "strength", "resistance",
               "wither", "night_vision", "saturation", "levitation", "invisibility", "speed",
               "fire_resistance", "poison", "weakness", "health_boost"},
}

errors: list[str] = []
checks = 0


def check(cond, message):
    global checks
    checks += 1
    if not cond:
        errors.append(message)
    return bool(cond)


def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"{path.relative_to(ROOT)}: invalid JSON ({exc})")
        return None


def walk(node, visit, path=()):
    if isinstance(node, dict):
        for k, v in node.items():
            visit(k, v, path)
            walk(v, visit, path + (k,))
    elif isinstance(node, list):
        for v in node:
            walk(v, visit, path)


def rel(p: Path):
    return str(p.relative_to(ROOT))


def png(texture_path: str):
    return RP / f"{texture_path}.png"


def main():
    # ------------------------------------------------------------- JSON + names
    for base in (BP, RP):
        for f in base.rglob("*"):
            if f.is_file():
                check(re.fullmatch(r"[a-z0-9_./\-]+|.*en_US\.lang", rel(f)) is not None,
                      f"{rel(f)}: file names must be lower-case without spaces")
            if f.suffix == ".json":
                load(f)

    # ---------------------------------------------------------------- manifests
    bpm, rpm = load(BP / "manifest.json"), load(RP / "manifest.json")
    uuids = []
    for name, m, kinds in (("behavior", bpm, {"data", "script"}), ("resource", rpm, {"resources"})):
        check(m["format_version"] == 2, f"{name} manifest: format_version must be 2")
        uuids.append(m["header"]["uuid"])
        check({mod["type"] for mod in m["modules"]} == kinds, f"{name} manifest: unexpected module types")
        for mod in m["modules"]:
            uuids.append(mod["uuid"])
        check(len(m["header"]["version"]) == 3 and len(m["header"]["min_engine_version"]) == 3,
              f"{name} manifest: bad version triple")
        check((BP if name == "behavior" else RP).joinpath("pack_icon.png").is_file(),
              f"{name} pack: pack_icon.png missing")
    for u in uuids:
        try:
            check(str(uuid.UUID(u)) == u, f"manifest uuid not canonical: {u}")
        except ValueError:
            check(False, f"manifest uuid invalid: {u}")
    check(len(set(uuids)) == len(uuids), "manifest uuids must all be unique")
    check(any(d.get("uuid") == rpm["header"]["uuid"] and d.get("version") == rpm["header"]["version"]
              for d in bpm["dependencies"]), "behavior pack must depend on the resource pack (uuid+version)")
    check(any(d.get("uuid") == bpm["header"]["uuid"] for d in rpm["dependencies"]),
          "resource pack must depend on the behavior pack")
    script_mod = next(mod for mod in bpm["modules"] if mod["type"] == "script")
    check((BP / script_mod["entry"]).is_file(), f"script entry missing: {script_mod['entry']}")
    check(any(d.get("module_name") == "@minecraft/server" for d in bpm["dependencies"]),
          "behavior pack must declare the @minecraft/server dependency")

    # --------------------------------------------------------------------- lang
    lang = {}
    for line in (RP / "texts/en_US.lang").read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("##"):
            continue
        key, _, value = line.partition("=")
        check(key not in lang, f"en_US.lang: duplicate key {key}")
        check(value.strip() != "", f"en_US.lang: empty value for {key}")
        lang[key] = value
    for base in (BP, RP):
        check(load(base / "texts/languages.json") == ["en_US"], f"{rel(base)}/texts/languages.json")

    # ------------------------------------------------------------ texture atlases
    item_tex = load(RP / "textures/item_texture.json")["texture_data"]
    terrain_tex = load(RP / "textures/terrain_texture.json")["texture_data"]
    used_textures = set()
    for atlas, data in (("item_texture", item_tex), ("terrain_texture", terrain_tex)):
        for key, entry in data.items():
            path = entry["textures"]
            used_textures.add(path)
            if check(png(path).is_file(), f"{atlas}.json: {key} -> missing file {path}.png"):
                img = Image.open(png(path))
                check(img.size == (16, 16), f"{path}.png: expected 16x16, got {img.size}")
                check(img.convert("RGBA").getbbox() is not None, f"{path}.png: image is fully transparent")

    # -------------------------------------------------------------------- items
    items, blocks, entities = set(), set(), {}
    for f in sorted((BP / "items").glob("*.json")):
        d = load(f)["minecraft:item"]
        ident = d["description"]["identifier"]
        check(ident == f"{NS}:{f.stem}", f"{rel(f)}: identifier {ident} does not match file name")
        check(ident not in items, f"duplicate item {ident}")
        items.add(ident)
        comps = d["components"]
        icon = comps.get("minecraft:icon", {}).get("textures", {}).get("default")
        check(icon in item_tex, f"{rel(f)}: icon '{icon}' is not defined in item_texture.json")
        name_key = comps.get("minecraft:display_name", {}).get("value")
        check(name_key in lang, f"{rel(f)}: display name key '{name_key}' missing from en_US.lang")
        for entry in comps.get("minecraft:repairable", {}).get("repair_items", []):
            for it in entry["items"]:
                check(it in items or it in VANILLA["item"] or (BP / f"items/{it.split(':')[1]}.json").is_file(),
                      f"{rel(f)}: unknown repair item {it}")
        convert = comps.get("minecraft:food", {}).get("using_converts_to")
        check(convert is None or convert in VANILLA["item"], f"{rel(f)}: unknown using_converts_to {convert}")
        if "minecraft:wearable" in comps:
            piece = f.stem.rsplit("_", 1)[1]
            for suffix in ("", ".player"):
                check((RP / f"attachables/{f.stem}{suffix}.json").is_file(),
                      f"{rel(f)}: wearable has no attachable {f.stem}{suffix}.json ({piece})")

    # ------------------------------------------------------------------- blocks
    blocks_json = load(RP / "blocks.json")
    for f in sorted((BP / "blocks").glob("*.json")):
        d = load(f)["minecraft:block"]
        ident = d["description"]["identifier"]
        check(ident == f"{NS}:{f.stem}", f"{rel(f)}: identifier does not match file name")
        blocks.add(ident)
        comps = d["components"]
        check(comps.get("minecraft:geometry") in VANILLA["block_geometry"], f"{rel(f)}: unknown geometry")
        for face, inst in comps.get("minecraft:material_instances", {}).items():
            check(inst["texture"] in terrain_tex, f"{rel(f)}: texture '{inst['texture']}' not in terrain_texture.json")
        check("minecraft:material_instances" in comps, f"{rel(f)}: missing material_instances")
        check(ident in blocks_json, f"{rel(f)}: no entry in blocks.json (sound)")
        check(f"tile.{ident}.name" in lang, f"{rel(f)}: tile.{ident}.name missing from en_US.lang")
    known_items = items | blocks | VANILLA["item"]

    # ----------------------------------------------------------- RP definitions
    geometries = {}
    for f in sorted((RP / "models").rglob("*.json")):
        for g in load(f)["minecraft:geometry"]:
            desc = g["description"]
            geometries[desc["identifier"]] = g
            tw, th = desc["texture_width"], desc["texture_height"]
            names = [b["name"] for b in g["bones"]]
            check(len(names) == len(set(names)), f"{rel(f)}: duplicate bone names")
            for b in g["bones"]:
                check(b.get("parent") is None or b["parent"] in names, f"{rel(f)}: bone {b['name']} has unknown parent")
                for c in b.get("cubes", []):
                    w, h, dep = c["size"]
                    u, v = c["uv"]
                    check(0 <= u and u + 2 * (w + dep) <= tw and 0 <= v and v + dep + h <= th,
                          f"{rel(f)}: cube UV of bone {b['name']} leaves the {tw}x{th} texture")
    animations = {}
    for f in sorted((RP / "animations").glob("*.json")):
        for name, anim in load(f)["animations"].items():
            animations[name] = anim
            for bone, channels in anim["bones"].items():
                for values in channels.values():
                    for v in values if isinstance(values, list) else [values]:
                        if isinstance(v, str):
                            check(v.count("(") == v.count(")"), f"{name}: unbalanced parentheses in '{v}'")
    render_controllers = set()
    for f in sorted((RP / "render_controllers").glob("*.json")):
        render_controllers |= set(load(f)["render_controllers"])

    client = {}
    for f in sorted((RP / "entity").glob("*.json")):
        d = load(f)["minecraft:client_entity"]["description"]
        ident = d["identifier"]
        check(ident not in client, f"duplicate client entity {ident}")
        client[ident] = d
        for mat in d["materials"].values():
            check(mat in VANILLA["material"], f"{rel(f)}: unknown material {mat}")
        geo = None
        for gid in d["geometry"].values():
            check(gid in geometries, f"{rel(f)}: geometry {gid} is not defined")
            geo = geometries.get(gid)
        check(set(d["textures"]) == set(d["geometry"]), f"{rel(f)}: texture and geometry keys differ")
        for key, tex in d["textures"].items():
            used_textures.add(tex)
            geo = geometries.get(d["geometry"].get(key, ""), geo)  # each skin is checked against its own model
            if check(png(tex).is_file(), f"{rel(f)}: missing texture {tex}.png") and geo:
                size = Image.open(png(tex)).size
                want = (geo["description"]["texture_width"], geo["description"]["texture_height"])
                check(size == want, f"{rel(f)}: texture is {size} but geometry expects {want}")
        for rc in d["render_controllers"]:
            check(rc in render_controllers, f"{rel(f)}: render controller {rc} is not defined")
        # an animated bone must exist in every model the entity can use
        bones = set.intersection(*[{b["name"] for b in geometries[g]["bones"]} for g in d["geometry"].values()
                                   if g in geometries]) if geo else set()
        for short in d["scripts"]["animate"]:
            check(short in d["animations"], f"{rel(f)}: animate entry '{short}' has no animation mapping")
        for short, anim_id in d["animations"].items():
            if check(anim_id in animations, f"{rel(f)}: animation {anim_id} is not defined"):
                for bone in animations[anim_id]["bones"]:
                    check(bone in bones, f"{rel(f)}: animation {anim_id} moves bone '{bone}' missing from the model")
        egg = d.get("spawn_egg")
        if egg:
            check(egg["texture"] in item_tex, f"{rel(f)}: spawn egg texture '{egg['texture']}' not in item_texture.json")

    # ----------------------------------------------------------------- entities
    for f in sorted((BP / "entities").glob("*.json")):
        d = load(f)["minecraft:entity"]
        ident = d["description"]["identifier"]
        check(ident == f"{NS}:{f.stem}", f"{rel(f)}: identifier does not match file name")
        entities[ident] = d
    known_entities = set(entities) | VANILLA["entity"]
    check(set(entities) == set(client), f"behavior/client entity mismatch: {set(entities) ^ set(client)}")
    for ident, d in entities.items():
        where = f"entities/{ident.split(':')[1]}.json"
        check(f"entity.{ident}.name" in lang, f"{where}: entity.{ident}.name missing from en_US.lang")
        if d["description"]["is_spawnable"]:
            check("spawn_egg" in client.get(ident, {}), f"{where}: spawnable entity has no spawn egg icon")
            check(f"item.spawn_egg.entity.{ident}.name" in lang, f"{where}: spawn egg name missing from en_US.lang")
        groups, events = d.get("component_groups", {}), d.get("events", {})

        def visit(key, value, path, where=where, groups=groups, events=events):
            if key == "table":
                check((BP / value).is_file(), f"{where}: loot table {value} does not exist")
            elif key == "event" and isinstance(value, str) and path and path[-1] != "events":
                check(value in events, f"{where}: event '{value}' is triggered but not defined")
            elif key == "component_groups" and isinstance(value, list):
                for g in value:
                    check(g in groups, f"{where}: component group '{g}' is not defined")
            elif key in ("def", "entity_type"):
                check(value in known_entities, f"{where}: unknown entity {value}")
            elif key in ("tame_items", "items") and isinstance(value, list):
                for it in value:
                    name = it["item"] if isinstance(it, dict) else it
                    check(name in known_items, f"{where}: unknown item {name}")

        walk(d, visit)

    # ------------------------------------------------------------- attachables
    for f in sorted((RP / "attachables").glob("*.json")):
        d = load(f)["minecraft:attachable"]["description"]
        item_ids = list(d.get("item", {d["identifier"]: ""}))
        for it in item_ids:
            check(it in items, f"{rel(f)}: attachable for unknown item {it}")
        for mat in d["materials"].values():
            check(mat in VANILLA["material"], f"{rel(f)}: unknown material {mat}")
        for tex in d["textures"].values():
            used_textures.add(tex)
            check(tex in VANILLA["texture"] or png(tex).is_file(), f"{rel(f)}: missing texture {tex}.png")
            if png(tex).is_file():
                check(Image.open(png(tex)).size == (64, 32), f"{rel(f)}: armour texture must be 64x32")
        for gid in d["geometry"].values():
            check(gid in VANILLA["geometry"], f"{rel(f)}: unknown geometry {gid}")
        for anim in d.get("animations", {}).values():
            check(anim in VANILLA["animation"], f"{rel(f)}: unknown animation {anim}")
        for rc in d["render_controllers"]:
            check(rc in VANILLA["render_controller"], f"{rel(f)}: unknown render controller {rc}")

    # ------------------------------------------------- recipes, loot, spawn rules
    recipe_ids = set()
    for f in sorted((BP / "recipes").glob("*.json")):
        d = load(f)
        body = d.get("minecraft:recipe_shaped") or d.get("minecraft:recipe_shapeless")
        if not check(body is not None, f"{rel(f)}: unknown recipe type"):
            continue
        rid = body["description"]["identifier"]
        check(rid not in recipe_ids, f"duplicate recipe {rid}")
        recipe_ids.add(rid)
        refs = [body["result"]["item"]] + [u["item"] for u in body.get("unlock", [])]
        if "pattern" in body:
            used = set("".join(body["pattern"])) - {" "}
            check(used == set(body["key"]), f"{rel(f)}: pattern symbols {used} do not match keys {set(body['key'])}")
            check(len({len(r) for r in body["pattern"]}) == 1, f"{rel(f)}: ragged pattern")
            refs += [v["item"] for v in body["key"].values()]
        else:
            refs += [i["item"] for i in body["ingredients"]]
        check("unlock" in body, f"{rel(f)}: missing unlock")
        for it in refs:
            check(it in known_items, f"{rel(f)}: unknown item {it}")
    for f in sorted((BP / "loot_tables").rglob("*.json")):
        for pool in load(f)["pools"]:
            for entry in pool["entries"]:
                check(entry["name"] in known_items, f"{rel(f)}: unknown item {entry['name']}")
    for f in sorted((BP / "trading").rglob("*.json")):
        for tier in load(f)["tiers"]:
            for group in tier["groups"]:
                check(0 < group["num_to_select"] <= len(group["trades"]), f"{rel(f)}: bad num_to_select")
                for trade in group["trades"]:
                    for side in trade["wants"] + trade["gives"]:
                        check(side["item"] in known_items, f"{rel(f)}: unknown item {side['item']}")
                        check(1 <= side["quantity"] <= 64, f"{rel(f)}: quantity out of range")
    for f in sorted((BP / "spawn_rules").glob("*.json")):
        ident = load(f)["minecraft:spawn_rules"]["description"]["identifier"]
        check(ident in entities and entities[ident]["description"]["is_spawnable"],
              f"{rel(f)}: spawn rule for unknown entity {ident}")

    # ------------------------------------------------------------------- sounds
    for ident, entry in load(RP / "sounds.json")["entity_sounds"]["entities"].items():
        check(ident in entities, f"sounds.json: unknown entity {ident}")
        for event, sound in entry["events"].items():
            check(sound in VANILLA["sound"], f"sounds.json: {ident}.{event} uses unknown sound {sound}")

    # ------------------------------------------------------------------- script
    script_dir = (BP / script_mod["entry"]).parent
    script_files = sorted(script_dir.glob("*.js"))
    script = "\n".join(f.read_text(encoding="utf-8") for f in script_files)
    declared_modules = {d["module_name"] for d in bpm["dependencies"] if "module_name" in d}
    for f in script_files:
        for module in re.findall(r'from "([^"]+)"', f.read_text(encoding="utf-8")):
            if module.startswith("."):
                check((f.parent / module).is_file(), f"{rel(f)}: import {module} does not exist")
            else:
                check(module in declared_modules, f"{rel(f)}: module {module} is not declared in the manifest")
    for target in re.findall(r'target: "(minecraft:[a-z_]+)"', script):
        check(target in VANILLA["quest_target"], f"scripts: unknown quest target {target}")
    for name in sorted(set(re.findall(r'\bid\("([a-z0-9_]+)"\)', script))):
        ident = f"{NS}:{name}"
        events = {e for d in entities.values() for e in d.get("events", {})}
        check(ident in items or ident in entities or ident in events or ident in blocks,
              f"scripts: unknown identifier {ident}")
    for name in sorted(set(re.findall(r'\bmc\("([a-z_]+)"\)', script))):
        check(name in VANILLA["script_block"] or f"minecraft:{name}" in VANILLA["item"],
              f"scripts: unverified vanilla block or item minecraft:{name}")
    for armor_set in re.findall(r'wearsFullSet\(gear, "([a-z_]+)"\)', script):
        for piece in ("helmet", "chestplate", "leggings", "boots"):
            check(f"{NS}:{armor_set}_{piece}" in items, f"main.js: unknown armour piece {armor_set}_{piece}")
    for ident in re.findall(r'const [A-Z]+ = "(minecraft:[a-z_0-9]+)";', script):
        check(ident in VANILLA["script_entity"] or ident in VANILLA["particle"], f"scripts: unknown vanilla id {ident}")
    for ident in re.findall(r'spawnEntity\("([^"]+)"', script):
        check(ident in known_entities, f"main.js: unknown entity {ident}")
    for sound in re.findall(r'playSound\([^,]+,\s*"([^"]+)"', script):
        check(sound in VANILLA["sound"], f"main.js: unknown sound {sound}")
    for p in re.findall(r'const [A-Z]+ = "(minecraft:[a-z_]+)";', script):
        check(p in VANILLA["particle"], f"scripts: unknown particle {p}")
    for sound in re.findall(r'"((?:random|mob|ambient|item|beacon)\.[a-z_.0-9]+)"', script):
        check(sound in VANILLA["sound"], f"scripts: unknown sound {sound}")
    for p in re.findall(r'particle\([^,]+,\s*"([^"]+)"', script):
        check(p in VANILLA["particle"], f"main.js: unknown particle {p}")
    for effect in re.findall(r'addEffect\("([^"]+)"', script):
        check(effect in VANILLA["effect"], f"main.js: unknown effect {effect}")
    for category in set(re.findall(r'"(overlord_[a-z]+)",\s*\d', script)) - {"overlord_sigil"}:
        declared = {load(f)["minecraft:item"]["components"].get("minecraft:cooldown", {}).get("category")
                    for f in (BP / "items").glob("*.json")}
        check(category in declared, f"main.js: cooldown category {category} is not declared by any item")

    # ------------------------------------------------- particles and player poses
    own_particles = set()
    for f in sorted((RP / "particles").glob("*.json")):
        d = load(f)["particle_effect"]
        ident = d["description"]["identifier"]
        check(ident == f"{NS}:{f.stem}", f"{rel(f)}: identifier does not match file name")
        own_particles.add(ident)
        params = d["description"]["basic_render_parameters"]
        check(params["material"] in {"particles_blend", "particles_alpha"}, f"{rel(f)}: unknown material")
        tex = params["texture"]
        used_textures.add(tex)
        if check(png(tex).is_file(), f"{rel(f)}: missing texture {tex}.png"):
            uv = d["components"]["minecraft:particle_appearance_billboard"]["uv"]
            size = Image.open(png(tex)).size
            check(size == (uv["texture_width"], uv["texture_height"]), f"{rel(f)}: texture is {size}, uv expects otherwise")
        text = json.dumps(d)
        check(text.count("(") == text.count(")"), f"{rel(f)}: unbalanced parentheses in an expression")
        for var in set(re.findall(r"variable\.([a-z_]+)", text)):
            check(var in {"color", "scale", "particle_age", "particle_lifetime"}, f"{rel(f)}: unexpected variable.{var}")
    for ident in set(re.findall(r'"(overlord:[a-z_]+)"', script)) & {f"{NS}:{p.stem}" for p in (RP / "particles").glob("*.json")} | \
            set(re.findall(r'emit\([^,]+, "([a-z_]+)"', script)):
        name = ident.split(":")[-1]
        check(f"{NS}:{name}" in own_particles, f"scripts: unknown particle {ident}")
    player_bones = {"head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"}
    for anim_id in set(re.findall(r'"(animation\.overlord\.[a-z_]+)"', script)):
        if check(anim_id in animations, f"scripts: animation {anim_id} is not defined"):
            anim = animations[anim_id]
            check(set(anim["bones"]) <= player_bones, f"{anim_id}: uses bones the player model does not have")
            for bone, channels in anim["bones"].items():
                for frames in channels.values():
                    times = [float(t) for t in frames]
                    check(times == sorted(times) and times[-1] <= anim["animation_length"] + 1e-6,
                          f"{anim_id}: keyframes of {bone} are out of order or past the end")

    # ---------------------------------------------------------- orphan textures
    for f in sorted((RP / "textures").rglob("*.png")):
        tex = str(f.relative_to(RP).with_suffix("")).replace("\\", "/")
        check(tex in used_textures, f"{rel(f)}: texture is never referenced")

    if errors:
        print(f"FAILED - {len(errors)} problem(s) in {checks} checks:")
        for e in errors:
            print("  -", e)
        return 1
    print(f"OK - {checks} checks passed "
          f"({len(items)} items, {len(blocks)} blocks, {len(entities)} entities, {len(recipe_ids)} recipes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
