#!/usr/bin/env python3
"""Generate MVP pixel-art PNG assets for BrandWars.kz."""

from __future__ import annotations

import json
import math
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    import subprocess
    subprocess.check_call(["pip3", "install", "pillow", "-q"])
    from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "assets"

PALETTE = {
    "outline": (26, 35, 64),
    "skin": (255, 213, 170),
    "skin_shadow": (224, 172, 130),
    "white": (255, 255, 255),
    "navy": (42, 58, 112),
    "cyan": (72, 201, 228),
    "purple": (142, 108, 255),
    "pink": (255, 120, 180),
    "yellow": (255, 214, 88),
    "green": (88, 196, 120),
    "orange": (255, 158, 72),
    "red": (235, 88, 88),
    "gray": (160, 170, 190),
    "grass": (96, 168, 88),
    "sand": (240, 220, 160),
    "water": (88, 160, 220),
    "tech": (56, 72, 120),
}

CATEGORIES = {
    "travel": {"primary": "orange", "secondary": "cyan", "accent": "yellow"},
    "beauty": {"primary": "pink", "secondary": "purple", "accent": "white"},
    "code": {"primary": "tech", "secondary": "cyan", "accent": "green"},
    "ai-agents": {"primary": "cyan", "secondary": "purple", "accent": "yellow"},
    "games": {"primary": "purple", "secondary": "pink", "accent": "yellow"},
    "marketing": {"primary": "red", "secondary": "orange", "accent": "yellow"},
}

ARCHETYPES = ["founder", "marketer", "builder", "courier", "supporter", "mascot"]


def px(draw: ImageDraw.ImageDraw, x: int, y: int, size: int, color: tuple[int, int, int]) -> None:
    draw.rectangle([x, y, x + size - 1, y + size - 1], fill=color)


def draw_character(size: int, primary: str, secondary: str, variant: int = 0) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    o = PALETTE["outline"]
    p = PALETTE[primary]
    s = PALETTE[secondary]
    skin = PALETTE["skin"]
    ss = PALETTE["skin_shadow"]
    u = size // 16

    # legs
    for lx, ly in [(5, 12), (9, 12)]:
        px(d, lx * u, ly * u, u, o)
        px(d, (lx + 0) * u, (ly + 1) * u, u, s if variant % 2 else p)
    # body
    for x in range(5, 11):
        for y in range(7, 12):
            px(d, x * u, y * u, u, p if y < 10 else s)
    # head
    for x in range(5, 11):
        for y in range(3, 7):
            c = skin if y < 6 else ss
            px(d, x * u, y * u, u, c)
    # eyes
    px(d, 6 * u, 4 * u, u, o)
    px(d, 9 * u, 4 * u, u, o)
    # accessory by variant
    if variant == 0:
        px(d, 7 * u, 2 * u, 2 * u, s)
    elif variant == 1:
        px(d, 11 * u, 8 * u, 2 * u, PALETTE["yellow"])
    else:
        px(d, 3 * u, 8 * u, 2 * u, PALETTE["cyan"])
    return img


def draw_building(size: int, primary: str, kind: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    o = PALETTE["outline"]
    p = PALETTE[primary]
    u = size // 16
    w, h = 8, 6 + kind
    ox, oy = (16 - w) // 2, 16 - h - 2
    for x in range(w):
        for y in range(h):
            px(d, (ox + x) * u, (oy + y) * u, u, p if y > 0 else PALETTE["white"])
    for x in range(2, w - 2, 3):
        px(d, (ox + x) * u, (oy + h - 2) * u, u, PALETTE["cyan"])
    return img


def draw_prop(size: int, primary: str, kind: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    p = PALETTE[primary]
    u = size // 16
    cx, cy = 8 * u, 8 * u
    r = (3 + kind) * u
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=p, outline=PALETTE["outline"])
    return img


def draw_tile(size: int, primary: str, secondary: str) -> Image.Image:
    img = Image.new("RGBA", (size, size), PALETTE[primary])
    d = ImageDraw.Draw(img)
    u = size // 8
    for x in range(8):
        for y in range(8):
            if (x + y) % 2 == 0:
                px(d, x * u, y * u, u, PALETTE[secondary])
    return img


def draw_effect(size: int, primary: str) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    p = PALETTE[primary]
    cx, cy = size // 2, size // 2
    for i in range(8):
        angle = i * math.pi / 4
        x = cx + int(math.cos(angle) * size * 0.35)
        y = cy + int(math.sin(angle) * size * 0.35)
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=p)
    d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=PALETTE["white"])
    return img


def draw_ui_icon(size: int, primary: str, letter: str) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([2, 2, size - 3, size - 3], radius=8, fill=PALETTE[primary], outline=PALETTE["outline"], width=2)
    return img


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)

    # Base characters
    base_dir = PUBLIC / "characters" / "base"
    base_dir.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(ARCHETYPES):
        colors = list(CATEGORIES.values())[i % len(CATEGORIES)]
        img = draw_character(64, colors["primary"], colors["secondary"], i % 3)
        img.save(base_dir / f"{name}-idle.png")

    manifest: dict = {"categories": {}, "characters": ARCHETYPES}

    for slug, colors in CATEGORIES.items():
        cat_dir = PUBLIC / "categories" / slug
        cat_dir.mkdir(parents=True, exist_ok=True)
        files = []

        leader = draw_character(64, colors["primary"], colors["secondary"], 0)
        p = cat_dir / "leader-idle.png"
        leader.save(p)
        files.append(p.name)

        for i in range(2):
            citizen = draw_character(48, colors["secondary"], colors["accent"], i + 1)
            fn = cat_dir / f"citizen-{i + 1}-idle.png"
            citizen.save(fn)
            files.append(fn.name)

        for i in range(5):
            prop = draw_prop(32, colors["accent"], i)
            fn = cat_dir / f"prop-{i + 1}.png"
            prop.save(fn)
            files.append(fn.name)

        for i in range(2):
            b = draw_building(64, colors["primary"], i)
            fn = cat_dir / f"building-{i + 1}.png"
            b.save(fn)
            files.append(fn.name)

        effect = draw_effect(48, colors["primary"])
        fn = cat_dir / "effect-sparkle.png"
        effect.save(fn)
        files.append(fn.name)

        manifest["categories"][slug] = files

    tiles_dir = PUBLIC / "map" / "tiles"
    tiles_dir.mkdir(parents=True, exist_ok=True)
    for slug, colors in CATEGORIES.items():
        tile = draw_tile(64, colors["primary"], colors["secondary"])
        tile.save(tiles_dir / f"{slug}-tile.png")

    ui_dir = PUBLIC / "ui"
    ui_dir.mkdir(parents=True, exist_ok=True)
    for slug, colors in CATEGORIES.items():
        icon = draw_ui_icon(48, colors["primary"], slug[0].upper())
        icon.save(ui_dir / f"category-{slug}.png")

    badge = draw_ui_icon(32, "green", "V")
    badge.save(ui_dir / "badge-verified.png")

    (PUBLIC / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Generated assets in {PUBLIC}")


if __name__ == "__main__":
    main()
