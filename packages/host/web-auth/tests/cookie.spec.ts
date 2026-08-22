import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { clearCookieHeader, readCookie, setCookieHeader } from '../src/cookie.ts'

function fakeRequest(cookieHeader: string | undefined): IncomingMessage {
  return { headers: { cookie: cookieHeader } } as unknown as IncomingMessage
}

describe('setCookieHeader', () => {
  it('formats the required attributes without Secure by default', () => {
    const header = setCookieHeader('dsh_web_auth', 'tok-en', 60_000, false)
    expect(header).toBe('dsh_web_auth=tok-en; Path=/; Max-Age=60; HttpOnly; SameSite=Strict')
  })

  it('adds Secure when requested', () => {
    const header = setCookieHeader('dsh_web_auth', 'tok-en', 60_000, true)
    expect(header).toContain('; Secure')
  })

  it('URL-encodes the value', () => {
    const header = setCookieHeader('dsh_web_auth', 'a b;c', 1000, false)
    expect(header).toContain(`dsh_web_auth=${encodeURIComponent('a b;c')}`)
  })
})

describe('clearCookieHeader', () => {
  it('zeroes Max-Age and matches the setting cookie\'s Secure attribute', () => {
    expect(clearCookieHeader('dsh_web_auth', false)).toBe('dsh_web_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict')
    expect(clearCookieHeader('dsh_web_auth', true)).toContain('; Secure')
  })
})

describe('readCookie', () => {
  it('reads a single cookie', () => {
    expect(readCookie(fakeRequest('dsh_web_auth=abc123'), 'dsh_web_auth')).toBe('abc123')
  })

  it('reads the target cookie among several', () => {
    const req = fakeRequest('other=1; dsh_web_auth=abc123; third=2')
    expect(readCookie(req, 'dsh_web_auth')).toBe('abc123')
  })

  it('returns undefined when the cookie is absent', () => {
    expect(readCookie(fakeRequest('other=1'), 'dsh_web_auth')).toBeUndefined()
  })

  it('returns undefined when there is no Cookie header at all', () => {
    expect(readCookie(fakeRequest(undefined), 'dsh_web_auth')).toBeUndefined()
  })

  it('decodes a URL-encoded value', () => {
    const req = fakeRequest(`dsh_web_auth=${encodeURIComponent('a b;c')}`)
    expect(readCookie(req, 'dsh_web_auth')).toBe('a b;c')
  })

  it('skips a malformed pair with no "=" and keeps scanning', () => {
    const req = fakeRequest('malformed; dsh_web_auth=abc123')
    expect(readCookie(req, 'dsh_web_auth')).toBe('abc123')
  })

  it('returns undefined for an undecodable value rather than throwing', () => {
    const req = fakeRequest('dsh_web_auth=%')
    expect(() => readCookie(req, 'dsh_web_auth')).not.toThrow()
    expect(readCookie(req, 'dsh_web_auth')).toBeUndefined()
  })
})
