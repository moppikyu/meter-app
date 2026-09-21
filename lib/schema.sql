-- Meter Reading App — SQLite schema
-- Mirrors the Postgres-shaped design in the proposal doc (§6), so a future
-- migration to hosted Postgres (Phase 5, for remote viewer access) is a
-- data-layer swap, not a redesign.

-- Local users: exactly two roles for now — editor (you) and viewer (your aunt).
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Session tokens for local cookie-based auth (no third-party auth service).
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  unit_label    TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meters (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  meter_code    TEXT NOT NULL UNIQUE,       -- e.g. "W-2F-A", "E-2FA-03"
  meter_type    TEXT NOT NULL CHECK (meter_type IN ('water', 'electric')),
  location_label TEXT NOT NULL,             -- e.g. "2nd Floor A"
  description   TEXT,
  digit_count   INTEGER NOT NULL DEFAULT 5, -- confirmed: 5 whole-unit digits on both meter types
  is_active     INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = retired
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Effective-dated tenant assignment per meter, so tenant turnover doesn't
-- corrupt history — a past reading still shows the tenant who lived there then.
CREATE TABLE IF NOT EXISTS meter_tenant_assignments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  meter_id   INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date   TEXT,                          -- NULL = current tenant
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per monthly reading session (e.g. "September 2026 Water Reading"),
-- used to detect missing readings for a cycle.
CREATE TABLE IF NOT EXISTS reading_batches (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_type     TEXT NOT NULL CHECK (batch_type IN ('water', 'electric')),
  period_label   TEXT NOT NULL,             -- e.g. "September 2026"
  scheduled_date TEXT NOT NULL,             -- e.g. "2026-09-14"
  completed_at   TEXT,
  created_by     INTEGER REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS readings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id       INTEGER REFERENCES reading_batches(id) ON DELETE SET NULL,
  meter_id       INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  reading_date   TEXT NOT NULL,
  reading_value  REAL NOT NULL,
  photo_path     TEXT,                      -- relative path under data/photos, proof only
  flag           TEXT NOT NULL DEFAULT 'none' CHECK (flag IN ('none','decrease','spike','rollover')),
  notes          TEXT,
  is_adjustment  INTEGER NOT NULL DEFAULT 0, -- 1 = ad-hoc reading (tenant move-in/out, re-check)
  superseded_by  INTEGER REFERENCES readings(id), -- points to the correcting row, if any
  created_by     INTEGER REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_readings_meter_date ON readings(meter_id, reading_date);
CREATE INDEX IF NOT EXISTS idx_assignments_meter ON meter_tenant_assignments(meter_id, end_date);
