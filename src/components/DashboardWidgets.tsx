import { Bar, BarChart, Cell, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { useFirmOverview } from "@/lib/overview";

type O = ReturnType<typeof useFirmOverview>;
const C = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } };

function Card({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`surface hover-lift card-glow animate-fade-up p-4 ${className}`}>
      <div className="mb-3">
        <div className="text-sm font-semibold">{title}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export function DashboardWidgets({ rows, docs }: { rows: O["rows"]; docs: O["docs"] }) {
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.percent, 0) / rows.length) : 0;
  const bars = rows.map((r) => ({ name: r.client.name.split(" ")[0], percent: r.percent }));
  const byStatus = Object.entries(docs.reduce<Record<string, number>>((m, d) => ((m[d.status] = (m[d.status] ?? 0) + 1), m), {})).map(([name, value]) => ({ name, value }));
  const statusCounts = Object.entries(rows.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {}));

  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-3">
      <Card title="Close progress by client" sub="Percent of monthly close complete" className="lg:col-span-2">
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={bars}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} width={30} />
              <Tooltip {...tip} cursor={{ fill: "var(--accent)" }} formatter={(v) => [`${v}%`, "Close"]} />
              <Bar dataKey="percent" radius={[6, 6, 0, 0]} animationDuration={900}>
                {bars.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Firm close" sub="Average across clients">
        <div className="relative h-56">
          <ResponsiveContainer>
            <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ v: avg }]} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="v" cornerRadius={10} fill="var(--primary)" background={{ fill: "var(--muted)" }} animationDuration={1200} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-3xl font-semibold">{avg}%</span>
            <span className="text-xs text-muted-foreground">complete</span>
          </div>
        </div>
      </Card>
      <Card title="Documents by status" sub={`${docs.length} documents`}>
        <div className="flex items-center gap-3">
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byStatus} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={3} animationDuration={900}>
                  {byStatus.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                </Pie>
                <Tooltip {...tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-xs">
            {byStatus.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: C[i % C.length] }} />
                {s.name} <span className="num font-semibold">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <Card title="Client health" sub="Close status right now" className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {statusCounts.map(([name, n]) => (
            <div key={name} className="rounded-md bg-muted p-3">
              <div className="num text-2xl font-semibold">{n}</div>
              <div className="text-xs text-muted-foreground">{name}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {rows.slice().sort((a, b) => b.percent - a.percent).map((r) => (
            <div key={r.client.id} className="flex items-center gap-3 text-xs">
              <span className="w-40 truncate">{r.client.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-1000" style={{ width: `${r.percent}%` }} />
              </div>
              <span className="num w-9 text-right">{r.percent}%</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
