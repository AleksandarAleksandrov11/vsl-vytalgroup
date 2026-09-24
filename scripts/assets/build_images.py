"""Genera las imágenes de la landing (AVIF + WebP, varios anchos).

Fuentes:
  * Catálogo ADC Global Tech | VytalGroup 2026 (imágenes extraídas con `pdfimages -all -p`)
  * Foto de Javier enviada por el cliente (`javier_foto.png`, 640 × 640)

Uso:
  pip install pillow numpy opencv-python-headless
  python3 build_images.py <dir_pdfimages> <dir_fotos> <dir_salida>

Tratamiento homogéneo de producto: cada equipo se recorta, se coloca sobre el mismo lienzo
blanco 4:3 con el mismo tamaño visual y la misma sombra de contacto suave. Los dos equipos que
solo existen en foto con fondo (Eco Wireless y Diatermia Multifunción) se recortan con GrabCut.
Nunca se amplía por encima de la resolución original.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

PDF, PHOTOS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
AVIF_Q, WEBP_Q = 60, 80
CW, CH = 640, 480  # lienzo de producto (4:3)


def save(im, name, widths, alpha=False):
    im = im.convert('RGBA' if alpha else 'RGB')
    for w in widths:
        w = min(w, im.width)
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(os.path.join(OUT, f'{name}-{w}.avif'), quality=AVIF_Q, speed=4)
        r.save(os.path.join(OUT, f'{name}-{w}.webp'), quality=WEBP_Q, method=6)
    print(name, im.size, widths)


def grabcut(path, box, fg_boxes, iters=6):
    """Máscara del objeto con GrabCut: `box` = zona probable, `fg_boxes` = zonas seguras."""
    img = cv2.imread(path)
    mask = np.full(img.shape[:2], cv2.GC_BGD, np.uint8)
    x0, y0, x1, y1 = box
    mask[y0:y1, x0:x1] = cv2.GC_PR_FGD
    for a, b, c, d in fg_boxes:
        mask[b:d, a:c] = cv2.GC_FGD
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(img, mask, None, bgd, fgd, iters, cv2.GC_INIT_WITH_MASK)
    return img, np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)


def largest(m, open_px):
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_px, open_px)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    return np.where(lab == big, 255, 0).astype(np.uint8)


def row_profile(m, smooth=9):
    """Reconstruye la máscara fila a fila con bordes suavizados (quita muescas y bultos)."""
    ys = np.where(m.max(axis=1) > 0)[0]
    left = np.array([np.argmax(m[y] > 0) for y in ys], float)
    right = np.array([m.shape[1] - 1 - np.argmax(m[y][::-1] > 0) for y in ys], float)
    k = np.ones(smooth) / smooth
    left = np.convolve(np.pad(left, smooth // 2, mode='edge'), k, 'valid')
    right = np.convolve(np.pad(right, smooth // 2, mode='edge'), k, 'valid')
    out = np.zeros_like(m)
    for y, a, b in zip(ys, left, right):
        out[y, int(round(a)):int(round(b)) + 1] = 255
    return out


def cutout(img, m, feather=1.2):
    """Devuelve RGBA recortado al objeto con el borde suavizado."""
    alpha = cv2.GaussianBlur(m, (0, 0), feather)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA)
    rgba[..., 3] = alpha
    ys, xs = np.where(alpha > 8)
    return Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1])


def from_white(path, fade=()):
    """Producto del catálogo sobre blanco → RGBA con alfa según la distancia al blanco.
    `fade` difumina los bordes donde la foto original está cortada (cables, base)."""
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    dist = (255 - a.min(axis=2)).clip(0, 255)
    alpha = np.clip((dist - 4) * 12, 0, 255).astype(np.float32)
    h, w = alpha.shape
    ramp = 44
    for side in fade:
        g = np.linspace(0, 1, ramp)[:, None] if side in ('top', 'bottom') else np.linspace(0, 1, ramp)[None, :]
        if side == 'bottom':
            alpha[h - ramp:, :] *= g[::-1]
        elif side == 'top':
            alpha[:ramp, :] *= g
        elif side == 'left':
            alpha[:, :ramp] *= g
        elif side == 'right':
            alpha[:, w - ramp:] *= g[:, ::-1]
    rgba = np.dstack([a.astype(np.uint8), alpha.astype(np.uint8)])
    ys, xs = np.where(alpha > 10)
    return Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')


def stage(obj, box=(0.74, 0.76), area=0.30, base=0.88, shadow=True, bg=(255, 255, 255, 255)):
    """Coloca el objeto en el lienzo 4:3 con tamaño visual homogéneo y sombra de contacto."""
    w, h = obj.size
    s = min(box[0] * CW / w, box[1] * CH / h, (area * CW * CH / (w * h)) ** 0.5, 1.0 * 2)
    obj = obj.resize((round(w * s), round(h * s)), Image.LANCZOS)
    canvas = Image.new('RGBA', (CW, CH), bg)
    x = (CW - obj.width) // 2
    y = round(CH * base) - obj.height
    if shadow:
        sh = Image.new('L', (CW, CH), 0)
        d = ImageDraw.Draw(sh)
        sw, shh = obj.width * 0.86, max(10, CH * 0.05)
        cx, cy = CW / 2, y + obj.height - shh * 0.18
        d.ellipse((cx - sw / 2, cy - shh / 2, cx + sw / 2, cy + shh / 2), fill=70)
        sh = sh.filter(ImageFilter.GaussianBlur(11))
        dark = Image.new('RGBA', (CW, CH), (11, 25, 41, 0))
        dark.putalpha(sh)
        canvas = Image.alpha_composite(canvas, dark)
    canvas.alpha_composite(obj, (x, y))
    return canvas


def grade(im, amount=0.12):
    """Etalonaje de marca suave: sombras hacia marino y altas hacia turquesa."""
    im = im.convert('RGB')
    g = im.convert('L')
    navy, teal = (11, 25, 41), (214, 240, 240)
    duo = Image.merge('RGB', [g.point(lambda v, a=navy[i], b=teal[i]: round(a + (b - a) * v / 255)) for i in range(3)])
    return ImageEnhance.Contrast(Image.blend(im, duo, amount)).enhance(1.05)


pdf = lambda n: os.path.join(PDF, n)

# ---------------------------------------------------------------- Diatermia Multifunción VytaMeD (foto)
img, m = grabcut(pdf('i-008-038.png'), (70, 20, 820, 690), [(150, 80, 750, 600)])
m[705:] = 0
m = largest(m, 25)
cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
hull = np.zeros_like(m)
cv2.fillPoly(hull, [cv2.convexHull(cnts[0])], 255)
# fuera la cuña gris de la base que asoma abajo a la izquierda (solo se ve en un lado)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
wedge = np.zeros_like(m)
wedge[500:, :170] = 255
hull[(wedge > 0) & (gray > 105)] = 0
hull = largest(hull, 9)
vytamed = cutout(img, hull)

# ---------------------------------------------------------------- Eco Wireless (sonda en su maletín)
img, m = grabcut(pdf('i-006-024.jpg'), (1095, 195, 1425, 910), [(1160, 350, 1370, 850), (1170, 210, 1340, 300)], 8)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
blue = (hsv[..., 0] > 90) & (hsv[..., 0] < 115) & (hsv[..., 1] > 70)
m = np.where((m > 0) & ((lum > 200) | blue), 255, 0).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
m = largest(m, 31)
m = row_profile(m, 15)
wireless = cutout(img, m)

# ---------------------------------------------------------------- productos del catálogo sobre blanco
ax8 = from_white(pdf('i-022-137.jpg'))
lx9 = from_white(pdf('i-017-102.jpg'))
reatherm = from_white(pdf('i-027-171.jpg'), fade=('bottom', 'left', 'right'))
hrtek = from_white(pdf('i-033-214.jpg'), fade=('left',))

PRODUCTS = {
    'p-eco-wireless': (wireless, dict(box=(0.5, 0.74), area=0.2)),
    'p-ax8': (ax8, dict(box=(0.8, 0.76), area=0.36)),
    'p-lx9': (lx9, dict(box=(0.6, 0.8))),
    'p-vytamed': (vytamed, {}),
    'p-reatherm': (reatherm, dict(box=(0.84, 0.76), area=0.36, shadow=False)),
    'p-hrtek': (hrtek, dict(box=(0.82, 0.76), area=0.34)),
}
for name, (obj, opt) in PRODUCTS.items():
    save(stage(obj, **opt), name, [320, 480, 640])

# ---------------------------------------------------------------- hero: la diatermia VytaMeD con alfa
hero = Image.new('RGBA', (vytamed.width + 40, vytamed.height + 60), (0, 0, 0, 0))
sh = Image.new('L', hero.size, 0)
ImageDraw.Draw(sh).ellipse((40, hero.height - 64, hero.width - 40, hero.height - 26), fill=90)
sh = sh.filter(ImageFilter.GaussianBlur(16))
dark = Image.new('RGBA', hero.size, (11, 25, 41, 0))
dark.putalpha(sh)
hero = Image.alpha_composite(hero, dark)
hero.alpha_composite(vytamed, (20, 20))
save(hero, 'hero-vytamed', [400, 560, 760], alpha=True)

# ---------------------------------------------------------------- Javier
# El recorte termina por encima del logo de terceros que lleva bordado el polo (y = 448)
foto = Image.open(os.path.join(PHOTOS, 'javier_foto.png')).convert('RGB')
jav = grade(foto.crop((128, 0, 512, 440))).filter(ImageFilter.UnsharpMask(radius=1.0, percent=30, threshold=2))
save(jav, 'javier', [320, 384])
save(grade(foto.crop((180, 15, 460, 295))), 'javier-avatar', [96])
