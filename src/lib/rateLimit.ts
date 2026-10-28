/**
 * Best-effort, per-IP fixed-window rate limit for the public demo.
 *
 * Counts live in this server instance's memory, so a visitor whose requests
 * land on different instances gets a little more than the limit. That's fine
 * for its job here, which is stopping one person from hammering the models in
 * a loop. The hard ceiling on spend is the AI Gateway budget, not this.
 */
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_TRACKED_KEYS = 5000;

const hits = new Map<string, { count: number; resetAt: number }>();

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * Counts one request against `bucket` for this client. Returns a 429
 * response if they're over `limit` per hour, else null.
 */
export function rateLimit(request: Request, bucket: string, limit: number): Response | null {
  const key = `${bucket}:${clientIp(request)}`;
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    if (hits.size >= MAX_TRACKED_KEYS) hits.clear();
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return Response.json(
      { error: `You've hit the demo limit. Try again in ${Math.ceil(retryAfter / 60)} minutes.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  entry.count += 1;
  return null;
}
