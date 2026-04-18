import type { SlotStatus } from "../types";

const statusDotColors: Record<string, string> = {
  green: "bg-signal",
  red: "bg-critical",
  grey: "bg-warm-grey",
  null: "bg-surface",
};

export function StatusDot({ status }: { status: SlotStatus }) {
  return (
    <div
      className={`w-2.5 h-2.5 rounded-full ${statusDotColors[status ?? "null"]}`}
    />
  );
}
