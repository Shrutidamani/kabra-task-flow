import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { daysUntil, type Task } from "@/lib/tasks";

// Pops a reminder to the assignee for tasks due within 2 days (and not completed).
export function ReminderWatcher() {
  const { user } = useAuth();
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let active = true;

    const check = async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, company, due_date, status")
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .not("due_date", "is", null);

      if (!active || !data) return;
      for (const t of data as Pick<Task, "id" | "title" | "company" | "due_date" | "status">[]) {
        if (!t.due_date) continue;
        const days = daysUntil(t.due_date);
        if (days <= 2 && !notified.current.has(t.id)) {
          notified.current.add(t.id);
          const when = days < 0 ? "overdue" : days === 0 ? "due today" : `due in ${days} day${days === 1 ? "" : "s"}`;
          toast.warning(`Reminder: "${t.title}" is ${when}`, {
            description: t.company ? `Client: ${t.company}` : "Please update its status when done.",
            duration: 10000,
          });
        }
      }
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  return null;
}
