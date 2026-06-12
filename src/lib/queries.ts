import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/lib/tasks";
import type { AppRole } from "@/lib/auth";
import type { AttendanceRecord } from "@/lib/payroll";

export interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  task_id: string | null;
  type: string;
  read: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  roles: AppRole[];
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async (): Promise<Member[]> => {
      const [{ data: profiles, error: pErr }, { data: roleRows, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, name, email").order("name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const roleMap = new Map<string, AppRole[]>();
      for (const r of (roleRows ?? []) as { user_id: string; role: AppRole }[]) {
        roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
      }
      return ((profiles ?? []) as { id: string; name: string; email: string }[]).map((p) => ({
        ...p,
        roles: roleMap.get(p.id) ?? [],
      }));
    },
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}
