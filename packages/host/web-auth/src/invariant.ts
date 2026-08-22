/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-host-web-auth`.
 * @module @deepseek-ai/dsh-host-web-auth/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-web-auth'

/** Cordis companion plugin name. */
export const name = 'host-web-auth-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/**
 * No runtime invariant: this package owns no mutable registry of its own —
 * `apply()` wires exactly two effects (one guard, one route) into
 * `@deepseek-ai/dsh-host-webserver`'s registries, and that package's own
 * `register`/`registerGuard` disposers are the owned relationship, already
 * covered by its invariant companion and its real-composition tests. Guard
 * and route disposal on fiber unload is Cordis's `ctx.effect()` contract, not
 * a relation this package introduces.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
