import { NextRequest, NextResponse } from "next/server";
import { loadSettings } from "@/lib/local-settings";

export const runtime = "nodejs";

const BACKUP_FILENAME = "cangxing-backup.txt";
const LEGACY_BACKUP_FILENAME = "shibei-backup.txt";

function hasFileExt(url: string): boolean {
  return /\.[a-z0-9]{1,5}$/i.test(url.trim());
}

function normalizeWebdavUrl(
  url: string,
  filename = BACKUP_FILENAME,
): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  // 旧版备份文件名自动迁移到新文件名（下载时仍有旧文件兜底）
  if (trimmed.endsWith(`/${LEGACY_BACKUP_FILENAME}`)) {
    return `${trimmed.slice(0, -LEGACY_BACKUP_FILENAME.length)}${filename}`;
  }
  if (hasFileExt(trimmed)) return trimmed;
  const withSlash = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return `${withSlash}cangxing/${filename}`;
}

function authHeaders(settings: {
  webdavUser?: string;
  webdavPass?: string;
}): HeadersInit {
  if (settings.webdavUser) {
    const token = Buffer.from(
      `${settings.webdavUser}:${settings.webdavPass ?? ""}`,
    ).toString("base64");
    return { Authorization: `Basic ${token}` };
  }
  return {};
}

export async function GET() {
  const settings = await loadSettings();
  const base = (settings.webdavUrl ?? "").trim();
  if (!base) {
    return NextResponse.json(
      { error: "未配置 WebDAV 地址" },
      { status: 400 },
    );
  }
  const url = normalizeWebdavUrl(base);
  const candidates = [url];
  // 兼容旧版 shibei-backup.txt：目录地址时自动追加旧文件名，完整旧地址时直接尝试
  if (!hasFileExt(base)) {
    candidates.push(normalizeWebdavUrl(base, LEGACY_BACKUP_FILENAME));
  } else if (base.endsWith(`/${LEGACY_BACKUP_FILENAME}`)) {
    candidates.push(base);
  }
  let lastError = "WebDAV 下载失败";
  try {
    for (const candidate of [...new Set(candidates)]) {
      const res = await fetch(candidate, {
        headers: authHeaders(settings),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        return NextResponse.json({ blob: await res.text() });
      }
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      lastError = `WebDAV 下载失败：${res.status}${
        detail ? `：${detail}` : ""
      }`;
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : "WebDAV 请求失败";
  }
  return NextResponse.json({ error: lastError }, { status: 502 });
}

export async function POST(req: NextRequest) {
  let body: { action?: string; blob?: string } = {};
  try {
    body = await req.json();
  } catch {
    // 忽略
  }
  const settings = await loadSettings();
  const url = normalizeWebdavUrl(settings.webdavUrl ?? "");
  if (!url) {
    return NextResponse.json(
      { error: "未配置 WebDAV 地址" },
      { status: 400 },
    );
  }
  if (body.action !== "put" || typeof body.blob !== "string") {
    return NextResponse.json(
      { error: "参数错误" },
      { status: 400 },
    );
  }
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        ...authHeaders(settings),
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: body.blob,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return NextResponse.json(
        {
          error: `WebDAV 上传失败：${res.status}${
            detail ? `：${detail}` : ""
          }（地址会自动补全为文件，请确认 WebDAV 服务支持 PUT 写入）`,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "WebDAV 请求失败" },
      { status: 502 },
    );
  }
}
