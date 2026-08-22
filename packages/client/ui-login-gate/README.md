# `@deepseek-ai/dsh-client-ui-login-gate`

English | [中文](README.zh.md)

Full-page login overlay for the opt-in [`@deepseek-ai/dsh-host-web-auth`](../../host/web-auth/README.md) password gate. Registers into [ui-layout](../ui-layout/README.md)'s `shell.overlay` list slot (waiting on its declaration via `ctx.slots.inject`, since AppFrame's mount order is not guaranteed ahead of this package's), checks `GET /auth/session` once on mount, and renders nothing when the gate is inactive or the browser is already authenticated. Otherwise it blocks the rest of the app behind [`OnboardingSurface`](../ui-primitives/README.md) until `POST /auth/login` succeeds — no page reload needed, since the app already fully booted and its subsequent same-origin `/api` calls carry the new session cookie automatically.

Talks to `/auth/*` through a plain `fetch` wrapper (`session-client.ts`), not the RPC bridge (`@deepseek-ai/dsh-client-connection`) — that machinery assumes an already-established session, which is circular for the endpoints that establish one.

## Model Experience

None, as the package renders a browser-side login overlay; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The shell boots fully before the gate resolves.** An unauthenticated visitor's inert app may issue a few background `/api` calls from unrelated plugins before the overlay renders on mount; the guard hard-denies them (no data exposure), but a console warning or a transient toast from an unrelated plugin may surface momentarily. Deferred rather than solved.
