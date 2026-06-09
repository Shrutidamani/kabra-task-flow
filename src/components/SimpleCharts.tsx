type ChartDatum = {
  name: string;
  value: number;
};

type GroupedBarDatum = {
  name: string;
  assigned: number;
  completed: number;
};

const DEFAULT_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const angleInRadians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
}

export function DonutChart({ data, colors = DEFAULT_COLORS }: { data: ChartDatum[]; colors?: string[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let angle = 0;

  if (total === 0) return <ChartEmpty />;

  return (
    <div className="flex h-60 items-center justify-center">
      <svg viewBox="0 0 220 220" role="img" aria-label="Donut chart" className="h-full w-full max-w-64">
        <circle cx="110" cy="110" r="72" fill="none" stroke="var(--color-muted)" strokeWidth="24" />
        {data.map((item, index) => {
          const sweep = (item.value / total) * 360;
          const path = describeArc(110, 110, 72, angle, angle + sweep);
          angle += sweep;
          return (
            <path
              key={item.name}
              d={path}
              fill="none"
              stroke={colors[index % colors.length]}
              strokeWidth="24"
              strokeLinecap="round"
            />
          );
        })}
        <text x="110" y="104" textAnchor="middle" className="fill-foreground text-2xl font-bold">
          {total}
        </text>
        <text x="110" y="126" textAnchor="middle" className="fill-muted-foreground text-xs">
          tasks
        </text>
      </svg>
    </div>
  );
}

export function BarList({ data, color = "var(--color-chart-2)" }: { data: ChartDatum[]; color?: string }) {
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="flex h-60 flex-col justify-center gap-3">
      {data.map((item) => (
        <div key={item.name} className="grid grid-cols-[minmax(74px,120px)_1fr_32px] items-center gap-3 text-xs">
          <span className="truncate text-muted-foreground">{item.name}</span>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${Math.max(4, (item.value / max) * 100)}%`, background: color }} />
          </div>
          <span className="text-right font-semibold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function GroupedBarList({ data }: { data: GroupedBarDatum[] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.assigned, item.completed]));

  if (data.length === 0) return <ChartEmpty />;

  return (
    <div className="space-y-4 py-2">
      {data.map((item) => (
        <div key={item.name} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-foreground">{item.name}</span>
            <span className="shrink-0 text-muted-foreground">{item.completed}/{item.assigned}</span>
          </div>
          <div className="grid gap-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (item.assigned / max) * 100)}%` }} />
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success" style={{ width: `${Math.max(4, (item.completed / max) * 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartEmpty() {
  return (
    <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
      No data yet
    </div>
  );
}