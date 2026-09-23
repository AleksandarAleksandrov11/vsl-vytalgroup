"""Ensambla el logo VytalGroup vectorizado (potrace) en varias versiones SVG.
Entrada: mark.svg, vytal.svg, group.svg generados con potrace desde la máscara
alfa del logo que aparece en el catálogo ADC | VytalGroup 2026 (página 1).
Uso: python3 build_logo.py <dir_trazados> <dir_salida>
"""
import re, sys, os

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

def paths(name):
    s = open(os.path.join(src, name + '.svg')).read()
    return ''.join(re.findall(r'<path d="[^"]+"\s*/>', s)).replace('\n', ' ')

T = 'translate(0 525) scale(.1 -.1)'  # transform de potrace (lienzo 844x525)
mark, vytal, group = paths('mark'), paths('vytal'), paths('group')

def grad(i, a, b):
    return (f'<linearGradient id="{i}" x1="191" y1="329" x2="650" y2="1" gradientUnits="userSpaceOnUse">'
            f'<stop offset="0" stop-color="{a}"/><stop offset=".55" stop-color="{b[0]}"/><stop offset="1" stop-color="{b[1]}"/></linearGradient>')

# Versiones completas (símbolo sobre texto), igual que el original
for key, g, cv, cg in [
    ('logo-vytalgroup', grad('vgm', '#102850', ('#2A6FA8', '#48A0A8')), '#102850', '#48A0A8'),
    ('logo-vytalgroup-light', grad('vgm', '#2F7BD0', ('#3FA8C8', '#5CC8C8')), '#FFFFFF', '#5CC8C8'),
]:
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 844 525" role="img" aria-label="VytalGroup">'
           f'<defs>{g}</defs>'
           f'<g transform="{T}" fill="url(#vgm)">{mark}</g>'
           f'<g transform="{T}" fill="{cv}">{vytal}</g>'
           f'<g transform="{T}" fill="{cg}">{group}</g></svg>')
    open(os.path.join(out, key + '.svg'), 'w').write(svg)

# Horizontal: símbolo a la izquierda y texto a la derecha (cabecera)
s = 0.52           # escala del símbolo
mw, mh = (650 - 191) * s, (329 - 1) * s
gap = 34
wx = mw + gap      # x donde empieza el texto
ty = (mh - 156) / 2 - 368  # centra el texto (alto 156, empieza en y=368)
W, H = wx + 844, mh
horiz = (f'<g transform="translate({-191*s:.1f} {-1*s:.1f}) scale({s})"><g transform="{T}" fill="url(#vgm)">{mark}</g></g>'
         f'<g transform="translate({wx:.1f} {ty:.1f})"><g transform="{T}" fill="var(--logo-a,#102850)">{vytal}</g>'
         f'<g transform="{T}" fill="var(--logo-b,#48A0A8)">{group}</g></g>')
open(os.path.join(out, 'logo-horizontal.inner.txt'), 'w').write(f'{W:.0f} {H:.0f}\n' + horiz)

# Símbolo solo (favicon), sobre cuadrado marino redondeado
fav = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
       f'<defs>{grad("vgm", "#2F7BD0", ("#3FA8C8", "#5CC8C8"))}</defs>'
       f'<rect width="512" height="512" rx="112" fill="#0B1929"/>'
       f'<g transform="translate(66 120) scale(.827)"><g transform="translate(-191 -1)"><g transform="{T}" fill="url(#vgm)">{mark}</g></g></g></svg>')
open(os.path.join(out, 'favicon.svg'), 'w').write(fav)
print('ok', W, H)
