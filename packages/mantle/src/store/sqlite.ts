import { Database } from "bun:sqlite";
import type {
  OutcomeStore,
  EventStore,
  BucketStore,
  ProviderOutcome,
  TargetOutcome,
  CheckOutcome,
  BucketStatus,
  BucketState,
  EventRecord,
  OpenProviderEvent,
  OpenTargetEvent,
  OpenCheckEvent,
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

CREATE TABLE IF NOT EXISTS provider_buckets (
  provider TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  bucket_end INTEGER NOT NULL,
  status TEXT,
  PRIMARY KEY (provider, bucket_start)
);

CREATE TABLE IF NOT EXISTS target_buckets (
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  bucket_end INTEGER NOT NULL,
  status TEXT,
  PRIMARY KEY (provider, target, bucket_start)
);

CREATE TABLE IF NOT EXISTS check_buckets (
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  check_name TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  bucket_end INTEGER NOT NULL,
  status TEXT,
  PRIMARY KEY (provider, target, check_name, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_provider_buckets_time ON provider_buckets(bucket_start, bucket_end);
CREATE INDEX IF NOT EXISTS idx_target_buckets_time ON target_buckets(bucket_start, bucket_end);
CREATE INDEX IF NOT EXISTS idx_check_buckets_time ON check_buckets(bucket_start, bucket_end);
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

  async getOpenProviderEvents(): Promise<OpenProviderEvent[]> {
    const stmt = this.db.prepare(`
      SELECT id, provider, code, start_time as startTime, message FROM provider_events WHERE end_time IS NULL
    `);
    return stmt.all() as OpenProviderEvent[];
  }

  async getOpenTargetEvents(): Promise<OpenTargetEvent[]> {
    const stmt = this.db.prepare(`
      SELECT id, provider, target, code, start_time as startTime, message FROM target_events WHERE end_time IS NULL
    `);
    return stmt.all() as OpenTargetEvent[];
  }

  async getOpenCheckEvents(): Promise<OpenCheckEvent[]> {
    const stmt = this.db.prepare(`
      SELECT id, provider, target, check_name as "check", code, start_time as startTime, message FROM check_events WHERE end_time IS NULL
    `);
    return stmt.all() as OpenCheckEvent[];
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

  async getEventsInRange(startTime: number, endTime: number): Promise<EventRecord[]> {
    // Events that overlap with the time window:
    // startTime < rangeEnd AND (endTime > rangeStart OR endTime IS NULL)
    const providerEvents = this.db.prepare(`
      SELECT id, provider, code, start_time, end_time, message
      FROM provider_events
      WHERE start_time < ? AND (end_time > ? OR end_time IS NULL)
    `).all(endTime, startTime) as {
      id: number;
      provider: string;
      code: string;
      start_time: number;
      end_time: number | null;
      message: string;
    }[];

    const targetEvents = this.db.prepare(`
      SELECT id, provider, target, code, start_time, end_time, message
      FROM target_events
      WHERE start_time < ? AND (end_time > ? OR end_time IS NULL)
    `).all(endTime, startTime) as {
      id: number;
      provider: string;
      target: string;
      code: string;
      start_time: number;
      end_time: number | null;
      message: string;
    }[];

    const checkEvents = this.db.prepare(`
      SELECT id, provider, target, check_name as "check", code, start_time, end_time, message
      FROM check_events
      WHERE start_time < ? AND (end_time > ? OR end_time IS NULL)
    `).all(endTime, startTime) as {
      id: number;
      provider: string;
      target: string;
      check: string;
      code: string;
      start_time: number;
      end_time: number | null;
      message: string;
    }[];

    const results: EventRecord[] = [];

    for (const e of providerEvents) {
      results.push({
        id: e.id,
        provider: e.provider,
        code: e.code,
        startTime: e.start_time,
        endTime: e.end_time,
        message: e.message,
      });
    }

    for (const e of targetEvents) {
      results.push({
        id: e.id,
        provider: e.provider,
        target: e.target,
        code: e.code,
        startTime: e.start_time,
        endTime: e.end_time,
        message: e.message,
      });
    }

    for (const e of checkEvents) {
      results.push({
        id: e.id,
        provider: e.provider,
        target: e.target,
        check: e.check,
        code: e.code,
        startTime: e.start_time,
        endTime: e.end_time,
        message: e.message,
      });
    }

    return results;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteBucketStore implements BucketStore {
  constructor(private db: Database) {}

  async upsertProviderBucket(
    provider: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus
  ): Promise<BucketStatus | undefined> {
    const existing = this.db.prepare(`
      SELECT status FROM provider_buckets WHERE provider = ? AND bucket_start = ?
    `).get(provider, bucketStart) as { status: string | null } | undefined;

    const oldStatus = existing?.status as BucketStatus | undefined;

    this.db.prepare(`
      INSERT INTO provider_buckets (provider, bucket_start, bucket_end, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (provider, bucket_start)
      DO UPDATE SET status = excluded.status, bucket_end = excluded.bucket_end
    `).run(provider, bucketStart, bucketEnd, status);

    return oldStatus;
  }

  async upsertTargetBucket(
    provider: string,
    target: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus
  ): Promise<BucketStatus | undefined> {
    const existing = this.db.prepare(`
      SELECT status FROM target_buckets WHERE provider = ? AND target = ? AND bucket_start = ?
    `).get(provider, target, bucketStart) as { status: string | null } | undefined;

    const oldStatus = existing?.status as BucketStatus | undefined;

    this.db.prepare(`
      INSERT INTO target_buckets (provider, target, bucket_start, bucket_end, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (provider, target, bucket_start)
      DO UPDATE SET status = excluded.status, bucket_end = excluded.bucket_end
    `).run(provider, target, bucketStart, bucketEnd, status);

    return oldStatus;
  }

  async upsertCheckBucket(
    provider: string,
    target: string,
    check: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus
  ): Promise<BucketStatus | undefined> {
    const existing = this.db.prepare(`
      SELECT status FROM check_buckets WHERE provider = ? AND target = ? AND check_name = ? AND bucket_start = ?
    `).get(provider, target, check, bucketStart) as { status: string | null } | undefined;

    const oldStatus = existing?.status as BucketStatus | undefined;

    this.db.prepare(`
      INSERT INTO check_buckets (provider, target, check_name, bucket_start, bucket_end, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (provider, target, check_name, bucket_start)
      DO UPDATE SET status = excluded.status, bucket_end = excluded.bucket_end
    `).run(provider, target, check, bucketStart, bucketEnd, status);

    return oldStatus;
  }

  async getBuckets(startTime: number, endTime: number): Promise<BucketState[]> {
    const providerBuckets = this.db.prepare(`
      SELECT provider, bucket_start, bucket_end, status
      FROM provider_buckets
      WHERE bucket_start >= ? AND bucket_start < ?
    `).all(startTime, endTime) as { provider: string; bucket_start: number; bucket_end: number; status: string | null }[];

    const targetBuckets = this.db.prepare(`
      SELECT provider, target, bucket_start, bucket_end, status
      FROM target_buckets
      WHERE bucket_start >= ? AND bucket_start < ?
    `).all(startTime, endTime) as { provider: string; target: string; bucket_start: number; bucket_end: number; status: string | null }[];

    const checkBuckets = this.db.prepare(`
      SELECT provider, target, check_name as "check", bucket_start, bucket_end, status
      FROM check_buckets
      WHERE bucket_start >= ? AND bucket_start < ?
    `).all(startTime, endTime) as { provider: string; target: string; check: string; bucket_start: number; bucket_end: number; status: string | null }[];

    const results: BucketState[] = [];

    for (const b of providerBuckets) {
      results.push({
        provider: b.provider,
        bucketStart: b.bucket_start,
        bucketEnd: b.bucket_end,
        status: b.status as BucketStatus,
      });
    }

    for (const b of targetBuckets) {
      results.push({
        provider: b.provider,
        target: b.target,
        bucketStart: b.bucket_start,
        bucketEnd: b.bucket_end,
        status: b.status as BucketStatus,
      });
    }

    for (const b of checkBuckets) {
      results.push({
        provider: b.provider,
        target: b.target,
        check: b.check,
        bucketStart: b.bucket_start,
        bucketEnd: b.bucket_end,
        status: b.status as BucketStatus,
      });
    }

    return results;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export function createSqliteStores(path: string): {
  outcomeStore: SqliteOutcomeStore;
  eventStore: SqliteEventStore;
  bucketStore: SqliteBucketStore;
  close: () => void;
} {
  const db = new Database(path);
  db.exec(SCHEMA);
  return {
    outcomeStore: new SqliteOutcomeStore(db),
    eventStore: new SqliteEventStore(db),
    bucketStore: new SqliteBucketStore(db),
    close: () => db.close(),
  };
}
