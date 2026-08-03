import { NextResponse } from "next/server";
import { neoDbToken } from "@/lib/config";
import { fetchAllShelfMarks, getMe } from "@/lib/neodb";

export const runtime = "nodejs";

export async function GET() {
  if (!(await neoDbToken())) {
    return NextResponse.json(
      { error: "尚未连接 NeoDB，无法导出。请先在「我的」页面完成 NeoDB 授权。" },
      { status: 401 },
    );
  }
  const [shelfResult, user] = await Promise.all([
    fetchAllShelfMarks(),
    getMe().catch(() => null),
  ]);
  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    app: "藏星 CANGXING",
    source: "NeoDB",
    user: user
      ? {
          username: user.username,
          display_name: user.display_name,
        }
      : null,
    count: shelfResult.marks.length,
    errors: shelfResult.errors.slice(0, 10),
    marks: shelfResult.marks,
  });
}
