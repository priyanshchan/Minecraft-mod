"""The add-on's armour sets as 3D models worn by players (attachables), one model per piece.

Each piece is built on a copy of the player's skeleton, as the vanilla armour models are: its parts hang
from bones named after the player's (head, body, arms, legs), so they follow every move the wearer makes.
The parts are placed in the player's model space, where the player faces -Z: a visor is painted on the
"front" faces and a cape hangs behind, at +Z.

Parts flagged as glowing (eye slits, gems, runes, cracks of fire) are written with a low alpha: the
attachables use the "entity_emissive_alpha" material, which draws those texels lit in the dark. In first
person everything but the arms is hidden, so a helmet's horns never cross the view.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from modelkit import Model, shade, mix, TRANSPARENT
from weapons3d import GLOW_ALPHA, SKELETON

NS = "overlord"
PIECES = ("helmet", "chestplate", "leggings", "boots")
PIVOTS = {name: pivot for name, _parent, pivot in SKELETON}
# what is hidden on the wearer while the piece is worn (as the vanilla armour does)
SETUP = {
    "helmet": "variable.helmet_layer_visible = 0.0;",
    "chestplate": "variable.chest_layer_visible = 0.0;",
    "leggings": "variable.leg_layer_visible = 0.0;",
    "boots": "variable.boot_layer_visible = 0.0;",
}


def rot_matrix(rx, ry, rz):
    """Bedrock cube rotation, as modelkit draws it: X and Z left-handed, Y right-handed."""
    ax, ay, az = math.radians(-rx), math.radians(ry), math.radians(-rz)
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return mz @ my @ mx


class Piece:
    """One armour piece in the making: boxes hung from the wearer's bones."""

    def __init__(self, set_key, piece):
        self.set_key, self.piece = set_key, piece
        self.model = Model(f"armor_{set_key}_{piece}", bounds=(3.0, 3.0, 1.0))
        for name, parent, pivot in SKELETON:
            self.model.bone(name, pivot, parent)
        self.parts = {}
        self.glowing = []

    def part(self, name):
        if name not in self.parts:
            self.parts[name] = self.model.bone(f"armor_{name}", PIVOTS[name], name)
        return self.parts[name]

    def box(self, part, origin, size, color, inflate=0.0, glow=False, noise=3, rotation=None, pivot=None):
        bone = self.part(part)
        c = bone.cube(origin, size, inflate, rotation, pivot)
        c.fill(color, noise=0 if glow else noise, seed=len(bone.cubes) + 7 * len(self.parts))
        if glow:
            self.glowing.append(c)
        return c

    def pair(self, part_r, part_l, origin, size, color, **kw):
        """The same box on the right side and, mirrored in X, on the left."""
        a = self.box(part_r, origin, size, color, **kw)
        mirrored = (-(origin[0] + size[0]), origin[1], origin[2])
        rot = kw.pop("rotation", None)
        piv = kw.pop("pivot", None)
        if rot:
            rot = (rot[0], -rot[1], -rot[2])
        if piv:
            piv = (-piv[0], piv[1], piv[2])
        b = self.box(part_l, mirrored, size, color, rotation=rot, pivot=piv, **kw)
        return a, b

    def curve(self, part, start, thick, segments, color, glow=False, mirror=False):
        """A horn or spike: boxes laid end to end, each turned from facing forward (-Z) by a pitch (negative
        is up) and a yaw (positive turns to the wearer's right, -X). The last piece is thinner."""
        p = np.array(start, float)
        if mirror:
            p[0] = -p[0]
        for i, (length, pitch, yaw) in enumerate(segments):
            if i == len(segments) - 1 and len(segments) > 2:
                thick = max(1, thick - 1)
            if mirror:
                yaw = -yaw
            origin = (p[0] - thick / 2, p[1] - thick / 2, p[2] - length)
            self.box(part, origin, (thick, thick, length), color, glow=glow, noise=2, rotation=(pitch, yaw, 0), pivot=tuple(p))
            p = p + rot_matrix(pitch, yaw, 0) @ np.array([0, 0, -length], float)

    def texture(self):
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


# ------------------------------------------------------------------ the sets
GOLD, GOLD_D = "#d9a92b", "#96701a"

# plate, light, dark, trim, glow, cape (or None), and the shapes of the helm, shoulders, legs and feet
LOOKS = {
    "dark_warrior": dict(plate="#1d1b24", light="#3a3644", dark="#0c0b10", trim=GOLD, glow="#ff3040", cape="#8c1420",
                         helm="horned", shoulder="spiked", legs="plate", feet="sabaton"),
    "world_champion": dict(plate="#d6dce6", light="#f6f8fb", dark="#8f98aa", trim="#3f7fe0", glow="#9fd8ff", cape="#2a5aa8",
                           helm="plume", shoulder="grand", legs="tabard", feet="sabaton"),
    "regalia": dict(plate="#2b1a3d", light="#4a2f66", dark="#1c1029", trim=GOLD, glow="#ff2a3a", cape="#1c1029",
                    helm="crown", shoulder="robe", legs="robe", feet="slipper"),
    "dragonscale": dict(plate="#a8d4ec", light="#eaf7ff", dark="#5f8fb8", trim="#f2c21b", glow="#c6f2ff", cape=None,
                        helm="dragon", shoulder="scale", legs="plate", feet="claw"),
    "infernal": dict(plate="#5a1410", light="#8f1a14", dark="#2a0a08", trim="#c2452a", glow="#ff8a1a", cape="#3a0c0a",
                     helm="demon", shoulder="spiked", legs="plate", feet="claw"),
    "vestment": dict(plate="#ece8de", light="#ffffff", dark="#b9b4a4", trim=GOLD, glow="#fff0a0", cape="#3f7fe0",
                     helm="hood", shoulder="robe", legs="robe", feet="slipper"),
    "ranger": dict(plate="#4a6a32", light="#6a8a48", dark="#2a3f1c", trim="#7a5530", glow="#b6ff6a", cape=None,
                   helm="cowl", shoulder="leather", legs="leather", feet="boot"),
    "crimson": dict(plate="#a3121f", light="#d43a44", dark="#6a0a13", trim="#f7f4f1", glow="#ff5a6a", cape=None,
                    helm="winged", shoulder="round", legs="plate", feet="sabaton"),
    "platinum": dict(plate="#d9dde6", light="#ffffff", dark="#9aa2b0", trim="#e8c96a", glow="#59d0ff", cape=None,
                     helm="great", shoulder="grand", legs="plate", feet="sabaton"),
    "bonedragon": dict(plate="#e3dcc2", light="#f6f2e4", dark="#a59c7e", trim="#6e664c", glow="#b6ff4a", cape=None,
                       helm="skull", shoulder="bone", legs="bone", feet="claw"),
    "beasthide": dict(plate="#a8743a", light="#d09a5a", dark="#6a4520", trim="#f1e0b8", glow="#ffd27a", cape="#7a5530",
                      helm="beast", shoulder="fur", legs="leather", feet="fur"),
}


# ----------------------------------------------------------------- helmets
def helmet(L):
    p = Piece(L["key"], "helmet")
    style = L["helm"]
    plate, light, dark, trim, glow = L["plate"], L["light"], L["dark"], L["trim"], L["glow"]
    if style in ("crown",):
        # a circlet of gold set with gems, five points rising from it
        band = p.box("head", (-4, 30, -4), (8, 2, 8), trim, inflate=0.6)
        for f in band.sides:
            f.hline(0, shade(trim, 1.25))
        for x in (-4.5, -2.0, 0.5, 3.0):
            p.box("head", (x, 32.5, -4.75), (1, 2 + (1 if abs(x + 0.75) < 2 else 0), 1), trim, inflate=0.1)
        p.box("head", (-0.5, 30.4, -4.9), (1, 1, 1), glow, glow=True, inflate=0.05)
        for x in (-3.4, 2.4):
            p.box("head", (x, 30.4, -4.85), (1, 1, 1), "#9b3cff", glow=True, inflate=-0.1)
        return p
    if style in ("hood", "cowl", "beast"):
        shell = p.box("head", (-4, 24, -4), (8, 8, 8), plate if style != "beast" else L["dark"], inflate=1.0)
        # the face is open
        shell.front.fill(TRANSPARENT, 1, 2, 7, 8)
        shell.front.border(trim)
        shell.front.fill(TRANSPARENT, 1, 2, 7, 8)
        for f in shell.sides:
            f.hline(7, trim)
        if style == "hood":
            p.box("head", (-0.5, 31, -5.6), (1, 2, 1), glow, glow=True, inflate=0.05)  # the holy sign on the brow
            p.box("head", (-1.5, 31.5, -5.6), (3, 1, 1), glow, glow=True, inflate=0.05)
            p.box("head", (-4, 19, 3), (8, 6, 2), plate, inflate=0.7)  # the hood falls to the shoulders
        elif style == "cowl":
            p.box("head", (-4, 24, -5.2), (8, 2, 1), L["dark"], inflate=0.6)  # a scarf over the mouth
            p.box("head", (-1, 32.6, -1), (2, 2, 4), plate, inflate=0.2, rotation=(-25, 0, 0), pivot=(0, 33, 1))  # the peak
        else:
            # a beast's head worn as a hood: ears, a muzzle above the brow, fangs
            p.box("head", (-3, 32.5, -5.8), (6, 2, 3), L["plate"], inflate=0.3)
            p.box("head", (-1, 31.4, -6.9), (2, 1, 2), "#2a1a12", inflate=0.1)
            for x in (-3, 2):
                p.box("head", (x, 30.2, -6.0), (1, 2, 1), trim, inflate=-0.1)  # fangs
            p.pair("head", "head", (-5, 33, -1), (2, 3, 2), L["plate"], inflate=0.1, rotation=(0, 0, 15), pivot=(-4, 33, 0))
            p.box("head", (-4, 18, 2.5), (8, 7, 2), L["plate"], inflate=0.5)  # the pelt down the back
        return p

    shell = p.box("head", (-4, 24, -4), (8, 8, 8), plate, inflate=1.0)
    for f in shell.sides:
        f.hline(7, trim)
        f.hline(0, light)
    shell.top.fill(light)
    shell.top.vline(3, trim)
    shell.top.vline(4, trim)
    shell.front.vline(3, dark, 4, 8)
    shell.front.vline(4, dark, 4, 8)
    # the eye slit, glowing
    if style == "great":
        p.box("head", (-3, 28, -5.6), (6, 1, 1), glow, glow=True, inflate=-0.3)
        p.box("head", (-0.5, 25, -5.45), (1, 6, 1), trim, inflate=-0.2)  # the gold cross
        p.box("head", (-2.5, 29.5, -5.45), (5, 1, 1), trim, inflate=-0.2)
        p.box("head", (-0.5, 33, -3), (1, 2, 7), trim, inflate=0.2)  # crest
    elif style == "skull":
        # a dragon's skull: a long snout over the face, teeth, sockets that glow, horns swept back
        p.box("head", (-3, 25, -9), (6, 4, 4), plate, inflate=0.4)
        p.box("head", (-2.5, 24, -8.6), (5, 1, 3), L["dark"], inflate=0.2)
        for x in (-2.6, -1.0, 0.6, 2.0):
            p.box("head", (x, 24.2, -9.6), (1, 1, 1), L["light"], inflate=-0.2)
        p.box("head", (-3.5, 29, -5.6), (2, 1, 1), glow, glow=True, inflate=0.1)
        p.box("head", (1.5, 29, -5.6), (2, 1, 1), glow, glow=True, inflate=0.1)
        horn = [(4, -30, 160), (3, -15, 170)]
        p.curve("head", (-3.5, 31.5, 2), 2, horn, L["light"])
        p.curve("head", (-3.5, 31.5, 2), 2, horn, L["light"], mirror=True)
    else:
        p.box("head", (-3, 28, -5.6), (6, 1, 1), glow, glow=True, inflate=-0.25)
    if style == "horned":
        # Momon's great horns: out from the temples, sweeping forward and up
        horn = [(3, -5, 85), (3, -25, 55), (3, -50, 25), (3, -75, 10)]
        p.curve("head", (-4.8, 29.5, -1), 2, horn, "#5e5868")
        p.curve("head", (-4.8, 29.5, -1), 2, horn, "#5e5868", mirror=True)
        p.box("head", (-0.5, 33, -4), (1, 1, 7), trim, inflate=0.2)
    elif style == "plume":
        p.box("head", (-0.5, 33, -2), (1, 3, 6), L["trim"], inflate=0.3, rotation=(-15, 0, 0), pivot=(0, 33, 2))
        p.box("head", (-0.5, 33.5, 3), (1, 2, 3), "#ffffff", inflate=0.3, rotation=(-35, 0, 0), pivot=(0, 33, 3))
        p.box("head", (-4, 30.5, -5.5), (8, 1, 1), GOLD, inflate=-0.1)  # the gold brow band
        p.pair("head", "head", (-6, 28, -1), (1, 3, 3), GOLD, inflate=0.1, rotation=(0, 0, -20), pivot=(-5, 28, 0))
    elif style == "dragon":
        for z in (-3, -1, 1, 3):
            p.box("head", (-0.5, 33, z), (1, 1 + (z < 2), 1), L["dark"], inflate=0.2)  # a ridge of scales
        horn = [(3, -20, 150), (3, -35, 165), (2, -45, 175)]
        p.curve("head", (-4.5, 31, 1), 2, horn, L["trim"])
        p.curve("head", (-4.5, 31, 1), 2, horn, L["trim"], mirror=True)
    elif style == "demon":
        for x, y0 in ((-3, 24), (2, 26), (-1, 25)):
            p.box("head", (x, y0, -5.55), (1, 3, 1), glow, glow=True, inflate=-0.3)  # cracks of fire
        horn = [(2, -10, 90), (3, -50, 130), (3, -85, 170), (2, -120, 175)]
        p.curve("head", (-5, 31, 0), 2, horn, "#1a0806")
        p.curve("head", (-5, 31, 0), 2, horn, "#1a0806", mirror=True)
    elif style == "winged":
        p.box("head", (-0.5, 25, -5.45), (1, 3, 1), glow, glow=True, inflate=-0.3)  # a T of light
        for i, (y, length) in enumerate(((29, 5), (30.5, 6), (32, 4))):
            p.pair("head", "head", (-5.5 - length + 1, y, 0), (length, 1, 2), L["trim"], inflate=0.05,
                   rotation=(0, -20, -25 - i * 8), pivot=(-5, y, 1))
    return p


# ------------------------------------------------------------------ chests
def chestplate(L):
    p = Piece(L["key"], "chestplate")
    plate, light, dark, trim, glow = L["plate"], L["light"], L["dark"], L["trim"], L["glow"]
    soft = L["shoulder"] in ("robe", "leather", "fur")
    body = p.box("body", (-4, 12, -2), (8, 12, 4), plate, inflate=1.01)
    body.front.border(trim)
    body.back.border(trim)
    if not soft:
        body.front.vline(3, light, 1, 11)
        body.front.vline(4, dark, 1, 11)
        body.front.hline(5, dark)
    else:
        body.front.vline(3, trim, 0, 12)
        body.front.vline(4, trim, 0, 12)
    body.front.hline(10, trim)
    # sleeves
    for part, x in (("rightArm", -8), ("leftArm", 4)):
        arm = p.box(part, (x, 12, -2), (4, 12, 4), dark if not soft else plate, inflate=0.85)
        for f in arm.sides:
            f.hline(11, trim)
            f.hline(10, trim)
        if not soft:
            # the gauntlet's cuff
            p.box(part, (x, 12, -2), (4, 4, 4), plate, inflate=1.05)
    # the gem at the heart
    if L["key"] in ("regalia", "platinum", "world_champion", "dragonscale", "bonedragon", "infernal"):
        p.box("body", (-1, 19, -3.9), (2, 2, 1), glow, glow=True, inflate=0.1)
        p.box("body", (-1.5, 18.5, -3.6), (3, 3, 1), trim, inflate=0.0)
    shoulder = L["shoulder"]
    if shoulder in ("spiked", "round", "grand", "scale"):
        big = shoulder == "grand"
        w = 6 if big else 5
        a, b = p.pair("rightArm", "leftArm", (-9.5 if big else -9, 20, -3 if big else -2.5), (w, 4, 6 if big else 5), plate, inflate=0.2)
        for c in (a, b):
            for f in c.sides:
                f.hline(3, trim)
                f.hline(0, light)
            c.top.border(trim)
        p.pair("rightArm", "leftArm", (-9 if big else -8.5, 18.5, -2.5 if big else -2), (w - 1, 2, 5 if big else 4), dark, inflate=0.2)
        if shoulder == "spiked":
            for z in (-1.5, 1.0):
                spike = [(2, -75, 20), (2, -60, 30)]
                p.curve("rightArm", (-7.5, 24, z), 1, spike, light)
                p.curve("leftArm", (-7.5, 24, z), 1, spike, light, mirror=True)
        if shoulder == "scale":
            for i, z in enumerate((-2, 0, 2)):
                p.pair("rightArm", "leftArm", (-9.5, 22.5 - i * 0.4, z - 0.5), (2, 1, 2), light, inflate=0.1)
        if big:
            p.pair("rightArm", "leftArm", (-10, 23.5, -2.5), (3, 1, 5), trim, inflate=0.1)
    elif shoulder == "robe":
        p.pair("rightArm", "leftArm", (-8.5, 21, -2.5), (5, 3, 5), trim, inflate=0.3)
        if L["key"] == "regalia":
            # the high collar of the Overlord's robe, with gold spikes rising behind the head
            p.box("body", (-5, 23, 1.5), (10, 5, 1), dark, inflate=0.2, rotation=(-15, 0, 0), pivot=(0, 23, 2))
            for x, h in ((-4.5, 4), (-2.5, 5), (1.5, 5), (3.5, 4)):
                p.box("body", (x, 27, 1.8), (1, h, 1), GOLD, inflate=0.05, rotation=(-15, 0, 0), pivot=(0, 23, 2))
            p.box("body", (-1, 14, -3.9), (2, 2, 1), "#ff2a3a", glow=True, inflate=0.1)
    elif shoulder == "leather":
        p.pair("rightArm", "leftArm", (-8.5, 21, -2.5), (5, 2, 5), plate, inflate=0.3)
        p.box("body", (-4.5, 12, 2.6), (3, 11, 2), L["trim"], inflate=0.0, rotation=(0, 0, -25), pivot=(-3, 18, 3))  # quiver
        for x in (-4.5, -3.5, -2.5):
            p.box("body", (x, 22, 2.8), (1, 3, 1), "#e8e0c8", inflate=-0.2, rotation=(0, 0, -25), pivot=(-3, 18, 3))
        p.box("body", (-4.5, 15, -3.2), (9, 1, 6), L["trim"], inflate=0.0, rotation=(0, 0, 32), pivot=(0, 18, 0))  # strap
    elif shoulder == "fur":
        for part, x in (("rightArm", -9), ("leftArm", 4)):
            fur = p.box(part, (x, 20.5, -3), (5, 3, 6), L["trim"], inflate=0.3)
            fur.top.noise(18, 3)
        p.box("body", (-5, 22, -3), (10, 3, 6), L["trim"], inflate=0.3)  # the fur collar
        for x in (-3.5, -1.5, 0.5, 2.5):
            p.box("body", (x, 20.8, -3.9), (1, 1, 1), "#f6f2e4", inflate=-0.1)  # a necklace of teeth
    elif shoulder == "bone":
        for i in range(3):
            p.pair("rightArm", "leftArm", (-9 + i * 0.5, 22.5 - i * 1.8, -3), (5 - i, 1, 6), light, inflate=0.1)
        for y in (14, 16, 18, 20):
            p.box("body", (-4.5, y, -3.6), (9, 1, 1), light, inflate=0.05)  # ribs
        for z in (-0.5,):
            for y in range(13, 25, 2):
                p.box("body", (-0.5, y, 3.5), (1, 1, 1), light, inflate=0.2)  # the spine
    cape = L["cape"]
    if cape:
        long = L["key"] in ("regalia", "vestment", "dark_warrior")
        c = p.box("body", (-4.5, 24 - (22 if long else 17), 3.2), (9, 22 if long else 17, 1), cape, inflate=-0.2,
                  rotation=(10, 0, 0), pivot=(0, 24, 3.2))
        c.back.border(L["trim"] if L["key"] != "dark_warrior" else shade(cape, 0.7))
        if L["key"] == "regalia":
            c.back.hline(c.back.h - 2, GOLD)
        if L["key"] in ("infernal", "beasthide"):
            c.back.ragged_bottom(4, 5)
            c.front.ragged_bottom(4, 5)
            c.right.ragged_bottom(4, 5)
            c.left.ragged_bottom(4, 5)
    return p


# ------------------------------------------------------------------- legs
def leggings(L):
    p = Piece(L["key"], "leggings")
    plate, light, dark, trim, glow = L["plate"], L["light"], L["dark"], L["trim"], L["glow"]
    style = L["legs"]
    belt = p.box("body", (-4, 11, -2), (8, 2, 4), trim if style != "bone" else dark, inflate=1.1)
    for f in belt.sides:
        f.hline(0, shade(trim, 1.2))
    p.box("body", (-1, 11, -3.4), (2, 2, 1), glow if style != "leather" else trim, glow=style != "leather", inflate=0.1)  # buckle
    for part, x in (("rightLeg", -3.9), ("leftLeg", -0.1)):
        robe = style == "robe"
        leg = p.box(part, (x, 0 if robe else 2, -2), (4, 12 if robe else 10, 4), plate if not robe else L["plate"], inflate=0.95 if robe else 0.55)
        for f in leg.sides:
            f.hline(f.h - 1 if robe else 0, trim)
        if robe:
            for f in leg.sides:
                f.hline(f.h - 2, trim)
            continue
        if style == "plate" or style == "tabard":
            # the knee and the plates of the thigh
            p.box(part, (x + 0.5, 5, -3.2), (3, 2, 1), light, inflate=0.2)
            p.box(part, (x, 8, -2), (4, 4, 4), plate, inflate=0.75)
        elif style == "bone":
            for y in (4, 7, 10):
                p.box(part, (x, y, -2.9), (4, 1, 1), light, inflate=0.1)
        else:
            p.box(part, (x + 0.5, 5, -3.0), (3, 2, 1), dark, inflate=0.1)
    if style == "tabard":
        t = p.box("body", (-2.5, 1, -3.6), (5, 10, 1), L["trim"], inflate=-0.1, rotation=(-6, 0, 0), pivot=(0, 11, -3))
        t.front.border(GOLD)
        t.front.vline(2, GOLD, 2, 7)
        t.front.hline(4, GOLD, 1, 4)
    if style == "robe":
        # the long front panel of the robe
        t = p.box("body", (-2, 0, -3.6), (4, 11, 1), L["light"] if L["key"] == "vestment" else L["dark"], inflate=-0.1)
        t.front.border(trim)
    return p


# ------------------------------------------------------------------- feet
def boots(L):
    p = Piece(L["key"], "boots")
    plate, light, dark, trim, glow = L["plate"], L["light"], L["dark"], L["trim"], L["glow"]
    style = L["feet"]
    for part, x in (("rightLeg", -3.9), ("leftLeg", -0.1)):
        tall = 6 if style in ("sabaton", "claw", "boot") else 4
        b = p.box(part, (x, 0, -2), (4, tall, 4), plate if style != "slipper" else dark, inflate=1.0)
        for f in b.sides:
            f.hline(0, trim)
            f.hline(f.h - 1, shade(plate, 0.75))
        if style == "sabaton":
            p.box(part, (x + 0.5, 0, -4.2), (3, 2, 2), light, inflate=0.2)  # the toe cap
            p.box(part, (x + 1, 3, -3.4), (2, 2, 1), trim, inflate=0.1)
        elif style == "claw":
            for dx in (0.2, 1.5, 2.8):
                p.box(part, (x + dx, 0, -4.6), (1, 1, 2), light if L["key"] != "infernal" else glow,
                      glow=L["key"] == "infernal", inflate=0.0)
        elif style == "fur":
            cuff = p.box(part, (x, 3.5, -2), (4, 2, 4), trim, inflate=1.3)
            cuff.top.noise(16, 4)
        elif style == "boot":
            p.box(part, (x, 4.5, -2), (4, 2, 4), trim, inflate=1.15)
        else:
            p.box(part, (x + 1, 1, -3.4), (2, 1, 1), trim, inflate=0.1)
    return p


def build_set(key):
    look = dict(LOOKS[key], key=key)
    return {piece: fn(look) for piece, fn in (("helmet", helmet), ("chestplate", chestplate), ("leggings", leggings), ("boots", boots))}


def build_all():
    """{set: {piece: Piece}} with every model packed."""
    out = {}
    for key in LOOKS:
        pieces = build_set(key)
        for piece in pieces.values():
            piece.model.pack()
        out[key] = pieces
    return out


# ------------------------------------------------------------------ pack files
def animations_json():
    """In first person only the arms are drawn: a helmet's horns or a cape must never cross the view."""
    hide = {f"armor_{part}": {"scale": 0} for part in ("head", "body", "rightLeg", "leftLeg")}
    return {"format_version": "1.10.0", "animations": {
        f"animation.{NS}.armor.first_person": {"loop": True, "bones": hide}}}


def attachable(key, piece):
    """The attachable that draws the piece on a player in place of the flat armour layer."""
    item = f"{NS}:{key}_{piece}"
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": f"{item}.player",
        "item": {item: "query.owner_identifier == 'minecraft:player'"},
        "materials": {"default": "entity_emissive_alpha", "enchanted": "entity_alphatest_glint"},
        "textures": {"default": f"textures/models/armor3d/{key}_{piece}", "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": f"geometry.{NS}.armor_{key}_{piece}"},
        "animations": {"first_person": f"animation.{NS}.armor.first_person"},
        "scripts": {"parent_setup": SETUP[piece], "animate": [{"first_person": "c.is_first_person"}]},
        "render_controllers": ["controller.render.item_default"],
    }}}
