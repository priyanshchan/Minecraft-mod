"""Item icons, spawn-egg icons, block textures and armour textures (all original art)."""
from __future__ import annotations

import random

from PIL import Image

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
