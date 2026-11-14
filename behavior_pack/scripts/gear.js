// Overlord: Tomb of Nazarick - gear upgrades: quality, gems and salvage.
//
// Quality: any weapon or armour piece of the add-on can be refined with Refining Stones and Gold
// Coins, from Common up to Divine. Each step adds 4% melee damage to a weapon (rpg.js) or turns aside
// 1.5% of the harm its wearer takes for an armour piece; a refinement can fail, which costs the stones
// but never the item. Quality opens sockets: a Fine weapon has one, an Epic weapon two, a Superior
// armour piece one. Gems set into them work on every blow (weapons) or all the time (armour), and can
// be taken out again for a few coins. Salvage breaks a piece down into Refining Stones, Data Crystals
// and any gems it held. Everything is written on the item.
//
// Refining, socketing and salvage need a Dwarf Runesmith, an anvil or a smithing table close by.
import { world, system, EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { creditedPlayer, giveItem, isElite, notify, registerMenu, restoreMana } from "./rpg.js";
import { countItem, takeItem } from "./spells.js";
import { PLUS_KEY, RUNES, runeOf, setLoreWriter } from "./forge.js";
import * as fx from "./vfx.js";

const NS = "overlord";
const id = (/** @type {string} */ name) => `${NS}:${name}`;
const TICKS = 20;
const COIN = id("yggdrasil_gold_coin");
export const STONE = id("refining_stone");
export const QUALITY_KEY = "overlord:quality";
export const GEMS_KEY = "overlord:gems";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").ItemStack} ItemStack */

/** Quality steps, their colour, the stones and coins the next step costs, and its chance. */
export const QUALITY = [
  { name: "Common", color: "§f" },
  { name: "Fine", color: "§a", stones: 1, coins: 10, chance: 1 },
  { name: "Superior", color: "§b", stones: 2, coins: 20, chance: 0.9 },
  { name: "Epic", color: "§d", stones: 3, coins: 35, chance: 0.75 },
  { name: "Legendary", color: "§6", stones: 5, coins: 60, chance: 0.6 },
  { name: "Divine", color: "§e", stones: 8, coins: 100, chance: 0.45 },
];
export const MAX_QUALITY = QUALITY.length - 1;

/** Gems: what they do in a weapon and in armour. */
/** @type {Record<string, { name: string, element: string, weapon: string, armour: string }>} */
export const GEMS = {
  ruby: { name: "Ruby of Embers", element: "fire", weapon: "a quarter of blows set the foe alight and scorch it", armour: "Fire Resistance; with two, Strength I" },
  sapphire: { name: "Sapphire of Frost", element: "ice", weapon: "a third of blows slow the foe", armour: "half a mana a second each" },
  topaz: { name: "Topaz of Storms", element: "lightning", weapon: "a fifth of blows jolt the nearest other foe for 4", armour: "with two, Speed I" },
  jade: { name: "Jade of Venom", element: "acid", weapon: "a quarter of blows poison the foe", armour: "half a heart every 4 seconds each" },
  onyx: { name: "Onyx of Night", element: "dark", weapon: "blows drink 5% of their harm", armour: "turns aside 5% of magical harm each" },
  sunstone: { name: "Sunstone", element: "holy", weapon: "+20% harm to the undead and demons", armour: "a kill heals you a heart each" },
};

// ------------------------------------------------------------------ reading items

/** @param {ItemStack | undefined} item */
export function qualityOf(item) {
  try {
    const q = item?.getDynamicProperty(QUALITY_KEY);
    return typeof q === "number" ? Math.max(0, Math.min(MAX_QUALITY, Math.floor(q))) : 0;
  } catch {
    return 0;
  }
}

/** @param {ItemStack | undefined} item @returns {string[]} */
export function gemsOf(item) {
  try {
    const raw = item?.getDynamicProperty(GEMS_KEY);
    return typeof raw === "string" && raw ? raw.split(",").filter((g) => g in GEMS) : [];
  } catch {
    return [];
  }
}

/** Whether an item is one of the add-on's armour pieces. @param {string} typeId */
export function isArmour(typeId) {
  return typeId.startsWith(`${NS}:`) && /_(helmet|chestplate|leggings|boots)$/.test(typeId) && typeId !== id("mask_of_envy");
}

/** Whether an item is one of the add-on's weapons (anything that can be reinforced or bears a kind). @param {string} typeId */
export function isWeapon(typeId) {
  return WEAPON_IDS.has(typeId);
}

const WEAPON_IDS = new Set(
  ["staff_of_ainz_ooal_gown", "spuit_lance", "ginnungagap", "god_slaying_emperor_blade", "death_knight_sword", "dark_warrior_greatsword",
    "razor_edge", "stiletto", "shadow_of_yggdrasil", "aura_whip", "frost_pain", "brain_katana", "iron_gauntlets", "magic_rifle",
    "runic_hammer", "fang_dagger", "charons_guidance", "angel_mace", "hellfire_blade", "kilineyram", "safarlisia", "takemikazuchi",
    "fell_iron", "fluder_staff", "golem_fist", "holy_staff", "blade_bug", "martial_lord_club", "elf_kings_staff", "giants_maul",
    "dragonbone_blade", "six_arms_knuckles", "cavalier_lance", "ghoulfang_sickle", "heartwood_staff", "runeblade"].map(id)
);

/** How many sockets an item has at a quality. @param {string} typeId @param {number} quality */
export function socketsFor(typeId, quality) {
  if (isWeapon(typeId)) return quality >= 3 ? 2 : quality >= 1 ? 1 : 0;
  if (isArmour(typeId)) return quality >= 2 ? 1 : 0;
  return 0;
}

/** Every line written on a worked item: quality, reinforcement, rune and gems. @param {ItemStack} item */
export function loreOf(item) {
  const lines = [];
  const q = qualityOf(item);
  if (q > 0) lines.push(`${QUALITY[q].color}${QUALITY[q].name}`, `§7${isArmour(item.typeId) ? `turns aside ${(q * 1.5).toFixed(1)}% of harm` : `+${q * 4}% melee damage`}`);
  let plus = 0;
  try {
    const raw = item.getDynamicProperty(PLUS_KEY);
    plus = typeof raw === "number" ? raw : 0;
  } catch {
    // no properties
  }
  if (plus > 0) lines.push(`§6Reinforced +${plus}`, `§7+${plus * 6}% melee damage`);
  const rune = runeOf(item);
  if (rune) lines.push(`§b${RUNES[rune].name}`, `§7${RUNES[rune].help}`);
  const gems = gemsOf(item);
  const sockets = socketsFor(item.typeId, q);
  if (sockets > 0) {
    lines.push(`§dSockets: ${[...gems.map((g) => `[${GEMS[g].name}]`), ...Array(Math.max(0, sockets - gems.length)).fill("[ ]")].join(" ")}`);
    for (const g of gems) lines.push(`§7${isArmour(item.typeId) ? GEMS[g].armour : GEMS[g].weapon}`);
  }
  return lines;
}

/** Rewrites an item's lore after a change. @param {ItemStack} item */
export function relore(item) {
  try {
    item.setLore(loreOf(item));
  } catch {
    // lore is cosmetic
  }
}

// ------------------------------------------------------------------ the workbench

/** Whether a smith, an anvil or a smithing table is near the player. @param {Player} player */
export function atWorkbench(player) {
  try {
    if (player.dimension.getEntities({ type: id("dwarf"), location: player.location, maxDistance: 10 }).length > 0) return true;
  } catch {
    // no entities query
  }
  const base = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -1; dy <= 2; dy++) {
      for (let dz = -3; dz <= 3; dz++) {
        try {
          const type = player.dimension.getBlock({ x: base.x + dx, y: base.y + dy, z: base.z + dz })?.typeId ?? "";
          if (/anvil$|smithing_table$/.test(type)) return true;
        } catch {
          // an unloaded block
        }
      }
    }
  }
  return false;
}

/** The add-on weapon or armour piece in the player's hand, with where it sits. @param {Player} player */
function heldGear(player) {
  const container = player.getComponent("minecraft:inventory")?.container;
  const slot = player.selectedSlotIndex ?? 0;
  const item = container?.getItem(slot);
  if (!container || !item || (!isWeapon(item.typeId) && !isArmour(item.typeId))) return undefined;
  return { container, slot, item };
}

/**
 * Refines the piece in the player's hand one step. Returns a message.
 * @param {Player} player @param {() => number} [random]
 */
export function refine(player, random = Math.random) {
  const held = heldGear(player);
  if (!held) return "§7Hold one of the add-on's weapons or armour pieces to refine it";
  if (!atWorkbench(player)) return "§7Refining needs a Dwarf Runesmith, an anvil or a smithing table close by";
  const q = qualityOf(held.item);
  if (q >= MAX_QUALITY) return "§7This piece is already Divine";
  const next = QUALITY[q + 1];
  if (countItem(player, STONE) < (next.stones ?? 0) || countItem(player, COIN) < (next.coins ?? 0)) {
    return `§7${next.name} costs ${next.stones} Refining Stone(s) and ${next.coins} Gold Coins`;
  }
  takeItem(player, STONE, next.stones ?? 0);
  takeItem(player, COIN, next.coins ?? 0);
  if (random() >= (next.chance ?? 1)) {
    sound(player, "random.anvil_land", 1.4);
    fx.spark(player.dimension, fx.handOf(player), "none", 0.8);
    return `§cThe stone cracks - the refinement failed. §7(${Math.round((next.chance ?? 1) * 100)}% chance; the piece is unharmed)`;
  }
  try {
    held.item.setDynamicProperty(QUALITY_KEY, q + 1);
    relore(held.item);
    held.container.setItem(held.slot, held.item);
  } catch {
    return "§7This piece cannot be refined";
  }
  sound(player, "random.anvil_use", 1.2);
  fx.rise(player.dimension, player.location, q + 1 >= 4 ? "holy" : "arcane", 1);
  fx.flash(player.dimension, fx.handOf(player), q + 1 >= 4 ? "holy" : "arcane", 1);
  const opened = socketsFor(held.item.typeId, q + 1) > socketsFor(held.item.typeId, q) ? " A new socket opens." : "";
  return `${next.color}Refined to ${next.name}!§r${opened}`;
}

/**
 * Sets a gem from the player's inventory into a free socket of the piece in their hand. Returns a message.
 * @param {Player} player @param {string} gem
 */
export function socket(player, gem) {
  const info = GEMS[gem];
  if (!info) return "§7No such gem";
  const held = heldGear(player);
  if (!held) return "§7Hold one of the add-on's weapons or armour pieces to set a gem in it";
  if (!atWorkbench(player)) return "§7Setting gems needs a Dwarf Runesmith, an anvil or a smithing table close by";
  const gems = gemsOf(held.item);
  const sockets = socketsFor(held.item.typeId, qualityOf(held.item));
  if (sockets === 0) return `§7Refine this piece to ${isArmour(held.item.typeId) ? "Superior" : "Fine"} to open a socket`;
  if (gems.length >= sockets) return "§7Every socket of this piece is filled";
  if (countItem(player, id(`gem_${gem}`)) < 1) return `§7You have no ${info.name}`;
  try {
    held.item.setDynamicProperty(GEMS_KEY, [...gems, gem].join(","));
    relore(held.item);
    held.container.setItem(held.slot, held.item);
  } catch {
    return "§7This piece cannot take a gem";
  }
  takeItem(player, id(`gem_${gem}`), 1);
  sound(player, "random.anvil_use", 1.6);
  fx.spark(player.dimension, fx.handOf(player), info.element, 1);
  return `§dThe ${info.name} is set: §7${isArmour(held.item.typeId) ? info.armour : info.weapon}`;
}

export const UNSOCKET_COST = 10;

/** Takes every gem out of the piece in the player's hand, for a few coins. Returns a message. @param {Player} player */
export function unsocket(player) {
  const held = heldGear(player);
  if (!held) return "§7Hold the piece whose gems you want back";
  if (!atWorkbench(player)) return "§7Taking gems out needs a Dwarf Runesmith, an anvil or a smithing table close by";
  const gems = gemsOf(held.item);
  if (gems.length === 0) return "§7This piece holds no gems";
  if (countItem(player, COIN) < UNSOCKET_COST) return `§7Taking the gems out costs ${UNSOCKET_COST} Gold Coins`;
  takeItem(player, COIN, UNSOCKET_COST);
  try {
    held.item.setDynamicProperty(GEMS_KEY, "");
    relore(held.item);
    held.container.setItem(held.slot, held.item);
  } catch {
    return "§7The gems will not come out";
  }
  for (const g of gems) giveItem(player, id(`gem_${g}`), 1);
  return `§dYou take back ${gems.length} gem${gems.length > 1 ? "s" : ""}`;
}

/**
 * Breaks the piece in the player's hand down into materials. Returns a message.
 * @param {Player} player @param {() => number} [random]
 */
export function salvage(player, random = Math.random) {
  const held = heldGear(player);
  if (!held) return "§7Hold one of the add-on's weapons or armour pieces to salvage it";
  if (!atWorkbench(player)) return "§7Salvage needs a Dwarf Runesmith, an anvil or a smithing table close by";
  const q = qualityOf(held.item);
  let plus = 0;
  try {
    const raw = held.item.getDynamicProperty(PLUS_KEY);
    plus = typeof raw === "number" ? raw : 0;
  } catch {
    // none
  }
  const gems = gemsOf(held.item);
  held.container.setItem(held.slot, undefined);
  const stones = 1 + q + plus;
  const crystals = 2 + Math.floor(random() * 3);
  giveItem(player, STONE, stones);
  giveItem(player, id("data_crystal"), crystals);
  for (const g of gems) giveItem(player, id(`gem_${g}`), 1);
  let bonus = "";
  if (random() < 0.2) {
    const keys = Object.keys(GEMS);
    const g = keys[Math.floor(random() * keys.length)];
    giveItem(player, id(`gem_${g}`), 1);
    bonus = `, and you find a ${GEMS[g].name} in it`;
  }
  sound(player, "random.anvil_land", 0.8);
  fx.spark(player.dimension, fx.handOf(player), "none", 1.2);
  return `§eSalvaged: §b${stones} Refining Stone${stones > 1 ? "s" : ""}§e, §b${crystals} Data Crystals§e${gems.length ? `, ${gems.length} gem(s) back` : ""}${bonus}`;
}

/** @param {Player} player @param {string} name @param {number} pitch */
function sound(player, name, pitch) {
  try {
    player.playSound(name, { volume: 1, pitch });
  } catch {
    // cosmetic only
  }
}

// ------------------------------------------------------------------ in combat

/** What the player wears: armour quality steps and gems, refreshed every second. */
/** @type {Map<string, { quality: number, gems: Record<string, number> }>} */
const worn = new Map();

/** @param {Player} player */
export function wornGear(player) {
  /** @type {{ quality: number, gems: Record<string, number> }} */
  const out = { quality: 0, gems: {} };
  try {
    const gear = player.getComponent("minecraft:equippable");
    if (!gear) return out;
    for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet]) {
      const item = gear.getEquipment(slot);
      if (!item || !isArmour(item.typeId)) continue;
      out.quality += qualityOf(item);
      for (const g of gemsOf(item)) out.gems[g] = (out.gems[g] ?? 0) + 1;
    }
  } catch {
    // the player is leaving
  }
  return out;
}

/** The weapon in the player's main hand. @param {Player} player */
function heldItem(player) {
  try {
    return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}

let striking = false;

/** @param {Player} player @param {Entity} foe @param {number} amount */
function strike(player, foe, amount) {
  try {
    const health = foe.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0 || amount <= 0) return;
    if (health.currentValue - amount > 0.5) health.setCurrentValue(health.currentValue - amount);
    else {
      striking = true;
      try {
        foe.applyDamage(health.effectiveMax * 4, { cause: EntityDamageCause.magic, damagingEntity: player });
      } finally {
        striking = false;
      }
    }
  } catch {
    // the foe vanished
  }
}

/** @param {Entity} entity @param {number} amount */
function heal(entity, amount) {
  try {
    const health = entity.getComponent("minecraft:health");
    if (health && health.currentValue > 0 && amount > 0) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));
  } catch {
    // unloading
  }
}

/**
 * The gems of a weapon act on a blow.
 * @param {Player} player @param {Entity} victim @param {number} damage @param {string[]} gems @param {() => number} [random]
 */
export function gemBlow(player, victim, damage, gems, random = Math.random) {
  const d = player.dimension;
  const at = { x: victim.location.x, y: victim.location.y + 1, z: victim.location.z };
  for (const g of gems) {
    if (g === "ruby" && random() < 0.25) {
      victim.setOnFire(3, true);
      strike(player, victim, 2);
      fx.spark(d, at, "fire", 0.7);
    } else if (g === "sapphire" && random() < 0.34) {
      victim.addEffect("slowness", 2 * TICKS, { amplifier: 1 });
      fx.puff(d, "shard", at, "ice", 0.7);
    } else if (g === "topaz" && random() < 0.2) {
      try {
        const other = d
          .getEntities({ location: victim.location, maxDistance: 5, families: ["monster"] })
          .find((e) => e.id !== victim.id && e.isValid);
        if (other) {
          strike(player, other, 4);
          fx.beam(d, at, { x: other.location.x, y: other.location.y + 1, z: other.location.z }, "lightning", 0.7);
        }
      } catch {
        // nothing near
      }
    } else if (g === "jade" && random() < 0.25) {
      victim.addEffect("poison", 3 * TICKS, { amplifier: 0 });
      fx.puff(d, "droplet", at, "acid", 0.7);
    } else if (g === "onyx") {
      heal(player, damage * 0.05);
    } else if (g === "sunstone" && (victim.matches({ families: ["undead"] }) || victim.matches({ families: ["demon"] }))) {
      strike(player, victim, damage * 0.2);
      fx.flash(d, at, "holy", 0.7);
    }
  }
}

world.afterEvents.entityHurt.subscribe((event) => {
  if (striking) return;
  try {
    const victim = event.hurtEntity;
    const source = event.damageSource;
    // Blows dealt: the weapon's gems.
    const attacker = source.damagingEntity;
    if (attacker && attacker.typeId === "minecraft:player" && source.cause === EntityDamageCause.entityAttack && victim.isValid && victim.typeId !== "minecraft:player") {
      const health = victim.getComponent("minecraft:health");
      if (health && event.damage < health.effectiveMax * 3) {
        const gems = gemsOf(heldItem(/** @type {Player} */ (attacker)));
        if (gems.length > 0) gemBlow(/** @type {Player} */ (attacker), victim, event.damage, gems);
      }
    }
    // Blows taken: armour quality and Onyx.
    if (victim.typeId !== "minecraft:player" || !victim.isValid) return;
    const player = /** @type {Player} */ (victim);
    const health = player.getComponent("minecraft:health");
    if (!health || health.currentValue <= 0) return;
    const cause = String(source.cause);
    if (["void", "selfDestruct", "suicide", "starve", "override"].includes(cause)) return;
    const gear = worn.get(player.id) ?? wornGear(player);
    let share = gear.quality * 0.015;
    if (["magic", "fire", "lightning", "entityExplosion", "wither", "fireTick"].includes(cause)) share += (gear.gems.onyx ?? 0) * 0.05;
    if (share > 0) heal(player, event.damage * share);
  } catch {
    // someone left mid-blow
  }
});

// Sunstone in armour: a kill heals; elites sometimes carry a Refining Stone.
world.afterEvents.entityDie.subscribe((event) => {
  try {
    const player = creditedPlayer(event.damageSource.damagingEntity);
    if (!player || event.deadEntity.typeId === "minecraft:player") return;
    const gear = worn.get(player.id);
    if (gear?.gems.sunstone) heal(player, 2 * gear.gems.sunstone);
    if (isElite(event.deadEntity) && Math.random() < 0.25) giveItem(player, STONE, 1);
  } catch {
    // the killer left
  }
});

/** One second of worn gear: refresh what is worn, and the effects of armour gems. @param {Player} player @param {number} second */
export function tickGear(player, second) {
  const gear = wornGear(player);
  worn.set(player.id, gear);
  const gems = gear.gems;
  if (gems.ruby) player.addEffect("fire_resistance", 3 * TICKS, { amplifier: 0, showParticles: false });
  if ((gems.ruby ?? 0) >= 2) player.addEffect("strength", 3 * TICKS, { amplifier: 0, showParticles: false });
  if ((gems.topaz ?? 0) >= 2) player.addEffect("speed", 3 * TICKS, { amplifier: 0, showParticles: false });
  if (gems.sapphire) restoreMana(player, 0.5 * gems.sapphire);
  if (gems.jade && second % 4 === 0) heal(player, gems.jade);
}

let second = 0;
system.runInterval(() => {
  second += 1;
  for (const player of world.getAllPlayers()) {
    try {
      tickGear(player, second);
    } catch {
      // the player is leaving
    }
  }
}, TICKS);

// ------------------------------------------------------------------ menu

/** @param {Player} player */
export function openWorkbench(player) {
  const held = heldGear(player);
  const lines = [];
  /** @type {(() => void)[]} */
  const actions = [];
  const form = new ActionFormData().title("Workbench: refine, gems, salvage");
  if (held) {
    const q = qualityOf(held.item);
    const gems = gemsOf(held.item);
    const sockets = socketsFor(held.item.typeId, q);
    lines.push(
      `In hand: ${QUALITY[q].color}${QUALITY[q].name}§r ${isArmour(held.item.typeId) ? "armour piece" : "weapon"}`,
      `Sockets: ${sockets === 0 ? "none yet" : `${gems.length}/${sockets} filled`}`,
      q < MAX_QUALITY
        ? `Next: ${QUALITY[q + 1].color}${QUALITY[q + 1].name}§r for ${QUALITY[q + 1].stones} Refining Stone(s) and ${QUALITY[q + 1].coins} Gold Coins (${Math.round((QUALITY[q + 1].chance ?? 1) * 100)}% chance)`
        : "It is Divine: it cannot be refined further."
    );
  } else lines.push("§7Hold one of the add-on's weapons or armour pieces.§r");
  lines.push(
    "",
    `You carry §b${countItem(player, STONE)} Refining Stones§r.`,
    `§eQuality§r: each step adds 4% melee damage to a weapon, or turns aside 1.5% of harm for each armour piece. A weapon opens a socket at Fine and a second at Epic; armour opens one at Superior.`,
    "§eGems§r:",
    ...Object.values(GEMS).map((g) => ` ${g.name}: weapon - ${g.weapon}; armour - ${g.armour}`),
    "§eSalvage§r breaks a piece into Refining Stones (more for refined and reinforced pieces), Data Crystals and its gems.",
    atWorkbench(player) ? "" : "\n§cYou need a Dwarf Runesmith, an anvil or a smithing table close by.§r"
  );
  form.body(lines.join("\n"));
  if (held) {
    form.button("Refine");
    actions.push(() => notify(player, refine(player)));
    for (const key of Object.keys(GEMS)) {
      if (countItem(player, id(`gem_${key}`)) < 1) continue;
      form.button(`Set the ${GEMS[key].name}`);
      actions.push(() => notify(player, socket(player, key)));
    }
    if (gemsOf(held.item).length > 0) {
      form.button(`Take the gems out (${UNSOCKET_COST} Gold Coins)`);
      actions.push(() => notify(player, unsocket(player)));
    }
    form.button("Salvage this piece");
    actions.push(() => openSalvage(player));
  }
  form.button("Close");
  actions.push(() => {});
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !player.isValid) return;
      actions[response.selection]?.();
    })
    .catch(() => {});
}

/** Asks before breaking a piece. @param {Player} player */
function openSalvage(player) {
  new ActionFormData()
    .title("Salvage")
    .body("Break the piece in your hand down into materials? It is destroyed; its gems come back to you.")
    .button("Salvage it")
    .button("Keep it")
    .show(player)
    .then((response) => {
      if (!response.canceled && response.selection === 0 && player.isValid) notify(player, salvage(player));
    })
    .catch(() => {});
}

registerMenu(() => "Workbench: refine, gems, salvage", openWorkbench);

setLoreWriter(loreOf); // reinforcing and runes keep the quality and gem lines
