import { NextRequest, NextResponse } from "next/server";
import { aiApiKey, aiBaseUrl, aiModel, neoDbToken } from "@/lib/config";
import { getShelf } from "@/lib/neodb";
import { searchCatalog } from "@/lib/neodb";
import { CATEGORY_META } from "@/lib/categories";
import {
  itemTitleMatches,
  normalizeTitle,
  pickTitle,
  titlesMatch,
} from "@/lib/utils";

export const runtime = "nodejs";

async function fetchAllShelfType(
  type: "complete" | "wishlist" | "progress",
) {
  const pages = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      getShelf(type, i + 1, 50).catch(() => null),
    ),
  );
  return pages.flatMap((p) => p?.data ?? []);
}

export async function POST(req: NextRequest) {
  let body: { types?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // 忽略
  }
  const validTypes = ["电影", "剧集", "动漫", "书籍", "游戏", "播客"];
  const types = (body.types ?? []).filter((t) => validTypes.includes(t));
  const catByType: Record<string, string> = {
    电影: "movie",
    剧集: "tv",
    动漫: "tv",
    书籍: "book",
    游戏: "game",
    播客: "podcast",
  };
  const selectedCats = new Set(
    types.map((t) => catByType[t]).filter(Boolean),
  );

  const [token, aiKey] = await Promise.all([neoDbToken(), aiApiKey()]);
  if (!token) {
    return NextResponse.json(
      { error: "请先在「我的」页连接 NeoDB 账号" },
      { status: 401 },
    );
  }
  if (!aiKey) {
    return NextResponse.json(
      { error: "未配置 AI API Key，请到「设置」页填写" },
      { status: 400 },
    );
  }

  const [completeAll, wishlistAll, progressAll] = await Promise.all([
    fetchAllShelfType("complete"),
    fetchAllShelfType("wishlist"),
    fetchAllShelfType("progress"),
  ]);
  const watchedUuids = new Set<string>();
  const watchedTitleAll: string[] = [];
  const seen = new Set<string>();
  const marks: string[] = [];
  for (const m of [...completeAll, ...wishlistAll, ...progressAll]) {
    watchedUuids.add(m.item.uuid);
    // 收集所有标题变体（中文/英文/原名），用于排除已看过
    const variants = [
      m.item.display_title,
      m.item.title,
      m.item.orig_title,
      pickTitle(m.item),
    ].filter(Boolean) as string[];
    for (const v of variants) {
      const n = normalizeTitle(v.split("（")[0]);
      if (n && !watchedTitleAll.includes(n)) {
        watchedTitleAll.push(n);
      }
    }
    // 只按勾选的类别推荐：只看该类别的已标记作品
    if (selectedCats.size > 0 && !selectedCats.has(m.item.category ?? "")) {
      continue;
    }
    const title = pickTitle(m.item);
    if (seen.has(title)) continue;
    seen.add(title);
    const cat =
      CATEGORY_META[m.item.category ?? ""]?.label ?? m.item.category ?? "";
    marks.push(cat ? `${title}（${cat}）` : title);
    if (marks.length >= 60) break;
  }
  if (marks.length < 3) {
    return NextResponse.json(
      {
        error: `已标记的作品只有 ${marks.length} 个，至少需要 3 个才能给出靠谱的推荐`,
      },
      { status: 400 },
    );
  }

  const typeHint =
    types.length > 0
      ? `\n请只推荐以下类型：${types.join("、")}。`
      : "";
  const prompt = `你是书影音推荐助手。以下是用户已经在 NeoDB 标记过的作品（这些是用户看过的，绝对不要推荐它们或它们的续作/番外）：\n${marks.join("、")}\n\n请根据这些偏好，推荐 5 部用户很可能喜欢的作品（电影/剧集/动漫/书籍/游戏皆可，必须排除上面所有已标记作品）。${typeHint}请只返回严格 JSON 数组，格式：[{"title":"作品名","type":"电影","reason":"中文推荐理由，结合用户已有记录说明为什么适合他"}]`;

  try {
    const [baseUrl, model] = await Promise.all([aiBaseUrl(), aiModel()]);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      if (res.status === 401) {
        return NextResponse.json(
          {
            error: `AI Key 无效（401）：当前请求的是 ${baseUrl}。${detail ? `接口返回：${detail}` : ""} 请到设置页确认 Key 与服务商匹配`,
          },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: `AI 接口返回 ${res.status}（请求地址：${baseUrl}）：${detail}` },
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
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(arrayMatch ? arrayMatch[0] : cleaned) as {
      title?: string;
      type?: string;
      reason?: string;
    }[];
    if (!Array.isArray(parsed)) throw new Error("AI 返回格式不正确");
    const items: {
      title: string;
      type?: string;
      reason?: string;
      uuid?: string;
      cover?: string | null;
    }[] = [];
    for (const it of parsed) {
      const title = String(it.title ?? "").trim();
      if (!title) continue;
      // 排除已看过的作品
      const nt = normalizeTitle(title);
      if (watchedTitleAll.some((w) => titlesMatch(nt, w))) continue;
      const entry: {
        title: string;
        type?: string;
        reason?: string;
        uuid?: string;
        cover?: string | null;
      } = {
        title,
        type: String(it.type ?? ""),
        reason: String(it.reason ?? ""),
      };
      const cat = catByType[String(it.type ?? "")];
      if (cat) {
        const search = await searchCatalog(title.slice(0, 60), cat, 1).catch(
          () => null,
        );
        const match = (search?.data ?? []).find(
          (c) => itemTitleMatches(c, title),
        );
        if (match) {
          if (watchedUuids.has(match.uuid)) continue;
          entry.uuid = match.uuid;
          entry.cover = match.cover_image_url ?? null;
        }
      }
      items.push(entry);
      if (items.length >= 5) break;
    }
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI 请求失败" },
      { status: 502 },
    );
  }
}
