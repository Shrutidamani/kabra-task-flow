import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useTasks, useMembers } from "@/lib/queries";
import { isOverdue, STATUS_LABELS, PRIORITY_LABELS, type Task } from "@/lib/tasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — K K Kabra & Co" }] }),
  component: Dashboard,
});

const STAT_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ListTodo;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex size-12 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="size-6" />
        </div>
        <div>
          <p className="text-3xl font-bold font-display">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { profile } = useAuth();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: members = [] } = useMembers();

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter(isOverdue).length;
    const pending = tasks.filter((t) => t.status !== "completed").length;
    return { total, completed, pending, overdue };
  }, [tasks]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, in_progress: 0, completed: 0 };
    tasks.forEach((t) => (counts[t.status] += 1));
    return Object.entries(counts).map(([k, v]) => ({
      name: STATUS_LABELS[k as Task["status"]],
      value: v,
    }));
  }, [tasks]);

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0 };
    tasks.forEach((t) => (counts[t.priority] += 1));
    return Object.entries(counts).map(([k, v]) => ({
      name: PRIORITY_LABELS[k as Task["priority"]],
      value: v,
    }));
  }, [tasks]);

  const memberData = useMemo(() => {
    return members
      .map((m) => {
        const assigned = tasks.filter((t) => t.assigned_to === m.id);
        const done = assigned.filter((t) => t.status === "completed").length;
        return {
          name: m.name || m.email.split("@")[0],
          assigned: assigned.length,
          completed: done,
        };
      })
      .filter((m) => m.assigned > 0)
      .sort((a, b) => b.assigned - a.assigned)
      .slice(0, 6);
  }, [members, tasks]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}</h1>
        <p className="text-muted-foreground">Firm-wide overview of task delegation and progress.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Tasks" value={stats.total} icon={ListTodo} tone="bg-secondary text-secondary-foreground" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="bg-success/15 text-success" />
        <StatCard label="Pending" value={stats.pending} icon={Clock} tone="bg-accent/20 text-accent-foreground" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} tone="bg-destructive/15 text-destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Tasks by Status</CardTitle></CardHeader>
          <CardContent>
            {stats.total === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {statusData.map((_, i) => <Cell key={i} fill={STAT_COLORS[i % STAT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <Legend items={statusData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tasks by Priority</CardTitle></CardHeader>
          <CardContent>
            {stats.total === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                  <Bar dataKey="value" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" /> Team Member Workload
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memberData.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={memberData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="assigned" name="Assigned" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {isLoading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      No data yet
    </div>
  );
}

function Legend({ items }: { items: { name: string; value: number }[] }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-4">
      {items.map((item, i) => (
        <div key={item.name} className="flex items-center gap-1.5 text-xs">
          <span className="size-2.5 rounded-full" style={{ background: STAT_COLORS[i % STAT_COLORS.length] }} />
          {item.name} ({item.value})
        </div>
      ))}
    </div>
  );
}
