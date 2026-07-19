import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";
import { ProjectRepository } from "@/repositories/project.repository";
import { WorkspaceRepository } from "@/repositories/workspace.repository";
import { ActivityRepository } from "@/repositories/activity.repository";
import crypto from "crypto";

type Params = { params: Promise<{ id: string }> };

const updateMembersSchema = z.object({
  memberIds: z.array(z.string()),
});

export async function PUT(req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;

  // Authorization check: only OWNER/ADMIN of the workspace can manage project members
  if (!canAdmin(membership)) {
    return forbidden("Chỉ quản trị viên mới có quyền quản lý thành viên dự án");
  }

  const project = await ProjectRepository.findById(projectId);
  if (!project || project.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }

  const parsed = updateMembersSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const targetMemberIds = parsed.data.memberIds;

  // 1. Verify all targetMemberIds are members of the workspace
  const workspaceMemberships = await WorkspaceRepository.findMembershipsByWorkspaceId(workspace.id);
  const workspaceMemberIds = new Set(workspaceMemberships.map((m: any) => m.userId));

  const allValid = targetMemberIds.every((id) => workspaceMemberIds.has(id));
  if (!allValid) {
    return NextResponse.json(
      { error: "Một số thành viên chọn không thuộc Workspace này" },
      { status: 400 }
    );
  }

  // 2. Fetch current project members
  const detail = await ProjectRepository.findByIdAndWorkspaceId(projectId, workspace.id);
  const currentMembers = detail?.members || [];
  const currentMemberIds: string[] = currentMembers.map((m: any) => m.userId as string);

  const toAdd = targetMemberIds.filter((id: string) => !currentMemberIds.includes(id));
  const toRemove = currentMemberIds.filter((id: string) => !targetMemberIds.includes(id));

  // 3. Process database inserts & deletes
  if (toRemove.length > 0) {
    await ProjectRepository.deleteProjectMembers(projectId, toRemove);
  }

  if (toAdd.length > 0) {
    const newMembers = toAdd.map((id) => ({
      id: crypto.randomUUID(),
      projectId,
      userId: id,
      role: "MEMBER",
    }));
    await ProjectRepository.createProjectMembers(newMembers);
  }

  // 4. Log Activity
  await ActivityRepository.create({
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    userId: user.id,
    action: "updated_project",
    entityType: "PROJECT",
    entityId: projectId,
    message: `${user.name ?? "Someone"} đã cập nhật danh sách thành viên dự án "${project.name}"`,
  });

  return NextResponse.json({ success: true });
}
