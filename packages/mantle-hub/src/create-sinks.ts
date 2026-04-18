import type { SinkInstance } from "mantle-framework";
import { OperationalError } from "mantle-framework";
import { getSink } from "./sinks.ts";

export type RegisteredSink = {
  name: string;
  instance: SinkInstance;
};

function getSinkType(instanceName: string, config: unknown): string {
  if (
    config &&
    typeof config === "object" &&
    "type" in config &&
    typeof (config as Record<string, unknown>).type === "string"
  ) {
    return (config as Record<string, unknown>).type as string;
  }
  return instanceName;
}

export function createSinkInstances(
  sinkConfigs: Record<string, unknown>,
): RegisteredSink[] {
  const sinks: RegisteredSink[] = [];

  for (const [name, config] of Object.entries(sinkConfigs)) {
    const sinkType = getSinkType(name, config);
    const sink = getSink(sinkType);
    if (!sink) {
      throw new OperationalError(`Unknown sink type: '${sinkType}'`);
    }
    sinks.push({ name, instance: sink.createInstance(config) });
    console.log(`Sink '${name}' (${sinkType}) initialized`);
  }

  return sinks;
}
