import { ConfigService } from '@nestjs/config';
import ms from 'ms';

/** Injection token for the refresh token lifetime in milliseconds. */
export const REFRESH_TOKEN_TTL_MS = Symbol('REFRESH_TOKEN_TTL_MS');

export const DEFAULT_REFRESH_EXPIRES_IN = '7d';

/**
 * Reads JWT_REFRESH_EXPIRES_IN (same format as JWT_EXPIRES_IN, e.g. `7d`, `30m`)
 * and returns it in milliseconds. Defaults to 7 days; an invalid value throws,
 * so the app fails on boot.
 */
export function refreshTokenTtlFromConfig(config: ConfigService): number {
  const raw = String(config.get('JWT_REFRESH_EXPIRES_IN') ?? '').trim() || DEFAULT_REFRESH_EXPIRES_IN;

  let ttl: number | undefined;
  try {
    ttl = ms(raw); // undefined for unparsable strings
  } catch {
    ttl = undefined;
  }

  if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl <= 0) {
    throw new Error(
      `JWT_REFRESH_EXPIRES_IN must be a positive duration like "7d" or "30m" (got "${raw}")`,
    );
  }
  return ttl;
}
