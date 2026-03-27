import { Database } from "bun:sqlite";
import type {
  OutcomeStore,
  EventStore,
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
  error TEXT
);

CREATE TABLE IF NOT EXISTS target_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  time INTEGER NOT NULL,
  success INTEGER NOT NULL,
  error TEXT
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
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_provider_outcomes_time ON provider_outcomes(provider, time);
CREATE INDEX IF NOT EXISTS idx_provider_outcomes_success ON provider_outcomes(provider, success);
CREATE INDEX IF NOT EXISTS idx_target_outcomes_time ON target_outcomes(provider, target, time);
CREATE INDEX IF NOT EXISTS idx_target_outcomes_success ON target_outcomes(provider, target, success);
CREATE INDEX IF NOT EXISTS idx_check_outcomes_time ON check_outcomes(provider, target, check_name, time);
CREATE INDEX IF NOT EXISTS idx_check_outcomes_success ON check_outcomes(provider, target, check_name, success);

CREATE TABLE IF NOT EXISTS provider_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  code TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS target_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  code TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS check_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  check_name TEXT NOT NULL,
  code TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  kind TEXT NOT NULL,
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_events_open ON provider_events(provider, code) WHERE end_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_target_events_open ON target_events(provider, target, code) WHERE end_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_check_events_open ON check_events(provider, target, check_name, code) WHERE end_time IS NULL;
`;

export class SqliteOutcomeStore implements OutcomeStore {
  constructor(private db: Database) {}

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

export class SqliteEventStore implements EventStore {
  constructor(private db: Database) {}

  async getOpenProviderEvents(): Promise<{ id: number; provider: string; code: string }[]> {
    const stmt = this.db.prepare(`
      SELECT id, provider, code FROM provider_events WHERE end_time IS NULL
    `);
    return stmt.all() as { id: number; provider: string; code: string }[];
  }

  async getOpenTargetEvents(): Promise<{ id: number; provider: string; target: string; code: string }[]> {
    const stmt = this.db.prepare(`
      SELECT id, provider, target, code FROM target_events WHERE end_time IS NULL
    `);
    return stmt.all() as { id: number; provider: string; target: string; code: string }[];
  }

  async getOpenCheckEvents(): Promise<{ id: number; provider: string; target: string; check: string; code: string }[]> {
    const stmt = this.db.prepare(`
      SELECT id, provider, target, check_name as "check", code FROM check_events WHERE end_time IS NULL
    `);
    return stmt.all() as { id: number; provider: string; target: string; check: string; code: string }[];
  }

  async openProviderEvent(
    provider: string,
    code: string,
    time: Date,
    message: string
  ): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO provider_events (provider, code, start_time, message)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(provider, code, time.getTime(), message);
    return Number(result.lastInsertRowid);
  }

  async closeProviderEvent(id: number, time: Date): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE provider_events SET end_time = ? WHERE id = ?
    `);
    stmt.run(time.getTime(), id);
  }

  async openTargetEvent(
    provider: string,
    target: string,
    code: string,
    time: Date,
    message: string
  ): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO target_events (provider, target, code, start_time, message)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(provider, target, code, time.getTime(), message);
    return Number(result.lastInsertRowid);
  }

  async closeTargetEvent(id: number, time: Date): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE target_events SET end_time = ? WHERE id = ?
    `);
    stmt.run(time.getTime(), id);
  }

  async openCheckEvent(
    provider: string,
    target: string,
    check: string,
    code: string,
    kind: "error" | "violation",
    time: Date,
    message: string
  ): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO check_events (provider, target, check_name, code, start_time, kind, message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(provider, target, check, code, time.getTime(), kind, message);
    return Number(result.lastInsertRowid);
  }

  async closeCheckEvent(id: number, time: Date): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE check_events SET end_time = ? WHERE id = ?
    `);
    stmt.run(time.getTime(), id);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export function createSqliteStores(path: string): {
  outcomeStore: SqliteOutcomeStore;
  eventStore: SqliteEventStore;
  close: () => void;
} {
  const db = new Database(path);
  db.exec(SCHEMA);
  return {
    outcomeStore: new SqliteOutcomeStore(db),
    eventStore: new SqliteEventStore(db),
    close: () => db.close(),
  };
}
