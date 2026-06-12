import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY } from "@/lib/keys";
import { hashSecret } from "@/lib/crypto";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { participantId, token } = await req.json();

  if (!participantId || !token) return NextResponse.json({ error: "누락" }, { status: 400 });

  const secretRaw = await redis.hget(KEY.secrets(code), participantId) as string | null;
  if (!secretRaw) return NextResponse.json({ error: "참여자 없음" }, { status: 404 });
  const [tokenHash] = secretRaw.split(":");
  if (hashSecret(token) !== tokenHash) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const pipe = redis.pipeline();
  pipe.hdel(KEY.participants(code), participantId);
  pipe.hdel(KEY.secrets(code), participantId);
  pipe.del(KEY.avail(code, participantId));
  pipe.del(KEY.note(code, participantId));
  pipe.incr(KEY.version(code));
  await pipe.exec();

  return NextResponse.json({ ok: true });
}
