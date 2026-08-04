import { NextRequest, NextResponse } from "next/server";
import {
  neoDbClientId,
  neoDbClientSecret,
  neoDbInstance,
  neoDbRedirectUri,
} from "@/lib/config";
import { saveAuthFile } from "@/lib/neodb-auth";

export const runtime = "nodejs";

const PAGE_HTML = (title: string, message: string, ok: boolean) => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      --bg: #faf7f0;
      --text: #3b3328;
      --muted: #6b5d45;
      --accent: #d6a84f;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --text: #f1ede3;
        --muted: #c9c2b0;
        --accent: #e3b968;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg);
      color: var(--text);
      font-family: "MiSans", system-ui, -apple-system, "Segoe UI",
        "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    .card {
      max-width: 420px;
      margin: 24px;
      padding: 36px 32px;
      border-radius: 20px;
      border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      text-align: center;
    }
    .star {
      width: 52px;
      height: 52px;
      margin: 0 auto 16px;
      color: var(--accent);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 22px;
    }
    p {
      margin: 6px 0;
      font-size: 14px;
      line-height: 1.7;
      color: var(--muted);
    }
    .ok { color: var(--accent); font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <svg class="star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c1.2 5.5 4.3 8.8 10 10-5.7 1.2-8.8 4.5-10 10-1.2-5.5-4.3-8.8-10-10 5.7-1.2 8.8-4.5 10-10Z" />
    </svg>
    <h1>${title}</h1>
    <p>${message}</p>
    ${ok ? '<p class="ok">请回到藏星应用窗口，已自动刷新。</p>' : ""}
  </div>
</body>
</html>`;

function renderPage(title: string, message: string, ok: boolean) {
  return new NextResponse(
    PAGE_HTML(title, message, ok),
    {
      status: ok ? 200 : 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    return renderPage("授权未完成", `NeoDB 返回错误：${error}`, false);
  }
  if (!code) {
    return renderPage("授权未完成", "缺少授权码，请重新在藏星里发起连接。", false);
  }

  const clientId = await neoDbClientId();
  const clientSecret = await neoDbClientSecret();
  if (!clientId || !clientSecret) {
    return renderPage(
      "授权失败",
      "未配置 NeoDB 客户端凭据，请到藏星设置页检查。",
      false,
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: neoDbRedirectUri(),
    grant_type: "authorization_code",
  });

  let res: Response;
  try {
    res = await fetch(`${neoDbInstance()}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });
  } catch {
    return renderPage("授权失败", "无法连接 NeoDB 服务器，请检查网络后重试。", false);
  }

  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  } | null;

  if (!res.ok || !data?.access_token) {
    return renderPage(
      "授权失败",
      "令牌交换失败，请检查应用凭据与 Redirect URI 后重试。",
      false,
    );
  }

  try {
    await saveAuthFile({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      scope: data.scope,
    });
  } catch {
    return renderPage("授权失败", "本地保存令牌失败，请稍后重试。", false);
  }

  return renderPage("NeoDB 授权成功", "令牌已保存到藏星。", true);
}
