import { NextRequest, NextResponse } from "next/server";
import { aiApiKey, aiBaseUrl, aiModel } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    type?: string;
    ratings?: { platform?: string; score?: number | null }[];
  } = {};
  try {
    body = await req.json();
  } catch {
    // 忽略
  }
  const aiKey = await aiApiKey();
  if (!aiKey) {
    return NextResponse.json(
      { error: "未配置 AI API Key，请到设置页填写" },
      { status: 400 },
    );
  }

  const title = body.title?.trim() || "该作品";
  const ratings = (body.ratings ?? [])
    .filter((r) => r.score != null)
    .map((r) => `${r.platform ?? "平台"}：${Number(r.score).toFixed(1)}`)
    .join("、");
  const prompt = `你是书影音评分分析助手。作品《${title}》${
    body.type ? `（${body.type}）` : ""
  }${ratings ? `，各平台评分：${ratings}` : ""}。请用 2-3 句话给出简短建议：综合这些评分，值不值得看（玩/读）？哪个平台的评分最值得参考？注意：中文回答，不超过 120 字，不要复述评分。`;

  const [baseUrl, model] = await Promise.all([aiBaseUrl(), aiModel()]);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: 300,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 150);
      return NextResponse.json(
        { error: `AI 接口返回 ${res.status}：${detail}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const verdict = data.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ verdict });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI 请求失败" },
      { status: 502 },
    );
  }
}
