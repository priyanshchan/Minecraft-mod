"""v11: the party's thirty-two companions, anime-styled and built in 3D (all art is original).

Every companion is sculpted from many parts and painted at four texels per model unit, in clean cel shading
with a toon outline:
  * an anime build: a larger head (9 units), a slim torso made of chest, waist and hips (narrow at the waist
    for women, broad at the shoulders for men), slender arms and long legs;
  * an anime face: big eyes with a dark-to-bright iris, a pupil, two glints and heavy upper lashes, small
    brows, a dot of a nose, a small mouth and, for women, blush;
  * hair in three dimensions: bangs and side locks as separate pointed locks, layered back hair with jagged
    ends, ponytails and twin tails that curve as chains of segments, buns, braids and an ahoge;
  * clothes and gear in layers: flared pleated skirts, bows, collars, sleeves, plate, capes, hats and helms.
Men and women of every vocation share one skeleton (the player's bone names under a "root" bone, so the
party's poses, emotes and the walk all play on them). Each look is a list of choices - skin, hair and its
style, eyes, a palette and its vocation's outfit in one of four cuts - built by the functions below.
"""
from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image, ImageDraw

from modelkit import Model, rgba, shade, mix

R = 2  # texels per model unit: chunky pixel art, as hand-made Blockbench models are
SHADE = "ramp"  # how a face is shaded: "ramp" (six dithered tones), "smooth" (blended tones) or "cel" (three flat tones)

# Art styles: how finely every character is painted and how it is shaded. One is picked for the whole pack.
STYLES = {
    "pixel": {"res": 2, "shade": "ramp"},  # chunky texels, six dithered tones (v11.0 - v11.1)
    "cel": {"res": 2, "shade": "cel"},  # the same texels in three flat anime tones with dark edges
    "hd": {"res": 3, "shade": "smooth"},  # finer texels (24 across a face) and smooth blended tones
    "anime": {"res": 4, "shade": "cel"},  # finest texels (32 across a face), flat anime tones, big detailed eyes
}
STYLE = "pixel"


def set_style(name):
    """Switches every builder (the companions, the people and the monsters) to one art style."""
    import sys
    global STYLE, SHADE, R
    st = STYLES[name]
    STYLE, SHADE, R = name, st["shade"], st["res"]
    for mod in ("npcs", "monsters"):
        if mod in sys.modules:
            sys.modules[mod].R = R

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

    def __init__(self, face, res=None):
        self.face, self.r = face, res or R
        res = self.r
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
            a, b = self.p(x0), self.p(y0)
            self.d.rectangle([a, b, max(a, self.p(x1) - 1), max(b, self.p(y1) - 1)], fill=rgba(color))
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

    def outline(self, color, width=1):
        w, h = self.img.width, self.img.height
        for k in range(width):
            for x in range(w):
                for y in (k, h - 1 - k):
                    if self.img.getpixel((x, y))[3]:
                        self.img.putpixel((x, y), rgba(color))
            for y in range(h):
                for x in (k, w - 1 - k):
                    if self.img.getpixel((x, y))[3]:
                        self.img.putpixel((x, y), rgba(color))
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


# ------------------------------------------------------------------------------------------ pixel shading
# The look of a hand-made Blockbench model: chunky texels, six tones from highlight to deep shadow, a dithered
# step between tones, darker edges where the light falls away, and hair that fades to its tips.
TOON = 0.52  # how dark an outline is, where one is drawn
BAYER = np.array([[0.0, 0.5], [0.75, 0.25]])


def ramp(color, metal=False):
    if metal:
        return [mix(color, "#ffffff", 0.55), shade(color, 1.32), shade(color, 1.1), shade(color, 0.82), shade(color, 0.58), shade(color, 0.4)]
    return [mix(color, "#ffffff", 0.22), shade(color, 1.12), rgba(color), shade(color, 0.83), shade(color, 0.67), shade(color, 0.5)]


def pixel_shade(p, color, light=0.0, tip=None, grad=(0.0, 1.0), edge=0.9, span=2.3, base=1.2, metal=False, dither=True):
    """Fills a face with ramp shading: lighter at the top, darker down it and towards its side edges, dithered.
    `tip` fades the colour towards another down the face (hair ending in another colour); `grad` is the part of
    that fade this face covers. How the tones are laid down depends on the art style (SHADE)."""
    W, H = p.img.width, p.img.height
    ys = (np.arange(H)[:, None] + 0.5) / H
    xs = np.arange(W)[None, :]
    e = np.minimum(xs + 0.5, W - 0.5 - xs) / max(1.0, W / 2)
    v = base + ys * span - light + (1 - np.minimum(1.0, e * 2.2)) * edge
    if SHADE == "ramp" and dither:
        v = v + (BAYER[np.arange(H)[:, None] % 2, np.arange(W)[None, :] % 2] - 0.375) * 0.45  # dither only near a step
    if SHADE == "cel":
        # three flat tones: a lit band at the top, the base colour, a shadow low down and at the edges
        idx = np.where(v < 1.45, 1, np.where(v < 2.75, 2, 3))
        if W >= 3 and edge > 0.5:  # a dark line down each side, as an anime outline
            idx[:, 0] = 4
            idx[:, W - 1] = 4
        frac = None
    elif SHADE == "smooth":
        v = np.clip(v, 0, 4.999)
        idx = v.astype(int)
        frac = np.round((v - idx) * 3) / 3  # blended in thirds: soft, still painted by hand
    else:
        idx = np.clip(v.astype(int), 0, 5)
        frac = None
    out = np.zeros((H, W, 4), np.uint8)
    rows = {}
    for y in range(H):
        if tip:
            t = grad[0] + (grad[1] - grad[0]) * (y + 0.5) / H
            key = round(t, 2)
            if key not in rows:
                rows[key] = np.array(ramp(mix(color, tip, min(1.0, max(0.0, t)) ** 1.4), metal), np.float32)
            tones = rows[key]
        else:
            if None not in rows:
                rows[None] = np.array(ramp(color, metal), np.float32)
            tones = rows[None]
        if frac is None:
            out[y] = tones[idx[y]]
        else:
            a, b = tones[idx[y]], tones[np.minimum(idx[y] + 1, 5)]
            out[y] = np.round(a + (b - a) * frac[y][:, None])
    p.img.paste(Image.fromarray(out, "RGBA"))
    return p


def cel(p, color, light=1.14, dark=0.8, top=0.18, bottom=0.26, outline=True):
    return pixel_shade(p, color)


def toon(cube, color, outline=True, light=1.14, dark=0.8, top=0.18, bottom=0.26, tip=None, grad=(0.0, 1.0)):
    for f in cube.faces:
        with paint(f) as p:
            if f is cube.top:
                pixel_shade(p, color, light=1.3, span=0.6, edge=0.6, tip=tip, grad=(grad[0], grad[0]))
            elif f is cube.bottom:
                pixel_shade(p, color, light=-2.2, span=0.6, edge=0.3, tip=tip, grad=(grad[1], grad[1]))
            else:
                pixel_shade(p, color, tip=tip, grad=grad)
    return cube


def toon_metal(cube, color, trim=None, rivets=False):
    for f in cube.faces:
        with paint(f) as p:
            if f is cube.bottom:
                pixel_shade(p, color, light=-2.5, span=0.5, metal=True)
                continue
            if f is cube.top:
                pixel_shade(p, color, light=1.4, span=0.8, metal=True)
            else:
                pixel_shade(p, color, span=2.6, base=1.0, metal=True)
                # the glint: one bright row a quarter of the way down, and a bright column
                y = int(p.img.height * 0.25)
                for x in range(1, p.img.width - 1):
                    p.px(x, y, mix(color, "#ffffff", 0.75))
                if p.img.width >= 4:
                    p.px(1, max(0, y - 1), "#ffffff")
            if trim and f in sides(cube):
                t = max(1, p.img.height // 6)
                for x in range(p.img.width):
                    for k in range(t):
                        p.px(x, k, mix(trim, "#ffffff", 0.2) if k == 0 else trim)
                        p.px(x, p.img.height - 1 - k, shade(trim, 0.7))
            if rivets and f in sides(cube) and p.h >= 2 and p.w >= 2:
                for rx in (0.5, p.w - 0.5):
                    p.px(int(rx * R) - (1 if rx > 1 else 0), int(p.h / 2 * R), mix(color, "#ffffff", 0.7))
    return cube


def toon_leather(cube, color, stitch=True):
    toon(cube, color)
    if stitch:
        for f in sides(cube):
            with paint(f) as p:
                if p.h >= 2:
                    for x in range(0, p.img.width, 2):
                        p.px(x, 1, shade(color, 1.4))
    return cube


def toon_hair(cube, hair, tips="point", ring=True, seed=0, tip=None, grad=(0.0, 1.0)):
    """Hair: ramp shading fading to the tip colour, a few dark strands, a light band, pointed or blunt ends."""
    hl, h, hd, hdd = hair_colors(hair)
    rnd = random.Random(seed)
    for f in cube.faces:
        with paint(f) as p:
            if f is cube.top:
                pixel_shade(p, hair, light=1.2, span=0.6, edge=0.5, tip=tip, grad=(grad[0], grad[0]))
                continue
            if f is cube.bottom:
                pixel_shade(p, hair, light=-2.2, span=0.4, tip=tip, grad=(grad[1], grad[1]))
                continue
            pixel_shade(p, hair, tip=tip, grad=grad, span=2.0, base=1.0)
            W, H = p.img.width, p.img.height
            for _ in range(max(1, W // 3)):  # strands
                x = rnd.randrange(W)
                for y in range(H // 4, H):
                    c = p.img.getpixel((x, y))
                    if c[3]:
                        p.img.putpixel((x, y), shade(c, 0.78))
            if ring and H >= 6:  # a band of shine
                y = max(1, int(H * 0.22))
                for x in range(W):
                    if (x + y) % 3:
                        c = p.img.getpixel((x, y))
                        p.img.putpixel((x, y), mix(c, "#ffffff", 0.3))
            if tips == "point":
                depth = min(H // 2, max(1, W // 2))
                for x in range(W):
                    t = abs((x + 0.5) - W / 2) / (W / 2)
                    for k in range(int(round(t * depth))):
                        p.px(x, H - 1 - k, (0, 0, 0, 0))
    return cube


def hollow(cube):
    for f in (cube.top, cube.bottom):
        with paint(f) as p:
            p.clear()
    return cube


# ------------------------------------------------------------------------------------------ the body
class Limb:
    """One arm or leg: its bone and the box it fills."""

    def __init__(self, bone, x0, w, z0, d, y0, y1, inflate=0.0):
        self.bone, self.x0, self.w, self.z0, self.d, self.y0, self.y1, self.inflate = bone, x0, w, z0, d, y0, y1, inflate

    def cube(self, y0=None, y1=None, extra=0.0):
        y0 = self.y0 if y0 is None else y0
        y1 = self.y1 if y1 is None else y1
        return self.bone.cube((self.x0, y0, self.z0), (self.w, int(y1 - y0), self.d), inflate=self.inflate + extra)


class Figure:
    """The bones and base shapes of one companion, for its outfit to dress."""

    HEAD = 8

    def __init__(self, n, look, name=None, bones=()):
        self.n, self.look = n, look
        f = self.female = look["sex"] == "f"
        self.m = m = Model(name or f"retainer_{n}", bounds=(4.0, 4.2, 1.5), res=R)
        legs = self.leg_top = 13 if f else 12  # long legs
        self.root = m.bone("root", (0, 0, 0))
        self.body = m.bone("body", (0, 24, 0), parent="root")
        self.head = m.bone("head", (0, 24, 0), parent="body")
        self.rarm = m.bone("rightArm", (-4, 23, 0) if f else (-5, 22.5, 0), parent="body")
        self.larm = m.bone("leftArm", (4, 23, 0) if f else (5, 22.5, 0), parent="body")
        self.rleg = m.bone("rightLeg", (-1.6, legs, 0) if f else (-1.9, legs, 0), parent="root")
        self.lleg = m.bone("leftLeg", (1.6, legs, 0) if f else (1.9, legs, 0), parent="root")
        # chest, waist and hips: (x0, width, z0, depth, y0, y1, inflate)
        if f:
            self.segs = [(-3, 6, -1.5, 3, 18, 24, 0.0), (-2.5, 5, -1.5, 3, 15, 18, -0.15), (-3.5, 7, -1.5, 3, 13, 15, 0.25)]
            self.arm_l = [Limb(self.rarm, -5, 2, -1, 2, 13, 24), Limb(self.larm, 3, 2, -1, 2, 13, 24)]
            self.leg_l = [Limb(self.rleg, -3.1, 3, -1.5, 3, 0, legs), Limb(self.lleg, 0.1, 3, -1.5, 3, 0, legs)]
            self.front, self.back = -1.5, 1.5
        else:
            self.segs = [(-3.5, 7, -2, 4, 17, 24, 0.0), (-3, 6, -2, 4, 14, 17, -0.08), (-3.5, 7, -2, 4, 12, 14, 0.05)]
            self.arm_l = [Limb(self.rarm, -6.5, 3, -1.5, 3, 12, 24), Limb(self.larm, 3.5, 3, -1.5, 3, 12, 24)]
            self.leg_l = [Limb(self.rleg, -3.4, 3, -1.5, 3, 0, legs, 0.1), Limb(self.lleg, 0.4, 3, -1.5, 3, 0, legs, 0.1)]
            self.front, self.back = -2, 2
        self.torso = [self.body.cube((x0, y0, z0), (w, y1 - y0, d), inflate=inf) for x0, w, z0, d, y0, y1, inf in self.segs]
        H = self.HEAD
        self.skull = self.head.cube((-H / 2, 24, -H / 2), (H, H, H))
        neck = self.head.cube((-1, 23, -1), (2, 1, 2))
        toon(neck, shade(look["skin"], 0.85))
        self.arms_c = [limb.cube() for limb in self.arm_l]
        self.legs_c = []
        knee = 6
        for limb in self.leg_l:  # a thigh and a slimmer shin
            self.legs_c.append(limb.bone.cube((limb.x0, knee, limb.z0), (limb.w, legs - knee, limb.d), inflate=limb.inflate + (0.15 if f else 0.0)))
            self.legs_c.append(limb.bone.cube((limb.x0, 0, limb.z0), (limb.w, knee, limb.d), inflate=limb.inflate - (0.12 if f else 0.0)))
        ra = self.arm_l[0]
        self.hx = ra.x0 + ra.w / 2  # where the right hand holds things
        self.hy = ra.y0 + 0.5
        self.hz = ra.z0
        la = self.arm_l[1]
        self.ox = la.x0 + la.w / 2
        self.weapon = m.bone("weapon", (self.hx, self.hy, self.hz), parent="rightArm")
        self.offhand = m.bone("offhand", (self.ox, self.hy, la.z0), parent="leftArm")
        self.cape = m.bone("cape", (0, 24, self.back), parent="body")
        self.chest = None  # (colour, kind, inflate) of the outermost layer over a woman's chest
        # bones some creatures' animations move: a robe that sways, a tail, wings (v11.1, for the NPCs)
        hips = self.segs[2]
        self.robe = m.bone("robe", (0, hips[5], 0), parent="body") if "robe" in bones else None
        self.tail = m.bone("tail", (0, hips[4] + 1, self.back), parent="body") if "tail" in bones else None
        self.rwing = m.bone("rightWing", (-1.5, 21, self.back + 0.5), parent="body") if "wings" in bones else None
        self.lwing = m.bone("leftWing", (1.5, 21, self.back + 0.5), parent="body") if "wings" in bones else None
        self.skirt_bone = self.robe

    def wrap(self, y0, y1, extra=0.3, bone=None):
        """Cubes hugging the torso between two heights (vests, plate, corsets, belts)."""
        out = []
        for x0, w, z0, d, sy0, sy1, inf in self.segs:
            a, b = max(y0, sy0), min(y1, sy1)
            if b > a:
                out.append((bone or self.body).cube((x0, a, z0), (w, int(b - a), d), inflate=inf + extra))
        return out

    def seg_at(self, y):
        for seg in self.segs:
            if seg[4] <= y < seg[5]:
                return seg
        return self.segs[0]


def hair_colors(hair):
    return shade(hair, 1.22), hair, shade(hair, 0.76), shade(hair, 0.55)


# ------------------------------------------------------------------------------------------ skin and face
def paint_skin(fig):
    """Skin is smooth: soft shading, no dithering."""
    skin = fig.look["skin"]
    for cube in fig.torso + fig.arms_c + fig.legs_c:
        for f in cube.faces:
            with paint(f) as p:
                pixel_shade(p, skin, light=1.0 if f is cube.top else -1.5 if f is cube.bottom else 0.4, span=1.4, edge=0.45, dither=False)
    for f in fig.skull.faces:
        with paint(f) as p:
            if f is fig.skull.front:
                p.fill(skin)
                p.rect(0, 7.5, 8, 8, shade(skin, 0.92))  # under the chin
            else:
                pixel_shade(p, skin, light=1.0, span=1.0, edge=0.4, dither=False)


# 16 x 16 faces, as on a Minecraft anime skin. Three styles to choose from:
#   "soft":  big gentle eyes (3 x 4) with a dark lash line, a coloured iris and one white glint
#   "sharp": narrow eyes (3 x 2) under a heavy lash, cool and quiet, like the reference model
#   "cute":  tall round eyes (2 x 4), tiny mouth, strong blush
FACE = "soft"
# Each eye is drawn for the left side of the face (outer corner first); the right one mirrors it.
# L lash, I iris, H glint, P pupil, J lower iris, W white
EYES = {
    "soft": {"f": ["LLLL", "IHIW", "IIPW", ".JJ."], "m": ["LLLL", "IHPW", ".JJ."]},
    "sharp": {"f": ["LLLL", "IHPW"], "m": ["LLLL", "IHPW"]},
    "cute": {"f": [".LL.", "LHIL", "LIPL", ".JJ."], "m": [".LL.", "LHIL", ".JJ."]},
}


# Finer faces for the finer art styles: 24 and 32 texels across. D dark top of the iris, S the soft lower lash,
# G a second, smaller glint.
EYES_HD = {
    3: {"soft": {"f": ["LLLLL.", "LDDDDL", ".DHDIW", ".IPPIW", ".IPPJW", ".JJJJ.", "..SS.."],
                 "m": ["LLLLLL", ".DHDDW", ".IPPIW", ".JJJJ.", "..SS.."]},
        "sharp": {"f": ["LLLLL.", "LLLLLL", ".DHPDW", ".JIPJ.", "..SSS."],
                  "m": ["LLLLLL", ".LDHPW", ".JIPJ.", "..SS.."]}},
    4: {"soft": {"f": ["..LLLLL.", "LLLLLLLL", "LLDDDDDL", ".DHHDDDW", ".IHHPPIW", ".IIPPPIW", ".JIPPGJW", "..JJJJJ.", "...SSS.."],
                 "m": ["LLLLLLLL", ".LDDDDDL", ".DHHPDIW", ".IHPPIIW", "..JJJJJ.", "...SSS.."]},
        "sharp": {"f": ["LLLLLLL.", "LLLLLLLL", ".LDHHPDW", "..IIPPIW", "...SSSS."],
                  "m": ["LLLLLLLL", ".LDHPPDW", "..JIPIJ.", "...SSS.."]}},
}


def paint_face_hd(fig, style):
    look = fig.look
    skin, eye, hair = look["skin"], look["eyes"], look["hair"]
    r = R
    F = 8 * r
    lash = mix(shade(hair, 0.3), "#100810", 0.65)
    glow = look.get("glow")
    iris = glow or eye

    def palette(c):
        return {"L": lash, "D": shade(c, 0.62) if not glow else c, "I": c, "J": mix(c, "#ffffff", 0.4),
                "P": shade(c, 0.3) if not glow else mix(c, "#ffffff", 0.6), "H": "#ffffff", "G": mix(c, "#ffffff", 0.75),
                "W": "#f8f6f2", "S": mix(lash, skin, 0.55)}

    kit = EYES_HD[r].get(style) or EYES_HD[r]["soft"]
    eyes = kit["f" if fig.female else "m"]
    ew, eh = len(eyes[0]), len(eyes)
    tall = eh >= (7 if r == 3 else 9)
    ey = int(round((6.0 if tall else 5.75) * r)) - eh
    lx, rx = r, F - r - ew
    pal, pal2 = palette(iris), palette(look["eyes2"]) if look.get("eyes2") else None
    with paint(fig.skull.front) as p:
        p.art(eyes, pal, lx, ey)
        p.art(eyes, pal2 or pal, rx, ey, mirror=True)
        brow = mix(shade(hair, 0.75), lash, 0.4)
        by = ey - (2 if r == 3 else 3)
        for x in range(1, ew - 1):  # brows, a little higher at the inner end for a soft look
            lift = 1 if (style == "soft" and x >= ew - 2 and r == 4) else 0
            p.px(lx + x, by - lift, brow).px(rx + ew - 1 - x, by - lift, brow)
        c = F // 2
        nose_y = int(round(6.2 * r))
        p.px(c, nose_y, shade(skin, 0.86))  # a dot of a nose, its shadow on one side
        my = int(round(6.85 * r))
        if fig.female:
            lips = look.get("lips", "#c06470")
            p.px(c - 1, my, lips).px(c, my, mix(lips, skin, 0.35))
            if r == 4:
                p.px(c - 2, my - 1, mix(lips, skin, 0.5)).px(c + 1, my - 1, mix(lips, skin, 0.6))  # a small smile
            for x in range(lx, lx + (3 if r == 3 else 4)):  # blush, two rows of soft strokes under each eye
                for k in range(r - 2):
                    p.blend(x + k, ey + eh + k, "#ff6f86", 0.32)
                    p.blend(F - 1 - x - k, ey + eh + k, "#ff6f86", 0.32)
        else:
            lips = look.get("lips", shade(skin, 0.66))
            for x in range(c - r + 1, c + r - 1):
                p.px(x, my, lips)
        if look.get("scar"):
            p.rect(6, 2.5, 6 + 1 / r, 4.6, shade(skin, 0.62))
    for f in (fig.skull.right, fig.skull.left):
        with paint(f) as p:  # ears
            p.rect(3.5, 4, 4.5, 6, shade(skin, 0.86))


def paint_face(fig, style=None):
    """A Minecraft anime face: eyes four texels apart at the height of Steve's, a small mouth, blush on the cheeks."""
    style = style or fig.look.get("face", FACE)
    if R > 2:
        return paint_face_hd(fig, style)
    look = fig.look
    skin, eye, hair = look["skin"], look["eyes"], look["hair"]
    lash = mix(shade(hair, 0.3), "#100810", 0.65)
    glow = look.get("glow")
    iris = glow or eye
    pal = {"L": lash, "I": iris, "J": mix(iris, "#ffffff", 0.45), "P": shade(iris, 0.32) if not glow else mix(iris, "#ffffff", 0.6),
           "H": "#ffffff", "W": "#f8f6f2"}
    eyes = EYES[style]["f" if fig.female else "m"]
    ew, eh = len(eyes[0]), len(eyes)
    ey = 8 if eh >= 3 else 9
    lx, rx = 2, 16 - 2 - ew
    pal2 = dict(pal)
    if look.get("eyes2"):
        e2 = look["eyes2"]
        pal2.update({"I": e2, "J": mix(e2, "#ffffff", 0.45), "P": shade(e2, 0.32)})
    with paint(fig.skull.front) as p:
        p.art(eyes, pal, lx, ey)
        p.art(eyes, pal2, rx, ey, mirror=True)
        brow = mix(shade(hair, 0.75), lash, 0.4)
        by = ey - 2
        for x in range(1, ew):  # brows: a short line over each eye
            p.px(lx + x, by, brow).px(rx + ew - 1 - x, by, brow)
        my = 13
        if fig.female:
            p.px(7, my, look.get("lips", "#c06470")).px(8, my, mix(look.get("lips", "#c06470"), skin, 0.4))
            for x in (2, 3, 12, 13):
                p.blend(x, 12, "#ff6f86", 0.3)
        else:
            lips = look.get("lips", shade(skin, 0.66))
            p.px(6, my, lips).px(7, my, lips).px(8, my, lips).px(9, my, lips)
        if look.get("scar"):
            for i in range(4):
                p.px(12, 5 + i, shade(skin, 0.62))
    for f in (fig.skull.right, fig.skull.left):
        with paint(f) as p:  # ears
            p.rect(3.5, 4, 4.5, 6, shade(skin, 0.86))


def elf_ears(fig):
    H = Figure.HEAD
    skin = fig.look["skin"]
    for x, rz in ((-H / 2 - 1, -30), (H / 2, 30)):
        ear = fig.head.cube((x, 27.5, -0.5), (1, 3, 1), rotation=(0, 0, rz), pivot=(x + 0.5, 27.5, 0))
        toon(ear, skin)


# ------------------------------------------------------------------------------------------ hair in 3D
def _rot(rx, ry, rz):
    """The same rotation the renderer (and Bedrock) applies, to chain hair segments end to end."""
    ax, ay, az = math.radians(-rx), math.radians(ry), math.radians(-rz)
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return mz @ my @ mx


def lock(fig, top, w, length, d=1, rot=(0, 0, 0), tips="point", bone=None, ring=False, inflate=0.0, grad=(0.0, 0.6)):
    """One lock of hair hanging from `top` (its top centre), turned by `rot` about that point."""
    x, y, z = top
    c = (bone or fig.head).cube((x - w / 2, y - length, z - d / 2), (w, int(length), d), rotation=rot, pivot=(x, y, z), inflate=inflate)
    toon_hair(c, fig.look["hair"], tips, ring, fig.n * 31 + int(x * 10 + y), fig.look.get("tip"), grad)
    return c


def chain(fig, start, parts, bone=None, fade=(0.0, 1.0)):
    """A tail of hair as a chain of segments, each hanging from the end of the one before, fading to its tip."""
    point = np.array(start, float)
    total = sum(p[1] for p in parts)
    done = 0.0
    for i, (w, length, d, rot) in enumerate(parts):
        last = i == len(parts) - 1
        g0 = fade[0] + (fade[1] - fade[0]) * done / total
        g1 = fade[0] + (fade[1] - fade[0]) * (done + length) / total
        lock(fig, tuple(point), w, length, d, rot, "point" if last else "blunt", bone, ring=i == 0, grad=(g0, g1))
        point = point + _rot(*rot) @ np.array([0, -length + 0.35, 0])
        done += length


def hair_cap(fig, sides="ear", back="short", inflate=0.4, bangs_base=1.25):
    H = Figure.HEAD
    cap = fig.head.cube((-H / 2, 24, -H / 2), (H, H, H), inflate=inflate)
    toon_hair(cap, fig.look["hair"], "blunt", True, fig.n, fig.look.get("tip"), (0.0, 0.25))
    with paint(cap.front) as p:
        p.clear(0, bangs_base, H, H)
    for f, right in ((cap.right, True), (cap.left, False)):
        with paint(f) as p:
            front_low = not right  # the left face starts at the front edge, the right one at the back
            if sides == "ear":
                lo, hi = (0, 5.5) if front_low else (2.5, 8)
                p.clear(lo, 3.5, hi, 8)
            elif sides == "jaw":
                lo, hi = (0, 1.5) if front_low else (6.5, 8)
                p.clear(lo, 6.5, hi, 8)
            if back == "short" and sides == "ear":
                lo, hi = (5.5, 8) if front_low else (0, 2.5)
                p.clear(lo, 6.5, hi, 8)
    with paint(cap.back) as p:
        if back == "short":
            p.clear(0, 6.5, H, H)
    with paint(cap.bottom) as p:
        p.clear()
    return cap


BANGS = {
    # (x of the lock's centre, width, length, z-turn): bangs over the forehead
    "hime": [(-3, 2, 4, 0), (-1, 2, 4, 0), (1, 2, 4, 0), (3, 2, 4, 0)],
    "swept": [(-3, 2, 3, 12), (-1.3, 2, 4, 18), (0.5, 2, 5, 22), (2.4, 2, 4, 24), (3.6, 1, 3, 20)],
    "parted": [(-3.2, 2, 5, -16), (-1.6, 2, 4, -22), (1.6, 2, 4, 22), (3.2, 2, 5, 16)],
    "spiky": [(-3.2, 2, 3, 14), (-1.5, 1, 4, 6), (-0.3, 2, 3, -6), (1.3, 1, 4, -12), (2.8, 2, 3, -18), (3.7, 1, 3, -24)],
    "short": [(-2.8, 2, 2, 10), (-0.9, 2, 3, 4), (1.0, 2, 3, -6), (2.9, 2, 2, -12)],
    "heavy": [(-3.3, 2, 5, 10), (-1.6, 1, 4, 5), (0, 2, 5, 0), (1.6, 1, 4, -5), (3.3, 2, 5, -10)],
}


def bangs(fig, kind):
    H = Figure.HEAD
    z = -H / 2 - 0.85
    for x, w, length, rz in BANGS.get(kind, []):
        lock(fig, (x, 24 + H + 0.3, z), w, length, 1, (-10, 0, rz), "blunt" if kind == "hime" else "point", grad=(0.0, 0.25))


def side_locks(fig, length=9):
    """Long locks falling in front of the shoulders."""
    H = Figure.HEAD
    for x, rz in ((-H / 2 - 0.45, -5), (H / 2 + 0.45, 5)):
        chain(fig, (x, 24 + H - 1, -2.8), [(1, length // 2 + 1, 2, (-4, 0, rz)), (1, length - length // 2, 2, (6, 0, -rz / 2))], fade=(0.1, 0.9))


def flowing(fig, length=16, strands=6, spread=1.0):
    """Long hair down the back: a layer close to the back and loose strands that sway, each fading to its tip."""
    H = Figure.HEAD
    top = 24 + H - 0.6
    z = H / 2 - 0.4
    under = fig.head.cube((-H / 2, top - length * 0.55, z - 0.6), (H, int(length * 0.55), 2), rotation=(10, 0, 0), pivot=(0, top, z))
    toon_hair(under, fig.look["hair"], "blunt", False, fig.n + 7, fig.look.get("tip"), (0.0, 0.5))
    rnd = random.Random(fig.n * 7)
    for i in range(strands):
        x = (-H / 2 + 0.8 + i * (H - 1.6) / max(1, strands - 1)) * spread
        sway = (i - (strands - 1) / 2) * 4 + rnd.uniform(-3, 3)
        l1 = int(length * 0.45)
        l2 = int(length * 0.35)
        l3 = max(2, length - l1 - l2 + rnd.randint(-1, 2))
        chain(fig, (x, top, z + 0.8), [(2, l1, 1, (14, 0, sway)), (2, l2, 1, (6, 0, sway * 0.6 + rnd.uniform(-4, 4))),
                                        (1, l3, 1, (2, 0, -sway * 0.3))])


def nape_spikes(fig):
    H = Figure.HEAD
    for i, x in enumerate((-2.6, -0.9, 0.9, 2.6)):
        lock(fig, (x, 26, H / 2 + 0.2), 2, 2 + i % 2, 1, (24, 0, x * 5))


def ahoge(fig):
    H = Figure.HEAD
    lock(fig, (0.5, 24 + H + 0.2, -1), 1, 3, 1, (150, 0, -15), "point")


def crown_locks(fig, spiky=False):
    """Locks over the crown and temples that break the box of the head into a head of hair."""
    H = Figure.HEAD
    top = 24 + H + 0.2
    if spiky:  # a man's tousled crown: locks raised and turned out all round
        for x, z, rx, rz in ((-2.6, -2.2, -35, 25), (0, -2.6, -40, 0), (2.6, -2.2, -35, -25), (-3.0, 1.3, 30, 30), (0, 2.2, 35, 0), (3.0, 1.3, 30, -30)):
            lock(fig, (x, top - 0.6, z), 2, 3, 2, (180 + rx, 0, rz), "point", grad=(0.0, 0.2))
    for sx in (-1, 1):  # fuller sides, over the temples
        lock(fig, (sx * (H / 2 + 0.3), top - 0.8, -1.3), 1, 5, 3, (0, 0, sx * 8), "point", grad=(0.0, 0.35))
        lock(fig, (sx * (H / 2 + 0.3), top - 0.8, 2.2), 1, 6, 3, (6, 0, sx * 6), "point", grad=(0.0, 0.4))


def hair_style(fig):
    look = fig.look
    style = look["style"]
    H = Figure.HEAD
    top = 24 + H
    bang = look.get("fringe", "hime" if fig.female else "spiky")
    if look.get("helmet") == "full":
        return  # all of it under the helm
    crowned = not look.get("helmet")
    if style == "bald":
        pass
    elif style == "crop":
        hair_cap(fig, "ear", "short", 0.15, 1.0)
        bangs(fig, "short")
    elif style == "topknot":
        hair_cap(fig, "ear", "short", 0.12, 0.75)
        lock(fig, (0, top + 2.5, 0.5), 3, 3, 3, (0, 0, 0), "blunt")
        lock(fig, (0, top + 4.0, 0.5), 1, 2, 1, (0, 0, 0), "blunt")
    elif style in ("short", "wild", "slick"):
        hair_cap(fig, "ear", "short", 0.45 if style == "wild" else 0.35)
        bangs(fig, "short" if style == "slick" else bang)
        nape_spikes(fig)
        crown_locks(fig, spiky=crowned)
        if style == "wild":
            for x, rz in ((-H / 2, -35), (H / 2, 35), (-2.2, -15), (2.2, 15)):
                lock(fig, (x, top - 0.5, 1.3), 2, 4, 2, (-25, 0, rz))
    elif style == "bob":
        hair_cap(fig, "jaw", "full", 0.45)
        bangs(fig, bang)
        side_locks(fig, 6)
        lock(fig, (0, top - 1, H / 2 + 0.3), H, 7, 1, (8, 0, 0), "blunt", grad=(0.0, 0.5))
        if crowned:
            crown_locks(fig)
    elif style == "long":
        hair_cap(fig, "jaw", "full", 0.45)
        bangs(fig, bang)
        side_locks(fig, look.get("locks", 12))
        flowing(fig, look.get("length", 17), look.get("strands", 6))
        if crowned:
            crown_locks(fig)
    elif style == "ponytail":
        hair_cap(fig, "jaw" if fig.female else "ear", "full", 0.4)
        bangs(fig, bang)
        if fig.female:
            side_locks(fig, 9)
        tie = fig.head.cube((-1, top - 2.5, H / 2 + 0.1), (2, 2, 1), inflate=0.2)
        toon(tie, look.get("ribbon", look.get("trim", GOLD)))
        chain(fig, (0, top - 1, H / 2 + 0.9), [(3, 4, 3, (-40, 0, 0)), (3, 5, 2, (-15, 0, 0)), (2, 6, 2, (-4, 0, 0)), (1, 4, 1, (6, 0, 0))])
    elif style == "twintails":
        hair_cap(fig, "jaw", "full", 0.45)
        bangs(fig, bang)
        side_locks(fig, 8)
        for sx in (-1, 1):
            tie = fig.head.cube((sx * (H / 2 + 0.4) - 1, top - 2.5, 0), (2, 2, 2), inflate=0.15)
            toon(tie, look.get("ribbon", "#e0405a"))
            chain(fig, (sx * (H / 2 + 1.1), top - 1.5, 1), [(3, 4, 3, (0, 0, sx * 35)), (3, 6, 2, (6, 0, sx * 10)), (2, 6, 2, (8, 0, 0)),
                                                             (2, 5, 2, (4, 0, -sx * 6)), (1, 4, 1, (0, 0, -sx * 10))])
    elif style == "braid":
        hair_cap(fig, "jaw", "full", 0.45)
        bangs(fig, bang)
        side_locks(fig, 8)
        for i in range(5):
            lock(fig, (0, top - 4 - i * 3, H / 2 + 0.6 + 0.2 * i), 2, 3, 2, (12, 0, 10 if i % 2 else -10), "blunt", grad=(i / 6, (i + 1) / 6))
        tip = fig.head.cube((-1, top - 19, H / 2 + 1.4), (2, 1, 2), inflate=0.1)
        toon(tip, look.get("ribbon", GOLD))
        lock(fig, (0, top - 19, H / 2 + 2.4), 1, 3, 1, (0, 0, 0), grad=(0.85, 1.0))
    elif style == "buns":
        hair_cap(fig, "jaw", "full", 0.4)
        bangs(fig, bang)
        side_locks(fig, 7)
        for sx in (-1, 1):
            bun = fig.head.cube((sx * 3 - 1.5, top - 0.2, -0.5), (3, 3, 3), inflate=0.1)
            toon_hair(bun, look["hair"], "blunt", True, fig.n)
            band_ = fig.head.cube((sx * 3 - 1.5, top - 0.2, -0.5), (3, 1, 3), inflate=0.25)
            toon(band_, look.get("ribbon", GOLD))
            hollow(band_)
    if look.get("ahoge"):
        ahoge(fig)
    if look.get("beard"):
        beard(fig)


def beard(fig):
    H = Figure.HEAD
    b = fig.head.cube((-H / 2, 23, -H / 2 - 0.6), (H, 4, 1))
    toon_hair(b, fig.look["hair"], "point", False, fig.n)
    with paint(b.front) as p:
        p.clear(3, 0, 5, 1.0)
    for sx in (-1, 1):
        burn = fig.head.cube((sx * (H / 2 + 0.2) - 0.5, 24.5, -3), (1, 4, 3))
        toon_hair(burn, fig.look["hair"], "blunt", False, fig.n)
    stache = fig.head.cube((-2, 26, -H / 2 - 0.65), (4, 1, 1))
    toon_hair(stache, fig.look["hair"], "blunt", False, fig.n)


# ------------------------------------------------------------------------------------------ horns, wings and haloes
def horns(fig, color="#2a2230", tip="#b05af0", curl=1.0):
    """Demon horns curving back from the brow, dark at the root and bright at the point."""
    H = Figure.HEAD
    for sx in (-1, 1):
        point = np.array([sx * 2.2, 24 + H + 0.2, -1.5])
        parts = [(2, 3, 2, (155, 0, sx * 28)), (2, 3, 1, (125 * curl, 0, sx * 40)), (1, 3, 1, (85 * curl, 0, sx * 45))]
        total = sum(q[1] for q in parts)
        done = 0
        for i, (w, length, d, rot) in enumerate(parts):
            c = fig.head.cube((point[0] - w / 2, point[1] - length, point[2] - d / 2), (w, length, d), rotation=rot, pivot=tuple(point))
            for f in c.faces:
                with paint(f) as p:
                    pixel_shade(p, color, tip=tip, grad=(done / total, (done + length) / total), span=1.6)
            point = point + _rot(*rot) @ np.array([0, -length + 0.3, 0])
            done += length


def bat_wings(fig, frame="#cfc8d8", membrane="#2a1f3a", glow="#9a3af0", span=1.0):
    """Great bat wings: a bone frame of fingers spread from the shoulder blades, and torn membranes between."""
    z = fig.back + 0.6
    for sx in (-1, 1):
        root = np.array([sx * 1.5, 21.0, z])
        # the arm of the wing, up and out, then the fingers fanning from its end
        arm_rot = (0, sx * -25, sx * 38)
        wing = (fig.rwing if sx < 0 else fig.lwing) or fig.body  # wings flap on their own bones where there are any
        arm = wing.cube((root[0] - 0.5, root[1], root[2] - 0.5), (1, int(9 * span), 1), rotation=arm_rot, pivot=tuple(root))
        toon(arm, frame)
        wrist = root + _rot(*arm_rot) @ np.array([0, 9 * span - 0.5, 0])
        joint = wing.cube((wrist[0] - 1, wrist[1] - 1, wrist[2] - 1), (2, 2, 2))
        toon(joint, frame)
        claw = wing.cube((wrist[0] - 0.5, wrist[1] + 0.5, wrist[2] - 0.5), (1, 2, 1), rotation=(0, 0, sx * 20), pivot=tuple(wrist))
        toon(claw, shade(frame, 0.7))
        fingers = [(sx * 100, 13), (sx * 135, 12), (sx * 165, 10)]
        for k, (rz, length) in enumerate(fingers):
            rot = (0, sx * -20, rz)
            finger = wing.cube((wrist[0] - 0.5, wrist[1], wrist[2] - 0.5), (1, int(length * span), 1), rotation=rot, pivot=tuple(wrist))
            toon(finger, frame)
            # the membrane between this finger and the next (or the body), a thin torn sheet
            nxt = fingers[k + 1][0] if k + 1 < len(fingers) else sx * 200
            mid = (rz + nxt) / 2
            mem_len = int(length * span * 0.95)
            sheet = wing.cube((wrist[0] - 3, wrist[1], wrist[2] - 0.5), (6, mem_len, 1), rotation=(0, sx * -20, mid), pivot=tuple(wrist), inflate=-0.35)
            for f in sheet.faces:
                with paint(f) as p:
                    pixel_shade(p, membrane, tip=glow, grad=(0.1, 0.9), span=1.4, edge=0.4)
                    W, Hh = p.img.width, p.img.height
                    rnd = random.Random(fig.n * 13 + k + sx)
                    for x in range(W):  # a scalloped, torn edge
                        cut = int(3 * abs(math.sin((x + 1) * math.pi / (W / 2)))) + rnd.randint(0, 2)
                        for kk in range(cut):
                            p.px(x, Hh - 1 - kk, (0, 0, 0, 0))
                    for _ in range(max(1, W * Hh // 60)):  # holes and veins
                        hx, hy = rnd.randrange(W), rnd.randrange(Hh // 3, Hh)
                        p.px(hx, hy, mix(membrane, glow, 0.6))


def feather_wings(fig, color="#f6f4f0", tip="#cfd8e8", span=1.0):
    """White feathered wings, folded half open: rows of long feathers."""
    z = fig.back + 1.0
    for sx in (-1, 1):
        root = np.array([sx * 1.5, 21.5, z])
        for row, (rz, n, length) in enumerate(((sx * 20, 4, 8), (sx * 38, 5, 11), (sx * 58, 5, 13))):
            for i in range(n):
                rot = (-12 - i * 3, sx * -40, rz + sx * i * 5)
                wing = (fig.rwing if sx < 0 else fig.lwing) or fig.body
                f = wing.cube((root[0] - 1, root[1], root[2] - 0.5 + row * 0.3), (2, int(length * span), 1), rotation=rot, pivot=tuple(root))
                toon_hair(f, color, "point", False, fig.n + row * 7 + i, tip, (0.0, 1.0))


def halo(fig, color="#ffe48a"):
    H = Figure.HEAD
    y = 24 + H + 2.5
    for x0, z0, w, d in ((-3, -3, 6, 1), (-3, 2, 6, 1), (-3, -2, 1, 4), (2, -2, 1, 4)):
        c = fig.head.cube((x0, y, z0), (w, 1, d), inflate=-0.1)
        toon(c, color)


# ------------------------------------------------------------------------------------------ clothes
def clothe(fig, top, bottom, legs=None, sleeve=None, sleeve_to=0.0, hands=None, neckline="round", trim=None):
    """The base clothes: the top over chest and waist, the bottom over the hips, the legs (trousers, hose or
    stockings) and sleeves down the arms to `sleeve_to` (0 = the wrist; 6 = short sleeves)."""
    skin = fig.look["skin"]
    sleeve = sleeve or top
    legs = legs or bottom
    for i, cube in enumerate(fig.torso):
        toon(cube, top if i < 2 else bottom)
    chest = fig.torso[0]
    with paint(chest.front) as p:
        cx = p.w / 2
        if neckline == "v":
            p.poly([(cx - 1.3, 0), (cx + 1.3, 0), (cx, 2.4)], skin)
            p.line([(cx - 1.3, 0), (cx, 2.4), (cx + 1.3, 0)], shade(top, 0.6))
        elif neckline == "round":
            p.ellipse(cx - 1.4, -0.8, cx + 1.4, 1.0, skin)
        elif neckline == "high":
            p.rect(cx - 1.5, 0, cx + 1.5, 0.75, shade(top, 1.18))
        if trim:
            p.rect(0, 0, p.w, 0.3, trim)
    for arm, cube in zip(fig.arm_l, fig.arms_c):
        for f in cube.faces:
            with paint(f) as p:
                if f is cube.top:
                    p.fill(shade(sleeve, 1.1))
                elif f is cube.bottom:
                    p.fill(hands or skin)
                else:
                    cut = arm.y1 - arm.y0 - 1.5 - sleeve_to
                    cel(p, sleeve, top=0.1, bottom=0.0)
                    p.rect(0, cut, p.w, p.h, skin)
                    p.rect(0, cut + 0.1, p.w, p.h, shade(skin, 0.96))
                    if hands:
                        p.rect(0, p.h - 1.5, p.w, p.h, hands)
                    if trim:
                        p.rect(0, cut - 0.5, p.w, cut, trim)
    for cube in fig.legs_c:
        toon(cube, legs, top=0.0, bottom=0.15)
    fig.chest = (top, "cloth", 0.08)


def bust(fig, color, kind="cloth", inflate=0.08):
    z = fig.front - 0.9
    b = fig.body.cube((-2.5, 19, z), (5, 3, 1), inflate=inflate)
    if kind == "metal":
        toon_metal(b, color)
    elif kind == "leather":
        toon_leather(b, color, stitch=False)
    else:
        toon(b, color, top=0.3, bottom=0.25)
    with paint(b.front) as p:
        p.line([(2.5, 0.6), (2.5, 3)], shade(color, 0.62))
    return b


def wrap(fig, y0, y1, color, kind="cloth", extra=0.3, chest=True, trim=None):
    """A layer over the torso between two heights: a vest, a corset, plate."""
    cubes = fig.wrap(y0, y1, extra)
    for c in cubes:
        {"metal": lambda c: toon_metal(c, color, trim), "leather": lambda c: toon_leather(c, color)}.get(kind, lambda c: toon(c, color))(c)
        hollow(c)
    if chest and y1 >= 21 and y0 <= 19:
        fig.chest = (color, kind, extra + 0.12)
    return cubes


def belt(fig, color, buckle=GOLD, sash=None, pouch=True):
    y = fig.segs[2][4] + (1 if fig.female else 0)  # the top of the hips
    b = fig.wrap(y, y + 1, 0.3)[0]
    toon(b, sash) if sash else toon_leather(b, color, stitch=False)
    hollow(b)
    bk = fig.body.cube((-1, y, fig.front - 0.6), (2, 1, 1), inflate=0.05)
    toon_metal(bk, buckle)
    if sash:
        for dx, rz in ((-1.5, 12), (-0.5, -6)):
            tail = fig.body.cube((dx - 0.5, y - 4, fig.front - 0.7), (1, 4, 1), rotation=(0, 0, rz), pivot=(dx, y, fig.front - 0.2))
            toon(tail, sash)
    if pouch:
        pc = fig.body.cube((2, y - 2, fig.front - 0.4), (2, 2, 1))
        toon_leather(pc, LEATHER)
    return b


def flared_skirt(fig, color, length=5, trim=None, flare=16, pleats=True, second=None, top=None):
    """A skirt that flares out from the hips: eight tilted panels (front, back, sides and corners)."""
    x0, w, z0, d, y0, y1, inf = fig.segs[2]
    top = y1 if top is None else top
    hw, hd = w / 2 + inf + 0.1, d / 2 + inf + 0.1
    panels = [
        ((-hw, top - length, -hd - 0.6), (int(w), length, 1), (-flare, 0, 0), (0, top, -hd)),
        ((-hw, top - length, hd - 0.4), (int(w), length, 1), (flare, 0, 0), (0, top, hd)),
        ((-hw - 0.6, top - length, -hd), (1, length, int(d) + 1), (0, 0, flare), (-hw, top, 0)),
        ((hw - 0.4, top - length, -hd), (1, length, int(d) + 1), (0, 0, -flare), (hw, top, 0)),
    ]
    out = []
    hang = fig.skirt_bone or fig.body
    for origin, size, rot, pivot in panels:
        c = hang.cube(origin, size, rotation=rot, pivot=pivot)
        toon(c, color, top=0.1, bottom=0.18)
        out.append(c)
    for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):  # the corners, turned 45 degrees
        cx, cz = sx * (hw - 0.4), sz * (hd - 0.2)
        c = hang.cube((cx - 1, top - length, cz - 0.5), (2, length, 1), rotation=(sz * flare * 0.7, sx * sz * -45, sx * -flare * 0.7), pivot=(cx, top, cz))
        toon(c, color, top=0.1, bottom=0.18)
        out.append(c)
    for c in out:
        for f in sides(c):
            with paint(f) as p:
                if pleats:
                    for k in range(1, int(p.w)):
                        p.line([(k, 0.5), (k, p.h - 0.3)], shade(color, 0.74))
                if trim:
                    p.rect(0, p.h - 0.6, p.w, p.h, trim)
                if second:
                    p.rect(0, p.h - 1.3, p.w, p.h - 0.9, second)
    return out


def robe(fig, color, trim=None, length=11, flare=7, second=None):
    """A long robe or gown: a long, gently flared skirt down to the ankles."""
    return flared_skirt(fig, color, length, trim, flare, pleats=False, second=second)


def sleeves(fig, color, length=5, trim=None, flare=0.5, wide=False):
    out = []
    for limb in fig.arm_l:
        y1 = limb.y1
        c = limb.cube(y1 - length, y1, flare)
        toon(c, color)
        hollow(c)
        out.append(c)
        if wide:  # a bell cuff at the wrist
            cuff = limb.cube(limb.y0 + 1, limb.y0 + 4, flare + 0.45)
            toon(cuff, color)
            hollow(cuff)
            if trim:
                for f in sides(cuff):
                    with paint(f) as p:
                        p.rect(0, p.h - 0.5, p.w, p.h, trim)
        if trim:
            for f in sides(c):
                with paint(f) as p:
                    p.rect(0, p.h - 0.45, p.w, p.h, trim)
    return out


def cuffs(fig, color, height=3, kind="leather", trim=None):
    out = []
    for limb in fig.arm_l:
        c = limb.cube(limb.y0, limb.y0 + height, 0.28)
        {"metal": lambda c: toon_metal(c, color, trim), "cloth": lambda c: toon(c, color)}.get(kind, lambda c: toon_leather(c, color))(c)
        if trim and kind != "metal":
            for f in sides(c):
                with paint(f) as p:
                    p.rect(0, 0, p.w, 0.4, trim)
        out.append(c)
    return out


def gloves(fig, color):
    for limb in fig.arm_l:
        c = limb.cube(limb.y0, limb.y0 + 2, 0.12)
        toon(c, color)


def boots(fig, color, height=5, cuff=None, kind="leather", heel=False):
    out = []
    for limb in fig.leg_l:
        c = limb.bone.cube((limb.x0, 0, limb.z0), (limb.w, height, limb.d), inflate=limb.inflate + 0.25)
        (toon_metal(c, color) if kind == "metal" else toon_leather(c, color, stitch=False))
        toe = limb.bone.cube((limb.x0, 0, limb.z0 - 0.75), (limb.w, 1, 1), inflate=limb.inflate + 0.25)
        (toon_metal(toe, color) if kind == "metal" else toon(toe, shade(color, 0.92)))
        if cuff:
            band_ = limb.bone.cube((limb.x0, height - 1, limb.z0), (limb.w, 1, limb.d), inflate=limb.inflate + 0.4)
            toon(band_, cuff)
            hollow(band_)
        if heel:
            h = limb.bone.cube((limb.x0 + limb.w / 2 - 0.5, 0, limb.z0 + limb.d - 1), (1, 1, 1), inflate=limb.inflate + 0.25)
            toon(h, shade(color, 0.8))
        out.append(c)
    return out


def stockings(fig, color, height=9, band_color=None):
    """Thigh-high stockings over bare legs."""
    for limb in fig.leg_l:
        c = limb.bone.cube((limb.x0, 0, limb.z0), (limb.w, height, limb.d), inflate=limb.inflate + 0.06)
        toon(c, color, top=0.0, bottom=0.1)
        hollow(c)
        if band_color:
            b = limb.bone.cube((limb.x0, height - 1, limb.z0), (limb.w, 1, limb.d), inflate=limb.inflate + 0.12)
            toon(b, band_color)
            hollow(b)


def trousers(fig, color, cuff=None):
    for limb in fig.leg_l:
        c = limb.cube(3, limb.y1, 0.18)
        toon(c, color, top=0.0, bottom=0.12)
        hollow(c)


def pauldrons(fig, color, trim=None, layers=2, spiked=False):
    out = []
    for limb in fig.arm_l:
        for i in range(layers):
            y = limb.y1 - 2 - i * 1.4
            c = limb.bone.cube((limb.x0 - 0.6, y, limb.z0 - 0.6), (int(limb.w + 1), 2, int(limb.d + 1)), inflate=0.15 + 0.1 * (layers - i),
                               rotation=(0, 0, (-12 if limb.x0 < 0 else 12) * (i + 1)), pivot=(limb.x0 + limb.w / 2, y + 2, 0))
            toon_metal(c, color if i == 0 else shade(color, 0.92), trim if i == 0 else None)
            out.append(c)
        if spiked:
            sp = limb.bone.cube((limb.x0 + limb.w / 2 - 0.5, limb.y1 + 0.4, -0.5), (1, 2, 1))
            toon(sp, BONE if spiked == "bone" else color)
    return out


def cape(fig, color, length=18, trim=None, lining=None, ragged=False, width=None, emblem=None):
    width = width or (8 if not fig.female else 7)
    c = fig.cape.cube((-width / 2, 24 - length, fig.back + 0.25), (width, length, 1), rotation=(10, 0, 0), pivot=(0, 24, fig.back))
    toon(c, color, top=0.08, bottom=0.2)
    with paint(c.back) as p:
        if trim:
            p.rect(0, p.h - 0.6, p.w, p.h, trim).rect(0, 0, 0.4, p.h, trim).rect(p.w - 0.4, 0, p.w, p.h, trim)
        if emblem:
            emblem(p)
        for k in range(1, int(p.w)):
            if k % 2 == 0:
                p.line([(k, 2), (k, p.h - 0.7)], shade(color, 0.85))
    with paint(c.front) as p:
        p.fill(shade(lining or color, 0.75)).outline(shade(lining or color, 0.5))
    if ragged:
        rnd = random.Random(fig.n)
        cuts = [rnd.randint(0, 9) for _ in range(c.front.w)]
        for f, flip in ((c.back, False), (c.front, True)):
            with paint(f) as p:
                for x in range(p.img.width):
                    for k in range(cuts[(p.img.width - 1 - x) if flip else x]):
                        p.px(x, p.img.height - 1 - k, (0, 0, 0, 0))
    mantle = fig.body.cube((-width / 2 - 0.5, 22, fig.front - 0.2), (width + 1, 2, int(fig.back - fig.front + 1)), inflate=0.25)
    toon(mantle, lining or color)
    with paint(mantle.front) as p:
        p.clear(1, 0, p.w - 1, p.h)
    hollow(mantle)
    return c


def tabard(fig, color, trim=GOLD, emblem=None, length=14):
    lift = 0.9 if fig.female else 0.0
    t = fig.body.cube((-2, 24 - length, fig.front - 0.8 - lift), (4, length, 1))
    toon(t, color, top=0.05, bottom=0.15)
    with paint(t.front) as p:
        p.rect(0, 0, 0.35, p.h, trim).rect(p.w - 0.35, 0, p.w, p.h, trim).rect(0, p.h - 0.4, p.w, p.h, trim)
        if emblem:
            emblem(p)
    return t


def bow_tie(fig, color, at=None):
    """A ribbon bow at the collar: two loops and a knot, with tails."""
    x, y, z = at or (0, 22.25, fig.front - 0.6)
    if fig.female:
        z -= 0.9
    for sx in (-1, 1):
        loop = fig.body.cube((x + (0.4 if sx > 0 else -2.4), y - 0.5, z - 0.5), (2, 2, 1), rotation=(0, 0, sx * -15), pivot=(x, y + 0.5, z))
        toon(loop, color)
    knot = fig.body.cube((x - 0.5, y - 0.25, z - 0.8), (1, 1, 1), inflate=0.1)
    toon(knot, shade(color, 0.85))
    for sx in (-1, 1):
        tail = fig.body.cube((x - 0.5, y - 3, z - 0.4), (1, 3, 1), rotation=(0, 0, sx * 18), pivot=(x, y, z))
        toon(tail, color)


def sailor_collar(fig, color, stripe="#f4f1ea"):
    c = fig.body.cube((-3.5 if not fig.female else -3, 20, fig.back - 0.2), (7 if not fig.female else 6, 4, 1), inflate=0.2)
    toon(c, color)
    with paint(c.back) as p:
        p.rect(0.3, p.h - 0.8, p.w - 0.3, p.h - 0.5, stripe).rect(0.3, 0.3, 0.6, p.h - 0.5, stripe).rect(p.w - 0.6, 0.3, p.w - 0.3, p.h - 0.5, stripe)


def collar(fig, color, fur=False, height=2):
    x0, w, z0, d, y0, y1, inf = fig.segs[0]
    c = fig.body.cube((x0 - 0.5, 24 - height + 0.5, z0 - 0.5), (int(w + 1), height, int(d + 1)), inflate=0.2)
    if fur:
        for f in c.faces:
            with paint(f) as p:
                p.fill(color)
                for x in range(0, p.img.width, 2):
                    p.line([(x / R, 0), (x / R, p.h)], shade(color, 0.85 if x % 4 else 1.15))
                p.outline(shade(color, 0.6))
    else:
        toon(c, color)
    with paint(c.top) as p:
        p.clear(1, 1, p.w - 1, p.h - 1)
    with paint(c.front) as p:
        p.clear(p.w / 2 - 1.5, 0, p.w / 2 + 1.5, 1)
    with paint(c.bottom) as p:
        p.clear()
    return c


def hood(fig, color, lining=None, peak=True, open_rows=(1.6, 9)):
    H = Figure.HEAD
    h = fig.head.cube((-H / 2, 24, -H / 2), (H, H, H), inflate=0.8)
    toon(h, color)
    lin = shade(lining or color, 0.45)
    with paint(h.front) as p:
        p.clear(1.2, open_rows[0], H - 1.2, open_rows[1])
        p.rect(0.7, open_rows[0] - 0.5, H - 0.7, open_rows[0], lin).rect(0.7, open_rows[0], 1.2, H, lin).rect(H - 1.2, open_rows[0], H - 0.7, H, lin)
    with paint(h.bottom) as p:
        p.clear()
    if peak:
        tip = fig.head.cube((-1, 24 + H - 3, H / 2 + 0.5), (2, 3, 2), rotation=(-35, 0, 0), pivot=(0, 24 + H - 1, H / 2 + 0.5))
        toon(tip, color)
    drape = fig.body.cube((-4.5, 19, fig.back + 0.2), (9, 5, 1))
    toon(drape, color)
    return h


def circlet(fig, color=GOLD, gem=None, y=None):
    H = Figure.HEAD
    y = 24 + H - 3.5 if y is None else y
    c = fig.head.cube((-H / 2, y, -H / 2), (H, 1, H), inflate=0.6)
    toon_metal(c, color)
    hollow(c)
    if gem:
        g = fig.head.cube((-0.5, y - 0.25, -H / 2 - 1.2), (1, 1, 1), inflate=0.1)
        toon(g, gem, light=1.5)


def veil(fig, color, band=None, length=12):
    H = Figure.HEAD
    v = fig.head.cube((-H / 2, 24, -H / 2), (H, H, H), inflate=0.6)
    toon(v, color)
    with paint(v.front) as p:
        p.clear(0.9, 2.0, H - 0.9, H)
        if band:
            p.rect(0, 1.25, H, 2.0, band)
    with paint(v.bottom) as p:
        p.clear()
    back = fig.head.cube((-H / 2 - 0.25, 24 + H - length, H / 2 - 0.3), (H, length, 1), inflate=0.3, rotation=(6, 0, 0), pivot=(0, 24 + H, H / 2))
    toon(back, color)
    if band:
        for f in (v.right, v.left, v.back):
            with paint(f) as p:
                p.rect(0, 1.25, p.w, 2.0, band)


def mask(fig, color, skull=False):
    H = Figure.HEAD
    if skull:
        mk = fig.head.cube((-H / 2, 24, -H / 2 - 0.7), (H, H, 1))
        toon(mk, BONE, top=0.0, bottom=0.12)
        glow = fig.look.get("glow", "#7df0c8")
        with paint(mk.front) as p:
            p.ellipse(1.3, 3.0, 3.9, 5.6, "#140c18").ellipse(5.1, 3.0, 7.7, 5.6, "#140c18")
            p.ellipse(2.1, 3.9, 3.0, 4.7, glow).ellipse(5.9, 3.9, 6.8, 4.7, glow)
            p.poly([(4.1, 6.0), (4.9, 6.0), (4.5, 6.9)], "#3a2f2a")
            for x in range(2, 7):
                p.rect(x + 0.1, 7.3, x + 0.85, 8.3, shade(BONE, 0.92)).line([(x, 7.3), (x, 8.3)], "#3a2f2a")
        return mk
    mk = fig.head.cube((-H / 2, 24, -H / 2 - 0.5), (H, 4, 1))
    toon(mk, color)
    with paint(mk.front) as p:
        for x in (2.5, 4.5, 6.5):
            p.line([(x, 1), (x - 0.4, 4)], shade(color, 0.75))
    return mk


# ------------------------------------------------------------------------------------------ headgear
def helm(fig, metal, trim=GOLD, plume=None, visor=True, wings=None, horns=None, open_face=False):
    H = Figure.HEAD
    h = fig.head.cube((-H / 2, 24, -H / 2), (H, H, H), inflate=0.7)
    toon_metal(h, metal)
    with paint(h.front) as p:
        if open_face:
            p.clear(1.2, 3.0, H - 1.2, H)
            p.rect(1.2, 2.4, H - 1.2, 3.0, trim)
        elif visor:
            p.rect(1, 3.6, H - 1, 4.6, "#0c0a10").rect(1, 3.3, H - 1, 3.6, trim)
            for x in range(2, 8):
                p.rivet(x, 6.2)
    with paint(h.bottom) as p:
        p.clear()
    if plume:
        pl = fig.head.cube((-0.5, 24 + H + 0.5, -H / 2 + 0.5), (1, 3, 8), rotation=(-8, 0, 0), pivot=(0, 24 + H, 0))
        toon(pl, plume)
    if wings:
        for sx in (-1, 1):
            for k in range(3):
                w = fig.head.cube((sx * (H / 2 + 0.8) - 0.5, 28 + k, -1 + k * 0.6), (1, 2, 4 - k), rotation=(-20 - k * 12, sx * 18, 0), pivot=(sx * (H / 2 + 0.8), 28 + k, 0))
                toon(w, wings)
    if horns:
        for sx in (-1, 1):
            for k in range(2):
                hn = fig.head.cube((sx * (H / 2 + 0.9) - 0.5, 29 + k * 2, -0.5), (1, 2, 1), rotation=(0, 0, sx * -(25 + k * 25)), pivot=(sx * (H / 2 + 0.6), 29 + k * 2, 0))
                toon(hn, horns)


def wizard_hat(fig, color, band=GOLD, wide=7, bent=True):
    H = Figure.HEAD
    y = 24 + H - 0.5
    brim = fig.head.cube((-wide, y, -wide), (wide * 2, 1, wide * 2))
    toon(brim, color)
    with paint(brim.top) as p:
        p.clear()
        p.ellipse(0, 0, p.w, p.h, shade(color, 1.1))
        p.ellipse(0.4, 0.4, p.w - 0.4, p.h - 0.4, color)
    with paint(brim.bottom) as p:
        p.clear()
        p.ellipse(0, 0, p.w, p.h, shade(color, 0.6))
    point = np.array([0.0, y + 1, 0.0])
    for i, size in enumerate((8, 6, 4, 2)):
        rot = (-14 * i if bent else 0, 0, 0)
        c = fig.head.cube((point[0] - size / 2, point[1], point[2] - size / 2), (size, 3, size), rotation=rot, pivot=tuple(point))
        toon(c, color)
        if i == 0:
            for f in sides(c):
                with paint(f) as p:
                    p.rect(0, p.h - 1, p.w, p.h, band)
        point = point + _rot(*rot) @ np.array([0, 2.6, 0])
    buckle = fig.head.cube((-1, y + 1, -4.5), (2, 1, 1))
    toon_metal(buckle, GOLD)


def cap(fig, color, feather=None):
    H = Figure.HEAD
    c = fig.head.cube((-H / 2, 24 + H - 2.5, -H / 2), (H, 3, H), inflate=0.65)
    toon(c, color)
    with paint(c.bottom) as p:
        p.clear()
    b = fig.head.cube((-H / 2 - 1, 24 + H - 2.2, -H / 2 - 1.5), (H + 2, 1, H + 2), rotation=(-6, 0, 8), pivot=(0, 24 + H, 0))
    toon(b, shade(color, 0.88))
    if feather:
        f = fig.head.cube((3, 24 + H, -1), (1, 7, 3), rotation=(-35, 0, 20), pivot=(3.5, 24 + H, 0.5))
        toon(f, feather)
        with paint(f.right) as p:
            p.line([(p.w / 2, 0), (p.w / 2, p.h)], shade(feather, 0.7))


def headband(fig, color, tails=True):
    H = Figure.HEAD
    y = 24 + H - 2.25
    b = fig.head.cube((-H / 2, y, -H / 2), (H, 1, H), inflate=0.55)
    toon(b, color)
    hollow(b)
    if tails:
        for x, rz in ((-1, 14), (1, -14)):
            t = fig.head.cube((x - 0.5, y - 5, H / 2 + 0.5), (1, 5, 1), rotation=(-25, 0, rz), pivot=(x, y + 0.5, H / 2 + 0.5))
            toon(t, color)


def crown(fig, color, points=5, gem=None, bone=False):
    H = Figure.HEAD
    y = 24 + H - 1
    c = fig.head.cube((-H / 2, y, -H / 2), (H, 2, H), inflate=0.45)
    (toon(c, color) if bone else toon_metal(c, color))
    hollow(c)
    for i in range(points):
        x = -H / 2 + 0.5 + i * ((H - 1) / max(1, points - 1))
        sp = fig.head.cube((x - 0.5, y + 2, -H / 2 - 0.45), (1, 2 if i % 2 == 0 else 1, 1))
        (toon(sp, color) if bone else toon_metal(sp, color))
    if gem:
        g = fig.head.cube((-0.5, y + 0.5, -H / 2 - 0.7), (1, 1, 1))
        toon(g, gem, light=1.5)


def ribbon(fig, color, at=(2.5, 32.5, -2)):
    """A hair ribbon: two loops and a knot."""
    x, y, z = at
    for sx in (-1, 1):
        loop = fig.head.cube((x + (0.3 if sx > 0 else -2.3), y - 0.75, z - 0.5), (2, 2, 1), rotation=(0, 0, sx * -20), pivot=(x, y, z))
        toon(loop, color)
    knot = fig.head.cube((x - 0.5, y - 0.5, z - 0.6), (1, 1, 1), inflate=0.1)
    toon(knot, shade(color, 0.85))


# ------------------------------------------------------------------------------------------ arms and gear
class Hand:
    """Places gear relative to where a hand holds it (the old party's numbers assumed a hand at y 12.5, z -2)."""

    def __init__(self, fig, bone, x):
        self.fig, self.bone, self.x = fig, bone, x
        self.dy = fig.hy - 12.5
        self.dz = fig.hz + 2

    def cube(self, origin, size, rotation=None, pivot=None, inflate=0.0):
        x, y, z = origin
        if pivot:
            pivot = (pivot[0], pivot[1] + self.dy, pivot[2] + self.dz)
        return self.bone.cube((x, y + self.dy, z + self.dz), size, inflate, rotation, pivot)


def blade(c, steel=SILVER, glow=None):
    for f in c.faces:
        with paint(f) as p:
            p.vgrad(mix(steel, "#ffffff", 0.35), shade(steel, 0.8))
            if f in sides(c):
                p.rect(0, 0, p.w, 0.35, "#ffffff")
                p.rect(0, p.h / 2 - 0.12, p.w, p.h / 2 + 0.12, glow or shade(steel, 0.7))
            p.outline(shade(steel, 0.45))
    return c


def grip(c, color=LEATHER_D, wrap=LEATHER_L):
    for f in c.faces:
        with paint(f) as p:
            p.fill(color)
            for k in range(0, p.img.width + p.img.height, 3):
                p.line([(k / R, 0), (k / R - p.h, p.h)], wrap)
    return c


def sword(fig, length=14, steel=SILVER, guard=GOLD, wide=1, glow=None):
    h = Hand(fig, fig.weapon, fig.hx - 0.5)
    x = h.x
    grip(h.cube((x, 12.5, -6), (1, 1, 4)))
    toon_metal(h.cube((x - 0.25, 12.25, -2.6), (1, 1, 1), inflate=0.25), guard)
    toon_metal(h.cube((x - 2, 11.75, -7), (5, 2, 1)), guard)
    blade(h.cube((x - (wide - 1) / 2, 12, -7 - length), (wide, 2, length)), steel, glow)
    blade(h.cube((x - (wide - 1) / 2, 12.5, -8 - length), (wide, 1, 1)), steel)


def katana(fig, length=15):
    h = Hand(fig, fig.weapon, fig.hx - 0.5)
    x = h.x
    grip(h.cube((x, 12.5, -7), (1, 1, 5)), "#1a1418", "#c9302c")
    toon_metal(h.cube((x - 1, 11.5, -8), (3, 3, 1)), GOLD_D)
    blade(h.cube((x, 12.25, -8 - length), (1, 1, length), rotation=(-4, 0, 0), pivot=(x + 0.5, 12.5, -8)), "#dfe5ec")


def staff(fig, head="orb", shaft=WOOD, orb="#c05bff", trim=GOLD, height=31):
    h = Hand(fig, fig.weapon, fig.hx - 0.5)
    x = h.x
    s = h.cube((x, 0, -3.5), (1, height, 1))
    toon(s, shaft, top=0.0, bottom=0.0)
    for f in sides(s):
        with paint(f) as p:
            for y in range(3, height, 7):
                p.rect(0, height - y - 0.5, p.w, height - y, trim)
    top = height
    if head == "orb":
        for dx, dz in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            toon_metal(h.cube((x + dx, top, -3.5 + dz), (1, 2, 1)), trim)
        o = h.cube((x - 0.5, top + 0.75, -4), (2, 2, 2))
        for f in o.faces:
            with paint(f) as p:
                p.fill(orb).ellipse(0.25, 0.25, 1.75, 1.75, mix(orb, "#ffffff", 0.35)).rect(0.4, 0.4, 0.8, 0.8, "#ffffff")
    elif head == "crystal":
        c = h.cube((x - 0.5, top, -4), (2, 4, 2), rotation=(0, 45, 0), pivot=(x + 0.5, top, -3))
        for f in c.faces:
            with paint(f) as p:
                p.vgrad(mix(orb, "#ffffff", 0.5), shade(orb, 0.7)).line([(0.5, 0), (0.5, 4)], "#ffffff")
        for k, dz in enumerate((-5.25, -0.75)):
            toon_metal(h.cube((x, top - 1, dz), (1, 3, 1), rotation=(25 if k else -25, 0, 0), pivot=(x + 0.5, top - 1, -3)), trim)
    elif head == "holy":
        for dy, dz, w, hh in ((0, -5.5, 5, 1), (4, -5.5, 5, 1), (1, -5.5, 1, 3), (1, -1.5, 1, 3)):
            toon_metal(h.cube((x, top + dy, dz), (1, hh, w)), trim)
        toon(h.cube((x - 0.25, top + 1.25, -4), (1, 2, 2), inflate=0.25), orb, light=1.4)
    elif head == "skull":
        sk = h.cube((x - 1, top, -4.5), (3, 3, 3))
        toon(sk, BONE)
        with paint(sk.front) as p:
            p.rect(0.25, 1, 1.25, 1.75, "#1a1020").rect(1.75, 1, 2.75, 1.75, "#1a1020")
            p.rect(0.5, 1.25, 0.9, 1.6, orb).rect(2.0, 1.25, 2.4, 1.6, orb)
        for k, dx in enumerate((-1.5, 2.5)):
            toon(h.cube((x + dx - 0.5, top + 1, -3.5), (1, 3, 1), rotation=(0, 0, 25 if k == 0 else -25), pivot=(x + dx, top + 1, -3)), BONE_D)
    elif head == "bone":
        for i, dz in enumerate((-4.5, -2.5)):
            toon(h.cube((x, top - i, dz), (1, 4 + i, 1), rotation=(-20 + i * 40, 0, 0), pivot=(x + 0.5, top, -3)), BONE)
        toon(h.cube((x - 0.25, top + 1, -4), (1, 1, 1), inflate=0.35), orb, light=1.4)
    elif head == "crook":
        for dy, dz, hh, w in ((0, -3.5, 3, 1), (2, -5.5, 1, 2), (0, -6.5, 2, 1)):
            toon(h.cube((x, top + dy, dz), (1, hh, w)), shaft)
        toon_metal(h.cube((x - 0.25, top - 1, -3.75), (1, 1, 1), inflate=0.3), trim)
    return h


def scythe(fig, steel=SILVER, shaft="#2a2230", trim="#8a2be2"):
    h = staff(fig, "none", shaft, trim=trim, height=32)
    x = h.x
    for i, (dy, dz, ln) in enumerate(((31, -9.5, 6), (30, -12.5, 3), (29, -14.0, 2))):
        blade(h.cube((x, dy, dz), (1, 1 if i else 2, ln)), steel)
    toon_metal(h.cube((x - 0.25, 30.5, -4), (1, 2, 1), inflate=0.25), trim)


def spear(fig, tip=SILVER, shaft=WOOD, trim=GOLD):
    h = staff(fig, "none", shaft, trim=trim, height=30)
    x = h.x
    blade(h.cube((x, 30, -4), (1, 5, 2)), tip)
    blade(h.cube((x, 35, -3.5), (1, 1, 1)), tip)
    toon_metal(h.cube((x - 0.25, 29, -3.75), (1, 1, 1), inflate=0.3), trim)


def axe(fig, steel=SILVER, shaft=WOOD, double=False):
    h = Hand(fig, fig.weapon, fig.hx - 0.5)
    x = h.x
    toon(h.cube((x, 12.5, -16), (1, 1, 13)), shaft)
    blade(h.cube((x, 10.5, -16), (1, 5, 3)), steel)
    if double:
        blade(h.cube((x, 13.5, -16), (1, 4, 3)), steel)


def mace(fig, steel=SILVER, trim=GOLD):
    h = Hand(fig, fig.weapon, fig.hx - 0.5)
    x = h.x
    grip(h.cube((x, 12.5, -12), (1, 1, 9)))
    toon_metal(h.cube((x - 1, 11.5, -15), (3, 3, 3)), steel, trim, rivets=True)
    for dx, dy in ((-1.75, 0), (1.75, 0), (0, 1.75), (0, -1.75)):
        toon_metal(h.cube((x + dx, 12.5 + dy, -14), (1, 1, 1)), shade(steel, 1.1))


def dagger(fig, bone, x, steel=SILVER, handle="#2a2230", length=6):
    h = Hand(fig, bone, x)
    grip(h.cube((x, 12.5, -5), (1, 1, 3)), handle)
    toon_metal(h.cube((x - 1, 12, -6), (3, 2, 1)), shade(steel, 0.6))
    blade(h.cube((x, 12, -6 - length), (1, 2, length)), steel)


def curved_blade(fig, bone, x, steel=SILVER, length=9, trim=GOLD):
    h = Hand(fig, bone, x)
    grip(h.cube((x, 12.5, -5), (1, 1, 3)), "#5a1a1a")
    toon_metal(h.cube((x - 1, 12, -6), (3, 2, 1)), trim)
    blade(h.cube((x, 12, -6 - length), (1, 2, length), rotation=(10, 0, 0), pivot=(x + 0.5, 13, -6)), steel)


def bow(fig, wood="#6b4423", trim=GOLD, string="#f4f1ea"):
    h = Hand(fig, fig.weapon, fig.hx - 0.5)
    x = h.x
    grip(h.cube((x, 10, -4.5), (1, 6, 1)), LEATHER_D)
    for y0, rx in ((4, 18), (16, -18)):
        toon(h.cube((x, y0, -4.5), (1, 7, 1), rotation=(rx, 0, 0), pivot=(x + 0.5, 13, -4)), wood)
    for y0 in (2.5, 22.5):
        toon_metal(h.cube((x, y0, -3.25), (1, 1, 1)), trim)
    toon(h.cube((x, 3, -2.25), (1, 20, 1), inflate=-0.42), string, outline=False)


def shield(fig, kind="kite", face="#2f4f8f", rim=GOLD, emblem=None):
    la = fig.arm_l[1]
    h = Hand(fig, fig.offhand, la.x0 + la.w + 0.25)
    x = h.x
    if kind == "round":
        s = h.cube((x, 7, -6), (1, 10, 10))
        for f in s.faces:
            with paint(f) as p:
                p.fill(face)
                if f in (s.right, s.left):
                    p.clear()
                    p.ellipse(0, 0, 10, 10, rim).ellipse(0.6, 0.6, 9.4, 9.4, face)
                    for k in range(1, 10, 2):
                        p.line([(k + 0.5, 1), (k + 0.5, 9)], shade(face, 0.85))
                    p.ellipse(3.75, 3.75, 6.25, 6.25, rim).ellipse(4.3, 4.3, 5.7, 5.7, mix(rim, "#ffffff", 0.3))
        return s
    w, hh = (7, 10)
    s = h.cube((x, 6, -2 - w + 2.5), (1, hh, w))
    for f in s.faces:
        with paint(f) as p:
            p.vgrad(shade(face, 1.15), shade(face, 0.82))
            if f in (s.right, s.left):
                p.rect(0, 0, p.w, 0.5, rim).rect(0, 0, 0.5, p.h, rim).rect(p.w - 0.5, 0, p.w, p.h, rim)
                p.poly([(0, p.h - 3), (p.w / 2, p.h), (p.w, p.h - 3), (p.w, p.h), (0, p.h)], (0, 0, 0, 0))
                p.line([(0.25, p.h - 3), (p.w / 2, p.h - 0.4), (p.w - 0.25, p.h - 3)], rim, 2)
                if emblem:
                    emblem(p)
            p.outline(shade(face, 0.5))
    return s


def book(fig, cover="#5a2a1a", trim=GOLD, side=1):
    x0, w, z0, d, y0, y1, inf = fig.segs[2]
    b = fig.body.cube((side * (w / 2 + inf) + (0 if side > 0 else -2), y0 - 1, -1.5), (2, 4, 3))
    toon_leather(b, cover, stitch=False)
    with paint(b.right if side < 0 else b.left) as p:
        p.rect(0, 0, p.w, 0.35, trim).rect(0, p.h - 0.35, p.w, p.h, trim).ellipse(1, 1.25, 2, 2.5, trim)
    return b


def quiver(fig, color=LEATHER, fletch=("#e9e6dc", "#c9302c", "#e9e6dc")):
    z = fig.back + 0.4
    q = fig.body.cube((-2.5, 13, z), (3, 10, 3), rotation=(0, 0, -20), pivot=(-1, 18, z))
    toon_leather(q, color)
    for i, x in enumerate((-2.5, -1.5, -0.5)):
        f = fig.body.cube((x - 1, 23, z + 0.6), (1, 3, 1), rotation=(0, 0, -20), pivot=(-1, 18, z))
        toon(f, fletch[i % len(fletch)])
    strap = fig.body.cube((-4, 17, fig.front - 0.5), (8, 1, 1), rotation=(0, 0, 38), pivot=(0, 19, fig.front))
    toon_leather(strap, LEATHER_D, stitch=False)


def lute(fig, wood="#8a5a2a", on_back=False):
    if on_back:
        z = fig.back + 0.3
        body = fig.body.cube((-3.5, 13, z), (4, 5, 2), rotation=(0, 0, 30), pivot=(0, 18, z))
        neck = fig.body.cube((-2, 18, z + 0.5), (1, 8, 1), rotation=(0, 0, 30), pivot=(0, 18, z))
    else:
        h = Hand(fig, fig.weapon, fig.hx - 0.5)
        x = h.x
        body = h.cube((x - 1.5, 9, -8), (4, 5, 4))
        neck = h.cube((x, 12, -16), (1, 1, 8))
        toon(h.cube((x - 0.5, 11.5, -17.5), (2, 2, 2)), WOOD_D)
    toon(body, wood)
    for f in sides(body):
        with paint(f) as p:
            p.ellipse(p.w / 2 - 0.6, p.h / 2 - 0.6, p.w / 2 + 0.6, p.h / 2 + 0.6, "#2a1a10")
    toon(neck, WOOD_D)


def wraps(fig, color="#e9e3cf"):
    for limb in fig.arm_l:
        w = limb.cube(limb.y0, limb.y0 + 4, 0.15)
        for f in w.faces:
            with paint(f) as p:
                p.fill(color)
                for k in range(0, 16, 3):
                    p.line([(0, k * 0.25), (p.w, k * 0.25 + 0.6)], shade(color, 0.78))
                p.outline(shade(color, 0.6))
        knuckle = limb.bone.cube((limb.x0, limb.y0, limb.z0 - 0.5), (limb.w, 2, 1))
        toon_metal(knuckle, SILVER)


def beads(fig, color="#7a3020", bead=GOLD):
    x0, w, z0, d, y0, y1, inf = fig.segs[0]
    b = fig.body.cube((x0 + 0.5, 17, fig.front - 0.6 - (0.9 if fig.female else 0)), (int(w - 1), 6, 1))
    with paint(b.front) as p:
        p.clear()
        n = 12
        for k in range(n):
            t = k / (n - 1)
            xx = 0.4 + (p.w - 0.8) * t
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
            a = k * math.pi / 4
            p.line([(cx, cy), (cx + math.cos(a) * 1.5, cy + math.sin(a) * 1.5)], color)
        p.ellipse(cx - 0.7, cy - 0.7, cx + 0.7, cy + 0.7, color)
    return draw


def emblem_skull(color):
    def draw(p):
        cx, cy = p.w / 2, p.h * 0.35
        p.ellipse(cx - 1.2, cy - 1.2, cx + 1.2, cy + 1.0, color)
        p.rect(cx - 0.7, cy + 0.6, cx + 0.7, cy + 1.6, color)
        p.rect(cx - 0.8, cy - 0.4, cx - 0.2, cy + 0.2, "#100c14").rect(cx + 0.2, cy - 0.4, cx + 0.8, cy + 0.2, "#100c14")
    return draw


# ------------------------------------------------------------------------------------------ the vocations
def plate(fig, metal, trim=GOLD, low=None):
    """A breastplate over chest and waist, ridged down the middle."""
    low = fig.segs[1][4] if low is None else low
    cubes = wrap(fig, low, 24, metal, "metal", 0.42, trim=None)
    with paint(cubes[0].front) as p:
        p.line([(p.w / 2, 0.8), (p.w / 2, p.h)], mix(metal, "#ffffff", 0.5))
        p.rect(0, 0, p.w, 0.45, trim).rect(p.w / 2 - 1.3, 0, p.w / 2 + 1.3, 0.9, shade(metal, 0.55))
    return cubes


def faulds(fig, metal, trim=GOLD):
    return flared_skirt(fig, metal, 4, trim, 10, pleats=True)


def fighter(fig, L):
    cut, metal, cloth, trim = L["cut"], L.get("metal", SILVER), L["main"], L.get("trim", GOLD)
    if cut == "knight":
        clothe(fig, cloth, shade(cloth, 0.6), "#2a2a33", neckline="high")
        plate(fig, metal, trim)
        faulds(fig, metal, trim)
        pauldrons(fig, metal, trim)
        cuffs(fig, metal, 4, "metal", trim)
        boots(fig, metal, 6, kind="metal")
        tabard(fig, cloth, trim, emblem_cross(trim), 13)
        cape(fig, cloth, 19, trim, lining=shade(cloth, 0.5), emblem=emblem_cross(trim))
        hair_style(fig)
        helm(fig, metal, trim, plume=L.get("plume", "#c9302c"))
        sword(fig, guard=trim)
        shield(fig, "kite", cloth, trim, emblem_cross(trim))
    elif cut == "swordsman":
        clothe(fig, "#2a2a33", "#2a2a33", "#2a2420", sleeve=cloth, neckline="v")
        coat = wrap(fig, 12, 24, cloth, "cloth", 0.3)
        with paint(coat[0].front) as p:
            p.clear(p.w / 2 - 1, 0, p.w / 2 + 1, p.h)
        flared_skirt(fig, cloth, 7, trim, 8, pleats=False)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, LEATHER, 3)
        boots(fig, LEATHER_D, 5, cuff=LEATHER_L)
        pauldrons(fig, metal, trim, layers=1)
        hair_style(fig)
        sword(fig, 18, wide=2, guard=trim)
    elif cut == "valkyrie":
        clothe(fig, cloth, shade(cloth, 0.75), "#f4f1ea", neckline="high")
        plate(fig, metal, trim)
        flared_skirt(fig, cloth, 5, trim, 18, second="#f4f1ea")
        pauldrons(fig, metal, trim)
        cuffs(fig, metal, 4, "metal", trim)
        boots(fig, metal, 7, kind="metal")
        hair_style(fig)
        helm(fig, metal, trim, wings="#f4f1ea", open_face=True)
        feather_wings(fig, "#f6f4f0", "#c8d8f0", 1.15)
        spear(fig, trim=trim)
        shield(fig, "round", cloth, trim)
    else:  # shieldmaiden
        clothe(fig, cloth, shade(LEATHER, 0.9), "#3a2a22", neckline="round")
        wrap(fig, 12, 24, LEATHER, "leather", 0.3)
        flared_skirt(fig, shade(cloth, 0.85), 5, trim, 14)
        collar(fig, "#c2ad80", fur=True)
        cuffs(fig, LEATHER_D, 4)
        boots(fig, LEATHER_D, 6, cuff="#c2ad80")
        cape(fig, shade(cloth, 0.7), 14, ragged=True)
        hair_style(fig)
        axe(fig)
        shield(fig, "round", L.get("shield", "#7a2a22"), metal)


def archer(fig, L):
    cut, cloth, second, trim = L["cut"], L["main"], L.get("second", LEATHER), L.get("trim", GOLD)
    if cut == "ranger":
        clothe(fig, cloth, "#4a3a2a", neckline="v")
        wrap(fig, 14, 24, second, "leather", 0.3)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, LEATHER, 4)
        boots(fig, LEATHER_D, 6, cuff=LEATHER_L)
        cape(fig, shade(cloth, 0.8), 17, ragged=True)
        hair_style(fig)
        hood(fig, shade(cloth, 0.8))
        quiver(fig)
        bow(fig)
    elif cut == "hunter":
        clothe(fig, second, "#3a2a1e", neckline="round")
        coat = wrap(fig, 12, 24, shade(second, 0.8), "leather", 0.3)
        with paint(coat[0].front) as p:
            p.clear(p.w / 2 - 0.75, 0, p.w / 2 + 0.75, p.h)
        collar(fig, "#a89068", fur=True)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, LEATHER_D, 4)
        boots(fig, LEATHER_D, 6, cuff="#a89068")
        cape(fig, "#6a5a44", 13, ragged=True)
        hair_style(fig)
        quiver(fig)
        bow(fig, wood="#4e321c")
    elif cut == "huntress":
        clothe(fig, cloth, cloth, fig.look["skin"], neckline="v", sleeve_to=5)
        wrap(fig, 15, 24, second, "leather", 0.3)
        flared_skirt(fig, shade(cloth, 0.85), 4, trim, 18)
        stockings(fig, "#3a3022", 9, trim)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, LEATHER, 4)
        boots(fig, LEATHER_D, 6, cuff=LEATHER_L)
        hair_style(fig)
        quiver(fig)
        bow(fig)
    else:  # windrunner
        clothe(fig, cloth, cloth, shade(cloth, 0.7), neckline="v", trim=trim)
        flared_skirt(fig, shade(cloth, 0.9), 6, trim, 16)
        belt(fig, "#e9e6dc", trim, pouch=False)
        cuffs(fig, "#e9e6dc", 4, trim=trim)
        boots(fig, "#e3ddcc", 8, cuff=trim)
        cape(fig, second, 18, trim, lining=cloth)
        elf_ears(fig)
        hair_style(fig)
        circlet(fig, trim, gem=L.get("gem", "#59d0ff"))
        quiver(fig, "#e9e6dc", ("#59d0ff", "#f4f1ea", "#59d0ff"))
        bow(fig, wood="#e9e6dc", trim=trim)


def mage(fig, L):
    cut, cloth, second, trim, orb = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", GOLD), L.get("orb", "#c05bff")
    if cut == "sorcerer":
        clothe(fig, cloth, cloth, shade(cloth, 0.6), neckline="high", trim=trim)
        robe(fig, cloth, trim)
        sleeves(fig, second, 6, trim, wide=True)
        tabard(fig, shade(cloth, 0.6), trim, emblem_sun(orb), 20)
        belt(fig, LEATHER_D, trim, pouch=False)
        hair_style(fig)
        hood(fig, shade(cloth, 0.7), peak=False)
        circlet(fig, trim, gem=orb)
        staff(fig, "crystal", orb=orb, trim=trim)
        book(fig)
    elif cut == "wizard":
        clothe(fig, cloth, cloth, shade(cloth, 0.6), neckline="v", trim=trim)
        robe(fig, cloth, trim, second=trim)
        sleeves(fig, cloth, 6, trim, wide=True)
        belt(fig, LEATHER_D, trim, sash=second, pouch=False)
        hair_style(fig)
        H = Figure.HEAD
        lock(fig, (0, 25, -H / 2 - 0.9), 5, 7, 1, (6, 0, 0), "point", ring=False)  # the long beard
        wizard_hat(fig, cloth, trim)
        staff(fig, "orb", orb=orb, trim=trim)
    elif cut == "witch":
        clothe(fig, cloth, cloth, "#1a1420", sleeve=cloth, neckline="v")
        corset = wrap(fig, 13, 18, second, "leather", 0.3, chest=False)
        with paint(corset[-1].front) as p:
            for y in range(1, 5):
                p.line([(p.w / 2 - 0.75, y - 0.6), (p.w / 2 + 0.75, y)], trim).line([(p.w / 2 + 0.75, y - 0.6), (p.w / 2 - 0.75, y)], trim)
        flared_skirt(fig, cloth, 9, trim, 14, second=second)
        stockings(fig, "#1a1420", 10, "#5a2a6a")
        sleeves(fig, cloth, 5, trim, wide=True)
        boots(fig, "#1a1420", 3, heel=True)
        bow_tie(fig, trim)
        hair_style(fig)
        wizard_hat(fig, shade(cloth, 0.85), trim, wide=8)
        staff(fig, "orb", shaft="#2a1f2a", orb=orb, trim=trim)
    else:  # enchantress
        clothe(fig, cloth, cloth, shade(cloth, 0.7), neckline="v", trim=trim)
        robe(fig, cloth, trim, second=second)
        sleeves(fig, second, 5, trim, wide=True)
        belt(fig, trim, GOLD_L, sash=trim, pouch=False)
        cape(fig, second, 19, trim, lining=cloth)
        elf_ears(fig)
        hair_style(fig)
        circlet(fig, trim, gem=orb)
        staff(fig, "crystal", shaft="#e9e6dc", orb=orb, trim=trim)


def healer(fig, L):
    cut, cloth, second, trim, orb = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", GOLD), L.get("orb", "#f6d968")
    if cut == "priest":
        clothe(fig, cloth, cloth, shade(cloth, 0.8), neckline="high", trim=trim)
        robe(fig, cloth, trim, second=second)
        sleeves(fig, cloth, 6, trim, wide=True)
        tabard(fig, second, trim, emblem_sun(trim), 20)
        hair_style(fig)
        H = Figure.HEAD
        mitre = fig.head.cube((-3, 24 + H - 0.5, -3), (6, 5, 6))
        toon(mitre, cloth)
        with paint(mitre.front) as p:
            p.rect(2.5, 0, 3.5, 5, trim).rect(1, 2, 5, 2.75, trim)
        staff(fig, "holy", orb=orb, trim=trim, shaft="#f4f1ea")
    elif cut == "acolyte":
        clothe(fig, cloth, cloth, shade(cloth, 0.8), neckline="round", trim=trim)
        robe(fig, cloth, trim, length=9)
        sleeves(fig, cloth, 4, trim)
        belt(fig, "#c9b98a", trim, pouch=False)
        hair_style(fig)
        staff(fig, "crook", trim=trim)
        book(fig, "#f4f1ea", trim)
    elif cut == "priestess":
        clothe(fig, cloth, cloth, shade(cloth, 0.85), neckline="v", trim=trim)
        robe(fig, cloth, trim, second=second)
        sleeves(fig, second, 5, trim, wide=True)
        tabard(fig, second, trim, emblem_sun(trim), 18)
        bow_tie(fig, trim)
        hair_style(fig)
        veil(fig, "#fbfaf6", band=trim)
        halo(fig)
        staff(fig, "holy", orb=orb, trim=trim, shaft="#f4f1ea")
    else:  # battle sister
        clothe(fig, cloth, cloth, "#1a1820", neckline="high")
        plate(fig, SILVER, trim)
        flared_skirt(fig, cloth, 7, trim, 12)
        tabard(fig, "#f4f1ea", trim, emblem_cross("#b3141c"), 15)
        pauldrons(fig, SILVER, trim, layers=1)
        cuffs(fig, SILVER, 3, "metal")
        boots(fig, SILVER, 6, kind="metal")
        hair_style(fig)
        veil(fig, cloth, band="#f4f1ea", length=11)
        mace(fig, trim=trim)
        book(fig, "#5a1a1a", trim, side=-1)


def rogue(fig, L):
    cut, cloth, second, trim = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", SILVER_D)
    if cut == "assassin":
        clothe(fig, cloth, cloth, shade(cloth, 0.85), neckline="high")
        wrap(fig, 13, 24, second, "leather", 0.3)
        for rz in (35, -35):
            strap = fig.body.cube((-4.5, 17.5, fig.front - 0.7), (9, 1, 1), rotation=(0, 0, rz), pivot=(0, 18, fig.front))
            toon_leather(strap, LEATHER_D, stitch=False)
        belt(fig, LEATHER_D, SILVER)
        cuffs(fig, second, 4)
        boots(fig, shade(cloth, 0.8), 6)
        cape(fig, shade(cloth, 0.9), 12, ragged=True)
        hair_style(fig)
        hood(fig, shade(cloth, 0.95), open_rows=(2.2, 9))
        mask(fig, shade(cloth, 0.8))
        dagger(fig, fig.weapon, fig.hx - 0.5)
        dagger(fig, fig.offhand, fig.ox - 0.5)
    elif cut == "thief":
        clothe(fig, cloth, cloth, "#3a3228", neckline="v")
        coat = wrap(fig, 13, 24, LEATHER, "leather", 0.3)
        with paint(coat[0].front) as p:
            p.clear(p.w / 2 - 1, 0, p.w / 2 + 1, p.h)
        belt(fig, LEATHER_D, GOLD_D)
        cuffs(fig, LEATHER_D, 3)
        boots(fig, LEATHER_D, 5, cuff=LEATHER)
        cape(fig, second, 11, ragged=True)
        hair_style(fig)
        headband(fig, L.get("band", "#a8322e"))
        dagger(fig, fig.weapon, fig.hx - 0.5, length=7)
    elif cut == "shadow_dancer":
        clothe(fig, cloth, cloth, shade(cloth, 0.8), neckline="v", sleeve_to=6)
        wrap(fig, 15, 24, second, "leather", 0.3)
        belt(fig, LEATHER_D, trim, sash=L.get("sash", "#8a2be2"), pouch=False)
        flared_skirt(fig, second, 4, trim, 20)
        stockings(fig, "#18141e", 11, trim)
        gloves(fig, second)
        cuffs(fig, second, 4, trim=trim)
        boots(fig, shade(second, 0.8), 9, heel=True)
        hair_style(fig)
        mask(fig, shade(cloth, 0.7))
        curved_blade(fig, fig.weapon, fig.hx - 0.5, length=7, trim=trim)
        curved_blade(fig, fig.offhand, fig.ox - 0.5, length=7, trim=trim)
    else:  # nightblade
        clothe(fig, cloth, cloth, shade(cloth, 0.85), neckline="high")
        wrap(fig, 13, 24, second, "leather", 0.3)
        flared_skirt(fig, shade(cloth, 0.9), 5, trim, 14)
        stockings(fig, "#14161e", 11)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, SILVER_D, 4, "metal")
        boots(fig, shade(cloth, 0.7), 9, heel=True)
        scarf = L.get("scarf", "#a8322e")
        c = collar(fig, scarf, height=2)
        tail = fig.cape.cube((-3, 15, fig.back + 0.3), (2, 8, 1), rotation=(18, 0, 10), pivot=(-2, 23, fig.back))
        toon(tail, scarf)
        hair_style(fig)
        katana(fig)


def bard(fig, L):
    cut, cloth, second, trim = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", GOLD)
    if cut == "minstrel":
        clothe(fig, cloth, cloth, second, sleeve=second, neckline="v", trim=trim)
        coat = wrap(fig, 13, 24, cloth, "cloth", 0.33)
        with paint(coat[0].front) as p:
            p.rect(p.w / 2 - 0.5, 0, p.w / 2 + 0.5, p.h, second)
            for y in (1.5, 3.5, 5.5):
                p.ellipse(p.w / 2 - 0.4, y, p.w / 2 + 0.4, y + 0.8, GOLD_L)
        sleeves(fig, cloth, 4, trim, flare=0.7)
        belt(fig, LEATHER_D, trim)
        boots(fig, LEATHER_D, 6, cuff=trim)
        cape(fig, second, 12, trim)
        hair_style(fig)
        cap(fig, cloth, feather=L.get("feather", "#f4f1ea"))
        lute(fig)
    elif cut == "skald":
        clothe(fig, cloth, cloth, "#3a3228", neckline="round")
        wrap(fig, 13, 24, LEATHER, "leather", 0.3)
        collar(fig, "#b7a27a", fur=True)
        belt(fig, LEATHER_D, trim)
        cuffs(fig, LEATHER_D, 4)
        boots(fig, LEATHER_D, 6, cuff="#b7a27a")
        fur = fig.cape.cube((-5, 11, fig.back + 0.2), (10, 13, 2), rotation=(8, 0, 0), pivot=(0, 24, fig.back))
        toon(fur, "#8a7558")
        hair_style(fig)
        helm(fig, SILVER_D, trim, visor=False, open_face=True, horns=BONE)
        axe(fig, double=True)
        lute(fig, on_back=True)
    elif cut == "songstress":
        clothe(fig, cloth, cloth, shade(cloth, 0.8), sleeve=second, neckline="v", trim=trim, sleeve_to=6)
        flared_skirt(fig, cloth, 10, trim, 16, second=second)
        sleeves(fig, second, 4, trim, flare=0.65)
        belt(fig, trim, GOLD_L, sash=second, pouch=False)
        bow_tie(fig, second)
        boots(fig, trim, 2, heel=True)
        hair_style(fig)
        crown(fig, GOLD, 5, gem=L.get("gem", "#e0405a"))
        lute(fig, "#a86a32")
    else:  # blade dancer
        clothe(fig, second, cloth, shade(second, 1.1), sleeve=cloth, neckline="v", sleeve_to=7)
        top = wrap(fig, 18, 24, second, "cloth", 0.28)
        with paint(top[0].front) as p:
            for x in range(1, int(p.w)):
                p.ellipse(x - 0.3, p.h - 0.7, x + 0.3, p.h - 0.1, trim)
        belt(fig, trim, GOLD_L, sash=L.get("sash", "#e0b040"), pouch=False)
        for limb in fig.leg_l:  # loose dancer's trousers
            pant = limb.cube(1, 11, 0.5)
            toon(pant, shade(second, 1.1))
            hollow(pant)
        boots(fig, trim, 1)
        hair_style(fig)
        H = Figure.HEAD
        v = fig.head.cube((-H / 2, 24, -H / 2 - 0.5), (H, 3, 1))
        toon(v, mix(second, "#ffffff", 0.4))
        curved_blade(fig, fig.weapon, fig.hx - 0.5, length=9, trim=trim)
        curved_blade(fig, fig.offhand, fig.ox - 0.5, length=9, trim=trim)


def monk(fig, L):
    cut, cloth, second, trim = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", GOLD)
    if cut == "martial":
        clothe(fig, cloth, cloth, cloth, neckline="v", sleeve_to=5)
        with paint(fig.torso[0].front) as p:
            p.line([(p.w / 2 - 1.3, 0), (p.w / 2 + 1.2, p.h)], shade(cloth, 0.7))
        belt(fig, second, trim, sash=second, pouch=False)
        trousers(fig, cloth)
        wraps(fig)
        boots(fig, "#3a2a1e", 1)
        hair_style(fig)
        headband(fig, L.get("band", "#c9302c"))
    elif cut == "ascetic":
        clothe(fig, cloth, cloth, cloth, neckline="v", sleeve_to=6)
        sash = fig.body.cube((-3.5, 12, fig.front - 0.35), (7, 12, 1))
        with paint(sash.front) as p:
            p.clear()
            p.poly([(0, 0), (1.75, 0), (7, 10), (7, 12), (5.25, 12), (0, 2.5)], second)
            p.line([(0, 0.5), (6.5, 11)], trim)
        for f in (sash.right, sash.left, sash.back, sash.top, sash.bottom):
            with paint(f) as p:
                p.clear()
        robe(fig, cloth, trim, length=8, flare=10)
        beads(fig)
        wraps(fig, "#d9cfb2")
        boots(fig, "#5a4030", 1)
        hair_style(fig)
        staff(fig, "none", WOOD, trim=trim, height=28)
    elif cut == "wind":
        clothe(fig, cloth, cloth, shade(cloth, 0.9), neckline="v", sleeve_to=5)
        with paint(fig.torso[0].front) as p:
            p.line([(p.w / 2 - 1.2, 0), (p.w / 2 + 1.0, p.h)], shade(cloth, 0.72))
        belt(fig, second, trim, sash=second, pouch=False)
        flared_skirt(fig, cloth, 4, trim, 20)
        stockings(fig, "#2a3a4a", 9)
        wraps(fig, "#f4f1ea")
        boots(fig, "#2a3a4a", 3)
        hair_style(fig)
        ribbon(fig, second, (2.8, 32.6, -2.5))
    else:  # lotus fist
        clothe(fig, cloth, cloth, "#1a1418", neckline="high", sleeve_to=8)
        with paint(fig.torso[0].front) as p:
            p.line([(p.w / 2, 0.6), (p.w / 2 + 2.2, 2.4)], trim)
            for y in (1.2, 2.2):
                p.ellipse(p.w / 2 + 1.0, y, p.w / 2 + 1.6, y + 0.5, trim)
        skirt = flared_skirt(fig, cloth, 9, trim, 6, pleats=False)
        with paint(skirt[0].front) as p:
            p.clear(p.w / 2 - 0.6, p.h * 0.35, p.w / 2 + 0.6, p.h)  # the slit
        wraps(fig, trim)
        boots(fig, "#1a1418", 2, heel=True)
        hair_style(fig)


def necromancer(fig, L):
    cut, cloth, second, trim, orb = L["cut"], L["main"], L.get("second", L["main"]), L.get("trim", "#8a2be2"), L.get("orb", "#7df0c8")
    if cut == "necromancer":
        clothe(fig, cloth, cloth, shade(cloth, 0.7), neckline="high", trim=trim)
        robe(fig, cloth, trim)
        sleeves(fig, cloth, 6, trim, wide=True)
        tabard(fig, second, trim, emblem_skull(BONE), 18)
        pauldrons(fig, BONE, None, layers=1, spiked="bone")
        belt(fig, LEATHER_D, BONE, pouch=False)
        hair_style(fig)
        hood(fig, shade(cloth, 0.9), lining="#100c14")
        staff(fig, "skull", "#2a2230", orb, trim)
        book(fig, "#2a1030", BONE)
    elif cut == "bone_sage":
        clothe(fig, cloth, cloth, shade(cloth, 0.7), neckline="high", trim=trim)
        robe(fig, cloth, trim)
        sleeves(fig, cloth, 6, trim, wide=True)
        beads(fig, BONE_D, BONE)
        cape(fig, shade(cloth, 0.7), 19, ragged=True)
        hair_style(fig)
        mask(fig, BONE, skull=True)
        crown(fig, BONE, 5, bone=True)
        staff(fig, "bone", BONE_D, orb, BONE)
    elif cut == "death_witch":
        clothe(fig, cloth, cloth, "#120e16", sleeve=cloth, neckline="v")
        wrap(fig, 13, 18, second, "leather", 0.3, chest=False)
        flared_skirt(fig, cloth, 10, trim, 15, second=trim)
        stockings(fig, "#120e16", 10, trim)
        sleeves(fig, cloth, 5, trim, wide=True)
        boots(fig, "#120e16", 3, heel=True)
        bow_tie(fig, trim)
        hair_style(fig)
        wizard_hat(fig, shade(cloth, 0.75), trim, wide=8)
        horns(fig, "#2a2230", trim, curl=0.6)
        staff(fig, "skull", "#2a2230", orb, trim)
    else:  # grave maiden: a demon of the grave, horned and winged
        clothe(fig, cloth, cloth, fig.look["skin"], sleeve=cloth, neckline="v")
        plate(fig, "#3a3244", second)
        pauldrons(fig, "#3a3244", second, layers=2, spiked=True)
        flared_skirt(fig, cloth, 5, second, 22, second=trim)
        cuffs(fig, "#3a3244", 4, "metal", second)
        stockings(fig, "#16121c", 11, second)
        boots(fig, "#2a2432", 7, kind="metal", heel=True)
        belt(fig, second, BONE, sash=second, pouch=False)
        hair_style(fig)
        horns(fig, "#2a2230", L.get("tip", "#c04a9a"))
        bat_wings(fig, "#d8d2e0", "#2a1f3a", L.get("tip", "#c04a9a"), span=1.45)
        scythe(fig, trim=second)


VOCATION_BUILDERS = [fighter, archer, mage, healer, rogue, bard, monk, necromancer]


# ------------------------------------------------------------------------------------------ the looks
# One entry per look, in the order of behavior_pack/scripts/classes.js (the look number is the variant).
# face: "soft" (big gentle eyes, the default) for the bright and kind, "sharp" (narrow eyes) for the cool and dark.
# style: short, wild, slick, crop, topknot, bob, long, ponytail, twintails, braid, buns
# fringe (bangs): hime, swept, parted, spiky, short, side
LOOKS = [
    # the twelve looks of before v11, drawn anew
    dict(name="Knight", face="sharp", helmet="full", voc=0, sex="m", cut="knight", skin="#f2d2bc", hair="#5a3a26", style="short", fringe="spiky", eyes="#3a6ad0", main="#2f4f9f", plume="#d0302c"),
    dict(name="Swordsman", face="sharp", voc=0, sex="m", cut="swordsman", skin="#e8c2a4", hair="#c8402a", style="wild", fringe="spiky", eyes="#d08a2a", main="#9f2a2a", scar=True),
    dict(name="Ranger", helmet="hood", voc=1, sex="m", cut="ranger", skin="#f2d6c0", hair="#d8b048", style="short", fringe="swept", eyes="#3aa04a", main="#3f7a4a"),
    dict(name="Hunter", face="sharp", voc=1, sex="m", cut="hunter", skin="#a8704a", hair="#1f1a16", style="short", fringe="short", eyes="#8a5a2a", main="#6b4a36", second="#7a5a3a", beard=True),
    dict(name="Sorcerer", face="sharp", helmet="hood", voc=2, sex="m", cut="sorcerer", skin="#f6e2d4", hair="#6a4a8a", style="short", fringe="parted", eyes="#a050e0", main="#4a2a7a", second="#6a3aa0", orb="#c05bff"),
    dict(name="Wizard", helmet="hat", voc=2, sex="m", cut="wizard", skin="#ecc8aa", hair="#eceae4", style="long", fringe="parted", eyes="#3a9ad0", main="#22336c", second="#6a4a9f", orb="#59d0ff"),
    dict(name="Priest", helmet="hat", voc=3, sex="m", cut="priest", skin="#f8e6d8", hair="#f0d070", style="short", fringe="swept", eyes="#3a7ad0", main="#f6f3ec", second="#e8c870", orb="#f6d968"),
    dict(name="Acolyte", voc=3, sex="m", cut="acolyte", skin="#7a4e36", hair="#15131a", style="crop", eyes="#6a4a2a", main="#b0d0e8", trim="#e0c06a", ahoge=True),
    dict(name="Assassin", face="sharp", helmet="hood", voc=4, sex="m", cut="assassin", skin="#eccaac", hair="#1a1622", style="short", fringe="spiky", eyes="#d0203a", main="#22222c", second="#2c2c38"),
    dict(name="Thief", face="sharp", voc=4, sex="m", cut="thief", skin="#e8c2a4", hair="#7a5230", style="wild", fringe="spiky", eyes="#3aa04a", main="#556a3a", second="#5a4a32", band="#b8322e"),
    dict(name="Minstrel", helmet="hat", voc=5, sex="m", cut="minstrel", skin="#f6dcc8", hair="#c8582e", style="short", fringe="swept", eyes="#2a9a7a", main="#b0322e", second="#e8b440", feather="#f4f1ea", ahoge=True),
    dict(name="Skald", face="sharp", helmet="open", voc=5, sex="m", cut="skald", skin="#f0cfb2", hair="#e0cfa0", style="braid", fringe="swept", eyes="#3a7ad0", main="#3a5a8a", beard=True, trim="#c9b98a"),
    # v11: the women of every vocation
    dict(name="Valkyrie", helmet="open", voc=0, sex="f", cut="valkyrie", skin="#fae2d2", hair="#f4d470", tip="#fff0b0", style="braid", fringe="parted", eyes="#3a9ae0", main="#2f4f9f", metal="#dfe4ec", ribbon="#2f4f9f"),
    dict(name="Shieldmaiden", face="sharp", voc=0, sex="f", cut="shieldmaiden", skin="#f2d2bc", hair="#d0502e", tip="#f0a040", style="ponytail", fringe="swept", eyes="#4aa04a", main="#5a7a4a", shield="#8a2a22", ribbon="#e9e3cf"),
    dict(name="Huntress", voc=1, sex="f", cut="huntress", skin="#eccaac", hair="#6a4428", style="ponytail", fringe="swept", eyes="#8a6a2a", main="#3f7a4a", second="#7a5238", ribbon="#3f7a4a"),
    dict(name="Windrunner", voc=1, sex="f", cut="windrunner", skin="#fae8dc", hair="#f4f6fa", tip="#7ae0c0", style="long", fringe="parted", eyes="#2ac0b0", main="#2f8a7a", second="#ecebe4", trim="#d9a92b", gem="#59d0ff"),
    dict(name="Witch", helmet="hat", voc=2, sex="f", cut="witch", skin="#fae4d6", hair="#7a4ab0", tip="#e070c0", style="long", fringe="hime", eyes="#5ad06a", main="#2a1f3e", second="#5a2a7a", trim="#b07af0", orb="#63ff6b", ahoge=True),
    dict(name="Enchantress", voc=2, sex="f", cut="enchantress", skin="#f6dcc8", hair="#d8e2f2", tip="#7ab0f0", style="long", fringe="parted", eyes="#4a80f0", main="#2a4a90", second="#a8c0e0", trim="#ecebe4", orb="#59d0ff"),
    dict(name="Priestess", helmet="veil", voc=3, sex="f", cut="priestess", skin="#fbe8dc", hair="#f8dc78", tip="#fff4c8", style="long", fringe="hime", eyes="#3a9ae0", main="#fdfcf8", second="#f4ead0", trim="#d9a92b"),
    dict(name="Battle Sister", helmet="veil", voc=3, sex="f", cut="battle_sister", skin="#a8704a", hair="#1f1a16", style="bob", fringe="hime", eyes="#8a5a2a", main="#24222e", trim="#d9a92b"),
    dict(name="Shadow Dancer", face="sharp", voc=4, sex="f", cut="shadow_dancer", skin="#f2d2bc", hair="#1e1828", tip="#6a3a9a", style="bob", fringe="hime", eyes="#c050f0", main="#2c2040", second="#3e2c58", trim="#c0a8e8", sash="#9a3af0"),
    dict(name="Nightblade", face="sharp", voc=4, sex="f", cut="nightblade", skin="#fae4d6", hair="#262e48", tip="#6a3ab0", style="ponytail", fringe="swept", eyes="#e0303a", main="#1f2436", second="#2c3248", trim="#8a909c", scarf="#b8322e", ribbon="#b8322e"),
    dict(name="Songstress", voc=5, sex="f", cut="songstress", skin="#fae2d2", hair="#d8703a", tip="#f0c050", style="long", fringe="parted", eyes="#4ab04a", main="#b0222e", second="#f0c050", gem="#e0405a"),
    dict(name="Blade Dancer", voc=5, sex="f", cut="blade_dancer", skin="#c8906a", hair="#1f1a16", style="buns", fringe="hime", eyes="#e0b040", main="#1f8a8a", second="#38b0b0", trim="#f0c050", sash="#f0c050", ribbon="#f0c050"),
    # v11: the Monks and the Necromancers
    dict(name="Martial Monk", face="sharp", voc=6, sex="m", cut="martial", skin="#f0cfb2", hair="#15131a", style="short", fringe="spiky", eyes="#5a3a2a", main="#f6f3ec", second="#1a1418", band="#d0302c"),
    dict(name="Ascetic", face="sharp", voc=6, sex="m", cut="ascetic", skin="#c8906a", hair="#15131a", style="topknot", eyes="#6a4a2a", main="#f08a20", second="#b83a18", trim="#f6d968"),
    dict(name="Wind Disciple", voc=6, sex="f", cut="wind", skin="#fae2d2", hair="#2a5a9a", tip="#7ac8f0", style="ponytail", fringe="swept", eyes="#3a9ae0", main="#a8d8f8", second="#f4f1ea", trim="#ecebe4", ribbon="#f4f1ea", ahoge=True),
    dict(name="Lotus Fist", voc=6, sex="f", cut="lotus", skin="#fae4d6", hair="#1a1418", style="buns", fringe="hime", eyes="#a03a2a", main="#c0141c", second="#f6d968", trim="#e0b030", ribbon="#e0b030"),
    dict(name="Necromancer", face="sharp", helmet="hood", voc=7, sex="m", cut="necromancer", skin="#e6dfd6", hair="#2a2632", style="short", fringe="parted", eyes="#7df0c8", main="#1f1a2a", second="#2c2040", trim="#9a3af0", orb="#c05bff"),
    dict(name="Bone Sage", face="sharp", voc=7, sex="m", cut="bone_sage", skin="#cfc6ba", hair="#8a8680", style="crop", eyes="#7df0c8", main="#4a4656", trim="#c9c0a0", orb="#7df0c8", glow="#7df0c8"),
    dict(name="Death Witch", face="sharp", helmet="hat", voc=7, sex="f", cut="death_witch", skin="#f2eae4", hair="#18151e", tip="#2f8a4a", style="long", fringe="hime", eyes="#63ff6b", main="#2c2040", second="#1a1424", trim="#6ad07a", orb="#63ff6b"),
    dict(name="Grave Maiden", face="sharp", voc=7, sex="f", cut="grave_maiden", skin="#f4e8ea", hair="#2a1e30", tip="#c04a9a", style="long", fringe="heavy", eyes="#d070ff", glow="#d070ff", main="#18141e", second="#8a3ad0", trim="#d0c8dc", length=24, strands=8),
]


def build(n):
    def make():
        look = LOOKS[n]
        fig = Figure(n, look)
        paint_skin(fig)
        paint_face(fig)
        VOCATION_BUILDERS[look["voc"]](fig, look)
        if fig.female and not look.get("flat") and fig.chest:
            color, kind, inflate = fig.chest
            bust(fig, color, kind, inflate)
        return fig.m
    make.__name__ = f"retainer_{n}"
    return make


MODELS = [build(n) for n in range(len(LOOKS))]


def gallery(path, scale=7, cols=8, picks=None, yaw=-28, cell=(220, 340)):
    """The companions side by side, for the release notes."""
    picks = list(range(len(LOOKS))) if picks is None else picks
    rows = (len(picks) + cols - 1) // cols
    sheet = Image.new("RGBA", (cell[0] * cols, cell[1] * rows), (34, 36, 44, 255))
    draw = ImageDraw.Draw(sheet)
    for i, n in enumerate(picks):
        img = MODELS[n]().render(yaw, 10, scale, cell, bg=(34, 36, 44, 255))
        x, y = (i % cols) * cell[0], (i // cols) * cell[1]
        sheet.paste(img, (x, y))
        draw.text((x + 8, y + 6), f"{n}. {LOOKS[n]['name']}", fill=(235, 230, 220, 255))
    sheet.save(path)
    return sheet
