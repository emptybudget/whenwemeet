import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY } from "@/lib/keys";
import { hashSecret } from "@/lib/crypto";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { participantId, token } = await req.json();

  if (!participantId || !token) return NextResponse.json({ error: "누락" }, { status: 400 });

  const exists = await redis.exists(KEY.room(code));
  if (!exists) return NextResponse.json({ error: "방 없음" }, { status: 404 });

  const secretRaw = await redis.hget(KEY.secrets(code), participantId) as string | null;
  if (!secretRaw) return NextResponse.json({ error: "참여자 없음" }, { status: 404 });

  const [tokenHash] = secretRaw.split(":");
  if (hashSecret(token) !== tokenHash) return NextResponse.json({ error: "토큰 불일치" }, { status: 401 });

  const name = await redis.hget(KEY.participants(code), participantId) as string | null;
  return NextResponse.json({ participantId, name });
}
