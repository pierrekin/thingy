import { renameSync } from "node:fs";
import { type Channel, type ChannelInstance, duration } from "mantle-framework";
import type {
  CheckEventEndedRecord,
  CheckEventRecord,
  ProviderEventEndedRecord,
  ProviderEventRecord,
  TargetEventEndedRecord,
  TargetEventRecord,
} from "mantle-store";
import { z } from "zod";

function iso(epoch: number): string {
  return new Date(epoch).toISOString();
}

function parseSize(s: string): number {
  const match = s.match(/^(?<value>\d+(?:\.\d+)?)\s*(?<unit>b|kb|mb|gb)$/i);
  const value = match?.groups?.value;
  const unit = match?.groups?.unit?.toLowerCase();
  if (
    !value ||
    (unit !== "b" && unit !== "kb" && unit !== "mb" && unit !== "gb")
  ) {
    throw new Error(`Invalid maxSize value: "${s}"`);
  }
  const multipliers = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
  } as const;
  return Math.floor(parseFloat(value) * multipliers[unit]);
}

type FileSink = ReturnType<ReturnType<typeof Bun.file>["writer"]>;

function rotate(path: string, writer: FileSink, suffix: string): FileSink {
  writer.end();
  renameSync(path, `${path}.${suffix}`);
  return Bun.file(path).writer();
}

type Notification = {
  type: string;
  time: string;
  started_at: string;
  ended_at?: string;
  provider: string;
  target?: string;
  check?: string;
  code: string;
  title: string;
  message: string;
};

function formatText(n: Notification): string {
  const parts: string[] = [
    `[${n.time}]`,
    n.type.replace(/_/g, " ").toUpperCase(),
  ];
  parts.push(`provider=${n.provider}`);
  if (n.target !== undefined) parts.push(`target=${n.target}`);
  if (n.check !== undefined) parts.push(`check=${n.check}`);
  parts.push(`code=${n.code}`);
  parts.push(`started_at="${n.started_at}"`);
  if (n.ended_at !== undefined) parts.push(`ended_at="${n.ended_at}"`);
  parts.push(`title="${n.title}"`);
  parts.push(`message="${n.message}"`);
  return parts.join(" ");
}

function formatJson(n: Notification): string {
  return JSON.stringify(n);
}

class LogChannelInstance implements ChannelInstance {
  private format: (n: Notification) => string;

  constructor(
    private writeLine: (line: string) => void,
    format: "text" | "json",
  ) {
    this.format = format === "json" ? formatJson : formatText;
  }

  onProviderEventStarted(event: ProviderEventRecord): void {
    this.writeLine(
      this.format({
        type: "provider_event_started",
        time: iso(event.startTime),
        started_at: iso(event.startTime),
        provider: event.provider,
        code: event.code,
        title: event.title,
        message: event.message,
      }),
    );
  }

  onProviderEventEnded(event: ProviderEventEndedRecord): void {
    this.writeLine(
      this.format({
        type: "provider_event_ended",
        time: iso(event.endTime),
        started_at: iso(event.startTime),
        ended_at: iso(event.endTime),
        provider: event.provider,
        code: event.code,
        title: event.title,
        message: event.message,
      }),
    );
  }

  onTargetEventStarted(event: TargetEventRecord): void {
    this.writeLine(
      this.format({
        type: "target_event_started",
        time: iso(event.startTime),
        started_at: iso(event.startTime),
        provider: event.provider,
        target: event.target,
        code: event.code,
        title: event.title,
        message: event.message,
      }),
    );
  }

  onTargetEventEnded(event: TargetEventEndedRecord): void {
    this.writeLine(
      this.format({
        type: "target_event_ended",
        time: iso(event.endTime),
        started_at: iso(event.startTime),
        ended_at: iso(event.endTime),
        provider: event.provider,
        target: event.target,
        code: event.code,
        title: event.title,
        message: event.message,
      }),
    );
  }

  onCheckEventStarted(event: CheckEventRecord): void {
    this.writeLine(
      this.format({
        type: "check_event_started",
        time: iso(event.startTime),
        started_at: iso(event.startTime),
        provider: event.provider,
        target: event.target,
        check: event.check,
        code: event.code,
        title: event.title,
        message: event.message,
      }),
    );
  }

  onCheckEventEnded(event: CheckEventEndedRecord): void {
    this.writeLine(
      this.format({
        type: "check_event_ended",
        time: iso(event.endTime),
        started_at: iso(event.startTime),
        ended_at: iso(event.endTime),
        provider: event.provider,
        target: event.target,
        check: event.check,
        code: event.code,
        title: event.title,
        message: event.message,
      }),
    );
  }

  async close(): Promise<void> {}
}

const logConfig = z.object({
  format: z.enum(["text", "json"]).default("text"),
});

const fileConfig = logConfig.extend({
  path: z.string(),
  maxSize: z.string().optional(),
  maxAge: duration.optional(),
});

const stdoutChannel: Channel = {
  name: "@mantle/log/stdout",
  configSchema: logConfig,
  createInstance: (config) => {
    const { format } = logConfig.parse(config ?? {});
    return new LogChannelInstance(
      (line) => process.stdout.write(`${line}\n`),
      format,
    );
  },
};

const stderrChannel: Channel = {
  name: "@mantle/log/stderr",
  configSchema: logConfig,
  createInstance: (config) => {
    const { format } = logConfig.parse(config ?? {});
    return new LogChannelInstance(
      (line) => process.stderr.write(`${line}\n`),
      format,
    );
  },
};

const fileChannel: Channel = {
  name: "@mantle/log/file",
  configSchema: fileConfig,
  createInstance: (config: unknown) => {
    const { path, format, maxSize, maxAge } = fileConfig.parse(config);
    const maxBytes = maxSize ? parseSize(maxSize) : null;
    const maxAgeMs = maxAge ?? null;

    let writer = Bun.file(path).writer();
    let bytesWritten = 0;
    let openedAt = Date.now();

    return new LogChannelInstance((line) => {
      const data = `${line}\n`;
      const now = Date.now();
      const suffix = new Date(now).toISOString().replace(/[:.]/g, "-");

      if (maxAgeMs !== null && now - openedAt >= maxAgeMs) {
        writer = rotate(path, writer, suffix);
        bytesWritten = 0;
        openedAt = now;
      }

      if (maxBytes !== null && bytesWritten + data.length > maxBytes) {
        writer = rotate(path, writer, suffix);
        bytesWritten = 0;
        openedAt = now;
      }

      writer.write(data);
      writer.flush();
      bytesWritten += data.length;
    }, format);
  },
};

export const channels: Channel[] = [stdoutChannel, stderrChannel, fileChannel];
