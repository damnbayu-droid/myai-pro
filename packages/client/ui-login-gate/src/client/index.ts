/**
 * Browser half: registers the login overlay into ui-layout's `shell.overlay`
 * list slot, waiting on its declaration since AppFrame's own mount order is
 * not guaranteed ahead of this package's.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the SlotMap merge declaring 'shell.overlay'.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { LoginGateOverlay } from './LoginGateOverlay.tsx'

/** Required services (cordis fiber inject): the slot registry. */
export const inject = ['slots']

/**
 * Client plugin body: register the overlay into `shell.overlay`.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({ name: 'shell.overlay', id: 'login-gate', order: 0 }, LoginGateOverlay))
}
