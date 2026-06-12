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

export function useFirmSettings() {
  return useQuery({
    queryKey: ["firm_settings"],
    queryFn: async (): Promise<{ allowed_holidays: number }> => {
      const { data, error } = await supabase
        .from("firm_settings")
        .select("allowed_holidays")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return { allowed_holidays: data?.allowed_holidays ?? 2 };
    },
  });
}

export function useAttendanceMonth(month: string) {
  return useQuery({
    queryKey: ["attendance", month],
    queryFn: async (): Promise<AttendanceRecord[]> => {
      const start = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const endDate = new Date(y, m, 1).toISOString().slice(0, 10); // first day of next month
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_id, date, status, note")
        .gte("date", start)
        .lt("date", endDate);
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
  });
}

export function useSalaries() {
  return useQuery({
    queryKey: ["salaries"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("salary_config")
        .select("user_id, monthly_salary");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as { user_id: string; monthly_salary: number }[]) {
        map[r.user_id] = Number(r.monthly_salary);
      }
      return map;
    },
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ["notifications"],
    enabled,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, task_id, type, read, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });
}

