import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";

// Self-contained .env loader
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("#") || !trimmedLine) continue;
      const match = trimmedLine.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  }
}

async function seed() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Lỗi: Vui lòng cấu hình NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong file .env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log("Đang xóa dữ liệu cũ...");
  await supabase.from("Activity").delete().neq("id", "");
  await supabase.from("Notification").delete().neq("id", "");
  await supabase.from("Comment").delete().neq("id", "");
  await supabase.from("Task").delete().neq("id", "");
  await supabase.from("ProjectMember").delete().neq("id", "");
  await supabase.from("GitIntegration").delete().neq("id", "");
  await supabase.from("Project").delete().neq("id", "");
  await supabase.from("WorkspaceMember").delete().neq("id", "");
  await supabase.from("Workspace").delete().neq("id", "");
  await supabase.from("User").delete().neq("id", "");

  console.log("Đang tạo người dùng mẫu...");
  const adminId = "u_admin_123";
  const janeId = "u_jane_123";
  const passwordHash = await bcrypt.hash("Password123", 12);

  const { error: userErr } = await supabase.from("User").insert([
    {
      id: adminId,
      name: "Admin User",
      email: "admin@example.com",
      passwordHash,
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
      tokenVersion: 0,
    },
    {
      id: janeId,
      name: "Jane Smith",
      email: "jane@example.com",
      passwordHash,
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      tokenVersion: 0,
    },
  ]);
  if (userErr) throw userErr;

  console.log("Đang tạo workspace...");
  const wsId = "w_dev_workspace_123";
  const { error: wsErr } = await supabase.from("Workspace").insert({
    id: wsId,
    name: "Dev Workspace",
    ownerId: adminId,
  });
  if (wsErr) throw wsErr;

  const { error: memberErr } = await supabase.from("WorkspaceMember").insert([
    {
      id: "wm_admin_123",
      workspaceId: wsId,
      userId: adminId,
      role: "OWNER",
    },
    {
      id: "wm_jane_123",
      workspaceId: wsId,
      userId: janeId,
      role: "MEMBER",
    },
  ]);
  if (memberErr) throw memberErr;

  console.log("Đang tạo dự án...");
  const proj1Id = "p_website_123";
  const proj2Id = "p_mobile_123";

  const { error: projErr } = await supabase.from("Project").insert([
    {
      id: proj1Id,
      workspaceId: wsId,
      name: "Website Redesign",
      description: "Làm mới toàn bộ giao diện website và tối ưu SEO.",
      status: "ACTIVE",
      priority: "HIGH",
      startDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
    {
      id: proj2Id,
      workspaceId: wsId,
      name: "Mobile App Development",
      description: "Xây dựng ứng dụng di động ProjectFlow trên iOS và Android.",
      status: "ACTIVE",
      priority: "MEDIUM",
      startDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(),
    },
  ]);
  if (projErr) throw projErr;

  const { error: pmErr } = await supabase.from("ProjectMember").insert([
    {
      id: "pm_p1_admin",
      projectId: proj1Id,
      userId: adminId,
      role: "MEMBER",
    },
    {
      id: "pm_p1_jane",
      projectId: proj1Id,
      userId: janeId,
      role: "MEMBER",
    },
    {
      id: "pm_p2_admin",
      projectId: proj2Id,
      userId: adminId,
      role: "MEMBER",
    },
  ]);
  if (pmErr) throw pmErr;

  console.log("Đang tạo tác vụ...");
  const task1Id = "t_task_1";
  const task2Id = "t_task_2";
  const task3Id = "t_task_3";

  const { error: taskErr } = await supabase.from("Task").insert([
    {
      id: task1Id,
      projectId: proj1Id,
      title: "Thiết kế Figma cho Landing Page",
      description: "Xây dựng UI mockup đầy đủ cho phiên bản Desktop & Mobile.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: janeId,
      creatorId: adminId,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
    {
      id: task2Id,
      projectId: proj1Id,
      title: "Viết API Authentication",
      description: "Cấu hình NextAuth, băm mật khẩu và quản lý JWT session.",
      status: "TODO",
      priority: "HIGH",
      assigneeId: adminId,
      creatorId: adminId,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
    },
    {
      id: task3Id,
      projectId: proj2Id,
      title: "Đăng ký Apple Developer Account",
      description: "Chuẩn bị các thủ tục đăng ký tài khoản doanh nghiệp.",
      status: "DONE",
      priority: "MEDIUM",
      assigneeId: adminId,
      creatorId: adminId,
    },
  ]);
  if (taskErr) throw taskErr;

  console.log("Đang tạo các hoạt động và bình luận mẫu...");
  await supabase.from("Comment").insert([
    {
      id: "c_comment_1",
      taskId: task1Id,
      userId: adminId,
      body: "Nhớ bám sát tông màu chủ đạo Blue/Navy đã chốt nhé Jane!",
    },
    {
      id: "c_comment_2",
      taskId: task1Id,
      userId: janeId,
      body: "Vâng ạ, em đang làm bản thảo phác họa trên Figma rồi.",
    },
  ]);

  await supabase.from("Activity").insert([
    {
      id: "a_act_1",
      workspaceId: wsId,
      userId: adminId,
      action: "created_workspace",
      entityType: "WORKSPACE",
      entityId: wsId,
      message: "Admin User đã tạo workspace Dev Workspace",
    },
    {
      id: "a_act_2",
      workspaceId: wsId,
      userId: adminId,
      action: "created_project",
      entityType: "PROJECT",
      entityId: proj1Id,
      message: "Admin User đã tạo dự án Website Redesign",
    },
  ]);

  console.log("Gieo dữ liệu thành công!");
}

seed().catch((err) => {
  console.error("Lỗi gieo dữ liệu:", err);
  process.exit(1);
});
