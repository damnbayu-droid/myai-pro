// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkSession, login, logout } from '../src/client/session-client.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('session-client', () => {
  it('checkSession reports inactive on a non-ok response instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await checkSession()).toEqual({ authenticated: false, required: false })
  })

  it('checkSession returns the parsed status on a 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ authenticated: true, required: true }) }))
    expect(await checkSession()).toEqual({ authenticated: true, required: true })
  })

  it('login posts the password and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    expect(await login('secret')).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ password: 'secret' }),
    }))
  })

  it('logout posts to /auth/logout', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await logout()
    expect(fetchMock).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({ method: 'POST' }))
  })
})
