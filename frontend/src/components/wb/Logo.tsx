interface LogoMarkProps {
  size?: number
  radius?: number
}

/** Converging-workflow glyph: two input circles flowing into one larger agent circle. */
export function LogoMark({ size = 28, radius }: LogoMarkProps) {
  const r = radius != null ? radius : Math.round(size * 0.3)
  return (
    <span className="brand-mark" style={{ width: size, height: size, borderRadius: r }}>
      <svg
        width={size * 0.66}
        height={size * 0.66}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
      >
        <line x1="7.5" y1="6.5" x2="16.5" y2="12" />
        <line x1="7.5" y1="17.5" x2="16.5" y2="12" />
        <circle cx="7.5" cy="6.5" r="2.4" fill="#fff" stroke="none" />
        <circle cx="7.5" cy="17.5" r="2.4" fill="#fff" stroke="none" />
        <circle cx="16.5" cy="12" r="3" fill="var(--accent)" stroke="#fff" strokeWidth="2.1" />
      </svg>
    </span>
  )
}

interface LogoProps {
  markSize?: number
  sub?: string | null
}

export function Logo({ markSize = 28, sub = 'workflow studio' }: LogoProps) {
  return (
    <div className="brand">
      <LogoMark size={markSize} />
      <span className="wordmark">
        whiteboard<span className="wm-accent">-agent</span>
      </span>
      {sub && <span className="brand-sub">{sub}</span>}
    </div>
  )
}
