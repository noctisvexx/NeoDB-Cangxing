import { NextRequest, NextResponse } from "next/server";
import { clearCache } from "@/lib/cache";
import { neoDbInstance } from "@/lib/config";
import { loadAuthFile } from "@/lib/neodb-auth";
import { loadSettings, saveSettings } from "@/lib/local-settings";

export const runtime = "nodejs";

export async function GET() {
  const [settings, auth] = await Promise.all([loadSettings(), loadAuthFile()]);
  return NextResponse.json({
    // 返回实际值，方便设置页回填修改（本地个人工具，可接受）
    tmdbApiKey: settings.tmdbApiKey ?? "",
    omdbApiKey: settings.omdbApiKey ?? "",
    aiApiKey: settings.aiApiKey ?? "",
    wereadApiKey: settings.wereadApiKey ?? "",
    webdavUrl: settings.webdavUrl ?? "",
    webdavUser: settings.webdavUser ?? "",
    webdavPass: settings.webdavPass ?? "",
    neoDbClientId: settings.neoDbClientId ?? "",
    neoDbClientSecret: settings.neoDbClientSecret ?? "",
    tmdbConfigured: !!settings.tmdbApiKey,
    omdbConfigured: !!settings.omdbApiKey,
    aiConfigured: !!settings.aiApiKey,
    aiBaseUrl: settings.aiBaseUrl || "https://api.openai.com/v1",
    aiModel: settings.aiModel || "gpt-4o-mini",
    wereadConfigured: !!settings.wereadApiKey,
    sectionOrder: settings.sectionOrder ?? null,
    titleOverrides: settings.titleOverrides ?? {},
    neoDbClientConfigured:
      !!settings.neoDbClientId && !!settings.neoDbClientSecret,
    neoDbClientIdSet: !!settings.neoDbClientId,
    neoDbClientSecretSet: !!settings.neoDbClientSecret,
    neoDbConnected: !!auth?.access_token,
    instance: neoDbInstance(),
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }
  const {
    tmdbApiKey,
    omdbApiKey,
    aiApiKey,
    aiBaseUrl,
    aiModel,
    wereadApiKey,
    webdavUrl,
    webdavUser,
    webdavPass,
    sectionOrder,
    titleOverrides,
    neoDbClientId,
    neoDbClientSecret,
  } = body as Record<string, unknown>;
  const patch: {
    tmdbApiKey?: string;
    omdbApiKey?: string;
    aiApiKey?: string;
    aiBaseUrl?: string;
    aiModel?: string;
    wereadApiKey?: string;
    webdavUrl?: string;
    webdavUser?: string;
    webdavPass?: string;
    sectionOrder?: string[];
    titleOverrides?: Record<string, string>;
    neoDbClientId?: string;
    neoDbClientSecret?: string;
  } = {};
  if (typeof tmdbApiKey === "string") patch.tmdbApiKey = tmdbApiKey;
  if (typeof omdbApiKey === "string") patch.omdbApiKey = omdbApiKey;
  if (typeof aiApiKey === "string") patch.aiApiKey = aiApiKey;
  if (typeof aiBaseUrl === "string") patch.aiBaseUrl = aiBaseUrl;
  if (typeof aiModel === "string") patch.aiModel = aiModel;
  if (typeof wereadApiKey === "string") patch.wereadApiKey = wereadApiKey;
  if (typeof webdavUrl === "string") patch.webdavUrl = webdavUrl;
  if (typeof webdavUser === "string") patch.webdavUser = webdavUser;
  if (typeof webdavPass === "string") patch.webdavPass = webdavPass;
  if (Array.isArray(sectionOrder)) patch.sectionOrder = sectionOrder;
  if (titleOverrides && typeof titleOverrides === "object" && !Array.isArray(titleOverrides)) {
    patch.titleOverrides = titleOverrides as Record<string, string>;
  }
  if (typeof neoDbClientId === "string") patch.neoDbClientId = neoDbClientId;
  if (typeof neoDbClientSecret === "string")
    patch.neoDbClientSecret = neoDbClientSecret;

  const saved = await saveSettings(patch);
  // 配置变化后让首页缓存立即失效
  clearCache("home-data");
  clearCache("item-");
  // 保存 OMDb Key 时顺手验证一次，避免无效 Key 静默不显示 IMDb 评分
  let omdbValid: boolean | null = null;
  if (typeof omdbApiKey === "string" && omdbApiKey.trim()) {
    const testKey =
      omdbApiKey.trim().match(/apikey=([A-Za-z0-9]+)/)?.[1] ??
      omdbApiKey.trim();
    try {
      const test = await fetch(
        // 用真实经典影片验证，避免示例 Key 只在演示标题下"看起来有效"
        `https://www.omdbapi.com/?apikey=${encodeURIComponent(testKey)}&i=tt0111161`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) },
      );
      if (test.ok) {
        const j = (await test.json()) as { Response?: string };
        omdbValid = j.Response === "True";
      } else {
        omdbValid = false;
      }
    } catch {
      omdbValid = false;
    }
  }
  // TMDB Key 验证
  let tmdbValid: boolean | null = null;
  if (typeof tmdbApiKey === "string" && tmdbApiKey.trim()) {
    const testKey = tmdbApiKey.trim();
    const isJwt = testKey.startsWith("eyJ");
    const headers: HeadersInit = isJwt
      ? { Authorization: `Bearer ${testKey}` }
      : {};
    const qs = isJwt ? "" : `api_key=${encodeURIComponent(testKey)}`;
    try {
      const test = await fetch(
        `https://api.themoviedb.org/3/trending/movie/week?${qs}`,
        { headers, cache: "no-store", signal: AbortSignal.timeout(10000) },
      );
      tmdbValid = test.ok;
    } catch {
      tmdbValid = false;
    }
  }
  // AI Key 验证（调用模型列表接口）
  let aiValid: boolean | null = null;
  if (typeof aiApiKey === "string" && aiApiKey.trim()) {
    const testBase = (
      typeof aiBaseUrl === "string" && aiBaseUrl.trim()
        ? aiBaseUrl.trim()
        : saved.aiBaseUrl || "https://api.openai.com/v1"
    ).replace(/\/+$/, "");
    try {
      const test = await fetch(`${testBase}/models`, {
        headers: { Authorization: `Bearer ${aiApiKey.trim()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      aiValid = test.ok;
    } catch {
      aiValid = false;
    }
  }
  return NextResponse.json({
    ok: true,
    tmdbValid,
    aiValid,
    tmdbConfigured: !!saved.tmdbApiKey,
    omdbConfigured: !!saved.omdbApiKey,
    aiConfigured: !!saved.aiApiKey,
    aiBaseUrl: saved.aiBaseUrl || "https://api.openai.com/v1",
    aiModel: saved.aiModel || "gpt-4o-mini",
    wereadConfigured: !!saved.wereadApiKey,
    sectionOrder: saved.sectionOrder ?? null,
    omdbValid,
    neoDbClientConfigured:
      !!saved.neoDbClientId && !!saved.neoDbClientSecret,
    neoDbClientIdSet: !!saved.neoDbClientId,
    neoDbClientSecretSet: !!saved.neoDbClientSecret,
  });
}
