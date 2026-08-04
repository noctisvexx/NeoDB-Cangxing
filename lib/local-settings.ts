// 应用内设置（TMDB Key、NeoDB 客户端凭据）保存在本地 data/ 目录，不入 git
import { promises as fs } from "node:fs";
import path from "node:path";

export interface LocalSettings {
  tmdbApiKey?: string;
  omdbApiKey?: string;
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
  wereadApiKey?: string;
  sectionOrder?: string[];
  neoDbClientId?: string;
  neoDbClientSecret?: string;
}

let cached: LocalSettings | null | undefined;

function settingsFilePath(): string {
  const root = process.env.CANGXING_DATA_DIR || process.cwd();
  return path.join(root, "data", "settings.json");
}

export async function loadSettings(): Promise<LocalSettings> {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(settingsFilePath(), "utf8");
    cached = JSON.parse(raw) as LocalSettings;
  } catch {
    // 读取 / 解析失败时返回空配置但不缓存，避免把一次损坏长期固化为"所有配置丢失"
    return {};
  }
  return cached ?? {};
}

export async function saveSettings(
  patch: Partial<LocalSettings>,
): Promise<LocalSettings> {
  const current = await loadSettings();
  const next: LocalSettings = {};
  for (const key of [
    "tmdbApiKey",
    "omdbApiKey",
    "aiApiKey",
    "aiBaseUrl",
    "aiModel",
    "wereadApiKey",
    "neoDbClientId",
    "neoDbClientSecret",
  ] as const) {
    const value = patch[key];
    next[key] = typeof value === "string" ? value.trim() : current[key];
  }
  next.sectionOrder = Array.isArray(patch.sectionOrder)
    ? patch.sectionOrder.map(String).filter(Boolean)
    : current.sectionOrder;
  const file = settingsFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(next, null, 2), "utf8");
  cached = next;
  return next;
}
