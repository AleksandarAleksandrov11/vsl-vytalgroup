#!/bin/bash
# Genera las fuentes autoalojadas con el subconjunto que usa la web en español:
# latín básico + Latin-1 (á é í ó ú ñ ü ¿ ¡ · × °...) + comillas tipográficas, viñeta, puntos suspensivos y €.
# · Geist (variable): se recorta el eje de peso a 400..600, que es lo único que usa la web.
# · Instrument Serif cursiva: solo para palabras de acento en algunos titulares.
# Origen: paquetes @fontsource-variable/geist y @fontsource/instrument-serif (licencia SIL OFL 1.1).
# Uso: bash scripts/assets/subset_fonts.sh   (requiere: pip install fonttools brotli)
set -e
U="U+0020-007E,U+00A0-00FF,U+2018-201F,U+2022,U+2026,U+2032-2033,U+20AC"
TMP=$(mktemp -d)
fonttools varLib.instancer node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2 wght=400:600 -o "$TMP/geist.ttf" -q
pyftsubset "$TMP/geist.ttf" --unicodes="$U" --layout-features="kern,liga,calt,ccmp,locl,mark,mkmk,tnum" \
  --flavor=woff2 --output-file=assets/fonts/geist.woff2
# La cursiva solo lleva letras (con tildes y eñe) y puntuación básica: pesa la mitad
US="U+0020-0022,U+0027,U+002C-002E,U+003A-003B,U+003F,U+0041-005A,U+0061-007A,U+00A1,U+00BF,U+00C1,U+00C9,U+00CD,U+00D1,U+00D3,U+00DA,U+00DC,U+00E1,U+00E9,U+00ED,U+00F1,U+00F3,U+00FA,U+00FC,U+2019"
pyftsubset node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2 --unicodes="$US" \
  --layout-features="kern,liga,calt,ccmp,locl,mark,mkmk" --flavor=woff2 --output-file=assets/fonts/instrument-serif-italic.woff2
rm -rf "$TMP"
ls -la assets/fonts
