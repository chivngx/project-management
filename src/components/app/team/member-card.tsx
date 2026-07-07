"use client";

import * as React from "react";
import { format } from "date-fns";
import { Mail, MoreVertical, Crown, Shield, User as UserIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TeamRole = "OWNER" | "ADMIN" | "MEMBER";

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: TeamRole;
  joinedAt: string;
}

const ROLE_BADGE_CLASS: Record<TeamRole, string> = {
  OWNER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ADMIN: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  MEMBER: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const ROLE_LABEL: Record<TeamRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Thành viên",
};

function RoleIcon({ role, className }: { role: TeamRole; className?: string }) {
  if (role === "OWNER") return <Crown className={className} aria-hidden />;
  if (role === "ADMIN") return <Shield className={className} aria-hidden />;
  return <UserIcon className={className} aria-hidden />;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MemberCard({ member }: { member: TeamMember }) {
  const displayName = member.name?.trim() || member.email;

  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <CardHeader className="pb-3 pt-5 px-5 flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar size="lg" className="ring-1 ring-border">
            {member.image ? (
              <AvatarImage src={member.image} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 font-medium">
              {getInitials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate" title={displayName}>
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground truncate" title={member.email}>
              {member.email}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 -mr-1 -mt-1 text-muted-foreground"
              aria-label="Tùy chọn thành viên"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <a
                href={`mailto:${member.email}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Mail className="size-4" aria-hidden />
                Gửi email
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            ROLE_BADGE_CLASS[member.role]
          )}
        >
          <RoleIcon role={member.role} className="size-3" />
          {ROLE_LABEL[member.role]}
        </span>
        <span className="text-xs text-muted-foreground">
          Tham gia {format(new Date(member.joinedAt), "dd/MM/yyyy")}
        </span>
      </CardContent>
    </Card>
  );
}

export function MemberCardSkeleton() {
  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <CardHeader className="pb-3 pt-5 px-5 flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-full bg-muted animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
            <div className="h-3 w-40 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="size-8 rounded-md bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3 flex items-center justify-between gap-2">
        <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
        <div className="h-3 w-24 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}
