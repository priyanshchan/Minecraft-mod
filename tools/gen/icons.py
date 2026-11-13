"""Item icons, spawn-egg icons, block textures and armour textures (all original art)."""
from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from modelkit import Cube, rgba, shade, mix

GOLD, GOLD_L, GOLD_D = "#d9a92b", "#f6d968", "#96701a"


class Sprite:
    def __init__(self, n=16):
        self.n = n
        self.img = Image.new("RGBA", (n, n), (0, 0, 0, 0))

    def px(self, x, y, color):
        if 0 <= x < self.n and 0 <= y < self.n:
            self.img.putpixel((x, y), rgba(color))
        return self

    def stamp(self, rows, pal, ox=0, oy=0):
        for j, line in enumerate(rows):
            for i, ch in enumerate(line):
                if ch != ".":
                    self.px(ox + i, oy + j, pal[ch])
        return self

    def shaft(self, x0, y0, length, light, dark):
        """Two-texel wide diagonal going up-right, vanilla tool style."""
        for i in range(length):
            self.px(x0 + i, y0 - i, light)
            self.px(x0 + i + 1, y0 - i, dark)
        return self

    def outline(self, factor=0.38):
        """Dark rim derived from the neighbouring texel colour."""
        src = self.img.copy()
        for y in range(self.n):
            for x in range(self.n):
                if src.getpixel((x, y))[3]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < self.n and 0 <= yy < self.n and src.getpixel((xx, yy))[3]:
                        self.img.putpixel((x, y), shade(src.getpixel((xx, yy)), factor))
                        break
        return self


def sprite16(rows, pal, outline=True):
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), [len(r) for r in rows]
    s = Sprite().stamp(rows, pal)
    return (s.outline() if outline else s).img


# ------------------------------------------------------------------ weapons
def staff():
    s = Sprite()
    s.shaft(1, 14, 9, GOLD_L, GOLD)
    for i in (2, 5):
        s.px(1 + i, 14 - i, GOLD_D).px(2 + i, 14 - i, GOLD_D)
    s.stamp([
        "..GLG..",
        ".GLbLG.",
        "GLRrRLG",
        "LgRWrcL",
        "GLRrRLG",
        ".GLvLG.",
        "..GLG..",
    ], {"G": GOLD, "L": GOLD_L, "R": "#c2171d", "r": "#ff5a4d", "W": "#ffd9d2", "b": "#3ed0ff",
        "g": "#63ff6b", "c": "#c05bff", "v": "#ffe14d"}, 8, 0)
    return s.outline().img


def ring(gem="#c2171d"):
    return sprite16([
        "................",
        "................",
        "......rRr.......",
        ".....rRWRr......",
        "......rRr.......",
        ".....GLLLG......",
        "....GL...LG.....",
        "...GL.....LG....",
        "...GL.....Lg....",
        "...GL.....Gg....",
        "...GL.....Gg....",
        "....GL...Gg.....",
        ".....GGGgg......",
        "................",
        "................",
        "................",
    ], {"G": GOLD, "L": GOLD_L, "g": GOLD_D, "R": gem, "r": shade(gem, 0.65),
        "W": mix(gem, "#ffffff", 0.6)})


def lance():
    s = Sprite()
    s.shaft(1, 14, 3, "#4a1218", "#2a0a0e")
    s.stamp(["GL", "gG"], {"G": GOLD, "L": GOLD_L, "g": GOLD_D}, 3, 10)
    s.px(5, 11, GOLD_D).px(3, 9, GOLD)
    for i in range(10):
        x, y = 5 + i, 9 - i
        w = 3 if i < 4 else 2 if i < 8 else 1
        s.px(x, y, "#f0d9d9" if i > 6 else "#d43a44")
        if w >= 2:
            s.px(x + 1, y, "#8f1020")
        if w >= 3:
            s.px(x, y + 1, "#6a0a13").px(x - 1, y, "#e96a72")
    return s.outline().img


def bardiche():
    s = Sprite()
    s.stamp([
        "...eee..",
        "..ennne.",
        ".ennNnne",
        ".enNNNne",
        ".ennNNn.",
        "..eennn.",
        "....ee..",
    ], {"e": "#8fe0ae", "n": "#2f6b4b", "N": "#173526"}, 5, 0)
    s.shaft(1, 14, 12, "#3c3a46", "#1c1b22")
    s.px(4, 11, "#3a7a58").px(5, 11, "#3a7a58")
    return s.outline().img


def katana():
    s = Sprite()
    s.shaft(1, 14, 3, "#2c3550", "#161b2c")
    s.px(2, 13, GOLD).px(3, 11, GOLD).px(4, 12, GOLD_D).px(4, 11, GOLD_L).px(5, 11, GOLD)
    for i in range(10):
        x, y = 5 + i, 10 - i
        s.px(x, y, "#f4fbff").px(x + 1, y, "#8ccdf0")
        if i < 8:
            s.px(x + 1, y + 1, "#5a9cc4") if i % 3 == 0 else None
    s.px(15, 0, "#f4fbff")
    return s.outline().img


def flamberge():
    s = Sprite()
    s.shaft(1, 14, 3, "#5a1218", "#2e080c")
    s.stamp(["kK.", "KkK", ".Kk"], {"K": "#1c1a22", "k": "#3a3644"}, 3, 9)
    for i in range(9):
        x, y = 6 + i, 9 - i
        s.px(x, y, "#c9d1df").px(x + 1, y, "#7a8294")
        s.px(x, y - 1 if i % 2 == 0 else y + 1, "#9aa2b4") if i < 8 else None
        if i in (2, 5):
            s.px(x, y, "#c2171d")
    return s.outline().img


# ------------------------------------------------------------------- misc
def tome(cover="#3b2450", cover_d="#2b1a3d", glyph="#e9e3cf", band="#b3141c"):
    return sprite16([
        "................",
        "..KKKKKKKKKKK...",
        ".KPPPPPPPPPPGK..",
        ".KPppppppppPGK..",
        ".KPppBBBBppPGK..",
        ".KPpBBBBBBpPGK..",
        ".KPpBKBBKBpPGK..",
        ".KPpBBBBBBpPGK..",
        ".KPppBKKBppPGK..",
        ".KPppBbBbppPGK..",
        ".KPppppppppPGK..",
        ".KPpRRRRRRpPGK..",
        ".KPPPPPPPPPPGK..",
        ".KWWWWWWWWWWwK..",
        "..KKKKKKKKKKK...",
        "................",
    ], {"K": "#120b18", "P": cover, "p": cover_d, "B": glyph, "b": shade(glyph, 0.6), "G": GOLD,
        "R": band, "W": "#e8e2d0", "w": "#b8b09a"}, outline=False)


def potion(liquid="#e0202c"):
    return sprite16([
        "................",
        "......CcC.......",
        "......cCc.......",
        ".....WWWWW......",
        "......WrW.......",
        "......WrW.......",
        ".....WrRrW......",
        "....WrRRRrW.....",
        "...WrRRRRRrW....",
        "...WRwRRRRDW....",
        "...WRwRRRRDW....",
        "...WRRRRRDDW....",
        "...WrRRRDDrW....",
        "....WrDDDrW.....",
        ".....WWWWW......",
        "................",
    ], {"C": "#9a6b3a", "c": "#6e4a26", "W": "#d7e6ee", "R": liquid, "r": mix(liquid, "#ffffff", 0.35),
        "w": mix(liquid, "#ffffff", 0.75), "D": shade(liquid, 0.65)})


def crystal(c="#43d6e8", light="#8ff0f7", shine="#ecffff", dark="#1c8fb0"):
    return sprite16([
        "................",
        ".......cC.......",
        "......cWCc......",
        "......CWCC......",
        ".....cWCCDc.....",
        ".....CWCCDC.....",
        "....cWCCCDDc....",
        "....CWCCCDDC....",
        "....CWCCCDDC....",
        "....cCWCCDDc....",
        ".....CCCDDC.....",
        ".....cCCDDc.....",
        "......CDDC......",
        "......cDDc......",
        ".......DD.......",
        "................",
    ], {"C": c, "c": light, "W": shine, "D": dark})


def coin():
    return sprite16([
        "................",
        "................",
        ".....GGGGGG.....",
        "....GLLLLLLG....",
        "...GLLgLLgLLG...",
        "...GLLLggLLLg...",
        "...GLgLggLgLg...",
        "...GLLgggglLg...",
        "...GLLLggLLLg...",
        "...GLLLggLLgg...",
        "...GLLgggglgg...",
        "....GLLLLggg....",
        ".....gggggg.....",
        "................",
        "................",
        "................",
    ], {"G": GOLD, "L": GOLD_L, "g": GOLD_D, "l": "#e6c04a"})


def crest():
    return sprite16([
        "................",
        "..GGGGGGGGGGGG..",
        "..GPPPPPPPPPPg..",
        "..GPpPPLLPPpPg..",
        "..GPPPLGGLPPPg..",
        "..GPPLGRRGLPPg..",
        "..GPPLGRRGLPPg..",
        "..GPPPLGGLPPPg..",
        "..GPpPPLLPPpPg..",
        "...GPPPLLPPPg...",
        "...GPPPLLPPPg...",
        "....GPPPPPPg....",
        ".....GPPPPg.....",
        "......GPPg......",
        ".......Gg.......",
        "................",
    ], {"G": GOLD, "L": GOLD_L, "g": GOLD_D, "P": "#3b2450", "p": "#5a3a80", "R": "#e0202c"})


def ingot():
    return sprite16([
        "................",
        "................",
        "................",
        "................",
        ".......lllll....",
        "......lLLLLLd...",
        ".....lLLLLLLdd..",
        "....lLLMMMMMdd..",
        "...lLLMMMMMddd..",
        "..lMMMMMMMdddd..",
        "..MMMMMMMMddd...",
        "..dddddddddd....",
        "................",
        "................",
        "................",
        "................",
    ], {"l": "#aab6d6", "L": "#7d8bb3", "M": "#55618a", "d": "#343c5c"})


SIGIL = [
    "................",
    ".....AAAAAA.....",
    "...AAbbbbbbAA...",
    "..AbbAAaaAAbbA..",
    "..AbAbbCCbbAbA..",
    ".AbAbbCccCbbAbA.",
    ".AbabCcDDcCbabA.",
    ".AbabCDWWDCbabA.",
    ".AbabCDWWDCbabA.",
    ".AbabCcDDcCbabA.",
    ".AbAbbCccCbbAbA.",
    "..AbAbbCCbbAbA..",
    "..AbbAAaaAAbbA..",
    "...AAbbbbbbAA...",
    ".....AAAAAA.....",
    "................",
]

SIGIL_COLORS = {
    # ring, dark base, inner, core
    "ainz": ("#d9a92b", "#1c1029", "#8a2be2", "#ff3b30"),
    "albedo": ("#f1eff0", "#17141d", "#d9a92b", "#f2c21b"),
    "shalltear": ("#d43a44", "#2a0a0e", "#dfe0ee", "#e0202c"),
    "cocytus": ("#9fd4ef", "#16324d", "#5f9fc6", "#e9fbff"),
    "demiurge": ("#e0703a", "#2a1210", "#d9a92b", "#ffd23d"),
    "sebas": ("#c9c9cc", "#1a1a21", "#7d8bb3", "#f3f3f1"),
    "narberal": ("#aeb6c6", "#16141c", "#ffe94d", "#ffffff"),
    "pandoras_actor": ("#e0b955", "#1d1b20", "#f0e7cb", "#b3141c"),
    "aura": ("#d9534a", "#2a1e16", "#f2d66b", "#3fbf5f"),
    "mare": ("#62b85f", "#1d4a61", "#f2d66b", "#3f8fe0"),
    "cz_delta": ("#6b7a4a", "#15131a", "#f0a8a0", "#3fbf7a"),
    "lupusregina": ("#a8402a", "#1f1e28", "#d9a92b", "#f2c21b"),
    "entoma": ("#c9608f", "#3a2a4a", "#f3ead8", "#d4202a"),
    "solution": ("#ecca5c", "#1f1e28", "#3f8fe0", "#bfe8ff"),
    "yuri": ("#3f6fb0", "#1b1a22", "#3d8a3f", "#f4f3f5"),
    "gargantua": ("#8f95a3", "#16171c", "#454954", "#ff5a3d"),
    "frost_dragon": ("#bfe3f5", "#15202b", "#5f8fb8", "#f2c21b"),
    "evil_lord_wrath": ("#c2452a", "#2a0a08", "#ff7a1a", "#ffd23d"),
    "zesshi": ("#f4f3f5", "#1b1a22", "#8e96a6", "#d4202a"),
    "dominion_authority": ("#f6d968", "#2a5aa8", "#f4f1ea", "#ffffff"),
    "skeletal_dragon": ("#d8d0b4", "#2a2620", "#a59c7e", "#b6ff4a"),
    "dark_young": ("#1f1c28", "#07060a", "#4a2a6a", "#c05bff"),
    "jaldabaoth": ("#a3121f", "#17060a", "#d8d0c0", "#ff7a1a"),
    "decem": ("#2f5a3a", "#10220f", "#f4f3f5", "#63ff6b"),
    "platinum_dragon_lord": ("#d9dde6", "#3a4050", "#9aa2b0", "#59d0ff"),
    "rubedo": ("#c2171d", "#2a0a0e", "#f4f1ea", "#e0202c"),
}


def sigil(who):
    ring_c, base, inner, core = SIGIL_COLORS[who]
    pal = {"A": ring_c, "a": shade(ring_c, 1.25), "b": base, "C": inner, "c": shade(inner, 0.7),
           "D": core, "W": mix(core, "#ffffff", 0.6)}
    return sprite16(SIGIL, pal)


ARMOR_PAL = {"K": "#0c0b10", "k": "#2b2833", "l": "#45414f", "G": GOLD, "g": GOLD_D, "R": "#d4202a"}
CHAMPION_PAL = {"K": "#4a5263", "k": "#d5dce8", "l": "#ffffff", "G": "#3f7fe0", "g": "#2a5aa8", "R": "#d4202a"}


def helmet(pal=None):
    return sprite16([
        "................",
        "................",
        "....KKKKKKKK....",
        "...KllkkkkkkK...",
        "..KlkkkkkkkkkK..",
        "..KkGGGGGGGGkK..",
        "..KkkkkkkkkkkK..",
        "..KkKKKKKKKKkK..",
        "..KkKRRKKRRKkK..",
        "..KkKKKggKKKkK..",
        "..KkkKKggKKkkK..",
        "..KkkkKggKkkkK..",
        "..KgGkKKKKkGgK..",
        "...KKKK..KKKK...",
        "................",
        "................",
    ], pal or ARMOR_PAL, outline=False)


def chestplate(pal=None):
    return sprite16([
        "................",
        "..KKK......KKK..",
        ".KllkK.RR.KkkkK.",
        ".KlkkkKRRKkkkkK.",
        ".KkkkkkkkkkkkkK.",
        ".KGGkkkGGkkkGGK.",
        "..KKkkGkkGkkKK..",
        "...KkkGkkGkkK...",
        "...KkkkGGkkkK...",
        "...KlkkkkkkkK...",
        "...KkkkkkkkkK...",
        "...KGGGGGGGGK...",
        "...KkkkkkkkkK...",
        "....KKKKKKKK....",
        "................",
        "................",
    ], pal or ARMOR_PAL, outline=False)


def leggings(pal=None):
    return sprite16([
        "................",
        "...KKKKKKKKKK...",
        "...KGGGGGGGGK...",
        "...KlkkkkkkkK...",
        "...KkkkKKkkkK...",
        "...KkkK..KkkK...",
        "...KlkK..KkkK...",
        "...KGGK..KGGK...",
        "...KkkK..KkkK...",
        "...KkkK..KkkK...",
        "...KlkK..KkkK...",
        "...KkkK..KkkK...",
        "...KkkK..KkkK...",
        "...KKKK..KKKK...",
        "................",
        "................",
    ], pal or ARMOR_PAL, outline=False)


def boots(pal=None):
    return sprite16([
        "................",
        "................",
        "................",
        "................",
        "..KKKK....KKKK..",
        "..KlkK....KlkK..",
        "..KGGK....KGGK..",
        "..KkkK....KkkK..",
        "..KkkK....KkkK..",
        ".KKkkK....KkkKK.",
        ".KlkkK....KkkkK.",
        ".KkkkK....KkkkK.",
        ".KKKKK....KKKKK.",
        "................",
        "................",
        "................",
    ], pal or ARMOR_PAL, outline=False)


EGG = [
    "................",
    "......AAAA......",
    ".....AAAAAA.....",
    "....AAABBAAA....",
    "....AAAAAAAA....",
    "...AABAAAABAA...",
    "...AAAAAAAAAA...",
    "...AAAABBAAAA...",
    "...ABAAAAAABA...",
    "...AAAAAAAAAA...",
    "...AAABAABAAA...",
    "....AAAAAAAA....",
    "....AABAABAA....",
    ".....AAAAAA.....",
    "................",
    "................",
]


def egg(base, spots):
    s = Sprite()
    for y, line in enumerate(EGG):
        for x, ch in enumerate(line):
            if ch == ".":
                continue
            c = base if ch == "A" else spots
            f = 1.18 if (x < 7 and y < 6) else 0.78 if (x > 9 or y > 11) else 1.0
            s.px(x, y, shade(c, f))
    return s.outline(0.45).img


# ----------------------------------------------------------------- blocks
def nazarick_bricks():
    rnd = random.Random(42)
    img = Image.new("RGBA", (16, 16))
    base, mortar = "#3a3346", "#1d1924"
    for y in range(16):
        for x in range(16):
            row = y // 4
            off = 0 if row % 2 == 0 else 4
            is_mortar = (y % 4 == 3) or ((x + off) % 8 == 7)
            c = mortar if is_mortar else base
            d = rnd.randint(-7, 7)
            r, g, b, a = rgba(c)
            if not is_mortar and y % 4 == 0:
                r, g, b = r + 12, g + 12, b + 14
            img.putpixel((x, y), (max(0, r + d), max(0, g + d), max(0, b + d), 255))
    for x, y in ((2, 1), (11, 5), (5, 9), (13, 13)):
        img.putpixel((x, y), rgba("#6b4fa0"))
    return img


def crystal_block():
    rnd = random.Random(7)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            band = (x + y * 2 + (3 if (x // 5) % 2 else 0)) % 9
            c = ["#1c8fb0", "#28a8c8", "#43d6e8", "#43d6e8", "#8ff0f7", "#43d6e8", "#28a8c8", "#1c8fb0",
                 "#167a98"][band]
            d = rnd.randint(-6, 6)
            r, g, b, a = rgba(c)
            img.putpixel((x, y), (max(0, min(255, r + d)), max(0, min(255, g + d)),
                                  max(0, min(255, b + d)), 255))
    for i in range(16):
        for x, y in ((i, 0), (0, i)):
            img.putpixel((x, y), rgba("#b8f8fc"))
        for x, y in ((i, 15), (15, i)):
            img.putpixel((x, y), rgba("#126680"))
    for x, y in ((4, 3), (10, 6), (6, 11), (12, 12)):
        img.putpixel((x, y), rgba("#ecffff"))
    return img


# ----------------------------------------------------------- armour layers
def armor_layers(plate="#1b1a22", plate_l="#35323f", plate_d="#0c0b10", red="#d4202a",
                 GOLD=GOLD, GOLD_D=GOLD_D):
    """Standard 64x32 humanoid armour sheets (layer 1 and layer 2)."""
    pal = {"K": plate, "k": plate_l, "D": plate_d, "G": GOLD, "g": GOLD_D, "R": red, "r": "#7a1016"}

    def put(sheet, cube, uv):
        sheet.paste(cube.img, uv)

    l1 = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    head = Cube((0, 0, 0), (8, 8, 8))
    head.fill(plate, noise=4, seed=3)
    head.front.rows([
        "kkkkkkkk",
        "kKKKKKKk",
        "GGGGGGGG",
        "KDDKKDDK",
        "KRRDDRRK",
        "KKKggKKK",
        "KKKggKKK",
        "kgKKKKgk",
    ], pal)
    for f in (head.right, head.left, head.back):
        f.hline(2, GOLD)
        f.hline(7, GOLD_D)
        f.hline(0, plate_l)
    head.top.border(plate_l)
    head.top.vline(3, red).vline(4, red)
    head.bottom.fill(None)
    put(l1, head, (0, 0))

    body = Cube((0, 0, 0), (8, 12, 4))
    body.fill(plate, noise=4, seed=5)
    body.front.rows([
        "kkGRRGkk",
        "kKKGGKKk",
        "KKkKKkKK",
        "KkKGGKkK",
        "KKGKKGKK",
        "KKGKKGKK",
        "KkKGGKkK",
        "KKKKKKKK",
        "DKKKKKKD",
        "GGGGGGGG",
        "gKKKKKKg",
        "DDKKKKDD",
    ], pal)
    for f in (body.right, body.left, body.back):
        f.hline(9, GOLD)
        f.hline(0, plate_l)
    body.back.vline(3, plate_l, 1, 9).vline(4, plate_d, 1, 9)
    body.bottom.fill(None)
    put(l1, body, (16, 16))

    arm = Cube((0, 0, 0), (4, 12, 4))
    arm.fill(plate, noise=4, seed=7)
    arm.band(0, 1, plate_l)
    arm.band(3, 4, GOLD)
    arm.band(4, 5, plate_d)
    arm.band(8, 9, GOLD_D)
    arm.band(10, 12, plate_l)
    arm.top.fill(plate_l).border(GOLD)
    put(l1, arm, (40, 16))

    boot = Cube((0, 0, 0), (4, 12, 4))
    boot.band(7, 12, plate)
    for i, f in enumerate(boot.sides):
        f.noise(4, 20 + i)
    boot.band(7, 8, GOLD)
    boot.band(11, 12, plate_d)
    boot.bottom.fill(plate_d)
    put(l1, boot, (0, 16))

    l2 = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    waist = Cube((0, 0, 0), (8, 12, 4))
    waist.band(7, 12, plate)
    for i, f in enumerate(waist.sides):
        f.noise(4, 30 + i)
    waist.band(7, 8, GOLD)
    waist.front.px(3, 9, red)
    waist.front.px(4, 9, red)
    put(l2, waist, (16, 16))
    leg = Cube((0, 0, 0), (4, 12, 4))
    leg.band(0, 10, plate)
    for i, f in enumerate(leg.sides):
        f.noise(4, 40 + i)
    leg.band(4, 5, GOLD_D)
    leg.band(5, 6, plate_l)
    leg.band(9, 10, plate_d)
    leg.top.fill(plate)
    put(l2, leg, (0, 16))
    return l1, l2


def greatsword():
    s = Sprite()
    s.shaft(1, 14, 3, "#5a1218", "#2e080c")
    s.stamp([".GL", "GLG", "LG."], {"G": GOLD, "L": GOLD_L}, 2, 10)
    for i in range(10):
        x, y = 5 + i, 10 - i
        s.px(x, y, "#4a4656").px(x + 1, y, "#211f29").px(x, y - 1, "#8d899c")
        if i < 9:
            s.px(x + 1, y + 1, "#121016")
        if i in (2, 5):
            s.px(x, y, "#d4202a")
    s.px(15, 0, "#8d899c")
    return s.outline().img


def mask():
    return sprite16([
        "................",
        "................",
        "...WWWWWWWWWW...",
        "..WWWWWWWWWWWW..",
        "..WWKKWWWWKKWW..",
        "..WKKKKWWKKKKW..",
        "..WWKKWWWWKKWW..",
        "..WWbWWWWWWbWW..",
        "..WWbWWwwWWbWw..",
        "..WWWWWwwWWWWw..",
        "..WWWKWWWWKWWw..",
        "...WWWKKKKWWw...",
        "...WWWWWWWwww...",
        "....wwwwwwww....",
        "................",
        "................",
    ], {"W": "#f4f1ea", "w": "#c9c3b5", "K": "#15131a", "b": "#4aa8e8"})


def scroll(seal):
    return sprite16([
        "................",
        "...ddddddddd....",
        "..dPPPPPPPPPd...",
        "..dppppppppPd...",
        "...PPPPPPPPP....",
        "...PgPPgPgPP....",
        "...PPPPPPPPP....",
        "...PPgSSSgPP....",
        "...PPPSsSPPP....",
        "...PPgSSSgPP....",
        "...PPPPPPPPP....",
        "..dppppppppPd...",
        "..dPPPPPPPPPd...",
        "...ddddddddd....",
        "................",
        "................",
    ], {"P": "#e9dcb4", "p": "#c9b98a", "d": "#8a7748", "g": "#7a6a44", "S": seal,
        "s": mix(seal, "#ffffff", 0.65)})


def nazarick_tiles():
    rnd = random.Random(21)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            edge = x % 8 in (0, 7) or y % 8 in (0, 7)
            dark = ((x // 8) + (y // 8)) % 2 == 0
            c = "#191620" if edge else ("#3f3850" if dark else "#2e2839")
            if x % 8 == 1 and y % 8 == 1:
                c = "#d9a92b"
            d = 0 if edge else rnd.randint(-5, 5)
            r, g, b, a = rgba(c)
            img.putpixel((x, y), (max(0, r + d), max(0, g + d), max(0, b + d), 255))
    return img


def nazarick_lamp():
    rnd = random.Random(33)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            ring = max(abs(x - 7.5), abs(y - 7.5))
            if ring > 6.5:
                c = "#231d2e"
            elif ring > 5.5:
                c = "#d9a92b"
            elif ring > 4.5:
                c = "#5f3fa0"
            elif ring > 2.5:
                c = "#b99cff"
            else:
                c = "#f3ecff"
            d = rnd.randint(-5, 5)
            r, g, b, a = rgba(c)
            img.putpixel((x, y), (max(0, min(255, r + d)), max(0, min(255, g + d)),
                                  max(0, min(255, b + d)), 255))
    for x, y in ((0, 0), (15, 0), (0, 15), (15, 15)):
        img.putpixel((x, y), rgba("#96701a"))
    return img


def blade_icon(grip, grip_d, guard, edge, mid, dark, length=10, glow=None):
    s = Sprite()
    s.shaft(1, 14, 3, grip, grip_d)
    s.stamp([".GL", "GLG", "LG."], {"G": guard, "L": shade(guard, 1.3)}, 2, 10)
    for i in range(length):
        x, y = 5 + i, 10 - i
        s.px(x, y, edge).px(x + 1, y, mid)
        if i < length - 1:
            s.px(x + 1, y + 1, dark)
        if glow and i % 3 == 1:
            s.px(x, y, glow)
    s.px(5 + length, 10 - length, edge)
    return s.outline().img


def yggdrasil_staff():
    s = Sprite()
    s.shaft(1, 14, 10, "#8a6238", "#5b3d22")
    s.stamp([
        "..lLl.",
        ".lLLLl",
        "lLDLLL",
        "LLLLDl",
        ".lLLl.",
        "..ll..",
    ], {"L": "#3d8a3f", "l": "#62b85f", "D": "#275c2a"}, 9, 0)
    s.px(4, 11, "#62b85f").px(7, 8, "#62b85f")
    return s.outline().img


def whip():
    return sprite16([
        "................",
        "......BBBB......",
        "....BBbbbbBB....",
        "...Bbb....bbB...",
        "..Bbb.BBBB.bbB..",
        "..Bb.BbbbbB.bB..",
        "..Bb.Bb..bB.bB..",
        "..Bb.Bb.BbB.bB..",
        "..Bb.BbB.B..bB..",
        "..Bbb.BbbB.bbB..",
        "...Bbb....bbB...",
        "....BBbbbbBH....",
        "......BBBBHhH...",
        "...........HhH..",
        "............HG..",
        "................",
    ], {"B": "#7a4a2a", "b": "#a56a3c", "H": "#3a1a16", "h": "#6b2a22", "G": GOLD})


def bell():
    return sprite16([
        "................",
        ".......GG.......",
        "......GLLG......",
        ".....GLLLGG.....",
        ".....GLLGGG.....",
        "....GLLLGGGg....",
        "....GLLGGGGg....",
        "....GLLGGGGg....",
        "...GLLLGGGGGg...",
        "...GLLGGGGGGg...",
        "..GGLGGGGGGGgg..",
        "..gggggggggggg..",
        ".......dd.......",
        "......dDDd......",
        ".......dd.......",
        "................",
    ], {"G": GOLD, "L": GOLD_L, "g": GOLD_D, "d": "#6b4a16", "D": "#96701a"})


def adamantite_block():
    rnd = random.Random(55)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            ring = max(abs(x - 7.5), abs(y - 7.5))
            c = "#aab6d6" if (x == 0 or y == 0) else "#343c5c" if (x == 15 or y == 15) else \
                "#7d8bb3" if ring > 5.5 else "#55618a" if (x + y) % 6 < 3 else "#606d98"
            d = rnd.randint(-4, 4)
            r, g, b, a = rgba(c)
            img.putpixel((x, y), (max(0, r + d), max(0, g + d), max(0, b + d), 255))
    return img


def pillar_side():
    rnd = random.Random(61)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            cap = y < 2 or y > 13
            groove = x % 4 == 3
            c = "#d9a92b" if y in (2, 13) else "#4a4259" if cap else "#231e2c" if groove else \
                "#3a3346" if x % 4 == 1 else "#332c3f"
            d = 0 if y in (2, 13) else rnd.randint(-5, 5)
            r, g, b, a = rgba(c)
            img.putpixel((x, y), (max(0, r + d), max(0, g + d), max(0, b + d), 255))
    return img


def pillar_top():
    rnd = random.Random(62)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            ring = max(abs(x - 7.5), abs(y - 7.5))
            c = "#231e2c" if ring > 6.5 else "#4a4259" if ring > 4.5 else "#d9a92b" if ring > 3.5 else "#3a3346"
            d = rnd.randint(-5, 5)
            r, g, b, a = rgba(c)
            img.putpixel((x, y), (max(0, r + d), max(0, g + d), max(0, b + d), 255))
    return img


def champion_layers():
    return armor_layers("#cfd6e2", "#f4f7fb", "#8f98aa", "#d4202a", GOLD="#3f7fe0", GOLD_D="#2a5aa8")


def scale():
    return sprite16([
        "................",
        "................",
        "......SSSS......",
        ".....SLLLLS.....",
        "....SLLWLLLS....",
        "....SLWLLLDS....",
        "....SLLLLLDS....",
        "....SLLLLDDS....",
        "....SLLLDDDS....",
        ".....SLDDDS.....",
        ".....SLDDDS.....",
        "......SDDS......",
        ".......SS.......",
        "................",
        "................",
        "................",
    ], {"S": "#7fb4d6", "L": "#bfe3f5", "W": "#ffffff", "D": "#5f8fb8"})


def fang():
    return sprite16([
        "................",
        "................",
        "....WWWW........",
        "....WWWWW.......",
        ".....WWWw.......",
        ".....WWWw.......",
        "......WWw.......",
        "......WWw.......",
        ".......Ww.......",
        ".......Ww.......",
        "........w.......",
        "........r.......",
        "................",
        "................",
        "................",
        "................",
    ], {"W": "#f4f1ea", "w": "#c9c3b5", "r": "#c2171d"})


def rune_hammer():
    s = Sprite()
    s.shaft(1, 14, 9, "#8a6238", "#5b3d22")
    s.stamp([
        ".MMMM.",
        "MmmmMD",
        "MmRmMD",
        "MmmmMD",
        "MMMMDD",
        ".DDDD.",
    ], {"M": "#9aa0aa", "m": "#c9ced6", "D": "#5d626c", "R": "#ff7a1a"}, 8, 1)
    return s.outline().img


RANGER_PAL = {"K": "#3a2a1a", "k": "#8a6238", "l": "#a8804f", "G": "#3f6a45", "g": "#2a4a2f", "R": "#62b85f"}
CRIMSON_PAL = {"K": "#3a0a10", "k": "#a3121f", "l": "#d43a44", "G": GOLD, "g": GOLD_D, "R": "#f7f4f1"}


def ranger_layers():
    return armor_layers("#7a5530", "#a8804f", "#4a321b", "#62b85f", GOLD="#3f6a45", GOLD_D="#2a4a2f")


def crimson_layers():
    return armor_layers("#a3121f", "#d43a44", "#6a0a13", "#f7f4f1")


def war_pick():
    s = Sprite()
    s.shaft(1, 14, 10, "#8a6238", "#5b3d22")
    s.stamp([
        "MMMMMMD.",
        ".mMMMMMD",
        "...mMMDD",
        "....mMD.",
        "....mD..",
        "....D...",
    ], {"M": "#6f7480", "m": "#a9b0bd", "D": "#454954"}, 7, 0)
    return s.outline().img


def sun_bow():
    return sprite16([
        "................",
        "......GGGG......",
        "....GGLLs.......",
        "...GLL..s.......",
        "..GLL...s.......",
        "..GL....s.......",
        ".GLL....s...R...",
        ".GL.....sRRRRW..",
        ".GL.....sRRRRW..",
        ".GLL....s...R...",
        "..GL....s.......",
        "..GLL...s.......",
        "...GLL..s.......",
        "....GGLLs.......",
        "......GGGG......",
        "................",
    ], {"G": GOLD, "L": GOLD_L, "s": "#f1ede4", "R": "#ff7a1a", "W": "#fff6c9"})


INFERNAL_PAL = {"K": "#2a0a08", "k": "#8f1a14", "l": "#c2452a", "G": "#ff7a1a", "g": "#c2452a", "R": "#ffd23d"}
VESTMENT_PAL = {"K": "#8a8478", "k": "#f4f1ea", "l": "#ffffff", "G": GOLD, "g": GOLD_D, "R": "#3f7fe0"}


BONEDRAGON_PAL = {"K": "#6e664c", "k": "#d8d0b4", "l": "#f1eee0", "G": "#a59c7e", "g": "#6e664c", "R": "#b6ff4a"}
BEASTHIDE_PAL = {"K": "#5a3a1c", "k": "#c07a2a", "l": "#e0a04a", "G": "#f1e0b8", "g": "#a8946a", "R": "#3a2a1e"}


PLATINUM_PAL = {"K": "#7a8292", "k": "#d9dde6", "l": "#ffffff", "G": "#59d0ff", "g": "#2f8fc0", "R": "#f6d968"}


def platinum_layers():
    return armor_layers("#d9dde6", "#ffffff", "#9aa2b0", "#59d0ff", GOLD="#b8bcc8", GOLD_D="#7a8292")


def rune_stone(glyph):
    """A flat stone carved with a glowing rune."""
    return sprite16([
        "................",
        "................",
        "....SSSSSSS.....",
        "...SsssssssS....",
        "..SssGsssGssS...",
        "..SsssGsGsssS...",
        "..SssssGssssS...",
        "..SsssGGGsssS...",
        "..SsssGsGsssS...",
        "..SssGsssGssS...",
        "..SsssGGGsssS...",
        "...SsssssssS....",
        "....SSSSSSS.....",
        "................",
        "................",
        "................",
    ], {"S": "#4a4f5a", "s": "#7a8090", "G": glyph})


def bonedragon_layers():
    return armor_layers("#d8d0b4", "#f1eee0", "#a59c7e", "#b6ff4a", GOLD="#a59c7e", GOLD_D="#6e664c")


def beasthide_layers():
    return armor_layers("#c07a2a", "#e0a04a", "#7a4a18", "#3a2a1e", GOLD="#f1e0b8", GOLD_D="#a8946a")


def bone():
    return sprite16([
        "................",
        "...........WW...",
        "..........WwWW..",
        "..........WWwW..",
        ".........WwWW...",
        "........WwW.....",
        ".......WwW......",
        "......WwW.......",
        ".....WwW........",
        "....WwW.........",
        "..WWwW..........",
        ".WwWW...........",
        ".WWwW...........",
        "..WW............",
        "................",
        "................",
    ], {"W": "#f1eee0", "w": "#a59c7e"})


def eye_icon():
    return sprite16([
        "................",
        "................",
        "................",
        "....GGGGGGG.....",
        "...GgggggggG....",
        "..GggYYYYYggG...",
        "..GgYYKKKYYgG...",
        "..GgYYKWKYYgG...",
        "..GgYYKKKYYgG...",
        "..GggYYYYYggG...",
        "...GgggggggG....",
        "....GGGGGGG.....",
        "................",
        "................",
        "................",
        "................",
    ], {"G": "#3f5a2a", "g": "#7a8a4a", "Y": "#f2e21b", "K": "#15130f", "W": "#ffffff"})


def hide():
    return sprite16([
        "................",
        "................",
        "..HH......HH....",
        "..HhHHHHHHhH....",
        "...HhhhhhhH.....",
        "...HhDhhDhH.....",
        "...HhhhhhhH.....",
        "...HhhDhhhH.....",
        "...HhhhhDhH.....",
        "...HhDhhhhH.....",
        "..HhHHHHHHhH....",
        "..HH......HH....",
        "................",
        "................",
        "................",
        "................",
    ], {"H": "#7a4a18", "h": "#c07a2a", "D": "#5a3a1c"})


def maul():
    s = Sprite()
    s.shaft(1, 14, 9, "#6b4a32", "#4a3323")
    s.stamp([
        ".IIIII.",
        "IiiiiiI",
        "IiWiWiI",
        "IiiiiiI",
        ".IIIII.",
    ], {"I": "#6a93b0", "i": "#cfe6f5", "W": "#ffffff"}, 8, 1)
    return s.outline().img


def infernal_layers():
    return armor_layers("#8f1a14", "#c2452a", "#4a0d0a", "#ffd23d", GOLD="#ff7a1a", GOLD_D="#c2452a")


def vestment_layers():
    return armor_layers("#e9e6dc", "#ffffff", "#b9b4a4", "#3f7fe0")


def feather():
    return sprite16([
        "................",
        "...........WW...",
        "..........WWWw..",
        ".........WWWWw..",
        "........WWWWw...",
        ".......WWWWw....",
        "......WWWWw.....",
        ".....WWWWw......",
        "....WWWWw.......",
        "....WWWw........",
        "...GWWw.........",
        "...GWw..........",
        "..G.............",
        ".G..............",
        "................",
        "................",
    ], {"W": "#fffbe8", "w": "#f6d968", "G": GOLD})


def heart():
    return sprite16([
        "................",
        "................",
        "...RRR....RRR...",
        "..RrrRR..RRrRR..",
        "..RrRRRRRRRRRD..",
        "..RRRRRORRRRRD..",
        "..RRRROOORRRDD..",
        "...RRROYORRDD...",
        "...RRRROORRDD...",
        "....RRRRRRDD....",
        ".....RRRRDD.....",
        "......RRDD......",
        ".......DD.......",
        "................",
        "................",
        "................",
    ], {"R": "#8f1a14", "r": "#c2452a", "D": "#4a0d0a", "O": "#ff7a1a", "Y": "#ffd23d"})


def cloth():
    return sprite16([
        "................",
        "................",
        "..WWWWWWWWWWW...",
        "..WWWWWWWWWWWw..",
        "..WWGWWWWWGWWw..",
        "..WWWWWBBWWWWw..",
        "..WWWWBBBBWWWw..",
        "..WWWWWBBWWWWw..",
        "..WWGWWWWWGWWw..",
        "..WWWWWWWWWWWw..",
        "..WwwwwwwwwwWw..",
        "...wwwwwwwwwww..",
        "................",
        "................",
        "................",
        "................",
    ], {"W": "#f4f1ea", "w": "#c9c3b5", "G": GOLD, "B": "#3f7fe0"})


def scythe():
    s = Sprite()
    s.shaft(1, 14, 11, "#35323f", "#1b1a22")
    s.stamp([
        "..SSSSS.",
        ".SsssssS",
        "Sss...sS",
        "Ss.....S",
        "S.......",
    ], {"S": "#c9d1df", "s": "#f2f5f9"}, 4, 1)
    return s.outline().img


def mace():
    s = Sprite()
    s.shaft(1, 14, 9, "#f6d968", "#96701a")
    s.stamp([
        ".GLG.",
        "GLWLG",
        "LWWWL",
        "GLWLG",
        ".GLG.",
    ], {"G": GOLD, "L": GOLD_L, "W": "#fffbe8"}, 9, 1)
    return s.outline().img


DRAGON_PAL = {"K": "#3f6a8a", "k": "#bfe3f5", "l": "#ffffff", "G": "#5f8fb8", "g": "#3f6a8a", "R": "#f2c21b"}


def dragonscale_layers():
    return armor_layers("#a8d4ec", "#eaf7ff", "#5f8fb8", "#f2c21b", GOLD="#5f8fb8", GOLD_D="#3f6a8a")


def gauntlets():
    return sprite16([
        "................",
        "................",
        "...kkk....kkk...",
        "..kMMMk..kMMMk..",
        "..kMmMk..kMmMk..",
        "..kGGGk..kGGGk..",
        "..kMMMk..kMMMk..",
        ".kMMmMMkkMMmMMk.",
        ".kMmMmMkkMmMmMk.",
        ".kMMMMMkkMMMMMk.",
        ".kdMdMdkkdMdMdk.",
        ".kMdMdMkkMdMdMk.",
        "..kkkkk..kkkkk..",
        "................",
        "................",
        "................",
    ], {"k": "#3a3f4a", "M": "#9aa0aa", "m": "#d5dae2", "d": "#5d626c", "G": GOLD}, outline=False)


def rifle():
    s = Sprite()
    s.stamp(["WW.", "WWW", ".WW"], {"W": "#6b4a2a"}, 1, 11)
    s.px(1, 11, "#8a6238").px(2, 12, "#8a6238")
    for i in range(11):
        x, y = 4 + i, 11 - i
        s.px(x, y, "#4a5160").px(x + 1, y, "#2b2f38")
        if 1 <= i <= 4:
            s.px(x, y - 1, "#6c7486").px(x + 1, y + 1, "#1c1f26")
    s.px(7, 6, "#15131a").px(8, 5, "#15131a").px(9, 4, "#3fbf7a")
    s.px(6, 11, "#1c1f26").px(6, 12, "#1c1f26")
    return s.outline().img


def holy_staff():
    s = Sprite()
    s.shaft(1, 14, 10, "#4a4a58", "#2a2a33")
    s.stamp([
        "..GLG.",
        "..LRL.",
        "GLLLLG",
        "LGLLGL",
        "..GLG.",
    ], {"G": GOLD, "L": GOLD_L, "R": "#d4202a"}, 9, 0)
    return s.outline().img


def emblem():
    return sprite16([
        "................",
        ".......GG.......",
        "......GLLG......",
        "......GLLG......",
        ".GGGGGLLLLGGGGG.",
        "..GLLLLWWLLLLG..",
        "...GLLWWWWLLG...",
        "....GLLWWLLG....",
        "....GLLLLLLG....",
        "...GLLLGGLLLG...",
        "...GLLG..GLLG...",
        "..GLLG....GLLG..",
        "..GGG......GGG..",
        "................",
        "................",
        "................",
    ], {"G": "#7d8bb3", "L": "#c9d4f2", "W": "#ffffff"})


def horn(body, tip, band=GOLD):
    return sprite16([
        "................",
        "............TT..",
        "...........TTt..",
        "..........BBt...",
        ".........BBb....",
        "........BBBb....",
        ".......GGBb.....",
        "......BBGGb.....",
        ".....BBBBb......",
        "....BBBBBb......",
        "...BBBBBb.......",
        "..GGBBBb........",
        "..BGGBb.........",
        "..bBBb..........",
        "...bb...........",
        "................",
    ], {"B": body, "b": shade(body, 0.7), "T": tip, "t": shade(tip, 0.75), "G": band})


def golem_fist():
    return sprite16([
        "................",
        "..........ww....",
        ".........wHHd...",
        "........wHHd....",
        ".......wHHd.....",
        "..sssswHHd......",
        ".sSSSSSHd.......",
        ".sSRSSSSd.......",
        ".sSSSRSSSd......",
        ".sSRSSSRSd......",
        ".sSSSSSSSd......",
        ".sSSRSSSSd......",
        "..dSSSSSd.......",
        "...ddddd........",
        "................",
        "................",
    ], {"S": "#6f7480", "s": "#8f95a3", "d": "#454954", "R": "#ff5a3d", "H": "#6b4a2a", "w": "#8a6238"})


def fluder_staff():
    s = Sprite()
    s.shaft(1, 14, 10, "#8a6238", "#5b3d22")
    s.stamp([".rRr.", "rRWRr", "RWRRR", "rRRRr", ".rRr."], {"R": "#e0202c", "r": "#9a0f1a", "W": "#ffb0a8"}, 10, 0)
    return s.outline().img


def bricks(base, mortar, speck, seed, cracks=False):
    rnd = random.Random(seed)
    img = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            off = 0 if (y // 4) % 2 == 0 else 4
            is_mortar = (y % 4 == 3) or ((x + off) % 8 == 7)
            r, g, b, a = rgba(mortar if is_mortar else base)
            d = rnd.randint(-7, 7)
            if not is_mortar and y % 4 == 0:
                r, g, b = r + 12, g + 12, b + 14
            img.putpixel((x, y), (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)), 255))
    for x, y in ((2, 1), (11, 5), (5, 9), (13, 13)):
        img.putpixel((x, y), rgba(speck))
    if cracks:
        for x, y in ((3, 0), (4, 1), (4, 2), (5, 2), (10, 4), (9, 5), (9, 6), (8, 6), (12, 8), (13, 9), (13, 10),
                     (2, 12), (3, 13), (3, 14), (6, 5), (7, 9), (7, 10)):
            img.putpixel((x, y), rgba(shade(mortar, 0.6)))
    return img


REGALIA_PAL = {"K": "#140c1e", "k": "#3b2450", "l": "#5a3a80", "G": GOLD, "g": GOLD_D, "R": "#e0202c"}


def regalia_layers():
    return armor_layers("#2b1a3d", "#412a5c", "#1c1029", "#e0202c")


def wand():
    s = Sprite()
    s.shaft(2, 13, 8, "#4a3a6a", "#2b1f45")
    s.px(3, 12, GOLD).px(4, 12, GOLD_D).px(9, 6, GOLD).px(10, 6, GOLD_D)
    s.stamp([".cC.", "cWCc", "CCDC", ".cD."], {"C": "#c05bff", "c": "#e3b8ff", "W": "#ffffff", "D": "#7a2bb3"}, 10, 2)
    return s.outline().img


def banner():
    return sprite16([
        "................",
        "..GG............",
        "..WWRRRRRRRRR...",
        "..WWRRRRLRRRRR..",
        "..WWRRRLLLRRRR..",
        "..WWRRRRLRRRR...",
        "..WWRRRRRRRRRR..",
        "..WWRRRRRRRR....",
        "..WW............",
        "..WW............",
        "..WW............",
        "..WW............",
        "..WW............",
        "..ww............",
        "................",
        "................",
    ], {"G": GOLD_L, "W": "#8a6238", "w": "#5b3d22", "R": "#a8262a", "L": GOLD})


def plate():
    return sprite16([
        "................",
        "......cc........",
        ".....c..c.......",
        ".....c..c.......",
        "......cc........",
        "...kkkkkkkkkk...",
        "..kMMMMMMMMMMk..",
        "..kMmmmmmmmmMk..",
        "..kMmddddddmMk..",
        "..kMmmmmmmmmMk..",
        "..kMmdddmGGmMk..",
        "..kMmmmmmGGmMk..",
        "..kMMMMMMMMMMk..",
        "...kkkkkkkkkk...",
        "................",
        "................",
    ], {"c": "#8a6a4a", "k": "#5a3a22", "M": "#c9824a", "m": "#e3a66e", "d": "#8f552a", "G": GOLD_L},
        outline=False)


def mask_layer():
    """64x32 armour sheet that only paints the Mask of Envy on the face."""
    sheet = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    head = Cube((0, 0, 0), (8, 8, 8))
    head.front.rows([
        "wWWWWWWw",
        "WWWWWWWW",
        "WKKWWKKW",
        "WKKWWKKW",
        "WbWWWWbW",
        "WbWwwWbW",
        "WWKWWKWW",
        "wWWKKWWw",
    ], {"W": "#f4f1ea", "w": "#c9c3b5", "K": "#15131a", "b": "#4aa8e8"})
    for f in (head.right, head.left, head.back):
        f.hline(3, "#3a2a1e")
    sheet.paste(head.img, (0, 0))
    return sheet


# ------------------------------------------------------- particle textures
# Drawn in white so the particle definitions can tint them per element.
# ------------------------------------------------------------ particle textures
# Every particle texture is white with an alpha shape; the particle tints it with the spell's colour
# and draws it additively, so brightness reads as glow.
def _alpha_image(alpha):
    """RGBA image from a 2-D float array of alpha values (0-1)."""
    a = np.clip(alpha, 0.0, 1.0)
    out = np.zeros((*a.shape, 4), np.uint8)
    out[..., :3] = 255
    out[..., 3] = (a * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def _grid(w, h):
    """Coordinates in -1..1 across a w x h image."""
    ys, xs = np.mgrid[0:h, 0:w]
    return (xs + 0.5) / w * 2 - 1, (ys + 0.5) / h * 2 - 1


def _drawn(size, draw_fn, scale=4, blur=0.0, glow=0.0):
    """Draws white strokes on a supersampled canvas, optionally adds a soft glow, and scales down."""
    w, h = size
    big = Image.new("L", (w * scale, h * scale), 0)
    draw_fn(ImageDraw.Draw(big), scale)
    if blur:
        big = big.filter(ImageFilter.GaussianBlur(blur * scale))
    alpha = np.asarray(big.resize((w, h), Image.LANCZOS), np.float32) / 255
    if glow:
        halo = np.asarray(big.filter(ImageFilter.GaussianBlur(glow * scale)).resize((w, h), Image.LANCZOS),
                          np.float32) / 255
        alpha = np.maximum(alpha, halo * 0.55)
    return _alpha_image(alpha)


def particle_glow():
    x, y = _grid(32, 32)
    d = np.hypot(x, y)
    return _alpha_image(np.minimum(1.0, np.clip(1 - d, 0, 1) ** 1.6 * 1.7))


def particle_star():
    """Four-pointed sparkle with a soft core."""
    x, y = _grid(32, 32)
    d = np.hypot(x, y)
    core = np.clip(1 - d * 2.6, 0, 1) ** 1.3
    rays = np.maximum(np.exp(-np.abs(y) * 14) * np.clip(1 - np.abs(x), 0, 1) ** 1.5,
                      np.exp(-np.abs(x) * 14) * np.clip(1 - np.abs(y), 0, 1) ** 1.5)
    return _alpha_image(np.maximum(core, rays * 0.95))


def particle_streak():
    """A streak of light: bright along the middle, fading towards both ends (16 x 64)."""
    x, y = _grid(16, 64)
    return _alpha_image(np.clip(1 - np.abs(x), 0, 1) ** 2.2 * np.clip(1 - np.abs(y), 0, 1) ** 0.8 * 1.25)


def particle_ring():
    x, y = _grid(64, 64)
    d = np.hypot(x, y)
    band = np.exp(-((d - 0.86) / 0.045) ** 2)
    inner = np.clip((d - 0.45) / 0.41, 0, 1) ** 3 * (d < 0.86) * 0.35
    return _alpha_image(np.maximum(band, inner))


def particle_shockwave():
    """Thick ground ring broken up by radial streaks, like kicked-up dust."""
    x, y = _grid(64, 64)
    d = np.hypot(x, y)
    angle = np.arctan2(y, x)
    grain = 0.65 + 0.35 * np.sin(angle * 23) * np.sin(angle * 7 + 1.3)
    return _alpha_image(np.exp(-((d - 0.8) / 0.11) ** 2) * grain)


def _polar(c, r, deg):
    return (c + math.cos(math.radians(deg)) * r, c + math.sin(math.radians(deg)) * r)


def particle_magic_circle():
    """Outer ring of a magic circle: double border, tick marks and a band of runes (128 px)."""
    n = 128

    def draw(d, k):
        c = n * k / 2
        ring = lambda r, w: d.ellipse([c - r * k, c - r * k, c + r * k, c + r * k], outline=255, width=int(w * k))
        ring(62, 1.6)
        ring(58.5, 0.8)
        ring(46, 1.2)
        for i in range(48):  # tick marks between the two borders
            d.line([_polar(c, 59 * k, i * 7.5), _polar(c, (62 if i % 4 else 56) * k, i * 7.5)], fill=255, width=k)
        rnd = random.Random(11)
        for i in range(12):  # runes
            base = i * 30 + 15
            pts = [_polar(c, (48.5 + rnd.random() * 7) * k, base + (rnd.random() - 0.5) * 16) for _ in range(4)]
            d.line(pts, fill=255, width=int(1.2 * k))
            d.line([_polar(c, 49 * k, base - 6), _polar(c, 55.5 * k, base - 6)], fill=255, width=k)

    return _drawn((n, n), draw, glow=1.6)


def particle_magic_circle_inner():
    """Inner figure of a magic circle: hexagram, hexagon and a small star (128 px)."""
    n = 128

    def draw(d, k):
        c = n * k / 2
        d.ellipse([c - 60 * k, c - 60 * k, c + 60 * k, c + 60 * k], outline=255, width=int(1.4 * k))
        for turn in (0, 180):
            d.polygon([_polar(c, 59 * k, 90 + turn + 120 * i) for i in range(3)], outline=255)
            pts = [_polar(c, 59 * k, 90 + turn + 120 * i) for i in range(4)]
            d.line(pts, fill=255, width=int(1.4 * k))
        d.line([_polar(c, 30 * k, 60 * i) for i in range(7)], fill=255, width=k)
        d.ellipse([c - 16 * k, c - 16 * k, c + 16 * k, c + 16 * k], outline=255, width=k)
        for i in range(4):
            d.line([_polar(c, 4 * k, 90 * i + 45), _polar(c, 14 * k, 90 * i)], fill=255, width=k)
            d.line([_polar(c, 4 * k, 90 * i - 45), _polar(c, 14 * k, 90 * i)], fill=255, width=k)

    return _drawn((n, n), draw, glow=1.6)


def particle_glyphs():
    """Strip of eight runes, 32 px each."""
    def draw(d, k):
        rnd = random.Random(29)
        for g in range(8):
            ox = g * 32 * k
            nodes = [(ox + (6 + rnd.random() * 20) * k, (5 + rnd.random() * 22) * k) for _ in range(5)]
            d.line(nodes, fill=255, width=int(2.2 * k))
            d.line([(ox + 16 * k, 4 * k), (ox + 16 * k, 28 * k)], fill=255, width=int(1.8 * k))
            if g % 2:
                d.ellipse([ox + 11 * k, 11 * k, ox + 21 * k, 21 * k], outline=255, width=int(1.6 * k))

    return _drawn((256, 32), draw, glow=1.2)


def particle_flame():
    """Four frames of a licking flame, 32 px each."""
    frames = []
    for f in range(4):
        x, y = _grid(32, 32)
        wobble = 0.22 * np.sin(y * 3.2 + f * 1.57) * (1 - (y + 1) / 2)
        width = 0.62 * np.clip((y + 1) / 2, 0, 1) ** 0.75 + 0.05
        body = np.clip(1 - np.abs(x - wobble) / width, 0, 1)
        frames.append(body ** 1.2 * np.clip((y + 1.0) * 1.6, 0, 1) * np.clip((1.0 - y) * 4.0, 0, 1))
    return _alpha_image(np.concatenate(frames, axis=1))


def particle_smoke():
    x, y = _grid(32, 32)
    rnd = random.Random(5)
    a = np.zeros_like(x)
    for _ in range(7):
        cx, cy, r = (rnd.random() - 0.5) * 0.9, (rnd.random() - 0.5) * 0.9, 0.28 + rnd.random() * 0.25
        a = np.maximum(a, np.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (r * r))))
    return _alpha_image(a * np.clip(1.15 - np.hypot(x, y), 0, 1) * 0.9)


def particle_shard():
    """A sliver of ice: a long diamond with one bright facet."""
    def draw(d, k):
        d.polygon([(16 * k, 1 * k), (22 * k, 14 * k), (16 * k, 31 * k), (10 * k, 14 * k)], fill=150)
        d.polygon([(16 * k, 1 * k), (22 * k, 14 * k), (16 * k, 31 * k)], fill=255)
        d.line([(16 * k, 1 * k), (16 * k, 31 * k)], fill=210, width=k)

    return _drawn((32, 32), draw, glow=0.8)


def particle_arc():
    """Four jagged lightning segments, 32 x 64 each."""
    def draw(d, k):
        rnd = random.Random(41)
        for f in range(4):
            ox = f * 32 * k
            pts = [(ox + 16 * k, 0)]
            for step in range(1, 8):
                pts.append((ox + (16 + (rnd.random() - 0.5) * 20) * k, step * 8 * k))
            pts.append((ox + 16 * k, 64 * k))
            d.line(pts, fill=255, width=int(2.4 * k), joint="curve")
            fork = pts[3 + f % 3]
            d.line([fork, (fork[0] + (rnd.random() - 0.5) * 16 * k, fork[1] + 12 * k)], fill=220, width=int(1.4 * k))

    return _drawn((128, 64), draw, glow=1.4)


def particle_slash():
    """A crescent - the trail of a blade."""
    x, y = _grid(64, 64)
    outer = np.clip((0.92 - np.hypot(x, y)) * 14, 0, 1)
    inner = np.clip((np.hypot(x + 0.22, y) - 0.86) * 9, 0, 1)
    taper = np.clip((x + 0.15) * 1.6, 0, 1) ** 0.6
    return _alpha_image(outer * inner * taper)


def particle_skull():
    art = [
        "................",
        "....WWWWWWWW....",
        "...WWWWWWWWWW...",
        "..WWWWWWWWWWWW..",
        "..WWWWWWWWWWWW..",
        "..WW..WWWW..WW..",
        "..WW..WWWW..WW..",
        "..WWWWWWWWWWWW..",
        "..WWWWW..WWWWW..",
        "...WWWWWWWWWW...",
        "....WWWWWWWW....",
        "....W.WW.WW.W...",
        "....W.WW.WW.W...",
        "....WWWWWWWW....",
        "................",
        "................",
    ]
    a = np.array([[1.0 if ch == "W" else 0.0 for ch in row] for row in art], np.float32)
    return _alpha_image(np.kron(a, np.ones((2, 2), np.float32)))


PARTICLE_TEXTURES = {
    "glow": particle_glow, "star": particle_star, "streak": particle_streak, "ring": particle_ring,
    "shockwave": particle_shockwave, "magic_circle": particle_magic_circle,
    "magic_circle_inner": particle_magic_circle_inner, "glyphs": particle_glyphs, "flame": particle_flame,
    "smoke": particle_smoke, "shard": particle_shard, "arc": particle_arc, "slash": particle_slash,
    "skull": particle_skull,
}


BLOCK_TEXTURES = {
    "nazarick_bricks": nazarick_bricks,
    "data_crystal_block": crystal_block,
    "nazarick_tiles": nazarick_tiles,
    "nazarick_lamp": nazarick_lamp,
    "adamantite_block": adamantite_block,
    "nazarick_pillar_side": pillar_side,
    "nazarick_pillar_top": pillar_top,
    "gilded_nazarick_bricks": lambda: bricks("#3a3346", "#d9a92b", "#f6d968", 71),
    "cracked_nazarick_bricks": lambda: bricks("#3a3346", "#1d1924", "#6b4fa0", 72, cracks=True),
    "glacier_bricks": lambda: bricks("#9fd4ef", "#5f9fc6", "#ffffff", 73),
}


EGG_COLORS = {
    "ainz": ("#2b1a3d", "#d9a92b"),
    "albedo": ("#f1eff0", "#17141d"),
    "shalltear": ("#a3121f", "#dfe0ee"),
    "cocytus": ("#9fd4ef", "#2f5f8c"),
    "demiurge": ("#b8402a", "#15131a"),
    "sebas": ("#1a1a21", "#f3f3f1"),
    "death_knight": ("#1c1a22", "#b3141c"),
    "elder_lich": ("#4a2020", "#b6ff4a"),
    "hamsuke": ("#dcdee6", "#6f9468"),
    "narberal": ("#1d1c26", "#f2f1f3"),
    "pandoras_actor": ("#c79a32", "#1d1b20"),
    "old_guarder": ("#e9e3cf", "#6b4a36"),
    "aura": ("#b3261f", "#f2d66b"),
    "mare": ("#2f6f8f", "#62b85f"),
    "gazef": ("#7a808c", "#7a1f1f"),
    "clementine": ("#18161c", "#eed27a"),
    "nazarick_maid": ("#f4f3f5", "#1f1e28"),
    "brain": ("#2d3a4a", "#5b7db3"),
    "zaryusu": ("#3f7a4a", "#c9c58f"),
    "cz_delta": ("#f0a8a0", "#4a5633"),
    "nfirea": ("#7a8f5a", "#e6c463"),
    "lupusregina": ("#1f1e28", "#a8402a"),
    "entoma": ("#3a2a4a", "#c9608f"),
    "solution": ("#1f1e28", "#ecca5c"),
    "yuri": ("#1b1a22", "#3d8a3f"),
    "goblin": ("#6f9a3f", "#6b4226"),
    "ogre": ("#b08a5a", "#4a3323"),
    "skeleton_mage": ("#22335c", "#59d0ff"),
    "lizardman": ("#5a7a3a", "#d2c79a"),
    "evileye": ("#8f1a1f", "#f1ede4"),
    "fluder": ("#e9e6dc", "#5a2a8a"),
    "gargantua": ("#6f7480", "#ff5a3d"),
    "soul_eater": ("#1c2026", "#59e0c8"),
    "quagoa": ("#6b4d34", "#e9e3cf"),
    "adventurer": ("#8a6a4a", "#3f6a45"),
    "guard": ("#8d939f", "#2f4f8f"),
    "soldier": ("#3f66a8", "#7a6a55"),
    "archer": ("#5f7a4a", "#3f66a8"),
    "imperial_knight": ("#3a3a44", "#a8262a"),
    "bandit": ("#3a3028", "#c99a78"),
    "war_troll": ("#5f7f6a", "#4a3323"),
    "vampire_bride": ("#e9e6ee", "#a3121f"),
    "dwarf": ("#7a4a2a", "#b5651d"),
    "frost_dragon": ("#bfe3f5", "#5f8fb8"),
    "hellhound": ("#2a1210", "#ff7a1a"),
    "shadow_demon": ("#221a2c", "#d4202a"),
    "evil_lord_wrath": ("#8f1a14", "#ff7a1a"),
    "archangel_flame": ("#f4f1ea", "#d9a92b"),
    "dominion_authority": ("#c9d1df", "#3f7fe0"),
    "theocracy_priest": ("#f4f1ea", "#3a2a1f"),
    "nigun": ("#2a2a33", "#e9e6dc"),
    "climb": ("#e9edf2", "#e6c463"),
    "zesshi": ("#1b1a22", "#f4f3f5"),
    "eclair": ("#1b1a22", "#f2a01b"),
    "skeletal_dragon": ("#d8d0b4", "#b6ff4a"),
    "khajiit": ("#5a1414", "#7a1fff"),
    "gigant_basilisk": ("#3f5a2a", "#f2e21b"),
    "frost_giant": ("#9fc4dc", "#4a3323"),
    "beastman": ("#c07a2a", "#f1e0b8"),
    "lakyus": ("#e9edf2", "#3a4fb0"),
    "enri": ("#b03a2e", "#b5642e"),
    "zero": ("#b9835a", "#3a3a44"),
    "dark_young": ("#0c0b10", "#c05bff"),
    "jaldabaoth": ("#a3121f", "#d8d0c0"),
    "go_gin": ("#8a9a6a", "#d9a92b"),
    "elf_ranger": ("#3f6a45", "#e9e2a8"),
    "decem": ("#2f5a3a", "#f4f3f5"),
    "behemoth": ("#7a6a55", "#4f4436"),
    "neia": ("#6a5238", "#d9c05a"),
    "remedios": ("#e9edf2", "#b03030"),
    "paladin": ("#d9dde6", "#f4f1ea"),
    "bafolk": ("#8a7a66", "#5a4e40"),
    "eight_edge_assassin": ("#15131a", "#d4202a"),
    "arena_master": ("#a8262a", "#d9a92b"),
    "platinum_dragon_lord": ("#d9dde6", "#59d0ff"),
    "rubedo": ("#f4f1ea", "#c2171d"),
}


def all_item_icons():
    icons = {
        "staff_of_ainz_ooal_gown": staff(),
        "ring_of_ainz_ooal_gown": ring(),
        "spuit_lance": lance(),
        "ginnungagap": bardiche(),
        "god_slaying_emperor_blade": katana(),
        "death_knight_sword": flamberge(),
        "tome_create_undead": tome(),
        "red_potion": potion(),
        "data_crystal": crystal(),
        "yggdrasil_gold_coin": coin(),
        "guardian_crest": crest(),
        "adamantite_ingot": ingot(),
        "dark_warrior_helmet": helmet(),
        "dark_warrior_chestplate": chestplate(),
        "dark_warrior_leggings": leggings(),
        "dark_warrior_boots": boots(),
        "dark_warrior_greatsword": greatsword(),
        "mask_of_envy": mask(),
        "scroll_of_lightning": scroll("#f2c21b"),
        "scroll_of_fly": scroll("#3ed0ff"),
        "ring_of_sustenance": ring("#2fbf5b"),
        "razor_edge": blade_icon("#3a2a1f", "#22170f", GOLD, "#ffffff", "#9fd4ff", "#4f8fd0", glow="#dff1ff"),
        "stiletto": blade_icon("#3a2a2a", "#201616", "#737b8c", "#f2f5f9", "#aab2c0", "#737b8c", length=6),
        "shadow_of_yggdrasil": yggdrasil_staff(),
        "aura_whip": whip(),
        "scroll_of_invisibility": scroll("#c9c9cc"),
        "scroll_of_teleportation": scroll("#a04bff"),
        "maid_bell": bell(),
        "world_champion_helmet": helmet(CHAMPION_PAL),
        "world_champion_chestplate": chestplate(CHAMPION_PAL),
        "world_champion_leggings": leggings(CHAMPION_PAL),
        "world_champion_boots": boots(CHAMPION_PAL),
        "scroll_of_explosion": scroll("#ff6a1a"),
        "scroll_of_time_stop": scroll("#2a2a3a"),
        "scroll_of_heavy_recover": scroll("#3fbf5f"),
        "tome_reality_slash": tome("#1d3a5c", "#132842", "#9fd4ff", "#f4fbff"),
        "tome_fallen_down": tome("#5c4a12", "#3d310b", "#fff6c9", "#3ed0ff"),
        "frost_pain": blade_icon("#3d5f7a", "#22384a", "#8ccdf0", "#f4fbff", "#bfe8ff", "#6fb4de",
                                 length=9, glow="#ffffff"),
        "brain_katana": blade_icon("#1b1b22", "#0c0c10", GOLD_D, "#f2f5f9", "#b9c2d0", "#7c8494"),
        "iron_gauntlets": gauntlets(),
        "magic_rifle": rifle(),
        "adventurer_plate": plate(),
        "command_banner": banner(),
        "frost_dragon_scale": scale(),
        "vampire_fang": fang(),
        "runic_hammer": rune_hammer(),
        "troll_blood": potion("#3f8a4a"),
        "troll_elixir": potion("#c9d43f"),
        "fang_dagger": blade_icon("#3a0d12", "#1f070a", "#a3121f", "#f4f1ea", "#c9c3b5", "#8a8478", length=6),
        "dragonscale_helmet": helmet(DRAGON_PAL),
        "dragonscale_chestplate": chestplate(DRAGON_PAL),
        "dragonscale_leggings": leggings(DRAGON_PAL),
        "dragonscale_boots": boots(DRAGON_PAL),
        "rune_of_fire": rune_stone("#ff7a1a"),
        "rune_of_frost": rune_stone("#8fe0ff"),
        "rune_of_storm": rune_stone("#ffe94a"),
        "rune_of_life": rune_stone("#63ff6b"),
        "platinum_scale": crystal("#d9dde6", "#ffffff", "#ffffff", "#9aa2b0"),
        "platinum_helmet": helmet(PLATINUM_PAL),
        "platinum_chestplate": chestplate(PLATINUM_PAL),
        "platinum_leggings": leggings(PLATINUM_PAL),
        "platinum_boots": boots(PLATINUM_PAL),
        "martial_lord_club": mace(),
        "elf_kings_staff": blade_icon("#6b4a32", "#4a3323", "#3f6a45", "#63ff6b", "#b8ffbe", "#2f8a3a", length=11),
        "depiction_of_nature": scroll("#3f8a4a"),
        "avarice_and_generosity": gauntlets(),
        "longinus": blade_icon("#3a2a1e", "#1f150f", "#d9a92b", "#f4f3f5", "#c9ced6", "#a3121f", length=12),
        "basilisk_eye": eye_icon(),
        "dragon_bone": bone(),
        "beast_hide": hide(),
        "orb_of_death": crystal("#3a0d4a", "#7a1fff", "#d9b3ff", "#17061f"),
        "giants_maul": maul(),
        "dragonbone_blade": blade_icon("#3a2a1e", "#1f150f", "#a59c7e", "#f1eee0", "#d8d0b4", "#6e664c", length=11),
        "six_arms_knuckles": gauntlets(),
        "bonedragon_helmet": helmet(BONEDRAGON_PAL),
        "bonedragon_chestplate": chestplate(BONEDRAGON_PAL),
        "bonedragon_leggings": leggings(BONEDRAGON_PAL),
        "bonedragon_boots": boots(BONEDRAGON_PAL),
        "beasthide_helmet": helmet(BEASTHIDE_PAL),
        "beasthide_chestplate": chestplate(BEASTHIDE_PAL),
        "beasthide_leggings": leggings(BEASTHIDE_PAL),
        "beasthide_boots": boots(BEASTHIDE_PAL),
        "angel_feather": feather(),
        "demon_heart": heart(),
        "blessed_cloth": cloth(),
        "charons_guidance": scythe(),
        "angel_mace": mace(),
        "hellfire_blade": blade_icon("#2a0a08", "#150504", "#ff7a1a", "#ffd23d", "#ff7a1a", "#8f1a14", glow="#fff6c9"),
        "sealing_crystal": crystal("#dff1ff", "#ffffff", "#ffffff", "#9fd4ff"),
        "infernal_helmet": helmet(INFERNAL_PAL),
        "infernal_chestplate": chestplate(INFERNAL_PAL),
        "infernal_leggings": leggings(INFERNAL_PAL),
        "infernal_boots": boots(INFERNAL_PAL),
        "vestment_helmet": helmet(VESTMENT_PAL),
        "vestment_chestplate": chestplate(VESTMENT_PAL),
        "vestment_leggings": leggings(VESTMENT_PAL),
        "vestment_boots": boots(VESTMENT_PAL),
        "ranger_helmet": helmet(RANGER_PAL),
        "ranger_chestplate": chestplate(RANGER_PAL),
        "ranger_leggings": leggings(RANGER_PAL),
        "ranger_boots": boots(RANGER_PAL),
        "crimson_helmet": helmet(CRIMSON_PAL),
        "crimson_chestplate": chestplate(CRIMSON_PAL),
        "crimson_leggings": leggings(CRIMSON_PAL),
        "crimson_boots": boots(CRIMSON_PAL),
        "kilineyram": blade_icon("#2a0a3a", "#150520", "#8a2be2", "#3b2450", "#1c1029", "#0d0714", glow="#c05bff"),
        "safarlisia": blade_icon("#8a6238", "#5b3d22", GOLD, "#ffffff", "#fff6c9", "#f6d968", glow="#ffffff"),
        "takemikazuchi": blade_icon("#3a0d12", "#1f070a", GOLD_D, "#f2f5f9", "#c9d1df", "#8e96a6", length=10, glow="#d4202a"),
        "fell_iron": war_pick(),
        "bow_of_houyi": sun_bow(),
        "magic_wand": wand(),
        "grimoire": tome("#1f5c3a", "#143f27", "#f6d968", "#c05bff"),
        "tome_crystal_lance": tome("#2a5a7a", "#1c4058", "#e6f6ff", "#bfe8ff"),
        "fluder_staff": fluder_staff(),
        "golem_fist": golem_fist(),
        "scroll_of_rebirth": scroll("#f6d968"),
        "raid_horn": horn("#3b2450", "#e9e3cf"),
        "goblin_horn": horn("#6f9a3f", "#f6d968", "#6b4226"),
        "soul_fragment": crystal("#59e0c8", "#b8fff2", "#ffffff", "#1f7a6a"),
        "regalia_helmet": helmet(REGALIA_PAL),
        "regalia_chestplate": chestplate(REGALIA_PAL),
        "regalia_leggings": leggings(REGALIA_PAL),
        "regalia_boots": boots(REGALIA_PAL),
        "holy_staff": holy_staff(),
        "blade_bug": blade_icon("#3a2a4a", "#22182c", "#c9608f", "#d9f2a0", "#8fbf4a", "#5a8a2a", length=8),
        "pleiades_emblem": emblem(),
        "shooting_star": ring("#7fd6ff"),
        "blue_potion": potion("#2f7fe0"),
    }
    for who in SIGIL_COLORS:
        icons[f"sigil_of_{who}"] = sigil(who)
    for who, (base, spots) in EGG_COLORS.items():
        icons[f"egg_{who}"] = egg(base, spots)
    return icons
