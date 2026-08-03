import { NextResponse } from "next/server";
import { neoDbInstance, neoDbRedirectUri } from "@/lib/config";
import { saveSettings } from "@/lib/local-settings";

export const runtime = "nodejs";

export async function POST() {
  try {
    const res = await fetch(`${neoDbInstance()}/api/v1/apps`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_name: "藏星 Cangxing",
        redirect_uris: neoDbRedirectUri(),
        website: "http://localhost:3000",
      }).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 150);
      return NextResponse.json(
        {
          error: `创建应用失败：${res.status}${
            detail ? `：${detail}` : ""
          }`,
        },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      client_id?: string;
      client_secret?: string;
    };
    if (!data.client_id || !data.client_secret) {
      return NextResponse.json(
        { error: "创建应用返回数据不完整" },
        { status: 502 },
      );
    }
    await saveSettings({
      neoDbClientId: data.client_id,
      neoDbClientSecret: data.client_secret,
    });
    return NextResponse.json({ ok: true, authorizeUrl: "/api/auth/neodb" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "创建应用失败" },
      { status: 502 },
    );
  }
}
