import { useEffect, useRef, useState } from 'react'
import type { EditorActions } from '@/lib/use-project-editor'
import { CATALOG, CATALOG_GROUPS, NODE_TYPES, TYPE_ORDER } from '@/lib/wb-data'
import type { Project, Selection, WBEdge, WBNode } from '@/types'
import { Btn } from './Button'
import { Icon } from './Icon'

/* ---------- stack chip picker ---------- */
interface StackPickerProps {
  value: string[]
  onToggle: (item: string) => void
  onAddCustom: (item: string) => void
  onClose: () => void
}

function StackPicker({ value, onToggle, onAddCustom, onClose }: StackPickerProps) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [onClose])
  const ql = q.trim().toLowerCase()
  const exactExists = CATALOG_GROUPS.some((g) => CATALOG[g].some((i) => i.toLowerCase() === ql))
  return (
    <div className="popover" ref={ref} style={{ position: 'relative', width: '100%', boxShadow: 'var(--sh-2)', marginTop: 8 }}>
      <div className="pop-search">
        <Icon name="search" size={14} />
        <input
          autoFocus
          placeholder="Search models, tools, integrations…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && ql && !exactExists) { onAddCustom(q.trim()); setQ('') } }}
        />
      </div>
      <div className="pop-list">
        {CATALOG_GROUPS.map((g) => {
          const items = CATALOG[g].filter((i) => i.toLowerCase().includes(ql))
          if (!items.length) return null
          return (
            <div key={g}>
              <div className="pop-group">{g}</div>
              {items.map((i) => {
                const on = value.includes(i)
                return (
                  <div key={i} className={`pop-opt ${on ? 'on' : ''}`} onClick={() => onToggle(i)}>
                    <span className="mono">{i}</span>
                    <span className="tick"><Icon name="check" size={14} /></span>
                  </div>
                )
              })}
            </div>
          )
        })}
        {ql && !exactExists && (
          <div className="pop-opt" onClick={() => { onAddCustom(q.trim()); setQ('') }}>
            <Icon name="plus" size={13} /> Add custom &ldquo;<span className="mono" style={{ marginLeft: 2 }}>{q.trim()}</span>&rdquo;
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- node inspector ---------- */
function NodeInspector({ node, actions, project }: { node: WBNode; actions: EditorActions; project: Project }) {
  const def = NODE_TYPES[node.type]
  const tint = `var(${def.token})`
  const [picking, setPicking] = useState(false)
  const presets = project.library || []

  const editField = (key: 'name' | 'desc') => ({
    onFocus: () => actions.beginInteraction(),
    onBlur: () => actions.commitInteraction(),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      actions.live((d) => { const n = d.nodes.find((x) => x.id === node.id); if (n) n[key] = e.target.value }),
    value: node[key] || '',
  })
  const toggleChip = (item: string) => actions.commit((d) => {
    const n = d.nodes.find((x) => x.id === node.id); if (!n) return
    n.stack = n.stack.includes(item) ? n.stack.filter((s) => s !== item) : [...n.stack, item]
  })

  return (
    <div className="inspector">
      <div className="insp-head" style={{ '--tint': tint } as React.CSSProperties}>
        <div className="node-badge"><span>{def.glyph}</span></div>
        <div className="it"><div className="k">{def.label}</div><div className="v">{node.name || 'Untitled'}</div></div>
      </div>
      <div className="insp-body" style={{ '--tint': tint } as React.CSSProperties}>
        <div className="field">
          <label>Name</label>
          <input className="inp" {...editField('name')} placeholder={def.defaults.name} />
        </div>
        <div className="field">
          <label>What it does <span className="hint">plain language</span></label>
          <textarea className="ta" {...editField('desc')} placeholder="Describe this step so Claude Code knows what to build…" />
        </div>

        <div className="field">
          <label>Stack &amp; integrations</label>
          <div className="chip-wrap">
            {node.stack.map((s) => (
              <span key={s} className="chip">{s}<button onClick={() => toggleChip(s)} title="Remove"><Icon name="close" size={11} /></button></span>
            ))}
            {!picking && <button className="chip-add" onClick={() => setPicking(true)}><Icon name="plus" size={12} /> Add</button>}
          </div>
          {picking && (
            <StackPicker value={node.stack} onToggle={toggleChip}
              onAddCustom={(c) => toggleChip(c)} onClose={() => setPicking(false)} />
          )}
        </div>

        {presets.length > 0 && (
          <div className="field">
            <label>Apply a saved stack</label>
            {presets.map((p) => (
              <div key={p.id} className="lib-item">
                <div className="ln">{p.name}</div>
                <div className="lc">{p.items.length}</div>
                <Btn size="s" kind="line" onClick={() => actions.commit((d) => {
                  const n = d.nodes.find((x) => x.id === node.id)
                  if (n) n.stack = Array.from(new Set([...n.stack, ...p.items]))
                })}>Apply</Btn>
              </div>
            ))}
          </div>
        )}
        {node.stack.length > 1 && (
          <Btn size="s" kind="soft" icon="layers" onClick={() => actions.saveLibrary(node.stack)}>Save these as a reusable stack</Btn>
        )}
      </div>
      <div className="insp-foot">
        <Btn kind="soft" icon="copy" onClick={() => actions.duplicateNode(node.id)}>Duplicate</Btn>
        <div style={{ flex: 1 }} />
        <Btn kind="line" className="btn-danger" icon="trash" onClick={() => actions.deleteNode(node.id)}>Delete</Btn>
      </div>
    </div>
  )
}

/* ---------- edge inspector ---------- */
function EdgeInspector({ edge, actions, project }: { edge: WBEdge; actions: EditorActions; project: Project }) {
  const from = project.nodes.find((n) => n.id === edge.from)
  const to = project.nodes.find((n) => n.id === edge.to)
  return (
    <div className="inspector">
      <div className="insp-head">
        <div className="node-badge" style={{ background: 'var(--edge)' }}><Icon name="arrow" size={15} /></div>
        <div className="it">
          <div className="k" style={{ color: 'var(--ink-faint)' }}>Connection</div>
          <div className="v" style={{ fontSize: 13 }}>{from ? from.name : '?'} → {to ? to.name : '?'}</div>
        </div>
      </div>
      <div className="insp-body">
        <div className="field">
          <label>Label / note <span className="hint">e.g. &ldquo;if refund &gt; $100&rdquo;</span></label>
          <input
            className="inp" autoFocus value={edge.label || ''}
            onFocus={() => actions.beginInteraction()} onBlur={() => actions.commitInteraction()}
            onChange={(e) => actions.live((d) => { const x = d.edges.find((y) => y.id === edge.id); if (x) x.label = e.target.value })}
            placeholder="Describe what passes along this arrow…"
          />
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.5, margin: 0 }}>
          Notes on arrows describe the data or condition that moves between steps. They&rsquo;re included in the export.
        </p>
      </div>
      <div className="insp-foot">
        <Btn kind="soft" icon="arrow" onClick={() => actions.reverseEdge(edge.id)}>Reverse</Btn>
        <div style={{ flex: 1 }} />
        <Btn kind="line" className="btn-danger" icon="trash" onClick={() => actions.deleteEdge(edge.id)}>Delete</Btn>
      </div>
    </div>
  )
}

/* ---------- empty / overview inspector ---------- */
function OverviewInspector({ project, actions }: { project: Project; actions: EditorActions }) {
  const counts: Partial<Record<string, number>> = {}
  project.nodes.forEach((n) => { counts[n.type] = (counts[n.type] || 0) + 1 })
  const used = TYPE_ORDER.filter((t) => counts[t])
  const presets = project.library || []
  return (
    <div className="inspector">
      <div className="insp-head">
        <div className="node-badge" style={{ background: 'var(--accent)' }}><Icon name="layers" size={15} /></div>
        <div className="it"><div className="k">Workflow</div><div className="v">{project.name}</div></div>
      </div>
      <div className="insp-body">
        <div className="insp-stat-row">
          <div className="insp-stat"><div className="n">{project.nodes.length}</div><div className="l">nodes</div></div>
          <div className="insp-stat"><div className="n">{project.edges.length}</div><div className="l">connections</div></div>
        </div>

        {used.length > 0 && (
          <div className="field">
            <div className="insp-section">Nodes in this workflow</div>
            {used.map((t) => {
              const def = NODE_TYPES[t]
              return (
                <div key={t} className="lib-item" style={{ borderColor: 'var(--line-2)' }}>
                  <div className="node-badge" style={{ width: 22, height: 22, fontSize: 12, '--tint': `var(${def.token})`, background: `var(${def.token})` } as React.CSSProperties}><span>{def.glyph}</span></div>
                  <div className="ln">{def.label}</div>
                  <div className="lc">{counts[t]}</div>
                </div>
              )
            })}
          </div>
        )}

        <div className="field">
          <div className="insp-section"><Icon name="layers" size={13} /> Stack library</div>
          {presets.length === 0 && <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0, lineHeight: 1.5 }}>Select a node, add models &amp; tools, then save them here to reuse across steps.</p>}
          {presets.map((p) => (
            <div key={p.id} className="lib-item">
              <div className="ln">{p.name}</div>
              <div className="lc">{p.items.length}</div>
              <Btn size="s" kind="ghost" className="btn-danger" icon="trash" onClick={() => actions.deleteLibrary(p.id)} />
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '12px 13px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Tip</div>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
            Drag from a node&rsquo;s edge dots to draw a connection. Click any arrow to add a note. Press <span className="kbd">⌫</span> to delete, <span className="kbd">⌘Z</span> to undo.
          </p>
        </div>
      </div>
    </div>
  )
}

interface InspectorProps {
  project: Project
  selection: Selection
  actions: EditorActions
}

export function Inspector({ project, selection, actions }: InspectorProps) {
  if (selection?.type === 'node') {
    const node = project.nodes.find((n) => n.id === selection.id)
    if (node) return <NodeInspector node={node} actions={actions} project={project} />
  }
  if (selection?.type === 'edge') {
    const edge = project.edges.find((e) => e.id === selection.id)
    if (edge) return <EdgeInspector edge={edge} actions={actions} project={project} />
  }
  return <OverviewInspector project={project} actions={actions} />
}
