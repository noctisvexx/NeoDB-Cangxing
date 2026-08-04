// 本地档案：昵称与头像（头像以 data URL 内嵌保存，跟随本地加密备份一起导出）
import { promises as fs } from "node:fs";
import path from "node:path";

export interface LocalProfile {
  nickname?: string;
  avatar?: string;
}

let cache: LocalProfile | null | undefined;

function profileFilePath(): string {
  const root = process.env.CANGXING_DATA_DIR || process.cwd();
  return path.join(root, "data", "local-profile.json");
}

export async function loadProfile(): Promise<LocalProfile> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(profileFilePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    cache = {
      nickname:
        typeof parsed.nickname === "string" && parsed.nickname.trim()
          ? parsed.nickname.trim().slice(0, 30)
          : undefined,
      avatar:
        typeof parsed.avatar === "string" && parsed.avatar.startsWith("data:")
          ? parsed.avatar
          : undefined,
    };
  } catch {
    cache = {};
  }
  return cache ?? {};
}

export async function saveProfile(patch: {
  nickname?: string;
  avatar?: string;
}): Promise<LocalProfile> {
  const current = await loadProfile();
  const next: LocalProfile = {
    nickname:
      typeof patch.nickname === "string"
        ? patch.nickname.trim().slice(0, 30) || undefined
        : current.nickname,
    avatar:
      typeof patch.avatar === "string"
        ? patch.avatar.startsWith("data:")
          ? patch.avatar
          : patch.avatar === ""
            ? undefined
            : current.avatar
        : current.avatar,
  };
  const file = profileFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(next, null, 2), "utf8");
  cache = next;
  return next;
}
