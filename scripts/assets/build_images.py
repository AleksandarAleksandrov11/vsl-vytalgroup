"""Genera las imágenes optimizadas de la landing (AVIF + WebP, varios anchos).

Fuentes:
  * Catálogo ADC Global Tech | VytalGroup 2026 (imágenes extraídas con `pdfimages -all -p`)
  * Fotogramas de los vídeos del cliente (Javier con la Diatermia Multifunción y presoterapia VytalGroup)

Uso:
  python3 build_images.py <dir_pdfimages> <dir_fotogramas> <dir_salida>

Recorta, centra los productos recortados sobre lienzo blanco 5:4, nunca amplía por
encima de la resolución original y exporta cada tamaño en AVIF y WebP.
"""
import os
import sys
from PIL import Image, ImageChops, ImageEnhance, ImageFilter

PDF, FRAMES, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)

AVIF_Q = 58
WEBP_Q = 78
manifest = []


def save(im, name, widths):
    """Exporta `im` en los anchos pedidos (sin ampliar) en AVIF y WebP."""
    im = im.convert('RGB')
    done = []
    for w in widths:
        if w > im.width:
            w = im.width
        if w in done:
            continue
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        r.save(os.path.join(OUT, f'{name}-{w}.avif'), quality=AVIF_Q, speed=4)
        r.save(os.path.join(OUT, f'{name}-{w}.webp'), quality=WEBP_Q, method=6)
        done.append(w)
    manifest.append((name, im.width, im.height, done))


def trim_white(im, thr=242):
    """Recorta el margen blanco alrededor del producto."""
    rgb = im.convert('RGB')
    bg = Image.new('RGB', rgb.size, (255, 255, 255))
    diff = ImageChops.difference(rgb, bg).convert('L').point(lambda v: 255 if v > 255 - thr + 10 else 0)
    box = diff.getbbox()
    return rgb.crop(box) if box else rgb


def on_canvas(im, ratio=(5, 4), fill=0.84, cw=640):
    """Centra un producto recortado sobre lienzo blanco de ancho fijo `cw`.
    El encuadre es igual en todas las tarjetas; la ampliación máxima resultante
    con las fuentes del catálogo es de 1,1x aproximadamente."""
    p = trim_white(im)
    pw, ph = p.size
    rw, rh = ratio
    ch = round(cw * rh / rw)
    s = min(cw * fill / pw, ch * fill / ph)
    p = p.resize((round(pw * s), round(ph * s)), Image.LANCZOS)
    c = Image.new('RGB', (cw, ch), (255, 255, 255))
    c.paste(p, ((cw - p.width) // 2, (ch - p.height) // 2 + round(ch * 0.02)))
    return c


def crop_ratio(im, box, ratio=None):
    c = im.convert('RGB').crop(box)
    if ratio:
        rw, rh = ratio
        w, h = c.size
        if w / h > rw / rh:
            nw = round(h * rw / rh)
            c = c.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = round(w * rh / rw)
            c = c.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return c


def pdf(name):
    return Image.open(os.path.join(PDF, name))


def grade(im, amount=0.16):
    """Etalonaje de marca suave: sombras hacia marino y altas hacia turquesa."""
    im = im.convert('RGB')
    g = im.convert('L')
    navy, teal = (11, 25, 41), (214, 240, 240)
    duo = Image.merge('RGB', [g.point(lambda v, a=navy[i], b=teal[i]: round(a + (b - a) * v / 255)) for i in range(3)])
    out = Image.blend(im, duo, amount)
    out = ImageEnhance.Contrast(out).enhance(1.05)
    return out


# ---------------------------------------------------------------- ecógrafos
ECO = {
    'eco-ax8': 'i-022-137.jpg',
    'eco-ax3': 'i-021-130.jpg',
    'eco-lx9': 'i-017-102.jpg',
    'eco-ax2': 'i-020-123.jpg',
    'eco-ax9': 'i-023-144.jpg',
    'eco-lx3': 'i-025-158.jpg',
    'eco-lx25': 'i-018-109.jpg',
    'eco-gx9': 'i-024-151.jpg',
    'eco-lx85': 'i-019-116.jpg',
}
for name, f in ECO.items():
    save(on_canvas(pdf(f)), name, [320, 480, 640])

# Eco Wireless (foto en su estuche)
save(crop_ratio(pdf('i-006-024.jpg'), (480, 20, 1600, 916), (5, 4)), 'eco-wireless', [320, 480, 640, 800])

# Physio Invasiva 2.0
save(crop_ratio(pdf('i-015-089.jpg'), (200, 700, 2900, 2860), (5, 4)), 'physio-invasiva', [240, 400, 560])

# ---------------------------------------------------------------- diatermias
save(crop_ratio(pdf('i-008-038.png'), (50, 0, 840, 632), (5, 4)), 'dia-vytamed', [320, 480, 640, 790])
save(on_canvas(pdf('i-027-171.jpg')), 'dia-reatherm', [320, 480, 640])
save(on_canvas(pdf('i-027-172.jpg')), 'dia-reacare', [320, 480, 640])
save(on_canvas(pdf('i-033-214.jpg')), 'dia-hrtek', [320, 480, 640])

# ---------------------------------------------------------------- hero
save(crop_ratio(pdf('i-008-038.png'), (60, 0, 700, 800), (4, 5)), 'hero-diatermia', [400, 640])
# Versión móvil 5:4 (dirección de arte): menos píxeles y bytes para el LCP en móvil
save(pdf('i-008-038.png').convert('RGB').crop((60, 0, 700, 800)).crop((0, 80, 640, 592)), 'hero-diatermia-m', [400, 640])
save(on_canvas(pdf('i-022-137.jpg'), ratio=(1, 1), fill=0.9, cw=320), 'hero-ax8', [200, 320])

# ---------------------------------------------------------------- secundarios
save(crop_ratio(Image.open(os.path.join(FRAMES, 'preso_20.png')), (0, 250, 576, 711), (5, 4)), 'sec-presoterapia', [240, 400])
save(crop_ratio(pdf('i-007-031.png'), (720, 230, 1536, 883), (5, 4)), 'sec-superinductiva', [240, 400])
save(on_canvas(pdf('i-032-207.jpg'), cw=400), 'sec-ondas', [240, 400])
save(on_canvas(pdf('i-009-045.png'), fill=0.9, cw=400), 'sec-laser', [240, 400])
cam = pdf('i-012-065.jpg').convert('RGB').crop((64, 72, 430, 300))
# el fondo de la página del catálogo es crema: se lleva a blanco puro antes de recortar
cam = cam.point(lambda v: 255 if v > 222 else v)
save(on_canvas(cam, fill=0.9, cw=400), 'sec-camillas', [240, 400])

# ---------------------------------------------------------------- Javier
jav = Image.open(os.path.join(FRAMES, 'jav_40.png')).convert('RGB').crop((470, 0, 790, 360))
jav = grade(jav).filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))
save(jav, 'javier', [320])
save(jav.crop((40, 10, 280, 250)), 'javier-avatar', [160, 240])

for m in manifest:
    print(m)
