import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), "fsc.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH, { readonly: false, fileMustExist: false });
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}
