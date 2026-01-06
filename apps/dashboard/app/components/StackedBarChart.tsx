import { useState } from "react";

type StackedSeriesPoint = {
  label: string;
  value: number;
};

type StackedBarChartProps = {
  title: string;
  series: Array<{ name: string; color: string; data: StackedSeriesPoint[] }>;
  height?: number;
  yLabel?: string;
};

const formatAxisValue = (value: number) => {
  if (value === 0) return "0";
  if (value < 1) return value.toFixed(2);
  if (value < 10) return value.toFixed(1);
  return value.toLocaleString("en-US");
};

export function StackedBarChart({ title, series, height = 180, yLabel }: StackedBarChartProps) {
  const width = 640;
  const padding = 36;
  const labels = series[0]?.data.map((point) => point.label) ?? [];
  const totals = labels.map((_, index) =>
    series.reduce((sum, current) => sum + (current.data[index]?.value ?? 0), 0)
  );
  const rawMaxValue = Math.max(...totals, 0);
  const maxValue = rawMaxValue === 0 ? 1 : rawMaxValue;
  const barWidth = (width - padding * 2) / Math.max(labels.length, 1);
  const tickLabels =
    labels.length > 0
      ? [labels[0], labels[Math.floor(labels.length / 2)], labels[labels.length - 1]]
      : [];
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: number;
    name: string;
  } | null>(null);

  return (
    <div className="chartCard">
      <div className="chartHeader">
        <h3>{title}</h3>
        <div className="chartLegend">
          {series.map((item) => (
            <div key={item.name} className="legendItem">
              <span className="legendDot" style={{ background: item.color }} />
              {item.name}
            </div>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chartSvg"
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="barGrid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(124,58,237,0.12)" />
            <stop offset="100%" stopColor="rgba(124,58,237,0.02)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="url(#barGrid)" rx="16" />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="rgba(124,58,237,0.2)"
          strokeWidth="1"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="rgba(124,58,237,0.2)"
          strokeWidth="1"
        />
        {labels.map((_, index) => {
          let stackHeight = 0;
          return series.map((item) => {
            const value = item.data[index]?.value ?? 0;
            const barHeight = (value / maxValue) * (height - padding * 2);
            const x = padding + index * barWidth + barWidth * 0.2;
            const y = height - padding - barHeight - stackHeight;
            stackHeight += barHeight;
            return (
              <rect
                key={`${item.name}-${index}`}
                x={x}
                y={y}
                width={barWidth * 0.6}
                height={barHeight}
                fill={item.color}
                rx={4}
                onMouseMove={(event) => {
                  const svg = event.currentTarget.ownerSVGElement;
                  if (!svg) return;
                  const bounds = svg.getBoundingClientRect();
                  setTooltip({
                    x: event.clientX - bounds.left,
                    y: event.clientY - bounds.top,
                    label: labels[index] ?? "",
                    value,
                    name: item.name,
                  });
                }}
              >
                <title>{`${item.name} · ${labels[index] ?? ""}: ${value.toLocaleString("en-US")}`}</title>
              </rect>
            );
          });
        })}
        <text x={padding - 8} y={padding + 6} textAnchor="end" className="chartAxisLabel">
          {formatAxisValue(rawMaxValue === 0 ? 0 : maxValue)}
        </text>
        <text
          x={padding - 8}
          y={(height - padding + padding) / 2}
          textAnchor="end"
          className="chartAxisLabel"
        >
          {formatAxisValue(rawMaxValue === 0 ? 0 : maxValue / 2)}
        </text>
        <text
          x={padding - 8}
          y={height - padding + 4}
          textAnchor="end"
          className="chartAxisLabel"
        >
          0
        </text>
        {tickLabels.length === 3 ? (
          <>
            <text x={padding} y={height - 8} textAnchor="start" className="chartAxisLabel">
              {tickLabels[0]}
            </text>
            <text x={width / 2} y={height - 6} textAnchor="middle" className="chartAxisLabel">
              {tickLabels[1]}
            </text>
            <text
              x={width - padding}
              y={height - 8}
              textAnchor="end"
              className="chartAxisLabel"
            >
              {tickLabels[2]}
            </text>
          </>
        ) : null}
        {yLabel ? (
          <text
            x={14}
            y={height / 2}
            textAnchor="middle"
            className="chartAxisTitle"
            transform={`rotate(-90 14 ${height / 2})`}
          >
            {yLabel}
          </text>
        ) : null}
      </svg>
      {tooltip ? (
        <div
          className="chartTooltip"
          style={{ left: tooltip.x + 12, top: Math.max(tooltip.y - 28, 12) }}
        >
          <strong>{tooltip.name}</strong>
          <span>{tooltip.label}</span>
          <span>{tooltip.value.toLocaleString("en-US")}</span>
        </div>
      ) : null}
    </div>
  );
}
