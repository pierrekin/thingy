import { Database } from "bun:sqlite";
import type {
  OutcomeStore,
  ProviderOutcome,
  TargetOutcome,
  CheckOutcome,
} from "./types.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS provider_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  time INTEGER NOT NULL,
  success INTEGER NOT NULL,
  error TEXT,
  UNIQUE(provider, time)
);

CREATE TABLE IF NOT EXISTS target_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  time INTEGER NOT NULL,
  success INTEGER NOT NULL,
  error TEXT,
  UNIQUE(provider, target, time)
);

CREATE TABLE IF NOT EXISTS check_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  check_name TEXT NOT NULL,
  time INTEGER NOT NULL,
  success INTEGER NOT NULL,
  value TEXT,
  violation TEXT,
  error TEXT,
  UNIQUE(provider, target, check_name, time)
);

CREATE INDEX IF NOT EXISTS idx_provider_outcomes_time ON provider_outcomes(provider, time);
CREATE INDEX IF NOT EXISTS idx_provider_outcomes_success ON provider_outcomes(provider, success);
CREATE INDEX IF NOT EXISTS idx_target_outcomes_time ON target_outcomes(provider, target, time);
CREATE INDEX IF NOT EXISTS idx_target_outcomes_success ON target_outcomes(provider, target, success);
CREATE INDEX IF NOT EXISTS idx_check_outcomes_time ON check_outcomes(provider, target, check_name, time);
CREATE INDEX IF NOT EXISTS idx_check_outcomes_success ON check_outcomes(provider, target, check_name, success);
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
    outcome: ProviderOutcome
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO provider_outcomes (provider, time, success, error)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      provider,
      time.getTime(),
      outcome.success ? 1 : 0,
      outcome.success ? null : JSON.stringify(outcome.error)
    );
  }

  async recordTargetOutcome(
    provider: string,
    target: string,
    time: Date,
    outcome: TargetOutcome
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO target_outcomes (provider, target, time, success, error)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      provider,
      target,
      time.getTime(),
      outcome.success ? 1 : 0,
      outcome.success ? null : JSON.stringify(outcome.error)
    );
  }

  async recordCheckOutcome(
    provider: string,
    target: string,
    check: string,
    time: Date,
    outcome: CheckOutcome
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO check_outcomes (provider, target, check_name, time, success, value, violation, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      provider,
      target,
      check,
      time.getTime(),
      outcome.success ? 1 : 0,
      outcome.success ? JSON.stringify(outcome.value) : null,
      outcome.success && outcome.violation ? JSON.stringify(outcome.violation) : null,
      outcome.success ? null : JSON.stringify(outcome.error)
    );
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
