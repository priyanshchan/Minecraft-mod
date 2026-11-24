"""v11.1: the monsters, undead and beasts, rebuilt in the companions' pixel style (all art is original).

Each creature is sculpted from many parts on a rig of its own proportions - bony limbs for the dead, hulking
shoulders for ogres and trolls, scaled tails for lizardmen, four legs for beasts, wings for demons and angels -
and painted with the companions' ramp shading: bone, scales, fur, stone, bark, plate and flame. Every creature
keeps its old size (height, breadth and reach) and the bones its animations move.
"""
from __future__ import annotations

import math
import random

import numpy as np

from modelkit import Model, shade, mix
from companions import (
    R, GOLD, GOLD_L, GOLD_D, SILVER, SILVER_L, SILVER_D, LEATHER, LEATHER_D, LEATHER_L, BONE, BONE_D, WOOD, WOOD_D,
    paint, toon, toon_metal, toon_leather, toon_hair, pixel_shade, hollow, sides, Limb, _rot,
    sword, staff, spear, axe, mace, bow, shield, quiver, scythe, dagger, Hand, blade, grip,
)


# ------------------------------------------------------------------------------------------ materials
def bone_cube(c, color=BONE, cracks=True):
    toon(c, color)
    if cracks:
        for f in sides(c):
            with paint(f) as p:
                rnd = random.Random(int(p.face.x * 7 + p.face.y))
                for _ in range(max(1, p.img.width * p.img.height // 40)):
                    x, y = rnd.randrange(p.img.width), rnd.randrange(p.img.height)
                    p.px(x, y, shade(color, 0.7))
    return c


def scales(c, color, belly=None):
    toon(c, color)
    for f in sides(c):
        with paint(f) as p:
            for y in range(0, p.img.height, 2):
                for x in range((y // 2) % 2, p.img.width, 2):
                    p.px(x, y, shade(color, 0.82))
            if belly and f is c.front:
                p.rect(p.w * 0.25, 0, p.w * 0.75, p.h, belly)
                for y in range(1, p.img.height, 2):
                    p.line([(p.w * 0.25, y / R), (p.w * 0.75, y / R)], shade(belly, 0.85))
    return c


def fur(c, color, tip=None):
    """Fur: the colour shaded down the body, flecked all over with short light and dark tufts (not stripes)."""
    toon(c, color, tip=tip, grad=(0.0, 1.0))
    rnd = random.Random(int(c.origin[0] * 13 + c.origin[1] * 7 + c.origin[2] * 3))
    for f in sides(c) + [c.top]:
        with paint(f) as p:
            W, Hh = p.img.width, p.img.height
            for _ in range(max(2, W * Hh // 9)):
                x, y = rnd.randrange(W), rnd.randrange(Hh)
                col = p.img.getpixel((x, y))
                if not col[3]:
                    continue
                k = 0.8 if rnd.random() < 0.6 else 1.16
                for dy in range(rnd.randint(1, 2)):
                    if y + dy < Hh:
                        p.img.putpixel((x, y + dy), shade(col, k))
    return c


RUNE_GLYPHS = [["X.X", "XXX", "X.X", "X.X", "X.X"], ["XX.", "X.X", "XX.", "X.X", "XX."], ["X..", "XX.", "X.X", "X..", "X.."],
               [".X.", "X.X", ".X.", "X.X", ".X."], ["X.X", ".X.", ".X.", ".X.", "X.X"]]


def stone(c, color, moss=None, runes=None):
    toon(c, color)
    for f in c.faces:
        with paint(f) as p:
            rnd = random.Random(int(p.face.x * 5 + p.face.y * 3))
            for _ in range(max(1, p.img.width * p.img.height // 30)):  # cracks
                x, y = rnd.randrange(p.img.width), rnd.randrange(p.img.height)
                for k in range(rnd.randint(1, 3)):
                    p.px(x + k, y + (k % 2), shade(color, 0.6))
            if moss and f is c.top:
                for _ in range(p.img.width):
                    p.px(rnd.randrange(p.img.width), rnd.randrange(p.img.height), moss)
            if runes and f in sides(c) and p.h >= 3:  # carved runes, glowing: a row of small glyphs
                cell = 0.4
                for k in range(int(p.w // 2)):
                    glyph = RUNE_GLYPHS[(k + int(p.face.x)) % len(RUNE_GLYPHS)]
                    gx, gy = 0.6 + k * 2, p.h / 2 - len(glyph) * cell / 2
                    for j, row in enumerate(glyph):
                        for i, ch in enumerate(row):
                            if ch == "X":
                                p.rect(gx + i * cell, gy + j * cell, gx + (i + 1) * cell, gy + (j + 1) * cell, runes)
    return c


def bark(c, color="#5a3e26", moss="#5f8a3a"):
    toon(c, color)
    for f in sides(c):
        with paint(f) as p:
            rnd = random.Random(int(p.face.x * 3 + p.face.y))
            for x in range(0, p.img.width, 2):
                for y in range(p.img.height):
                    if rnd.random() < 0.6:
                        p.px(x, y, shade(color, 0.78))
            for _ in range(max(1, p.img.width // 3)):
                p.px(rnd.randrange(p.img.width), rnd.randrange(p.img.height), moss)
    return c


def flame(c, color="#ff8a1a", core="#fff2a0"):
    for f in c.faces:
        with paint(f) as p:
            pixel_shade(p, core, tip=color, grad=(0.0, 1.0), span=1.0, base=0.2, edge=0.3)
    return c


def glow_eyes(head_cube, color, y=3.2, h=1.0, spread=1.6, w=1.0):
    with paint(head_cube.front) as p:
        cx = p.w / 2
        for sx in (-1, 1):
            x = cx + sx * spread
            p.rect(x - w / 2 - 0.25, y - 0.25, x + w / 2 + 0.25, y + h + 0.25, shade(color, 0.35))
            p.rect(x - w / 2, y, x + w / 2, y + h, color)
            p.px(int((x - w / 2) * R), int(y * R), mix(color, "#ffffff", 0.7))


def skull(head_cube, glow="#e0202c", color=BONE, jaw=True):
    bone_cube(head_cube, color)
    with paint(head_cube.front) as p:
        cx = p.w / 2
        p.ellipse(cx - 3.2, p.h * 0.32, cx - 0.4, p.h * 0.32 + 2.6, "#0c0a10").ellipse(cx + 0.4, p.h * 0.32, cx + 3.2, p.h * 0.32 + 2.6, "#0c0a10")
        p.rect(cx - 2.2, p.h * 0.32 + 0.9, cx - 1.4, p.h * 0.32 + 1.6, glow).rect(cx + 1.4, p.h * 0.32 + 0.9, cx + 2.2, p.h * 0.32 + 1.6, glow)
        p.poly([(cx - 0.4, p.h * 0.62), (cx + 0.4, p.h * 0.62), (cx, p.h * 0.72)], "#2a2024")
        if jaw:
            for k in range(-2, 2):
                p.rect(cx + k + 0.1, p.h * 0.82, cx + k + 0.9, p.h, shade(color, 0.92)).line([(cx + k, p.h * 0.82), (cx + k, p.h)], "#3a2f2a")


# ------------------------------------------------------------------------------------------ the rig
class Rig:
    """A humanoid frame of any proportions, with the same bone names as the player (and the companions)."""

    def __init__(self, name, head=(8, 8, 8), torso=(8, 12, 4), arm=(4, 12, 4), leg=(4, 12, 4), gap=0.0, bones=(),
                 bounds=(4.0, 4.2, 1.5), arm_drop=2.0, head_lift=0.0, head_fwd=0.0):
        self.name, self.n, self.look = name, sum(map(ord, name)), {}
        m = self.m = Model(name, bounds=bounds, res=R)
        hw, hh, hd = head
        tw, th, td = torso
        aw, ah, ad = arm
        lw, lh, ld = leg
        self.leg_top, self.top = lh, lh + th
        top = self.top
        self.root = m.bone("root", (0, 0, 0))
        self.body = m.bone("body", (0, top, 0), parent="root")
        self.torso = self.body.cube((-tw / 2, lh, -td / 2), (tw, th, td))
        self.head = m.bone("head", (0, top, 0), parent="body")
        self.skull = self.head.cube((-hw / 2, top + head_lift, -hd / 2 - head_fwd), (hw, hh, hd))
        sx = tw / 2 + aw / 2
        self.rarm = m.bone("rightArm", (-sx, top - arm_drop, 0), parent="body")
        self.larm = m.bone("leftArm", (sx, top - arm_drop, 0), parent="body")
        self.arm_l = [Limb(self.rarm, -sx - aw / 2, aw, -ad / 2, ad, top - ah, top), Limb(self.larm, sx - aw / 2, aw, -ad / 2, ad, top - ah, top)]
        self.arms_c = [limb.cube() for limb in self.arm_l]
        lx = lw / 2 + gap / 2
        self.rleg = m.bone("rightLeg", (-lx, lh, 0), parent="root")
        self.lleg = m.bone("leftLeg", (lx, lh, 0), parent="root")
        self.leg_l = [Limb(self.rleg, -lx - lw / 2, lw, -ld / 2, ld, 0, lh), Limb(self.lleg, lx - lw / 2, lw, -ld / 2, ld, 0, lh)]
        self.legs_c = [limb.cube() for limb in self.leg_l]
        ra, la = self.arm_l
        self.hx, self.hy, self.hz = ra.x0 + ra.w / 2, ra.y0 + 0.5, ra.z0
        self.ox = la.x0 + la.w / 2
        self.weapon = m.bone("weapon", (self.hx, self.hy, self.hz), parent="rightArm")
        self.offhand = m.bone("offhand", (self.ox, self.hy, la.z0), parent="leftArm")
        self.front, self.back = -td / 2, td / 2
        self.segs = [(-tw / 2, tw, -td / 2, td, lh, top, 0.0)] * 3
        self.cape = m.bone("cape", (0, top, self.back), parent="body") if "cape" in bones else None
        self.robe = m.bone("robe", (0, lh, 0), parent="body") if "robe" in bones else None
        self.tail = m.bone("tail", (0, lh + 1, self.back), parent="body") if "tail" in bones else None
        self.rwing = m.bone("rightWing", (-2, top - 3, self.back), parent="body") if "wings" in bones else None
        self.lwing = m.bone("leftWing", (2, top - 3, self.back), parent="body") if "wings" in bones else None
        if "arms2" in bones:
            self.rarm2 = m.bone("rightArm2", (-sx, top - 6, 0), parent="body")
            self.larm2 = m.bone("leftArm2", (sx, top - 6, 0), parent="body")
        self.skirt_bone = self.robe

    def cube(self, bone, origin, size, inflate=0.0, rotation=None, pivot=None):
        return bone.cube(origin, size, inflate, rotation, pivot)


def chain_on(bone, start, parts, paint_fn):
    """Segments hanging end to end from `start` (tails, tentacles, horns)."""
    point = np.array(start, float)
    out = []
    for i, (w, length, d, rot) in enumerate(parts):
        c = bone.cube((point[0] - w / 2, point[1] - length, point[2] - d / 2), (w, length, d), 0.0, rot, tuple(point))
        paint_fn(c, i)
        out.append(c)
        point = point + _rot(*rot) @ np.array([0, -length + 0.3, 0])
    return out


def wings_on(rig, kind="bat", color="#2a1f3a", frame="#cfc8d8", glow=None, span=1.0, lift=40):
    """Bat or feathered wings on the rig's wing bones."""
    z = rig.back + 0.5
    for sx in (-1, 1):
        bone = rig.rwing if sx < 0 else rig.lwing
        root = np.array([sx * 2.0, rig.top - 3, z])
        if kind == "bat":
            arm_rot = (0, sx * -25, sx * (90 - lift) if lift < 90 else sx * 40)
            bone.cube((root[0] - 0.5, root[1], root[2] - 0.5), (1, int(8 * span), 1), 0.0, arm_rot, tuple(root))
            wrist = root + _rot(*arm_rot) @ np.array([0, 8 * span - 0.5, 0])
            toon(bone.cubes[-1], frame)
            fingers = [(sx * 100, 11), (sx * 135, 10), (sx * 165, 8)]
            for k, (rz, length) in enumerate(fingers):
                rot = (0, sx * -20, rz)
                f = bone.cube((wrist[0] - 0.5, wrist[1], wrist[2] - 0.5), (1, int(length * span), 1), 0.0, rot, tuple(wrist))
                toon(f, frame)
                nxt = fingers[k + 1][0] if k + 1 < len(fingers) else sx * 200
                sheet = bone.cube((wrist[0] - 3, wrist[1], wrist[2] - 0.5), (6, int(length * span * 0.95), 1), -0.35, (0, sx * -20, (rz + nxt) / 2), tuple(wrist))
                for face in sheet.faces:
                    with paint(face) as p:
                        pixel_shade(p, color, tip=glow or shade(color, 0.6), grad=(0.1, 0.9), span=1.4, edge=0.4)
                        W, Hh = p.img.width, p.img.height
                        for x in range(W):
                            cut = int(3 * abs(math.sin((x + 1) * math.pi / (W / 2))))
                            for kk in range(cut):
                                p.px(x, Hh - 1 - kk, (0, 0, 0, 0))
        else:
            base = 90 - lift
            for row, (rz, n, length) in enumerate(((sx * (base - 10), 4, 7), (sx * (base + 10), 5, 9), (sx * (base + 30), 5, 10))):
                for i in range(n):
                    rot = (-12 - i * 3, sx * -40, rz + sx * i * 5)
                    f = bone.cube((root[0] - 1, root[1], root[2] - 0.5 + row * 0.3), (2, int(length * span), 1), 0.0, rot, tuple(root))
                    toon_hair(f, color, "point", False, row * 7 + i, glow, (0.0, 1.0))


def horns_on(rig, color="#2a2230", tip="#c04a2a", size=1.0, curl=1.0, spread=2.4):
    head = rig.head
    top = rig.skull.origin[1] + rig.skull.size[1]
    for sx in (-1, 1):
        parts = [(2, int(3 * size), 2, (155, 0, sx * 28)), (2, int(3 * size), 1, (125 * curl, 0, sx * 40)), (1, int(3 * size), 1, (85 * curl, 0, sx * 45))]
        total = sum(q[1] for q in parts)
        done = [0]

        def paint_horn(c, i, parts=parts, total=total, done=done):
            for f in c.faces:
                with paint(f) as p:
                    pixel_shade(p, color, tip=tip, grad=(done[0] / total, (done[0] + parts[i][1]) / total), span=1.6)
            done[0] += parts[i][1]
        chain_on(head, (sx * spread, top + 0.2, rig.skull.origin[2] + 3), parts, paint_horn)


def tail_on(rig, parts, paint_fn, start=None):
    start = start or (0, rig.leg_top + 1.5, rig.back + 0.2)
    return chain_on(rig.tail, start, parts, paint_fn)


def claws(rig, color=BONE_D, n=3):
    for limb in rig.arm_l:
        for k in range(n):
            x = limb.x0 + (k + 0.5) * limb.w / n - 0.5
            c = limb.bone.cube((x, limb.y0 - 1.5, limb.z0 - 0.3), (1, 2, 1), -0.15, (-25, 0, 0), (x + 0.5, limb.y0, limb.z0))
            toon(c, color)


def loincloth(rig, color, trim=None):
    x0, w, z0, d, y0, y1, _ = rig.segs[0]
    for z, rx in ((z0 - 0.6, -6), (z0 + d - 0.4, 6)):
        c = rig.body.cube((-w / 4, rig.leg_top - 5, z), (int(w / 2), 6, 1), 0.0, (rx, 0, 0), (0, rig.leg_top + 1, z))
        toon(c, color)
        if trim:
            with paint(c.front) as p:
                p.rect(0, p.h - 0.5, p.w, p.h, trim)
    b = rig.body.cube((x0, rig.leg_top, z0), (int(w), 1, int(d)), 0.3)
    toon_leather(b, LEATHER_D, stitch=False)
    hollow(b)


def armour_over(bone, cube, metal, trim=None, extra=0.35, y0=None, y1=None):
    ox, oy, oz = cube.origin
    w, h, d = cube.size
    y0 = oy if y0 is None else y0
    y1 = oy + h if y1 is None else y1
    c = bone.cube((ox, y0, oz), (w, int(y1 - y0), d), cube.inflate + extra)
    toon_metal(c, metal, trim)
    hollow(c)
    return c


def rig_weapon(rig, kind, **kw):
    """The companions' weapons, held in the rig's hands."""
    {"sword": lambda: sword(rig, **kw), "greatsword": lambda: sword(rig, wide=2, **kw), "spear": lambda: spear(rig, **kw),
     "axe": lambda: axe(rig, **kw), "mace": lambda: mace(rig, **kw), "bow": lambda: bow(rig, **kw), "staff": lambda: staff(rig, **kw),
     "scythe": lambda: scythe(rig, **kw), "dagger": lambda: dagger(rig, rig.weapon, rig.hx - 0.5, **kw), "none": lambda: None}[kind]()


def club(rig, wood="#6b4a2a", studs=SILVER_D, length=13, thick=3):
    h = Hand(rig, rig.weapon, rig.hx - 0.5)
    x = h.x
    grip(h.cube((x, 12.5, -5), (1, 1, 4)), LEATHER_D)
    c = h.cube((x - (thick - 1) / 2, 13 - thick / 2, -5 - length), (thick, thick, length), inflate=0.1)
    bark(c, wood, shade(wood, 0.7))
    for k in range(4):
        st = h.cube((x - 0.5, 13 + thick / 2 - 0.2, -7 - k * 3), (1, 1, 1))
        toon_metal(st, studs)


def flamberge(rig, steel="#3a3440", vein="#e0202c", length=20):
    """The Death Knight's wavy greatsword, red light running down its fuller."""
    h = Hand(rig, rig.weapon, rig.hx - 0.5)
    x = h.x
    grip(h.cube((x, 12.5, -6), (1, 1, 5)), "#1a1418", "#5a1a1a")
    toon_metal(h.cube((x - 2.5, 11.5, -7), (6, 3, 1)), "#2a2430")
    for k in range(length // 2):
        dz = -7 - (k + 1) * 2
        wave = 0.5 if k % 2 else 0
        blade(h.cube((x - 0.5 + wave * 0.5, 11.5, dz), (2, 3, 2), inflate=-0.2), steel, glow=vein)


def tower_shield(rig, face="#2a2430", rim="#5a1a1a", emblem="#e0202c"):
    la = rig.arm_l[1]
    h = Hand(rig, rig.offhand, la.x0 + la.w + 0.25)
    x = h.x
    s = h.cube((x, 4, -7), (1, 16, 10))
    for f in s.faces:
        with paint(f) as p:
            pixel_shade(p, face, span=1.6, metal=True)
            if f in (s.right, s.left):
                p.rect(0, 0, p.w, 0.6, rim).rect(0, p.h - 0.6, p.w, p.h, rim).rect(0, 0, 0.6, p.h, rim).rect(p.w - 0.6, 0, p.w, p.h, rim)
                cx = p.w / 2
                p.rect(cx - 0.4, 3, cx + 0.4, p.h - 3, emblem).rect(cx - 2.5, 6, cx + 2.5, 6.8, emblem)
                for k in range(3):
                    p.px(int((cx - 1.5 + k * 1.5) * R), int(3.5 * R), "#ffffff")


# ------------------------------------------------------------------------------------------ the dead
def skeleton(name, gear="old_guarder"):
    rig = Rig(name, head=(7, 7, 7), torso=(6, 12, 3), arm=(2, 12, 2), leg=(2, 13, 2), gap=1.5, bones=(), arm_drop=1.5)
    # a ribcage: the spine, a row of ribs and the pelvis
    with paint(rig.torso.front) as p:
        p.clear()
    for f in rig.torso.faces:
        with paint(f) as p:
            p.clear()
    spine = rig.body.cube((-0.5, rig.leg_top, 0.3), (1, 12, 1))
    bone_cube(spine)
    for k in range(5):
        rib = rig.body.cube((-3, rig.leg_top + 5 + k * 1.4, -1.5), (6, 1, 3), -0.1)
        bone_cube(rib, BONE if k % 2 else BONE_D)
        with paint(rib.top) as p:
            p.clear(1, 0.5, p.w - 1, p.h - 0.5)
    pelvis = rig.body.cube((-2.5, rig.leg_top - 0.5, -1.25), (5, 2, 3), -0.1)
    bone_cube(pelvis)
    clav = rig.body.cube((-4, rig.top - 1, -0.5), (8, 1, 1))
    bone_cube(clav)
    for c in rig.arms_c + rig.legs_c:
        bone_cube(c)
        with paint(c.front) as p:
            p.rect(0, p.h / 2 - 0.25, p.w, p.h / 2 + 0.5, BONE_D)  # the joint
    skull(rig.skull, "#e0202c" if gear != "archer" else "#59e0c8")
    if gear == "old_guarder":
        armour_over(rig.body, rig.torso, "#7a6a55", "#5a4a35", 0.4, rig.leg_top + 5)
        helm_ = rig.head.cube(rig.skull.origin, rig.skull.size, 0.5)
        toon_metal(helm_, "#7a6a55")
        with paint(helm_.front) as p:
            p.clear(0.8, 2, p.w - 0.8, p.h)
            p.rect(p.w / 2 - 0.4, 2, p.w / 2 + 0.4, 4.5, "#7a6a55")
        hollow(helm_)
        sword(rig, 11, "#a8a290", "#5a4a35")
        shield(rig, "round", "#5a4a35", "#7a6a55")
    elif gear == "archer":
        hood_ = rig.head.cube(rig.skull.origin, rig.skull.size, 0.6)
        toon(hood_, "#3a3228")
        with paint(hood_.front) as p:
            p.clear(1, 1.5, p.w - 1, p.h)
        with paint(hood_.bottom) as p:
            p.clear()
        quiver(rig, "#4a3a2a")
        bow(rig, "#4a3a2a", BONE_D)
    return rig.m


def robed_dead(name, robe_c, trim, glow, headgear="hood", height=35, tentacles=False, crown_c=None, orb="#c05bff"):
    """Liches, skeleton mages, wraiths and the brain eater: a robe over the dead, floating as it goes."""
    rig = Rig(name, head=(7, 7, 7), torso=(7, 12, 4), arm=(2, 12, 2), leg=(3, 14, 3), gap=0.5, bones=("robe",), arm_drop=1.5)
    for c in rig.legs_c:
        for f in c.faces:
            with paint(f) as p:
                p.clear()  # under the robe there is nothing but darkness
    toon(rig.torso, robe_c)
    with paint(rig.torso.front) as p:
        p.rect(p.w / 2 - 0.5, 0, p.w / 2 + 0.5, p.h, trim)
    # the robe: long panels from the waist to the ground, ragged at the hem
    for side, (ox, oz, w, d, rx, rz) in enumerate(((-3.8, -2.6, 8, 1, -8, 0), (-3.8, 1.6, 8, 1, 8, 0), (-4.4, -2.2, 1, 4, 0, 8), (3.4, -2.2, 1, 4, 0, -8))):
        c = rig.robe.cube((ox, 0, oz), (w, rig.leg_top, d), 0.0, (rx, 0, rz), (ox + w / 2, rig.leg_top, oz + d / 2))
        toon(c, robe_c)
        for f in sides(c):
            with paint(f) as p:
                rnd = random.Random(side * 31 + int(p.face.x))
                p.rect(0, 0.5, p.w, 1.2, trim)
                for x in range(p.img.width):
                    for k in range(rnd.randint(0, 5)):
                        p.px(x, p.img.height - 1 - k, (0, 0, 0, 0))
    for limb, c in zip(rig.arm_l, rig.arms_c):
        bone_cube(c, BONE if not tentacles else "#9a6aa8")
        sl = limb.cube(limb.y1 - 7, limb.y1, 0.7)
        toon(sl, robe_c)
        hollow(sl)
        with paint(sl.front) as p:
            p.rect(0, p.h - 0.6, p.w, p.h, trim)
    claws(rig, BONE_D)
    if tentacles:  # the brain eater: a swollen violet head and tentacles where a mouth would be
        toon(rig.skull, "#9a6aa8")
        glow_eyes(rig.skull, glow, 2.8, 1.0, 1.7, 1.2)
        for i, x in enumerate((-2.2, -0.8, 0.8, 2.2)):
            chain_on(rig.head, (x, rig.top + 2, rig.skull.origin[2] - 0.2),
                     [(1, 3, 1, (15, 0, (x) * 5)), (1, 3, 1, (25, 0, -x * 4)), (1, 2, 1, (35, 0, x * 3))],
                     lambda c, k: toon(c, "#8a5a98" if k < 2 else "#c08ad0"))
        brain_ = rig.head.cube((-3.5, rig.top + 5, -3), (7, 3, 6), 0.2)
        toon(brain_, "#c88ad8")
        with paint(brain_.top) as p:
            for k in range(1, int(p.w)):
                p.line([(k, 0.5), (k - 0.5, p.h - 0.5)], "#8a4a9a")
    else:
        skull(rig.skull, glow)
    if headgear == "hood":
        hd = rig.head.cube(rig.skull.origin, rig.skull.size, 0.8)
        toon(hd, robe_c)
        with paint(hd.front) as p:
            p.clear(1, 1, p.w - 1, p.h)
            p.rect(0.6, 0.6, p.w - 0.6, 1, shade(robe_c, 0.5))
        with paint(hd.bottom) as p:
            p.clear()
        tip = rig.head.cube((-1, rig.top + 5, 3), (2, 3, 2), 0.0, (-35, 0, 0), (0, rig.top + 6, 3.5))
        toon(tip, robe_c)
    if crown_c:
        c = rig.head.cube((-3.5, rig.top + 6.5, -3.5), (7, 2, 7), 0.6)
        toon_metal(c, crown_c)
        hollow(c)
        for k in range(5):
            sp = rig.head.cube((-3.5 + k * 1.6, rig.top + 8.5, -4.1), (1, 2 if k % 2 == 0 else 1, 1))
            toon_metal(sp, crown_c)
    collar_ = rig.body.cube((-4.5, rig.top - 1.5, -2.5), (9, 3, 5), 0.2)
    toon(collar_, shade(robe_c, 0.8))
    with paint(collar_.top) as p:
        p.clear(1.5, 1, p.w - 1.5, p.h - 1)
    with paint(collar_.bottom) as p:
        p.clear()
    if not tentacles:
        staff(rig, "skull" if name != "elder_lich" else "orb", "#2a2230", orb, trim, 30)
    return rig.m


def death_knight():
    rig = Rig("death_knight", head=(8, 8, 8), torso=(10, 13, 6), arm=(4, 14, 5), leg=(5, 14, 5), gap=0.5, arm_drop=2)
    black, red = "#2a2430", "#e0202c"
    for c in [rig.torso] + rig.arms_c + rig.legs_c:
        toon_metal(c, black)
        for f in sides(c):
            with paint(f) as p:
                rnd = random.Random(int(p.face.x * 3 + p.face.y))
                for _ in range(2):  # red veins of power in the plate
                    x = rnd.uniform(0.5, max(0.6, p.w - 0.5))
                    p.line([(x, 1), (x + rnd.uniform(-1, 1), p.h * 0.6), (x + rnd.uniform(-1, 1), p.h - 1)], shade(red, 0.8))
    skull(rig.skull, red)
    helm_ = rig.head.cube(rig.skull.origin, rig.skull.size, 0.6)
    toon_metal(helm_, black)
    with paint(helm_.front) as p:
        p.clear(1, 2.2, p.w - 1, 5)
        p.rect(p.w / 2 - 0.4, 2.2, p.w / 2 + 0.4, 6, black)
    with paint(helm_.bottom) as p:
        p.clear()
    for sx in (-1, 1):  # great horns
        chain_on(rig.head, (sx * 3.5, rig.top + 7.5, -1), [(2, 3, 2, (0, 0, sx * 50)), (1, 3, 1, (0, 0, sx * 20))],
                 lambda c, k: toon(c, "#e9e3cf" if k else "#bdb496"))
    for limb in rig.arm_l:  # spiked pauldrons
        pd = limb.bone.cube((limb.x0 - 1, limb.y1 - 4, limb.z0 - 1), (int(limb.w + 2), 4, int(limb.d + 2)), 0.2)
        toon_metal(pd, black, shade(red, 0.7))
        for k in range(2):
            sp = limb.bone.cube((limb.x0 + limb.w / 2 - 0.5 + (k - 0.5) * 1.5, limb.y1, limb.z0 + limb.d / 2 - 0.5), (1, 2, 1))
            toon_metal(sp, "#6a6070")
    cape_ = rig.body.cube((-5, 6, rig.back + 0.3), (10, 18, 1), 0.0, (8, 0, 0), (0, rig.top, rig.back))
    toon(cape_, "#5a1418")
    with paint(cape_.back) as p:
        rnd = random.Random(5)
        for x in range(p.img.width):
            for k in range(rnd.randint(0, 9)):
                p.px(x, p.img.height - 1 - k, (0, 0, 0, 0))
    flamberge(rig)
    tower_shield(rig)
    return rig.m


def death_cavalier():
    rig = Rig("death_cavalier", head=(8, 8, 8), torso=(9, 13, 5), arm=(4, 13, 4), leg=(4, 14, 4), gap=0.6, arm_drop=2)
    steel, purple = "#4a4458", "#8a3ad0"
    for c in [rig.torso] + rig.arms_c + rig.legs_c:
        toon_metal(c, steel, shade(purple, 0.8))
    skull(rig.skull, purple)
    helm_ = rig.head.cube(rig.skull.origin, rig.skull.size, 0.6)
    toon_metal(helm_, steel)
    with paint(helm_.front) as p:
        p.rect(1, 3, p.w - 1, 4, "#0c0a10")
        p.rect(2, 3.2, 3, 3.8, purple).rect(p.w - 3, 3.2, p.w - 2, 3.8, purple)
    with paint(helm_.bottom) as p:
        p.clear()
    pl = rig.head.cube((-0.5, rig.top + 8.5, -3), (1, 4, 8), 0.0, (-12, 0, 0), (0, rig.top + 8, 0))
    toon_hair(pl, "#2a1a3a", "point", False, 3, purple)
    for limb in rig.arm_l:
        pd = limb.bone.cube((limb.x0 - 1, limb.y1 - 4, limb.z0 - 1), (int(limb.w + 2), 4, int(limb.d + 2)), 0.2)
        toon_metal(pd, steel, purple)
        for k in range(3):
            sp = limb.bone.cube((limb.x0 + k * 1.5, limb.y1, 0), (1, 2, 1), 0.0, (0, 0, (k - 1) * 20), (limb.x0 + k * 1.5 + 0.5, limb.y1, 0))
            toon_metal(sp, "#8a8098")
    cape_ = rig.body.cube((-4.5, 7, rig.back + 0.3), (9, 17, 1), 0.0, (8, 0, 0), (0, rig.top, rig.back))
    toon(cape_, "#1a1222")
    spear(rig, "#cfc8d8", "#2a2230", purple)
    return rig.m


def ghoul():
    rig = Rig("ghoul", head=(7, 7, 7), torso=(8, 12, 4), arm=(3, 15, 3), leg=(3, 13, 3), gap=1, arm_drop=1.5, head_fwd=1.5)
    skin = "#7a8a6a"
    for c in [rig.torso] + rig.arms_c + rig.legs_c:
        toon(c, skin)
        for f in sides(c):
            with paint(f) as p:
                rnd = random.Random(int(p.face.x + p.face.y * 5))
                for _ in range(max(1, p.img.width * p.img.height // 25)):
                    p.px(rnd.randrange(p.img.width), rnd.randrange(p.img.height), "#4a5a3a")
    toon(rig.skull, skin)
    glow_eyes(rig.skull, "#e0e040", 2.6, 0.8, 1.6, 1.2)
    with paint(rig.skull.front) as p:
        p.rect(1.5, 4.5, p.w - 1.5, 6, "#2a1a1a")
        for x in range(2, int(p.w) - 1):
            p.rect(x, 4.5, x + 0.5, 5.2, "#e8e0c8")
    with paint(rig.torso.front) as p:
        for k in range(4):
            p.line([(1.5, 2 + k * 1.5), (p.w - 1.5, 2 + k * 1.5)], "#5a6a4a")  # ribs through the skin
    loincloth(rig, "#4a3a2a")
    rag = rig.body.cube((-4, rig.top - 6, -2), (8, 6, 4), 0.3)
    toon(rag, "#5a4a3a")
    with paint(rag.front) as p:
        p.clear(2, 2, 6, 6)
    hollow(rag)
    claws(rig, "#3a3a2a")
    return rig.m


def goblin():
    rig = Rig("goblin", head=(8, 7, 7), torso=(8, 11, 4), arm=(3, 12, 3), leg=(3, 13, 3), gap=1, arm_drop=1.5)
    skin = "#6a9a4a"
    for c in [rig.torso] + rig.arms_c + rig.legs_c:
        toon(c, skin)
    toon(rig.skull, skin)
    glow_eyes(rig.skull, "#e0c020", 3.0, 0.8, 1.8, 1.2)
    with paint(rig.skull.front) as p:
        p.rect(p.w / 2 - 0.75, 3.8, p.w / 2 + 0.75, 5.2, shade(skin, 0.8))  # a big nose
        p.rect(2, 5.6, p.w - 2, 6.2, "#2a1a1a")
        p.px(int(2.5 * R), int(5.6 * R), "#ffffff").px(int((p.w - 2.5) * R), int(5.6 * R), "#ffffff")
    for sx in (-1, 1):  # long pointed ears
        ear = rig.head.cube((sx * 4.5 - 0.5, rig.top + 4, -0.5), (1, 2, 4), 0.0, (0, sx * -30, sx * -25), (sx * 4, rig.top + 5, 0))
        toon(ear, skin)
    vest_ = armour_over(rig.body, rig.torso, LEATHER, None, 0.3)
    toon_leather(vest_, LEATHER)
    hollow(vest_)
    loincloth(rig, "#6a4a2a")
    for limb in rig.leg_l:
        b = limb.cube(0, 4, 0.25)
        toon_leather(b, LEATHER_D)
    club(rig, "#6b4a2a", SILVER_D, 10, 2)
    return rig.m


def brute(name, skin, cloth, weapon="club", hair=None, beard=None, armour=None, tusks=True, eyes="#e0c020", horns=None, rocky=False):
    """Ogres, trolls, giants: small heads on great shoulders, arms to the knee."""
    rig = Rig(name, head=(6, 6, 6), torso=(12, 13, 7), arm=(5, 17, 5), leg=(5, 13, 5), gap=1, arm_drop=2.5, head_fwd=1.5, head_lift=-0.5)
    painter = (lambda c: stone(c, skin, "#5f8a3a")) if rocky else (lambda c: toon(c, skin))
    for c in [rig.torso] + rig.arms_c + rig.legs_c:
        painter(c)
    painter(rig.skull)
    hump = rig.body.cube((-5, rig.top - 4, -1), (10, 4, 6), 0.2)
    painter(hump)
    glow_eyes(rig.skull, eyes, 2.0, 0.7, 1.4, 1.0)
    with paint(rig.skull.front) as p:
        p.rect(p.w / 2 - 0.75, 2.8, p.w / 2 + 0.75, 4.0, shade(skin, 0.8))
        p.rect(1.2, 4.6, p.w - 1.2, 5.3, "#2a1a1a")
    if tusks:
        for sx in (-1, 1):
            t = rig.head.cube((sx * 1.8 - 0.5, rig.top + 0.5, rig.skull.origin[2] - 0.6), (1, 2, 1))
            toon(t, "#e8e0c8")
    if hair:
        h = rig.head.cube(rig.skull.origin, (6, 2, 6), 0.4)
        h.origin = (rig.skull.origin[0], rig.skull.origin[1] + 4, rig.skull.origin[2])
        toon_hair(h, hair, "blunt", True, 5)
    if beard:
        b = rig.head.cube((-3, rig.top - 3, rig.skull.origin[2] - 0.5), (6, 4, 1))
        toon_hair(b, beard, "point", False, 7)
    if horns:
        horns_on(rig, horns, shade(horns, 1.4), 0.8, 0.8, 2.2)
    loincloth(rig, cloth, shade(cloth, 1.3))
    if armour:
        armour_over(rig.body, rig.torso, armour, GOLD_D, 0.4, rig.top - 6)
        for limb in rig.arm_l:
            pd = limb.bone.cube((limb.x0 - 1, limb.y1 - 4, limb.z0 - 1), (int(limb.w + 2), 4, int(limb.d + 2)), 0.2)
            toon_metal(pd, armour)
    for limb in rig.leg_l:
        w = limb.cube(0, 3, 0.3)
        toon_leather(w, LEATHER_D)
    if weapon == "club":
        club(rig, "#5a3e26", SILVER_D, 14, 3)
    elif weapon == "greatsword":
        sword(rig, 18, "#9aa0aa", LEATHER_D, wide=2)
    elif weapon == "axe":
        axe(rig, "#cfe8f8", WOOD_D, double=True)
    elif weapon == "fists":
        for limb in rig.arm_l:
            fist = limb.cube(limb.y0 - 1, limb.y0 + 2, 0.5)
            painter(fist)
    return rig.m


def reptile(name, skin, belly, weapon="spear", crest=None, armour=None, kind="lizard", mane=None, horns=None, glow="#e0c020"):
    """Lizardmen and the beast-folk: a long snouted head, a tail, scales or fur."""
    rig = Rig(name, head=(6, 6, 7), torso=(8, 12, 5), arm=(3, 12, 3), leg=(4, 13, 4), gap=0.6, bones=("tail",), arm_drop=1.5, head_lift=0.5)
    paint_fn = (lambda c: scales(c, skin)) if kind == "lizard" else (lambda c: fur(c, skin))
    for c in rig.arms_c + rig.legs_c:
        paint_fn(c)
    if kind == "lizard":
        scales(rig.torso, skin, belly)
    else:
        fur(rig.torso, skin)
    paint_fn(rig.skull)
    snout = rig.head.cube((-2, rig.top + 0.5, rig.skull.origin[2] - 4), (4, 3, 4))
    paint_fn(snout)
    with paint(snout.front) as p:
        p.rect(0.5, p.h - 1, p.w - 0.5, p.h - 0.6, "#2a1a1a")
        p.px(int(1 * R), int(0.5 * R), "#1a1010").px(int((p.w - 1) * R) - 1, int(0.5 * R), "#1a1010")
    glow_eyes(rig.skull, glow, 2.2, 0.8, 2.2, 0.8)
    if kind != "lizard":
        for sx in (-1, 1):
            ear = rig.head.cube((sx * 2.5 - 0.5, rig.top + 6, -1), (1, 2, 2), 0.0, (0, 0, sx * -15), (sx * 2.5, rig.top + 6, 0))
            paint_fn(ear)
    if crest:
        for k in range(4):
            c = rig.head.cube((-0.5, rig.top + 5.5 - k * 0.3, -2 + k * 1.6), (1, 2 + (k % 2), 1))
            toon(c, crest)
    if mane:
        m = rig.head.cube((-4, rig.top - 1, -1), (8, 8, 5), 0.2)
        toon_hair(m, mane, "point", True, 9)
        with paint(m.front) as p:
            p.clear(1.5, 1, p.w - 1.5, p.h)
    if horns:
        horns_on(rig, horns, shade(horns, 1.3), 0.9, 0.9, 2.0)
    tail_paint = (lambda c, i: scales(c, skin)) if kind == "lizard" else (lambda c, i: fur(c, skin))
    tail_on(rig, [(3, 5, 3, (-60, 0, 0)), (2, 5, 2, (-75, 0, 0)), (2, 4, 2, (-85, 0, 5)), (1, 3, 1, (-90, 0, 10))], tail_paint)
    loincloth(rig, "#6a4a2a" if not armour else shade(armour, 0.6), GOLD_D)
    if armour:
        armour_over(rig.body, rig.torso, armour, GOLD, 0.4, rig.top - 7)
        for limb in rig.arm_l:
            pd = limb.bone.cube((limb.x0 - 1, limb.y1 - 3, limb.z0 - 1), (int(limb.w + 2), 3, int(limb.d + 2)), 0.2)
            toon_metal(pd, armour, GOLD)
    claws(rig, "#e8e0c8", 2)
    if weapon == "spear":
        spear(rig, "#e8e4dc", WOOD, LEATHER_D)
    elif weapon == "frost":  # Frost Pain
        sword(rig, 14, "#a8e0ff", "#3a6aa8", glow="#e8f8ff")
    elif weapon == "axe":
        axe(rig, SILVER, WOOD_D)
    elif weapon == "mace":
        mace(rig, "#8a8a92", GOLD)
    elif weapon == "greatsword":
        sword(rig, 16, "#3a3440", "#5a1a1a", wide=2, glow="#e0202c")
    return rig.m


def quagoa(name="quagoa", warlord=False):
    rig = Rig(name, head=(7, 6, 7), torso=(9, 13, 6), arm=(4, 13, 4), leg=(4, 14, 4), gap=0.5, arm_drop=2, head_fwd=0.5)
    fur_c = "#6b4d34" if not warlord else "#4a3a2a"
    for c in [rig.torso, rig.skull] + rig.arms_c + rig.legs_c:
        fur(c, fur_c)
    snout = rig.head.cube((-1.5, rig.top + 0.5, rig.skull.origin[2] - 2.5), (3, 2, 3))
    toon(snout, "#e89aa8")
    glow_eyes(rig.skull, "#e0202c", 2.0, 0.6, 1.6, 0.7)
    with paint(rig.torso.front) as p:
        p.rect(2, 1.5, p.w - 2, p.h - 2, shade(fur_c, 1.25))
    for limb in rig.arm_l:  # great digging claws
        for k in range(3):
            x = limb.x0 + k * 1.4
            c = limb.bone.cube((x, limb.y0 - 2.5, limb.z0 - 0.5), (1, 3, 1), 0.0, (-30, 0, 0), (x + 0.5, limb.y0, limb.z0))
            toon(c, "#f1eee0")
    if warlord:
        armour_over(rig.body, rig.torso, "#5a6a7a", "#a8e0ff", 0.4, rig.top - 8)
        for limb in rig.arm_l:
            pd = limb.bone.cube((limb.x0 - 1, limb.y1 - 4, limb.z0 - 1), (int(limb.w + 2), 4, int(limb.d + 2)), 0.2)
            toon_metal(pd, "#5a6a7a", "#a8e0ff")
        c = rig.head.cube((-3, rig.top + 6, -3), (6, 2, 6), 0.4)
        toon_metal(c, "#5a6a7a")
        for k in range(3):
            sp = rig.head.cube((-2.5 + k * 2, rig.top + 8, -1), (1, 2, 1))
            toon(sp, "#a8e0ff")
    loincloth(rig, "#4a3020")
    return rig.m


# ------------------------------------------------------------------------------------------ demons and angels
def demon(name, skin, armour, glow, wings="bat", horns="#2a2230", weapon="flame", mask=False, suit=None):
    rig = Rig(name, head=(7, 7, 7), torso=(9, 13, 5), arm=(3, 14, 3), leg=(4, 14, 4), gap=0.6, bones=("wings",), arm_drop=2)
    for c in [rig.torso] + rig.arms_c + rig.legs_c:
        toon(c, skin)
    toon(rig.skull, skin)
    glow_eyes(rig.skull, glow, 2.6, 0.8, 1.6, 1.4)
    with paint(rig.skull.front) as p:
        p.rect(1.5, 5, p.w - 1.5, 5.6, "#1a0a0a")
        for x in (2, p.w - 2.5):
            p.rect(x, 5, x + 0.5, 6, "#f4f0e2")
    if suit:  # Jaldabaoth: a suit of fine cloth, a mask over the face
        for c in [rig.torso] + rig.arms_c + rig.legs_c:
            toon(c, suit)
        with paint(rig.torso.front) as p:
            p.poly([(p.w / 2 - 1.5, 0), (p.w / 2 + 1.5, 0), (p.w / 2, 4)], "#f4f3f5")
    if armour:
        armour_over(rig.body, rig.torso, armour, glow, 0.45, rig.top - 9)
        for limb in rig.arm_l + rig.leg_l:
            ar = limb.cube(limb.y0, limb.y0 + 5, 0.3)
            toon_metal(ar, armour)
        for limb in rig.arm_l:
            pd = limb.bone.cube((limb.x0 - 1, limb.y1 - 4, limb.z0 - 1), (int(limb.w + 2), 4, int(limb.d + 2)), 0.25)
            toon_metal(pd, armour, glow)
    if mask:
        mk = rig.head.cube((-3.5, rig.top + 0.5, rig.skull.origin[2] - 0.6), (7, 6, 1))
        toon(mk, "#f1ede4")
        with paint(mk.front) as p:
            p.ellipse(1, 2, 3, 3.5, "#1a0a0a").ellipse(4, 2, 6, 3.5, "#1a0a0a")
            p.line([(1, 4.5), (3.5, 5.2), (6, 4.5)], "#c2171d")
    horns_on(rig, horns, glow, 1.0, 1.0, 2.2)
    wings_on(rig, wings, "#2a1418" if wings == "bat" else "#f4f0e8", "#3a2a30", glow, 1.1, lift=22)
    claws(rig, "#1a1418")
    if weapon == "flame":
        h = Hand(rig, rig.weapon, rig.hx - 0.5)
        x = h.x
        grip(h.cube((x, 12.5, -6), (1, 1, 4)), "#1a1418")
        toon_metal(h.cube((x - 1.5, 11.5, -7), (4, 3, 1)), armour or "#2a2230")
        b = h.cube((x - 0.5, 12, -21), (2, 2, 14))
        flame(b, glow, "#fff2a0")
    elif weapon == "scythe":
        scythe(rig, "#3a3440", "#1a1418", glow)
    tail_bone = rig.body
    tail_paint = lambda c, i: toon(c, skin)
    chain_on(tail_bone, (0, rig.leg_top + 1, rig.back + 0.2), [(2, 4, 2, (-55, 0, 0)), (1, 4, 1, (-70, 0, 8)), (1, 3, 1, (-80, 0, -6))], tail_paint)
    return rig.m


def angel(name, armour, cloth, glow, weapon="flame", shield_=True, faceless=True):
    rig = Rig(name, head=(7, 7, 7), torso=(9, 13, 5), arm=(3, 14, 3), leg=(4, 14, 4), gap=0.6, bones=("wings",), arm_drop=2)
    for c in [rig.torso] + rig.arms_c + rig.legs_c:
        toon_metal(c, armour, GOLD)
    toon_metal(rig.skull, armour)
    with paint(rig.skull.front) as p:
        if faceless:
            p.rect(1, 3, p.w - 1, 4, "#0c0a10")
            p.rect(1.5, 3.2, p.w - 1.5, 3.8, glow)
    skirt_ = rig.body.cube((-4.5, rig.leg_top - 6, -2.5), (9, 7, 5), 0.4)
    toon(skirt_, cloth)
    hollow(skirt_)
    for limb in rig.arm_l:
        pd = limb.bone.cube((limb.x0 - 1, limb.y1 - 4, limb.z0 - 1), (int(limb.w + 2), 4, int(limb.d + 2)), 0.25)
        toon_metal(pd, GOLD)
    # a halo of fire
    for x0, z0, w, d in ((-3, -3, 6, 1), (-3, 2, 6, 1), (-3, -2, 1, 4), (2, -2, 1, 4)):
        c = rig.head.cube((x0, rig.top + 9.5, z0), (w, 1, d), -0.1)
        flame(c, glow, "#fff8d0")
    wings_on(rig, "feather", "#fbfaf6", None, mix(glow, "#ffffff", 0.5), 1.15, lift=30)
    if weapon == "flame":
        h = Hand(rig, rig.weapon, rig.hx - 0.5)
        x = h.x
        grip(h.cube((x, 12.5, -6), (1, 1, 4)), GOLD_D)
        toon_metal(h.cube((x - 1.5, 11.5, -7), (4, 3, 1)), GOLD)
        flame(h.cube((x - 0.5, 12, -21), (2, 2, 14)), glow, "#fff8d0")
    elif weapon == "scepter":
        staff(rig, "holy", "#f4f1ea", glow, GOLD, 30)
    if shield_:
        shield(rig, "kite", cloth, GOLD)
    return rig.m


# ------------------------------------------------------------------------------------------ golems and trees
def golem(name, rock, runes=None, metal=False, moss=None, legs=12):
    rig = Rig(name, head=(6, 5, 6), torso=(14, 13, 8), arm=(6, 17, 6), leg=(6, legs, 6), gap=1, arm_drop=3, head_lift=-0.5, head_fwd=1)
    painter = (lambda c: toon_metal(c, rock, runes)) if metal else (lambda c: stone(c, rock, moss, runes))
    for c in [rig.torso, rig.skull] + rig.arms_c + rig.legs_c:
        painter(c)
    glow_eyes(rig.skull, runes or "#59d0ff", 1.8, 0.8, 1.4, 1.2)
    for limb in rig.arm_l:  # boulder fists and shoulder stones
        fist = limb.cube(limb.y0 - 1, limb.y0 + 3, 0.6)
        painter(fist)
        sh = limb.bone.cube((limb.x0 - 1, limb.y1 - 4, limb.z0 - 1), (int(limb.w + 2), 5, int(limb.d + 2)), 0.1)
        painter(sh)
    core = rig.body.cube((-1.5, rig.top - 7, rig.front - 0.8), (3, 3, 1), 0.1)
    toon(core, runes or "#59d0ff", light=1.4)
    for k in range(3):
        ch = rig.body.cube((-6 + k * 4.5, rig.top, -2), (3, 2, 4))
        painter(ch)
    return rig.m


def treant(name, wood, leaves, eyes="#ffd23d", corrupt=False):
    rig = Rig(name, head=(8, 8, 7), torso=(10, 13, 6), arm=(4, 16, 4), leg=(5, 12, 5), gap=0.6, arm_drop=2, head_lift=-1)
    for c in [rig.torso, rig.skull] + rig.arms_c + rig.legs_c:
        bark(c, wood, leaves)
    glow_eyes(rig.skull, eyes, 3.0, 1.0, 1.8, 1.2)
    with paint(rig.skull.front) as p:
        p.ellipse(2, 5, p.w - 2, 7, "#1a1008")
    for limb in rig.arm_l:  # branching hands
        for k in range(3):
            c = limb.bone.cube((limb.x0 + k * 1.3, limb.y0 - 4, limb.z0 + 1), (1, 5, 1), 0.0, (-20, 0, (k - 1) * 25), (limb.x0 + k * 1.3 + 0.5, limb.y0, limb.z0 + 1.5))
            bark(c, shade(wood, 0.9), leaves)
    for limb in rig.leg_l:  # roots
        for k in range(2):
            r = limb.bone.cube((limb.x0 + k * 2, 0, limb.z0 - 2), (1, 2, 3), 0.0, (0, (k - 0.5) * 40, 0), (limb.x0 + k * 2 + 0.5, 0, limb.z0))
            bark(r, wood)
    crown_ = []
    for i, (x, y, z, w, h, d) in enumerate(((-6, 34, -4, 12, 4, 9), (-4, 37, -3, 8, 2, 7), (-7, 32, -2, 3, 3, 5), (4, 32, -2, 3, 3, 5))):
        c = rig.head.cube((x, y - 3 + (rig.skull.origin[1] + 8 - 32), z), (w, h, d))
        toon_hair(c, leaves, "point", True, i * 5, shade(leaves, 1.3) if not corrupt else "#c05bff", (0.0, 1.0))
        crown_.append(c)
    if corrupt:  # Zy'tl Q'ae: tentacle roots and violet fruit
        for k in range(4):
            a = k * math.pi / 2 + 0.4
            chain_on(rig.body, (math.cos(a) * 4, rig.leg_top + 2, math.sin(a) * 3),
                     [(2, 4, 2, (math.sin(a) * 40, 0, -math.cos(a) * 40)), (1, 4, 1, (math.sin(a) * 60, 0, -math.cos(a) * 60))],
                     lambda c, i: toon(c, "#3a2a3a"))
        for x, z in ((-4, -3), (3, 0), (-1, 3)):
            f = rig.head.cube((x, rig.skull.origin[1] + 9, z), (1, 1, 1), 0.2)
            toon(f, "#c05bff", light=1.3)
    return rig.m


# ------------------------------------------------------------------------------------------ beasts
def quadruped(name, body_c, kind="horse", glow="#59e0c8", accent=BONE, tail_bones=("tail",)):
    """Four-legged beasts on the old frame (legs leg0-leg3, a tail), sculpted anew."""
    m = Model(name, bounds=(3.5, 3, 0.9), res=R)
    root = m.bone("root", (0, 0, 0))
    body = m.bone("body", (0, 12, 0), parent="root")
    if kind == "insect":
        b = body.cube((-3, 9, -7), (6, 5, 14))
    else:
        b = body.cube((-4, 8, -8), (8, 8, 16))
    head = m.bone("head", (0, 13, -8), parent="body")
    legs = []
    for nm, x, z in (("leg0", -4, -7), ("leg1", 1, -7), ("leg2", -4, 4), ("leg3", 1, 4)):
        bone = m.bone(nm, (x + 1.5, 8, z + 1.5), parent="body")
        legs.append((bone, x, z))
    if kind == "horse":  # the Soul Eater: a skeletal horse, wreathed in ghost-light
        toon(b, body_c)
        for f in (b.right, b.left):
            with paint(f) as p:
                for k in range(6):
                    p.rect(1 + k * 2.3, 2, 1.8 + k * 2.3, p.h - 2, accent)  # ribs
        h = head.cube((-2.5, 9, -16), (5, 6, 8))
        bone_cube(h, accent)
        glow_eyes(h, glow, 1.6, 1.0, 1.4, 1.0)
        neck = head.cube((-2, 12, -10), (4, 5, 4), 0.0, (-35, 0, 0), (0, 14, -8))
        toon(neck, body_c)
        mane = body.cube((-1, 16, -8), (2, 4, 12))
        flame(mane, glow, mix(glow, "#ffffff", 0.6))
        for bone, x, z in legs:
            leg = bone.cube((x + 0.5, 0, z + 0.5), (2, 9, 2))
            bone_cube(leg, accent)
            hoof = bone.cube((x, 0, z), (3, 2, 3))
            flame(hoof, glow, mix(glow, "#ffffff", 0.6))
        for sx in (-1, 1):
            horn = head.cube((sx * 1.5 - 0.5, 14.5, -14), (1, 3, 1), 0.0, (-30, 0, sx * -15), (sx * 1.5, 14.5, -13.5))
            toon(horn, "#2a2230")
    elif kind == "dog":  # the Hellhound: black fur and fire
        fur(b, body_c)
        h = head.cube((-3, 10, -14), (6, 6, 6))
        fur(h, body_c)
        sn = head.cube((-2, 10, -17), (4, 3, 3))
        fur(sn, body_c)
        with paint(sn.front) as p:
            p.rect(0.5, p.h - 1, p.w - 0.5, p.h - 0.5, "#e0402a")
        glow_eyes(h, glow, 2.0, 0.8, 1.5, 1.0)
        for sx in (-1, 1):
            ear = head.cube((sx * 2 - 0.5, 16, -12), (1, 2, 2))
            fur(ear, body_c)
        mane = body.cube((-3, 15, -8), (6, 3, 8), 0.2)
        flame(mane, glow, "#fff2a0")
        for bone, x, z in legs:
            leg = bone.cube((x, 0, z), (3, 8, 3))
            fur(leg, body_c)
            paw = bone.cube((x, 0, z - 0.5), (3, 1, 4), 0.1)
            flame(paw, glow, "#fff2a0")
    elif kind == "lizard":  # the Gigant Basilisk: a great lizard with a crest
        scales(b, body_c, accent)
        h = head.cube((-3, 9, -15), (6, 5, 8))
        scales(h, body_c)
        glow_eyes(h, glow, 1.4, 1.0, 1.8, 1.0)
        with paint(h.front) as p:
            p.rect(0.5, p.h - 1.2, p.w - 0.5, p.h - 0.8, "#2a1a1a")
        for k in range(5):
            c = body.cube((-0.5, 16, -7 + k * 3), (1, 2 + (k % 2), 2))
            toon(c, "#f2e21b")
        for bone, x, z in legs:
            leg = bone.cube((x - 0.5, 0, z), (4, 8, 3))
            scales(leg, body_c)
    elif kind == "goat":  # the Dark Young: a black mass on hooves, mouths and tentacles
        toon(b, body_c)
        with paint(b.right) as p:
            p.ellipse(2, 2, 6, 5, "#2a0a2a").ellipse(9, 3, 13, 6, "#2a0a2a")
        h = head.cube((-3, 12, -12), (6, 6, 6))
        toon(h, body_c)
        glow_eyes(h, glow, 1.5, 1.0, 1.6, 1.2)
        for k in range(6):
            a = k * math.pi / 3
            chain_on(body, (math.cos(a) * 3, 16, math.sin(a) * 6), [(1, 4, 1, (math.sin(a) * 30 + 150, 0, -math.cos(a) * 30)), (1, 3, 1, (170, 0, 0))],
                     lambda c, i: toon(c, "#2a2433" if i == 0 else glow))
        for bone, x, z in legs:
            leg = bone.cube((x, 0, z), (3, 8, 3))
            toon(leg, body_c)
            hoof = bone.cube((x, 0, z), (3, 2, 3), 0.1)
            toon(hoof, "#0c0b10")
    elif kind == "insect":  # the Eight-Edge Assassin: a black-shelled insect with blades for legs
        toon_metal(b, body_c)
        h = head.cube((-2, 9, -12), (4, 4, 5))
        toon_metal(h, body_c)
        glow_eyes(h, glow, 1.0, 1.0, 1.0, 0.8)
        for bone, x, z in legs:
            leg = bone.cube((x + 0.5, 0, z + 0.5), (2, 9, 2))
            toon_metal(leg, body_c)
            bl = bone.cube((x + 0.5, 4, z - 2), (2, 1, 3), 0.0, (-30, 0, 0), (x + 1.5, 4, z))
            blade(bl, "#cfc8d8", glow)
        for sx in (-1, 1):
            for k in range(2):
                sc = body.cube((sx * 4 - 0.5, 10, -5 + k * 5), (1, 1, 6), 0.0, (0, sx * 30, sx * 20), (sx * 3, 11, -2 + k * 5))
                blade(sc, "#cfc8d8", glow)
            arm_ = head.cube((sx * 2 - 0.5, 12, -10), (1, 6, 1), 0.0, (-20, 0, sx * -10), (sx * 2, 12, -9.5))
            toon_metal(arm_, body_c)
            sc = head.cube((sx * 2 - 0.5, 17.5, -11), (1, 4, 1), 0.0, (-50, 0, 0), (sx * 2, 17.5, -10.5))
            blade(sc, "#cfc8d8", glow)
    # the tail(s)
    if tail_bones == ("tail",):
        tail = m.bone("tail", (0, 13, 8), parent="body", rotation=(-25, 0, 0))
        t = tail.cube((-1, 12, 8), (2, 2, 7))
        {"horse": lambda: flame(t, glow, mix(glow, "#ffffff", 0.6)), "dog": lambda: fur(t, body_c),
         "lizard": lambda: scales(t, body_c), "goat": lambda: toon(t, body_c), "insect": lambda: toon_metal(t, body_c)}[kind]()
    return m


def hamsuke():
    """The Wise King of the Forest: a giant hamster with a snake for a tail."""
    m = Model("hamsuke", bounds=(3.5, 2.5, 0.6), res=R)
    furc, belly = "#e9e2d8", "#f8f4ee"
    root = m.bone("root", (0, 0, 0))
    body = m.bone("body", (0, 8, 0), parent="root")
    b = body.cube((-7, 2, -8), (14, 12, 16))
    fur(b, furc)
    with paint(b.front) as p:
        p.ellipse(2, 2, p.w - 2, p.h, belly)
    with paint(b.top) as p:  # her markings
        p.ellipse(4, 4, p.w - 4, p.h - 4, "#a89880")
        p.ellipse(5, 5, p.w - 5, p.h - 5, "#5a7aa8")
    head = m.bone("head", (0, 10, -8), parent="body")
    h = head.cube((-5, 5, -14), (10, 9, 7))
    fur(h, furc)
    with paint(h.front) as p:
        p.ellipse(1.5, 2.5, 3.5, 4.5, "#1a1418").ellipse(6.5, 2.5, 8.5, 4.5, "#1a1418")
        p.px(int(2 * R), int(2.8 * R), "#ffffff").px(int(7 * R), int(2.8 * R), "#ffffff")
        p.rect(4.25, 5, 5.75, 5.8, "#e89aa8")
        p.rect(4.5, 6.5, 5.5, 8, "#ffffff")
        for sx in (-1, 1):
            for k in range(2):
                p.line([(5 + sx * 1.5, 5.5 + k * 0.6), (5 + sx * 4.5, 5 + k * 1.2)], "#c8c0b8")
    cheeks = head.cube((-6, 5, -12), (12, 4, 4), 0.1)
    fur(cheeks, belly)
    for sx in (-1, 1):
        ear = head.cube((sx * 3.5 - 1, 14, -10), (2, 2, 1))
        toon(ear, "#e89aa8")
    for nm, x, z in (("leg0", -6, -7), ("leg1", 3, -7), ("leg2", -6, 4), ("leg3", 3, 4)):
        bone = m.bone(nm, (x + 1.5, 4, z + 1.5), parent="body")
        leg = bone.cube((x, 0, z), (3, 4, 3))
        fur(leg, furc)
    t1 = m.bone("tail", (0, 8, 8), parent="body")
    t2 = m.bone("tail2", (0, 8, 15), parent="tail")
    t3 = m.bone("tail3", (0, 8, 22), parent="tail2")
    for bone, z, w in ((t1, 8, 3), (t2, 15, 2), (t3, 22, 2)):
        c = bone.cube((-w / 2, 7, z), (w, w, 7))
        scales(c, "#3a5a2a", "#a8c07a")
    snake = t3.cube((-1.5, 7, 28), (3, 2, 3))
    scales(snake, "#3a5a2a")
    return m


def cocytus():
    """The Ruler of the Fifth Floor: a warrior of living ice, four-armed, mandibled, with a great tail."""
    rig = Rig("cocytus", head=(7, 7, 8), torso=(9, 13, 6), arm=(3, 13, 3), leg=(4, 14, 4), gap=0.6, bones=("tail", "arms2"), arm_drop=2)
    ice, ice_d = "#a8d8f0", "#5a8ab0"
    for c in [rig.torso, rig.skull] + rig.arms_c + rig.legs_c:
        toon_metal(c, ice, "#e8f8ff")
    glow_eyes(rig.skull, "#e8f8ff", 2.4, 1.2, 2.0, 1.6)
    for sx in (-1, 1):  # mandibles
        md = rig.head.cube((sx * 1.5 - 0.5, rig.top, rig.skull.origin[2] - 1.5), (1, 2, 2), 0.0, (0, sx * 20, 0), (sx * 1.5, rig.top + 1, rig.skull.origin[2]))
        toon_metal(md, "#e8f8ff")
        crest_ = rig.head.cube((sx * 2.5 - 0.5, rig.top + 7, -2), (1, 3, 5), 0.0, (-25, 0, sx * -20), (sx * 2.5, rig.top + 7, 0))
        toon_metal(crest_, ice_d)
    for bone, sx in ((rig.rarm2, -1), (rig.larm2, 1)):  # the lower pair of arms
        x0 = sx * (4.5 + 1.5) - 1.5
        c = bone.cube((x0, rig.top - 17, -1.5), (3, 11, 3))
        toon_metal(c, ice)
    for limb in rig.arm_l:
        sp = limb.bone.cube((limb.x0 - 0.5, limb.y1 - 3, limb.z0 - 0.5), (int(limb.w + 1), 3, int(limb.d + 1)), 0.3)
        toon_metal(sp, ice_d, "#e8f8ff")
        for k in range(2):
            s_ = limb.bone.cube((limb.x0 + limb.w / 2 - 0.5, limb.y1 + k, -0.5 + k), (1, 2, 1), 0.0, (-30, 0, 0), (limb.x0 + limb.w / 2, limb.y1, 0))
            toon_metal(s_, "#e8f8ff")
    tail_on(rig, [(3, 5, 3, (-55, 0, 0)), (3, 5, 2, (-70, 0, 0)), (2, 5, 2, (-80, 0, 0)), (2, 4, 2, (-85, 0, 0))],
            lambda c, i: toon_metal(c, ice if i % 2 else ice_d, "#e8f8ff"))
    staff(rig, "none", "#5a8ab0", "#e8f8ff", "#e8f8ff", 30)
    h = Hand(rig, rig.weapon, rig.hx - 0.5)
    blade(h.cube((h.x, 26, -8), (1, 6, 4)), "#e8f8ff", "#a8d8f0")
    blade(h.cube((h.x, 30, -4), (1, 5, 1)), "#e8f8ff")
    return rig.m


def eclair():
    """Eclair Ecleir Eicler, the penguin who would rule Nazarick: a waistcoat and a bow tie."""
    m = Model("eclair", bounds=(2, 2, 0.6), res=R)
    root = m.bone("root", (0, 0, 0))
    body = m.bone("body", (0, 6, 0), parent="root")
    b = body.cube((-4, 2, -3.5), (8, 10, 7))
    toon(b, "#1a1a22")
    with paint(b.front) as p:
        p.ellipse(1, 0.5, p.w - 1, p.h, "#f4f3f5")
        p.rect(p.w / 2 - 1.5, 1, p.w / 2 + 1.5, 2, "#c2171d")
    vest = body.cube((-4, 6, -3.5), (8, 5, 7), 0.25)
    toon(vest, "#7a1a1a")
    with paint(vest.front) as p:
        p.clear(2, 0, p.w - 2, p.h)
    hollow(vest)
    head = m.bone("head", (0, 12, 0), parent="body")
    h = head.cube((-3.5, 12, -3), (7, 7, 6))
    toon(h, "#1a1a22")
    with paint(h.front) as p:
        p.ellipse(1, 2, p.w - 1, p.h, "#f4f3f5")
        p.rect(1.5, 3, 2.5, 4, "#1a1418").rect(p.w - 2.5, 3, p.w - 1.5, 4, "#1a1418")
    beak = head.cube((-1, 14, -5), (2, 2, 2))
    toon(beak, "#f0a020")
    for nm, x in (("rightArm", -5), ("leftArm", 4)):
        bone = m.bone(nm, (x + 0.5, 11, 0), parent="body")
        f = bone.cube((x, 4, -2), (1, 7, 4))
        toon(f, "#1a1a22")
    for nm, x in (("rightLeg", -3), ("leftLeg", 1)):
        bone = m.bone(nm, (x + 1, 2, 0), parent="root")
        f = bone.cube((x, 0, -2.5), (2, 2, 3))
        toon(f, "#f0a020")
    return m


# ------------------------------------------------------------------------------------------ the list
def named(name, fn, *a, **k):
    def make():
        return fn(*a, **k)
    make.__name__ = name
    return make


MODELS = [
    named("death_knight", death_knight),
    named("old_guarder", skeleton, "old_guarder", "old_guarder"),
    named("skeleton_archer", skeleton, "skeleton_archer", "archer"),
    named("elder_lich", robed_dead, "elder_lich", "#3a1a5a", GOLD, "#e0202c", "hood", crown_c=GOLD, orb="#c05bff"),
    named("skeleton_mage", robed_dead, "skeleton_mage", "#2a2a3a", "#5a5a7a", "#59d0ff", "hood", orb="#59d0ff"),
    named("wraith", robed_dead, "wraith", "#14121a", "#3a2a4a", "#9fd4ff", "hood", orb="#9fd4ff"),
    named("brain_eater", robed_dead, "brain_eater", "#2a1a3a", "#6a3a8a", "#e0e040", "none", tentacles=True),
    named("death_cavalier", death_cavalier),
    named("ghoul", ghoul),
    named("goblin", goblin),
    named("ogre", brute, "ogre", "#8a8a5a", "#6a4a2a", "club", hair="#3a2a1a"),
    named("war_troll", brute, "war_troll", "#5a7a6a", "#4a4a52", "greatsword", armour="#6a6a72", eyes="#e0202c"),
    named("frost_giant", brute, "frost_giant", "#a8c8e0", "#e8e8f0", "axe", hair="#f4f6fa", beard="#f4f6fa", tusks=False, eyes="#59d0ff"),
    named("go_gin", brute, "go_gin", "#4a6a5a", "#5a1a1a", "greatsword", armour="#3a3a44", horns="#e9e3cf", eyes="#e0202c"),
    named("behemoth", brute, "behemoth", "#7a6a55", "#4f4436", "fists", tusks=True, horns="#d8d0b8", rocky=True, eyes="#ffb040"),
    named("lizardman", reptile, "lizardman", "#4a7a4a", "#c8d8a0", "spear", crest="#c84a2a"),
    named("zaryusu", reptile, "zaryusu", "#3a6a8a", "#c8e0d8", "frost", crest="#e8f8ff"),
    named("beastman", reptile, "beastman", "#c89048", "#f0d8a8", "axe", kind="fur", mane="#8a5a2a", glow="#e0c020"),
    named("bafolk", reptile, "bafolk", "#8a7a66", "#d6cfb6", "mace", kind="fur", horns="#e9e3cf", glow="#e0202c"),
    named("buser", reptile, "buser", "#5a4a3a", "#a89880", "greatsword", kind="fur", mane="#2a1a1a", armour="#3a3a44", horns="#d8d0b8", glow="#e0202c"),
    named("quagoa", quagoa, "quagoa"),
    named("quagoa_warlord", quagoa, "quagoa_warlord", True),
    named("shadow_demon", demon, "shadow_demon", "#14121a", None, "#e0202c", "bat", "#2a2230", "none"),
    named("evil_lord_wrath", demon, "evil_lord_wrath", "#5a1418", "#2a1a1a", "#ff5a1a", "bat", "#1a1010", "flame"),
    named("evil_lord_envy", demon, "evil_lord_envy", "#1a3a2a", "#2a3a2a", "#63ff6b", "bat", "#1a2a1a", "scythe"),
    named("evil_lord_greed", demon, "evil_lord_greed", "#5a4a1a", GOLD_D, "#ffd23d", "bat", "#3a2a10", "flame"),
    named("jaldabaoth", demon, "jaldabaoth", "#2a1a1a", None, "#ff5a1a", "bat", "#1a1010", "flame", True, "#5a1418"),
    named("archangel_flame", angel, "archangel_flame", "#f4f1ea", "#f4f1ea", "#ff8a1a", "flame", True),
    named("dominion_authority", angel, "dominion_authority", "#e8e4ec", "#5a3a8a", "#ffe48a", "scepter", False),
    named("gargantua", golem, "gargantua", "#8a8478", "#59d0ff", moss="#5f8a3a", legs=11),
    named("rune_golem", golem, "rune_golem", "#7a6a5a", "#ffb040", metal=True, legs=13),
    named("treant_sapling", treant, "treant_sapling", "#5a3e26", "#5f8a3a"),
    named("zytl_qae", treant, "zytl_qae", "#3a2a2a", "#4a3a5a", "#c05bff", True),
    named("hamsuke", hamsuke),
    named("soul_eater", quadruped, "soul_eater", "#1c2026", "horse", "#59e0c8", BONE),
    named("hellhound", quadruped, "hellhound", "#1a1416", "dog", "#ff5a1a"),
    named("gigant_basilisk", quadruped, "gigant_basilisk", "#3f5a2a", "lizard", "#f2e21b", "#7a8a4a"),
    named("dark_young", quadruped, "dark_young", "#0c0b10", "goat", "#c05bff"),
    named("eight_edge_assassin", quadruped, "eight_edge_assassin", "#1a1622", "insect", "#e0202c"),
    named("cocytus", cocytus),
    named("eclair", eclair),
]
