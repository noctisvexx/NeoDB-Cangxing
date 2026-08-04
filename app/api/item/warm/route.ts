// 条目详情预热接口：首页悬停卡片时后台调用，
// 提前把该条目的数据加载并写入本地缓存，点击进入时即可秒开
import { NextRequest, NextResponse } from "next/server";
import { loadItemBundle } from "@/lib/item-loader";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const uuid = req.nextUrl.searchParams.get("uuid")?.trim();
  if (!uuid) {
    return NextResponse.json({ error: "缺少 uuid 参数" }, { status: 400 });
  }
  const startedAt = Date.now();
  try {
    // 全量加载并写入各板块缓存（核心/评论/评分/相似），页面会直接读这些缓存
    await loadItemBundle(uuid);
    return NextResponse.json({
      ok: true,
      ms: Date.now() - startedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "预热失败" },
      { status: 502 },
    );
  }
}
