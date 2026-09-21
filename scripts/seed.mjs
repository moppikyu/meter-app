// One-time (idempotent) local database setup.
// Run with: npm run db:init
//
// Creates the schema, two local login accounts (editor + viewer), the real
// water/electric meter inventory, and the August->September electric
// baseline readings you provided. Water meters are created with no
// readings yet, since no baseline numbers were given for them.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "app.db");
const SCHEMA_PATH = path.join(ROOT, "lib", "schema.sql");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.join(DATA_DIR, "photos"))) {
  fs.mkdirSync(path.join(DATA_DIR, "photos"), { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));

function upsertUser(username, role, plainPassword) {
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existing) {
    console.log(`- user "${username}" already exists, leaving as-is`);
    return;
  }
  const hash = bcrypt.hashSync(plainPassword, 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)"
  ).run(username, hash, role);
  console.log(`- created user "${username}" (role: ${role})`);
}

// Default local accounts. CHANGE THESE after first login (or set
// SEED_EDITOR_PASSWORD / SEED_VIEWER_PASSWORD env vars before running this
// script for the first time).
upsertUser("editor", "editor", process.env.SEED_EDITOR_PASSWORD || "changeme-editor");
upsertUser("aunt", "viewer", process.env.SEED_VIEWER_PASSWORD || "changeme-viewer");

const editorId = db
  .prepare("SELECT id FROM users WHERE username = 'editor'")
  .get().id;

function upsertMeter(meterCode, meterType, locationLabel) {
  const existing = db
    .prepare("SELECT id FROM meters WHERE meter_code = ?")
    .get(meterCode);
  if (existing) return existing.id;
  const result = db
    .prepare(
      "INSERT INTO meters (meter_code, meter_type, location_label) VALUES (?, ?, ?)"
    )
    .run(meterCode, meterType, locationLabel);
  return Number(result.lastInsertRowid);
}

function assignTenant(meterId, tenantName, startDate) {
  const tenantResult = db
    .prepare("INSERT INTO tenants (name) VALUES (?)")
    .run(tenantName);
  const tenantId = Number(tenantResult.lastInsertRowid);
  db.prepare(
    "INSERT INTO meter_tenant_assignments (meter_id, tenant_id, start_date) VALUES (?, ?, ?)"
  ).run(meterId, tenantId, startDate);
}

function getOrCreateBatch(batchType, periodLabel, scheduledDate, completedAt) {
  const existing = db
    .prepare(
      "SELECT id FROM reading_batches WHERE batch_type = ? AND period_label = ?"
    )
    .get(batchType, periodLabel);
  if (existing) return existing.id;
  const result = db
    .prepare(
      `INSERT INTO reading_batches (batch_type, period_label, scheduled_date, completed_at, created_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(batchType, periodLabel, scheduledDate, completedAt, editorId);
  return Number(result.lastInsertRowid);
}

function insertBaselineReading(meterId, batchId, date, value) {
  const existing = db
    .prepare(
      "SELECT id FROM readings WHERE meter_id = ? AND batch_id = ?"
    )
    .get(meterId, batchId);
  if (existing) return;
  db.prepare(
    `INSERT INTO readings
      (batch_id, meter_id, reading_date, reading_value, flag, is_adjustment, created_by)
     VALUES (?, ?, ?, ?, 'none', 0, ?)`
  ).run(batchId, meterId, date, value, editorId);
}

// ---------------------------------------------------------------------
// Water meters (5) — confirmed layout, no Ground Floor (separate water source).
// No baseline readings provided yet, so these start with an empty history.
// ---------------------------------------------------------------------
const waterMeters = [
  ["W-2F-A", "2nd Floor A"],
  ["W-2F-B", "2nd Floor B"],
  ["W-3F-A", "3rd Floor A"],
  ["W-3F-A2", "3rd Floor A2"],
  ["W-3F-B", "3rd Floor B"],
];
for (const [code, label] of waterMeters) {
  upsertMeter(code, "water", label);
}
console.log(`- seeded ${waterMeters.length} water meters (no readings yet)`);

// ---------------------------------------------------------------------
// Electric meters (25) — grouped by wing, with the August->September
// baseline readings you provided. Names are temporary placeholders per
// your note, and can be edited once official tenant names are set.
// ---------------------------------------------------------------------
const electricWings = [
  {
    code: "GF",
    label: "Ground Floor (Other Side)",
    tenants: [
      { name: null, previous: 1156, current: 1159 }, // vacant — no tenant assignment
      { name: "Sherlyn and CK", previous: 3011, current: 3021 },
      { name: "Melchi", previous: 796, current: 805 },
    ],
  },
  {
    code: "2FA",
    label: "2nd Floor A",
    tenants: [
      { name: "Christian", previous: 2809, current: 2820 },
      { name: "Geneva & Daniel", previous: 2667, current: 2672 },
      { name: "Jomel & Sheryl", previous: 2585, current: 2601 },
      { name: "Melody & Roselyn", previous: 3256, current: 3284 },
      { name: "Josilito", previous: 3177, current: 3224 },
      { name: "Joshua", previous: 3687, current: 3691 },
      { name: "Rivor & Mary", previous: 3150, current: 3191 },
      { name: "Thea", previous: 4111, current: 4115 },
    ],
  },
  {
    code: "2FB",
    label: "2nd Floor B",
    tenants: [
      { name: "Fernan", previous: 4372, current: 4403 },
      { name: "Nida", previous: 3776, current: 3816 },
      { name: "Bernadette (Joy & Sonny)", previous: 3043, current: 3102 },
      { name: "Eugene", previous: 2002, current: 2011 },
      { name: "Charis", previous: 2666, current: 2670 },
      { name: "August", previous: 3873, current: 3906 },
      { name: "Arlyn", previous: 3756, current: 3776 },
    ],
  },
  {
    code: "3FA",
    label: "3rd Floor A",
    tenants: [
      { name: "Bell", previous: 6675, current: 6694 },
      { name: "Ryan & Maribel", previous: 2853, current: 2858 },
      { name: "Joy and Sonny", previous: 644, current: 654 },
      { name: "Jason", previous: 914, current: 925 },
    ],
  },
  {
    code: "3FB",
    label: "3rd Floor B",
    tenants: [
      { name: "Carlo & Venice", previous: 3769, current: 3776 },
      { name: "Trixie", previous: 4927, current: 4930 },
      { name: "Delia & Eduardo", previous: 3416, current: 3448 },
    ],
  },
];

const augustBatch = getOrCreateBatch(
  "electric",
  "August 2026",
  "2026-08-25",
  "2026-08-25"
);
const septemberBatch = getOrCreateBatch(
  "electric",
  "September 2026",
  "2026-09-25",
  "2026-09-25"
);

let electricCount = 0;
for (const wing of electricWings) {
  wing.tenants.forEach((tenant, index) => {
    const seq = String(index + 1).padStart(2, "0");
    const meterCode = `E-${wing.code}-${seq}`;
    const meterId = upsertMeter(meterCode, "electric", wing.label);

    if (tenant.name) {
      const alreadyAssigned = db
        .prepare(
          "SELECT id FROM meter_tenant_assignments WHERE meter_id = ? AND end_date IS NULL"
        )
        .get(meterId);
      if (!alreadyAssigned) assignTenant(meterId, tenant.name, "2026-08-01");
    }
    // No assignment at all = vacant, shown as such in the UI (§15 of the proposal).

    insertBaselineReading(meterId, augustBatch, "2026-08-25", tenant.previous);
    insertBaselineReading(meterId, septemberBatch, "2026-09-25", tenant.current);
    electricCount++;
  });
}
console.log(`- seeded ${electricCount} electric meters with August->September baseline readings`);

console.log("\nDone. Local database is ready at data/app.db");
console.log("Default logins (change these passwords after first login):");
console.log(`  editor / ${process.env.SEED_EDITOR_PASSWORD || "changeme-editor"}`);
console.log(`  aunt   / ${process.env.SEED_VIEWER_PASSWORD || "changeme-viewer"}`);
