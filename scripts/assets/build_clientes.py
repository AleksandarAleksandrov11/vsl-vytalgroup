"""Material real de clientes para la tarjeta "Clientes" del hero (fotos y vídeo, formato 4:5).

Fuentes (enviadas por el cliente, sept. 2026):
  * image00020.jpeg  Fisioterapeuta tratando una rodilla con la diatermia (misma sesión que el vídeo)
  * image00019.jpeg  Botas de presoterapia VytalGroup en uso
  * image00017.jpeg  Diatermia recién montada sobre la camilla de una clínica
  * ff620f93-….mov   Vídeo vertical (464 × 832, 60 fps, 13,8 s) de la diatermia en consulta

No se usan las capturas de WhatsApp e Instagram: muestran nombres, números y conversaciones.

Uso:
  pip install pillow   (y ffmpeg con libx264 y libvpx-vp9)
  python3 build_clientes.py <dir_clientes> <dir_img_salida> <dir_video_salida>

El vídeo empieza en el plano general (11,3 s), que coincide con la foto que se ve mientras
carga, y sigue desde el principio: el bucle queda sin saltos. Se recorta a 4:5 y va sin audio.
"""
import glob
import os
import subprocess
import sys

from PIL import Image, ImageFilter, ImageOps

SRC, IMG, VID = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(IMG, exist_ok=True)
os.makedirs(VID, exist_ok=True)
AVIF_Q, WEBP_Q = 50, 78
WIDTHS = [400, 520, 640, 800]


def save(im, name):
    for w in WIDTHS:
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r = r.filter(ImageFilter.UnsharpMask(radius=0.8, percent=35, threshold=2))
        r.save(os.path.join(IMG, f'{name}-{w}.avif'), quality=AVIF_Q, speed=4)
        r.save(os.path.join(IMG, f'{name}-{w}.webp'), quality=WEBP_Q, method=6)
    print(name, im.size)


def crop45(path, x0=0, y0=0):
    """Recorte 4:5 a partir de (x0, y0), con la orientación EXIF aplicada."""
    im = ImageOps.exif_transpose(Image.open(os.path.join(SRC, path))).convert('RGB')
    w, h = im.size
    cw, ch = (w, round(w * 5 / 4)) if w * 5 / 4 <= h else (round(h * 4 / 5), h)
    return im.crop((x0, y0, x0 + cw, y0 + ch))


save(crop45('image00020.jpeg', y0=40), 'cliente-diatermia')
save(crop45('image00019.jpeg', y0=64), 'cliente-presoterapia')
save(crop45('image00017.jpeg', x0=790), 'cliente-clinica')

# ---------------------------------------------------------------- vídeo
mov = glob.glob(os.path.join(SRC, '*.mov'))[0]
chain = ('[0:v]trim=start=11.3,setpts=PTS-STARTPTS[a];[0:v]trim=end=11.3,setpts=PTS-STARTPTS[b];'
         '[a][b]concat=n=2:v=1:a=0,fps=30,crop=464:580:0:150,format=yuv420p[v]')
base = ['ffmpeg', '-v', 'error', '-y', '-i', mov, '-filter_complex', chain, '-map', '[v]', '-an']
subprocess.run(base + ['-c:v', 'libx264', '-preset', 'veryslow', '-crf', '29', '-profile:v', 'high', '-tune', 'film',
                       '-movflags', '+faststart', os.path.join(VID, 'cliente-diatermia.mp4')], check=True)
subprocess.run(base + ['-c:v', 'libvpx-vp9', '-crf', '44', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '1',
                       os.path.join(VID, 'cliente-diatermia.webm')], check=True)
print('vídeo', [f'{f}: {os.path.getsize(os.path.join(VID, f)) // 1024} KB' for f in sorted(os.listdir(VID))])
