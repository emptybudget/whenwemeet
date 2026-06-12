import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY } from "@/lib/keys";
import { hashSecret } from "@/lib/crypto";

async function verifyToken(code: string, participantId: string, token: string): Promise<boolean> {
  const secretRaw = await redis.hget(KEY.secrets(code), participantId) as string | null;
  if (!secretRaw) return false;
  const [tokenHash] = secretRaw.split(":");
  return hashSecret(token) === tokenHash;
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { participantId, token, slots } = await req.json();
  // slots: Array<{ slot: string; checked: boolean }>

  if (!participantId || !token || !Array.isArray(slots)) {
    return NextResponse.json({ error: "누락" }, { status: 400 });
  }

  if (!(await verifyToken(code, participantId, token))) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const pipe = redis.pipeline();
  const availKey = KEY.avail(code, participantId);
  for (const { slot, checked } of slots) {
    if (checked) pipe.sadd(availKey, slot);
    else pipe.srem(availKey, slot);
  }
  pipe.incr(KEY.version(code));
  await pipe.exec();

  return NextResponse.json({ ok: true });
}
