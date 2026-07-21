#!/bin/bash
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if command -v dpkg-deb >/dev/null 2>&1; then
  BUILD="/tmp/racketclub-deb-build-$$"
  rm -rf "$BUILD"
  mkdir -p "$BUILD/DEBIAN"
  cp "$ROOT/pkg/DEBIAN/control" "$BUILD/DEBIAN/"
  for f in racketclub_gate.py racketclub-gate RestAPI.py Logger.py INIFile.py \
    AllowList.py Secrets.py UserAppServer.py config.ini \
    start_racketclub-gate.sh stop_racketclub-gate.sh; do
    cp "$ROOT/pkg/$f" "$BUILD/"
  done
  find "$BUILD" -type f -exec sed -i 's/\r$//' {} +
  chmod 755 "$BUILD/DEBIAN" "$BUILD"/*.sh "$BUILD/racketclub-gate" "$BUILD"/*.py
  chmod 644 "$BUILD/DEBIAN/control" "$BUILD/config.ini"
  VERSION="$(awk -F': ' '/^Version:/{print $2; exit}' "$ROOT/pkg/DEBIAN/control")"
  OUT="$ROOT/racketclub-gate_${VERSION}_all.deb"
  dpkg-deb --build -Zgzip "$BUILD" "$OUT"
  rm -rf "$BUILD"
  echo "Built $OUT"
else
  exec python "$ROOT/build-deb.py"
fi
