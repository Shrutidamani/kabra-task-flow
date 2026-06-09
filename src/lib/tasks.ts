export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "in_progress" | "completed";

export interface Task {
  id: string;
  title: string;
  company: string | null;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const STATUS_OPTIONS: TaskStatus[] = ["pending", "in_progress", "completed"];
export const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high"];

export function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === "completed") return false;
  const due = new Date(task.due_date + "T23:59:59");
  return due.getTime() < Date.now();
}

export function daysUntil(dateStr: string): number {
  const due = new Date(dateStr + "T23:59:59");
  const diff = due.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
