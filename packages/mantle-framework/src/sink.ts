import type { z } from "zod";

export type SinkRecord = {
  time: number;
  provider: string;
  target: string;
  check: string;
  success: boolean;
  value: number | null;
  error: string | null;
  violation: string | null;
};

export interface SinkInstance {
  write(records: SinkRecord[]): Promise<void>;
  close(): Promise<void>;
}

export interface Sink {
  name: string;
  configSchema: z.ZodType | null;
  createInstance(config: unknown): SinkInstance;
}
