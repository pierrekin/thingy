import type { MantleClient } from "@mantle-team/client";
import { useMemo } from "react";
import { useMetricsData } from "../hooks/useMetricsData";
import { useMetricsSubscription } from "../hooks/useMetricsSubscription";
import type { Check } from "../types";
import type { ConnectionStatus } from "../ws-store";
import { EventTable } from "./EventTable";
import { SparkChart } from "./SparkChart";
import { StatusBar } from "./StatusBar";

type Props = {
  provider: string;
  target: string;
  check: Check;
  client: MantleClient | null;
  connectionStatus: ConnectionStatus;
};

/**
 * Round a timestamp down to the nearest bucket boundary
 */
function roundDown(timestamp: number, bucketDurationMs: number): number {
  return Math.floor(timestamp / bucketDurationMs) * bucketDurationMs;
}

export function CheckRow({
  provider,
  target,
  check,
  client,
  connectionStatus,
}: Props) {
  const hasEvents = check.events.length > 0;

  // Calculate metrics subscription params
  const now = useMemo(() => Date.now(), []);
  const lookbackMs = 60 * 60 * 1000; // 60 minutes lookback
  const bucketDurationMs = 1 * 60 * 1000; // 1 minute buckets for metrics
  const domainStart = roundDown(now - lookbackMs, bucketDurationMs);
  const domainEnd = now;

  const metricsParams = useMemo(
    () => ({
      provider,
      target,
      check: check.name,
      start: domainStart,
      end: null, // live mode
      bucketDurationMs,
    }),
    [provider, target, check.name, domainStart],
  );

  // Subscribe to metrics
  const subscriptionId = useMetricsSubscription(
    metricsParams,
    client,
    connectionStatus,
  );
  const metricsData = useMetricsData(
    subscriptionId ?? "",
    provider,
    target,
    check.name,
  );

  return (
    <div className="bg-surface">
      <div className="px-4 py-2">
        <span className="text-sm text-mist">{check.name}</span>
      </div>
      <div className="px-4">
        <SparkChart
          data={metricsData}
          domainStart={domainStart}
          domainEnd={domainEnd}
          ariaLabel={`${check.name} trend for ${provider}/${target}`}
        />
      </div>
      <StatusBar slots={check.statusSlots} />
      {hasEvents && (
        <div className="px-4 pb-2">
          <EventTable events={check.events} eventLevel="check" />
        </div>
      )}
    </div>
  );
}
