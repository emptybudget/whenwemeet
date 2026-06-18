export const KEY = {
  room: (code: string) => `room:${code}`,
  participants: (code: string) => `room:${code}:participants`,
  secrets: (code: string) => `room:${code}:secrets`,
  avail: (code: string, pid: string) => `room:${code}:avail:${pid}`,
  note: (code: string, pid: string) => `room:${code}:note:${pid}`,
  version: (code: string) => `room:${code}:version`,
};

export const TTL_DAYS = 60;
export const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;
export const MAX_PARTICIPANTS = 20;

export function ttlFromDate(d: Date): number {
  return Math.floor((d.getTime() - Date.now()) / 1000);
}

export async function setAllTTL(
  redis: import("@upstash/redis").Redis,
  code: string,
  participantIds: string[],
  ttlSeconds: number
) {
  const keys = [
    KEY.room(code),
    KEY.participants(code),
    KEY.secrets(code),
    KEY.version(code),
    ...participantIds.flatMap((pid) => [KEY.avail(code, pid), KEY.note(code, pid)]),
  ];
  await Promise.all(keys.map((k) => redis.expire(k, ttlSeconds)));
}
