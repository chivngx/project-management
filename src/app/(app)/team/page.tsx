"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Crown, User as UserIcon, UserPlus } from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  MemberCard,
  MemberCardSkeleton,
  type TeamMember,
} from "@/components/app/team/member-card";
import { InviteMemberDialog } from "@/components/app/team/invite-member-dialog";

type TeamResponse = TeamMember[];

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card className="gap-0 py-4 px-4 flex-row items-center gap-3">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg shrink-0",
          accent
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-semibold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </Card>
  );
}

function EmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <Card className="py-12 px-6 flex flex-col items-center justify-center text-center gap-3 border-dashed">
      <span className="flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
        <Users className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="font-medium text-sm">Chưa có thành viên nào</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Mời thành viên đã đăng ký tài khoản để cùng làm việc trong workspace
          này.
        </p>
      </div>
      <Button onClick={onInvite}>
        <UserPlus className="size-4" />
        Mời thành viên
      </Button>
    </Card>
  );
}

export default function TeamPage() {
  const [query, setQuery] = React.useState("");
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const { data, isLoading, isError, error } = useQuery<TeamResponse>({
    queryKey: ["team"],
    queryFn: () => apiFetch<TeamResponse>("/api/team"),
  });

  const members = React.useMemo(() => data ?? [], [data]);

  const stats = React.useMemo(() => {
    const ownersAdmins = members.filter(
      (m) => m.role === "OWNER" || m.role === "ADMIN"
    ).length;
    const membersCount = members.filter((m) => m.role === "MEMBER").length;
    return {
      total: members.length,
      ownersAdmins,
      members: membersCount,
    };
  }, [members]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = (m.name ?? "").toLowerCase();
      return name.includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [members, query]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Đội nhóm</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý thành viên trong workspace của bạn.
          </p>
        </div>
        <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      </header>

      <section
        aria-label="Thống kê"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <Stat
          icon={Users}
          label="Tổng thành viên"
          value={stats.total}
          accent="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        />
        <Stat
          icon={Crown}
          label="Owner / Admin"
          value={stats.ownersAdmins}
          accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        />
        <Stat
          icon={UserIcon}
          label="Thành viên"
          value={stats.members}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        />
      </section>

      <section aria-label="Danh sách thành viên" className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc email…"
            className="pl-9"
            aria-label="Tìm kiếm thành viên"
          />
        </div>

        {isError ? (
          <Card className="py-10 px-6 text-center text-sm text-muted-foreground">
            Không tải được danh sách thành viên.
            {error instanceof Error ? ` ${error.message}` : ""}
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 max-h-[28rem] overflow-y-auto thin-scroll pr-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <MemberCardSkeleton key={i} />
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState onInvite={() => setInviteOpen(true)} />
        ) : filtered.length === 0 ? (
          <Card className="py-10 px-6 text-center text-sm text-muted-foreground">
            Không tìm thấy thành viên phù hợp với “{query}”.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 max-h-[28rem] overflow-y-auto thin-scroll pr-1">
            {filtered.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
