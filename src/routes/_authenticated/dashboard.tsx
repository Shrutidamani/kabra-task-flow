import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  CalendarCheck,
  CalendarDays,
} from "lucide-react";
import { useTasks, useMembers, useAttendanceMonth } from "@/lib/queries";
import { isOverdue, daysUntil, STATUS_LABELS, PRIORITY_LABELS, type Task } from "@/lib/tasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ATTENDANCE_LABELS, monthKey, monthLabel } from "@/lib/payroll";
import { BarList, ChartEmpty, DonutChart, GroupedBarList } from "@/components/SimpleCharts";

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
  const { canManage } = useAuth();
  return canManage ? <AdminDashboard /> : <StaffHome />;
}

function AdminDashboard() {
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
              <ChartEmpty />
            ) : (
              <DonutChart data={statusData} colors={STAT_COLORS} />
            )}
            <Legend items={statusData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tasks by Priority</CardTitle></CardHeader>
          <CardContent>
            {stats.total === 0 ? (
              <ChartEmpty />
            ) : (
              <BarList data={priorityData} />
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
            <ChartEmpty />
          ) : (
            <GroupedBarList data={memberData} />
          )}
        </CardContent>
      </Card>

      {isLoading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
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

const PRIORITY_TONE: Record<string, string> = {
  high: "bg-destructive/15 text-destructive",
  medium: "bg-accent/20 text-accent-foreground",
  low: "bg-secondary text-secondary-foreground",
};

function StaffHome() {
  const { profile, user } = useAuth();
  const { data: tasks = [], isLoading } = useTasks();
  const month = monthKey();
  const { data: attendance = [] } = useAttendanceMonth(month);

  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigned_to === user?.id),
    [tasks, user?.id],
  );

  const active = useMemo(
    () => myTasks.filter((t) => t.status !== "completed"),
    [myTasks],
  );

  const todayOrOverdue = useMemo(
    () =>
      active
        .filter((t) => t.due_date && daysUntil(t.due_date) <= 0)
        .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1)),
    [active],
  );

  const upcoming = useMemo(
    () =>
      active
        .filter((t) => t.due_date && daysUntil(t.due_date) > 0)
        .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
        .slice(0, 5),
    [active],
  );

  const stats = useMemo(() => {
    const now = new Date();
    const inMonth = (s: string | null) =>
      s ? s.slice(0, 7) === month : false;
    return {
      assigned: active.length,
      inProgress: myTasks.filter((t) => t.status === "in_progress").length,
      completedThisMonth: myTasks.filter(
        (t) => t.status === "completed" && inMonth(t.completed_at),
      ).length,
      overdue: myTasks.filter(isOverdue).length,
    };
  }, [active, myTasks, month]);

  const myAttendance = useMemo(
    () => attendance.filter((a) => a.user_id === user?.id),
    [attendance, user?.id],
  );

  const attCounts = useMemo(() => {
    return {
      present: myAttendance.filter((a) => a.status === "present").length,
      half_day: myAttendance.filter((a) => a.status === "half_day").length,
      absent: myAttendance.filter((a) => a.status === "absent").length,
    };
  }, [myAttendance]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Hello{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground">Here's what's on your plate.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Tasks" value={stats.assigned} icon={ListTodo} tone="bg-secondary text-secondary-foreground" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} tone="bg-accent/20 text-accent-foreground" />
        <StatCard label="Done This Month" value={stats.completedThisMonth} icon={CheckCircle2} tone="bg-success/15 text-success" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} tone="bg-destructive/15 text-destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4" /> Due Today & Overdue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {todayOrOverdue.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nothing due today. Nice work! 🎉
            </p>
          ) : (
            todayOrOverdue.map((t) => <TaskRow key={t.id} task={t} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4" /> Upcoming Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No upcoming deadlines.
            </p>
          ) : (
            upcoming.map((t) => <TaskRow key={t.id} task={t} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="size-4" /> My Attendance — {monthLabel(month)}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold font-display text-success">{attCounts.present}</p>
            <p className="text-xs text-muted-foreground">{ATTENDANCE_LABELS.present}</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-display text-accent-foreground">{attCounts.half_day}</p>
            <p className="text-xs text-muted-foreground">{ATTENDANCE_LABELS.half_day}</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-display text-destructive">{attCounts.absent}</p>
            <p className="text-xs text-muted-foreground">{ATTENDANCE_LABELS.absent}</p>
          </div>
        </CardContent>
      </Card>

      {isLoading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const overdue = isOverdue(task);
  const days = task.due_date ? daysUntil(task.due_date) : null;
  const dueLabel =
    days === null
      ? ""
      : days < 0
        ? `${Math.abs(days)}d overdue`
        : days === 0
          ? "Due today"
          : `In ${days}d`;
  return (
    <Link
      to="/tasks"
      className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{task.title}</p>
        {task.company && (
          <p className="truncate text-xs text-muted-foreground">{task.company}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline" className={PRIORITY_TONE[task.priority]}>
          {PRIORITY_LABELS[task.priority]}
        </Badge>
        {dueLabel && (
          <span className={`text-xs font-medium ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
            {dueLabel}
          </span>
        )}
      </div>
    </Link>
  );
}
