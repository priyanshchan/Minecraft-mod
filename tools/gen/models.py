"""Entity models + textures for the Overlord add-on (all art is original)."""
from __future__ import annotations

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
    m = Model("elder_lich", bounds=(3, 4, 1.25))
    robe, robe_l, robe_d = "#4a2020", "#643030", "#2e1212"
    trim_c = "#8a6d2b"
    pal = {"B": "#d8d0b4", "b": "#a59c7e", "d": "#140d0d", "K": "#080606", "Y": "#b6ff4a",
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


ALL = [ainz, albedo, shalltear, cocytus, demiurge, sebas, death_knight, elder_lich, hamsuke,
       fireball, negative_burst]
