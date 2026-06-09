import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const BRAINSTORM_MONTHLY_CAP = 200

const SYSTEM_PROMPT = `You are Brainstorm — a sharp, opinionated co-pilot for designing agentic workflows. You're like a senior engineer sitting next to the user: direct, collaborative, occasionally asks a clarifying question, but mostly just gets things done.

You can read and edit the canvas (add/update/delete nodes and edges). The current canvas state is always provided to you.

## Default contract: always produce a complete, connected workflow

When a user asks you to build, create, design, or scaffold a workflow — even vaguely — your response is a fully connected diagram, ready to export, in a single turn. That means:
- Every node added has at least one edge connecting it to the graph
- The flow is complete from trigger to output with no dead ends (unless the user explicitly asks for a partial diagram)
- All add_node and add_edge calls happen in the same turn — never add nodes and wait for a follow-up to connect them

The user should never have to say "now connect them" or "add the edges." If they do, that's a mistake on your part.

The only time you build partially is if the user explicitly asks for it (e.g. "just add the input nodes for now").

## Tone & style

- Talk like a colleague, not a help desk. Short sentences. No fluff.
- Never open with "Certainly!", "Of course!", "Great idea!", "Happy to help!", or any filler affirmation.
- Don't narrate what you're about to do — just do it, then confirm in one sentence what changed.
- If something is ambiguous, ask one short question instead of making assumptions. Not multiple questions.
- When the canvas is empty or sparse, take initiative and suggest a direction rather than waiting to be told every detail.
- Match the user's energy: if they're brief, be brief. If they want to think out loud, engage with it.

## After making canvas changes

Confirm what you did in one short sentence — e.g. "Built a Slack-triggered support triage loop with escalation to a human reviewer." Don't list every node and edge; just summarize the intent.

## Node types
- trigger: Starts the workflow (user message, webhook, schedule)
- agent: LLM-driven worker that reasons and acts
- orchestrator: Supervises sub-agents and routes work
- tool: Callable function or API the agent invokes
- data: Database, vector store, or knowledge source
- decision: Branch or routing logic
- human: Human review or approval step
- output: Final result delivered to the user

## Stack values (use exact strings)
Models: Claude Sonnet 4.5, Claude Opus 4, Claude Haiku 4, GPT-4o, o3, Gemini 2.5 Pro, Llama 3.3 70B, Mistral Large, Hermes 3, Qwen 2.5, DeepSeek V3, Grok 3, Local (Ollama)
Media generation: Midjourney, DALL-E 3, Stable Diffusion, Flux, Adobe Firefly, Runway, Sora, Pika, Luma Dream Machine, HeyGen, ElevenLabs, Suno
Frameworks: Claude Agent SDK, LangGraph, CrewAI, OpenAI Agents SDK, Vercel AI SDK, LlamaIndex, Mastra, Pydantic AI, Model Context Protocol (MCP)
Data & memory: Postgres, Pinecone, Weaviate, Chroma, Redis, Supabase, S3, Neo4j
Integrations: Slack, GitHub, Linear, Notion, Gmail, Stripe, Google Drive, Jira, Salesforce, Webhook
Social platforms: X (Twitter), Instagram, TikTok, LinkedIn, YouTube, Facebook, Pinterest, Threads, Buffer
MCP servers: Filesystem MCP, GitHub MCP, Puppeteer MCP, Brave Search MCP, Postgres MCP, Slack MCP, Memory MCP, Fetch MCP
Runtime: Node / TypeScript, Python, Cloudflare Workers, AWS Lambda, Modal, Docker

## Canvas editing rules
- Use **build_workflow** any time you are creating 2 or more connected nodes. Never use add_node in a loop when building a workflow — build_workflow is the right tool.
- Use individual add_node / add_edge / update_node / delete_node etc. only for single-element changes to an existing diagram.
- Node order matters for layout: nodes in build_workflow are arranged in a circle in the order listed. Put them in logical flow order (trigger first, output last) so the diagram reads clockwise.
- Choose concise, specific node names and descriptions
- Limit stack to 1–3 relevant items
- Use edge labels only when the relationship isn't obvious (e.g. "if refund", "on error")`

const TOOLS = [
  {
    name: 'build_workflow',
    description: 'Create or replace a connected set of nodes and edges in one shot. Use this whenever the user asks to build, create, design, or scaffold a workflow — even partially. Never use repeated add_node calls when build_workflow applies.',
    input_schema: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          description: 'Nodes to add, in logical flow order (trigger first, output last).',
          items: {
            type: 'object',
            properties: {
              ref:   { type: 'string', description: 'Short local reference ID you will use in edges (e.g. "trigger", "agent1"). Not shown to the user.' },
              type:  { type: 'string', enum: ['trigger','agent','orchestrator','tool','data','decision','human','output'] },
              name:  { type: 'string', description: 'Short display name (3–6 words)' },
              desc:  { type: 'string', description: 'One-sentence description' },
              stack: { type: 'array', items: { type: 'string' }, description: '1–3 stack items from the catalog, or omit' },
            },
            required: ['ref', 'type', 'name', 'desc'],
          },
        },
        edges: {
          type: 'array',
          description: 'Edges connecting the nodes. Every node should have at least one edge.',
          items: {
            type: 'object',
            properties: {
              from:  { type: 'string', description: 'ref of the source node' },
              to:    { type: 'string', description: 'ref of the target node' },
              label: { type: 'string', description: 'Optional label (only when relationship is non-obvious)' },
            },
            required: ['from', 'to'],
          },
        },
      },
      required: ['nodes', 'edges'],
    },
  },
  {
    name: 'add_node',
    description: 'Add a single node to an existing diagram. Use only for one-off additions, not for building a workflow from scratch.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['trigger', 'agent', 'orchestrator', 'tool', 'data', 'decision', 'human', 'output'],
          description: 'Node type',
        },
        name: { type: 'string', description: 'Short display name (3–6 words)' },
        desc: { type: 'string', description: 'One-sentence description of what this node does' },
        stack: {
          type: 'array',
          items: { type: 'string' },
          description: 'Stack items (1–3 exact strings from the catalog, or omit)',
        },
      },
      required: ['type', 'name', 'desc'],
    },
  },
  {
    name: 'update_node',
    description: 'Update an existing node. Only include fields you want to change.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Exact node ID from the current canvas' },
        name: { type: 'string' },
        desc: { type: 'string' },
        type: {
          type: 'string',
          enum: ['trigger', 'agent', 'orchestrator', 'tool', 'data', 'decision', 'human', 'output'],
        },
        stack: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_node',
    description: 'Delete a node and all its connected edges.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Exact node ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_edge',
    description: 'Connect two nodes. For nodes added in this same turn, use their exact name instead of ID.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source node ID (or name of a node added in this turn)' },
        to: { type: 'string', description: 'Target node ID (or name of a node added in this turn)' },
        label: { type: 'string', description: 'Optional edge label' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'update_edge',
    description: 'Update the label of an existing edge.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Exact edge ID from the current canvas' },
        label: { type: 'string', description: 'New label (empty string to remove)' },
      },
      required: ['id', 'label'],
    },
  },
  {
    name: 'delete_edge',
    description: 'Delete an edge between nodes.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Exact edge ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_memory',
    description: 'Save a fact about this user\'s workflow preferences or patterns to long-term memory so you can reference it in future conversations. Use for things worth remembering across sessions: preferred stack choices, naming conventions, architectural patterns, domain context. Limit to 1-2 sentences. Only call this when something genuinely novel is learned — do not call it every turn.',
    input_schema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'The preference or pattern to remember (1-2 sentences max)' },
      },
      required: ['fact'],
    },
  },
]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// Parse Claude's SSE response stream into an array of data events
async function* readClaudeStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const chunks = buf.split('\n\n')
    buf = chunks.pop() ?? ''
    for (const chunk of chunks) {
      if (!chunk.trim()) continue
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6)
        if (raw === '[DONE]') continue
        try { yield JSON.parse(raw) } catch { /* skip */ }
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return new Response('Server misconfigured', { status: 500 })

  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401, headers: CORS })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  )

  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { data: profile } = await sb.from('profiles').select('plan').eq('user_id', user.id).maybeSingle()
  if (profile?.plan !== 'pro') return new Response('Pro plan required', { status: 403, headers: CORS })

  const { data: newCount, error: usageErr } = await sb.rpc('increment_brainstorm_usage')
  if (usageErr) return new Response('Usage tracking error', { status: 500, headers: CORS })
  if ((newCount as number) > BRAINSTORM_MONTHLY_CAP) {
    return new Response('Monthly limit reached', { status: 429, headers: CORS })
  }

  const { messages, project, longTermMemory = [] } = await req.json()

  // Build project context snapshot for the system prompt
  const nodeLines = (project.nodes as any[]).map((n: any) =>
    `  id="${n.id}" type=${n.type} name="${n.name}"${n.stack?.length ? ` stack=[${n.stack.join(', ')}]` : ''} desc="${n.desc}"`
  ).join('\n') || '  (empty)'
  const edgeLines = (project.edges as any[]).map((e: any) =>
    `  id="${e.id}" from="${e.from}" to="${e.to}"${e.label ? ` label="${e.label}"` : ''}`
  ).join('\n') || '  (none)'

  const memorySection = (longTermMemory as string[]).length > 0
    ? `\n\n---\nWhat you know about this user's workflow preferences (long-term memory):\n${(longTermMemory as string[]).map((f: string) => `- ${f}`).join('\n')}`
    : ''

  const systemMsg = `${SYSTEM_PROMPT}${memorySection}\n\n---\nCurrent canvas: "${project.name}"\nNodes:\n${nodeLines}\nEdges:\n${edgeLines}`

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  const run = async () => {
    const newMessages: unknown[] = []

    try {
      // ── Phase 1: first call to Claude ────────────────────────────────
      const r1 = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemMsg,
          tools: TOOLS,
          messages,
          stream: true,
        }),
      })

      if (!r1.ok) {
        await writer.write(sse('error', { message: `Claude error: ${r1.status}` }))
        return
      }

      let assistantText = ''
      const toolBlocks: { id: string; name: string; input: unknown }[] = []
      let curTool: { id: string; name: string } | null = null
      let curInputJson = ''

      for await (const ev of readClaudeStream(r1.body!)) {
        if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
          curTool = { id: ev.content_block.id, name: ev.content_block.name }
          curInputJson = ''
        } else if (ev.type === 'content_block_delta') {
          if (ev.delta?.type === 'text_delta') {
            assistantText += ev.delta.text
            await writer.write(sse('text_delta', { content: ev.delta.text }))
          } else if (ev.delta?.type === 'input_json_delta') {
            curInputJson += ev.delta.partial_json
          }
        } else if (ev.type === 'content_block_stop' && curTool) {
          let input: unknown = {}
          try { input = JSON.parse(curInputJson) } catch { /* keep {} */ }
          toolBlocks.push({ ...curTool, input })
          curTool = null
          curInputJson = ''
        }
      }

      // Build the assistant message to store in history
      const assistantContent: unknown[] = []
      if (assistantText) assistantContent.push({ type: 'text', text: assistantText })
      for (const t of toolBlocks) {
        assistantContent.push({ type: 'tool_use', id: t.id, name: t.name, input: t.input })
      }
      newMessages.push({
        role: 'assistant',
        content: assistantContent.length === 1 && (assistantContent[0] as any).type === 'text'
          ? assistantText
          : assistantContent,
      })

      // ── Phase 2: tool use round-trip ─────────────────────────────────
      // Separate canvas operations from memory updates
      const canvasBlocks = toolBlocks.filter((t) => t.name !== 'update_memory')
      const memoryUpdates = toolBlocks
        .filter((t) => t.name === 'update_memory')
        .map((t) => (t.input as { fact: string }).fact)
        .filter(Boolean)

      if (toolBlocks.length > 0) {
        // Only emit canvas tool calls to the frontend (memory updates are invisible to the user)
        if (canvasBlocks.length > 0) {
          await writer.write(sse('tool_calls', {
            calls: canvasBlocks.map((t) => ({ name: t.name, id: t.id, input: t.input })),
          }))
        }

        // Send tool results for ALL blocks (including memory) back to Claude
        const toolResults = {
          role: 'user',
          content: toolBlocks.map((t) => ({
            type: 'tool_result',
            tool_use_id: t.id,
            content: 'success',
          })),
        }
        newMessages.push(toolResults)

        const r2 = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 512,
            system: systemMsg,
            tools: TOOLS,
            messages: [...messages, ...newMessages],
            stream: true,
          }),
        })

        if (r2.ok) {
          let ackText = ''
          for await (const ev of readClaudeStream(r2.body!)) {
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              ackText += ev.delta.text
              await writer.write(sse('text_delta', { content: ev.delta.text }))
            }
          }
          if (ackText) newMessages.push({ role: 'assistant', content: ackText })
        } else {
          await writer.write(sse('text_delta', { content: 'Done.' }))
        }
      }

      await writer.write(sse('message_complete', { newMessages, memoryUpdates }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      try { await writer.write(sse('error', { message: msg })) } catch { /* ignore */ }
    } finally {
      try { await writer.close() } catch { /* ignore */ }
    }
  }

  run()

  return new Response(readable, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
})
