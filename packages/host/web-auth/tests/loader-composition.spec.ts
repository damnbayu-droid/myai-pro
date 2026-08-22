/**
 * Real-composition guard: webserver, credentials-local, and web-auth boot
 * from a test-only cordis.yml through the actual Loader + Include path, and
 * every assertion observes actual HTTP/WS round-trips against the running
 * server — no password configured passes every surface through unchanged;
 * setting one (as the CLI's `--set-password-stdin` does) gates `/api/*` and
 * both HTTP and upgrade dispatch behind a session cookie; `enabled: false`
 * keeps the gate off even with a password stored.
 */

import { once } from 'node:events'
import { connect } from 'node:net'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import LocalCredentialProvider from '@deepseek-ai/dsh-credentials-local'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import * as WebAuth from '../src/index.ts'
import { hashPassword } from '../src/crypto.ts'

const PASSWORD_HASH_REF = credentialRef('DSH_WEB_AUTH_PASSWORD_HASH')
const SESSION_SECRET_REF = credentialRef('DSH_WEB_AUTH_SESSION_SECRET')
const FAST_SCRYPT = { N: 2 ** 10, r: 8, p: 1 }

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function loadComposition(options?: { enabled?: boolean; sessionTtlMs?: number }): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-web-auth-composition-'))
  const credentialsPath = join(root, '.credentials.yaml')
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-host-webserver'",
    '  config:',
    "    host: '127.0.0.1'",
    '    port: 0',
    "- name: '@deepseek-ai/dsh-credentials-local'",
    '  config:',
    `    path: ${JSON.stringify(credentialsPath)}`,
    '    debounceMs: 10',
    "- name: '@deepseek-ai/dsh-host-web-auth'",
    '  config:',
    `    enabled: ${String(options?.enabled ?? true)}`,
    ...options?.sessionTtlMs === undefined ? [] : [`    sessionTtlMs: ${String(options.sessionTtlMs)}`],
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-host-webserver', WebServer],
    ['@deepseek-ai/dsh-credentials-local', LocalCredentialProvider],
    ['@deepseek-ai/dsh-host-web-auth', WebAuth],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()

  // A probe route standing in for the composing bundle's real /api owner.
  context.webServer.register({ kind: 'prefix', path: '/api', handler: (_req, res) => { res.writeHead(200); res.end('API') } })
  context.webServer.registerUpgrade({
    path: '/api/events.mux',
    handler: (_req, socket) => { socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: dsh-test\r\n\r\n') },
  })
  return context
}

interface HttpResult { status: number; body: string; setCookie: string | undefined }

async function request(port: number, path: string, init?: RequestInit): Promise<HttpResult> {
  const response = await fetch(`http://127.0.0.1:${String(port)}${path}`, init)
  return { status: response.status, body: await response.text(), setCookie: response.headers.get('set-cookie') ?? undefined }
}

function cookiePair(setCookie: string): string {
  return setCookie.split(';')[0]!
}

async function upgrade(port: number, path: string, cookie?: string): Promise<{ status: string; socket: ReturnType<typeof connect> }> {
  const socket = connect(port, '127.0.0.1')
  await once(socket, 'connect')
  const dataPromise = once(socket, 'data')
  socket.write([
    `GET ${path} HTTP/1.1`,
    `Host: 127.0.0.1:${String(port)}`,
    'Connection: Upgrade',
    'Upgrade: dsh-test',
    ...cookie === undefined ? [] : [`Cookie: ${cookie}`],
    '',
    '',
  ].join('\r\n'))
  const [data] = await dataPromise as [Buffer]
  return { status: String(data).split('\r\n')[0] ?? '', socket }
}

describe('web-auth real Loader composition', () => {
  it('passes every surface through unchanged while no password is configured', async () => {
    const ctx = await loadComposition()
    const port = ctx.webServer.port

    expect(await request(port, '/api/anything')).toMatchObject({ status: 200, body: 'API' })
    expect(await request(port, '/auth/session')).toMatchObject({ status: 200, body: JSON.stringify({ authenticated: false, required: false }) })
    const { status } = await upgrade(port, '/api/events.mux')
    expect(status).toContain('101 Switching Protocols')
  })

  it('answers /auth/login with 503 while no password is configured, and 404 for an unmatched /auth path', async () => {
    const ctx = await loadComposition()
    const port = ctx.webServer.port
    const login = await request(port, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'x' }) })
    expect(login).toMatchObject({ status: 503, body: JSON.stringify({ ok: false, error: 'not configured' }) })
    expect((await request(port, '/auth/unknown')).status).toBe(404)
  })

  it('rejects a login body with no password field, an empty body, and an oversized body', async () => {
    const ctx = await loadComposition()
    const port = ctx.webServer.port
    await ctx.credentials.set(PASSWORD_HASH_REF, hashPassword('correct horse battery staple', FAST_SCRYPT))

    expect((await request(port, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })).status).toBe(401)
    expect((await request(port, '/auth/login', { method: 'POST' })).status).toBe(401)
    expect((await request(port, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not valid json{' })).status).toBe(401)
    const oversized = JSON.stringify({ password: 'x'.repeat(5000) })
    expect((await request(port, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: oversized })).status).toBe(401)
  })

  it('gates /api and both dispatch surfaces once a password is stored, via login/replay/logout', async () => {
    const ctx = await loadComposition()
    const port = ctx.webServer.port
    await ctx.credentials.set(PASSWORD_HASH_REF, hashPassword('correct horse battery staple', FAST_SCRYPT))

    // Unauthenticated: /api is denied, the auth-status probe reports it.
    expect((await request(port, '/api/anything')).status).toBe(401)
    expect(await request(port, '/auth/session')).toMatchObject({ status: 200, body: JSON.stringify({ authenticated: false, required: true }) })
    const deniedUpgrade = await upgrade(port, '/api/events.mux')
    expect(deniedUpgrade.status).toContain('401')
    deniedUpgrade.socket.destroy()

    // Wrong password: rejected, no cookie issued.
    const wrong = await request(port, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) })
    expect(wrong.status).toBe(401)
    expect(wrong.setCookie).toBeUndefined()

    // Right password: session cookie issued, and it unlocks every surface.
    const login = await request(port, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'correct horse battery staple' }) })
    expect(login.status).toBe(200)
    expect(login.setCookie).toBeDefined()
    const cookie = cookiePair(login.setCookie!)

    expect(await request(port, '/api/anything', { headers: { cookie } })).toMatchObject({ status: 200, body: 'API' })
    expect(await request(port, '/auth/session', { headers: { cookie } })).toMatchObject({ status: 200, body: JSON.stringify({ authenticated: true, required: true }) })

    // A second login (e.g. a second browser tab) reuses the already-minted
    // session secret instead of generating a fresh one.
    const secretBefore = await ctx.credentials.resolve(SESSION_SECRET_REF)
    const secondLogin = await request(port, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'correct horse battery staple' }) })
    expect(secondLogin.status).toBe(200)
    expect(await ctx.credentials.resolve(SESSION_SECRET_REF)).toEqual(secretBefore)

    const acceptedUpgrade = await upgrade(port, '/api/events.mux', cookie)
    expect(acceptedUpgrade.status).toContain('101 Switching Protocols')
    acceptedUpgrade.socket.destroy()

    // Logout clears the cookie; the cleared cookie no longer authenticates.
    const logout = await request(port, '/auth/logout', { method: 'POST' })
    expect(logout.status).toBe(200)
    const clearedCookie = cookiePair(logout.setCookie!)
    expect(clearedCookie).toBe('dsh_web_auth=')
    expect((await request(port, '/api/anything', { headers: { cookie: clearedCookie } })).status).toBe(401)
  })

  it('enforces session expiry', async () => {
    const ctx = await loadComposition({ sessionTtlMs: 50 })
    const port = ctx.webServer.port
    await ctx.credentials.set(PASSWORD_HASH_REF, hashPassword('short-lived', FAST_SCRYPT))

    const login = await request(port, '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'short-lived' }) })
    const cookie = cookiePair(login.setCookie!)
    expect((await request(port, '/api/anything', { headers: { cookie } })).status).toBe(200)

    await new Promise(resolve => setTimeout(resolve, 100))
    expect((await request(port, '/api/anything', { headers: { cookie } })).status).toBe(401)
  })

  it('never registers the guard when enabled is false, even with a password stored', async () => {
    const ctx = await loadComposition({ enabled: false })
    const port = ctx.webServer.port
    await ctx.credentials.set(PASSWORD_HASH_REF, hashPassword('ignored', FAST_SCRYPT))

    expect((await request(port, '/api/anything')).status).toBe(200)
    // /auth/* is only registered when the plugin is enabled.
    expect((await request(port, '/auth/session')).status).toBe(404)
  })
})
