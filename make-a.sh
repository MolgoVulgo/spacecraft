#!/usr/bin/env bash
set -euo pipefail

OUT="projet.zip"
TMP="${OUT}.tmp"

rm -f "$OUT" "$TMP"

EXCLUDES=(
  "./$OUT"
  "./$TMP"

  "./.git/*"
  "./.agents/*"
  "./.codex/*"

  "./node_modules/*"
  "./dist/*"
  "./stl/*"

  "./.cache/*"
  "./coverage/*"
  "./.vite/*"

  "*.log"
  ".DS_Store"
  "Thumbs.db"
  ".env"
  ".env.*"
)

zip -r "$TMP" . -x "${EXCLUDES[@]}"

mv "$TMP" "$OUT"

echo "Archive créée : $OUT"
