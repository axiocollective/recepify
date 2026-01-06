import { useState } from "react";

type LineChartPoint = {
  label: string;
  value: number;
};

type LineChartProps = {
  title: string;
  series: Array<{ name: string; color: string; data: LineChartPoint[] }>;
  height?: number;
  xLabel?: string;
  yLabel?: string;
};

const formatAxisValue = (value: number) => {
  if (value === 0) return "0";
  if (value < 1) return value.toFixed(2);
  if (value < 10) return value.toFixed(1);
  return value.toLocaleString("en-US");
};

const buildPoints = (data: LineChartPoint[], width: number, height: number, maxValue: number) => {
  return data
    .map((point, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width;
      const y = height - (point.value / maxValue) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};

export function LineChart({ title, series, height = 160, xLabel, yLabel }: LineChartProps) {
  const width = 640;
  const padding = 36;
  const hasData = series.some((item) => item.data.length > 0);
  const rawMaxValue = Math.max(
    ...series.flatMap((item) => item.data.map((point) => point.value)),
    0
  );
  const maxValue = rawMaxValue === 0 ? 1 : rawMaxValue;
  const xSeries = series[0]?.data ?? [];
  const xLabels =
    xSeries.length > 0
      ? [
          xSeries[0]?.label ?? "",
          xSeries[Math.floor(xSeries.length / 2)]?.label ?? "",
          xSeries[xSeries.length - 1]?.label ?? "",
        ]
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
      {hasData ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="chartSvg"
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id="grid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(124,58,237,0.16)" />
              <stop offset="100%" stopColor="rgba(124,58,237,0.02)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={width} height={height} fill="url(#grid)" rx="16" />
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
          {series.map((item) => (
            <g key={item.name}>
              <polyline
                points={buildPoints(item.data, width - padding * 2, height - padding * 2, maxValue)}
                transform={`translate(${padding}, ${padding})`}
                fill="none"
                stroke={item.color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {item.data.map((point, index) => {
                const x = padding + (index / Math.max(item.data.length - 1, 1)) * (width - padding * 2);
                const y = padding + (height - padding * 2) - (point.value / maxValue) * (height - padding * 2);
                return (
                  <circle
                    key={`${item.name}-${point.label}`}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill={item.color}
                    onMouseMove={(event) => {
                      const svg = event.currentTarget.ownerSVGElement;
                      if (!svg) return;
                      const bounds = svg.getBoundingClientRect();
                      setTooltip({
                        x: event.clientX - bounds.left,
                        y: event.clientY - bounds.top,
                        label: point.label,
                        value: point.value,
                        name: item.name,
                      });
                    }}
                  >
                    <title>{`${item.name} · ${point.label}: ${point.value.toLocaleString("en-US")}`}</title>
                  </circle>
                );
              })}
            </g>
          ))}
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
          {xLabels.length === 3 ? (
            <>
              <text x={padding} y={height - 8} textAnchor="start" className="chartAxisLabel">
                {xLabels[0]}
              </text>
              <text
                x={width / 2}
                y={height - 8}
                textAnchor="middle"
                className="chartAxisLabel"
              >
                {xLabels[1]}
              </text>
              <text
                x={width - padding}
                y={height - 8}
                textAnchor="end"
                className="chartAxisLabel"
              >
                {xLabels[2]}
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
          {xLabel ? (
            <text x={width / 2} y={height - 2} textAnchor="middle" className="chartAxisLabel">
              {xLabel}
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
      ) : (
        <div className="chartEmpty">No data for this range.</div>
      )}
    </div>
  );
}
