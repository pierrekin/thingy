import type { MetricsDataPoint } from "../hooks/useMetricsData";

type SparkChartProps = {
	data: MetricsDataPoint[];
	width?: number;
	height?: number;
	color?: string;
};

/**
 * SparkChart renders a small line chart for time-series metrics.
 * Displays a simple line connecting data points, with null values creating gaps.
 */
export function SparkChart({
	data,
	width = 200,
	height = 40,
	color = "#3b82f6",
}: SparkChartProps) {
	if (data.length === 0) {
		return (
			<svg width={width} height={height}>
				<text x={width / 2} y={height / 2} textAnchor="middle" fill="#999" fontSize="12">
					No data
				</text>
			</svg>
		);
	}

	// Filter out null values and compute min/max for scaling
	const validPoints = data.filter((d) => d.mean !== null);
	if (validPoints.length === 0) {
		return (
			<svg width={width} height={height}>
				<text x={width / 2} y={height / 2} textAnchor="middle" fill="#999" fontSize="12">
					No data
				</text>
			</svg>
		);
	}

	const values = validPoints.map((d) => d.mean as number);
	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);
	const range = maxValue - minValue || 1; // Avoid division by zero

	// Padding around the chart
	const padding = 4;
	const chartWidth = width - 2 * padding;
	const chartHeight = height - 2 * padding;

	// Map data points to coordinates
	const points = data.map((d, i) => {
		const x = padding + (i / (data.length - 1)) * chartWidth;
		if (d.mean === null) {
			return null;
		}
		const normalizedValue = (d.mean - minValue) / range;
		const y = padding + chartHeight - normalizedValue * chartHeight;
		return { x, y };
	});

	// Build path string, breaking on null values
	let pathData = "";
	let inPath = false;

	for (const point of points) {
		if (point === null) {
			inPath = false;
		} else {
			if (!inPath) {
				pathData += `M ${point.x} ${point.y} `;
				inPath = true;
			} else {
				pathData += `L ${point.x} ${point.y} `;
			}
		}
	}

	return (
		<svg width={width} height={height}>
			<path
				d={pathData}
				fill="none"
				stroke={color}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
