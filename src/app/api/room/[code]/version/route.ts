import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY } from "@/lib/keys";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const version = await redis.get(KEY.version(code));
    if (version === null) return NextResponse.json({ error: "방 없음" }, { status: 404 });
    return NextResponse.json({ version });
  } catch (e) {
    console.error("GET /api/room/[code]/version error:", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
