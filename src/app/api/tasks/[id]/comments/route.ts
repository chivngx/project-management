import { NextResponse } from "next/server";
import { z } from "zod";
import { CommentService } from "@/services/comment.service";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

/** List comments for a task (scoped to the active workspace). */
export async function GET(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  try {
    const comments = await CommentService.listComments(id, workspace.id);
    return NextResponse.json(
      comments.map((c: any) => ({
        id: c.id,
        taskId: c.taskId,
        body: c.body,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        user: {
          id: c.user?.id,
          name: c.user?.name,
          email: c.user?.email,
          image: c.user?.image,
        },
      }))
    );
  } catch (e: any) {
    if (e.message === "TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
    }
    console.error("List comments error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}

const createSchema = z.object({
  body: z.string().min(1, "Nội dung bình luận là bắt buộc").max(2000),
});

/** Create a comment on a task. */
export async function POST(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );

  try {
    const comment = await CommentService.createComment(
      id,
      workspace.id,
      { id: user.id, name: user.name },
      parsed.data.body
    );

    return NextResponse.json({
      id: comment.id,
      taskId: comment.taskId,
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.user?.id,
        name: comment.user?.name,
        email: comment.user?.email,
        image: comment.user?.image,
      },
    });
  } catch (e: any) {
    if (e.message === "TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
    }
    console.error("Create comment error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
