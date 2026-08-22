/**
 * @deepseek-ai/dsh-host-web-auth — Opt-in single-password + signed
 * session-cookie gate over the webserver's `/api` surface and both WebSocket
 * upgrades. Inert until a password is actually configured (via the
 * `--set-password-stdin` CLI flag this package's consumer exposes) — with no
 * password set, every request passes exactly as it does without this package
 * mounted at all. The static SPA shell is never gated: the capability
 * boundary this protects is entirely behind `/api/*`.
 * @module @deepseek-ai/dsh-host-web-auth
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef, type CredentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { createGuard } from './guard.ts'
import { authRoute } from './routes.ts'

export { hashPassword, verifyPassword, generateSessionSecret } from './crypto.ts'
export { mintSession, verifySession, type SessionPayload } from './session.ts'
export { AUTH_PATH_PREFIX, API_PATH_PREFIX } from './guard.ts'

/** Stable Cordis plugin name. */
export const name = 'web-auth'

/** Services required before the guard and routes can register. */
export const inject = ['webServer', 'credentials']

/** Plugin config: mount switch and cookie/session shape. */
export interface Config {
  /**
   * Master mount switch — a lockout-recovery escape hatch. The real
   * activation condition is whether a password is actually stored; this
   * exists so an operator can force the gate open without touching the
   * stored hash, by overriding this to `false` in their own patch layer.
   */
  enabled: boolean
  /** Session cookie name. */
  cookieName: string
  /** Session lifetime in milliseconds. */
  sessionTtlMs: number
  /** Emit the cookie's `Secure` attribute; set true behind a TLS-terminating reverse proxy. */
  secureCookie: boolean
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(false),
  cookieName: z.string().default('dsh_web_auth'),
  sessionTtlMs: z.natural().default(30 * 24 * 60 * 60 * 1000),
  secureCookie: z.boolean().default(false),
})

/** Credential reference holding the password's {@link hashPassword} output. */
export const PASSWORD_HASH_REF: CredentialRef = credentialRef('DSH_WEB_AUTH_PASSWORD_HASH')
/** Credential reference holding the session-signing secret. */
export const SESSION_SECRET_REF: CredentialRef = credentialRef('DSH_WEB_AUTH_SESSION_SECRET')

/**
 * Mount the guard and `/auth/*` routes.
 * @param ctx - plugin context carrying the webServer and credentials services.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
  const deps = {
    credentials: ctx.credentials,
    cookieName: config.cookieName,
    sessionTtlMs: config.sessionTtlMs,
    secureCookie: config.secureCookie,
    passwordHashRef: PASSWORD_HASH_REF,
    sessionSecretRef: SESSION_SECRET_REF,
  }
  ctx.effect(() => ctx.webServer.registerGuard(createGuard(deps)), 'web-auth: guard')
  ctx.effect(() => ctx.webServer.register(authRoute(deps)), 'web-auth: /auth routes')
}
