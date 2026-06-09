import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, Building, CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTasks, useMembers, useTemplates } from "@/lib/queries";
import {
  isOverdue,
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Task Management — K K Kabra & Co" }] }),
  component: TasksPage,
});

const CUSTOM = "__custom__";

function priorityClass(p: TaskPriority) {
  return p === "high"
    ? "bg-destructive/15 text-destructive"
    : p === "medium"
      ? "bg-accent/20 text-accent-foreground"
      : "bg-secondary text-secondary-foreground";
}

function statusClass(s: TaskStatus) {
  return s === "completed"
    ? "bg-success/15 text-success"
    : s === "in_progress"
      ? "bg-chart-5/15 text-chart-5"
      : "bg-muted text-muted-foreground";
}

function TasksPage() {
  const { user, canManage } = useAuth();
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: members = [] } = useMembers();
  const { data: templates = [] } = useTemplates();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const memberName = (id: string | null) => {
    if (!id) return "Unassigned";
    const m = members.find((x) => x.id === id);
    return m?.name || m?.email || "Unknown";
  };

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.company ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tasks, search, statusFilter]);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Task Management</h1>
          <p className="text-muted-foreground">Create, assign and track firm tasks.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> New Task</Button>
            </DialogTrigger>
            <CreateTaskDialog
              templates={templates}
              members={members}
              userId={user?.id ?? ""}
              onDone={() => setOpen(false)}
            />
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by task or company…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground">Loading tasks…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No tasks found. {canManage && "Create one to get started."}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const overdue = isOverdue(t);
            const canUpdate = canManage || t.assigned_to === user?.id;
            return (
              <Card key={t.id} className={cn(overdue && "border-destructive/40")}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{t.title}</h3>
                      <Badge className={priorityClass(t.priority)} variant="secondary">
                        {PRIORITY_LABELS[t.priority]}
                      </Badge>
                      {overdue && <Badge variant="secondary" className="bg-destructive/15 text-destructive">Overdue</Badge>}
                    </div>
                    {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {t.company && <span className="flex items-center gap-1"><Building className="size-3.5" /> {t.company}</span>}
                      {t.due_date && <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> {new Date(t.due_date).toLocaleDateString()}</span>}
                      <span>Assignee: <strong className="text-foreground">{memberName(t.assigned_to)}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canUpdate ? (
                      <Select value={t.status} onValueChange={(v) => statusMutation.mutate({ id: t.id, status: v as TaskStatus })}>
                        <SelectTrigger className={cn("w-[150px]", statusClass(t.status))}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className={statusClass(t.status)}>{STATUS_LABELS[t.status]}</Badge>
                    )}
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(t.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateTaskDialog({
  templates,
  members,
  userId,
  onDone,
}: {
  templates: { id: string; name: string }[];
  members: { id: string; name: string; email: string }[];
  userId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [templateChoice, setTemplateChoice] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const title = templateChoice === CUSTOM ? customTitle.trim() : templateChoice;
      if (!title) throw new Error("Please choose or enter a task.");
      if (!assignedTo) throw new Error("Please choose an assignee.");

      // Save new custom template for future use
      if (templateChoice === CUSTOM && customTitle.trim()) {
        await supabase.from("task_templates").insert({ name: customTitle.trim() }).then(() => {});
      }

      const { error } = await supabase.from("tasks").insert({
        title,
        company: company.trim() || null,
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        assigned_to: assignedTo,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Task created & assigned");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Create &amp; Assign Task</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Task</Label>
          <Select value={templateChoice} onValueChange={setTemplateChoice}>
            <SelectTrigger><SelectValue placeholder="Select a regular task" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
              <SelectItem value={CUSTOM}>+ Add a new task…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {templateChoice === CUSTOM && (
          <div className="space-y-2">
            <Label>New task name</Label>
            <Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="e.g. Net Worth Certificate" />
          </div>
        )}
        <div className="space-y-2">
          <Label>Company / Client</Label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Client or company name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Assign to</Label>
          <Select value={assignedTo} onValueChange={setAssignedTo}>
            <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
            <SelectContent>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add task details…" rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="size-4 animate-spin" />} Create Task
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
