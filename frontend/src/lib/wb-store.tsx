import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { AppState, Project } from '@/types'
import { useAuth } from './auth-store'
import { supabase } from './supabase'
import { makeProject } from './wb-data'

interface WhiteboardRow {
  id: string
  title: string
  description: string | null
  graph_data: Partial<Pick<Project, 'nodes' | 'edges' | 'view' | 'library'>> | null
  created_at: string
  updated_at: string
}

function rowToProject(row: WhiteboardRow): Project {
  const graph = row.graph_data ?? {}
  return {
    id: row.id,
    name: row.title,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    nodes: graph.nodes ?? [],
    edges: graph.edges ?? [],
    view: graph.view ?? { x: 0, y: 0, z: 1 },
    library: graph.library,
  }
}

function graphOf(project: Pick<Project, 'nodes' | 'edges' | 'view' | 'library'>) {
  return { nodes: project.nodes, edges: project.edges, view: project.view, library: project.library }
}

interface WbStoreValue {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
  projects: Project[]
  loading: boolean
  error: string | null
  reload: () => void
  createProject: () => Promise<Project | null>
  duplicateProject: (id: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  persistProject: (project: Project) => Promise<void>
}

const WbStoreContext = createContext<WbStoreValue | null>(null)

/**
 * Project store backed by the Supabase `whiteboards` table (RLS-scoped to the
 * signed-in user — see frontend/supabase/schema.sql). `state`/`setState` stay
 * the in-memory source of truth so the canvas/editor can mutate synchronously
 * (instant drags, undo/redo); list-level CRUD round-trips to Supabase, and
 * content edits are persisted via `persistProject`, debounced by the editor
 * (see use-project-editor.ts).
 */
export function WbStoreProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<AppState>({ projects: [], openId: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      // Logged out: clear the in-memory cache of a previous account's projects.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ projects: [], openId: null })
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)
    supabase
      .from('whiteboards')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }
        setState({ projects: (data ?? []).map(rowToProject), openId: null })
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user, authLoading, reloadToken])

  const reload = () => setReloadToken((n) => n + 1)

  const createProject = async (): Promise<Project | null> => {
    if (!user) return null
    const base = makeProject()
    const { data, error } = await supabase
      .from('whiteboards')
      .insert({ user_id: user.id, title: base.name, graph_data: graphOf(base) })
      .select()
      .single()
    if (error || !data) {
      setError(error?.message ?? 'Could not create workflow.')
      return null
    }
    const project = rowToProject(data)
    setState((s) => ({ ...s, projects: [project, ...s.projects] }))
    return project
  }

  const duplicateProject = async (id: string) => {
    if (!user) return
    const src = state.projects.find((p) => p.id === id)
    if (!src) return
    const { data, error } = await supabase
      .from('whiteboards')
      .insert({ user_id: user.id, title: `${src.name} copy`, graph_data: graphOf(src) })
      .select()
      .single()
    if (error || !data) {
      setError(error?.message ?? 'Could not duplicate workflow.')
      return
    }
    const project = rowToProject(data)
    setState((s) => ({ ...s, projects: [project, ...s.projects] }))
  }

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('whiteboards').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setState((s) => ({
      ...s,
      projects: s.projects.filter((p) => p.id !== id),
      openId: s.openId === id ? null : s.openId,
    }))
  }

  const persistProject = async (project: Project) => {
    const { error } = await supabase
      .from('whiteboards')
      .update({ title: project.name, graph_data: graphOf(project) })
      .eq('id', project.id)
    if (error) throw error
  }

  return (
    <WbStoreContext.Provider
      value={{
        state,
        setState,
        projects: state.projects,
        loading,
        error,
        reload,
        createProject,
        duplicateProject,
        deleteProject,
        persistProject,
      }}
    >
      {children}
    </WbStoreContext.Provider>
  )
}

// useWbStore is colocated with WbStoreProvider/WbStoreContext (the standard provider+hook
// pattern) rather than split into its own file, hence the Fast Refresh trade-off here.
// eslint-disable-next-line react-refresh/only-export-components
export function useWbStore() {
  const ctx = useContext(WbStoreContext)
  if (!ctx) throw new Error('useWbStore must be used within a WbStoreProvider')
  return ctx
}
