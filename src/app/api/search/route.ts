import { NextResponse } from "next/server";
import { SearchService } from "@/services/search.service";
import { getApiContext } from "@/lib/api-context";

/** Global search across projects, tasks, and members in the active workspace.
 *  Query param: ?q=...  (min 2 chars, max 60) */
export async function GET(req: Request) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({ projects: [], tasks: [], members: [] });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ projects: [], tasks: [], members: [] });
  }

  try {
    const results = await SearchService.globalSearch(workspace.id, q);
    return NextResponse.json(results);
  } catch (e: any) {
    console.error("Global search error:", e);
    return NextResponse.json({ error: "Lỗi thực hiện tìm kiếm" }, { status: 500 });
  }
}
