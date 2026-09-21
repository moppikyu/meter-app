import { db } from "./db";
import { evaluateReading, ReadingFlag } from "./validation";

export type MeterType = "water" | "electric";

export interface Meter {
  id: number;
  meter_code: string;
  meter_type: MeterType;
  location_label: string;
  description: string | null;
  digit_count: number;
  is_active: number;
  tenant_name: string | null; // resolved from the current assignment, if any
}

export interface ReadingRow {
  id: number;
  meter_id: number;
  reading_date: string;
  reading_value: number;
  photo_path: string | null;
  flag: ReadingFlag;
  notes: string | null;
  is_adjustment: number;
}

/** All meters of a type, with the currently-assigned tenant name resolved (null = vacant). */
export function getMeters(type: MeterType, includeInactive = false): Meter[] {
  const activeClause = includeInactive ? "" : "AND m.is_active = 1";
  return db
    .prepare(
      `SELECT m.id, m.meter_code, m.meter_type, m.location_label, m.description,
              m.digit_count, m.is_active,
              t.name as tenant_name
       FROM meters m
       LEFT JOIN meter_tenant_assignments a
         ON a.meter_id = m.id AND a.end_date IS NULL
       LEFT JOIN tenants t ON t.id = a.tenant_id
       WHERE m.meter_type = ? ${activeClause}
       ORDER BY m.location_label, m.meter_code`
    )
    .all(type) as unknown as Meter[];
}

/** Most recent reading for a meter (excluding any that have been corrected/superseded). */
export function getLatestReading(meterId: number): ReadingRow | null {
  const row = db
    .prepare(
      `SELECT id, meter_id, reading_date, reading_value, photo_path, flag, notes, is_adjustment
       FROM readings
       WHERE meter_id = ? AND superseded_by IS NULL
       ORDER BY reading_date DESC, id DESC
       LIMIT 1`
    )
    .get(meterId) as ReadingRow | undefined;
  return row ?? null;
}

/** Full history for a meter, oldest first — used for the trend/history view. */
export function getMeterHistory(meterId: number): ReadingRow[] {
  return db
    .prepare(
      `SELECT id, meter_id, reading_date, reading_value, photo_path, flag, notes, is_adjustment
       FROM readings
       WHERE meter_id = ? AND superseded_by IS NULL
       ORDER BY reading_date ASC, id ASC`
    )
    .all(meterId) as unknown as ReadingRow[];
}

/** Average of the last few monthly increases for a meter, used for spike detection. */
function getTrailingAverageIncrease(meterId: number, lookback = 6): number | null {
  const rows = getMeterHistory(meterId).slice(-lookback - 1); // need N+1 rows to get N increases
  if (rows.length < 2) return null;

  const increases: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const diff = rows[i].reading_value - rows[i - 1].reading_value;
    if (diff > 0) increases.push(diff);
  }
  if (increases.length === 0) return null;
  return increases.reduce((a, b) => a + b, 0) / increases.length;
}

export interface SaveReadingInput {
  meterId: number;
  readingDate: string; // ISO date, e.g. "2026-09-14"
  readingValue: number;
  photoPath: string | null;
  notes: string | null;
  isAdjustment: boolean;
  batchId: number | null;
  createdBy: number;
}

export interface SaveReadingResult {
  id: number;
  increase: number;
  flag: ReadingFlag;
  previousValue: number | null;
}

/**
 * Saves a new reading for a meter, computing the increase and any warning
 * flag against the previous reading. If a reading already exists for this
 * meter in the same batch, it is corrected (the old row is marked
 * superseded rather than deleted) instead of creating a duplicate.
 */
export function saveReading(input: SaveReadingInput): SaveReadingResult {
  const meter = db
    .prepare("SELECT digit_count FROM meters WHERE id = ?")
    .get(input.meterId) as { digit_count: number } | undefined;
  const digitCount = meter?.digit_count ?? 5;

  const previous = getLatestReading(input.meterId);
  const trailingAverage = getTrailingAverageIncrease(input.meterId);

  const { flag, increase } = evaluateReading(
    input.readingValue,
    previous ? previous.reading_value : null,
    digitCount,
    trailingAverage
  );

  // If this meter already has a reading in the same batch, treat this as a
  // correction: mark the old row superseded rather than inserting a duplicate.
  let supersedes: number | null = null;
  if (input.batchId !== null) {
    const existing = db
      .prepare(
        `SELECT id FROM readings WHERE meter_id = ? AND batch_id = ? AND superseded_by IS NULL`
      )
      .get(input.meterId, input.batchId) as { id: number } | undefined;
    if (existing) supersedes = existing.id;
  }

  const result = db
    .prepare(
      `INSERT INTO readings
        (batch_id, meter_id, reading_date, reading_value, photo_path, flag, notes, is_adjustment, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.batchId,
      input.meterId,
      input.readingDate,
      input.readingValue,
      input.photoPath,
      flag,
      input.notes,
      input.isAdjustment ? 1 : 0,
      input.createdBy
    );

  const newId = Number(result.lastInsertRowid);

  if (supersedes !== null) {
    db.prepare("UPDATE readings SET superseded_by = ? WHERE id = ?").run(
      newId,
      supersedes
    );
  }

  return {
    id: newId,
    increase,
    flag,
    previousValue: previous ? previous.reading_value : null,
  };
}

/** Meters of a type that have NOT yet been read in the given batch — powers the "missing readings" warning. */
export function getMissingMeters(type: MeterType, batchId: number): Meter[] {
  const all = getMeters(type);
  const readMeterIds = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT meter_id FROM readings WHERE batch_id = ? AND superseded_by IS NULL`
        )
        .all(batchId) as { meter_id: number }[]
    ).map((r) => r.meter_id)
  );
  return all.filter((m) => !readMeterIds.has(m.id));
}

/** Latest + second-latest reading for a meter, with the increase computed on the fly (never stored — see schema notes). */
export interface MeterSummary {
  latest: ReadingRow | null;
  previous: ReadingRow | null;
  increase: number | null;
}

export function getMeterSummary(meterId: number): MeterSummary {
  const history = getMeterHistory(meterId);
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const increase =
    latest && previous ? latest.reading_value - previous.reading_value : null;
  return { latest, previous, increase };
}

// ---------------------------------------------------------------------
// Meter & tenant management (add/edit meters, rename or reassign tenants)
// ---------------------------------------------------------------------

export interface MeterInput {
  meterCode: string;
  meterType: MeterType;
  locationLabel: string;
  description?: string | null;
}

export function createMeter(input: MeterInput): number {
  const result = db
    .prepare(
      `INSERT INTO meters (meter_code, meter_type, location_label, description)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      input.meterCode,
      input.meterType,
      input.locationLabel,
      input.description ?? null
    );
  return Number(result.lastInsertRowid);
}

export interface MeterUpdateInput {
  locationLabel?: string;
  description?: string | null;
  isActive?: boolean;
}

export function updateMeter(meterId: number, input: MeterUpdateInput): void {
  if (input.locationLabel !== undefined) {
    db.prepare("UPDATE meters SET location_label = ? WHERE id = ?").run(
      input.locationLabel,
      meterId
    );
  }
  if (input.description !== undefined) {
    db.prepare("UPDATE meters SET description = ? WHERE id = ?").run(
      input.description,
      meterId
    );
  }
  if (input.isActive !== undefined) {
    db.prepare("UPDATE meters SET is_active = ? WHERE id = ?").run(
      input.isActive ? 1 : 0,
      meterId
    );
  }
}

/** Renames the tenant currently on a meter, without touching assignment history. Fixes placeholder names in place. */
export function renameCurrentTenant(meterId: number, newName: string): boolean {
  const assignment = db
    .prepare(
      `SELECT tenant_id FROM meter_tenant_assignments WHERE meter_id = ? AND end_date IS NULL`
    )
    .get(meterId) as { tenant_id: number } | undefined;
  if (!assignment) return false;
  db.prepare("UPDATE tenants SET name = ? WHERE id = ?").run(
    newName,
    assignment.tenant_id
  );
  return true;
}

/**
 * Tenant turnover: ends the current assignment (if any) as of `effectiveDate`
 * and starts a new one for `newName`. Pass `newName = null` to mark the
 * meter vacant instead of assigning someone new. Existing readings keep
 * pointing at the correct tenant for their period — see meter_tenant_assignments.
 */
export function reassignTenant(
  meterId: number,
  newName: string | null,
  effectiveDate: string
): void {
  db.prepare(
    `UPDATE meter_tenant_assignments SET end_date = ?
     WHERE meter_id = ? AND end_date IS NULL`
  ).run(effectiveDate, meterId);

  if (newName && newName.trim() !== "") {
    const tenantResult = db
      .prepare("INSERT INTO tenants (name) VALUES (?)")
      .run(newName.trim());
    const tenantId = Number(tenantResult.lastInsertRowid);
    db.prepare(
      `INSERT INTO meter_tenant_assignments (meter_id, tenant_id, start_date)
       VALUES (?, ?, ?)`
    ).run(meterId, tenantId, effectiveDate);
  }
}

/** Single meter by id, with the currently-assigned tenant resolved. */
export function getMeterById(meterId: number): Meter | null {
  const row = db
    .prepare(
      `SELECT m.id, m.meter_code, m.meter_type, m.location_label, m.description,
              m.digit_count, m.is_active,
              t.name as tenant_name
       FROM meters m
       LEFT JOIN meter_tenant_assignments a
         ON a.meter_id = m.id AND a.end_date IS NULL
       LEFT JOIN tenants t ON t.id = a.tenant_id
       WHERE m.id = ?`
    )
    .get(meterId) as Meter | undefined;
  return row ?? null;
}

/** The current calendar-month period label, in the same format used when a reading is saved (see reading-form.tsx). */
export function getCurrentPeriodLabel(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Active meters of a type that have no reading yet in the current month's
 * batch. If no one has started this month's cycle at all, every active
 * meter counts as missing — that's the correct answer, not an edge case.
 */
export function getMissingMetersForCurrentPeriod(type: MeterType): Meter[] {
  const periodLabel = getCurrentPeriodLabel();
  const batch = db
    .prepare(
      `SELECT id FROM reading_batches WHERE batch_type = ? AND period_label = ?`
    )
    .get(type, periodLabel) as { id: number } | undefined;

  if (!batch) return getMeters(type);
  return getMissingMeters(type, batch.id);
}

export interface Batch {
  id: number;
  batch_type: MeterType;
  period_label: string;
  scheduled_date: string;
  completed_at: string | null;
}

/** Finds an open batch for this type/period, or creates one. Keeps "start reading" idempotent. */
export function getOrCreateBatch(
  type: MeterType,
  periodLabel: string,
  scheduledDate: string,
  createdBy: number
): Batch {
  const existing = db
    .prepare(
      `SELECT id, batch_type, period_label, scheduled_date, completed_at
       FROM reading_batches WHERE batch_type = ? AND period_label = ?`
    )
    .get(type, periodLabel) as Batch | undefined;

  if (existing) return existing;

  const result = db
    .prepare(
      `INSERT INTO reading_batches (batch_type, period_label, scheduled_date, created_by)
       VALUES (?, ?, ?, ?)`
    )
    .run(type, periodLabel, scheduledDate, createdBy);

  return {
    id: Number(result.lastInsertRowid),
    batch_type: type,
    period_label: periodLabel,
    scheduled_date: scheduledDate,
    completed_at: null,
  };
}
