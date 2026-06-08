import type { Project } from '@/types'
import { NODE_TYPES } from '@/lib/wb-data'

const W = 218
const H = 96

export function ThumbGraph({ project }: { project: Project }) {
  const { nodes, edges } = project
  if (!nodes.length) {
    return (
      <div
        style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          color: 'var(--ink-faint)', fontSize: 12, fontFamily: 'var(--mono)',
        }}
      >
        empty
      </div>
    )
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + W)
    maxY = Math.max(maxY, n.y + H)
  })
  const pad = 40
  const bw = maxX - minX + pad * 2
  const bh = maxY - minY + pad * 2
  const pos: Record<string, { x: number; y: number }> = {}
  nodes.forEach((n) => {
    pos[n.id] = { x: n.x - minX + pad + W / 2, y: n.y - minY + pad + H / 2 }
  })

  return (
    <svg viewBox={`0 0 ${bw} ${bh}`} preserveAspectRatio="xMidYMid meet">
      {edges.map((e) => {
        const a = pos[e.from], b = pos[e.to]
        if (!a || !b) return null
        return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--edge)" strokeWidth={3} />
      })}
      {nodes.map((n) => {
        const p = pos[n.id]
        const tint = `var(${NODE_TYPES[n.type].token})`
        return (
          <g key={n.id}>
            <rect x={p.x - W / 2} y={p.y - H / 2} width={W} height={H} rx={14} fill="var(--surface)" stroke={tint} strokeWidth={3} />
            <rect x={p.x - W / 2} y={p.y - H / 2} width={8} height={H} rx={4} fill={tint} />
          </g>
        )
      })}
    </svg>
  )
}
