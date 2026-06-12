export type AttendanceStatus = "present" | "absent" | "half_day";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
};

export const ATTENDANCE_OPTIONS: AttendanceStatus[] = ["present", "absent", "half_day"];

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note: string | null;
}

// We treat every month as a fixed 30-day month (firm policy).
export const MONTH_DAYS = 30;

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the YYYY-MM string for a Date. */
export function monthKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

export interface SalaryBreakdown {
  present: number;
  halfDay: number;
  absent: number;
  paidHolidays: number;
  paidDays: number;
  payableDays: number;
  dailyRate: number;
  gross: number;
}

/**
 * Holiday-adjusted daily rate on a fixed 30-day month.
 * dailyRate = salary / (30 - allowedHolidays)
 * paidDays  = present + 0.5*halfDay + min(absent, allowedHolidays)
 * gross     = dailyRate * paidDays (capped at salary)
 */
export function computeSalary(
  records: AttendanceRecord[],
  monthlySalary: number,
  allowedHolidays: number,
): SalaryBreakdown {
  const present = records.filter((r) => r.status === "present").length;
  const halfDay = records.filter((r) => r.status === "half_day").length;
  const absent = records.filter((r) => r.status === "absent").length;

  const paidHolidays = Math.min(absent, Math.max(0, allowedHolidays));
  const paidDays = present + 0.5 * halfDay + paidHolidays;
  const payableDays = Math.max(1, MONTH_DAYS - allowedHolidays);
  const dailyRate = monthlySalary / payableDays;
  const gross = Math.min(monthlySalary, Math.round(dailyRate * paidDays * 100) / 100);

  return {
    present,
    halfDay,
    absent,
    paidHolidays,
    paidDays,
    payableDays,
    dailyRate: Math.round(dailyRate * 100) / 100,
    gross,
  };
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
