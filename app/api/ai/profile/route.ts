import { NextRequest, NextResponse } from "next/server";
import { aiApiKey, aiBaseUrl, aiModel, neoDbToken } from "@/lib/config";
import { getShelf } from "@/lib/neodb";
import { CATEGORY_META } from "@/lib/categories";
import { pickTitle } from "@/lib/utils";

export const runtime = "nodejs";

function sanitizeText(s: string): string {
  let t = s.replace(/用户/g, "你");
  t = t
    .split(/[。！？!?]/)
    .filter((seg) => !/推荐|建议|尝试|值得一看|可以考虑/.test(seg))
    .join("。");
  return t.trim().replace(/^[。，,]+|[。，,]+$/g, "");
}

function sanitizeProfile(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (Array.isArray(v)) {
      out[k] = v.map((s) => sanitizeText(String(s))).filter(Boolean);
    } else if (typeof v === "string") {
      out[k] = sanitizeText(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function POST(_req: NextRequest) {
  const [token, aiKey] = await Promise.all([neoDbToken(), aiApiKey()]);
  if (!token) {
    return NextResponse.json(
      { error: "请先在「我的」页连接 NeoDB 账号" },
      { status: 401 },
    );
  }
  if (!aiKey) {
    return NextResponse.json(
      { error: "未配置 AI API Key，请到设置页填写" },
      { status: 400 },
    );
  }
  const pages = await Promise.all(
    [1, 2, 3, 4].map((p) =>
      getShelf("complete", p, 24).catch(() => null),
    ),
  );
  const marks = pages
    .flatMap((p) => p?.data ?? [])
    .map(
      (m) =>
        `${pickTitle(m.item)}（${
          CATEGORY_META[m.item.category ?? ""]?.label ?? ""
        }）`,
    )
    .slice(0, 80);
  if (marks.length < 3) {
    return NextResponse.json(
      { error: "已看记录太少，至少需要 3 个才能生成画像" },
      { status: 400 },
    );
  }

  const prompt = `根据用户的 NeoDB 已看记录生成详细用户画像：\n${marks.join("、")}\n\n只返回严格 JSON（不要其他文字）：{"summary":"用 2-3 句话详细总结用户的口味偏好","favoriteTypes":["偏好类型3-6个"],"favoriteGenres":["偏好题材/风格3-6个"],"favoritePeriods":["偏好的年代/时期2-4个"],"habits":["观看/阅读习惯3-5个"],"personality":["从作品偏好推测的性格特点2-4个"],"suggestion":"一句有针对性的推荐建议"}`;

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
        temperature: 0.7,
        max_tokens: 500,
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
    const content = data.choices?.[0]?.message?.content ?? "";
    const cleaned = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    const profile = objMatch ? JSON.parse(objMatch[0]) : {};
    return NextResponse.json({ profile: sanitizeProfile(profile) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI 请求失败" },
      { status: 502 },
    );
  }
}
