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
def tome():
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
    ], {"K": "#120b18", "P": "#3b2450", "p": "#2b1a3d", "B": "#e9e3cf", "b": "#8d8468", "G": GOLD,
        "R": "#b3141c", "W": "#e8e2d0", "w": "#b8b09a"}, outline=False)


def potion():
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
    ], {"C": "#9a6b3a", "c": "#6e4a26", "W": "#d7e6ee", "R": "#e0202c", "r": "#ff6a5e", "w": "#ffd0c8",
        "D": "#9a0f1a"})


def crystal():
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
    ], {"C": "#43d6e8", "c": "#8ff0f7", "W": "#ecffff", "D": "#1c8fb0"})


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
}


def sigil(who):
    ring_c, base, inner, core = SIGIL_COLORS[who]
    pal = {"A": ring_c, "a": shade(ring_c, 1.25), "b": base, "C": inner, "c": shade(inner, 0.7),
           "D": core, "W": mix(core, "#ffffff", 0.6)}
    return sprite16(SIGIL, pal)


ARMOR_PAL = {"K": "#0c0b10", "k": "#2b2833", "l": "#45414f", "G": GOLD, "g": GOLD_D, "R": "#d4202a"}


def helmet():
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
    ], ARMOR_PAL, outline=False)


def chestplate():
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
    ], ARMOR_PAL, outline=False)


def leggings():
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
    ], ARMOR_PAL, outline=False)


def boots():
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
    ], ARMOR_PAL, outline=False)


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
def armor_layers():
    """Standard 64x32 humanoid armour sheets (layer 1 and layer 2)."""
    plate, plate_l, plate_d, red = "#1b1a22", "#35323f", "#0c0b10", "#d4202a"
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
    }
    for who in SIGIL_COLORS:
        icons[f"sigil_of_{who}"] = sigil(who)
    for who, (base, spots) in EGG_COLORS.items():
        icons[f"egg_{who}"] = egg(base, spots)
    return icons
