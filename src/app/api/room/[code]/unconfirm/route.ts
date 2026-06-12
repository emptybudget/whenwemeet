import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY } from "@/lib/keys";
import { hashSecret } from "@/lib/crypto";
import { setAllTTL } from "@/lib/keys";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { participantId, token } = await req.json();

  if (!participantId || !token) return NextResponse.json({ error: "누락" }, { status: 400 });

  const meta = await redis.hgetall(KEY.room(code)) as Record<string, string> | null;
  if (!meta) return NextResponse.json({ error: "방 없음" }, { status: 404 });

  if (meta.ownerId !== participantId) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const secretRaw = await redis.hget(KEY.secrets(code), participantId) as string | null;
  if (!secretRaw) return NextResponse.json({ error: "참여자 없음" }, { status: 404 });
  const [tokenHash] = secretRaw.split(":");
  if (hashSecret(token) !== tokenHash) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  await redis.hset(KEY.room(code), { confirmedSlot: "" });

  const baseExpireAt = Number(meta.baseExpireAt);
  const ttlSeconds = Math.max(Math.floor((baseExpireAt - Date.now()) / 1000), 86400);

  const participants = (await redis.hgetall(KEY.participants(code))) as Record<string, string> | null;
  const pids = Object.keys(participants || {});
  await setAllTTL(redis, code, pids, ttlSeconds);

  return NextResponse.json({ ok: true });
}
