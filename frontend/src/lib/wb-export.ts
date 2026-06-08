import { CATALOG_GROUPS, NODE_TYPES, groupOf } from './wb-data'
import type { Project, WBNode } from '@/types'

const slug = (s: string) => (s || 'step').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step'

/**
 * Generates the whiteboard.md spec for a project — a build-ready brief that
 * Claude Code or Codex can read to scaffold the agentic workflow for real.
 */
export function buildMarkdown(project: Project): string {
  const { nodes, edges } = project
  const byId: Record<string, WBNode> = {}
  nodes.forEach((n) => { byId[n.id] = n })
  const outAdj: Record<string, typeof edges> = {}
  const inAdj: Record<string, typeof edges> = {}
  nodes.forEach((n) => { outAdj[n.id] = []; inAdj[n.id] = [] })
  edges.forEach((e) => { if (byId[e.from] && byId[e.to]) { outAdj[e.from].push(e); inAdj[e.to].push(e) } })

  // ordering: topological-ish from entry nodes
  const order: WBNode[] = []
  const seen = new Set<string>()
  const roots = nodes.filter((n) => inAdj[n.id].length === 0)
  const queue = (roots.length ? roots : nodes).slice()
  while (queue.length) {
    const n = queue.shift()
    if (!n || seen.has(n.id)) continue
    seen.add(n.id); order.push(n)
    outAdj[n.id].forEach((e) => { if (!seen.has(e.to) && byId[e.to]) queue.push(byId[e.to]) })
  }
  nodes.forEach((n) => { if (!seen.has(n.id)) order.push(n) })

  const allStack = Array.from(new Set(nodes.flatMap((n) => n.stack)))
  const grouped: Record<string, string[]> = {}
  allStack.forEach((s) => { const g = groupOf(s); (grouped[g] = grouped[g] || []).push(s) })

  const L: string[] = []
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

  L.push(`# ${project.name}`)
  L.push('')
  L.push(`> Agentic workflow spec generated from a whiteboard on ${date}.`)
  L.push(`> ${nodes.length} nodes · ${edges.length} connections.`)
  L.push('')

  // ---- build prompt ----
  L.push('## ▶ Build instructions')
  L.push('')
  L.push('**Paste this whole file to Claude Code or Codex.** Then:')
  L.push('')
  L.push('1. Read the **Architecture** and **Components** sections to understand the agents, their jobs, and how data flows between them.')
  L.push('2. Use the stack noted on each component. Where a component lists a model or framework, wire it up; where it lists an integration, scaffold the client and a `.env` entry for its credentials.')
  L.push("3. Follow the **Suggested project structure** as a starting point, adapting to the chosen framework's conventions.")
  L.push('4. Implement each connection as a real data hand-off (function call, message, or queue) — the connection notes describe what passes between steps.')
  L.push('5. Stub external calls behind interfaces so the graph can be tested end-to-end before credentials are added.')
  L.push('')

  // ---- overview ----
  if (allStack.length) {
    L.push('## Stack at a glance')
    L.push('')
    CATALOG_GROUPS.concat(['Custom']).forEach((g) => {
      if (grouped[g]?.length) L.push(`- **${g}:** ${grouped[g].join(', ')}`)
    })
    L.push('')
  }

  // ---- architecture / flow ----
  L.push('## Architecture')
  L.push('')
  L.push('Execution flows roughly in this order (entry points first):')
  L.push('')
  order.forEach((n, i) => {
    const def = NODE_TYPES[n.type]
    const outs = outAdj[n.id].map((e) => {
      const t = byId[e.to]; return t ? `${t.name}${e.label ? ` _(${e.label})_` : ''}` : null
    }).filter((x): x is string => !!x)
    L.push(`${i + 1}. **${n.name}** \`${def.label}\`${outs.length ? ` → ${outs.join(', ')}` : ''}`)
  })
  L.push('')
  L.push('```')
  L.push('Flow map:')
  edges.forEach((e) => {
    const a = byId[e.from], b = byId[e.to]
    if (a && b) L.push(`  ${a.name}  --${e.label ? `[ ${e.label} ]` : ''}-->  ${b.name}`)
  })
  if (!edges.length) L.push('  (no connections yet)')
  L.push('```')
  L.push('')

  // ---- components ----
  L.push('## Components')
  L.push('')
  order.forEach((n) => {
    const def = NODE_TYPES[n.type]
    L.push(`### ${def.glyph} ${n.name}`)
    L.push('')
    L.push(`- **Type:** ${def.label} — ${def.hint}`)
    L.push(`- **Role:** ${n.desc || '_(no description)_'}`)
    if (n.stack.length) L.push(`- **Stack:** ${n.stack.map((s) => `\`${s}\``).join(', ')}`)
    const ins = inAdj[n.id].map((e) => {
      const f = byId[e.from]; return f ? `${f.name}${e.label ? ` (${e.label})` : ''}` : null
    }).filter((x): x is string => !!x)
    const outs = outAdj[n.id].map((e) => {
      const t = byId[e.to]; return t ? `${t.name}${e.label ? ` (${e.label})` : ''}` : null
    }).filter((x): x is string => !!x)
    if (ins.length) L.push(`- **Receives from:** ${ins.join(', ')}`)
    if (outs.length) L.push(`- **Sends to:** ${outs.join(', ')}`)
    L.push('')
  })

  // ---- connections ----
  if (edges.length) {
    L.push('## Connections & notes')
    L.push('')
    edges.forEach((e) => {
      const a = byId[e.from], b = byId[e.to]
      if (a && b) L.push(`- \`${a.name}\` → \`${b.name}\`${e.label ? ` — ${e.label}` : ''}`)
    })
    L.push('')
  }

  // ---- suggested structure ----
  const fw = allStack.find((s) => /sdk|langgraph|crewai|mastra|pydantic|llamaindex|mcp/i.test(s))
  const py = allStack.some((s) => /python|pydantic/i.test(s))
  const ext = py ? 'py' : 'ts'
  L.push('## Suggested project structure')
  L.push('')
  L.push('```')
  L.push(`${slug(project.name)}/`)
  L.push(`├─ ${py ? 'main.py' : `src/index.${ext}`}        # entry point / trigger wiring`)
  L.push('├─ agents/')
  order.filter((n) => ['agent', 'orchestrator'].includes(n.type)).forEach((n) => L.push(`│  ├─ ${slug(n.name)}.${ext}`))
  L.push('├─ tools/')
  order.filter((n) => n.type === 'tool').forEach((n) => L.push(`│  ├─ ${slug(n.name)}.${ext}`))
  const dataNodes = order.filter((n) => n.type === 'data')
  if (dataNodes.length) {
    L.push('├─ data/')
    dataNodes.forEach((n) => L.push(`│  ├─ ${slug(n.name)}.${ext}`))
  }
  L.push(`├─ graph.${ext}            # wires components together per the flow map`)
  L.push('└─ .env                 # API keys & integration credentials')
  L.push('```')
  L.push('')
  if (fw) { L.push(`_Framework detected: **${fw}** — follow its conventions for defining and connecting agents._`); L.push('') }

  L.push('---')
  L.push('_Generated by Whiteboard Agent._')
  return L.join('\n')
}
