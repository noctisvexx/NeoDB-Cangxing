import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** 轻量健康检查：Electron 用它判断内置服务是否就绪，避免等待首页数据加载 */
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
