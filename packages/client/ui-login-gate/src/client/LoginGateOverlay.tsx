/**
 * Full-page login overlay: checks `/auth/session` once on mount, renders
 * nothing when the gate is inactive or the browser is already authenticated,
 * otherwise blocks the app behind `OnboardingSurface` until the right
 * password is submitted.
 */
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BrandWordmark, Button, Input, OnboardingSurface, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import { checkSession, login } from './session-client.ts'
import css from './LoginGateOverlay.module.css'

type GateState = 'checking' | 'open' | 'gated' | 'submitting'

/** A minimal open-eye glyph (reveal-password affordance, "show"). */
function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** A minimal crossed-out eye glyph (reveal-password affordance, "hide"). */
function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

/** Brand mark: rounded dark plate + thick white code glyph (the black logo). */
function BrandMark() {
  return (
    <svg width="72" height="72" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="22" fill="#1a1a1a" />
      <rect x="4" y="4" width="92" height="92" rx="22" fill="none" stroke="#262626" strokeWidth="1.5" />
      <g stroke="#ffffff" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M31 37 17.5 50 31 63" />
        <path d="m69 63 12.5-13-12.5-13" />
        <path d="M57.5 24 42.5 76" />
      </g>
    </svg>
  )
}

/** Render the login overlay (or nothing, once resolved open). */
export function LoginGateOverlay() {
  const [state, setState] = useState<GateState>('checking')
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void checkSession().then((status) => {
      if (cancelled) return
      setState(status.required && !status.authenticated ? 'gated' : 'open')
    })
    return () => { cancelled = true }
  }, [])

  if (state === 'checking' || state === 'open') return null

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    setState('submitting')
    setError(undefined)
    void login(password).then((ok) => {
      if (ok) {
        setState('open')
        return
      }
      setError('Incorrect password')
      setState('gated')
    })
  }

  return (
    <OnboardingSurface>
      <div className={css.panel}>
        <BrandMark />
        <div style={{ marginTop: -8 }}>
          <BrandWordmark size={40} textOnly />
        </div>
        <p className={css.heading}>Restricted Access &mdash; MyAI CODE</p>
        <form className={css.form} onSubmit={submit}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Input
              type={revealed ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value) }}
              placeholder="Password"
              autoFocus
              disabled={state === 'submitting'}
            />
            <button
              type="button"
              className={css.reveal}
              onClick={() => { setRevealed(current => !current) }}
              aria-label={revealed ? 'Hide password' : 'Show password'}
            >
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <Button type="submit" variant="primary" disabled={state === 'submitting' || password.length === 0}>
            Unlock
          </Button>
        </form>
      </div>
      {error !== undefined && <Toast text={error} onDone={() => { setError(undefined) }} />}
    </OnboardingSurface>
  )
}
