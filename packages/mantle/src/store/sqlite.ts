import { Database } from "bun:sqlite";
import type { ProviderOutcome, TargetOutcome, CheckOutcome, ChannelOutcome, AgentOutcome, BucketStatus } from "mantle-framework";
import type {
  OutcomeStore,
  EventStore,
  BucketStore,
  MetricsStore,
  ChannelOutcomeStore,
  ChannelEventStore,
  ChannelBucketStore,
  AgentOutcomeStore,
  AgentEventStore,
  AgentBucketStore,
  ChannelBucket,
  AgentBucket,
  ChannelEventRecord,
  AgentEventRecord,
  ProviderBucket,
  TargetBucket,
  CheckBucket,
  StoredBuckets,
  ProviderEventRecord,
  TargetEventRecord,
  CheckEventRecord,
  StoredEvents,
  OpenProviderEvent,
  OpenTargetEvent,
  OpenCheckEvent,
  OpenChannelEvent,
  OpenAgentEvent,
  MetricBucket,
  StoredOutcome,
  OutboxStore,
  OutboxEntry,
} from "mantle-store";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS provider_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  event_id INTEGER,
  time INTEGER NOT NULL,
  success INTEGER NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS target_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  event_id INTEGER,
  time INTEGER NOT NULL,
  success INTEGER NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS check_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  check_name TEXT NOT NULL,
  event_id INTEGER,
  time INTEGER NOT NULL,
  success INTEGER NOT NULL,
  value REAL,
  violation TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_provider_outcomes_time ON provider_outcomes(provider, time);
CREATE INDEX IF NOT EXISTS idx_provider_outcomes_success ON provider_outcomes(provider, success);
CREATE INDEX IF NOT EXISTS idx_provider_outcomes_event ON provider_outcomes(event_id);
CREATE INDEX IF NOT EXISTS idx_target_outcomes_time ON target_outcomes(provider, target, time);
CREATE INDEX IF NOT EXISTS idx_target_outcomes_success ON target_outcomes(provider, target, success);
CREATE INDEX IF NOT EXISTS idx_target_outcomes_event ON target_outcomes(event_id);
CREATE INDEX IF NOT EXISTS idx_check_outcomes_time ON check_outcomes(provider, target, check_name, time);
CREATE INDEX IF NOT EXISTS idx_check_outcomes_success ON check_outcomes(provider, target, check_name, success);
CREATE INDEX IF NOT EXISTS idx_check_outcomes_event ON check_outcomes(event_id);

CREATE TABLE IF NOT EXISTS provider_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS target_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  target TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
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
  title TEXT NOT NULL DEFAULT '',
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

CREATE TABLE IF NOT EXISTS channel_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  event_id INTEGER,
  time INTEGER NOT NULL,
  success INTEGER NOT NULL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_channel_outcomes_time ON channel_outcomes(channel, time);
CREATE INDEX IF NOT EXISTS idx_channel_outcomes_event ON channel_outcomes(event_id);

CREATE TABLE IF NOT EXISTS channel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channel_events_open ON channel_events(channel, code) WHERE end_time IS NULL;

CREATE TABLE IF NOT EXISTS channel_buckets (
  channel TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  bucket_end INTEGER NOT NULL,
  status TEXT,
  PRIMARY KEY (channel, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_channel_buckets_time ON channel_buckets(bucket_start, bucket_end);

CREATE TABLE IF NOT EXISTS agent_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,
  event_id INTEGER,
  time INTEGER NOT NULL,
  success INTEGER NOT NULL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_outcomes_time ON agent_outcomes(agent, time);
CREATE INDEX IF NOT EXISTS idx_agent_outcomes_event ON agent_outcomes(event_id);

CREATE TABLE IF NOT EXISTS agent_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_events_open ON agent_events(agent, code) WHERE end_time IS NULL;

CREATE TABLE IF NOT EXISTS agent_buckets (
  agent TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  bucket_end INTEGER NOT NULL,
  status TEXT,
  PRIMARY KEY (agent, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_agent_buckets_time ON agent_buckets(bucket_start, bucket_end);

CREATE TABLE IF NOT EXISTS channel_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sink_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_cursors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outbox TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  cursor INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_cursors_lookup ON outbox_cursors(outbox, worker_id, id);
`;

export class SqliteOutcomeStore implements OutcomeStore {
  constructor(private db: Database) {}

  async recordProviderOutcome(
    provider: string,
    time: Date,
    outcome: ProviderOutcome,
    eventId?: number,
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO provider_outcomes (provider, event_id, time, success, error)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      provider,
      eventId ?? null,
      time.getTime(),
      outcome.success ? 1 : 0,
      outcome.success ? null : JSON.stringify(outcome.error)
    );
  }

  async recordTargetOutcome(
    provider: string,
    target: string,
    time: Date,
    outcome: TargetOutcome,
    eventId?: number,
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO target_outcomes (provider, target, event_id, time, success, error)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      provider,
      target,
      eventId ?? null,
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
    outcome: CheckOutcome,
    eventId?: number,
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO check_outcomes (provider, target, check_name, event_id, time, success, value, violation, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      provider,
      target,
      check,
      eventId ?? null,
      time.getTime(),
      outcome.success ? 1 : 0,
      outcome.success ? outcome.value : null,
      outcome.success && outcome.violation ? JSON.stringify(outcome.violation) : null,
      outcome.success ? null : JSON.stringify(outcome.error)
    );
  }

  async getOutcomesForEvent(
    eventId: number,
    level: "provider" | "target" | "check",
    limit: number = 100,
    offset: number = 0,
  ): Promise<StoredOutcome[]> {
    const table = level === "provider" ? "provider_outcomes" : level === "target" ? "target_outcomes" : "check_outcomes";
    const columns = level === "check"
      ? "id, time, success, error, value, violation"
      : "id, time, success, error";

    const rows = this.db.prepare(`
      SELECT ${columns}
      FROM ${table}
      WHERE event_id = ?
      ORDER BY time ASC
      LIMIT ? OFFSET ?
    `).all(eventId, limit, offset) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: r.id as number,
      time: r.time as number,
      success: (r.success as number) === 1,
      error: (r.error as string | null) ?? null,
      value: (r.value as number | null) ?? null,
      violation: (r.violation as string | null) ?? null,
    }));
  }

  async getLatestProviderStatuses(): Promise<Array<{
    provider: string;
    status: BucketStatus;
  }>> {
    const rows = this.db.prepare(`
      SELECT provider, success
      FROM provider_outcomes
      WHERE id IN (
        SELECT MAX(id) FROM provider_outcomes GROUP BY provider
      )
    `).all() as Array<{ provider: string; success: number }>;

    return rows.map((r) => ({
      provider: r.provider,
      status: r.success === 1 ? "green" as const : "red" as const,
    }));
  }

  async getLatestProviderStatus(provider: string): Promise<BucketStatus> {
    const row = this.db.prepare(`
      SELECT success
      FROM provider_outcomes
      WHERE provider = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(provider) as { success: number } | undefined;

    if (!row) return null;
    return row.success === 1 ? "green" : "red";
  }

  async getLatestTargetStatuses(): Promise<Array<{
    provider: string;
    target: string;
    status: BucketStatus;
  }>> {
    const rows = this.db.prepare(`
      SELECT provider, target,
        MIN(CASE
          WHEN success = 0 THEN 0
          WHEN violation IS NOT NULL THEN 0
          ELSE 1
        END) as all_green
      FROM check_outcomes
      WHERE id IN (
        SELECT MAX(id) FROM check_outcomes GROUP BY provider, target, check_name
      )
      GROUP BY provider, target
    `).all() as Array<{ provider: string; target: string; all_green: number }>;

    return rows.map((r) => ({
      provider: r.provider,
      target: r.target,
      status: r.all_green === 1 ? "green" as const : "red" as const,
    }));
  }

  async getLatestTargetStatus(provider: string, target: string): Promise<BucketStatus> {
    const row = this.db.prepare(`
      SELECT MIN(CASE
        WHEN success = 0 THEN 0
        WHEN violation IS NOT NULL THEN 0
        ELSE 1
      END) as all_green
      FROM check_outcomes
      WHERE id IN (
        SELECT MAX(id) FROM check_outcomes
        WHERE provider = ? AND target = ?
        GROUP BY check_name
      )
    `).get(provider, target) as { all_green: number } | undefined;

    if (!row || row.all_green === null) return null;
    return row.all_green === 1 ? "green" : "red";
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteEventStore implements EventStore {
  constructor(private db: Database) {}

  async getOpenProviderEvents(): Promise<OpenProviderEvent[]> {
    const stmt = this.db.prepare(`
      SELECT id, provider, code, title, start_time as startTime, message FROM provider_events WHERE end_time IS NULL
    `);
    return stmt.all() as OpenProviderEvent[];
  }

  async getOpenTargetEvents(): Promise<OpenTargetEvent[]> {
    const stmt = this.db.prepare(`
      SELECT id, provider, target, code, title, start_time as startTime, message FROM target_events WHERE end_time IS NULL
    `);
    return stmt.all() as OpenTargetEvent[];
  }

  async getOpenCheckEvents(): Promise<OpenCheckEvent[]> {
    const stmt = this.db.prepare(`
      SELECT id, provider, target, check_name as "check", code, title, start_time as startTime, message FROM check_events WHERE end_time IS NULL
    `);
    return stmt.all() as OpenCheckEvent[];
  }

  async openProviderEvent(
    provider: string,
    code: string,
    title: string,
    time: Date,
    message: string
  ): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO provider_events (provider, code, title, start_time, message)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(provider, code, title, time.getTime(), message);
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
    title: string,
    time: Date,
    message: string
  ): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO target_events (provider, target, code, title, start_time, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(provider, target, code, title, time.getTime(), message);
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
    title: string,
    kind: "error" | "violation",
    time: Date,
    message: string
  ): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO check_events (provider, target, check_name, code, title, start_time, kind, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(provider, target, check, code, title, time.getTime(), kind, message);
    return Number(result.lastInsertRowid);
  }

  async closeCheckEvent(id: number, time: Date): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE check_events SET end_time = ? WHERE id = ?
    `);
    stmt.run(time.getTime(), id);
  }

  async getEventsInRange(startTime: number, endTime: number): Promise<StoredEvents> {
    // Events that overlap with the time window:
    // startTime < rangeEnd AND (endTime > rangeStart OR endTime IS NULL)
    const providerRows = this.db.prepare(`
      SELECT id, provider, code, title, start_time, end_time, message
      FROM provider_events
      WHERE start_time < ? AND (end_time > ? OR end_time IS NULL)
    `).all(endTime, startTime) as {
      id: number;
      provider: string;
      code: string;
      title: string;
      start_time: number;
      end_time: number | null;
      message: string;
    }[];

    const targetRows = this.db.prepare(`
      SELECT id, provider, target, code, title, start_time, end_time, message
      FROM target_events
      WHERE start_time < ? AND (end_time > ? OR end_time IS NULL)
    `).all(endTime, startTime) as {
      id: number;
      provider: string;
      target: string;
      code: string;
      title: string;
      start_time: number;
      end_time: number | null;
      message: string;
    }[];

    const checkRows = this.db.prepare(`
      SELECT id, provider, target, check_name as "check", code, title, start_time, end_time, message
      FROM check_events
      WHERE start_time < ? AND (end_time > ? OR end_time IS NULL)
    `).all(endTime, startTime) as {
      id: number;
      provider: string;
      target: string;
      check: string;
      code: string;
      title: string;
      start_time: number;
      end_time: number | null;
      message: string;
    }[];

    const providers: ProviderEventRecord[] = providerRows.map((e) => ({
      id: e.id,
      provider: e.provider,
      code: e.code,
      title: e.title,
      startTime: e.start_time,
      endTime: e.end_time,
      message: e.message,
    }));

    const targets: TargetEventRecord[] = targetRows.map((e) => ({
      id: e.id,
      provider: e.provider,
      target: e.target,
      code: e.code,
      title: e.title,
      startTime: e.start_time,
      endTime: e.end_time,
      message: e.message,
    }));

    const checks: CheckEventRecord[] = checkRows.map((e) => ({
      id: e.id,
      provider: e.provider,
      target: e.target,
      check: e.check,
      code: e.code,
      title: e.title,
      startTime: e.start_time,
      endTime: e.end_time,
      message: e.message,
    }));

    return { providers, targets, checks };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteBucketStore implements BucketStore {
  constructor(private db: Database) {}

  async getProviderBucketStatus(
    provider: string,
    bucketStart: number,
  ): Promise<BucketStatus | undefined> {
    const row = this.db.prepare(`
      SELECT status FROM provider_buckets WHERE provider = ? AND bucket_start = ?
    `).get(provider, bucketStart) as { status: string | null } | undefined;
    return row?.status as BucketStatus | undefined;
  }

  async getTargetBucketStatus(
    provider: string,
    target: string,
    bucketStart: number,
  ): Promise<BucketStatus | undefined> {
    const row = this.db.prepare(`
      SELECT status FROM target_buckets WHERE provider = ? AND target = ? AND bucket_start = ?
    `).get(provider, target, bucketStart) as { status: string | null } | undefined;
    return row?.status as BucketStatus | undefined;
  }

  async getCheckBucketStatus(
    provider: string,
    target: string,
    check: string,
    bucketStart: number,
  ): Promise<BucketStatus | undefined> {
    const row = this.db.prepare(`
      SELECT status FROM check_buckets WHERE provider = ? AND target = ? AND check_name = ? AND bucket_start = ?
    `).get(provider, target, check, bucketStart) as { status: string | null } | undefined;
    return row?.status as BucketStatus | undefined;
  }

  async setProviderBucket(
    provider: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus
  ): Promise<void> {
    this.db.prepare(`
      INSERT INTO provider_buckets (provider, bucket_start, bucket_end, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (provider, bucket_start)
      DO UPDATE SET status = excluded.status, bucket_end = excluded.bucket_end
    `).run(provider, bucketStart, bucketEnd, status);
  }

  async setTargetBucket(
    provider: string,
    target: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus
  ): Promise<void> {
    this.db.prepare(`
      INSERT INTO target_buckets (provider, target, bucket_start, bucket_end, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (provider, target, bucket_start)
      DO UPDATE SET status = excluded.status, bucket_end = excluded.bucket_end
    `).run(provider, target, bucketStart, bucketEnd, status);
  }

  async setCheckBucket(
    provider: string,
    target: string,
    check: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus
  ): Promise<void> {
    this.db.prepare(`
      INSERT INTO check_buckets (provider, target, check_name, bucket_start, bucket_end, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (provider, target, check_name, bucket_start)
      DO UPDATE SET status = excluded.status, bucket_end = excluded.bucket_end
    `).run(provider, target, check, bucketStart, bucketEnd, status);
  }

  async getBuckets(startTime: number, endTime: number): Promise<StoredBuckets> {
    const providerRows = this.db.prepare(`
      SELECT provider, bucket_start, bucket_end, status
      FROM provider_buckets
      WHERE bucket_start >= ? AND bucket_start < ?
    `).all(startTime, endTime) as { provider: string; bucket_start: number; bucket_end: number; status: string | null }[];

    const targetRows = this.db.prepare(`
      SELECT provider, target, bucket_start, bucket_end, status
      FROM target_buckets
      WHERE bucket_start >= ? AND bucket_start < ?
    `).all(startTime, endTime) as { provider: string; target: string; bucket_start: number; bucket_end: number; status: string | null }[];

    const checkRows = this.db.prepare(`
      SELECT provider, target, check_name as "check", bucket_start, bucket_end, status
      FROM check_buckets
      WHERE bucket_start >= ? AND bucket_start < ?
    `).all(startTime, endTime) as { provider: string; target: string; check: string; bucket_start: number; bucket_end: number; status: string | null }[];

    const providers: ProviderBucket[] = providerRows.map((b) => ({
      provider: b.provider,
      bucketStart: b.bucket_start,
      bucketEnd: b.bucket_end,
      status: b.status as BucketStatus,
    }));

    const targets: TargetBucket[] = targetRows.map((b) => ({
      provider: b.provider,
      target: b.target,
      bucketStart: b.bucket_start,
      bucketEnd: b.bucket_end,
      status: b.status as BucketStatus,
    }));

    const checks: CheckBucket[] = checkRows.map((b) => ({
      provider: b.provider,
      target: b.target,
      check: b.check,
      bucketStart: b.bucket_start,
      bucketEnd: b.bucket_end,
      status: b.status as BucketStatus,
    }));

    return { providers, targets, checks };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteMetricsStore implements MetricsStore {
  constructor(private db: Database) {}

  async getAggregatedMetrics(
    provider: string,
    target: string,
    check: string,
    startTime: number,
    endTime: number,
    bucketDurationMs: number
  ): Promise<MetricBucket[]> {
    const stmt = this.db.prepare(`
      SELECT
        (time / ?) * ? as bucketStart,
        ((time / ?) * ? + ?) as bucketEnd,
        AVG(value) as mean
      FROM check_outcomes
      WHERE provider = ? AND target = ? AND check_name = ?
        AND time >= ? AND time < ?
        AND success = 1
        AND value IS NOT NULL
      GROUP BY bucketStart
      ORDER BY bucketStart ASC
    `);

    const rows = stmt.all(
      bucketDurationMs,
      bucketDurationMs,
      bucketDurationMs,
      bucketDurationMs,
      bucketDurationMs,
      provider,
      target,
      check,
      startTime,
      endTime
    ) as Array<{ bucketStart: number; bucketEnd: number; mean: number | null }>;

    return rows;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteChannelOutcomeStore implements ChannelOutcomeStore {
  constructor(private db: Database) {}

  async recordChannelOutcome(
    channel: string,
    time: Date,
    outcome: ChannelOutcome,
    eventId?: number,
  ): Promise<void> {
    this.db.prepare(`
      INSERT INTO channel_outcomes (channel, event_id, time, success, error)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      channel,
      eventId ?? null,
      time.getTime(),
      outcome.success ? 1 : 0,
      outcome.success ? null : outcome.error,
    );
  }

  async getLatestChannelStatuses(): Promise<Array<{
    channel: string;
    status: BucketStatus;
  }>> {
    const rows = this.db.prepare(`
      SELECT channel, success
      FROM channel_outcomes
      WHERE id IN (
        SELECT MAX(id) FROM channel_outcomes GROUP BY channel
      )
    `).all() as Array<{ channel: string; success: number }>;

    return rows.map((r) => ({
      channel: r.channel,
      status: r.success === 1 ? "green" as const : "red" as const,
    }));
  }

  async getLatestChannelStatus(channel: string): Promise<BucketStatus> {
    const row = this.db.prepare(`
      SELECT success
      FROM channel_outcomes
      WHERE channel = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(channel) as { success: number } | undefined;

    if (!row) return null;
    return row.success === 1 ? "green" : "red";
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteChannelEventStore implements ChannelEventStore {
  constructor(private db: Database) {}

  async getOpenChannelEvents(): Promise<OpenChannelEvent[]> {
    return this.db.prepare(`
      SELECT id, channel, code, title, start_time as startTime, message
      FROM channel_events WHERE end_time IS NULL
    `).all() as OpenChannelEvent[];
  }

  async openChannelEvent(
    channel: string,
    code: string,
    title: string,
    time: Date,
    message: string,
  ): Promise<number> {
    const result = this.db.prepare(`
      INSERT INTO channel_events (channel, code, title, start_time, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(channel, code, title, time.getTime(), message);
    return Number(result.lastInsertRowid);
  }

  async closeChannelEvent(id: number, time: Date): Promise<void> {
    this.db.prepare(`
      UPDATE channel_events SET end_time = ? WHERE id = ?
    `).run(time.getTime(), id);
  }

  async getChannelEventsInRange(startTime: number, endTime: number): Promise<ChannelEventRecord[]> {
    const rows = this.db.prepare(`
      SELECT id, channel, code, title, start_time, end_time, message
      FROM channel_events
      WHERE start_time < ? AND (end_time > ? OR end_time IS NULL)
    `).all(endTime, startTime) as {
      id: number;
      channel: string;
      code: string;
      title: string;
      start_time: number;
      end_time: number | null;
      message: string;
    }[];

    return rows.map((e) => ({
      id: e.id,
      channel: e.channel,
      code: e.code,
      title: e.title,
      startTime: e.start_time,
      endTime: e.end_time,
      message: e.message,
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteChannelBucketStore implements ChannelBucketStore {
  constructor(private db: Database) {}

  async getChannelBucketStatus(
    channel: string,
    bucketStart: number,
  ): Promise<BucketStatus | undefined> {
    const row = this.db.prepare(`
      SELECT status FROM channel_buckets WHERE channel = ? AND bucket_start = ?
    `).get(channel, bucketStart) as { status: string | null } | undefined;
    return row?.status as BucketStatus | undefined;
  }

  async setChannelBucket(
    channel: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus,
  ): Promise<void> {
    this.db.prepare(`
      INSERT INTO channel_buckets (channel, bucket_start, bucket_end, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (channel, bucket_start)
      DO UPDATE SET status = excluded.status, bucket_end = excluded.bucket_end
    `).run(channel, bucketStart, bucketEnd, status);
  }

  async getChannelBuckets(startTime: number, endTime: number): Promise<ChannelBucket[]> {
    const rows = this.db.prepare(`
      SELECT channel, bucket_start, bucket_end, status
      FROM channel_buckets
      WHERE bucket_start >= ? AND bucket_start < ?
    `).all(startTime, endTime) as { channel: string; bucket_start: number; bucket_end: number; status: string | null }[];

    return rows.map((b) => ({
      channel: b.channel,
      bucketStart: b.bucket_start,
      bucketEnd: b.bucket_end,
      status: b.status as BucketStatus,
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteAgentOutcomeStore implements AgentOutcomeStore {
  constructor(private db: Database) {}

  async recordAgentOutcome(
    agent: string,
    time: Date,
    outcome: AgentOutcome,
    eventId?: number,
  ): Promise<void> {
    this.db.prepare(`
      INSERT INTO agent_outcomes (agent, event_id, time, success, error)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      agent,
      eventId ?? null,
      time.getTime(),
      outcome.success ? 1 : 0,
      outcome.success ? null : outcome.error,
    );
  }

  async getLatestAgentStatuses(): Promise<Array<{
    agent: string;
    status: BucketStatus;
  }>> {
    const rows = this.db.prepare(`
      SELECT agent, success
      FROM agent_outcomes
      WHERE id IN (
        SELECT MAX(id) FROM agent_outcomes GROUP BY agent
      )
    `).all() as Array<{ agent: string; success: number }>;

    return rows.map((r) => ({
      agent: r.agent,
      status: r.success === 1 ? "green" as const : "red" as const,
    }));
  }

  async getLatestAgentStatus(agent: string): Promise<BucketStatus> {
    const row = this.db.prepare(`
      SELECT success
      FROM agent_outcomes
      WHERE agent = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(agent) as { success: number } | undefined;

    if (!row) return null;
    return row.success === 1 ? "green" : "red";
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteAgentEventStore implements AgentEventStore {
  constructor(private db: Database) {}

  async getOpenAgentEvents(): Promise<OpenAgentEvent[]> {
    return this.db.prepare(`
      SELECT id, agent, code, title, start_time as startTime, message
      FROM agent_events WHERE end_time IS NULL
    `).all() as OpenAgentEvent[];
  }

  async openAgentEvent(
    agent: string,
    code: string,
    title: string,
    time: Date,
    message: string,
  ): Promise<number> {
    const result = this.db.prepare(`
      INSERT INTO agent_events (agent, code, title, start_time, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(agent, code, title, time.getTime(), message);
    return Number(result.lastInsertRowid);
  }

  async closeAgentEvent(id: number, time: Date): Promise<void> {
    this.db.prepare(`
      UPDATE agent_events SET end_time = ? WHERE id = ?
    `).run(time.getTime(), id);
  }

  async getAgentEventsInRange(startTime: number, endTime: number): Promise<AgentEventRecord[]> {
    const rows = this.db.prepare(`
      SELECT id, agent, code, title, start_time, end_time, message
      FROM agent_events
      WHERE start_time < ? AND (end_time > ? OR end_time IS NULL)
    `).all(endTime, startTime) as {
      id: number;
      agent: string;
      code: string;
      title: string;
      start_time: number;
      end_time: number | null;
      message: string;
    }[];

    return rows.map((e) => ({
      id: e.id,
      agent: e.agent,
      code: e.code,
      title: e.title,
      startTime: e.start_time,
      endTime: e.end_time,
      message: e.message,
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteAgentBucketStore implements AgentBucketStore {
  constructor(private db: Database) {}

  async getAgentBucketStatus(
    agent: string,
    bucketStart: number,
  ): Promise<BucketStatus | undefined> {
    const row = this.db.prepare(`
      SELECT status FROM agent_buckets WHERE agent = ? AND bucket_start = ?
    `).get(agent, bucketStart) as { status: string | null } | undefined;
    return row?.status as BucketStatus | undefined;
  }

  async setAgentBucket(
    agent: string,
    bucketStart: number,
    bucketEnd: number,
    status: BucketStatus,
  ): Promise<void> {
    this.db.prepare(`
      INSERT INTO agent_buckets (agent, bucket_start, bucket_end, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (agent, bucket_start)
      DO UPDATE SET status = excluded.status, bucket_end = excluded.bucket_end
    `).run(agent, bucketStart, bucketEnd, status);
  }

  async getAgentBuckets(startTime: number, endTime: number): Promise<AgentBucket[]> {
    const rows = this.db.prepare(`
      SELECT agent, bucket_start, bucket_end, status
      FROM agent_buckets
      WHERE bucket_start >= ? AND bucket_start < ?
    `).all(startTime, endTime) as { agent: string; bucket_start: number; bucket_end: number; status: string | null }[];

    return rows.map((b) => ({
      agent: b.agent,
      bucketStart: b.bucket_start,
      bucketEnd: b.bucket_end,
      status: b.status as BucketStatus,
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteChannelOutboxStore implements OutboxStore {
  constructor(private db: Database) {}

  async append(payload: string): Promise<number> {
    const result = this.db.prepare(
      `INSERT INTO channel_outbox (payload, created_at) VALUES (?, ?)`
    ).run(payload, Date.now());
    return Number(result.lastInsertRowid);
  }

  async read(fromId: number | null, limit: number): Promise<OutboxEntry[]> {
    const rows = this.db.prepare(`
      SELECT id, payload, created_at FROM channel_outbox
      WHERE id > ? ORDER BY id ASC LIMIT ?
    `).all(fromId ?? 0, limit) as { id: number; payload: string; created_at: number }[];
    return rows.map((r) => ({ id: r.id, payload: r.payload, createdAt: r.created_at }));
  }

  async getCursor(workerId: string): Promise<number | null> {
    const row = this.db.prepare(`
      SELECT cursor FROM outbox_cursors
      WHERE outbox = 'channel' AND worker_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(workerId) as { cursor: number } | undefined;
    return row?.cursor ?? null;
  }

  async advanceCursor(workerId: string, cursor: number): Promise<void> {
    this.db.prepare(
      `INSERT INTO outbox_cursors (outbox, worker_id, cursor, created_at) VALUES ('channel', ?, ?, ?)`
    ).run(workerId, cursor, Date.now());
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class SqliteSinkOutboxStore implements OutboxStore {
  constructor(private db: Database) {}

  async append(payload: string): Promise<number> {
    const result = this.db.prepare(
      `INSERT INTO sink_outbox (payload, created_at) VALUES (?, ?)`
    ).run(payload, Date.now());
    return Number(result.lastInsertRowid);
  }

  async read(fromId: number | null, limit: number): Promise<OutboxEntry[]> {
    const rows = this.db.prepare(`
      SELECT id, payload, created_at FROM sink_outbox
      WHERE id > ? ORDER BY id ASC LIMIT ?
    `).all(fromId ?? 0, limit) as { id: number; payload: string; created_at: number }[];
    return rows.map((r) => ({ id: r.id, payload: r.payload, createdAt: r.created_at }));
  }

  async getCursor(workerId: string): Promise<number | null> {
    const row = this.db.prepare(`
      SELECT cursor FROM outbox_cursors
      WHERE outbox = 'sink' AND worker_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(workerId) as { cursor: number } | undefined;
    return row?.cursor ?? null;
  }

  async advanceCursor(workerId: string, cursor: number): Promise<void> {
    this.db.prepare(
      `INSERT INTO outbox_cursors (outbox, worker_id, cursor, created_at) VALUES ('sink', ?, ?, ?)`
    ).run(workerId, cursor, Date.now());
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export function createSqliteStores(path: string): {
  outcomeStore: SqliteOutcomeStore;
  eventStore: SqliteEventStore;
  bucketStore: SqliteBucketStore;
  metricsStore: SqliteMetricsStore;
  channelOutcomeStore: SqliteChannelOutcomeStore;
  channelEventStore: SqliteChannelEventStore;
  channelBucketStore: SqliteChannelBucketStore;
  agentOutcomeStore: SqliteAgentOutcomeStore;
  agentEventStore: SqliteAgentEventStore;
  agentBucketStore: SqliteAgentBucketStore;
  channelOutboxStore: SqliteChannelOutboxStore;
  sinkOutboxStore: SqliteSinkOutboxStore;
  close: () => void;
} {
  const db = new Database(path);
  db.exec(SCHEMA);
  return {
    outcomeStore: new SqliteOutcomeStore(db),
    eventStore: new SqliteEventStore(db),
    bucketStore: new SqliteBucketStore(db),
    metricsStore: new SqliteMetricsStore(db),
    channelOutcomeStore: new SqliteChannelOutcomeStore(db),
    channelEventStore: new SqliteChannelEventStore(db),
    channelBucketStore: new SqliteChannelBucketStore(db),
    agentOutcomeStore: new SqliteAgentOutcomeStore(db),
    agentEventStore: new SqliteAgentEventStore(db),
    agentBucketStore: new SqliteAgentBucketStore(db),
    channelOutboxStore: new SqliteChannelOutboxStore(db),
    sinkOutboxStore: new SqliteSinkOutboxStore(db),
    close: () => db.close(),
  };
}
