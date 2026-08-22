/**
 * Session cookie header formatting and parsing.
 * @module @deepseek-ai/dsh-host-web-auth/cookie
 */

import type { IncomingMessage } from 'node:http'

/**
 * Read one cookie's value from a request's `Cookie` header.
 * @param req - the incoming request.
 * @param name - the cookie name to look up.
 * @returns the decoded value, or `undefined` if absent.
 */
export function readCookie(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie
  if (header === undefined) return undefined
  for (const pair of header.split(';')) {
    const at = pair.indexOf('=')
    if (at === -1) continue
    const key = pair.slice(0, at).trim()
    if (key !== name) continue
    try {
      return decodeURIComponent(pair.slice(at + 1).trim())
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Build a `Set-Cookie` header value that stores a session token.
 * @param name - the cookie name.
 * @param value - the session token.
 * @param maxAgeMs - lifetime in milliseconds.
 * @param secure - whether to emit the `Secure` attribute (set true behind a TLS-terminating reverse proxy).
 * @returns the header value.
 */
export function setCookieHeader(name: string, value: string, maxAgeMs: number, secure: boolean): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${String(Math.floor(maxAgeMs / 1000))}`,
    'HttpOnly',
    'SameSite=Strict',
  ]
  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}

/**
 * Build a `Set-Cookie` header value that clears a session cookie.
 * @param name - the cookie name.
 * @param secure - whether to emit the `Secure` attribute, matching the cookie that set it.
 * @returns the header value.
 */
export function clearCookieHeader(name: string, secure: boolean): string {
  const attributes = [`${name}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Strict']
  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}
