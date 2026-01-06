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

export function StackedBarChart({ title, series, height = 180, yLabel }: StackedBarChartProps) {
  const width = 640;
  const padding = 24;
  const labels = series[0]?.data.map((point) => point.label) ?? [];
  const totals = labels.map((_, index) =>
    series.reduce((sum, current) => sum + (current.data[index]?.value ?? 0), 0)
  );
  const maxValue = Math.max(...totals, 1);
  const barWidth = (width - padding * 2) / Math.max(labels.length, 1);
  const tickLabels =
    labels.length > 0
      ? [labels[0], labels[Math.floor(labels.length / 2)], labels[labels.length - 1]]
      : [];

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
      <svg viewBox={`0 0 ${width} ${height}`} className="chartSvg">
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
              />
            );
          });
        })}
        <text x={padding - 6} y={padding + 4} textAnchor="end" className="chartAxisLabel">
          {maxValue.toLocaleString("en-US")}
        </text>
        <text
          x={padding - 6}
          y={(height - padding + padding) / 2}
          textAnchor="end"
          className="chartAxisLabel"
        >
          {Math.round(maxValue / 2).toLocaleString("en-US")}
        </text>
        <text
          x={padding - 6}
          y={height - padding + 4}
          textAnchor="end"
          className="chartAxisLabel"
        >
          0
        </text>
        {tickLabels.length === 3 ? (
          <>
            <text x={padding} y={height - 6} textAnchor="start" className="chartAxisLabel">
              {tickLabels[0]}
            </text>
            <text x={width / 2} y={height - 6} textAnchor="middle" className="chartAxisLabel">
              {tickLabels[1]}
            </text>
            <text
              x={width - padding}
              y={height - 6}
              textAnchor="end"
              className="chartAxisLabel"
            >
              {tickLabels[2]}
            </text>
          </>
        ) : null}
        {yLabel ? (
          <text
            x={12}
            y={height / 2}
            textAnchor="middle"
            className="chartAxisLabel"
            transform={`rotate(-90 12 ${height / 2})`}
          >
            {yLabel}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
