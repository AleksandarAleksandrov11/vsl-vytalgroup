#!/bin/bash
# Genera las fuentes autoalojadas con el subconjunto que usa la web en español:
# latín básico + Latin-1 (á é í ó ú ñ ü ¿ ¡ · × ° Ø...) + comillas tipográficas, viñeta, puntos suspensivos y €.
# Origen: paquetes @fontsource/syne y @fontsource/inter (licencia SIL OFL 1.1).
# Uso: bash scripts/assets/subset_fonts.sh   (requiere: pip install fonttools brotli; npm i -D @fontsource/syne @fontsource/inter)
set -e
for f in syne-700 syne-800 inter-400 inter-500 inter-600; do
  fam=${f%-*}; w=${f#*-}
  pyftsubset "node_modules/@fontsource/$fam/files/$fam-latin-$w-normal.woff2" \
    --unicodes="U+0020-007E,U+00A0-00FF,U+2018-201F,U+2022,U+2026,U+20AC" \
    --layout-features="kern,liga,calt,ccmp,locl,mark,mkmk" \
    --flavor=woff2 --output-file="assets/fonts/$f.woff2"
done
ls -la assets/fonts
