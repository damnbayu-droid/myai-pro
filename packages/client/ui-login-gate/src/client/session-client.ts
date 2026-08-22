/**
 * Plain-fetch client for the `/auth/*` routes. Not the RPC bridge
 * (`@deepseek-ai/dsh-client-connection`): that machinery assumes an already
 * established session, which is circular for the endpoints that establish one.
 */

/** `GET /auth/session` result. */
export interface SessionStatus {
  authenticated: boolean
  required: boolean
}

/**
 * Check whether the gate is active and, if so, whether this browser is authenticated.
 * @returns the session status; `required: false` when no password is configured.
 */
export async function checkSession(): Promise<SessionStatus> {
  const response = await fetch('/auth/session', { credentials: 'same-origin' })
  if (!response.ok) return { authenticated: false, required: false }
  return await response.json() as SessionStatus
}

/**
 * Submit a password; on success, the response's Set-Cookie establishes the session.
 * @param password - the plaintext password.
 * @returns whether login succeeded.
 */
export async function login(password: string): Promise<boolean> {
  const response = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return response.ok
}

/** Clear the session cookie. */
export async function logout(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' })
}
