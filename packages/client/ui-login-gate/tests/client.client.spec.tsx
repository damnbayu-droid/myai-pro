// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'
import { LoginGateOverlay } from '../src/client/LoginGateOverlay.tsx'

afterEach(cleanup)

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  const declareShellOverlay = () => slots.register({
    name: 'root',
    children: { 'shell.overlay': { kind: 'list', scope: 'root' } },
  } as never, () => null)
  return { ctx, slots, declareShellOverlay }
}

describe('ui-login-gate node half', () => {
  it('has an empty host apply', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })
})

describe('ui-login-gate client half', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual(['slots'])
  })

  it('fills the shell.overlay slot for a declaration before or after apply, and leaves with its fiber', async () => {
    const before = await bench()
    before.declareShellOverlay()
    const fiber = before.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(before.slots.entries('shell.overlay')).toHaveLength(1)
    await fiber.dispose()
    expect(before.slots.entries('shell.overlay')).toHaveLength(0)

    const after = await bench()
    await after.ctx.plugin({ inject: [...inject], apply }).await()
    expect(after.slots.entries('shell.overlay')).toHaveLength(0)
    after.declareShellOverlay()
    await Promise.resolve()
    expect(after.slots.entries('shell.overlay')).toHaveLength(1)
  })
})

describe('LoginGateOverlay', () => {
  const fetchMock = vi.fn()

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('renders nothing when the gate is inactive', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ authenticated: false, required: false }) })
    vi.stubGlobal('fetch', fetchMock)
    const { container } = render(<LoginGateOverlay />)
    await waitFor(() => { expect(container.innerHTML).toBe('') })
    expect(fetchMock).toHaveBeenCalledWith('/auth/session', { credentials: 'same-origin' })
  })

  it('renders nothing when already authenticated', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ authenticated: true, required: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const { container } = render(<LoginGateOverlay />)
    await waitFor(() => { expect(container.innerHTML).toBe('') })
  })

  it('shows the overlay when gated, and unlocks on the right password', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ authenticated: false, required: true }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<LoginGateOverlay />)
    const input = await screen.findByPlaceholderText('Password')

    fetchMock.mockResolvedValueOnce({ ok: false })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'wrong' } })
      fireEvent.click(screen.getByText('Unlock'))
    })
    await screen.findByText('Incorrect password')

    fetchMock.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'correct' } })
      fireEvent.click(screen.getByText('Unlock'))
    })
    await waitFor(() => { expect(screen.queryByPlaceholderText('Password')).toBeNull() })
  })

  it('shows a heading and toggles password visibility with the reveal button', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ authenticated: false, required: true }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<LoginGateOverlay />)
    const input = await screen.findByPlaceholderText<HTMLInputElement>('Password')
    expect(screen.getByText('Restricted Access — Myai Developer')).toBeDefined()
    expect(input.type).toBe('password')

    fireEvent.click(screen.getByLabelText('Show password'))
    expect(input.type).toBe('text')

    fireEvent.click(screen.getByLabelText('Hide password'))
    expect(input.type).toBe('password')
  })

  it('does not update state after unmounting while the session check is still pending', async () => {
    const pending = Promise.withResolvers<{ ok: boolean; json: () => Promise<unknown> }>()
    fetchMock.mockReturnValueOnce(pending.promise)
    vi.stubGlobal('fetch', fetchMock)
    const { unmount, container } = render(<LoginGateOverlay />)
    unmount()
    pending.resolve({ ok: true, json: async () => ({ authenticated: false, required: true }) })
    await Promise.resolve()
    await Promise.resolve()
    expect(container.innerHTML).toBe('')
  })

  it('auto-dismisses the error toast after its hold-and-fade cycle', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ authenticated: false, required: true }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<LoginGateOverlay />)
    await act(async () => { await vi.runOnlyPendingTimersAsync() })
    const input = screen.getByPlaceholderText('Password')

    fetchMock.mockResolvedValueOnce({ ok: false })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'wrong' } })
      fireEvent.click(screen.getByText('Unlock'))
      await vi.runOnlyPendingTimersAsync()
    })
    expect(screen.getByText('Incorrect password')).toBeDefined()
    await act(async () => { await vi.advanceTimersByTimeAsync(4001) })
    expect(screen.queryByText('Incorrect password')).toBeNull()
    vi.useRealTimers()
  })
})
