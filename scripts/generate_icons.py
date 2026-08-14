import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ICONS_DIR = Path(__file__).parent.parent / "public" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)

def create_glow(draw, shape_func, glow_color, max_blur=10):
    """Draws layered blur glow around shapes."""
    pass

def generate_pin_marker(filename, glow_color, bg_color, inner_icon_type, size=64):
    # Supersampling 4x for smooth antialiasing
    scale = 4
    W, H = size * scale, size * scale
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = W // 2, H * 0.42
    r = W * 0.32

    # Glow layers (soft shadow/glow)
    glow_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_img)
    for i in range(12, 0, -2):
        alpha = int(255 * (0.08 * (1 - i / 12)))
        gc = glow_color + (alpha,)
        # Pin teardrop path
        glow_draw.ellipse([cx - r - i*4, cy - r - i*4, cx + r + i*4, cy + r + i*4], fill=gc)
    
    glow_img = glow_img.filter(ImageFilter.GaussianBlur(radius=8 * scale // 2))
    img = Image.alpha_composite(img, glow_img)
    draw = ImageDraw.Draw(img)

    # Pin Shadow Base
    shadow_box = [cx - r*0.5, H*0.82, cx + r*0.5, H*0.94]
    draw.ellipse(shadow_box, fill=(0, 0, 0, 100))

    # Teardrop body
    # Draw head circle + bottom triangle
    points = [
        (cx - r * 0.85, cy + r * 0.3),
        (cx, H * 0.84),
        (cx + r * 0.85, cy + r * 0.3),
    ]
    draw.polygon(points, fill=bg_color)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=bg_color)

    # Outer border ring
    border_color = glow_color + (240,)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=border_color, width=int(3 * scale))
    draw.polygon(points, outline=border_color, width=int(2 * scale))

    # Inner lens circle
    ir = r * 0.65
    lens_bg = (15, 23, 42, 230) # slate-900
    draw.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=lens_bg, outline=border_color, width=int(2 * scale))

    # Inner Icon (Camera glyph / Symbol)
    ic_c = glow_color + (255,)
    if inner_icon_type == "camera":
        # Camera body
        cw, ch = ir * 0.9, ir * 0.6
        draw.rounded_rectangle([cx - cw/2, cy - ch/2, cx + cw/2, cy + ch/2], radius=int(3*scale), fill=ic_c)
        # Lens dot
        draw.ellipse([cx - cw/4, cy - cw/4, cx + cw/4, cy + cw/4], fill=(15, 23, 42, 255))
        draw.ellipse([cx - cw/8, cy - cw/8, cx + cw/8, cy + cw/8], fill=ic_c)
        # Lens flare
        draw.polygon([(cx + cw/2, cy - ch/4), (cx + cw*0.75, cy - ch*0.4), (cx + cw*0.75, cy + ch*0.4), (cx + cw/2, cy + ch/4)], fill=ic_c)

    elif inner_icon_type == "camera_offline":
        cw, ch = ir * 0.9, ir * 0.6
        draw.rounded_rectangle([cx - cw/2, cy - ch/2, cx + cw/2, cy + ch/2], radius=int(3*scale), fill=(100, 116, 139, 200))
        # Red slash line
        draw.line([cx - ir*0.8, cy + ir*0.8, cx + ir*0.8, cy - ir*0.8], fill=(239, 68, 68, 255), width=int(3*scale))

    elif inner_icon_type == "camera_unstable":
        cw, ch = ir * 0.9, ir * 0.6
        draw.rounded_rectangle([cx - cw/2, cy - ch/2, cx + cw/2, cy + ch/2], radius=int(3*scale), fill=ic_c)
        # Warning triangle in lens
        draw.ellipse([cx - cw/4, cy - cw/4, cx + cw/4, cy + cw/4], fill=(15, 23, 42, 255))
        # Amber center exclamation dot
        draw.ellipse([cx - cw/8, cy - cw/8, cx + cw/8, cy + cw/8], fill=(245, 158, 11, 255))
        draw.polygon([(cx + cw/2, cy - ch/4), (cx + cw*0.75, cy - ch*0.4), (cx + cw*0.75, cy + ch*0.4), (cx + cw/2, cy + ch/4)], fill=ic_c)

    elif inner_icon_type == "unknown":
        cw, ch = ir * 0.9, ir * 0.6
        draw.rounded_rectangle([cx - cw/2, cy - ch/2, cx + cw/2, cy + ch/2], radius=int(3*scale), fill=ic_c)
        # Question mark or amber pulse center
        draw.ellipse([cx - cw/4, cy - cw/4, cx + cw/4, cy + cw/4], fill=(245, 158, 11, 255))

    # Downsample
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(ICONS_DIR / filename, "WEBP", quality=95)
    print(f"Generated {filename} ({size}x{size})")


def generate_cluster_marker(filename, ring_color, bg_color, size=80):
    scale = 4
    W, H = size * scale, size * scale
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = W // 2, H // 2
    r = W * 0.38

    # Outer glow
    glow_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_img)
    for i in range(16, 0, -2):
        alpha = int(255 * (0.06 * (1 - i / 16)))
        gc = ring_color + (alpha,)
        glow_draw.ellipse([cx - r - i*4, cy - r - i*4, cx + r + i*4, cy + r + i*4], fill=gc)
    
    glow_img = glow_img.filter(ImageFilter.GaussianBlur(radius=10 * scale // 2))
    img = Image.alpha_composite(img, glow_img)
    draw = ImageDraw.Draw(img)

    # Outer Ring
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=bg_color, outline=ring_color + (240,), width=int(4 * scale))

    # Inner Ring dashed/accent
    ir = r * 0.72
    draw.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=(15, 23, 42, 220), outline=ring_color + (180,), width=int(2 * scale))

    # Downsample
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(ICONS_DIR / filename, "WEBP", quality=95)
    print(f"Generated {filename} ({size}x{size})")


def generate_badge_icon(filename, color, size=48):
    scale = 4
    W, H = size * scale, size * scale
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    padding = W * 0.1
    draw.rounded_rectangle([padding, padding, W - padding, H - padding], radius=int(8*scale), fill=(15, 23, 42, 230), outline=color + (255,), width=int(3*scale))

    cx, cy = W // 2, H // 2
    cw, ch = W * 0.35, H * 0.25
    draw.rounded_rectangle([cx - cw/2, cy - ch/2, cx + cw/2, cy + ch/2], radius=int(2*scale), fill=color + (255,))
    draw.ellipse([cx - cw/3, cy - cw/3, cx + cw/3, cy + cw/3], fill=(15, 23, 42, 255))
    draw.polygon([(cx + cw/2, cy - ch/4), (cx + cw*0.75, cy - ch*0.4), (cx + cw*0.75, cy + ch*0.4), (cx + cw/2, cy + ch/4)], fill=color + (255,))

    img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(ICONS_DIR / filename, "WEBP", quality=95)
    print(f"Generated {filename} ({size}x{size})")


def main():
    print("Generating custom WebP icons...")

    # Colors (RGB)
    EMERALD = (34, 197, 94)    # Freeway Online
    CYAN = (6, 182, 212)       # Highway Online
    AMBER = (245, 158, 11)     # Freeway Unstable / Warning
    YELLOW = (234, 179, 8)     # Highway Unstable
    RED = (239, 68, 68)        # Offline
    SLATE = (100, 116, 139)    # Muted Offline
    MAGENTA = (236, 72, 153)   # Large Cluster

    BG_DARK = (15, 23, 42, 230)

    # 1. Markers (64x64)
    generate_pin_marker("marker-freeway-online.webp", EMERALD, BG_DARK, "camera", size=64)
    generate_pin_marker("marker-freeway-unstable.webp", AMBER, BG_DARK, "camera_unstable", size=64)
    generate_pin_marker("marker-freeway-offline.webp", RED, BG_DARK, "camera_offline", size=64)
    generate_pin_marker("marker-highway-online.webp", CYAN, BG_DARK, "camera", size=64)
    generate_pin_marker("marker-highway-unstable.webp", YELLOW, BG_DARK, "camera_unstable", size=64)
    generate_pin_marker("marker-highway-offline.webp", SLATE, BG_DARK, "camera_offline", size=64)
    generate_pin_marker("marker-unknown.webp", AMBER, BG_DARK, "unknown", size=64)

    # 2. Clusters
    generate_cluster_marker("cluster-sm.webp", CYAN, BG_DARK, size=40)
    generate_cluster_marker("cluster-md.webp", AMBER, BG_DARK, size=48)
    generate_cluster_marker("cluster-lg.webp", MAGENTA, BG_DARK, size=56)

    # 3. Badges / UI Icons
    generate_badge_icon("cctv-badge.webp", CYAN, size=48)
    generate_badge_icon("toggle-cctv.webp", EMERALD, size=48)

    print("\nAll custom WebP icons generated successfully in public/icons/")

if __name__ == "__main__":
    main()
