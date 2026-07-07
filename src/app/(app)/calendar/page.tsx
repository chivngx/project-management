"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format, getDaysInMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PRIORITY_BADGE,
  TASK_STATUS_BADGE,
} from "@/lib/constants";

type CalendarTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  projectName: string;
  projectId: string;
  assigneeName: string | null;
};

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function CalendarPage() {
  const [cursor, setCursor] = React.useState(() => new Date());
  const monthKey = format(cursor, "yyyy-MM");

  const { data: tasks, isLoading } = useQuery<CalendarTask[]>({
    queryKey: ["calendar", monthKey],
    queryFn: () => apiFetch(`/api/calendar?month=${monthKey}`),
  });

  // Build a 6-row grid starting from the Monday on/before the 1st.
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const tasksByDay = React.useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const t of tasks ?? []) {
      const d = parseISO(t.dueDate);
      const key = format(d, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Lịch</h1>
          <p className="text-sm text-muted-foreground">
            Tác vụ theo ngày hết hạn trong workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label="Tháng trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium capitalize">
            {format(cursor, "MMMM yyyy", { locale: vi })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Tháng sau"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Hôm nay
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const today = isToday(day);
            return (
              <div
                key={key}
                className={cn(
                  "min-h-28 border-b border-r p-1.5 sm:min-h-32",
                  !inMonth && "bg-muted/20",
                  today && "bg-primary/5"
                )}
              >
                <div
                  className={cn(
                    "mb-1 text-right text-xs font-medium",
                    today
                      ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/60"
                  )}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((t) => (
                    <Link
                      key={t.id}
                      href={`/projects/${t.projectId}`}
                      className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium hover:bg-accent"
                      title={`${t.title} — ${t.projectName}`}
                    >
                      <span
                        className={cn(
                          "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
                          (TASK_STATUS_BADGE[t.status] ?? "").includes("emerald")
                            ? "bg-emerald-500"
                            : (TASK_STATUS_BADGE[t.status] ?? "").includes("amber")
                              ? "bg-amber-500"
                              : (TASK_STATUS_BADGE[t.status] ?? "").includes("violet")
                                ? "bg-violet-500"
                                : "bg-zinc-400"
                        )}
                      />
                      <span className="align-middle">{t.title}</span>
                    </Link>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="px-1.5 text-[10px] text-muted-foreground">
                      +{dayTasks.length - 3} khác
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {isLoading && tasks === undefined && (
        <p className="text-sm text-muted-foreground">Đang tải tác vụ…</p>
      )}
      {!isLoading && (tasks ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">
          Không có tác vụ nào đến hạn trong tháng này.
        </p>
      )}
    </div>
  );
}
