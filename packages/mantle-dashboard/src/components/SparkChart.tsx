import { useEffect, useRef, useState } from "react";
import type { MetricsDataPoint } from "../hooks/useMetricsData";

type SparkChartProps = {
  data: MetricsDataPoint[];
  domainStart: number;
  domainEnd: number;
  ariaLabel: string;
  height?: number;
  color?: string;
};

/**
 * SparkChart renders a small line chart for time-series metrics.
 * Uses a time-based x axis aligned to the given domain.
 */
export function SparkChart({
  data,
  domainStart,
  domainEnd,
  height = 30,
  color = "var(--color-signal)",
  ariaLabel,
}: SparkChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const domainRange = domainEnd - domainStart;

  // Filter out null values and compute min/max for scaling
  const validPoints = data.filter((d) => d.mean !== null);
  const values = validPoints.map((d) => d.mean as number);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 1;
  const range = maxValue - minValue || 1;

  const padding = 4;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  let pathData = "";
  if (width > 0 && domainRange > 0 && validPoints.length > 0) {
    let inPath = false;
    for (const d of data) {
      const t = (d.bucketStart + d.bucketEnd) / 2;
      const x = padding + ((t - domainStart) / domainRange) * chartWidth;
      if (d.mean === null) {
        inPath = false;
      } else {
        const y =
          padding + chartHeight - ((d.mean - minValue) / range) * chartHeight;
        pathData += inPath ? `L ${x} ${y} ` : `M ${x} ${y} `;
        inPath = true;
      }
    }
  }

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block"
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>
          {pathData ? (
            <path
              d={pathData}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              fill="var(--color-warm-grey)"
              fontSize="12"
            >
              No data
            </text>
          )}
        </svg>
      )}
    </div>
  );
}
