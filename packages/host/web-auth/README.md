# `@deepseek-ai/dsh-host-web-auth`

English | [中文](README.zh.md)

Opt-in single-password + signed session-cookie gate over the [webserver](../webserver/README.md)'s `/api` surface and both WebSocket upgrades, registered through its `registerGuard` pre-dispatch hook so every route — regardless of which plugin registered it — passes through the same check. The static SPA shell is never gated: it is non-secret and identical for every visitor, and the real capability boundary (session data, LLM calls, tool execution) is entirely behind `/api/*`.

The gate is inert by construction until a password is actually stored: `apply()` mounts the guard and `/auth/*` routes only when `config.enabled` is true, and the guard itself allows every request while [`ctx.credentials`](../../credentials/credentials/README.md) has no value for `DSH_WEB_AUTH_PASSWORD_HASH`. A deployment sets the password through the composing bundle's `--set-password-stdin` CLI flag (never over the web — that would be circular), never by editing config directly.

Sessions are stateless, signed cookies (HMAC-SHA256 over a `{iat, exp}` payload, secret in `DSH_WEB_AUTH_SESSION_SECRET`) — there is no server-side session table, so revocation is rotating the secret, which invalidates every outstanding cookie at once.

## Config

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `false` | Master mount switch — a lockout-recovery escape hatch. The real activation condition is credential presence, not this flag; an operator forces the gate open by overriding this to `false` in their own patch layer, without touching the stored hash. |
| `cookieName` | `dsh_web_auth` | Session cookie name. |
| `sessionTtlMs` | 30 days | Session lifetime. |
| `secureCookie` | `false` | Emit the cookie's `Secure` attribute. Set true behind a TLS-terminating reverse proxy; leave false for a plain-HTTP loopback dev run. |

## Model Experience

None, as the package authenticates HTTP requests behind a password gate; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No brute-force rate limiting or lockout on `POST /auth/login`.** Acceptable for a single shared password behind a reverse proxy in personal/small-team use; a public multi-attempt-tolerant deployment would need one.
- **`API_PATH_PREFIX` (`/api`) is a manually-synced string literal**, not imported from [`@deepseek-ai/dsh-client-connection`](../../client/connection/README.md) — `packages/host/*` must not depend on `packages/client/*` (wrong layering direction). If that package's API path ever changes, this literal must be updated by hand.
- **Session revocation is all-or-nothing.** Rotating `DSH_WEB_AUTH_SESSION_SECRET` invalidates every outstanding session at once; there is no per-session revocation list.
- **Single shared password only** — no per-user accounts, no audit log of who logged in. Fits the product's existing single-operator model; a multi-user deployment needs a different design.
