"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Github,
  Gitlab,
  GitCommit,
  GitPullRequest,
  RefreshCw,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  CircleDot,
  CheckCircle,
  FileCode,
  Plus,
  ArrowRight,
  ShieldCheck,
  PlayCircle,
  XCircle,
  HelpCircle,
} from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface IntegrationTabProps {
  projectId: string;
}

export function IntegrationTab({ projectId }: IntegrationTabProps) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  
  const [activeProvider, setActiveProvider] = React.useState<"github" | "gitlab">("github");
  const [owner, setOwner] = React.useState("");
  const [repoName, setRepoName] = React.useState("");
  const [token, setToken] = React.useState("");
  const [apiUrl, setApiUrl] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [selectedIssues, setSelectedIssues] = React.useState<string[]>([]);

  const [repoList, setRepoList] = React.useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = React.useState(false);
  const [manualMode, setManualMode] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Multi-repo states
  const [selectedIntegrationId, setSelectedIntegrationId] = React.useState<string>("");
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [autoLoad, setAutoLoad] = React.useState(false);

  // Clear states when provider changes
  React.useEffect(() => {
    setRepoList([]);
    setOwner("");
    setRepoName("");
    setToken("");
    setApiUrl("");
    setWebhookSecret("");
    setManualMode(false);
    setSearchQuery("");
    setIsOpen(false);
  }, [activeProvider]);

  // Handle clicking outside the custom dropdown combobox
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Catch OAuth redirect parameters
  React.useEffect(() => {
    const gitToken = searchParams.get("gitToken");
    const gitProvider = searchParams.get("gitProvider");
    const gitApiUrl = searchParams.get("gitApiUrl");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      toast.error(decodeURIComponent(oauthError));
      // Clean query params
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else if (gitToken && gitProvider) {
      setToken(gitToken);
      setActiveProvider(gitProvider as "github" | "gitlab");
      if (gitApiUrl) setApiUrl(decodeURIComponent(gitApiUrl));
      
      toast.success("OAuth kết nối thành công! Đang tải danh sách repo...");
      setAutoLoad(true);
      
      // Clean token from browser history immediately for security
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [searchParams]);

  // Load repositories from token
  const loadRepos = async () => {
    const currentToken = token || searchParams.get("gitToken");
    if (!currentToken) {
      toast.error("Vui lòng nhập Personal Access Token trước hoặc kết nối qua OAuth!");
      return;
    }
    setLoadingRepos(true);
    try {
      const res = (await apiFetch(`/api/projects/${projectId}/integration/repos`, {
        method: "POST",
        body: JSON.stringify({
          repoProvider: activeProvider,
          repoToken: currentToken,
          repoApiUrl: activeProvider === "gitlab" ? apiUrl : undefined,
        }),
      })) as any;
      if (res.error) {
        throw new Error(res.error);
      }
      setRepoList(res.repos || []);
      toast.success(`Đã tải thành công ${res.repos?.length || 0} repositories!`);
      setManualMode(false);
    } catch (e: any) {
      toast.error(e.message || "Không thể kết nối hoặc tải danh sách repos");
      setManualMode(true);
    } finally {
      setLoadingRepos(false);
    }
  };

  // Trigger autoload when coming from OAuth callback
  React.useEffect(() => {
    if (autoLoad && token) {
      loadRepos();
      setAutoLoad(false);
    }
  }, [autoLoad, token]);

  // Fetch Integration settings & repository info
  const {
    data: integration,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<any>({
    queryKey: ["project-integration", projectId, selectedIntegrationId],
    queryFn: () => {
      const url = selectedIntegrationId 
        ? `/api/projects/${projectId}/integration?integrationId=${selectedIntegrationId}`
        : `/api/projects/${projectId}/integration`;
      return apiFetch(url);
    },
  });

  // Sync active integration selected ID from data
  React.useEffect(() => {
    if (integration?.activeIntegrationId && !selectedIntegrationId) {
      setSelectedIntegrationId(integration.activeIntegrationId);
    }
  }, [integration]);

  // Fetch unlinked issues for importer
  const {
    data: issuesData,
    isLoading: loadingIssues,
    refetch: refetchIssues,
  } = useQuery<any>({
    queryKey: ["project-unlinked-issues", projectId, selectedIntegrationId],
    queryFn: () => {
      const url = selectedIntegrationId
        ? `/api/projects/${projectId}/integration/sync?integrationId=${selectedIntegrationId}`
        : `/api/projects/${projectId}/integration/sync`;
      return apiFetch(url);
    },
    enabled: !!integration?.configured,
  });

  // Save integration config
  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/api/projects/${projectId}/integration`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (res: any) => {
      toast.success("Cấu hình tích hợp thành công!");
      setSelectedIntegrationId(res.integrationId);
      setShowAddForm(false);
      queryClient.invalidateQueries({ queryKey: ["project-integration", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      // Reset form states
      setToken("");
      setWebhookSecret("");
      setSearchQuery("");
      setRepoList([]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Không thể cấu hình tích hợp");
    },
  });

  // Disconnect integration
  const disconnectMutation = useMutation({
    mutationFn: (integrationId: string) =>
      apiFetch(`/api/projects/${projectId}/integration?integrationId=${integrationId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Đã hủy tích hợp repository thành công!");
      setSelectedIntegrationId("");
      queryClient.invalidateQueries({ queryKey: ["project-integration", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Không thể hủy tích hợp");
    },
  });

  // Sync statuses mutation
  const syncMutation = useMutation({
    mutationFn: (data?: any) =>
      apiFetch(`/api/projects/${projectId}/integration/sync`, {
        method: "POST",
        body: JSON.stringify({
          ...(data || {}),
          integrationId: selectedIntegrationId,
        }),
      }),
    onSuccess: (res: any) => {
      toast.success(
        `Đồng bộ hoàn tất: Đã import ${res.importedCount} tasks mới và cập nhật trạng thái ${res.updatedCount} tasks.`
      );
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-unlinked-issues", projectId] });
      setSelectedIssues([]);
    },
    onError: (err: any) => {
      toast.error(err.message || "Đồng bộ hóa thất bại");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[250px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const handleConfigure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner || !repoName || !token) {
      toast.error("Vui lòng điền đầy đủ các thông tin bắt buộc!");
      return;
    }
    saveMutation.mutate({
      repoProvider: activeProvider,
      repoOwner: owner,
      repoName,
      repoToken: token,
      repoApiUrl: activeProvider === "gitlab" ? apiUrl : undefined,
      repoWebhookSecret: webhookSecret || undefined,
    });
  };

  // Render setup view if no repository connected and not currently showing the add form
  if (!integration?.configured || showAddForm) {
    return (
      <Card className="border shadow-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold">Tích hợp GitHub / GitLab</CardTitle>
            {integration?.configured && (
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                Quay lại Dashboard
              </Button>
            )}
          </div>
          <CardDescription>
            Liên kết dự án với các kho lưu trữ mã nguồn để đồng bộ hóa tác vụ, cập nhật trạng thái tự động và xem lịch sử code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Provider selection column */}
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-semibold">Chọn nhà cung cấp Git</Label>
              <button
                type="button"
                onClick={() => setActiveProvider("github")}
                className={`flex items-center gap-3 rounded-lg border p-4 text-left font-medium transition-all ${
                  activeProvider === "github"
                    ? "border-foreground bg-accent/60 shadow-sm"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <Github className="size-6 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">GitHub</p>
                  <p className="text-xs text-muted-foreground">Tích hợp với github.com</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveProvider("gitlab")}
                className={`flex items-center gap-3 rounded-lg border p-4 text-left font-medium transition-all ${
                  activeProvider === "gitlab"
                    ? "border-foreground bg-accent/60 shadow-sm"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <Gitlab className="size-6 text-[#fc6d26] shrink-0" />
                <div>
                  <p className="text-sm font-semibold">GitLab</p>
                  <p className="text-xs text-muted-foreground">Sử dụng gitlab.com hoặc self-hosted</p>
                </div>
              </button>
            </div>

            {/* Input Configuration form column */}
            <div className="md:col-span-2 space-y-6">
              {/* OAuth 2.0 Option */}
              <div className="border-b pb-5 space-y-3">
                <Label className="font-semibold text-sm">Kết nối nhanh bằng OAuth 2.0</Label>
                <p className="text-xs text-muted-foreground">
                  Khuyên dùng. Kết nối tài khoản GitHub/GitLab của bạn mà không cần tạo Personal Access Token thủ công.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      window.location.href = `/api/auth/oauth/github?projectId=${projectId}`;
                    }}
                    className="flex items-center gap-2 hover:bg-zinc-100 hover:text-zinc-900 border-zinc-200 text-xs"
                  >
                    <Github className="size-4" />
                    Kết nối GitHub (OAuth)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const customUrl = prompt("Nhập GitLab API URL (để trống nếu sử dụng gitlab.com):", "") || "";
                      window.location.href = `/api/auth/oauth/gitlab?projectId=${projectId}&apiUrl=${encodeURIComponent(customUrl)}`;
                    }}
                    className="flex items-center gap-2 hover:bg-orange-50 hover:text-[#fc6d26] border-orange-200 text-[#fc6d26] text-xs"
                  >
                    <Gitlab className="size-4" />
                    Kết nối GitLab (OAuth)
                  </Button>
                </div>
              </div>

              {/* Form Fallback to PAT */}
              <form onSubmit={handleConfigure} className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Hoặc sử dụng Personal Access Token
                </p>

                {activeProvider === "gitlab" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="api-url" className="font-semibold">
                      GitLab API URL (Tùy chọn)
                    </Label>
                    <Input
                      id="api-url"
                      placeholder="e.g. https://gitlab.example.com (để trống nếu dùng gitlab.com)"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="pat-token" className="font-semibold">
                    Personal Access Token (PAT) *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="pat-token"
                      type="password"
                      placeholder={
                        activeProvider === "github"
                          ? "Nhập GitHub Token (phạm vi: repo, workflow)"
                          : "Nhập GitLab Personal Access Token (phạm vi: api)"
                      }
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={loadRepos}
                      disabled={loadingRepos}
                      className="shrink-0 flex gap-1 items-center"
                    >
                      <RefreshCw className={cn("size-4", loadingRepos && "animate-spin")} />
                      Tải danh sách
                    </Button>
                  </div>
                </div>

                {/* Repo selection dropdown or manual entry */}
                {repoList.length > 0 && !manualMode ? (
                  <div className="space-y-1.5 relative" ref={containerRef}>
                    <div className="flex justify-between items-center">
                      <Label className="font-semibold">Chọn Repository *</Label>
                      <button
                        type="button"
                        onClick={() => setManualMode(true)}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Nhập thủ công
                      </button>
                    </div>
                    
                    <div className="relative">
                      <Input
                        placeholder="Tìm kiếm và chọn repository của bạn..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setIsOpen(true);
                          if (!e.target.value) {
                            setOwner("");
                            setRepoName("");
                          }
                        }}
                        onFocus={() => setIsOpen(true)}
                        className="pr-10 cursor-pointer"
                      />
                      <div 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none cursor-pointer"
                        onClick={() => setIsOpen(!isOpen)}
                      >
                        {activeProvider === "github" ? (
                          <Github className="size-4 opacity-70" />
                        ) : (
                          <Gitlab className="size-4 text-[#fc6d26] opacity-70" />
                        )}
                      </div>

                      {isOpen && (
                        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md thin-scroll animate-in fade-in-50 slide-in-from-top-1">
                          {repoList.filter(r => 
                            r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            r.description.toLowerCase().includes(searchQuery.toLowerCase())
                          ).length === 0 ? (
                            <div className="px-3 py-2.5 text-xs text-muted-foreground text-center">
                              Không tìm thấy repository nào khớp.
                            </div>
                          ) : (
                            repoList.filter(r => 
                              r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              r.description.toLowerCase().includes(searchQuery.toLowerCase())
                            ).map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  setOwner(r.owner);
                                  setRepoName(r.name);
                                  setSearchQuery(r.fullName);
                                  setIsOpen(false);
                                }}
                                className={cn(
                                  "flex w-full flex-col items-start gap-0.5 rounded px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                  owner === r.owner && repoName === r.name && "bg-accent/40 text-accent-foreground"
                                )}
                              >
                                <span className="font-semibold text-xs leading-none flex items-center gap-1.5">
                                  {activeProvider === "github" ? (
                                    <Github className="size-3 opacity-60" />
                                  ) : (
                                    <Gitlab className="size-3 text-[#fc6d26] opacity-60" />
                                  )}
                                  {r.fullName}
                                </span>
                                {r.description && (
                                  <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                                    {r.description}
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="font-semibold">Thông tin Repository *</Label>
                      {repoList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setManualMode(false)}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          Chọn từ danh sách
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="repo-owner" className="text-xs font-semibold">
                          {activeProvider === "github" ? "GitHub Owner / Org" : "GitLab Owner / Group"}
                        </Label>
                        <Input
                          id="repo-owner"
                          placeholder="e.g. facebook"
                          value={owner}
                          onChange={(e) => setOwner(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="repo-name" className="text-xs font-semibold">
                          Tên Repository
                        </Label>
                        <Input
                          id="repo-name"
                          placeholder="e.g. react"
                          value={repoName}
                          onChange={(e) => setRepoName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="webhook-secret" className="font-semibold">
                    Webhook Secret / Token (Tùy chọn)
                  </Label>
                  <Input
                    id="webhook-secret"
                    placeholder="Nhập secret key để xác thực webhook"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Đang kết nối..." : "Kết nối Repository"}
                  </Button>
                  {integration?.configured && (
                    <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)}>
                      Hủy
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Webhook link generation ---
  const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3000";
  const webhookUrl = `${protocol}//${host}/api/webhooks/${integration.repoProvider}?projectId=${projectId}`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Đã sao chép URL Webhook");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncAll = () => {
    syncMutation.mutate({});
  };

  const handleImportSelectedIssues = () => {
    if (selectedIssues.length === 0) return;
    const issuesDataList = issuesData?.unlinkedIssues || [];
    const selectedData = issuesDataList.filter((issue: any) => selectedIssues.includes(issue.id));
    syncMutation.mutate({ issues: selectedData });
  };

  const handleToggleIssue = (issueId: string) => {
    setSelectedIssues((prev) => (prev.includes(issueId) ? prev.filter((id) => id !== issueId) : [...prev, issueId]));
  };

  // Status check renderer helper
  const renderCiStatus = (status: string) => {
    switch (status) {
      case "success":
        return (
          <span title="CI Checks Passed">
            <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
          </span>
        );
      case "failure":
        return (
          <span title="CI Checks Failed">
            <XCircle className="size-4 text-red-500 shrink-0" />
          </span>
        );
      case "pending":
        return (
          <span title="CI Checks Pending">
            <PlayCircle className="size-4 text-amber-500 shrink-0 animate-pulse" />
          </span>
        );
      default:
        return (
          <span title="No CI Info">
            <HelpCircle className="size-4 text-muted-foreground shrink-0 opacity-60" />
          </span>
        );
    }
  };

  // --- Render Dashboard when configured successfully ---
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left panel: Info, Sync actions, Webhook setup */}
      <div className="space-y-6 lg:col-span-1">
        {/* Repo Switcher and Multi-repo Management card */}
        <Card className="shadow-sm border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Đang kết nối ({integration.integrations?.length || 1} repos)</span>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => setShowAddForm(true)}
                title="Liên kết thêm Repository"
              >
                <Plus className="size-4" />
              </Button>
            </CardTitle>
            <CardDescription className="text-xs">
              Chọn repository hoạt động bên dưới để đồng bộ hoặc hủy kết nối.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1.5 max-h-40 overflow-y-auto thin-scroll pr-1">
              {integration.integrations?.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedIntegrationId(item.id)}
                  className={cn(
                    "flex items-center justify-between rounded-md border p-2 text-xs transition-all cursor-pointer hover:bg-accent/40",
                    selectedIntegrationId === item.id 
                      ? "border-foreground bg-accent/60 font-medium" 
                      : "border-border"
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {item.provider === "github" ? (
                      <Github className="size-3.5 shrink-0" />
                    ) : (
                      <Gitlab className="size-3.5 text-[#fc6d26] shrink-0" />
                    )}
                    <span className="truncate">{item.owner}/{item.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Bạn có chắc chắn muốn hủy kết nối ${item.owner}/${item.name}?`)) {
                        disconnectMutation.mutate(item.id);
                      }
                    }}
                    disabled={disconnectMutation.isPending}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Repo Info card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {integration.repoProvider === "github" ? (
                  <Github className="size-5 shrink-0" />
                ) : (
                  <Gitlab className="size-5 text-[#fc6d26] shrink-0" />
                )}
                <CardTitle className="text-sm font-bold truncate">
                  {integration.repoOwner}/{integration.repoName}
                </CardTitle>
              </div>
              <a
                href={integration.repoInfo?.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
            <CardDescription className="line-clamp-2 text-xs">
              {integration.repoInfo?.description || "Không có mô tả repository."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {integration.error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Lỗi kết nối Git API:</p>
                  <p>{integration.error}</p>
                </div>
              </div>
            )}

            {integration.repoInfo && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md bg-accent/40 p-2 text-center">
                  <p className="text-muted-foreground">Stars</p>
                  <p className="text-lg font-bold">{integration.repoInfo.stars}</p>
                </div>
                <div className="rounded-md bg-accent/40 p-2 text-center">
                  <p className="text-muted-foreground">Forks</p>
                  <p className="text-lg font-bold">{integration.repoInfo.forks}</p>
                </div>
                <div className="rounded-md bg-accent/40 p-2 text-center col-span-2">
                  <p className="text-muted-foreground">Ngôn ngữ chủ yếu / Issues mở</p>
                  <p className="text-sm font-semibold">
                    {integration.repoInfo.language || "N/A"} — {integration.repoInfo.openIssues} Issues
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAll}
                disabled={syncMutation.isPending}
                className="w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className={`size-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                {syncMutation.isPending ? "Đang đồng bộ..." : "Đồng bộ hóa trạng thái"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Configuration instructions */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Thiết lập Webhook cập nhật tự động</CardTitle>
            <CardDescription className="text-xs">
              Sao chép URL bên dưới cấu hình vào GitHub/GitLab để kích hoạt cập nhật trạng thái tasks tự động.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-center rounded-md bg-accent/40 p-2">
              <input
                readOnly
                value={webhookUrl}
                className="bg-transparent border-none text-xs flex-1 outline-none truncate"
              />
              <Button variant="ghost" size="icon-xs" onClick={handleCopyWebhook} className="shrink-0">
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              </Button>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Cách cấu hình:</p>
              {integration.repoProvider === "github" ? (
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Vào Repository settings &gt; Webhooks &gt; Add webhook.</li>
                  <li>Dán URL trên vào mục Payload URL.</li>
                  <li>Chọn Content type là application/json.</li>
                  <li>Điền Secret (nếu đã cấu hình ở bước trước).</li>
                  <li>Chọn Let me select individual events, tick vào Issues và Pull requests.</li>
                  <li>Nhấn Add webhook.</li>
                </ol>
              ) : (
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Vào Project Settings &gt; Webhooks.</li>
                  <li>Dán URL trên vào ô URL.</li>
                  <li>Điền Secret token (nếu đã cấu hình).</li>
                  <li>Tick chọn Trigger: Issues events, Merge request events.</li>
                  <li>Nhấn Add webhook.</li>
                </ol>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right panel: Commits, PRs, Issue Importer */}
      <Card className="lg:col-span-2 shadow-sm">
        <CardContent className="p-0">
          <Tabs defaultValue="commits" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-muted/40 p-0 h-12">
              <TabsTrigger
                value="commits"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 h-full"
              >
                <GitCommit className="size-4 mr-2" />
                Commits
              </TabsTrigger>
              <TabsTrigger
                value="prs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 h-full"
              >
                <GitPullRequest className="size-4 mr-2" />
                Pull Requests / MRs
              </TabsTrigger>
              <TabsTrigger
                value="issues"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 h-full"
              >
                <CircleDot className="size-4 mr-2" />
                Import Issues ({issuesData?.unlinkedIssues?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Commits Panel */}
            <TabsContent value="commits" className="p-4 outline-none m-0">
              <div className="space-y-4 max-h-[35rem] overflow-y-auto thin-scroll pr-1">
                {integration.commits?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Không có commits gần đây.</p>
                ) : (
                  integration.commits?.map((commit: any) => (
                    <div key={commit.sha} className="flex items-start gap-3 border-b pb-3 last:border-b-0 last:pb-0">
                      <div className="rounded-full bg-accent p-2 shrink-0">
                        <FileCode className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">{commit.message}</p>
                        <p className="text-xs text-muted-foreground">
                          bởi <span className="font-semibold">{commit.author}</span> vào{" "}
                          {new Date(commit.date).toLocaleString("vi-VN")}
                        </p>
                      </div>
                      <a
                        href={commit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-muted-foreground hover:text-foreground shrink-0 border rounded px-1.5 py-0.5 bg-accent/40"
                      >
                        {commit.sha.substring(0, 7)}
                      </a>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* PRs / MRs Panel */}
            <TabsContent value="prs" className="p-4 outline-none m-0">
              <div className="space-y-4 max-h-[35rem] overflow-y-auto thin-scroll pr-1">
                {integration.pullRequests?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Không có Pull Requests / Merge Requests đang mở.</p>
                ) : (
                  integration.pullRequests?.map((pr: any) => (
                    <div key={pr.id} className="flex items-center justify-between border-b pb-3 last:border-b-0 last:pb-0">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              pr.state === "open" || pr.state === "opened"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-zinc-100 text-zinc-800"
                            }`}
                          >
                            {pr.state === "open" || pr.state === "opened" ? "Open" : "Closed"}
                          </span>
                          <span className="font-bold text-xs text-muted-foreground">#{pr.number}</span>
                          
                          {/* Render CI check status */}
                          {renderCiStatus(pr.ciStatus)}
                          
                          <p className="text-sm font-semibold text-foreground line-clamp-1 hover:underline">
                            <a href={pr.url} target="_blank" rel="noopener noreferrer">
                              {pr.title}
                            </a>
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          tạo bởi <span className="font-semibold">{pr.author}</span> vào{" "}
                          {new Date(pr.createdAt).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0 pl-2"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Issue Importer Panel */}
            <TabsContent value="issues" className="p-4 outline-none m-0">
              {loadingIssues ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !issuesData?.unlinkedIssues || issuesData.unlinkedIssues.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle className="size-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">Tuyệt vời! Tất cả issues từ repository đều đã được đồng bộ.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <p className="text-xs text-muted-foreground">
                      Chọn các Issue bạn muốn import thành Task trong ProjectFlow. Mặc định các tác vụ được tạo sẽ có trạng thái TODO.
                    </p>
                    {selectedIssues.length > 0 && (
                      <Button
                        size="sm"
                        onClick={handleImportSelectedIssues}
                        disabled={syncMutation.isPending}
                      >
                        Import ({selectedIssues.length})
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[30rem] overflow-y-auto thin-scroll pr-1">
                    {issuesData.unlinkedIssues.map((issue: any) => (
                      <div
                        key={issue.id}
                        className="flex items-start gap-3 border-b pb-3 last:border-b-0 last:pb-0 cursor-pointer"
                        onClick={() => handleToggleIssue(issue.id)}
                      >
                        <Checkbox
                          checked={selectedIssues.includes(issue.id)}
                          onCheckedChange={() => handleToggleIssue(issue.id)}
                          className="mt-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-semibold text-foreground line-clamp-1">{issue.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Số hiệu: #{issue.number} &bull;{" "}
                            <a
                              href={issue.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:underline hover:text-foreground"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Xem trên {integration.repoProvider === "github" ? "GitHub" : "GitLab"}
                            </a>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
