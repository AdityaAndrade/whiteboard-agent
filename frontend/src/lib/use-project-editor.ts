import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { NodeType, Project, ProjectView, Selection, WBEdge } from '@/types'
import { makeNode, uid } from './wb-data'
import { useWbStore } from './wb-store'

export interface EditorActions {
  setView: (v: ProjectView) => void
  live: (updater: (draft: Project) => void) => void
  commit: (updater: (draft: Project) => void) => void
  beginInteraction: () => void
  commitInteraction: () => void
  addNode: (type: NodeType, x: number, y: number) => void
  duplicateNode: (id: string) => void
  deleteNode: (id: string) => void
  addEdge: (from: string, to: string) => void
  updateEdge: (id: string, patch: Partial<WBEdge>) => void
  deleteEdge: (id: string) => void
  reverseEdge: (id: string) => void
  saveLibrary: (items: string[]) => void
  deleteLibrary: (id: string) => void
}

/**
 * Per-project editing session: mutation actions, undo/redo history, and
 * selection — mirrors app.jsx's `setOpenProject`/`actions`/history pattern,
 * scoped to a single project id from the route.
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const AUTOSAVE_DELAY_MS = 800

export function useProjectEditor(projectId: string | undefined, onLibrarySaved?: () => void) {
  const { state, setState, persistProject } = useWbStore()
  // Mirrors the latest `state` for async callbacks (scheduleSave's timer, beginInteraction)
  // that need the freshest value without becoming stale closures or rebinding on every
  // state change. Written in an effect — refs must not be written during render — which is
  // safe here since those callbacks only ever run later, from timers or user interaction.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const project = state.projects.find((p) => p.id === projectId) || null

  const hist = useRef<{ undo: string[]; redo: string[] }>({ undo: [], redo: [] })
  const pending = useRef<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [selection, setSelection] = useState<Selection>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Reset per-project UI state synchronously when switching projects, so the
  // previous project's selection/status never flashes — adjusted during render
  // rather than in an effect, per https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [trackedProjectId, setTrackedProjectId] = useState(projectId)
  if (projectId !== trackedProjectId) {
    setTrackedProjectId(projectId)
    setSelection(null)
    setSaveStatus('idle')
  }

  // Ref resets belong in an effect (refs must not be written during render).
  useEffect(() => {
    hist.current = { undo: [], redo: [] }
    pending.current = null
    clearTimeout(saveTimer.current)
  }, [projectId])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  /**
   * Debounced persistence to Supabase, scheduled from history-recording edits
   * (commits, completed drags, undo/redo, rename) — not from continuous `live`
   * updates or pan/zoom, which would otherwise fire on every animation frame.
   */
  const scheduleSave = useCallback(() => {
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const proj = stateRef.current.projects.find((p) => p.id === projectId)
      if (!proj) return
      persistProject(proj)
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, AUTOSAVE_DELAY_MS)
  }, [projectId, persistProject])

  const setProject = useCallback(
    (updater: (draft: Project) => void, recordHistory: boolean) => {
      setState((s) => {
        const proj = s.projects.find((p) => p.id === projectId)
        if (!proj) return s
        if (recordHistory) {
          hist.current.undo.push(JSON.stringify(proj))
          hist.current.redo = []
        }
        const draft = JSON.parse(JSON.stringify(proj)) as Project
        updater(draft)
        draft.updatedAt = Date.now()
        return { ...s, projects: s.projects.map((p) => (p.id === projectId ? draft : p)) }
      })
      if (recordHistory) scheduleSave()
    },
    [projectId, setState, scheduleSave],
  )

  const beginInteraction = useCallback(() => {
    const proj = stateRef.current.projects.find((p) => p.id === projectId)
    pending.current = proj ? JSON.stringify(proj) : null
  }, [projectId])

  const commitInteraction = useCallback(() => {
    if (pending.current) {
      hist.current.undo.push(pending.current)
      hist.current.redo = []
      pending.current = null
      force()
      scheduleSave()
    }
  }, [scheduleSave])

  const undo = useCallback(() => {
    if (!hist.current.undo.length) return
    setState((s) => {
      const proj = s.projects.find((p) => p.id === projectId)
      if (proj) hist.current.redo.push(JSON.stringify(proj))
      const prev = JSON.parse(hist.current.undo.pop()!) as Project
      return { ...s, projects: s.projects.map((p) => (p.id === projectId ? prev : p)) }
    })
    setSelection(null)
    force()
    scheduleSave()
  }, [projectId, setState, scheduleSave])

  const redo = useCallback(() => {
    if (!hist.current.redo.length) return
    setState((s) => {
      const proj = s.projects.find((p) => p.id === projectId)
      if (proj) hist.current.undo.push(JSON.stringify(proj))
      const next = JSON.parse(hist.current.redo.pop()!) as Project
      return { ...s, projects: s.projects.map((p) => (p.id === projectId ? next : p)) }
    })
    setSelection(null)
    force()
    scheduleSave()
  }, [projectId, setState, scheduleSave])

  const renameProject = useCallback(
    (name: string) => {
      setState((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === projectId ? { ...p, name } : p)),
      }))
      scheduleSave()
    },
    [projectId, setState, scheduleSave],
  )

  const actions: EditorActions = {
    setView: (v) => setProject((d) => { d.view = v }, false),
    live: (u) => setProject(u, false),
    commit: (u) => setProject(u, true),
    beginInteraction,
    commitInteraction,
    addNode: (type, x, y) => {
      const node = makeNode(type, x, y)
      setProject((d) => { d.nodes.push(node) }, true)
      setSelection({ type: 'node', id: node.id })
    },
    duplicateNode: (id) => {
      if (!project) return
      const src = project.nodes.find((n) => n.id === id)
      if (!src) return
      const copy = {
        ...(JSON.parse(JSON.stringify(src)) as typeof src),
        id: uid('n'),
        x: src.x + 30,
        y: src.y + 30,
        name: `${src.name} copy`,
      }
      setProject((d) => { d.nodes.push(copy) }, true)
      setSelection({ type: 'node', id: copy.id })
    },
    deleteNode: (id) => {
      setProject((d) => {
        d.nodes = d.nodes.filter((n) => n.id !== id)
        d.edges = d.edges.filter((e) => e.from !== id && e.to !== id)
      }, true)
      setSelection(null)
    },
    addEdge: (from, to) => {
      if (from === to || !project) return
      if (project.edges.some((e) => e.from === from && e.to === to)) return
      const edge: WBEdge = { id: uid('e'), from, to, label: '' }
      setProject((d) => { d.edges.push(edge) }, true)
    },
    updateEdge: (id, patch) => setProject((d) => {
      const e = d.edges.find((x) => x.id === id)
      if (e) Object.assign(e, patch)
    }, true),
    deleteEdge: (id) => {
      setProject((d) => { d.edges = d.edges.filter((e) => e.id !== id) }, true)
      setSelection(null)
    },
    reverseEdge: (id) => setProject((d) => {
      const e = d.edges.find((x) => x.id === id)
      if (e) { const f = e.from; e.from = e.to; e.to = f }
    }, true),
    saveLibrary: (items) => {
      setProject((d) => {
        d.library = d.library || []
        d.library.push({
          id: uid('lib'),
          name: items[0] + (items.length > 1 ? ` +${items.length - 1}` : ''),
          items: [...items],
        })
      }, true)
      onLibrarySaved?.()
    },
    deleteLibrary: (id) => setProject((d) => {
      d.library = (d.library || []).filter((p) => p.id !== id)
    }, true),
  }

  return {
    project,
    selection,
    setSelection,
    actions,
    renameProject,
    undo,
    redo,
    // hist is a ref (not state) because every mutation site already forces a render
    // — via setState (setProject/undo/redo) or force() (commitInteraction) — so these
    // always reflect the latest history by the time they're read here.
    // eslint-disable-next-line react-hooks/refs -- see comment above; mutation+render is paired by construction
    canUndo: hist.current.undo.length > 0,
    // eslint-disable-next-line react-hooks/refs -- see comment above; mutation+render is paired by construction
    canRedo: hist.current.redo.length > 0,
    saveStatus,
  }
}
