import { describe, expect, it } from 'vitest'
import { generateSessionSecret, hashPassword, verifyPassword } from '../src/crypto.ts'

const FAST_PARAMS = { N: 2 ** 10, r: 8, p: 1 }

describe('hashPassword / verifyPassword', () => {
  it('round-trips the correct password', () => {
    const stored = hashPassword('correct horse battery staple', FAST_PARAMS)
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true)
  })

  it('rejects a wrong password', () => {
    const stored = hashPassword('correct horse battery staple', FAST_PARAMS)
    expect(verifyPassword('wrong password', stored)).toBe(false)
  })

  it('produces different hashes for the same password (random salt)', () => {
    const first = hashPassword('same password', FAST_PARAMS)
    const second = hashPassword('same password', FAST_PARAMS)
    expect(first).not.toBe(second)
    expect(verifyPassword('same password', first)).toBe(true)
    expect(verifyPassword('same password', second)).toBe(true)
  })

  it('uses the documented default cost parameters when none are given', () => {
    const stored = hashPassword('default cost password')
    expect(stored.split('$').slice(0, 4)).toEqual(['scrypt', String(2 ** 15), '8', '1'])
    expect(verifyPassword('default cost password', stored)).toBe(true)
  })

  it.each([
    ['empty string', ''],
    ['wrong prefix', 'bcrypt$1024$8$1$c2FsdA$a2V5'],
    ['too few fields', 'scrypt$1024$8$1$salt'],
    ['too many fields', 'scrypt$1024$8$1$salt$key$extra'],
    ['non-numeric cost', 'scrypt$abc$8$1$c2FsdA$a2V5'],
    ['non-base64url salt', 'scrypt$1024$8$1$not base64!!$a2V5'],
    ['empty key', 'scrypt$1024$8$1$c2FsdA$'],
  ])('rejects malformed stored value without throwing: %s', (_label, stored) => {
    expect(() => verifyPassword('anything', stored)).not.toThrow()
    expect(verifyPassword('anything', stored)).toBe(false)
  })

  it('rejects a stored value whose cost parameters scrypt itself refuses', () => {
    // N must be a power of two; scrypt throws a RangeError for 1023.
    const stored = 'scrypt$1023$8$1$c2FsdA$a2V5'
    expect(() => verifyPassword('anything', stored)).not.toThrow()
    expect(verifyPassword('anything', stored)).toBe(false)
  })

  it.each([
    ['N below the floor', 'scrypt$1$8$1$c2FsdA$a2V5'],
    ['N above the ceiling', `scrypt$${String(2 ** 21)}$8$1$c2FsdA$a2V5`],
    ['r above the ceiling', 'scrypt$1024$65$1$c2FsdA$a2V5'],
    ['p above the ceiling', 'scrypt$1024$8$17$c2FsdA$a2V5'],
  ])('rejects out-of-bounds cost parameters before ever calling scrypt: %s', (_label, stored) => {
    expect(verifyPassword('anything', stored)).toBe(false)
  })
})

describe('generateSessionSecret', () => {
  it('produces distinct, non-empty base64url secrets', () => {
    const first = generateSessionSecret()
    const second = generateSessionSecret()
    expect(first).not.toBe(second)
    expect(first.length).toBeGreaterThan(0)
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
