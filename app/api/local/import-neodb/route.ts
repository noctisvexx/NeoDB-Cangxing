import { NextResponse } from "next/server";
import { neoDbToken } from "@/lib/config";
import { loadMarks, upsertMark } from "@/lib/local-marks";
import { fetchAllShelfMarks } from "@/lib/neodb";
import { pickTitle } from "@/lib/utils";

export const runtime = "nodejs";

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
  const { marks, errors } = await fetchAllShelfMarks();
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
  return NextResponse.json({
    ok: true,
    imported,
    total: marks.length,
    errors: errors.slice(0, 10),
  });
}
