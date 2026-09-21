import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Local, self-hosted database — a single file on disk, $0 cost, no account
// of any kind. Uses Node's built-in `node:sqlite` module (Node 22.5+) so
// there is no native addon to compile, which is the main practical
// annoyance with alternatives like better-sqlite3.

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");
const SCHEMA_PATH = path.join(process.cwd(), "lib", "schema.sql");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Reused across hot-reloads in dev so we don't open the file repeatedly.
declare global {
  // eslint-disable-next-line no-var
  var __meterDb: DatabaseSync | undefined;
}

function createConnection(): DatabaseSync {
  const database = new DatabaseSync(DB_PATH);
  database.exec("PRAGMA foreign_keys = ON;");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  database.exec(schema);
  return database;
}

export const db: DatabaseSync = global.__meterDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  global.__meterDb = db;
}
