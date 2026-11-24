"""v11: the party's thirty-two companions, drawn in high detail (all art is original).

Every companion is painted at four texels per model unit - a face is 32 x 32 texels instead of 8 x 8 - so
eyes have irises, lashes and a glint, hair falls in strands, plate shines and leather is stitched. Men and
women of every vocation share one skeleton (the player's bone names under a "root" bone, so the party's
poses, emotes and the walk all play on them) and differ in build: women have narrower arms and a shaped
torso. Each look is a list of choices - skin, hair and its style, eyes, a palette and its vocation's outfit
in one of four cuts - built by the functions below.
"""
from __future__ import annotations

import random

import numpy as np
from PIL import Image, ImageDraw

from modelkit import Model, rgba, shade, mix

R = 4  # texels per model unit

GOLD, GOLD_L, GOLD_D = "#d9a92b", "#f6d968", "#96701a"
SILVER, SILVER_L, SILVER_D = "#c9ced6", "#f1f4f8", "#7d838e"
LEATHER, LEATHER_D, LEATHER_L = "#6b4a36", "#45301f", "#8a6648"
BONE, BONE_D = "#e9e3cf", "#bdb496"
WOOD, WOOD_D = "#7a5230", "#4e321c"


# ------------------------------------------------------------------------------------------ painting
class Paint:
    """Paints one face of a cube in model units (fractions allowed), at the cube's resolution.

    Used as a context manager: the face is copied out, drawn on with PIL and pasted back on exit, so a
    shape can never spill onto a neighbouring face.
    """

    def __init__(self, face, res=R):
        self.face, self.r = face, res
        self.w, self.h = face.w / res, face.h / res  # size in units
        self.img = face.img.crop((face.x, face.y, face.x + face.w, face.y + face.h))
        self.d = ImageDraw.Draw(self.img)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.face.img.paste(self.img, (self.face.x, self.face.y))

    def p(self, v):
        return int(round(v * self.r))

    # shapes, in units
    def rect(self, x0, y0, x1, y1, color):
        if x1 > x0 and y1 > y0:
            self.d.rectangle([self.p(x0), self.p(y0), self.p(x1) - 1, self.p(y1) - 1], fill=rgba(color))
        return self

    def fill(self, color):
        return self.rect(0, 0, self.w, self.h, color)

    def clear(self, x0=0, y0=0, x1=None, y1=None):
        x1 = self.w if x1 is None else x1
        y1 = self.h if y1 is None else y1
        return self.rect(x0, y0, x1, y1, (0, 0, 0, 0))

    def vgrad(self, top, bottom, x0=0, y0=0, x1=None, y1=None):
        x1 = self.w if x1 is None else x1
        y1 = self.h if y1 is None else y1
        a, b = self.p(y0), self.p(y1)
        for y in range(a, b):
            t = (y - a) / max(1, b - a - 1)
            self.d.line([(self.p(x0), y), (self.p(x1) - 1, y)], fill=mix(top, bottom, t))
        return self

    def hgrad(self, left, right, x0=0, y0=0, x1=None, y1=None):
        x1 = self.w if x1 is None else x1
        y1 = self.h if y1 is None else y1
        a, b = self.p(x0), self.p(x1)
        for x in range(a, b):
            t = (x - a) / max(1, b - a - 1)
            self.d.line([(x, self.p(y0)), (x, self.p(y1) - 1)], fill=mix(left, right, t))
        return self

    def ellipse(self, x0, y0, x1, y1, color, outline=None):
        self.d.ellipse([self.p(x0), self.p(y0), self.p(x1) - 1, self.p(y1) - 1], fill=rgba(color) if color else None,
                       outline=rgba(outline) if outline else None)
        return self

    def poly(self, pts, color):
        self.d.polygon([(self.p(x), self.p(y)) for x, y in pts], fill=rgba(color))
        return self

    def line(self, pts, color, width=1):
        self.d.line([(self.p(x), self.p(y)) for x, y in pts], fill=rgba(color), width=width)
        return self

    # texels
    def px(self, x, y, color):
        if 0 <= x < self.img.width and 0 <= y < self.img.height:
            self.img.putpixel((x, y), rgba(color))
        return self

    def art(self, rows, pal, ox, oy, mirror=False):
        """Pixel art at texel (ox, oy); '.' leaves the texel be."""
        for j, row in enumerate(rows):
            if mirror:
                row = row[::-1]
            for i, ch in enumerate(row):
                if ch != ".":
                    self.px(ox + i, oy + j, pal[ch])
        return self

    def blend(self, x, y, color, alpha):
        if 0 <= x < self.img.width and 0 <= y < self.img.height:
            base = self.img.getpixel((x, y))
            if base[3]:
                self.img.putpixel((x, y), mix(base, color, alpha)[:3] + (base[3],))
        return self

    def dashes(self, y, color, x0=0, x1=None, on=2, off=2):
        """A row of stitches at unit height y."""
        x1 = self.w if x1 is None else x1
        yy = self.p(y)
        for x in range(self.p(x0), self.p(x1)):
            if (x - self.p(x0)) % (on + off) < on:
                self.px(x, yy, color)
        return self

    def rivet(self, x, y, color=SILVER_L):
        cx, cy = self.p(x), self.p(y)
        self.px(cx, cy, color).px(cx + 1, cy + 1, shade(color, 0.45))
        return self

    def noise(self, amount=6, seed=0):
        a = np.asarray(self.img).astype(np.int16)
        rng = np.random.default_rng(seed * 7919 + self.face.x * 131 + self.face.y * 31 + self.face.w)
        jitter = rng.integers(-amount, amount + 1, a.shape[:2])
        mask = a[..., 3] > 0
        for c in range(3):
            a[..., c] = np.where(mask, np.clip(a[..., c] + jitter, 0, 255), a[..., c])
        self.img.paste(Image.fromarray(a.astype(np.uint8), "RGBA"))
        return self

    def strands(self, color, seed=0, density=0.35, dark=0.82, light=1.14, y0=0, y1=None):
        """Hair: fine vertical strands of lighter and darker texels."""
        rnd = random.Random(seed)
        y1 = self.h if y1 is None else y1
        for x in range(self.img.width):
            if rnd.random() < density:
                f = dark if rnd.random() < 0.6 else light
                top = self.p(y0) + rnd.randint(0, 3)
                bottom = self.p(y1) - rnd.randint(0, 4)
                for y in range(top, bottom):
                    base = self.img.getpixel((x, y))
                    if base[3]:
                        self.img.putpixel((x, y), shade(base, f))
        return self

    def bevel(self, light=1.1, dark=0.78):
        """Lit along the top and left edge, shadowed along the bottom and right: the face reads as a solid."""
        w, h = self.img.width, self.img.height
        for x in range(w):
            for y, f in ((0, light), (h - 1, dark)):
                c = self.img.getpixel((x, y))
                if c[3]:
                    self.img.putpixel((x, y), shade(c, f))
        for y in range(h):
            for x, f in ((0, (light + 1) / 2), (w - 1, (dark + 1) / 2)):
                c = self.img.getpixel((x, y))
                if c[3]:
                    self.img.putpixel((x, y), shade(c, f))
        return self

    def darken(self, x0, y0, x1, y1, factor):
        for y in range(self.p(y0), self.p(y1)):
            for x in range(self.p(x0), self.p(x1)):
                if 0 <= x < self.img.width and 0 <= y < self.img.height:
                    c = self.img.getpixel((x, y))
                    if c[3]:
                        self.img.putpixel((x, y), shade(c, factor))
        return self


def paint(face):
    return Paint(face)


def coat(cube, color, top=1.06, bottom=0.86, noise=5, seed=1, bevel=True):
    """Every face of a cube in one colour, lit from above, with grain and a bevel."""
    for i, f in enumerate(cube.faces):
        with paint(f) as p:
            if f in (cube.top, cube.bottom):
                p.fill(shade(color, top if f is cube.top else 0.62))
            else:
                p.vgrad(shade(color, top), shade(color, bottom))
            if noise:
                p.noise(noise, seed + i)
            if bevel:
                p.bevel()
    return cube


def sides(cube):
    return [cube.right, cube.front, cube.left, cube.back]


def band(cube, y0, y1, color, trim=None):
    """A band round the four sides, between unit heights y0 and y1 measured from the top."""
    for f in sides(cube):
        with paint(f) as p:
            p.vgrad(shade(color, 1.08), shade(color, 0.88), 0, y0, p.w, y1)
            if trim:
                p.rect(0, y0, p.w, y0 + 0.25, trim).rect(0, y1 - 0.25, p.w, y1, shade(trim, 0.7))
    return cube


def hollow(cube):
    """Leaves the top and bottom of an overlay open (sleeves, skirts, collars)."""
    for f in (cube.top, cube.bottom):
        with paint(f) as p:
            p.clear()
    return cube


# ------------------------------------------------------------------------------------------ the body
class Figure:
    """The bones and base cubes of one companion, for its outfit to dress."""

    def __init__(self, n, look):
        self.n, self.look = n, look
        self.female = look["sex"] == "f"
        self.m = Model(f"retainer_{n}", bounds=(3.4, 3.8, 1.3), res=R)
        m = self.m
        self.root = m.bone("root", (0, 0, 0))
        self.body = m.bone("body", (0, 24, 0), parent="root")
        self.torso = self.body.cube((-4, 12, -2), (8, 12, 4))
        self.head = m.bone("head", (0, 24, 0), parent="body")
        self.skull = self.head.cube((-4, 24, -4), (8, 8, 8))
        self.aw = 3 if self.female else 4
        aw = self.aw
        self.rarm = m.bone("rightArm", (-5, 22, 0), parent="body")
        self.larm = m.bone("leftArm", (5, 22, 0), parent="body")
        self.rarm_c = self.rarm.cube((-4 - aw, 12, -2), (aw, 12, 4))
        self.larm_c = self.larm.cube((4, 12, -2), (aw, 12, 4))
        self.rleg = m.bone("rightLeg", (-1.9, 12, 0), parent="root")
        self.lleg = m.bone("leftLeg", (1.9, 12, 0), parent="root")
        self.rleg_c = self.rleg.cube((-3.9, 0, -2), (4, 12, 4))
        self.lleg_c = self.lleg.cube((-0.1, 0, -2), (4, 12, 4))
        self.hx = -4 - aw / 2  # the centre of the right hand, where weapons are held
        self.ox = 4 + aw / 2
        self.weapon = m.bone("weapon", (self.hx, 13, -2), parent="rightArm")
        self.offhand = m.bone("offhand", (self.ox, 13, -2), parent="leftArm")
        self.cape = m.bone("cape", (0, 24, 2), parent="body")
        self.chest = None  # (colour, kind, inflate, trim) of the outermost layer over a woman's chest

    # the arms and legs as pairs: (bone, cube, x of the outer face, side sign)
    @property
    def arms(self):
        return [(self.rarm, self.rarm_c, -4 - self.aw, -1), (self.larm, self.larm_c, 4, 1)]

    @property
    def legs(self):
        return [(self.rleg, self.rleg_c, -3.9, -1), (self.lleg, self.lleg_c, -0.1, 1)]


def skin_tones(skin):
    return {"S": skin, "s": shade(skin, 0.86), "z": shade(skin, 0.74), "l": shade(skin, 1.07)}


def paint_skin(cube, skin, seed=0):
    coat(cube, skin, top=1.04, bottom=0.92, noise=2, seed=seed, bevel=False)


def paint_face(fig):
    """The face: skin with a soft jaw shadow, brows, eyes with iris, pupil and glint, nose, mouth, blush."""
    look = fig.look
    skin, eye, hair = look["skin"], look["eyes"], look["hair"]
    paint_skin(fig.skull, skin, fig.n)
    lash = mix(shade(hair, 0.4), "#1a1216", 0.5)
    iris_d, iris, iris_l = shade(eye, 0.55), eye, mix(eye, "#ffffff", 0.35)
    pal = {"L": lash, "W": "#f6f3ee", "D": iris_d, "I": iris, "J": iris_l, "P": shade(eye, 0.22), "H": "#ffffff",
           "s": shade(skin, 0.86), "z": shade(skin, 0.78)}
    if fig.female:
        eye_rows = [
            "L.....",
            ".LLLLL",
            "LDDDDL",
            "WHIPIW",
            "WIPPIW",
            ".JJJJ.",
            "..ss..",
        ]
        ex, ey = 5, 14
    else:
        eye_rows = [
            ".LLLL.",
            "LDDDDL",
            "WHIPIW",
            ".JIIJ.",
            "..ss..",
        ]
        ex, ey = 5, 15
    glow = look.get("glow")  # undead light in the eyes
    if glow:
        pal.update({"D": shade(glow, 0.7), "I": glow, "J": mix(glow, "#ffffff", 0.5), "P": mix(glow, "#ffffff", 0.7), "W": "#1a1216"})
    with paint(fig.skull.front) as p:
        # a soft shadow under the jaw and down the sides
        p.darken(0, 7.25, 8, 8, 0.9)
        p.darken(0, 0, 0.5, 8, 0.95).darken(7.5, 0, 8, 8, 0.95)
        # brows
        brow = shade(hair, 0.75)
        by = ey - 3 if fig.female else ey - 2
        for x in range(ex, ex + 6):
            p.px(x, by + (1 if x == ex else 0), brow)
            p.px(31 - x, by + (1 if x == ex else 0), brow)
        if not fig.female:
            for x in range(ex + 1, ex + 5):
                p.px(x, by - 1, shade(brow, 1.1))
                p.px(31 - x, by - 1, shade(brow, 1.1))
        # eyes, the right one mirrored
        p.art(eye_rows, pal, ex, ey)
        p.art(eye_rows, pal, 32 - ex - 6, ey, mirror=True)
        # nose: a little shadow and a highlight
        ny = ey + len(eye_rows) + 1
        p.px(15, ny, pal["z"]).px(16, ny, pal["s"]).px(16, ny - 1, shade(skin, 1.06))
        # mouth
        my = ny + 3
        lips = look.get("lips", "#b8606a" if fig.female else shade(skin, 0.62))
        if fig.female:
            p.px(14, my, lips).px(15, my, shade(lips, 0.85)).px(16, my, shade(lips, 0.85)).px(17, my, lips)
            p.px(15, my + 1, shade(lips, 1.12)).px(16, my + 1, shade(lips, 1.12))
            for x, y in ((6, ny), (7, ny), (24, ny), (25, ny)):
                p.blend(x, y, "#ff7c8a", 0.35)
        else:
            for x in range(13, 19):
                p.px(x, my, lips)
            p.px(15, my + 1, shade(skin, 0.9)).px(16, my + 1, shade(skin, 0.9))
        if look.get("scar"):
            for i in range(5):
                p.px(22 + (i % 2), 12 + i, shade(skin, 0.7))
    # ears on the sides
    for f in (fig.skull.right, fig.skull.left):
        with paint(f) as p:
            p.rect(3.25, 3.75, 4.75, 5.75, shade(skin, 0.94)).rect(3.75, 4.25, 4.25, 5.25, shade(skin, 0.8))


def paint_body_skin(fig):
    skin = fig.look["skin"]
    for i, (_, cube, _, _) in enumerate(fig.arms + fig.legs):
        paint_skin(cube, skin, fig.n * 7 + i)
    paint_skin(fig.torso, skin, fig.n * 7 + 5)


def elf_ears(fig):
    skin = fig.look["skin"]
    for x, flip in ((-5.25, False), (4.25, True)):
        ear = fig.head.cube((x, 27.25, 0), (1, 2, 1), rotation=(0, 0, -25 if not flip else 25), pivot=(x + 0.5, 27, 0.5))
        coat(ear, skin, noise=2, bevel=False)
        with paint(ear.front) as p:
            p.rect(0.25, 0.5, 0.75, 1.75, shade(skin, 0.82))


# ------------------------------------------------------------------------------------------ hair
FRINGES = {
    # a curtain of bangs over the forehead: the hair line in units from the top, at each texel column
    "straight": lambda x: 2.75 + (0.35 if (x // 3) % 2 else 0),
    "swept": lambda x: 1.5 + x / 32 * 2.5 + (0.3 if (x // 3) % 2 else 0),
    "parted": lambda x: 3.0 - abs(x - 15.5) / 16 * 1.75 + (0.25 if (x // 2) % 3 == 0 else 0),
    "spiky": lambda x: 2.25 + [0, 0.9, 1.6, 0.9][(x // 2) % 4],
    "short": lambda x: 1.5 + (0.3 if (x // 4) % 2 else 0),
    "none": lambda x: 0.75,
}


def hair_colors(hair):
    return shade(hair, 1.18), hair, shade(hair, 0.78), shade(hair, 0.6)


def hair_cap(fig, fringe="straight", sides="ear", back="short", inflate=0.45, top=True):
    """The hair over the head: a shell around it, open where the face shows.

    sides: "ear" (cut above the ear), "jaw" (down to the jaw, in front of the ears), "full" (all the way down)
    back: "short" (to the nape), "full" (to the bottom of the head)
    """
    hl, h, hd, hdd = hair_colors(fig.look["hair"])
    cap = fig.head.cube((-4, 24, -4), (8, 8, 8), inflate=inflate)
    seed = fig.n * 13
    edge = FRINGES[fringe]
    with paint(cap.top) as p:
        p.fill(h).strands(h, seed, 0.5).noise(5, seed)
        p.ellipse(2, 2, 6, 6, hl)  # the crown catches the light
        p.strands(hl, seed + 1, 0.5)
    with paint(cap.front) as p:
        p.vgrad(hl, hd).strands(h, seed + 2)
        for x in range(p.img.width):
            cut = int(edge(x) * R)
            for y in range(cut, p.img.height):
                p.px(x, y, (0, 0, 0, 0))
            p.px(x, cut - 1, hdd)  # the shadow under the fringe
        # the angel ring: a band of shine across the fringe
        for x in range(p.img.width):
            if (x * 7) % 5 < 3:
                p.blend(x, 4, "#ffffff", 0.22)
        if fringe == "parted":
            p.line([(4, 0), (4, 1.25)], hdd)
    for f, right in ((cap.right, True), (cap.left, False)):
        with paint(f) as p:
            p.vgrad(hl, hd).strands(h, seed + (3 if right else 4))
            # the side faces run from the front edge to the back (right face: x=0 is the back... modelkit's
            # right face starts at the back corner); open the ear and cheek
            front_at_low_x = not right
            if sides == "ear":
                cut = (3.0, 4.5) if front_at_low_x else (3.5, 5.0)
                lo, hi = (0, cut[1]) if front_at_low_x else (cut[0], 8)
                p.clear(lo, 3.5, hi, 8)
                p.line([(lo if front_at_low_x else hi, 3.5), (hi if front_at_low_x else lo, 3.5)], hdd)
            elif sides == "jaw":
                lo, hi = (0, 1.25) if front_at_low_x else (6.75, 8)
                p.clear(lo, 6.5, hi, 8)
            if back == "short":
                lo, hi = (5.5, 8) if front_at_low_x else (0, 2.5)
                if sides == "ear":
                    p.clear(lo, 6.25, hi, 8)
    with paint(cap.back) as p:
        p.vgrad(hl, hd).strands(h, seed + 5)
        if back == "short":
            p.clear(0, 6.5, 8, 8)
            p.line([(0, 6.4), (8, 6.4)], hdd)
    with paint(cap.bottom) as p:
        p.clear()
    return cap


def hair_panel(fig, origin, size, rotation=None, pivot=None, seed=0, ragged=True):
    """A hanging lock or tail of hair."""
    hl, h, hd, hdd = hair_colors(fig.look["hair"])
    c = fig.head.cube(origin, size, rotation=rotation, pivot=pivot)
    for i, f in enumerate(c.faces):
        with paint(f) as p:
            p.vgrad(hl if f is not c.bottom else hd, hdd if f not in (c.top, c.bottom) else hd).strands(h, fig.n * 17 + seed + i, 0.45)
            if ragged and f in sides(c):
                for x in range(p.img.width):
                    cut = (x * 5 + seed) % 3
                    for k in range(cut):
                        p.px(x, p.img.height - 1 - k, (0, 0, 0, 0))
    return c


def hair_style(fig):
    style = fig.look["style"]
    fringe = fig.look.get("fringe", "straight" if fig.female else "short")
    if style == "short":
        hair_cap(fig, fringe, "ear", "short")
    elif style == "crop":  # cropped close, the monk's or soldier's
        hair_cap(fig, "none", "ear", "short", inflate=0.2)
    elif style == "bald":
        pass
    elif style == "topknot":
        hair_cap(fig, "none", "ear", "short", inflate=0.15)
        hair_panel(fig, (-1, 32, 0), (2, 2, 2), seed=1, ragged=False)
        hair_panel(fig, (-0.5, 33.5, 0.5), (1, 2, 1), seed=2, ragged=False)
    elif style == "bob":
        hair_cap(fig, fringe, "jaw", "full")
        for x in (-4.75, 3.75):
            hair_panel(fig, (x, 21.5, -3.75), (1, 5, 3), seed=int(x * 10))
    elif style == "long":
        hair_cap(fig, fringe, "jaw", "full")
        hair_panel(fig, (-4.25, 12, 2.6), (8, 18, 1), seed=3)
        for x in (-4.75, 3.75):
            hair_panel(fig, (x, 17, -3.5), (1, 9, 2), seed=int(x * 10) + 4)
    elif style == "ponytail":
        hair_cap(fig, fringe, "jaw" if fig.female else "ear", "full")
        hair_panel(fig, (-1.5, 28, 4.25), (3, 3, 2), seed=5, ragged=False)
        hair_panel(fig, (-1, 15, 4.4), (2, 13, 2), rotation=(-12, 0, 0), pivot=(0, 28, 5), seed=6)
    elif style == "twintails":
        hair_cap(fig, fringe, "jaw", "full")
        for x in (-6.25, 4.25):
            hair_panel(fig, (x, 28.5, -0.5), (2, 2, 2), seed=7, ragged=False)
            hair_panel(fig, (x, 14, 0), (2, 15, 2), rotation=(0, 0, 8 if x < 0 else -8), pivot=(x + 1, 29, 1), seed=8)
    elif style == "braid":
        hair_cap(fig, fringe, "jaw", "full")
        braid = hair_panel(fig, (-1, 11, 4.0), (2, 15, 2), seed=9, ragged=False)
        hl, h, hd, hdd = hair_colors(fig.look["hair"])
        for f in sides(braid):
            with paint(f) as p:
                for y in range(0, 15, 2):
                    p.line([(0, y + 0.25), (2, y + 1.5)], hdd).line([(0, y + 1.5), (2, y + 0.25)], hl)
        tie = fig.head.cube((-1, 11.5, 4.0), (2, 1, 2), inflate=0.15)
        coat(tie, fig.look.get("trim", GOLD), noise=0)
    elif style == "buns":
        hair_cap(fig, fringe, "jaw", "full")
        for x in (-4.5, 2.5):
            hair_panel(fig, (x, 31, -1), (2, 2, 2), seed=10, ragged=False)
    elif style == "wild":  # a mane, spiky at the back
        hair_cap(fig, "spiky", "jaw", "full", inflate=0.6)
        for i, x in enumerate((-3.5, -1, 1.5)):
            hair_panel(fig, (x, 25, 4.3), (2, 4, 1), rotation=(-25, 0, 0), pivot=(x + 1, 29, 4.5), seed=11 + i)
    elif style == "slick":  # swept back
        hair_cap(fig, "none", "ear", "full", inflate=0.35)
        hair_panel(fig, (-3, 27, 4.2), (6, 3, 1), seed=14)
    if fig.look.get("beard"):
        beard(fig)


def beard(fig):
    hl, h, hd, hdd = hair_colors(fig.look["hair"])
    b = fig.head.cube((-4, 23, -4.35), (8, 3, 1))
    with paint(b.front) as p:
        p.vgrad(h, hd).strands(h, fig.n, 0.6)
        p.clear(2.75, 0, 5.25, 0.75)  # the mouth shows above it
        for x in range(p.img.width):
            if x % 3 == 0:
                p.px(x, p.img.height - 1, (0, 0, 0, 0))
    for f in (b.right, b.left, b.top, b.bottom, b.back):
        with paint(f) as p:
            p.fill(hd)
    with paint(fig.skull.front) as p:  # stubble along the jaw and the moustache
        for x in range(8, 24):
            p.px(x, 23, hd)
            if x in range(10, 22):
                p.px(x, 22, h if 13 <= x <= 18 else hd)
    side_burns = fig.head.cube((-4.3, 24, -4.3), (8, 4, 1), inflate=0.0)
    with paint(side_burns.front) as p:
        p.clear()
        p.rect(0, 0, 0.75, 4, hd).rect(7.25, 0, 8, 4, hd)
    for f in (side_burns.right, side_burns.left, side_burns.top, side_burns.bottom, side_burns.back):
        with paint(f) as p:
            p.clear()


# ------------------------------------------------------------------------------------------ clothes
def cloth_face(p, color, seed, folds=True, top=1.06, bottom=0.84):
    p.vgrad(shade(color, top), shade(color, bottom))
    if folds:  # soft vertical folds
        rnd = random.Random(seed)
        for _ in range(max(1, int(p.w / 2))):
            x = rnd.uniform(0.5, max(0.6, p.w - 0.5))
            p.line([(x, rnd.uniform(0, p.h * 0.3)), (x + rnd.uniform(-0.3, 0.3), p.h)], shade(color, 0.9))
    p.noise(4, seed)


def dress_cube(cube, color, seed=0, folds=True, bevel=True):
    for i, f in enumerate(cube.faces):
        with paint(f) as p:
            if f in (cube.top, cube.bottom):
                p.fill(shade(color, 1.05 if f is cube.top else 0.6)).noise(3, seed + i)
            else:
                cloth_face(p, color, seed + i, folds)
            if bevel:
                p.bevel(1.06, 0.84)
    return cube


def metal_face(p, color, seed, rivets=False, trim=None, vertical_shine=True):
    p.vgrad(shade(color, 1.18), shade(color, 0.72))
    if vertical_shine:  # a bright streak where the light catches the curve
        x = p.w * 0.3
        p.rect(x, 0, x + 0.5, p.h, shade(color, 1.28))
        p.rect(x + 0.5, 0, x + 0.75, p.h, shade(color, 1.1))
    p.noise(3, seed)
    if trim:
        p.rect(0, 0, p.w, 0.5, trim).rect(0, p.h - 0.5, p.w, p.h, shade(trim, 0.7))
    if rivets and p.h >= 2:
        for x in (0.5, p.w - 0.75):
            for y in (0.75, p.h - 1.0):
                p.rivet(x, y)
    p.bevel(1.15, 0.7)


def armour_cube(cube, color, seed=0, rivets=False, trim=None):
    for i, f in enumerate(cube.faces):
        with paint(f) as p:
            if f is cube.bottom:
                p.fill(shade(color, 0.5))
            else:
                metal_face(p, color, seed + i, rivets and f in sides(cube), trim if f in sides(cube) else None)
    return cube


def leather_cube(cube, color, seed=0, stitch=True):
    for i, f in enumerate(cube.faces):
        with paint(f) as p:
            p.vgrad(shade(color, 1.1), shade(color, 0.8)).noise(6, seed + i)
            if stitch and f in sides(cube) and p.h >= 1.5:
                p.dashes(0.35, shade(color, 1.35)).dashes(p.h - 0.4, shade(color, 1.35))
            p.bevel(1.1, 0.75)
    return cube


def clothe(fig, top, bottom, sleeves=None, hands=None, trim=None, neckline="round", seed=0):
    """The base clothes: a top over the torso and arms, trousers or hose on the legs, bare hands."""
    skin = fig.look["skin"]
    sleeves = sleeves or top
    with paint(fig.torso.front) as p:
        cloth_face(p, top, seed)
        if neckline == "v":
            p.poly([(2.75, 0), (5.25, 0), (4, 2.25)], skin).line([(2.75, 0), (4, 2.25), (5.25, 0)], shade(top, 0.7))
        elif neckline == "round":
            p.ellipse(2.75, -0.75, 5.25, 0.85, skin)
        elif neckline == "high":
            p.rect(2.5, 0, 5.5, 0.6, shade(top, 1.15))
        if fig.female:  # a shaped waist
            p.darken(0, 4.5, 0.75, 8.5, 0.86).darken(7.25, 4.5, 8, 8.5, 0.86)
        if trim:
            p.rect(0, 11.5, 8, 12, trim)
    for f in (fig.torso.right, fig.torso.left, fig.torso.back, fig.torso.top, fig.torso.bottom):
        with paint(f) as p:
            cloth_face(p, top, seed + 1) if f not in (fig.torso.top, fig.torso.bottom) else p.fill(shade(top, 0.95))
    for i, (_, cube, _, _) in enumerate(fig.arms):
        for j, f in enumerate(cube.faces):
            with paint(f) as p:
                if f is cube.top:
                    p.fill(shade(sleeves, 1.04))
                elif f is cube.bottom:
                    p.fill(hands or skin)
                else:
                    cloth_face(p, sleeves, seed + 10 + i * 6 + j)
                    p.vgrad(shade(hands or skin, 1.02), shade(hands or skin, 0.9), 0, 10.75, p.w, 12)
                    if trim:
                        p.rect(0, 10.25, p.w, 10.75, trim)
                    p.bevel(1.05, 0.85)
    for i, (_, cube, _, _) in enumerate(fig.legs):
        for j, f in enumerate(cube.faces):
            with paint(f) as p:
                if f in (cube.top, cube.bottom):
                    p.fill(shade(bottom, 0.8))
                else:
                    cloth_face(p, bottom, seed + 30 + i * 6 + j)
                    p.bevel(1.04, 0.85)
    fig.chest = (top, "cloth", 0.05, trim)


def bust(fig, color, trim=None, kind="cloth", inflate=0.05):
    """A woman's figure under her outermost layer (cloth, leather or plate), drawn once the outfit is on."""
    metal = kind == "metal"
    b = fig.body.cube((-3.25, 18.25, -2.6), (6, 3, 1), inflate=inflate)
    if metal:
        armour_cube(b, color, fig.n)
    elif kind == "leather":
        leather_cube(b, color, fig.n, stitch=False)
    else:
        dress_cube(b, color, fig.n, folds=False)
    with paint(b.front) as p:
        p.line([(3, 0.5), (3, 3)], shade(color, 0.72))  # the parting between
        p.darken(0, 2.4, 6, 3, 0.82)
        if trim and not metal:
            p.rect(0, 0, 6, 0.35, trim)
    with paint(b.top) as p:
        p.fill(shade(color, 1.1))
    return b


def boots(fig, color, height=4, cuff=None, seed=0, metal=False):
    out = []
    for i, (bone, _, x, _) in enumerate(fig.legs):
        boot = bone.cube((x, 0, -2), (4, height, 4), inflate=0.28)
        (armour_cube if metal else leather_cube)(boot, color, seed + i)
        with paint(boot.front) as p:  # the toe
            p.rect(0.5, height - 1, 3.5, height, shade(color, 0.8))
            p.rect(0, height - 0.3, 4, height, shade(color, 0.55))
            if cuff:
                p.rect(0, 0, 4, 0.75, cuff)
        if cuff:
            for f in (boot.right, boot.left, boot.back):
                with paint(f) as p:
                    p.rect(0, 0, p.w, 0.75, cuff)
        out.append(boot)
    return out


def belt(fig, color, buckle=GOLD, y=12, pouch=True, sash=None):
    b = fig.body.cube((-4, y, -2), (8, 1, 4), inflate=0.34)
    if sash:
        dress_cube(b, sash, fig.n, folds=False)
    else:
        leather_cube(b, color, fig.n)
    with paint(b.front) as p:
        p.rect(3.25, 0.1, 4.75, 0.9, buckle).rect(3.75, 0.35, 4.25, 0.65, shade(buckle, 0.5))
    hollow(b)
    if pouch:
        pc = fig.body.cube((1.75, 10.75, -2.75), (2, 2, 1))
        leather_cube(pc, LEATHER, fig.n + 3)
        with paint(pc.front) as p:
            p.rect(0, 0, 2, 0.75, shade(LEATHER, 0.8)).rivet(1, 0.5, buckle)
    if sash:
        tail = fig.body.cube((-3.5, 8.5, -2.7), (2, 4, 1), rotation=(0, 0, 8), pivot=(-2.5, 12.5, -2.2))
        dress_cube(tail, sash, fig.n + 5)
    return b


def skirt(fig, color, length=5, trim=None, flare=0.6, slit=False, seed=0, pattern=None):
    """A skirt or the lower part of a robe, hanging from the waist."""
    s = fig.body.cube((-4, 12 - length, -2), (8, length, 4), inflate=flare)
    dress_cube(s, color, fig.n + seed)
    hollow(s)
    for f in sides(s):
        with paint(f) as p:
            if trim:
                p.rect(0, p.h - 0.6, p.w, p.h, trim).rect(0, p.h - 0.85, p.w, p.h - 0.6, shade(trim, 0.6))
            if pattern:
                pattern(p)
    if slit:
        with paint(s.front) as p:
            p.clear(3.5, length * 0.35, 4.5, length)
    return s


def robe_legs(fig, color, trim=None, length=7, seed=0):
    """A long robe's hem, split over the legs so they can walk."""
    out = []
    for i, (bone, _, x, _) in enumerate(fig.legs):
        c = bone.cube((x, 12 - length, -2), (4, length, 4), inflate=0.62)
        dress_cube(c, color, fig.n + seed + i)
        hollow(c)
        if trim:
            for f in sides(c):
                with paint(f) as p:
                    p.rect(0, p.h - 0.6, p.w, p.h, trim)
        out.append(c)
    return out


def sleeves(fig, color, length=5, trim=None, flare=0.45, seed=0):
    out = []
    for i, (bone, _, x, _) in enumerate(fig.arms):
        c = bone.cube((x, 24 - length, -2), (fig.aw, length, 4), inflate=flare)
        dress_cube(c, color, fig.n + seed + i)
        hollow(c)
        if trim:
            for f in sides(c):
                with paint(f) as p:
                    p.rect(0, p.h - 0.5, p.w, p.h, trim)
        out.append(c)
    return out


def cuffs(fig, color, height=3, metal=False, trim=None):
    """Bracers, gauntlets or wide cuffs at the wrists."""
    out = []
    for i, (bone, _, x, _) in enumerate(fig.arms):
        c = bone.cube((x, 12, -2), (fig.aw, height, 4), inflate=0.3)
        (armour_cube if metal else leather_cube)(c, color, fig.n + i)
        if trim:
            for f in sides(c):
                with paint(f) as p:
                    p.rect(0, 0, p.w, 0.4, trim)
        out.append(c)
    return out


def pauldrons(fig, color, trim=None, size=4, spiked=False, seed=0):
    out = []
    for i, (bone, _, x, sign) in enumerate(fig.arms):
        c = bone.cube((x - 0.5, 24 - size + 0.5, -2.5), (fig.aw + 1, size, 5), inflate=0.15)
        armour_cube(c, color, fig.n + seed + i, rivets=True, trim=trim)
        with paint(c.top) as p:
            p.ellipse(0.5, 0.5, p.w - 0.5, p.h - 0.5, shade(color, 1.2))
        if spiked:
            sp = bone.cube((x + fig.aw / 2 - 0.5, 24.5, -0.5), (1, 2, 1))
            armour_cube(sp, BONE if spiked == "bone" else shade(color, 1.1), fig.n)
        out.append(c)
    return out


def cape(fig, color, length=17, trim=None, lining=None, ragged=False, width=8, emblem=None):
    c = fig.cape.cube((-width / 2, 24 - length, 2.2), (width, length, 1))
    dress_cube(c, color, fig.n + 40)
    with paint(c.back) as p:
        if trim:
            p.rect(0, p.h - 0.6, p.w, p.h, trim).rect(0, 0, 0.35, p.h, trim).rect(p.w - 0.35, 0, p.w, p.h, trim)
        if emblem:
            emblem(p)
        if ragged:
            rnd = random.Random(fig.n)
            for x in range(p.img.width):
                for k in range(rnd.randint(0, 7)):
                    p.px(x, p.img.height - 1 - k, (0, 0, 0, 0))
    with paint(c.front) as p:
        p.vgrad(shade(lining or color, 0.8), shade(lining or color, 0.6))
        if ragged:
            rnd = random.Random(fig.n)
            for x in range(p.img.width):
                for k in range(rnd.randint(0, 7)):
                    p.px(p.img.width - 1 - x, p.img.height - 1 - k, (0, 0, 0, 0))
    return c


def tabard(fig, color, trim=GOLD, emblem=None, length=16):
    lift = 0.5 if fig.female and not fig.look.get("flat") else 0  # hangs clear of the figure
    t = fig.body.cube((-2.5, 24 - length, -2.75 - lift), (5, length, 1))
    dress_cube(t, color, fig.n + 50, folds=False)
    with paint(t.front) as p:
        p.rect(0, 0, 0.35, p.h, trim).rect(p.w - 0.35, 0, p.w, p.h, trim).rect(0, p.h - 0.4, p.w, p.h, trim)
        if emblem:
            emblem(p)
    return t


def collar(fig, color, fur=False, height=2):
    c = fig.body.cube((-4.5, 24 - height + 0.5, -2.5), (9, height, 5), inflate=0.2)
    if fur:
        for i, f in enumerate(c.faces):
            with paint(f) as p:
                p.fill(color).noise(18, fig.n + i).strands(color, fig.n + i, 0.6, 0.75, 1.2)
    else:
        dress_cube(c, color, fig.n + 60, folds=False)
    with paint(c.top) as p:
        p.clear(1.5, 1, 7.5, 4)
    with paint(c.front) as p:
        p.clear(3, 0, 6, 1)
    with paint(c.bottom) as p:
        p.clear()
    return c


def hood(fig, color, lining=None, depth=0.75, peak=True, open_rows=(1.5, 8)):
    h = fig.head.cube((-4, 24, -4), (8, 8, 8), inflate=depth)
    dress_cube(h, color, fig.n + 70)
    with paint(h.front) as p:
        p.clear(1, open_rows[0], 7, open_rows[1])
        p.rect(0.5, open_rows[0] - 0.5, 7.5, open_rows[0], shade(lining or color, 0.55))
        p.rect(0.5, open_rows[0], 1, 8, shade(lining or color, 0.5)).rect(7, open_rows[0], 7.5, 8, shade(lining or color, 0.5))
    with paint(h.bottom) as p:
        p.clear()
    if peak:
        tip = fig.head.cube((-1, 29, 4.5), (2, 3, 2), rotation=(-30, 0, 0), pivot=(0, 31, 4.5))
        dress_cube(tip, color, fig.n + 71)
    drape = fig.body.cube((-4.5, 18.5, 2.3), (9, 5, 1))
    dress_cube(drape, color, fig.n + 72)
    return h


def circlet(fig, color=GOLD, gem=None, y=29.25):
    c = fig.head.cube((-4, y, -4), (8, 1, 8), inflate=0.55)
    armour_cube(c, color, fig.n)
    hollow(c)
    if gem:
        g = fig.head.cube((-0.5, y - 0.25, -5.0), (1, 1, 1))
        coat(g, gem, noise=0)
        with paint(g.front) as p:
            p.rect(0, 0, 0.5, 0.5, mix(gem, "#ffffff", 0.6))
    return c


def veil(fig, color, band=None, length=10):
    """A veil over the hair, falling down the back."""
    v = fig.head.cube((-4, 24, -4), (8, 8, 8), inflate=0.55)
    dress_cube(v, color, fig.n + 80, folds=False)
    with paint(v.front) as p:
        p.clear(0.75, 1.75, 7.25, 8)
        if band:
            p.rect(0, 1.0, 8, 1.75, band)
    with paint(v.bottom) as p:
        p.clear()
    back = fig.head.cube((-4.25, 24 - length + 4, 3.8), (8, length, 1), inflate=0.3)
    dress_cube(back, color, fig.n + 81)
    if band:
        for f in (v.right, v.left, v.back):
            with paint(f) as p:
                p.rect(0, 1.0, p.w, 1.75, band)
    return v


def mask(fig, color, eyes_open=True, skull=False):
    """A cloth mask over the lower face, or a skull mask over the whole of it."""
    if skull:
        mk = fig.head.cube((-4, 24, -4.6), (8, 8, 1))
        coat(mk, BONE, noise=4)
        with paint(mk.front) as p:
            p.fill(BONE).noise(6, fig.n)
            p.ellipse(1.25, 2.75, 3.5, 5.0, "#140c18").ellipse(4.5, 2.75, 6.75, 5.0, "#140c18")
            glow = fig.look.get("glow", "#7df0c8")
            p.rect(2.0, 3.5, 2.5, 4.0, glow).rect(5.25, 3.5, 5.75, 4.0, glow)
            p.poly([(3.6, 5.4), (4.4, 5.4), (4, 6.2)], "#3a2f2a")
            for x in range(2, 6):
                p.rect(x + 0.1, 6.6, x + 0.8, 7.4, shade(BONE, 0.9)).line([(x, 6.6), (x, 7.4)], "#3a2f2a")
            p.darken(0, 0, 8, 1, 0.9)
        return mk
    mk = fig.head.cube((-4, 24, -4.45), (8, 3, 1))
    dress_cube(mk, color, fig.n + 90, folds=False)
    with paint(mk.front) as p:
        p.line([(0, 0.25), (8, 0.25)], shade(color, 1.25))
        for x in (2, 4, 6):
            p.line([(x, 0.75), (x - 0.3, 3)], shade(color, 0.8))
    return mk


# ------------------------------------------------------------------------------------------ headgear
def helm(fig, metal, trim=GOLD, plume=None, visor=True, wings=None, horns=None, open_face=False):
    h = fig.head.cube((-4, 24, -4), (8, 8, 8), inflate=0.62)
    armour_cube(h, metal, fig.n, trim=None)
    with paint(h.front) as p:
        if open_face:
            p.clear(1, 2.75, 7, 8)
            p.rect(1, 2.25, 7, 2.75, trim)
        elif visor:
            p.rect(1, 3.25, 7, 4.25, "#0c0a10").rect(1, 3.0, 7, 3.25, trim)
            for x in (2, 3, 4, 5, 6):
                p.rivet(x, 5.5)
            p.line([(4, 4.5), (4, 8)], shade(metal, 0.7))
        p.rect(0, 0, 8, 0.5, shade(trim, 1.1))
    with paint(h.bottom) as p:
        p.clear()
    if plume:
        pl = fig.head.cube((-0.5, 32.5, -3.5), (1, 3, 8))
        for i, f in enumerate(pl.faces):
            with paint(f) as p:
                p.vgrad(shade(plume, 1.2), shade(plume, 0.7)).strands(plume, fig.n + i, 0.7)
        crest = fig.head.cube((-0.5, 32.4, -4), (1, 1, 1))
        armour_cube(crest, trim, fig.n)
    if wings:
        for x, ry in ((-5.5, 20), (4.5, -20)):
            w = fig.head.cube((x, 28, -1), (1, 4, 5), rotation=(0, ry, 0), pivot=(x + 0.5, 28, 1))
            for i, f in enumerate(w.faces):
                with paint(f) as p:
                    p.vgrad(shade(wings, 1.15), shade(wings, 0.8))
                    for k in range(4):
                        p.line([(0, k + 0.5), (p.w, k + 1.2)], shade(wings, 0.7))
                    p.bevel()
    if horns:
        for x, rz in ((-6, 25), (5, -25)):
            hn = fig.head.cube((x, 29, -0.5), (1, 4, 1), rotation=(0, 0, rz), pivot=(x + 0.5, 29, 0))
            armour_cube(hn, horns, fig.n)
    return h


def wizard_hat(fig, color, band=GOLD, wide=6.5, bent=True, seed=0):
    brim = fig.head.cube((-wide, 31.25, -wide), (int(wide * 2), 1, int(wide * 2)))
    dress_cube(brim, color, fig.n + seed, folds=False)
    with paint(brim.top) as p:
        p.ellipse(0, 0, p.w, p.h, shade(color, 1.05))
    tiers = [(8, 2.5), (6, 2.5), (4, 2.5), (2, 2)]
    y = 32.25
    for i, (size, h) in enumerate(tiers):
        lean = (i * 0.8) if bent else 0
        t = fig.head.cube((-size / 2, y, -size / 2 + lean), (size, int(h + 0.5), size),
                          rotation=(-10 * i if bent else 0, 0, 0), pivot=(0, y, lean))
        dress_cube(t, color, fig.n + seed + i)
        y += h
        if i == 0:
            for f in sides(t):
                with paint(f) as p:
                    p.rect(0, p.h - 1, p.w, p.h, band).rect(0, p.h - 1, p.w, p.h - 0.75, shade(band, 1.2))
    buckle = fig.head.cube((-0.75, 32.25, -4.4), (2, 1, 1))
    armour_cube(buckle, GOLD, fig.n)


def cap(fig, color, feather=None, brim=True):
    c = fig.head.cube((-4, 29.5, -4), (8, 3, 8), inflate=0.6)
    dress_cube(c, color, fig.n + 100, folds=False)
    with paint(c.bottom) as p:
        p.clear()
    if brim:
        b = fig.head.cube((-5, 29.75, -5.5), (10, 1, 10))
        dress_cube(b, shade(color, 0.85), fig.n + 101, folds=False)
    if feather:
        f = fig.head.cube((3, 32, -1), (1, 7, 3), rotation=(-30, 0, 18), pivot=(3.5, 32, 0.5))
        for i, face in enumerate(f.faces):
            with paint(face) as p:
                p.vgrad(shade(feather, 1.2), shade(feather, 0.75))
                p.line([(p.w / 2, 0), (p.w / 2, p.h)], mix(feather, "#ffffff", 0.5))
                for k in range(0, int(p.h * R), 3):
                    p.px(0, k, (0, 0, 0, 0))
    return c


def headband(fig, color, tails=True):
    b = fig.head.cube((-4, 30, -4), (8, 1, 8), inflate=0.5)
    dress_cube(b, color, fig.n + 110, folds=False)
    hollow(b)
    if tails:
        for x, rz in ((-1.5, 10), (0.5, -10)):
            t = fig.head.cube((x, 25, 4.4), (1, 5, 1), rotation=(-20, 0, rz), pivot=(x + 0.5, 30, 4.5))
            dress_cube(t, color, fig.n + 111)
    return b


def crown(fig, color, points=5, gem=None, bone=False):
    c = fig.head.cube((-4, 31, -4), (8, 2, 8), inflate=0.5)
    if bone:
        coat(c, color, noise=6)
    else:
        armour_cube(c, color, fig.n)
    hollow(c)
    for i in range(points):
        x = -3.5 + i * (7 / max(1, points - 1))
        sp = fig.head.cube((x - 0.5, 33, -4.6), (1, 2 if i % 2 == 0 else 1, 1))
        (coat(sp, color, noise=4) if bone else armour_cube(sp, color, fig.n + i))
    if gem:
        g = fig.head.cube((-0.5, 31.5, -4.75), (1, 1, 1))
        coat(g, gem, noise=0)
    return c


# ------------------------------------------------------------------------------------------ arms and gear
def blade_cube(cube, steel=SILVER, edge=SILVER_L, glow=None):
    for i, f in enumerate(cube.faces):
        with paint(f) as p:
            p.vgrad(shade(steel, 1.15), shade(steel, 0.85))
            if f in sides(cube):
                p.rect(0, 0, p.w, 0.3, edge)
                p.rect(0, p.h / 2 - 0.15, p.w, p.h / 2 + 0.15, shade(steel, 0.75))  # the fuller
            if glow:
                p.rect(0, p.h / 2 - 0.15, p.w, p.h / 2 + 0.15, glow)
            p.noise(3, i)
    return cube


def grip_cube(cube, color=LEATHER_D, wrap=LEATHER_L):
    for f in cube.faces:
        with paint(f) as p:
            p.fill(color)
            for k in range(0, p.img.width + p.img.height, 3):
                p.line([(k / R, 0), (k / R - p.h, p.h)], wrap)
    return cube


def sword(fig, bone=None, length=14, steel=SILVER, guard=GOLD, glow=None, x=None, wide=1):
    bone = bone or fig.weapon
    x = fig.hx - 0.5 if x is None else x
    grip_cube(bone.cube((x, 12.5, -6), (1, 1, 4)))
    pom = bone.cube((x - 0.25, 12.25, -2.6), (1, 1, 1), inflate=0.25)
    armour_cube(pom, guard, fig.n)
    g = bone.cube((x - 2, 11.75, -7), (5, 2, 1))
    armour_cube(g, guard, fig.n + 1)
    blade_cube(bone.cube((x - (wide - 1) / 2, 12, -7 - length), (wide, 2, length)), steel, glow=glow)
    tip = bone.cube((x - (wide - 1) / 2, 12.5, -8 - length), (wide, 1, 1))
    blade_cube(tip, steel)


def katana(fig, length=15):
    x = fig.hx - 0.5
    grip = fig.weapon.cube((x, 12.5, -7), (1, 1, 5))
    grip_cube(grip, "#1a1418", "#c9302c")
    tsuba = fig.weapon.cube((x - 1, 11.5, -8), (3, 3, 1))
    armour_cube(tsuba, GOLD_D, fig.n)
    blade = fig.weapon.cube((x, 12.25, -8 - length), (1, 1, length), rotation=(-4, 0, 0), pivot=(x + 0.5, 12.5, -8))
    blade_cube(blade, "#dfe5ec", "#ffffff")


def staff(fig, head="orb", shaft=WOOD, orb="#c05bff", trim=GOLD, height=31, bone=None, x=None):
    bone = bone or fig.weapon
    x = fig.hx - 0.5 if x is None else x
    s = bone.cube((x, 0, -3.5), (1, height, 1))
    for i, f in enumerate(s.faces):
        with paint(f) as p:
            p.vgrad(shade(shaft, 1.15), shade(shaft, 0.8)).noise(5, fig.n + i)
            for y in range(3, height, 7):
                p.rect(0, height - y - 0.5, p.w, height - y, trim)
    top = height
    if head == "orb":
        for dx, dz in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            armour_cube(bone.cube((x + dx, top, -3.5 + dz), (1, 2, 1)), trim, fig.n)
        o = bone.cube((x - 0.5, top + 0.75, -4), (2, 2, 2))
        for f in o.faces:
            with paint(f) as p:
                p.fill(orb).ellipse(0.25, 0.25, 1.75, 1.75, mix(orb, "#ffffff", 0.35)).rect(0.4, 0.4, 0.8, 0.8, "#ffffff")
    elif head == "crystal":
        c = bone.cube((x - 0.5, top, -4), (2, 4, 2), rotation=(0, 45, 0), pivot=(x + 0.5, top, -3))
        for f in c.faces:
            with paint(f) as p:
                p.vgrad(mix(orb, "#ffffff", 0.5), shade(orb, 0.7)).line([(0.5, 0), (0.5, 4)], "#ffffff")
    elif head == "holy":  # a ring of gold with a sunburst
        for dy, dz, w, h in ((0, -5.5, 5, 1), (4, -5.5, 5, 1), (1, -5.5, 1, 3), (1, -1.5, 1, 3)):
            armour_cube(bone.cube((x, top + dy, dz), (1, h, w)), trim, fig.n)
        o = bone.cube((x - 0.25, top + 1.25, -4), (1, 2, 2), inflate=0.25)
        coat(o, orb, noise=0)
    elif head == "skull":
        sk = bone.cube((x - 1, top, -4.5), (3, 3, 3))
        coat(sk, BONE, noise=5)
        with paint(sk.front) as p:
            p.rect(0.25, 1, 1.25, 1.75, "#1a1020").rect(1.75, 1, 2.75, 1.75, "#1a1020")
            p.rect(0.5, 1.25, 0.9, 1.6, orb).rect(2.0, 1.25, 2.4, 1.6, orb)
            p.rect(1.25, 2.25, 1.75, 3, "#3a2f2a")
        for k, dx in enumerate((-1.5, 2.5)):
            h = bone.cube((x + dx - 0.5, top + 1, -3.5), (1, 3, 1), rotation=(0, 0, 25 if k == 0 else -25), pivot=(x + dx, top + 1, -3))
            coat(h, BONE_D, noise=4)
    elif head == "bone":
        for i, dz in enumerate((-4.5, -2.5)):
            b = bone.cube((x, top - i, dz), (1, 4 + i, 1), rotation=(-20 + i * 40, 0, 0), pivot=(x + 0.5, top, -3))
            coat(b, BONE, noise=5)
        o = bone.cube((x - 0.25, top + 1, -4), (1, 1, 1), inflate=0.35)
        coat(o, orb, noise=0)
    elif head == "crook":
        for dy, dz, h, w in ((0, -3.5, 3, 1), (2, -5.5, 1, 2), (0, -6.5, 2, 1)):
            b = bone.cube((x, top + dy, dz), (1, h, w))
            coat(b, shaft, noise=4)
        armour_cube(bone.cube((x - 0.25, top - 1, -3.75), (1, 1, 1), inflate=0.3), trim, fig.n)
    elif head == "lantern":
        armour_cube(bone.cube((x, top, -5.5), (1, 1, 3)), trim, fig.n)
        lamp = bone.cube((x - 0.5, top - 3, -6), (2, 3, 2))
        for f in lamp.faces:
            with paint(f) as p:
                p.fill(orb).rect(0, 0, p.w, 0.4, trim).rect(0, p.h - 0.4, p.w, p.h, trim).rect(0.75, 0.6, 1.25, 2.4, "#ffffff")


def scythe(fig, blade=SILVER, shaft="#2a2230", trim="#8a2be2"):
    staff(fig, head="none", shaft=shaft, trim=trim, height=32)
    x = fig.hx - 0.5
    for i, (dy, dz, ln) in enumerate(((31, -9.5, 6), (30, -12.5, 3), (29, -14.0, 2))):
        b = fig.weapon.cube((x, dy, dz), (1, 1 if i else 2, ln))
        blade_cube(b, blade)
    armour_cube(fig.weapon.cube((x - 0.25, 30.5, -4), (1, 2, 1), inflate=0.25), trim, fig.n)


def spear(fig, tip=SILVER, shaft=WOOD, trim=GOLD, banner=None):
    staff(fig, head="none", shaft=shaft, trim=trim, height=30)
    x = fig.hx - 0.5
    blade_cube(fig.weapon.cube((x, 30, -4), (1, 5, 2)), tip)
    blade_cube(fig.weapon.cube((x, 35, -3.5), (1, 1, 1)), tip)
    armour_cube(fig.weapon.cube((x - 0.25, 29, -3.75), (1, 1, 1), inflate=0.3), trim, fig.n)
    if banner:
        flag = fig.weapon.cube((x, 24, -2.5), (1, 5, 4))
        dress_cube(flag, banner, fig.n)


def axe(fig, steel=SILVER, shaft=WOOD, double=False):
    x = fig.hx - 0.5
    h = fig.weapon.cube((x, 12.5, -16), (1, 1, 13))
    coat(h, shaft, noise=4)
    head = fig.weapon.cube((x, 10.5, -16), (1, 5, 3))
    blade_cube(head, steel)
    if double:
        blade_cube(fig.weapon.cube((x, 13.5, -16), (1, 4, 3)), steel)


def mace(fig, steel=SILVER, shaft=WOOD, trim=GOLD):
    x = fig.hx - 0.5
    grip_cube(fig.weapon.cube((x, 12.5, -12), (1, 1, 9)))
    head = fig.weapon.cube((x - 1, 11.5, -15), (3, 3, 3))
    armour_cube(head, steel, fig.n, rivets=True, trim=trim)
    for dx, dy in ((-1.75, 0), (1.75, 0), (0, 1.75), (0, -1.75)):
        armour_cube(fig.weapon.cube((x + dx, 12.5 + dy, -14), (1, 1, 1)), shade(steel, 1.1), fig.n)


def dagger(fig, bone, x, steel=SILVER, grip="#2a2230", length=6, reverse=False):
    grip_cube(bone.cube((x, 12.5, -5), (1, 1, 3)), grip)
    armour_cube(bone.cube((x - 1, 12, -6), (3, 2, 1)), shade(steel, 0.6), fig.n)
    blade_cube(bone.cube((x, 12, -6 - length), (1, 2, length)), steel)


def curved_blade(fig, bone, x, steel=SILVER, length=9, trim=GOLD):
    grip_cube(bone.cube((x, 12.5, -5), (1, 1, 3)), "#5a1a1a")
    armour_cube(bone.cube((x - 1, 12, -6), (3, 2, 1)), trim, fig.n)
    blade_cube(bone.cube((x, 12, -6 - length), (1, 2, length), rotation=(10, 0, 0), pivot=(x + 0.5, 13, -6)), steel)


def bow(fig, wood="#6b4423", trim=GOLD, string="#f4f1ea", elven=False):
    x = fig.hx - 0.5
    grip_cube(fig.weapon.cube((x, 10, -4.5), (1, 6, 1)), LEATHER_D)
    for y0, rx in ((4, 18), (16, -18)):
        limb = fig.weapon.cube((x, y0, -4.5), (1, 7, 1), rotation=(rx, 0, 0), pivot=(x + 0.5, 13, -4))
        for f in limb.faces:
            with paint(f) as p:
                p.vgrad(shade(wood, 1.2), shade(wood, 0.8))
                if elven:
                    p.line([(0.5, 0), (0.5, 7)], trim)
    for y0 in (2, 23):
        armour_cube(fig.weapon.cube((x, y0, -3), (1, 1, 1)), trim, fig.n)
    s = fig.weapon.cube((x, 3, -2.0), (1, 20, 1), inflate=-0.42)
    coat(s, string, noise=0, bevel=False)


def shield(fig, kind="kite", face="#2f4f8f", rim=GOLD, emblem=None):
    x = fig.ox - 0.5
    if kind == "round":
        s = fig.offhand.cube((x + 0.75, 7, -6), (1, 10, 10))
        for i, f in enumerate(s.faces):
            with paint(f) as p:
                p.fill(face).noise(5, i)
                if f in (s.right, s.left):
                    p.clear()
                    p.ellipse(0, 0, 10, 10, rim)
                    p.ellipse(0.6, 0.6, 9.4, 9.4, face)
                    for k in range(0, 10, 2):
                        p.line([(k + 0.5, 1), (k + 0.5, 9)], shade(face, 0.85))
                    p.ellipse(3.75, 3.75, 6.25, 6.25, rim).ellipse(4.3, 4.3, 5.7, 5.7, shade(rim, 1.2))
                    if emblem:
                        emblem(p)
        return s
    w, h = (8, 12) if kind == "tower" else (7, 10)
    s = fig.offhand.cube((x + 0.75, 6, -2 - w + 2.5), (1, h, w))
    for i, f in enumerate(s.faces):
        with paint(f) as p:
            p.vgrad(shade(face, 1.15), shade(face, 0.8)).noise(4, i)
            if f in (s.right, s.left):
                p.rect(0, 0, p.w, 0.5, rim).rect(0, 0, 0.5, p.h, rim).rect(p.w - 0.5, 0, p.w, p.h, rim)
                if kind == "kite":
                    p.poly([(0, p.h - 3), (p.w / 2, p.h), (p.w, p.h - 3), (p.w, p.h), (0, p.h)], (0, 0, 0, 0))
                    p.line([(0.25, p.h - 3), (p.w / 2, p.h - 0.4), (p.w - 0.25, p.h - 3)], rim, 2)
                else:
                    p.rect(0, p.h - 0.5, p.w, p.h, rim)
                if emblem:
                    emblem(p)
                else:
                    p.rect(p.w / 2 - 0.4, 1.5, p.w / 2 + 0.4, p.h - 3.5, rim).rect(1.5, 3.5, p.w - 1.5, 4.3, rim)
            p.bevel()
    return s


def book(fig, cover="#5a2a1a", trim=GOLD, at=None):
    x, y, z = at or (2.5, 9.5, -3)
    b = fig.body.cube((x, y, z), (3, 4, 2))
    leather_cube(b, cover, fig.n)
    with paint(b.front) as p:
        p.rect(0, 0, p.w, 0.35, trim).rect(0, p.h - 0.35, p.w, p.h, trim).ellipse(1, 1.25, 2, 2.5, trim)
    with paint(b.right) as p:
        p.fill("#efe6cc")
        for k in range(1, 8):
            p.line([(0, k * 0.5), (p.w, k * 0.5)], "#cfc4a6")
    return b


def quiver(fig, color=LEATHER, fletch=("#e9e6dc", "#c9302c", "#e9e6dc")):
    q = fig.body.cube((-3, 13, 2.5), (3, 10, 3), rotation=(0, 0, -20), pivot=(-1.5, 18, 3))
    leather_cube(q, color, fig.n)
    band(q, 1, 1.75, shade(color, 0.7), GOLD)
    for i, x in enumerate((-3, -2, -1)):
        f = fig.body.cube((x - 1.5, 23, 3), (1, 3, 1), rotation=(0, 0, -20), pivot=(-1.5, 18, 3))
        coat(f, fletch[i % len(fletch)], noise=3)
    strap = fig.body.cube((-4, 14, -2.6), (8, 1, 1), rotation=(0, 0, 35), pivot=(0, 18, -2))
    leather_cube(strap, LEATHER_D, fig.n, stitch=False)


def lute(fig, wood="#8a5a2a", on_back=False, glow=None):
    if on_back:
        bone, x, z, rot = fig.body, -2, 2.4, (0, 0, 30)
        body = bone.cube((x - 1.5, 13, z), (4, 5, 2), rotation=rot, pivot=(0, 18, 3))
        neck = bone.cube((x, 18, z + 0.5), (1, 8, 1), rotation=rot, pivot=(0, 18, 3))
    else:
        x = fig.hx - 0.5
        body = fig.weapon.cube((x - 1.5, 9, -8), (4, 5, 4))
        neck = fig.weapon.cube((x, 12, -16), (1, 1, 8))
        pegs = fig.weapon.cube((x - 0.5, 11.5, -17.5), (2, 2, 2))
        coat(pegs, WOOD_D, noise=3)
    for f in body.faces:
        with paint(f) as p:
            p.vgrad(shade(wood, 1.2), shade(wood, 0.85)).noise(4, fig.n)
            p.ellipse(p.w / 2 - 0.6, p.h / 2 - 0.6, p.w / 2 + 0.6, p.h / 2 + 0.6, "#2a1a10")
    coat(neck, WOOD_D, noise=3)
    if glow:
        coat(fig.weapon.cube((fig.hx - 1, 13.5, -6.5), (2, 1, 1)), glow, noise=0)


def wraps(fig, color="#e9e3cf"):
    """Cloth wrapped round hands and forearms, for those who fight with their fists."""
    for i, (bone, _, x, _) in enumerate(fig.arms):
        w = bone.cube((x, 12, -2), (fig.aw, 4, 4), inflate=0.2)
        for f in w.faces:
            with paint(f) as p:
                p.fill(color).noise(5, fig.n + i)
                for k in range(0, 16, 3):
                    p.line([(0, k * 0.25), (p.w, k * 0.25 + 0.6)], shade(color, 0.78))
        knuckle = bone.cube((x, 12, -2.6), (fig.aw, 2, 1))
        armour_cube(knuckle, SILVER, fig.n)


def beads(fig, color="#7a3020", bead=GOLD):
    b = fig.body.cube((-3, 17, -2.55), (6, 6, 1))
    with paint(b.front) as p:
        p.clear()
        for k in range(12):
            t = k / 11
            xx = 0.4 + 5.2 * t
            yy = 0.4 + 4.8 * (1 - (2 * t - 1) ** 2)
            p.ellipse(xx - 0.35, yy - 0.35, xx + 0.35, yy + 0.35, color if k % 3 else bead)
    for f in (b.right, b.left, b.top, b.bottom, b.back):
        with paint(f) as p:
            p.clear()


def emblem_cross(color):
    def draw(p):
        cx, cy = p.w / 2, p.h * 0.4
        p.rect(cx - 0.4, cy - 2, cx + 0.4, cy + 2.5, color).rect(cx - 1.5, cy - 0.9, cx + 1.5, cy - 0.1, color)
    return draw


def emblem_sun(color):
    def draw(p):
        cx, cy = p.w / 2, p.h * 0.38
        for k in range(8):
            import math
            a = k * math.pi / 4
            p.line([(cx, cy), (cx + math.cos(a) * 1.6, cy + math.sin(a) * 1.6)], color)
        p.ellipse(cx - 0.8, cy - 0.8, cx + 0.8, cy + 0.8, color)
    return draw


def emblem_skull(color):
    def draw(p):
        cx, cy = p.w / 2, p.h * 0.35
        p.ellipse(cx - 1.2, cy - 1.2, cx + 1.2, cy + 1.0, color)
        p.rect(cx - 0.7, cy + 0.6, cx + 0.7, cy + 1.6, color)
        p.rect(cx - 0.8, cy - 0.4, cx - 0.2, cy + 0.2, "#100c14").rect(cx + 0.2, cy - 0.4, cx + 0.8, cy + 0.2, "#100c14")
    return draw


def emblem_note(color):
    def draw(p):
        cx, cy = p.w / 2, p.h * 0.4
        p.ellipse(cx - 1, cy + 0.6, cx, cy + 1.5, color).rect(cx - 0.25, cy - 1.5, cx, cy + 1.1, color)
        p.line([(cx - 0.1, cy - 1.5), (cx + 1, cy - 0.8)], color, 2)
    return draw


# ------------------------------------------------------------------------------------------ the vocations
def breastplate(fig, metal, trim=GOLD, seed=0, low=13):
    plate = fig.body.cube((-4, low, -2), (8, 24 - low, 4), inflate=0.42)
    armour_cube(plate, metal, fig.n + seed, trim=None)
    with paint(plate.front) as p:
        p.line([(4, 0), (4, p.h - 2)], shade(metal, 1.3)).line([(4.25, 0), (4.25, p.h - 2)], shade(metal, 0.75))
        for y in (p.h - 3.5, p.h - 2.25, p.h - 1):
            p.line([(0.5, y), (7.5, y)], shade(metal, 0.7))
        p.rect(0, 0, 8, 0.5, trim).rect(0, 0, 0.5, p.h, shade(trim, 0.9)).rect(7.5, 0, 8, p.h, shade(trim, 0.9))
        p.rect(2.5, 0, 5.5, 0.9, shade(metal, 0.6))  # the gorget's opening
    hollow(plate)
    fig.chest = (metal, "metal", 0.5, None)
    return plate


def faulds(fig, metal, trim=GOLD, length=4):
    f = fig.body.cube((-4, 12 - length, -2), (8, length, 4), inflate=0.55)
    armour_cube(f, metal, fig.n + 3)
    for face in sides(f):
        with paint(face) as p:
            for y in range(1, length):
                p.line([(0, y), (p.w, y)], shade(metal, 0.65))
            p.rect(0, p.h - 0.4, p.w, p.h, trim)
            for x in range(1, int(p.w), 2):
                p.line([(x, 0), (x, p.h)], shade(metal, 0.8))
    hollow(f)
    return f


def vest(fig, color, low=14, open_front=False, seed=0):
    v = fig.body.cube((-4, low, -2), (8, 24 - low, 4), inflate=0.32)
    leather_cube(v, color, fig.n + seed)
    with paint(v.front) as p:
        if open_front:
            p.clear(3.25, 0, 4.75, p.h)
        else:
            for y in range(1, int(p.h), 2):
                p.rect(3.75, y, 4.25, y + 0.5, GOLD_D)
    hollow(v)
    if low <= 18 and not open_front:
        fig.chest = (color, "leather", 0.4, None)
    return v


def fighter(fig, L):
    cut, metal, cloth, trim = L["cut"], L.get("metal", SILVER), L["main"], L.get("trim", GOLD)
    if cut == "knight":
        clothe(fig, cloth, shade(cloth, 0.6), trim=trim, neckline="high")
        breastplate(fig, metal, trim)
        faulds(fig, metal, trim)
        pauldrons(fig, metal, trim, size=4)
        cuffs(fig, metal, 4, metal=True, trim=trim)
        boots(fig, metal, 6, metal=True)
        belt(fig, LEATHER_D, trim, pouch=False)
        tabard(fig, cloth, trim, emblem_cross(trim), length=14)
        cape(fig, cloth, 18, trim, lining=shade(cloth, 0.5), emblem=emblem_cross(trim))
        hair_style(fig)
        helm(fig, metal, trim, plume=L.get("plume", "#c9302c"))
        sword(fig, steel=SILVER, guard=trim)
        shield(fig, "kite", cloth, trim, emblem_cross(trim))
    elif cut == "swordsman":
        clothe(fig, cloth, "#2a2420", sleeves=cloth, trim=trim, neckline="v")
        chain = fig.body.cube((-4, 12, -2), (8, 12, 4), inflate=0.2)
        for f in chain.faces:
            with paint(f) as p:
                p.fill("#8a8f99")
                for y in range(0, p.img.height, 2):
                    for x in range(y % 4 // 2, p.img.width, 2):
                        p.px(x, y, "#b9bec8")
        with paint(chain.front) as p:
            p.clear(0, 0, 8, 12)
        hollow(chain)
        vest(fig, cloth, 12, open_front=True)
        skirt(fig, cloth, 6, trim, flare=0.5, slit=True)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, LEATHER, 3)
        boots(fig, LEATHER_D, 5, cuff=shade(LEATHER, 1.1))
        pauldrons(fig, metal, trim, size=3, seed=1)
        hair_style(fig)
        sword(fig, length=18, wide=2, steel=SILVER, guard=trim)
    elif cut == "valkyrie":
        clothe(fig, cloth, shade(cloth, 0.7), trim=trim, neckline="high")
        breastplate(fig, metal, trim, low=14)
        skirt(fig, cloth, 5, trim, flare=0.55)
        pauldrons(fig, metal, trim, size=3)
        cuffs(fig, metal, 4, metal=True, trim=trim)
        boots(fig, metal, 6, metal=True)
        belt(fig, LEATHER_D, trim, pouch=False)
        cape(fig, "#f4f1ea", 17, trim, lining=cloth)
        hair_style(fig)
        helm(fig, metal, trim, wings="#f4f1ea", open_face=True)
        spear(fig, trim=trim)
        shield(fig, "round", cloth, trim)
    else:  # shieldmaiden
        clothe(fig, cloth, shade(LEATHER, 0.9), trim=trim, neckline="round")
        vest(fig, LEATHER, 13)
        skirt(fig, shade(cloth, 0.8), 4, trim, flare=0.45)
        collar(fig, "#a8946a", fur=True)
        cuffs(fig, LEATHER_D, 4)
        boots(fig, LEATHER_D, 5, cuff="#b7a37a")
        belt(fig, LEATHER_D, trim)
        cape(fig, shade(cloth, 0.7), 13, ragged=True)
        hair_style(fig)
        axe(fig)
        shield(fig, "round", L.get("shield", "#7a2a22"), metal)


def archer(fig, L):
    cut, cloth, second, trim = L["cut"], L["main"], L.get("second", LEATHER), L.get("trim", GOLD)
    if cut == "ranger":
        clothe(fig, cloth, "#4a3a2a", trim=None, neckline="v")
        vest(fig, second, 14)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, LEATHER, 4)
        boots(fig, LEATHER_D, 6, cuff=LEATHER)
        cape(fig, shade(cloth, 0.8), 16, ragged=True)
        hair_style(fig)
        hood(fig, shade(cloth, 0.8))
        quiver(fig)
        bow(fig)
    elif cut == "hunter":
        clothe(fig, second, "#3a2a1e", neckline="round")
        vest(fig, shade(second, 0.8), 13, open_front=True)
        collar(fig, "#8a7558", fur=True, height=2)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, LEATHER_D, 4)
        boots(fig, LEATHER_D, 6, cuff="#8a7558")
        cape(fig, "#6a5a44", 12, ragged=True)
        hair_style(fig)
        quiver(fig)
        bow(fig, wood="#4e321c")
    elif cut == "huntress":
        clothe(fig, cloth, "#3a3022", trim=trim, neckline="v")
        vest(fig, second, 15)
        skirt(fig, shade(cloth, 0.85), 4, trim, flare=0.45)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, LEATHER, 4)
        boots(fig, LEATHER_D, 7, cuff=LEATHER)
        hair_style(fig)
        quiver(fig)
        bow(fig)
    else:  # windrunner
        clothe(fig, cloth, shade(cloth, 0.75), trim=trim, neckline="v")
        skirt(fig, shade(cloth, 0.9), 5, trim, flare=0.5, slit=True)
        belt(fig, "#e9e6dc", trim, pouch=False)
        cuffs(fig, "#e9e6dc", 4, trim=trim)
        boots(fig, "#d9d4c4", 7, cuff=trim)
        cape(fig, second, 17, trim, lining=cloth)
        elf_ears(fig)
        hair_style(fig)
        circlet(fig, trim, gem=L.get("gem", "#59d0ff"))
        quiver(fig, "#e9e6dc", ("#59d0ff", "#f4f1ea", "#59d0ff"))
        bow(fig, wood="#e9e6dc", trim=trim, elven=True)


def mage(fig, L):
    cut, cloth, second, trim, orb = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", GOLD), L.get("orb", "#c05bff")
    stars = lambda p: [p.px(int(x * R), int(y * R), mix(trim, "#ffffff", 0.4)) for x, y in ((1.2, 1.5), (5.5, 2.2), (3.1, 3.8), (6.6, 4.9), (2.2, 5.8))]
    if cut == "sorcerer":
        clothe(fig, cloth, shade(cloth, 0.6), trim=trim, neckline="high")
        skirt(fig, cloth, 6, trim, flare=0.65)
        robe_legs(fig, cloth, trim)
        sleeves(fig, second, 6, trim, flare=0.55)
        tabard(fig, shade(cloth, 0.6), trim, emblem_sun(orb), length=20)
        belt(fig, LEATHER_D, trim, pouch=False)
        hair_style(fig)
        hood(fig, shade(cloth, 0.7), open_rows=(1.25, 8), peak=False)
        circlet(fig, trim, gem=orb, y=29.0)
        staff(fig, "crystal", orb=orb, trim=trim)
        book(fig)
    elif cut == "wizard":
        clothe(fig, cloth, shade(cloth, 0.6), trim=trim, neckline="v")
        skirt(fig, cloth, 6, trim, flare=0.65, pattern=stars)
        robe_legs(fig, cloth, trim)
        sleeves(fig, cloth, 6, trim, flare=0.6)
        belt(fig, LEATHER_D, trim, sash=second)
        hair_style(fig)
        long_beard = fig.head.cube((-2.5, 17, -4.4), (5, 7, 1))
        hl, h, hd, _ = hair_colors(fig.look["hair"])
        for f in long_beard.faces:
            with paint(f) as p:
                p.vgrad(hl, hd).strands(h, fig.n, 0.7)
                for x in range(p.img.width):
                    for k in range((x * 3) % 5):
                        p.px(x, p.img.height - 1 - k, (0, 0, 0, 0))
        wizard_hat(fig, cloth, trim)
        staff(fig, "orb", orb=orb, trim=trim)
    elif cut == "witch":
        clothe(fig, cloth, "#1a1420", sleeves=cloth, trim=trim, neckline="v")
        corset = fig.body.cube((-4, 12, -2), (8, 5, 4), inflate=0.3)
        leather_cube(corset, second, fig.n)
        with paint(corset.front) as p:
            for y in range(1, 5):
                p.line([(3.25, y - 0.5), (4.75, y)], trim).line([(4.75, y - 0.5), (3.25, y)], trim)
        hollow(corset)
        skirt(fig, cloth, 7, trim, flare=0.7)
        robe_legs(fig, cloth, trim, length=6)
        sleeves(fig, cloth, 5, trim, flare=0.6)
        boots(fig, "#1a1420", 3)
        hair_style(fig)
        wizard_hat(fig, shade(cloth, 0.8), trim, wide=7, seed=2)
        staff(fig, "orb", shaft="#2a1f2a", orb=orb, trim=trim)
    else:  # enchantress
        clothe(fig, cloth, shade(cloth, 0.7), trim=trim, neckline="v")
        skirt(fig, cloth, 7, trim, flare=0.65)
        robe_legs(fig, cloth, trim)
        sleeves(fig, second, 5, trim, flare=0.6)
        belt(fig, trim, GOLD_L, pouch=False, sash=trim)
        cape(fig, second, 18, trim, lining=cloth)
        elf_ears(fig)
        hair_style(fig)
        circlet(fig, trim, gem=orb)
        staff(fig, "crystal", shaft="#e9e6dc", orb=orb, trim=trim)


def healer(fig, L):
    cut, cloth, second, trim, orb = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", GOLD), L.get("orb", "#f6d968")
    if cut == "priest":
        clothe(fig, cloth, shade(cloth, 0.8), trim=trim, neckline="high")
        skirt(fig, cloth, 6, trim, flare=0.65)
        robe_legs(fig, cloth, trim)
        sleeves(fig, cloth, 6, trim, flare=0.55)
        tabard(fig, second, trim, emblem_sun(trim), length=20)
        hair_style(fig)
        mitre = fig.head.cube((-3, 32, -3), (6, 5, 6))
        dress_cube(mitre, cloth, fig.n, folds=False)
        with paint(mitre.front) as p:
            p.rect(2.5, 0, 3.5, 5, trim).rect(1, 2, 5, 2.75, trim)
        staff(fig, "holy", orb=orb, trim=trim, shaft="#f4f1ea")
    elif cut == "acolyte":
        clothe(fig, cloth, shade(cloth, 0.8), trim=trim, neckline="round")
        skirt(fig, cloth, 5, trim, flare=0.6)
        robe_legs(fig, cloth, trim, length=6)
        sleeves(fig, cloth, 4, trim)
        belt(fig, "#c9b98a", trim, pouch=False)
        hair_style(fig)
        staff(fig, "crook", shaft=WOOD, trim=trim)
        book(fig, "#f4f1ea", trim)
    elif cut == "priestess":
        clothe(fig, cloth, shade(cloth, 0.85), trim=trim, neckline="v")
        skirt(fig, cloth, 7, trim, flare=0.65)
        robe_legs(fig, cloth, trim)
        sleeves(fig, second, 5, trim, flare=0.6)
        tabard(fig, second, trim, emblem_sun(trim), length=18)
        hair_style(fig)
        veil(fig, "#fbfaf6", band=trim, length=12)
        staff(fig, "holy", orb=orb, trim=trim, shaft="#f4f1ea")
    else:  # battle sister
        clothe(fig, cloth, "#1a1820", trim=trim, neckline="high")
        breastplate(fig, SILVER, trim, low=15)
        skirt(fig, cloth, 6, trim, flare=0.6)
        tabard(fig, "#f4f1ea", trim, emblem_cross("#b3141c"), length=16)
        pauldrons(fig, SILVER, trim, size=3)
        cuffs(fig, SILVER, 3, metal=True)
        boots(fig, SILVER, 5, metal=True)
        hair_style(fig)
        veil(fig, cloth, band="#f4f1ea", length=11)
        mace(fig, trim=trim)
        book(fig, "#5a1a1a", trim, at=(-5.5, 9.5, -2.5))


def rogue(fig, L):
    cut, cloth, second, trim = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", SILVER_D)
    if cut == "assassin":
        clothe(fig, cloth, shade(cloth, 0.85), trim=None, neckline="high")
        vest(fig, second, 13)
        for rz in (35, -35):
            strap = fig.body.cube((-4.5, 17.5, -2.6), (9, 1, 1), rotation=(0, 0, rz), pivot=(0, 18, -2))
            leather_cube(strap, LEATHER_D, fig.n, stitch=False)
        belt(fig, LEATHER_D, SILVER)
        for x in (-3, -1, 1):
            blade_cube(fig.body.cube((x, 11, -2.9), (1, 3, 1)))
        cuffs(fig, second, 4)
        boots(fig, shade(cloth, 0.8), 6)
        cape(fig, shade(cloth, 0.9), 11, ragged=True)
        hair_style(fig)
        hood(fig, shade(cloth, 0.95), open_rows=(2, 8))
        mask(fig, shade(cloth, 0.8))
        dagger(fig, fig.weapon, fig.hx - 0.5)
        dagger(fig, fig.offhand, fig.ox - 0.5)
    elif cut == "thief":
        clothe(fig, cloth, "#3a3228", trim=None, neckline="v")
        vest(fig, LEATHER, 13, open_front=True)
        belt(fig, LEATHER_D, GOLD_D)
        for x in (-3.5, 2.0):
            pc = fig.body.cube((x, 10.5, -2.8), (2, 2, 1))
            leather_cube(pc, LEATHER_L, fig.n)
        cuffs(fig, LEATHER_D, 3)
        boots(fig, LEATHER_D, 5, cuff=LEATHER)
        cape(fig, second, 10, ragged=True)
        hair_style(fig)
        headband(fig, L.get("band", "#a8322e"))
        dagger(fig, fig.weapon, fig.hx - 0.5, length=7)
    elif cut == "shadow_dancer":
        clothe(fig, cloth, shade(cloth, 0.8), trim=trim, neckline="v")
        vest(fig, second, 15)
        belt(fig, LEATHER_D, trim, sash=L.get("sash", "#8a2be2"))
        cuffs(fig, second, 4, trim=trim)
        boots(fig, shade(second, 0.8), 7)
        hair_style(fig)
        mask(fig, shade(cloth, 0.7))
        curved_blade(fig, fig.weapon, fig.hx - 0.5, length=7, trim=trim)
        curved_blade(fig, fig.offhand, fig.ox - 0.5, length=7, trim=trim)
    else:  # nightblade
        clothe(fig, cloth, shade(cloth, 0.85), trim=trim, neckline="high")
        vest(fig, second, 13)
        skirt(fig, shade(cloth, 0.9), 4, trim, flare=0.45, slit=True)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, SILVER_D, 4, metal=True)
        boots(fig, shade(cloth, 0.7), 6)
        scarf = fig.body.cube((-4.5, 22, -2.5), (9, 2, 5), inflate=0.15)
        dress_cube(scarf, L.get("scarf", "#a8322e"), fig.n)
        hollow(scarf)
        tail = fig.cape.cube((-3, 15, 2.6), (2, 8, 1), rotation=(10, 0, 6), pivot=(-2, 23, 2.6))
        dress_cube(tail, L.get("scarf", "#a8322e"), fig.n)
        hair_style(fig)
        katana(fig)


def bard(fig, L):
    cut, cloth, second, trim, glow = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", GOLD), L.get("orb", "#ffd45c")
    if cut == "minstrel":
        clothe(fig, cloth, second, sleeves=second, trim=trim, neckline="v")
        doublet = fig.body.cube((-4, 13, -2), (8, 11, 4), inflate=0.33)
        dress_cube(doublet, cloth, fig.n, folds=False)
        with paint(doublet.front) as p:
            p.rect(3.5, 0, 4.5, p.h, second)
            for y in (1.5, 4, 6.5, 9):
                p.ellipse(3.6, y, 4.4, y + 0.8, GOLD_L)
        hollow(doublet)
        for i, (bone, _, x, _) in enumerate(fig.arms):
            puff = bone.cube((x, 19, -2), (fig.aw, 4, 4), inflate=0.55)
            dress_cube(puff, cloth, fig.n + i)
            band(puff, 1.5, 2.5, second, trim)
            hollow(puff)
        belt(fig, LEATHER_D, trim)
        boots(fig, LEATHER_D, 5, cuff=trim)
        cape(fig, second, 11, trim)
        hair_style(fig)
        cap(fig, cloth, feather=L.get("feather", "#f4f1ea"))
        lute(fig, glow=glow)
    elif cut == "skald":
        clothe(fig, cloth, "#3a3228", neckline="round")
        vest(fig, LEATHER, 13)
        collar(fig, "#a8946a", fur=True)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, LEATHER_D, 4)
        boots(fig, LEATHER_D, 5, cuff="#a8946a")
        fur = fig.cape.cube((-5, 11, 1.8), (10, 13, 2))
        for i, f in enumerate(fur.faces):
            with paint(f) as p:
                p.fill("#8a7558").noise(16, fig.n + i).strands("#8a7558", fig.n + i, 0.6, 0.75, 1.2)
        hair_style(fig)
        helm(fig, SILVER_D, trim, visor=False, open_face=True, horns=BONE)
        axe(fig, double=True)
        lute(fig, on_back=True)
    elif cut == "songstress":
        clothe(fig, cloth, cloth, sleeves=second, trim=trim, neckline="v")
        skirt(fig, cloth, 7, trim, flare=0.7, pattern=lambda p: p.rect(0, p.h - 1.4, p.w, p.h - 1.1, second))
        robe_legs(fig, cloth, trim)
        sleeves(fig, second, 4, trim, flare=0.55)
        belt(fig, trim, GOLD_L, pouch=False, sash=second)
        hair_style(fig)
        crown(fig, GOLD, points=5, gem=L.get("gem", "#e0405a"))
        lute(fig, wood="#a86a32", glow=glow)
    else:  # blade dancer
        clothe(fig, cloth, second, sleeves=cloth, trim=trim, neckline="v")
        top = fig.body.cube((-4, 18, -2), (8, 6, 4), inflate=0.3)
        dress_cube(top, second, fig.n, folds=False)
        with paint(top.front) as p:
            for x in range(1, 8):
                p.ellipse(x - 0.3, 5.3, x + 0.3, 5.9, trim)
        hollow(top)
        fig.chest = (second, "cloth", 0.38, trim)
        belt(fig, trim, GOLD_L, pouch=False, sash=L.get("sash", "#e0b040"))
        for i, (bone, _, x, _) in enumerate(fig.legs):
            pant = bone.cube((x, 1, -2), (4, 10, 4), inflate=0.45)
            dress_cube(pant, shade(second, 1.1), fig.n + i)
            hollow(pant)
        boots(fig, trim, 1)
        hair_style(fig)
        headband(fig, trim, tails=False)
        veil_ = fig.head.cube((-4, 24, -4.5), (8, 3, 1))
        dress_cube(veil_, mix(second, "#ffffff", 0.4), fig.n, folds=False)
        with paint(veil_.front) as p:
            for x in range(1, 8, 2):
                p.ellipse(x - 0.25, 2.4, x + 0.25, 2.9, trim)
        curved_blade(fig, fig.weapon, fig.hx - 0.5, length=9, trim=trim)
        curved_blade(fig, fig.offhand, fig.ox - 0.5, length=9, trim=trim)


def monk(fig, L):
    cut, cloth, second, trim = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", GOLD)
    if cut == "martial":
        clothe(fig, cloth, cloth, trim=None, neckline="v")
        with paint(fig.torso.front) as p:
            p.line([(2.75, 0), (5.5, 6)], shade(cloth, 0.75))  # the gi's crossed lapels
        belt(fig, second, trim, pouch=False, sash=second)
        wraps(fig)
        boots(fig, "#3a2a1e", 1)
        hair_style(fig)
        headband(fig, L.get("band", "#c9302c"))
    elif cut == "ascetic":
        clothe(fig, cloth, cloth, trim=trim, neckline="v")
        sash = fig.body.cube((-4, 12, -2), (8, 12, 4), inflate=0.36)
        with paint(sash.front) as p:
            p.clear()
            p.poly([(0, 0), (1.75, 0), (8, 9.5), (8, 12), (6.25, 12), (0, 2.5)], second)
            p.line([(0, 0.5), (7.5, 11)], trim)
        for f in (sash.right, sash.left, sash.back, sash.top, sash.bottom):
            with paint(f) as p:
                p.clear()
        skirt(fig, cloth, 6, trim, flare=0.55)
        beads(fig)
        wraps(fig, "#d9cfb2")
        boots(fig, "#5a4030", 1)
        hair_style(fig)
        staff(fig, "none", shaft=WOOD, trim=trim, height=28)
    elif cut == "wind":
        clothe(fig, cloth, shade(cloth, 0.9), trim=trim, neckline="v")
        with paint(fig.torso.front) as p:
            p.line([(2.75, 0), (5.5, 6)], shade(cloth, 0.75))
        belt(fig, second, trim, pouch=False, sash=second)
        wraps(fig, "#f4f1ea")
        boots(fig, "#2a3a4a", 2)
        hair_style(fig)
        headband(fig, second)
    else:  # lotus fist
        clothe(fig, cloth, "#1a1418", trim=trim, neckline="high")
        with paint(fig.torso.front) as p:
            p.line([(4, 0.6), (6.5, 2.5)], trim)
            for y in (1.2, 2.2):
                p.ellipse(5.2, y, 5.8, y + 0.5, trim)
            p.poly([(3, 6), (5, 6), (4, 8)], second)
        skirt(fig, cloth, 7, trim, flare=0.4, slit=True)
        wraps(fig, trim)
        boots(fig, "#1a1418", 2)
        hair_style(fig)


def necromancer(fig, L):
    cut, cloth, second, trim, orb = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", "#8a2be2"), L.get("orb", "#7df0c8")
    if cut == "necromancer":
        clothe(fig, cloth, shade(cloth, 0.7), trim=trim, neckline="high")
        skirt(fig, cloth, 6, trim, flare=0.65)
        robe_legs(fig, cloth, trim)
        sleeves(fig, cloth, 6, trim, flare=0.6)
        tabard(fig, second, trim, emblem_skull(BONE), length=18)
        pauldrons(fig, BONE, None, size=3, spiked="bone")
        belt(fig, LEATHER_D, BONE, pouch=False)
        hair_style(fig)
        hood(fig, shade(cloth, 0.9), lining="#100c14", open_rows=(1.5, 8))
        staff(fig, "skull", shaft="#2a2230", orb=orb, trim=trim)
        book(fig, "#2a1030", BONE)
    elif cut == "bone_sage":
        clothe(fig, cloth, shade(cloth, 0.7), trim=trim, neckline="high")
        skirt(fig, cloth, 6, trim, flare=0.65)
        robe_legs(fig, cloth, trim)
        sleeves(fig, cloth, 6, trim, flare=0.6)
        beads(fig, BONE_D, BONE)
        cape(fig, shade(cloth, 0.7), 18, ragged=True)
        hair_style(fig)
        mask(fig, BONE, skull=True)
        crown(fig, BONE, points=5, bone=True)
        staff(fig, "bone", shaft=BONE_D, orb=orb, trim=BONE)
    elif cut == "death_witch":
        clothe(fig, cloth, "#120e16", sleeves=cloth, trim=trim, neckline="v")
        corset = fig.body.cube((-4, 12, -2), (8, 5, 4), inflate=0.3)
        leather_cube(corset, second, fig.n)
        hollow(corset)
        skirt(fig, cloth, 7, trim, flare=0.7)
        robe_legs(fig, cloth, trim, length=6)
        sleeves(fig, cloth, 5, trim, flare=0.65)
        hair_style(fig)
        wizard_hat(fig, shade(cloth, 0.7), trim, wide=7, seed=3)
        staff(fig, "skull", shaft="#2a2230", orb=orb, trim=trim)
    else:  # grave maiden
        clothe(fig, cloth, "#120e16", sleeves=cloth, trim=trim, neckline="v")
        skirt(fig, cloth, 7, trim, flare=0.7, pattern=lambda p: p.rect(0, p.h - 1.4, p.w, p.h - 1.0, second))
        robe_legs(fig, cloth, trim)
        sleeves(fig, cloth, 5, trim, flare=0.6)
        belt(fig, second, BONE, pouch=False, sash=second)
        hair_style(fig)
        veil(fig, cloth, band=second, length=12)
        scythe(fig, trim=second)


VOCATION_BUILDERS = [fighter, archer, mage, healer, rogue, bard, monk, necromancer]


# ------------------------------------------------------------------------------------------ the looks
# One entry per look, in the order of behavior_pack/scripts/classes.js (the look number is the variant).
LOOKS = [
    # the twelve looks of before v11, drawn anew
    dict(name="Knight", voc=0, sex="m", cut="knight", skin="#e0b48c", hair="#3a2a1f", style="short", eyes="#3a6ab0", main="#2f4f8f", plume="#c9302c"),
    dict(name="Swordsman", voc=0, sex="m", cut="swordsman", skin="#c99a78", hair="#a8402a", style="wild", eyes="#6a3a2a", main="#8f2a2a", scar=True),
    dict(name="Ranger", voc=1, sex="m", cut="ranger", skin="#e3b894", hair="#c9a53c", style="short", eyes="#4a8a3a", main="#3f6a45"),
    dict(name="Hunter", voc=1, sex="m", cut="hunter", skin="#8d5a3b", hair="#1f1a16", style="short", eyes="#3a2a1a", main="#6b4a36", second="#7a5a3a", beard=True),
    dict(name="Sorcerer", voc=2, sex="m", cut="sorcerer", skin="#f1dccb", hair="#5a3a66", style="short", eyes="#7a3ab0", main="#4a2a6a", second="#5a2a8a", orb="#c05bff"),
    dict(name="Wizard", voc=2, sex="m", cut="wizard", skin="#d6a57e", hair="#e9e6dc", style="long", eyes="#3a8ab0", main="#22335c", second="#6a4a8f", orb="#59d0ff", beard=True),
    dict(name="Priest", voc=3, sex="m", cut="priest", skin="#f6e2d4", hair="#ecca5c", style="short", eyes="#3a6ab0", main="#f4f1ea", second="#e0c06a", orb="#f6d968"),
    dict(name="Acolyte", voc=3, sex="m", cut="acolyte", skin="#6b4430", hair="#15131a", style="crop", eyes="#3a2a1a", main="#a8c8de", trim="#e0c06a"),
    dict(name="Assassin", voc=4, sex="m", cut="assassin", skin="#d9b08c", hair="#15131a", style="short", eyes="#8a1a2a", main="#22222a", second="#2a2a33"),
    dict(name="Thief", voc=4, sex="m", cut="thief", skin="#c99a78", hair="#6a4a2a", style="wild", eyes="#4a8a3a", main="#4f5a3a", second="#5a4a32", band="#a8322e"),
    dict(name="Minstrel", voc=5, sex="m", cut="minstrel", skin="#f1d6bf", hair="#b5482e", style="short", eyes="#3a8a6a", main="#a8322e", second="#e0b040", feather="#f4f1ea"),
    dict(name="Skald", voc=5, sex="m", cut="skald", skin="#e3bfa0", hair="#d9c9a0", style="braid", eyes="#3a6ab0", main="#3a5a7a", beard=True, trim="#c9b98a"),
    # v11: the women of every vocation
    dict(name="Valkyrie", voc=0, sex="f", cut="valkyrie", skin="#f3d7c3", hair="#ecca5c", style="braid", fringe="parted", eyes="#3a8ab0", main="#2f4f8f", metal="#d9dee6"),
    dict(name="Shieldmaiden", voc=0, sex="f", cut="shieldmaiden", skin="#e0b48c", hair="#b5482e", style="ponytail", fringe="swept", eyes="#4a8a3a", main="#5a6a4a", shield="#7a2a22"),
    dict(name="Huntress", voc=1, sex="f", cut="huntress", skin="#c99a78", hair="#5a3a22", style="ponytail", fringe="swept", eyes="#6a4a2a", main="#3f6a45", second="#6b4a36"),
    dict(name="Windrunner", voc=1, sex="f", cut="windrunner", skin="#f6e2d4", hair="#eef2f6", style="long", fringe="parted", eyes="#3ab0a0", main="#2f7a6a", second="#e9e6dc", trim="#d9a92b", gem="#59d0ff"),
    dict(name="Witch", voc=2, sex="f", cut="witch", skin="#f1dccb", hair="#6a3a9a", style="long", fringe="straight", eyes="#63c05b", main="#2a1f36", second="#5a2a6a", trim="#a86ae0", orb="#63ff6b"),
    dict(name="Enchantress", voc=2, sex="f", cut="enchantress", skin="#e3bfa0", hair="#cfd8e6", style="long", fringe="parted", eyes="#4a7ad6", main="#2a4a80", second="#9fb4cc", trim="#e9e6dc", orb="#59d0ff"),
    dict(name="Priestess", voc=3, sex="f", cut="priestess", skin="#f6e2d4", hair="#f0d070", style="long", fringe="straight", eyes="#3a8ab0", main="#fbfaf6", second="#f0e6c8", trim="#d9a92b"),
    dict(name="Battle Sister", voc=3, sex="f", cut="battle_sister", skin="#8d5a3b", hair="#1f1a16", style="short", fringe="straight", eyes="#5a3a1a", main="#22202a", trim="#d9a92b", flat=True),
    dict(name="Shadow Dancer", voc=4, sex="f", cut="shadow_dancer", skin="#e0b48c", hair="#1a1622", style="bob", fringe="straight", eyes="#b040e0", main="#2a1f36", second="#3a2a4a", trim="#b49ad6", sash="#8a2be2"),
    dict(name="Nightblade", voc=4, sex="f", cut="nightblade", skin="#f1dccb", hair="#22283a", style="ponytail", fringe="swept", eyes="#c9302c", main="#1f2433", second="#2a3044", trim="#7d838e", scarf="#a8322e"),
    dict(name="Songstress", voc=5, sex="f", cut="songstress", skin="#f3d7c3", hair="#c0663a", style="long", fringe="parted", eyes="#4a8a3a", main="#a8222e", second="#e0b040", gem="#e0405a"),
    dict(name="Blade Dancer", voc=5, sex="f", cut="blade_dancer", skin="#b9835a", hair="#1f1a16", style="buns", fringe="straight", eyes="#c9a53c", main="#1f7a7a", second="#2fa0a0", trim="#e0b040", sash="#e0b040"),
    # v11: the Monks and the Necromancers
    dict(name="Martial Monk", voc=6, sex="m", cut="martial", skin="#e0b48c", hair="#15131a", style="short", eyes="#3a2a1a", main="#f4f1ea", second="#1a1418", band="#c9302c"),
    dict(name="Ascetic", voc=6, sex="m", cut="ascetic", skin="#b9835a", hair="#15131a", style="topknot", eyes="#5a3a1a", main="#e07a1a", second="#a83218", trim="#f6d968"),
    dict(name="Wind Disciple", voc=6, sex="f", cut="wind", skin="#f3d7c3", hair="#2a4a7a", style="ponytail", fringe="swept", eyes="#3a8ab0", main="#9fd0f0", second="#f4f1ea", trim="#e9e6dc"),
    dict(name="Lotus Fist", voc=6, sex="f", cut="lotus", skin="#f1dccb", hair="#1a1418", style="buns", fringe="straight", eyes="#5a2a1a", main="#b3141c", second="#f6d968", trim="#d9a92b"),
    dict(name="Necromancer", voc=7, sex="m", cut="necromancer", skin="#d9d2c8", hair="#22202a", style="short", eyes="#7df0c8", main="#1f1a26", second="#2a1f36", trim="#8a2be2", orb="#c05bff"),
    dict(name="Bone Sage", voc=7, sex="m", cut="bone_sage", skin="#bdb4a8", hair="#7d7a74", style="crop", eyes="#7df0c8", main="#4a4650", trim="#bdb496", orb="#7df0c8", glow="#7df0c8"),
    dict(name="Death Witch", voc=7, sex="f", cut="death_witch", skin="#e6ddd4", hair="#15131a", style="long", fringe="straight", eyes="#63ff6b", main="#2a1f36", second="#1a1420", trim="#63c05b", orb="#63ff6b"),
    dict(name="Grave Maiden", voc=7, sex="f", cut="grave_maiden", skin="#efe6e0", hair="#eef0f2", style="long", fringe="parted", eyes="#c9302c", main="#18141c", second="#8a1a2a", trim="#c9c3d0"),
]


def build(n):
    def make():
        look = LOOKS[n]
        fig = Figure(n, look)
        paint_body_skin(fig)
        paint_face(fig)
        VOCATION_BUILDERS[look["voc"]](fig, look)
        if fig.female and not look.get("flat") and fig.chest:
            color, kind, inflate, trim = fig.chest
            bust(fig, color, trim, kind, inflate)
        return fig.m
    make.__name__ = f"retainer_{n}"
    return make


MODELS = [build(n) for n in range(len(LOOKS))]


def gallery(path, scale=7, cols=8):
    """Every companion side by side, front and back, for the release notes."""
    from PIL import ImageDraw as _Draw
    cell = (220, 330)
    rows = (len(LOOKS) + cols - 1) // cols
    sheet = Image.new("RGBA", (cell[0] * cols, cell[1] * rows), (34, 36, 44, 255))
    draw = _Draw.Draw(sheet)
    for n, make in enumerate(MODELS):
        m = make()
        img = m.render(-28, 12, scale, cell, bg=(34, 36, 44, 255))
        x, y = (n % cols) * cell[0], (n // cols) * cell[1]
        sheet.paste(img, (x, y))
        look = LOOKS[n]
        draw.text((x + 8, y + 6), f"{n}. {look['name']}", fill=(235, 230, 220, 255))
    sheet.save(path)
    return sheet
