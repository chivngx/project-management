"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Search, FolderKanban, ListTodo, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

type Results = {
  projects: { id: string; name: string; status: string; href: string }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    projectName: string;
    href: string;
  }[];
  members: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
  }[];
};

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const { data } = useQuery<Results>({
    queryKey: ["search", query],
    queryFn: () => apiFetch(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
  });

  const trimmed = query.trim();
  const hasResults =
    !!data &&
    (data.projects.length > 0 ||
      data.tasks.length > 0 ||
      data.members.length > 0);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <Popover open={open && trimmed.length >= 2} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm dự án, tác vụ, thành viên…"
            className="pl-9"
            aria-label="Tìm kiếm toàn cục"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {!hasResults ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {trimmed.length < 2
              ? "Nhập ít nhất 2 ký tự để tìm."
              : "Không tìm thấy kết quả."}
          </p>
        ) : (
          <div className="thin-scroll max-h-96 overflow-y-auto">
            {data!.projects.length > 0 && (
              <Section label="Dự án" icon={FolderKanban}>
                {data!.projects.map((p) => (
                  <ResultRow
                    key={p.id}
                    onClick={() => go(p.href)}
                    title={p.name}
                    subtitle={`Trạng thái: ${p.status}`}
                  />
                ))}
              </Section>
            )}
            {data!.tasks.length > 0 && (
              <Section label="Tác vụ" icon={ListTodo}>
                {data!.tasks.map((t) => (
                  <ResultRow
                    key={t.id}
                    onClick={() => go(t.href)}
                    title={t.title}
                    subtitle={t.projectName}
                  />
                ))}
              </Section>
            )}
            {data!.members.length > 0 && (
              <Section label="Thành viên" icon={User}>
                {data!.members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => go("/team")}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/50"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={m.image ?? undefined} alt={m.name} />
                      <AvatarFallback className="text-xs">
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email}
                      </p>
                    </div>
                  </button>
                ))}
              </Section>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Section({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  onClick,
  title,
  subtitle,
}: {
  onClick: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start px-3 py-2 text-left hover:bg-accent/50"
      )}
    >
      <span className="truncate text-sm font-medium">{title}</span>
      {subtitle && (
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      )}
    </button>
  );
}
