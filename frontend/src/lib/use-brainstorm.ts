import { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeType, Project } from '@/types'
import { supabase } from './supabase'
import type { EditorActions } from './use-project-editor'
import { BRAINSTORM_MONTHLY_CAP } from './plans'
import { uid } from './wb-data'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  changes?: ChangeEntry[]
}

export interface ChangeEntry {
  action: string
  label: string
}

interface ToolCall {
  name: string
  id: string
  input: Record<string, unknown>
}

// Messages in the format the Anthropic API expects (stored between turns)
type ApiMessage = { role: 'user' | 'assistant'; content: unknown }

const MAX_MEMORY_ENTRIES = 20
const MAX_HISTORY_MESSAGES = 20

const historyKey = (id: string) => `bs_hist_${id}`

function loadHistory(projectId: string): { messages: ChatMessage[]; apiHistory: ApiMessage[] } {
  try {
    const raw = localStorage.getItem(historyKey(projectId))
    if (!raw) return { messages: [], apiHistory: [] }
    return JSON.parse(raw)
  } catch {
    return { messages: [], apiHistory: [] }
  }
}

function persistHistory(projectId: string, messages: ChatMessage[], apiHistory: ApiMessage[]) {
  try {
    localStorage.setItem(historyKey(projectId), JSON.stringify({ messages, apiHistory }))
  } catch { /* storage full */ }
}

function describeCall(call: ToolCall): ChangeEntry {
  const i = call.input
  switch (call.name) {
    case 'build_workflow': {
      const nodes = (i.nodes as any[]) ?? []
      const edges = (i.edges as any[]) ?? []
      return { action: 'add', label: `Built workflow: ${nodes.length} nodes, ${edges.length} edges` }
    }
    case 'add_node':    return { action: 'add',    label: `Added ${i.type} node: "${i.name}"` }
    case 'update_node': return { action: 'update', label: `Updated node${i.name ? `: "${i.name}"` : ''}` }
    case 'delete_node': return { action: 'delete', label: 'Deleted node' }
    case 'add_edge':    return { action: 'add',    label: `Connected nodes${i.label ? ` (${i.label})` : ''}` }
    case 'update_edge': return { action: 'update', label: `Updated edge label${i.label ? `: "${i.label}"` : ''}` }
    case 'delete_edge': return { action: 'delete', label: 'Removed connection' }
    default:            return { action: call.name, label: call.name }
  }
}

// Auto-position new nodes.
// Single node: place to the right of the existing cluster.
// Multiple nodes in one turn: arrange in a circle so edges are visually clear.
function autoPos(project: Project, idx: number, total: number): { x: number; y: number } {
  const existing = project.nodes
  const cx = existing.length > 0
    ? existing.reduce((s, n) => s + n.x, 0) / existing.length
    : 600
  const cy = existing.length > 0
    ? existing.reduce((s, n) => s + n.y, 0) / existing.length
    : 380

  if (total === 1) {
    const maxX = existing.reduce((m, n) => Math.max(m, n.x), cx)
    return { x: Math.round(maxX + 280), y: Math.round(cy) }
  }

  if (total === 2) {
    return { x: Math.round(cx + (idx === 0 ? -180 : 180)), y: Math.round(cy) }
  }

  // 3+ nodes: evenly spaced around an ellipse, starting from the top
  const rx = Math.max(220, total * 70)
  const ry = Math.round(rx * 0.65)
  const angle = -Math.PI / 2 + (idx / total) * 2 * Math.PI
  return {
    x: Math.round(cx + rx * Math.cos(angle)),
    y: Math.round(cy + ry * Math.sin(angle)),
  }
}

// Apply all tool calls from one turn as a single commit (= one undo step)
function applyToolCalls(calls: ToolCall[], project: Project, actions: EditorActions) {
  let newNodeIdx = 0
  const totalNew = calls.filter((c) => c.name === 'add_node').length

  actions.commit((draft) => {
    // Build a snapshot of the project for position calculation BEFORE mutations
    const posBase = { nodes: [...project.nodes] }

    // Pass 0 – build_workflow (compound: nodes + edges in one call)
    for (const call of calls) {
      if (call.name !== 'build_workflow') continue
      const i = call.input as { nodes: any[]; edges: any[] }
      const nodes = i.nodes ?? []
      const edges = i.edges ?? []
      const refToId = new Map<string, string>()

      nodes.forEach((n, idx) => {
        const { x, y } = autoPos(posBase as Project, idx, nodes.length)
        const node = {
          id: uid('n'),
          type: n.type as NodeType,
          x, y,
          name: (n.name as string) || 'Node',
          desc: (n.desc as string) || '',
          stack: (n.stack as string[]) || [],
        }
        draft.nodes.push(node)
        refToId.set(n.ref, node.id)
        refToId.set(n.name, node.id) // fallback: resolve by name too
      })

      for (const e of edges) {
        const fromId = refToId.get(e.from) ?? e.from
        const toId   = refToId.get(e.to)   ?? e.to
        if (fromId === toId) continue
        if (draft.edges.some((ex) => ex.from === fromId && ex.to === toId)) continue
        draft.edges.push({ id: uid('e'), from: fromId, to: toId, label: (e.label as string) || '' })
      }
    }

    // Pass 1 – add nodes; build name→id map for edge resolution
    const nameToId = new Map<string, string>()
    for (const call of calls) {
      if (call.name !== 'add_node') continue
      const i = call.input
      const { x, y } = autoPos(posBase as Project, newNodeIdx++, totalNew)
      const node = {
        id: uid('n'),
        type: i.type as NodeType,
        x,
        y,
        name: (i.name as string) || 'Node',
        desc: (i.desc as string) || '',
        stack: (i.stack as string[]) || [],
      }
      draft.nodes.push(node)
      nameToId.set(node.name, node.id)
    }

    // Pass 2 – update / delete nodes
    for (const call of calls) {
      if (call.name === 'update_node') {
        const i = call.input
        const node = draft.nodes.find((n) => n.id === i.id)
        if (!node) continue
        if (i.name !== undefined) node.name = i.name as string
        if (i.desc !== undefined) node.desc = i.desc as string
        if (i.type !== undefined) node.type = i.type as NodeType
        if (i.stack !== undefined) node.stack = i.stack as string[]
      } else if (call.name === 'delete_node') {
        const id = call.input.id as string
        draft.nodes = draft.nodes.filter((n) => n.id !== id)
        draft.edges = draft.edges.filter((e) => e.from !== id && e.to !== id)
      }
    }

    // Pass 3 – add edges (resolve IDs by name for new nodes)
    for (const call of calls) {
      if (call.name !== 'add_edge') continue
      const i = call.input
      const rawFrom = i.from as string
      const rawTo   = i.to   as string
      const fromId  = draft.nodes.some((n) => n.id === rawFrom) ? rawFrom : (nameToId.get(rawFrom) ?? rawFrom)
      const toId    = draft.nodes.some((n) => n.id === rawTo)   ? rawTo   : (nameToId.get(rawTo)   ?? rawTo)
      if (fromId === toId) continue
      if (draft.edges.some((e) => e.from === fromId && e.to === toId)) continue
      draft.edges.push({ id: uid('e'), from: fromId, to: toId, label: (i.label as string) || '' })
    }

    // Pass 4 – update / delete edges
    for (const call of calls) {
      if (call.name === 'update_edge') {
        const edge = draft.edges.find((e) => e.id === call.input.id)
        if (edge) edge.label = (call.input.label as string) ?? ''
      } else if (call.name === 'delete_edge') {
        draft.edges = draft.edges.filter((e) => e.id !== call.input.id)
      }
    }
  })
}

async function loadMemory(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('brainstorm_memories')
    .select('entries')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.entries as string[]) ?? []
}

async function saveMemory(userId: string, entries: string[]): Promise<void> {
  await supabase
    .from('brainstorm_memories')
    .upsert({ user_id: userId, entries, updated_at: new Date().toISOString() })
}

export function useBrainstorm(project: Project | null, actions: EditorActions) {
  const projectId = project?.id ?? ''
  const saved = projectId ? loadHistory(projectId) : { messages: [], apiHistory: [] }

  const [messages, setMessages] = useState<ChatMessage[]>(saved.messages)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [longTermMemory, setLongTermMemory] = useState<string[]>([])
  const [usageCount, setUsageCount] = useState<number>(0)

  // Full Anthropic-format message history for multi-turn context (short-term)
  const historyRef = useRef<ApiMessage[]>(saved.apiHistory)
  // Ref mirror of longTermMemory so send() always sees latest without re-creating callback
  const memoryRef = useRef<string[]>([])

  // Load long-term memory + current month's usage count from Supabase
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || !active) return
      const userId = session.user.id

      loadMemory(userId).then((entries) => {
        if (!active) return
        setLongTermMemory(entries)
        memoryRef.current = entries
      })

      const thisMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
      supabase
        .from('brainstorm_usage')
        .select('count, period_start')
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data }) => {
          if (!active || !data) return
          // Only use stored count if it's from the current calendar month
          if ((data.period_start as string).startsWith(thisMonth)) {
            setUsageCount(data.count as number)
          }
        })
    })
    return () => { active = false }
  }, [])

  const send = useCallback(async (text: string) => {
    if (!project || streaming) return
    setError(null)
    setStreaming(true)

    const userMsg: ChatMessage = { id: uid('m'), role: 'user', content: text }
    const asstMsg: ChatMessage = { id: uid('m'), role: 'assistant', content: '', streaming: true }
    setMessages((prev) => [...prev, userMsg, asstMsg])

    // Append user message to API history for this call, capped to the sliding window
    const callHistory: ApiMessage[] = [
      ...historyRef.current.slice(-MAX_HISTORY_MESSAGES),
      { role: 'user', content: text },
    ]

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      const url = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/brainstorm`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: callHistory, project, longTermMemory: memoryRef.current }),
      })

      if (!res.ok) {
        if (res.status === 429) setUsageCount(BRAINSTORM_MONTHLY_CAP)
        const msg = res.status === 403
          ? 'Brainstorm requires a Pro plan.'
          : res.status === 429
          ? `You've used all ${BRAINSTORM_MONTHLY_CAP} Brainstorm messages this month. Your limit resets on the 1st.`
          : `Request failed (${res.status})`
        throw new Error(msg)
      }

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let fullText = ''
      const changes: ChangeEntry[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })

        // Split on double-newline to get complete SSE events
        const events = buf.split('\n\n')
        buf = events.pop() ?? ''

        for (const block of events) {
          if (!block.trim()) continue
          let eventName = ''
          let dataStr = ''
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) eventName = line.slice(7).trim()
            if (line.startsWith('data: ')) dataStr = line.slice(6)
          }
          if (!eventName || !dataStr) continue

          const data = JSON.parse(dataStr)

          if (eventName === 'text_delta') {
            fullText += data.content as string
            const snap = fullText
            setMessages((prev) =>
              prev.map((m) => (m.id === asstMsg.id ? { ...m, content: snap } : m))
            )
          } else if (eventName === 'tool_calls') {
            const calls = data.calls as ToolCall[]
            calls.forEach((c) => changes.push(describeCall(c)))
            applyToolCalls(calls, project, actions)
          } else if (eventName === 'message_complete') {
            // Update short-term history for next turn, keeping only the sliding window
            historyRef.current = [
              ...historyRef.current,
              { role: 'user' as const, content: text },
              ...(data.newMessages as ApiMessage[]),
            ].slice(-MAX_HISTORY_MESSAGES)
            setUsageCount((prev) => prev + 1)
            // Merge and persist any new long-term memory entries
            const updates = (data.memoryUpdates as string[] | undefined) ?? []
            if (updates.length > 0) {
              const merged = [...memoryRef.current, ...updates].slice(-MAX_MEMORY_ENTRIES)
              memoryRef.current = merged
              setLongTermMemory(merged)
              saveMemory(session.user.id, merged).catch(() => { /* non-fatal: memory persisted in-session */ })
            }
          } else if (eventName === 'error') {
            throw new Error(data.message as string)
          }
        }
      }

      // Finalise the assistant bubble and persist the conversation
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === asstMsg.id
            ? { ...m, content: fullText, streaming: false, changes: changes.length ? changes : undefined }
            : m
        )
        persistHistory(projectId, next, historyRef.current)
        return next
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      setMessages((prev) => prev.filter((m) => m.id !== asstMsg.id))
    } finally {
      setStreaming(false)
    }
  }, [project, actions, streaming])

  // Clears short-term memory only (conversation history + displayed messages)
  const clear = useCallback(() => {
    setMessages([])
    setError(null)
    historyRef.current = []
    if (projectId) localStorage.removeItem(historyKey(projectId))
  }, [projectId])

  // Clears long-term memory (persisted preferences) — separate from clear()
  const clearLongTermMemory = useCallback(async () => {
    memoryRef.current = []
    setLongTermMemory([])
    const { data: { session } } = await supabase.auth.getSession()
    if (session) await saveMemory(session.user.id, [])
  }, [])

  // Re-sends the last user message after rolling back its turn from state + history
  const rewrite = useCallback(() => {
    if (streaming || messages.length === 0) return
    let lastUserIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx === -1) return

    const lastUserText = messages[lastUserIdx].content
    const trimmedMessages = messages.slice(0, lastUserIdx)
    setMessages(trimmedMessages)
    setError(null)

    // Roll back API history to before the last user turn
    const h = historyRef.current
    let lastUserHistIdx = -1
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].role === 'user') { lastUserHistIdx = i; break }
    }
    if (lastUserHistIdx !== -1) historyRef.current = h.slice(0, lastUserHistIdx)

    if (projectId) persistHistory(projectId, trimmedMessages, historyRef.current)
    send(lastUserText)
  }, [messages, streaming, send, projectId])

  return { messages, streaming, error, send, clear, rewrite, longTermMemory, clearLongTermMemory, usageCount }
}
