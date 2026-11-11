"""All JSON / text content of the Overlord add-on (behavior + resource pack)."""
from __future__ import annotations

NS = "overlord"
VERSION = [1, 0, 0]
MIN_ENGINE = [1, 21, 90]
UUID_BP = "e6440d11-49cb-4a78-994b-2621743284c3"
UUID_BP_DATA = "92b407c1-2afe-47be-96e5-2ca63d6e95e3"
UUID_BP_SCRIPT = "953c5275-23d2-4160-bd35-cc41791660c6"
UUID_RP = "c0efa9f1-85eb-41e8-a663-b693b3f36197"
UUID_RP_MOD = "6f472436-ea00-42b5-b73d-8ee5e218a303"

PACK_NAME = "Overlord: Tomb of Nazarick"
PACK_DESC = "Ainz Ooal Gown, the Floor Guardians, Death Knights, legendary weapons and spells. §7v1.0.0"


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
    "sigil_of_ainz": ("Sigil of Ainz Ooal Gown", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "epic", "minecraft:glint": True}),
}
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
}


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
                        "*": {"texture": f"{NS}_{name}", "render_method": "opaque"}},
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
    "minecraft:golden_carrot", "minecraft:blaze_rod",
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
                  _pool(_entry(oid("red_potion"), 2, 4, looting=False))],
        "ainz": [one(oid("staff_of_ainz_ooal_gown")), one(oid("ring_of_ainz_ooal_gown")),
                 _pool(_entry(cry, 8, 12)), _pool(_entry(coin, 24, 32)),
                 _pool(_entry(oid("tome_create_undead"), 1, 1, looting=False))],
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
    return {f"entities/{k}.json": v for k, v in out.items()}


MOBS = ["ainz", "albedo", "shalltear", "cocytus", "demiurge", "sebas", "death_knight", "elder_lich",
        "hamsuke"]
PROJECTILES = ["fireball", "negative_burst"]

ENTITY_NAMES = {
    "ainz": "Ainz Ooal Gown", "albedo": "Albedo", "shalltear": "Shalltear Bloodfallen",
    "cocytus": "Cocytus", "demiurge": "Demiurge", "sebas": "Sebas Tian",
    "death_knight": "Death Knight", "elder_lich": "Elder Lich", "hamsuke": "Hamsuke",
    "fireball": "Fireball", "negative_burst": "Negative Burst",
}


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
                    "minecraft:density_limit": {"surface": 2},
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
    return {
        "spawn_rules/death_knight.json": monster("death_knight", 8),
        "spawn_rules/elder_lich.json": monster("elder_lich", 8),
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
    "fireball": ["projectile.spin"],
    "negative_burst": ["projectile.spin"],
}

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


def attachable_files():
    """Mirrors the vanilla diamond armour attachables (player + other mobs)."""
    out = {}
    for piece, (layer, setup) in ARMOR.items():
        item = oid(f"dark_warrior_{piece}")
        common = {
            "materials": {"default": "armor", "enchanted": "armor_enchanted"},
            "textures": {"default": f"textures/models/armor/{NS}_dark_warrior_{layer}",
                         "enchanted": "textures/misc/enchanted_actor_glint"},
        }
        out[f"attachables/dark_warrior_{piece}.player.json"] = {
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
        out[f"attachables/dark_warrior_{piece}.json"] = {
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
            "texture_data": {f"{NS}_{n}": {"textures": f"textures/blocks/{NS}/{n}"} for n in BLOCKS}}


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
