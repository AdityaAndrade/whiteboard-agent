import type { NodeType, NodeTypeDef, Project, WBNode } from '@/types'

export const uid = (prefix = 'id') =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`

/* ---------- node type catalog ---------- */
export const NODE_TYPES: Record<NodeType, NodeTypeDef> = {
  trigger: {
    label: 'Trigger', token: '--t-trigger', glyph: '▶',
    hint: 'Starts the workflow',
    defaults: { name: 'Trigger', desc: 'User message / webhook / schedule that kicks off the run.' },
  },
  agent: {
    label: 'Agent', token: '--t-agent', glyph: '✦',
    hint: 'LLM-driven worker',
    defaults: { name: 'Agent', desc: 'An LLM agent that reasons over input and decides what to do.' },
  },
  orchestrator: {
    label: 'Orchestrator', token: '--t-orchestrator', glyph: '◈',
    hint: 'Supervises sub-agents',
    defaults: { name: 'Orchestrator', desc: 'Routes work to sub-agents and aggregates their results.' },
  },
  tool: {
    label: 'Tool', token: '--t-tool', glyph: '⚒',
    hint: 'Function / API call',
    defaults: { name: 'Tool', desc: 'A callable function or API the agent can invoke.' },
  },
  data: {
    label: 'Data source', token: '--t-data', glyph: '▤',
    hint: 'DB / vector store / API',
    defaults: { name: 'Data source', desc: 'Knowledge the workflow reads from (DB, vector store, files).' },
  },
  decision: {
    label: 'Decision', token: '--t-decision', glyph: '◆',
    hint: 'Branch / route',
    defaults: { name: 'Decision', desc: 'Branches the flow based on a condition or classification.' },
  },
  human: {
    label: 'Human step', token: '--t-human', glyph: '✋',
    hint: 'Approval / review',
    defaults: { name: 'Human review', desc: 'Pauses for a person to approve, edit, or reject.' },
  },
  output: {
    label: 'Output', token: '--t-output', glyph: '◎',
    hint: 'Result / sink',
    defaults: { name: 'Output', desc: 'Final result delivered to the user or downstream system.' },
  },
}

export const TYPE_ORDER: NodeType[] = [
  'trigger', 'agent', 'orchestrator', 'tool', 'data', 'decision', 'human', 'output',
]

/* ---------- stack / integration catalog ---------- */
export const CATALOG: Record<string, string[]> = {
  Models: ['Claude Sonnet 4.5', 'Claude Opus 4', 'Claude Haiku 4', 'GPT-4o', 'o3', 'Gemini 2.5 Pro', 'Llama 3.3 70B', 'Local (Ollama)'],
  Frameworks: ['Claude Agent SDK', 'LangGraph', 'CrewAI', 'OpenAI Agents SDK', 'Vercel AI SDK', 'LlamaIndex', 'Mastra', 'Pydantic AI'],
  'Data & memory': ['Postgres', 'Pinecone', 'Weaviate', 'Chroma', 'Redis', 'Supabase', 'S3', 'Neo4j'],
  Integrations: ['Slack', 'GitHub', 'Linear', 'Notion', 'Gmail', 'Stripe', 'Google Drive', 'Jira', 'Salesforce', 'Webhook'],
  Runtime: ['Node / TypeScript', 'Python', 'Cloudflare Workers', 'AWS Lambda', 'Modal', 'Docker'],
}
export const CATALOG_GROUPS = Object.keys(CATALOG)
export const groupOf = (item: string) =>
  CATALOG_GROUPS.find((g) => CATALOG[g].includes(item)) || 'Custom'

/* ---------- factories ---------- */
export function makeNode(type: NodeType, x: number, y: number): WBNode {
  const def = NODE_TYPES[type]
  return {
    id: uid('n'),
    type,
    x,
    y,
    name: def.defaults.name,
    desc: def.defaults.desc,
    stack: [],
  }
}

export function makeProject(name?: string): Project {
  const now = Date.now()
  return {
    id: uid('p'),
    name: name || 'Untitled workflow',
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    view: { x: 0, y: 0, z: 1 },
  }
}

/* ---------- a starter sample so the canvas isn't empty ---------- */
export function sampleProject(): Project {
  const p = makeProject('Support triage assistant')
  const n = (type: NodeType, x: number, y: number, over: Partial<WBNode>) =>
    Object.assign(makeNode(type, x, y), over)

  const trigger = n('trigger', 80, 300, { name: 'New support email', desc: 'Inbound customer email arrives in the shared inbox.' })
  const orch = n('orchestrator', 380, 300, { name: 'Triage orchestrator', desc: 'Classifies the request and routes it to the right specialist.', stack: ['Claude Sonnet 4.5', 'Claude Agent SDK'] })
  const kb = n('data', 380, 540, { name: 'Help center KB', desc: 'Vector store of help articles for grounded answers.', stack: ['Pinecone'] })
  const billing = n('agent', 720, 170, { name: 'Billing agent', desc: 'Resolves billing & subscription questions.', stack: ['Claude Sonnet 4.5', 'Stripe'] })
  const tech = n('agent', 720, 400, { name: 'Tech support agent', desc: 'Handles technical troubleshooting using the KB.', stack: ['Claude Sonnet 4.5'] })
  const human = n('human', 1050, 285, { name: 'Approve refund', desc: 'Refunds over $100 require a human to approve before sending.' })
  const out = n('output', 1330, 300, { name: 'Reply to customer', desc: 'Sends the drafted reply back to the customer.', stack: ['Gmail'] })
  p.nodes = [trigger, orch, kb, billing, tech, human, out]

  const e = (a: WBNode, b: WBNode, label = '') => ({ id: uid('e'), from: a.id, to: b.id, label })
  p.edges = [
    e(trigger, orch),
    e(kb, orch, 'grounds'),
    e(orch, billing, 'billing'),
    e(orch, tech, 'technical'),
    e(billing, human, 'if refund'),
    e(tech, out),
    e(human, out, 'approved'),
  ]
  p.view = { x: 40, y: -40, z: 0.82 }
  return p
}
