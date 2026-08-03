import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { baseUrl?: string; apiKey?: string } = {};
  try {
    body = await req.json();
  } catch {
    // 忽略
  }
  const base = (body.baseUrl ?? "").trim().replace(/\/+$/, "");
  const key = (body.apiKey ?? "").trim();
  if (!base || !key) {
    return NextResponse.json(
      { error: "缺少 Base URL 或 API Key" },
      { status: 400 },
    );
  }
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return NextResponse.json(
        { error: `模型接口返回 ${res.status}：${detail}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { data?: { id?: string }[] };
    const models = (data.data ?? [])
      .map((m) => m.id)
      .filter(
        (id): id is string =>
          !!id && !/^(whisper|tts|text-embedding|image|moderation|dall-e)/i.test(id),
      );
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "请求失败" },
      { status: 502 },
    );
  }
}
