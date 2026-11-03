"""Simple home-screen icons for Plan de Alex. Requires Pillow."""

from math import cos, radians, sin
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / "icons"
ORANGE = (252, 76, 2, 255)
TEAL = (20, 184, 166, 255)
BG = (12, 14, 18, 255)
WHITE = (255, 255, 255, 255)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def point(cx, cy, radius, angle):
    # Pillow arcs start at 3 o'clock and grow clockwise.
    rad = radians(angle)
    return cx + radius * cos(rad), cy + radius * sin(rad)


def draw_mark(draw, size, cx, cy, scale):
    radius = size * 0.30 * scale
    width = max(3, int(size * 0.055 * scale))
    box = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.arc(box, start=200, end=430, fill=ORANGE, width=width)
    draw.arc(box, start=70, end=160, fill=TEAL, width=width)
    dot = max(3, int(size * 0.045 * scale))
    x, y = point(cx, cy, radius, 200)
    draw.ellipse((x - dot, y - dot, x + dot, y + dot), fill=ORANGE)
    font = ImageFont.truetype(FONT, int(size * 0.34 * scale))
    text = "A"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        (cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1] - size * 0.015 * scale),
        text,
        font=font,
        fill=WHITE,
    )


def save_any(size, path):
    image = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(image)
    draw_mark(draw, size, size / 2, size / 2, 1)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=int(size * 0.22), fill=255
    )
    image.putalpha(mask)
    image.save(path)


def save_maskable(size, path):
    image = Image.new("RGBA", (size, size), ORANGE)
    draw = ImageDraw.Draw(image)
    margin = int(size * 0.14)
    draw.ellipse((margin, margin, size - margin, size - margin), fill=BG)
    draw_mark(draw, size, size / 2, size / 2, 0.78)
    image.save(path)


def save_apple(size, path):
    image = Image.new("RGB", (size, size), BG[:3])
    draw = ImageDraw.Draw(image)
    draw_mark(draw, size, size / 2, size / 2, 1)
    image.save(path)


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    save_any(192, ROOT / "icon-192.png")
    save_any(512, ROOT / "icon-512.png")
    save_maskable(192, ROOT / "icon-maskable-192.png")
    save_maskable(512, ROOT / "icon-maskable-512.png")
    save_apple(180, ROOT / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
