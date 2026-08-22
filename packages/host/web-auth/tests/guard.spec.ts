import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { createGuard } from '../src/guard.ts'
import { mintSession } from '../src/session.ts'

const PASSWORD_HASH_REF = credentialRef('DSH_WEB_AUTH_PASSWORD_HASH')
const SESSION_SECRET_REF = credentialRef('DSH_WEB_AUTH_SESSION_SECRET')

function fakeCredentials(values: Record<string, string>) {
  return {
    resolve: async (ref: string) => ref in values ? { value: values[ref]!, source: 'test' } : undefined,
  } as never
}

function fakeRequest(url: string, cookie?: string): IncomingMessage {
  return { url, headers: { cookie } } as unknown as IncomingMessage
}

describe('createGuard', () => {
  it('allows a non-/api, non-/auth request even when a password is configured', async () => {
    const guard = createGuard({
      credentials: fakeCredentials({ [PASSWORD_HASH_REF]: 'some-hash' }),
      cookieName: 'dsh_web_auth',
      passwordHashRef: PASSWORD_HASH_REF,
      sessionSecretRef: SESSION_SECRET_REF,
    })
    expect(await guard(fakeRequest('/index.html'))).toEqual({ allow: true })
  })

  it('fails closed when a password is configured but the session secret is missing', async () => {
    const guard = createGuard({
      credentials: fakeCredentials({ [PASSWORD_HASH_REF]: 'some-hash' }),
      cookieName: 'dsh_web_auth',
      passwordHashRef: PASSWORD_HASH_REF,
      sessionSecretRef: SESSION_SECRET_REF,
    })
    const decision = await guard(fakeRequest('/api/anything', 'dsh_web_auth=whatever-token'))
    expect(decision).toMatchObject({ allow: false, status: 401 })
  })

  it('allows an /api request with a valid session', async () => {
    const secret = 'test-secret'
    const token = mintSession(secret, 60_000)
    const guard = createGuard({
      credentials: fakeCredentials({ [PASSWORD_HASH_REF]: 'some-hash', [SESSION_SECRET_REF]: secret }),
      cookieName: 'dsh_web_auth',
      passwordHashRef: PASSWORD_HASH_REF,
      sessionSecretRef: SESSION_SECRET_REF,
    })
    expect(await guard(fakeRequest('/api/anything', `dsh_web_auth=${token}`))).toEqual({ allow: true })
  })
})
