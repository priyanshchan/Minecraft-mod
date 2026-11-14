"""The add-on's weapons as 3D models held in the hand (attachables), with their hold animations.

Every weapon is built in its own frame: the middle of the grip at the origin, the weapon running up +Y,
the flat of a blade facing +-X (its width runs along Z). The model is then placed in the player's skeleton
at the hand and the hold animations turn it into position - in third person on the arm the game raises
when you hold something, in first person on the arm the game draws at the lower right. Both were set up
by drawing them with tools/weapon_view.py.

Parts flagged as glowing (runes, edges, gems, orbs) are written with a low alpha: the attachables use the
"entity_emissive_alpha" material, which draws those texels lit in the dark.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from modelkit import Model, shade, mix

GRIP = (-6.0, 13.5, 0.0)  # the middle of the fist of the right arm, in the player's model space
GLOW_ALPHA = 110  # alpha of glowing texels (above the cut-out threshold either way)
SKELETON = [  # the player's bones, without cubes, so the weapon can hang from rightItem
    ("root", None, (0, 0, 0)), ("waist", "root", (0, 12, 0)), ("body", "waist", (0, 24, 0)),
    ("head", "body", (0, 24, 0)), ("leftArm", "body", (5, 22, 0)), ("leftItem", "leftArm", (6, 15, 1)),
    ("rightArm", "body", (-5, 22, 0)), ("rightItem", "rightArm", (-6, 15, 1)),
    ("leftLeg", "root", (1.9, 12, 0)), ("rightLeg", "root", (-1.9, 12, 0)),
]

# How each kind is held: (third person rotation, position), (first person rotation, position)
HOLDS = {
    "blade": (((60, 0, 0), (0, 0, 0)), ((150, 0, 0), (0, 0, 0))),
    "greatsword": (((60, 0, 0), (0, 0, 0)), ((150, 0, 0), (0, 0, 0))),
    "dagger": (((70, 0, 0), (0, 0, 0)), ((150, 0, 0), (0, 0, 0))),
    "heavy": (((55, 0, 0), (0, 0, 0)), ((150, 0, 0), (0, 0, 0))),
    "polearm": (((60, 0, 0), (0, 0, 0)), ((150, 0, 0), (0, 0, 0))),
    "staff": (((25, 0, 0), (0, 0, 0)), ((165, 0, -10), (0, 0, 0))),
    "whip": (((60, 0, 0), (0, 0, 0)), ((150, 0, 0), (0, 0, 0))),
    "rifle": (((90, 0, 0), (0, 0, 0)), ((115, 0, 0), (0, 0, 0))),
    "fist": (((0, 0, 0), (0, 0, 0)), ((0, 0, 0), (0, 0, 0))),
}


class Weapon:
    """A weapon model in the making: boxes placed relative to the grip."""

    def __init__(self, key, kind):
        self.key, self.kind = key, kind
        self.model = Model(f"weapon_{key}", bounds=(4.0, 4.0, 1.0))
        for name, parent, pivot in SKELETON:
            self.model.bone(name, pivot, parent)
        self.bone = self.model.bone("weapon", GRIP, "rightItem")
        self.glowing = []
        self.tip = (0.0, 10.0, 0.0)

    def box(self, x, y, z, w, h, d, color, glow=False, inflate=0.0, noise=3, rotation=None, pivot=None):
        """A box with its low corner at (x, y, z) in the weapon's frame."""
        piv = None if pivot is None else (GRIP[0] + pivot[0], GRIP[1] + pivot[1], GRIP[2] + pivot[2])
        c = self.bone.cube((GRIP[0] + x, GRIP[1] + y, GRIP[2] + z), (w, h, d), inflate, rotation, piv)
        c.fill(color, noise=0 if glow else noise, seed=len(self.bone.cubes))
        if glow:
            self.glowing.append(c)
        return c

    # ------------------------------------------------------------- parts
    def grip(self, y0, length, color, wrap=None, thick=1):
        c = self.box(-thick / 2, y0, -thick / 2, thick, length, thick, color, inflate=0.1)
        if wrap:
            for f in c.sides:
                for row in range(0, length, 2):
                    f.hline(row, wrap)
        return c

    def guard(self, y, width, color, depth=1, thick=1, glow=False):
        return self.box(-depth / 2 - 0.5, y, -width / 2, depth + 1, thick, width, color, glow=glow)

    def pommel(self, y, color, size=2, gem=None):
        c = self.box(-size / 2, y, -size / 2, size, size, size, color)
        if gem:
            self.box(-0.5, y + size - 0.6, -0.5, 1, 1, 1, gem, glow=True, inflate=-0.1)
        return c

    def blade(self, y0, length, width, color, edge=None, glow_edge=False, runes=None, taper=4, curve=0.0, wave=0.0,
              thick=1, fuller=None):
        """A blade of `width` along Z, tapering to a point over its last `taper` rows. `curve` bends it
        backwards (katanas), `wave` ripples it (flamberges). Edges and runes may glow."""
        edge = edge or shade(color, 1.25)
        # A straight blade is one piece up to where it narrows; curved and rippled ones are built in steps.
        segment = 2 if (curve or wave) else max(2, length - taper)
        y = y0
        rows = []
        while y < y0 + length:
            h = min(segment if y == y0 else 2, y0 + length - y)
            left = (y0 + length) - y
            w = width if left > taper else max(1, round(width * left / (taper + 1)))
            t = (y - y0) / max(1, length)
            dz = -curve * t * t + (wave * math.sin(t * math.pi * 5) if wave else 0.0)
            rows.append((y, h, w, dz))
            y += h
        for y, h, w, dz in rows:
            core_w = max(1, w - 2) if w >= 3 else w
            body = self.box(-thick / 2, y, -w / 2 + dz, thick, h, w, color, inflate=-0.05 if thick == 1 else 0.0)
            for f in (body.right, body.left):
                if f.w >= 3:
                    f.vline(0, edge)
                    f.vline(f.w - 1, edge)
                    if fuller and f.w >= 4:
                        f.vline(f.w // 2, fuller)
            if glow_edge and w >= 2:
                # a glowing edge along the leading side of the blade
                self.box(-thick / 2, y, -w / 2 + dz - 0.4, thick, h, 1, edge, glow=True, inflate=-0.15)
        if runes:
            for i, (ry, rcol) in enumerate(runes):
                if ry < y0 + length - taper:
                    self.box(-thick / 2 - 0.05, y0 + ry, -0.5, thick, 1, 1, rcol, glow=True, inflate=0.06)
        self.tip = (0.0, y0 + length, -curve)
        return rows

    def shaft(self, y0, length, color, band=None, thick=1):
        c = self.box(-thick / 2, y0, -thick / 2, thick, length, thick, color, inflate=0.05)
        if band:
            for f in c.sides:
                for row in range(2, length, 6):
                    f.hline(row, band)
        return c

    def gem(self, x, y, z, color, size=1):
        return self.box(x - size / 2, y - size / 2, z - size / 2, size, size, size, color, glow=True)

    # ------------------------------------------------------------- output
    def finish(self):
        self.model.pack()
        for b in self.model.bones:
            if b.name == "weapon":
                b.locators = {"tip": [round(GRIP[0] + self.tip[0], 3), round(GRIP[1] + self.tip[1], 3), round(GRIP[2] + self.tip[2], 3)]}
        return self

    def texture(self):
        """The HD texture, with glowing parts given their low alpha."""
        img = self.model.hd().copy()
        a = np.asarray(img).copy()
        k = self.model.HD
        for c in self.glowing:
            u, v = c.uv
            w, h, d = c.size
            region = a[v * k:(v + d + h) * k, u * k:(u + 2 * d + 2 * w) * k]
            painted = region[..., 3] > 0
            region[..., 3][painted] = GLOW_ALPHA
        return Image.fromarray(a, "RGBA")


# ------------------------------------------------------------------ the weapons
GOLD, GOLD_D = "#d9a92b", "#96701a"
STEEL, STEEL_L, STEEL_D = "#c9d0da", "#f2f5f9", "#8a93a0"
DARK, DARK_L = "#22202a", "#3c3848"
LEATHER, LEATHER_D = "#5a3a1c", "#3a2412"


def razor_edge():
    w = Weapon("razor_edge", "blade")
    w.grip(-3, 6, LEATHER, wrap=LEATHER_D)
    w.pommel(-5, GOLD)
    w.guard(3, 6, GOLD)
    w.blade(4, 15, 2, STEEL, STEEL_L, fuller=STEEL_D)
    return w


def katana(key, blade, edge, handle, wrap, guard, glow_edge=False, length=16, runes=None):
    w = Weapon(key, "blade")
    w.grip(-4, 7, handle, wrap=wrap)
    w.box(-0.5, 3, -1.5, 1, 1, 3, guard)  # the tsuba
    w.blade(4, length, 2, blade, edge, glow_edge=glow_edge, curve=2.2, taper=3, runes=runes)
    w.pommel(-5, shade(handle, 0.7), size=1)
    return w


def god_slaying_emperor_blade():
    return katana("god_slaying_emperor_blade", "#a9d4f5", "#e4f6ff", "#1b2a4a", "#4a7fc0", GOLD, glow_edge=True, length=17)


def brain_katana():
    return katana("brain_katana", STEEL, STEEL_L, "#151515", "#7a1a1a", "#3a3a3a")


def takemikazuchi():
    return katana("takemikazuchi", "#d8d2f5", "#b7a8ff", "#2a1f4a", GOLD, GOLD, glow_edge=True, length=19,
                  runes=[(4, "#b7a8ff"), (8, "#b7a8ff"), (12, "#b7a8ff")])


def frost_pain():
    w = Weapon("frost_pain", "blade")
    w.grip(-3, 6, "#2a3f5f", wrap="#9fd0ff")
    w.pommel(-5, "#cfefff", gem="#7fdcff")
    w.guard(3, 7, "#bfe6ff", glow=True)
    w.blade(4, 16, 3, "#9ed8f7", "#e8f8ff", glow_edge=True, fuller="#6fb3e0")
    for y, z in ((7, 1.9), (11, -1.9), (15, 1.6)):  # frost crystals on the blade
        w.box(-0.5, y, z - 0.5, 1, 2, 1, "#e0f8ff", glow=True, inflate=-0.1)
    return w


def hellfire_blade():
    w = Weapon("hellfire_blade", "blade")
    w.grip(-3, 6, "#2a0f0a", wrap="#7a2010")
    w.pommel(-5, "#3a1208", gem="#ff6a1a")
    w.box(-1, 3, -3.5, 2, 1, 7, "#3a1208")  # the horned guard
    w.box(-0.5, 4, -3.5, 1, 2, 1, "#3a1208")
    w.box(-0.5, 4, 2.5, 1, 2, 1, "#3a1208")
    w.blade(4, 17, 3, "#2a0f0a", "#ff7a1a", glow_edge=True, runes=[(3, "#ffb84a"), (7, "#ffb84a"), (11, "#ffb84a")])
    return w


def kilineyram():
    w = Weapon("kilineyram", "blade")
    w.grip(-3, 6, "#1a0f24", wrap="#5a2f8a")
    w.pommel(-5, DARK, gem="#b44aff")
    w.box(-1, 3, -3, 2, 1, 6, DARK)
    w.box(-0.5, 2, -3, 1, 1, 1, DARK)
    w.box(-0.5, 2, 2, 1, 1, 1, DARK)
    w.blade(4, 18, 3, "#1a1424", "#7a3ac0", glow_edge=True, runes=[(2, "#c070ff"), (6, "#c070ff"), (10, "#c070ff"), (14, "#c070ff")])
    return w


def safarlisia():
    w = Weapon("safarlisia", "blade")
    w.grip(-3, 6, "#f4f0e6", wrap=GOLD)
    w.pommel(-5, GOLD, gem="#fff3a0")
    w.box(-1, 3, -4, 2, 1, 8, GOLD)  # a winged guard
    w.box(-0.5, 4, -4.5, 1, 1, 2, GOLD)
    w.box(-0.5, 4, 2.5, 1, 1, 2, GOLD)
    w.blade(4, 17, 3, "#f4f6fb", "#ffe27a", glow_edge=True, fuller="#d8c070")
    w.gem(0, 3.5, 0, "#fff3a0")
    return w


def stiletto():
    w = Weapon("stiletto", "dagger")
    w.grip(-2, 4, "#2a2018", wrap="#7a4a20")
    w.pommel(-3, STEEL_D, size=1)
    w.guard(2, 3, STEEL_D)
    w.blade(3, 10, 1, STEEL, STEEL_L, taper=5)
    w.box(-0.6, 4, -0.2, 1, 6, 1, "#ff8a2a", glow=True, inflate=-0.3)  # the stored fire, glowing through
    return w


def fang_dagger():
    w = Weapon("fang_dagger", "dagger")
    w.grip(-2, 4, "#3a2a1a", wrap="#1a120a")
    w.pommel(-3, "#e8e0c8", size=1)
    w.blade(2, 9, 2, "#ece4cc", "#fffaf0", taper=4, curve=1.6)
    w.box(-0.5, 2, -1.5, 1, 1, 3, "#7a1a1a")
    return w


def blade_bug():
    w = Weapon("blade_bug", "dagger")
    w.grip(-2, 4, "#2a3a1a", wrap="#6aa040")
    w.box(-1, 2, -1.5, 2, 2, 3, "#3a5a20")  # the insect's head
    w.gem(0, 3, -1.2, "#c8ff60")
    w.gem(0, 3, 1.2, "#c8ff60")
    rows = w.blade(4, 10, 2, "#6aa040", "#c8ff60", glow_edge=True, taper=4)
    for y, _h, _w, _dz in rows[::2]:  # segments of chitin
        w.box(-0.6, y, -1.1, 1, 1, 2, "#3a5a20", inflate=-0.05)
    return w


def death_knight_sword():
    w = Weapon("death_knight_sword", "greatsword")
    w.grip(-5, 8, "#1a1414", wrap="#4a1010")
    w.pommel(-7, DARK, gem="#ff2a2a")
    w.box(-1, 3, -4.5, 2, 1, 9, DARK)
    w.box(-0.5, 2, -4.5, 1, 2, 1, DARK)
    w.box(-0.5, 2, 3.5, 1, 2, 1, DARK)
    w.blade(4, 22, 4, "#2a2830", "#8a8494", wave=0.8, runes=[(3, "#ff3030"), (8, "#ff3030"), (13, "#ff3030")], taper=5)
    return w


def dark_warrior_greatsword():
    w = Weapon("dark_warrior_greatsword", "greatsword")
    w.grip(-5, 8, "#1a1a1a", wrap="#3a3a3a")
    w.pommel(-7, DARK, size=2)
    w.box(-1, 3, -4, 2, 2, 8, DARK_L)
    w.blade(5, 22, 5, "#1c1c22", "#5a5a68", fuller="#0e0e12", taper=4)
    w.box(-0.6, 8, -0.5, 1, 14, 1, "#6a4aa8", glow=True, inflate=-0.3)  # a faint line of dark magic down the fuller
    return w


def dragonbone_blade():
    w = Weapon("dragonbone_blade", "greatsword")
    w.grip(-5, 8, "#4a3a28", wrap="#2a2018")
    w.pommel(-7, "#e8dcc0", size=2)
    w.box(-1, 3, -3, 2, 2, 6, "#e8dcc0")
    w.blade(5, 21, 5, "#ece2c8", "#fff8e6", taper=5)
    for y in (8, 12, 16, 20):  # spines along the back
        w.box(-0.5, y, 2.5, 1, 2, 2, "#d8ccb0", rotation=(-30, 0, 0), pivot=(0, y, 2.5))
    return w


def spuit_lance():
    w = Weapon("spuit_lance", "polearm")
    w.shaft(-8, 10, "#e8e0e8", band="#8a1a2a")
    w.box(-1.5, 2, -1.5, 3, 2, 3, "#8a1a2a")  # the vamplate
    for i, size in enumerate((3, 3, 2, 2, 1)):  # the cone, narrowing to its point
        w.box(-size / 2, 4 + i * 4, -size / 2, size, 4, size, "#f0eaf0", inflate=0.3 if size >= 2 else 0)
        w.box(-size / 2 - 0.05, 5 + i * 4, -0.5, 1, 2, 1, "#ff2a4a", glow=True, inflate=-0.2)
    w.tip = (0.0, 24.0, 0.0)
    w.pommel(-9, "#8a1a2a", size=1)
    return w


def charons_guidance():
    w = Weapon("charons_guidance", "polearm")
    w.shaft(-10, 32, "#1a1622", band="#6a4a9a")
    w.box(-1, 19, -1.5, 2, 3, 3, DARK_L)  # the collar
    # the blade: out from the head and curving down to a point, its inner edge glowing
    w.box(-0.5, 19.5, -12, 1, 2, 10, "#2a2438")
    w.box(-0.5, 18, -14, 1, 3, 2, "#2a2438")
    w.box(-0.5, 16.5, -15, 1, 2, 1, "#2a2438")
    w.box(-0.6, 18.9, -12, 1, 1, 10, "#a070ff", glow=True, inflate=-0.15)
    w.box(-0.6, 16.8, -14.6, 1, 2, 1, "#a070ff", glow=True, inflate=-0.15)
    w.gem(0, 20.5, 0, "#c090ff")
    w.tip = (0.0, 16.5, -15.0)
    return w


def ginnungagap():
    w = Weapon("ginnungagap", "heavy")
    w.shaft(-8, 28, "#2a2440", band=GOLD)
    w.box(-1, 17, -1, 2, 4, 2, "#3a3258")
    # a great bardiche blade on one side, its edge alight with void magic
    w.box(-0.5, 12, -6, 1, 11, 5, "#4a3a78")
    w.box(-0.5, 14, -8, 1, 8, 2, "#4a3a78")
    w.box(-0.5, 22, -5, 1, 2, 3, "#4a3a78")
    w.box(-0.6, 14, -8.6, 1, 8, 1, "#b48aff", glow=True, inflate=-0.15)
    w.box(-0.6, 12, -6.6, 1, 2, 1, "#b48aff", glow=True, inflate=-0.15)
    for y in (15, 18):  # runes on the blade
        w.box(-0.65, y, -4, 1, 1, 1, "#e0c8ff", glow=True, inflate=0.05)
    w.gem(0, 19, 0.6, "#e0c8ff")
    w.tip = (0.0, 22.0, -8.0)
    return w


def runic_hammer():
    w = Weapon("runic_hammer", "heavy")
    w.shaft(-6, 20, "#5a3a20", band="#8a6a40")
    w.box(-2, 14, -4, 4, 5, 8, "#6a6e78")  # the head
    for z in (-3.6, 3.6):
        w.box(-1.5, 15, z - 0.5, 3, 3, 1, "#4ac8ff", glow=True, inflate=-0.1)
    w.box(-2.2, 16, -1, 1, 1, 2, "#4ac8ff", glow=True, inflate=-0.35)
    w.pommel(-7, "#6a6e78", size=2)
    w.tip = (0.0, 19.0, 0.0)
    return w


def fell_iron():
    w = Weapon("fell_iron", "heavy")
    w.shaft(-6, 20, "#3a2a1a", band="#6a6e78")
    w.box(-1.5, 13, -2, 3, 3, 4, "#4a4e58")
    w.box(-0.5, 13.5, -8, 1, 2, 6, "#8a8e98")  # the pick
    w.box(-0.5, 14, -9, 1, 1, 1, STEEL_L)
    w.box(-1, 13.5, 2, 2, 2, 3, "#4a4e58")  # the hammer back
    w.tip = (0.0, 14.5, -9.0)
    return w


def angel_mace():
    w = Weapon("angel_mace", "heavy")
    w.shaft(-6, 17, "#f4ead0", band=GOLD)
    w.box(-2, 11, -2, 4, 5, 4, GOLD)
    for angle in range(0, 360, 60):  # flanges
        a = math.radians(angle)
        w.box(math.cos(a) * 2.2 - 0.5, 11.5, math.sin(a) * 2.2 - 0.5, 1, 4, 1, "#ffe27a")
    # a halo above it
    for angle in range(0, 360, 45):
        a = math.radians(angle)
        w.box(math.cos(a) * 3 - 0.5, 18, math.sin(a) * 3 - 0.5, 1, 1, 1, "#fff6b0", glow=True, inflate=-0.1)
    w.gem(0, 16.5, 0, "#fff6b0")
    w.tip = (0.0, 18.0, 0.0)
    return w


def martial_lord_club():
    w = Weapon("martial_lord_club", "heavy")
    w.grip(-5, 8, "#4a3018", wrap="#2a1a0a")
    for i, s in enumerate((2, 3, 4, 4, 5, 5)):
        w.box(-s / 2, 3 + i * 3, -s / 2, s, 3, s, "#6a4a28")
    for y in (8, 12, 16):
        for z in (-3, 3):
            w.box(-0.5, y, z - 0.5, 1, 1, 1, "#9aa0aa")
    w.tip = (0.0, 21.0, 0.0)
    return w


def giants_maul():
    w = Weapon("giants_maul", "heavy")
    w.shaft(-7, 21, "#4a3a2a", band="#a8d8f8")
    w.box(-3, 13, -5, 6, 6, 10, "#8ac0e8")  # a head of ice and iron
    w.box(-3.2, 14, -5.2, 6, 4, 1, "#5a6a7a")
    w.box(-3.2, 14, 4.2, 6, 4, 1, "#5a6a7a")
    for z in (-3, 0, 3):
        w.box(-0.5, 19, z - 0.5, 1, 2, 1, "#e0f6ff", glow=True)
    w.tip = (0.0, 19.0, 0.0)
    return w


def staff(key, wood, band, top):
    w = Weapon(key, "staff")
    w.shaft(-12, 30, wood, band=band)
    top(w)
    return w


def staff_of_ainz():
    w = Weapon("staff_of_ainz_ooal_gown", "staff")
    w.shaft(-12, 28, GOLD, band=GOLD_D)
    # seven serpents rising from the head, each holding a gem in its jaws
    gems = ["#ff3a3a", "#ffa63a", "#fff04a", "#4aff6a", "#4ac8ff", "#6a6aff", "#c84aff"]
    for i, col in enumerate(gems):
        a = math.radians(i * 360 / 7)
        x, z = math.cos(a) * 3, math.sin(a) * 3
        w.box(x - 0.5, 16, z - 0.5, 1, 3, 1, GOLD, rotation=(math.degrees(math.sin(a)) * 0.4, 0, -math.degrees(math.cos(a)) * 0.4), pivot=(x, 16, z))
        w.gem(x * 1.1, 19.5, z * 1.1, col)
    w.box(-1.5, 15, -1.5, 3, 2, 3, GOLD)
    w.gem(0, 18, 0, "#ff2a2a", size=2)
    w.tip = (0.0, 20.0, 0.0)
    return w


def fluder_staff():
    def top(w):
        w.box(-1.5, 17, -1.5, 3, 1, 3, "#5a3a20")
        for x, z in ((-1.5, -1.5), (0.5, -1.5), (-1.5, 0.5), (0.5, 0.5)):
            w.box(x, 18, z, 1, 3, 1, "#5a3a20")
        w.gem(0, 20, 0, "#ff8a2a", size=2)
        w.tip = (0.0, 20.0, 0.0)
    return staff("fluder_staff", "#6a4a2a", "#9a7a4a", top)


def holy_staff():
    def top(w):
        w.box(-0.5, 18, -3, 1, 1, 6, GOLD)  # a cross of gold
        w.box(-0.5, 18, -0.5, 1, 5, 1, GOLD)
        w.gem(0, 18.5, 0, "#fff6b0", size=2)
        for z in (-3, 3):
            w.gem(0, 18.5, z, "#ffe27a")
        w.tip = (0.0, 22.0, 0.0)
    return staff("holy_staff", "#f4ead0", GOLD, top)


def shadow_of_yggdrasil():
    def top(w):
        for i, (x, z) in enumerate(((1, 0), (-1, 1), (0, -1), (1, 1))):  # twisting wood
            w.box(x - 0.5, 17 + i, z - 0.5, 1, 2, 1, "#4a3a1a")
        for x, z in ((-2, 0), (2, 1), (0, 2), (1, -2)):
            w.box(x - 0.5, 19, z - 0.5, 1, 1, 1, "#4aa040")  # leaves
        w.gem(0, 21, 0, "#7aff6a", size=2)
        w.tip = (0.0, 21.0, 0.0)
    return staff("shadow_of_yggdrasil", "#5a4428", "#3a8a30", top)


def elf_kings_staff():
    def top(w):
        w.box(-1.5, 17, -1.5, 3, 1, 3, "#3a6a2a")
        for x, z in ((-2, -1), (2, -1), (0, 2)):
            w.box(x - 0.5, 18, z - 0.5, 1, 3, 1, "#5a8a3a")
        w.box(-1, 19, -1, 2, 3, 2, "#9affd0", glow=True)  # a living crystal
        w.tip = (0.0, 22.0, 0.0)
    return staff("elf_kings_staff", "#6a5a3a", "#5a8a3a", top)


def aura_whip():
    w = Weapon("aura_whip", "whip")
    w.grip(-3, 7, "#3a2a1a", wrap="#7aa040")
    w.pommel(-4, GOLD, size=1)
    # the lash, curling down and back
    angle, x, y, z = 0.0, 0.0, 4.0, 0.0
    for i in range(10):
        w.box(-0.5, y, z - 0.5, 1, 2, 1, "#8ac040" if i % 2 == 0 else "#5a8a2a", inflate=-0.15)
        angle += 16
        y += 2 * math.cos(math.radians(angle))
        z -= 2 * math.sin(math.radians(angle)) * 0.6  # the lash falls away beneath the blade's line
    w.gem(0, y, z, "#d8ff7a")
    w.tip = (0.0, y, z)
    return w


def magic_rifle():
    w = Weapon("magic_rifle", "rifle")
    w.grip(-3, 5, "#3a2a1a")
    w.box(-1, 2, -1, 2, 3, 3, "#2a2a30")  # the receiver
    w.box(-0.5, 5, -0.5, 1, 14, 1, "#4a4a54", inflate=0.1)  # the barrel
    w.box(-0.6, 8, -0.6, 1, 8, 1, "#4aff9a", glow=True, inflate=-0.2)
    w.box(-0.5, 6, -2.5, 1, 6, 1, "#2a2a30")  # the scope
    w.gem(0, 7, -2.6, "#7aff9a")
    w.box(-1, -1, 1, 2, 3, 5, "#5a3a20")  # the stock
    w.tip = (0.0, 19.0, 0.0)
    return w


def gauntlets(key, color, trim, spikes=None, size=0.6, glow=None):
    w = Weapon(key, "fist")
    # wrapped round the end of the arm: the arm runs from x -2..2, z -2..2, y -1.5..10.5 in this frame
    w.box(-2, -2.5, -2, 4, 6, 4, color, inflate=size)
    w.box(-2, 3.5, -2, 4, 1, 4, trim, inflate=size + 0.1)
    w.box(-2, -2.6, -2.6, 4, 1, 1, trim, inflate=size)  # knuckles
    if spikes:
        for x in (-1.5, 0, 1.5):
            w.box(x - 0.5, -2.8, -3.6 - size, 1, 1, 2, spikes)
    if glow:
        w.box(-2.7, 0, -1, 1, 2, 2, glow, glow=True, inflate=-0.1)
    w.tip = (0.0, -3.0, -3.0)
    return w


def iron_gauntlets():
    return gauntlets("iron_gauntlets", "#7a808a", "#a0a6b0", spikes=None)


def six_arms_knuckles():
    return gauntlets("six_arms_knuckles", "#3a2a1a", GOLD, spikes=GOLD, size=0.4)


def golem_fist():
    return gauntlets("golem_fist", "#8a8478", "#6a645a", spikes="#a8a094", size=1.4, glow="#ffb84a")


# ------------------------------------------------------------------ v8.6
def cavalier_lance():
    """The Death Cavalier's lance: a long black shaft, a vamplate, a barbed head lit with spectral green."""
    w = Weapon("cavalier_lance", "polearm")
    w.shaft(-10, 22, "#1d1b24", band="#59e0a0")
    w.box(-2, 10, -2, 4, 2, 4, "#2a2833", inflate=0.2)  # the vamplate
    w.box(-1.5, 12, -1.5, 3, 1, 3, "#3a3644")
    w.box(-0.5, 12.5, -2.5, 1, 4, 1, "#3a3644", rotation=(-25, 0, 0), pivot=(0, 12.5, -2))  # barbs
    w.box(-0.5, 12.5, 1.5, 1, 4, 1, "#3a3644", rotation=(25, 0, 0), pivot=(0, 12.5, 2))
    for i, size in enumerate((2, 2, 1)):
        w.box(-size / 2, 13 + i * 3, -size / 2, size, 3, size, "#5e5868", inflate=0.15)
    w.box(-0.55, 13, -0.5, 1, 8, 1, "#59e0a0", glow=True, inflate=-0.2)
    w.tip = (0.0, 22.0, 0.0)
    w.pommel(-11, "#3a3644", size=1)
    return w


def ghoulfang_sickle():
    """A sickle of bone set with ghoul fangs, its inner edge sickly green."""
    w = Weapon("ghoulfang_sickle", "blade")
    w.grip(-4, 7, "#3a2a1a", wrap="#1a1410")
    w.pommel(-5, "#d8d0b4", size=1)
    w.box(-0.5, 3, -1, 1, 6, 2, "#d8d0b4")  # the spine rising from the grip
    w.box(-0.5, 8, -5, 1, 2, 5, "#d8d0b4")   # curving forward
    w.box(-0.5, 6, -7, 1, 3, 2, "#d8d0b4")
    w.box(-0.5, 4.5, -8, 1, 2, 1, "#e9e2cc")  # the point
    for z in (-2, -4):
        w.box(-0.5, 7, z, 1, 1, 1, "#f4f1e6", inflate=-0.1)  # fangs along the inner edge
    w.box(-0.6, 7.6, -6.5, 1, 1, 5, "#9cff6a", glow=True, inflate=-0.2)
    w.tip = (0.0, 4.5, -8.0)
    return w


def heartwood_staff():
    def top(w):
        w.box(-2, 15, -2, 4, 2, 4, "#4a3320")
        for x, z in ((-2, -2), (1, -2), (-2, 1), (1, 1)):
            w.box(x, 17, z, 1, 4, 1, "#5a3e24", rotation=(0, 0, 12 if x < 0 else -12), pivot=(x + 0.5, 17, z + 0.5))
        w.box(-1, 17.5, -1, 2, 3, 2, "#9cff6a", glow=True)  # the living heart
        for x, z in ((-2.5, 0), (2, -0.5)):
            w.box(x, 20, z, 1, 1, 1, "#4f8a3a")  # leaves
        w.tip = (0.0, 21.0, 0.0)
    return staff("heartwood_staff", "#5a3e24", "#4f8a3a", top)


ALL = {
    "staff_of_ainz_ooal_gown": staff_of_ainz, "spuit_lance": spuit_lance, "ginnungagap": ginnungagap,
    "god_slaying_emperor_blade": god_slaying_emperor_blade, "death_knight_sword": death_knight_sword,
    "dark_warrior_greatsword": dark_warrior_greatsword, "razor_edge": razor_edge, "stiletto": stiletto,
    "shadow_of_yggdrasil": shadow_of_yggdrasil, "aura_whip": aura_whip, "frost_pain": frost_pain,
    "brain_katana": brain_katana, "iron_gauntlets": iron_gauntlets, "magic_rifle": magic_rifle,
    "runic_hammer": runic_hammer, "fang_dagger": fang_dagger, "charons_guidance": charons_guidance,
    "angel_mace": angel_mace, "hellfire_blade": hellfire_blade, "kilineyram": kilineyram, "safarlisia": safarlisia,
    "takemikazuchi": takemikazuchi, "fell_iron": fell_iron, "fluder_staff": fluder_staff, "golem_fist": golem_fist,
    "holy_staff": holy_staff, "blade_bug": blade_bug, "martial_lord_club": martial_lord_club,
    "elf_kings_staff": elf_kings_staff, "giants_maul": giants_maul, "dragonbone_blade": dragonbone_blade,
    "six_arms_knuckles": six_arms_knuckles,
    "cavalier_lance": cavalier_lance, "ghoulfang_sickle": ghoulfang_sickle, "heartwood_staff": heartwood_staff,
}


def build_all():
    return {key: fn().finish() for key, fn in ALL.items()}


# ------------------------------------------------------------------ pack files
NS = "overlord"
AURA_COLOURS = {  # element -> (r, g, b) of the motes that drift off a held weapon
    "fire": (1.0, 0.45, 0.12), "ice": (0.55, 0.85, 1.0), "lightning": (0.72, 0.68, 1.0), "holy": (1.0, 0.9, 0.5),
    "dark": (0.7, 0.3, 1.0), "arcane": (0.55, 0.6, 1.0), "acid": (0.5, 1.0, 0.4),
}


def animations_json():
    """How each kind is held, and the aura: a puff of motes from the weapon's tip, four times a second."""
    anims = {}
    for kind, (third, first) in HOLDS.items():
        for view, (rot, pos) in (("third_person", third), ("first_person", first)):
            anims[f"animation.{NS}.weapon.{kind}.{view}"] = {
                "loop": True, "bones": {"weapon": {"rotation": list(rot), "position": list(pos)}}}
    anims[f"animation.{NS}.weapon.aura"] = {
        "loop": True, "animation_length": 0.25,
        "particle_effects": {"0.0": {"effect": "aura", "locator": "tip"}}}
    return {"format_version": "1.10.0", "animations": anims}


def attachable(key, weapon, element):
    """The attachable that draws the weapon in a player's hand in place of the flat item."""
    item = f"{NS}:{key}"
    animations = {
        "hold_first_person": f"animation.{NS}.weapon.{weapon.kind}.first_person",
        "hold_third_person": f"animation.{NS}.weapon.{weapon.kind}.third_person",
    }
    animate = [{"hold_first_person": "c.is_first_person"}, {"hold_third_person": "!c.is_first_person"}]
    description = {
        "identifier": f"{item}.held",
        "item": {item: "query.owner_identifier == 'minecraft:player'"},
        "materials": {"default": "entity_emissive_alpha", "enchanted": "entity_alphatest_glint"},
        "textures": {"default": f"textures/models/weapons/{key}", "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": f"geometry.{NS}.weapon_{key}"},
        "animations": animations,
        "scripts": {"animate": animate},
        "render_controllers": ["controller.render.item_default"],
    }
    if element in AURA_COLOURS:
        animations["aura"] = f"animation.{NS}.weapon.aura"
        animate.append({"aura": "!c.is_first_person"})
        description["particle_effects"] = {"aura": f"{NS}:weapon_aura_{element}"}
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": description}}


def particle_files():
    """Motes of each element's colour that drift up and fade: the aura round a held weapon."""
    out = {}
    for element, (r, g, b) in AURA_COLOURS.items():
        name = f"weapon_aura_{element}"
        life = "(variable.particle_age / variable.particle_lifetime)"
        out[f"particles/{name}.json"] = {
            "format_version": "1.10.0",
            "particle_effect": {
                "description": {"identifier": f"{NS}:{name}",
                                "basic_render_parameters": {"material": "particles_add", "texture": f"textures/particle/{NS}/glow"}},
                "components": {
                    "minecraft:emitter_lifetime_once": {"active_time": 0.05},
                    "minecraft:emitter_rate_instant": {"num_particles": 2},
                    "minecraft:emitter_shape_sphere": {"radius": 0.12, "direction": "outwards"},
                    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
                    "minecraft:particle_initial_speed": "math.random(0.05, 0.25)",
                    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.5, 0], "linear_drag_coefficient": 1.2},
                    "minecraft:particle_appearance_billboard": {
                        "size": [f"0.06 * (1.0 - 0.6 * {life})", f"0.06 * (1.0 - 0.6 * {life})"],
                        "facing_camera_mode": "lookat_xyz",
                        "uv": {"texture_width": 32, "texture_height": 32, "uv": [0, 0], "uv_size": [32, 32]}},
                    "minecraft:particle_appearance_tinting": {"color": [r, g, b, f"(1.0 - {life})"]},
                },
            },
        }
    return out
