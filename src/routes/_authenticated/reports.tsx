import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useTasks, useMembers } from "@/lib/queries";
import { isOverdue, STATUS_LABELS, PRIORITY_LABELS, daysUntil, type Task } from "@/lib/tasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports & Analytics — K K Kabra & Co" }] }),
  component: ReportsPage,
});

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function ReportsPage() {
  const { data: tasks = [] } = useTasks();
  const { data: members = [] } = useMembers();

  const byStatus = useMemo(() => {
    const c: Record<string, number> = { pending: 0, in_progress: 0, completed: 0 };
    tasks.forEach((t) => (c[t.status] += 1));
    return Object.entries(c).map(([k, v]) => ({ name: STATUS_LABELS[k as Task["status"]], value: v }));
  }, [tasks]);

  const byPriority = useMemo(() => {
    const c: Record<string, number> = { low: 0, medium: 0, high: 0 };
    tasks.forEach((t) => (c[t.priority] += 1));
    return Object.entries(c).map(([k, v]) => ({ name: PRIORITY_LABELS[k as Task["priority"]], value: v }));
  }, [tasks]);

  const byDue = useMemo(() => {
    const buckets = { Overdue: 0, "Due ≤7 days": 0, "Due 8-30 days": 0, "Later": 0, "No date": 0 };
    tasks.filter((t) => t.status !== "completed").forEach((t) => {
      if (!t.due_date) buckets["No date"] += 1;
      else {
        const d = daysUntil(t.due_date);
        if (d < 0) buckets.Overdue += 1;
        else if (d <= 7) buckets["Due ≤7 days"] += 1;
        else if (d <= 30) buckets["Due 8-30 days"] += 1;
        else buckets.Later += 1;
      }
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  const memberStats = useMemo(() => {
    return members
      .map((m) => {
        const assigned = tasks.filter((t) => t.assigned_to === m.id);
        const done = assigned.filter((t) => t.status === "completed").length;
        const overdue = assigned.filter(isOverdue).length;
        return {
          id: m.id,
          name: m.name || m.email,
          assigned: assigned.length,
          done,
          overdue,
          rate: assigned.length ? Math.round((done / assigned.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.assigned - a.assigned);
  }, [members, tasks]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports &amp; Analytics</h1>
        <p className="text-muted-foreground">Insights across team, status, priority and deadlines.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">By Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={80} label>
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By Priority</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={byPriority}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="value" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By Due Date (open)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={byDue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="value" fill="var(--color-chart-4)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Team Member-wise Analytics</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {memberStats.length === 0 && <p className="text-sm text-muted-foreground">No team members yet.</p>}
          {memberStats.map((m) => (
            <div key={m.id} className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{m.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{m.done}/{m.assigned} done</span>
                  {m.overdue > 0 && <Badge variant="secondary" className="bg-destructive/15 text-destructive">{m.overdue} overdue</Badge>}
                  <span className="font-semibold text-foreground">{m.rate}%</span>
                </div>
              </div>
              <Progress value={m.rate} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
