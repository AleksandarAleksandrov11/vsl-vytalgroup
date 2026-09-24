"""Genera las imágenes de la landing (AVIF + WebP, varios anchos).

Fuentes:
  * Catálogo ADC Global Tech | VytalGroup 2026 (imágenes extraídas con `pdfimages -all -p`)
  * Catálogo PDF comprimido (assets/docs): portada y páginas interiores para la maqueta 3D (pdftoppm)
  * Foto de Javier enviada por el cliente (`javier_foto.png`, 640 × 640)

Uso:
  pip install pillow numpy opencv-python-headless   (y poppler-utils para pdftoppm)
  python3 build_images.py <dir_pdfimages> <dir_fotos> <dir_salida>

Tratamiento homogéneo de producto: cada equipo se recorta, se coloca sobre el mismo lienzo
blanco 4:3 con el mismo tamaño visual y la misma sombra de contacto suave. Los dos equipos que
solo existen en foto con fondo (Eco Wireless y Diatermia Multifunción) se recortan con GrabCut.
Nunca se amplía por encima de la resolución original.
"""
import os
import subprocess
import sys
import tempfile

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

# ---------------------------------------------------------------- más equipos (6 categorías, mismo tratamiento)
def superinductiva():
    """Superinductiva VytaMeD: recorte de la escena del catálogo (pág. 7) con GrabCut y marcas a mano."""
    img = cv2.imread(pdf('i-007-031.png'))
    h, w = img.shape[:2]
    mask = np.full((h, w), cv2.GC_BGD, np.uint8)
    mask[290:920, 510:1300] = cv2.GC_PR_BGD
    for x0, y0, x1, y1 in [(525, 365, 822, 540), (545, 540, 985, 820), (980, 320, 1020, 810), (1030, 295, 1290, 570),
                           (1090, 530, 1240, 740), (1025, 615, 1260, 705), (850, 660, 1180, 915)]:
        mask[y0:y1, x0:x1] = cv2.GC_PR_FGD
    for x0, y0, x1, y1 in [(570, 395, 790, 505), (580, 585, 950, 785), (992, 360, 1008, 760), (1130, 575, 1195, 690)]:
        mask[y0:y1, x0:x1] = cv2.GC_FGD
    cv2.circle(mask, (1160, 432), 118, cv2.GC_FGD, 30)   # aro del aplicador
    cv2.circle(mask, (1160, 432), 62, cv2.GC_BGD, -1)    # su hueco
    for x0, y0, x1, y1 in [(800, 270, 975, 525), (1290, 440, 1536, 760), (0, 0, w, 290), (0, 930, w, h),
                           (1018, 470, 1092, 600), (1238, 560, 1290, 615), (1240, 712, 1290, 760), (510, 822, 845, 930)]:
        mask[y0:y1, x0:x1] = cv2.GC_BGD                  # estanterías, cama, pared y suelo
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(img, mask, None, bgd, fgd, 10, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    yy, xx = np.mgrid[0:h, 0:w]
    b, g, r = [img[..., i].astype(int) for i in range(3)]
    lum = (r + g + b) / 3

    def keep(m, k=5, minarea=2500):
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        n, lab, st, _ = cv2.connectedComponentsWithStats(m)
        return np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > minarea]).astype(np.uint8) * 255

    m = keep(m, 5, 3000)
    # restos de cama, pared y suelo alrededor del mástil y del aro
    for x0, y0, x1, y1 in [(1016, 470, 1100, 615), (1016, 700, 1100, 760), (1232, 540, 1300, 612), (1232, 702, 1300, 770),
                           (1263, 612, 1300, 702), (977, 530, 996, 765), (1014, 600, 1036, 760), (1036, 600, 1100, 614),
                           (1014, 690, 1100, 745), (1225, 600, 1300, 632), (1014, 600, 1040, 660), (966, 340, 996, 530)]:
        m[y0:y1, x0:x1] = 0
    ring = np.hypot(xx - 1160, yy - 426) > 121
    for x0, y0, x1, y1 in [(1016, 380, 1100, 600), (1222, 290, 1320, 612), (1070, 290, 1230, 330)]:
        m[(xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1) & ring] = 0
    m[(yy >= 740) & (yy < 900) & (xx >= 940) & (xx < 1180) & (((r - b) >= 5) & (lum > 125) | (lum > 162))] = 0
    m = keep(m, 5)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    return cutout(img, m)


def physio_invasiva():
    """Physio Invasiva 2.0 (EasyTech): foto sobre fondo cian. Recorte guiado por un polígono y
    corrección del tono cian para que el equipo quede blanco, como el resto."""
    img = cv2.resize(cv2.imread(pdf('i-015-089.jpg')), None, fx=.25, fy=.25, interpolation=cv2.INTER_AREA)
    h, w = img.shape[:2]
    poly = np.array([(262, 293), (606, 353), (628, 363), (634, 402), (632, 562), (548, 585), (160, 537), (140, 520),
                     (138, 430), (158, 398)], np.int32)
    band = np.zeros((h, w), np.uint8)
    cv2.fillPoly(band, [poly], 255)
    mask = np.full((h, w), cv2.GC_BGD, np.uint8)
    mask[cv2.dilate(band, np.ones((25, 25), np.uint8)) > 0] = cv2.GC_PR_BGD
    mask[band > 0] = cv2.GC_PR_FGD
    inner = cv2.erode(band, np.ones((31, 31), np.uint8)) > 0
    mask[inner] = cv2.GC_FGD
    bgd, fgd = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(img, mask, None, bgd, fgd, 10, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    m = largest(m, 5)
    body = img[inner & (cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) > 150)]
    fix = np.clip(img.astype(np.float32) * (238.0 / np.median(body, axis=0)), 0, 255).astype(np.uint8)
    return cutout(fix, m)


def whiten(src, crop=None, cut=226):
    """Lleva a blanco puro un fondo casi blanco o crema (para recortar después con from_white)."""
    im = Image.open(pdf(src)).convert('RGB')
    if crop:
        im = im.crop(crop)
    out = os.path.join(tempfile.mkdtemp(), 'w.png')
    im.point(lambda v: 255 if v > cut else v).save(out)
    return out



CATEGORIES = {
    'cat-presoterapia': (from_white(pdf('i-048-315.png')), dict(box=(0.66, 0.66), area=0.26)),
    'cat-ondas': (from_white(pdf('i-032-207.jpg')), dict(box=(0.72, 0.76), area=0.3)),
    'cat-magnetoterapia': (superinductiva(), dict(box=(0.8, 0.76), area=0.34)),
    'cat-laser': (from_white(whiten('i-009-045.png', cut=240)), dict(box=(0.84, 0.7), area=0.36)),
    'cat-electrolisis': (physio_invasiva(), dict(box=(0.8, 0.72), area=0.32)),
    'cat-camillas': (from_white(whiten('i-014-082.jpg', (88, 36, 388, 238))), dict(box=(0.86, 0.72), area=0.36)),
}
for name, (obj, opt) in CATEGORIES.items():
    save(stage(obj, **opt), name, [240, 360, 480])

# ---------------------------------------------------------------- catálogo: portada y dos páginas para la maqueta 3D
CATALOG = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'docs', 'catalogo-vytalgroup-2026.pdf')
tmp = tempfile.mkdtemp()
for page, name, widths in [(1, 'catalogo-portada', [300, 450, 600]), (6, 'catalogo-p06', [300, 450]), (8, 'catalogo-p08', [300, 450])]:
    subprocess.run(['pdftoppm', '-r', '80', '-f', str(page), '-l', str(page), '-png', '-singlefile', CATALOG,
                    os.path.join(tmp, name)], check=True)
    save(Image.open(os.path.join(tmp, name + '.png')), name, widths)

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
