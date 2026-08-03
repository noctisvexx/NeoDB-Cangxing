import { NextRequest, NextResponse } from "next/server";
import {
  loadMarks,
  removeMark,
  replaceMarks,
  upsertMark,
} from "@/lib/local-marks";
import type { ShelfType } from "@/lib/types";

export const runtime = "nodejs";

const SHELF_TYPES: ShelfType[] = ["wishlist", "progress", "complete", "dropped"];

export async function GET() {
  const marks = await loadMarks();
  marks.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  return NextResponse.json({ marks });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // 忽略
  }
  // 批量导入：从备份恢复或本地↔NeoDB 桥接
  if (body.action === "import" && Array.isArray(body.marks)) {
    const marks = await replaceMarks(body.marks as Parameters<typeof replaceMarks>[0]);
    marks.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
    return NextResponse.json({ marks, ok: true });
  }
  const shelf = body.shelf as ShelfType;
  if (!SHELF_TYPES.includes(shelf)) {
    return NextResponse.json({ error: "无效的 shelf 类型" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title : "";
  if (!title.trim()) {
    return NextResponse.json({ error: "缺少标题" }, { status: 400 });
  }
  const rating =
    typeof body.rating === "number" && body.rating >= 1 && body.rating <= 10
      ? Math.round(body.rating)
      : undefined;
  const marks = await upsertMark({
    id: typeof body.id === "string" ? body.id : undefined,
    title,
    category:
      typeof body.category === "string" ? body.category : undefined,
    cover: typeof body.cover === "string" ? body.cover : undefined,
    year: typeof body.year === "number" ? body.year : undefined,
    shelf,
    rating,
    comment: typeof body.comment === "string" ? body.comment : undefined,
    neodbUuid:
      typeof body.neodbUuid === "string" ? body.neodbUuid : undefined,
    sourceUrl:
      typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
  });
  marks.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  return NextResponse.json({ marks, ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }
  const marks = await removeMark(id);
  marks.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  return NextResponse.json({ marks, ok: true });
}
