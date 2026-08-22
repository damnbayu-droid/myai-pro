// Myai Developer brand wordmark: a code-bracket mark plus wordmark text in one svg.
// Native 116x24. Text rides currentColor so it follows the active theme; the
// mark's own dark plate and white glyph stay fixed regardless of theme. The
// "CODE" suffix rides a badge plate (currentColor fill) with knocked-out
// inverted label text, echoing the HARNESS badge of the upstream DeepSeek
// Harness wordmark.

import type { IconProps } from './icons/props.ts'

/** Brand wordmark props: size/className plus presentation switches. */
export interface BrandWordmarkProps extends IconProps {
  /** Plate color scheme: 'dark' (default, #1a1a1a plate / white glyph) or 'light' (reverse). */
  variant?: 'dark' | 'light'
  /** Render just "MyAI CODE" (no mark plate) — for spots where the standalone mark sits separately. */
  textOnly?: boolean
  /** Upstream-compatible alias: false renders text-only (no mark plate). */
  includeMark?: boolean
}

/**
 * Render the full brand wordmark.
 * @param props.size - height in px (default 24; width keeps the 116:24 ratio).
 * @param props.className - extra class for layout placement.
 * @param props.variant - plate color scheme: 'dark' (default, #1a1a1a plate /
 *   white glyph) or 'light' (reverse: white plate / near-black glyph).
 * @param props.textOnly - render just "MyAI CODE" (no mark plate) — for spots
 *   where the standalone mark sits separately (e.g. the login gate).
 * @param props.includeMark - false renders text-only (upstream `OfficialBrandName` contract).
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className, variant = 'dark', textOnly = false, includeMark }: BrandWordmarkProps) {
  const textOnlyFinal = textOnly || includeMark === false
  const plate = variant === 'dark' ? '#1a1a1a' : '#ffffff'
  const plateBorder = variant === 'dark' ? '#262626' : '#d9d9d9'
  const glyph = variant === 'dark' ? '#ffffff' : '#0a0a0a'
  const textX = textOnlyFinal ? 0 : 30
  return (
    <svg
      width={textOnlyFinal ? (size * 86) / 24 : (size * 116) / 24}
      height={size}
      className={className}
      viewBox={`0 0 ${textOnlyFinal ? 86 : 116} 24`}
      fill="none"
      aria-hidden="true"
    >
      {!textOnly && (
        <>
          <rect x="0.5" y="0.5" width="23" height="23" rx="5.3" fill={plate} />
          <rect x="0.5" y="0.5" width="23" height="23" rx="5.3" fill="none" stroke={plateBorder} strokeWidth="0.36" />
          <g stroke={glyph} strokeWidth="2.04" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M7.44 8.88 4.2 12l3.24 3.12" />
            <path d="m16.56 15.12 3.24-3.12-3.24-3.12" />
            <path d="M13.8 5.76 10.2 18.24" />
          </g>
        </>
      )}
      <text x={textX} y="17" fontFamily="Arial, Helvetica, sans-serif" fontSize="13" fontWeight="700" fill="currentColor">
        MyAI
      </text>
      <rect x={textOnly ? 36 : 66} y="4.5" width="47" height="15" rx="4.5" fill="currentColor" />
      <text
        x={textOnly ? 59.5 : 89.5}
        y="15.6"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="10"
        fontWeight="800"
        letterSpacing="0.6"
        fill="var(--dsw-alias-label-primary-inverted)"
      >
        CODE
      </text>
    </svg>
  )
}
