import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Save, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMembers, useAttendanceMonth, useSalaries, useFirmSettings } from "@/lib/queries";
import {
  computeSalary,
  formatINR,
  monthKey,
  monthLabel,
  MONTH_DAYS,
} from "@/lib/payroll";
import { AttendancePrompt } from "@/components/AttendancePrompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Attendance & Salary — K K Kabra & Co" }] }),
  component: PayrollPage,
});

function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }
  return out;
}

function PayrollPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthKey());
  const [promptOpen, setPromptOpen] = useState(false);

  const { data: members = [] } = useMembers();
  const { data: records = [] } = useAttendanceMonth(month);
  const { data: salaries = {} } = useSalaries();
  const { data: settings } = useFirmSettings();

  const allowedHolidays = settings?.allowed_holidays ?? 2;
  const staff = useMemo(() => members.filter((m) => m.id !== user?.id), [members, user?.id]);

  const [holidayInput, setHolidayInput] = useState<string>("");
  const [salaryEdits, setSalaryEdits] = useState<Record<string, string>>({});

  const saveHolidays = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from("firm_settings")
        .update({ allowed_holidays: value })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["firm_settings"] });
      toast.success("Holiday setting updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSalary = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const { error } = await supabase
        .from("salary_config")
        .upsert({ user_id: userId, monthly_salary: amount }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salaries"] });
      toast.success("Salary updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-muted-foreground">
        Only admins can access attendance and salary.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <AttendancePrompt open={promptOpen} onOpenChange={setPromptOpen} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Attendance & Salary</h1>
          <p className="text-muted-foreground">
            Mark daily attendance and compute monthly salary (30-day month).
          </p>
        </div>
        <Button onClick={() => setPromptOpen(true)}>
          <CalendarCheck className="size-4" /> Mark Today's Attendance
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Paid holidays allowed / month</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Currently {allowedHolidays} days</Label>
              <Input
                type="number"
                min={0}
                max={30}
                className="w-28"
                placeholder={String(allowedHolidays)}
                value={holidayInput}
                onChange={(e) => setHolidayInput(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              disabled={saveHolidays.isPending || holidayInput === ""}
              onClick={() => {
                const v = Math.max(0, Math.min(30, Number(holidayInput)));
                saveHolidays.mutate(v);
                setHolidayInput("");
              }}
            >
              {saveHolidays.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Salary month</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {lastMonths(12).map((m) => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4" /> Salary for {monthLabel(month)}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {staff.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No staff added yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Monthly Salary</TableHead>
                  <TableHead className="text-center">P</TableHead>
                  <TableHead className="text-center">H</TableHead>
                  <TableHead className="text-center">A</TableHead>
                  <TableHead className="text-right">Payable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((m) => {
                  const recs = records.filter((r) => r.user_id === m.id);
                  const base = salaries[m.id] ?? 0;
                  const calc = computeSalary(recs, base, allowedHolidays);
                  const edit = salaryEdits[m.id];
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name || m.email.split("@")[0]}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            className="w-28"
                            value={edit ?? String(base)}
                            onChange={(e) =>
                              setSalaryEdits((s) => ({ ...s, [m.id]: e.target.value }))
                            }
                          />
                          {edit !== undefined && Number(edit) !== base && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                saveSalary.mutate({ userId: m.id, amount: Math.max(0, Number(edit)) });
                                setSalaryEdits((s) => {
                                  const c = { ...s };
                                  delete c[m.id];
                                  return c;
                                });
                              }}
                            >
                              <Save className="size-4 text-primary" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-success">{calc.present}</TableCell>
                      <TableCell className="text-center text-accent-foreground">{calc.halfDay}</TableCell>
                      <TableCell className="text-center text-destructive">{calc.absent}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(calc.gross)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            P = Present, H = Half day, A = Absent. Daily rate = salary ÷ ({MONTH_DAYS} −{" "}
            {allowedHolidays} holidays). Up to {allowedHolidays} absent day(s) are paid as holidays.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
