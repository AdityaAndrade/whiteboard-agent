import { MdView } from './ExportModal'

// ─── geometry constants ───────────────────────────────────────
const NW = 160   // node width
const NH = 50    // node height
const RX = 10    // corner radius

interface NodeSpec {
  id: string; label: string; sub: string; g: string; t: string
  cx: number; cy: number; nd: number // nd = entrance animation delay (ms)
}

const NODES: NodeSpec[] = [
  { id: 'trigger',  label: 'Support email',       sub: 'TRIGGER',      g: '▶', t: '--t-trigger',      cx: 90,  cy: 125, nd: 0   },
  { id: 'orch',     label: 'Triage orchestrator', sub: 'ORCHESTRATOR', g: '◈', t: '--t-orchestrator', cx: 325, cy: 125, nd: 150 },
  { id: 'kb',       label: 'Help center KB',      sub: 'DATA SOURCE',  g: '▤', t: '--t-data',         cx: 325, cy: 195, nd: 300 },
  { id: 'billing',  label: 'Billing agent',       sub: 'AGENT',        g: '✦', t: '--t-agent',        cx: 555, cy: 72,  nd: 450 },
  { id: 'tech',     label: 'Tech support',        sub: 'AGENT',        g: '✦', t: '--t-agent',        cx: 555, cy: 158, nd: 600 },
  { id: 'output',   label: 'Reply to customer',   sub: 'OUTPUT',       g: '◎', t: '--t-output',       cx: 785, cy: 125, nd: 750 },
]

type Pt = { x: number; y: number }
const rp = (n: NodeSpec): Pt => ({ x: n.cx + NW / 2, y: n.cy })
const lp = (n: NodeSpec): Pt => ({ x: n.cx - NW / 2, y: n.cy })
const bp = (n: NodeSpec): Pt => ({ x: n.cx, y: n.cy + NH / 2 })
const tp = (n: NodeSpec): Pt => ({ x: n.cx, y: n.cy - NH / 2 })
const hcurve = (a: Pt, b: Pt) => {
  const mx = (a.x + b.x) / 2
  return `M${a.x} ${a.y}C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`
}

const [TRG, ORC, KB, BIL, TEC, OUT] = NODES

interface EdgeSpec { id: string; d: string; ed: number }

const EDGES: EdgeSpec[] = [
  { id: 'e1', d: `M${rp(TRG).x} ${rp(TRG).y}L${lp(ORC).x} ${lp(ORC).y}`, ed: 950  },
  { id: 'e2', d: `M${tp(KB).x} ${tp(KB).y}L${bp(ORC).x} ${bp(ORC).y}`,    ed: 1080 },
  { id: 'e3', d: hcurve(rp(ORC), lp(BIL)),                                 ed: 1180 },
  { id: 'e4', d: hcurve(rp(ORC), lp(TEC)),                                 ed: 1280 },
  { id: 'e5', d: hcurve(rp(BIL), lp(OUT)),                                 ed: 1380 },
  { id: 'e6', d: hcurve(rp(TEC), lp(OUT)),                                 ed: 1480 },
]

const STACK = ['Claude Sonnet 4.5', 'Claude Agent SDK', 'Pinecone (via KB)']

// ─── component ───────────────────────────────────────────────
interface Props { step: number; md: string }

export function HowItWorksDemo({ step, md }: Props) {
  const isAnim = step === 0

  return (
    <div
      className="wb-theme"
      style={{ background: 'var(--bg)', animation: 'hiw-fade 0.3s ease both' }}
    >
      {step === 2 ? (
        // ── Step 2: exported markdown ──────────────────────────────
        <div style={{ aspectRatio: '875 / 240', overflow: 'hidden', display: 'flex' }}>
          <MdView md={md} />
        </div>
      ) : (
        // ── Step 0 + 1: SVG diagram ────────────────────────────────
        <div className="relative" style={{ aspectRatio: '875 / 240' }}>
          <svg
            viewBox="0 0 875 240"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            aria-hidden="true"
          >
            <defs>
              <marker id="hiw-arr" markerWidth="7" markerHeight="7" refX="6.5" refY="3.5" orient="auto">
                <path d="M0 1 L6 3.5 L0 6Z" style={{ fill: 'var(--ink-faint)' }} />
              </marker>
            </defs>

            {/* edges */}
            {EDGES.map(e => (
              <path
                key={e.id}
                d={e.d}
                fill="none"
                markerEnd="url(#hiw-arr)"
                pathLength="1"
                style={{
                  stroke: 'var(--line)',
                  strokeWidth: 1.5,
                  ...(isAnim ? {
                    strokeDasharray: 1,
                    strokeDashoffset: 1,
                    opacity: 0,
                    animation: `hiw-edge 0.5s ease-out ${e.ed}ms forwards`,
                  } : {}),
                }}
              />
            ))}


            {/* nodes */}
            {NODES.map(n => {
              const lx = n.cx - NW / 2
              const ty = n.cy - NH / 2
              const badgeCx = lx + 25
              const textX = lx + 48

              return (
                <g
                  key={n.id}
                  style={isAnim ? {
                    opacity: 0,
                    animation: `hiw-node 0.38s ease-out ${n.nd}ms forwards`,
                  } : undefined}
                >
                  <rect
                    x={lx} y={ty} width={NW} height={NH} rx={RX}
                    style={{ fill: 'var(--surface)', stroke: 'var(--line)', strokeWidth: 1.5 }}
                  />
                  <clipPath id={`hiw-clip-${n.id}`}>
                    <rect x={lx} y={ty} width={NW} height={NH} rx={RX} />
                  </clipPath>
                  <rect
                    x={lx} y={ty} width={4} height={NH}
                    clipPath={`url(#hiw-clip-${n.id})`}
                    style={{ fill: `var(${n.t})` }}
                  />
                  <circle cx={badgeCx} cy={n.cy} r={13} style={{ fill: `var(${n.t})` }} />
                  <text
                    x={badgeCx} y={n.cy + 5}
                    textAnchor="middle"
                    style={{ fontSize: 12, fill: 'white', userSelect: 'none' }}
                  >
                    {n.g}
                  </text>
                  <text
                    x={textX} y={n.cy - 4}
                    style={{
                      fontSize: 11, fontWeight: 600,
                      fill: 'var(--ink)',
                      fontFamily: 'Hanken Grotesk, sans-serif',
                    }}
                  >
                    {n.label}
                  </text>
                  <text
                    x={textX} y={n.cy + 10}
                    style={{
                      fontSize: 8, fontWeight: 700,
                      fill: `var(${n.t})`,
                      fontFamily: 'JetBrains Mono, monospace',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {n.sub}
                  </text>
                  {/* selection ring on orchestrator in step 1 */}
                  {step === 1 && n.id === 'orch' && (
                    <rect
                      x={lx - 3} y={ty - 3} width={NW + 6} height={NH + 6} rx={RX + 3}
                      style={{
                        fill: 'none',
                        stroke: 'var(--accent)',
                        strokeWidth: 2.5,
                        opacity: 0,
                        animation: 'hiw-fade 0.3s ease 80ms both',
                      }}
                    />
                  )}
                </g>
              )
            })}
          </svg>

          {/* step 1: inspector panel */}
          {step === 1 && (
            <div
              className="absolute top-4 right-4 bottom-4 w-48 rounded-xl border shadow-xl overflow-hidden flex flex-col"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--accent-line)',
                opacity: 0,
                animation: 'hiw-slide-r 0.35s ease-out 120ms both',
              }}
            >
              <div
                className="px-3.5 py-3 flex items-center gap-2.5 flex-none border-b"
                style={{ borderColor: 'var(--line)' }}
              >
                <span
                  className="flex-none rounded-full flex items-center justify-center"
                  style={{
                    background: 'var(--t-orchestrator)', color: 'white',
                    width: 26, height: 26, fontSize: 12,
                  }}
                >
                  ◈
                </span>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, margin: 0 }}>
                    Triage orchestrator
                  </p>
                  <p style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', margin: 0,
                    color: 'var(--t-orchestrator)', fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    ORCHESTRATOR
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-3 flex-none">
                <p style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: 'var(--ink-faint)', margin: '0 0 8px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  Stack
                </p>
                <div className="flex flex-col gap-1.5">
                  {STACK.map((item, i) => (
                    <span
                      key={item}
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        background: 'var(--accent-soft)',
                        color: 'var(--accent-ink)',
                        display: 'inline-block',
                        fontSize: 11,
                        opacity: 0,
                        animation: `hiw-up 0.25s ease ${280 + i * 130}ms both`,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="px-3.5 pb-3">
                <p style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: 'var(--ink-faint)', margin: '0 0 5px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  Role
                </p>
                <p style={{
                  fontSize: 11, lineHeight: 1.55, color: 'var(--ink-2)', margin: 0,
                  opacity: 0, animation: 'hiw-fade 0.3s ease 580ms both',
                }}>
                  Classifies the request and routes it to the right specialist agent.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
