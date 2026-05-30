"""
Generate synthetic training data for chess piece recognition.
Creates 32x32 grayscale images of each piece type on light and dark backgrounds.
Uses case-safe directory names for Windows compatibility.
"""

import os
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Output directory
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'training_data')

# 13 case-safe classes
CLASSES = [
    'empty',
    'white_K', 'white_Q', 'white_R', 'white_B', 'white_N', 'white_P',
    'black_k', 'black_q', 'black_r', 'black_b', 'black_n', 'black_p'
]

# Unicode chess symbols for rendering
PIECE_UNICODE = {
    'white_K': '\u2654', 'white_Q': '\u2655', 'white_R': '\u2656', 'white_B': '\u2657', 'white_N': '\u2658', 'white_P': '\u2659',
    'black_k': '\u265A', 'black_q': '\u265B', 'black_r': '\u265C', 'black_b': '\u265D', 'black_n': '\u265E', 'black_p': '\u265F',
}

# Try to find a good font for chess symbols
def find_font(size=24):
    """Find a font that renders chess Unicode symbols well."""
    font_candidates = [
        'seguisym.ttf',    # Segoe UI Symbol (Windows) - best for chess
        'arial.ttf',       # Arial
        'DejaVuSans.ttf',  # DejaVu
        'segoeui.ttf',     # Segoe UI
        'times.ttf',       # Times New Roman
    ]
    
    for font_name in font_candidates:
        try:
            font = ImageFont.truetype(font_name, size)
            img = Image.new('L', (32, 32), 255)
            d = ImageDraw.Draw(img)
            d.text((0, 0), '\u2654', font=font, fill=0)
            arr = np.array(img)
            if arr.min() < 200:  # Something was drawn
                return font
        except (OSError, IOError):
            continue
    
    return ImageFont.load_default()


def draw_crosshatch(draw, w, h, spacing=4, color=180):
    """Draw diagonal cross-hatching pattern (dark square background)."""
    for offset in range(-h, w + h, spacing):
        draw.line([(offset, 0), (offset + h, h)], fill=color, width=1)
    for offset in range(-h, w + h, spacing):
        draw.line([(w - offset, 0), (w - offset - h, h)], fill=color, width=1)


def create_background(w, h, bg_type='light'):
    """Create a background image."""
    if bg_type == 'light':
        base_val = random.randint(235, 255)
        img = Image.new('L', (w, h), base_val)
    elif bg_type == 'dark_hatched':
        base_val = random.randint(235, 255)
        img = Image.new('L', (w, h), base_val)
        draw = ImageDraw.Draw(img)
        hatch_color = random.randint(140, 190)
        spacing = random.choice([3, 4, 5])
        draw_crosshatch(draw, w, h, spacing=spacing, color=hatch_color)
    elif bg_type == 'dark_solid':
        base_val = random.randint(160, 200)
        img = Image.new('L', (w, h), base_val)
    else:
        base_val = random.randint(200, 230)
        img = Image.new('L', (w, h), base_val)
    return img


def render_piece(class_name, font, size=32, bg_type='light'):
    """Render a single chess piece on a background."""
    render_size = size * 3
    img = create_background(render_size, render_size, bg_type)
    draw = ImageDraw.Draw(img)
    
    unicode_char = PIECE_UNICODE[class_name]
    
    bbox = draw.textbbox((0, 0), unicode_char, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    x = (render_size - text_w) // 2 - bbox[0]
    y = (render_size - text_h) // 2 - bbox[1]
    
    # White pieces (starts with 'white_') are drawn outlines
    # Black pieces (starts with 'black_') are drawn solid
    if class_name.startswith('white_'):
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx != 0 or dy != 0:
                    draw.text((x + dx, y + dy), unicode_char, font=font, fill=40)
        draw.text((x, y), unicode_char, font=font, fill=240)
    else:
        draw.text((x, y), unicode_char, font=font, fill=20)
    
    margin = render_size // 3
    cropped = img.crop((margin, margin, render_size - margin, render_size - margin))
    resized = cropped.resize((size, size), Image.Resampling.LANCZOS)
    
    return resized


def render_empty(size=32, bg_type='light'):
    """Render an empty square."""
    return create_background(size, size, bg_type)


def augment_image(img):
    """Apply random augmentations to an image."""
    arr = np.array(img, dtype=np.float32)
    
    # Random brightness shift
    brightness = random.uniform(-20, 20)
    arr = arr + brightness
    
    # Random contrast
    contrast = random.uniform(0.8, 1.2)
    mean_val = arr.mean()
    arr = (arr - mean_val) * contrast + mean_val
    
    # Random gaussian noise
    if random.random() < 0.5:
        noise = np.random.normal(0, random.uniform(2, 8), arr.shape)
        arr = arr + noise
    
    # Clip to valid range
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    result = Image.fromarray(arr, mode='L')
    
    # Random slight blur
    if random.random() < 0.3:
        result = result.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 0.8)))
    
    # Random translation (shift by 1-2 pixels)
    if random.random() < 0.4:
        tx = random.randint(-2, 2)
        ty = random.randint(-2, 2)
        from PIL import ImageChops
        if tx > 0:
            result = ImageChops.offset(result, tx, 0)
        elif tx < 0:
            result = ImageChops.offset(result, tx, 0)
        if ty > 0:
            result = ImageChops.offset(result, 0, ty)
        elif ty < 0:
            result = ImageChops.offset(result, 0, ty)
    
    return result


def generate_dataset(samples_per_class=400):
    """Generate the full training dataset."""
    for cls in CLASSES:
        cls_dir = os.path.join(OUTPUT_DIR, cls)
        os.makedirs(cls_dir, exist_ok=True)
    
    font_sizes = [20, 22, 24, 26, 28]
    fonts = {}
    for fs in font_sizes:
        fonts[fs] = find_font(fs)
    
    print(f"Generating {samples_per_class} samples per class ({len(CLASSES)} classes)...")
    print(f"Output directory: {os.path.abspath(OUTPUT_DIR)}")
    
    bg_types = ['light', 'dark_hatched', 'dark_solid', 'medium']
    
    total = 0
    for cls_idx, cls in enumerate(CLASSES):
        cls_dir = os.path.join(OUTPUT_DIR, cls)
        count = 0
        
        for i in range(samples_per_class):
            bg = random.choice(bg_types)
            
            if cls == 'empty':
                img = render_empty(32, bg)
            else:
                font_size = random.choice(font_sizes)
                font = fonts[font_size]
                img = render_piece(cls, font, 32, bg)
            
            img = augment_image(img)
            
            # Case-safe filename prefixing class name
            filename = f"{cls}_{i:04d}.png"
            img.save(os.path.join(cls_dir, filename))
            count += 1
        
        total += count
        print(f"  [{cls_idx+1:2d}/13] Class '{cls:>10s}': {count} images generated")
    
    print(f"\nTotal: {total} images generated successfully!")
    print(f"Saved to: {os.path.abspath(OUTPUT_DIR)}")
    return total


if __name__ == '__main__':
    generate_dataset(samples_per_class=400)
