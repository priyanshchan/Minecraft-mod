#!/usr/bin/env python3
"""Draws the add-on's 3D weapons as they are held: in third person on the player's skeleton, and in first
person from the player's eye, using the same bone chain and hold animations the game uses.

The first-person arm uses the transform the game applies to the right arm in first person: rotation
(95, -45, 115) and translation (13.5, -10, 12), with the item bone moved (0, 0, -1), as documented in the
Bedrock wiki's attachables guide (Bedrock-OSS/bedrock-wiki, docs/items/attachables.md). The third-person arm
is raised 18 degrees, as when holding an item.

Usage:  python3 tools/weapon_view.py [out_dir]     (default: dist/weapons)
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "gen"))

# The player skeleton: name -> (parent, pivot, cubes [(origin, size, colour)])
SKIN, SHIRT, PANTS = (196, 150, 118), (60, 140, 160), (60, 60, 120)
PLAYER = {
    "body": (None, (0, 24, 0), [((-4, 12, -2), (8, 12, 4), SHIRT)]),
    "head": ("body", (0, 24, 0), [((-4, 24, -4), (8, 8, 8), SKIN)]),
    "rightArm": ("body", (-5, 22, 0), [((-8, 12, -2), (4, 12, 4), SKIN)]),
    "rightItem": ("rightArm", (-6, 15, 1), []),
    "leftArm": ("body", (5, 22, 0), [((4, 12, -2), (4, 12, 4), SKIN)]),
    "rightLeg": (None, (-1.9, 12, 0), [((-3.9, 0, -2), (4, 12, 4), PANTS)]),
    "leftLeg": (None, (1.9, 12, 0), [((-0.1, 0, -2), (4, 12, 4), PANTS)]),
}
FIRST_PERSON_ARM = {"rightArm": ((95, -45, 115), (13.5, -10, 12)), "rightItem": ((0, 0, 0), (0, 0, -1))}
THIRD_PERSON_ARM = {"rightArm": ((-18, 0, 0), (0, 0, 0))}


def rot_matrix(rx, ry, rz):
    """Bedrock bone rotation: X and Z rotate left-handed, Y right-handed (as modelkit renders it)."""
    ax, ay, az = math.radians(-rx), math.radians(ry), math.radians(-rz)
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return mz @ my @ mx


def transform(points, bone, bones, anim):
    """Model-space points of a bone, through its own animation and every parent's."""
    while bone is not None:
        parent, pivot, rotation = bones[bone]
        rot, pos = anim.get(bone, ((0, 0, 0), (0, 0, 0)))
        total = tuple(a + b for a, b in zip(rotation or (0, 0, 0), rot))
        p = np.array(pivot, float)
        points = (points - p) @ rot_matrix(*total).T + p + np.array(pos, float)
        bone = parent
    return points


class Canvas:
    def __init__(self, w, h, bg=(40, 42, 52)):
        self.w, self.h = w, h
        self.color = np.zeros((h, w, 3), np.float32)
        self.color[:] = bg
        self.depth = np.full((h, w), 1e9, np.float32)

    def quad(self, scr, z, sample, light):
        """scr: 3 screen points (tl, tr, bl); z: their depths; sample(s, t) -> (rgb, mask)."""
        o, a, b = scr
        e1, e2 = a - o, b - o
        det = e1[0] * e2[1] - e1[1] * e2[0]
        if abs(det) < 1e-9:
            return
        xs = [o[0], a[0], b[0], a[0] + e2[0]]
        ys = [o[1], a[1], b[1], a[1] + e2[1]]
        x0, x1 = max(0, int(min(xs))), min(self.w - 1, int(max(xs)) + 1)
        y0, y1 = max(0, int(min(ys))), min(self.h - 1, int(max(ys)) + 1)
        if x0 > x1 or y0 > y1:
            return
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        rx, ry = gx - o[0], gy - o[1]
        s = (rx * e2[1] - ry * e2[0]) / det
        t = (e1[0] * ry - e1[1] * rx) / det
        inside = (s >= 0) & (s < 1) & (t >= 0) & (t < 1)
        zz = z[0] + s * (z[1] - z[0]) + t * (z[2] - z[0])
        rgb, mask = sample(np.clip(s, 0, 0.9999), np.clip(t, 0, 0.9999))
        sub_d = self.depth[y0:y1 + 1, x0:x1 + 1]
        sub_c = self.color[y0:y1 + 1, x0:x1 + 1]
        m = inside & mask & (zz < sub_d)
        sub_c[m] = np.clip(rgb[m] * light, 0, 255)
        sub_d[m] = zz[m]

    def image(self):
        return Image.fromarray(self.color.astype(np.uint8), "RGB")


def faces(origin, size, inflate=0.0):
    x0, y0, z0 = (origin[i] - inflate for i in range(3))
    x1, y1, z1 = (origin[i] + size[i] + inflate for i in range(3))
    w, h, d = size
    return [  # (tl, tr, bl, (u, v, w, h) offsets from cube uv, light)
        ((x0, y1, z0), (x1, y1, z0), (x0, y0, z0), (d, d, w, h), 1.0),
        ((x1, y1, z1), (x0, y1, z1), (x1, y0, z1), (2 * d + w, d, w, h), 0.7),
        ((x0, y1, z1), (x0, y1, z0), (x0, y0, z1), (0, d, d, h), 0.82),
        ((x1, y1, z0), (x1, y1, z1), (x1, y0, z0), (d + w, d, d, h), 0.82),
        ((x0, y1, z1), (x1, y1, z1), (x0, y1, z0), (d, 0, w, d), 1.12),
        ((x0, y0, z0), (x1, y0, z0), (x0, y0, z1), (d + w, 0, w, d), 0.6),
    ]


def draw(canvas, project, model, hold, arm, show_body=True):
    """Draws the player (or just the arm) and a weapon model held with `hold` (bone -> (rotation, position))."""
    bones = {name: (parent, pivot, None) for name, (parent, pivot, _c) in PLAYER.items()}
    for b in model.bones:
        if b.name not in bones:
            bones[b.name] = (b.parent, b.pivot, b.rotation)
    anim = dict(arm)
    anim.update(hold)
    for name, (parent, pivot, cubes) in PLAYER.items():
        if not show_body and name not in ("rightArm",):
            continue
        for origin, size, col in cubes:
            for tl, tr, bl, _uv, light in faces(origin, size):
                pts = transform(np.array([tl, tr, bl], float), name, bones, anim)
                scr, z = project(pts)
                if scr is None:
                    continue
                canvas.quad(scr, z, lambda s, t, col=col: (np.broadcast_to(np.array(col, np.float32), s.shape + (3,)), np.ones(s.shape, bool)), light)
    tex = np.asarray(model.hd()).astype(np.float32)
    K = model.HD
    for b in model.bones:
        for c in b.cubes:
            u, v = c.uv
            for tl, tr, bl, (du, dv, tw, th), light in faces(c.origin, c.size, c.inflate):
                if tw == 0 or th == 0:
                    continue
                pts = np.array([tl, tr, bl], float)
                if c.rotation:
                    pv = np.array(c.pivot or (0, 0, 0), float)
                    pts = (pts - pv) @ rot_matrix(*c.rotation).T + pv
                pts = transform(pts, b.name, bones, anim)
                scr, z = project(pts)
                if scr is None:
                    continue

                def sample(s, t, u=u + du, v=v + dv, tw=tw, th=th):
                    tx = np.clip(((u + s * tw) * K).astype(int), 0, tex.shape[1] - 1)
                    ty = np.clip(((v + t * th) * K).astype(int), 0, tex.shape[0] - 1)
                    px = tex[ty, tx]
                    return px[..., :3], px[..., 3] > 0
                canvas.quad(scr, z, sample, light)


def third_person(model, hold, size=(360, 420), yaw=-60.0, pitch=12.0, scale=7.0):
    canvas = Canvas(*size)
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    cam = np.array([[1, 0, 0], [0, cp, sp], [0, -sp, cp]]) @ np.array([[cy, 0, -sy], [0, 1, 0], [sy, 0, cy]])

    def project(pts):
        q = pts @ cam.T
        scr = np.stack([q[:, 0] * scale + size[0] / 2, size[1] - 50 - q[:, 1] * scale], axis=1)
        return scr, q[:, 2]
    draw(canvas, project, model, hold, THIRD_PERSON_ARM)
    return canvas.image()


def first_person(model, hold, size=(480, 300), fov=70.0):
    canvas = Canvas(*size, bg=(118, 168, 220))
    # In first person the arm is drawn as seen from the head's pivot looking along +z, +x to the right:
    # this is the frame in which the wiki's first-person arm transform puts the hand at the lower right
    # with the shoulder out of sight, as in the game.
    eye = np.array([0.0, 24.0, 0.0])
    f = (size[1] / 2) / math.tan(math.radians(fov / 2))

    def project(pts):
        q = pts - eye
        depth = q[:, 2]
        if np.any(depth < 0.5):
            return None, None
        scr = np.stack([size[0] / 2 + q[:, 0] / depth * f, size[1] / 2 - q[:, 1] / depth * f], axis=1)
        return scr, depth
    draw(canvas, project, model, hold, FIRST_PERSON_ARM, show_body=False)
    img = canvas.image()
    ImageDraw.Draw(img).line([(size[0] / 2 - 6, size[1] / 2), (size[0] / 2 + 6, size[1] / 2)], fill=(255, 255, 255))
    ImageDraw.Draw(img).line([(size[0] / 2, size[1] / 2 - 6), (size[0] / 2, size[1] / 2 + 6)], fill=(255, 255, 255))
    return img
