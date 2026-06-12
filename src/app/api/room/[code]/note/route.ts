import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY } from "@/lib/keys";
import { hashSecret } from "@/lib/crypto";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const { participantId, token, note } = await req.json();

    if (!participantId || !token) return NextResponse.json({ error: "누락" }, { status: 400 });

    const secretRaw = await redis.hget(KEY.secrets(code), participantId) as string | null;
    if (!secretRaw) return NextResponse.json({ error: "참여자 없음" }, { status: 404 });
    const [tokenHash] = secretRaw.split(":");
    if (hashSecret(token) !== tokenHash) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

    if (note) {
      await redis.set(KEY.note(code, participantId), note);
    } else {
      await redis.del(KEY.note(code, participantId));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/room/[code]/note error:", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
