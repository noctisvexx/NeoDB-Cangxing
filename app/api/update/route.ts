import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const runtime = "nodejs";

const OWNER = "noctisvexx";
const REPO = "NeoDB-Cangxing";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 小时

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at?: string;
  assets: GitHubAsset[];
}

async function currentVersion(): Promise<string> {
  const env = (process.env.APP_VERSION ?? "").trim();
  if (env) return env;
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "package.json"),
      "utf8",
    );
    const pkg = JSON.parse(raw) as { version?: string };
    if (pkg.version) return pkg.version;
  } catch {
    // 忽略
  }
  return "0.0.0";
}

interface VersionParts {
  nums: number[];
  pre: string[];
}

function splitVersion(v: string): VersionParts {
  const cleaned = String(v).trim().replace(/^v/i, "");
  const [main, ...rest] = cleaned.split(/[-+]/);
  const nums = main
    .split(".")
    .map((p) => parseInt(p, 10))
    .filter((n) => !Number.isNaN(n));
  return { nums, pre: rest };
}

/** a > b 返回 1，a < b 返回 -1，否则 0；预发布版本小于正式版 */
function compareVersion(a: string, b: string): number {
  const va = splitVersion(a);
  const vb = splitVersion(b);
  const len = Math.max(va.nums.length, vb.nums.length);
  for (let i = 0; i < len; i++) {
    const x = va.nums[i] ?? 0;
    const y = vb.nums[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  if (va.pre.length !== vb.pre.length) {
    return va.pre.length === 0 ? 1 : vb.pre.length === 0 ? -1 : 0;
  }
  return 0;
}

async function fetchFromApi(): Promise<GitHubRelease | null> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "cangxing-desktop",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as GitHubRelease;
}

/** GitHub API 不可达时（如国内网络 403），降级解析发布页 HTML */
async function fetchFromWeb(): Promise<GitHubRelease | null> {
  const res = await fetch(
    `https://github.com/${OWNER}/${REPO}/releases/latest`,
    {
      redirect: "follow",
      headers: { "User-Agent": "cangxing-desktop" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!res.ok) return null;
  const html = await res.text();
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch?.[1]?.trim() ?? "";
  // 优先从标题提取版本号：Release 藏星 v1.1.0 · ...
  const titleVersion = title.match(/(v?\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.]+)?)/);
  let tag = titleVersion?.[1] ?? "";
  if (!tag) {
    // 兜底：扫描所有 tag 链接，排除 *name 之类的 JS 占位符
    const candidates = html.matchAll(/\/releases\/tag\/([^"<&?]+)/g);
    for (const m of candidates) {
      const candidate = m[1].trim();
      if (
        candidate &&
        !candidate.includes("*") &&
        /^\d+(\.\d+)+/.test(candidate.replace(/^v/i, ""))
      ) {
        tag = candidate;
        break;
      }
    }
  }
  if (!tag) return null;
  const releaseUrl =
    typeof res.url === "string" &&
    res.url.includes("/releases/tag/") &&
    !res.url.includes("*")
      ? res.url
      : `https://github.com/${OWNER}/${REPO}/releases/tag/${tag}`;
  return {
    tag_name: tag,
    name: title || tag,
    body: "",
    html_url: releaseUrl,
    assets: [],
  };
}

async function fetchLatest(): Promise<GitHubRelease | null> {
  const api = await fetchFromApi().catch(() => null);
  if (api) return api;
  return fetchFromWeb();
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const current = await currentVersion();
  let latest: GitHubRelease | null = null;
  let error: string | null = null;
  try {
    latest = force
      ? await fetchLatest()
      : await cached("update-check", CACHE_TTL, fetchLatest);
  } catch (e) {
    error = e instanceof Error ? e.message : "网络错误";
  }
  if (!latest) {
    return NextResponse.json({
      current,
      updateAvailable: false,
      error: error || "检查更新失败（网络或 GitHub 暂不可达）",
      checkedAt: Date.now(),
    });
  }
  const latestVersion = String(latest.tag_name || latest.name || "")
    .replace(/^v/i, "")
    .trim();
  const updateAvailable =
    latestVersion !== "" &&
    latestVersion !== current &&
    compareVersion(latestVersion, current) > 0;
  return NextResponse.json({
    current,
    latest: latestVersion,
    updateAvailable,
    release: {
      name: latest.name,
      tag: latest.tag_name,
      notes: latest.body ?? "",
      url: latest.html_url,
      publishedAt: latest.published_at ?? null,
      assets: (latest.assets ?? []).map((a) => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
      })),
    },
    checkedAt: Date.now(),
  });
}
