export type NodeType =
  | 'trigger'
  | 'agent'
  | 'orchestrator'
  | 'tool'
  | 'data'
  | 'decision'
  | 'human'
  | 'output'

export interface NodeTypeDef {
  label: string
  /** CSS custom-property name (e.g. "--t-agent") that resolves to this type's tint color */
  token: string
  glyph: string
  hint: string
  defaults: { name: string; desc: string }
}

export interface WBNode {
  id: string
  type: NodeType
  x: number
  y: number
  name: string
  desc: string
  /** model / framework / integration chips, e.g. "Claude Sonnet 4.5" */
  stack: string[]
}

export interface WBEdge {
  id: string
  from: string
  to: string
  label: string
}

export interface StackPreset {
  id: string
  name: string
  items: string[]
}

export interface ProjectView {
  x: number
  y: number
  z: number
}

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  nodes: WBNode[]
  edges: WBEdge[]
  view: ProjectView
  library?: StackPreset[]
}

export interface AppState {
  projects: Project[]
  openId: string | null
}

export type Selection = { type: 'node' | 'edge'; id: string } | null

export type Plan = 'free' | 'pro'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}
