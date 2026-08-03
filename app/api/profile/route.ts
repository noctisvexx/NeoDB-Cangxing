import { NextRequest, NextResponse } from "next/server";
import { loadProfile, saveProfile } from "@/lib/local-profile";

export const runtime = "nodejs";

const MAX_AVATAR_LENGTH = 3_000_000; // 约 2MB base64

export async function GET() {
  return NextResponse.json(await loadProfile());
}

export async function POST(req: NextRequest) {
  let body: { nickname?: string; avatar?: string } = {};
  try {
    body = await req.json();
  } catch {
    // 忽略
  }
  const avatar =
    typeof body.avatar === "string" && body.avatar !== ""
      ? body.avatar
      : undefined;
  if (avatar && avatar.length > MAX_AVATAR_LENGTH) {
    return NextResponse.json(
      { error: "头像图片太大，请换一张小一点的（建议 512×512 以内）" },
      { status: 400 },
    );
  }
  const profile = await saveProfile({
    nickname: typeof body.nickname === "string" ? body.nickname : undefined,
    avatar: typeof body.avatar === "string" ? body.avatar : undefined,
  });
  return NextResponse.json(profile);
}
