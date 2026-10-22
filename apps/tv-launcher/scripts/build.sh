#!/bin/sh
# Packages src/ into dist/tv-launcher.wgt (unsigned; Apps2Samsung signs it on install).
set -eu
cd "$(dirname "$0")/.."

[ -f src/icon.png ] || node scripts/make-icon.mjs
node scripts/build-marks.mjs

mkdir -p dist
rm -f dist/tv-launcher.wgt
(cd src && zip -q -r -X ../dist/tv-launcher.wgt . -x '*.DS_Store' -x '.*' -x 'img/marks/*' \
  -x 'img/easter-egg/*.jpg' -x 'img/easter-egg/runner.png' -x 'img/easter-egg/obstacle.png' \
  -x 'img/easter-egg/obstacle-face.png')

echo "Built dist/tv-launcher.wgt"
unzip -l dist/tv-launcher.wgt
