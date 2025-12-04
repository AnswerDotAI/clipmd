#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT/dist"
BUMP="${BUMP:-patch}"
KEY_PATH="${KEY_PATH:-$ROOT/signing-key.pem}"
CHROME_BIN="${CHROME_BIN:-}"
FILES=(manifest.json popup.html popup.js turndown.js README.md icons)

version() {
  python - <<'PY'
import json
from pathlib import Path
m=json.loads(Path("manifest.json").read_text())
print(m["version"])
PY
}

bump_version() {
  python - <<'PY'
import json
from pathlib import Path
path=Path("manifest.json")
m=json.loads(path.read_text())
parts=m["version"].split(".")
while len(parts)<3: parts.append("0")
if "${BUMP}"=="major":
    parts[0]=str(int(parts[0])+1);parts[1]="0";parts[2]="0"
elif "${BUMP}"=="minor":
    parts[1]=str(int(parts[1])+1);parts[2]="0"
else:
    parts[2]=str(int(parts[2])+1)
m["version"]=".".join(parts)
path.write_text(json.dumps(m,indent=2)+"\n")
print(m["version"])
PY
}

pick_chrome() {
  if [[ -n "$CHROME_BIN" ]]; then return 0; fi
  for bin in google-chrome-stable google-chrome chromium chromium-browser; do
    if command -v "$bin" >/dev/null 2>&1; then CHROME_BIN="$bin"; return 0; fi
  done
  return 1
}

mkdir -p "$DIST_DIR"
pushd "$ROOT" >/dev/null

NEW_VERSION="$(bump_version)"
STAGE="$DIST_DIR/clipmd-$NEW_VERSION"
rm -rf "$STAGE"
mkdir -p "$STAGE"

for f in "${FILES[@]}"; do
  if [[ -e "$f" ]]; then
    cp -R "$f" "$STAGE/"
  fi
done

(cd "$DIST_DIR" && zip -qr "clipmd-$NEW_VERSION.zip" "clipmd-$NEW_VERSION")

if [[ ! -f "$KEY_PATH" ]]; then
  openssl genrsa -out "$KEY_PATH" 2048 >/dev/null 2>&1
fi

if pick_chrome; then
  "$CHROME_BIN" --pack-extension="$STAGE" --pack-extension-key="$KEY_PATH" >/dev/null 2>&1 || true
  CRX_CANDIDATE="$STAGE.crx"
  [[ -f "$CRX_CANDIDATE" ]] || CRX_CANDIDATE="$STAGE/clipmd-$NEW_VERSION.crx"
  if [[ -f "$CRX_CANDIDATE" ]]; then
    mv "$CRX_CANDIDATE" "$DIST_DIR/clipmd-$NEW_VERSION.crx"
  else
    echo "Chrome ran but CRX not found; skipping CRX output" >&2
  fi
else
  echo "Chrome/Chromium not found; skipping CRX build" >&2
fi

echo "$NEW_VERSION" > "$DIST_DIR/version.txt"
popd >/dev/null
echo "Built version $NEW_VERSION at $DIST_DIR"
