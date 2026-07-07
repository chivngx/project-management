"use client";

import * as React from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
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

// Neutral + emerald/amber/violet/zinc palette (no indigo/blue).
const STATUS_COLORS: Record<string, string> = {
  TODO: "#a1a1aa", // zinc-400
  IN_PROGRESS: "#f59e0b", // amber-500
  REVIEW: "#8b5cf6", // violet-500
  DONE: "#10b981", // emerald-500
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: TasksByStatusDatum }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const total = item?.payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{item?.name}</p>
      <p className="mt-0.5 text-muted-foreground">
        {item?.value} tác vụ
      </p>
      {total ? null : null}
    </div>
  );
}

function ChartLegend({
  data,
  total,
}: {
  data: TasksByStatusDatum[];
  total: number;
}) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
      {data.map((d) => (
        <li key={d.key} className="flex items-center gap-1.5 text-xs">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[d.key] ?? "#a1a1aa" }}
            aria-hidden
          />
          <span className="text-muted-foreground">{d.name}</span>
          <span className="font-medium tabular-nums text-foreground">
            {d.value}
          </span>
          <span className="text-muted-foreground">
            ({total === 0 ? 0 : Math.round((d.value / total) * 100)}%)
          </span>
        </li>
      ))}
    </ul>
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
        <CardTitle>Tác vụ theo trạng thái</CardTitle>
        <CardDescription>
          Phân bố {total} tác vụ trong workspace hiện tại
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <Skeleton className="size-44 rounded-full" />
            <div className="flex w-full flex-wrap gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-24" />
              ))}
            </div>
          </div>
        ) : total === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Chưa có tác vụ nào
            </p>
            <p className="text-xs text-muted-foreground">
              Các tác vụ sẽ xuất hiện ở đây khi được tạo.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div
              className="relative h-48 w-full"
              role="img"
              aria-label={`Biểu đồ tác vụ theo trạng thái: ${data
                .map((d) => `${d.name}: ${d.value}`)
                .join(", ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={84}
                    paddingAngle={2}
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
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={() => <span className="hidden" />}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums">
                  {total}
                </span>
                <span className="text-xs text-muted-foreground">tác vụ</span>
              </div>
            </div>
            <ChartLegend data={data} total={total} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
