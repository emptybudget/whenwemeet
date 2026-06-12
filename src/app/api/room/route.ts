import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY, TTL_SECONDS } from "@/lib/keys";
import { generateRoomCode, generateToken, hashSecret } from "@/lib/crypto";
import { randomBytes } from "crypto";

function generateParticipantId(): string {
  return randomBytes(12).toString("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, notice, ownerName, ownerPin } = body;

    if (!title || !ownerName || !ownerPin) {
      return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    let code = "";
    for (let i = 0; i < 10; i++) {
      const candidate = generateRoomCode();
      const exists = await redis.exists(KEY.room(candidate));
      if (!exists) { code = candidate; break; }
    }
    if (!code) return NextResponse.json({ error: "코드 생성 실패" }, { status: 500 });

    const ownerId = generateParticipantId();
    const token = generateToken();
    const tokenHash = hashSecret(token);
    const pinHash = hashSecret(ownerPin);
    const now = Date.now();
    const baseExpireAt = now + TTL_SECONDS * 1000;

    const pipe = redis.pipeline();
    pipe.hset(KEY.room(code), {
      title,
      notice: notice || "",
      ownerId,
      createdAt: String(now),
      baseExpireAt: String(baseExpireAt),
      confirmedText: "",
    });
    pipe.hset(KEY.participants(code), { [ownerId]: ownerName });
    pipe.hset(KEY.secrets(code), { [ownerId]: `${tokenHash}:${pinHash}` });
    pipe.set(KEY.version(code), "0");
    pipe.expire(KEY.room(code), TTL_SECONDS);
    pipe.expire(KEY.participants(code), TTL_SECONDS);
    pipe.expire(KEY.secrets(code), TTL_SECONDS);
    pipe.expire(KEY.version(code), TTL_SECONDS);
    await pipe.exec();

    return NextResponse.json({ code, participantId: ownerId, token });
  } catch (e) {
    console.error("POST /api/room error:", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
