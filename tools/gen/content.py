"""All JSON / text content of the Overlord add-on (behavior + resource pack)."""
from __future__ import annotations

NS = "overlord"
VERSION = [2, 4, 0]
MIN_ENGINE = [1, 21, 90]
UUID_BP = "e6440d11-49cb-4a78-994b-2621743284c3"
UUID_BP_DATA = "92b407c1-2afe-47be-96e5-2ca63d6e95e3"
UUID_BP_SCRIPT = "953c5275-23d2-4160-bd35-cc41791660c6"
UUID_RP = "c0efa9f1-85eb-41e8-a663-b693b3f36197"
UUID_RP_MOD = "6f472436-ea00-42b5-b73d-8ee5e218a303"

PACK_NAME = "Overlord: Tomb of Nazarick"
PACK_DESC = "Ainz Ooal Gown, the Floor Guardians, legendary weapons, spells, levels, classes and quests. §7v2.4.0"


def oid(name):
    return f"{NS}:{name}"


# =============================================================== manifests
def manifests():
    bp = {
        "format_version": 2,
        "header": {
            "name": PACK_NAME + " [BP]",
            "description": PACK_DESC,
            "uuid": UUID_BP,
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [
            {"type": "data", "uuid": UUID_BP_DATA, "version": VERSION},
            {"type": "script", "language": "javascript", "uuid": UUID_BP_SCRIPT,
             "entry": "scripts/main.js", "version": VERSION},
        ],
        "dependencies": [
            {"uuid": UUID_RP, "version": VERSION},
            {"module_name": "@minecraft/server", "version": "2.0.0"},
            {"module_name": "@minecraft/server-ui", "version": "2.0.0"},
        ],
        "metadata": {"authors": ["Overlord Add-on contributors"], "license": "MIT"},
    }
    rp = {
        "format_version": 2,
        "header": {
            "name": PACK_NAME + " [RP]",
            "description": PACK_DESC,
            "uuid": UUID_RP,
            "version": VERSION,
            "min_engine_version": MIN_ENGINE,
        },
        "modules": [{"type": "resources", "uuid": UUID_RP_MOD, "version": VERSION}],
        "dependencies": [{"uuid": UUID_BP, "version": VERSION}],
        "metadata": {"authors": ["Overlord Add-on contributors"], "license": "MIT"},
    }
    return bp, rp


# ================================================================== items
# id -> (display name, category, components)
def _weapon(damage, extra=None, rarity="epic"):
    c = {
        "minecraft:max_stack_size": 1,
        "minecraft:hand_equipped": True,
        "minecraft:damage": damage,
        "minecraft:can_destroy_in_creative": False,
        "minecraft:enchantable": {"slot": "sword", "value": 15},
        "minecraft:rarity": rarity,
    }
    c.update(extra or {})
    return c


def _armor(slot, protection, durability, ench):
    return {
        "minecraft:max_stack_size": 1,
        "minecraft:wearable": {"slot": slot, "protection": protection},
        "minecraft:durability": {"max_durability": durability},
        "minecraft:enchantable": {"slot": ench, "value": 15},
        "minecraft:repairable": {"repair_items": [
            {"items": [oid("adamantite_ingot")], "repair_amount": "query.max_durability * 0.25"}]},
        "minecraft:rarity": "rare",
    }


def _cooldown(category, seconds):
    return {"minecraft:cooldown": {"category": category, "duration": seconds}}


SIGILS = {
    "albedo": ("Albedo", "minecraft:obsidian"),
    "shalltear": ("Shalltear Bloodfallen", "minecraft:redstone_block"),
    "cocytus": ("Cocytus", "minecraft:packed_ice"),
    "demiurge": ("Demiurge", "minecraft:magma"),
    "sebas": ("Sebas Tian", "minecraft:iron_block"),
    "narberal": ("Narberal Gamma", "minecraft:copper_block"),
    "pandoras_actor": ("Pandora's Actor", "minecraft:gold_block"),
    "aura": ("Aura Bella Fiora", "minecraft:oak_log"),
    "mare": ("Mare Bello Fiore", "minecraft:moss_block"),
    "cz_delta": ("CZ2128 Delta", "minecraft:gunpowder"),
    "lupusregina": ("Lupusregina Beta", "minecraft:bone_block"),
    "entoma": ("Entoma Vasilissa Zeta", "minecraft:string"),
    "solution": ("Solution Epsilon", "minecraft:slime_ball"),
    "yuri": ("Yuri Alpha", "minecraft:iron_ingot"),
    "gargantua": ("Gargantua", "minecraft:stone"),
}

ITEMS = {
    "staff_of_ainz_ooal_gown": ("Staff of Ainz Ooal Gown", "equipment", _weapon(
        6, {**_cooldown("overlord_staff", 1.0), "minecraft:glint": True})),
    "ring_of_ainz_ooal_gown": ("Ring of Ainz Ooal Gown", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_ring", 3.0)}),
    "spuit_lance": ("Spuit Lance", "equipment", _weapon(10)),
    "ginnungagap": ("Ginnungagap", "equipment", _weapon(12, _cooldown("overlord_ginnungagap", 8.0))),
    "god_slaying_emperor_blade": ("God Slaying Emperor Blade", "equipment", _weapon(11)),
    "death_knight_sword": ("Death Knight Flamberge", "equipment", _weapon(8, {
        "minecraft:durability": {"max_durability": 1561},
        "minecraft:repairable": {"repair_items": [
            {"items": ["minecraft:iron_ingot"], "repair_amount": "query.max_durability * 0.25"}]},
    }, rarity="rare")),
    "tome_create_undead": ("Tome: Create Undead", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "rare", "minecraft:glint": True,
        **_cooldown("overlord_tome", 30.0)}),
    "red_potion": ("Minor Healing Potion", "items", {
        "minecraft:max_stack_size": 16,
        "minecraft:use_animation": "drink",
        "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35},
        "minecraft:food": {"can_always_eat": True, "nutrition": 0, "saturation_modifier": 0.0,
                           "using_converts_to": "minecraft:glass_bottle"},
        "minecraft:rarity": "uncommon",
    }),
    "data_crystal": ("Data Crystal", "items", {"minecraft:max_stack_size": 64}),
    "yggdrasil_gold_coin": ("YGGDRASIL Gold Coin", "items", {"minecraft:max_stack_size": 64}),
    "guardian_crest": ("Floor Guardian Crest", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "rare"}),
    "adamantite_ingot": ("Adamantite Ingot", "items", {"minecraft:max_stack_size": 64}),
    "dark_warrior_helmet": ("Dark Warrior Helmet", "equipment",
                            _armor("slot.armor.head", 3, 407, "armor_head")),
    "dark_warrior_chestplate": ("Dark Warrior Chestplate", "equipment",
                                _armor("slot.armor.chest", 8, 592, "armor_torso")),
    "dark_warrior_leggings": ("Dark Warrior Leggings", "equipment",
                              _armor("slot.armor.legs", 6, 555, "armor_legs")),
    "dark_warrior_boots": ("Dark Warrior Boots", "equipment",
                           _armor("slot.armor.feet", 3, 481, "armor_feet")),
    "dark_warrior_greatsword": ("Dark Warrior Greatsword", "equipment", _weapon(9, {
        "minecraft:durability": {"max_durability": 2031},
        "minecraft:repairable": {"repair_items": [
            {"items": [oid("adamantite_ingot")], "repair_amount": "query.max_durability * 0.25"}]},
    }, rarity="rare")),
    "mask_of_envy": ("Mask of Envy", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "uncommon",
        "minecraft:wearable": {"slot": "slot.armor.head", "protection": 1}}),
    "scroll_of_lightning": ("Scroll: Call Greater Thunder", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "uncommon",
        **_cooldown("overlord_scroll", 1.5)}),
    "scroll_of_fly": ("Scroll: Fly", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "uncommon",
        **_cooldown("overlord_scroll", 1.5)}),
    "ring_of_sustenance": ("Ring of Sustenance", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "rare", "minecraft:glint": True,
        **_cooldown("overlord_sustenance", 60.0)}),
    "razor_edge": ("Razor Edge", "equipment", _weapon(10)),
    "stiletto": ("Clementine's Stiletto", "equipment", _weapon(6, rarity="rare")),
    "shadow_of_yggdrasil": ("Shadow of Yggdrasil", "equipment", _weapon(
        5, {**_cooldown("overlord_yggdrasil", 6.0), "minecraft:glint": True})),
    "aura_whip": ("Beast Tamer's Whip", "equipment", _weapon(7, _cooldown("overlord_whip", 3.0),
                                                             rarity="rare")),
    "scroll_of_invisibility": ("Scroll: Invisibility", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "uncommon",
        **_cooldown("overlord_scroll", 1.5)}),
    "scroll_of_teleportation": ("Scroll: Greater Teleportation", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "uncommon",
        **_cooldown("overlord_scroll", 1.5)}),
    "maid_bell": ("Bell of Nazarick", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "uncommon"}),
    "world_champion_helmet": ("World Champion Helmet", "equipment",
                              _armor("slot.armor.head", 4, 610, "armor_head")),
    "world_champion_chestplate": ("World Champion Chestplate", "equipment",
                                  _armor("slot.armor.chest", 9, 888, "armor_torso")),
    "world_champion_leggings": ("World Champion Leggings", "equipment",
                                _armor("slot.armor.legs", 7, 832, "armor_legs")),
    "world_champion_boots": ("World Champion Boots", "equipment",
                             _armor("slot.armor.feet", 4, 721, "armor_feet")),
    **{f"scroll_of_{key}": (f"Scroll: {title}", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "uncommon",
        **_cooldown("overlord_scroll", 1.5)})
       for key, title in (("explosion", "Explosion"), ("time_stop", "Time Stop"),
                          ("heavy_recover", "Heavy Recover"))},
    "tome_reality_slash": ("Tome: Reality Slash", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_slash", 10.0)}),
    "tome_fallen_down": ("Tome: Fallen Down", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_fallen", 60.0)}),
    "frost_pain": ("Frost Pain", "equipment", _weapon(8, _cooldown("overlord_frost", 6.0))),
    "brain_katana": ("Brain's Katana", "equipment", _weapon(9, _cooldown("overlord_flash", 5.0),
                                                           rarity="rare")),
    "iron_gauntlets": ("Sebas's Iron Gauntlets", "equipment", _weapon(7, rarity="rare")),
    "magic_rifle": ("CZ's Magic Rifle", "equipment", _weapon(3, _cooldown("overlord_rifle", 0.6),
                                                            rarity="rare")),
    "adventurer_plate": ("Adventurer's Plate", "equipment", {"minecraft:max_stack_size": 1}),
    "grimoire": ("Grimoire", "equipment", {"minecraft:max_stack_size": 1, "minecraft:rarity": "rare"}),
    "magic_wand": ("Magic Wand", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:hand_equipped": True, "minecraft:rarity": "rare",
        "minecraft:can_destroy_in_creative": False}),
    "tome_crystal_lance": ("Tome: Crystal Lance", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "rare", "minecraft:glint": True,
        **_cooldown("overlord_lance", 1.5)}),
    "fluder_staff": ("Fluder's Staff", "equipment", _weapon(
        5, {**_cooldown("overlord_fluder", 4.0), "minecraft:glint": True})),
    "golem_fist": ("Gargantua's Fist", "equipment", _weapon(13, _cooldown("overlord_slam", 8.0))),
    "scroll_of_rebirth": ("Scroll: Rebirth", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "rare",
        **_cooldown("overlord_scroll", 1.5)}),
    "raid_horn": ("Horn of the Tomb Raid", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True}),
    "goblin_horn": ("Horn of the Goblin General", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "rare",
        **_cooldown("overlord_goblins", 120.0)}),
    "soul_fragment": ("Soul Fragment", "items", {"minecraft:max_stack_size": 64}),
    "regalia_helmet": ("Overlord's Regalia Hood", "equipment",
                       _armor("slot.armor.head", 2, 363, "armor_head")),
    "regalia_chestplate": ("Overlord's Regalia Robe", "equipment",
                           _armor("slot.armor.chest", 6, 528, "armor_torso")),
    "regalia_leggings": ("Overlord's Regalia Leggings", "equipment",
                         _armor("slot.armor.legs", 5, 495, "armor_legs")),
    "regalia_boots": ("Overlord's Regalia Boots", "equipment",
                      _armor("slot.armor.feet", 2, 429, "armor_feet")),
    "holy_staff": ("Lupusregina's Holy Staff", "equipment", _weapon(
        7, {**_cooldown("overlord_holy", 12.0), "minecraft:glint": True}, rarity="rare")),
    "blade_bug": ("Entoma's Blade Bug", "equipment", _weapon(8, rarity="rare")),
    "pleiades_emblem": ("Pleiades Emblem", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "rare"}),
    "shooting_star": ("Shooting Star", "items", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True}),
    "blue_potion": ("Mana Potion", "items", {
        "minecraft:max_stack_size": 16,
        "minecraft:use_animation": "drink",
        "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35},
        "minecraft:food": {"can_always_eat": True, "nutrition": 0, "saturation_modifier": 0.0,
                           "using_converts_to": "minecraft:glass_bottle"},
        "minecraft:rarity": "uncommon",
    }),
    "sigil_of_ainz": ("Sigil of Ainz Ooal Gown", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "epic", "minecraft:glint": True}),
}
for _piece in ("helmet", "chestplate", "leggings", "boots"):
    ITEMS[f"world_champion_{_piece}"][2]["minecraft:rarity"] = "epic"
    ITEMS[f"regalia_{_piece}"][2]["minecraft:repairable"] = {"repair_items": [
        {"items": [oid("soul_fragment")], "repair_amount": "query.max_durability * 0.25"}]}
for _who, (_name, _mat) in SIGILS.items():
    ITEMS[f"sigil_of_{_who}"] = (f"Sigil of {_name}", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "rare", "minecraft:glint": True})


def item_files():
    out = {}
    for name, (_display, category, comps) in ITEMS.items():
        out[f"items/{name}.json"] = {
            "format_version": "1.21.50",
            "minecraft:item": {
                "description": {"identifier": oid(name), "menu_category": {"category": category}},
                "components": {
                    "minecraft:icon": {"textures": {"default": f"{NS}_{name}"}},
                    "minecraft:display_name": {"value": f"item.{NS}.{name}.name"},
                    **comps,
                },
            },
        }
    return out


# ================================================================= blocks
BLOCKS = {
    "nazarick_bricks": ("Nazarick Bricks", "stone", {
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 2.0},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 30},
        "minecraft:map_color": "#3a3346",
    }),
    "data_crystal_block": ("Block of Data Crystal", "glass", {
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.5},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 12},
        "minecraft:map_color": "#43d6e8",
        "minecraft:light_emission": 10,
    }),
    "nazarick_tiles": ("Nazarick Tiles", "stone", {
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 2.0},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 30},
        "minecraft:map_color": "#2e2839",
    }),
    "nazarick_lamp": ("Nazarick Lamp", "glass", {
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.0},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 6},
        "minecraft:map_color": "#b99cff",
        "minecraft:light_emission": 15,
    }),
    "adamantite_block": ("Block of Adamantite", "metal", {
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 4.0},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 60},
        "minecraft:map_color": "#55618a",
    }),
    **{name: (title, sound, {
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 2.0},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 30},
        "minecraft:map_color": color})
       for name, title, sound, color in (
           ("gilded_nazarick_bricks", "Gilded Nazarick Bricks", "stone", "#d9a92b"),
           ("cracked_nazarick_bricks", "Cracked Nazarick Bricks", "stone", "#3a3346"),
           ("glacier_bricks", "Glacier Bricks", "glass", "#9fd4ef"))},
    "nazarick_pillar": ("Nazarick Pillar", "stone", {
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 2.0},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 30},
        "minecraft:map_color": "#3a3346",
    }),
}

# blocks whose faces differ: block -> {face: texture name}
BLOCK_FACES = {
    "nazarick_pillar": {"*": "nazarick_pillar_side", "up": "nazarick_pillar_top",
                        "down": "nazarick_pillar_top"},
}


def block_faces(name):
    return BLOCK_FACES.get(name, {"*": name})


def terrain_textures():
    return sorted({t for name in BLOCKS for t in block_faces(name).values()})


def block_files():
    """Custom blocks declare their own geometry + material (required since 1.21.80)."""
    out = {}
    for name, (_display, _sound, comps) in BLOCKS.items():
        out[f"blocks/{name}.json"] = {
            "format_version": "1.21.80",
            "minecraft:block": {
                "description": {"identifier": oid(name), "menu_category": {"category": "construction"}},
                "components": {
                    "minecraft:geometry": "minecraft:geometry.full_block",
                    "minecraft:material_instances": {
                        face: {"texture": f"{NS}_{tex}", "render_method": "opaque"}
                        for face, tex in block_faces(name).items()},
                    **comps,
                },
            },
        }
    return out


# ================================================================ recipes
def _shaped(name, pattern, key, result, count=1, unlock=None):
    r = {
        "format_version": "1.20.10",
        "minecraft:recipe_shaped": {
            "description": {"identifier": oid(name)},
            "tags": ["crafting_table"],
            "pattern": pattern,
            "key": {k: {"item": v} for k, v in key.items()},
            "unlock": [{"item": unlock or next(iter(key.values()))}],
            "result": {"item": result, "count": count},
        },
    }
    return r


def _shapeless(name, ingredients, result, count=1):
    return {
        "format_version": "1.20.10",
        "minecraft:recipe_shapeless": {
            "description": {"identifier": oid(name)},
            "tags": ["crafting_table"],
            "ingredients": [{"item": i} for i in ingredients],
            "unlock": [{"item": ingredients[-1]}],
            "result": {"item": result, "count": count},
        },
    }


def recipe_files():
    ing, cry = oid("adamantite_ingot"), oid("data_crystal")
    r = {
        "adamantite_ingot": _shapeless("adamantite_ingot", [
            "minecraft:iron_ingot", "minecraft:iron_ingot", "minecraft:diamond", cry], ing, 2),
        "dark_warrior_helmet": _shaped("dark_warrior_helmet", ["AAA", "A A"], {"A": ing},
                                       oid("dark_warrior_helmet")),
        "dark_warrior_chestplate": _shaped("dark_warrior_chestplate", ["A A", "AAA", "AAA"], {"A": ing},
                                           oid("dark_warrior_chestplate")),
        "dark_warrior_leggings": _shaped("dark_warrior_leggings", ["AAA", "A A", "A A"], {"A": ing},
                                         oid("dark_warrior_leggings")),
        "dark_warrior_boots": _shaped("dark_warrior_boots", ["A A", "A A"], {"A": ing},
                                      oid("dark_warrior_boots")),
        "red_potion": _shaped("red_potion", ["RCR", "BBB"], {
            "C": cry, "R": "minecraft:redstone", "B": "minecraft:glass_bottle"}, oid("red_potion"), 3),
        "tome_create_undead": _shaped("tome_create_undead", ["DCD", "CBC", "DCD"], {
            "C": cry, "D": "minecraft:bone", "B": "minecraft:book"}, oid("tome_create_undead")),
        "data_crystal_block": _shaped("data_crystal_block", ["CCC", "CCC", "CCC"], {"C": cry},
                                      oid("data_crystal_block")),
        "data_crystal_from_block": _shapeless("data_crystal_from_block", [oid("data_crystal_block")],
                                              cry, 9),
        "nazarick_bricks": _shaped("nazarick_bricks", ["SSS", "SOS", "SSS"], {
            "O": "minecraft:obsidian", "S": "minecraft:stone_bricks"}, oid("nazarick_bricks"), 8),
        "dark_warrior_greatsword": _shaped("dark_warrior_greatsword", ["A", "A", "S"], {
            "A": ing, "S": "minecraft:stick"}, oid("dark_warrior_greatsword")),
        "mask_of_envy": _shaped("mask_of_envy", ["BBB", "BCB"], {
            "B": "minecraft:bone", "C": cry}, oid("mask_of_envy"), unlock=cry),
        "scroll_of_lightning": _shapeless("scroll_of_lightning", [
            "minecraft:paper", "minecraft:copper_ingot", cry], oid("scroll_of_lightning"), 2),
        "scroll_of_fly": _shapeless("scroll_of_fly", [
            "minecraft:paper", "minecraft:feather", cry], oid("scroll_of_fly"), 2),
        "nazarick_tiles": _shaped("nazarick_tiles", ["SS", "SS"], {"S": oid("nazarick_bricks")},
                                  oid("nazarick_tiles"), 4),
        "nazarick_lamp": _shaped("nazarick_lamp", [" S ", "SGS", " S "], {
            "S": oid("nazarick_bricks"), "G": "minecraft:glowstone"}, oid("nazarick_lamp"), 2),
        "maid_bell": _shaped("maid_bell", [" G ", "GCG"], {
            "G": "minecraft:gold_ingot", "C": cry}, oid("maid_bell"), unlock=cry),
        "scroll_of_invisibility": _shapeless("scroll_of_invisibility", [
            "minecraft:paper", "minecraft:fermented_spider_eye", cry], oid("scroll_of_invisibility"), 2),
        "scroll_of_teleportation": _shapeless("scroll_of_teleportation", [
            "minecraft:paper", "minecraft:ender_pearl", cry], oid("scroll_of_teleportation"), 2),
        "adamantite_block": _shaped("adamantite_block", ["AAA", "AAA", "AAA"], {"A": ing},
                                    oid("adamantite_block")),
        "adamantite_ingot_from_block": _shapeless("adamantite_ingot_from_block",
                                                  [oid("adamantite_block")], ing, 9),
        "nazarick_pillar": _shaped("nazarick_pillar", ["S", "S"], {"S": oid("nazarick_bricks")},
                                   oid("nazarick_pillar"), 2),
        **{f"world_champion_{piece}": _shapeless(f"world_champion_{piece}", [
            oid(f"dark_warrior_{piece}"), "minecraft:diamond_block", oid("guardian_crest")],
            oid(f"world_champion_{piece}")) for piece in ("helmet", "chestplate", "leggings", "boots")},
        "scroll_of_explosion": _shapeless("scroll_of_explosion", [
            "minecraft:paper", "minecraft:gunpowder", cry], oid("scroll_of_explosion"), 2),
        "scroll_of_time_stop": _shapeless("scroll_of_time_stop", [
            "minecraft:paper", "minecraft:clock", cry], oid("scroll_of_time_stop"), 2),
        "scroll_of_heavy_recover": _shapeless("scroll_of_heavy_recover", [
            "minecraft:paper", "minecraft:glistering_melon_slice", cry], oid("scroll_of_heavy_recover"), 2),
        "tome_reality_slash": _shaped("tome_reality_slash", ["DCD", "CBC", "DCD"], {
            "C": cry, "D": "minecraft:amethyst_shard", "B": "minecraft:book"}, oid("tome_reality_slash")),
        "tome_fallen_down": _shaped("tome_fallen_down", ["DCD", "CBC", "DCD"], {
            "C": cry, "D": "minecraft:diamond_block", "B": "minecraft:book"}, oid("tome_fallen_down")),
        "regalia_helmet": _shaped("regalia_helmet", ["AAA", "A A"], {"A": oid("soul_fragment")},
                                  oid("regalia_helmet")),
        "regalia_chestplate": _shaped("regalia_chestplate", ["A A", "AAA", "AAA"],
                                      {"A": oid("soul_fragment")}, oid("regalia_chestplate")),
        "regalia_leggings": _shaped("regalia_leggings", ["AAA", "A A", "A A"], {"A": oid("soul_fragment")},
                                    oid("regalia_leggings")),
        "regalia_boots": _shaped("regalia_boots", ["A A", "A A"], {"A": oid("soul_fragment")},
                                 oid("regalia_boots")),
        "raid_horn": _shaped("raid_horn", ["BCB", "BGB", " B "], {
            "B": "minecraft:bone", "C": cry, "G": "minecraft:gold_ingot"}, oid("raid_horn"), unlock=cry),
        "goblin_horn": _shaped("goblin_horn", ["BEB", "BGB", " B "], {
            "B": "minecraft:bone", "E": "minecraft:emerald", "G": "minecraft:gold_ingot"},
            oid("goblin_horn"), unlock="minecraft:emerald"),
        "scroll_of_rebirth": _shapeless("scroll_of_rebirth", [
            "minecraft:paper", "minecraft:golden_apple", cry], oid("scroll_of_rebirth")),
        "gilded_nazarick_bricks": _shaped("gilded_nazarick_bricks", ["SS", "SG"], {
            "S": oid("nazarick_bricks"), "G": "minecraft:gold_ingot"}, oid("gilded_nazarick_bricks"), 3),
        "cracked_nazarick_bricks": _shapeless("cracked_nazarick_bricks", [
            "minecraft:gunpowder", oid("nazarick_bricks")], oid("cracked_nazarick_bricks")),
        "glacier_bricks": _shaped("glacier_bricks", ["II", "II"], {"I": "minecraft:packed_ice"},
                                  oid("glacier_bricks"), 4),
        "shooting_star": _shaped("shooting_star", ["EEE", "EGE", "EEE"], {
            "E": oid("pleiades_emblem"), "G": "minecraft:gold_block"}, oid("shooting_star")),
        "grimoire": _shapeless("grimoire", ["minecraft:book", cry], oid("grimoire")),
        "magic_wand": _shaped("magic_wand", ["C", "G", "S"], {
            "C": cry, "G": "minecraft:gold_ingot", "S": "minecraft:stick"}, oid("magic_wand")),
        "adventurer_plate": _shapeless("adventurer_plate", [
            "minecraft:paper", "minecraft:copper_ingot"], oid("adventurer_plate")),
        "blue_potion": _shaped("blue_potion", ["LCL", "BBB"], {
            "C": cry, "L": "minecraft:lapis_lazuli", "B": "minecraft:glass_bottle"}, oid("blue_potion"), 3),
        "sigil_of_ainz": _shaped("sigil_of_ainz", ["KCK", "CDC", "KCK"], {
            "K": oid("guardian_crest"), "C": cry, "D": "minecraft:diamond_block"}, oid("sigil_of_ainz")),
    }
    for who, (_n, mat) in SIGILS.items():
        r[f"sigil_of_{who}"] = _shaped(f"sigil_of_{who}", ["CXC", "XGX", "CXC"], {
            "C": cry, "X": mat, "G": oid("yggdrasil_gold_coin")}, oid(f"sigil_of_{who}"))
    return {f"recipes/{k}.json": v for k, v in r.items()}


VANILLA_ITEMS_USED = [
    "minecraft:iron_ingot", "minecraft:diamond", "minecraft:redstone", "minecraft:glass_bottle",
    "minecraft:bone", "minecraft:book", "minecraft:obsidian", "minecraft:stone_bricks",
    "minecraft:diamond_block", "minecraft:redstone_block", "minecraft:packed_ice", "minecraft:magma",
    "minecraft:iron_block", "minecraft:wheat_seeds", "minecraft:pumpkin_seeds", "minecraft:melon_seeds",
    "minecraft:beetroot_seeds", "minecraft:wheat", "minecraft:apple", "minecraft:carrot",
    "minecraft:golden_carrot", "minecraft:blaze_rod", "minecraft:paper", "minecraft:stick",
    "minecraft:copper_ingot", "minecraft:feather", "minecraft:copper_block", "minecraft:gold_block",
    "minecraft:glowstone", "minecraft:gold_ingot", "minecraft:fermented_spider_eye",
    "minecraft:ender_pearl", "minecraft:oak_log", "minecraft:moss_block", "minecraft:golden_apple",
    "minecraft:gunpowder", "minecraft:clock", "minecraft:glistering_melon_slice",
    "minecraft:amethyst_shard", "minecraft:nether_wart", "minecraft:lapis_lazuli",
    "minecraft:bone_block", "minecraft:string", "minecraft:slime_ball", "minecraft:leather",
    "minecraft:rotten_flesh", "minecraft:emerald", "minecraft:stone", "minecraft:raw_iron",
    "minecraft:cod",
]


# ============================================================ loot tables
def _entry(item, lo, hi, looting=True, weight=1):
    fn = [{"function": "set_count", "count": {"min": lo, "max": hi}}]
    if looting:
        fn.append({"function": "looting_enchant", "count": {"min": 0, "max": 1}})
    return {"type": "item", "name": item, "weight": weight, "functions": fn}


def _pool(*entries, conditions=None):
    p = {"rolls": 1, "entries": list(entries)}
    if conditions:
        p["conditions"] = conditions
    return p


def loot_files():
    cry, coin, crest = oid("data_crystal"), oid("yggdrasil_gold_coin"), oid("guardian_crest")
    one = lambda item: _pool(_entry(item, 1, 1, looting=False))
    t = {
        "death_knight": [
            _pool(_entry(cry, 0, 2)), _pool(_entry(coin, 1, 3)),
            _pool(_entry(oid("death_knight_sword"), 1, 1, looting=False), conditions=[
                {"condition": "killed_by_player"},
                {"condition": "random_chance_with_looting", "chance": 0.1, "looting_multiplier": 0.03}]),
        ],
        "elder_lich": [_pool(_entry(cry, 1, 2)), _pool(_entry(coin, 0, 2)),
                       _pool(_entry("minecraft:bone", 0, 2))],
        "albedo": [one(crest), one(oid("ginnungagap")), _pool(_entry(cry, 3, 6)), _pool(_entry(coin, 8, 16))],
        "shalltear": [one(crest), one(oid("spuit_lance")), _pool(_entry(cry, 3, 6)), _pool(_entry(coin, 8, 16))],
        "cocytus": [one(crest), one(oid("god_slaying_emperor_blade")), _pool(_entry(cry, 3, 6)),
                    _pool(_entry(coin, 8, 16))],
        "demiurge": [one(crest), _pool(_entry(cry, 4, 8)), _pool(_entry(coin, 12, 20)),
                     _pool(_entry("minecraft:blaze_rod", 2, 5))],
        "sebas": [one(crest), _pool(_entry(cry, 4, 8)), _pool(_entry(coin, 12, 20)),
                  _pool(_entry(oid("red_potion"), 2, 4, looting=False)), one(oid("iron_gauntlets"))],
        "ainz": [one(oid("staff_of_ainz_ooal_gown")), one(oid("ring_of_ainz_ooal_gown")),
                 _pool(_entry(cry, 8, 12)), _pool(_entry(coin, 24, 32)),
                 _pool(_entry(oid("tome_create_undead"), 1, 1, looting=False))],
        "narberal": [_pool(_entry(oid("pleiades_emblem"), 1, 2, looting=False)),
                     _pool(_entry(oid("scroll_of_lightning"), 2, 4, looting=False)),
                     _pool(_entry(cry, 3, 5)), _pool(_entry(coin, 6, 12))],
        "pandoras_actor": [one(crest), one(oid("ring_of_sustenance")), _pool(_entry(cry, 4, 8)),
                           _pool(_entry(coin, 32, 48))],
        "old_guarder": [
            _pool(_entry("minecraft:bone", 0, 2)), _pool(_entry(coin, 0, 1)),
            _pool(_entry(cry, 1, 1, looting=False), conditions=[
                {"condition": "killed_by_player"},
                {"condition": "random_chance_with_looting", "chance": 0.25, "looting_multiplier": 0.05}]),
        ],
        "aura": [one(crest), one(oid("aura_whip")), _pool(_entry(cry, 3, 6)), _pool(_entry(coin, 8, 16))],
        "mare": [one(crest), one(oid("shadow_of_yggdrasil")), _pool(_entry(cry, 3, 6)),
                 _pool(_entry(coin, 8, 16))],
        "gazef": [one(oid("razor_edge")), _pool(_entry("minecraft:iron_ingot", 2, 5)),
                  _pool(_entry("minecraft:gold_ingot", 1, 3))],
        "clementine": [one(oid("stiletto")), _pool(_entry(coin, 4, 8)), _pool(_entry(cry, 1, 3))],
        "brain": [one(oid("brain_katana")), _pool(_entry(coin, 4, 8))],
        "zaryusu": [one(oid("frost_pain")), _pool(_entry(cry, 1, 3))],
        "cz_delta": [_pool(_entry(oid("pleiades_emblem"), 1, 2, looting=False)), one(oid("magic_rifle")), _pool(_entry(cry, 3, 5)), _pool(_entry(coin, 6, 12))],
        "lupusregina": [_pool(_entry(oid("pleiades_emblem"), 1, 2, looting=False)), one(oid("holy_staff")),
                        _pool(_entry(cry, 3, 5)), _pool(_entry(coin, 6, 12))],
        "entoma": [_pool(_entry(oid("pleiades_emblem"), 1, 2, looting=False)), one(oid("blade_bug")),
                   _pool(_entry(cry, 3, 5)), _pool(_entry("minecraft:string", 2, 6))],
        "solution": [_pool(_entry(oid("pleiades_emblem"), 1, 2, looting=False)), _pool(_entry(cry, 3, 5)),
                     _pool(_entry("minecraft:slime_ball", 3, 8)), _pool(_entry(coin, 6, 12))],
        "yuri": [_pool(_entry(oid("pleiades_emblem"), 1, 2, looting=False)), _pool(_entry(cry, 3, 5)),
                 _pool(_entry(coin, 8, 14))],
        "skeleton_mage": [_pool(_entry("minecraft:bone", 0, 2)), _pool(_entry(coin, 0, 2)),
                          _pool(_entry(oid("soul_fragment"), 0, 1))],
        "lizardman": [_pool(_entry(coin, 0, 2)), _pool(_entry("minecraft:cod", 0, 2))],
        "evileye": [one(oid("tome_crystal_lance")), _pool(_entry(cry, 2, 5)), _pool(_entry(coin, 6, 12))],
        "fluder": [one(oid("fluder_staff")), _pool(_entry(cry, 2, 5)), _pool(_entry(coin, 6, 12))],
        "gargantua": [one(oid("golem_fist")), one(crest), _pool(_entry(cry, 6, 10)),
                      _pool(_entry(coin, 24, 40)), _pool(_entry(oid("adamantite_ingot"), 4, 8))],
        "soul_eater": [_pool(_entry(oid("soul_fragment"), 1, 3)), _pool(_entry(coin, 1, 3))],
        "quagoa": [_pool(_entry("minecraft:raw_iron", 0, 2)), _pool(_entry(coin, 0, 2))],
        "goblin": [_pool(_entry(coin, 0, 1)), _pool(_entry("minecraft:rotten_flesh", 0, 1))],
        "ogre": [_pool(_entry(coin, 1, 3)), _pool(_entry("minecraft:leather", 0, 2))],
        "empty": [],
    }
    return {f"loot_tables/entities/{NS}/{k}.json": {"pools": v} for k, v in t.items()}


def loot_path(name):
    return f"loot_tables/entities/{NS}/{name}.json"


# =============================================================== entities
def _is_family(value, subject="other"):
    return {"test": "is_family", "subject": subject, "value": value}


def _mob(name, families, health, speed, box, loot=None, xp=10, scale=None, kb=None, follow=32,
         fire_immune=False, persistent=False, undead=False):
    c = {
        "minecraft:is_hidden_when_invisible": {},
        "minecraft:type_family": {"family": families},
        "minecraft:collision_box": {"width": box[0], "height": box[1]},
        "minecraft:health": {"value": health, "max": health},
        "minecraft:movement": {"value": speed},
        "minecraft:follow_range": {"value": follow, "max": follow},
        "minecraft:experience_reward": {"on_death": f"query.last_hit_by_player ? {xp} : 0"},
        "minecraft:nameable": {},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True,
                                      "can_pass_doors": True, "can_open_doors": True},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": undead},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8.0, "probability": 0.02},
        "minecraft:behavior.random_look_around": {"priority": 8},
    }
    if loot:
        c["minecraft:loot"] = {"table": loot_path(loot)}
    if scale:
        c["minecraft:scale"] = {"value": scale}
    if kb is not None:
        c["minecraft:knockback_resistance"] = {"value": kb}
    if fire_immune:
        c["minecraft:fire_immune"] = {}
    if persistent:
        c["minecraft:persistent"] = {}
    else:
        c["minecraft:despawn"] = {"despawn_from_distance": {}}
    return c


def _target_players(dist=32, extra=()):
    types = [{"filters": _is_family("player"), "max_dist": dist}]
    for fam in extra:
        types.append({"filters": _is_family(fam), "max_dist": dist})
    return {"priority": 2, "must_see": True, "reselect_targets": True, "entity_types": types}


def _entity(name, components, groups=None, events=None, spawnable=True):
    e = {
        "format_version": "1.21.0",
        "minecraft:entity": {
            "description": {"identifier": oid(name), "is_spawnable": spawnable, "is_summonable": True,
                            "is_experimental": False},
            "component_groups": groups or {},
            "components": components,
            "events": events or {},
        },
    }
    return e


def _no_fall():
    return {"triggers": [{"cause": "fall", "deals_damage": False}]}


def _expire_parts():
    """Shared self-removal pieces (timer -> instant_despawn)."""
    groups = {"overlord:despawn": {"minecraft:instant_despawn": {}}}
    events = {"overlord:expire": {"add": {"component_groups": ["overlord:despawn"]}}}
    return groups, events


def entity_files():
    out = {}
    ally = "nazarick_ally"

    # ------------------------------------------------------------ Ainz
    c = _mob("ainz", ["ainz", "nazarick", "undead", "skeleton", "monster", "mob"], 500, 0.26, (0.8, 2.2),
             loot="ainz", xp=500, scale=1.15, kb=1.0, follow=48, fire_immune=True, persistent=True,
             undead=True)
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": True}
    c["minecraft:damage_sensor"] = _no_fall()
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(48, [ally])
    c["minecraft:behavior.summon_entity"] = {
        "priority": 2,
        "summon_choices": [{
            "weight": 1, "cooldown_time": 30.0, "cast_duration": 2.0, "particle_color": "#FF7B1FA2",
            "start_sound_event": "cast.spell",
            "sequence": [{
                "shape": "circle", "target": "self", "base_delay": 1.5, "num_entities_spawned": 2,
                "entity_type": oid("death_knight"), "summon_cap": 3, "summon_cap_radius": 24.0,
                "size": 2.5, "sound_event": "prepare.summon"}],
        }],
    }
    groups = {
        "overlord:mode_switcher": {"minecraft:target_nearby_sensor": {
            "inside_range": 3.5, "outside_range": 5.0, "must_see": True,
            "on_inside_range": {"event": "overlord:switch_to_melee", "target": "self"},
            "on_outside_range": {"event": "overlord:switch_to_ranged", "target": "self"}}},
        "overlord:ranged_mode": {
            "minecraft:shooter": {"def": oid("negative_burst")},
            "minecraft:behavior.ranged_attack": {
                "priority": 3, "attack_interval_min": 1.5, "attack_interval_max": 3.0,
                "attack_radius": 28.0, "speed_multiplier": 1.0}},
        "overlord:melee_mode": {
            "minecraft:attack": {"damage": 14, "effect_name": "wither", "effect_duration": 6},
            "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.2,
                                                    "track_target": True}},
    }
    events = {
        "minecraft:entity_spawned": {"add": {"component_groups": ["overlord:mode_switcher",
                                                                   "overlord:ranged_mode"]}},
        "overlord:switch_to_melee": {"remove": {"component_groups": ["overlord:ranged_mode"]},
                                     "add": {"component_groups": ["overlord:melee_mode"]}},
        "overlord:switch_to_ranged": {"remove": {"component_groups": ["overlord:melee_mode"]},
                                      "add": {"component_groups": ["overlord:ranged_mode"]}},
    }
    out["ainz"] = _entity("ainz", c, groups, events)

    # ------------------------------------------------------ melee guardians
    def guardian(name, health, speed, damage, box, scale=None, kb=0.6, attack_extra=None,
                 fire_immune=False, neutral=False, sensor=None, xp=150, extra_family=()):
        c = _mob(name, [name, "nazarick", *extra_family, "monster", "mob"], health, speed, box,
                 loot=name, xp=xp, scale=scale, kb=kb, follow=40, fire_immune=fire_immune,
                 persistent=True)
        c["minecraft:attack"] = {"damage": damage, **(attack_extra or {})}
        c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.25,
                                                    "track_target": True}
        triggers = [{"cause": "fall", "deals_damage": False}]
        if sensor:
            triggers.append(sensor)
        c["minecraft:damage_sensor"] = {"triggers": triggers}
        if not neutral:
            c["minecraft:behavior.nearest_attackable_target"] = _target_players(40, [ally])
        return c

    out["albedo"] = _entity("albedo", guardian(
        "albedo", 320, 0.3, 14, (0.7, 2.0), kb=1.0,
        sensor={"cause": "all", "damage_multiplier": 0.6}))
    out["shalltear"] = _entity("shalltear", guardian(
        "shalltear", 300, 0.36, 12, (0.7, 2.0), scale=0.9, kb=0.5, extra_family=("undead",)))
    out["cocytus"] = _entity("cocytus", guardian(
        "cocytus", 360, 0.28, 13, (0.9, 2.1), scale=1.25, kb=0.9,
        attack_extra={"effect_name": "slowness", "effect_duration": 5}))
    out["sebas"] = _entity("sebas", guardian("sebas", 260, 0.34, 12, (0.7, 2.0), kb=0.7, neutral=True))

    # --------------------------------------------------------- Demiurge
    c = guardian("demiurge", 280, 0.3, 10, (0.7, 2.0), kb=0.6, fire_immune=True)
    del c["minecraft:attack"], c["minecraft:behavior.melee_box_attack"]
    groups = {
        "overlord:mode_switcher": {"minecraft:target_nearby_sensor": {
            "inside_range": 3.0, "outside_range": 4.5, "must_see": True,
            "on_inside_range": {"event": "overlord:switch_to_melee", "target": "self"},
            "on_outside_range": {"event": "overlord:switch_to_ranged", "target": "self"}}},
        "overlord:ranged_mode": {
            "minecraft:shooter": {"def": "minecraft:small_fireball"},
            "minecraft:behavior.ranged_attack": {
                "priority": 3, "burst_shots": 3, "burst_interval": 0.3, "attack_interval_min": 2.0,
                "attack_interval_max": 3.5, "attack_radius": 24.0, "speed_multiplier": 1.0}},
        "overlord:melee_mode": {
            "minecraft:attack": {"damage": 10},
            "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.25,
                                                    "track_target": True}},
    }
    out["demiurge"] = _entity("demiurge", c, groups, dict(events))

    # --------------------------------------------- Narberal / Pandora's Actor
    c = guardian("narberal", 220, 0.32, 9, (0.7, 2.0), kb=0.4, xp=100)
    del c["minecraft:attack"], c["minecraft:behavior.melee_box_attack"]
    narberal_groups = {
        "overlord:mode_switcher": groups["overlord:mode_switcher"],
        "overlord:ranged_mode": {
            "minecraft:shooter": {"def": oid("lightning_bolt")},
            "minecraft:behavior.ranged_attack": {
                "priority": 3, "attack_interval_min": 1.5, "attack_interval_max": 2.5,
                "attack_radius": 20.0, "speed_multiplier": 1.0}},
        "overlord:melee_mode": {
            "minecraft:attack": {"damage": 9},
            "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.25,
                                                    "track_target": True}},
    }
    out["narberal"] = _entity("narberal", c, narberal_groups, dict(events))
    out["pandoras_actor"] = _entity("pandoras_actor", guardian(
        "pandoras_actor", 300, 0.32, 12, (0.7, 2.0), kb=0.7))

    # ------------------------------------------------------- Aura / Mare
    c = guardian("aura", 260, 0.36, 9, (0.7, 2.0), scale=0.8, kb=0.4)
    del c["minecraft:attack"], c["minecraft:behavior.melee_box_attack"]
    out["aura"] = _entity("aura", c, {
        "overlord:mode_switcher": groups["overlord:mode_switcher"],
        "overlord:ranged_mode": {
            "minecraft:shooter": {"def": "minecraft:arrow"},
            "minecraft:behavior.ranged_attack": {
                "priority": 3, "attack_interval_min": 1.0, "attack_interval_max": 2.0,
                "attack_radius": 20.0, "speed_multiplier": 1.0}},
        "overlord:melee_mode": {
            "minecraft:attack": {"damage": 9},
            "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.25,
                                                    "track_target": True}},
    }, dict(events))

    c = guardian("mare", 260, 0.3, 8, (0.7, 2.0), scale=0.8, kb=0.4)
    fang = {"target": "self", "entity_type": "minecraft:evocation_fang", "entity_lifespan": 1.1}
    c["minecraft:behavior.summon_entity"] = {
        "priority": 2,
        "summon_choices": [
            {"min_activation_range": 0.0, "max_activation_range": 3.0, "cooldown_time": 6.0, "weight": 3,
             "cast_duration": 2.0, "particle_color": "#FF3FBF5F", "start_sound_event": "cast.spell",
             "sequence": [
                 {"shape": "circle", "base_delay": 1.0, "delay_per_summon": 0.0, "num_entities_spawned": 5,
                  "size": 1.5, "sound_event": "prepare.attack", **fang},
                 {"shape": "circle", "base_delay": 0.15, "delay_per_summon": 0.0, "num_entities_spawned": 8,
                  "size": 2.5, **fang}]},
            {"min_activation_range": 3.0, "cooldown_time": 6.0, "weight": 3, "cast_duration": 2.0,
             "particle_color": "#FF3FBF5F", "start_sound_event": "cast.spell",
             "sequence": [
                 {"shape": "line", "base_delay": 1.0, "delay_per_summon": 0.05, "num_entities_spawned": 16,
                  "size": 20, **fang}]},
        ],
    }
    out["mare"] = _entity("mare", c)

    # ------------------------------------------------- Gazef / Clementine
    c = _mob("gazef", ["gazef", "human", "mob"], 120, 0.3, (0.7, 2.0), loot="gazef", xp=40, kb=0.5)
    c["minecraft:attack"] = {"damage": 11}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.25, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = {
        "priority": 2, "must_see": True, "reselect_targets": True,
        "entity_types": [{"filters": _is_family("monster"), "max_dist": 16}]}
    out["gazef"] = _entity("gazef", c)

    c = _mob("clementine", ["clementine", "human", "monster", "mob"], 100, 0.38, (0.6, 1.9),
             loot="clementine", xp=40, kb=0.2)
    c["minecraft:attack"] = {"damage": 8, "effect_name": "poison", "effect_duration": 4}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally])
    out["clementine"] = _entity("clementine", c)

    # ------------------------------------------- Brain / Zaryusu / CZ Delta
    def hunter(name, family, health, speed, damage, attack_extra=None):
        c = _mob(name, [name, family, "mob"], health, speed, (0.7, 2.0), loot=name, xp=40, kb=0.4)
        c["minecraft:attack"] = {"damage": damage, **(attack_extra or {})}
        c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.25,
                                                    "track_target": True}
        c["minecraft:behavior.nearest_attackable_target"] = {
            "priority": 2, "must_see": True, "reselect_targets": True,
            "entity_types": [{"filters": _is_family("monster"), "max_dist": 16}]}
        return _entity(name, c)

    out["brain"] = hunter("brain", "human", 110, 0.33, 10)
    out["zaryusu"] = hunter("zaryusu", "lizardman", 100, 0.3, 9,
                            {"effect_name": "slowness", "effect_duration": 3})

    c = guardian("cz_delta", 200, 0.3, 7, (0.7, 2.0), kb=0.4, xp=100)
    del c["minecraft:attack"], c["minecraft:behavior.melee_box_attack"]
    out["cz_delta"] = _entity("cz_delta", c, {
        "overlord:mode_switcher": groups["overlord:mode_switcher"],
        "overlord:ranged_mode": {
            "minecraft:shooter": {"def": oid("magic_bullet")},
            "minecraft:behavior.ranged_attack": {
                "priority": 3, "attack_interval_min": 0.8, "attack_interval_max": 1.5,
                "attack_radius": 24.0, "speed_multiplier": 1.0}},
        "overlord:melee_mode": {
            "minecraft:attack": {"damage": 7},
            "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.25,
                                                    "track_target": True}},
    }, dict(events))

    # ------------------------------------------------ remaining Pleiades
    out["lupusregina"] = _entity("lupusregina", guardian(
        "lupusregina", 240, 0.34, 10, (0.7, 2.0), kb=0.5, xp=100))
    out["entoma"] = _entity("entoma", guardian(
        "entoma", 200, 0.34, 8, (0.7, 2.0), kb=0.4, xp=100,
        attack_extra={"effect_name": "poison", "effect_duration": 6}))
    out["solution"] = _entity("solution", guardian(
        "solution", 220, 0.32, 8, (0.7, 2.0), kb=0.8, xp=100,
        attack_extra={"effect_name": "wither", "effect_duration": 4},
        sensor={"cause": "projectile", "damage_multiplier": 0.5}))
    out["yuri"] = _entity("yuri", guardian("yuri", 230, 0.34, 12, (0.7, 2.0), kb=0.7, xp=100))

    # ------------------------------------------------------ goblin / ogre
    c = _mob("goblin", ["goblin", "monster", "mob"], 16, 0.3, (0.6, 1.9), xp=4, scale=0.7)
    del c["minecraft:despawn"], c["minecraft:experience_reward"]
    c["minecraft:attack"] = {"damage": 3}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    exp_groups, exp_events = _expire_parts()
    out["goblin"] = _entity("goblin", c, {
        "overlord:wild": {
            "minecraft:despawn": {"despawn_from_distance": {}},
            "minecraft:loot": {"table": loot_path("goblin")},
            "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 4 : 0"},
            "minecraft:behavior.nearest_attackable_target": _target_players(20, [ally]),
        },
        "overlord:summoned": {
            "minecraft:type_family": {"family": ["goblin", ally, "mob"]},
            "minecraft:persistent": {},
            "minecraft:loot": {"table": loot_path("empty")},
            "minecraft:health": {"value": 30, "max": 30},
            "minecraft:attack": {"damage": 6},
            "minecraft:tameable": {"probability": 1.0, "tame_items": ["minecraft:emerald"]},
            "minecraft:behavior.follow_owner": {"priority": 4, "speed_multiplier": 1.2,
                                                "start_distance": 10, "stop_distance": 3},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
            "minecraft:behavior.nearest_attackable_target": {
                "priority": 3, "must_see": True, "reselect_targets": True,
                "entity_types": [{"filters": _is_family("monster"), "max_dist": 16}]},
            "minecraft:timer": {"looping": False, "time": 300,
                                "time_down_event": {"event": "overlord:expire", "target": "self"}},
        },
        **exp_groups,
    }, {
        "minecraft:entity_spawned": {"add": {"component_groups": ["overlord:wild"]}},
        "overlord:become_summoned": {"remove": {"component_groups": ["overlord:wild"]},
                                     "add": {"component_groups": ["overlord:summoned"]}},
        **exp_events,
    })

    # ------------------------------------- mega batch: casters, beasts, golem
    c = _mob("skeleton_mage", ["skeleton_mage", "nazarick", "undead", "skeleton", "monster", "mob"], 30,
             0.25, (0.6, 1.9), loot="skeleton_mage", xp=10, undead=True)
    c["minecraft:shooter"] = {"def": oid("magic_bullet")}
    c["minecraft:behavior.ranged_attack"] = {
        "priority": 3, "attack_interval_min": 1.5, "attack_interval_max": 2.5, "attack_radius": 16.0,
        "speed_multiplier": 1.0}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally])
    out["skeleton_mage"] = _entity("skeleton_mage", c)

    out["lizardman"] = hunter("lizardman", "lizardman", 40, 0.3, 6)

    c = _mob("evileye", ["evileye", "human", "mob"], 180, 0.32, (0.6, 1.9), loot="evileye", xp=80, scale=0.85,
             kb=0.4)
    c["minecraft:shooter"] = {"def": oid("crystal_shard")}
    c["minecraft:behavior.ranged_attack"] = {
        "priority": 3, "attack_interval_min": 1.2, "attack_interval_max": 2.0, "attack_radius": 20.0,
        "speed_multiplier": 1.0}
    c["minecraft:behavior.nearest_attackable_target"] = {
        "priority": 2, "must_see": True, "reselect_targets": True,
        "entity_types": [{"filters": _is_family("monster"), "max_dist": 20}]}
    out["evileye"] = _entity("evileye", c)

    c = _mob("fluder", ["fluder", "human", "monster", "mob"], 160, 0.27, (0.7, 2.0), loot="fluder", xp=80,
             kb=0.3, fire_immune=True)
    c["minecraft:shooter"] = {"def": oid("fireball")}
    c["minecraft:behavior.ranged_attack"] = {
        "priority": 3, "attack_interval_min": 2.0, "attack_interval_max": 3.5, "attack_radius": 24.0,
        "speed_multiplier": 1.0}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(32, [ally])
    out["fluder"] = _entity("fluder", c)

    c = guardian("gargantua", 600, 0.22, 20, (1.4, 2.6), scale=1.6, kb=1.0, xp=300,
                 sensor={"cause": "projectile", "damage_multiplier": 0.5})
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": False}
    out["gargantua"] = _entity("gargantua", c)

    c = _mob("soul_eater", ["soul_eater", "nazarick", "undead", "monster", "mob"], 70, 0.34, (1.0, 1.3),
             loot="soul_eater", xp=25, kb=0.4, undead=True)
    del c["minecraft:can_climb"]
    c["minecraft:attack"] = {"damage": 9, "effect_name": "wither", "effect_duration": 3}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(28, [ally])
    out["soul_eater"] = _entity("soul_eater", c)

    c = _mob("quagoa", ["quagoa", "monster", "mob"], 35, 0.3, (0.7, 2.0), loot="quagoa", xp=10, kb=0.2)
    c["minecraft:attack"] = {"damage": 7}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(20, [ally])
    out["quagoa"] = _entity("quagoa", c)

    c = _mob("ogre", ["ogre", "monster", "mob"], 60, 0.24, (0.9, 2.0), loot="ogre", xp=15, scale=1.4, kb=0.7)
    c["minecraft:attack"] = {"damage": 10}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24)
    out["ogre"] = _entity("ogre", c)

    # ------------------------------------------------- Nfirea (herbalist)
    c = _mob("nfirea", ["nfirea", "human", "mob"], 30, 0.25, (0.6, 1.9), xp=0)
    del c["minecraft:behavior.hurt_by_target"]
    c["minecraft:economy_trade_table"] = {
        "display_name": f"entity.{oid('nfirea')}.name",
        "table": f"trading/{NS}/nfirea.json", "new_screen": True}
    c["minecraft:behavior.trade_with_player"] = {"priority": 1, "filters": {"all_of": [
        {"test": "in_water", "value": False}, {"test": "on_ground", "value": True}]}}
    c["minecraft:behavior.look_at_trading_player"] = {"priority": 2}
    c["minecraft:behavior.panic"] = {"priority": 3, "speed_multiplier": 1.4}
    out["nfirea"] = _entity("nfirea", c)

    # ----------------------------------------------------- Nazarick maid
    c = _mob("nazarick_maid", ["nazarick_maid", "mob"], 40, 0.25, (0.6, 1.9), xp=0, persistent=True)
    del c["minecraft:behavior.hurt_by_target"]
    c["minecraft:economy_trade_table"] = {
        "display_name": f"entity.{oid('nazarick_maid')}.name",
        "table": f"trading/{NS}/nazarick_maid.json", "new_screen": True}
    c["minecraft:behavior.trade_with_player"] = {"priority": 1, "filters": {"all_of": [
        {"test": "in_water", "value": False}, {"test": "on_ground", "value": True}]}}
    c["minecraft:behavior.look_at_trading_player"] = {"priority": 2}
    c["minecraft:behavior.panic"] = {"priority": 3, "speed_multiplier": 1.4}
    c["minecraft:damage_sensor"] = _no_fall()
    out["nazarick_maid"] = _entity("nazarick_maid", c)

    # ----------------------------------------------- Nazarick Old Guarder
    c = _mob("old_guarder", ["old_guarder", "nazarick", "undead", "skeleton", "monster", "mob"], 30, 0.25,
             (0.6, 1.9), loot="old_guarder", xp=8, undead=True)
    c["minecraft:attack"] = {"damage": 5}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally])
    out["old_guarder"] = _entity("old_guarder", c)

    # ----------------------------------------------------- Death Knight
    c = _mob("death_knight", ["death_knight", "nazarick", "undead", "monster", "mob"], 80, 0.27,
             (0.8, 2.0), xp=20, scale=1.3, kb=0.6, undead=True)
    del c["minecraft:despawn"], c["minecraft:experience_reward"]
    c["minecraft:attack"] = {"damage": 9}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:damage_sensor"] = _no_fall()
    exp_groups, exp_events = _expire_parts()
    groups = {
        "overlord:wild": {
            "minecraft:despawn": {"despawn_from_distance": {}},
            "minecraft:loot": {"table": loot_path("death_knight")},
            "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 20 : 0"},
            "minecraft:behavior.nearest_attackable_target": _target_players(32, [ally]),
        },
        "overlord:summoned": {
            "minecraft:type_family": {"family": ["death_knight", ally, "undead", "mob"]},
            "minecraft:persistent": {},
            "minecraft:loot": {"table": loot_path("empty")},
            "minecraft:tameable": {"probability": 1.0, "tame_items": [oid("data_crystal")]},
            "minecraft:behavior.follow_owner": {"priority": 4, "speed_multiplier": 1.2,
                                                "start_distance": 10, "stop_distance": 3},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
            "minecraft:behavior.nearest_attackable_target": {
                "priority": 3, "must_see": True, "reselect_targets": True,
                "entity_types": [{"filters": _is_family("monster"), "max_dist": 16}]},
            "minecraft:timer": {"looping": False, "time": 300,
                                "time_down_event": {"event": "overlord:expire", "target": "self"}},
        },
        **exp_groups,
    }
    events = {
        "minecraft:entity_spawned": {"add": {"component_groups": ["overlord:wild"]}},
        "overlord:become_summoned": {"remove": {"component_groups": ["overlord:wild"]},
                                     "add": {"component_groups": ["overlord:summoned"]}},
        **exp_events,
    }
    out["death_knight"] = _entity("death_knight", c, groups, events)

    # ------------------------------------------------------- Elder Lich
    c = _mob("elder_lich", ["elder_lich", "nazarick", "undead", "skeleton", "monster", "mob"], 40, 0.25,
             (0.6, 1.9), loot="elder_lich", xp=15, undead=True)
    c["minecraft:shooter"] = {"def": "minecraft:small_fireball"}
    c["minecraft:behavior.ranged_attack"] = {
        "priority": 3, "attack_interval_min": 2.0, "attack_interval_max": 3.5, "attack_radius": 16.0,
        "speed_multiplier": 1.0}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally])
    c["minecraft:fire_immune"] = {}
    out["elder_lich"] = _entity("elder_lich", c)

    # ---------------------------------------------------------- Hamsuke
    seeds = ["minecraft:wheat_seeds", "minecraft:pumpkin_seeds", "minecraft:melon_seeds",
             "minecraft:beetroot_seeds"]
    c = _mob("hamsuke", ["hamsuke", "mob"], 60, 0.3, (1.1, 1.1), xp=5, scale=1.3, kb=0.3)
    del c["minecraft:despawn"], c["minecraft:can_climb"]
    c["minecraft:navigation.walk"] = {"can_path_over_water": True, "avoid_damage_blocks": True}
    c["minecraft:attack"] = {"damage": 8}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:damage_sensor"] = _no_fall()
    c["minecraft:leashable"] = {"soft_distance": 4.0, "hard_distance": 6.0, "max_distance": 10.0}
    c["minecraft:healable"] = {"items": [{"item": s, "heal_amount": 4} for s in seeds] + [
        {"item": "minecraft:wheat", "heal_amount": 6}, {"item": "minecraft:apple", "heal_amount": 8},
        {"item": "minecraft:carrot", "heal_amount": 8}, {"item": "minecraft:golden_carrot", "heal_amount": 20}]}
    c["minecraft:variable_max_auto_step"] = {"base_value": 1.0625, "controlled_value": 1.0625,
                                              "jump_prevented_value": 0.5625}
    c["minecraft:behavior.tempt"] = {"priority": 5, "speed_multiplier": 1.1, "items": seeds}
    groups = {
        "overlord:wild": {
            "minecraft:tameable": {"probability": 0.34, "tame_items": seeds,
                                   "tame_event": {"event": "overlord:on_tame", "target": "self"}},
        },
        "overlord:tamed": {
            "minecraft:is_tamed": {},
            "minecraft:persistent": {},
            "minecraft:rideable": {"seat_count": 1, "crouching_skip_interact": True,
                                   "family_types": ["player"],
                                   "interact_text": "action.interact.ride.horse",
                                   "seats": {"position": [0.0, 1.05, -0.1]}},
            "minecraft:input_ground_controlled": {},
            "minecraft:behavior.player_ride_tamed": {},
            "minecraft:behavior.follow_owner": {"priority": 4, "speed_multiplier": 1.2,
                                                "start_distance": 10, "stop_distance": 3},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
        },
    }
    events = {
        "minecraft:entity_spawned": {"add": {"component_groups": ["overlord:wild"]}},
        "overlord:on_tame": {"remove": {"component_groups": ["overlord:wild"]},
                             "add": {"component_groups": ["overlord:tamed"]}},
    }
    out["hamsuke"] = _entity("hamsuke", c, groups, events)

    # ------------------------------------------------------ projectiles
    def projectile(name, box, on_hit, groups, events):
        g, e = _expire_parts()
        return _entity(name, {
            "minecraft:type_family": {"family": ["projectile", name]},
            "minecraft:collision_box": {"width": box, "height": box},
            "minecraft:projectile": {
                "on_hit": on_hit, "power": 1.6, "gravity": 0.0, "inertia": 1.0, "liquid_inertia": 1.0,
                "uncertainty_base": 1.0, "uncertainty_multiplier": 0.0, "anchor": 1,
                "offset": [0, -0.1, 0], "reflect_on_hurt": False, "catch_fire": False},
            "minecraft:physics": {},
            "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": True},
            "minecraft:timer": {"looping": False, "time": 8,
                                "time_down_event": {"event": "overlord:expire", "target": "self"}},
            "minecraft:conditional_bandwidth_optimization": {"default_values": {
                "max_optimized_distance": 80.0, "max_dropped_ticks": 7,
                "use_motion_prediction_hints": True}},
        }, {**groups, **g}, {**events, **e}, spawnable=False)

    out["fireball"] = projectile("fireball", 0.4, {
        "impact_damage": {"damage": 8, "knockback": True, "catch_fire": True,
                          "semi_random_diff_damage": False},
        "definition_event": {"affect_projectile": True,
                             "event_trigger": {"event": "overlord:explode", "target": "self"}},
    }, {"overlord:exploding": {"minecraft:explode": {
        "fuse_length": 0, "fuse_lit": True, "power": 2.5, "causes_fire": False, "breaks_blocks": False}}},
        {"overlord:explode": {"add": {"component_groups": ["overlord:exploding"]}}})
    out["negative_burst"] = projectile("negative_burst", 0.4, {
        "impact_damage": {"damage": 10, "knockback": True, "semi_random_diff_damage": False},
        "mob_effect": {"effect": "wither", "durationeasy": 60, "durationnormal": 120,
                       "durationhard": 200, "amplifier": 1},
        "remove_on_hit": {},
    }, {}, {})
    out["crystal_shard"] = projectile("crystal_shard", 0.3, {
        "impact_damage": {"damage": 14, "knockback": True, "semi_random_diff_damage": False},
        "remove_on_hit": {},
    }, {}, {})
    out["magic_bullet"] = projectile("magic_bullet", 0.25, {
        "impact_damage": {"damage": 7, "knockback": True, "semi_random_diff_damage": False},
        "remove_on_hit": {},
    }, {}, {})
    out["lightning_bolt"] = projectile("lightning_bolt", 0.3, {
        "impact_damage": {"damage": 9, "knockback": True, "semi_random_diff_damage": False},
        "remove_on_hit": {},
    }, {}, {})
    return {f"entities/{k}.json": v for k, v in out.items()}


MOBS = ["ainz", "albedo", "shalltear", "cocytus", "demiurge", "sebas", "death_knight", "elder_lich",
        "hamsuke", "narberal", "pandoras_actor", "old_guarder", "aura", "mare", "gazef", "clementine",
        "nazarick_maid", "brain", "zaryusu", "cz_delta", "nfirea",
        "lupusregina", "entoma", "solution", "yuri", "goblin", "ogre",
        "skeleton_mage", "lizardman", "evileye", "fluder", "gargantua", "soul_eater", "quagoa"]
PROJECTILES = ["fireball", "negative_burst", "lightning_bolt", "magic_bullet", "crystal_shard"]

ENTITY_NAMES = {
    "ainz": "Ainz Ooal Gown", "albedo": "Albedo", "shalltear": "Shalltear Bloodfallen",
    "cocytus": "Cocytus", "demiurge": "Demiurge", "sebas": "Sebas Tian",
    "death_knight": "Death Knight", "elder_lich": "Elder Lich", "hamsuke": "Hamsuke",
    "narberal": "Narberal Gamma", "pandoras_actor": "Pandora's Actor",
    "old_guarder": "Nazarick Old Guarder", "aura": "Aura Bella Fiora", "mare": "Mare Bello Fiore",
    "gazef": "Gazef Stronoff", "clementine": "Clementine", "nazarick_maid": "Nazarick Maid",
    "brain": "Brain Unglaus", "zaryusu": "Zaryusu Shasha", "cz_delta": "CZ2128 Delta",
    "nfirea": "Nfirea Bareare", "magic_bullet": "Magic Bullet",
    "lupusregina": "Lupusregina Beta", "entoma": "Entoma Vasilissa Zeta",
    "solution": "Solution Epsilon", "yuri": "Yuri Alpha", "goblin": "Goblin", "ogre": "Ogre",
    "skeleton_mage": "Skeleton Mage", "lizardman": "Lizardman Warrior", "evileye": "Evileye",
    "fluder": "Fluder Paradyne", "gargantua": "Gargantua", "soul_eater": "Soul Eater",
    "quagoa": "Quagoa", "crystal_shard": "Crystal Lance",
    "fireball": "Fireball", "negative_burst": "Negative Burst", "lightning_bolt": "Lightning",
}


# ================================================================ trading
def trade_files():
    coin = oid("yggdrasil_gold_coin")

    def sell(item, price, qty=1, uses=32):
        return {"wants": [{"item": coin, "quantity": price}],
                "gives": [{"item": item, "quantity": qty}], "max_uses": uses}

    def buy(item, qty, coins, uses=32):
        return {"wants": [{"item": item, "quantity": qty}],
                "gives": [{"item": coin, "quantity": coins}], "max_uses": uses}

    trades = [
        sell(oid("red_potion"), 4), sell(oid("blue_potion"), 5), sell(oid("data_crystal"), 6), sell(oid("scroll_of_fly"), 8),
        sell(oid("scroll_of_lightning"), 8), sell(oid("scroll_of_invisibility"), 10),
        sell(oid("scroll_of_teleportation"), 12), sell(oid("nazarick_bricks"), 4, qty=16),
        sell(oid("nazarick_lamp"), 6, qty=4), sell("minecraft:golden_apple", 16),
        sell(oid("adamantite_ingot"), 24), sell(oid("scroll_of_explosion"), 10),
        sell(oid("scroll_of_time_stop"), 14), sell(oid("scroll_of_rebirth"), 20),
        sell(oid("soul_fragment"), 5),
        buy("minecraft:diamond", 1, 6), buy("minecraft:gold_ingot", 4, 5), buy("minecraft:bone", 16, 2),
    ]
    herbs = [
        sell(oid("red_potion"), 3), sell(oid("blue_potion"), 4), sell(oid("scroll_of_heavy_recover"), 6),
        sell("minecraft:golden_carrot", 3, qty=2), sell("minecraft:glistering_melon_slice", 4),
        buy("minecraft:nether_wart", 8, 3), buy("minecraft:wheat", 16, 2),
        buy("minecraft:glass_bottle", 8, 2), buy("minecraft:apple", 6, 2),
    ]
    table = lambda t: {"tiers": [{"total_exp_required": 0,
                                  "groups": [{"num_to_select": len(t), "trades": t}]}]}
    return {f"trading/{NS}/nazarick_maid.json": table(trades),
            f"trading/{NS}/nfirea.json": table(herbs)}


# ============================================================ spawn rules
def spawn_rule_files():
    def monster(name, weight, herd=(1, 1)):
        return {
            "format_version": "1.8.0",
            "minecraft:spawn_rules": {
                "description": {"identifier": oid(name), "population_control": "monster"},
                "conditions": [{
                    "minecraft:spawns_on_surface": {},
                    "minecraft:brightness_filter": {"min": 0, "max": 7, "adjust_for_weather": True},
                    "minecraft:difficulty_filter": {"min": "easy", "max": "hard"},
                    "minecraft:weight": {"default": weight},
                    "minecraft:density_limit": {"surface": max(2, herd[1])},
                    "minecraft:herd": {"min_size": herd[0], "max_size": herd[1]},
                    "minecraft:biome_filter": {"all_of": [
                        {"test": "has_biome_tag", "operator": "==", "value": "monster"},
                        {"test": "has_biome_tag", "operator": "==", "value": "overworld"}]},
                }],
            },
        }

    hamsuke = {
        "format_version": "1.8.0",
        "minecraft:spawn_rules": {
            "description": {"identifier": oid("hamsuke"), "population_control": "animal"},
            "conditions": [{
                "minecraft:spawns_on_surface": {},
                "minecraft:spawns_on_block_filter": "minecraft:grass_block",
                "minecraft:brightness_filter": {"min": 7, "max": 15, "adjust_for_weather": False},
                "minecraft:weight": {"default": 3},
                "minecraft:density_limit": {"surface": 1},
                "minecraft:herd": {"min_size": 1, "max_size": 1},
                "minecraft:biome_filter": {"test": "has_biome_tag", "operator": "==", "value": "forest"},
            }],
        },
    }
    def day_creature(name, biome, weight=2):
        return {
            "format_version": "1.8.0",
            "minecraft:spawn_rules": {
                "description": {"identifier": oid(name), "population_control": "animal"},
                "conditions": [{
                    "minecraft:spawns_on_surface": {},
                    "minecraft:spawns_on_block_filter": "minecraft:grass_block",
                    "minecraft:brightness_filter": {"min": 7, "max": 15, "adjust_for_weather": False},
                    "minecraft:weight": {"default": weight},
                    "minecraft:density_limit": {"surface": 1},
                    "minecraft:herd": {"min_size": 1, "max_size": 1},
                    "minecraft:biome_filter": {"test": "has_biome_tag", "operator": "==", "value": biome},
                }],
            },
        }

    return {
        "spawn_rules/gazef.json": day_creature("gazef", "plains"),
        "spawn_rules/brain.json": day_creature("brain", "taiga"),
        "spawn_rules/zaryusu.json": day_creature("zaryusu", "swamp", 3),
        "spawn_rules/nfirea.json": day_creature("nfirea", "plains"),
        "spawn_rules/clementine.json": monster("clementine", 3),
        "spawn_rules/goblin.json": monster("goblin", 14, herd=(2, 4)),
        "spawn_rules/skeleton_mage.json": monster("skeleton_mage", 8),
        "spawn_rules/soul_eater.json": monster("soul_eater", 4),
        "spawn_rules/fluder.json": monster("fluder", 2),
        "spawn_rules/lizardman.json": day_creature("lizardman", "swamp", 4),
        "spawn_rules/evileye.json": day_creature("evileye", "extreme_hills"),
        "spawn_rules/quagoa.json": {
            "format_version": "1.8.0",
            "minecraft:spawn_rules": {
                "description": {"identifier": oid("quagoa"), "population_control": "monster"},
                "conditions": [{
                    "minecraft:spawns_underground": {},
                    "minecraft:brightness_filter": {"min": 0, "max": 7, "adjust_for_weather": True},
                    "minecraft:difficulty_filter": {"min": "easy", "max": "hard"},
                    "minecraft:height_filter": {"min": -60, "max": 48},
                    "minecraft:weight": {"default": 20},
                    "minecraft:herd": {"min_size": 1, "max_size": 3},
                    "minecraft:biome_filter": {"all_of": [
                        {"test": "has_biome_tag", "operator": "==", "value": "monster"},
                        {"test": "has_biome_tag", "operator": "==", "value": "overworld"}]},
                }],
            },
        },
        "spawn_rules/ogre.json": monster("ogre", 6),
        "spawn_rules/death_knight.json": monster("death_knight", 8),
        "spawn_rules/elder_lich.json": monster("elder_lich", 8),
        "spawn_rules/old_guarder.json": monster("old_guarder", 12, herd=(2, 3)),
        "spawn_rules/hamsuke.json": hamsuke,
    }


# ====================================================== resource pack JSON
SOUNDS = {
    "ainz": (1.0, [0.6, 0.75], {"ambient": "mob.wither.ambient", "hurt": "mob.skeleton.hurt",
                                "death": "mob.wither.death", "step": "mob.skeleton.step",
                                "cast.spell": "mob.evocation_illager.cast_spell",
                                "prepare.summon": "mob.evocation_illager.prepare_summon",
                                "shoot": "mob.wither.shoot"}),
    "albedo": (1.0, [1.1, 1.25], {"hurt": "game.player.hurt", "death": "game.player.die",
                                  "step": "mob.zombie.step"}),
    "shalltear": (1.0, [1.3, 1.5], {"hurt": "game.player.hurt", "death": "game.player.die",
                                    "step": "mob.zombie.step"}),
    "cocytus": (1.0, [0.6, 0.8], {"ambient": "mob.spider.say", "hurt": "mob.irongolem.hit",
                                  "death": "mob.irongolem.death", "step": "mob.irongolem.walk"}),
    "demiurge": (1.0, [0.85, 0.95], {"hurt": "game.player.hurt", "death": "game.player.die",
                                     "step": "mob.zombie.step", "shoot": "mob.blaze.shoot"}),
    "sebas": (1.0, [0.7, 0.8], {"hurt": "game.player.hurt", "death": "game.player.die",
                                "step": "mob.zombie.step"}),
    "death_knight": (1.0, [0.5, 0.65], {"ambient": "mob.husk.ambient", "hurt": "mob.husk.hurt",
                                        "death": "mob.husk.death", "step": "mob.irongolem.walk"}),
    "elder_lich": (1.0, [0.7, 0.9], {"ambient": "mob.stray.ambient", "hurt": "mob.stray.hurt",
                                     "death": "mob.stray.death", "step": "mob.stray.step",
                                     "shoot": "mob.blaze.shoot"}),
    "narberal": (1.0, [1.15, 1.3], {"hurt": "game.player.hurt", "death": "game.player.die",
                                    "step": "mob.zombie.step", "shoot": "mob.shulker.shoot"}),
    "pandoras_actor": (1.0, [0.95, 1.05], {"hurt": "game.player.hurt", "death": "game.player.die",
                                          "step": "mob.zombie.step"}),
    "old_guarder": (1.0, [0.8, 1.0], {"ambient": "mob.skeleton.say", "hurt": "mob.skeleton.hurt",
                                      "death": "mob.skeleton.death", "step": "mob.skeleton.step"}),
    "aura": (1.0, [1.3, 1.45], {"hurt": "game.player.hurt", "death": "game.player.die",
                                "step": "mob.zombie.step", "shoot": "random.bow"}),
    "mare": (1.0, [1.35, 1.5], {"hurt": "game.player.hurt", "death": "game.player.die",
                                "step": "mob.zombie.step",
                                "cast.spell": "mob.evocation_illager.cast_spell",
                                "prepare.attack": "mob.evocation_illager.prepare_attack"}),
    "gazef": (1.0, [0.8, 0.9], {"hurt": "game.player.hurt", "death": "game.player.die",
                                "step": "mob.zombie.step"}),
    "clementine": (1.0, [1.2, 1.3], {"hurt": "game.player.hurt", "death": "game.player.die",
                                     "step": "mob.zombie.step"}),
    "nazarick_maid": (1.0, [1.2, 1.35], {"hurt": "mob.villager.hit", "death": "mob.villager.death",
                                         "step": "mob.zombie.step", "haggle": "mob.villager.haggle",
                                         "haggle.yes": "mob.villager.yes", "haggle.no": "mob.villager.no"}),
    "brain": (1.0, [0.85, 0.95], {"hurt": "game.player.hurt", "death": "game.player.die",
                                  "step": "mob.zombie.step"}),
    "zaryusu": (1.0, [0.6, 0.7], {"hurt": "game.player.hurt", "death": "game.player.die",
                                  "step": "mob.zombie.step"}),
    "cz_delta": (1.0, [1.25, 1.4], {"hurt": "game.player.hurt", "death": "game.player.die",
                                    "step": "mob.zombie.step", "shoot": "crossbow.shoot"}),
    "nfirea": (1.0, [1.0, 1.1], {"hurt": "mob.villager.hit", "death": "mob.villager.death",
                                 "step": "mob.zombie.step", "haggle": "mob.villager.haggle",
                                 "haggle.yes": "mob.villager.yes", "haggle.no": "mob.villager.no"}),
    "lupusregina": (1.0, [1.2, 1.3], {"hurt": "game.player.hurt", "death": "game.player.die",
                                      "step": "mob.zombie.step"}),
    "entoma": (1.0, [1.4, 1.55], {"ambient": "mob.spider.say", "hurt": "game.player.hurt",
                                  "death": "game.player.die", "step": "mob.zombie.step"}),
    "solution": (1.0, [1.1, 1.2], {"hurt": "game.player.hurt", "death": "game.player.die",
                                   "step": "mob.zombie.step"}),
    "yuri": (1.0, [1.0, 1.1], {"hurt": "game.player.hurt", "death": "game.player.die",
                               "step": "mob.zombie.step"}),
    "goblin": (1.0, [1.5, 1.7], {"ambient": "mob.zombie.say", "hurt": "mob.husk.hurt",
                                 "death": "mob.husk.death", "step": "mob.zombie.step"}),
    "ogre": (1.0, [0.5, 0.6], {"ambient": "mob.zombie.say", "hurt": "mob.husk.hurt",
                               "death": "mob.husk.death", "step": "mob.irongolem.walk"}),
    "skeleton_mage": (1.0, [1.0, 1.2], {"ambient": "mob.skeleton.say", "hurt": "mob.skeleton.hurt",
                                        "death": "mob.skeleton.death", "step": "mob.skeleton.step",
                                        "shoot": "mob.shulker.shoot"}),
    "lizardman": (1.0, [0.7, 0.8], {"hurt": "game.player.hurt", "death": "game.player.die",
                                    "step": "mob.zombie.step"}),
    "evileye": (1.0, [1.4, 1.5], {"hurt": "game.player.hurt", "death": "game.player.die",
                                  "step": "mob.zombie.step", "shoot": "random.glass"}),
    "fluder": (1.0, [0.7, 0.8], {"hurt": "game.player.hurt", "death": "game.player.die",
                                 "step": "mob.zombie.step", "shoot": "mob.ghast.fireball"}),
    "gargantua": (1.0, [0.5, 0.6], {"ambient": "mob.ravager.ambient", "hurt": "mob.irongolem.hit",
                                    "death": "mob.irongolem.death", "step": "mob.irongolem.walk"}),
    "soul_eater": (1.0, [0.6, 0.8], {"ambient": "mob.wither.ambient", "hurt": "mob.husk.hurt",
                                     "death": "mob.husk.death", "step": "mob.zombie.step"}),
    "quagoa": (1.0, [0.9, 1.1], {"ambient": "mob.rabbit.idle", "hurt": "mob.rabbit.hurt",
                                 "death": "mob.rabbit.death", "step": "mob.zombie.step"}),
    "hamsuke": (1.0, [0.6, 0.8], {"ambient": "mob.rabbit.idle", "hurt": "mob.rabbit.hurt",
                                  "death": "mob.rabbit.death", "step": "mob.polarbear.step"}),
}


def sounds_json():
    ents = {}
    for name, (vol, pitch, events) in SOUNDS.items():
        ents[oid(name)] = {"volume": vol, "pitch": pitch, "events": events}
    return {"entity_sounds": {"entities": ents}}


def _walk(amp, phase=0.0):
    p = f" + {phase}" if phase else ""
    return (f"math.cos(query.modified_distance_moved * 38.17{p}) * {amp} * "
            f"math.clamp(query.modified_move_speed, 0.0, 1.0)")


def animations_json():
    swing = "math.sin(variable.attack_time * 180.0)"
    a = {
        "animation.overlord.look_at_target": {"loop": True, "bones": {
            "head": {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0.0]}}},
        "animation.overlord.idle": {"loop": True, "bones": {
            "rightArm": {"rotation": ["math.sin(query.life_time * 76.8) * 2.5", 0.0,
                                      "math.cos(query.life_time * 103.2) * 2.5 + 2.5"]},
            "leftArm": {"rotation": ["-math.sin(query.life_time * 76.8) * 2.5", 0.0,
                                     "-(math.cos(query.life_time * 103.2) * 2.5 + 2.5)"]}}},
        "animation.overlord.walk": {"loop": True, "bones": {
            "rightLeg": {"rotation": [_walk(45.0), 0.0, 0.0]},
            "leftLeg": {"rotation": [_walk(45.0, 180.0), 0.0, 0.0]},
            "rightArm": {"rotation": [_walk(25.0, 180.0), 0.0, 0.0]},
            "leftArm": {"rotation": [_walk(25.0), 0.0, 0.0]}}},
        "animation.overlord.robe_walk": {"loop": True, "bones": {
            "robe": {"rotation": [_walk(4.0), 0.0, 0.0]},
            "rightArm": {"rotation": [_walk(12.0, 180.0), 0.0, 0.0]},
            "leftArm": {"rotation": [_walk(12.0), 0.0, 0.0]}}},
        "animation.overlord.attack": {"loop": True, "bones": {
            "body": {"rotation": [0.0, f"{swing} * 8.0", 0.0]},
            "rightArm": {"rotation": [f"-{swing} * 105.0", 0.0, 0.0]}}},
        "animation.overlord.cast": {"loop": True, "bones": {
            "leftArm": {"rotation": [
                "query.is_casting ? (-150.0 + math.sin(query.life_time * 720.0) * 8.0) : 0.0", 0.0,
                "query.is_casting ? -15.0 : 0.0"]}}},
        "animation.overlord.wings": {"loop": True, "bones": {
            "rightWing": {"rotation": [0.0, "math.sin(query.life_time * 120.0) * 7.0", 0.0]},
            "leftWing": {"rotation": [0.0, "-math.sin(query.life_time * 120.0) * 7.0", 0.0]}}},
        "animation.overlord.tail": {"loop": True, "bones": {
            "tail": {"rotation": [0.0, "math.sin(query.life_time * 90.0) * 9.0", 0.0]}}},
        "animation.overlord.lower_arms": {"loop": True, "bones": {
            "rightArm2": {"rotation": [f"math.sin(query.life_time * 80.0) * 4.0 - {swing} * 60.0", 0.0, 0.0]},
            "leftArm2": {"rotation": ["-math.sin(query.life_time * 80.0) * 4.0", 0.0, 0.0]}}},
        "animation.overlord.hamsuke.walk": {"loop": True, "bones": {
            "leg0": {"rotation": [_walk(40.0), 0.0, 0.0]},
            "leg1": {"rotation": [_walk(40.0, 180.0), 0.0, 0.0]},
            "leg2": {"rotation": [_walk(40.0, 180.0), 0.0, 0.0]},
            "leg3": {"rotation": [_walk(40.0), 0.0, 0.0]}}},
        "animation.overlord.hamsuke.tail": {"loop": True, "bones": {
            "tail": {"rotation": [0.0, "math.sin(query.life_time * 100.0) * 10.0", 0.0]},
            "tail2": {"rotation": [0.0, "math.sin(query.life_time * 100.0 - 60.0) * 14.0", 0.0]},
            "tail3": {"rotation": [0.0, "math.sin(query.life_time * 100.0 - 120.0) * 16.0", 0.0]}}},
        "animation.overlord.hamsuke.attack": {"loop": True, "bones": {
            "head": {"rotation": [f"-{swing} * 25.0", 0.0, 0.0]}}},
        "animation.overlord.projectile.spin": {"loop": True, "bones": {
            "body": {"rotation": ["query.life_time * 420.0", "query.life_time * 300.0", 0.0]}}},
    }
    return {"format_version": "1.8.0", "animations": a}


# which animations each entity plays (short name -> animation id)
ENTITY_ANIMS = {
    "ainz": ["look_at_target", "idle", "robe_walk", "attack", "cast"],
    "elder_lich": ["look_at_target", "idle", "robe_walk", "attack"],
    "albedo": ["look_at_target", "idle", "robe_walk", "attack", "wings"],
    "shalltear": ["look_at_target", "idle", "walk", "attack"],
    "cocytus": ["look_at_target", "idle", "walk", "attack", "tail", "lower_arms"],
    "demiurge": ["look_at_target", "idle", "walk", "attack", "tail"],
    "sebas": ["look_at_target", "idle", "walk", "attack"],
    "death_knight": ["look_at_target", "idle", "walk", "attack"],
    "hamsuke": ["look_at_target", "hamsuke.walk", "hamsuke.tail", "hamsuke.attack"],
    "narberal": ["look_at_target", "idle", "robe_walk", "attack"],
    "pandoras_actor": ["look_at_target", "idle", "walk", "attack"],
    "old_guarder": ["look_at_target", "idle", "walk", "attack"],
    "aura": ["look_at_target", "idle", "walk", "attack"],
    "mare": ["look_at_target", "idle", "walk", "attack", "cast"],
    "gazef": ["look_at_target", "idle", "walk", "attack"],
    "clementine": ["look_at_target", "idle", "walk", "attack"],
    "nazarick_maid": ["look_at_target", "idle", "robe_walk"],
    "brain": ["look_at_target", "idle", "walk", "attack"],
    "zaryusu": ["look_at_target", "idle", "walk", "attack", "tail"],
    "cz_delta": ["look_at_target", "idle", "robe_walk", "attack"],
    "nfirea": ["look_at_target", "idle", "walk"],
    "lupusregina": ["look_at_target", "idle", "robe_walk", "attack"],
    "entoma": ["look_at_target", "idle", "robe_walk", "attack"],
    "solution": ["look_at_target", "idle", "robe_walk", "attack"],
    "yuri": ["look_at_target", "idle", "robe_walk", "attack"],
    "goblin": ["look_at_target", "idle", "walk", "attack"],
    "ogre": ["look_at_target", "idle", "walk", "attack"],
    "skeleton_mage": ["look_at_target", "idle", "robe_walk", "attack"],
    "lizardman": ["look_at_target", "idle", "walk", "attack", "tail"],
    "evileye": ["look_at_target", "idle", "walk", "attack"],
    "fluder": ["look_at_target", "idle", "robe_walk", "attack"],
    "gargantua": ["look_at_target", "idle", "walk", "attack"],
    "soul_eater": ["look_at_target", "hamsuke.walk", "hamsuke.attack"],
    "quagoa": ["look_at_target", "idle", "walk", "attack"],
    "crystal_shard": ["projectile.spin"],
    "magic_bullet": ["projectile.spin"],
    "lightning_bolt": ["projectile.spin"],
    "fireball": ["projectile.spin"],
    "negative_burst": ["projectile.spin"],
}

# ---------------------------------------------------------------- particles
# Every spell effect is drawn with these five emitters.  The script passes
# variable.color (element colour) and variable.scale (size) with each spawn.
def particle_files():
    tint = ["variable.color.r", "variable.color.g", "variable.color.b"]
    life = "variable.particle_age / variable.particle_lifetime"

    def effect(name, texture, tex_size, components):
        return {
            "format_version": "1.10.0",
            "particle_effect": {
                "description": {
                    "identifier": oid(name),
                    "basic_render_parameters": {"material": "particles_blend",
                                                "texture": f"textures/particle/{NS}/{texture}"},
                },
                "components": {
                    "minecraft:emitter_lifetime_once": {"active_time": 0.1},
                    **components,
                },
            },
        }

    def billboard(size, mode, tex_size):
        return {"size": [size, size], "facing_camera_mode": mode,
                "uv": {"texture_width": tex_size, "texture_height": tex_size, "uv": [0, 0],
                       "uv_size": [tex_size, tex_size]}}

    out = {
        # burst of glowing motes flying outwards (impacts)
        "spark": effect("spark", "glow", 16, {
            "minecraft:emitter_rate_instant": {"num_particles": 14},
            "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
            "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.35, 0.8)"},
            "minecraft:particle_initial_speed": "math.random(1.5, 4.0) * variable.scale",
            "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -2.0, 0],
                                                  "linear_drag_coefficient": 2.5},
            "minecraft:particle_appearance_billboard": billboard(
                f"0.12 * variable.scale * (1.0 - {life})", "lookat_xyz", 16),
            "minecraft:particle_appearance_tinting": {"color": [*tint, 1.0]},
        }),
        # one still mote (beams and trails are drawn as rows of these)
        "mote": effect("mote", "glow", 16, {
            "minecraft:emitter_rate_instant": {"num_particles": 1},
            "minecraft:emitter_shape_point": {},
            "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
            "minecraft:particle_appearance_billboard": billboard(
                f"0.2 * variable.scale * (1.0 - 0.7 * {life})", "lookat_xyz", 16),
            "minecraft:particle_appearance_tinting": {"color": [*tint, f"1.0 - {life}"]},
        }),
        # motes rising from a disc on the ground (heals, buffs, charging spells)
        "rise": effect("rise", "glow", 16, {
            "minecraft:emitter_rate_instant": {"num_particles": 16},
            "minecraft:emitter_shape_disc": {"radius": "variable.scale", "plane_normal": [0, 1, 0],
                                             "direction": [0, 1, 0]},
            "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.7, 1.4)"},
            "minecraft:particle_initial_speed": "math.random(1.0, 2.6)",
            "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.8},
            "minecraft:particle_appearance_billboard": billboard(
                f"0.1 * (1.0 - {life})", "lookat_xyz", 16),
            "minecraft:particle_appearance_tinting": {"color": [*tint, 1.0]},
        }),
        # flat rotating magic circle
        "magic_circle": effect("magic_circle", "magic_circle", 64, {
            "minecraft:emitter_rate_instant": {"num_particles": 1},
            "minecraft:emitter_shape_point": {},
            "minecraft:particle_lifetime_expression": {"max_lifetime": 1.3},
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 80},
            "minecraft:particle_appearance_billboard": billboard("variable.scale", "emitter_transform_xz", 64),
            "minecraft:particle_appearance_tinting": {"color": [
                *tint, "math.clamp(math.min(variable.particle_age * 6.0, "
                       "(variable.particle_lifetime - variable.particle_age) * 3.0), 0.0, 1.0)"]},
        }),
        # flat ring that expands and fades (shock waves)
        "ring": effect("ring", "ring", 32, {
            "minecraft:emitter_rate_instant": {"num_particles": 1},
            "minecraft:emitter_shape_point": {},
            "minecraft:particle_lifetime_expression": {"max_lifetime": 0.55},
            "minecraft:particle_appearance_billboard": billboard(
                f"variable.scale * (0.15 + 0.85 * {life})", "emitter_transform_xz", 32),
            "minecraft:particle_appearance_tinting": {"color": [*tint, f"1.0 - {life}"]},
        }),
    }
    return {f"particles/{name}.json": data for name, data in out.items()}


PARTICLES = ["spark", "mote", "rise", "magic_circle", "ring"]
PLAYER_BONES = ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"]


def player_animations_json():
    """Casting poses played on the player with Entity.playAnimation."""
    def keys(*frames):
        return {f"{t:.2f}": list(v) for t, v in frames}

    return {"format_version": "1.8.0", "animations": {
        # one hand thrust at the target
        "animation.overlord.cast_point": {"animation_length": 0.6, "bones": {
            "rightArm": {"rotation": keys((0, (0, 0, 0)), (0.12, (-95, -8, 0)), (0.42, (-95, -8, 0)),
                                          (0.6, (0, 0, 0)))},
            "body": {"rotation": keys((0, (0, 0, 0)), (0.12, (0, 8, 0)), (0.42, (0, 8, 0)), (0.6, (0, 0, 0)))},
        }},
        # both arms raised to the sky (area and super-tier magic)
        "animation.overlord.cast_raise": {"animation_length": 1.0, "bones": {
            "rightArm": {"rotation": keys((0, (0, 0, 0)), (0.2, (-165, 0, 18)), (0.75, (-165, 0, 18)),
                                          (1.0, (0, 0, 0)))},
            "leftArm": {"rotation": keys((0, (0, 0, 0)), (0.2, (-165, 0, -18)), (0.75, (-165, 0, -18)),
                                         (1.0, (0, 0, 0)))},
            "head": {"rotation": keys((0, (0, 0, 0)), (0.2, (-18, 0, 0)), (0.75, (-18, 0, 0)), (1.0, (0, 0, 0)))},
        }},
        # arms spread wide (healing, buffs, self-targeted magic)
        "animation.overlord.cast_self": {"animation_length": 0.8, "bones": {
            "rightArm": {"rotation": keys((0, (0, 0, 0)), (0.2, (-20, 0, 75)), (0.6, (-20, 0, 75)),
                                          (0.8, (0, 0, 0)))},
            "leftArm": {"rotation": keys((0, (0, 0, 0)), (0.2, (-20, 0, -75)), (0.6, (-20, 0, -75)),
                                         (0.8, (0, 0, 0)))},
        }},
    }}


RENDER_CONTROLLER = "controller.render.overlord.entity"


def render_controllers_json():
    return {"format_version": "1.8.0", "render_controllers": {RENDER_CONTROLLER: {
        "geometry": "Geometry.default",
        "materials": [{"*": "Material.default"}],
        "textures": ["Texture.default"],
    }}}


def client_entity_files():
    out = {}
    for name, anims in ENTITY_ANIMS.items():
        d = {
            "identifier": oid(name),
            "materials": {"default": "entity_alphatest"},
            "textures": {"default": f"textures/entity/{NS}/{name}"},
            "geometry": {"default": f"geometry.overlord.{name}"},
            "scripts": {"animate": [a.replace(".", "_") for a in anims]},
            "animations": {a.replace(".", "_"): f"animation.overlord.{a}" for a in anims},
            "render_controllers": [RENDER_CONTROLLER],
        }
        if name in MOBS:
            d["spawn_egg"] = {"texture": f"{NS}_egg_{name}", "texture_index": 0}
        out[f"entity/{name}.entity.json"] = {"format_version": "1.10.0",
                                             "minecraft:client_entity": {"description": d}}
    return out


ARMOR = {
    # piece: (layer texture, variable hidden on the wearer)
    "helmet": ("1", "variable.helmet_layer_visible = 0.0;"),
    "chestplate": ("1", "variable.chest_layer_visible = 0.0;"),
    "leggings": ("2", "variable.leg_layer_visible = 0.0;"),
    "boots": ("1", "variable.boot_layer_visible = 0.0;"),
}


# wearable item -> (armour piece geometry, texture)
WEARABLES = {
    **{f"dark_warrior_{piece}": (piece, f"{NS}_dark_warrior_{layer}") for piece, (layer, _s) in ARMOR.items()},
    "mask_of_envy": ("helmet", f"{NS}_mask_of_envy"),
    **{f"world_champion_{piece}": (piece, f"{NS}_world_champion_{layer}")
       for piece, (layer, _s) in ARMOR.items()},
    **{f"regalia_{piece}": (piece, f"{NS}_regalia_{layer}") for piece, (layer, _s) in ARMOR.items()},
}


def attachable_files():
    """Mirrors the vanilla diamond armour attachables (player + other mobs)."""
    out = {}
    for name, (piece, texture) in WEARABLES.items():
        item = oid(name)
        setup = ARMOR[piece][1]
        common = {
            "materials": {"default": "armor", "enchanted": "armor_enchanted"},
            "textures": {"default": f"textures/models/armor/{texture}",
                         "enchanted": "textures/misc/enchanted_actor_glint"},
        }
        out[f"attachables/{name}.player.json"] = {
            "format_version": "1.10.0",
            "minecraft:attachable": {"description": {
                "identifier": f"{item}.player",
                "item": {item: "query.owner_identifier == 'minecraft:player'"},
                **common,
                "geometry": {"default": f"geometry.player.armor.{piece}"},
                "scripts": {"parent_setup": setup, "animate": ["offset"]},
                "animations": {"offset": f"animation.armor.{piece}.offset"},
                "render_controllers": ["controller.render.armor"],
            }},
        }
        out[f"attachables/{name}.json"] = {
            "format_version": "1.8.0",
            "minecraft:attachable": {"description": {
                "identifier": item,
                **common,
                "geometry": {"default": f"geometry.humanoid.armor.{piece}"},
                "scripts": {"parent_setup": setup},
                "render_controllers": ["controller.render.armor"],
            }},
        }
    return out


# vanilla definitions our files are allowed to reference
VANILLA_REFS = {
    "geometry": {f"geometry.player.armor.{p}" for p in ARMOR} | {f"geometry.humanoid.armor.{p}" for p in ARMOR},
    "animation": {f"animation.armor.{p}.offset" for p in ARMOR},
    "render_controller": {"controller.render.armor"},
    "material": {"entity_alphatest", "armor", "armor_enchanted"},
    "texture": {"textures/misc/enchanted_actor_glint"},
    "entity": {"minecraft:small_fireball"},
}


def item_texture_json(icon_names):
    return {"resource_pack_name": NS, "texture_name": "atlas.items", "texture_data": {
        f"{NS}_{n}": {"textures": f"textures/items/{NS}/{n}"} for n in sorted(icon_names)}}


def terrain_texture_json():
    return {"resource_pack_name": NS, "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4,
            "texture_data": {f"{NS}_{n}": {"textures": f"textures/blocks/{NS}/{n}"}
                             for n in terrain_textures()}}


def blocks_json():
    d = {"format_version": "1.21.40"}
    for name, (_display, sound, _c) in BLOCKS.items():
        d[oid(name)] = {"sound": sound}
    return d


# ================================================================== texts
def lang_rp():
    lines = ["## Overlord: Tomb of Nazarick", ""]
    for name, (display, _cat, _c) in ITEMS.items():
        lines.append(f"item.{NS}.{name}.name={display}")
    lines.append("")
    for name, (display, _s, _c) in BLOCKS.items():
        lines.append(f"tile.{oid(name)}.name={display}")
    lines.append("")
    for name, display in ENTITY_NAMES.items():
        lines.append(f"entity.{oid(name)}.name={display}")
    lines.append("")
    for name in MOBS:
        lines.append(f"item.spawn_egg.entity.{oid(name)}.name={ENTITY_NAMES[name]} Spawn Egg")
    lines += ["", f"pack.name={PACK_NAME}", f"pack.description={PACK_DESC}", ""]
    return "\n".join(lines)


def lang_bp():
    return "\n".join([f"pack.name={PACK_NAME}", f"pack.description={PACK_DESC}", ""])
