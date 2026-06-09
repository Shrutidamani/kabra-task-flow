import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { useMembers, useTasks } from "@/lib/queries";
import { createTeamMember, updateMemberRole, deleteTeamMember } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team Members — K K Kabra & Co" }] }),
  component: TeamPage,
});

const ROLE_OPTIONS: AppRole[] = ["admin", "partner", "manager", "article", "intern"];

function TeamPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useMembers();
  const { data: tasks = [] } = useTasks();
  const [open, setOpen] = useState(false);

  const create = useServerFn(createTeamMember);
  const updateRole = useServerFn(updateMemberRole);
  const remove = useServerFn(deleteTeamMember);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("article");

  const createMutation = useMutation({
    mutationFn: () => create({ data: { name: name.trim(), email: email.trim(), password, role } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Team member added");
      setName(""); setEmail(""); setPassword(""); setRole("article");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; role: AppRole }) => updateRole({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => remove({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Team member removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statsFor = (id: string) => {
    const assigned = tasks.filter((t) => t.assigned_to === id);
    const done = assigned.filter((t) => t.status === "completed").length;
    return { assigned: assigned.length, done };
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-muted-foreground">Manage the people in your firm and their roles.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="size-4" /> Add Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
                <div className="space-y-2"><Label>Email ID</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@kabraco.in" /></div>
                <div className="space-y-2"><Label>Temporary Password</Label>
                  <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></div>
                <div className="space-y-2"><Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="size-4 animate-spin" />} Add Member
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-3">
          {members.map((m) => {
            const s = statsFor(m.id);
            const rate = s.assigned ? Math.round((s.done / s.assigned) * 100) : 0;
            const initials = (m.name || m.email).split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
            return (
              <Card key={m.id}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold">
                        {m.name || "Unnamed"}
                        {m.roles.includes("admin") && <ShieldCheck className="size-4 text-accent" />}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.roles.length ? m.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="text-[10px]">{ROLE_LABELS[r]}</Badge>
                        )) : <Badge variant="outline" className="text-[10px]">No role</Badge>}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="text-muted-foreground">Tasks: <strong className="text-foreground">{s.assigned}</strong></p>
                    <p className="text-muted-foreground">Completion: <strong className="text-foreground">{rate}%</strong></p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <Select value={m.roles[0] ?? ""} onValueChange={(v) => roleMutation.mutate({ userId: m.id, role: v as AppRole })}>
                        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Set role" /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {m.id !== user?.id && (
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
