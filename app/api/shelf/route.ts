import { NextRequest, NextResponse } from "next/server";
import { neoDbToken } from "@/lib/config";
import { deleteMark, markItem } from "@/lib/neodb";
import type { ShelfType } from "@/lib/types";

export const runtime = "nodejs";

const SHELF_TYPES: ShelfType[] = ["wishlist", "progress", "complete", "dropped"];

function unauthorized() {
  return NextResponse.json(
    {
      error:
        "尚未配置 NeoDB 访问令牌，请在 .env.local 中设置 NEO_DB_ACCESS_TOKEN",
    },
    { status: 401 },
  );
}

export async function POST(req: NextRequest) {
  if (!(await neoDbToken())) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const { itemUuid, shelfType, ratingGrade, commentText } = body as {
    itemUuid?: string;
    shelfType?: string;
    ratingGrade?: unknown;
    commentText?: string;
  };

  if (!itemUuid || typeof itemUuid !== "string") {
    return NextResponse.json({ error: "缺少 itemUuid" }, { status: 400 });
  }
  if (!shelfType || !SHELF_TYPES.includes(shelfType as ShelfType)) {
    return NextResponse.json({ error: "无效的 shelfType" }, { status: 400 });
  }

  const grade =
    typeof ratingGrade === "number" && ratingGrade >= 1 && ratingGrade <= 10
      ? Math.round(ratingGrade)
      : undefined;

  try {
    const result = await markItem(itemUuid, {
      shelf_type: shelfType as ShelfType,
      rating_grade: grade,
      comment_text:
        typeof commentText === "string" && commentText.trim()
          ? commentText.trim()
          : undefined,
    });
    return NextResponse.json({ ok: result.ok ?? true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "同步失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await neoDbToken())) return unauthorized();

  const itemUuid = req.nextUrl.searchParams.get("itemUuid");
  if (!itemUuid) {
    return NextResponse.json({ error: "缺少 itemUuid" }, { status: 400 });
  }

  try {
    const result = await deleteMark(itemUuid);
    return NextResponse.json({ ok: result.ok ?? true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "移除失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
