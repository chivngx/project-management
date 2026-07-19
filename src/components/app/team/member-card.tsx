"use client";

import * as React from "react";
import { format } from "date-fns";
import { Mail, MoreVertical, Crown, Shield, User as UserIcon, Trash2, UserCog, CalendarDays } from "lucide-react";
import { toast } from "sonner";

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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api-fetch";

export type TeamRole = "OWNER" | "ADMIN" | "MEMBER";

export interface TeamMember {
  id: string;
  name: string | null;
  username?: string;
  email: string;
  image: string | null;
  role: TeamRole;
  joinedAt: string;
}

const ROLE_BADGE_CLASS: Record<TeamRole, string> = {
  OWNER:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ADMIN:  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  MEMBER: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const ROLE_LABEL: Record<TeamRole, string> = {
  OWNER:  "Owner",
  ADMIN:  "Admin",
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

export function MemberCard({
  member,
  currentUserId,
  currentUserRole,
  onChanged,
}: {
  member: TeamMember;
  currentUserId?: string;
  currentUserRole?: TeamRole;
  onChanged?: () => void;
}) {
  const displayName = member.name?.trim() || member.email;
  const isSelf = member.id === currentUserId;
  const isOwner = currentUserRole === "OWNER";
  const isTargetOwner = member.role === "OWNER";
  const canChangeRole = isOwner && !isTargetOwner && !isSelf;
  const canRemove =
    !isTargetOwner &&
    (isSelf || currentUserRole === "OWNER" || currentUserRole === "ADMIN");

  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function changeRole(role: TeamRole) {
    setBusy(true);
    try {
      await apiFetch(`/api/team/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      toast.success(`Đã đổi vai trò thành ${ROLE_LABEL[role]}`);
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể đổi vai trò");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember() {
    setBusy(true);
    try {
      await apiFetch(`/api/team/${member.id}`, { method: "DELETE" });
      toast.success(isSelf ? "Đã rời workspace" : "Đã xóa thành viên");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể xóa thành viên");
    } finally {
      setBusy(false);
      setRemoveOpen(false);
    }
  }

  return (
    <Card className="card-lift group gap-0 py-0 overflow-hidden">
      <CardHeader className="pb-3 pt-5 px-5 flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar with role-colored ring */}
          <div className="relative shrink-0">
            <Avatar
              size="lg"
              className={cn(
                "ring-2",
                member.role === "OWNER"
                  ? "ring-emerald-400/60 dark:ring-emerald-500/40"
                  : member.role === "ADMIN"
                  ? "ring-amber-400/60 dark:ring-amber-500/40"
                  : "ring-border"
              )}
            >
              {member.image ? (
                <AvatarImage src={member.image} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 font-semibold text-sm">
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            {/* Role icon badge */}
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-card",
                ROLE_BADGE_CLASS[member.role]
              )}
              aria-hidden
            >
              <RoleIcon role={member.role} className="size-2.5" />
            </span>
          </div>

          {/* Name / email */}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" title={displayName}>
              {displayName}
              {isSelf && (
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  (bạn)
                </span>
              )}
            </p>
            {member.username && (
              <p className="text-xs text-muted-foreground truncate" title={member.username}>
                @{member.username}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground/75 truncate" title={member.email}>
              {member.email}
            </p>
            <span
              className={cn(
                "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                ROLE_BADGE_CLASS[member.role]
              )}
            >
              <RoleIcon role={member.role} className="size-2.5" />
              {ROLE_LABEL[member.role]}
            </span>
          </div>
        </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 -mr-1 -mt-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Tùy chọn thành viên"
              disabled={busy}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <a
                href={`mailto:${member.email}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Mail className="size-4" aria-hidden />
                Gửi email
              </a>
            </DropdownMenuItem>
            {canChangeRole && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UserCog className="size-3.5" /> Đổi vai trò
                </DropdownMenuLabel>
                {(["ADMIN", "MEMBER"] as TeamRole[]).map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => changeRole(r)}
                    disabled={member.role === r}
                    className="gap-2"
                  >
                    <RoleIcon role={r} className="size-3.5" />
                    {ROLE_LABEL[r]}
                    {member.role === r && (
                      <span className="ml-auto text-xs text-muted-foreground">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {canRemove && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setRemoveOpen(true)}
                  className="text-destructive focus:text-destructive gap-2"
                >
                  <Trash2 className="size-4" />
                  {isSelf ? "Rời workspace" : "Xóa thành viên"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="px-5 pb-4 pt-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          <span>Tham gia {format(new Date(member.joinedAt), "dd/MM/yyyy")}</span>
        </div>
      </CardContent>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isSelf ? "Rời workspace?" : `Xóa ${displayName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSelf
                ? "Bạn sẽ mất quyền truy cập vào workspace này. Hành động không thể hoàn tác."
                : "Thành viên sẽ bị xóa khỏi workspace và không còn truy cập vào các dự án chung."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeMember}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Đang xử lý…" : isSelf ? "Rời workspace" : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
            <div className="h-4 w-16 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
        <div className="size-8 rounded-md bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        <div className="h-3 w-32 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}
