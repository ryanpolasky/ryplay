CREATE TABLE IF NOT EXISTS listens (
  ts INTEGER NOT NULL,
  artist TEXT NOT NULL,
  track TEXT NOT NULL,
  album TEXT NOT NULL DEFAULT '',
  artist_mbid TEXT,
  release_mbid TEXT,
  caa_id INTEGER,
  duration_ms INTEGER,
  PRIMARY KEY (ts, artist, track)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS artist_genres (
  artist TEXT PRIMARY KEY,
  genre TEXT,
  checked_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
