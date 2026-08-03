import { NextRequest, NextResponse } from "next/server";
import {
  neoDbClientId,
  neoDbInstance,
  neoDbRedirectUri,
} from "@/lib/config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = await neoDbClientId();
  if (!clientId) {
    return NextResponse.redirect(
      `${req.nextUrl.origin}/me?auth_error=${encodeURIComponent("未配置 NeoDB Client ID，请先在「设置」页填写 Client ID 与 Client Secret")}`,
    );
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: neoDbRedirectUri(),
    scope: "read write",
  });
  return NextResponse.redirect(
    `${neoDbInstance()}/oauth/authorize?${params.toString()}`,
  );
}
