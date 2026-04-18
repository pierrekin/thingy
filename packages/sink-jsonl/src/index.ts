import type { Sink, SinkInstance, SinkRecord } from "mantle-framework";
import { z } from "zod";

class JsonlStdoutSink implements SinkInstance {
  async write(records: SinkRecord[]): Promise<void> {
    for (const record of records) {
      process.stdout.write(`${JSON.stringify(record)}\n`);
    }
  }

  async close(): Promise<void> {}
}

class JsonlFileSink implements SinkInstance {
  private writer: ReturnType<ReturnType<typeof Bun.file>["writer"]>;

  constructor(path: string) {
    this.writer = Bun.file(path).writer();
  }

  async write(records: SinkRecord[]): Promise<void> {
    for (const record of records) {
      this.writer.write(`${JSON.stringify(record)}\n`);
    }
    this.writer.flush();
  }

  async close(): Promise<void> {
    this.writer.end();
  }
}

const stdoutSink: Sink = {
  name: "@mantle/jsonl/stdout",
  configSchema: null,
  createInstance: () => new JsonlStdoutSink(),
};

const fileSinkConfig = z.object({
  path: z.string(),
});

const fileSink: Sink = {
  name: "@mantle/jsonl/file",
  configSchema: fileSinkConfig,
  createInstance: (config: unknown) => {
    const { path } = fileSinkConfig.parse(config);
    return new JsonlFileSink(path);
  },
};

export const sinks: Sink[] = [stdoutSink, fileSink];
