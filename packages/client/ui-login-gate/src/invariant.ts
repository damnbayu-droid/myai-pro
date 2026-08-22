/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-login-gate`.
 * @module @deepseek-ai/dsh-client-ui-login-gate/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-login-gate'

/** Cordis companion plugin name. */
export const name = 'client-ui-login-gate-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the plugin registers one renderless-until-gated
 * overlay entry into `shell.overlay` as a single effect, whose disposal the
 * HMR-safety spec proves, and it retains no state between session checks.
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
