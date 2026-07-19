import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { UserRepository } from "@/repositories/user.repository";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "Không tìm thấy tệp tải lên" }, { status: 400 });
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Tệp ảnh phải nhỏ hơn 2MB" }, { status: 400 });
    }

    // Validate mime type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Tệp tải lên không phải là hình ảnh" }, { status: 400 });
    }

    // 1. Ensure 'avatars' bucket exists in Supabase Storage
    try {
      await supabaseAdmin.storage.createBucket("avatars", {
        public: true,
      });
    } catch (bucketErr) {
      // Ignore if it already exists
    }

    // 2. Generate a unique name for the file
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${user.id}-${Date.now()}.${ext}`;

    // 3. Upload file buffer to storage
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // 4. Get the public URL of the uploaded avatar
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      image: publicUrl,
    });
  } catch (err) {
    console.error("Avatar upload API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải ảnh lên" },
      { status: 500 }
    );
  }
}
