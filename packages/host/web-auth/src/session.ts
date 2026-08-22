/**
 * Stateless, signed session tokens: an HMAC-SHA256 signature over a JSON
 * `{iat, exp}` payload. No server-side session table — verification is pure
 * recomputation, so revocation is rotating the signing secret, not a lookup.
 * @module @deepseek-ai/dsh-host-web-auth/session
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_SEPARATOR = '.'

/** Decoded, verified session payload. */
export interface SessionPayload {
  /** Issued-at, epoch milliseconds. */
  iat: number
  /** Expires-at, epoch milliseconds. */
  exp: number
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

/**
 * Mint a signed session token.
 * @param secret - the current session-signing secret.
 * @param ttlMs - session lifetime in milliseconds.
 * @param now - current time in epoch milliseconds; defaults to `Date.now()`.
 * @returns `base64url(payload).base64url(hmac)`.
 */
export function mintSession(secret: string, ttlMs: number, now: number = Date.now()): string {
  const payload: SessionPayload = { iat: now, exp: now + ttlMs }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encodedPayload}${TOKEN_SEPARATOR}${sign(encodedPayload, secret)}`
}

/**
 * Verify a session token's signature and expiry.
 * @param token - a {@link mintSession} output.
 * @param secret - the current session-signing secret.
 * @param now - current time in epoch milliseconds; defaults to `Date.now()`.
 * @returns the decoded payload, or `undefined` on any failure (bad shape, bad signature, expired).
 */
export function verifySession(token: string, secret: string, now: number = Date.now()): SessionPayload | undefined {
  const separatorAt = token.indexOf(TOKEN_SEPARATOR)
  if (separatorAt === -1) return undefined
  const encodedPayload = token.slice(0, separatorAt)
  const signature = token.slice(separatorAt + 1)
  const expectedSignature = sign(encodedPayload, secret)
  const actual = Buffer.from(signature, 'base64url')
  const expected = Buffer.from(expectedSignature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    return undefined
  }
  if (
    typeof payload !== 'object' || payload === null
    || !('iat' in payload) || !('exp' in payload)
    || typeof payload.iat !== 'number' || typeof payload.exp !== 'number'
  ) return undefined
  if (payload.exp <= now) return undefined
  return { iat: payload.iat, exp: payload.exp }
}
