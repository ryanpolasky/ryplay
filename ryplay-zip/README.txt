ryplay perf/security/cleanup — manual application instructions
==============================================================

This zip contains all changed/new files plus a list of files to delete,
matching the single commit `2a06c4f`.

Apply with the included script (run from repo root):
    bash apply.sh

Or do it manually:

  1. From the ryplay repo root, on a fresh branch:
       git checkout -b perf-cleanup

  2. Copy all files from `files/` over your repo, preserving paths:
       cp -r files/. .

  3. Remove the deleted files listed in DELETED.txt:
       xargs rm -f < DELETED.txt

  4. Commit (the suggested message is in COMMIT_MSG.txt):
       git add -A
       git commit -F COMMIT_MSG.txt
       git push -u origin perf-cleanup

  5. Open a PR.

Notes
-----
- Build verified locally: `npm run build` passes.
- Lint output is identical to main (the existing `MinimalView.tsx:31`
  error is pre-existing).
- Backend now requires LASTFM_API_KEY at startup (fail-fast). For
  prod, also set RYPLAY_ALLOWED_ORIGINS=https://ryplay.dev.
- Spotify *user-OAuth* code removed; Spotify client-credentials
  *artwork-search* fallback (SPOTIFY_CLIENT_ID/SECRET) is kept.
