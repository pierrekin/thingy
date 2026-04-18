import type { Sink } from "mantle-framework";
import { sinks as jsonlSinks } from "sink-jsonl";

const allSinks = [...jsonlSinks];

const registry: Record<string, Sink> = Object.fromEntries(
  allSinks.map((s) => [s.name, s]),
);

export function getSink(name: string): Sink | undefined {
  return registry[name];
}

export function getAllSinks(): Sink[] {
  return allSinks;
}
