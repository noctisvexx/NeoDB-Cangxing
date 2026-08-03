// 环境变量与应用内设置的集中读取：环境变量优先，其次本地设置文件
import { loadAuthFile } from "./neodb-auth";
import { loadSettings } from "./local-settings";

export function neoDbInstance(): string {
  return (
    process.env.NEO_DB_INSTANCE || "https://neodb.social"
  )
    .trim()
    .replace(/\/+$/, "");
}

/** 优先 OAuth 令牌（read+write），其次环境变量令牌 */
export async function neoDbToken(): Promise<string | null> {
  const file = await loadAuthFile();
  const fileToken = file?.access_token?.trim();
  if (fileToken) return fileToken;
  const envToken = process.env.NEO_DB_ACCESS_TOKEN?.trim();
  return envToken || null;
}

export async function neoDbClientId(): Promise<string | null> {
  const env = process.env.NEO_DB_CLIENT_ID?.trim();
  if (env) return env;
  const settings = await loadSettings();
  return settings.neoDbClientId?.trim() || null;
}

export async function neoDbClientSecret(): Promise<string | null> {
  const env = process.env.NEO_DB_CLIENT_SECRET?.trim();
  if (env) return env;
  const settings = await loadSettings();
  return settings.neoDbClientSecret?.trim() || null;
}

export function neoDbRedirectUri(): string {
  return (
    process.env.NEO_DB_REDIRECT_URI ||
    "http://localhost:3000/api/auth/callback"
  );
}

export async function tmdbApiKey(): Promise<string | null> {
  const env = process.env.TMDB_API_KEY?.trim();
  if (env) return env;
  const settings = await loadSettings();
  return settings.tmdbApiKey?.trim() || null;
}

export async function omdbApiKey(): Promise<string | null> {
  const env = process.env.OMDB_API_KEY?.trim();
  if (env) return env;
  const settings = await loadSettings();
  return settings.omdbApiKey?.trim() || null;
}

export async function aiApiKey(): Promise<string | null> {
  const env = process.env.AI_API_KEY?.trim();
  if (env) return env;
  const settings = await loadSettings();
  return settings.aiApiKey?.trim() || null;
}

export async function aiBaseUrl(): Promise<string> {
  const env = process.env.AI_BASE_URL?.trim();
  if (env) {
    return env
      .replace(/\/chat\/completions$/i, "")
      .replace(/\/+$/, "");
  }
  const settings = await loadSettings();
  return (settings.aiBaseUrl || "https://api.openai.com/v1")
    .trim()
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/+$/, "");
}

export async function aiModel(): Promise<string> {
  const env = process.env.AI_MODEL?.trim();
  if (env) return env;
  const settings = await loadSettings();
  return settings.aiModel || "gpt-4o-mini";
}

export async function wereadApiKey(): Promise<string | null> {
  const env = process.env.WEREAD_API_KEY?.trim();
  if (env) return env;
  const settings = await loadSettings();
  return settings.wereadApiKey?.trim() || null;
}

export async function hasTmdb(): Promise<boolean> {
  return !!(await tmdbApiKey());
}
