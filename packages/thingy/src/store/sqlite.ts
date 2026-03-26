import { Database } from "bun:sqlite";
import type { OutcomeStore, OutcomeError, Violation } from "./types.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS provider_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  time INTEGER NOT NULL,
  value TEXT,
  error TEXT,
  UNIQUE(provider, time)
);

CREATE TABLE IF NOT EXISTS target_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  time INTEGER NOT NULL,
  value TEXT,
  error TEXT,
  UNIQUE(provider, target, time)
);

CREATE TABLE IF NOT EXISTS check_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  check_name TEXT NOT NULL,
  time INTEGER NOT NULL,
  value TEXT,
  violation TEXT,
  error TEXT,
  UNIQUE(provider, target, check_name, time)
);

CREATE INDEX IF NOT EXISTS idx_provider_outcomes_time ON provider_outcomes(provider, time);
CREATE INDEX IF NOT EXISTS idx_target_outcomes_time ON target_outcomes(provider, target, time);
CREATE INDEX IF NOT EXISTS idx_check_outcomes_time ON check_outcomes(provider, target, check_name, time);
CREATE INDEX IF NOT EXISTS idx_check_outcomes_error ON check_outcomes(provider, target, time) WHERE error IS NOT NULL;
`;

export class SqliteOutcomeStore implements OutcomeStore {
  private db: Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.exec(SCHEMA);
  }

  async recordProviderOutcome(
    provider: string,
    time: Date,
    result: { value?: Record<string, unknown>; error?: OutcomeError }
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO provider_outcomes (provider, time, value, error)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      provider,
      time.getTime(),
      result.value ? JSON.stringify(result.value) : null,
      result.error ? JSON.stringify(result.error) : null
    );
  }

  async recordTargetOutcome(
    provider: string,
    target: string,
    time: Date,
    result: { value?: Record<string, unknown>; error?: OutcomeError }
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO target_outcomes (provider, target, time, value, error)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      provider,
      target,
      time.getTime(),
      result.value ? JSON.stringify(result.value) : null,
      result.error ? JSON.stringify(result.error) : null
    );
  }

  async recordCheckOutcome(
    provider: string,
    target: string,
    check: string,
    time: Date,
    result: {
      value?: Record<string, unknown>;
      violation?: Violation;
      error?: OutcomeError;
    }
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO check_outcomes (provider, target, check_name, time, value, violation, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      provider,
      target,
      check,
      time.getTime(),
      result.value ? JSON.stringify(result.value) : null,
      result.violation ? JSON.stringify(result.violation) : null,
      result.error ? JSON.stringify(result.error) : null
    );
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
