"""Tiny modelling kit for Bedrock entity models.

A model is described once in Python (bones + cubes).  From that single
description we derive:

  * the ``.geo.json`` geometry file (box-UV, auto-packed),
  * the entity texture (every cube face is painted through a ``Face`` canvas),
  * a software-rendered preview image used to eyeball the result.

Coordinates are Bedrock geometry coordinates: Y up, the mob faces -Z and the
mob's right arm sits on -X.
"""
from __future__ import annotations

import zlib
import math
import random

import numpy as np
from PIL import Image

TRANSPARENT = (0, 0, 0, 0)


def rgba(color):
    """Accepts '#rrggbb', '#rrggbbaa', (r,g,b), (r,g,b,a) or None."""
    if color is None:
        return TRANSPARENT
    if isinstance(color, str):
        c = color.lstrip("#")
        if len(c) == 6:
            return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)
        return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), int(c[6:8], 16))
    if len(color) == 3:
        return (color[0], color[1], color[2], 255)
    return tuple(color)


def shade(color, factor):
    """Multiply brightness (factor > 1 brightens)."""
    r, g, b, a = rgba(color)
    f = lambda v: max(0, min(255, int(round(v * factor))))
    return (f(r), f(g), f(b), a)


def mix(c1, c2, t):
    a, b = rgba(c1), rgba(c2)
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(4))


class Face:
    """A rectangular window into an image; (0, 0) is the top-left texel."""

    def __init__(self, img, x, y, w, h):
        self.img, self.x, self.y, self.w, self.h = img, x, y, w, h

    def px(self, x, y, color):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.img.putpixel((self.x + x, self.y + y), rgba(color))

    def get(self, x, y):
        return self.img.getpixel((self.x + x, self.y + y))

    def fill(self, color, x0=0, y0=0, x1=None, y1=None):
        x1 = self.w if x1 is None else x1
        y1 = self.h if y1 is None else y1
        for yy in range(y0, y1):
            for xx in range(x0, x1):
                self.px(xx, yy, color)
        return self

    def hline(self, y, color, x0=0, x1=None):
        if y < 0:
            y += self.h
        return self.fill(color, x0, y, x1, y + 1)

    def vline(self, x, color, y0=0, y1=None):
        if x < 0:
            x += self.w
        return self.fill(color, x, y0, x + 1, y1)

    def border(self, color):
        self.hline(0, color)
        self.hline(self.h - 1, color)
        self.vline(0, color)
        self.vline(self.w - 1, color)
        return self

    def rows(self, art, pal, ox=0, oy=0):
        """Stamp ASCII art.  '.' leaves the texel untouched, ' ' clears it."""
        for j, line in enumerate(art):
            for i, ch in enumerate(line):
                if ch == ".":
                    continue
                self.px(ox + i, oy + j, None if ch == " " else pal[ch])
        return self

    def noise(self, amount=6, seed=0):
        """Per-texel brightness jitter so flat fills do not look synthetic."""
        rnd = random.Random(seed * 7919 + self.x * 131 + self.y * 31 + self.w)
        for yy in range(self.h):
            for xx in range(self.w):
                r, g, b, a = self.get(xx, yy)
                if a == 0:
                    continue
                d = rnd.randint(-amount, amount)
                self.px(xx, yy, (max(0, min(255, r + d)), max(0, min(255, g + d)),
                                 max(0, min(255, b + d)), a))
        return self

    def vshade(self, top=1.0, bottom=0.8):
        """Vertical brightness ramp (darker towards the bottom by default)."""
        for yy in range(self.h):
            t = yy / max(1, self.h - 1)
            f = top + (bottom - top) * t
            for xx in range(self.w):
                c = self.get(xx, yy)
                if c[3]:
                    self.px(xx, yy, shade(c, f))
        return self

    def ragged_bottom(self, depth=3, seed=0):
        """Cut a tattered hem into the lower rows (uses alpha)."""
        rnd = random.Random(seed + self.w * 17)
        for xx in range(self.w):
            cut = rnd.randint(0, depth)
            for k in range(cut):
                self.px(xx, self.h - 1 - k, None)
        return self


class Cube:
    def __init__(self, origin, size, inflate=0.0, rotation=None, pivot=None, res=1):
        self.origin = tuple(float(v) for v in origin)
        self.size = tuple(int(v) for v in size)
        self.inflate = float(inflate)
        self.rotation = rotation
        self.pivot = pivot
        self.res = res  # texels painted per model unit (v11: the companions are painted at 4)
        w, h, d = (v * res for v in self.size)
        self.img = Image.new("RGBA", (2 * d + 2 * w, d + h), TRANSPARENT)
        self.right = Face(self.img, 0, d, d, h)
        self.front = Face(self.img, d, d, w, h)
        self.left = Face(self.img, d + w, d, d, h)
        self.back = Face(self.img, 2 * d + w, d, w, h)
        self.top = Face(self.img, d, 0, w, d)
        self.bottom = Face(self.img, d + w, 0, w, d)
        self.uv = None

    @property
    def faces(self):
        return [self.right, self.front, self.left, self.back, self.top, self.bottom]

    @property
    def sides(self):
        return [self.right, self.front, self.left, self.back]

    def fill(self, color, noise=5, seed=1):
        """Fill every face with a base colour, light from above."""
        for i, f in enumerate(self.faces):
            f.fill(color)
            if noise:
                f.noise(noise, seed + i)
        self.bottom.fill(shade(color, 0.7))
        return self

    def band(self, y0, y1, color):
        """Horizontal band around the four side faces (rows y0..y1-1)."""
        for f in self.sides:
            f.fill(color, 0, y0, None, y1)
        return self


class Bone:
    def __init__(self, name, pivot, parent=None, rotation=None, res=1):
        self.name, self.pivot, self.parent, self.rotation = name, tuple(pivot), parent, rotation
        self.res = res
        self.cubes: list[Cube] = []
        self.locators: dict = {}
        self.scale = 1.0  # a scale an always-on animation gives this bone in game (one number, or x, y, z)
        self.offset = (0.0, 0.0, 0.0)  # and a shift (the figure lifted on longer legs)

    def cube(self, origin, size, inflate=0.0, rotation=None, pivot=None):
        c = Cube(origin, size, inflate, rotation, pivot, self.res)
        c.bone = self.name
        self.cubes.append(c)
        return c


def round_off(bone, c, r, ends=False):
    """Replaces an upright box with a rounded one, keeping its paint. The upright edges are bevelled: two boxes
    (full width but shallower, full depth but narrower) and four slim boxes turned 45 degrees along those edges.
    With `ends`, the top and bottom edges are bevelled too: a third, shorter core box and eight more slim boxes
    along the top and bottom edges. Each part takes its texture from the matching part of the painted box, so
    the painted light now rolls round the bevels. Returns the new boxes."""
    k = c.res
    W, H, D = c.size
    rk = int(round(r * k))
    top_only = ends == "top"  # hats and hair over a head: rounded over the top, open below
    if ends and H * k - (1 if top_only else 2) * rk < k:
        ends = False
    if rk < 1 or W * k - 2 * rk < k or D * k - 2 * rk < k or H < 1:
        return [c]
    x0, y0, z0 = c.origin
    x1, y1, z1 = x0 + W, y0 + H, z0 + D
    i = c.inflate
    img = c.img
    Wk, Hk, Dk = W * k, H * k, D * k
    et = r if ends else 0  # how far the top is bevelled
    eb = r if ends and not top_only else 0  # and the bottom
    etk, ebk = int(round(et * k)), int(round(eb * k))

    def crop(f, cx0=0, cx1=None, cy0=0, cy1=None):
        cx1 = f.w if cx1 is None else cx1
        cy1 = f.h if cy1 is None else cy1
        return img.crop((f.x + cx0, f.y + cy0, f.x + cx1, f.y + cy1))

    def put(dst, face, piece):
        if face.w == 0 or face.h == 0:
            return
        if piece.width == 0 or piece.height == 0:
            return
        if piece.size != (face.w, face.h):
            piece = piece.resize((face.w, face.h), Image.NEAREST)
        dst.img.paste(piece, (face.x, face.y))

    def stack(*parts, vertical=False):
        parts = [p for p in parts if p.width and p.height]
        if vertical:
            out = Image.new("RGBA", (max(p.width for p in parts), sum(p.height for p in parts)))
            y = 0
            for p in parts:
                out.paste(p.resize((out.width, p.height), Image.NEAREST), (0, y))
                y += p.height
            return out
        out = Image.new("RGBA", (sum(p.width for p in parts), max(p.height for p in parts)))
        x = 0
        for p in parts:
            out.paste(p.resize((p.width, out.height), Image.NEAREST), (x, 0))
            x += p.width
        return out

    out = []
    # the cores
    zc = Cube((x0 + r, y0 + eb, z0), (W - 2 * r, H - et - eb, D), i, None, None, k)  # full depth: the front and back
    put(zc, zc.front, crop(c.front, rk, Wk - rk, etk, Hk - ebk))
    put(zc, zc.back, crop(c.back, rk, Wk - rk, etk, Hk - ebk))
    put(zc, zc.right, crop(c.right, 0, Dk, etk, Hk - ebk))
    put(zc, zc.left, crop(c.left, 0, Dk, etk, Hk - ebk))
    put(zc, zc.top, crop(c.top, rk, Wk - rk))
    put(zc, zc.bottom, crop(c.bottom, rk, Wk - rk))
    xc = Cube((x0, y0 + eb, z0 + r), (W, H - et - eb, D - 2 * r), i, None, None, k)  # full width: the sides
    put(xc, xc.right, crop(c.right, rk, Dk - rk, etk, Hk - ebk))
    put(xc, xc.left, crop(c.left, rk, Dk - rk, etk, Hk - ebk))
    put(xc, xc.front, crop(c.front, 0, Wk, etk, Hk - ebk))
    put(xc, xc.back, crop(c.back, 0, Wk, etk, Hk - ebk))
    put(xc, xc.top, crop(c.top, 0, Wk, rk, Dk - rk))
    put(xc, xc.bottom, crop(c.bottom, 0, Wk, rk, Dk - rk))
    out += [zc, xc]
    if ends:
        yc = Cube((x0 + r, y0, z0 + r), (W - 2 * r, H, D - 2 * r), i, None, None, k)  # full height: the top (and bottom)
        put(yc, yc.top, crop(c.top, rk, Wk - rk, rk, Dk - rk))
        put(yc, yc.bottom, crop(c.bottom, rk, Wk - rk, rk, Dk - rk))
        for f, src in ((yc.front, c.front), (yc.back, c.back)):
            put(yc, f, crop(src, rk, Wk - rk))
        for f, src in ((yc.right, c.right), (yc.left, c.left)):
            put(yc, f, crop(src, rk, Dk - rk))
        out.append(yc)
    infl = (r * math.sqrt(2) - 1) / 2
    lo_x, hi_x, lo_z, hi_z = x0 + r - i, x1 - r + i, z0 + r - i, z1 - r + i
    # the upright edges
    for cx, cz, s1, s2 in (
        (lo_x, lo_z, crop(c.front, 0, rk, etk, Hk - ebk), crop(c.right, Dk - rk, Dk, etk, Hk - ebk)),
        (hi_x, lo_z, crop(c.front, Wk - rk, Wk, etk, Hk - ebk), crop(c.left, 0, rk, etk, Hk - ebk)),
        (lo_x, hi_z, crop(c.back, Wk - rk, Wk, etk, Hk - ebk), crop(c.right, 0, rk, etk, Hk - ebk)),
        (hi_x, hi_z, crop(c.back, 0, rk, etk, Hk - ebk), crop(c.left, Dk - rk, Dk, etk, Hk - ebk)),
    ):
        hh = H - et - eb
        low = 0.5 if eb or not ends else 0.0  # an open bottom stays flush
        p = Cube((cx - 0.5, y0 + eb - low, cz - 0.5), (1, int(round(hh + 0.5 + low)), 1), infl, (0, 45, 0), (cx, y0 + eb, cz), k)
        strip = stack(s1, s2)
        for f in p.sides:
            put(p, f, strip)
        put(p, p.top, crop(c.top, 0, rk, 0, rk))
        put(p, p.bottom, crop(c.bottom, 0, rk, 0, rk))
        out.append(p)
    if ends:
        lo_y, hi_y = y0 + r - i, y1 - r + i
        # along x: the top and bottom edges at the front and back
        for cy, cz, s1, s2 in (
            (hi_y, lo_z, crop(c.front, rk, Wk - rk, 0, rk), crop(c.top, rk, Wk - rk, Dk - rk, Dk)),
            (hi_y, hi_z, crop(c.back, rk, Wk - rk, 0, rk).transpose(Image.FLIP_LEFT_RIGHT), crop(c.top, rk, Wk - rk, 0, rk)),
            (lo_y, lo_z, crop(c.front, rk, Wk - rk, Hk - rk, Hk), crop(c.bottom, rk, Wk - rk, 0, rk)),
            (lo_y, hi_z, crop(c.back, rk, Wk - rk, Hk - rk, Hk).transpose(Image.FLIP_LEFT_RIGHT), crop(c.bottom, rk, Wk - rk, Dk - rk, Dk)),
        )[:2 if top_only else 4]:
            p = Cube((x0 + r - 0.5, cy - 0.5, cz - 0.5), (int(W - 2 * r + 1), 1, 1), infl, (45, 0, 0), (x0, cy, cz), k)
            strip = stack(s1, s2, vertical=True)
            for f in (p.front, p.back, p.top, p.bottom):
                put(p, f, strip)
            put(p, p.right, crop(c.right, 0, rk, 0, rk))
            put(p, p.left, crop(c.left, 0, rk, 0, rk))
            out.append(p)
        # along z: the top and bottom edges at the sides
        for cx, cy, s1, s2 in (
            (lo_x, hi_y, crop(c.right, rk, Dk - rk, 0, rk), crop(c.top, 0, rk, rk, Dk - rk).transpose(Image.ROTATE_90)),
            (hi_x, hi_y, crop(c.left, rk, Dk - rk, 0, rk), crop(c.top, Wk - rk, Wk, rk, Dk - rk).transpose(Image.ROTATE_90)),
            (lo_x, lo_y, crop(c.right, rk, Dk - rk, Hk - rk, Hk), crop(c.bottom, 0, rk, rk, Dk - rk).transpose(Image.ROTATE_90)),
            (hi_x, lo_y, crop(c.left, rk, Dk - rk, Hk - rk, Hk), crop(c.bottom, Wk - rk, Wk, rk, Dk - rk).transpose(Image.ROTATE_90)),
        )[:2 if top_only else 4]:
            p = Cube((cx - 0.5, cy - 0.5, z0 + r - 0.5), (1, 1, int(D - 2 * r + 1)), infl, (0, 0, 45), (cx, cy, z0), k)
            strip = stack(s1, s2, vertical=True)
            for f in (p.right, p.left):
                put(p, f, strip)
            for f in (p.top, p.bottom):
                put(p, f, strip.transpose(Image.ROTATE_90))
            put(p, p.front, crop(c.front, 0, rk, 0, rk))
            put(p, p.back, crop(c.back, 0, rk, 0, rk))
            out.append(p)
    for n in out:
        n.bone = bone.name
    idx = bone.cubes.index(c)
    bone.cubes[idx:idx + 1] = out
    return out


def _enhance(region, low, k, rng, side):
    """Adds fine detail to one face of a cube, in place.

    `region` is the face at k times the painted resolution (already scaled up), `low` the face as
    painted.  The painted texture stays the design; this pass gives it depth: light falling from
    above, a bevel around the face, a thin shadow under every painted feature and a little grain.
    """
    h, w = low.shape[:2]
    if h == 0 or w == 0:
        return
    opaque = low[..., 3] > 0
    lum = low[..., :3].mean(axis=2)
    mult = np.ones((h * k, w * k), np.float32)
    if side and h > 1:  # light from above: the sides of things darken towards the ground
        mult *= np.linspace(1.05, 0.92, h * k, dtype=np.float32)[:, None]
    # painted features (belts, trim, eyes...) cast a thin shadow on what lies below and to their right
    for axis in (0, 1):
        before = np.roll(lum, 1, axis=axis)
        before_opaque = np.roll(opaque, 1, axis=axis)
        edge = (np.abs(lum - before) > 12) & opaque & before_opaque
        if axis == 0:
            edge[0, :] = False
            big = np.repeat(np.repeat(edge, k, axis=0), k, axis=1)
            big[np.arange(h * k) % k != 0, :] = False  # only the first sub-row of the lower texel
            mult[big] *= 0.86
        else:
            edge[:, 0] = False
            big = np.repeat(np.repeat(edge, k, axis=0), k, axis=1)
            big[:, np.arange(w * k) % k != 0] = False
            mult[big] *= 0.93
    if h >= 3 and w >= 3:  # a bevel: lit along the top and left, shaded along the bottom and right
        mult[0, :] *= 1.08
        mult[:, 0] *= 1.05
        mult[-1, :] *= 0.86
        mult[:, -1] *= 0.92
    mult *= 1.0 + rng.uniform(-0.035, 0.035, mult.shape).astype(np.float32)  # grain
    region[..., :3] *= mult[..., None]


class Model:
    SIZES = [(32, 32), (64, 32), (64, 64), (128, 64), (128, 128), (256, 128), (256, 256)]
    HD = 2  # texels per painted pixel in the texture that is shipped

    def __init__(self, name, bounds=(3.0, 3.5, 1.25), res=1):
        self.name = name
        self.bones: list[Bone] = []
        self.view_scale = 1.0  # the client entity's scale script, in game
        self.bounds = bounds  # visible bounds width, height, y offset (blocks)
        self.res = res  # texels painted per model unit; a model painted finely ships as painted
        self.texture = None
        self.units = None  # the texture's size in model units, as the geometry names it
        self._hd = None

    def bone(self, name, pivot, parent=None, rotation=None):
        b = Bone(name, pivot, parent, rotation, self.res)
        self.bones.append(b)
        return b

    # ---------------------------------------------------------------- packing
    def pack(self):
        cubes = [c for b in self.bones for c in b.cubes]
        r = self.res
        order = sorted(cubes, key=lambda c: (-c.img.height, -c.img.width))
        for tw, th in self.SIZES:
            x = y = shelf = 0
            ok = True
            placed = []
            for c in order:
                w, h = c.img.width // r, c.img.height // r
                if w > tw:
                    ok = False
                    break
                if x + w > tw:
                    x, y, shelf = 0, y + shelf, 0
                if y + h > th:
                    ok = False
                    break
                placed.append((c, x, y))
                x += w
                shelf = max(shelf, h)
            if ok:
                tex = Image.new("RGBA", (tw * r, th * r), TRANSPARENT)
                for c, px, py in placed:
                    c.uv = (px, py)
                    tex.paste(c.img, (px * r, py * r))
                self.texture = tex
                self.units = (tw, th)
                return tex
        raise ValueError(f"{self.name}: cubes do not fit the largest atlas")

    def hd(self):
        """The texture that is shipped: the painted one at HD times its resolution with detail added.

        The geometry keeps the painted size as its texture size; the game maps UVs proportionally, so a
        finer image simply shows more detail on the same model.
        """
        if self.texture is None:
            self.pack()
        if self._hd is not None:
            return self._hd
        if self.res > 1:  # painted finely already: shipped as painted
            self._hd = self.texture
            return self._hd
        k = self.HD
        src = np.asarray(self.texture).astype(np.float32)
        out = np.repeat(np.repeat(src, k, axis=0), k, axis=1)
        rng = np.random.default_rng(zlib.crc32(self.name.encode()))
        for b in self.bones:
            for c in b.cubes:
                for face in c.faces:
                    x0, y0 = c.uv[0] + face.x, c.uv[1] + face.y
                    _enhance(out[y0 * k:(y0 + face.h) * k, x0 * k:(x0 + face.w) * k],
                             src[y0:y0 + face.h, x0:x0 + face.w], k, rng, face in c.sides)
        self._hd = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
        return self._hd

    # ------------------------------------------------------------ geometry
    def geometry(self):
        if self.texture is None:
            self.pack()
        num = lambda v: int(v) if float(v).is_integer() else round(float(v), 4)
        bones = []
        for b in self.bones:
            jb = {"name": b.name}
            if b.parent:
                jb["parent"] = b.parent
            jb["pivot"] = [num(v) for v in b.pivot]
            if b.rotation:
                jb["rotation"] = [num(v) for v in b.rotation]
            if b.cubes:
                jb["cubes"] = []
                for c in b.cubes:
                    jc = {"origin": [num(v) for v in c.origin], "size": list(c.size),
                          "uv": list(c.uv)}
                    if c.inflate:
                        jc["inflate"] = num(c.inflate)
                    if c.rotation:
                        jc["pivot"] = [num(v) for v in (c.pivot or (0, 0, 0))]
                        jc["rotation"] = [num(v) for v in c.rotation]
                    jb["cubes"].append(jc)
            if b.locators:
                jb["locators"] = {k: [num(v) for v in p] for k, p in b.locators.items()}
            bones.append(jb)
        return {
            "format_version": "1.12.0",
            "minecraft:geometry": [{
                "description": {
                    "identifier": f"geometry.overlord.{self.name}",
                    "texture_width": self.units[0],
                    "texture_height": self.units[1],
                    "visible_bounds_width": self.bounds[0],
                    "visible_bounds_height": self.bounds[1],
                    "visible_bounds_offset": [0, self.bounds[2], 0],
                },
                "bones": bones,
            }],
        }

    # ------------------------------------------------------------- preview
    def render(self, yaw=-35.0, pitch=18.0, scale=8, size=(420, 520), bg=(58, 62, 74, 255)):
        """Orthographic z-buffered render of the rest pose."""
        if self.texture is None:
            self.pack()
        tex = np.asarray(self.hd()).astype(np.float32)
        K = self.res if self.res > 1 else self.HD
        W, H = size
        color = np.zeros((H, W, 4), np.float32)
        color[:, :] = bg
        depth = np.full((H, W), 1e9, np.float32)
        bones = {b.name: b for b in self.bones}

        def rot_matrix(rx, ry, rz):
            # Bedrock geometry: X and Z rotate left-handed, Y right-handed.
            ax, ay, az = math.radians(-rx), math.radians(ry), math.radians(-rz)
            cx, sx, cy, sy, cz, sz = (math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay),
                                      math.cos(az), math.sin(az))
            mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
            my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
            mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
            return mz @ my @ mx

        def apply(points, rotation, pivot):
            m = rot_matrix(*rotation)
            p = np.array(pivot, np.float64)
            return (points - p) @ m.T + p

        cam = rot_matrix(0, 0, 0)
        cy_, sy_ = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
        yaw_m = np.array([[cy_, 0, -sy_], [0, 1, 0], [sy_, 0, cy_]])
        pitch_m = np.array([[1, 0, 0], [0, cp, sp], [0, -sp, cp]])
        cam = pitch_m @ yaw_m

        for b in self.bones:
            for c in b.cubes:
                x0, y0, z0 = (c.origin[i] - c.inflate for i in range(3))
                x1, y1, z1 = (c.origin[i] + c.size[i] + c.inflate for i in range(3))
                w, h, d = c.size
                u, v = c.uv
                # face: (corner top-left, top-right, bottom-left), tex rect, light
                quads = [
                    ((x0, y1, z0), (x1, y1, z0), (x0, y0, z0), (u + d, v + d, w, h), 1.0),        # front
                    ((x1, y1, z1), (x0, y1, z1), (x1, y0, z1), (u + 2 * d + w, v + d, w, h), 0.7),  # back
                    ((x0, y1, z1), (x0, y1, z0), (x0, y0, z1), (u, v + d, d, h), 0.82),           # right
                    ((x1, y1, z0), (x1, y1, z1), (x1, y0, z0), (u + d + w, v + d, d, h), 0.82),   # left
                    ((x0, y1, z1), (x1, y1, z1), (x0, y1, z0), (u + d, v, w, d), 1.12),           # top
                    ((x0, y0, z0), (x1, y0, z0), (x0, y0, z1), (u + d + w, v, w, d), 0.6),        # bottom
                ]
                for p_tl, p_tr, p_bl, (tx, ty, tw_, th_), light in quads:
                    if tw_ == 0 or th_ == 0:
                        continue
                    pts = np.array([p_tl, p_tr, p_bl], np.float64)
                    if c.rotation:
                        pts = apply(pts, c.rotation, c.pivot or (0, 0, 0))
                    bb = b
                    while bb is not None:
                        if bb.scale != 1.0:
                            pv = np.array(bb.pivot, np.float64)
                            sc = np.array(bb.scale if isinstance(bb.scale, (tuple, list)) else (bb.scale,) * 3, np.float64)
                            pts = (pts - pv) * sc + pv
                        if bb.rotation:
                            pts = apply(pts, bb.rotation, bb.pivot)
                        if any(bb.offset):
                            pts = pts + np.array(bb.offset, np.float64)
                        bb = bones.get(bb.parent) if bb.parent else None
                    pts = pts * self.view_scale @ cam.T
                    sx_ = pts[:, 0] * scale + W / 2
                    sy2 = H - 40 - pts[:, 1] * scale
                    sz_ = pts[:, 2]
                    o = np.array([sx_[0], sy2[0]])
                    e1 = np.array([sx_[1] - sx_[0], sy2[1] - sy2[0]])
                    e2 = np.array([sx_[2] - sx_[0], sy2[2] - sy2[0]])
                    det = e1[0] * e2[1] - e1[1] * e2[0]
                    if abs(det) < 1e-6:
                        continue
                    xs = [o[0], o[0] + e1[0], o[0] + e2[0], o[0] + e1[0] + e2[0]]
                    ys = [o[1], o[1] + e1[1], o[1] + e2[1], o[1] + e1[1] + e2[1]]
                    bx0, bx1 = max(0, int(min(xs))), min(W - 1, int(max(xs)) + 1)
                    by0, by1 = max(0, int(min(ys))), min(H - 1, int(max(ys)) + 1)
                    if bx0 > bx1 or by0 > by1:
                        continue
                    gx, gy = np.meshgrid(np.arange(bx0, bx1 + 1) + 0.5, np.arange(by0, by1 + 1) + 0.5)
                    rx_, ry_ = gx - o[0], gy - o[1]
                    s = (rx_ * e2[1] - ry_ * e2[0]) / det
                    t = (e1[0] * ry_ - e1[1] * rx_) / det
                    inside = (s >= 0) & (s < 1) & (t >= 0) & (t < 1)
                    z = sz_[0] + s * (sz_[1] - sz_[0]) + t * (sz_[2] - sz_[0])
                    txi = np.clip(((tx + s * tw_) * K).astype(int), 0, tex.shape[1] - 1)
                    tyi = np.clip(((ty + t * th_) * K).astype(int), 0, tex.shape[0] - 1)
                    sample = tex[tyi, txi]
                    sub_d = depth[by0:by1 + 1, bx0:bx1 + 1]
                    sub_c = color[by0:by1 + 1, bx0:bx1 + 1]
                    mask = inside & (sample[..., 3] > 127) & (z < sub_d)
                    lit = sample.copy()
                    lit[..., :3] = np.clip(lit[..., :3] * light, 0, 255)
                    sub_c[mask] = lit[mask]
                    sub_d[mask] = z[mask]
        return Image.fromarray(color.astype(np.uint8), "RGBA")

    def preview(self, scale=8, size=(420, 520)):
        a = self.render(-35, 16, scale, size)
        b = self.render(145, 16, scale, size)
        out = Image.new("RGBA", (size[0] * 2, size[1]))
        out.paste(a, (0, 0))
        out.paste(b, (size[0], 0))
        return out
