type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  accent?: "purple" | "green" | "orange";
};

const ACCENT_CLASS: Record<NonNullable<StatCardProps["accent"]>, string> = {
  purple: "statCardAccentPurple",
  green: "statCardAccentGreen",
  orange: "statCardAccentOrange",
};

export function StatCard({ label, value, sub, accent = "purple" }: StatCardProps) {
  return (
    <div className={`statCard ${ACCENT_CLASS[accent]}`}>
      <div className="statCardLabel">{label}</div>
      <div className="statCardValue">{value}</div>
      {sub ? <div className="statCardSub">{sub}</div> : null}
    </div>
  );
}
