import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY, TTL_SECONDS, MAX_PARTICIPANTS } from "@/lib/keys";
import { generateToken, hashSecret } from "@/lib/crypto";
import { randomBytes } from "crypto";

function generateParticipantId(): string {
  return randomBytes(12).toString("hex");
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { name, pin } = body;

    if (!name || !pin) return NextResponse.json({ error: "이름과 PIN 필요" }, { status: 400 });

    const exists = await redis.exists(KEY.room(code));
    if (!exists) return NextResponse.json({ error: "방 없음" }, { status: 404 });

    const secrets = (await redis.hgetall(KEY.secrets(code))) as Record<string, string> | null;
    const participants = (await redis.hgetall(KEY.participants(code))) as Record<string, string> | null;

    const pinHash = hashSecret(pin);

    if (participants && secrets) {
      for (const [pid, pname] of Object.entries(participants)) {
        if (pname === name && secrets[pid]) {
          const [, storedPinHash] = secrets[pid].split(":");
          if (storedPinHash === pinHash) {
            const newToken = generateToken();
            const newTokenHash = hashSecret(newToken);
            await redis.hset(KEY.secrets(code), { [pid]: `${newTokenHash}:${pinHash}` });
            return NextResponse.json({ participantId: pid, token: newToken, resumed: true });
          } else {
            return NextResponse.json({ error: "PIN이 틀렸습니다" }, { status: 401 });
          }
        }
      }
    }

    if (participants && Object.keys(participants).length >= MAX_PARTICIPANTS) {
      return NextResponse.json({ error: `참여 인원은 최대 ${MAX_PARTICIPANTS}명까지 가능합니다` }, { status: 403 });
    }

    const pid = generateParticipantId();
    const token = generateToken();
    const tokenHash = hashSecret(token);

    const pipe = redis.pipeline();
    pipe.hset(KEY.participants(code), { [pid]: name });
    pipe.hset(KEY.secrets(code), { [pid]: `${tokenHash}:${pinHash}` });
    pipe.incr(KEY.version(code));
    pipe.expire(KEY.participants(code), TTL_SECONDS);
    pipe.expire(KEY.secrets(code), TTL_SECONDS);
    await pipe.exec();

    return NextResponse.json({ participantId: pid, token, resumed: false });
  } catch (e) {
    console.error("POST /api/room/[code]/join error:", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
