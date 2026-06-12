import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY } from "@/lib/keys";
import { hashSecret } from "@/lib/crypto";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { participantId, token, slots } = await req.json();

    if (!participantId || !token || !Array.isArray(slots)) {
      return NextResponse.json({ error: "누락" }, { status: 400 });
    }

    const secretRaw = await redis.hget(KEY.secrets(code), participantId) as string | null;
    if (!secretRaw) return NextResponse.json({ error: "참여자 없음" }, { status: 404 });
    const [tokenHash] = secretRaw.split(":");
    if (hashSecret(token) !== tokenHash) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

    const pipe = redis.pipeline();
    const availKey = KEY.avail(code, participantId);
    for (const { slot, checked } of slots) {
      if (checked) pipe.sadd(availKey, slot);
      else pipe.srem(availKey, slot);
    }
    pipe.incr(KEY.version(code));
    await pipe.exec();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/room/[code]/toggle error:", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
