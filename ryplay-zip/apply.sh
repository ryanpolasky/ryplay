#!/usr/bin/env bash
# Apply the ryplay changes from the unzipped directory.
# Run this from the directory you unzipped into, with the repo at $1
# (defaults to ../ryplay).
set -euo pipefail

REPO="${1:-../ryplay}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -d "$REPO/.git" ]]; then
  echo "ERROR: $REPO doesn't look like a git repo. Pass the ryplay repo path as the first arg." >&2
  exit 1
fi

echo "Copying changed/new files into $REPO..."
cp -r "$HERE/files/." "$REPO/"

echo "Deleting removed files..."
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  rm -f "$REPO/$f"
done < "$HERE/DELETED.txt"

echo "Done. Now in $REPO:"
echo "  git checkout -b perf-cleanup"
echo "  git add -A"
echo "  git commit -F \"$HERE/COMMIT_MSG.txt\""
echo "  git push -u origin perf-cleanup"
