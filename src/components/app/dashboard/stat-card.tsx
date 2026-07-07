"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tone = "zinc" | "emerald" | "violet" | "amber" | "red";

const TONE_STYLES: Record<Tone, string> = {
  zinc:    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  violet:  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  amber:   "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  red:     "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  helper?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  /** Emphasize value (e.g. overdue > 0). */
  alert?: boolean;
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "zinc",
  alert = false,
  loading = false,
}: StatCardProps) {
  return (
    <Card className="card-lift overflow-hidden">
      <CardContent className="flex items-start gap-4 p-5">
        {/* Icon chip */}
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
            alert ? TONE_STYLES.red : TONE_STYLES[tone]
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </div>

        {/* Text block */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-1.5 h-8 w-16 rounded-md" />
          ) : (
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-3xl font-bold tracking-tight tabular-nums leading-tight",
                  alert && "text-red-600 dark:text-red-400"
                )}
              >
                {value}
              </span>
            </div>
          )}
          {helper && !loading && (
            <p
              className={cn(
                "mt-1.5 truncate text-xs text-muted-foreground",
                alert && "text-red-600/80 dark:text-red-400/80"
              )}
            >
              {helper}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
