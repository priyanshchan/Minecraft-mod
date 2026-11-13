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
    def __init__(self, origin, size, inflate=0.0, rotation=None, pivot=None):
        self.origin = tuple(float(v) for v in origin)
        self.size = tuple(int(v) for v in size)
        self.inflate = float(inflate)
        self.rotation = rotation
        self.pivot = pivot
        w, h, d = self.size
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
    def __init__(self, name, pivot, parent=None, rotation=None):
        self.name, self.pivot, self.parent, self.rotation = name, tuple(pivot), parent, rotation
        self.cubes: list[Cube] = []

    def cube(self, origin, size, inflate=0.0, rotation=None, pivot=None):
        c = Cube(origin, size, inflate, rotation, pivot)
        self.cubes.append(c)
        return c


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

    def __init__(self, name, bounds=(3.0, 3.5, 1.25)):
        self.name = name
        self.bones: list[Bone] = []
        self.bounds = bounds  # visible bounds width, height, y offset (blocks)
        self.texture = None
        self._hd = None

    def bone(self, name, pivot, parent=None, rotation=None):
        b = Bone(name, pivot, parent, rotation)
        self.bones.append(b)
        return b

    # ---------------------------------------------------------------- packing
    def pack(self):
        cubes = [c for b in self.bones for c in b.cubes]
        order = sorted(cubes, key=lambda c: (-c.img.height, -c.img.width))
        for tw, th in self.SIZES:
            x = y = shelf = 0
            ok = True
            placed = []
            for c in order:
                w, h = c.img.size
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
                tex = Image.new("RGBA", (tw, th), TRANSPARENT)
                for c, px, py in placed:
                    c.uv = (px, py)
                    tex.paste(c.img, (px, py))
                self.texture = tex
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
            bones.append(jb)
        return {
            "format_version": "1.12.0",
            "minecraft:geometry": [{
                "description": {
                    "identifier": f"geometry.overlord.{self.name}",
                    "texture_width": self.texture.width,
                    "texture_height": self.texture.height,
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
        K = self.HD
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
                        if bb.rotation:
                            pts = apply(pts, bb.rotation, bb.pivot)
                        bb = bones.get(bb.parent) if bb.parent else None
                    pts = pts @ cam.T
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
