import { timingSafeEqual } from "crypto";

/**
 * Cron request authorization.
 *
 * Fails closed: if CRON_SECRET is not configured, no request is authorized.
 * This prevents a misconfigured deployment from silently exposing expensive,
 * org-wide AI jobs to unauthenticated callers.
 *
 * Uses timingSafeEqual for the bearer comparison to avoid leaking the secret
 * byte-by-byte via timing side-channels. Cron traffic is typically
 * machine-to-machine (Vercel → Vercel) with low network jitter, which makes
 * timing attacks more feasible here than for user-facing endpoints.
 */
export function isCronRequestAuthorized(
  authHeader: string | null,
  cronSecret: string | undefined
): boolean {
  if (!cronSecret) return false;
  const expected = `Bearer ${cronSecret}`;
  if (!authHeader || authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}
