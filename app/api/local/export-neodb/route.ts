import { NextResponse } from "next/server";
import { neoDbToken } from "@/lib/config";
import { loadMarks, upsertMark } from "@/lib/local-marks";
import { markItem, searchCatalog } from "@/lib/neodb";
import { itemTitleMatches } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST() {
  if (!(await neoDbToken())) {
    return NextResponse.json(
      { error: "尚未连接 NeoDB，无法导出。请先在「我的」页面完成 NeoDB 授权。" },
      { status: 401 },
    );
  }
  const marks = await loadMarks();
  let exported = 0;
  let matched = 0;
  const errors: string[] = [];
  for (const mark of marks) {
    let uuid = mark.neodbUuid;
    if (!uuid) {
      try {
        const search = await searchCatalog(
          mark.title.slice(0, 60),
          mark.category && mark.category !== "all" ? mark.category : undefined,
          1,
        );
        const match = (search?.data ?? []).find((it) =>
          itemTitleMatches(it, mark.title),
        );
        if (match) {
          uuid = match.uuid;
          matched++;
          await upsertMark({ ...mark, neodbUuid: uuid });
        }
      } catch (e) {
        errors.push(
          `《${mark.title}》搜索失败：${
            e instanceof Error ? e.message : "未知错误"
          }`,
        );
        continue;
      }
    }
    if (!uuid) {
      errors.push(
        `《${mark.title}》在 NeoDB 未找到对应条目，已跳过（可先在详情页「切换相同条目」确认）`,
      );
      continue;
    }
    try {
      await markItem(uuid, {
        shelf_type: mark.shelf,
        rating_grade: mark.rating,
        comment_text: mark.comment,
      });
      exported++;
    } catch (e) {
      errors.push(
        `《${mark.title}》同步失败：${
          e instanceof Error ? e.message : "未知错误"
        }`,
      );
    }
  }
  return NextResponse.json({
    ok: true,
    exported,
    matched,
    failed: errors.length,
    errors: errors.slice(0, 20),
  });
}
