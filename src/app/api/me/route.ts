import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";

export async function GET() {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
}
