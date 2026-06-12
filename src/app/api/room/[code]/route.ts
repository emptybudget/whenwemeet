import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY } from "@/lib/keys";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const meta = await redis.hgetall(KEY.room(code));
    if (!meta) return NextResponse.json({ error: "방 없음" }, { status: 404 });

    const participants = (await redis.hgetall(KEY.participants(code))) as Record<string, string> | null;
    const version = await redis.get(KEY.version(code));
    const pids = Object.keys(participants || {});

    // Gather avail (selected dates) and notes per participant
    const availEntries: Record<string, string[]> = {};
    const notes: Record<string, string> = {};

    if (pids.length) {
      await Promise.all(
        pids.map(async (pid) => {
          const [dates, note] = await Promise.all([
            redis.smembers(KEY.avail(code, pid)),
            redis.get(KEY.note(code, pid)) as Promise<string | null>,
          ]);
          if (dates.length) availEntries[pid] = dates as string[];
          if (note) notes[pid] = note as string;
        })
      );
    }

    // Heatmap: date -> list of pids
    const heatmap: Record<string, string[]> = {};
    for (const [pid, dates] of Object.entries(availEntries)) {
      for (const date of dates) {
        if (!heatmap[date]) heatmap[date] = [];
        heatmap[date].push(pid);
      }
    }

    // Disambiguate duplicate names
    const nameCount: Record<string, number> = {};
    const nameIndex: Record<string, number> = {};
    const displayNames: Record<string, string> = {};
    for (const name of Object.values(participants || {})) {
      nameCount[name] = (nameCount[name] || 0) + 1;
    }
    for (const [pid, name] of Object.entries(participants || {})) {
      if (nameCount[name] > 1) {
        nameIndex[name] = (nameIndex[name] || 0) + 1;
        displayNames[pid] = nameIndex[name] === 1 ? name : `${name}(${nameIndex[name]})`;
      } else {
        displayNames[pid] = name;
      }
    }

    return NextResponse.json({
      meta,
      participants: displayNames,
      writerIds: Object.keys(availEntries),
      heatmap,
      notes,
      version,
    });
  } catch (e) {
    console.error("GET /api/room/[code] error:", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
