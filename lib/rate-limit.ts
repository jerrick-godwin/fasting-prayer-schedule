type RateRecord = { count: number; resetAt: number };

const requests = new Map<string, RateRecord>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;
const MAX_RECORDS = 1_000;

function pruneRequests(now: number) {
  for (const [storedKey, record] of requests) {
    if (record.resetAt <= now) requests.delete(storedKey);
  }

  while (requests.size >= MAX_RECORDS) {
    const oldestKey = requests.keys().next().value as string | undefined;
    if (!oldestKey) break;
    requests.delete(oldestKey);
  }
}

export function checkRateLimit(key: string, now = Date.now()) {
  if (requests.size >= MAX_RECORDS) pruneRequests(now);

  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}
