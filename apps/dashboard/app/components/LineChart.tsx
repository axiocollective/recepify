type LineChartPoint = {
  label: string;
  value: number;
};

type LineChartProps = {
  title: string;
  series: Array<{ name: string; color: string; data: LineChartPoint[] }>;
  height?: number;
};

const buildPoints = (data: LineChartPoint[], width: number, height: number) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  return data
    .map((point, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width;
      const y = height - (point.value / maxValue) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};

export function LineChart({ title, series, height = 160 }: LineChartProps) {
  const width = 640;
  const padding = 8;
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
          <linearGradient id="grid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(124,58,237,0.16)" />
            <stop offset="100%" stopColor="rgba(124,58,237,0.02)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="url(#grid)" rx="16" />
        {series.map((item) => (
          <polyline
            key={item.name}
            points={buildPoints(item.data, width - padding * 2, height - padding * 2)}
            transform={`translate(${padding}, ${padding})`}
            fill="none"
            stroke={item.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}
