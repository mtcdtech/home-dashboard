/**
 * In-memory sliding window rate limiter keyed by client IP.
 *
 * Limitation note: Rate limit state is stored per container instance in-memory
 * and is not shared across clusters/servers. Adequate for self-hosted, low-traffic use.
 */
import { NextRequest } from "next/server";

interface RateLimitEntry {
  timestamps: number[];
}

const buckets = new Map<string, RateLimitEntry>();

// Periodically purge entries older than 5 minutes to prevent memory leaks
const PURGE_INTERVAL_MS = 5 * 60 * 1000;
let lastPurge = Date.now();

function purgeExpired(windowMs: number) {
  const now = Date.now();
  if (now - lastPurge < PURGE_INTERVAL_MS) return;
  lastPurge = now;
  for (const [key, entry] of buckets.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
    if (entry.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}

export function getClientIp(req: Request | NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(
  ip: string,
  limit: number = 60,
  windowMs: number = 60000,
  bucketPrefix: string = "default"
): RateLimitResult {
  const now = Date.now();
  purgeExpired(windowMs);

  const key = `${bucketPrefix}:${ip}`;
  let entry = buckets.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(key, entry);
  }

  // Remove timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    resetMs: windowMs,
  };
}
