import { NextRequest, NextResponse } from "next/server";
import {
  neoDbClientId,
  neoDbClientSecret,
  neoDbInstance,
  neoDbRedirectUri,
} from "@/lib/config";
import { saveAuthFile } from "@/lib/neodb-auth";

export const runtime = "nodejs";

function redirectToMe(req: NextRequest, param: string) {
  return NextResponse.redirect(`${req.nextUrl.origin}/me?${param}`);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  if (error) return redirectToMe(req, `auth_error=${encodeURIComponent(error)}`);
  if (!code) return redirectToMe(req, "auth_error=缺少授权码");

  const clientId = await neoDbClientId();
  const clientSecret = await neoDbClientSecret();
  if (!clientId || !clientSecret) {
    return redirectToMe(req, "auth_error=未配置客户端凭据");
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
    return redirectToMe(req, "auth_error=无法连接 NeoDB");
  }

  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  } | null;

  if (!res.ok || !data?.access_token) {
    return redirectToMe(
      req,
      "auth_error=令牌交换失败，请检查 Client ID / Secret 与 Redirect URI",
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
    return redirectToMe(req, "auth_error=本地保存令牌失败");
  }

  return redirectToMe(req, "connected=1");
}
