type BarChartProps = {
  title: string;
  data: Array<{ label: string; value: number }>;
  color?: string;
};

export function BarChart({ title, data, color = "#7c3aed" }: BarChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="chartCard">
      <div className="chartHeader">
        <h3>{title}</h3>
      </div>
      <div className="barList">
        {data.map((item) => (
          <div key={item.label} className="barRow">
            <div className="barLabel">{item.label}</div>
            <div className="barTrack">
              <div
                className="barFill"
                style={{
                  width: `${Math.round((item.value / maxValue) * 100)}%`,
                  background: color,
                }}
              />
            </div>
            <div className="barValue">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
