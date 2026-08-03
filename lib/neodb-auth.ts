// 本地保存的 NeoDB OAuth 令牌（只写在项目 data/ 目录，不入 git）
import { promises as fs } from "node:fs";
import path from "node:path";

export interface NeoDBAuthFile {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  obtained_at?: string;
}

let cached: NeoDBAuthFile | null | undefined;

function tokenFilePath(): string {
  const root = process.env.CANGXING_DATA_DIR || process.cwd();
  return path.join(root, "data", "neodb-auth.json");
}

export async function loadAuthFile(): Promise<NeoDBAuthFile | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await fs.readFile(tokenFilePath(), "utf8");
    const data = JSON.parse(raw) as NeoDBAuthFile;
    cached =
      data && typeof data.access_token === "string" && data.access_token
        ? data
        : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function saveAuthFile(data: NeoDBAuthFile): Promise<void> {
  const file = tokenFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    JSON.stringify(
      { ...data, obtained_at: new Date().toISOString() },
      null,
      2,
    ),
    "utf8",
  );
  cached = data;
}
