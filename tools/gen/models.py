"""Entity models + textures for the Overlord add-on (all art is original)."""
from __future__ import annotations

import random

from modelkit import Model, shade, mix

BONE, BONE_D, BONE_DD = "#e9e3cf", "#bdb496", "#8d8468"
GOLD, GOLD_L, GOLD_D = "#d9a92b", "#f6d968", "#96701a"
BLACK = "#121016"


def art(face, rows, pal, ox=0, oy=0):
    for line in rows:
        assert len(line) + ox <= face.w, (rows, face.w)
    assert len(rows) + oy <= face.h, (rows, face.h)
    face.rows(rows, pal, ox, oy)


def stripes(cube, color, every=3, start=2):
    """Horizontal segment lines on the four side faces."""
    h = cube.size[1]
    for y in range(start, h, every):
        cube.band(y, y + 1, color)


def trim(face, color):
    face.border(color)


# --------------------------------------------------------------------- Ainz
def ainz():
    m = Model("ainz", bounds=(3.5, 4.5, 1.5))
    robe, robe_l, robe_d = "#2b1a3d", "#412a5c", "#1c1029"
    red, red_l = "#b3141c", "#ff5a4d"
    pal = {"B": BONE, "b": BONE_D, "d": "#191320", "K": "#0b090d", "R": red, "r": red_l,
           "P": robe, "p": robe_l, "G": GOLD, "g": GOLD_D, "L": GOLD_L, "T": "#d6cfb6", "t": "#7f7758"}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(robe)
    art(torso.front, [
        "PGdBBdGP",
        "PGBBBBGP",
        "PGdBBdGP",
        "PGBBBBGP",
        "PGdBBdGP",
        "PGBBBBGP",
        "PGdRRdGP",
        "PGRrrRGP",
        "PGdRRdGP",
        "PGddddGP",
        "gGGLLGGg",
        "PPgGGgPP",
    ], pal)
    torso.back.vline(0, GOLD_D).vline(-1, GOLD_D)
    torso.band(10, 11, GOLD_D)
    art(torso.front, ["gGGLLGGg"], pal, 0, 10)

    collar = body.cube((-6, 21, 2), (12, 12, 2))
    collar.fill(robe_l)
    for f in (collar.front, collar.back):
        trim(f, GOLD)
    collar.front.fill(robe_d, 2, 2, 10, 12)
    collar.top.fill(GOLD)
    art(collar.back, ["..GG..", ".GrrG.", ".GrrG.", "..GG.."], pal, 3, 4)

    for side, x in (("right", -12), ("left", 5)):
        pad = body.cube((x, 20, -3), (7, 5, 6))
        pad.fill(robe_l)
        for f in pad.faces:
            trim(f, GOLD)
        art(pad.front, ["LrL"], pal, 2, 2)
        art(pad.top, ["GLG", "LrL", "GLG"], pal, 2, 1)
        horn = body.cube((x + (1 if side == "right" else 4), 25, -1), (2, 4, 2))
        horn.fill(BONE)
        horn.band(3, 4, BONE_D)
        horn.band(0, 1, "#fbf8ee")

    skirt = m.bone("robe", (0, 12, 0), parent="body").cube((-5, 0, -3), (10, 12, 6))
    skirt.fill(robe)
    for f in skirt.sides:
        f.vshade(1.05, 0.8)
    skirt.band(10, 11, GOLD)
    skirt.band(11, 12, GOLD_D)
    skirt.front.fill(robe_l, 4, 0, 6, 10).vline(3, GOLD_D, 0, 10).vline(6, GOLD_D, 0, 10)
    art(skirt.front, ["Gr", "rG"], pal, 4, 3)

    head = m.bone("head", (0, 24, 0), parent="body")
    skull = head.cube((-4, 24, -4), (8, 8, 8))
    skull.fill(BONE, noise=4)
    art(skull.front, [
        "BBBBBBBB",
        "BBBBBBBB",
        "bBBBBBBb",
        "BKKBBKKB",
        "BKrBBrKB",
        "bBBKKBBb",
        "bTtTtTtb",
        ".bTtTtb.",
    ], pal)
    for f in (skull.right, skull.left):
        art(f, ["........", "........", "........", "..bb....", ".bddb...", "..bb....", "bbbbbb..", ".bbbb..."], pal)
    skull.back.fill(BONE_D, 1, 6, 7, 8)

    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(robe)
        for f in arm.sides:
            f.vshade(1.0, 0.85)
        arm.band(8, 9, GOLD)
        arm.band(9, 10, GOLD_D)
        arm.band(10, 12, BONE)
        for f in arm.sides:
            f.vline(1, BONE_DD, 10, 12)
        arm.bottom.fill(BONE_D)

    staff = m.bone("staff", (-6, 13, -3), parent="rightArm")
    shaft = staff.cube((-6.5, 1, -3.5), (1, 33, 1))
    shaft.fill(GOLD, noise=3)
    stripes(shaft, GOLD_D, every=4, start=3)
    crown = staff.cube((-8, 33, -5), (4, 2, 4))
    crown.fill(GOLD_D)
    crown.band(0, 1, GOLD_L)
    top = staff.cube((-7.5, 35, -4.5), (3, 4, 3))
    top.fill(GOLD)
    gems = ["#ff4b3e", "#3ed0ff", "#63ff6b", "#c05bff"]
    for f, g in zip(top.sides, gems):
        f.px(1, 1, g)
        f.px(1, 2, shade(g, 0.7))
        f.px(0, 0, GOLD_L)
        f.px(2, 0, GOLD_L)
    top.top.fill(GOLD_L).px(1, 1, "#ffe14d")
    orb = staff.cube((-6.5, 39, -3.5), (1, 1, 1))
    orb.fill("#ff3b30", noise=0)
    return m


# -------------------------------------------------------------- Elder Lich
def elder_lich():
    return _lich()


def skeleton_mage():
    return _lich("skeleton_mage", "#22335c", "#34497a", "#141f3a", "#8a8fa8", "#59d0ff")


def _lich(name="elder_lich", robe="#4a2020", robe_l="#643030", robe_d="#2e1212", trim_c="#8a6d2b",
          eye="#b6ff4a"):
    m = Model(name, bounds=(3, 4, 1.25))
    pal = {"B": "#d8d0b4", "b": "#a59c7e", "d": "#140d0d", "K": "#080606", "Y": eye,
           "P": robe, "p": robe_l, "G": trim_c, "T": "#c9c1a4", "t": "#6e664c", "H": robe_d}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(robe)
    art(torso.front, [
        "PPdBBdPP",
        "PGBBBBGP",
        "PGdBBdGP",
        "PGBBBBGP",
        "PGdBBdGP",
        "PPGBBGPP",
        "PPPGGPPP",
        "PPPPPPPP",
        "PPPPPPPP",
        "GGGGGGGG",
        "PPPPPPPP",
        "PPPPPPPP",
    ], pal)
    torso.band(9, 10, trim_c)

    skirt = m.bone("robe", (0, 12, 0), parent="body").cube((-5, 0, -3), (10, 12, 6))
    skirt.fill(robe)
    for i, f in enumerate(skirt.sides):
        f.vshade(1.0, 0.7)
        f.ragged_bottom(3, seed=11 + i)
    skirt.front.vline(4, robe_d).vline(5, robe_l)

    head = m.bone("head", (0, 24, 0), parent="body")
    skull = head.cube((-4, 24, -4), (8, 8, 8))
    skull.fill("#d8d0b4", noise=5)
    art(skull.front, [
        "BBBBBBBB",
        "BBBBBBBB",
        "bBBBBBBb",
        "BKKBBKKB",
        "BKYBBYKB",
        "bBBKKBBb",
        "bTtTtTtb",
        ".bTtTtb.",
    ], pal)
    hood = head.cube((-4, 24, -4), (8, 8, 8), inflate=0.75)
    hood.fill(robe)
    hood.front.fill(None, 1, 2, 7, 8)
    hood.front.hline(1, robe_d)
    hood.bottom.fill(None)
    for f in (hood.right, hood.left, hood.back):
        f.vshade(1.05, 0.8)
        f.hline(7, trim_c)

    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(robe)
        for i, f in enumerate(arm.sides):
            f.vshade(1.0, 0.8)
        arm.band(8, 9, trim_c)
        arm.band(9, 12, "#d8d0b4")
        for f in arm.sides:
            f.vline(1, "#6e664c", 9, 12)
            f.vline(3, "#a59c7e", 9, 12)

    staff = m.bone("staff", (-6, 13, -3), parent="rightArm")
    shaft = staff.cube((-6.5, 1, -3.5), (1, 30, 1))
    shaft.fill("#5b3d22", noise=6)
    stripes(shaft, "#3c2714", every=5, start=2)
    claw = staff.cube((-7.5, 31, -4.5), (3, 2, 3))
    claw.fill("#3c2714")
    orb = staff.cube((-7, 33, -4), (2, 2, 2))
    orb.fill("#9b3bff", noise=0)
    orb.front.px(0, 0, "#e3c2ff")
    orb.top.px(0, 0, "#e3c2ff")
    return m


# ------------------------------------------------------------------ Albedo
def albedo():
    m = Model("albedo", bounds=(4, 4, 1.25))
    skin, skin_d = "#f3d9c6", "#d9b59e"
    hair, hair_l = "#17141d", "#2c2738"
    white, white_d = "#f1eff0", "#cfcbd2"
    horn = "#f4f0e2"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_l, "W": white, "w": white_d,
           "Y": "#f2c21b", "E": "#fbfbfb", "m": "#c9606f", "G": GOLD, "g": GOLD_D,
           "N": "#1b3327", "n": "#2f5b43", "e": "#8fe0ae", "K": "#101015"}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(white)
    art(torso.front, [
        "SSSSSSSS",
        "WSSSSSSW",
        "WWSGGSWW",
        "WWGWWGWW",
        "WGWWWWGW",
        "WWGWWGWW",
        "WWWGGWWW",
        "WWWWWWWW",
        "wWWWWWWw",
        "GwWWWWwG",
        "wGGGGGGw",
        "wwWWWWww",
    ], pal)
    torso.band(0, 1, skin)
    torso.band(10, 11, GOLD)
    torso.back.fill(skin, 1, 1, 7, 5)  # open back of the dress
    torso.top.fill(skin)

    skirt = m.bone("robe", (0, 12, 0), parent="body").cube((-5, 0, -3), (10, 12, 6))
    skirt.fill(white)
    for f in skirt.sides:
        f.vshade(1.0, 0.86)
        for x in range(1, f.w, 3):
            f.vline(x, white_d, 2, 10)
    skirt.band(10, 11, GOLD)
    skirt.band(11, 12, white_d)

    hair_back = body.cube((-4, 12, 2), (8, 12, 1))
    hair_back.fill(hair)
    for x in (1, 4, 6):
        hair_back.back.vline(x, hair_l, 0, 11)
    hair_back.back.ragged_bottom(2, seed=5)

    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(hair, noise=4)
    art(hd.front, [
        "HHHHHHHH",
        "HHhHHhHH",
        "HSSHHSSH",
        "HSSSSSSH",
        "SEYSSYES",
        "SSSSSSSS",
        "HSSmmSSH",
        "HHSSSSHH",
    ], pal)
    for f in (hd.right, hd.left, hd.back):
        for x in (1, 4, 6):
            f.vline(x, hair_l, 1, 8)
    hd.bottom.fill(skin_d)
    for sx in (-6, 4):
        base = head.cube((sx, 27, -2), (2, 3, 3))
        base.fill(horn)
        tip = head.cube((sx, 28, -6), (2, 2, 4))
        tip.fill(horn)
        tip.front.fill("#d9d2bb")
        base.band(2, 3, "#d9d2bb")

    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(skin)
        arm.band(5, 6, GOLD)
        arm.band(6, 12, white)
        for f in arm.sides:
            f.vshade(1.0, 0.92)
        arm.bottom.fill(white_d)
        arm.top.fill(skin)

    for name, x, pivot, ry, outer_left in (("rightWing", -15, (-3, 16, 2), 32, True),
                                           ("leftWing", 3, (3, 16, 2), -32, False)):
        wing = m.bone(name, pivot, parent="body", rotation=(0, ry, 0)).cube((x, 4, 2), (12, 15, 1))
        wing.fill(None, noise=0)
        for f, flip in ((wing.front, not outer_left), (wing.back, outer_left)):
            for xx in range(12):
                d = 11 - xx if flip else xx          # 0 = outer tip, 11 = root at the body
                top = max(0, 4 - d) + (1 if d > 9 else 0)
                bottom = 14 - (2, 0, 1)[d % 3] - max(0, 3 - d)
                for yy in range(top, bottom + 1):
                    feather_edge = (yy + d * 2) % 4 == 0 or yy == bottom
                    f.px(xx, yy, hair_l if feather_edge else hair)
                f.px(xx, top, "#3d3650")
            f.noise(3, 9)
    weapon = m.bone("weapon", (-6, 13, -3), parent="rightArm")
    shaft = weapon.cube((-6.5, 1, -3.5), (1, 34, 1))
    shaft.fill("#1c1b22", noise=3)
    stripes(shaft, "#3a5a48", every=6, start=4)
    blade = weapon.cube((-6.5, 25, -9.5), (1, 10, 6))
    blade_art = [
        "..enNN",
        ".ennNN",
        "ennnNN",
        "ennnNN",
        "ennnNK",
        "ennnNK",
        "ennnNN",
        ".ennNN",
        "..enNN",
        "...eNN",
    ]
    blade.fill(None, noise=0)
    art(blade.left, blade_art, pal | {".": None})
    art(blade.right, [row[::-1] for row in blade_art], pal | {".": None})
    blade.back.fill("#1b3327")
    blade.front.fill("#8fe0ae", 0, 2, 1, 7)
    return m


# --------------------------------------------------------------- Shalltear
def shalltear():
    m = Model("shalltear", bounds=(3, 4, 1.25))
    skin, skin_d = "#f6e6e2", "#dcc3c0"
    hair, hair_d = "#dfe0ee", "#b3b5cc"
    red, red_l, red_d = "#a3121f", "#d43a44", "#6a0a13"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_d, "R": red, "r": red_l, "D": red_d,
           "G": GOLD, "g": GOLD_D, "W": "#f7f4f1", "E": "#ffffff", "e": "#e0202c",
           "m": "#b84a5a", "K": "#2a0a0e"}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(red)
    art(torso.front, [
        "RRGWWGRR",
        "RrRGGRrR",
        "RrrRRrrR",
        "RDrrrrDR",
        "RRDrrDRR",
        "RRRDDRRR",
        "DRRRRRRD",
        "RDRRRRDR",
        "GRRRRRRG",
        "gGGGGGGg",
        "RRRGGRRR",
        "DRRRRRRD",
    ], pal)
    torso.band(9, 10, GOLD_D)
    torso.back.vline(3, red_d, 0, 9).vline(4, red_l, 0, 9)

    tasset = body.cube((-5, 7, -3), (10, 6, 6))
    tasset.fill(red)
    for f in tasset.sides:
        f.vshade(1.05, 0.85)
        f.hline(5, GOLD)
        for x in range(2, f.w, 3):
            f.vline(x, red_d, 0, 5)
    tasset.bottom.fill(None)
    tasset.top.fill(red_d)

    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(hair, noise=4)
    art(hd.front, [
        "RRRRRRRR",
        "RGRrrRGR",
        "HHhHHhHH",
        "HSSHHSSH",
        "SEeSSeES",
        "SSSSSSSS",
        "HSSmmSSH",
        "HhSSSShH",
    ], pal)
    for f in (hd.right, hd.left, hd.back):
        f.fill(red, 0, 0, None, 2)
        f.hline(1, GOLD_D)
        for x in (2, 5):
            f.vline(x, hair_d, 2, 8)
    hd.top.fill(red).border(GOLD_D)
    hd.bottom.fill(skin_d)
    for sx in (-5, 4):
        wing = head.cube((sx, 28, -1), (1, 5, 5))
        wing.fill("#f7f4f1")
        fart = ["WWWW.", "WWWWW", "wWWWW", ".wWWW", "..wWW"]
        wpal = {"W": "#f7f4f1", "w": "#cfc9c4", ".": None}
        art(wing.left, fart, wpal)
        art(wing.right, [r[::-1] for r in fart], wpal)
    tail = head.cube((-1, 15, 4), (2, 11, 2))
    tail.fill(hair)
    tail.band(0, 1, red)
    for f in tail.sides:
        f.vshade(1.0, 0.85)

    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        bone = m.bone(name, (px, 22, 0), parent="body")
        arm = bone.cube((x, 12, -2), (4, 12, 4))
        arm.fill(red)
        arm.band(4, 5, red_d)
        arm.band(7, 8, GOLD_D)
        arm.band(10, 12, red_d)
        for f in arm.sides:
            f.vshade(1.0, 0.88)
        pad = bone.cube((x - (1 if x < 0 else 0), 21, -3), (5, 4, 6))
        pad.fill(red_l)
        for f in pad.faces:
            trim(f, GOLD)

    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill(red)
        leg.band(5, 6, GOLD)
        leg.band(6, 7, red_d)
        leg.band(10, 12, red_d)
        for f in leg.sides:
            f.vshade(1.0, 0.88)

    lance = m.bone("weapon", (-6, 13, -3), parent="rightArm")
    grip = lance.cube((-6.5, 3, -3.5), (1, 10, 1))
    grip.fill("#2a0a0e", noise=2)
    guard = lance.cube((-8, 13, -5), (4, 2, 4))
    guard.fill(GOLD)
    guard.band(1, 2, GOLD_D)
    lower = lance.cube((-7.5, 15, -4.5), (3, 8, 3))
    lower.fill("#7d1220")
    mid = lance.cube((-7, 23, -4), (2, 8, 2))
    mid.fill("#b3202f")
    tip = lance.cube((-6.5, 31, -3.5), (1, 7, 1))
    tip.fill("#f2e3e3", noise=2)
    for c in (lower, mid):
        for f in c.sides:
            f.vline(0, "#e9c9c9")
            f.vshade(1.1, 0.9)
    return m


# ----------------------------------------------------------------- Cocytus
def cocytus():
    m = Model("cocytus", bounds=(4, 4.5, 1.5))
    ice, ice_l, ice_d, deep = "#9fd4ef", "#d8f2ff", "#5f9fc6", "#2f5f8c"
    pal = {"L": ice, "l": ice_l, "D": ice_d, "X": deep, "E": "#e9fbff", "e": "#56e0ff", "K": "#16324d"}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-5, 12, -3), (10, 12, 6))
    torso.fill(ice)
    art(torso.front, [
        "DLLLLLLLLD",
        "LlllLLlllL",
        "LlllLLlllL",
        "LLllDDllLL",
        "DLLLDDLLLD",
        "XDLLLLLLDX",
        "LLDDDDDDLL",
        "LLlLLLLlLL",
        "DLLlLLlLLD",
        "XDLLLLLLDX",
        "XXDDDDDDXX",
        "XXXDDDDXXX",
    ], pal)
    for f in (torso.right, torso.left, torso.back):
        for y in (3, 6, 9):
            f.hline(y, ice_d)
        f.vshade(1.05, 0.85)
    for sx in (-4, 2):
        spike = body.cube((sx, 20, 3), (2, 3, 4))
        spike.fill(ice_l)
        spike.back.fill("#ffffff")
    crest = body.cube((-1, 14, 3), (2, 4, 3))
    crest.fill(ice_l)

    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(ice, noise=4)
    art(hd.front, [
        "DLLLLLLD",
        "LLlLLlLL",
        "LKKLLKKL",
        "LKeLLeKL",
        "LLLllLLL",
        "DeLLLLeD",
        "LDDXXDDL",
        "XDLXXLDX",
    ], pal)
    for f in (hd.right, hd.left):
        art(f, ["........", "........", "..KK....", "..eK....", "........", "DD......", "........", "XX......"], pal)
        f.vshade(1.0, 0.9)
    hd.back.hline(3, ice_d).hline(6, ice_d)
    for sx in (-3, 1):
        mand = head.cube((sx, 23, -6), (2, 3, 2))
        mand.fill(ice_d)
        mand.band(2, 3, "#ffffff")
    for sx in (-4, 2):
        horn = head.cube((sx, 32, -1), (2, 4, 2))
        horn.fill(ice_l)
        horn.band(0, 1, "#ffffff")

    for name, x, px in (("rightArm", -9, -6), ("leftArm", 5, 6)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(ice)
        stripes(arm, ice_d, every=4, start=3)
        arm.band(10, 12, deep)
        for f in arm.sides:
            f.vshade(1.05, 0.88)
    for name, x, px, rz in (("rightArm2", -8, -5, 22), ("leftArm2", 5, 5, -22)):
        arm = m.bone(name, (px, 16, -1), parent="body", rotation=(-20, 0, rz)).cube((x, 5, -2.5), (3, 11, 3))
        arm.fill(ice_d)
        stripes(arm, deep, every=4, start=3)
        arm.band(9, 11, deep)

    for name, x, px in (("rightLeg", -5, -2.5), ("leftLeg", 0, 2.5)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2.5), (5, 12, 5))
        leg.fill(ice)
        stripes(leg, ice_d, every=4, start=3)
        leg.band(10, 12, deep)
        for f in leg.sides:
            f.vshade(1.05, 0.85)

    tail = m.bone("tail", (0, 13, 3), parent="body", rotation=(-25, 0, 0))
    t1 = tail.cube((-2, 10, 3), (4, 4, 7))
    t1.fill(ice)
    t2 = tail.cube((-1.5, 10.5, 10), (3, 3, 6))
    t2.fill(ice_d)
    t3 = tail.cube((-1, 11, 16), (2, 2, 4))
    t3.fill(ice_l)
    for c in (t1, t2):
        for f in (c.right, c.left, c.top):
            for x in range(2, f.w, 3):
                f.vline(x, deep)

    sword = m.bone("weapon", (-7, 13, -2), parent="rightArm")
    grip = sword.cube((-7.5, 12.5, -5), (1, 1, 3))
    grip.fill("#20283a", noise=2)
    guard = sword.cube((-8.5, 11.5, -6), (3, 3, 1))
    guard.fill(GOLD)
    blade = sword.cube((-7.5, 12, -24), (1, 2, 18))
    blade.fill("#eaf7ff", noise=3)
    for f in (blade.right, blade.left):
        f.hline(1, "#9fd4ef")
    blade.front.fill("#ffffff")
    return m


# ---------------------------------------------------------------- Demiurge
def demiurge():
    m = Model("demiurge", bounds=(3, 3.5, 1.25))
    skin, skin_d = "#d9a57c", "#b9855f"
    hair, hair_l = "#15131a", "#2b2836"
    suit, suit_l, suit_d = "#b8402a", "#d4654a", "#832818"
    metal, metal_d = "#b9c0cc", "#7c8494"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_l, "F": "#3a3a44", "g": "#dff3ff",
           "m": "#7a3a2e", "O": suit, "o": suit_l, "D": suit_d, "W": "#f2f0ee", "T": "#2a2230",
           "K": "#16141a"}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(suit)
    art(torso.front, [
        "OoDWWDoO",
        "OoDWTDoO",
        "OoODTOoO",
        "OoODTOoO",
        "OoOODOoO",
        "OoOODOoO",
        "OoOKDOoO",
        "OoOODOoO",
        "OoOKDOoO",
        "OoOODOoO",
        "DDDDDDDD",
        "OoOOOOoO",
    ], pal)
    for f in (torso.right, torso.left, torso.back):
        for x in range(1, f.w, 2):
            f.vline(x, suit_l)
        f.hline(10, suit_d)

    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(skin, noise=3)
    art(hd.front, [
        "HHHHHHHH",
        "HhHHHHhH",
        "HSSSSSSH",
        "SSSSSSSS",
        "FggFFggF",
        "SFFSSFFS",
        "SSmmmmSS",
        "SSSSSSSS",
    ], pal)
    for f in (hd.right, hd.left):
        f.fill(hair, 0, 0, None, 4)
        f.fill(hair, 0, 4, 5, 6)
        f.vline(2, hair_l, 0, 4)
    hd.left.fill(skin, 0, 4, 3, 6)
    hd.left.fill(hair, 3, 4, 8, 6)
    hd.back.fill(hair, 0, 0, None, 7)
    hd.top.fill(hair)
    for x in (2, 5):
        hd.top.vline(x, hair_l)
    for sx in (-5, 4):
        ear = head.cube((sx, 27, 0), (1, 4, 2))
        ear.fill(skin)
        ear.band(0, 1, skin_d)

    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(suit)
        for f in arm.sides:
            for xx in range(1, f.w, 2):
                f.vline(xx, suit_l)
        arm.band(9, 10, "#f2f0ee")
        arm.band(10, 12, hair)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill(suit)
        for f in leg.sides:
            for xx in range(1, f.w, 2):
                f.vline(xx, suit_l)
            f.vshade(1.0, 0.9)
        leg.band(10, 12, hair)

    tail = m.bone("tail", (0, 13, 2), parent="body", rotation=(20, 0, 0))
    t1 = tail.cube((-1, 12, 2), (2, 2, 9))
    t1.fill(metal)
    for f in (t1.right, t1.left, t1.top):
        for x in range(1, f.w, 2):
            f.vline(x, metal_d)
    t2 = tail.cube((-2, 11, 11), (4, 4, 3))
    t2.fill(metal_d)
    for f in t2.faces:
        f.px(f.w // 2, f.h // 2, "#ffffff")
    return m


# ------------------------------------------------------------------- Sebas
def sebas():
    m = Model("sebas", bounds=(3, 3.5, 1.25))
    skin, skin_d = "#e3b997", "#c0946f"
    white, white_d = "#f3f3f1", "#c9c9cc"
    coat, coat_l = "#1a1a21", "#2f2f3a"
    pal = {"S": skin, "s": skin_d, "W": white, "w": white_d, "K": coat, "k": coat_l,
           "e": "#22303f", "G": "#c9c9cc"}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(coat)
    art(torso.front, [
        "KkWWWWkK",
        "KkWKKWkK",
        "KKkWWkKK",
        "KKkWWkKK",
        "KKKkWKKK",
        "KKKGWKKK",
        "KKKkWKKK",
        "KKKGWKKK",
        "KKKkkKKK",
        "KKKKKKKK",
        "kkkkkkkk",
        "KKKKKKKK",
    ], pal)
    tails = body.cube((-4, 4, 2), (8, 8, 1))
    tails.fill(coat)
    tails.back.vline(3, coat_l).vline(4, None, 3, 8)
    tails.front.vline(4, None, 3, 8)

    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(skin, noise=3)
    art(hd.front, [
        "WWWWWWWW",
        "WwWWWWwW",
        "WSSSSSSW",
        "SWWSSWWS",
        "SeSSSSeS",
        "SSSssSSS",
        "wWWWWWWw",
        "WWwWWwWW",
    ], pal)
    for f in (hd.right, hd.left):
        f.fill(white, 0, 0, None, 3)
        f.fill(white, 0, 6, None, 8)
    hd.right.fill(white, 0, 3, 5, 6)
    hd.left.fill(white, 3, 3, 8, 6)
    hd.back.fill(white, 0, 0, None, 7)
    hd.top.fill(white)
    for x in (1, 4, 6):
        hd.top.vline(x, white_d)
        hd.back.vline(x, white_d, 0, 7)

    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(coat)
        arm.band(9, 10, white_d)
        arm.band(10, 12, white)
        for f in arm.sides:
            f.vline(0, coat_l, 0, 9)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill(coat)
        for f in leg.sides:
            f.vline(1, coat_l, 0, 10)
        leg.band(10, 12, "#0c0c10")
    return m


# ------------------------------------------------------------ Death Knight
def death_knight():
    m = Model("death_knight", bounds=(4, 4.5, 1.5))
    arm_c, arm_l, arm_d = "#1c1a22", "#34303e", "#0e0d12"
    vein, vein_l = "#b3141c", "#ff4d3d"
    pal = {"K": arm_c, "k": arm_l, "D": arm_d, "R": vein, "r": vein_l, "B": BONE, "b": BONE_D,
           "T": "#d6cfb6", "t": "#6f684e", "N": "#060507", "S": "#8e96a6", "s": "#c9d1df", "W": "#5b606c"}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-5, 12, -3), (10, 12, 6))
    torso.fill(arm_c)
    art(torso.front, [
        "kKKKRRKKKk",
        "KkKRKKRKkK",
        "KKRKBBKRKK",
        "KRKBNNBKRK",
        "KRKBBBBKRK",
        "KKRKTTKRKK",
        "DKKRKKRKKD",
        "DKKKRRKKKD",
        "kkkkkkkkkk",
        "DKRKKKKRKD",
        "DKKRKKRKKD",
        "DDKKRRKKDD",
    ], pal)
    for f in (torso.right, torso.left, torso.back):
        f.hline(8, arm_l)
        f.vshade(1.05, 0.85)
    torso.back.vline(4, vein, 0, 8).vline(5, vein, 0, 8)

    cape = body.cube((-5, 1, 3), (10, 22, 1))
    cape.fill("#3a0d12")
    for f in (cape.front, cape.back):
        f.vshade(1.0, 0.7)
        for x in (2, 5, 8):
            f.vline(x, "#24080b", 2, 22)
        f.ragged_bottom(5, seed=3)
    cape.bottom.fill(None)

    for sx in (-12, 5):
        pad = body.cube((sx, 20, -4), (7, 5, 8))
        pad.fill(arm_l)
        for f in pad.faces:
            trim(f, arm_d)
        pad.front.px(3, 2, vein_l)
        pad.top.fill(vein, 2, 3, 5, 5)
        spike = body.cube((sx + 2, 25, -1), (2, 3, 2))
        spike.fill(BONE_D)
        spike.band(0, 1, BONE)

    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(arm_c, noise=4)
    art(hd.front, [
        "KKKRRKKK",
        "KkKKKKkK",
        "KBBBBBBK",
        "KNrBBrNK",
        "KBBNNBBK",
        "KTtTtTtK",
        "DKTtTtKD",
        "DDKKKKDD",
    ], pal)
    for f in (hd.right, hd.left, hd.back):
        f.hline(2, arm_l)
        f.vshade(1.05, 0.85)
    hd.top.vline(3, vein).vline(4, vein)
    for sx in (-6, 4):
        base = head.cube((sx, 29, -1), (2, 2, 2))
        base.fill(arm_l)
        up = head.cube((sx + (-1 if sx < 0 else 1), 31, -1), (2, 5, 2))
        up.fill(BONE_D)
        up.band(0, 2, BONE)

    for name, x, px in (("rightArm", -9, -7), ("leftArm", 5, 7)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(arm_c)
        arm.band(5, 6, arm_l)
        arm.band(9, 10, vein)
        arm.band(10, 12, arm_d)
        for f in arm.sides:
            f.vline(1, vein, 1, 5)
    for name, x, px in (("rightLeg", -5, -2.5), ("leftLeg", 0, 2.5)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2.5), (5, 12, 5))
        leg.fill(arm_c)
        leg.band(4, 5, arm_l)
        leg.band(5, 6, vein)
        leg.band(10, 12, arm_d)
        for f in leg.sides:
            f.vshade(1.05, 0.85)

    shield = m.bone("shield", (7, 14, -3), parent="leftArm").cube((2, 5, -4.5), (10, 18, 1))
    shield.fill(arm_c)
    art(shield.front, [
        "DkkkkkkkkD",
        "kKKKKKKKKk",
        "kKKKRRKKKk",
        "kKKRKKRKKk",
        "kKRKBBKRKk",
        "kKRBNNBRKk",
        "kKRBBBBRKk",
        "kKKRTTRKKk",
        "kKKKRRKKKk",
        "kKRKKKKRKk",
        "kKKRKKRKKk",
        "kKKKRRKKKk",
        "kKKKRRKKKk",
        "kKKKKKKKKk",
        "DkKKKKKKkD",
        ".DkKKKKkD.",
        "..DkKKkD..",
        "...DkkD...",
    ], pal | {".": None})
    shield.back.fill(arm_d)
    art(shield.back, [".........." for _ in range(15)] + ["K........K", "KK......KK", "KKK....KKK"],
        {"K": None})

    sword = m.bone("weapon", (-7, 13, -2), parent="rightArm")
    grip = sword.cube((-7.5, 12.5, -5), (1, 1, 3))
    grip.fill("#3a0d12", noise=2)
    guard = sword.cube((-9.5, 12, -6), (5, 2, 1))
    guard.fill(arm_l)
    guard.front.px(2, 0, vein_l)
    blade = sword.cube((-7.5, 11, -26), (1, 4, 20))
    blade.fill(None, noise=0)
    wave = [
        "..ssssssssssssssss..",
        ".sSSSSSSSSSSSSSSSSss",
        "sSWSSWSSWSSWSSWSSWSs",
        ".s.ss.ss.ss.ss.ss.s.",
    ]
    art(blade.right, wave, pal | {".": None})
    art(blade.left, [r[::-1] for r in wave], pal | {".": None})
    blade.top.fill("#c9d1df")
    return m


# ----------------------------------------------------------------- Hamsuke
def hamsuke():
    m = Model("hamsuke", bounds=(3.5, 3, 0.8))
    fur, fur_d, belly = "#dcdee6", "#a4a8b8", "#f6f6f8"
    scale_c, scale_d = "#6f9468", "#4a6b47"
    pal = {"F": fur, "f": fur_d, "W": belly, "K": "#0d0d12", "k": "#3c3c48", "P": "#e89aa8",
           "p": "#c8707f", "w": "#ffffff", "R": "#7d8296"}

    body = m.bone("body", (0, 9, 0))
    b = body.cube((-7, 3, -8), (14, 12, 17))
    b.fill(fur, noise=6)
    b.bottom.fill(belly)
    for f in (b.right, b.left):
        f.fill(belly, 0, 9, None, 12)
        f.noise(5, 3)
        art(f, ["R.R...R..R.", ".R.R.R.R.R.", "R...R...R.."], pal, 3, 3)  # rune markings
    b.top.fill(fur_d, 5, 0, 9, 17)
    b.top.noise(6, 4)
    b.back.fill(fur_d, 5, 0, 9, 6)
    b.front.fill(belly, 2, 7, 12, 12)

    head = m.bone("head", (0, 9, -8), parent="body")
    h = head.cube((-5, 4, -14), (10, 9, 6))
    h.fill(fur, noise=5)
    art(h.front, [
        "FFFffffFFF",
        "FFFFffFFFF",
        "FKwFFFFwKF",
        "FKKFFFFKKF",
        "FFFFPPFFFF",
        "WWWWppWWWW",
        "WWWkWWkWWW",
        "WWWWkkWWWW",
        "FWWWWWWWWF",
    ], pal)
    h.top.fill(fur_d, 3, 0, 7, 6)
    for f in (h.right, h.left):
        f.fill(belly, 0, 5, None, 9)
    for sx in (-5, 2):
        ear = head.cube((sx, 12, -11), (3, 3, 1))
        ear.fill(fur_d)
        ear.front.fill("#e89aa8", 1, 1, 2, 3)

    for name, x, z in (("leg0", -6, -6), ("leg1", 3, -6), ("leg2", -6, 5), ("leg3", 3, 5)):
        leg = m.bone(name, (x + 1.5, 3, z + 1.5), parent="body").cube((x, 0, z), (3, 4, 3))
        leg.fill(fur_d)
        leg.band(3, 4, "#e89aa8")

    tail = m.bone("tail", (0, 8, 9), parent="body")
    t1 = tail.cube((-1, 7, 9), (2, 2, 8))
    t2 = m.bone("tail2", (0, 8, 17), parent="tail").cube((-1, 7, 17), (2, 2, 8))
    t3 = m.bone("tail3", (0, 8, 25), parent="tail2").cube((-0.5, 7.5, 25), (1, 1, 5))
    for c in (t1, t2, t3):
        c.fill(scale_c, noise=4)
        for f in (c.right, c.left, c.top, c.bottom):
            for x in range(1, f.w, 2):
                f.vline(x, scale_d)
    return m


# -------------------------------------------------------------- Projectiles
def fireball():
    m = Model("fireball", bounds=(1, 1, 0.25))
    body = m.bone("body", (0, 3, 0))
    c = body.cube((-3, 0, -3), (6, 6, 6))
    pal = {"R": "#c7260f", "O": "#ff7a1a", "Y": "#ffd23d", "W": "#fff6c9"}
    rows = ["ROOOOR", "OYYYYO", "OYWWYO", "OYWWYO", "OYYYYO", "ROOOOR"]
    for f in c.faces:
        art(f, rows, pal)
    core = body.cube((-4, 1, -1), (8, 4, 2))
    core.fill("#ff7a1a", noise=10)
    core2 = body.cube((-1, 1, -4), (2, 4, 8))
    core2.fill("#ffb02e", noise=10)
    return m


def negative_burst():
    m = Model("negative_burst", bounds=(1, 1, 0.25))
    body = m.bone("body", (0, 3, 0))
    c = body.cube((-3, 0, -3), (6, 6, 6))
    pal = {"K": "#0d0714", "P": "#3b1466", "M": "#8a2be2", "W": "#e7b8ff"}
    rows = ["KPPPPK", "PMMMMP", "PMWWMP", "PMWWMP", "PMMMMP", "KPPPPK"]
    for f in c.faces:
        art(f, rows, pal)
    ring = body.cube((-4, 2, -4), (8, 2, 8))
    ring.fill("#5a1f9c", noise=10)
    ring.top.fill(None, 2, 2, 6, 6)
    ring.bottom.fill(None, 2, 2, 6, 6)
    return m


# ---------------------------------------------------------- Narberal Gamma
def narberal():
    m = Model("narberal", bounds=(3, 3.5, 1.25))
    skin, skin_d = "#f4dfd0", "#d8bba8"
    hair, hair_l = "#16141c", "#2d2a3a"
    dress, dress_l = "#1d1c26", "#33313f"
    white, white_d = "#f2f1f3", "#c8c6cf"
    steel, steel_d = "#aeb6c6", "#6f7789"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_l, "K": dress, "k": dress_l, "W": white,
           "w": white_d, "e": "#3a3148", "m": "#b9596a", "G": GOLD, "g": GOLD_D, "M": steel, "d": steel_d}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(dress)
    art(torso.front, [
        "KWWSSWWK",
        "MMWWWWMM",
        "MdKWWKdM",
        "KKWWWWKK",
        "KKWGGWKK",
        "KKWWWWKK",
        "KKWWWWKK",
        "KkWWWWkK",
        "KKWWWWKK",
        "wWWWWWWw",
        "KWWWWWWK",
        "KkWWWWkK",
    ], pal)
    torso.back.fill(white, 2, 9, 6, 12)  # apron bow
    torso.back.hline(9, white)

    skirt = m.bone("robe", (0, 12, 0), parent="body").cube((-5, 0, -3), (10, 12, 6))
    skirt.fill(dress)
    for f in skirt.sides:
        f.vshade(1.0, 0.85)
        for x in range(1, f.w, 3):
            f.vline(x, dress_l, 1, 11)
    skirt.front.fill(white, 2, 0, 8, 9)
    skirt.front.hline(9, white_d, 2, 8)
    skirt.band(11, 12, white)

    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(hair, noise=4)
    art(hd.front, [
        "WwWWWWwW",
        "HHHHHHHH",
        "HHSHHSHH",
        "HSSSSSSH",
        "SeSSSSeS",
        "SSSSSSSS",
        "HSSmmSSH",
        "HHSSSSHH",
    ], pal)
    for f in (hd.right, hd.left, hd.back):
        f.hline(0, white)
        for x in (2, 5):
            f.vline(x, hair_l, 1, 8)
    hd.top.hline(7, white).hline(6, white_d)
    hd.bottom.fill(skin_d)
    tail = head.cube((-1, 16, 4), (2, 12, 2))
    tail.fill(hair)
    tail.band(1, 2, white)
    for f in tail.sides:
        f.vshade(1.0, 0.85)

    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(dress)
        arm.band(0, 3, steel)
        arm.band(2, 3, steel_d)
        arm.band(7, 8, white)
        arm.band(8, 11, steel)
        arm.band(10, 11, steel_d)
        arm.band(11, 12, skin)
    return m


# --------------------------------------------------------- Pandora's Actor
def pandoras_actor():
    m = Model("pandoras_actor", bounds=(3, 3.5, 1.25))
    face, face_d = "#f0e7cb", "#cfc5a4"
    coat, coat_l, coat_d = "#c79a32", "#e0b955", "#8f6b1c"
    dark, dark_l = "#1d1b20", "#35323b"
    white = "#f3f2ee"
    pal = {"F": face, "f": face_d, "K": "#0a090b", "Y": coat, "y": coat_l, "D": coat_d, "W": white,
           "B": dark, "b": dark_l, "G": GOLD_L, "R": "#b3141c"}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(coat)
    art(torso.front, [
        "YyWWWWyY",
        "YyDRRDyY",
        "YGyDDyGY",
        "YyyDDyyY",
        "YGyDDyGY",
        "YyyDDyyY",
        "YGyDDyGY",
        "YyyDDyyY",
        "DYYDDYYD",
        "BBBGGBBB",
        "YyyDDyyY",
        "DYYDDYYD",
    ], pal)
    torso.band(9, 10, dark)
    art(torso.front, ["BBBGGBBB"], pal, 0, 9)
    for f in (torso.right, torso.left, torso.back):
        f.vshade(1.03, 0.9)
    tails = body.cube((-4, 3, 2), (8, 9, 1))
    tails.fill(coat)
    tails.back.vline(3, coat_d).vline(4, None, 3, 9)
    tails.front.vline(4, None, 3, 9)
    for f in (tails.front, tails.back):
        f.hline(8, coat_d)

    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(face, noise=3)
    art(hd.front, [
        "FFFFFFFF",
        "FFFFFFFF",
        "FFFFFFFF",
        "FKKFFKKF",
        "FKKFFKKF",
        "FFFFFFFF",
        "FFFKKFFF",
        "fFFKKFFf",
    ], pal)
    for f in (hd.right, hd.left, hd.back):
        f.vshade(1.0, 0.9)
    cap = head.cube((-4, 31, -4), (8, 3, 8), inflate=0.5)
    cap.fill(coat)
    cap.band(2, 3, dark)
    cap.top.border(coat_d)
    art(cap.front, ["GRG"], pal, 3, 0)
    cap.bottom.fill(None)
    visor = head.cube((-4, 31, -7), (8, 1, 3))
    visor.fill(dark)
    visor.front.fill(dark_l)

    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(coat)
        arm.band(0, 1, coat_l)
        arm.band(8, 9, coat_d)
        arm.band(9, 12, white)
        for f in arm.sides:
            f.vline(0, coat_l, 1, 8)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill(dark)
        for f in leg.sides:
            f.vline(1, dark_l, 0, 7)
        leg.band(7, 8, coat_d)
        leg.band(8, 12, "#0e0d10")
    return m


# ---------------------------------------------------- Nazarick Old Guarder
def old_guarder():
    m = Model("old_guarder", bounds=(3, 3.5, 1.25))
    rust, rust_l, rust_d = "#6b4a36", "#8a6549", "#452d20"
    iron, iron_d = "#9aa0aa", "#5d626c"
    pal = {"B": BONE, "b": BONE_D, "d": "#1a1512", "K": "#0b090d", "r": "#ff5a4d", "U": rust,
           "u": rust_l, "D": rust_d, "T": "#d6cfb6", "t": "#7f7758", "I": iron, "i": iron_d, "G": GOLD_D}

    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill("#1a1512", noise=3)
    art(torso.front, [
        "UuUUUUuU",
        "UUuUUuUU",
        "UUUGGUUU",
        "DUUGGUUD",
        "DUUUUUUD",
        "DDUUUUDD",
        "dBdBBdBd",
        "dBBBBBBd",
        "dBdBBdBd",
        "ddBBBBdd",
        "dddBBddd",
        "DDDDDDDD",
    ], pal)
    for f in (torso.right, torso.left, torso.back):
        f.fill(rust, 0, 0, None, 6)
        f.hline(5, rust_d)
        f.hline(11, rust_d)
        f.noise(5, 2)
    torso.back.vline(3, BONE_D, 6, 11).vline(4, BONE, 6, 11)

    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(BONE, noise=4)
    art(hd.front, [
        "UUUUUUUU",
        "UuUDDUuU",
        "DBBDDBBD",
        "BKKBBKKB",
        "BKrBBrKB",
        "bBBKKBBb",
        "bTtTtTtb",
        ".bTtTtb.",
    ], pal)
    for f in (hd.right, hd.left, hd.back):
        f.fill(rust, 0, 0, None, 3)
        f.hline(2, rust_d)
        f.noise(5, 6)
    hd.top.fill(rust).noise(6, 1)
    hd.top.vline(3, rust_l).vline(4, rust_d)

    for name, x, px in (("rightArm", -6, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -1), (2, 12, 2))
        arm.fill(BONE)
        arm.band(0, 3, rust)
        arm.band(2, 3, rust_d)
        stripes(arm, BONE_D, every=4, start=5)
    for name, x, px in (("rightLeg", -3, -2), ("leftLeg", 1, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -1), (2, 12, 2))
        leg.fill(BONE)
        stripes(leg, BONE_D, every=4, start=2)
        leg.band(9, 12, rust)
        leg.band(9, 10, rust_d)

    shield = m.bone("shield", (5, 14, -2), parent="leftArm").cube((2, 9, -3), (7, 8, 1))
    shield.fill(rust)
    art(shield.front, [
        ".DDDDD.",
        "DuUUUuD",
        "DUUIUUD",
        "DUIiIUD",
        "DUIiIUD",
        "DUUIUUD",
        "DuUUUuD",
        ".DDDDD.",
    ], pal | {".": None})
    art(shield.back, [".DDDDD.", "DDDDDDD", "DDDDDDD", "DDDDDDD", "DDDDDDD", "DDDDDDD", "DDDDDDD", ".DDDDD."],
        pal | {".": None})
    for f in (shield.top, shield.bottom):
        f.px(0, 0, None)
        f.px(6, 0, None)

    sword = m.bone("weapon", (-5, 13, -1), parent="rightArm")
    grip = sword.cube((-5.5, 12.5, -4), (1, 1, 3))
    grip.fill("#3a2a1e", noise=2)
    guard = sword.cube((-6.5, 12, -5), (3, 2, 1))
    guard.fill(rust_d)
    blade = sword.cube((-5.5, 12, -17), (1, 2, 12))
    blade.fill(iron, noise=5)
    for f in (blade.right, blade.left):
        f.hline(1, iron_d)
    blade.front.fill("#d5dae2")
    return m


# ------------------------------------------------- Aura & Mare (dark elves)
ELF_SKIN, ELF_SKIN_D = "#b9835a", "#96643f"
ELF_HAIR, ELF_HAIR_D = "#f2d66b", "#c9a53c"


def _elf_head(m, front, pal, long_hair):
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(ELF_HAIR, noise=4)
    art(hd.front, front, pal)
    rows = 8 if long_hair else 5
    for f in (hd.right, hd.left):
        f.fill(ELF_SKIN, 0, rows, None, 8)
        for x in (2, 5):
            f.vline(x, ELF_HAIR_D, 0, rows)
    for x in (1, 4, 6):
        hd.back.vline(x, ELF_HAIR_D, 0, 8)
    if not long_hair:
        hd.back.fill(ELF_SKIN, 0, 6, None, 8)
    hd.bottom.fill(ELF_SKIN_D)
    for sx in (-6, 4):
        ear = head.cube((sx, 27, -1), (2, 2, 1))
        ear.fill(ELF_SKIN)
        ear.band(1, 2, ELF_SKIN_D)
    return head


def aura():
    m = Model("aura", bounds=(3, 3.5, 1.25))
    red, red_l, red_d = "#b3261f", "#d9534a", "#7a1612"
    white, white_d = "#f3f1ee", "#c9c5bf"
    pal = {"S": ELF_SKIN, "s": ELF_SKIN_D, "H": ELF_HAIR, "h": ELF_HAIR_D, "g": "#3fbf5f",
           "b": "#3f8fe0", "m": "#7a4030", "R": red, "r": red_l, "D": red_d, "W": white, "w": white_d,
           "G": GOLD, "K": "#2a1e16"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(red)
    art(torso.front, [
        "RrWWWWrR",
        "RrGWWGrR",
        "RrRWWRrR",
        "RDrWWrDR",
        "RrRWWRrR",
        "RDrWWrDR",
        "RrRWWRrR",
        "RDrGGrDR",
        "RrRRRRrR",
        "KKKGGKKK",
        "WWWWWWWW",
        "WwWWWWwW",
    ], pal)
    torso.band(9, 10, "#2a1e16")
    art(torso.front, ["KKKGGKKK"], pal, 0, 9)
    torso.band(10, 12, white)
    for f in (torso.right, torso.left, torso.back):
        for y in (2, 5):
            f.hline(y, red_d)
    whip = body.cube((-6, 8, -2), (1, 4, 4))
    whip.fill("#6b4226", noise=6)
    whip.right.fill("#3d2513", 1, 1, 3, 3)

    _elf_head(m, [
        "HHHHHHHH",
        "HHhHHhHH",
        "HHSHHSHH",
        "HSSSSSSH",
        "SgSSSSbS",
        "SSSSSSSS",
        "SSSmmSSS",
        "SSSSSSSS",
    ], pal, long_hair=False)

    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(white)
        arm.band(0, 2, red)
        arm.band(2, 3, GOLD)
        arm.band(8, 12, "#2a1e16")
        arm.band(8, 9, GOLD_D)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill(white)
        for f in leg.sides:
            f.vshade(1.0, 0.9)
        leg.band(8, 12, "#2a1e16")
        leg.band(8, 9, GOLD_D)
    return m


def mare():
    m = Model("mare", bounds=(3, 3.5, 1.25))
    teal, teal_l, teal_d = "#2f6f8f", "#4f97b8", "#1d4a61"
    white, white_d = "#f3f1ee", "#c9c5bf"
    leaf, leaf_l, leaf_d = "#3d8a3f", "#62b85f", "#275c2a"
    pal = {"S": ELF_SKIN, "s": ELF_SKIN_D, "H": ELF_HAIR, "h": ELF_HAIR_D, "g": "#3fbf5f",
           "b": "#3f8fe0", "m": "#7a4030", "T": teal, "t": teal_l, "D": teal_d, "W": white, "w": white_d,
           "G": GOLD, "L": leaf, "l": leaf_l}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(teal)
    art(torso.front, [
        "LLWWWWLL",
        "TLlGGlLT",
        "TtTWWTtT",
        "TtTWWTtT",
        "TDtWWtDT",
        "TtTTTTtT",
        "TDtTTtDT",
        "TtTTTTtT",
        "GGGGGGGG",
        "WWWWWWWW",
        "WwWWWWwW",
        "WWwWWwWW",
    ], pal)
    torso.band(8, 9, GOLD)
    torso.band(9, 12, white)
    skirt = body.cube((-5, 7, -3), (10, 5, 6))
    skirt.fill(white)
    for f in skirt.sides:
        f.vshade(1.0, 0.88)
        for x in range(1, f.w, 2):
            f.vline(x, white_d, 1, 5)
    skirt.bottom.fill(None)
    cloak = body.cube((-5, 9, 2), (10, 15, 1))
    cloak.fill(leaf)
    for f in (cloak.front, cloak.back):
        for x in (1, 4, 6, 8):
            f.vline(x, leaf_d, 1, 15)
        for x in (2, 5):
            f.vline(x, leaf_l, 0, 12)
        f.ragged_bottom(3, seed=8)
    cloak.bottom.fill(None)

    _elf_head(m, [
        "HHHHHHHH",
        "HhHHHHhH",
        "HHHSSHHH",
        "HSSSSSSH",
        "HbSSSSgH",
        "HSSSSSSH",
        "HSSmmSSH",
        "HHSSSSHH",
    ], pal, long_hair=True)

    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(teal)
        arm.band(0, 1, leaf)
        arm.band(6, 7, GOLD)
        arm.band(7, 11, white)
        arm.band(11, 12, ELF_SKIN)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill(white)
        leg.band(0, 4, ELF_SKIN)
        leg.band(4, 5, teal)
        leg.band(9, 12, teal_d)

    staff = m.bone("staff", (-6, 13, -3), parent="rightArm")
    shaft = staff.cube((-6.5, 2, -3.5), (1, 28, 1))
    shaft.fill("#6b4a2a", noise=6)
    stripes(shaft, "#4a321b", every=5, start=2)
    crown = staff.cube((-8, 30, -5), (4, 4, 4))
    crown.fill(leaf, noise=8)
    for f in crown.faces:
        f.px(1, 1, leaf_l)
        f.px(2, 2, leaf_d)
    bud = staff.cube((-7, 34, -4), (2, 2, 2))
    bud.fill(leaf_l)
    return m


# ------------------------------------------------- Gazef / Clementine / maid
def gazef():
    m = Model("gazef", bounds=(3, 3.5, 1.25))
    skin, skin_d = "#d6a57e", "#b38460"
    hair, hair_l = "#3a2a1f", "#55402f"
    steel, steel_l, steel_d = "#7a808c", "#a9b0bd", "#4c515b"
    cloth, cloth_d = "#7a1f1f", "#4f1212"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_l, "e": "#2b2118", "M": steel, "m": steel_l,
           "D": steel_d, "C": cloth, "c": cloth_d, "G": GOLD, "b": "#8a6a55"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(steel)
    art(torso.front, [
        "MmMSSMmM",
        "MmMMMMmM",
        "DMmMMmMD",
        "DMMGGMMD",
        "DMMGGMMD",
        "DDMMMMDD",
        "MDDMMDDM",
        "MMDDDDMM",
        "CCCGGCCC",
        "CcCCCCcC",
        "CcCCCCcC",
        "cCcCCcCc",
    ], pal)
    torso.band(8, 9, cloth_d)
    art(torso.front, ["CCCGGCCC"], pal, 0, 8)
    torso.band(9, 12, cloth)
    for f in (torso.right, torso.left, torso.back):
        f.hline(4, steel_d)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(skin, noise=3)
    art(hd.front, [
        "HHHHHHHH",
        "HhHHHHhH",
        "HSSSSSSH",
        "SHHSSHHS",
        "SeSSSSeS",
        "SSSssSSS",
        "bSSSSSSb",
        "bbbHHbbb",
    ], pal)
    for f in (hd.right, hd.left):
        f.fill(hair, 0, 0, None, 3)
        f.hline(7, "#8a6a55")
    hd.right.fill(hair, 0, 3, 4, 5)
    hd.left.fill(hair, 4, 3, 8, 5)
    hd.back.fill(hair, 0, 0, None, 6)
    hd.top.fill(hair)
    for x in (2, 5):
        hd.top.vline(x, hair_l)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(steel)
        arm.band(0, 1, steel_l)
        arm.band(3, 4, steel_d)
        arm.band(4, 7, cloth)
        arm.band(7, 8, steel_d)
        arm.band(11, 12, steel_d)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill("#3b3029")
        leg.band(4, 6, steel)
        leg.band(8, 12, steel_d)
        leg.band(8, 9, steel_l)
    sword = m.bone("weapon", (-6, 13, -2), parent="rightArm")
    grip = sword.cube((-6.5, 12.5, -5), (1, 1, 3))
    grip.fill("#3a2a1f", noise=2)
    guard = sword.cube((-8, 12, -6), (4, 2, 1))
    guard.fill(GOLD)
    blade = sword.cube((-6.5, 12, -22), (1, 2, 16))
    blade.fill("#dff1ff", noise=3)
    for f in (blade.right, blade.left):
        f.hline(1, "#7fc4ff")
    blade.front.fill("#ffffff")
    return m


def clementine():
    m = Model("clementine", bounds=(3, 3.5, 1.25))
    skin, skin_d = "#f1d3bd", "#d2ab92"
    hair, hair_d = "#eed27a", "#c4a54a"
    cloak, cloak_l = "#18161c", "#2c2933"
    steel, steel_d = "#b5bcc9", "#737b8c"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_d, "e": "#d4202a", "m": "#a8434f", "K": cloak,
           "k": cloak_l, "M": steel, "d": steel_d, "G": GOLD, "c": "#b87333", "L": "#3a2a2a"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(skin)
    art(torso.front, [
        "KKSSSSKK",
        "KMdMMdMK",
        "KMGMcMMK",
        "KdMMMMdK",
        "KSMcGMSK",
        "KSSSSSSK",
        "KSSSSSSK",
        "KSSssSSK",
        "LLLLLLLL",
        "MGLLLLcM",
        "LMcLLGML",
        "LLLLLLLL",
    ], pal)
    for f in (torso.right, torso.left, torso.back):
        f.fill(cloak)
        f.noise(4, 2)
    cape = body.cube((-5, 3, 2), (10, 21, 1))
    cape.fill(cloak)
    for f in (cape.front, cape.back):
        f.vshade(1.0, 0.8)
        for x in (2, 5, 7):
            f.vline(x, cloak_l, 1, 20)
        f.ragged_bottom(2, seed=4)
    cape.bottom.fill(None)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(hair, noise=4)
    art(hd.front, [
        "HHHHHHHH",
        "HHhHHhHH",
        "HSHSSHSH",
        "HSSSSSSH",
        "SeSSSSeS",
        "SSSSSSSS",
        "SmSSSSmS",
        "SSmmmmSS",
    ], pal)
    for f in (hd.right, hd.left):
        f.fill(skin, 0, 6, None, 8)
        for x in (2, 5):
            f.vline(x, hair_d, 0, 6)
    hd.back.fill(skin, 0, 7, None, 8)
    hd.bottom.fill(skin_d)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(skin)
        arm.band(0, 3, cloak)
        arm.band(7, 11, "#3a2a2a")
        arm.band(7, 8, steel_d)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill("#3a2a2a")
        leg.band(0, 2, skin)
        leg.band(5, 6, steel)
        leg.band(9, 12, cloak)
    dagger = m.bone("weapon", (-6, 13, -2), parent="rightArm")
    grip = dagger.cube((-6.5, 12.5, -5), (1, 1, 3))
    grip.fill("#3a2a2a", noise=2)
    guard = dagger.cube((-7.5, 12, -6), (3, 2, 1))
    guard.fill(steel_d)
    blade = dagger.cube((-6.5, 12.5, -13), (1, 1, 7))
    blade.fill("#e6ebf2", noise=3)
    return m


def nazarick_maid():
    m = Model("nazarick_maid", bounds=(3, 3.5, 1.25))
    skin, skin_d = "#f6e0d0", "#d9bca8"
    hair, hair_d = "#e9c46a", "#b9953f"
    dress, dress_l = "#1f1e28", "#35333f"
    white, white_d = "#f4f3f5", "#c9c7d0"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_d, "K": dress, "k": dress_l, "W": white,
           "w": white_d, "e": "#3f6fb0", "m": "#c0606f", "R": "#b3261f"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(dress)
    art(torso.front, [
        "KWWSSWWK",
        "KKWRRWKK",
        "KWWWWWWK",
        "KkWWWWkK",
        "KKWWWWKK",
        "KkWWWWkK",
        "KKWWWWKK",
        "KkWWWWkK",
        "KKWWWWKK",
        "wWWWWWWw",
        "KWWWWWWK",
        "KkWWWWkK",
    ], pal)
    torso.back.hline(9, white)
    torso.back.fill(white, 2, 9, 6, 12)
    skirt = m.bone("robe", (0, 12, 0), parent="body").cube((-5, 0, -3), (10, 12, 6))
    skirt.fill(dress)
    for f in skirt.sides:
        f.vshade(1.0, 0.85)
        for x in range(1, f.w, 3):
            f.vline(x, dress_l, 1, 11)
    skirt.front.fill(white, 2, 0, 8, 9)
    skirt.front.hline(9, white_d, 2, 8)
    skirt.band(11, 12, white)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(hair, noise=4)
    art(hd.front, [
        "WwWWWWwW",
        "HHHHHHHH",
        "HhSHHShH",
        "HSSSSSSH",
        "SeSSSSeS",
        "SSSSSSSS",
        "SSSmmSSS",
        "SSSSSSSS",
    ], pal)
    for f in (hd.right, hd.left, hd.back):
        f.hline(0, white)
        for x in (2, 5):
            f.vline(x, hair_d, 1, 6)
    for f in (hd.right, hd.left):
        f.fill(skin, 0, 6, None, 8)
    hd.top.hline(7, white).hline(6, white_d)
    hd.bottom.fill(skin_d)
    bun = head.cube((-2, 26, 4), (4, 4, 2))
    bun.fill(hair, noise=5)
    bun.back.border(hair_d)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(dress)
        arm.band(0, 2, white)
        arm.band(9, 11, white)
        arm.band(11, 12, skin)
    return m


# ------------------------------------- Brain / Zaryusu / CZ Delta / Nfirea
def brain():
    m = Model("brain", bounds=(3, 3.5, 1.25))
    skin, skin_d = "#e0b390", "#bd8f6c"
    hair, hair_l = "#3b5a8c", "#5b7db3"
    coat, coat_l, coat_d = "#2d3a4a", "#44566b", "#1b2530"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_l, "e": "#2b2118", "C": coat, "c": coat_l,
           "D": coat_d, "W": "#d9d4c8", "B": "#5a3d28", "G": GOLD_D, "b": "#7c6a5c"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(coat)
    art(torso.front, [
        "CcWSSWcC",
        "CcWWWWcC",
        "CCcWWcCC",
        "CCcWWcCC",
        "DCCcWCCD",
        "DCCcCCCD",
        "CCCCCCCC",
        "CcCCCCcC",
        "BBBGGBBB",
        "CcCCCCcC",
        "DCCCCCCD",
        "DDCCCCDD",
    ], pal)
    torso.band(8, 9, "#5a3d28")
    art(torso.front, ["BBBGGBBB"], pal, 0, 8)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(skin, noise=3)
    art(hd.front, [
        "HHHHHHHH",
        "HhHHHhHH",
        "HHSHSSHH",
        "HSSSSSSH",
        "SeSSSSeS",
        "SSSssSSS",
        "SSSSSSSS",
        "bSSbbSSb",
    ], pal)
    for f in (hd.right, hd.left):
        f.fill(hair, 0, 0, None, 4)
    hd.right.fill(hair, 0, 4, 4, 6)
    hd.left.fill(hair, 4, 4, 8, 6)
    hd.back.fill(hair, 0, 0, None, 7)
    hd.top.fill(hair)
    for x in (1, 3, 6):
        hd.top.vline(x, hair_l)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(coat)
        arm.band(8, 9, coat_d)
        arm.band(9, 12, skin)
        for f in arm.sides:
            f.vline(0, coat_l, 0, 8)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill("#3a3530")
        leg.band(9, 12, "#5a3d28")
    sword = m.bone("weapon", (-6, 13, -2), parent="rightArm")
    grip = sword.cube((-6.5, 12.5, -5), (1, 1, 3))
    grip.fill("#1b1b22", noise=2)
    guard = sword.cube((-7.5, 12, -6), (3, 2, 1))
    guard.fill(GOLD_D)
    blade = sword.cube((-6.5, 12.5, -23), (1, 1, 17))
    blade.fill("#e9eef5", noise=3)
    return m


def zaryusu():
    return _lizard()


def lizardman():
    return _lizard("lizardman", "#5a7a3a", "#7a9c55", "#3a5226", "#d2c79a", ("#8a8f98", "#c9ced6"))


def _lizard(name="zaryusu", sc="#3f7a4a", sc_l="#5fa068", sc_d="#27502f", belly="#c9c58f",
            blade_c=("#bfe8ff", "#f4fbff")):
    m = Model(name, bounds=(3.5, 3.5, 1.25))
    pal = {"G": sc, "g": sc_l, "D": sc_d, "Y": belly, "y": "#a8a472", "e": "#f2c21b", "K": "#15130f",
           "T": "#f1eee0", "L": "#6b4226", "l": "#8a5a36"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(sc)
    art(torso.front, [
        "GgYYYYgG",
        "GYYyyYYG",
        "DYYYYYYD",
        "GYyYYyYG",
        "GYYYYYYG",
        "DYYyyYYD",
        "GgYYYYgG",
        "GGgYYgGG",
        "LLLLLLLL",
        "LlLLLLlL",
        "lLlLLlLl",
        "LlLlLlLL",
    ], pal)
    torso.band(8, 9, "#4a2d18")
    torso.band(9, 12, "#6b4226")
    for f in (torso.right, torso.left, torso.back):
        for y in (2, 5):
            f.hline(y, sc_d)
    torso.back.vline(3, sc_l, 0, 8).vline(4, sc_d, 0, 8)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(sc, noise=5)
    art(hd.front, [
        "GgGGGGgG",
        "GGDGGDGG",
        "GeKGGKeG",
        "GGGGGGGG",
        "DGGGGGGD",
        "GGGGGGGG",
        "DGGGGGGD",
        "GDGGGGDG",
    ], pal)
    for f in (hd.right, hd.left, hd.back):
        f.hline(3, sc_d)
    snout = head.cube((-3, 24, -8), (6, 4, 4))
    snout.fill(sc_l)
    art(snout.front, ["gKggKg", "gggggg", "TKTTKT", "YYYYYY"], pal)
    for f in (snout.right, snout.left):
        f.hline(2, "#f1eee0")
        f.hline(3, belly)
    snout.bottom.fill(belly)
    for sx in (-3, 2):
        crest = head.cube((sx, 32, 0), (1, 2, 3))
        crest.fill(sc_d)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(sc)
        stripes(arm, sc_d, every=4, start=3)
        arm.band(10, 12, sc_d)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill(sc)
        leg.band(0, 4, "#6b4226")
        stripes(leg, sc_d, every=4, start=6)
        leg.band(10, 12, sc_d)
    tail = m.bone("tail", (0, 13, 2), parent="body", rotation=(-30, 0, 0))
    t1 = tail.cube((-2, 11, 2), (4, 4, 7))
    t1.fill(sc)
    t2 = tail.cube((-1, 12, 9), (2, 2, 7))
    t2.fill(sc_d)
    for f in (t1.right, t1.left, t1.top):
        for x in range(2, f.w, 3):
            f.vline(x, sc_d)
    t1.bottom.fill(belly)
    sword = m.bone("weapon", (-6, 13, -2), parent="rightArm")
    grip = sword.cube((-6.5, 12.5, -5), (1, 1, 3))
    grip.fill("#3d5f7a", noise=2)
    guard = sword.cube((-8, 12, -6), (4, 2, 1))
    guard.fill("#8ccdf0")
    blade = sword.cube((-6.5, 11.5, -20), (1, 3, 14))
    blade.fill(None, noise=0)
    ice = [
        "...ssssssssss.",
        "sSSSSSSSSSSSSs",
        "..sSSsSSsSSss.",
    ]
    ipal = {"s": blade_c[0], "S": blade_c[1], ".": None}
    art(blade.right, ice, ipal)
    art(blade.left, [r[::-1] for r in ice], ipal)
    blade.top.fill(blade_c[0])
    return m


def cz_delta():
    m = Model("cz_delta", bounds=(3, 3.5, 1.25))
    skin, skin_d = "#f6e2d4", "#dcc0ad"
    hair, hair_d = "#f0a8a0", "#cf7f78"
    dress, dress_l = "#2a3324", "#3f4a36"
    camo, camo_d = "#6b7a4a", "#4a5633"
    white, white_d = "#f2f1f3", "#c8c6cf"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_d, "K": dress, "k": dress_l, "W": white,
           "w": white_d, "e": "#3fbf7a", "P": "#15131a", "m": "#c0606f", "C": camo, "c": camo_d,
           "G": GOLD}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(dress)
    art(torso.front, [
        "CcCCCcCC",
        "cCCcCCcC",
        "KKWWWWKK",
        "KkWWWWkK",
        "KKWGGWKK",
        "KkWWWWkK",
        "KKWWWWKK",
        "KkWWWWkK",
        "CCcCCcCC",
        "wWWWWWWw",
        "KWWWWWWK",
        "KkWWWWkK",
    ], pal)
    torso.band(0, 2, camo)
    for f in torso.sides:
        f.px(1, 0, camo_d)
        f.px(2, 1, camo_d)
    skirt = m.bone("robe", (0, 12, 0), parent="body").cube((-5, 0, -3), (10, 12, 6))
    skirt.fill(dress)
    for f in skirt.sides:
        f.vshade(1.0, 0.85)
        for x in range(1, f.w, 3):
            f.vline(x, dress_l, 1, 11)
    skirt.front.fill(white, 2, 0, 8, 8)
    skirt.band(11, 12, camo)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(hair, noise=4)
    art(hd.front, [
        "WwWWWWwW",
        "HHHHHHHH",
        "HhHHHHhH",
        "HSSSSHHH",
        "HeSSSPPH",
        "HSSSSSSH",
        "HSSmmSSH",
        "HHSSSSHH",
    ], pal)
    for f in (hd.right, hd.left, hd.back):
        f.hline(0, white)
        for x in (2, 5):
            f.vline(x, hair_d, 1, 8)
    hd.left.hline(4, "#15131a")
    hd.back.hline(4, "#15131a")
    hd.top.hline(7, white)
    hd.bottom.fill(skin_d)
    hair_back = body.cube((-4, 13, 2), (8, 11, 1))
    hair_back.fill(hair)
    for x in (1, 4, 6):
        hair_back.back.vline(x, hair_d, 0, 10)
    hair_back.back.ragged_bottom(2, seed=7)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(dress)
        arm.band(0, 2, camo)
        arm.band(8, 9, white)
        arm.band(9, 12, "#15131a")
    gun = m.bone("weapon", (-6, 13, -2), parent="rightArm")
    stock = gun.cube((-7, 11, -3), (2, 3, 4))
    stock.fill("#4a321b", noise=5)
    barrel = gun.cube((-6.5, 12.5, -15), (1, 1, 12))
    barrel.fill("#2b2f38", noise=3)
    body_g = gun.cube((-7, 12, -8), (2, 2, 5))
    body_g.fill("#3c424e", noise=3)
    scope = gun.cube((-6.5, 14, -8), (1, 1, 4))
    scope.fill("#15131a")
    scope.front.fill("#3fbf7a")
    return m


def nfirea():
    m = Model("nfirea", bounds=(3, 3.5, 1.25))
    skin, skin_d = "#f0d2b8", "#d0ab8e"
    hair, hair_d = "#e6c463", "#b99338"
    shirt, shirt_d = "#7a8f5a", "#566741"
    apron, apron_d = "#d9cfb8", "#b3a88f"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_d, "T": shirt, "t": shirt_d, "A": apron,
           "a": apron_d, "m": "#b9606a", "B": "#5a3d28", "R": "#e0202c", "g": "#43d6e8"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(shirt)
    art(torso.front, [
        "TtSSSStT",
        "TTtSStTT",
        "TAAAAAAT",
        "TAaAAaAT",
        "TAAAAAAT",
        "TARAAgAT",
        "TAAAAAAT",
        "TAaAAaAT",
        "BBBBBBBB",
        "TAAAAAAT",
        "TAaAAaAT",
        "tAAAAAAt",
    ], pal)
    torso.band(8, 9, "#5a3d28")
    for f in (torso.right, torso.left, torso.back):
        f.vshade(1.0, 0.9)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(hair, noise=4)
    art(hd.front, [
        "HHHHHHHH",
        "HhHHHHhH",
        "HHHhHHHH",
        "HHhHHhHH",
        "HhHHhHHh",
        "SSSSSSSS",
        "SSSmmSSS",
        "SSSSSSSS",
    ], pal)
    for f in (hd.right, hd.left):
        f.fill(skin, 0, 6, None, 8)
        for x in (2, 5):
            f.vline(x, hair_d, 0, 6)
    hd.back.fill(skin, 0, 7, None, 8)
    hd.bottom.fill(skin_d)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(shirt)
        arm.band(6, 7, shirt_d)
        arm.band(7, 12, skin)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill("#5a4a3a")
        leg.band(9, 12, "#3a2a1e")
    return m


def magic_bullet():
    m = Model("magic_bullet", bounds=(1, 1, 0.25))
    body = m.bone("body", (0, 1.5, 0))
    c = body.cube((-1.5, 0, -1.5), (3, 3, 3))
    pal = {"G": "#3fbf7a", "W": "#eafff3", "D": "#1f7a48"}
    for f in c.faces:
        art(f, ["DGD", "GWG", "DGD"], pal)
    a = body.cube((-0.5, 1, -4), (1, 1, 8))
    a.fill("#9ff0c4", noise=6)
    return m


# ----------------------------------------------- remaining Pleiades maids
def _pleiades(name, skin, hair, hair_d, eye, dress="#1f1e28", accent="#b3261f", face=None, glasses=False,
              sleeve=None, glove=None, bun=True):
    """Shared battle-maid body; returns (model, head bone, body bone, palette)."""
    m = Model(name, bounds=(3, 3.5, 1.25))
    skin_d, dress_l = shade(skin, 0.86), shade(dress, 1.5)
    white, white_d = "#f4f3f5", "#c9c7d0"
    pal = {"S": skin, "s": skin_d, "H": hair, "h": hair_d, "K": dress, "k": dress_l, "W": white,
           "w": white_d, "e": eye, "m": "#c0606f", "R": accent, "F": "#2a2a33", "M": "#aeb6c6"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(dress)
    art(torso.front, [
        "KWWSSWWK",
        "MKWRRWKM",
        "KWWWWWWK",
        "KkWWWWkK",
        "KKWWWWKK",
        "KkWWWWkK",
        "KKWWWWKK",
        "KkWWWWkK",
        "RRWWWWRR",
        "wWWWWWWw",
        "KWWWWWWK",
        "KkWWWWkK",
    ], pal)
    torso.band(8, 9, accent)
    art(torso.front, ["RRWWWWRR"], pal, 0, 8)
    torso.back.fill(white, 2, 9, 6, 12)
    skirt = m.bone("robe", (0, 12, 0), parent="body").cube((-5, 0, -3), (10, 12, 6))
    skirt.fill(dress)
    for f in skirt.sides:
        f.vshade(1.0, 0.85)
        for x in range(1, f.w, 3):
            f.vline(x, dress_l, 1, 11)
    skirt.front.fill(white, 2, 0, 8, 9)
    skirt.front.hline(9, white_d, 2, 8)
    skirt.band(11, 12, accent)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(hair, noise=4)
    art(hd.front, face or [
        "WwWWWWwW",
        "HHHHHHHH",
        "HhSHHShH",
        "HSSSSSSH",
        "SeSSSSeS",
        "SSSSSSSS",
        "SSSmmSSS",
        "SSSSSSSS",
    ], pal)
    if glasses:
        art(hd.front, ["FeFFFFeF"], pal, 0, 4)
    for f in (hd.right, hd.left, hd.back):
        f.hline(0, white)
        for x in (2, 5):
            f.vline(x, hair_d, 1, 6)
    for f in (hd.right, hd.left):
        f.fill(skin, 0, 6, None, 8)
    hd.top.hline(7, white).hline(6, white_d)
    hd.bottom.fill(skin_d)
    if bun:
        knot = head.cube((-2, 26, 4), (4, 4, 2))
        knot.fill(hair, noise=5)
        knot.back.border(hair_d)
    for bname, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(bname, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(sleeve or dress)
        arm.band(0, 2, "#aeb6c6")
        arm.band(8, 9, white)
        arm.band(9, 12, glove or skin)
    return m, head, body, pal


def lupusregina():
    m, head, body, pal = _pleiades("lupusregina", "#c98f68", "#a8402a", "#7a2a1a", "#f2c21b",
                                   accent="#d9a92b", bun=False)
    for sx in (-5, 3):
        braid = head.cube((sx, 14, 3), (2, 12, 2))
        braid.fill("#a8402a")
        stripes(braid, "#7a2a1a", every=3, start=1)
    staff = m.bone("staff", (-6, 13, -3), parent="rightArm")
    shaft = staff.cube((-6.5, 1, -3.5), (1, 32, 1))
    shaft.fill("#2a2a33", noise=3)
    bar = staff.cube((-10, 27, -3.5), (8, 2, 1))
    bar.fill(GOLD)
    top = staff.cube((-7.5, 31, -4), (3, 5, 2))
    top.fill(GOLD)
    top.front.px(1, 2, "#d4202a")
    top.back.px(1, 2, "#d4202a")
    return m


def entoma():
    face = [
        "WwWWWWwW",
        "HHHHHHHH",
        "HHHHHHHH",
        "HSSSSSSH",
        "SeSSSSeS",
        "SSSSSSSS",
        "SSSSSSSS",
        "SSSSSSSS",
    ]
    m, head, body, pal = _pleiades("entoma", "#f3ead8", "#5a3a66", "#3d2646", "#d4202a",
                                   dress="#3a2a4a", accent="#c9608f", face=face,
                                   sleeve="#c9608f", glove="#3a2a4a", bun=False)
    for sx in (-6, 3):
        knot = head.cube((sx, 29, 0), (3, 4, 3))
        knot.fill("#5a3a66", noise=5)
        knot.band(3, 4, "#c9608f")
    for bname in ("rightArm", "leftArm"):
        bone = next(b for b in m.bones if b.name == bname)
        x = -9 if bname == "rightArm" else 4
        cuff = bone.cube((x, 12, -3), (5, 5, 6))
        cuff.fill("#c9608f")
        for f in cuff.sides:
            f.hline(4, "#f3ead8")
        cuff.bottom.fill("#3a2a4a")
    return m


def solution():
    m, head, body, pal = _pleiades("solution", "#f6e2d4", "#ecca5c", "#bf9a34", "#3f8fe0",
                                   accent="#3f8fe0", bun=False)
    for sx in (-6, 4):
        curl = head.cube((sx, 17, 0), (2, 10, 2))
        curl.fill("#ecca5c")
        stripes(curl, "#bf9a34", every=2, start=1)
    return m


def yuri():
    m, head, body, pal = _pleiades("yuri", "#f1dccb", "#1b1a22", "#35323f", "#3a3148",
                                   accent="#3f6fb0", glasses=True, glove="#3d8a3f")
    for bname in ("rightArm", "leftArm"):
        bone = next(b for b in m.bones if b.name == bname)
        x = -9 if bname == "rightArm" else 4
        fist = bone.cube((x, 11, -3), (5, 4, 6))
        fist.fill("#3d8a3f", noise=5)
        for f in fist.sides:
            for xx in range(1, f.w, 2):
                f.px(xx, 0, "#e9e3cf")
        fist.bottom.fill("#275c2a")
    choker = body.cube((-3, 23, -3), (6, 1, 6))
    choker.fill("#3f6fb0")
    return m


# ------------------------------------------------------------ goblin / ogre
def goblin():
    m = Model("goblin", bounds=(2.5, 3, 1.0))
    g, g_l, g_d = "#6f9a3f", "#8dbb55", "#4a6b27"
    pal = {"G": g, "g": g_l, "D": g_d, "e": "#f2c21b", "K": "#15130f", "T": "#f1eee0", "L": "#6b4226",
           "l": "#8a5a36"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(g)
    art(torso.front, [
        "GgGGGGgG",
        "GGgGGgGG",
        "DGGGGGGD",
        "GGDGGDGG",
        "GgGGGGgG",
        "DGGggGGD",
        "GGGGGGGG",
        "LLLLLLLL",
        "LlLLLLlL",
        "lLlLLlLl",
        "LlLlLlLL",
        "LL.LL.LL",
    ], pal | {".": g_d})
    torso.band(7, 12, "#6b4226")
    for f in (torso.right, torso.left, torso.back):
        f.noise(6, 4)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(g, noise=5)
    art(hd.front, [
        "GgGGGGgG",
        "GGGGGGGG",
        "DDGGGGDD",
        "GeKGGKeG",
        "GGGDDGGG",
        "GGGGGGGG",
        "GTKKKKTG",
        "DGGGGGGD",
    ], pal)
    for sx in (-7, 4):
        ear = head.cube((sx, 27, -1), (3, 3, 1))
        ear.fill(g_l)
        ear.front.px(0 if sx < 0 else 2, 0, None)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(g)
        arm.band(10, 12, g_d)
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill(g)
        leg.band(0, 3, "#6b4226")
        leg.band(10, 12, g_d)
    club = m.bone("weapon", (-6, 13, -2), parent="rightArm")
    handle = club.cube((-6.5, 12.5, -8), (1, 1, 6))
    handle.fill("#6b4a2a", noise=5)
    knob = club.cube((-7.5, 11.5, -13), (3, 3, 5))
    knob.fill("#5b3d22", noise=8)
    return m


def ogre():
    return _brute()


def war_troll():
    return _brute("war_troll", "#5f7f6a", "#7fa088", "#3d5546")


def _brute(name="ogre", o="#b08a5a", o_l="#cba878", o_d="#7d5f3a"):
    m = Model(name, bounds=(4.5, 5, 1.5))
    pal = {"O": o, "o": o_l, "D": o_d, "e": "#d4202a", "K": "#15130f", "T": "#f1eee0", "L": "#4a3323",
           "l": "#6b4a32"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-6, 12, -3), (12, 12, 7))
    torso.fill(o)
    art(torso.front, [
        "OoOOOOOOOoOO",
        "OOoOOOOOoOOO",
        "DOOoOOOoOOOD",
        "OOOOoooOOOOO",
        "OOOOOOOOOOOO",
        "DOOOOOOOOOOD",
        "OOoOOOOOOoOO",
        "OOOoOOOOoOOO",
        "LLLLLLLLLLLL",
        "LlLLlLLlLLlL",
        "lLLlLLlLLlLL",
        "LLlLL.LL.lLL",
    ], pal | {".": o_d})
    torso.band(8, 12, "#4a3323")
    for f in (torso.right, torso.left, torso.back):
        f.noise(6, 3)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(o, noise=5)
    art(hd.front, [
        "OoOOOOoO",
        "DDDOODDD",
        "OeKOOKeO",
        "OOOOOOOO",
        "OODOODOO",
        "OOOOOOOO",
        "TKKKKKKT",
        "TOOOOOOT",
    ], pal)
    for name, x, px in (("rightArm", -11, -8.5), ("leftArm", 6, 8.5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 10, -2.5), (5, 14, 5))
        arm.fill(o)
        arm.band(0, 2, o_l)
        arm.band(12, 14, o_d)
    for name, x, px in (("rightLeg", -6, -3), ("leftLeg", 0, 3)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -3), (6, 12, 6))
        leg.fill(o)
        leg.band(0, 4, "#4a3323")
        leg.band(10, 12, o_d)
    club = m.bone("weapon", (-8.5, 11, -2), parent="rightArm")
    handle = club.cube((-9, 10.5, -10), (1, 1, 8))
    handle.fill("#6b4a2a", noise=5)
    knob = club.cube((-10.5, 9, -20), (4, 4, 10))
    knob.fill("#5b3d22", noise=8)
    for f in knob.faces:
        f.px(1, 1, "#c9c1a4")
    return m


# ---------------------------------- Evileye / Fluder / Gargantua / beasts
def evileye():
    m = Model("evileye", bounds=(3, 3.5, 1.25))
    red, red_l, red_d = "#8f1a1f", "#b5333a", "#5a0d11"
    pal = {"R": red, "r": red_l, "D": red_d, "W": "#f1ede4", "w": "#c9c3b5", "K": "#15131a", "J": "#e0202c",
           "H": "#ecd06a", "B": "#1b1a22", "G": GOLD}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(red)
    art(torso.front, [
        "RrBBBBrR",
        "RrRBBRrR",
        "RRrGGrRR",
        "DRRrrRRD",
        "RRRRRRRR",
        "RrRRRRrR",
        "DRRRRRRD",
        "RRrRRrRR",
        "BBBGGBBB",
        "RrRRRRrR",
        "DRRRRRRD",
        "DDRRRRDD",
    ], pal)
    cape = body.cube((-5, 2, 2), (10, 22, 1))
    cape.fill(red)
    for f in (cape.front, cape.back):
        f.vshade(1.0, 0.75)
        for x in (2, 5, 7):
            f.vline(x, red_d, 1, 21)
        f.ragged_bottom(3, seed=6)
    cape.bottom.fill(None)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill("#ecd06a", noise=4)
    art(hd.front, [
        "HHHHHHHH",
        "WWWWWWWW",
        "WWWJJWWW",
        "WKKWWKKW",
        "WWWWWWWW",
        "WWwWWwWW",
        "wWWWWWWw",
        ".wWWWWw.",
    ], pal)
    hood = head.cube((-4, 24, -4), (8, 8, 8), inflate=0.75)
    hood.fill(red)
    hood.front.fill(None, 1, 1, 7, 8)
    hood.bottom.fill(None)
    for f in (hood.right, hood.left, hood.back):
        f.vshade(1.05, 0.8)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(red)
        arm.band(8, 9, red_d)
        arm.band(9, 12, "#1b1a22")
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill("#1b1a22")
        leg.band(8, 12, red_d)
    return m


def fluder():
    m = Model("fluder", bounds=(3, 4, 1.25))
    robe, robe_l, robe_d = "#e9e6dc", "#fbfaf5", "#b9b4a4"
    skin = "#e2bfa3"
    pal = {"W": robe, "w": robe_d, "L": robe_l, "S": skin, "s": "#c29c80", "B": "#f6f6f2", "b": "#cfcfc8",
           "e": "#2b2b33", "G": GOLD, "P": "#5a2a8a", "p": "#7d49b3"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(robe)
    art(torso.front, [
        "WPBBBBPW",
        "WPBBBBPW",
        "WPpBBpPW",
        "WWPBBPWW",
        "WWPbbPWW",
        "WWPPPPWW",
        "WwWPPWwW",
        "WWWPPWWW",
        "GGGGGGGG",
        "WwWPPWwW",
        "WWWPPWWW",
        "wWWPPWWw",
    ], pal)
    torso.band(8, 9, GOLD)
    skirt = m.bone("robe", (0, 12, 0), parent="body").cube((-5, 0, -3), (10, 12, 6))
    skirt.fill(robe)
    for f in skirt.sides:
        f.vshade(1.0, 0.85)
        for x in range(1, f.w, 3):
            f.vline(x, robe_d, 1, 11)
    skirt.front.fill("#5a2a8a", 4, 0, 6, 11)
    skirt.band(11, 12, GOLD)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(skin, noise=3)
    art(hd.front, [
        "BBBBBBBB",
        "BSSSSSSB",
        "SBBSSBBS",
        "SeSSSSeS",
        "SSSssSSS",
        "BBBBBBBB",
        "BBbBBbBB",
        "BBBBBBBB",
    ], pal)
    for f in (hd.right, hd.left, hd.back):
        f.fill("#f6f6f2", 0, 0, None, 2)
        f.fill("#f6f6f2", 0, 5, None, 8)
    hd.back.fill("#f6f6f2")
    hd.top.fill(skin)
    hd.top.border("#f6f6f2")
    beard = head.cube((-3, 17, -5), (6, 8, 1))
    beard.fill("#f6f6f2", noise=5)
    beard.front.ragged_bottom(3, seed=2)
    for x in (1, 4):
        beard.front.vline(x, "#cfcfc8", 0, 6)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(robe)
        arm.band(8, 9, GOLD)
        arm.band(9, 10, "#5a2a8a")
        arm.band(10, 12, skin)
    staff = m.bone("staff", (-6, 13, -3), parent="rightArm")
    shaft = staff.cube((-6.5, 1, -3.5), (1, 31, 1))
    shaft.fill("#6b4a2a", noise=5)
    orb = staff.cube((-7.5, 32, -4.5), (3, 3, 3))
    orb.fill("#e0202c", noise=4)
    for f in orb.faces:
        f.px(0, 0, "#ffb0a8")
    return m


def gargantua(name="gargantua", st="#6f7480", st_l="#8f95a3", st_d="#454954", rune="#ff5a3d"):
    m = Model(name, bounds=(6, 7, 2.5))
    pal = {"S": st, "s": st_l, "D": st_d, "R": rune, "K": "#16171c"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-7, 10, -4), (14, 14, 8))
    torso.fill(st, noise=8)
    art(torso.front, [
        "sSSSSSSSSSSSSs",
        "SsSSDSSSSDSSsS",
        "SSSDSSRRSSDSSS",
        "SSDSSRSSRSSDSS",
        "SSSSRSKKSRSSSS",
        "SSSSRSKKSRSSSS",
        "SSDSSRSSRSSDSS",
        "SSSDSSRRSSDSSS",
        "DSSSSSSSSSSSSD",
        "DDSSSDSSDSSSDD",
        "SDDSSSSSSSSDDS",
        "SSDDDDDDDDDDSS",
        "DSSSSSSSSSSSSD",
        "DDSSSSSSSSSSDD",
    ], pal)
    for f in (torso.right, torso.left, torso.back):
        for y in (4, 9):
            f.hline(y, st_d)
    torso.back.vline(6, rune, 1, 9).vline(7, rune, 1, 9)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 6, 8))
    hd.fill(st, noise=8)
    art(hd.front, ["sSSSSSSs", "SDDSSDDS", "SRRDDRRS", "SSSSSSSS", "DSDSDSDS", "DDDDDDDD"], pal)
    for name, x, px in (("rightArm", -13, -10), ("leftArm", 7, 10)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 4, -3), (6, 20, 6))
        arm.fill(st, noise=8)
        arm.band(0, 2, st_l)
        arm.band(8, 9, st_d)
        arm.band(14, 15, rune)
        arm.band(15, 20, st_d)
    for name, x, px in (("rightLeg", -7, -3.5), ("leftLeg", 1, 3.5)):
        leg = m.bone(name, (px, 10, 0)).cube((x, 0, -3), (6, 10, 6))
        leg.fill(st, noise=8)
        leg.band(4, 5, st_d)
        leg.band(8, 10, st_d)
    return m


def soul_eater():
    return _beast()


def hellhound():
    return _beast("hellhound", "#2a1210", "#4a1f18", "#ff7a1a", "#3a1a14", "#241008")


def _beast(name="soul_eater", dark="#1c2026", dark_l="#343b45", glow="#59e0c8", BONE=BONE, BONE_D=BONE_D):
    m = Model(name, bounds=(3.5, 3, 0.9))
    pal = {"K": dark, "k": dark_l, "B": BONE, "b": BONE_D, "G": glow, "g": "#b8fff2", "N": "#07080a",
           "T": "#d6cfb6"}
    body = m.bone("body", (0, 12, 0))
    b = body.cube((-4, 8, -8), (8, 8, 16))
    b.fill(dark, noise=5)
    for f in (b.right, b.left):
        art(f, ["................", ".B.B.B.B.B.B.B..", ".B.B.B.B.B.B.B..", ".b.b.b.b.b.b.b..", "..G...G...G.....",
                "................"], pal, 0, 1)
    b.top.vline(3, BONE, 0, 16).vline(4, BONE_D, 0, 16)
    b.bottom.fill(glow, 2, 3, 6, 13)
    mane = body.cube((-2, 16, -8), (4, 3, 12))
    mane.fill(glow, noise=14)
    mane.bottom.fill(None)
    head = m.bone("head", (0, 13, -8), parent="body")
    h = head.cube((-3, 9, -14), (6, 7, 6))
    h.fill(BONE, noise=4)
    art(h.front, ["BBBBBB", "BBBBBB", "NGBBGN", "NNBBNN", "BBNNBB", "TNTTNT", "bTNNTb"], pal)
    for f in (h.right, h.left):
        f.fill(BONE_D, 0, 5, None, 7)
    for sx in (-4, 2):
        horn = head.cube((sx, 15, -11), (2, 4, 2))
        horn.fill(dark_l)
        horn.band(0, 1, glow)
    for name, x, z in (("leg0", -4, -7), ("leg1", 1, -7), ("leg2", -4, 4), ("leg3", 1, 4)):
        leg = m.bone(name, (x + 1.5, 8, z + 1.5), parent="body").cube((x, 0, z), (3, 8, 3))
        leg.fill(dark)
        stripes(leg, BONE_D, every=3, start=1)
        leg.band(7, 8, glow)
    return m


def quagoa(name="quagoa", fur="#6b4d34", fur_l="#8a684a", fur_d="#45301f"):
    m = Model(name, bounds=(3, 3.5, 1.25))
    pal = {"F": fur, "f": fur_l, "D": fur_d, "e": "#e0202c", "K": "#15130f", "N": "#e89aa8", "T": "#f1eee0",
           "C": "#e9e3cf"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -3), (8, 12, 6))
    torso.fill(fur, noise=8)
    torso.front.fill(fur_l, 2, 2, 6, 10)
    torso.front.noise(8, 3)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(fur, noise=8)
    art(hd.front, ["FfFFFFfF", "FFFFFFFF", "FeKFFKeF", "FFFFFFFF", "DFFFFFFD", "FFFFFFFF", "DFFFFFFD", "FDFFFFDF"], pal)
    snout = head.cube((-2, 24, -7), (4, 4, 3))
    snout.fill(fur_l, noise=5)
    art(snout.front, ["fNNf", "ffff", "TKKT", "ffff"], pal)
    for sx in (-5, 3):
        ear = head.cube((sx, 31, -1), (2, 2, 1))
        ear.fill(fur_d)
    for name, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(name, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(fur, noise=8)
        arm.band(10, 12, fur_d)
        for f in arm.sides:
            for xx in (0, 2):
                f.px(xx, 11, "#e9e3cf")
    for name, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(name, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill(fur, noise=8)
        leg.band(10, 12, fur_d)
    return m


def crystal_shard():
    m = Model("crystal_shard", bounds=(1, 1, 0.25))
    body = m.bone("body", (0, 1.5, 0))
    c = body.cube((-1.5, 0, -1.5), (3, 3, 3))
    pal = {"C": "#bfe8ff", "W": "#ffffff", "D": "#6fb4de"}
    for f in c.faces:
        art(f, ["DCD", "CWC", "DCD"], pal)
    a = body.cube((-0.5, 1, -5), (1, 1, 10))
    a.fill("#e6f6ff", noise=6)
    b2 = body.cube((-3, 1, -0.5), (6, 1, 1))
    b2.fill("#bfe8ff", noise=6)
    return m


# ------------------------------------------------ everyday NPCs: adventurer, guard
def _soldier(name, skin, hair, armor, armor_l, armor_d, cloth, cloth_d, helmet, weapon_kind, mask=None,
             orb="#c05bff"):
    m = Model(name, bounds=(3, 3.5, 1.25))
    skin_d = shade(skin, 0.85)
    pal = {"S": skin, "s": skin_d, "H": hair, "h": shade(hair, 1.4), "e": "#2b2118", "M": armor, "m": armor_l,
           "D": armor_d, "C": cloth, "c": cloth_d, "G": GOLD, "W": "#e9e6dc", "b": "#6b4a36"}
    body = m.bone("body", (0, 24, 0))
    torso = body.cube((-4, 12, -2), (8, 12, 4))
    torso.fill(armor)
    art(torso.front, [
        "MmCSSCmM",
        "MCCCCCCM",
        "DCcCCcCD",
        "DCCGGCCD",
        "DCCGGCCD",
        "MCcCCcCM",
        "MMCCCCMM",
        "DMMCCMMD",
        "bbbGGbbb",
        "CcCCCCcC",
        "CCcCCcCC",
        "cCCCCCCc",
    ], pal)
    torso.band(8, 9, "#6b4a36")
    art(torso.front, ["bbbGGbbb"], pal, 0, 8)
    torso.band(9, 12, cloth)
    for f in (torso.right, torso.left, torso.back):
        f.hline(4, armor_d)
    torso.back.fill(cloth, 1, 0, 7, 8)
    torso.back.vline(3, cloth_d, 0, 8)
    head = m.bone("head", (0, 24, 0), parent="body")
    hd = head.cube((-4, 24, -4), (8, 8, 8))
    hd.fill(skin, noise=3)
    art(hd.front, [
        "HHHHHHHH",
        "HhHHHHhH",
        "HSSSSSSH",
        "SSSSSSSS",
        "SeSSSSeS",
        "SSSssSSS",
        "SSSSSSSS",
        "SSsbbsSS",
    ], pal)
    for f in (hd.right, hd.left):
        f.fill(hair, 0, 0, None, 3)
    hd.right.fill(hair, 0, 3, 4, 5)
    hd.left.fill(hair, 4, 3, 8, 5)
    hd.back.fill(hair, 0, 0, None, 6)
    hd.top.fill(hair)
    if mask:
        hd.front.fill(mask, 0, 5, None, 8)
        for f in (hd.right, hd.left, hd.back):
            f.fill(mask, 0, 5, None, 8)
    if helmet:
        cap = head.cube((-4, 28, -4), (8, 4, 8), inflate=0.5)
        cap.fill(armor)
        cap.band(3, 4, armor_d)
        cap.band(0, 1, armor_l)
        cap.top.border(armor_l)
        cap.front.vline(3, armor_d, 3, 4).vline(4, armor_l, 0, 4)
        cap.bottom.fill(None)
    for bname, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
        arm = m.bone(bname, (px, 22, 0), parent="body").cube((x, 12, -2), (4, 12, 4))
        arm.fill(cloth)
        arm.band(0, 3, armor)
        arm.band(2, 3, armor_d)
        arm.band(8, 11, "#6b4a36")
        arm.band(11, 12, skin)
    for bname, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
        leg = m.bone(bname, (px, 12, 0)).cube((x, 0, -2), (4, 12, 4))
        leg.fill("#4a3f36")
        leg.band(4, 6, armor)
        leg.band(8, 12, "#3a2a1e")
    weapon = m.bone("weapon", (-6, 13, -2), parent="rightArm")
    if weapon_kind == "none":
        pass  # bare hands
    elif weapon_kind == "scythe":
        shaft = weapon.cube((-6.5, 1, -3.5), (1, 34, 1))
        shaft.fill("#1b1a22", noise=3)
        blade = weapon.cube((-6.5, 28, -13), (1, 7, 10))
        blade.fill(None, noise=0)
        curve = [
            ".....sssss",
            "...ssSSSSS",
            ".ssSSSSSSS",
            "sSSSss....",
            "sSss......",
            "ss........",
            "s.........",
        ]
        spal = {"s": "#c9d1df", "S": "#f2f5f9", ".": None}
        art(blade.left, curve, spal)
        art(blade.right, [r[::-1] for r in curve], spal)
    elif weapon_kind == "bow":
        grip = weapon.cube((-6.5, 9, -4), (1, 8, 1))
        grip.fill("#6b4a2a", noise=5)
        for y0 in (6, 17):
            limb = weapon.cube((-6.5, y0, -3), (1, 3, 1))
            limb.fill("#8a6238", noise=4)
        string = weapon.cube((-6.5, 7, -2), (1, 12, 1))
        string.fill(None, noise=0)
        for f in (string.right, string.left):
            f.vline(0, "#e9e6dc")
        quiver = body.cube((-2, 14, 2), (4, 9, 2))
        quiver.fill("#6b4a36", noise=5)
        quiver.top.fill("#e9e6dc")
    elif weapon_kind == "hammer":
        haft = weapon.cube((-6.5, 12.5, -12), (1, 1, 10))
        haft.fill("#6b4a2a", noise=5)
        head_ = weapon.cube((-8, 10.5, -17), (4, 5, 5))
        head_.fill(armor, noise=6)
        for f in head_.faces:
            f.px(1, 2, orb)
    elif weapon_kind == "staff":
        shaft = weapon.cube((-6.5, 1, -3.5), (1, 30, 1))
        shaft.fill("#6b4a2a", noise=5)
        stripes(shaft, "#4a321b", every=6, start=3)
        gem = weapon.cube((-7.5, 31, -4.5), (3, 3, 3))
        gem.fill(orb, noise=4)
        for f in gem.faces:
            f.px(0, 0, mix(orb, "#ffffff", 0.7))
    elif weapon_kind == "spear":
        shaft = weapon.cube((-6.5, 1, -3.5), (1, 32, 1))
        shaft.fill("#6b4a2a", noise=5)
        tip = weapon.cube((-6.5, 33, -3.5), (1, 5, 1))
        tip.fill("#d5dae2", noise=3)
        collar = weapon.cube((-7, 32, -4), (2, 1, 2))
        collar.fill(armor_d)
    else:
        grip = weapon.cube((-6.5, 12.5, -5), (1, 1, 3))
        grip.fill("#3a2a1f", noise=2)
        guard = weapon.cube((-8, 12, -6), (4, 2, 1))
        guard.fill(armor_d)
        blade = weapon.cube((-6.5, 12, -19), (1, 2, 13))
        blade.fill("#c9ced6", noise=4)
        for f in (blade.right, blade.left):
            f.hline(1, "#8a8f98")
        shield = m.bone("shield", (5, 14, -2), parent="leftArm").cube((3, 9, -3), (6, 8, 1))
        shield.fill("#6b4a36", noise=6)
        shield.front.border(armor)
        shield.front.fill(cloth, 2, 2, 4, 6)
    return m


def adventurer():
    return _soldier("adventurer", "#e0b48c", "#5a3d28", "#8a6a4a", "#a8855f", "#5f4630", "#3f6a45", "#2a4a2f",
                    helmet=False, weapon_kind="sword")


def guard():
    return _soldier("guard", "#dcae88", "#3a2a1f", "#8d939f", "#b9c0cc", "#5d626c", "#2f4f8f", "#1f3766",
                    helmet=True, weapon_kind="spear")


def soldier():
    return _soldier("soldier", "#dcae88", "#6b4a2a", "#7a6a55", "#9a8a72", "#55483a", "#3f66a8", "#2a4a80",
                    helmet=False, weapon_kind="spear")


def archer():
    return _soldier("archer", "#e3b894", "#c9a53c", "#5f7a4a", "#7d9a66", "#40552f", "#3f66a8", "#2a4a80",
                    helmet=False, weapon_kind="bow")


def imperial_knight():
    return _soldier("imperial_knight", "#e0b48c", "#2a2018", "#3a3a44", "#5a5a68", "#1f1f26", "#a8262a", "#701519",
                    helmet=True, weapon_kind="sword")


def bandit():
    return _soldier("bandit", "#c99a78", "#1f1a16", "#3a3028", "#52463a", "#231c16", "#4a4038", "#2f2822",
                    helmet=False, weapon_kind="sword", mask="#2a2420")


# Looks a retainer can take: two per vocation (fighter, archer, mage, healer, rogue, bard).
RETAINER_LOOKS = [
    # skin, hair, armour, light, dark, cloth, cloth dark, helmet, weapon, orb
    ("#e0b48c", "#3a2a1f", "#9aa0aa", "#c9ced6", "#5d626c", "#2f4f8f", "#1f3766", True, "sword", None),
    ("#c99a78", "#a8402a", "#7a5a3a", "#9a7a55", "#55402a", "#8f2a2a", "#601818", False, "sword", None),
    ("#e3b894", "#c9a53c", "#5f7a4a", "#7d9a66", "#40552f", "#3f6a45", "#2a4a2f", False, "bow", None),
    ("#b9835a", "#1f1a16", "#6b4a36", "#8a6a4a", "#45301f", "#7a6a45", "#55482f", False, "bow", None),
    ("#f1dccb", "#5a3a66", "#4a2a6a", "#6a4a8f", "#2f1a45", "#5a2a8a", "#3d1a60", False, "staff", "#c05bff"),
    ("#d6a57e", "#e9e6dc", "#22335c", "#34497a", "#141f3a", "#2a4a80", "#1a3058", False, "staff", "#59d0ff"),
    ("#f6e2d4", "#ecca5c", "#d9d4c4", "#f4f1ea", "#a8a290", "#f4f1ea", "#c9c3b5", False, "staff", "#f6d968"),
    ("#e0b48c", "#6b4a2a", "#8fb8d6", "#b8d8f0", "#5f8aa8", "#dff1ff", "#a8c8de", False, "staff", "#63ff6b"),
    # rogues: a masked assassin in black and a thief in worn leathers
    ("#d9b08c", "#15131a", "#2a2a33", "#3d3d4a", "#17171d", "#3a1f4a", "#24122f", False, "sword", None, "#1c1c24"),
    ("#c99a78", "#6a4a2a", "#6a5238", "#8a6e4c", "#463522", "#4f5a3a", "#363f28", False, "sword", None),
    # bards: a minstrel in crimson and gold and a skald in blue and fur
    ("#f1d6bf", "#b5482e", "#a8322e", "#cf4d44", "#6e1f1c", "#e0b040", "#a87d22", False, "staff", "#ffd45c"),
    ("#e3bfa0", "#d9c9a0", "#3a5a7a", "#54799c", "#263d54", "#8a7558", "#5f503b", True, "staff", "#7fe0d0"),
]


def _retainer(n):
    skin, hair, armor, light, dark, cloth, cloth_d, helmet, weapon, orb = RETAINER_LOOKS[n][:10]
    mask = RETAINER_LOOKS[n][10] if len(RETAINER_LOOKS[n]) > 10 else None
    return lambda: _soldier(f"retainer_{n}", skin, hair, armor, light, dark, cloth, cloth_d, helmet=helmet,
                            weapon_kind=weapon, mask=mask, orb=orb or "#c05bff")


# v8.7: the party drawn in full. Each of the twelve looks gets its vocation's outfit - plate, cloak and
# hood, robe, vestments, leathers or finery - layered over the body, a face with eyes, brows and mouth,
# and its own gear: sword and kite shield, recurve bow and quiver, crystal staff and spellbook, holy staff
# with its halo, twin daggers, or a lute. Bones keep the player's names (body, head, arms, legs) so the
# same casting and weapon poses play on them, plus "weapon" and "offhand" in the hands and "cape".
HAIR_STYLES = ["short", "tied", "long", "short", "long", "beard", "long", "short", "hood", "short", "long", "braid"]


def _hero_face(hd, skin, hair, eye, style, mask=None):
    skin_d, skin_l = shade(skin, 0.84), shade(skin, 1.08)
    hd.fill(skin, noise=2)
    rows = [
        "HHHHHHHH",
        "HhHHHHhH" if style != "hood" else "HHHHHHHH",
        "SbbSSbbS",
        "SwEsSEwS",
        "SSSllSSS",
        "SSSddSSS",
        "SSsmmsSS",
        "SSSSSSSS",
    ]
    if style == "beard":
        rows[5], rows[6], rows[7] = "SHSddSHS", "SHHmmHHS", "sHHHHHHs"
    art(hd.front, rows, {"H": hair, "h": shade(hair, 1.35), "S": skin, "s": skin_d, "l": skin_l, "d": skin_d,
                         "b": shade(hair, 0.7), "w": "#f4f1ea", "E": eye, "m": "#a0525a"})
    for f in (hd.right, hd.left):
        f.fill(hair, 0, 0, None, 3)
    hd.right.fill(hair, 0, 3, 3, 6)
    hd.left.fill(hair, 5, 3, 8, 6)
    hd.back.fill(hair, 0, 0, None, 7 if style in ("long", "braid", "tied") else 5)
    hd.top.fill(hair)
    hd.top.noise(10, 4)
    if mask:
        for f in (hd.front, hd.right, hd.left, hd.back):
            f.fill(mask, 0, 5, None, 8)


def _hero(n):
    def build():
        look = RETAINER_LOOKS[n]
        skin, hair, armor, light, dark, cloth, cloth_d, helmet, _weapon, orb = look[:10]
        mask = look[10] if len(look) > 10 else None
        voc = n // 2
        style = HAIR_STYLES[n]
        orb = orb or "#c05bff"
        leather, leather_d, steel, steel_l = "#6b4a36", "#45301f", "#c9ced6", "#eef2f6"
        m = Model(f"retainer_{n}", bounds=(3, 3.5, 1.25))
        body = m.bone("body", (0, 24, 0))
        torso = body.cube((-4, 12, -2), (8, 12, 4))
        torso.fill(cloth, noise=3)
        head = m.bone("head", (0, 24, 0), parent="body")
        hd = head.cube((-4, 24, -4), (8, 8, 8))
        eye = ["#3a6ab0", "#4a8a3a", "#6a3a2a", "#2a2a2a", "#7a3ab0", "#3a8ab0"][n % 6]
        _hero_face(hd, skin, hair, eye, style, mask)
        arms = {}
        for bname, x, px in (("rightArm", -8, -5), ("leftArm", 4, 5)):
            bone = m.bone(bname, (px, 22, 0), parent="body")
            arm = bone.cube((x, 12, -2), (4, 12, 4))
            arm.fill(cloth, noise=3)
            arm.band(10, 12, skin)
            arms[bname] = (bone, x)
        legs = {}
        for bname, x, px in (("rightLeg", -4, -2), ("leftLeg", 0, 2)):
            bone = m.bone(bname, (px, 12, 0))
            leg = bone.cube((x, 0, -2), (4, 12, 4))
            leg.fill(shade(cloth_d, 0.8), noise=3)
            boot = bone.cube((x, 0, -2), (4, 4, 4), inflate=0.25)
            boot.fill(leather_d, noise=4)
            boot.band(0, 1, leather)
            legs[bname] = (bone, x)
        belt = body.cube((-4, 12, -2), (8, 2, 4), inflate=0.3)
        belt.fill(leather, noise=3)
        belt.front.fill(GOLD, 3, 0, 5, 2)
        pouch = body.cube((2, 11, -3), (2, 2, 1))
        pouch.fill(leather_d)
        weapon = m.bone("weapon", (-6, 13, -2), parent="rightArm")
        offhand = m.bone("offhand", (6, 13, -2), parent="leftArm")

        if voc == 0:  # fighters: plate over cloth, pauldrons, a cape, sword and kite shield
            plate = body.cube((-4, 15, -2), (8, 9, 4), inflate=0.5)
            plate.fill(armor, noise=4)
            plate.front.border(light)
            plate.front.vline(3, dark, 1, 8).vline(4, light, 1, 8)
            plate.front.fill(cloth, 2, 2, 6, 6)
            plate.front.vline(3, GOLD, 2, 6)
            for bname in ("rightArm", "leftArm"):
                bone, x = arms[bname]
                pauldron = bone.cube((x - 0.5, 20, -2.5), (5, 4, 5), inflate=0.2)
                pauldron.fill(armor, noise=4)
                pauldron.band(0, 1, light)
                pauldron.top.border(dark)
                bracer = bone.cube((x, 13, -2), (4, 3, 4), inflate=0.3)
                bracer.fill(armor)
            for bname in ("rightLeg", "leftLeg"):
                bone, x = legs[bname]
                greave = bone.cube((x, 4, -2), (4, 5, 4), inflate=0.3)
                greave.fill(armor, noise=3)
                greave.front.vline(2, light)
            cape = m.bone("cape", (0, 24, 2), parent="body").cube((-4, 7, 2.2), (8, 17, 1))
            cape.fill(cloth, noise=4)
            cape.back.border(cloth_d)
            cape.back.fill(GOLD, 3, 3, 5, 5)
            if helmet:
                helm = head.cube((-4, 24, -4), (8, 8, 8), inflate=0.6)
                helm.fill(armor, noise=3)
                helm.front.fill(None, 1, 3, 7, 7)
                helm.front.hline(3, dark, 1, 7)
                helm.front.vline(3, light, 0, 3).vline(4, light, 0, 3)
                helm.bottom.fill(None)
                plume = head.cube((-0.5, 32, -3), (1, 3, 7))
                plume.fill(cloth, noise=6)
            else:
                band = head.cube((-4, 30, -4), (8, 1, 8), inflate=0.55)
                band.fill(cloth_d)
                band.top.fill(None)
                band.bottom.fill(None)
            grip = weapon.cube((-6.5, 12.5, -6), (1, 1, 4))
            grip.fill(leather_d)
            pommel = weapon.cube((-7, 12, -2.5), (2, 2, 1))
            pommel.fill(GOLD)
            guard = weapon.cube((-8.5, 11.5, -7), (5, 3, 1))
            guard.fill(GOLD_D)
            guard.front.hline(1, GOLD)
            blade = weapon.cube((-6.5, 12, -21), (1, 2, 14))
            blade.fill(steel, noise=3)
            for f in (blade.right, blade.left):
                f.hline(0, steel_l)
                f.hline(1, "#9aa0aa", 2, 12)
            shield = offhand.cube((3.5, 7, -4.5), (7, 10, 1))
            shield.fill(armor, noise=4)
            shield.front.border(GOLD)
            shield.front.fill(cloth, 2, 2, 5, 8)
            shield.front.vline(3, GOLD, 2, 8)
            shield.front.hline(4, GOLD, 2, 5)
            boss = offhand.cube((6.5, 11, -5.2), (1, 2, 1))
            boss.fill(GOLD_L)
        elif voc == 1:  # archers: hooded cloak, bracers, a recurve bow and a full quiver
            vest = body.cube((-4, 14, -2), (8, 10, 4), inflate=0.35)
            vest.fill(armor, noise=5)
            vest.front.vline(3, leather_d).vline(4, leather_d)
            strap = body.cube((-4, 14, -2.6), (8, 1, 1), rotation=(0, 0, 35), pivot=(0, 18, -2))
            strap.fill(leather_d)
            cloak = m.bone("cape", (0, 24, 2), parent="body").cube((-4.5, 9, 2.2), (9, 15, 1))
            cloak.fill(cloth, noise=6)
            cloak.back.ragged_bottom(3, n)
            hood = head.cube((-4, 24, -4), (8, 8, 8), inflate=0.55)
            hood.fill(cloth, noise=5)
            hood.front.fill(None, 1, 2, 7, 8)
            hood.bottom.fill(None)
            for bname in ("rightArm", "leftArm"):
                bone, x = arms[bname]
                bracer = bone.cube((x, 13, -2), (4, 4, 4), inflate=0.3)
                bracer.fill(leather, noise=4)
                bracer.band(1, 2, leather_d)
            quiver = body.cube((-3, 13, 2.5), (3, 10, 3), rotation=(0, 0, -20), pivot=(-1.5, 18, 3))
            quiver.fill(leather, noise=5)
            quiver.band(1, 2, leather_d)
            for i, x in enumerate((-3, -2, -1)):
                fletch = body.cube((x - 1.5, 23, 3), (1, 3, 1), rotation=(0, 0, -20), pivot=(-1.5, 18, 3))
                fletch.fill(["#e9e6dc", "#c9302c", "#e9e6dc"][i])
            grip = weapon.cube((-6.5, 10, -4.5), (1, 6, 1))
            grip.fill(leather_d)
            for y0, dz in ((4, -3.5), (16, -3.5)):
                limb = weapon.cube((-6.5, y0, dz), (1, 6, 1))
                limb.fill(armor if voc else "#8a6238", noise=4)
            for y0 in (2, 22):
                tip = weapon.cube((-6.5, y0, -2.5), (1, 2, 1))
                tip.fill(shade(armor, 0.7))
            string = weapon.cube((-6.5, 3, -1.5), (1, 20, 1), inflate=-0.4)
            string.fill("#f4f1ea", noise=0)
        elif voc == 2:  # mages: a long robe, a hat or hooded circlet, a spellbook, a crystal staff
            robe = body.cube((-4, 0, -2), (8, 12, 4), inflate=0.6)
            robe.fill(cloth, noise=4)
            robe.front.vline(3, GOLD, 0, 12).vline(4, GOLD, 0, 12)
            robe.top.fill(None)
            robe.bottom.fill(shade(cloth, 0.6))
            for f in robe.sides:
                f.hline(11, GOLD)
            stole = body.cube((-2, 12, -2.5), (4, 12, 1))
            stole.fill(cloth_d)
            stole.front.vline(0, GOLD).vline(3, GOLD)
            for bname in ("rightArm", "leftArm"):
                bone, x = arms[bname]
                sleeve = bone.cube((x, 12, -2), (4, 5, 4), inflate=0.45)
                sleeve.fill(cloth, noise=4)
                sleeve.band(0, 1, GOLD)
            if n == 5:  # the wizard's pointed hat
                brim = head.cube((-6, 31, -6), (12, 1, 12))
                brim.fill(cloth_d, noise=4)
                for i, size in enumerate((8, 6, 4, 2)):
                    tier = head.cube((-size / 2, 32 + i * 2.5, -size / 2 + i * 0.4), (size, 3, size))
                    tier.fill(cloth, noise=4)
                head.cube((-4, 32, -4), (8, 1, 8), inflate=0.1).fill(GOLD)
            else:  # the sorcerer's hood and circlet
                hood = head.cube((-4, 24, -4), (8, 8, 8), inflate=0.55)
                hood.fill(cloth_d, noise=5)
                hood.front.fill(None, 1, 1, 7, 8)
                hood.bottom.fill(None)
                circlet = head.cube((-0.5, 29.5, -4.8), (1, 1, 1))
                circlet.fill(orb, noise=0)
            book = body.cube((2.5, 9.5, -3), (3, 4, 2))
            book.fill("#5a2a1a", noise=3)
            book.front.border(GOLD)
            shaft = weapon.cube((-6.5, 0, -3.5), (1, 31, 1))
            shaft.fill("#4a321b", noise=4)
            stripes(shaft, GOLD_D, every=7, start=3)
            for dx, dz in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                prong = weapon.cube((-6.5 + dx, 31, -3.5 + dz), (1, 3, 1))
                prong.fill(GOLD)
            crystal = weapon.cube((-7, 32, -4), (2, 3, 2))
            crystal.fill(orb, noise=6)
        elif voc == 3:  # healers: white vestments, a tabard with a holy sign, a mitre or circlet, a haloed staff
            robe = body.cube((-4, 0, -2), (8, 12, 4), inflate=0.6)
            robe.fill(armor, noise=3)
            robe.top.fill(None)
            for f in robe.sides:
                f.hline(11, GOLD).hline(10, cloth_d)
            tabard = body.cube((-2, 2, -2.8), (4, 20, 1))
            tabard.fill(cloth, noise=2)
            tabard.front.border(GOLD)
            tabard.front.vline(1, orb, 12, 18).vline(2, orb, 12, 18)
            tabard.front.hline(14, orb, 0, 4)
            for bname in ("rightArm", "leftArm"):
                bone, x = arms[bname]
                sleeve = bone.cube((x, 12, -2), (4, 6, 4), inflate=0.45)
                sleeve.fill(armor, noise=3)
                sleeve.band(0, 1, GOLD)
            if n == 6:  # the priest's mitre
                mitre = head.cube((-3, 32, -3), (6, 5, 6))
                mitre.fill(armor, noise=2)
                mitre.front.vline(2, GOLD).vline(3, GOLD)
                mitre.front.hline(2, GOLD)
            else:
                circlet = head.cube((-4, 29, -4), (8, 1, 8), inflate=0.55)
                circlet.fill(GOLD)
                circlet.top.fill(None)
                circlet.bottom.fill(None)
            shaft = weapon.cube((-6.5, 0, -3.5), (1, 30, 1))
            shaft.fill("#f4f1ea", noise=2)
            stripes(shaft, GOLD, every=6, start=2)
            for dy, dz, w, h in ((30, -5.5, 5, 1), (34, -5.5, 5, 1), (31, -5.5, 1, 3), (31, -1.5, 1, 3)):
                ring = weapon.cube((-6.5, dy, dz), (1, h, w))
                ring.fill(GOLD)
            glow = weapon.cube((-7, 31, -4), (2, 3, 2))
            glow.fill(orb, noise=0)
        elif voc == 4:  # rogues: leathers, hood and mask, a short cloak, twin daggers, a belt of knives
            vest = body.cube((-4, 13, -2), (8, 11, 4), inflate=0.35)
            vest.fill(armor, noise=4)
            vest.front.vline(2, dark).vline(5, dark)
            for x in (-3, -1, 1):
                knife = body.cube((x, 11.5, -2.8), (1, 3, 1))
                knife.fill(steel)
            cloak = m.bone("cape", (0, 24, 2), parent="body").cube((-4, 14, 2.2), (8, 10, 1))
            cloak.fill(cloth, noise=5)
            cloak.back.ragged_bottom(3, n)
            hood = head.cube((-4, 24, -4), (8, 8, 8), inflate=0.55)
            hood.fill(cloth_d if n == 8 else cloth, noise=4)
            hood.front.fill(None, 1, 2, 7, 6 if n == 8 else 8)
            hood.bottom.fill(None)
            for bname, wbone in (("rightArm", weapon), ("leftArm", offhand)):
                bone, x = arms[bname]
                wrap = bone.cube((x, 12, -2), (4, 5, 4), inflate=0.3)
                wrap.fill(dark, noise=3)
                gx = -6.5 if wbone is weapon else 5.5
                hilt = wbone.cube((gx, 12.5, -5), (1, 1, 3))
                hilt.fill(leather_d)
                cross = wbone.cube((gx - 1, 12, -6), (3, 2, 1))
                cross.fill(dark)
                edge = wbone.cube((gx, 12, -13), (1, 2, 7))
                edge.fill(steel, noise=3)
                for f in (edge.right, edge.left):
                    f.hline(0, steel_l)
        else:  # bards: finery and a feathered hat or fur cloak, a lute in hand
            doublet = body.cube((-4, 13, -2), (8, 11, 4), inflate=0.35)
            doublet.fill(armor, noise=3)
            doublet.front.fill(cloth, 3, 0, 5, 11)
            for y in (2, 5, 8):
                doublet.front.px(3, y, GOLD_L)
                doublet.front.px(4, y, GOLD_L)
            for bname in ("rightArm", "leftArm"):
                bone, x = arms[bname]
                puff = bone.cube((x, 19, -2), (4, 4, 4), inflate=0.5)
                puff.fill(cloth, noise=4)
                puff.band(1, 2, armor)
            if n == 10:  # the minstrel's feathered hat
                hat = head.cube((-5, 31, -5), (10, 1, 10))
                hat.fill(armor, noise=3)
                crown = head.cube((-3.5, 32, -3.5), (7, 2, 7))
                crown.fill(armor, noise=3)
                crown.band(0, 1, GOLD)
                feather = head.cube((2, 33, 0), (1, 6, 3), rotation=(-25, 0, 15), pivot=(2.5, 33, 1))
                feather.fill(cloth, noise=6)
            else:  # the skald's fur mantle
                fur = m.bone("cape", (0, 24, 2), parent="body").cube((-5, 13, 1.5), (10, 11, 2))
                fur.fill("#8a7558", noise=14)
                collar = body.cube((-5, 22, -3), (10, 3, 6), inflate=0.2)
                collar.fill("#a8946a", noise=16)
                collar.front.fill(None, 3, 0, 7, 3)
                if helmet:
                    cap = head.cube((-4, 29, -4), (8, 3, 8), inflate=0.6)
                    cap.fill(armor, noise=4)
                    cap.bottom.fill(None)
                    for x in (-5.5, 4.5):
                        horn = head.cube((x, 30, -1), (1, 3, 1))
                        horn.fill(BONE)
            lute = weapon.cube((-8, 8, -7), (3, 5, 4))
            lute.fill("#8a5a2a", noise=5)
            lute.front.px(1, 2, "#2a1a10")
            neck = weapon.cube((-7, 12.5, -15), (1, 1, 8))
            neck.fill("#5a3a1a")
            pegs = weapon.cube((-7.5, 12, -16.5), (2, 2, 2))
            pegs.fill("#3a2410")
            glow = weapon.cube((-7.5, 13.5, -6.5), (2, 1, 1))
            glow.fill(orb, noise=0)
        if not any(b.name == "cape" for b in m.bones):
            m.bone("cape", (0, 24, 2), parent="body")  # every look shares the bones the party's animations move
        return m
    return build


RETAINERS = [_hero(n) for n in range(len(RETAINER_LOOKS))]


def _wings(m, color, light, span=10):
    """Adds a pair of flat feathered wings (rightWing / leftWing) to a humanoid model."""
    for name, x, pivot, ry in (("rightWing", -3 - span, (-3, 20, 2), 28), ("leftWing", 3, (3, 20, 2), -28)):
        wing = m.bone(name, pivot, parent="body", rotation=(0, ry, 0)).cube((x, 10, 2), (span, 14, 1))
        wing.fill(None, noise=0)
        outer_left = name == "rightWing"
        for f, flip in ((wing.front, not outer_left), (wing.back, outer_left)):
            for xx in range(span):
                d = span - 1 - xx if flip else xx  # 0 = tip
                top = max(0, 3 - d)
                bottom = 13 - (2, 0, 1)[d % 3] - max(0, 4 - d)
                for yy in range(top, bottom + 1):
                    f.px(xx, yy, light if (yy + d) % 3 == 0 or yy == bottom else color)


def _angel(name, armor, armor_l, armor_d, cloth, cloth_d, weapon_kind, orb, wing, wing_l):
    m = _soldier(name, "#fff1c9", "#f6d968", armor, armor_l, armor_d, cloth, cloth_d, helmet=True,
                 weapon_kind=weapon_kind, orb=orb)
    _wings(m, wing, wing_l)
    head = next(b for b in m.bones if b.name == "head")
    halo = head.cube((-3, 34, -3), (6, 1, 6))
    halo.fill("#ffe14d", noise=0)
    halo.top.fill(None, 1, 1, 5, 5)
    halo.bottom.fill(None, 1, 1, 5, 5)
    return m


def archangel_flame():
    return _angel("archangel_flame", "#d9a92b", "#f6d968", "#96701a", "#f4f1ea", "#c9c3b5", "sword", "#ff7a1a",
                  "#f4f1ea", "#ffd9a0")


def dominion_authority():
    return _angel("dominion_authority", "#c9d1df", "#f2f5f9", "#8e96a6", "#3f7fe0", "#2a5aa8", "staff", "#fff6c9",
                  "#eaf7ff", "#bfe3f5")


def theocracy_priest():
    return _soldier("theocracy_priest", "#e0b48c", "#3a2a1f", "#d9d4c4", "#f4f1ea", "#a8a290", "#f4f1ea", "#c9c3b5",
                    helmet=False, weapon_kind="staff", orb="#f6d968")


def nigun():
    return _soldier("nigun", "#d2a07a", "#1f1a16", "#2a2a33", "#45454f", "#15151a", "#e9e6dc", "#b9b4a4",
                    helmet=False, weapon_kind="staff", orb="#9fd4ff")


def climb():
    return _soldier("climb", "#f0d2b8", "#e6c463", "#e9edf2", "#ffffff", "#aab2c0", "#3f66a8", "#2a4a80",
                    helmet=False, weapon_kind="sword")


def zesshi():
    m = _soldier("zesshi", "#f1dccb", "#f4f3f5", "#1b1a22", "#35323f", "#0c0b10", "#2a2433", "#17141d",
                 helmet=False, weapon_kind="scythe")
    head = next(b for b in m.bones if b.name == "head").cubes[0]
    # Her hair is white on one side and black on the other.
    for f in (head.front, head.top, head.back):
        for y in range(f.h):
            for x in range(f.w // 2, f.w):
                if f.get(x, y)[:3] in ((244, 243, 245),) or sum(f.get(x, y)[:3]) > 600:
                    f.px(x, y, "#1b1a22")
    head.left.fill("#1b1a22", 0, 0, None, 3)
    head.left.fill("#1b1a22", 4, 3, 8, 5)
    head.front.px(1, 4, "#1b1a22")
    head.front.px(6, 4, "#e9e6dc")
    return m


def shadow_demon():
    m = _brute("shadow_demon", "#221a2c", "#3d3050", "#120d18")
    head = next(b for b in m.bones if b.name == "head")
    for sx in (-4, 2):
        horn = head.cube((sx, 30, -1), (2, 3, 2))
        horn.fill("#0d0a12")
        horn.band(0, 1, "#d4202a")
    return m


def evil_lord_wrath():
    m = _brute("evil_lord_wrath", "#8f1a14", "#c2452a", "#4a0d0a")
    head = next(b for b in m.bones if b.name == "head")
    for sx in (-5, 3):
        base = head.cube((sx, 29, -1), (2, 2, 2))
        base.fill("#2a1210")
        up = head.cube((sx + (-1 if sx < 0 else 1), 31, -1), (2, 5, 2))
        up.fill("#1b0d0a")
        up.band(0, 2, "#ff7a1a")
    _wings(m, "#2a1210", "#8f1a14", span=12)
    return m


def eclair():
    m = Model("eclair", bounds=(2, 2.5, 0.8))
    black, black_l, white = "#1b1a22", "#35323f", "#f4f3f5"
    pal = {"K": black, "k": black_l, "W": white, "w": "#c9c7d0", "Y": "#f2a01b", "y": "#c97a10", "R": "#b3261f",
           "e": "#0b090d"}
    body = m.bone("body", (0, 8, 0))
    torso = body.cube((-4, 2, -3), (8, 10, 6))
    torso.fill(black)
    art(torso.front, [
        "KkWWWWkK",
        "KWRRRRWK",
        "KWWRRWWK",
        "KWWWWWWK",
        "KWWWWWWK",
        "KWWWWWWK",
        "KWWWWWWK",
        "KWWWWWWK",
        "KkWWWWkK",
        "KKwWWwKK",
    ], pal)
    torso.back.vline(3, black_l, 0, 10)
    tail = body.cube((-1, 2, 3), (2, 2, 2))
    tail.fill(black_l)
    head = m.bone("head", (0, 12, 0), parent="body")
    hd = head.cube((-3, 12, -3), (6, 6, 6))
    hd.fill(black, noise=3)
    art(hd.front, ["KKKKKK", "KkKKkK", "WeKKeW", "WWYYWW", "KWYYWK", "KKWWKK"], pal)
    for f in (hd.right, hd.left):
        f.fill(white, 0, 2, 2, 5)
    beak = head.cube((-1, 13, -5), (2, 2, 2))
    beak.fill("#f2a01b")
    beak.bottom.fill("#c97a10")
    crest = head.cube((-1, 18, -2), (2, 2, 3))
    crest.fill("#f2a01b")
    for name, x, px in (("rightArm", -5, -4), ("leftArm", 4, 4)):
        arm = m.bone(name, (px, 11, 0), parent="body").cube((x, 4, -2), (1, 7, 4))
        arm.fill(black)
        arm.band(6, 7, black_l)
    for name, x, px in (("rightLeg", -3, -2), ("leftLeg", 1, 2)):
        leg = m.bone(name, (px, 2, 0)).cube((x, 0, -4), (2, 2, 5))
        leg.fill("#f2a01b")
        leg.band(1, 2, "#c97a10")
    return m


def vampire_bride():
    m, head, body, pal = _pleiades("vampire_bride", "#eee6ea", "#1b1a22", "#35323f", "#e0202c",
                                   dress="#e9e6ee", accent="#a3121f", bun=False)
    veil = body.cube((-4, 12, 2), (8, 12, 1))
    veil.fill("#1b1a22")
    for x in (1, 4, 6):
        veil.back.vline(x, "#35323f", 0, 11)
    veil.back.ragged_bottom(2, seed=9)
    return m


def dwarf():
    return _soldier("dwarf", "#d9a07a", "#b5651d", "#6b6f7a", "#9aa0aa", "#454852", "#7a4a2a", "#55301a",
                    helmet=True, weapon_kind="hammer", mask="#b5651d", orb="#ff7a1a")


def frost_dragon(name="frost_dragon", sc="#bfe3f5", sc_l="#eaf7ff", sc_d="#7fb4d6", belly="#5f8fb8",
                 eye="#f2c21b"):
    m = Model(name, bounds=(7, 6, 2.0))
    pal = {"S": sc, "s": sc_l, "D": sc_d, "B": belly, "e": eye, "K": "#15202b", "T": "#ffffff"}
    body = m.bone("body", (0, 12, 0))
    b = body.cube((-6, 8, -10), (12, 10, 20))
    b.fill(sc, noise=6)
    b.bottom.fill(belly)
    for f in (b.right, b.left):
        f.fill(belly, 0, 8, None, 10)
        for x in range(2, f.w, 4):
            f.vline(x, sc_d, 1, 8)
    b.top.vline(5, sc_d, 0, 20).vline(6, sc_l, 0, 20)
    for z in (-8, -3, 2, 7):
        spine = body.cube((-1, 18, z), (2, 3, 2))
        spine.fill(sc_l)
        spine.band(0, 1, "#ffffff")
    neck = body.cube((-3, 13, -18), (6, 7, 9))
    neck.fill(sc, noise=6)
    neck.bottom.fill(belly)
    head = m.bone("head", (0, 17, -17), parent="body")
    h = head.cube((-4, 15, -26), (8, 7, 9))
    h.fill(sc, noise=5)
    art(h.front, ["SsSSSSsS", "SDDSSDDS", "SeKSSKeS", "SSSSSSSS", "DSSSSSSD", "SSSSSSSS", "DSSSSSSD"], pal)
    for f in (h.right, h.left):
        f.px(2, 2, "#f2c21b")
        f.px(3, 2, "#15202b")
    snout = head.cube((-3, 15, -32), (6, 4, 6))
    snout.fill(sc_l, noise=5)
    art(snout.front, ["sKssKs", "ssssss", "TKTTKT", "BBBBBB"], pal)
    for f in (snout.right, snout.left):
        f.hline(2, "#ffffff")
        f.hline(3, belly)
    for sx in (-4, 2):
        horn = head.cube((sx, 22, -20), (2, 5, 2))
        horn.fill("#ffffff")
        horn.band(3, 5, sc_d)
    for name, x, z in (("leg0", -8, -9), ("leg1", 4, -9), ("leg2", -8, 5), ("leg3", 4, 5)):
        leg = m.bone(name, (x + 2, 9, z + 2), parent="body").cube((x, 0, z), (4, 9, 4))
        leg.fill(sc, noise=5)
        leg.band(7, 9, sc_d)
        for f in leg.sides:
            f.px(0, 8, "#ffffff")
            f.px(2, 8, "#ffffff")
    tail = m.bone("tail", (0, 13, 10), parent="body")
    t1 = tail.cube((-3, 10, 10), (6, 6, 10))
    t2 = m.bone("tail2", (0, 13, 20), parent="tail").cube((-2, 11, 20), (4, 4, 10))
    t3 = m.bone("tail3", (0, 13, 30), parent="tail2").cube((-1, 12, 30), (2, 2, 8))
    for c in (t1, t2, t3):
        c.fill(sc, noise=5)
        c.bottom.fill(belly)
        for f in (c.right, c.left, c.top):
            for x in range(2, f.w, 3):
                f.vline(x, sc_d)
    for name, x, pivot, rz in (("rightWing", -22, (-6, 17, -4), 18), ("leftWing", 6, (6, 17, -4), -18)):
        wing = m.bone(name, pivot, parent="body", rotation=(0, 0, rz)).cube((x, 17, -8), (16, 1, 14))
        wing.fill(sc_d, noise=5)
        for f in (wing.top, wing.bottom):
            for xx in range(0, 16, 5):
                f.vline(xx, sc_l)
            f.hline(0, sc_l)
            for xx in range(16):
                if (xx // 3) % 2:
                    f.px(xx, 13, None)
    return m


def frost_breath():
    m = Model("frost_breath", bounds=(1, 1, 0.25))
    body = m.bone("body", (0, 2, 0))
    c = body.cube((-2, 0, -2), (4, 4, 4))
    pal = {"C": "#bfe8ff", "W": "#ffffff", "D": "#6fb4de"}
    for f in c.faces:
        art(f, ["DCCD", "CWWC", "CWWC", "DCCD"], pal)
    a = body.cube((-3, 1, -1), (6, 2, 2))
    a.fill("#e6f6ff", noise=8)
    b2 = body.cube((-1, 1, -3), (2, 2, 6))
    b2.fill("#bfe8ff", noise=8)
    return m


def lightning_bolt():
    m = Model("lightning_bolt", bounds=(1, 1, 0.25))
    body = m.bone("body", (0, 2, 0))
    c = body.cube((-2, 0, -2), (4, 4, 4))
    pal = {"Y": "#ffe94d", "W": "#ffffff", "B": "#9fd8ff"}
    for f in c.faces:
        art(f, ["BYYB", "YWWY", "YWWY", "BYYB"], pal)
    a = body.cube((-4, 1, -1), (8, 2, 2))
    a.fill("#fff6a8", noise=8)
    b = body.cube((-1, 1, -4), (2, 2, 8))
    b.fill("#cfeaff", noise=8)
    d = body.cube((-1, -2, -1), (2, 8, 2))
    d.fill("#fff6a8", noise=8)
    return m



# ------------------------------------------------------ v5.0: the wider world
def skeletal_dragon():
    return frost_dragon("skeletal_dragon", "#d8d0b4", "#f1eee0", "#a59c7e", "#6e664c", eye="#b6ff4a")


def khajiit():
    return _soldier("khajiit", "#d9c7b0", "#d9c7b0", "#5a1414", "#7a2020", "#3a0c0c", "#2a0a0a", "#1a0606",
                    helmet=False, weapon_kind="staff", orb="#7a1fff")


def gigant_basilisk():
    return _beast("gigant_basilisk", "#3f5a2a", "#5f7f3f", "#f2e21b", "#7a8a4a", "#55652f")


def frost_giant():
    return _brute("frost_giant", "#9fc4dc", "#cfe6f5", "#6a93b0")


def beastman():
    return _lizard("beastman", "#c07a2a", "#e0a04a", "#7a4a18", "#f1e0b8", ("#8a8f98", "#c9ced6"))


def lakyus():
    return _soldier("lakyus", "#f6dcc8", "#f0d060", "#e9edf2", "#ffffff", "#aab2c0", "#3a4fb0", "#27357a",
                    helmet=False, weapon_kind="sword")


def enri():
    return _soldier("enri", "#f0cfae", "#b5642e", "#8a6a4a", "#a8845c", "#5f4830", "#b03a2e", "#7a251d",
                    helmet=False, weapon_kind="none")


def zero():
    return _soldier("zero", "#b9835a", "#b9835a", "#5a3a2a", "#7a5238", "#3a2418", "#3a3a44", "#22222a",
                    helmet=False, weapon_kind="none")


def dark_young():
    return _beast("dark_young", "#0c0b10", "#1f1c28", "#c05bff", "#2a2433", "#17141d")


def jaldabaoth():
    m = _soldier("jaldabaoth", "#e8c9a8", "#1b1a22", "#a3121f", "#c93a3a", "#5f0a12", "#2a0a0e", "#17060a",
                 helmet=False, weapon_kind="none", mask="#d8d0c0")
    _wings(m, "#3a0d12", "#6a1a20")
    return m



# ------------------------------------------------ v6.0: arena, elves, paladins
def go_gin():
    return _brute("go_gin", "#8a9a6a", "#aabb88", "#5a6a44")


def elf_ranger():
    return _soldier("elf_ranger", "#f2dcc4", "#e9e2a8", "#3f6a45", "#5f8f66", "#2a4a2f", "#7a6a45", "#55482f",
                    helmet=False, weapon_kind="bow")


def decem():
    return _soldier("decem", "#e8d2bc", "#f4f3f5", "#2f5a3a", "#4a8055", "#1c3a24", "#d9a92b", "#96701a",
                    helmet=False, weapon_kind="staff", orb="#63ff6b")


def behemoth():
    return _brute("behemoth", "#7a6a55", "#9a8a72", "#4f4436")


def neia():
    return _soldier("neia", "#f0d2b8", "#d9c05a", "#6a5238", "#8a6e4c", "#463522", "#3f4a5a", "#2a323f",
                    helmet=False, weapon_kind="bow")


def remedios():
    return _soldier("remedios", "#f0d2b8", "#5a3a1f", "#e9edf2", "#ffffff", "#aab2c0", "#b03030", "#7a1f1f",
                    helmet=False, weapon_kind="sword")


def paladin():
    return _soldier("paladin", "#e0b48c", "#3a2a1f", "#d9dde6", "#f4f6fa", "#9aa2b0", "#f4f1ea", "#c9c3b5",
                    helmet=True, weapon_kind="sword")


def bafolk():
    return _lizard("bafolk", "#8a7a66", "#a89880", "#5a4e40", "#d6cfb6", ("#6b4a32", "#8a6a4a"))


def eight_edge_assassin():
    return _beast("eight_edge_assassin", "#15131a", "#2a2633", "#d4202a", "#3a3a44", "#22222a")


def arena_master():
    return _soldier("arena_master", "#d6a57e", "#2a2a2a", "#a8262a", "#c93a3a", "#6e1f1c", "#d9a92b", "#96701a",
                    helmet=False, weapon_kind="none")


def platinum_dragon_lord():
    return frost_dragon("platinum_dragon_lord", "#d9dde6", "#ffffff", "#9aa2b0", "#b8bcc8", eye="#59d0ff")


def rubedo():
    m, _head, _body, _pal = _pleiades("rubedo", "#f6e2d4", "#c2171d", "#7a1016", "#e0202c", dress="#f4f1ea",
                                      accent="#c2171d", bun=False)
    return m



# ------------------------------------------------- v6.5: more detail on every body
# The shared bodies are dressed after they are built: hair with depth, pauldrons, capes, pouches,
# tusks, ears, tails and spines.  Each wrapper keeps the name of the builder it extends, so every
# creature made from that body gets the detail.
def _bone(m, name):
    return next(b for b in m.bones if b.name == name)


def _hair_layer(m, hair, long=False):
    """A second, slightly larger head layer carrying the hair, so it stands off the face."""
    layer = _bone(m, "head").cube((-4, 24, -4), (8, 8, 8), inflate=0.45)
    hair_d = shade(hair, 0.82)
    layer.top.fill(hair)
    layer.top.noise(8, 3)
    layer.back.fill(hair, 0, 0, None, 8 if long else 6)
    layer.back.noise(8, 4)
    layer.back.hline(7 if long else 5, hair_d)
    for face, x0, x1 in ((layer.right, 0, 8), (layer.left, 0, 8)):
        face.fill(hair, x0, 0, x1, 4)
        face.noise(8, 5)
        face.hline(3, hair_d)
    layer.right.fill(hair, 0, 4, 4, 7 if long else 5)   # the back half hangs lower
    layer.left.fill(hair, 4, 4, 8, 7 if long else 5)
    layer.front.fill(hair, 0, 0, None, 2)
    layer.front.fill(hair_d, 0, 1, 2, 3)
    layer.front.fill(hair_d, 6, 1, 8, 3)
    return layer


# Who wears a cape, and in which colour (None: the darker cloth colour of their outfit).
CAPES = {"climb": "#2a4a80", "lakyus": None, "remedios": "#f4f1ea", "paladin": None, "imperial_knight": "#a8262a",
         "guard": None, "zesshi": "#17141d", "nigun": "#e9e6dc", "khajiit": "#3a0c0c", "decem": "#d9a92b",
         "arena_master": "#96701a", "theocracy_priest": None, "zero": None, "soldier": None}

_plain_soldier = _soldier


def _soldier(name, skin, hair, armor, armor_l, armor_d, cloth, cloth_d, helmet, weapon_kind, mask=None,
             orb="#c05bff"):
    m = _plain_soldier(name, skin, hair, armor, armor_l, armor_d, cloth, cloth_d, helmet, weapon_kind, mask, orb)
    body = _bone(m, "body")
    if helmet:
        for bname, x in (("rightArm", -8), ("leftArm", 4)):  # pauldrons
            pad = _bone(m, bname).cube((x, 21, -2), (4, 3, 4), inflate=0.7)
            pad.fill(armor_l)
            pad.band(2, 3, armor_d)
            pad.top.border(armor)
    elif hair != skin:  # the bald keep their heads bare
        _hair_layer(m, hair)
    pouch = body.cube((2, 10, -3), (3, 3, 1))
    pouch.fill("#6b4a36")
    pouch.front.hline(0, "#8a6a4a")
    pouch.front.px(1, 1, GOLD)
    if name in CAPES or name.startswith("retainer_"):
        colour = CAPES.get(name) or cloth_d
        if not name.startswith("retainer_") or helmet:
            # Named characters get a cape that swings on its own bone; the retainer looks share one
            # skeleton, so theirs hangs from the body.
            hanger = body if name.startswith("retainer_") else m.bone("cape", (0, 24, 2), parent="body")
            cape = hanger.cube((-4, 11, 2), (8, 13, 1))
            cape.fill(colour)
            cape.back.vshade(1.0, 0.75)
            cape.back.ragged_bottom(2, 7)
            cape.back.hline(0, shade(colour, 1.3))
    return m


_plain_pleiades = _pleiades


def _pleiades(name, skin, hair, hair_d, eye, dress="#1f1e28", accent="#b3261f", face=None, glasses=False,
              sleeve=None, glove=None, bun=True):
    m, head, body, pal = _plain_pleiades(name, skin, hair, hair_d, eye, dress, accent, face, glasses, sleeve, glove,
                                         bun)
    _hair_layer(m, hair, long=True)
    bow = body.cube((-3, 13, 2), (6, 4, 1))  # the bow of the apron at the back
    bow.fill(accent)
    bow.back.vline(2, shade(accent, 0.7))
    bow.back.vline(3, shade(accent, 0.7))
    return m, head, body, pal


_plain_brute = _brute


def _brute(name="ogre", o="#b08a5a", o_l="#cba878", o_d="#7d5f3a"):
    m = _plain_brute(name, o, o_l, o_d)
    head, body = _bone(m, "head"), _bone(m, "body")
    for x in (-3, 2):  # tusks
        tusk = head.cube((x, 25, -5), (1, 2, 1))
        tusk.fill("#f1eee0")
    for x in (-6, 4):  # ears
        ear = head.cube((x, 28, -1), (2, 3, 1))
        ear.fill(o_d)
        ear.front.fill(o, 0, 0, None, 2)
    for x in (-8, 6):  # knots of muscle on the shoulders
        knot = body.cube((x, 22, -2), (2, 3, 4))
        knot.fill(o_l)
    flap = body.cube((-3, 7, -4), (6, 5, 1))  # loincloth
    flap.fill("#4a3323")
    flap.front.ragged_bottom(2, 5)
    flap.front.hline(0, "#6b4a32")
    return m


_plain_beast = _beast


def _beast(name="soul_eater", dark="#1c2026", dark_l="#343b45", glow="#59e0c8", BONE=BONE, BONE_D=BONE_D):
    m = _plain_beast(name, dark, dark_l, glow, BONE, BONE_D)
    head, body = _bone(m, "head"), _bone(m, "body")
    for z in (-6, -2, 2):  # spines along the back
        spine = body.cube((-1, 19, z), (2, 2, 2))
        spine.fill(BONE)
        spine.top.fill(BONE_D)
    for x in (-3, 2):  # ears
        ear = head.cube((x, 16, -10), (1, 2, 1))
        ear.fill(dark_l)
    tail = m.bone("tail", (0, 13, 8), parent="body", rotation=(-25, 0, 0))
    t1 = tail.cube((-1, 12, 8), (2, 2, 7))
    t1.fill(dark)
    tip = tail.cube((-1.5, 11.5, 15), (3, 3, 3))
    tip.fill(glow)
    return m


_plain_lizard = _lizard


def _lizard(name="zaryusu", sc="#3f7a4a", sc_l="#5fa068", sc_d="#27502f", belly="#c9c58f",
            blade_c=("#bfe8ff", "#f4fbff")):
    m = _plain_lizard(name, sc, sc_l, sc_d, belly, blade_c)
    body = _bone(m, "body")
    for y in (21, 18, 15):  # a ridge of scales down the back
        ridge = body.cube((-0.5, y, 2), (1, 2, 2))
        ridge.fill(sc_d)
        ridge.top.fill(sc_l)
    for bname, x in (("rightArm", -8), ("leftArm", 4)):  # bracers
        bracer = _bone(m, bname).cube((x, 14, -2), (4, 3, 4), inflate=0.3)
        bracer.fill("#6b4226")
        bracer.band(0, 1, "#8a5a36")
    return m


_plain_dragon = frost_dragon


def frost_dragon(name="frost_dragon", sc="#bfe3f5", sc_l="#eaf7ff", sc_d="#7fb4d6", belly="#5f8fb8",
                 eye="#f2c21b"):
    m = _plain_dragon(name, sc, sc_l, sc_d, belly, eye)
    head, body = _bone(m, "head"), _bone(m, "body")
    for x in (-5, 4):  # a second, swept-back pair of horns and cheek spikes
        horn = head.cube((x, 20, -17), (1, 4, 1))
        horn.fill(sc_l)
        cheek = head.cube((x, 16, -22), (1, 1, 3))
        cheek.fill(sc_d)
    for z in (-14, -4, 6):  # plates along the flanks
        for x in (-7, 6):
            plate = body.cube((x, 12, z), (1, 4, 5))
            plate.fill(sc_d)
            plate.top.fill(sc_l)
    spike = _bone(m, "tail3").cube((-2, 11, 36), (4, 4, 3))  # a club of spikes at the tip of the tail
    spike.fill(sc_l)
    spike.back.fill(sc_d)
    return m



# ------------------------------------------------------- v6.6: the great dragons
# The three dragons are built far larger than anything else and each in its own way: the Frost
# Dragon bristles with ice, the Skeletal Dragon is an open cage of bone round a soul fire, and the
# Platinum Dragon Lord is plated and crowned.  They share one skeleton so they share their
# animations: body, neck, neck2, head, jaw, leg0-3, tail, tail2-4 and two-part wings.
def _great_dragon(name, style, scale_c, light, dark, belly, horn, membrane, eye, glow):
    m = Model(name, bounds=(16, 10, 3.5))
    m.SIZES = Model.SIZES + [(512, 256), (512, 512)]
    bone_style, ice, plated = style == "bone", style == "ice", style == "plated"
    pal = {"S": scale_c, "s": light, "D": dark, "B": belly, "e": eye, "K": "#0e0f14", "T": "#f4f1e6", "H": horn,
           "G": glow}

    def scales(cube, base=scale_c, seed=3):
        cube.fill(base, noise=7, seed=seed)
        for f in cube.sides:  # rows of overlapping scales
            for y in range(2, f.h, 3):
                f.hline(y, dark)
        cube.bottom.fill(belly)
        return cube

    body = m.bone("body", (0, 22, 0))
    if bone_style:
        # an open ribcage round a soul fire, between solid shoulders and hips
        spine = body.cube((-2, 25, -16), (4, 4, 34))
        spine.fill(scale_c, noise=8)
        for z in range(-12, 14, 5):
            for x in (-9, 7):
                rib = body.cube((x, 13, z), (2, 13, 2))
                rib.fill(light, noise=6)
                rib.band(11, 13, dark)
            arch = body.cube((-9, 26, z), (18, 2, 2))
            arch.fill(light, noise=6)
        sternum = body.cube((-2, 12, -13), (4, 2, 28))
        sternum.fill(dark)
        fire = body.cube((-4, 16, -8), (8, 7, 16))
        fire.fill(glow, noise=14)
        fire.top.fill(shade(glow, 1.3))
        for z, depth in ((-20, 6), (15, 6)):  # shoulder and hip girdles
            block = body.cube((-9, 13, z), (18, 15, depth))
            block.fill(scale_c, noise=8)
            block.band(0, 2, light)
            block.band(12, 15, dark)
    else:
        torso = scales(body.cube((-9, 14, -16), (18, 16, 34)))
        torso.top.fill(dark, 6, 0, 12, None)  # darker along the spine
        chest = scales(body.cube((-8, 12, -21), (16, 15, 6)), seed=5)
        chest.front.fill(belly, 3, 4, 13, 15)
        for y in range(6, 15, 3):
            chest.front.hline(y, shade(belly, 0.8), 3, 13)
        if plated:
            for z in (-12, -2, 8):  # overlapping armour plates down the flanks
                for x in (-10, 9):
                    plate = body.cube((x, 17, z), (1, 9, 8))
                    plate.fill(light)
                    plate.band(0, 1, glow)
                    plate.band(8, 9, dark)
            gem = body.cube((-2, 17, -22), (4, 4, 1))
            gem.fill(glow)
            gem.front.border(horn)
    for i, z in enumerate(range(-14, 18, 5)):  # the ridge along the back
        tall = 7 if ice else 4 if bone_style else 5
        ridge = body.cube((-1, 30, z), (2, tall - (i % 2), 3))
        ridge.fill(light if ice else horn)
        ridge.top.fill(glow if ice else shade(horn, 1.2))

    # ------------------------------------------------------------ neck and head
    neck = m.bone("neck", (0, 26, -18), parent="body", rotation=(-28, 0, 0))
    n1 = neck.cube((-5, 21, -31), (10, 10, 15))
    n1.fill(scale_c, noise=7) if bone_style else scales(n1, seed=7)
    neck2 = m.bone("neck2", (0, 26, -31), parent="neck", rotation=(-18, 0, 0))
    n2 = neck2.cube((-4, 22, -43), (8, 8, 13))
    n2.fill(scale_c, noise=7) if bone_style else scales(n2, seed=9)
    for bone_, z0 in ((neck, -30), (neck2, -42)):
        for z in range(z0, z0 + 12, 4):
            spike = bone_.cube((-1, 30 if bone_ is neck2 else 31, z), (2, 5 if ice else 3, 2))
            spike.fill(light if ice else horn)
    head = m.bone("head", (0, 26, -43), parent="neck2", rotation=(46, 0, 0))
    skull = head.cube((-6, 21, -56), (12, 11, 14))
    skull.fill("#e9e3cf" if bone_style else scale_c, noise=7)
    skull.top.fill(light if not bone_style else "#f4f1e6")
    for face, flip in ((skull.right, False), (skull.left, True)):  # eyes under a heavy brow
        ex = 3 if not flip else face.w - 6
        face.fill(dark, ex - 1, 2, ex + 4, 3)
        face.fill("#0e0f14", ex, 3, ex + 3, 6)
        face.fill(eye, ex, 4, ex + 3, 5)
        face.px(ex + (0 if flip else 2), 4, "#ffffff")
    snout = head.cube((-4, 22, -67), (8, 7, 11))
    snout.fill("#e9e3cf" if bone_style else scale_c, noise=7)
    snout.top.fill(light if not bone_style else "#f4f1e6")
    snout.front.fill("#0e0f14", 1, 1, 3, 3)   # nostrils
    snout.front.fill("#0e0f14", 5, 1, 7, 3)
    for f in (snout.right, snout.left):  # upper teeth
        for x in range(1, f.w, 2):
            f.px(x, f.h - 1, "#f4f1e6")
        f.hline(f.h - 2, dark)
    jaw = m.bone("jaw", (0, 22, -55), parent="head")
    lower = jaw.cube((-4, 19, -66), (8, 3, 12))
    lower.fill("#d6cfb6" if bone_style else dark, noise=6)
    for f in (lower.right, lower.left):  # lower teeth
        for x in range(0, f.w, 2):
            f.px(x, 0, "#f4f1e6")
    lower.top.fill("#7a1f28" if not bone_style else "#3a3528")  # the inside of the mouth
    horns = [(-6, 31, -50, 2, 3, 12), (4, 31, -50, 2, 3, 12), (-7, 28, -48, 1, 2, 8), (6, 28, -48, 1, 2, 8)]
    if plated:  # a crown of horns
        horns += [(-3, 32, -48, 2, 6, 2), (1, 32, -48, 2, 6, 2), (-1, 32, -53, 2, 4, 2)]
    if ice:  # a beard of icicles
        horns += [(-3, 17, -62, 1, 3, 1), (2, 17, -62, 1, 3, 1), (-1, 16, -58, 2, 4, 2)]
    for x, y, z, w, h, d in horns:
        spur = (jaw if y < 20 else head).cube((x, y, z), (w, h, d))
        spur.fill(light if (ice and y < 20) else horn)
        spur.back.fill(shade(horn, 1.25))

    # --------------------------------------------------------------------- legs
    for i, (x, z) in enumerate(((-14, -17), (8, -17), (-14, 10), (8, 10))):
        leg = m.bone(f"leg{i}", (x + 3, 17, z + 4), parent="body")
        thigh = leg.cube((x, 6, z), (6, 13, 8))
        thigh.fill(scale_c, noise=7) if bone_style else scales(thigh, seed=11 + i)
        if bone_style:
            thigh.band(0, 2, light)
            thigh.band(11, 13, dark)
        foot = leg.cube((x - 1, 0, z - 3), (8, 6, 11))
        foot.fill(dark if not bone_style else scale_c, noise=6)
        for cx in (x - 1, x + 2, x + 5):  # claws
            claw = leg.cube((cx, 0, z - 6), (2, 2, 3))
            claw.fill("#f4f1e6")

    # --------------------------------------------------------------------- tail
    parent, z = "body", 18
    for i, (w, h, length) in enumerate(((12, 12, 15), (9, 9, 15), (6, 6, 15), (4, 4, 13))):
        name_ = "tail" if i == 0 else f"tail{i + 1}"
        tail = m.bone(name_, (0, 24, z), parent=parent)
        seg = tail.cube((-w / 2, 24 - h / 2 - 1, z), (w, h, length))
        seg.fill(scale_c, noise=7) if bone_style else scales(seg, seed=17 + i)
        if bone_style:
            for zz in range(2, length, 4):
                for f in seg.sides[::2]:
                    f.vline(zz, dark)
        fin = tail.cube((-1, 24 + h / 2 - 1, z + 3), (2, 4 if ice else 3, 3))
        fin.fill(light if ice else horn)
        parent, z = name_, z + length
    tip = _bone(m, "tail4")
    if ice:  # a mace of ice
        for x, y in ((-4, 21), (2, 21), (-1, 25), (-1, 18)):
            shard = tip.cube((x, y, z - 4), (2, 3, 6))
            shard.fill(light)
            shard.back.fill(glow)
    elif plated:  # a bladed fan
        fan = tip.cube((-6, 22, z - 3), (12, 1, 8))
        fan.fill(light)
        fan.top.border(glow)
    else:  # a spur of bone
        spur = tip.cube((-1, 20, z - 2), (2, 8, 5))
        spur.fill("#f4f1e6")

    # -------------------------------------------------------------------- wings
    def wing_skin(cube, tattered):
        """A wing skin seen from above and below: finger bones with skin stretched between."""
        for f in (cube.top, cube.bottom):
            f.fill(membrane)
            f.noise(6, 21)
            for x in range(0, f.w, 6):  # fingers
                f.vline(x, horn)
            for x in range(f.w):  # a scalloped trailing edge
                depth = 2 + (x % 6 if x % 12 < 6 else 5 - x % 6)
                for y in range(f.h - depth, f.h):
                    f.px(x, y, (0, 0, 0, 0))
            if tattered:  # holes where the skin has rotted through
                rnd = random.Random(name + str(f.w))
                for _ in range(14):
                    hx, hy = rnd.randrange(1, f.w - 3), rnd.randrange(2, f.h - 4)
                    for dx in range(rnd.randrange(2, 5)):
                        for dy in range(rnd.randrange(2, 6)):
                            if (hx + dx) % 6:
                                f.px(hx + dx, hy + dy, (0, 0, 0, 0))
        for f in cube.sides:
            f.fill(shade(membrane, 0.8))

    for side, sign in (("right", -1), ("left", 1)):
        inner = m.bone(f"{side}Wing", (sign * 9, 29, -8), parent="body", rotation=(0, 0, sign * 24))
        x0 = -35 if sign < 0 else 9
        arm = inner.cube((x0, 28, -11), (26, 3, 4))
        arm.fill(scale_c if not bone_style else "#e9e3cf", noise=6)
        skin = inner.cube((x0, 29, -7), (26, 1, 26))
        wing_skin(skin, bone_style)
        outer = m.bone(f"{side}WingTip", (sign * 35, 29, -8), parent=f"{side}Wing", rotation=(0, 0, sign * -34))
        x1 = -63 if sign < 0 else 35
        arm2 = outer.cube((x1, 28, -11), (28, 2, 3))
        arm2.fill(scale_c if not bone_style else "#e9e3cf", noise=6)
        skin2 = outer.cube((x1, 29, -8), (28, 1, 22))
        wing_skin(skin2, bone_style)
        claw = outer.cube((x1 if sign < 0 else x1 + 26, 27, -13), (2, 2, 4))
        claw.fill("#f4f1e6")
    return m


def frost_dragon():
    return _great_dragon("frost_dragon", "ice", "#a9d6ee", "#eaf7ff", "#6fa6c9", "#dff1fb", "#cfe9f7", "#7fb8d8",
                         "#f2c21b", "#8fe9ff")


# ------------------------------------------------------------------ v8.6: the dead and the deep forest
def ghoul():
    """A grey-green eater of the dead: bare and gaunt, with long dark claws and a hungry yellow stare."""
    m = _soldier("ghoul", "#7d8a6a", "#2a2a22", "#4a4438", "#5f5848", "#2f2a22", "#3a3a2e", "#26261e",
                 helmet=False, weapon_kind="none")
    for bname, x in (("rightArm", -8), ("leftArm", 6)):
        bone = next(b for b in m.bones if b.name == bname)
        for i in range(3):
            claw = bone.cube((x + i * 0.9 - 0.2, 9.5, -2.5), (1, 3, 1))
            claw.fill("#1a1612")
    head = next(b for b in m.bones if b.name == "head")
    for x in (-3, 2):
        eye = head.cube((x, 28, -4.3), (1, 1, 1))
        eye.fill("#f2e21b", noise=0)
    return m


def wraith():
    """A shade of the Katze Plains: a hooded tatter of black and grave-teal with burning eyes."""
    return _lich("wraith", robe="#16202a", robe_l="#24404a", robe_d="#0a1015", trim_c="#3fb8a0", eye="#9cffe8")


def death_cavalier():
    """An undead knight of the plains, in black plate lit with spectral green, lance in hand."""
    return _soldier("death_cavalier", "#d8d0b4", "#1a1612", "#1d1b24", "#3a3644", "#0c0b10", "#1e5a44", "#0f3a2a",
                    helmet=True, weapon_kind="spear", orb="#59e0a0")


def _treant(name, bark, bark_l, bark_d, leaves, eye):
    m = _brute(name, bark, bark_l, bark_d)
    head = next(b for b in m.bones if b.name == "head")
    for x, z, h in ((-5, -3, 4), (1, -4, 5), (-2, 1, 6), (3, 1, 4), (-4, 3, 3)):
        crown = head.cube((x, 32, z), (4, h, 4))
        crown.fill(leaves, noise=16)
    for x, y in ((-6, 30), (5, 29)):
        branch = head.cube((x, y, -1), (2, 1, 2))
        branch.fill(bark_d)
    for x in (-3, 1):
        glow = head.cube((x, 28, -4.3), (2, 1, 1))
        glow.fill(eye, noise=0)
    body = next(b for b in m.bones if b.name == "body")
    for f in (body.cubes[0].front, body.cubes[0].back):
        for xx in range(0, f.w, 3):
            f.vline(xx, bark_d)
    return m


def treant_sapling():
    return _treant("treant_sapling", "#6b4a2a", "#8a6a42", "#3f2a16", "#4f8a3a", "#c8ff6a")


def zytl_qae():
    """Zy'tl Q'ae, the Destroyer Tree: a treant of the old world, blighted black and crowned with dead leaves."""
    return _treant("zytl_qae", "#3a2a1e", "#5a4430", "#1e140c", "#4a5a28", "#ff7a2a")


def pinison():
    """Pinison Pole Perlia, the dryad of the forest: green-skinned, leaf-haired, in a dress of bark and moss."""
    m, head, body, pal = _pleiades("pinison", "#c8d9a0", "#4f8a3a", "#2f5a22", "#ffd23d",
                                   dress="#4a3320", accent="#7aa040", bun=False)
    for x, z in ((-4, -1), (3, -2), (-1, 2)):
        leaf = head.cube((x, 32, z), (2, 2, 2))
        leaf.fill("#6aa84f", noise=10)
    sash = body.cube((-4, 17, -2.3), (8, 1, 1))
    sash.fill("#7aa040")
    return m


def skeleton_archer():
    """An Old Guarder's bones with a short bow in place of sword and shield, and a quiver on its back."""
    m = old_guarder()
    m.name = "skeleton_archer"
    for b in m.bones:
        if b.name in ("weapon", "shield"):
            b.cubes.clear()
    bow = _bone(m, "weapon")
    grip = bow.cube((-5.5, 10, -3), (1, 5, 1))
    grip.fill("#5a3a1e", noise=4)
    for y0 in (5, 15):
        limb = bow.cube((-5.5, y0, -2), (1, 5, 1))
        limb.fill("#7a5230", noise=4)
    string = bow.cube((-5.5, 6, -0.5), (1, 13, 1), inflate=-0.4)
    string.fill("#e9e6dc", noise=0)
    quiver = _bone(m, "body").cube((-2, 14, 1.5), (3, 9, 2))
    quiver.fill("#4a321b", noise=5)
    quiver.top.fill("#c9302c")
    return m


def quagoa_warlord():
    """The warlord of the quagoa clans: black-furred and scarred, armoured in plates of blue ore, crowned with
    crystal and swinging a crystal-headed war pick (v9.5)."""
    m = quagoa("quagoa_warlord", "#3a2a1e", "#5a4430", "#22180f")
    head, body = _bone(m, "head"), _bone(m, "body")
    ore, ore_l, ore_d, glow = "#3a6a8a", "#5a9ac0", "#1e3a4e", "#4ac8ff"
    for x in (-6, 3):  # pauldrons of raw ore
        p = body.cube((x, 21, -3), (3, 3, 6), inflate=0.2)
        p.fill(ore, noise=10)
        p.top.fill(ore_l)
        p.front.hline(0, ore_d)
    plate = body.cube((-3, 15, -3.6), (6, 6, 1))  # a breastplate
    plate.fill(ore, noise=8)
    plate.front.fill(glow, 2, 2, 4, 4)
    belt = body.cube((-4, 12, -3.2), (8, 1, 6.4))
    belt.fill("#2a1e14")
    for x in (-3, -1, 1, 3):  # the crown: shards of crystal
        h = 3 if x in (-1, 1) else 2
        c = head.cube((x - 0.5, 32, -3), (1, h, 1))
        c.fill(glow, noise=4)
    band = head.cube((-4, 31, -4), (8, 1, 8), inflate=0.15)
    band.fill(ore_d)
    scar = head.cube((1, 27, -4.1), (1, 4, 0))
    scar.fill("#c8a8a0")
    arm = _bone(m, "rightArm")
    haft = arm.cube((-6.5, 11, -9), (1, 1, 11))  # the war pick, held forward
    haft.fill("#4a3323", noise=5)
    head_ = arm.cube((-7, 8, -10), (2, 7, 2))
    head_.fill(ore, noise=8)
    tip = arm.cube((-6.5, 6, -9.5), (1, 2, 1))
    tip.fill(glow)
    tip2 = arm.cube((-6.5, 15, -9.5), (1, 2, 1))
    tip2.fill(glow)
    return m


def rune_golem():
    """A guardian of the dwarven royal forge: bronze-bound stone carved all over with glowing blue runes, an
    anvil for a crown and runic plates on its fists (v9.5)."""
    m = gargantua("rune_golem", "#7a6a52", "#9a8a6e", "#4e4232", "#4ac8ff")
    head, body = _bone(m, "head"), _bone(m, "body")
    bronze, bronze_d = "#b07a3a", "#7a5226"
    for x in (-9, 5):  # bronze shoulder plates
        p = body.cube((x, 22, -4.5), (4, 3, 9), inflate=0.2)
        p.fill(bronze, noise=6)
        p.front.hline(1, "#4ac8ff")
        p.bottom.fill(bronze_d)
    anvil = head.cube((-5, 30, -3), (10, 2, 6))  # the anvil crown
    anvil.fill("#3a3e46", noise=5)
    anvil.top.fill("#5a5e66")
    neck = head.cube((-2, 29.5, -2), (4, 1, 4))
    neck.fill("#2a2e36")
    for name in ("rightArm", "leftArm"):
        arm = _bone(m, name)
        x = -13.5 if name == "rightArm" else 6.5
        fist = arm.cube((x, 4, -3.5), (7, 5, 7))  # runic knuckle-plates
        fist.fill(bronze, noise=6)
        for f in fist.sides:
            f.hline(2, "#4ac8ff")
    core = body.cube((-2, 17, -4.4), (4, 4, 1))  # a rune-core glowing in its chest
    core.fill("#4ac8ff")
    core.front.fill("#d0f4ff", 1, 1, 3, 3)
    return m


def wyrm_steed():
    """A young dragon of Nazarick, bred to be ridden (steeds.js): scaled in purple and black, horned in gold."""
    return _great_dragon("wyrm_steed", "plated", "#3a2452", "#6b4a8f", "#1d1029", "#c9a227", "#d9a92b", "#5a2a7a",
                         "#ff3040", "#b56cff")


def skeletal_dragon():
    return _great_dragon("skeletal_dragon", "bone", "#d8d0b4", "#f1eee0", "#8a8166", "#a59c7e", "#b8b094", "#5a5545",
                         "#b6ff4a", "#7dff5a")


def platinum_dragon_lord():
    return _great_dragon("platinum_dragon_lord", "plated", "#cfd4de", "#ffffff", "#8e96a6", "#eef1f6", "#d9a92b",
                         "#9fb4cc", "#59d0ff", "#59d0ff")


ALL = [ainz, albedo, shalltear, cocytus, demiurge, sebas, death_knight, elder_lich, hamsuke,
       narberal, pandoras_actor, old_guarder, aura, mare, gazef, clementine, nazarick_maid,
       brain, zaryusu, cz_delta, nfirea,
       lupusregina, entoma, solution, yuri, goblin, ogre,
       skeleton_mage, lizardman, evileye, fluder, gargantua, soul_eater, quagoa, adventurer, guard,
       soldier, archer, imperial_knight, bandit, *RETAINERS,
       war_troll, vampire_bride, dwarf, frost_dragon, frost_breath,
       hellhound, shadow_demon, evil_lord_wrath, archangel_flame, dominion_authority, theocracy_priest, nigun,
       climb, zesshi, eclair,
       skeletal_dragon, khajiit, gigant_basilisk, frost_giant, beastman, lakyus, enri, zero, dark_young, jaldabaoth,
       go_gin, elf_ranger, decem, behemoth, neia, remedios, paladin, bafolk, eight_edge_assassin, arena_master,
       platinum_dragon_lord, rubedo, wyrm_steed, ghoul, wraith, death_cavalier, treant_sapling, zytl_qae, pinison,
       skeleton_archer, quagoa_warlord, rune_golem,
       crystal_shard, fireball, negative_burst, lightning_bolt, magic_bullet]
