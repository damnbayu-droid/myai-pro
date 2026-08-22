/**
 * Password hashing and verification, `node:crypto` only. No external hashing
 * dependency exists anywhere in this repo; scrypt (interactive-login-grade
 * defaults) plus a constant-time compare is the built-in equivalent.
 * @module @deepseek-ai/dsh-host-web-auth/crypto
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const FIELD_SEPARATOR = '$'
const HASH_PREFIX = 'scrypt'
const KEY_LENGTH = 64
const DEFAULT_N = 2 ** 15
const DEFAULT_R = 8
const DEFAULT_P = 1
/** scrypt's own memory-usage formula, doubled for headroom over Node's 32MB default cap. */
function scryptMaxmem(params: { N: number; r: number; p: number }): number {
  return 128 * params.N * params.r * params.p * 2
}

/** Scrypt cost parameters; only overridden by tests (production always uses the defaults). */
export interface ScryptParams {
  N: number
  r: number
  p: number
}

/**
 * Hash a password into a self-describing string carrying its own salt and
 * cost parameters, so a future default change never invalidates stored hashes.
 * @param password - the plaintext password.
 * @param params - scrypt cost parameters; defaults are Node's documented
 * interactive-login-grade values.
 * @returns `scrypt$N$r$p$saltB64url$keyB64url`.
 */
export function hashPassword(password: string, params: ScryptParams = { N: DEFAULT_N, r: DEFAULT_R, p: DEFAULT_P }): string {
  const salt = randomBytes(16)
  const key = scryptSync(password, salt, KEY_LENGTH, { N: params.N, r: params.r, p: params.p, maxmem: scryptMaxmem(params) })
  return [
    HASH_PREFIX,
    String(params.N),
    String(params.r),
    String(params.p),
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join(FIELD_SEPARATOR)
}

/**
 * Verify a password against a {@link hashPassword} output in constant time.
 * A malformed or foreign-shaped stored value is always a mismatch, never a
 * throw — a corrupted credentials document must fail closed, not 500 every
 * request that reaches the guard.
 * @param password - the plaintext password to check.
 * @param stored - a previously produced {@link hashPassword} string.
 * @returns whether the password matches.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const fields = stored.split(FIELD_SEPARATOR)
  if (fields.length !== 6 || fields[0] !== HASH_PREFIX) return false
  const [, nField, rField, pField, saltField, keyField] = fields
  const N = Number(nField)
  const r = Number(rField)
  const p = Number(pField)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  // Bound cost parameters before ever calling scrypt: a corrupted or hand-edited
  // stored value must fail closed cheaply, not attempt a pathological allocation.
  if (N < 2 || N > 2 ** 20 || r < 1 || r > 64 || p < 1 || p > 16) return false
  // fields.length === 6 above guarantees every destructured element is a real
  // string. Buffer.from never throws for base64url content — it decodes
  // leniently — so a garbled salt/key surfaces as a length or comparison
  // mismatch below, not here.
  const salt = Buffer.from(saltField as string, 'base64url')
  const expectedKey = Buffer.from(keyField as string, 'base64url')
  if (expectedKey.length === 0) return false
  let actualKey: Buffer
  try {
    // The requested keylen (third argument) always makes scryptSync's output
    // exactly expectedKey.length bytes — no length check needed after this.
    actualKey = scryptSync(password, salt, expectedKey.length, { N, r, p, maxmem: scryptMaxmem({ N, r, p }) })
  } catch {
    // Malformed cost parameters (e.g. N not a power of two) reach scrypt as a
    // thrown RangeError — a corrupted stored value, not a live incident.
    return false
  }
  return timingSafeEqual(actualKey, expectedKey)
}

/**
 * Generate a fresh session-signing secret.
 * @returns a 256-bit random value, base64url-encoded.
 */
export function generateSessionSecret(): string {
  return randomBytes(32).toString('base64url')
}
