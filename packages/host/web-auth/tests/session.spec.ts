import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { mintSession, verifySession } from '../src/session.ts'

const SECRET = 'test-session-secret'
const OTHER_SECRET = 'a-different-secret'
const ONE_HOUR_MS = 60 * 60 * 1000

/** Build a validly-signed token around an arbitrary payload string, so a
 * malformed-payload test exercises JSON/shape validation rather than just
 * failing at the signature check. */
function signedToken(rawPayload: string, secret: string = SECRET): string {
  const encodedPayload = Buffer.from(rawPayload, 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${signature}`
}

describe('mintSession / verifySession', () => {
  it('round-trips a freshly minted token', () => {
    const now = Date.now()
    const token = mintSession(SECRET, ONE_HOUR_MS, now)
    const payload = verifySession(token, SECRET, now)
    expect(payload).toEqual({ iat: now, exp: now + ONE_HOUR_MS })
  })

  it('rejects a token verified after it expires', () => {
    const now = Date.now()
    const token = mintSession(SECRET, ONE_HOUR_MS, now)
    expect(verifySession(token, SECRET, now + ONE_HOUR_MS + 1)).toBeUndefined()
  })

  it('accepts a token right up to (but not at) its expiry instant', () => {
    const now = Date.now()
    const token = mintSession(SECRET, ONE_HOUR_MS, now)
    expect(verifySession(token, SECRET, now + ONE_HOUR_MS - 1)).toBeDefined()
    expect(verifySession(token, SECRET, now + ONE_HOUR_MS)).toBeUndefined()
  })

  it('rejects a token verified with the wrong secret', () => {
    const token = mintSession(SECRET, ONE_HOUR_MS)
    expect(verifySession(token, OTHER_SECRET)).toBeUndefined()
  })

  it('rejects a token whose payload was tampered with', () => {
    const token = mintSession(SECRET, ONE_HOUR_MS)
    const [encodedPayload, signature] = token.split('.')
    const forgedPayload = Buffer.from(JSON.stringify({ iat: 0, exp: Date.now() + ONE_HOUR_MS }), 'utf8').toString('base64url')
    expect(forgedPayload).not.toBe(encodedPayload)
    expect(verifySession(`${forgedPayload}.${signature}`, SECRET)).toBeUndefined()
  })

  it('rejects a token whose signature was tampered with', () => {
    const token = mintSession(SECRET, ONE_HOUR_MS)
    const [encodedPayload] = token.split('.')
    expect(verifySession(`${encodedPayload}.forged-signature`, SECRET)).toBeUndefined()
  })

  it.each([
    ['no separator', 'not-a-valid-token'],
    ['empty string', ''],
  ])('rejects a malformed token without throwing: %s', (_label, token) => {
    expect(() => verifySession(token, SECRET)).not.toThrow()
    expect(verifySession(token, SECRET)).toBeUndefined()
  })

  it.each([
    ['payload not valid JSON', 'not json'],
    ['payload JSON missing fields', '{}'],
    ['payload JSON wrong field types', '{"iat":"x","exp":"y"}'],
    ['payload not a JSON object', '[1,2,3]'],
  ])('rejects a validly-signed but malformed payload without throwing: %s', (_label, rawPayload) => {
    const token = signedToken(rawPayload)
    expect(() => verifySession(token, SECRET)).not.toThrow()
    expect(verifySession(token, SECRET)).toBeUndefined()
  })
})
