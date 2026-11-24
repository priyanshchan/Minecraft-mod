"""v11.1: the people of the world, redrawn in the companions' anime style (all art is original).

Every humanoid NPC - the Guardians and Pleiades of Nazarick, the heroes and villains of the New World, and the
guards, soldiers, priests and bandits on its roads - is built on the companions' skeleton (companions.py): pixel
shading, an anime face, hair in 3D locks, clothes and gear in layers. Each keeps the size it always had (the
head's top at 32 units, like the old models) and the bones its animations move (a robe that sways, a cape, a tail,
wings).
"""
from __future__ import annotations

import math

import numpy as np

from modelkit import shade, mix
import companions as _cmp
from companions import (
    Figure, R, GOLD, GOLD_L, GOLD_D, SILVER, SILVER_L, SILVER_D, LEATHER, LEATHER_D, LEATHER_L, BONE, BONE_D, WOOD, WOOD_D,
    paint, toon, toon_metal, toon_leather, toon_hair, pixel_shade, hollow, sides, paint_skin, paint_face, hair_style,
    clothe, wrap, belt, flared_skirt, robe, sleeves, cuffs, gloves, boots, stockings, trousers, pauldrons, cape, tabard,
    bow_tie, collar, hood, circlet, veil, mask, helm, wizard_hat, cap, headband, crown, ribbon, horns, bat_wings,
    feather_wings, halo, elf_ears, sword, katana, staff, scythe, spear, axe, mace, dagger, curved_blade, bow, shield,
    book, quiver, lute, wraps, beads, plate, faulds, emblem_cross, emblem_sun, emblem_skull, lock, chain, Hand, blade,
    grip, bust, _rot, fashion,
)

H = Figure.HEAD


# ------------------------------------------------------------------------------------------ pieces of dress
def maid(fig, dress="#1f1e28", white="#f4f3f5", length=10, legs="#1a1820", apron=True, sleeves_puff=True, cap_=True, armoured=False):
    """A Nazarick maid's uniform: a long dark dress, a white apron and bib, a collar bow, a frilled headdress."""
    clothe(fig, dress, dress, legs, neckline="high", trim=white)
    flared_skirt(fig, dress, length, white, 12 if length > 6 else 18)
    if apron:
        hips = fig.segs[2]
        a = (fig.skirt_bone or fig.body).cube((-2.5, hips[5] - length + 1.5, fig.front - 1.3 - (0.9 if fig.female else 0)), (5, length - 2, 1),
                                               rotation=(-8, 0, 0), pivot=(0, hips[5], fig.front))
        toon(a, white)
        with paint(a.front) as p:
            p.rect(0, p.h - 0.6, p.w, p.h, shade(white, 0.85))
        bib = fig.body.cube((-2, 17, fig.front - 0.6 - (1.0 if fig.female else 0)), (4, 6, 1))
        toon(bib, white)
    if sleeves_puff:
        sleeves(fig, dress, 4, white, flare=0.6)
    if not armoured:  # an armoured maid's gauntlets and greaves take the place of cuffs and shoes
        cuffs(fig, white, 2, "cloth")
        boots(fig, "#121016", 2, heel=fig.female)
    bow_tie(fig, white if dress != white else "#1f1e28")
    stockings(fig, legs, 11)
    if cap_:
        hd = fig.head.cube((-3.5, 24 + H - 0.5, -2), (7, 1, 3), rotation=(-25, 0, 0), pivot=(0, 24 + H, -1))
        toon(hd, white)
        with paint(hd.front) as p:
            for x in range(0, p.img.width, 2):
                p.px(x, 0, shade(white, 0.8))


def battle_armour(fig, metal="#c9ced6", trim=GOLD):
    """The Pleiades' armour over their uniforms: gauntlets, greaves and plates on the skirt."""
    cuffs(fig, metal, 5, "metal", trim)
    boots(fig, metal, 6, kind="metal", heel=fig.female)
    pauldrons(fig, metal, trim, layers=1)


def suit(fig, jacket, shirt="#f4f3f5", tie="#b3141c", trousers_color=None, shoes="#1a1418", tails=False, vest=None):
    """A gentleman's suit: jacket open over shirt and tie, trousers and polished shoes; a butler's has tails."""
    clothe(fig, shirt, trousers_color or jacket, trousers_color or jacket, sleeve=jacket, neckline="high")
    coat = wrap(fig, 13, 24, jacket, "cloth", 0.3, chest=False)
    with paint(coat[0].front) as p:
        cx = p.w / 2
        p.poly([(cx - 1.6, 0), (cx + 1.6, 0), (cx + 0.6, p.h), (cx - 0.6, p.h)], shirt)
        p.rect(cx - 0.35, 0.4, cx + 0.35, p.h - 0.5, tie)
        if vest:
            p.rect(cx - 1.2, 2.5, cx - 0.4, p.h, vest).rect(cx + 0.4, 2.5, cx + 1.2, p.h, vest)
    for c in coat[1:]:
        with paint(c.front) as p:
            p.rect(p.w / 2 - 0.5, 0, p.w / 2 + 0.5, p.h, shade(jacket, 0.8))
    for limb in fig.leg_l:
        t = limb.cube(2, limb.y1, 0.18)
        toon(t, trousers_color or jacket)
        hollow(t)
    boots(fig, shoes, 2)
    if tails:
        for sx in (-1, 1):
            t = fig.cape.cube((sx * 1.6 - 1.5, 9, fig.back + 0.1), (3, 6, 1), rotation=(8, 0, sx * 6), pivot=(sx * 1.6, 15, fig.back))
            toon(t, jacket)


def glasses(fig, frame="#c9a53c"):
    """Spectacles: two thin frames before the eyes and a bridge."""
    for x0 in (-3.2, 0.7):
        g = fig.head.cube((x0, 26.4, -H / 2 - 0.55), (3, 2, 1), inflate=-0.4)
        for f in g.faces:
            with paint(f) as p:
                p.clear()
                if f is g.front or f is g.back:
                    W, Hh = p.img.width, p.img.height
                    for x in range(W):
                        p.px(x, 0, frame).px(x, Hh - 1, frame)
                    for y in range(Hh):
                        p.px(0, y, frame).px(W - 1, y, frame)
    br = fig.head.cube((-0.5, 27.3, -H / 2 - 0.55), (1, 1, 1), inflate=-0.42)
    toon(br, frame)


def eyepatch(fig, color="#2a3324", left=False):
    with paint(fig.skull.front) as p:
        x0 = 5 if left else 1
        p.rect(x0, 3.5, x0 + 2, 6, color)
        p.line([(0, 3.2), (8, 4.6) if not left else (0, 4.6)], shade(color, 0.8))


def demon_tail(fig, color="#c9ced6", tip="#e0b040", length=5):
    """A tail of plated segments with a spade at its end (Demiurge)."""
    bone = fig.tail
    point = np.array([0.0, fig.segs[2][4] + 1.0, fig.back + 0.2])
    for i in range(length):
        rot = (35 + i * 8, 0, (-1) ** i * 6)
        c = bone.cube((point[0] - 0.5, point[1] - 2, point[2] - 0.5), (1, 2, 1), rotation=rot, pivot=tuple(point), inflate=0.15 - i * 0.03)
        toon_metal(c, color)
        point = point + _rot(*rot) @ np.array([0, -1.7, 0])
    spade = bone.cube((point[0] - 1, point[1] - 2, point[2] - 0.5), (2, 2, 1), rotation=(70, 0, 45), pivot=tuple(point))
    toon_metal(spade, tip)


def military_cap(fig, color, badge=GOLD):
    fig.headwear = True
    c = fig.head.cube((-H / 2, 24 + H - 2, -H / 2), (H, 3, H), inflate=0.6)
    toon(c, color)
    with paint(c.bottom) as p:
        p.clear()
    with paint(c.front) as p:
        p.rect(p.w / 2 - 0.6, 0.6, p.w / 2 + 0.6, 1.6, badge)
    peak = fig.head.cube((-3, 24 + H - 2.4, -H / 2 - 2.2), (6, 1, 2))
    toon(peak, shade(color, 0.6))


def wide_hat(fig, color, band=None, wide=6):
    fig.headwear = True
    y = 24 + H - 0.4
    brim = fig.head.cube((-wide, y, -wide), (wide * 2, 1, wide * 2))
    toon(brim, color)
    with paint(brim.top) as p:
        p.clear()
        p.ellipse(0, 0, p.w, p.h, shade(color, 1.1))
    with paint(brim.bottom) as p:
        p.clear()
        p.ellipse(0, 0, p.w, p.h, shade(color, 0.6))
    crown_ = fig.head.cube((-H / 2 + 0.5, y + 1, -H / 2 + 0.5), (H - 1, 3, H - 1))
    toon(crown_, color)
    if band:
        for f in sides(crown_):
            with paint(f) as p:
                p.rect(0, p.h - 1, p.w, p.h, band)


def skull_face(fig, glow="#e0202c"):
    """A bare skull for a face and bone hands (the Sorcerer King)."""
    with paint(fig.skull.front) as p:
        p.fill(BONE)
        p.rect(0, 0, 8, 1, shade(BONE, 1.05))
        p.ellipse(0.8, 3.0, 3.6, 5.6, "#0c0a10").ellipse(4.4, 3.0, 7.2, 5.6, "#0c0a10")
        p.rect(1.8, 3.9, 2.6, 4.6, glow).rect(5.4, 3.9, 6.2, 4.6, glow)
        p.poly([(3.6, 5.8), (4.4, 5.8), (4.0, 6.6)], "#2a2024")
        for x in range(2, 6):
            p.rect(x + 0.1, 6.9, x + 0.9, 7.9, shade(BONE, 0.92)).line([(x, 6.9), (x, 7.9)], "#3a2f2a")
    for f in (fig.skull.right, fig.skull.left, fig.skull.back, fig.skull.top):
        with paint(f) as p:
            pixel_shade(p, BONE, light=0.8, span=1.2, edge=0.5, dither=False)
    for c in fig.arms_c:
        for f in c.faces:
            with paint(f) as p:
                p.rect(0, p.h - 1.5, p.w, p.h, BONE)
                for x in range(0, p.img.width, 2):
                    p.px(x, p.img.height - 1, shade(BONE, 0.7))


def egg_face(fig):
    """A doppelganger's face: smooth and round as an egg, three dark holes for eyes and mouth (Pandora's Actor)."""
    egg = "#f2d8c6"
    with paint(fig.skull.front) as p:
        p.fill(egg)
        p.ellipse(1.5, 3.2, 3.2, 5.4, "#120c10").ellipse(4.8, 3.2, 6.5, 5.4, "#120c10")
        p.ellipse(3.2, 6.0, 4.8, 7.4, "#120c10")
    for f in (fig.skull.right, fig.skull.left, fig.skull.back, fig.skull.top):
        with paint(f) as p:
            pixel_shade(p, egg, light=1.0, span=1.0, edge=0.4, dither=False)


def tattoos(fig, ink="#2a3a6a"):
    """Bare arms and chest marked with tattoos (Zero of the Six Arms)."""
    for c in fig.arms_c:
        for f in (c.right, c.left, c.front):
            with paint(f) as p:  # bands of script down the arms
                for k in (2, 3, 5.5, 6.5):
                    p.line([(0, k), (p.w, k + 0.6)], ink)
    with paint(fig.torso[0].front) as p:  # a sigil over the heart
        p.line([(1.5, 1.5), (3, 3.5), (1.5, 5.5)], ink).line([(3, 3.5), (5.5, 3.5)], ink)


def halberd(fig, steel="#2a2230", edge="#6a4a9a", shaft="#1a1420"):
    """A great black halberd (Albedo's Ginnungagap): a long shaft, a crescent axe and a spike."""
    h = staff(fig, "none", shaft, trim=edge, height=30)
    x = h.x
    blade(h.cube((x, 26, -8), (1, 6, 4)), steel, glow=edge)
    blade(h.cube((x, 27, -10), (1, 4, 2)), steel)
    blade(h.cube((x, 30, -4), (1, 5, 1)), steel)
    toon_metal(h.cube((x - 0.25, 25, -3.75), (1, 2, 1), inflate=0.3), edge)


def lance(fig, color="#f1eff2", tip="#c2171d"):
    """A long jousting lance (Shalltear's Spuit Lance): a tapering white cone and a red point."""
    h = Hand(fig, fig.weapon, fig.hx - 0.5)
    x = h.x
    grip(h.cube((x, 12.5, -4), (1, 1, 4)), "#2a2028")
    toon_metal(h.cube((x - 1, 11.5, -6), (3, 3, 2)), color)
    for i, (w, ln) in enumerate(((3, 4), (2, 5), (1, 5))):
        c = h.cube((x - (w - 1) / 2, 13 - w / 2, -6 - 4 * i - ln), (w, w, ln))
        toon_metal(c, color)
    blade(h.cube((x, 12.5, -21), (1, 1, 3)), tip)


def whip(fig, color="#6b4a36"):
    """A coiled whip at the hip and its handle in hand (Aura)."""
    h = Hand(fig, fig.weapon, fig.hx - 0.5)
    x = h.x
    grip(h.cube((x, 12.5, -6), (1, 1, 4)), "#2a1a10", GOLD)
    for k in range(4):
        loop = h.cube((x - 0.25, 8 - k * 0.9, -4 - k * 0.6), (1, 1, 3), rotation=(0, 30 * k, 0), pivot=(x, 8, -4), inflate=-0.2)
        toon_leather(loop, color, stitch=False)


def rifle(fig, body="#2a3324", metal="#4a4a52"):
    """A long gun (CZ2128 Delta)."""
    h = Hand(fig, fig.weapon, fig.hx - 0.5)
    x = h.x
    toon(h.cube((x - 0.5, 11, -6), (2, 3, 5)), body)
    toon_metal(h.cube((x, 12.5, -18), (1, 1, 12)), metal)
    toon(h.cube((x - 0.5, 9, -3), (2, 3, 2)), shade(body, 0.8))
    toon_metal(h.cube((x - 0.5, 14, -9), (2, 1, 3)), metal)


def gauntlets(fig, metal="#3a3a44", spikes=SILVER):
    """Great spiked gauntlets (Yuri Alpha)."""
    for limb in fig.arm_l:
        g = limb.cube(limb.y0 - 0.5, limb.y0 + 4, 0.55)
        toon_metal(g, metal)
        for k in range(3):
            sp = limb.bone.cube((limb.x0 + limb.w / 2 - 0.5, limb.y0 + 0.5 + k * 1.2, limb.z0 - 1.6), (1, 1, 1))
            toon_metal(sp, spikes)


def potion_bag(fig):
    b = fig.body.cube((-4.5, 10, -1.5), (2, 3, 3))
    toon_leather(b, LEATHER)
    for k, c in enumerate(("#e0303a", "#3aa0e0", "#63c05b")):
        v = fig.body.cube((-4.2 + k * 0.1, 13, -1 + k * 0.8), (1, 1, 1), inflate=-0.1)
        toon(v, c)


def stilettos(fig):
    for bone, x in ((fig.weapon, fig.hx - 0.5), (fig.offhand, fig.ox - 0.5)):
        h = Hand(fig, bone, x)
        grip(h.cube((x, 12.5, -4.5), (1, 1, 2)), "#2a2028")
        blade(h.cube((x, 12.75, -12), (1, 1, 7), inflate=-0.25), "#e8ecf2")


def scale_cloak(fig, color="#c9a53c"):
    """A cloak sewn with the plates of slain adventurers (Clementine)."""
    c = fig.cape.cube((-3.5, 12, fig.back + 0.25), (7, 12, 1), rotation=(8, 0, 0), pivot=(0, 24, fig.back))
    toon(c, "#2a2028")
    with paint(c.back) as p:
        for y in range(0, int(p.h), 2):
            for x in range(0, int(p.w), 2):
                tone = (color, "#c9ced6", "#b87333", "#e8ecf2")[(x + y) % 4]
                p.rect(x + 0.2 + (y % 4) * 0.25, y + 0.2, x + 1.6, y + 1.6, tone)


# ------------------------------------------------------------------------------------------ the people
MODEST = {"aura", "mare", "entoma", "shalltear", "evileye", "cz_delta", "enri", "neia"}  # young: dressed as they are


def build_person(name, look, dress, bones=()):
    def make():
        fig = Figure(0, look, name=name, bones=bones, modest=name in MODEST)
        paint_skin(fig)
        paint_face(fig)
        dress(fig, look)
        fashion(fig)
        if fig.female and not look.get("flat") and not (fig.modest and _cmp.FASHION) and fig.chest:
            color, kind, inflate = fig.chest
            bust(fig, color, kind, inflate)
        return fig.m
    make.__name__ = name
    return make


def L(**kw):
    return kw


def _albedo(f, L_):
    clothe(f, "#f4f2f2", "#f4f2f2", "#f4f2f2", neckline="v", trim=GOLD)
    robe(f, "#f4f2f2", GOLD, 11, 10)
    sleeves(f, "#f4f2f2", 5, GOLD, wide=True)
    gloves(f, "#f4f2f2")
    collar(f, GOLD)
    hair_style(f)
    horns(f, "#f4f0e2", "#d8d0b8", curl=0.9)
    feather_wings(f, "#1a1622", "#3a2f4a", 1.1)
    halberd(f)


def _shalltear(f, L_):
    clothe(f, "#1a1420", "#1a1420", "#1a1420", neckline="high", trim="#c2171d")
    flared_skirt(f, "#1a1420", 10, "#c2171d", 24, second="#f4f1ea")
    sleeves(f, "#1a1420", 5, "#c2171d", wide=True)
    gloves(f, "#f4f1ea")
    bow_tie(f, "#c2171d")
    boots(f, "#1a1420", 2, heel=True)
    hair_style(f)
    ribbon(f, "#1a1420", (0, 24 + H + 0.8, 1))
    lance(f)


def _demiurge(f, L_):
    suit(f, "#c8642a", "#f4f3f5", "#2a2028", "#c8642a", "#2a1a14", vest="#7a3a1a")
    with paint(f.torso[0].front) as p:  # pinstripes
        for x in range(0, p.img.width, 3):
            for y in range(0, p.img.height, 2):
                p.blend(x, y, "#ffffff", 0.15)
    hair_style(f)
    glasses(f, "#c9a53c")
    demon_tail(f)


def _sebas(f, L_):
    suit(f, "#1f1e28", "#f4f3f5", "#1f1e28", "#1f1e28", tails=True, vest="#3a3a44")
    gloves(f, "#f4f3f5")
    hair_style(f)


def _narberal(f, L_):
    maid(f, "#1f1e28", "#f4f3f5", 10, armoured=True)
    battle_armour(f, "#c9ced6", GOLD)
    hair_style(f)


def _lupusregina(f, L_):
    maid(f, "#2a2030", "#f4f3f5", 9, armoured=True)
    veil(f, "#2a2030", band="#f4f3f5", length=10)
    battle_armour(f, "#c9ced6", "#c2171d")
    hair_style(f)
    h = staff(f, "holy", "#e8e4dc", "#ffe48a", GOLD, 32)


def _entoma(f, L_):
    maid(f, "#3a2a1e", "#f0d8a8", 9, apron=True, armoured=True)
    sleeves(f, "#c84a2a", 5, "#f0d8a8", wide=True)
    battle_armour(f, "#6a4a3a", GOLD)
    hair_style(f)
    for sx in (-1, 1):  # insect legs folded at her back
        for k in range(2):
            leg = f.body.cube((sx * 1.5 - 0.5, 18 - k * 2, f.back + 0.5), (1, 5, 1), rotation=(40, 0, sx * (60 + k * 25)), pivot=(sx * 1.5, 18 - k * 2, f.back + 0.5))
            toon(leg, "#3a2a1e")


def _solution(f, L_):
    maid(f, "#1f1e28", "#f4f3f5", 10, armoured=True)
    battle_armour(f, "#d8d0c0", GOLD)
    hair_style(f)


def _yuri(f, L_):
    maid(f, "#1f1e28", "#f4f3f5", 10, armoured=True)
    boots(f, "#3a3a44", 6, kind="metal", heel=True)
    pauldrons(f, "#3a3a44", SILVER, layers=1)
    gauntlets(f)
    hair_style(f)
    glasses(f, "#2a2a33")


def _cz(f, L_):
    maid(f, "#2a3324", "#f2f1f3", 6, armoured=True)
    battle_armour(f, "#6b7a4a", "#4a5633")
    hair_style(f)
    eyepatch(f, "#2a3324")
    rifle(f)


def _maid(f, L_):
    maid(f, "#1f1e28", "#f4f3f5", 10, cap_=True)
    hair_style(f)


def _aura(f, L_):
    clothe(f, "#f4f1ea", "#2a2a33", f.look["skin"], sleeve="#f4f1ea", neckline="round")
    vest_ = wrap(f, 15, 24, "#b3241c", "cloth", 0.3)
    for limb in f.leg_l:  # shorts
        s = limb.cube(9, limb.y1, 0.25)
        toon(s, "#2a2a33")
        hollow(s)
    belt(f, LEATHER_D, GOLD)
    gloves(f, "#f4f1ea")
    boots(f, "#6b4a36", 5, cuff=GOLD)
    elf_ears(f)
    hair_style(f)
    whip(f)


def _mare(f, L_):
    clothe(f, "#f4f1ea", "#3a6a3a", f.look["skin"], sleeve="#f4f1ea", neckline="round")
    wrap(f, 15, 24, "#3a6a3a", "cloth", 0.3)
    flared_skirt(f, "#3a6a3a", 6, GOLD, 18, second="#f4f1ea")
    stockings(f, "#f4f1ea", 10)
    boots(f, "#6b4a36", 3)
    elf_ears(f)
    hair_style(f)
    staff(f, "crystal", "#5a3a22", "#63ff6b", GOLD, 31)


def _pandora(f, L_):
    clothe(f, "#c9b04a", "#2a2a33", "#2a2a33", neckline="high")
    coat = wrap(f, 12, 24, "#c9b04a", "cloth", 0.32)
    with paint(coat[0].front) as p:
        for y in (1, 2.5, 4):
            p.rect(p.w / 2 - 1.5, y, p.w / 2 - 0.9, y + 0.6, GOLD).rect(p.w / 2 + 0.9, y, p.w / 2 + 1.5, y + 0.6, GOLD)
    flared_skirt(f, "#c9b04a", 5, GOLD, 8, pleats=False)
    belt(f, "#2a2a33", GOLD)
    boots(f, "#1a1418", 7)
    gloves(f, "#f4f3f5")
    pauldrons(f, GOLD, GOLD_D, layers=1)
    hair_style(f)
    egg_face(f)
    military_cap(f, "#c9b04a")


def _gazef(f, L_):
    clothe(f, "#3a3a44", "#2a2420", "#2a2420", neckline="high")
    plate(f, "#8a9098", GOLD)
    pauldrons(f, "#8a9098", GOLD)
    cuffs(f, "#8a9098", 4, "metal")
    boots(f, "#5a5048", 6, cuff="#3a3028")
    belt(f, LEATHER_D, GOLD)
    hair_style(f)
    sword(f, 15, "#e8ecf2", GOLD, glow="#9fd4ff")


def _clementine(f, L_):
    clothe(f, "#2a2028", "#2a2028", f.look["skin"], neckline="v", sleeve_to=7)
    wrap(f, 15, 24, "#3a3038", "leather", 0.3)
    flared_skirt(f, "#2a2028", 3, "#c9a53c", 20)
    stockings(f, "#1a1418", 10)
    boots(f, "#2a2028", 8, heel=True)
    scale_cloak(f)
    hair_style(f)
    stilettos(f)


def _brain(f, L_):
    clothe(f, "#3a5a8a", "#2a2a33", "#2a2a33", neckline="v")
    coat = wrap(f, 12, 24, "#2a3a5a", "cloth", 0.3)
    with paint(coat[0].front) as p:
        p.clear(p.w / 2 - 1, 0, p.w / 2 + 1, p.h)
    flared_skirt(f, "#2a3a5a", 6, None, 6, pleats=False)
    belt(f, LEATHER_D, SILVER)
    boots(f, "#2a2420", 5)
    hair_style(f)
    katana(f, 16)


def _nfirea(f, L_):
    clothe(f, "#6a7a4a", "#4a3a2a", "#4a3a2a", neckline="round")
    wrap(f, 14, 24, "#8a7a5a", "cloth", 0.3)
    belt(f, LEATHER_D, GOLD_D)
    potion_bag(f)
    boots(f, "#4a3020", 4)
    hair_style(f)


def _evileye(f, L_):
    clothe(f, "#8f1a1f", "#8f1a1f", "#1b1a22", neckline="high")
    robe(f, "#8f1a1f", GOLD, 9, 10)
    cape(f, "#5a0d11", 17, GOLD, lining="#1b1a22")
    gloves(f, "#1b1a22")
    hair_style(f)
    mk = f.head.cube((-H / 2, 24, -H / 2 - 0.55), (H, 6, 1))
    toon(mk, "#f1ede4")
    with paint(mk.front) as p:
        p.rect(1.5, 2.5, 3.2, 3.2, "#15131a").rect(4.8, 2.5, 6.5, 3.2, "#15131a")
        p.line([(1, 4.5), (2.5, 5.5)], "#e0202c").line([(7, 4.5), (5.5, 5.5)], "#e0202c")
    wide_hat(f, "#5a0d11", GOLD, 6)


def _fluder(f, L_):
    clothe(f, "#3a2a6a", "#3a2a6a", "#2a2040", neckline="v", trim=GOLD)
    robe(f, "#3a2a6a", GOLD, 11, 7, second=GOLD)
    sleeves(f, "#3a2a6a", 6, GOLD, wide=True)
    belt(f, LEATHER_D, GOLD, sash="#6a4a9f", pouch=False)
    hair_style(f)
    if not _cmp.FASHION:
        lock(f, (0, 25, -H / 2 - 0.9), 5, 9, 1, (6, 0, 0), "point")  # the long white beard
    staff(f, "orb", WOOD_D, "#59d0ff", GOLD)


def _ainz(f, L_):
    clothe(f, "#2b1a3d", "#2b1a3d", "#1c1029", neckline="high", trim=GOLD)
    robe(f, "#2b1a3d", GOLD, 11, 8, second="#b3141c")
    sleeves(f, "#2b1a3d", 6, GOLD, wide=True)
    for sx in (-1, 1):  # the high collar of the Sorcerer King's robe, spiked with gold
        for k in range(3):
            sp = f.body.cube((sx * 3.5 - 0.5, 23 + k * 2, -1 + k * 0.5), (1, 3, 1), rotation=(-10, 0, sx * -(20 + k * 12)), pivot=(sx * 3.5, 23, 0))
            toon_metal(sp, GOLD)
    cape(f, "#1c1029", 20, GOLD, lining="#b3141c")
    orb = f.body.cube((-1, 15, f.front - 1.4), (2, 2, 1), inflate=0.2)
    toon(orb, "#b3141c", light=1.3)
    skull_face(f, "#ff3a2e")
    staff(f, "orb", "#2a1a3d", "#c05bff", GOLD, 31)


def _vampire_bride(f, L_):
    clothe(f, "#f1eff2", "#f1eff2", "#e8e4ec", neckline="v")
    robe(f, "#f1eff2", "#c2171d", 11, 9)
    sleeves(f, "#f1eff2", 5, None, wide=True)
    hair_style(f)
    with paint(f.skull.front) as p:  # fangs
        p.rect(3.5, 7, 3.5 + 1 / R, 7 + 1 / R, "#ffffff").rect(4.5, 7, 4.5 + 1 / R, 7 + 1 / R, "#ffffff")


def _dwarf(f, L_):
    clothe(f, "#6a4a2a", "#4a3a2a", "#4a3a2a", neckline="round")
    plate(f, "#8a8a92", GOLD)
    belt(f, LEATHER_D, GOLD)
    cuffs(f, "#8a8a92", 4, "metal")
    boots(f, "#4a3020", 5, cuff="#8a7558")
    hair_style(f)
    helm(f, "#8a8a92", GOLD, visor=False, open_face=True, horns="#e9e3cf")
    axe(f, double=True)


def _generic_soldier(metal, cloth, weapon, helmet=True, shield_kind=None, cape_=True, crest=GOLD, plume=None):
    def dress(f, L_):
        clothe(f, cloth, shade(cloth, 0.7), "#2a2a33", neckline="high")
        plate(f, metal, crest)
        faulds(f, metal, crest)
        pauldrons(f, metal, crest, layers=1)
        cuffs(f, metal, 4, "metal")
        boots(f, metal, 6, kind="metal")
        tabard(f, cloth, crest, emblem_cross(crest), 12)
        if cape_:
            cape(f, cloth, 16, crest)
        hair_style(f)
        if helmet:
            helm(f, metal, crest, plume=plume, visor=False, open_face=True)
        weapon(f)
        if shield_kind:
            shield(f, shield_kind, cloth, crest, emblem_cross(crest))
    return dress


def _adventurer(f, L_):
    clothe(f, "#5a6a3a", "#3a3228", "#3a3228", neckline="v")
    wrap(f, 13, 24, LEATHER, "leather", 0.3)
    belt(f, LEATHER_D, GOLD_D)
    cuffs(f, LEATHER_D, 3)
    boots(f, LEATHER_D, 5, cuff=LEATHER_L)
    cape(f, "#6a5a44", 13, ragged=True)
    hair_style(f)
    sword(f, 12)


def _bandit(f, L_):
    clothe(f, "#4a4038", "#2f2822", "#2f2822", neckline="v")
    coat = wrap(f, 13, 24, "#3a3028", "leather", 0.3)
    with paint(coat[0].front) as p:
        p.clear(p.w / 2 - 1, 0, p.w / 2 + 1, p.h)
    belt(f, LEATHER_D, SILVER_D)
    boots(f, "#2a2420", 5)
    hair_style(f)
    mask(f, "#2a2420")
    dagger(f, f.weapon, f.hx - 0.5, length=7)


def _archer(f, L_):
    clothe(f, "#3f66a8", "#3a3228", "#3a3228", neckline="v")
    wrap(f, 14, 24, LEATHER, "leather", 0.3)
    belt(f, LEATHER_D, GOLD)
    cuffs(f, LEATHER_D, 4)
    boots(f, LEATHER_D, 6)
    hair_style(f)
    cap(f, "#2a4a80", feather="#f4f1ea")
    quiver(f)
    bow(f)


def _priest(cloth, trim, orb, dark=False):
    def dress(f, L_):
        clothe(f, cloth, cloth, shade(cloth, 0.8), neckline="high", trim=trim)
        robe(f, cloth, trim, 11, 7)
        sleeves(f, cloth, 6, trim, wide=True)
        tabard(f, shade(cloth, 0.85) if not dark else trim, trim, emblem_sun(trim if not dark else cloth), 18)
        cape(f, shade(cloth, 0.9), 18, trim)
        hair_style(f)
        staff(f, "holy" if not dark else "orb", "#f4f1ea" if not dark else WOOD_D, orb, trim)
    return dress


def _climb(f, L_):
    clothe(f, "#3f66a8", "#2a4a80", "#2a2a33", neckline="high")
    plate(f, "#f1f4f8", GOLD)
    faulds(f, "#f1f4f8", GOLD)
    pauldrons(f, "#f1f4f8", GOLD)
    cuffs(f, "#f1f4f8", 4, "metal", GOLD)
    boots(f, "#f1f4f8", 6, kind="metal")
    cape(f, "#3f66a8", 17, GOLD)
    hair_style(f)
    sword(f, 13, guard=GOLD)
    shield(f, "kite", "#3f66a8", GOLD, emblem_cross(GOLD))


def _lakyus(f, L_):
    clothe(f, "#3a4fb0", "#27357a", "#27357a", neckline="high")
    plate(f, "#f1f4f8", GOLD)
    flared_skirt(f, "#3a4fb0", 5, GOLD, 18, second="#f1f4f8")
    pauldrons(f, "#f1f4f8", GOLD)
    cuffs(f, "#f1f4f8", 4, "metal", GOLD)
    boots(f, "#f1f4f8", 8, kind="metal", heel=True)
    cape(f, "#3a4fb0", 18, GOLD)
    hair_style(f)
    circlet(f, GOLD, gem="#59d0ff")
    sword(f, 14, "#2a2230", GOLD, glow="#7a3aff")


def _remedios(f, L_):
    clothe(f, "#b03030", "#7a1f1f", "#2a2a33", neckline="high")
    plate(f, "#f1f4f8", GOLD)
    flared_skirt(f, "#b03030", 5, GOLD, 16)
    pauldrons(f, "#f1f4f8", GOLD)
    cuffs(f, "#f1f4f8", 4, "metal", GOLD)
    boots(f, "#f1f4f8", 8, kind="metal")
    cape(f, "#b03030", 18, GOLD)
    hair_style(f)
    sword(f, 15, "#f4f6fa", GOLD, glow="#ffe48a")


def _neia(f, L_):
    clothe(f, "#3f4a5a", "#2a323f", "#2a323f", neckline="high")
    wrap(f, 14, 24, "#6a5238", "leather", 0.3)
    flared_skirt(f, "#3f4a5a", 4, "#d9c05a", 16)
    stockings(f, "#2a323f", 10)
    boots(f, "#463522", 7)
    cuffs(f, "#463522", 4)
    hair_style(f)
    v = f.head.cube((-H / 2, 28, -H / 2 - 0.5), (H, 1, 1), inflate=0.1)  # a visor band
    toon_metal(v, "#8a9098")
    quiver(f)
    bow(f, "#f4f1ea", "#ffe48a")


def _zesshi(f, L_):
    clothe(f, "#1b1a22", "#1b1a22", "#1b1a22", neckline="high")
    plate(f, "#35323f", "#e8e4ec")
    flared_skirt(f, "#1b1a22", 6, "#e8e4ec", 20)
    pauldrons(f, "#35323f", "#e8e4ec")
    cuffs(f, "#35323f", 4, "metal")
    stockings(f, "#0c0b10", 11)
    boots(f, "#35323f", 8, kind="metal", heel=True)
    hair_style(f)
    # her hair: white on one side and black on the other
    scythe(f, "#e8e4ec", "#1b1a22", "#e8e4ec")


def _zero(f, L_):
    clothe(f, f.look["skin"], "#3a3a44", "#3a3a44", sleeve=f.look["skin"], neckline="none")
    tattoos(f)
    belt(f, "#22222a", GOLD, sash="#22222a", pouch=False)
    trousers(f, "#3a3a44")
    wraps(f, "#2a2a33")
    boots(f, "#22222a", 2)
    hair_style(f)
    cape(f, "#22222a", 16)


def _khajiit(f, L_):
    clothe(f, "#5a1414", "#3a0c0c", "#2a0a0a", neckline="high", trim="#c9a53c")
    robe(f, "#5a1414", "#c9a53c", 11, 8)
    sleeves(f, "#5a1414", 6, "#c9a53c", wide=True)
    cape(f, "#2a0a0a", 18, "#c9a53c")
    beads(f, BONE_D, BONE)
    hair_style(f)
    staff(f, "orb", "#2a1414", "#7a1fff", "#c9a53c")


def _enri(f, L_):
    clothe(f, "#b03a2e", "#8a6a4a", f.look["skin"], neckline="round", sleeve_to=5)
    flared_skirt(f, "#8a6a4a", 8, "#5f4830", 12, pleats=False)
    a = f.body.cube((-2.5, 6, f.front - 1.4 - 0.9), (5, 9, 1), rotation=(-8, 0, 0), pivot=(0, 15, f.front))
    toon(a, "#f1e8d8")
    stockings(f, "#5f4830", 6)
    boots(f, "#5a3a22", 3)
    hair_style(f)


def _elf_ranger(f, L_):
    clothe(f, "#3f6a45", "#2a4a2f", "#2a4a2f", neckline="v")
    wrap(f, 14, 24, "#7a6a45", "leather", 0.3)
    belt(f, LEATHER_D, GOLD)
    cuffs(f, LEATHER, 4)
    boots(f, "#55482f", 7)
    cape(f, "#2a4a2f", 15, ragged=True)
    elf_ears(f)
    hair_style(f)
    quiver(f)
    bow(f, "#e9e2a8", GOLD)


def _decem(f, L_):
    clothe(f, "#2f5a3a", "#1c3a24", "#1c3a24", neckline="high", trim=GOLD)
    robe(f, "#2f5a3a", GOLD, 10, 8)
    sleeves(f, "#2f5a3a", 6, GOLD, wide=True)
    cape(f, "#1c3a24", 18, GOLD)
    elf_ears(f)
    hair_style(f)
    circlet(f, GOLD, gem="#63ff6b")
    staff(f, "crystal", WOOD_D, "#63ff6b", GOLD)


def _arena_master(f, L_):
    clothe(f, "#a8262a", "#6e1f1c", "#2a2420", neckline="v")
    coat = wrap(f, 12, 24, "#a8262a", "cloth", 0.3)
    with paint(coat[0].front) as p:
        p.clear(p.w / 2 - 1.2, 0, p.w / 2 + 1.2, p.h)
        for y in (1, 3, 5):
            p.rect(p.w / 2 - 1.8, y, p.w / 2 - 1.2, y + 0.6, GOLD)
    flared_skirt(f, "#a8262a", 6, GOLD, 8, pleats=False)
    belt(f, LEATHER_D, GOLD)
    boots(f, "#2a2420", 6, cuff=GOLD)
    cape(f, "#6e1f1c", 16, GOLD)
    gloves(f, "#f4f1ea")
    hair_style(f)
    cap(f, "#2a2420", feather="#d9a92b")


def _rubedo(f, L_):
    clothe(f, "#f4f1ea", "#f4f1ea", "#f4f1ea", neckline="high", trim="#c2171d")
    robe(f, "#f4f1ea", "#c2171d", 9, 14, second="#c2171d")
    sleeves(f, "#f4f1ea", 5, "#c2171d", wide=True)
    bow_tie(f, "#c2171d")
    boots(f, "#c2171d", 3, heel=True)
    hair_style(f)
    halo(f, "#e0202c")


def _pinison(f, L_):
    leaf, bark = "#4f8a3a", "#4a3320"
    clothe(f, bark, bark, f.look["skin"], sleeve=f.look["skin"], neckline="v")
    robe(f, bark, leaf, 10, 12, second=leaf)
    for i, (x, rz) in enumerate(((-3, 30), (-1, 10), (1, -10), (3, -30))):  # leaves in her hair
        c = f.head.cube((x - 1, 24 + H, -1), (2, 2, 1), rotation=(-20, 0, rz), pivot=(x, 24 + H, -0.5))
        toon(c, "#6aa84f")
    hair_style(f)
    staff(f, "crystal", WOOD, "#ffd23d", leaf, 30)


def _theocracy(f, L_):
    _priest("#e9e6dc", "#d9a92b", "#f6d968")(f, L_)


def _nigun(f, L_):
    _priest("#2a2a33", "#e9e6dc", "#9fd4ff", dark=True)(f, L_)


def _paladin(f, L_):
    _generic_soldier("#d9dde6", "#f4f1ea", lambda f: sword(f, 14, guard=GOLD), True, "kite", plume="#f4f1ea")(f, L_)


# name -> (look, dress, extra bones the entity's animations move)
PEOPLE = {
    "albedo": (L(shoulders=True, sex="f", skin="#f6e2d6", hair="#17141d", tip="#3a2f4a", style="long", fringe="parted", eyes="#f2c21b", face="soft", length=17, strands=7), _albedo, ("robe", "wings")),
    "shalltear": (L(sex="f", skin="#fbf0ee", hair="#eef0f4", tip="#c8c8d8", style="twintails", fringe="hime", eyes="#c2171d", face="soft", ribbon="#1a1420"), _shalltear, ()),
    "demiurge": (L(sex="m", skin="#f0cfb2", hair="#1a1620", style="slick", eyes="#e0b040", face="sharp"), _demiurge, ("tail",)),
    "sebas": (L(sex="m", skin="#e8c2a4", hair="#e8e8ec", style="slick", eyes="#3a6ad0", face="sharp", beard="short"), _sebas, ()),
    "narberal": (L(sex="f", skin="#fae8de", hair="#15131a", tip="#2a2a3a", style="ponytail", fringe="hime", eyes="#1a1622", face="sharp", ribbon="#f4f3f5"), _narberal, ("robe",)),
    "lupusregina": (L(sex="f", skin="#d8a882", hair="#c8302a", tip="#f0603a", style="braid", fringe="swept", eyes="#e0b040", face="soft", ribbon="#f4f3f5"), _lupusregina, ("robe",)),
    "entoma": (L(sex="f", skin="#fae8de", hair="#3a2a1e", style="buns", fringe="hime", eyes="#2a1a12", face="sharp", ribbon="#c84a2a"), _entoma, ("robe",)),
    "solution": (L(sex="f", skin="#fbeee6", hair="#f4d470", tip="#fff0b0", style="twintails", fringe="parted", eyes="#3a7ad0", face="sharp", ribbon="#1f1e28"), _solution, ("robe",)),
    "yuri": (L(sex="f", skin="#f6e2d6", hair="#1a1622", style="buns", fringe="parted", eyes="#2a6a4a", face="sharp", ribbon="#1f1e28"), _yuri, ("robe",)),
    "cz_delta": (L(sex="f", skin="#fbeee6", hair="#f0a8a0", tip="#f8d0c8", style="bob", fringe="hime", eyes="#5ad06a", face="soft"), _cz, ("robe",)),
    "nazarick_maid": (L(sex="f", skin="#fae8de", hair="#e9c46a", style="long", fringe="hime", eyes="#3a7ad0", face="soft", length=12, strands=5), _maid, ("robe",)),
    "aura": (L(sex="f", skin="#c8906a", hair="#f0d060", style="short", fringe="spiky", eyes="#3aa04a", eyes2="#3a7ad0", face="soft", flat=True, ahoge=True), _aura, ()),
    "mare": (L(sex="f", skin="#c8906a", hair="#f0d060", style="bob", fringe="hime", eyes="#3a7ad0", eyes2="#3aa04a", face="soft", flat=True), _mare, ()),
    "pandoras_actor": (L(sex="m", skin="#f2d8c6", hair="#2a2a33", style="bald", eyes="#120c10"), _pandora, ()),
    "gazef": (L(sex="m", skin="#d8a882", hair="#1a1620", style="short", fringe="short", eyes="#3a2a1a", face="sharp", beard="stubble"), _gazef, ()),
    "clementine": (L(midriff=True, sex="f", skin="#fae4d6", hair="#f0d060", tip="#fff0b0", style="bob", fringe="swept", eyes="#c2171d", face="sharp"), _clementine, ()),
    "brain": (L(sex="m", skin="#e8c2a4", hair="#3a5a8a", style="wild", fringe="spiky", eyes="#3a6ad0", face="sharp", scar=True), _brain, ()),
    "nfirea": (L(sex="m", skin="#f6e2d6", hair="#e8c860", style="short", fringe="heavy", eyes="#3a6ad0", face="soft"), _nfirea, ()),
    "evileye": (L(sex="f", skin="#fbf0ee", hair="#f0d060", style="long", fringe="hime", eyes="#c2171d", face="sharp", length=11, strands=5, flat=True), _evileye, ()),
    "fluder": (L(sex="m", skin="#e8c2a4", hair="#eceae4", style="long", fringe="parted", eyes="#3a7ad0", face="sharp", beard="long", length=12, strands=4), _fluder, ("robe",)),
    "ainz": (L(sex="m", skin=BONE, hair=BONE, style="bald", eyes="#ff3a2e", helmet="full"), _ainz, ("robe",)),
    "vampire_bride": (L(shoulders=True, sex="f", skin="#f2eef0", hair="#15131a", tip="#3a1020", style="long", fringe="hime", eyes="#e0202c", face="sharp", lips="#a01020", length=16, strands=6), _vampire_bride, ("robe",)),
    "dwarf": (L(sex="m", skin="#d8a882", hair="#a8502a", style="short", fringe="short", eyes="#3a2a1a", face="sharp", beard="full", helmet="open"), _dwarf, ()),
    "adventurer": (L(sex="m", skin="#e8c2a4", hair="#7a5230", style="short", fringe="swept", eyes="#3aa04a", face="soft"), _adventurer, ()),
    "guard": (L(sex="m", skin="#f0cfb2", hair="#3a2a1f", style="short", fringe="short", eyes="#3a6ad0", face="sharp", helmet="open"),
              _generic_soldier("#9aa0aa", "#3f66a8", lambda f: spear(f), True, "kite", plume="#3f66a8"), ()),
    "soldier": (L(sex="m", skin="#e8c2a4", hair="#5a3a26", style="short", fringe="short", eyes="#5a3a2a", face="sharp", helmet="open"),
                _generic_soldier("#8a9098", "#8f2a2a", lambda f: spear(f), True, None, plume="#c9302c"), ()),
    "archer": (L(sex="m", skin="#f0cfb2", hair="#6a4428", style="short", fringe="swept", eyes="#3aa04a", face="soft", helmet="hat"), _archer, ()),
    "imperial_knight": (L(sex="m", skin="#e0b48c", hair="#2a2018", style="short", fringe="short", eyes="#3a2a1a", face="sharp", helmet="open"),
                        _generic_soldier("#4a4a58", "#a8262a", lambda f: sword(f, 14, guard=GOLD), True, "kite", plume="#a8262a"), ()),
    "bandit": (L(sex="m", skin="#c99a78", hair="#1f1a16", style="wild", fringe="spiky", eyes="#5a3a2a", face="sharp", scar=True), _bandit, ()),
    "theocracy_priest": (L(sex="m", skin="#e0b48c", hair="#3a2a1f", style="short", fringe="parted", eyes="#3a6ad0", face="soft"), _theocracy, ()),
    "nigun": (L(sex="m", skin="#d2a07a", hair="#1f1a16", style="slick", eyes="#5a3a2a", face="sharp", scar=True), _nigun, ()),
    "climb": (L(sex="m", skin="#f6e2d6", hair="#e6c463", style="short", fringe="swept", eyes="#3a6ad0", face="soft"), _climb, ()),
    "zesshi": (L(sex="f", skin="#fbeee6", hair="#f4f3f5", tip="#15131a", style="long", fringe="hime", eyes="#3a7ad0", eyes2="#c2171d", face="sharp", length=16, strands=6), _zesshi, ()),
    "khajiit": (L(sex="m", skin="#d9c7b0", hair="#d9c7b0", style="bald", eyes="#7a1fff", face="sharp"), _khajiit, ()),
    "lakyus": (L(sex="f", skin="#fbeee6", hair="#f0d060", tip="#fff4c8", style="long", fringe="parted", eyes="#3a9ae0", face="soft", length=16, strands=6), _lakyus, ()),
    "enri": (L(sex="f", skin="#f6dcc8", hair="#b5642e", style="braid", fringe="hime", eyes="#6a4a2a", face="soft", ribbon="#b03a2e"), _enri, ()),
    "zero": (L(sex="m", skin="#b9835a", hair="#b9835a", style="bald", eyes="#3a2a1a", face="sharp"), _zero, ()),
    "elf_ranger": (L(sex="f", skin="#f6e2d6", hair="#e9e2a8", style="ponytail", fringe="swept", eyes="#3aa04a", face="soft", ribbon="#3f6a45"), _elf_ranger, ()),
    "decem": (L(sex="m", skin="#f0dcc8", hair="#f4f3f5", style="long", fringe="parted", eyes="#63c05b", face="sharp", length=13, strands=4), _decem, ()),
    "neia": (L(sex="f", skin="#f6dcc8", hair="#d9c05a", style="short", fringe="swept", eyes="#a0a8b0", face="sharp", flat=True), _neia, ()),
    "remedios": (L(sex="f", skin="#f6dcc8", hair="#5a3a1f", style="short", fringe="swept", eyes="#5a3a2a", face="sharp"), _remedios, ()),
    "paladin": (L(sex="m", skin="#e0b48c", hair="#3a2a1f", style="short", fringe="short", eyes="#3a6ad0", face="sharp", helmet="open"), _paladin, ()),
    "arena_master": (L(sex="m", skin="#d6a57e", hair="#2a2a2a", style="short", fringe="swept", eyes="#5a3a2a", face="sharp", helmet="hat"), _arena_master, ()),
    "rubedo": (L(sex="f", skin="#fbf0ee", hair="#c2171d", tip="#ff6040", style="long", fringe="hime", eyes="#c2171d", face="sharp", length=14, strands=5, flat=True), _rubedo, ("robe",)),
    "pinison": (L(sex="f", skin="#c8d9a0", hair="#4f8a3a", tip="#a8d870", style="long", fringe="parted", eyes="#ffd23d", face="soft", length=15, strands=6), _pinison, ("robe",)),
}

MODELS = [build_person(name, look, dress, bones) for name, (look, dress, bones) in PEOPLE.items()]
