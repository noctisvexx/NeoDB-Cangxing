import { NextRequest, NextResponse } from "next/server";
import { loadSettings } from "@/lib/local-settings";

export const runtime = "nodejs";

function normalizeWebdavUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/\.[a-z0-9]{1,5}$/i.test(trimmed)) return trimmed;
  const withSlash = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return `${withSlash}cangxing/shibei-backup.txt`;
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
  const url = normalizeWebdavUrl(settings.webdavUrl ?? "");
  if (!url) {
    return NextResponse.json(
      { error: "未配置 WebDAV 地址" },
      { status: 400 },
    );
  }
  try {
    const res = await fetch(url, {
      headers: authHeaders(settings),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return NextResponse.json(
        {
          error: `WebDAV 下载失败：${res.status}${
            detail ? `：${detail}` : ""
          }`,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ blob: await res.text() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "WebDAV 请求失败" },
      { status: 502 },
    );
  }
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
