import { Redis } from "@upstash/redis";

// NOTE: Do NOT set automaticDeserialization: false.
// With that option, hgetall returns the raw flat array [field, value, ...]
// instead of an object, so Object.keys(participants).length counts every
// field AND value (e.g. 1 participant -> length 2 -> "2명" bug).
// Default mode also leaves plain strings/numbers unserialized on write
// (defaultSerializer), so version INCR and date sets keep working.
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
