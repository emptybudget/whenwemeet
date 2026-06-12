import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { KEY } from "@/lib/keys";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const meta = await redis.hgetall(KEY.room(code));
  if (!meta) return NextResponse.json({ error: "방 없음" }, { status: 404 });

  const participants = (await redis.hgetall(KEY.participants(code))) as Record<string, string> | null;
  const version = await redis.get(KEY.version(code));

  const pids = Object.keys(participants || {});
  // Gather avail sets for all participants
  const availEntries: Record<string, string[]> = {};
  if (pids.length) {
    await Promise.all(
      pids.map(async (pid) => {
        const slots = await redis.smembers(KEY.avail(code, pid));
        if (slots.length) availEntries[pid] = slots;
      })
    );
  }

  // Compute heatmap: slot -> count
  const heatmap: Record<string, string[]> = {};
  for (const [pid, slots] of Object.entries(availEntries)) {
    for (const slot of slots) {
      if (!heatmap[slot]) heatmap[slot] = [];
      heatmap[slot].push(pid);
    }
  }

  // Count writers (participants who checked at least one slot)
  const writerIds = Object.keys(availEntries);

  // Disambiguate duplicate names
  const nameCount: Record<string, number> = {};
  const nameIndex: Record<string, number> = {};
  const displayNames: Record<string, string> = {};
  for (const [pid, name] of Object.entries(participants || {})) {
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
    rawParticipants: participants || {},
    writerIds,
    heatmap,
    version,
  });
}
