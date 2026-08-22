// Myai Developer mark: the code-bracket glyph alone, for standalone/decorative use
// (hero empty state, rail, etc.) apart from the full wordmark. Native square. Ink
// rides currentColor so it follows the surrounding text color. Geometry mirrors
// the glyph inside the BrandWordmark plate so every mark stays one family.

import type { IconProps } from './icons/props.ts'

/**
 * Render the standalone brand mark (no wordmark text).
 * @param props.size - width and height in px (default 24; square aspect ratio).
 * @param props.className - extra class for layout placement.
 * @returns the mark svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="2.04" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M7.44 8.88 4.2 12l3.24 3.12" />
        <path d="m16.56 15.12 3.24-3.12-3.24-3.12" />
        <path d="M13.8 5.76 10.2 18.24" />
      </g>
    </svg>
  )
}
