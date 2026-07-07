"use client";

import * as React from "react";
import { formatDistanceToNow, isValid } from "date-fns";
import { vi } from "date-fns/locale";
import { Activity as ActivityIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface Activity {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  userName: string | null;
  userImage: string | null;
}

interface RecentActivityProps {
  activities: Activity[];
  loading?: boolean;
}

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ActivityRow({ activity }: { activity: Activity }) {
  const created = new Date(activity.createdAt);
  const valid = isValid(created);

  return (
    <li className="group relative flex items-start gap-3 py-2.5 px-1">
      {/* Avatar */}
      <Avatar size="sm" className="mt-0.5 shrink-0 ring-2 ring-background">
        {activity.userImage ? (
          <AvatarImage src={activity.userImage} alt={activity.userName ?? ""} />
        ) : null}
        <AvatarFallback className="text-[10px] font-semibold">
          {initialsFromName(activity.userName)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground">
          {activity.message}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/70">
            {activity.userName ?? "Hệ thống"}
          </span>
          {valid && (
            <>
              {" · "}
              {formatDistanceToNow(created, { addSuffix: true, locale: vi })}
            </>
          )}
        </p>
      </div>
    </li>
  );
}

function ActivitySkeleton() {
  return (
    <li className="flex items-start gap-3 px-1 py-2.5">
      <Skeleton className="mt-0.5 size-6 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </li>
  );
}

export function RecentActivity({
  activities,
  loading = false,
}: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Hoạt động gần đây</CardTitle>
        <CardDescription className="text-xs">
          Cập nhật mới nhất từ workspace của bạn
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2">
        {loading ? (
          <ul className="space-y-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <ActivitySkeleton key={i} />
            ))}
          </ul>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <ActivityIcon className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Chưa có hoạt động nào</p>
            <p className="max-w-[16rem] text-xs text-muted-foreground">
              Các hành động của bạn và đội nhóm sẽ hiển thị tại đây.
            </p>
          </div>
        ) : (
          <ul className="timeline-list max-h-96 overflow-y-auto thin-scroll">
            {activities.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
