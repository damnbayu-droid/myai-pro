/**
 * The `/auth/*` routes: login, logout, and a session-status probe. Exempted
 * from the guard by path (see {@link AUTH_PATH_PREFIX}), so they work
 * identically whether or not a session is currently valid.
 * @module @deepseek-ai/dsh-host-web-auth/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CredentialProvider, CredentialRef } from '@deepseek-ai/dsh-credentials'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { verifyPassword, generateSessionSecret } from './crypto.ts'
import { clearCookieHeader, readCookie, setCookieHeader } from './cookie.ts'
import { mintSession, verifySession } from './session.ts'
import { AUTH_PATH_PREFIX } from './guard.ts'

const MAX_BODY_BYTES = 4096

/** Inputs the routes need to authenticate and mint sessions. */
export interface AuthRouteDependencies {
  credentials: CredentialProvider
  cookieName: string
  sessionTtlMs: number
  secureCookie: boolean
  passwordHashRef: CredentialRef
  sessionSecretRef: CredentialRef
}

function sendJson(res: ServerResponse, status: number, body: unknown, extraHeaders?: Record<string, string>): void {
  res.writeHead(status, { 'content-type': 'application/json', ...extraHeaders })
  res.end(JSON.stringify(body))
}

/**
 * Read a request body up to {@link MAX_BODY_BYTES} and parse it as JSON.
 * @param req - the incoming request.
 * @returns the parsed body, or `undefined` if it is missing, oversized, or not valid JSON.
 */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    bytes += chunk.length
    if (bytes > MAX_BODY_BYTES) return undefined
    chunks.push(chunk)
  }
  if (chunks.length === 0) return undefined
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}

async function handleLogin(req: IncomingMessage, res: ServerResponse, deps: AuthRouteDependencies): Promise<void> {
  const passwordHash = await deps.credentials.resolve(deps.passwordHashRef)
  if (passwordHash === undefined) {
    sendJson(res, 503, { ok: false, error: 'not configured' })
    return
  }
  const body = await readJsonBody(req)
  const password = typeof body === 'object' && body !== null && 'password' in body && typeof body.password === 'string'
    ? body.password
    : undefined
  if (password === undefined || !verifyPassword(password, passwordHash.value)) {
    sendJson(res, 401, { ok: false })
    return
  }
  let secretInfo = await deps.credentials.resolve(deps.sessionSecretRef)
  if (secretInfo === undefined) {
    const secret = generateSessionSecret()
    await deps.credentials.set(deps.sessionSecretRef, secret)
    secretInfo = { value: secret, source: 'set' }
  }
  const token = mintSession(secretInfo.value, deps.sessionTtlMs)
  sendJson(res, 200, { ok: true }, {
    'set-cookie': setCookieHeader(deps.cookieName, token, deps.sessionTtlMs, deps.secureCookie),
  })
}

function handleLogout(_req: IncomingMessage, res: ServerResponse, deps: AuthRouteDependencies): void {
  sendJson(res, 200, { ok: true }, {
    'set-cookie': clearCookieHeader(deps.cookieName, deps.secureCookie),
  })
}

async function handleSession(req: IncomingMessage, res: ServerResponse, deps: AuthRouteDependencies): Promise<void> {
  const passwordHash = await deps.credentials.resolve(deps.passwordHashRef)
  const required = passwordHash !== undefined
  if (!required) {
    sendJson(res, 200, { authenticated: false, required: false })
    return
  }
  const token = readCookie(req, deps.cookieName)
  const secret = token === undefined ? undefined : await deps.credentials.resolve(deps.sessionSecretRef)
  const authenticated = token !== undefined && secret !== undefined && verifySession(token, secret.value) !== undefined
  sendJson(res, 200, { authenticated, required: true })
}

/**
 * Build the `/auth` prefix route.
 * @param deps - credential provider, cookie/session config, and the refs it checks.
 * @returns the route to register with `ctx.webServer.register`.
 */
export function authRoute(deps: AuthRouteDependencies): WebRoute {
  return {
    kind: 'prefix',
    path: AUTH_PATH_PREFIX,
    handler: async (req, res) => {
      /* v8 ignore next -- node:http always sets url on server requests. */
      const pathname = new URL(req.url ?? '/', 'http://x').pathname
      if (pathname === `${AUTH_PATH_PREFIX}/login` && req.method === 'POST') {
        await handleLogin(req, res, deps)
        return
      }
      if (pathname === `${AUTH_PATH_PREFIX}/logout` && req.method === 'POST') {
        handleLogout(req, res, deps)
        return
      }
      if (pathname === `${AUTH_PATH_PREFIX}/session` && req.method === 'GET') {
        await handleSession(req, res, deps)
        return
      }
      res.writeHead(404)
      res.end()
    },
  }
}
