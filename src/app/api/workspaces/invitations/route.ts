import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { WorkspaceRepository } from "@/repositories/workspace.repository";

export async function GET() {
  const { user } = await getApiContext();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const invitations = await WorkspaceRepository.findPendingInvitationsByUserId(user.id);
    return NextResponse.json(invitations);
  } catch (e) {
    console.error("GET workspace invitations error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
