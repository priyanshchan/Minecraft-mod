"""All JSON / text content of the Overlord add-on (behavior + resource pack)."""
from __future__ import annotations

NS = "overlord"
VERSION = [8, 7, 0]
MIN_ENGINE = [1, 21, 90]
UUID_BP = "e6440d11-49cb-4a78-994b-2621743284c3"
UUID_BP_DATA = "92b407c1-2afe-47be-96e5-2ca63d6e95e3"
UUID_BP_SCRIPT = "953c5275-23d2-4160-bd35-cc41791660c6"
UUID_RP = "c0efa9f1-85eb-41e8-a663-b693b3f36197"
UUID_RP_MOD = "6f472436-ea00-42b5-b73d-8ee5e218a303"

PACK_NAME = "Overlord: Tomb of Nazarick"
PACK_DESC = "Ainz Ooal Gown, the Floor Guardians, tier magic, levels, quests, companions and faction camps, a story campaign and your own kingdom. §7v8.7.0"


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
    "frost_dragon": ("the Frost Dragon", "minecraft:blue_ice"),
    "evil_lord_wrath": ("Evil Lord Wrath", "minecraft:netherrack"),
    "dominion_authority": ("Dominion Authority", "minecraft:glowstone"),
    "zesshi": ("Zesshi Zetsumei", "minecraft:quartz_block"),
    "skeletal_dragon": ("the Skeletal Dragon", "minecraft:soul_sand"),
    "dark_young": ("the Dark Young", "minecraft:crying_obsidian"),
    "jaldabaoth": ("Jaldabaoth", "minecraft:blaze_rod"),
    "decem": ("Decem Hougan", "minecraft:emerald"),
    "platinum_dragon_lord": ("the Platinum Dragon Lord", "minecraft:amethyst_shard"),
    "rubedo": ("Rubedo", "minecraft:nether_star"),
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
    "frost_dragon_scale": ("Frost Dragon Scale", "items", {"minecraft:max_stack_size": 64,
                                                            "minecraft:rarity": "rare"}),
    "vampire_fang": ("Vampire Fang", "items", {"minecraft:max_stack_size": 64}),
    "troll_blood": ("Troll Blood", "items", {"minecraft:max_stack_size": 16}),
    "troll_elixir": ("Troll Blood Elixir", "items", {
        "minecraft:max_stack_size": 16,
        "minecraft:use_animation": "drink",
        "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35},
        "minecraft:food": {"can_always_eat": True, "nutrition": 0, "saturation_modifier": 0.0,
                           "using_converts_to": "minecraft:glass_bottle"},
        "minecraft:rarity": "rare",
    }),
    "runic_hammer": ("Dwarven Runic Hammer", "equipment", _weapon(11, _cooldown("overlord_rune", 8.0),
                                                                 rarity="rare")),
    "fang_dagger": ("Fang Dagger", "equipment", _weapon(7, rarity="rare")),
    "dragonscale_helmet": ("Dragonscale Helm", "equipment", _armor("slot.armor.head", 3, 520, "armor_head")),
    "dragonscale_chestplate": ("Dragonscale Mail", "equipment",
                               _armor("slot.armor.chest", 8, 760, "armor_torso")),
    "dragonscale_leggings": ("Dragonscale Greaves", "equipment",
                             _armor("slot.armor.legs", 6, 710, "armor_legs")),
    "dragonscale_boots": ("Dragonscale Boots", "equipment", _armor("slot.armor.feet", 3, 615, "armor_feet")),
    "angel_feather": ("Angel Feather", "items", {"minecraft:max_stack_size": 64}),
    "demon_heart": ("Demon's Heart", "items", {"minecraft:max_stack_size": 16, "minecraft:rarity": "rare"}),
    "blessed_cloth": ("Blessed Cloth", "items", {"minecraft:max_stack_size": 64}),
    "sealing_crystal": ("Sealing Crystal", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_scroll", 1.5)}),
    "charons_guidance": ("Charon's Guidance", "equipment", _weapon(14, _cooldown("overlord_reap", 9.0))),
    "angel_mace": ("Angel's Mace", "equipment", _weapon(9, rarity="rare")),
    "hellfire_blade": ("Hellfire Blade", "equipment", _weapon(12, _cooldown("overlord_hellfire", 7.0))),
    "infernal_helmet": ("Infernal Helm", "equipment", _armor("slot.armor.head", 3, 500, "armor_head")),
    "infernal_chestplate": ("Infernal Plate", "equipment", _armor("slot.armor.chest", 8, 730, "armor_torso")),
    "infernal_leggings": ("Infernal Greaves", "equipment", _armor("slot.armor.legs", 6, 680, "armor_legs")),
    "infernal_boots": ("Infernal Boots", "equipment", _armor("slot.armor.feet", 3, 590, "armor_feet")),
    "vestment_helmet": ("Scripture Cowl", "equipment", _armor("slot.armor.head", 2, 220, "armor_head")),
    "vestment_chestplate": ("Scripture Vestment", "equipment", _armor("slot.armor.chest", 6, 320, "armor_torso")),
    "vestment_leggings": ("Scripture Leggings", "equipment", _armor("slot.armor.legs", 5, 300, "armor_legs")),
    "vestment_boots": ("Scripture Sandals", "equipment", _armor("slot.armor.feet", 2, 260, "armor_feet")),
    "ranger_helmet": ("Ranger's Hood", "equipment", _armor("slot.armor.head", 2, 165, "armor_head")),
    "ranger_chestplate": ("Ranger's Jerkin", "equipment", _armor("slot.armor.chest", 5, 240, "armor_torso")),
    "ranger_leggings": ("Ranger's Leggings", "equipment", _armor("slot.armor.legs", 4, 225, "armor_legs")),
    "ranger_boots": ("Ranger's Boots", "equipment", _armor("slot.armor.feet", 1, 195, "armor_feet")),
    "crimson_helmet": ("Crimson Valkyrie Helm", "equipment", _armor("slot.armor.head", 3, 480, "armor_head")),
    "crimson_chestplate": ("Crimson Valkyrie Cuirass", "equipment",
                           _armor("slot.armor.chest", 8, 700, "armor_torso")),
    "crimson_leggings": ("Crimson Valkyrie Tassets", "equipment", _armor("slot.armor.legs", 6, 655, "armor_legs")),
    "crimson_boots": ("Crimson Valkyrie Greaves", "equipment", _armor("slot.armor.feet", 3, 570, "armor_feet")),
    "kilineyram": ("Demonic Sword Kilineyram", "equipment", _weapon(11, _cooldown("overlord_kilineyram", 10.0))),
    "safarlisia": ("Holy Sword Safarlisia", "equipment", _weapon(10, _cooldown("overlord_safarlisia", 8.0))),
    "takemikazuchi": ("Takemikazuchi Mk 8", "equipment", _weapon(13, _cooldown("overlord_kings", 9.0))),
    "fell_iron": ("War Pick Fell Iron", "equipment", _weapon(9, _cooldown("overlord_fracture", 8.0),
                                                            rarity="rare")),
    "bow_of_houyi": ("Bow of Houyi", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:hand_equipped": True, "minecraft:rarity": "epic",
        "minecraft:can_destroy_in_creative": False, "minecraft:glint": True,
        **_cooldown("overlord_houyi", 0.8)}),
    "command_banner": ("Command Banner", "equipment", {"minecraft:max_stack_size": 1,
                                                       "minecraft:hand_equipped": True}),
    "grimoire": ("Grimoire", "equipment", {"minecraft:max_stack_size": 1, "minecraft:rarity": "rare"}),
    # Read to gain a skill point (at most ten in all); dropped by world bosses, dragons and Tomb Raids.
    "codex_of_skills": ("Codex of the Supreme Beings", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "epic", "minecraft:glint": True}),
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
    **{f"rune_of_{kind}": (f"Rune of {kind.capitalize()}", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "rare"}) for kind in ("fire", "frost", "storm", "life")},
    # v7.5 gear upgrades: refining raises an item's quality, gems are set into its sockets (gear.js).
    "refining_stone": ("Refining Stone", "items", {"minecraft:max_stack_size": 64, "minecraft:rarity": "uncommon"}),
    # v7.6.1: a testing aid that only works in creative mode (devtools.js); not craftable.
    "ascension_tome": ("Creative Tome of Ascension", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True}),
    # v7.5.5: opens (and leads back out of) the Great Tomb of Nazarick (dungeon.js).
    "tomb_key": ("Key of the Great Tomb", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_tomb_key", 3.0)}),
    # v8.0: the seal of a founded kingdom; using it opens the Sorcerer Kingdom (kingdom.js). Earned in the campaign.
    "royal_seal": ("Seal of the Sorcerer Kingdom", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_royal_seal", 1.0)}),
    # v8.6: the dead of the plains and the Destroyer Tree
    "ghoul_fang": ("Ghoul Fang", "items", {"minecraft:max_stack_size": 64}),
    "spectral_iron": ("Spectral Iron", "items", {"minecraft:max_stack_size": 64, "minecraft:rarity": "uncommon"}),
    "heartwood": ("Heartwood of the Destroyer", "items", {"minecraft:max_stack_size": 64, "minecraft:rarity": "rare"}),
    "cavalier_lance": ("Lance of the Death Cavalier", "equipment", _weapon(12, rarity="rare")),
    "ghoulfang_sickle": ("Ghoulfang Sickle", "equipment", _weapon(9, rarity="rare")),
    "heartwood_staff": ("Heartwood Staff", "equipment", _weapon(6)),
    "cavalier_helmet": ("Death Cavalier Helm", "equipment", _armor("slot.armor.head", 3, 520, "armor_head")),
    "cavalier_chestplate": ("Death Cavalier Cuirass", "equipment", _armor("slot.armor.chest", 8, 760, "armor_torso")),
    "cavalier_leggings": ("Death Cavalier Greaves", "equipment", _armor("slot.armor.legs", 6, 700, "armor_legs")),
    "cavalier_boots": ("Death Cavalier Sabatons", "equipment", _armor("slot.armor.feet", 3, 600, "armor_feet")),
    # v8.1 steeds (steeds.js): call your mount, and armour for it.
    "wyrm_whistle": ("Whistle of the Nazarick Wyrm", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_wyrm_whistle", 1.0)}),
    "soul_reins": ("Reins of the Soul Eater", "equipment", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "rare", **_cooldown("overlord_soul_reins", 1.0)}),
    "adamantite_barding": ("Adamantite Barding", "equipment", {"minecraft:max_stack_size": 1, "minecraft:rarity": "uncommon"}),
    "nazarick_barding": ("Barding of Nazarick", "equipment", {"minecraft:max_stack_size": 1, "minecraft:rarity": "epic",
                                                              "minecraft:glint": True}),
    **{f"gem_{gem}": (title, "items", {"minecraft:max_stack_size": 16, "minecraft:rarity": "rare"})
       for gem, title in (("ruby", "Ruby of Embers"), ("sapphire", "Sapphire of Frost"), ("topaz", "Topaz of Storms"),
                          ("jade", "Jade of Venom"), ("onyx", "Onyx of Night"), ("sunstone", "Sunstone"))},
    "platinum_scale": ("Platinum Dragon Scale", "items", {"minecraft:max_stack_size": 64, "minecraft:rarity": "rare"}),
    "platinum_helmet": ("Platinum Helm", "equipment", _armor("slot.armor.head", 3, 520, "armor_head")),
    "platinum_chestplate": ("Platinum Cuirass", "equipment", _armor("slot.armor.chest", 8, 760, "armor_torso")),
    "platinum_leggings": ("Platinum Greaves", "equipment", _armor("slot.armor.legs", 6, 710, "armor_legs")),
    "platinum_boots": ("Platinum Boots", "equipment", _armor("slot.armor.feet", 3, 620, "armor_feet")),
    "martial_lord_club": ("Martial Lord's Club", "equipment", _weapon(14, _cooldown("overlord_roar", 12.0))),
    "elf_kings_staff": ("Staff of the Elf King", "equipment", _weapon(6, _cooldown("overlord_elemental", 60.0))),
    # World Items
    "depiction_of_nature": ("Depiction of Nature and Society", "items", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_depiction", 300.0)}),
    "avarice_and_generosity": ("Avarice and Generosity", "items", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_avarice", 5.0)}),
    "longinus": ("Longinus", "items", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_scroll", 1.5)}),
    "basilisk_eye": ("Basilisk Eye", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "rare", **_cooldown("overlord_scroll", 1.5)}),
    "dragon_bone": ("Dragon Bone", "items", {"minecraft:max_stack_size": 64}),
    "beast_hide": ("Beast Hide", "items", {"minecraft:max_stack_size": 64}),
    "orb_of_death": ("Orb of Death", "items", {
        "minecraft:max_stack_size": 1, "minecraft:rarity": "epic", "minecraft:glint": True,
        **_cooldown("overlord_orb", 45.0)}),
    "giants_maul": ("Frost Giant's Maul", "equipment", _weapon(13, _cooldown("overlord_quake", 10.0))),
    "dragonbone_blade": ("Dragonbone Greatsword", "equipment", _weapon(12, rarity="rare")),
    "six_arms_knuckles": ("Knuckles of the Six Arms", "equipment", _weapon(9, _cooldown("overlord_flurry", 8.0))),
    "bonedragon_helmet": ("Bone Dragon Helm", "equipment", _armor("slot.armor.head", 3, 480, "armor_head")),
    "bonedragon_chestplate": ("Bone Dragon Cuirass", "equipment", _armor("slot.armor.chest", 8, 700, "armor_torso")),
    "bonedragon_leggings": ("Bone Dragon Greaves", "equipment", _armor("slot.armor.legs", 6, 650, "armor_legs")),
    "bonedragon_boots": ("Bone Dragon Boots", "equipment", _armor("slot.armor.feet", 3, 560, "armor_feet")),
    "beasthide_helmet": ("Beast Hide Hood", "equipment", _armor("slot.armor.head", 2, 200, "armor_head")),
    "beasthide_chestplate": ("Beast Hide Jerkin", "equipment", _armor("slot.armor.chest", 5, 290, "armor_torso")),
    "beasthide_leggings": ("Beast Hide Leggings", "equipment", _armor("slot.armor.legs", 4, 270, "armor_legs")),
    "beasthide_boots": ("Beast Hide Boots", "equipment", _armor("slot.armor.feet", 2, 240, "armor_feet")),
    "sigil_of_ainz": ("Sigil of Ainz Ooal Gown", "items", {
        "minecraft:max_stack_size": 16, "minecraft:rarity": "epic", "minecraft:glint": True}),
}

# v7.2: weapons that had no art of their own now have one (see behavior_pack/scripts/arms.js).
WEAPON_ARTS = {
    "spuit_lance": ("overlord_blood_lance", 8.0),
    "god_slaying_emperor_blade": ("overlord_azure_draw", 8.0),
    "death_knight_sword": ("overlord_undead_wrath", 10.0),
    "dark_warrior_greatsword": ("overlord_blade_storm", 9.0),
    "razor_edge": ("overlord_fourfold", 7.0),
    "stiletto": ("overlord_stored_spell", 8.0),
    "iron_gauntlets": ("overlord_dragon_fist", 8.0),
    "fang_dagger": ("overlord_pounce", 7.0),
    "angel_mace": ("overlord_judgement", 10.0),
    "blade_bug": ("overlord_swarm", 9.0),
    "dragonbone_blade": ("overlord_dragon_cleave", 9.0),
    "cavalier_lance": ("overlord_death_charge", 9.0),
    "ghoulfang_sickle": ("overlord_rend", 7.0),
    "heartwood_staff": ("overlord_roots", 8.0),
}
for _key, (_category, _seconds) in WEAPON_ARTS.items():
    ITEMS[_key][2].update(_cooldown(_category, _seconds))
for _piece in ("helmet", "chestplate", "leggings", "boots"):
    ITEMS[f"world_champion_{_piece}"][2]["minecraft:rarity"] = "epic"
    ITEMS[f"infernal_{_piece}"][2]["minecraft:rarity"] = "epic"
    ITEMS[f"bonedragon_{_piece}"][2]["minecraft:rarity"] = "epic"
    ITEMS[f"platinum_{_piece}"][2]["minecraft:rarity"] = "epic"
    ITEMS[f"platinum_{_piece}"][2]["minecraft:repairable"] = {"repair_items": [
        {"items": [oid("platinum_scale")], "repair_amount": "query.max_durability * 0.25"}]}
    ITEMS[f"bonedragon_{_piece}"][2]["minecraft:repairable"] = {"repair_items": [
        {"items": [oid("dragon_bone")], "repair_amount": "query.max_durability * 0.25"}]}
    ITEMS[f"beasthide_{_piece}"][2]["minecraft:rarity"] = "uncommon"
    ITEMS[f"beasthide_{_piece}"][2]["minecraft:repairable"] = {"repair_items": [
        {"items": [oid("beast_hide")], "repair_amount": "query.max_durability * 0.25"}]}
    ITEMS[f"vestment_{_piece}"][2]["minecraft:repairable"] = {"repair_items": [
        {"items": [oid("blessed_cloth")], "repair_amount": "query.max_durability * 0.25"}]}
    ITEMS[f"ranger_{_piece}"][2]["minecraft:rarity"] = "uncommon"
    ITEMS[f"ranger_{_piece}"][2]["minecraft:repairable"] = {"repair_items": [
        {"items": ["minecraft:leather"], "repair_amount": "query.max_durability * 0.25"}]}
    ITEMS[f"crimson_{_piece}"][2]["minecraft:rarity"] = "epic"
    ITEMS[f"dragonscale_{_piece}"][2]["minecraft:rarity"] = "epic"
    ITEMS[f"dragonscale_{_piece}"][2]["minecraft:repairable"] = {"repair_items": [
        {"items": [oid("frost_dragon_scale")], "repair_amount": "query.max_durability * 0.25"}]}
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
        **{f"vestment_{piece}": _shaped(f"vestment_{piece}", pattern, {"A": oid("blessed_cloth")},
                                        oid(f"vestment_{piece}"))
           for piece, pattern in (("helmet", ["AAA", "A A"]), ("chestplate", ["A A", "AAA", "AAA"]),
                                  ("leggings", ["AAA", "A A", "A A"]), ("boots", ["A A", "A A"]))},
        **{f"{kind}_{piece}": _shaped(f"{kind}_{piece}", pattern, {"A": oid(mat)}, oid(f"{kind}_{piece}"))
           for kind, mat in (("bonedragon", "dragon_bone"), ("beasthide", "beast_hide"),
                             ("platinum", "platinum_scale"))
           for piece, pattern in (("helmet", ["AAA", "A A"]), ("chestplate", ["A A", "AAA", "AAA"]),
                                  ("leggings", ["AAA", "A A", "A A"]), ("boots", ["A A", "A A"]))},
        "tomb_key": _shaped("tomb_key", ["BCB", "CKC", "BCB"], {
            "B": oid("nazarick_bricks"), "C": cry, "K": oid("guardian_crest")}, oid("tomb_key"), unlock=oid("guardian_crest")),
        "cavalier_lance": _shaped("cavalier_lance", ["  I", " I ", "S  "], {"I": oid("spectral_iron"), "S": "minecraft:stick"},
                                  oid("cavalier_lance")),
        "ghoulfang_sickle": _shaped("ghoulfang_sickle", ["FF", " I", " S"], {
            "F": oid("ghoul_fang"), "I": oid("spectral_iron"), "S": "minecraft:stick"}, oid("ghoulfang_sickle")),
        "heartwood_staff": _shaped("heartwood_staff", ["C", "H", "H"], {"C": cry, "H": oid("heartwood")}, oid("heartwood_staff"),
                                   unlock=oid("heartwood")),
        **{f"cavalier_{piece}": _shaped(f"cavalier_{piece}", pattern, {"A": oid("spectral_iron")}, oid(f"cavalier_{piece}"))
           for piece, pattern in (("helmet", ["AAA", "A A"]), ("chestplate", ["A A", "AAA", "AAA"]),
                                  ("leggings", ["AAA", "A A", "A A"]), ("boots", ["A A", "A A"]))},
        "wyrm_whistle": _shaped("wyrm_whistle", ["BSB", "SKS", "BSB"], {
            "B": oid("dragon_bone"), "S": oid("frost_dragon_scale"), "K": oid("guardian_crest")}, oid("wyrm_whistle"),
            unlock=oid("frost_dragon_scale")),
        "soul_reins": _shaped("soul_reins", ["LSL", "SCS", "LSL"], {
            "L": "minecraft:leather", "S": oid("soul_fragment"), "C": cry}, oid("soul_reins"), unlock=oid("soul_fragment")),
        "adamantite_barding": _shaped("adamantite_barding", ["A A", "AAA", "A A"], {"A": oid("adamantite_ingot")},
                                      oid("adamantite_barding")),
        "nazarick_barding": _shaped("nazarick_barding", ["SCS", "CBC", "SCS"], {
            "S": oid("soul_fragment"), "C": cry, "B": oid("adamantite_barding")}, oid("nazarick_barding"),
            unlock=oid("adamantite_barding")),
        "refining_stone": _shapeless("refining_stone", [oid("adamantite_ingot"), cry, cry, "minecraft:stone"],
                                     oid("refining_stone"), count=2),
        **{f"gem_{gem}": _shapeless(f"gem_{gem}", [cry, cry, cry, cry, oid("refining_stone"), core], oid(f"gem_{gem}"))
           for gem, core in (("ruby", "minecraft:redstone_block"), ("sapphire", "minecraft:lapis_lazuli"),
                             ("topaz", "minecraft:gold_ingot"), ("jade", "minecraft:emerald"),
                             ("onyx", "minecraft:obsidian"), ("sunstone", "minecraft:glowstone"))},
        **{f"rune_of_{kind}": _shaped(f"rune_of_{kind}", [" C ", "CXC", " C "], {"C": cry, "X": core},
                                      oid(f"rune_of_{kind}"))
           for kind, core in (("fire", "minecraft:blaze_powder"), ("frost", "minecraft:packed_ice"),
                              ("storm", "minecraft:copper_ingot"), ("life", "minecraft:golden_apple"))},
        "dragonbone_blade": _shaped("dragonbone_blade", ["B", "B", "S"], {
            "B": oid("dragon_bone"), "S": "minecraft:stick"}, oid("dragonbone_blade")),
        **{f"infernal_{piece}": _shapeless(f"infernal_{piece}", [
            oid(f"dark_warrior_{piece}"), oid("demon_heart"), "minecraft:magma"],
            oid(f"infernal_{piece}")) for piece in ("helmet", "chestplate", "leggings", "boots")},
        "angel_mace": _shaped("angel_mace", ["F", "G", "S"], {
            "F": oid("angel_feather"), "G": "minecraft:gold_block", "S": "minecraft:stick"}, oid("angel_mace")),
        **{f"ranger_{piece}": _shaped(f"ranger_{piece}", pattern, {"A": "minecraft:leather"},
                                      oid(f"ranger_{piece}"))
           for piece, pattern in (("helmet", ["AAA", "A A"]), ("chestplate", ["A A", "AAA", "AAA"]),
                                  ("leggings", ["AAA", "A A", "A A"]), ("boots", ["A A", "A A"]))},
        **{f"crimson_{piece}": _shapeless(f"crimson_{piece}", [
            oid(f"dark_warrior_{piece}"), oid("vampire_fang"), oid("vampire_fang"), "minecraft:redstone_block"],
            oid(f"crimson_{piece}")) for piece in ("helmet", "chestplate", "leggings", "boots")},
        "kilineyram": _shaped("kilineyram", ["F", "A", "S"], {
            "F": oid("soul_fragment"), "A": ing, "S": "minecraft:stick"}, oid("kilineyram")),
        "safarlisia": _shaped("safarlisia", ["G", "A", "S"], {
            "G": "minecraft:gold_block", "A": ing, "S": "minecraft:stick"}, oid("safarlisia")),
        "takemikazuchi": _shaped("takemikazuchi", ["K", "A", "S"], {
            "K": oid("guardian_crest"), "A": ing, "S": "minecraft:stick"}, oid("takemikazuchi")),
        "fell_iron": _shaped("fell_iron", ["IAI", " S ", " S "], {
            "I": "minecraft:iron_block", "A": ing, "S": "minecraft:stick"}, oid("fell_iron")),
        "bow_of_houyi": _shaped("bow_of_houyi", [" BT", "B T", " BT"], {
            "B": "minecraft:blaze_rod", "T": "minecraft:string"}, oid("bow_of_houyi")),
        "dragonscale_helmet": _shaped("dragonscale_helmet", ["AAA", "A A"], {"A": oid("frost_dragon_scale")}, oid("dragonscale_helmet")),
        "dragonscale_chestplate": _shaped("dragonscale_chestplate", ["A A", "AAA", "AAA"], {"A": oid("frost_dragon_scale")},
                                          oid("dragonscale_chestplate")),
        "dragonscale_leggings": _shaped("dragonscale_leggings", ["AAA", "A A", "A A"], {"A": oid("frost_dragon_scale")},
                                        oid("dragonscale_leggings")),
        "dragonscale_boots": _shaped("dragonscale_boots", ["A A", "A A"], {"A": oid("frost_dragon_scale")}, oid("dragonscale_boots")),
        "troll_elixir": _shapeless("troll_elixir", [
            "minecraft:glass_bottle", oid("troll_blood"), cry], oid("troll_elixir")),
        "fang_dagger": _shaped("fang_dagger", ["F", "F", "S"], {
            "F": oid("vampire_fang"), "S": "minecraft:stick"}, oid("fang_dagger")),
        "command_banner": _shaped("command_banner", ["WW", "SW", "S "], {
            "W": "minecraft:red_wool", "S": "minecraft:stick"}, oid("command_banner")),
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
    "minecraft:cod", "minecraft:bread", "minecraft:arrow", "minecraft:red_wool", "minecraft:blue_ice",
    "minecraft:coal", "minecraft:netherrack", "minecraft:quartz_block", "minecraft:blaze_powder",
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
        "hellhound": [_pool(_entry(coin, 0, 2)), _pool(_entry("minecraft:blaze_powder", 0, 1))],
        "shadow_demon": [_pool(_entry(coin, 0, 2)), _pool(_entry(cry, 0, 1))],
        "evil_lord_wrath": [_pool(_entry(oid("demon_heart"), 3, 5, looting=False)), one(oid("hellfire_blade")),
                            one(crest), _pool(_entry(cry, 6, 10)), _pool(_entry(coin, 30, 48))],
        "archangel_flame": [_pool(_entry(oid("angel_feather"), 0, 2))],
        "dominion_authority": [_pool(_entry(oid("angel_feather"), 6, 10, looting=False)), one(crest),
                               _pool(_entry(cry, 6, 10)), _pool(_entry(coin, 30, 48))],
        "theocracy_priest": [_pool(_entry(oid("blessed_cloth"), 0, 2)), _pool(_entry(coin, 1, 3))],
        "nigun": [one(oid("sealing_crystal")), _pool(_entry(oid("blessed_cloth"), 3, 6, looting=False)),
                  _pool(_entry(coin, 10, 20))],
        "climb": [_pool(_entry("minecraft:iron_ingot", 1, 3))],
        "lakyus": [_pool(_entry("minecraft:gold_ingot", 1, 3))],
        "go_gin": [one(oid("martial_lord_club")), _pool(_entry(crest, 1, 1, looting=False)), _pool(_entry(coin, 15, 25))],
        "elf_ranger": [_pool(_entry("minecraft:arrow", 0, 3)), _pool(_entry(coin, 0, 2))],
        "decem": [one(oid("elf_kings_staff")), _pool(_entry(crest, 2, 2, looting=False)), _pool(_entry(cry, 8, 12)),
                  _pool(_entry(coin, 14, 24))],
        "behemoth": [_pool(_entry("minecraft:stone", 2, 5)), _pool(_entry(coin, 3, 8))],
        "neia": [_pool(_entry("minecraft:arrow", 2, 6))],
        "remedios": [_pool(_entry("minecraft:gold_ingot", 1, 3))],
        "paladin": [_pool(_entry("minecraft:iron_ingot", 0, 2))],
        "bafolk": [_pool(_entry(oid("beast_hide"), 0, 2)), _pool(_entry(coin, 0, 2))],
        "eight_edge_assassin": [_pool(_entry(oid("soul_fragment"), 0, 2)), _pool(_entry(cry, 1, 2))],
        "platinum_dragon_lord": [_pool(_entry(oid("codex_of_skills"), 2, 2, looting=False)),
                                 _pool(_entry(oid("platinum_scale"), 10, 14, looting=False)),
                                 one(oid("avarice_and_generosity")), _pool(_entry(crest, 4, 4, looting=False)),
                                 _pool(_entry(cry, 12, 18)), _pool(_entry(coin, 24, 36))],
        "rubedo": [one(oid("longinus")), _pool(_entry(crest, 4, 4, looting=False)), _pool(_entry(cry, 14, 20)),
                   _pool(_entry(coin, 30, 40))],
        "skeletal_dragon": [_pool(_entry(oid("codex_of_skills"), 1, 1, looting=False)),
                            _pool(_entry(oid("dragon_bone"), 8, 12, looting=False)),
                            _pool(_entry(crest, 2, 2, looting=False)), _pool(_entry(cry, 6, 10)),
                            _pool(_entry(coin, 12, 20))],
        "khajiit": [one(oid("orb_of_death")), _pool(_entry(oid("soul_fragment"), 2, 4)), _pool(_entry(coin, 6, 12))],
        "gigant_basilisk": [_pool(_entry(oid("basilisk_eye"), 1, 2, looting=False)),
                            _pool(_entry(oid("beast_hide"), 1, 3)), _pool(_entry(coin, 2, 5))],
        "ghoul": [_pool(_entry(oid("ghoul_fang"), 0, 2)), _pool(_entry("minecraft:rotten_flesh", 0, 2))],
        "wraith": [_pool(_entry(oid("soul_fragment"), 0, 2)), _pool(_entry(coin, 0, 2))],
        "death_cavalier": [
            _pool(_entry(oid("spectral_iron"), 1, 3)), _pool(_entry(coin, 3, 8)),
            _pool(_entry(oid("cavalier_lance"), 1, 1, looting=False), conditions=[
                {"condition": "killed_by_player"},
                {"condition": "random_chance_with_looting", "chance": 0.1, "looting_multiplier": 0.03}]),
        ],
        "treant_sapling": [_pool(_entry("minecraft:stick", 1, 4)), _pool(_entry("minecraft:oak_sapling", 0, 1))],
        "zytl_qae": [one(oid("codex_of_skills")), _pool(_entry(oid("heartwood"), 6, 10, looting=False)),
                     one(oid("heartwood_staff")), _pool(_entry(coin, 30, 50)), _pool(_entry(oid("data_crystal"), 8, 14))],
        "frost_giant": [
            _pool(_entry("minecraft:packed_ice", 1, 3)), _pool(_entry(coin, 1, 4)),
            _pool(_entry(oid("giants_maul"), 1, 1, looting=False), conditions=[
                {"condition": "killed_by_player"},
                {"condition": "random_chance_with_looting", "chance": 0.12, "looting_multiplier": 0.03}]),
        ],
        "beastman": [_pool(_entry(oid("beast_hide"), 0, 2)), _pool(_entry(coin, 0, 2))],
        "zero": [one(oid("six_arms_knuckles")), _pool(_entry(coin, 10, 20))],
        "dark_young": [_pool(_entry(oid("soul_fragment"), 6, 10, looting=False)),
                       _pool(_entry(crest, 2, 2, looting=False)), _pool(_entry(cry, 8, 12)),
                       _pool(_entry(coin, 14, 24))],
        "jaldabaoth": [_pool(_entry(oid("demon_heart"), 4, 6, looting=False)),
                       _pool(_entry(crest, 3, 3, looting=False)), _pool(_entry(cry, 10, 16)),
                       _pool(_entry(coin, 20, 30))],
        "zesshi": [one(oid("charons_guidance")), _pool(_entry(crest, 2, 2, looting=False)),
                   _pool(_entry(cry, 8, 12)), _pool(_entry(coin, 40, 64))],
        "frost_dragon": [_pool(_entry(oid("codex_of_skills"), 1, 1, looting=False)),
                         _pool(_entry(oid("frost_dragon_scale"), 8, 12, looting=False)),
                         _pool(_entry(crest, 2, 2, looting=False)), _pool(_entry(cry, 8, 14)),
                         _pool(_entry(coin, 40, 64)), _pool(_entry("minecraft:diamond", 2, 5))],
        "war_troll": [_pool(_entry(oid("troll_blood"), 1, 2)), _pool(_entry(coin, 2, 5)),
                      _pool(_entry("minecraft:leather", 0, 2))],
        "vampire_bride": [_pool(_entry(oid("vampire_fang"), 0, 2)), _pool(_entry(coin, 1, 3))],
        "adventurer": [_pool(_entry(coin, 1, 3)), _pool(_entry("minecraft:iron_ingot", 0, 1))],
        "guard": [_pool(_entry("minecraft:iron_ingot", 0, 2))],
        "soldier": [_pool(_entry("minecraft:iron_ingot", 0, 1)), _pool(_entry("minecraft:bread", 0, 1))],
        "archer": [_pool(_entry("minecraft:arrow", 0, 4))],
        "imperial_knight": [_pool(_entry("minecraft:iron_ingot", 0, 2)), _pool(_entry(coin, 0, 2))],
        "bandit": [_pool(_entry(coin, 0, 3)), _pool(_entry("minecraft:bread", 0, 1)),
                   _pool(_entry("minecraft:iron_ingot", 0, 1))],
        "empty": [],
    }
    return {f"loot_tables/entities/{NS}/{k}.json": {"pools": v} for k, v in t.items()}


def loot_path(name):
    return f"loot_tables/entities/{NS}/{name}.json"


# =============================================================== entities
def _is_family(value, subject="other"):
    return {"test": "is_family", "subject": subject, "value": value}


# Floor Guardians who can serve a crowned player (court.js), with the harm of their blows
GUARDIAN_COMPANIONS = {"albedo": 16, "shalltear": 15, "cocytus": 16, "demiurge": 12, "aura": 11, "mare": 11, "pandoras_actor": 13}


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
    c = _mob("nfirea", ["nfirea", "merchant", "mob"], 30, 0.25, (0.6, 1.9), xp=0)
    del c["minecraft:behavior.hurt_by_target"]
    c["minecraft:economy_trade_table"] = {
        "display_name": f"entity.{oid('nfirea')}.name",
        "table": f"trading/{NS}/nfirea.json", "new_screen": True}
    c["minecraft:behavior.trade_with_player"] = {"priority": 1, "filters": {"all_of": [
        {"test": "in_water", "value": False}, {"test": "on_ground", "value": True}]}}
    c["minecraft:behavior.look_at_trading_player"] = {"priority": 2}
    c["minecraft:behavior.panic"] = {"priority": 3, "speed_multiplier": 1.4}
    out["nfirea"] = _entity("nfirea", c)

    # --------------------------------------------------- Dwarf runesmith
    c = _mob("dwarf", ["dwarf", "merchant", "mob"], 40, 0.25, (0.6, 1.9), xp=0, scale=0.78, persistent=True)
    del c["minecraft:behavior.hurt_by_target"]
    c["minecraft:economy_trade_table"] = {
        "display_name": f"entity.{oid('dwarf')}.name",
        "table": f"trading/{NS}/dwarf.json", "new_screen": True}
    c["minecraft:behavior.trade_with_player"] = {"priority": 1, "filters": {"all_of": [
        {"test": "in_water", "value": False}, {"test": "on_ground", "value": True}]}}
    c["minecraft:behavior.look_at_trading_player"] = {"priority": 2}
    c["minecraft:behavior.panic"] = {"priority": 3, "speed_multiplier": 1.4}
    out["dwarf"] = _entity("dwarf", c)

    # ----------------------------------------------- Slane Theocracy and its angels
    def caster(name, families, health, projectile_id, lo, hi, radius, **kw):
        c = _mob(name, families, health, kw.pop("speed", 0.28), kw.pop("box", (0.7, 2.0)), loot=name, **kw)
        c["minecraft:shooter"] = {"def": projectile_id}
        c["minecraft:behavior.ranged_attack"] = {
            "priority": 3, "attack_interval_min": lo, "attack_interval_max": hi, "attack_radius": radius,
            "speed_multiplier": 1.0}
        c["minecraft:behavior.nearest_attackable_target"] = _target_players(28, [ally])
        return c

    def angel_call(cooldown, count, cap):
        return {"priority": 2, "summon_choices": [{
            "weight": 1, "cooldown_time": cooldown, "cast_duration": 2.0, "particle_color": "#FFFFF6C9",
            "start_sound_event": "cast.spell",
            "sequence": [{"shape": "circle", "target": "self", "base_delay": 1.5, "num_entities_spawned": count,
                          "entity_type": oid("archangel_flame"), "summon_cap": cap, "summon_cap_radius": 24.0,
                          "size": 2.0, "sound_event": "prepare.summon"}]}]}

    theocracy = ["theocracy", "human", "monster", "mob"]
    c = caster("theocracy_priest", ["theocracy_priest", *theocracy], 40, oid("magic_bullet"), 1.8, 3.0, 16.0, xp=15)
    c["minecraft:behavior.summon_entity"] = angel_call(25.0, 1, 2)
    out["theocracy_priest"] = _entity("theocracy_priest", c)

    c = caster("nigun", ["nigun", *theocracy], 180, oid("magic_bullet"), 1.2, 2.2, 20.0, xp=120, kb=0.4,
               persistent=True)
    c["minecraft:behavior.summon_entity"] = angel_call(18.0, 2, 4)
    out["nigun"] = _entity("nigun", c)

    c = _mob("archangel_flame", ["archangel_flame", "angel", "theocracy", "monster", "mob"], 50, 0.3, (0.7, 2.0),
             loot="archangel_flame", xp=15, kb=0.3, fire_immune=True)
    c["minecraft:attack"] = {"damage": 8}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.25, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally])
    c["minecraft:damage_sensor"] = _no_fall()
    out["archangel_flame"] = _entity("archangel_flame", c)

    c = caster("dominion_authority", ["dominion_authority", "angel", "theocracy", "monster", "mob"], 500,
               oid("lightning_bolt"), 1.2, 2.2, 26.0, xp=300, kb=1.0, scale=1.6, fire_immune=True, persistent=True,
               follow=40)
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": False}
    c["minecraft:damage_sensor"] = _no_fall()
    out["dominion_authority"] = _entity("dominion_authority", c)

    # --------------------------------------------------------------- demons
    demon = ["demon", "monster", "mob"]
    c = _mob("hellhound", ["hellhound", *demon], 45, 0.38, (0.9, 1.2), loot="hellhound", xp=18, kb=0.2,
             fire_immune=True)
    del c["minecraft:can_climb"]
    c["minecraft:attack"] = {"damage": 7}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.leap_at_target"] = {"priority": 2, "yd": 0.4, "must_be_on_ground": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(28, [ally, "human"])
    out["hellhound"] = _entity("hellhound", c)

    c = _mob("shadow_demon", ["shadow_demon", *demon], 35, 0.4, (0.6, 1.9), loot="shadow_demon", xp=14, scale=0.7,
             fire_immune=True)
    c["minecraft:attack"] = {"damage": 6}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally, "human"])
    out["shadow_demon"] = _entity("shadow_demon", c)

    c = _mob("evil_lord_wrath", ["evil_lord_wrath", *demon], 650, 0.26, (1.0, 2.2), loot="evil_lord_wrath", xp=400,
             scale=1.6, kb=1.0, follow=48, fire_immune=True, persistent=True)
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": True}
    c["minecraft:damage_sensor"] = _no_fall()
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(48, [ally, "human"])
    out["evil_lord_wrath"] = _entity("evil_lord_wrath", c, {
        "overlord:mode_switcher": {"minecraft:target_nearby_sensor": {
            "inside_range": 4.5, "outside_range": 6.5, "must_see": True,
            "on_inside_range": {"event": "overlord:switch_to_melee", "target": "self"},
            "on_outside_range": {"event": "overlord:switch_to_ranged", "target": "self"}}},
        "overlord:ranged_mode": {
            "minecraft:shooter": {"def": oid("fireball")},
            "minecraft:behavior.ranged_attack": {
                "priority": 3, "burst_shots": 2, "burst_interval": 0.4, "attack_interval_min": 2.5,
                "attack_interval_max": 4.0, "attack_radius": 26.0, "speed_multiplier": 1.0}},
        "overlord:melee_mode": {
            "minecraft:attack": {"damage": 20},
            "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.2, "track_target": True}},
    }, {
        "minecraft:entity_spawned": {"add": {"component_groups": ["overlord:mode_switcher",
                                                                   "overlord:ranged_mode"]}},
        "overlord:switch_to_melee": {"remove": {"component_groups": ["overlord:ranged_mode"]},
                                     "add": {"component_groups": ["overlord:melee_mode"]}},
        "overlord:switch_to_ranged": {"remove": {"component_groups": ["overlord:melee_mode"]},
                                      "add": {"component_groups": ["overlord:ranged_mode"]}},
    })

    # ------------------------------------------------- Zesshi, Climb, Eclair
    c = _mob("zesshi", ["zesshi", "theocracy", "human", "monster", "mob"], 600, 0.4, (0.7, 2.0), loot="zesshi",
             xp=500, kb=1.0, follow=48, persistent=True)
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": False}
    c["minecraft:attack"] = {"damage": 18}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:damage_sensor"] = {"triggers": [{"cause": "fall", "deals_damage": False},
                                                 {"cause": "all", "damage_multiplier": 0.7}]}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(48, [ally])
    out["zesshi"] = _entity("zesshi", c)

    out["climb"] = hunter("climb", "human", 70, 0.32, 8)

    c = _mob("eclair", ["eclair", "mob"], 20, 0.2, (0.5, 1.1), xp=0)
    del c["minecraft:behavior.hurt_by_target"]
    c["minecraft:behavior.panic"] = {"priority": 1, "speed_multiplier": 1.6}
    out["eclair"] = _entity("eclair", c)

    # ------------------------------------- War Troll, Vampire Bride, Frost Dragon
    c = _mob("war_troll", ["war_troll", "monster", "mob"], 120, 0.26, (0.9, 2.0), loot="war_troll", xp=40,
             scale=1.5, kb=0.8)
    c["minecraft:attack"] = {"damage": 13}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally])
    out["war_troll"] = _entity("war_troll", c)

    c = _mob("vampire_bride", ["vampire_bride", "nazarick", "undead", "monster", "mob"], 60, 0.36, (0.6, 1.9),
             loot="vampire_bride", xp=25, kb=0.2, undead=True)
    c["minecraft:attack"] = {"damage": 8}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally])
    out["vampire_bride"] = _entity("vampire_bride", c)

    c = _mob("frost_dragon", ["frost_dragon", "dragon", "monster", "mob"], 700, 0.26, DRAGON_BOX, loot="frost_dragon",
             xp=600, scale=1.4, kb=1.0, follow=48, persistent=True)
    del c["minecraft:can_climb"]
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": False}
    c["minecraft:damage_sensor"] = {"triggers": [
        {"cause": "fall", "deals_damage": False}, {"cause": "freezing", "deals_damage": False}]}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(48, [ally])
    out["frost_dragon"] = _entity("frost_dragon", c, {
        "overlord:mode_switcher": {"minecraft:target_nearby_sensor": {
            "inside_range": 4.5, "outside_range": 6.5, "must_see": True,
            "on_inside_range": {"event": "overlord:switch_to_melee", "target": "self"},
            "on_outside_range": {"event": "overlord:switch_to_ranged", "target": "self"}}},
        "overlord:ranged_mode": {
            "minecraft:shooter": {"def": oid("frost_breath")},
            "minecraft:behavior.ranged_attack": {
                "priority": 3, "burst_shots": 3, "burst_interval": 0.25, "attack_interval_min": 2.5,
                "attack_interval_max": 4.0, "attack_radius": 26.0, "speed_multiplier": 1.0}},
        "overlord:melee_mode": {
            "minecraft:attack": {"damage": 18, "effect_name": "slowness", "effect_duration": 4},
            "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.2,
                                                    "track_target": True}},
    }, {
        "minecraft:entity_spawned": {"add": {"component_groups": ["overlord:mode_switcher",
                                                                   "overlord:ranged_mode"]}},
        "overlord:switch_to_melee": {"remove": {"component_groups": ["overlord:ranged_mode"]},
                                     "add": {"component_groups": ["overlord:melee_mode"]}},
        "overlord:switch_to_ranged": {"remove": {"component_groups": ["overlord:melee_mode"]},
                                      "add": {"component_groups": ["overlord:ranged_mode"]}},
    })

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
    # ------------------------------------------- everyday NPCs: adventurer, guard
    hunt = {"priority": 2, "must_see": True, "reselect_targets": True,
            "entity_types": [{"filters": _is_family("monster"), "max_dist": 18}]}
    c = _mob("adventurer", ["adventurer", "human", "mob"], 50, 0.3, (0.7, 2.0), loot="adventurer", xp=10, kb=0.3)
    del c["minecraft:despawn"]
    c["minecraft:attack"] = {"damage": 7}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.25, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = hunt
    exp_groups, exp_events = _expire_parts()
    out["adventurer"] = _entity("adventurer", c, {
        "overlord:free": {
            "minecraft:despawn": {"despawn_from_distance": {}},
            "minecraft:tameable": {"probability": 0.34, "tame_items": [oid("yggdrasil_gold_coin")],
                                   "tame_event": {"event": "overlord:hired", "target": "self"}},
        },
        "overlord:hired": {
            "minecraft:is_tamed": {},
            "minecraft:persistent": {},
            "minecraft:behavior.follow_owner": {"priority": 4, "speed_multiplier": 1.2,
                                                "start_distance": 10, "stop_distance": 3},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
            "minecraft:timer": {"looping": False, "time": 600,
                                "time_down_event": {"event": "overlord:expire", "target": "self"}},
        },
        **exp_groups,
    }, {
        "minecraft:entity_spawned": {"add": {"component_groups": ["overlord:free"]}},
        "overlord:hired": {"remove": {"component_groups": ["overlord:free"]},
                           "add": {"component_groups": ["overlord:hired"]}},
        **exp_events,
    })

    c = _mob("guard", ["guard", "human", "mob"], 60, 0.3, (0.7, 2.0), loot="guard", xp=10, kb=0.5,
             persistent=True)
    c["minecraft:attack"] = {"damage": 8}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.25, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = hunt
    c["minecraft:home"] = {"restriction_radius": 24}
    out["guard"] = _entity("guard", c)

    # ---------------------------------------- low-level faction troops and bandits
    def troop(name, faction, enemy, health, damage, ranged=False, speed=0.3):
        c = _mob(name, [name, faction, "human", "mob"], health, speed, (0.7, 2.0), loot=name, xp=6, kb=0.2)
        targets = {"priority": 2, "must_see": True, "reselect_targets": True, "entity_types": [
            {"filters": _is_family("monster"), "max_dist": 16},
            {"filters": _is_family(enemy), "max_dist": 16}]}
        c["minecraft:behavior.nearest_attackable_target"] = targets
        c["minecraft:behavior.hurt_by_target"] = {"priority": 1, "alert_same_type": True}
        c["minecraft:home"] = {"restriction_radius": 20}
        if ranged:
            c["minecraft:shooter"] = {"def": "minecraft:arrow"}
            c["minecraft:behavior.ranged_attack"] = {
                "priority": 3, "attack_interval_min": 1.5, "attack_interval_max": 3.0,
                "attack_radius": 15.0, "speed_multiplier": 1.0}
        else:
            c["minecraft:attack"] = {"damage": damage}
            c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.25,
                                                        "track_target": True}
        return _entity(name, c)

    out["soldier"] = troop("soldier", "kingdom", "empire", 30, 5)
    out["archer"] = troop("archer", "kingdom", "empire", 24, 0, ranged=True)
    out["imperial_knight"] = troop("imperial_knight", "empire", "kingdom", 45, 7)

    c = _mob("bandit", ["bandit", "human", "monster", "mob"], 30, 0.32, (0.7, 2.0), loot="bandit", xp=8, kb=0.2)
    c["minecraft:attack"] = {"damage": 5}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.25, "track_target": True}
    c["minecraft:behavior.hurt_by_target"] = {"priority": 1, "alert_same_type": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(20, ["kingdom", "empire", "adventurer"])
    out["bandit"] = _entity("bandit", c)

    # ------------------------------------------------------ v5.0: the wider world
    c = _mob("skeletal_dragon", ["skeletal_dragon", "dragon", "undead", "monster", "mob"], 550, 0.28, DRAGON_BOX,
             loot="skeletal_dragon", xp=450, scale=1.4, kb=1.0, follow=48, persistent=True, undead=True)
    del c["minecraft:can_climb"]
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": False}
    c["minecraft:attack"] = {"damage": 16}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    # Its bones turn magic aside: spells do a quarter of their damage.
    c["minecraft:damage_sensor"] = {"triggers": [{"cause": "fall", "deals_damage": False},
                                                 {"cause": "magic", "damage_multiplier": 0.25}]}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(48, [ally, "human"])
    out["skeletal_dragon"] = _entity("skeletal_dragon", c)

    c = caster("khajiit", ["khajiit", "zurrernorn", "human", "monster", "mob"], 200, oid("negative_burst"), 1.6, 2.6,
               20.0, xp=150, kb=0.4, persistent=True)
    c["minecraft:behavior.summon_entity"] = {"priority": 2, "summon_choices": [{
        "weight": 1, "cooldown_time": 16.0, "cast_duration": 2.0, "particle_color": "#FF7A1FFF",
        "start_sound_event": "cast.spell",
        "sequence": [{"shape": "circle", "target": "self", "base_delay": 1.5, "num_entities_spawned": 2,
                      "entity_type": oid("old_guarder"), "summon_cap": 5, "summon_cap_radius": 24.0,
                      "size": 2.0, "sound_event": "prepare.summon"}]}]}
    out["khajiit"] = _entity("khajiit", c)

    c = _mob("gigant_basilisk", ["gigant_basilisk", "beast", "monster", "mob"], 160, 0.3, (1.4, 1.5),
             loot="gigant_basilisk", xp=60, scale=1.5, kb=0.8)
    del c["minecraft:can_climb"]
    c["minecraft:attack"] = {"damage": 10, "effect_name": "poison", "effect_duration": 6}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally, "human"])
    out["gigant_basilisk"] = _entity("gigant_basilisk", c)

    c = _mob("frost_giant", ["frost_giant", "giant", "monster", "mob"], 150, 0.26, (0.9, 2.0), loot="frost_giant",
             xp=50, scale=1.7, kb=0.9)
    c["minecraft:attack"] = {"damage": 13, "effect_name": "slowness", "effect_duration": 4}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:damage_sensor"] = {"triggers": [{"cause": "freezing", "deals_damage": False}]}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally, "human"])
    out["frost_giant"] = _entity("frost_giant", c)

    c = _mob("beastman", ["beastman", "monster", "mob"], 50, 0.34, (0.7, 2.0), loot="beastman", xp=14, kb=0.2)
    c["minecraft:attack"] = {"damage": 7}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.hurt_by_target"] = {"priority": 1, "alert_same_type": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally, "human"])
    out["beastman"] = _entity("beastman", c)

    out["lakyus"] = hunter("lakyus", "human", 140, 0.32, 11)

    c = _mob("enri", ["enri", "merchant", "mob"], 30, 0.25, (0.6, 1.9), xp=0, persistent=True)
    del c["minecraft:behavior.hurt_by_target"]
    c["minecraft:economy_trade_table"] = {
        "display_name": f"entity.{oid('enri')}.name",
        "table": f"trading/{NS}/enri.json", "new_screen": True}
    c["minecraft:behavior.trade_with_player"] = {"priority": 1, "filters": {"all_of": [
        {"test": "in_water", "value": False}, {"test": "on_ground", "value": True}]}}
    c["minecraft:behavior.look_at_trading_player"] = {"priority": 2}
    c["minecraft:behavior.panic"] = {"priority": 3, "speed_multiplier": 1.4}
    out["enri"] = _entity("enri", c)

    c = _mob("zero", ["zero", "bandit", "human", "monster", "mob"], 300, 0.36, (0.7, 2.0), loot="zero", xp=200,
             kb=0.8, follow=40, persistent=True)
    c["minecraft:boss"] = {"hud_range": 40, "should_darken_sky": False}
    c["minecraft:attack"] = {"damage": 14}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.4, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(32, ["kingdom", "empire", "adventurer"])
    out["zero"] = _entity("zero", c)

    c = _mob("dark_young", ["dark_young", "monster", "mob"], 800, 0.3, (2.2, 2.6), loot="dark_young", xp=700,
             scale=2.4, kb=1.0, follow=48, persistent=True)
    del c["minecraft:can_climb"]
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": True}
    c["minecraft:attack"] = {"damage": 22}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:damage_sensor"] = _no_fall()
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(48, [ally, "human"])
    out["dark_young"] = _entity("dark_young", c)

    c = _mob("jaldabaoth", ["jaldabaoth", "demon", "monster", "mob"], 900, 0.3, (0.8, 2.1), loot="jaldabaoth",
             xp=800, scale=1.3, kb=1.0, follow=48, fire_immune=True, persistent=True)
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": True}
    c["minecraft:damage_sensor"] = _no_fall()
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(48, [ally, "human"])
    out["jaldabaoth"] = _entity("jaldabaoth", c, {
        "overlord:mode_switcher": {"minecraft:target_nearby_sensor": {
            "inside_range": 4.5, "outside_range": 6.5, "must_see": True,
            "on_inside_range": {"event": "overlord:switch_to_melee", "target": "self"},
            "on_outside_range": {"event": "overlord:switch_to_ranged", "target": "self"}}},
        "overlord:ranged_mode": {
            "minecraft:shooter": {"def": oid("fireball")},
            "minecraft:behavior.ranged_attack": {
                "priority": 3, "burst_shots": 3, "burst_interval": 0.3, "attack_interval_min": 2.0,
                "attack_interval_max": 3.5, "attack_radius": 28.0, "speed_multiplier": 1.0}},
        "overlord:melee_mode": {
            "minecraft:attack": {"damage": 24},
            "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True}},
    }, {
        "minecraft:entity_spawned": {"add": {"component_groups": ["overlord:mode_switcher",
                                                                   "overlord:ranged_mode"]}},
        "overlord:switch_to_melee": {"remove": {"component_groups": ["overlord:ranged_mode"]},
                                     "add": {"component_groups": ["overlord:melee_mode"]}},
        "overlord:switch_to_ranged": {"remove": {"component_groups": ["overlord:melee_mode"]},
                                      "add": {"component_groups": ["overlord:ranged_mode"]}},
    })

    # ---------------------------------------------- v6.0: arena, elves, paladins
    def two_modes(shot, burst, melee_damage, radius=28.0):
        """Component groups and events for a boss that shoots from range and closes in to strike."""
        return ({
            "overlord:mode_switcher": {"minecraft:target_nearby_sensor": {
                "inside_range": 4.5, "outside_range": 6.5, "must_see": True,
                "on_inside_range": {"event": "overlord:switch_to_melee", "target": "self"},
                "on_outside_range": {"event": "overlord:switch_to_ranged", "target": "self"}}},
            "overlord:ranged_mode": {
                "minecraft:shooter": {"def": shot},
                "minecraft:behavior.ranged_attack": {
                    "priority": 3, "burst_shots": burst, "burst_interval": 0.3, "attack_interval_min": 2.0,
                    "attack_interval_max": 3.5, "attack_radius": radius, "speed_multiplier": 1.0}},
            "overlord:melee_mode": {
                "minecraft:attack": {"damage": melee_damage},
                "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.3,
                                                        "track_target": True}},
        }, {
            "minecraft:entity_spawned": {"add": {"component_groups": ["overlord:mode_switcher",
                                                                       "overlord:ranged_mode"]}},
            "overlord:switch_to_melee": {"remove": {"component_groups": ["overlord:ranged_mode"]},
                                         "add": {"component_groups": ["overlord:melee_mode"]}},
            "overlord:switch_to_ranged": {"remove": {"component_groups": ["overlord:melee_mode"]},
                                          "add": {"component_groups": ["overlord:ranged_mode"]}},
        })

    c = _mob("go_gin", ["go_gin", "arena", "monster", "mob"], 450, 0.3, (0.9, 2.0), loot="go_gin", xp=300,
             scale=1.7, kb=1.0, follow=40, persistent=True)
    c["minecraft:boss"] = {"hud_range": 40, "should_darken_sky": False}
    c["minecraft:attack"] = {"damage": 16}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(32, [ally])
    out["go_gin"] = _entity("go_gin", c)

    out["elf_ranger"] = troop("elf_ranger", "elf", "theocracy", 36, 0, ranged=True)
    out["neia"] = troop("neia", "holy_kingdom", "demon", 90, 0, ranged=True)
    out["paladin"] = troop("paladin", "holy_kingdom", "demon", 50, 8)
    out["remedios"] = hunter("remedios", "human", 160, 0.32, 13)

    c = _mob("decem", ["decem", "elf", "human", "monster", "mob"], 700, 0.36, (0.7, 2.0), loot="decem", xp=600,
             kb=1.0, follow=48, persistent=True)
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": False}
    c["minecraft:attack"] = {"damage": 20}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.summon_entity"] = {"priority": 2, "summon_choices": [{
        "weight": 1, "cooldown_time": 30.0, "cast_duration": 2.0, "particle_color": "#FF63FF6B",
        "start_sound_event": "cast.spell",
        "sequence": [{"shape": "circle", "target": "self", "base_delay": 1.5, "num_entities_spawned": 1,
                      "entity_type": oid("behemoth"), "summon_cap": 1, "summon_cap_radius": 32.0,
                      "size": 2.0, "sound_event": "prepare.summon"}]}]}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(48, [ally])
    out["decem"] = _entity("decem", c)

    c = _mob("behemoth", ["behemoth", "elemental", "monster", "mob"], 260, 0.26, (1.0, 2.2), loot="behemoth", xp=120,
             scale=1.9, kb=1.0)
    c["minecraft:attack"] = {"damage": 18}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(32, [ally, "human"])
    out["behemoth"] = _entity("behemoth", c)

    c = _mob("bafolk", ["bafolk", "monster", "mob"], 60, 0.33, (0.7, 2.0), loot="bafolk", xp=16, kb=0.3)
    c["minecraft:attack"] = {"damage": 8}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.hurt_by_target"] = {"priority": 1, "alert_same_type": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(24, [ally, "human"])
    out["bafolk"] = _entity("bafolk", c)

    c = _mob("eight_edge_assassin", ["eight_edge_assassin", "nazarick", "monster", "mob"], 90, 0.42, (1.0, 1.2),
             loot="eight_edge_assassin", xp=45, scale=1.2, kb=0.4)
    del c["minecraft:can_climb"]
    c["minecraft:attack"] = {"damage": 12}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.4, "track_target": True}
    c["minecraft:behavior.leap_at_target"] = {"priority": 2, "yd": 0.4, "must_be_on_ground": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(28, [ally, "human"])
    out["eight_edge_assassin"] = _entity("eight_edge_assassin", c)

    c = _mob("arena_master", ["arena_master", "empire", "mob"], 40, 0.2, (0.6, 1.9), xp=0, persistent=True)
    del c["minecraft:behavior.hurt_by_target"]
    c["minecraft:damage_sensor"] = {"triggers": [{"cause": "all", "deals_damage": False}]}
    out["arena_master"] = _entity("arena_master", c)

    c = _mob("platinum_dragon_lord", ["platinum_dragon_lord", "dragon", "monster", "mob"], 1200, 0.3, DRAGON_BOX,
             loot="platinum_dragon_lord", xp=1000, scale=1.6, kb=1.0, follow=48, persistent=True)
    del c["minecraft:can_climb"]
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": True}
    c["minecraft:damage_sensor"] = _no_fall()
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(48, [ally])
    groups, events = two_modes(oid("lightning_bolt"), 3, 26)
    out["platinum_dragon_lord"] = _entity("platinum_dragon_lord", c, groups, events)

    c = _mob("rubedo", ["rubedo", "nazarick", "monster", "mob"], 1500, 0.42, (0.7, 2.0), loot="rubedo", xp=1200,
             kb=1.0, follow=48, persistent=True)
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": True}
    c["minecraft:attack"] = {"damage": 30}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.4, "track_target": True}
    c["minecraft:damage_sensor"] = {"triggers": [{"cause": "fall", "deals_damage": False},
                                                 {"cause": "all", "damage_multiplier": 0.8}]}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(48, [ally])
    out["rubedo"] = _entity("rubedo", c)

    # --------------------------------------------------- retainers (party members)
    not_players = {"test": "is_family", "subject": "other", "operator": "!=", "value": "player"}
    follow = lambda start, stop: {"priority": 4, "speed_multiplier": 1.3, "start_distance": start,
                                  "stop_distance": stop}
    c = {
        "minecraft:is_hidden_when_invisible": {},
        "minecraft:type_family": {"family": ["retainer", ally, "human", "mob"]},
        "minecraft:collision_box": {"width": 0.6, "height": 1.9},
        "minecraft:health": {"value": 60, "max": 60},
        "minecraft:movement": {"value": 0.34},
        "minecraft:follow_range": {"value": 32, "max": 32},
        "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True,
                                      "can_pass_doors": True, "can_open_doors": True},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": False},
        "minecraft:persistent": {},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:tameable": {"probability": 0.0, "tame_items": [oid("guardian_crest")]},
        "minecraft:healable": {"items": [{"item": oid("red_potion"), "heal_amount": 20},
                                         {"item": "minecraft:bread", "heal_amount": 6}]},
        # Players cannot hurt retainers, and retainers never turn on players.
        "minecraft:damage_sensor": {"triggers": [
            {"cause": "fall", "deals_damage": False},
            {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "player"}},
             "deals_damage": False}]},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.hurt_by_target": {"priority": 1, "entity_types": [{"filters": not_players}]},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8.0, "probability": 0.02},
        "minecraft:behavior.random_look_around": {"priority": 8},
    }
    keep_away = lambda dist, priority: {"priority": priority, "entity_types": [{
        "filters": _is_family("monster"), "max_dist": dist, "walk_speed_multiplier": 1.2,
        "sprint_speed_multiplier": 1.4}]}
    shot = lambda lo, hi, radius: {"priority": 3, "attack_interval_min": lo, "attack_interval_max": hi,
                                   "attack_radius": radius, "speed_multiplier": 1.0}
    groups = {
        "overlord:voc_fighter": {
            "minecraft:attack": {"damage": 9},
            "minecraft:knockback_resistance": {"value": 0.6},
            "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True}},
        # Ranged vocations keep monsters at arm's length instead of standing in melee.
        "overlord:voc_archer": {"minecraft:shooter": {"def": "minecraft:arrow"},
                                "minecraft:behavior.ranged_attack": shot(0.9, 1.7, 18.0),
                                "minecraft:behavior.avoid_mob_type": keep_away(4, 2)},
        "overlord:voc_mage": {"minecraft:shooter": {"def": oid("magic_bullet")},
                              "minecraft:behavior.ranged_attack": shot(1.1, 2.0, 18.0),
                              "minecraft:behavior.avoid_mob_type": keep_away(4, 2)},
        "overlord:voc_healer": {"minecraft:shooter": {"def": oid("magic_bullet")},
                                "minecraft:behavior.ranged_attack": shot(2.5, 4.0, 14.0),
                                "minecraft:behavior.avoid_mob_type": keep_away(6, 2)},
        # Rogues are quick on their feet; bards hang back and sing.
        "overlord:voc_rogue": {
            "minecraft:attack": {"damage": 10},
            "minecraft:behavior.melee_box_attack": {"priority": 3, "speed_multiplier": 1.5, "track_target": True}},
        "overlord:voc_bard": {"minecraft:shooter": {"def": oid("magic_bullet")},
                              "minecraft:behavior.ranged_attack": shot(3.0, 4.5, 14.0),
                              "minecraft:behavior.avoid_mob_type": keep_away(5, 2)},
        # A badly hurt member backs well away from monsters until it has recovered (set by the script).
        "overlord:fall_back": {"minecraft:behavior.avoid_mob_type": keep_away(10, 1)},
        # stances
        "overlord:stance_come": {
            "minecraft:behavior.follow_owner": follow(5, 2),
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2}},
        "overlord:stance_go": {
            "minecraft:behavior.follow_owner": follow(14, 4),
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
            "minecraft:behavior.nearest_attackable_target": {
                "priority": 2, "must_see": True, "reselect_targets": True,
                "entity_types": [{"filters": _is_family("monster"), "max_dist": 18}]}},
        # Holding a spot still means defending it.
        "overlord:stance_stay": {
            "minecraft:behavior.nearest_attackable_target": {
                "priority": 2, "must_see": True, "reselect_targets": True,
                "entity_types": [{"filters": _is_family("monster"), "max_dist": 10}]}},
    }
    events = {"minecraft:entity_spawned": {"add": {"component_groups": ["overlord:stance_come"]}},
              "overlord:fall_back": {"add": {"component_groups": ["overlord:fall_back"]}}}
    # Rallying puts the vocation's own way of fighting back in place of the retreat.
    for v in VOCATIONS:
        events[f"overlord:rally_{v}"] = {"sequence": [
            {"remove": {"component_groups": ["overlord:fall_back", f"overlord:voc_{v}"]}},
            {"add": {"component_groups": [f"overlord:voc_{v}"]}}]}
    for n in range(RETAINER_LOOKS):
        groups[f"overlord:look_{n}"] = {"minecraft:variant": {"value": n}}
        events[f"overlord:look_{n}"] = {
            "remove": {"component_groups": [f"overlord:look_{k}" for k in range(RETAINER_LOOKS) if k != n] +
                                           [f"overlord:voc_{v}" for v in VOCATIONS if v != VOCATIONS[n // 2]]},
            "add": {"component_groups": [f"overlord:look_{n}", f"overlord:voc_{VOCATIONS[n // 2]}"]}}
    for stance in ("come", "go", "stay"):
        events[f"overlord:stance_{stance}"] = {
            "remove": {"component_groups": [f"overlord:stance_{k}" for k in ("come", "go", "stay") if k != stance]},
            "add": {"component_groups": [f"overlord:stance_{stance}"]}}
    out["retainer"] = _entity("retainer", c, groups, events, spawnable=False)

    # v8.6: the dead of the Katze Plains, the forest's treants, its dryad, and the Destroyer Tree
    undead_foes = _target_players(24, [ally, "human"])
    c = _mob("ghoul", ["ghoul", "undead", "monster", "mob"], 34, 0.34, (0.6, 1.9), loot="ghoul", xp=10, undead=True)
    c["minecraft:attack"] = {"damage": 5, "effect_name": "slowness", "effect_duration": 3}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.leap_at_target"] = {"priority": 2, "yd": 0.35, "must_be_on_ground": True}
    c["minecraft:behavior.hurt_by_target"] = {"priority": 1, "alert_same_type": True}
    c["minecraft:behavior.nearest_attackable_target"] = undead_foes
    out["ghoul"] = _entity("ghoul", c)

    c = _mob("wraith", ["wraith", "undead", "monster", "mob"], 30, 0.3, (0.6, 1.9), loot="wraith", xp=14, undead=True)
    c["minecraft:attack"] = {"damage": 6, "effect_name": "wither", "effect_duration": 3}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:damage_sensor"] = _no_fall()
    c["minecraft:behavior.nearest_attackable_target"] = undead_foes
    out["wraith"] = _entity("wraith", c)

    c = _mob("death_cavalier", ["death_cavalier", "undead", "monster", "mob"], 160, 0.3, (0.7, 2.0), loot="death_cavalier",
             xp=60, kb=0.7, undead=True)
    c["minecraft:attack"] = {"damage": 14}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.3, "track_target": True}
    c["minecraft:behavior.leap_at_target"] = {"priority": 2, "yd": 0.3, "must_be_on_ground": True}
    c["minecraft:behavior.nearest_attackable_target"] = undead_foes
    out["death_cavalier"] = _entity("death_cavalier", c)

    c = _mob("treant_sapling", ["treant", "monster", "mob"], 50, 0.22, (0.9, 2.0), loot="treant_sapling", xp=16, kb=0.6)
    c["minecraft:attack"] = {"damage": 7, "effect_name": "slowness", "effect_duration": 3}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.2, "track_target": True}
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(20, [ally])
    out["treant_sapling"] = _entity("treant_sapling", c)

    c = _mob("zytl_qae", ["zytl_qae", "treant", "monster", "mob"], 1300, 0.2, (0.9, 2.0), loot="zytl_qae", xp=900,
             kb=1.0, follow=48, persistent=True)
    del c["minecraft:can_climb"]
    c["minecraft:boss"] = {"hud_range": 55, "should_darken_sky": False}
    c["minecraft:attack"] = {"damage": 22}
    c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.1, "track_target": True}
    c["minecraft:damage_sensor"] = _no_fall()
    c["minecraft:behavior.nearest_attackable_target"] = _target_players(40, [ally])
    out["zytl_qae"] = _entity("zytl_qae", c)

    c = _mob("pinison", ["pinison", "merchant", "mob"], 40, 0.25, (0.6, 1.9), xp=0, persistent=True)
    del c["minecraft:behavior.hurt_by_target"]
    c["minecraft:economy_trade_table"] = {"display_name": f"entity.{oid('pinison')}.name",
                                          "table": f"trading/{NS}/pinison.json", "new_screen": True}
    c["minecraft:behavior.trade_with_player"] = {"priority": 1, "filters": {"all_of": [
        {"test": "in_water", "value": False}, {"test": "on_ground", "value": True}]}}
    c["minecraft:behavior.look_at_trading_player"] = {"priority": 2}
    c["minecraft:behavior.panic"] = {"priority": 3, "speed_multiplier": 1.4}
    out["pinison"] = _entity("pinison", c)

    # v8.1: steeds called with an item (steeds.js), which also flies the wyrm and drives the Soul Eater.
    for name, families, health, speed, box, scale, seat, flying in (
            ("wyrm_steed", ["wyrm_steed", "nazarick_ally", "mob"], 90, 0.3, (1.6, 1.3), 0.55, [0.0, 0.75, -0.1], True),
            ("soul_steed", ["soul_steed", "nazarick_ally", "undead", "mob"], 70, 0.34, (1.1, 1.3), 1.1, [0.0, 0.8, 0.1], False)):
        c = _mob(name, families, health, speed, box, xp=0, scale=scale, kb=0.6, persistent=True, fire_immune=True, undead=not flying)
        del c["minecraft:can_climb"]
        del c["minecraft:experience_reward"]
        c["minecraft:navigation.walk"] = {"can_path_over_water": True, "avoid_damage_blocks": True}
        c["minecraft:damage_sensor"] = _no_fall()
        c["minecraft:rideable"] = {"seat_count": 1, "crouching_skip_interact": True, "family_types": ["player"],
                                   "interact_text": "action.interact.ride.horse", "seats": {"position": seat}}
        c["minecraft:behavior.random_stroll"] = {"priority": 8, "speed_multiplier": 0.5}
        c["minecraft:variable_max_auto_step"] = {"base_value": 1.0625, "controlled_value": 1.5625, "jump_prevented_value": 0.5625}
        groups, events = {}, {}
        if flying:
            groups["overlord:airborne"] = {"minecraft:physics": {"has_gravity": False, "has_collision": True},
                                           "minecraft:movement": {"value": 0.0}}
            events = {"overlord:take_off": {"add": {"component_groups": ["overlord:airborne"]}},
                      "overlord:land": {"remove": {"component_groups": ["overlord:airborne"]}}}
        else:
            c["minecraft:input_ground_controlled"] = {}
        out[name] = _entity(name, c, groups, events, spawnable=False)

    # v8.5: the Floor Guardians as they serve a crowned player (court.js): at their side, or standing at
    # court in the capital (then still, and gone again after a while unless posted anew).
    for key, damage in GUARDIAN_COMPANIONS.items():
        base = out[key]["minecraft:entity"]["components"]
        name = f"guardian_{key}"
        box = base["minecraft:collision_box"]
        c = _mob(name, ["guardian", "nazarick_ally", "mob"], 300, 0.32, (box["width"], box["height"]), xp=0,
                 scale=base.get("minecraft:scale", {}).get("value"), kb=0.8, persistent=True, fire_immune=True)
        del c["minecraft:experience_reward"]
        c["minecraft:attack"] = {"damage": damage}
        c["minecraft:behavior.melee_box_attack"] = {"priority": 3, "speed_multiplier": 1.25, "track_target": True}
        c["minecraft:behavior.nearest_attackable_target"] = {"priority": 2, "must_see": True, "reselect_targets": True,
            "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "monster"}, "max_dist": 16}]}
        c["minecraft:tameable"] = {"probability": 1.0, "tame_items": [oid("ascension_tome")]}
        c["minecraft:behavior.follow_owner"] = {"priority": 4, "speed_multiplier": 1.3, "start_distance": 8, "stop_distance": 3}
        c["minecraft:behavior.owner_hurt_by_target"] = {"priority": 1}
        c["minecraft:behavior.owner_hurt_target"] = {"priority": 2}
        c["minecraft:damage_sensor"] = _no_fall()
        groups = {
            "overlord:court": {"minecraft:movement": {"value": 0.0},
                               "minecraft:timer": {"looping": False, "time": 150,
                                                   "time_down_event": {"event": "overlord:expire", "target": "self"}}},
            "overlord:despawn": {"minecraft:instant_despawn": {}},
        }
        groups["overlord:sortie"] = {"minecraft:timer": {"looping": False, "time": 420,
                                                        "time_down_event": {"event": "overlord:expire", "target": "self"}}}
        events = {"overlord:to_court": {"add": {"component_groups": ["overlord:court"]}},
                  "overlord:sortie": {"add": {"component_groups": ["overlord:sortie"]}},
                  "overlord:expire": {"add": {"component_groups": ["overlord:despawn"]}}}
        out[name] = _entity(name, c, groups, events, spawnable=False)

    _apply_ai(out)
    _resize(out)
    out["frost_breath"] = projectile("frost_breath", 0.4, {
        "impact_damage": {"damage": 10, "knockback": True, "semi_random_diff_damage": False},
        "mob_effect": {"effect": "slowness", "durationeasy": 60, "durationnormal": 100,
                       "durationhard": 140, "amplifier": 2},
        "remove_on_hit": {},
    }, {}, {})
    out["lightning_bolt"] = projectile("lightning_bolt", 0.3, {
        "impact_damage": {"damage": 9, "knockback": True, "semi_random_diff_damage": False},
        "remove_on_hit": {},
    }, {}, {})
    return {f"entities/{k}.json": v for k, v in out.items()}


# How large each creature stands.  The models are drawn two blocks tall, so 0.94 puts a grown man at the
# player's own height; everything else is sized against that.  People without an entry use 0.94.
SIZES = {
    # men and women of note
    "gazef": 1.0, "sebas": 0.98, "zero": 1.04, "brain": 0.96, "demiurge": 0.96, "pandoras_actor": 0.96,
    "albedo": 0.95, "narberal": 0.92, "lupusregina": 0.92, "solution": 0.93, "yuri": 0.93, "lakyus": 0.92,
    "remedios": 0.93, "vampire_bride": 0.92, "rubedo": 0.9, "nazarick_maid": 0.9, "clementine": 0.9, "enri": 0.9,
    "nfirea": 0.9, "climb": 0.92, "neia": 0.88, "zesshi": 0.86, "entoma": 0.86, "cz_delta": 0.86,
    # the small
    "shalltear": 0.8, "evileye": 0.78, "aura": 0.74, "mare": 0.74, "dwarf": 0.74, "goblin": 0.68,
    "shadow_demon": 0.8, "eclair": 0.9, "quagoa": 0.9,
    # the undead
    "ainz": 1.12, "death_knight": 1.4, "elder_lich": 0.96, "skeleton_mage": 0.92,
    # demi-humans
    "lizardman": 1.02, "zaryusu": 1.06, "beastman": 1.08, "bafolk": 1.0, "cocytus": 1.45,
    # the big
    "ogre": 1.5, "war_troll": 1.8, "go_gin": 2.0, "frost_giant": 2.3, "behemoth": 2.6, "gargantua": 3.0,
    "evil_lord_wrath": 1.9, "jaldabaoth": 1.3, "dominion_authority": 2.0, "archangel_flame": 1.0,
    # beasts
    "hamsuke": 1.5, "soul_eater": 1.2, "hellhound": 1.1, "eight_edge_assassin": 1.2, "gigant_basilisk": 2.0,
    "dark_young": 3.0, "treant_sapling": 1.25, "zytl_qae": 4.5, "death_cavalier": 1.05, "pinison": 0.86,
    # dragons
    # The dragons' own models are already more than eight blocks long before this is applied.
    "frost_dragon": 2.6, "skeletal_dragon": 2.8, "platinum_dragon_lord": 3.4,
}
# A dragon's hit box is its trunk, not its whole length: wide enough to be hit, narrow enough to walk.
DRAGON_BOX = (1.4, 2.0)


def _resize(out):
    for name in ("frost_dragon", "skeletal_dragon", "platinum_dragon_lord"):
        # v7.5.5: the dragons take to the air. dragons.js flies them; while aloft gravity is off and
        # their own legs stand still.
        e = out[name]["minecraft:entity"]
        e["component_groups"]["overlord:airborne"] = {
            "minecraft:physics": {"has_gravity": False, "has_collision": True},
            "minecraft:movement": {"value": 0.0}}
        e["events"]["overlord:take_off"] = {"add": {"component_groups": ["overlord:airborne"]}}
        e["events"]["overlord:land"] = {"remove": {"component_groups": ["overlord:airborne"]}}
        # Creatures this large step over ledges that would stop anything smaller.
        out[name]["minecraft:entity"]["components"]["minecraft:variable_max_auto_step"] = {
            "base_value": 2.0625, "controlled_value": 2.0625, "jump_prevented_value": 1.0625}
    for name, entity in out.items():
        c = entity["minecraft:entity"]["components"]
        if "minecraft:collision_box" not in c:
            continue
        scale = SIZES.get(name)
        if scale is None:
            if c["minecraft:collision_box"]["height"] < 1.9:
                continue
            scale = 0.94
        c["minecraft:scale"] = {"value": scale}


def _apply_ai(out):
    """Faction and behaviour tweaks layered over the basic definitions."""
    def parts(name, group=None):
        entity = out[name]["minecraft:entity"]
        return entity["component_groups"][group] if group else entity["components"]

    # Factions: monsters and Nazarick's rank and file also hunt the human NPCs.
    for name, group in (("death_knight", "overlord:wild"), ("goblin", "overlord:wild"), ("old_guarder", None),
                        ("elder_lich", None), ("skeleton_mage", None), ("soul_eater", None), ("ogre", None),
                        ("quagoa", None), ("clementine", None), ("war_troll", None),
                        ("vampire_bride", None), ("archangel_flame", None)):
        parts(name, group)["minecraft:behavior.nearest_attackable_target"]["entity_types"].append(
            {"filters": _is_family("human"), "max_dist": 16})

    # Creatures that tier magic can summon as allies get the same "summoned" form as Death Knights.
    for name, families in (("old_guarder", ["old_guarder", "nazarick_ally", "undead", "mob"]),
                           ("archangel_flame", ["archangel_flame", "nazarick_ally", "angel", "mob"]),
                           ("behemoth", ["behemoth", "nazarick_ally", "elemental", "mob"]),
                           ("ghoul", ["ghoul", "nazarick_ally", "undead", "mob"])):
        entity = out[name]["minecraft:entity"]
        entity["component_groups"]["overlord:summoned"] = {
            "minecraft:type_family": {"family": families},
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
            "minecraft:timer": {"looping": False, "time": 120,
                                "time_down_event": {"event": "overlord:expire", "target": "self"}},
        }
        entity["component_groups"]["overlord:despawn"] = {"minecraft:instant_despawn": {}}
        entity["events"]["overlord:become_summoned"] = {"add": {"component_groups": ["overlord:summoned"]}}
        entity["events"]["overlord:expire"] = {"add": {"component_groups": ["overlord:despawn"]}}

    # Climb serves the Kingdom as well.
    parts("climb")["minecraft:type_family"]["family"].insert(1, "kingdom")

    # Gazef and the village guards belong to the Kingdom, so Empire troops fight them too.
    for name in ("guard", "gazef"):
        parts(name)["minecraft:type_family"]["family"].insert(1, "kingdom")

    # Packs: hitting one member brings the others.
    for name in ("goblin", "old_guarder", "quagoa", "lizardman", "adventurer", "guard"):
        parts(name)["minecraft:behavior.hurt_by_target"] = {"priority": 1, "alert_same_type": True}

    # Casters back away when the player closes in, then resume firing.
    for name in ("elder_lich", "skeleton_mage", "fluder"):
        parts(name)["minecraft:behavior.avoid_mob_type"] = {"priority": 2, "entity_types": [{
            "filters": _is_family("player"), "max_dist": 4, "walk_speed_multiplier": 1.2,
            "sprint_speed_multiplier": 1.3}]}

    # Lesser skeletons burn in daylight like vanilla ones, so they do not pile up by day.
    for name in ("old_guarder", "skeleton_mage"):
        parts(name)["minecraft:burns_in_daylight"] = {}

    # A summoned Old Guarder serves by day as well: only the wild ones burn in sunlight.
    entity = out["old_guarder"]["minecraft:entity"]
    entity["component_groups"]["overlord:wild"] = {
        "minecraft:burns_in_daylight": entity["components"].pop("minecraft:burns_in_daylight")}
    entity["events"]["minecraft:entity_spawned"] = {"add": {"component_groups": ["overlord:wild"]}}
    entity["events"]["overlord:become_summoned"] = {"remove": {"component_groups": ["overlord:wild"]},
                                                    "add": {"component_groups": ["overlord:summoned"]}}

    parts("soul_eater")["minecraft:behavior.leap_at_target"] = {"priority": 2, "yd": 0.4,
                                                                "must_be_on_ground": True}
    # The Death Knight's tower shield turns aside half of all projectile damage.
    parts("death_knight")["minecraft:damage_sensor"]["triggers"].append(
        {"cause": "projectile", "damage_multiplier": 0.5})

    # Reputation: troops of a faction that has come to hate a player are told (by script) to attack players.
    for name in ("soldier", "archer", "guard", "imperial_knight", "adventurer", "lizardman"):
        entity = out[name]["minecraft:entity"]
        entity["component_groups"]["overlord:hostile"] = {"minecraft:behavior.nearest_attackable_target": {
            "priority": 2, "must_see": True, "reselect_targets": True, "entity_types": [
                {"filters": _is_family("player"), "max_dist": 20},
                {"filters": _is_family("monster"), "max_dist": 16}]}}
        entity["events"]["overlord:turn_hostile"] = {"add": {"component_groups": ["overlord:hostile"]}}
        entity["events"]["overlord:calm"] = {"remove": {"component_groups": ["overlord:hostile"]}}

    # Goblins lose their nerve and run once badly hurt.
    goblin = out["goblin"]["minecraft:entity"]
    goblin["component_groups"]["overlord:brave"] = {"minecraft:environment_sensor": {"triggers": [{
        "filters": {"test": "actor_health", "subject": "self", "operator": "<", "value": 6},
        "event": "overlord:flee", "target": "self"}]}}
    goblin["component_groups"]["overlord:fleeing"] = {"minecraft:behavior.avoid_mob_type": {
        "priority": 1, "entity_types": [{
            "filters": {"any_of": [_is_family("player"), _is_family("human")]}, "max_dist": 10,
            "walk_speed_multiplier": 1.3, "sprint_speed_multiplier": 1.4}]}}
    goblin["events"]["minecraft:entity_spawned"]["add"]["component_groups"].append("overlord:brave")
    goblin["events"]["overlord:flee"] = {"remove": {"component_groups": ["overlord:brave"]},
                                         "add": {"component_groups": ["overlord:fleeing"]}}


MOBS = ["ainz", "albedo", "shalltear", "cocytus", "demiurge", "sebas", "death_knight", "elder_lich",
        "hamsuke", "narberal", "pandoras_actor", "old_guarder", "aura", "mare", "gazef", "clementine",
        "nazarick_maid", "brain", "zaryusu", "cz_delta", "nfirea",
        "lupusregina", "entoma", "solution", "yuri", "goblin", "ogre",
        "skeleton_mage", "lizardman", "evileye", "fluder", "gargantua", "soul_eater", "quagoa",
        "adventurer", "guard", "soldier", "archer", "imperial_knight", "bandit",
        "war_troll", "vampire_bride", "dwarf", "frost_dragon",
        "hellhound", "shadow_demon", "evil_lord_wrath", "archangel_flame", "dominion_authority",
        "theocracy_priest", "nigun", "climb", "zesshi", "eclair",
        "skeletal_dragon", "khajiit", "gigant_basilisk", "frost_giant", "beastman", "lakyus", "enri", "zero",
        "dark_young", "jaldabaoth",
        "go_gin", "elf_ranger", "decem", "behemoth", "neia", "remedios", "paladin", "bafolk",
        "eight_edge_assassin", "arena_master", "platinum_dragon_lord", "rubedo",
        "ghoul", "wraith", "death_cavalier", "treant_sapling", "zytl_qae", "pinison"]
PROJECTILES = ["fireball", "negative_burst", "lightning_bolt", "magic_bullet", "crystal_shard", "frost_breath"]

ENTITY_NAMES = {
    "ghoul": "Ghoul", "wraith": "Wraith", "death_cavalier": "Death Cavalier", "treant_sapling": "Treant",
    "zytl_qae": "Zy'tl Q'ae, the Destroyer Tree", "pinison": "Pinison Pole Perlia",
    "guardian_albedo": "Albedo", "guardian_shalltear": "Shalltear Bloodfallen", "guardian_cocytus": "Cocytus",
    "guardian_demiurge": "Demiurge", "guardian_aura": "Aura Bella Fiora", "guardian_mare": "Mare Bello Fiore",
    "guardian_pandoras_actor": "Pandora's Actor",
    "wyrm_steed": "Nazarick Wyrm", "soul_steed": "Soul Eater Steed",
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
    "quagoa": "Quagoa", "crystal_shard": "Crystal Lance", "adventurer": "Adventurer",
    "hellhound": "Hellhound", "shadow_demon": "Shadow Demon", "evil_lord_wrath": "Evil Lord Wrath",
    "archangel_flame": "Archangel Flame", "dominion_authority": "Dominion Authority",
    "theocracy_priest": "Sunlight Scripture Priest", "nigun": "Nigun Grid Luin", "climb": "Climb",
    "zesshi": "Zesshi Zetsumei", "eclair": "Eclair",
    "skeletal_dragon": "Skeletal Dragon", "khajiit": "Khajiit Dale Badantel", "gigant_basilisk": "Gigant Basilisk",
    "frost_giant": "Frost Giant", "beastman": "Beastman Warrior", "lakyus": "Lakyus Alvein Dale Aindra",
    "enri": "Enri Emmot", "zero": "Zero of the Six Arms", "dark_young": "Dark Young", "jaldabaoth": "Jaldabaoth",
    "go_gin": "Go Gin the Martial Lord", "elf_ranger": "Elf Ranger", "decem": "Decem Hougan",
    "behemoth": "Primal Earth Elemental", "neia": "Neia Baraja", "remedios": "Remedios Custodio",
    "paladin": "Holy Kingdom Paladin", "bafolk": "Bafolk Raider", "eight_edge_assassin": "Eight-Edge Assassin",
    "arena_master": "Arena Master", "platinum_dragon_lord": "Platinum Dragon Lord", "rubedo": "Rubedo",
    "war_troll": "War Troll", "vampire_bride": "Vampire Bride", "dwarf": "Dwarf Runesmith",
    "frost_dragon": "Frost Dragon", "frost_breath": "Frost Breath",
    "retainer": "Retainer", "guard": "Kingdom Guard", "soldier": "Kingdom Soldier", "archer": "Kingdom Archer",
    "imperial_knight": "Imperial Knight", "bandit": "Bandit",
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
        sell(oid("soul_fragment"), 5), sell(oid("sealing_crystal"), 30, uses=4), sell(oid("tome_create_undead"), 28, uses=4),
        buy("minecraft:diamond", 1, 6), buy("minecraft:gold_ingot", 4, 5), buy("minecraft:bone", 16, 2),
    ]
    herbs = [
        sell(oid("red_potion"), 3), sell(oid("blue_potion"), 4), sell(oid("scroll_of_heavy_recover"), 6),
        sell("minecraft:golden_carrot", 3, qty=2), sell("minecraft:glistering_melon_slice", 4),
        sell(oid("troll_elixir"), 9), sell(oid("scroll_of_rebirth"), 18),
        buy("minecraft:nether_wart", 8, 3), buy("minecraft:wheat", 16, 2),
        buy("minecraft:glass_bottle", 8, 2), buy("minecraft:apple", 6, 2),
    ]
    forge = [
        sell(oid("adamantite_ingot"), 20), sell(oid("runic_hammer"), 60), sell("minecraft:iron_ingot", 6, qty=4),
        sell(oid("data_crystal"), 6), sell(oid("gilded_nazarick_bricks"), 8, qty=8),
        buy("minecraft:raw_iron", 8, 3), buy("minecraft:coal", 16, 2), buy("minecraft:diamond", 1, 7),
        buy("minecraft:gold_ingot", 4, 5), buy(oid("dragon_bone"), 2, 5), buy(oid("frost_dragon_scale"), 2, 6),
        sell(oid("rune_of_fire"), 26, uses=4), sell(oid("rune_of_frost"), 26, uses=4),
        sell(oid("rune_of_storm"), 26, uses=4), sell(oid("rune_of_life"), 32, uses=4),
        sell(oid("refining_stone"), 8, qty=2, uses=8),
    ]
    village = [
        sell("minecraft:bread", 1, qty=3), sell("minecraft:cooked_beef", 2, qty=2), sell(oid("red_potion"), 3),
        sell(oid("goblin_horn"), 24, uses=4), sell("minecraft:arrow", 2, qty=16), sell("minecraft:leather", 2, qty=2),
        buy("minecraft:wheat", 16, 2), buy(oid("beast_hide"), 3, 2), buy("minecraft:rotten_flesh", 16, 1),
        buy(oid("basilisk_eye"), 1, 6),
    ]
    table = lambda t: {"tiers": [{"total_exp_required": 0,
                                  "groups": [{"num_to_select": len(t), "trades": t}]}]}
    return {f"trading/{NS}/nazarick_maid.json": table(trades),
            f"trading/{NS}/nfirea.json": table(herbs),
            f"trading/{NS}/dwarf.json": table(forge),
            f"trading/{NS}/enri.json": table(village),
            f"trading/{NS}/pinison.json": table([
                sell("minecraft:oak_sapling", 1, qty=4), sell("minecraft:golden_apple", 14), sell(oid("red_potion"), 3),
                sell("minecraft:moss_block", 1, qty=8), sell("minecraft:flowering_azalea", 2, qty=2),
                sell(oid("scroll_of_heavy_recover"), 6), buy(oid("ghoul_fang"), 4, 3), buy("minecraft:bone_meal", 16, 2),
                buy(oid("heartwood"), 1, 12),
            ])}


# ============================================================ spawn rules
def spawn_rule_files():
    def monster(name, weight, herd=(1, 1), biomes=None):
        biome_tests = [{"test": "has_biome_tag", "operator": "==", "value": "monster"},
                       {"test": "has_biome_tag", "operator": "==", "value": "overworld"}]
        if biomes:
            biome_tests.append({"any_of": [{"test": "has_biome_tag", "operator": "==", "value": b}
                                           for b in biomes]})
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
                    "minecraft:biome_filter": {"all_of": biome_tests},
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
    def day_creature(name, biome, weight=2, herd=(1, 1)):
        biomes = [biome] if isinstance(biome, str) else list(biome)
        tests = [{"test": "has_biome_tag", "operator": "==", "value": b} for b in biomes]
        return {
            "format_version": "1.8.0",
            "minecraft:spawn_rules": {
                "description": {"identifier": oid(name), "population_control": "animal"},
                "conditions": [{
                    "minecraft:spawns_on_surface": {},
                    "minecraft:spawns_on_block_filter": "minecraft:grass_block",
                    "minecraft:brightness_filter": {"min": 7, "max": 15, "adjust_for_weather": False},
                    "minecraft:weight": {"default": weight},
                    "minecraft:density_limit": {"surface": herd[1]},
                    "minecraft:herd": {"min_size": herd[0], "max_size": herd[1]},
                    "minecraft:biome_filter": tests[0] if len(tests) == 1 else {"any_of": tests},
                }],
            },
        }

    return {
        "spawn_rules/gazef.json": day_creature("gazef", "plains"),
        "spawn_rules/brain.json": day_creature("brain", "taiga"),
        "spawn_rules/zaryusu.json": day_creature("zaryusu", "swamp", 3),
        "spawn_rules/nfirea.json": day_creature("nfirea", "plains"),
        "spawn_rules/adventurer.json": day_creature(
            "adventurer", ["plains", "forest", "taiga", "savanna"], 4, herd=(2, 3)),
        "spawn_rules/bandit.json": monster("bandit", 6, herd=(2, 3),
                                            biomes=["forest", "plains", "taiga", "savanna"]),
        "spawn_rules/hellhound.json": monster("hellhound", 3, herd=(1, 2)),
        "spawn_rules/shadow_demon.json": monster("shadow_demon", 3, herd=(1, 2)),
        "spawn_rules/theocracy_priest.json": monster("theocracy_priest", 2, herd=(2, 3),
                                                     biomes=["plains", "forest", "savanna"]),
        "spawn_rules/climb.json": day_creature("climb", "plains", 1),
        "spawn_rules/lakyus.json": day_creature("lakyus", "forest", 1),
        "spawn_rules/neia.json": day_creature("neia", "plains", 1),
        "spawn_rules/elf_ranger.json": day_creature("elf_ranger", "forest", 2, herd=(2, 3)),
        "spawn_rules/bafolk.json": monster("bafolk", 4, herd=(2, 3), biomes=["extreme_hills", "savanna", "mesa"]),
        "spawn_rules/eight_edge_assassin.json": monster("eight_edge_assassin", 2),
        "spawn_rules/gigant_basilisk.json": monster("gigant_basilisk", 2, biomes=["plains", "savanna", "forest"]),
        "spawn_rules/frost_giant.json": monster("frost_giant", 3, biomes=["cold", "taiga", "extreme_hills"]),
        "spawn_rules/beastman.json": monster("beastman", 4, herd=(2, 4), biomes=["savanna", "plains", "mesa"]),
        "spawn_rules/eclair.json": day_creature("eclair", "cold", 2),
        "spawn_rules/war_troll.json": monster("war_troll", 2, biomes=["extreme_hills", "taiga", "forest"]),
        "spawn_rules/vampire_bride.json": monster("vampire_bride", 3),
        "spawn_rules/clementine.json": monster("clementine", 2),
        "spawn_rules/goblin.json": monster("goblin", 10, herd=(2, 4), biomes=["forest", "plains", "taiga"]),
        "spawn_rules/skeleton_mage.json": monster("skeleton_mage", 6),
        "spawn_rules/soul_eater.json": monster("soul_eater", 3),
        "spawn_rules/ghoul.json": monster("ghoul", 6, (2, 3)),
        "spawn_rules/wraith.json": monster("wraith", 3),
        "spawn_rules/death_cavalier.json": monster("death_cavalier", 1, biomes=["plains", "savanna"]),
        "spawn_rules/treant_sapling.json": monster("treant_sapling", 3, biomes=["forest", "taiga", "jungle"]),
        "spawn_rules/fluder.json": monster("fluder", 1),
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
                    "minecraft:weight": {"default": 12},
                    "minecraft:herd": {"min_size": 1, "max_size": 3},
                    "minecraft:biome_filter": {"all_of": [
                        {"test": "has_biome_tag", "operator": "==", "value": "monster"},
                        {"test": "has_biome_tag", "operator": "==", "value": "overworld"}]},
                }],
            },
        },
        "spawn_rules/ogre.json": monster("ogre", 4, biomes=["plains", "forest", "extreme_hills", "savanna"]),
        "spawn_rules/death_knight.json": monster("death_knight", 5),
        "spawn_rules/elder_lich.json": monster("elder_lich", 5),
        "spawn_rules/old_guarder.json": monster("old_guarder", 10, herd=(2, 3)),
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
    "adventurer": (1.0, [0.95, 1.1], {"hurt": "game.player.hurt", "death": "game.player.die",
                                      "step": "mob.zombie.step"}),
    "guard": (1.0, [0.85, 0.95], {"hurt": "game.player.hurt", "death": "game.player.die",
                                  "step": "mob.zombie.step"}),
    "soldier": (1.0, [0.95, 1.05], {"hurt": "game.player.hurt", "death": "game.player.die",
                                   "step": "mob.zombie.step"}),
    "archer": (1.0, [1.05, 1.15], {"hurt": "game.player.hurt", "death": "game.player.die",
                                  "step": "mob.zombie.step", "shoot": "random.bow"}),
    "imperial_knight": (1.0, [0.8, 0.9], {"hurt": "game.player.hurt", "death": "game.player.die",
                                          "step": "mob.zombie.step"}),
    "bandit": (1.0, [0.9, 1.0], {"hurt": "game.player.hurt", "death": "game.player.die",
                                 "step": "mob.zombie.step"}),
    "retainer": (1.0, [0.95, 1.1], {"hurt": "game.player.hurt", "death": "game.player.die",
                                    "step": "mob.zombie.step", "shoot": "random.bow"}),
    "hellhound": (1.0, [0.6, 0.75], {"ambient": "mob.wither.ambient", "hurt": "mob.husk.hurt",
                                     "death": "mob.husk.death", "step": "mob.zombie.step"}),
    "shadow_demon": (1.0, [1.4, 1.6], {"ambient": "mob.zombie.say", "hurt": "mob.husk.hurt",
                                        "death": "mob.husk.death", "step": "mob.zombie.step"}),
    "evil_lord_wrath": (1.0, [0.4, 0.5], {"ambient": "mob.ravager.ambient", "hurt": "mob.irongolem.hit",
                                          "death": "mob.wither.death", "step": "mob.irongolem.walk",
                                          "shoot": "mob.ghast.fireball"}),
    "archangel_flame": (1.0, [1.3, 1.45], {"hurt": "mob.irongolem.hit", "death": "random.glass",
                                           "step": "mob.zombie.step"}),
    "dominion_authority": (1.0, [0.8, 0.9], {"hurt": "mob.irongolem.hit", "death": "random.glass",
                                             "step": "mob.irongolem.walk",
                                             "shoot": "ambient.weather.lightning.impact"}),
    "theocracy_priest": (1.0, [0.9, 1.0], {"hurt": "game.player.hurt", "death": "game.player.die",
                                           "step": "mob.zombie.step", "shoot": "mob.shulker.shoot",
                                           "cast.spell": "mob.evocation_illager.cast_spell",
                                           "prepare.summon": "mob.evocation_illager.prepare_summon"}),
    "nigun": (1.0, [0.75, 0.85], {"hurt": "game.player.hurt", "death": "game.player.die",
                                  "step": "mob.zombie.step", "shoot": "mob.shulker.shoot",
                                  "cast.spell": "mob.evocation_illager.cast_spell",
                                  "prepare.summon": "mob.evocation_illager.prepare_summon"}),
    "climb": (1.0, [1.05, 1.15], {"hurt": "game.player.hurt", "death": "game.player.die",
                                  "step": "mob.zombie.step"}),
    "zesshi": (1.0, [1.2, 1.3], {"hurt": "game.player.hurt", "death": "game.player.die",
                                 "step": "mob.zombie.step"}),
    "eclair": (1.0, [1.5, 1.7], {"ambient": "mob.rabbit.idle", "hurt": "mob.rabbit.hurt",
                                 "death": "mob.rabbit.death", "step": "mob.zombie.step"}),
    "war_troll": (1.0, [0.45, 0.55], {"ambient": "mob.zombie.say", "hurt": "mob.husk.hurt",
                                     "death": "mob.husk.death", "step": "mob.irongolem.walk"}),
    "vampire_bride": (1.0, [1.3, 1.45], {"hurt": "game.player.hurt", "death": "game.player.die",
                                         "step": "mob.zombie.step"}),
    "dwarf": (1.0, [0.7, 0.8], {"hurt": "mob.villager.hit", "death": "mob.villager.death",
                                "step": "mob.zombie.step", "haggle": "mob.villager.haggle",
                                "haggle.yes": "mob.villager.yes", "haggle.no": "mob.villager.no"}),
    "frost_dragon": (1.0, [0.7, 0.85], {"ambient": "mob.enderdragon.growl", "hurt": "mob.enderdragon.hit",
                                       "death": "mob.enderdragon.death", "step": "mob.irongolem.walk",
                                       "shoot": "random.glass"}),
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


for _new, _like in (("skeletal_dragon", "frost_dragon"), ("khajiit", "nigun"), ("gigant_basilisk", "soul_eater"),
                    ("frost_giant", "ogre"), ("beastman", "lizardman"), ("lakyus", "climb"), ("enri", "nfirea"),
                    ("zero", "bandit"), ("dark_young", "evil_lord_wrath"), ("jaldabaoth", "evil_lord_wrath"),
                    ("go_gin", "ogre"), ("elf_ranger", "archer"), ("decem", "climb"), ("behemoth", "ogre"),
                    ("neia", "archer"), ("remedios", "climb"), ("paladin", "soldier"), ("bafolk", "lizardman"),
                    ("eight_edge_assassin", "soul_eater"), ("arena_master", "nfirea"),
                    ("platinum_dragon_lord", "frost_dragon"), ("rubedo", "yuri"),
                    ("wyrm_steed", "frost_dragon"), ("soul_steed", "soul_eater"),
                    ("ghoul", "bandit"), ("wraith", "elder_lich"), ("death_cavalier", "imperial_knight"),
                    ("treant_sapling", "ogre"), ("zytl_qae", "ogre"), ("pinison", "nfirea")):
    SOUNDS[_new] = SOUNDS[_like]
for _key in GUARDIAN_COMPANIONS:
    SOUNDS[f"guardian_{_key}"] = SOUNDS[_key]


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
        "animation.overlord.dragon_wings": {"loop": True, "bones": {
            "rightWing": {"rotation": [0.0, 0.0, "math.sin(query.life_time * 140.0) * 12.0"]},
            "leftWing": {"rotation": [0.0, 0.0, "-math.sin(query.life_time * 140.0) * 12.0"]}}},
        # ------------------------------------------------------------- the great dragons
        # two-part wings: the arm beats and the tip follows a moment later, harder when on the move
        "animation.overlord.dragon.wings": {"loop": True, "bones": {
            "rightWing": {"rotation": [0.0, "math.sin(query.life_time * 110.0 + 90.0) * 4.0",
                                       "math.sin(query.life_time * 110.0) * (9.0 + math.clamp(query.modified_move_speed, 0.0, 1.0) * 9.0"
                                       " + (query.is_on_ground ? 0.0 : 26.0))"]},
            "leftWing": {"rotation": [0.0, "-math.sin(query.life_time * 110.0 + 90.0) * 4.0",
                                      "-math.sin(query.life_time * 110.0) * (9.0 + math.clamp(query.modified_move_speed, 0.0, 1.0) * 9.0"
                                      " + (query.is_on_ground ? 0.0 : 26.0))"]},
            "rightWingTip": {"rotation": [0.0, 0.0, "math.sin(query.life_time * 110.0 - 60.0) * (16.0 + (query.is_on_ground ? 0.0 : 20.0))"]},
            "leftWingTip": {"rotation": [0.0, 0.0, "-math.sin(query.life_time * 110.0 - 60.0) * (16.0 + (query.is_on_ground ? 0.0 : 20.0))"]}}},
        # aloft: the legs fold back, the neck reaches forward and the tail streams out behind
        "animation.overlord.dragon.soar": {"loop": True, "bones": {
            "leg0": {"rotation": ["(query.is_on_ground ? 0.0 : 55.0)", 0.0, 0.0]},
            "leg1": {"rotation": ["(query.is_on_ground ? 0.0 : 55.0)", 0.0, 0.0]},
            "leg2": {"rotation": ["(query.is_on_ground ? 0.0 : 65.0)", 0.0, 0.0]},
            "leg3": {"rotation": ["(query.is_on_ground ? 0.0 : 65.0)", 0.0, 0.0]},
            "neck": {"rotation": ["(query.is_on_ground ? 0.0 : -12.0)", 0.0, 0.0]},
            "tail": {"rotation": ["(query.is_on_ground ? 0.0 : -8.0)", 0.0, 0.0]},
            "body": {"rotation": ["(query.is_on_ground ? 0.0 : math.sin(query.life_time * 110.0) * 2.5)", 0.0, 0.0]}}},
        # the neck weaves like a snake's
        "animation.overlord.dragon.neck": {"loop": True, "bones": {
            "neck": {"rotation": ["math.sin(query.life_time * 40.0) * 3.0", "math.sin(query.life_time * 27.0) * 6.0", 0.0]},
            "neck2": {"rotation": ["math.sin(query.life_time * 40.0 - 50.0) * 4.0",
                                   "math.sin(query.life_time * 27.0 - 40.0) * 7.0", 0.0]}}},
        # the jaw gapes to bite, and now and then to snarl
        "animation.overlord.dragon.jaw": {"loop": True, "bones": {
            "jaw": {"rotation": [f"math.max({swing} * 32.0, "
                                 "math.clamp(math.sin(query.life_time * 45.0) * 60.0 - 50.0, 0.0, 14.0))", 0.0, 0.0]}}},
        # a wave runs down the tail, wider towards the tip
        "animation.overlord.dragon.tail": {"loop": True, "bones": {
            "tail": {"rotation": ["math.sin(query.life_time * 55.0) * 2.0", "math.sin(query.life_time * 70.0) * 7.0", 0.0]},
            "tail2": {"rotation": [0.0, "math.sin(query.life_time * 70.0 - 55.0) * 11.0", 0.0]},
            "tail3": {"rotation": [0.0, "math.sin(query.life_time * 70.0 - 110.0) * 14.0", 0.0]},
            "tail4": {"rotation": [0.0, "math.sin(query.life_time * 70.0 - 165.0) * 17.0", 0.0]}}},
        # a bite is a lunge of the whole neck
        "animation.overlord.dragon.lunge": {"loop": True, "bones": {
            "body": {"rotation": [f"{swing} * 4.0", 0.0, 0.0]},
            "neck": {"rotation": [f"{swing} * 18.0", 0.0, 0.0]},
            "neck2": {"rotation": [f"{swing} * 14.0", 0.0, 0.0]},
            "head": {"rotation": [f"-{swing} * 10.0", 0.0, 0.0]}}},
        # ------------------------------------------------ life: small motions every creature shares
        # breathing: the chest swells and settles
        "animation.overlord.breathe": {"loop": True, "bones": {
            "body": {"scale": ["1.0 + math.sin(query.life_time * 100.0) * 0.008",
                               "1.0 + math.sin(query.life_time * 100.0) * 0.015",
                               "1.0 + math.sin(query.life_time * 100.0) * 0.008"]}}},
        # leaning into a walk or run
        "animation.overlord.lean": {"loop": True, "bones": {
            "body": {"rotation": ["math.clamp(query.modified_move_speed, 0.0, 1.0) * 5.0", 0.0, 0.0]}}},
        # recoiling when struck
        "animation.overlord.flinch": {"loop": True, "bones": {
            "body": {"rotation": ["-query.hurt_time * 1.0", 0.0, "math.sin(query.hurt_time * 40.0) * 2.0"]}}},
        # the rest of the body follows a swing: the off arm counters it and the head dips
        "animation.overlord.follow": {"loop": True, "bones": {
            "leftArm": {"rotation": [f"{swing} * 25.0", 0.0, 0.0]},
            "head": {"rotation": [f"{swing} * 6.0", 0.0, 0.0]}}},
        # a cape stirs when standing and streams out when moving
        "animation.overlord.cape": {"loop": True, "bones": {
            "cape": {"rotation": ["6.0 + math.clamp(query.modified_move_speed, 0.0, 1.0) * 28.0 + "
                                  "math.sin(query.life_time * 95.0) * 3.0", 0.0, 0.0]}}},
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
    "adventurer": ["look_at_target", "idle", "walk", "attack"],
    "guard": ["look_at_target", "idle", "walk", "attack"],
    "soldier": ["look_at_target", "idle", "walk", "attack"],
    "archer": ["look_at_target", "idle", "walk", "attack"],
    "imperial_knight": ["look_at_target", "idle", "walk", "attack"],
    "bandit": ["look_at_target", "idle", "walk", "attack"],
    "hellhound": ["look_at_target", "hamsuke.walk", "hamsuke.attack"],
    "shadow_demon": ["look_at_target", "idle", "walk", "attack"],
    "evil_lord_wrath": ["look_at_target", "idle", "walk", "attack", "wings"],
    "archangel_flame": ["look_at_target", "idle", "walk", "attack", "wings"],
    "dominion_authority": ["look_at_target", "idle", "walk", "attack", "wings", "cast"],
    "theocracy_priest": ["look_at_target", "idle", "walk", "attack", "cast"],
    "nigun": ["look_at_target", "idle", "walk", "attack", "cast"],
    "climb": ["look_at_target", "idle", "walk", "attack"],
    "zesshi": ["look_at_target", "idle", "walk", "attack"],
    "eclair": ["look_at_target", "idle", "walk"],
    "war_troll": ["look_at_target", "idle", "walk", "attack"],
    "vampire_bride": ["look_at_target", "idle", "robe_walk", "attack"],
    "dwarf": ["look_at_target", "idle", "walk"],
    "frost_dragon": ["look_at_target", "hamsuke.walk", "dragon.wings", "dragon.neck", "dragon.jaw", "dragon.tail",
                     "dragon.lunge", "dragon.soar"],
    "frost_breath": ["projectile.spin"],
    "retainer": ["look_at_target", "idle", "walk", "attack"],
    "crystal_shard": ["projectile.spin"],
    "magic_bullet": ["projectile.spin"],
    "lightning_bolt": ["projectile.spin"],
    "fireball": ["projectile.spin"],
    "negative_burst": ["projectile.spin"],
}
for _new, _like in (("skeletal_dragon", "frost_dragon"), ("khajiit", "nigun"), ("gigant_basilisk", "soul_eater"),
                    ("frost_giant", "ogre"), ("beastman", "lizardman"), ("lakyus", "climb"), ("enri", "nfirea"),
                    ("zero", "bandit"), ("dark_young", "soul_eater"), ("jaldabaoth", "evil_lord_wrath"),
                    ("go_gin", "ogre"), ("elf_ranger", "archer"), ("decem", "climb"), ("behemoth", "ogre"),
                    ("neia", "archer"), ("remedios", "climb"), ("paladin", "soldier"), ("bafolk", "lizardman"),
                    ("eight_edge_assassin", "soul_eater"), ("arena_master", "nfirea"),
                    ("platinum_dragon_lord", "frost_dragon"), ("rubedo", "yuri"),
                    ("wyrm_steed", "frost_dragon"), ("soul_steed", "soul_eater"),
                    ("ghoul", "bandit"), ("wraith", "elder_lich"), ("death_cavalier", "imperial_knight"),
                    ("treant_sapling", "ogre"), ("zytl_qae", "ogre"), ("pinison", "yuri")):
    ENTITY_ANIMS[_new] = ENTITY_ANIMS[_like]
for _key in GUARDIAN_COMPANIONS:
    ENTITY_ANIMS[f"guardian_{_key}"] = ENTITY_ANIMS[_key]

# Every creature breathes and flinches; walkers lean into their stride, fighters follow their swings
# through, the caped have capes that move and the beasts have tails that do.
CAPED = ["climb", "lakyus", "remedios", "paladin", "imperial_knight", "guard", "zesshi", "nigun", "khajiit",
         "decem", "arena_master", "theocracy_priest", "zero", "soldier", "retainer"]
TAILED = ["soul_eater", "hellhound", "gigant_basilisk", "dark_young", "eight_edge_assassin"]
for _name in list(ENTITY_ANIMS):
    if _name in PROJECTILES:
        continue
    _anims = list(ENTITY_ANIMS[_name]) + ["breathe", "flinch"]
    if "walk" in _anims or "robe_walk" in _anims:
        _anims.append("lean")
    if "attack" in _anims:
        _anims.append("follow")
    if _name in CAPED:
        _anims.append("cape")
    if _name in TAILED:
        _anims.append("tail")
    ENTITY_ANIMS[_name] = _anims

# ---------------------------------------------------------------- particles
# Every spell effect is drawn with these five emitters.  The script passes
# variable.color (element colour) and variable.scale (size) with each spawn.
def particle_files():
    """The add-on's own particle effects. Each is tinted with variable.color and sized with variable.scale,
    both set by the script; most are drawn additively so they glow."""
    tint = ["variable.color.r", "variable.color.g", "variable.color.b"]
    life = "(variable.particle_age / variable.particle_lifetime)"
    # white-hot at birth, cooling to the spell's colour
    hot = [f"math.lerp(1.0, variable.color.{c}, {life})" for c in "rgb"]
    pale = [f"math.lerp(1.0, variable.color.{c}, 0.6)" for c in "rgb"]
    fade = f"(1.0 - {life})"
    swell = f"(1.0 - (1.0 - {life}) * (1.0 - {life}))"  # fast at first, easing out
    pulse = ("math.clamp(math.min(variable.particle_age * 6.0, "
             "(variable.particle_lifetime - variable.particle_age) * 3.0), 0.0, 1.0)")
    twinkle = "(0.65 + 0.35 * math.sin(variable.particle_age * 1400.0 + variable.particle_random_1 * 360.0))"

    def effect(name, texture, components, material="particles_add", active=0.1):
        return {
            "format_version": "1.10.0",
            "particle_effect": {
                "description": {
                    "identifier": oid(name),
                    "basic_render_parameters": {"material": material,
                                                "texture": f"textures/particle/{NS}/{texture}"},
                },
                "components": {
                    "minecraft:emitter_lifetime_once": {"active_time": active},
                    **components,
                },
            },
        }

    def quad(size, mode, tex, uv=None, uv_size=None, flipbook=None, direction=None):
        """Billboard appearance. tex is (width, height) of the texture."""
        w, h = tex
        size = size if isinstance(size, list) else [size, size]
        uvs = {"texture_width": w, "texture_height": h}
        if flipbook:
            uvs["flipbook"] = flipbook
        else:
            uvs["uv"] = uv or [0, 0]
            uvs["uv_size"] = uv_size or [w, h]
        out = {"size": size, "facing_camera_mode": mode, "uv": uvs}
        if direction:
            out["direction"] = direction
        return out

    burst = lambda n: {"minecraft:emitter_rate_instant": {"num_particles": n}}
    point = {"minecraft:emitter_shape_point": {}}
    lifetime = lambda lo, hi=None: {"minecraft:particle_lifetime_expression": {
        "max_lifetime": lo if hi is None else f"math.random({lo}, {hi})"}}
    colour = lambda rgb, alpha: {"minecraft:particle_appearance_tinting": {"color": [*rgb, alpha]}}
    along_velocity = {"mode": "derive_from_velocity", "min_speed_threshold": 0.01}
    moving = {"minecraft:particle_motion_dynamic": {}}  # a particle only keeps its starting speed with a motion component

    out = {
        # ---------------------------------------------------------------- basics
        # burst of sparkles flying outwards (the heart of every impact)
        "spark": effect("spark", "star", {
            **burst(18),
            "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
            **lifetime(0.35, 0.85),
            "minecraft:particle_initial_speed": "math.random(1.5, 4.5) * variable.scale",
            "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -2.0, 0],
                                                  "linear_drag_coefficient": 2.5},
            "minecraft:particle_appearance_billboard": quad(f"0.16 * variable.scale * {fade}", "lookat_xyz", (32, 32)),
            **colour(hot, 1.0),
        }),
        # one still mote (beams and trails are drawn as rows of these)
        "mote": effect("mote", "glow", {
            **burst(1), **point, **lifetime(0.45),
            "minecraft:particle_appearance_billboard": quad(
                f"0.22 * variable.scale * (1.0 - 0.7 * {life})", "lookat_xyz", (32, 32)),
            **colour(tint, fade),
        }),
        # sparkles rising from a disc on the ground (heals, buffs, charging spells)
        "rise": effect("rise", "star", {
            **burst(18),
            "minecraft:emitter_shape_disc": {"radius": "variable.scale", "plane_normal": [0, 1, 0],
                                             "direction": [0, 1, 0]},
            **lifetime(0.7, 1.4),
            "minecraft:particle_initial_speed": "math.random(1.0, 2.6)",
            "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.8},
            "minecraft:particle_appearance_billboard": quad(f"0.13 * {fade}", "lookat_xyz", (32, 32)),
            **colour(tint, twinkle),
        }),
        # outer ring of a magic circle, turning slowly
        "magic_circle": effect("magic_circle", "magic_circle", {
            **burst(1), **point, **lifetime(1.4),
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 60},
            "minecraft:particle_appearance_billboard": quad(
                f"variable.scale * (0.85 + 0.15 * math.min(1.0, variable.particle_age * 5.0))",
                "emitter_transform_xz", (128, 128)),
            **colour(tint, pulse),
        }),
        # inner figure of a magic circle, turning the other way
        "magic_circle_inner": effect("magic_circle_inner", "magic_circle_inner", {
            **burst(1), **point, **lifetime(1.4),
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": -110},
            "minecraft:particle_appearance_billboard": quad("variable.scale", "emitter_transform_xz", (128, 128)),
            **colour(hot, pulse),
        }),
        # flat ring that expands and fades (shock waves)
        "ring": effect("ring", "ring", {
            **burst(1), **point, **lifetime(0.6),
            "minecraft:particle_appearance_billboard": quad(
                f"variable.scale * (0.15 + 0.85 * {swell})", "emitter_transform_xz", (64, 64)),
            **colour(tint, fade),
        }),
        # --------------------------------------------------------------- impacts
        # a flash of light at the moment of impact
        "flash": effect("flash", "glow", {
            **burst(1), **point, **lifetime(0.22),
            "minecraft:particle_appearance_billboard": quad(
                f"variable.scale * (0.6 + 1.6 * {life})", "lookat_xyz", (32, 32)),
            **colour(hot, f"0.9 * {fade}"),
        }),
        # sparks drawn out along their flight
        "streak": effect("streak", "streak", {
            **burst(14),
            "minecraft:emitter_shape_sphere": {"radius": 0.15, "direction": "outwards"},
            **lifetime(0.25, 0.5),
            "minecraft:particle_initial_speed": "math.random(4.0, 9.0) * variable.scale",
            "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -3.0, 0],
                                                  "linear_drag_coefficient": 3.0},
            "minecraft:particle_appearance_billboard": quad(
                ["0.05 * variable.scale", f"0.35 * variable.scale * {fade}"], "lookat_direction", (16, 64),
                direction=along_velocity),
            **colour(hot, 1.0),
        }),
        # a great many streaks at once (explosions and novas)
        "nova": effect("nova", "streak", {
            **burst(46),
            "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
            **lifetime(0.35, 0.6),
            "minecraft:particle_initial_speed": "math.random(2.2, 3.8) * variable.scale",
            "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.5},
            "minecraft:particle_appearance_billboard": quad(
                ["0.1", f"0.8 * {fade}"], "lookat_direction", (16, 64), direction=along_velocity),
            **colour(hot, 1.0),
        }),
        # sparkles rushing inwards to a point (spells gathering power)
        "implode": effect("implode", "star", {
            **burst(26),
            "minecraft:emitter_shape_sphere": {"radius": "variable.scale", "surface_only": True,
                                               "direction": "inwards"},
            **lifetime(0.5),
            "minecraft:particle_initial_speed": "variable.scale * 1.9",
            **moving,
            "minecraft:particle_appearance_billboard": quad(f"0.1 + 0.12 * {life}", "lookat_xyz", (32, 32)),
            **colour([f"math.lerp(variable.color.{c}, 1.0, {life})" for c in "rgb"], pulse),
        }),
        # heavy ring along the ground with dust thrown up behind it
        "shockwave": effect("shockwave", "shockwave", {
            **burst(1), **point, **lifetime(0.7),
            "minecraft:particle_appearance_billboard": quad(
                f"variable.scale * (0.2 + 0.9 * {swell})", "emitter_transform_xz", (64, 64)),
            **colour(pale, f"0.85 * {fade}"),
        }),
        "dust": effect("dust", "smoke", {
            **burst(16),
            "minecraft:emitter_shape_disc": {"radius": 0.3, "plane_normal": [0, 1, 0], "direction": "outwards"},
            **lifetime(0.6, 1.0),
            "minecraft:particle_initial_speed": "variable.scale * math.random(2.0, 3.5)",
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-60, 60)"},
            "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 3.0},
            "minecraft:particle_appearance_billboard": quad(f"0.25 + 0.5 * {life}", "lookat_xyz", (32, 32)),
            **colour([f"(0.45 + 0.3 * variable.color.{c})" for c in "rgb"], f"0.5 * {fade}"),
        }, material="particles_blend"),
        # the crescent a blade leaves in the air
        "slash": effect("slash", "slash", {
            **burst(1), **point, **lifetime(0.28),
            "minecraft:particle_initial_spin": {"rotation": "math.random(-40, 40)"},
            "minecraft:particle_appearance_billboard": quad(
                f"variable.scale * (0.6 + 0.6 * {swell})", "lookat_xyz", (64, 64)),
            **colour(hot, fade),
        }),
        # --------------------------------------------------- the eight elements
        # fire: licking flames and drifting embers
        "flame": effect("flame", "flame", {
            **burst(10),
            "minecraft:emitter_shape_sphere": {"radius": "0.35 * variable.scale", "direction": [0, 1, 0]},
            **lifetime(0.45, 0.8),
            "minecraft:particle_initial_speed": "math.random(0.8, 2.2)",
            **moving,
            "minecraft:particle_appearance_billboard": quad(
                f"0.3 * variable.scale * (1.0 - 0.6 * {life})", "lookat_xyz", (128, 32),
                flipbook={"base_UV": [0, 0], "size_UV": [32, 32], "step_UV": [32, 0],
                          "frames_per_second": 10, "max_frame": 4, "loop": True}),
            **colour(hot, f"math.min(1.0, 2.5 * {fade})"),
        }),
        "ember": effect("ember", "glow", {
            **burst(10),
            "minecraft:emitter_shape_sphere": {"radius": "0.5 * variable.scale", "direction": "outwards"},
            **lifetime(0.9, 1.8),
            "minecraft:particle_initial_speed": "math.random(0.3, 1.0)",
            "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.2, 0], "linear_drag_coefficient": 0.6},
            "minecraft:particle_appearance_billboard": quad(0.07, "lookat_xyz", (32, 32)),
            **colour(hot, f"{twinkle} * {fade}"),
        }),
        # ice: tumbling shards
        "shard": effect("shard", "shard", {
            **burst(9),
            "minecraft:emitter_shape_sphere": {"radius": 0.15, "direction": "outwards"},
            **lifetime(0.5, 0.9),
            "minecraft:particle_initial_speed": "math.random(3.0, 6.0) * variable.scale",
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-400, 400)"},
            "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -9.0, 0], "linear_drag_coefficient": 1.0},
            "minecraft:particle_appearance_billboard": quad("0.18 * variable.scale", "lookat_xyz", (32, 32)),
            **colour(pale, f"math.min(1.0, 3.0 * {fade})"),
        }),
        # lightning: jagged arcs that flicker for an instant
        "arc": effect("arc", "arc", {
            **burst(7),
            "minecraft:emitter_shape_sphere": {"radius": "0.8 * variable.scale", "direction": "outwards"},
            **lifetime(0.06, 0.16),
            "minecraft:particle_initial_speed": 0.0,
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
            "minecraft:particle_appearance_billboard": quad(
                ["0.3 * variable.scale", "0.6 * variable.scale"], "lookat_xyz", (128, 64),
                uv=["math.floor(variable.particle_random_1 * 3.99) * 32", 0], uv_size=[32, 64]),
            **colour(hot, 1.0),
        }),
        # holy: shafts of light rising
        "ray": effect("ray", "streak", {
            **burst(10),
            "minecraft:emitter_shape_disc": {"radius": "variable.scale", "plane_normal": [0, 1, 0],
                                             "direction": [0, 1, 0]},
            **lifetime(0.5, 0.9),
            "minecraft:particle_initial_speed": "math.random(2.0, 4.5)",
            **moving,
            "minecraft:particle_appearance_billboard": quad(
                ["0.07", f"0.7 * (1.0 - 0.5 * {life})"], "lookat_y", (16, 64)),
            **colour(hot, fade),
        }),
        # dark: curling wisps of shadow and, for death magic, a rising skull
        "wisp": effect("wisp", "smoke", {
            **burst(8),
            "minecraft:emitter_shape_sphere": {"radius": "0.4 * variable.scale", "direction": "outwards"},
            **lifetime(0.8, 1.4),
            "minecraft:particle_initial_speed": "math.random(0.3, 0.9)",
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-60, 60)"},
            "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0], "linear_drag_coefficient": 1.0},
            "minecraft:particle_appearance_billboard": quad(
                f"0.3 * variable.scale * (0.6 + 0.8 * {life})", "lookat_xyz", (32, 32)),
            **colour([f"(0.8 * variable.color.{c})" for c in "rgb"], f"0.7 * {fade}"),
        }, material="particles_blend"),
        "skull": effect("skull", "skull", {
            **burst(1), **lifetime(1.1),
            "minecraft:emitter_shape_custom": {"offset": [0, 0, 0], "direction": [0, 1, 0]},
            "minecraft:particle_initial_speed": 0.8,
            **moving,
            "minecraft:particle_appearance_billboard": quad("0.45 * variable.scale", "lookat_xyz", (32, 32)),
            **colour(pale, pulse),
        }),
        # acid: a spatter of droplets
        "droplet": effect("droplet", "glow", {
            **burst(12),
            "minecraft:emitter_shape_sphere": {"radius": 0.15, "direction": "outwards"},
            **lifetime(0.4, 0.8),
            "minecraft:particle_initial_speed": "math.random(2.0, 5.0) * variable.scale",
            "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -12.0, 0], "linear_drag_coefficient": 0.6},
            "minecraft:particle_appearance_billboard": quad("0.1 * variable.scale", "lookat_xyz", (32, 32)),
            **colour(tint, f"math.min(1.0, 3.0 * {fade})"),
        }),
        # arcane: runes that drift up and fade
        "glyph": effect("glyph", "glyphs", {
            **burst(8),
            "minecraft:emitter_shape_disc": {"radius": "variable.scale", "plane_normal": [0, 1, 0],
                                             "surface_only": True, "direction": [0, 1, 0]},
            **lifetime(1.0, 1.5),
            "minecraft:particle_initial_speed": "math.random(0.25, 0.6)",
            **moving,
            "minecraft:particle_appearance_billboard": quad(
                0.24, "lookat_xyz", (256, 32),
                uv=["math.floor(variable.particle_random_1 * 7.99) * 32", 0], uv_size=[32, 32]),
            **colour(tint, pulse),
        }),
        # ------------------------------------------------------- beams and auras
        # one shaft of light standing on the ground (the script places it half-way up)
        "pillar_light": effect("pillar_light", "streak", {
            **burst(1), **point, **lifetime(0.7),
            "minecraft:particle_appearance_billboard": quad(
                [f"0.5 * variable.scale * (1.0 - 0.5 * {life})", "variable.height * 0.5"], "lookat_y", (16, 64)),
            **colour(hot, pulse),
        }),
        # the bright core of a beam, laid from one point to another (the script places it at the middle)
        "beam_core": effect("beam_core", "streak", {
            **burst(1), **point, **lifetime(0.3),
            "minecraft:particle_appearance_billboard": quad(
                [f"0.1 * variable.scale * (1.0 + {life})", "variable.length * 0.5"], "lookat_direction", (16, 64),
                direction={"mode": "custom", "custom_direction": [
                    "variable.direction.x", "variable.direction.y", "variable.direction.z"]}),
            **colour(hot, fade),
        }),
        # ------------------------------------------------- what a spell leaves behind
        # sparkles that keep rising from where a spell struck
        "linger": effect("linger", "star", {
            "minecraft:emitter_rate_steady": {"spawn_rate": 18, "max_particles": 40},
            "minecraft:emitter_shape_disc": {"radius": "variable.scale", "plane_normal": [0, 1, 0],
                                             "direction": [0, 1, 0]},
            **lifetime(0.6, 1.1),
            "minecraft:particle_initial_speed": "math.random(0.5, 1.4)",
            **moving,
            "minecraft:particle_appearance_billboard": quad(f"0.1 * {fade}", "lookat_xyz", (32, 32)),
            **colour(tint, twinkle),
        }, active=1.4),
        # flames that burn on for a moment
        "flame_linger": effect("flame_linger", "flame", {
            "minecraft:emitter_rate_steady": {"spawn_rate": 14, "max_particles": 30},
            "minecraft:emitter_shape_disc": {"radius": "variable.scale", "plane_normal": [0, 1, 0],
                                             "direction": [0, 1, 0]},
            **lifetime(0.4, 0.7),
            "minecraft:particle_initial_speed": "math.random(0.6, 1.6)",
            **moving,
            "minecraft:particle_appearance_billboard": quad(
                f"0.34 * (1.0 - 0.6 * {life})", "lookat_xyz", (128, 32),
                flipbook={"base_UV": [0, 0], "size_UV": [32, 32], "step_UV": [32, 0],
                          "frames_per_second": 10, "max_frame": 4, "loop": True}),
            **colour(hot, f"math.min(1.0, 2.5 * {fade})"),
        }, active=1.2),
        # a low mist that spreads and thins (cold, shadow, acid)
        "mist": effect("mist", "smoke", {
            "minecraft:emitter_rate_steady": {"spawn_rate": 10, "max_particles": 24},
            "minecraft:emitter_shape_disc": {"radius": "variable.scale", "plane_normal": [0, 1, 0],
                                             "direction": "outwards"},
            **lifetime(1.0, 1.8),
            "minecraft:particle_initial_speed": "math.random(0.2, 0.7)",
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-30, 30)"},
            "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.15, 0], "linear_drag_coefficient": 0.8},
            "minecraft:particle_appearance_billboard": quad(f"0.5 + 0.7 * {life}", "lookat_xyz", (32, 32)),
            **colour([f"(0.35 + 0.65 * variable.color.{c})" for c in "rgb"], f"0.45 * {fade}"),
        }, material="particles_blend", active=1.3),
        # lightning that goes on spitting where it struck
        "crackle": effect("crackle", "arc", {
            "minecraft:emitter_rate_steady": {"spawn_rate": 16, "max_particles": 24},
            "minecraft:emitter_shape_sphere": {"radius": "variable.scale", "direction": "outwards"},
            **lifetime(0.06, 0.14),
            "minecraft:particle_initial_speed": 0.0,
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
            "minecraft:particle_appearance_billboard": quad(
                ["0.22", "0.44"], "lookat_xyz", (128, 64),
                uv=["math.floor(variable.particle_random_1 * 3.99) * 32", 0], uv_size=[32, 64]),
            **colour(hot, 1.0),
        }, active=1.0),
        # a dark mark burnt into the ground that fades over a few seconds
        "scorch": effect("scorch", "glow", {
            **burst(1), **point, **lifetime(4.0),
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
            "minecraft:particle_appearance_billboard": quad("variable.scale", "emitter_transform_xz", (32, 32)),
            **colour([f"(0.12 * variable.color.{c})" for c in "rgb"], f"0.7 * {fade}"),
        }, material="particles_blend"),
        # motes circling the caster as power gathers
        "orbit": effect("orbit", "star", {
            **burst(10), **point, **lifetime(1.2),
            "minecraft:particle_motion_parametric": {"relative_position": [
                "math.cos(variable.particle_age * 300.0 + variable.particle_random_1 * 360.0) * variable.scale",
                "0.2 + variable.particle_age * 1.3 + variable.particle_random_2 * 0.8",
                "math.sin(variable.particle_age * 300.0 + variable.particle_random_1 * 360.0) * variable.scale"]},
            "minecraft:particle_appearance_billboard": quad(f"0.12 * {pulse}", "lookat_xyz", (32, 32)),
            **colour(hot, pulse),
        }),
        # the soft glow round the core of a beam
        "beam_glow": effect("beam_glow", "streak", {
            **burst(1), **point, **lifetime(0.35),
            "minecraft:particle_appearance_billboard": quad(
                [f"0.4 * variable.scale * (1.0 + {life})", "variable.length * 0.5"], "lookat_direction", (16, 64),
                direction={"mode": "custom", "custom_direction": [
                    "variable.direction.x", "variable.direction.y", "variable.direction.z"]}),
            **colour(tint, f"0.35 * {fade}"),
        }),
        # a second of sparkles climbing around whoever stands in the middle (buffs)
        "aura": effect("aura", "star", {
            "minecraft:emitter_rate_steady": {"spawn_rate": 34, "max_particles": 60},
            "minecraft:emitter_shape_disc": {"radius": "variable.scale", "plane_normal": [0, 1, 0],
                                             "surface_only": True, "direction": [0, 1, 0]},
            **lifetime(0.6, 1.0),
            "minecraft:particle_initial_speed": "math.random(1.4, 2.4)",
            **moving,
            "minecraft:particle_appearance_billboard": quad(f"0.11 * {fade}", "lookat_xyz", (32, 32)),
            **colour(tint, twinkle),
        }, active=1.1),
    }
    return {f"particles/{name}.json": data for name, data in out.items()}


PARTICLES = ["spark", "mote", "rise", "magic_circle", "magic_circle_inner", "ring", "flash", "streak", "nova",
             "implode", "shockwave", "dust", "slash", "flame", "ember", "shard", "arc", "ray", "wisp", "skull",
             "droplet", "glyph", "pillar_light", "beam_core", "aura", "linger", "flame_linger", "mist", "crackle",
             "scorch", "orbit", "beam_glow"]
PLAYER_BONES = ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"]


def player_animations_json():
    """Casting and weapon poses played on the player with Entity.playAnimation.

    Each pose winds up, strikes and settles, so a cast reads as a gesture rather than a held stance.
    Rotations are in degrees on the vanilla player bones; a negative x on an arm swings it forward and up.
    """
    def keys(*frames):
        return {f"{t:.2f}": list(v) for t, v in frames}

    def anim(length, **bones):
        return {"animation_length": length,
                "bones": {bone: {"rotation": keys(*frames)} for bone, frames in bones.items()}}

    Z = (0, 0, 0)
    return {"format_version": "1.8.0", "animations": {
        # one hand drawn back, thrust at the target, then a short recoil
        "animation.overlord.cast_point": anim(
            0.65,
            rightArm=[(0, Z), (0.08, (20, -10, 0)), (0.18, (-102, -8, 0)), (0.3, (-88, -8, 0)),
                      (0.48, (-92, -8, 0)), (0.65, Z)],
            leftArm=[(0, Z), (0.18, (18, 0, -12)), (0.48, (14, 0, -10)), (0.65, Z)],
            body=[(0, Z), (0.08, (0, -8, 0)), (0.18, (0, 12, 0)), (0.48, (0, 9, 0)), (0.65, Z)],
            head=[(0, Z), (0.18, (-4, 0, 0)), (0.65, Z)]),
        # both arms swept up to the sky and held (area magic)
        "animation.overlord.cast_raise": anim(
            1.1,
            rightArm=[(0, Z), (0.1, (10, 0, 12)), (0.28, (-172, 0, 22)), (0.5, (-164, 0, 16)),
                      (0.82, (-168, 0, 20)), (1.1, Z)],
            leftArm=[(0, Z), (0.1, (10, 0, -12)), (0.28, (-172, 0, -22)), (0.5, (-164, 0, -16)),
                     (0.82, (-168, 0, -20)), (1.1, Z)],
            head=[(0, Z), (0.28, (-22, 0, 0)), (0.82, (-20, 0, 0)), (1.1, Z)],
            body=[(0, Z), (0.1, (6, 0, 0)), (0.28, (-5, 0, 0)), (0.82, (-4, 0, 0)), (1.1, Z)]),
        # arms spread wide, then drawn in to the chest (healing, buffs, self-targeted magic)
        "animation.overlord.cast_self": anim(
            0.9,
            rightArm=[(0, Z), (0.2, (-20, 0, 80)), (0.45, (-24, 0, 74)), (0.65, (-62, -34, 6)), (0.9, Z)],
            leftArm=[(0, Z), (0.2, (-20, 0, -80)), (0.45, (-24, 0, -74)), (0.65, (-62, 34, -6)), (0.9, Z)],
            head=[(0, Z), (0.2, (-10, 0, 0)), (0.65, (8, 0, 0)), (0.9, Z)]),
        # an arm swept across the body (lines and cones)
        "animation.overlord.cast_sweep": anim(
            0.7,
            rightArm=[(0, Z), (0.12, (-70, 55, 0)), (0.36, (-84, -52, 0)), (0.5, (-78, -44, 0)), (0.7, Z)],
            leftArm=[(0, Z), (0.36, (16, 0, -18)), (0.7, Z)],
            body=[(0, Z), (0.12, (0, -22, 0)), (0.36, (0, 26, 0)), (0.5, (0, 20, 0)), (0.7, Z)]),
        # both hands raised and brought down hard (bursts around the caster)
        "animation.overlord.cast_slam": anim(
            0.8,
            rightArm=[(0, Z), (0.26, (-170, 0, 14)), (0.4, (-38, 0, 8)), (0.58, (-30, 0, 6)), (0.8, Z)],
            leftArm=[(0, Z), (0.26, (-170, 0, -14)), (0.4, (-38, 0, -8)), (0.58, (-30, 0, -6)), (0.8, Z)],
            body=[(0, Z), (0.26, (-8, 0, 0)), (0.4, (22, 0, 0)), (0.58, (18, 0, 0)), (0.8, Z)],
            head=[(0, Z), (0.26, (-14, 0, 0)), (0.4, (16, 0, 0)), (0.8, Z)]),
        # both hands held out, shaking with the strain (curses and drains)
        "animation.overlord.cast_channel": anim(
            1.2,
            rightArm=[(0, Z), (0.2, (-86, -14, 0)), (0.4, (-90, -10, 0)), (0.6, (-84, -15, 0)),
                      (0.8, (-90, -11, 0)), (1.0, (-86, -14, 0)), (1.2, Z)],
            leftArm=[(0, Z), (0.2, (-86, 14, 0)), (0.4, (-82, 10, 0)), (0.6, (-88, 15, 0)),
                     (0.8, (-83, 11, 0)), (1.0, (-86, 14, 0)), (1.2, Z)],
            body=[(0, Z), (0.2, (6, 0, 0)), (1.0, (6, 0, 0)), (1.2, Z)],
            head=[(0, Z), (0.2, (6, 0, 0)), (1.0, (4, 0, 0)), (1.2, Z)]),
        # a hand pressed towards the ground, then lifted as the summoned rise
        "animation.overlord.cast_summon": anim(
            1.2,
            rightArm=[(0, Z), (0.25, (-48, 0, 0)), (0.5, (-52, 0, 0)), (0.85, (-150, 0, 14)), (1.0, (-146, 0, 12)),
                      (1.2, Z)],
            leftArm=[(0, Z), (0.25, (12, 0, -16)), (0.85, (-20, 0, -30)), (1.2, Z)],
            body=[(0, Z), (0.25, (32, 0, 0)), (0.5, (34, 0, 0)), (0.85, (-6, 0, 0)), (1.2, Z)],
            head=[(0, Z), (0.25, (24, 0, 0)), (0.85, (-16, 0, 0)), (1.2, Z)]),
        # super-tier magic: arms rise slowly, hold, then come down as the spell is loosed
        "animation.overlord.cast_super": anim(
            2.6,
            rightArm=[(0, Z), (1.1, (-172, 0, 24)), (1.5, (-166, 0, 18)), (1.9, (-172, 0, 24)), (2.2, (-64, -6, 0)),
                      (2.35, (-56, -6, 0)), (2.6, Z)],
            leftArm=[(0, Z), (1.1, (-172, 0, -24)), (1.5, (-166, 0, -18)), (1.9, (-172, 0, -24)), (2.2, (-64, 6, 0)),
                     (2.35, (-56, 6, 0)), (2.6, Z)],
            head=[(0, Z), (1.1, (-26, 0, 0)), (1.9, (-26, 0, 0)), (2.2, (10, 0, 0)), (2.6, Z)],
            body=[(0, Z), (1.1, (-7, 0, 0)), (1.9, (-7, 0, 0)), (2.2, (12, 0, 0)), (2.6, Z)]),
        # a scroll held open in both hands, read, then cast away
        "animation.overlord.use_scroll": anim(
            0.9,
            rightArm=[(0, Z), (0.18, (-68, -26, 0)), (0.5, (-70, -24, 0)), (0.68, (-128, -6, 0)), (0.9, Z)],
            leftArm=[(0, Z), (0.18, (-68, 26, 0)), (0.5, (-70, 24, 0)), (0.68, (-40, 12, 0)), (0.9, Z)],
            head=[(0, Z), (0.18, (22, 0, 0)), (0.5, (20, 0, 0)), (0.68, (-8, 0, 0)), (0.9, Z)]),
        # a tome held in the off hand while the other traces the words
        "animation.overlord.use_tome": anim(
            1.0,
            leftArm=[(0, Z), (0.2, (-56, 22, 0)), (0.8, (-56, 22, 0)), (1.0, Z)],
            rightArm=[(0, Z), (0.2, (-70, -30, 0)), (0.45, (-96, -8, 0)), (0.6, (-88, -18, 0)), (0.8, (-100, -4, 0)),
                      (1.0, Z)],
            head=[(0, Z), (0.2, (24, 8, 0)), (0.6, (10, 0, 0)), (0.8, (-6, 0, 0)), (1.0, Z)]),
        # a blade drawn back over the shoulder and cut down across the body
        "animation.overlord.weapon_slash": anim(
            0.5,
            rightArm=[(0, Z), (0.1, (-150, -24, 0)), (0.24, (-22, 38, 0)), (0.34, (-12, 34, 0)), (0.5, Z)],
            body=[(0, Z), (0.1, (0, -18, 0)), (0.24, (8, 24, 0)), (0.34, (6, 18, 0)), (0.5, Z)],
            leftArm=[(0, Z), (0.24, (20, 0, -14)), (0.5, Z)]),
        # a two-handed overhead blow into the ground
        "animation.overlord.weapon_slam": anim(
            0.7,
            rightArm=[(0, Z), (0.22, (-165, 14, 0)), (0.36, (-42, 12, 0)), (0.5, (-36, 12, 0)), (0.7, Z)],
            leftArm=[(0, Z), (0.22, (-165, -14, 0)), (0.36, (-42, -12, 0)), (0.5, (-36, -12, 0)), (0.7, Z)],
            body=[(0, Z), (0.22, (-10, 0, 0)), (0.36, (26, 0, 0)), (0.5, (22, 0, 0)), (0.7, Z)],
            head=[(0, Z), (0.22, (-12, 0, 0)), (0.36, (14, 0, 0)), (0.7, Z)]),
        # a full turn with the blade held out: the body twists all the way round and back
        "animation.overlord.weapon_spin": anim(
            0.75,
            rightArm=[(0, Z), (0.12, (-80, 60, 0)), (0.3, (-86, -10, 70)), (0.48, (-82, -60, 74)), (0.6, (-40, -20, 20)),
                      (0.75, Z)],
            leftArm=[(0, Z), (0.12, (-20, 0, -40)), (0.48, (-20, 0, -50)), (0.75, Z)],
            body=[(0, Z), (0.12, (0, -40, 0)), (0.3, (0, 60, 0)), (0.48, (0, 150, 0)), (0.6, (0, 40, 0)), (0.75, Z)],
            head=[(0, Z), (0.3, (0, -30, 0)), (0.48, (0, -60, 0)), (0.75, Z)]),
        # drawn back to the hip, then driven straight forward at the target
        "animation.overlord.weapon_thrust": anim(
            0.5,
            rightArm=[(0, Z), (0.12, (-20, 0, 18)), (0.22, (-94, 0, 0)), (0.32, (-90, 0, 0)), (0.5, Z)],
            leftArm=[(0, Z), (0.12, (-50, 0, -20)), (0.22, (20, 0, -10)), (0.5, Z)],
            body=[(0, Z), (0.12, (0, 22, 0)), (0.22, (10, -18, 0)), (0.32, (8, -14, 0)), (0.5, Z)],
            head=[(0, Z), (0.22, (6, 10, 0)), (0.5, Z)]),
        # a fist dropped low and driven up past the head
        "animation.overlord.weapon_uppercut": anim(
            0.55,
            rightArm=[(0, Z), (0.14, (34, 0, 12)), (0.28, (-176, 0, 6)), (0.38, (-168, 0, 8)), (0.55, Z)],
            leftArm=[(0, Z), (0.14, (-60, 0, -14)), (0.28, (20, 0, -10)), (0.55, Z)],
            body=[(0, Z), (0.14, (22, 10, 0)), (0.28, (-14, -12, 0)), (0.38, (-10, -8, 0)), (0.55, Z)],
            head=[(0, Z), (0.14, (12, 0, 0)), (0.28, (-24, 0, 0)), (0.55, Z)]),
        # a sheathed blade drawn across the body in one stroke (iaido)
        "animation.overlord.weapon_draw": anim(
            0.55,
            rightArm=[(0, Z), (0.14, (-30, 40, -30)), (0.24, (-92, -70, 0)), (0.36, (-86, -62, 0)), (0.55, Z)],
            leftArm=[(0, Z), (0.14, (-30, 30, -10)), (0.24, (14, 0, -16)), (0.55, Z)],
            body=[(0, Z), (0.14, (10, 30, 0)), (0.24, (4, -34, 0)), (0.36, (4, -28, 0)), (0.55, Z)],
            head=[(0, Z), (0.14, (8, -20, 0)), (0.24, (0, 20, 0)), (0.55, Z)]),
        # god-tier: down on one knee gathering power, rising with both arms flung to the sky, held, then
        # both hands driven down and forward as the spell is loosed
        "animation.overlord.cast_god": anim(
            3.2,
            rightArm=[(0, Z), (0.5, (-40, 0, 30)), (1.0, (-30, 0, 40)), (1.5, (-176, 0, 30)), (2.2, (-170, 0, 26)),
                      (2.6, (-176, 0, 30)), (2.85, (-70, -10, 0)), (3.0, (-64, -10, 0)), (3.2, Z)],
            leftArm=[(0, Z), (0.5, (-40, 0, -30)), (1.0, (-30, 0, -40)), (1.5, (-176, 0, -30)), (2.2, (-170, 0, -26)),
                     (2.6, (-176, 0, -30)), (2.85, (-70, 10, 0)), (3.0, (-64, 10, 0)), (3.2, Z)],
            body=[(0, Z), (0.5, (28, 0, 0)), (1.0, (32, 0, 0)), (1.5, (-12, 0, 0)), (2.6, (-10, 0, 0)), (2.85, (16, 0, 0)),
                  (3.2, Z)],
            head=[(0, Z), (0.5, (30, 0, 0)), (1.0, (34, 0, 0)), (1.5, (-36, 0, 0)), (2.6, (-32, 0, 0)), (2.85, (8, 0, 0)),
                  (3.2, Z)],
            rightLeg=[(0, Z), (0.5, (-40, 0, 0)), (1.0, (-44, 0, 0)), (1.5, Z), (3.2, Z)],
            leftLeg=[(0, Z), (0.5, (60, 0, 0)), (1.0, (64, 0, 0)), (1.5, Z), (3.2, Z)]),
        # the blade snapped across the body to meet a blow, then swept back out in the counter
        "animation.overlord.weapon_parry": anim(
            0.45,
            rightArm=[(0, Z), (0.06, (-80, 50, 0)), (0.16, (-86, 46, 0)), (0.26, (-60, -40, 0)), (0.45, Z)],
            body=[(0, Z), (0.06, (0, 20, 0)), (0.16, (0, 18, 0)), (0.26, (0, -16, 0)), (0.45, Z)],
            leftArm=[(0, Z), (0.06, (-30, 0, -20)), (0.45, Z)]),
        # ---- v8.7: the party's own poses (they share the player's bone names)
        # the shield driven forward off the left arm
        "animation.overlord.party_bash": anim(
            0.5,
            leftArm=[(0, Z), (0.1, (20, 0, -10)), (0.2, (-80, -20, 0)), (0.32, (-70, -20, 0)), (0.5, Z)],
            body=[(0, Z), (0.1, (0, 15, 0)), (0.2, (0, -20, 0)), (0.5, Z)],
            rightArm=[(0, Z), (0.2, (25, 0, 10)), (0.5, Z)]),
        # arms flung wide, chest out: a challenge
        "animation.overlord.party_taunt": anim(
            0.9,
            rightArm=[(0, Z), (0.15, (-30, 0, 70)), (0.6, (-25, 0, 75)), (0.9, Z)],
            leftArm=[(0, Z), (0.15, (-30, 0, -70)), (0.6, (-25, 0, -75)), (0.9, Z)],
            head=[(0, Z), (0.15, (-15, 0, 0)), (0.6, (-15, 0, 0)), (0.9, Z)],
            body=[(0, Z), (0.15, (-6, 0, 0)), (0.9, Z)]),
        # the bow raised and the string drawn to the cheek, then loosed
        "animation.overlord.party_draw": anim(
            0.7,
            leftArm=[(0, Z), (0.15, (-90, 10, 0)), (0.5, (-90, 10, 0)), (0.7, Z)],
            rightArm=[(0, Z), (0.15, (-90, -25, 0)), (0.42, (-95, -60, 0)), (0.5, (-80, 20, 0)), (0.7, Z)],
            body=[(0, Z), (0.15, (0, -20, 0)), (0.5, (0, -20, 0)), (0.7, Z)],
            head=[(0, Z), (0.15, (0, -15, 0)), (0.5, (0, -15, 0)), (0.7, Z)]),
        # an arrow loosed high at the sky
        "animation.overlord.party_skyshot": anim(
            0.8,
            leftArm=[(0, Z), (0.15, (-150, 10, 0)), (0.6, (-150, 10, 0)), (0.8, Z)],
            rightArm=[(0, Z), (0.15, (-140, -20, 0)), (0.5, (-150, -50, 0)), (0.6, (-130, 20, 0)), (0.8, Z)],
            head=[(0, Z), (0.15, (-35, 0, 0)), (0.6, (-35, 0, 0)), (0.8, Z)]),
        # hands together at the chest, head bowed
        "animation.overlord.party_pray": anim(
            1.0,
            rightArm=[(0, Z), (0.2, (-60, 30, 0)), (0.8, (-62, 32, 0)), (1.0, Z)],
            leftArm=[(0, Z), (0.2, (-60, -30, 0)), (0.8, (-62, -32, 0)), (1.0, Z)],
            head=[(0, Z), (0.2, (20, 0, 0)), (0.8, (22, 0, 0)), (1.0, Z)]),
        # an overarm throw
        "animation.overlord.party_throw": anim(
            0.5,
            rightArm=[(0, Z), (0.12, (-170, 0, 10)), (0.24, (-40, 0, 0)), (0.5, Z)],
            body=[(0, Z), (0.12, (0, -15, 0)), (0.24, (0, 15, 0)), (0.5, Z)]),
        # fingers across the lute's strings, a sway to the music
        "animation.overlord.party_strum": anim(
            1.0,
            rightArm=[(0, Z), (0.15, (-40, 30, 0)), (0.3, (-30, 20, 0)), (0.45, (-40, 30, 0)), (0.6, (-30, 20, 0)), (0.8, (-40, 30, 0)), (1.0, Z)],
            leftArm=[(0, Z), (0.15, (-50, -40, 0)), (0.8, (-50, -40, 0)), (1.0, Z)],
            body=[(0, Z), (0.25, (0, 0, 5)), (0.5, (0, 0, -5)), (0.75, (0, 0, 5)), (1.0, Z)],
            head=[(0, Z), (0.25, (0, 0, -6)), (0.5, (0, 0, 6)), (0.75, (0, 0, -6)), (1.0, Z)]),
        # the weapon raised high in both hands and held while it wakes
        "animation.overlord.weapon_awaken": anim(
            1.4,
            rightArm=[(0, Z), (0.3, (-178, -6, 10)), (0.6, (-170, -6, 8)), (0.9, (-178, -6, 10)), (1.15, (-160, -6, 8)),
                      (1.4, Z)],
            leftArm=[(0, Z), (0.3, (-178, 6, -10)), (0.6, (-170, 6, -8)), (0.9, (-178, 6, -10)), (1.15, (-160, 6, -8)),
                     (1.4, Z)],
            body=[(0, Z), (0.3, (-10, 0, 0)), (1.15, (-8, 0, 0)), (1.4, Z)],
            head=[(0, Z), (0.3, (-30, 0, 0)), (1.15, (-26, 0, 0)), (1.4, Z)]),
    }}


RENDER_CONTROLLER = "controller.render.overlord.entity"
RETAINER_CONTROLLER = "controller.render.overlord.retainer"
RETAINER_LOOKS = 12  # two looks per vocation
VOCATIONS = ["fighter", "archer", "mage", "healer", "rogue", "bard"]


def render_controllers_json():
    looks = [f"v{n}" for n in range(RETAINER_LOOKS)]
    return {"format_version": "1.8.0", "render_controllers": {
        RENDER_CONTROLLER: {
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": ["Texture.default"],
        },
        # Retainers pick their model and skin from the entity's variant (one per look).
        RETAINER_CONTROLLER: {
            "arrays": {
                "textures": {"Array.skins": [f"Texture.{k}" for k in looks]},
                "geometries": {"Array.models": [f"Geometry.{k}" for k in looks]},
            },
            "geometry": "Array.models[query.variant]",
            "materials": [{"*": "Material.default"}],
            "textures": ["Array.skins[query.variant]"],
        },
    }}


# creatures drawn with another one's model and skin
MODEL_ALIASES = {"soul_steed": "soul_eater", **{f"guardian_{k}": k for k in GUARDIAN_COMPANIONS}}


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
        if name == "retainer":
            d["textures"] = {f"v{n}": f"textures/entity/{NS}/retainer_{n}" for n in range(RETAINER_LOOKS)}
            d["geometry"] = {f"v{n}": f"geometry.overlord.retainer_{n}" for n in range(RETAINER_LOOKS)}
            d["render_controllers"] = [RETAINER_CONTROLLER]
        if name in MODEL_ALIASES:  # drawn with another creature's model and skin
            d["textures"] = {"default": f"textures/entity/{NS}/{MODEL_ALIASES[name]}"}
            d["geometry"] = {"default": f"geometry.overlord.{MODEL_ALIASES[name]}"}
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
    **{f"dragonscale_{piece}": (piece, f"{NS}_dragonscale_{layer}") for piece, (layer, _s) in ARMOR.items()},
    **{f"ranger_{piece}": (piece, f"{NS}_ranger_{layer}") for piece, (layer, _s) in ARMOR.items()},
    **{f"infernal_{piece}": (piece, f"{NS}_infernal_{layer}") for piece, (layer, _s) in ARMOR.items()},
    **{f"vestment_{piece}": (piece, f"{NS}_vestment_{layer}") for piece, (layer, _s) in ARMOR.items()},
    **{f"bonedragon_{piece}": (piece, f"{NS}_bonedragon_{layer}") for piece, (layer, _s) in ARMOR.items()},
    **{f"beasthide_{piece}": (piece, f"{NS}_beasthide_{layer}") for piece, (layer, _s) in ARMOR.items()},
    **{f"platinum_{piece}": (piece, f"{NS}_platinum_{layer}") for piece, (layer, _s) in ARMOR.items()},
    **{f"crimson_{piece}": (piece, f"{NS}_crimson_{layer}") for piece, (layer, _s) in ARMOR.items()},
    **{f"cavalier_{piece}": (piece, f"{NS}_cavalier_{layer}") for piece, (layer, _s) in ARMOR.items()},
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
    "render_controller": {"controller.render.armor", "controller.render.item_default"},
    "material": {"entity_alphatest", "armor", "armor_enchanted", "entity_emissive_alpha", "entity_alphatest_glint"},
    "texture": {"textures/misc/enchanted_actor_glint", "textures/misc/enchanted_item_glint"},
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
