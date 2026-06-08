import {
  useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState,
  type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent,
} from 'react'
import type { EditorActions } from '@/lib/use-project-editor'
import { NODE_TYPES, TYPE_ORDER } from '@/lib/wb-data'
import { curve, edgePath, DEF_H, NODE_W, type Rect } from '@/lib/wb-geometry'
import type { NodeType, Project, Selection, WBEdge, WBNode } from '@/types'
import { Icon } from './Icon'

// Small placement jitter so repeatedly double-clicking a palette entry doesn't stack
// nodes exactly on top of each other. Module-level (not component-body) since it's
// only ever invoked from an event handler, never during render.
function jitter(range: number) {
  return Math.random() * range - range / 2
}

interface NodeCardProps {
  node: WBNode
  selected: boolean
  connectTarget: boolean
  onPointerDown: (e: ReactPointerEvent, node: WBNode) => void
  onPortDown: (e: ReactPointerEvent, node: WBNode, side: 't' | 'r' | 'b' | 'l') => void
  onContext: (e: ReactPointerEvent | React.MouseEvent, node: WBNode) => void
  measureRef?: (el: HTMLDivElement | null) => void
}

function NodeCard({ node, selected, connectTarget, onPointerDown, onPortDown, onContext, measureRef }: NodeCardProps) {
  const def = NODE_TYPES[node.type]
  const tint = `var(${def.token})`
  const shown = node.stack.slice(0, 4)
  const extra = node.stack.length - shown.length
  return (
    <div
      ref={measureRef}
      className={`node ${selected ? 'sel' : ''} ${connectTarget ? 'connect-target' : ''}`}
      style={{ left: node.x, top: node.y, '--tint': tint } as React.CSSProperties}
      onPointerDown={(e) => onPointerDown(e, node)}
      onContextMenu={(e) => onContext(e, node)}
      data-node-id={node.id}
    >
      <div className="node-head">
        <div className="node-badge"><span>{def.glyph}</span></div>
        <div className="node-titles">
          <div className="node-type">{def.label}</div>
          <div className="node-name">{node.name || 'Untitled'}</div>
        </div>
      </div>
      {node.desc && <div className="node-desc">{node.desc}</div>}
      {node.stack.length > 0 && (
        <div className="node-stack">
          {shown.map((s, i) => <span key={i} className="node-chip">{s}</span>)}
          {extra > 0 && <span className="node-chip more">+{extra}</span>}
        </div>
      )}
      {(['t', 'r', 'b', 'l'] as const).map((side) => (
        <div key={side} className={`port ${side}`} onPointerDown={(e) => onPortDown(e, node, side)} />
      ))}
    </div>
  )
}

interface EdgeLabelProps {
  edge: WBEdge
  mid: { x: number; y: number }
  selected: boolean
  actions: EditorActions
  onSelect: () => void
}

function EdgeLabel({ edge, mid, selected, actions, onSelect }: EdgeLabelProps) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(edge.label)
  // Re-sync the edit buffer when the edge's label changes externally (e.g. undo/redo) —
  // adjusted during render rather than in an effect, per https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevLabel, setPrevLabel] = useState(edge.label)
  if (edge.label !== prevLabel) {
    setPrevLabel(edge.label)
    setVal(edge.label)
  }
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      ref.current.select()
    }
  }, [editing])
  const commit = () => {
    setEditing(false)
    actions.updateEdge(edge.id, { label: val.trim() })
  }
  if (!edge.label && !editing && !selected) {
    return (
      <div
        className="edge-label placeholder"
        style={{ left: mid.x, top: mid.y }}
        onPointerDown={(e) => { e.stopPropagation(); onSelect(); setEditing(true) }}
      >
        + note
      </div>
    )
  }
  return (
    <div
      className={`edge-label ${selected ? 'sel' : ''}`}
      style={{ left: mid.x, top: mid.y }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect() }}
      onDoubleClick={() => setEditing(true)}
    >
      {editing ? (
        <input
          ref={ref}
          value={val}
          placeholder="label…"
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setVal(edge.label); setEditing(false) }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (edge.label || '+ note')}
    </div>
  )
}

interface TempEdge { fromId: string; sx: number; sy: number; x: number; y: number; targetId: string | null }
interface Ghost { type: NodeType; x: number; y: number }
interface CtxMenu { x: number; y: number; node: WBNode }

interface CanvasProps {
  project: Project
  selection: Selection
  setSelection: (s: Selection) => void
  actions: EditorActions
}

export function Canvas({ project, selection, setSelection, actions }: CanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const sizesRef = useRef<Record<string, { w: number; h: number }>>({})
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [temp, setTemp] = useState<TempEdge | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [ctx, setCtx] = useState<CtxMenu | null>(null)
  const view = project.view

  /* measure node sizes after render */
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let changed = false
    stage.querySelectorAll<HTMLElement>('.node').forEach((el) => {
      const id = el.getAttribute('data-node-id')
      if (!id) return
      const w = el.offsetWidth, h = el.offsetHeight
      const prev = sizesRef.current[id]
      if (!prev || prev.w !== w || prev.h !== h) { sizesRef.current[id] = { w, h }; changed = true }
    })
    if (changed) force()
  })

  const sizeOf = (id: string) => sizesRef.current[id] || { w: NODE_W, h: DEF_H }
  const rectOf = (n: WBNode): Rect => ({ x: n.x, y: n.y, ...sizeOf(n.id) })

  const toWorld = useCallback((cx: number, cy: number) => {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z }
  }, [view.x, view.y, view.z])

  /* ---------------- panning ---------------- */
  const panState = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null)
  function onStagePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button === 2) return
    const target = e.target as HTMLElement
    if (target.closest('.node') || target.closest('.edge-label')) return
    setSelection(null)
    setCtx(null)
    const stage = stageRef.current!
    stage.classList.add('panning')
    panState.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
    const move = (ev: PointerEvent) => {
      const p = panState.current; if (!p) return
      actions.setView({ ...view, x: p.vx + (ev.clientX - p.sx), y: p.vy + (ev.clientY - p.sy) })
    }
    const up = () => {
      panState.current = null
      stage.classList.remove('panning')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* ---------------- wheel zoom / pan ---------------- */
  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const r = stageRef.current!.getBoundingClientRect()
      const mx = e.clientX - r.left, my = e.clientY - r.top
      const factor = Math.exp(-e.deltaY * 0.0016)
      const z2 = Math.min(2.4, Math.max(0.25, view.z * factor))
      const k = z2 / view.z
      actions.setView({ z: z2, x: mx - (mx - view.x) * k, y: my - (my - view.y) * k })
    } else {
      actions.setView({ ...view, x: view.x - e.deltaX, y: view.y - e.deltaY })
    }
  }

  /* ---------------- node drag ---------------- */
  function onNodePointerDown(e: ReactPointerEvent, node: WBNode) {
    if (e.button === 2) return
    e.stopPropagation()
    setSelection({ type: 'node', id: node.id })
    setCtx(null)
    const start = { mx: e.clientX, my: e.clientY, nx: node.x, ny: node.y }
    let moved = false
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.mx) / view.z, dy = (ev.clientY - start.my) / view.z
      if (!moved && Math.hypot(ev.clientX - start.mx, ev.clientY - start.my) > 3) {
        moved = true
        actions.beginInteraction()
      }
      if (moved) actions.live((d) => {
        const n = d.nodes.find((x) => x.id === node.id)
        if (n) { n.x = Math.round(start.nx + dx); n.y = Math.round(start.ny + dy) }
      })
    }
    const up = () => {
      if (moved) actions.commitInteraction()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* ---------------- connecting ---------------- */
  function onPortDown(e: ReactPointerEvent, node: WBNode, side: 't' | 'r' | 'b' | 'l') {
    e.stopPropagation()
    e.preventDefault()
    const r = rectOf(node)
    const start = {
      x: r.x + (side === 'l' ? 0 : side === 'r' ? r.w : r.w / 2),
      y: r.y + (side === 't' ? 0 : side === 'b' ? r.h : r.h / 2),
    }
    stageRef.current!.classList.add('connecting')
    setTemp({ fromId: node.id, sx: start.x, sy: start.y, x: start.x, y: start.y, targetId: null })
    const move = (ev: PointerEvent) => {
      const w = toWorld(ev.clientX, ev.clientY)
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const targetEl = el && (el as HTMLElement).closest('.node')
      const tid = targetEl ? targetEl.getAttribute('data-node-id') : null
      setTemp((t) => t && ({ ...t, x: w.x, y: w.y, targetId: tid && tid !== node.id ? tid : null }))
    }
    const up = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const targetEl = el && (el as HTMLElement).closest('.node')
      const tid = targetEl ? targetEl.getAttribute('data-node-id') : null
      if (tid && tid !== node.id) actions.addEdge(node.id, tid)
      stageRef.current!.classList.remove('connecting')
      setTemp(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* ---------------- palette drag / click ---------------- */
  function startPaletteDrag(e: ReactPointerEvent, type: NodeType) {
    e.preventDefault()
    setGhost({ type, x: e.clientX, y: e.clientY })
    const move = (ev: PointerEvent) => setGhost({ type, x: ev.clientX, y: ev.clientY })
    const up = (ev: PointerEvent) => {
      const r = stageRef.current!.getBoundingClientRect()
      const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
      if (inside) {
        const w = toWorld(ev.clientX, ev.clientY)
        actions.addNode(type, Math.round(w.x - NODE_W / 2), Math.round(w.y - DEF_H / 2))
      }
      setGhost(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  function clickPalette(type: NodeType) {
    const r = stageRef.current!.getBoundingClientRect()
    const w = toWorld(r.left + r.width / 2, r.top + r.height / 2)
    actions.addNode(
      type,
      Math.round(w.x - NODE_W / 2 + jitter(40)),
      Math.round(w.y - DEF_H / 2 + jitter(40)),
    )
  }

  /* ---------------- context menu ---------------- */
  function onNodeContext(e: ReactPointerEvent | React.MouseEvent, node: WBNode) {
    e.preventDefault(); e.stopPropagation()
    setSelection({ type: 'node', id: node.id })
    setCtx({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY, node })
  }
  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    window.addEventListener('pointerdown', close, { capture: true })
    return () => window.removeEventListener('pointerdown', close, { capture: true })
  }, [ctx])

  /* ---------------- zoom buttons ---------------- */
  function zoomBy(f: number) {
    const r = stageRef.current!.getBoundingClientRect()
    const mx = r.width / 2, my = r.height / 2
    const z2 = Math.min(2.4, Math.max(0.25, view.z * f))
    const k = z2 / view.z
    actions.setView({ z: z2, x: mx - (mx - view.x) * k, y: my - (my - view.y) * k })
  }
  const fitView = useCallback(() => {
    const nodes = project.nodes
    const r = stageRef.current!.getBoundingClientRect()
    if (!nodes.length) { actions.setView({ x: 0, y: 0, z: 1 }); return }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    nodes.forEach((n) => {
      const s = sizeOf(n.id)
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + s.w); maxY = Math.max(maxY, n.y + s.h)
    })
    const pad = 90
    const z = Math.min(1.3, Math.min((r.width - pad * 2) / (maxX - minX), (r.height - pad * 2) / (maxY - minY)))
    const zz = Math.max(0.25, z || 1)
    actions.setView({ z: zz, x: r.width / 2 - ((minX + maxX) / 2) * zz, y: r.height / 2 - ((minY + maxY) / 2) * zz })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.nodes])

  const byId = useMemo(() => {
    const m: Record<string, WBNode> = {}
    project.nodes.forEach((n) => (m[n.id] = n))
    return m
  }, [project.nodes])

  return (
    <div
      ref={stageRef}
      className="stage grid-dots cards-plain"
      onPointerDown={onStagePointerDown}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* world */}
      <div className="world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
        {/* edges */}
        <svg className="edges-svg">
          <defs>
            <marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
              <path d="M1,1 L8,4.5 L1,8 Z" fill="var(--edge)" />
            </marker>
            <marker id="ah-a" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
              <path d="M1,1 L8,4.5 L1,8 Z" fill="var(--accent)" />
            </marker>
          </defs>
          {/* rectOf reads sizesRef (measured in the useLayoutEffect above, which forces a
              render once sizes settle) so edges are routed against real, laid-out node
              dimensions rather than the NODE_W/DEF_H placeholder on first paint. */}
          {/* eslint-disable-next-line react-hooks/refs -- see comment above; measure-then-force-render is intentional and correctly synchronized */}
          {project.edges.map((e) => {
            const a = byId[e.from], b = byId[e.to]
            if (!a || !b) return null
            const { d } = edgePath(rectOf(a), rectOf(b))
            const sel = selection?.type === 'edge' && selection.id === e.id
            return (
              <g key={e.id} className={`edge-g ${sel ? 'edge-sel' : ''}`} style={{ pointerEvents: 'auto' }}>
                <path className="hit" d={d} onPointerDown={(ev) => { ev.stopPropagation(); setSelection({ type: 'edge', id: e.id }) }} />
                <path className="wire" d={d} markerEnd={`url(#${sel ? 'ah-a' : 'ah'})`} />
              </g>
            )
          })}
          {/* eslint-disable-next-line react-hooks/refs -- rectOf reads sizesRef; see comment above */}
          {temp && (() => {
            const a = byId[temp.fromId]; if (!a) return null
            const end = temp.targetId
              ? (() => { const t = rectOf(byId[temp.targetId!]); return { x: t.x + t.w / 2, y: t.y + t.h / 2 } })()
              : { x: temp.x, y: temp.y }
            const { d } = curve({ x: temp.sx, y: temp.sy }, end)
            return <path className="wire" d={d} style={{ stroke: 'var(--accent)', strokeDasharray: '6 5' }} markerEnd="url(#ah-a)" />
          })()}
        </svg>

        {/* edge labels (outside svg so they're crisp & clickable) */}
        {/* eslint-disable-next-line react-hooks/refs -- rectOf reads sizesRef; see comment above */}
        {project.edges.map((e) => {
          const a = byId[e.from], b = byId[e.to]
          if (!a || !b) return null
          const { mid } = edgePath(rectOf(a), rectOf(b))
          const sel = selection?.type === 'edge' && selection.id === e.id
          return <EdgeLabel key={`l${e.id}`} edge={e} mid={mid} selected={!!sel} actions={actions} onSelect={() => setSelection({ type: 'edge', id: e.id })} />
        })}

        {/* nodes */}
        {project.nodes.map((n) => (
          <NodeCard
            key={n.id}
            node={n}
            selected={selection?.type === 'node' && selection.id === n.id}
            connectTarget={temp?.targetId === n.id}
            onPointerDown={onNodePointerDown}
            onPortDown={onPortDown}
            onContext={onNodeContext}
          />
        ))}
      </div>

      {/* palette */}
      <div className="palette">
        <div className="pal-label">Drag</div>
        {TYPE_ORDER.map((type) => {
          const def = NODE_TYPES[type]
          return (
            <button
              key={type}
              className="pal-item"
              style={{ '--tint': `var(${def.token})` } as React.CSSProperties}
              onPointerDown={(e) => startPaletteDrag(e, type)}
              onDoubleClick={() => clickPalette(type)}
              title={def.label}
            >
              <span className="gl">{def.glyph}</span>
              <div className="pal-tip"><b>{def.label}</b><span>{def.hint}</span></div>
            </button>
          )
        })}
      </div>

      {/* empty hint */}
      {project.nodes.length === 0 && (
        <div className="hint-pill"><Icon name="arrow" size={14} /> Drag a node from the left to start your workflow</div>
      )}

      {/* bottom controls */}
      <div className="controls">
        <button className="ctrl-btn" onClick={() => zoomBy(1 / 1.2)} title="Zoom out"><Icon name="zoomOut" /></button>
        <span className="zlabel">{Math.round(view.z * 100)}%</span>
        <button className="ctrl-btn" onClick={() => zoomBy(1.2)} title="Zoom in"><Icon name="zoomIn" /></button>
        <span className="sep" />
        <button className="ctrl-btn" onClick={fitView} title="Fit to view"><Icon name="fit" /></button>
      </div>

      {/* drag ghost */}
      {ghost && (() => {
        const def = NODE_TYPES[ghost.type]
        return (
          <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
            <div className="node" style={{ position: 'static', width: NODE_W, '--tint': `var(${def.token})`, opacity: 0.92, transform: `scale(${view.z})` } as React.CSSProperties}>
              <div className="node-head">
                <div className="node-badge"><span>{def.glyph}</span></div>
                <div className="node-titles"><div className="node-type">{def.label}</div><div className="node-name">{def.defaults.name}</div></div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* context menu */}
      {ctx && (
        <div className="ctx" style={{ left: ctx.x, top: ctx.y }} onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => { actions.duplicateNode(ctx.node.id); setCtx(null) }}><Icon name="copy" size={14} /> Duplicate</button>
          <div className="ctx-sep" />
          <button className="danger" onClick={() => { actions.deleteNode(ctx.node.id); setCtx(null) }}><Icon name="trash" size={14} /> Delete node</button>
        </div>
      )}
    </div>
  )
}
