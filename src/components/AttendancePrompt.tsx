import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMembers, useAttendanceMonth } from "@/lib/queries";
import {
  ATTENDANCE_OPTIONS,
  ATTENDANCE_LABELS,
  monthKey,
  todayStr,
  type AttendanceStatus,
} from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Daily pop-up that asks the admin to mark who is present / absent / half-day. */
export function AttendancePrompt({
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const today = todayStr();
  const { data: members = [] } = useMembers();
  const { data: monthRecords = [] } = useAttendanceMonth(monthKey());

  const staff = useMemo(() => members.filter((m) => m.id !== user?.id), [members, user?.id]);
  const todaysRecords = useMemo(
    () => monthRecords.filter((r) => r.date === today),
    [monthRecords, today],
  );

  const [internalOpen, setInternalOpen] = useState(false);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});

  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  // Auto-open once per day if today's attendance is incomplete.
  useEffect(() => {
    if (open !== undefined) return; // controlled externally
    if (!isAdmin || staff.length === 0) return;
    const dismissed = localStorage.getItem(`attendance_done_${today}`);
    const complete = staff.every((s) => todaysRecords.some((r) => r.user_id === s.id));
    if (!dismissed && !complete) setInternalOpen(true);
  }, [open, isAdmin, staff, todaysRecords, today]);

  // Seed marks (default present, or existing record).
  useEffect(() => {
    if (!isOpen) return;
    const seed: Record<string, AttendanceStatus> = {};
    for (const s of staff) {
      const existing = todaysRecords.find((r) => r.user_id === s.id);
      seed[s.id] = (existing?.status as AttendanceStatus) ?? "present";
    }
    setMarks(seed);
  }, [isOpen, staff, todaysRecords]);

  const save = useMutation({
    mutationFn: async () => {
      const rows = staff.map((s) => ({
        user_id: s.id,
        date: today,
        status: marks[s.id] ?? "present",
        marked_by: user?.id ?? null,
      }));
      const { error } = await supabase
        .from("attendance")
        .upsert(rows, { onConflict: "user_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      localStorage.setItem(`attendance_done_${today}`, "1");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Attendance saved for today");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="size-5" /> Today's Attendance
          </DialogTitle>
          <DialogDescription>
            {new Date(today).toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            — mark who is present, absent or on half day.
          </DialogDescription>
        </DialogHeader>

        {staff.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No staff added yet. Add team members first.
          </p>
        ) : (
          <div className="space-y-3">
            {staff.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{s.name || s.email.split("@")[0]}</span>
                <div className="flex gap-1">
                  {ATTENDANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setMarks((m) => ({ ...m, [s.id]: opt }))}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        marks[s.id] === opt
                          ? opt === "present"
                            ? "bg-success text-success-foreground"
                            : opt === "absent"
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {ATTENDANCE_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Later
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || staff.length === 0}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Save Attendance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
