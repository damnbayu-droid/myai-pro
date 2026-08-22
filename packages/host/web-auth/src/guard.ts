/**
 * The pre-dispatch guard: allows `/auth/*` unconditionally, allows everything
 * while no password is configured (the layer-2 off switch), allows anything
 * outside `/api` (the static SPA shell is non-secret and identical for every
 * visitor), and otherwise requires a valid session cookie.
 * @module @deepseek-ai/dsh-host-web-auth/guard
 */

import type { CredentialProvider, CredentialRef } from '@deepseek-ai/dsh-credentials'
import type { WebGuard } from '@deepseek-ai/dsh-host-webserver'
import { readCookie } from './cookie.ts'
import { verifySession } from './session.ts'

/** `/auth/*` route prefix — owns its own logic, including the unauthenticated login POST. */
export const AUTH_PATH_PREFIX = '/auth'

/**
 * `/api` route prefix — the capability boundary this guard protects.
 * Duplicated as a literal rather than imported from `@deepseek-ai/dsh-client-connection`:
 * `packages/host/*` must not depend on `packages/client/*` (host is the lower layer).
 * Keep in sync with that package's own API path constant by hand.
 */
export const API_PATH_PREFIX = '/api'

/** Inputs the guard needs to make its decision. */
export interface GuardDependencies {
  credentials: CredentialProvider
  cookieName: string
  passwordHashRef: CredentialRef
  sessionSecretRef: CredentialRef
}

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Build the guard function registered with `ctx.webServer.registerGuard`.
 * @param deps - credential provider and the refs/cookie name it checks.
 * @returns the guard.
 */
export function createGuard(deps: GuardDependencies): WebGuard {
  return async (req) => {
    /* v8 ignore next -- node:http always sets url on server requests. */
    const pathname = new URL(req.url ?? '/', 'http://x').pathname
    if (underPrefix(pathname, AUTH_PATH_PREFIX)) return { allow: true }

    const passwordHash = await deps.credentials.resolve(deps.passwordHashRef)
    if (passwordHash === undefined) return { allow: true } // no password configured: gate is inert

    if (!underPrefix(pathname, API_PATH_PREFIX)) return { allow: true }

    const token = readCookie(req, deps.cookieName)
    if (token === undefined) return unauthorized()

    const secret = await deps.credentials.resolve(deps.sessionSecretRef)
    if (secret === undefined) return unauthorized() // password set but secret missing: fail closed

    const session = verifySession(token, secret.value)
    if (session === undefined) return unauthorized()

    return { allow: true }
  }
}

function unauthorized(): { allow: false; status: number; headers: Record<string, string>; body: string } {
  return {
    allow: false,
    status: 401,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ error: 'unauthorized' }),
  }
}
