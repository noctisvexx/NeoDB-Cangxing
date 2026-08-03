import { NextResponse } from "next/server";
import { neoDbToken } from "@/lib/config";
import { loadMarks, upsertMark } from "@/lib/local-marks";
import { getShelf } from "@/lib/neodb";
import { itemTitleMatches, pickTitle } from "@/lib/utils";
import type { NeoDBMark, ShelfType } from "@/lib/types";

export const runtime = "nodejs";

const SHELF_TYPES: ShelfType[] = ["wishlist", "progress", "complete", "dropped"];
const MAX_PAGES = 50; // 每个书架最多 50 页 × 100 条

export async function POST() {
  if (!(await neoDbToken())) {
    return NextResponse.json(
      { error: "尚未连接 NeoDB，无法导入。请先在「我的」页面完成 NeoDB 授权。" },
      { status: 401 },
    );
  }
  const seen = new Set<string>(
    (await loadMarks())
      .map((m) => m.neodbUuid)
      .filter((v): v is string => !!v),
  );
  let imported = 0;
  let total = 0;
  const errors: string[] = [];
  for (const shelf of SHELF_TYPES) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      let result: { data: NeoDBMark[]; count: number } | null = null;
      try {
        result = await getShelf(shelf, page, 100);
      } catch (e) {
        errors.push(
          `${shelf} 第 ${page} 页读取失败：${
            e instanceof Error ? e.message : "未知错误"
          }`,
        );
        break;
      }
      const marks = result?.data ?? [];
      total += marks.length;
      for (const m of marks) {
        const uuid = m.item?.uuid;
        if (!uuid || seen.has(uuid)) continue;
        seen.add(uuid);
        await upsertMark({
          id: `neodb-${uuid}`,
          title: pickTitle(m.item) || m.item?.display_title || uuid,
          category: m.item?.category,
          cover: m.item?.cover_image_url,
          year: m.item?.year ?? undefined,
          shelf: m.shelf_type,
          rating: m.rating_grade ?? undefined,
          comment: m.comment_text ?? undefined,
          neodbUuid: uuid,
          created: m.created_time || undefined,
        });
        imported++;
      }
      if ((marks ?? []).length < 100) break;
    }
  }
  return NextResponse.json({
    ok: true,
    imported,
    total,
    errors: errors.slice(0, 10),
  });
}
