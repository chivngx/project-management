"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface TasksByStatusDatum {
  name: string;
  value: number;
  key: string;
}

interface TasksByStatusChartProps {
  data: TasksByStatusDatum[];
  loading?: boolean;
}

// Palette: zinc / amber / violet / emerald (no blue/indigo)
const STATUS_COLORS: Record<string, string> = {
  TODO:        "#a1a1aa", // zinc-400
  IN_PROGRESS: "#f59e0b", // amber-500
  REVIEW:      "#8b5cf6", // violet-500
  DONE:        "#10b981", // emerald-500
};

const STATUS_BG: Record<string, string> = {
  TODO:        "bg-zinc-100 dark:bg-zinc-800",
  IN_PROGRESS: "bg-amber-100 dark:bg-amber-950",
  REVIEW:      "bg-violet-100 dark:bg-violet-950",
  DONE:        "bg-emerald-100 dark:bg-emerald-950",
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: TasksByStatusDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{item?.name}</p>
      <p className="mt-0.5 text-muted-foreground">
        <span className="tabular-nums font-medium text-foreground">{item?.value}</span>{" "}
        tác vụ
      </p>
    </div>
  );
}

function LegendRow({
  datum,
  total,
}: {
  datum: TasksByStatusDatum;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((datum.value / total) * 100);
  const color = STATUS_COLORS[datum.key] ?? "#a1a1aa";

  return (
    <div className="flex items-center gap-2">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {datum.name}
      </span>
      <span className="text-xs font-semibold tabular-nums">{datum.value}</span>
      <span className="w-8 text-right text-[11px] text-muted-foreground tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

export function TasksByStatusChart({
  data,
  loading = false,
}: TasksByStatusChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Tác vụ theo trạng thái</CardTitle>
        <CardDescription className="text-xs">
          Phân bố {total} tác vụ trong workspace hiện tại
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-6 py-2">
            <Skeleton className="size-36 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-full rounded" />
              ))}
            </div>
          </div>
        ) : total === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Chưa có tác vụ nào
            </p>
            <p className="text-xs text-muted-foreground">
              Các tác vụ sẽ xuất hiện ở đây khi được tạo.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            {/* Donut chart */}
            <div
              className="relative h-36 w-36 shrink-0"
              role="img"
              aria-label={`Biểu đồ tác vụ: ${data.map((d) => `${d.name}: ${d.value}`).join(", ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={44}
                    outerRadius={64}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={STATUS_COLORS[entry.key] ?? "#a1a1aa"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<ChartTooltip />}
                    wrapperStyle={{ outline: "none" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums leading-none">
                  {total}
                </span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">
                  tác vụ
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="w-full flex-1 space-y-2">
              {data.map((d) => (
                <LegendRow key={d.key} datum={d} total={total} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
