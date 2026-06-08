import { Link } from 'react-router-dom'
import { ArrowRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NODE_TYPES, TYPE_ORDER } from '@/lib/wb-data'

const steps = [
  {
    title: 'Diagram your workflow',
    body: 'Drag triggers, agents, orchestrators, tools, data sources, decisions, human steps, and outputs onto a canvas, then connect them to define how data and control flow through your system.',
  },
  {
    title: 'Pick your stack, node by node',
    body: 'Choose the model for each agent, the service for each integration, and the data store for each source — all from a simple inspector panel, with reusable stack presets.',
  },
  {
    title: 'Export a whiteboard.md spec',
    body: 'Download a structured markdown file that captures the full design — ready to hand to Claude Code or Codex to scaffold the real implementation.',
  },
]

export function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          Whiteboard your agentic workflows.
          <br />
          <span className="text-primary">Ship them with your coding agent.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          A visual canvas for sketching multi-agent systems — for technical and non-technical
          builders alike. Diagram it, configure your stack, then export a spec your AI coding
          agent can build from directly.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/login">
              Start whiteboarding <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/dashboard">View a sample workflow</Link>
          </Button>
        </div>
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, i) => (
          <Card key={step.title}>
            <CardHeader>
              <span className="text-sm font-medium text-muted-foreground">Step {i + 1}</span>
              <CardTitle className="text-xl">{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{step.body}</CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          Build with the components agentic systems are made of
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
          A ready-made palette of node types — drop them on the canvas and configure each one to
          match your real stack.
        </p>
        <div className="wb-theme mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {TYPE_ORDER.map((type) => {
            const def = NODE_TYPES[type]
            return (
              <div
                key={type}
                className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="node-badge" style={{ '--tint': `var(${def.token})` } as React.CSSProperties}>
                  {def.glyph}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{def.label}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-20 rounded-xl border bg-card p-8 text-center md:p-12">
        <Download className="mx-auto size-8 text-primary" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          One click to a build-ready spec
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Every whiteboard exports to a single <code className="rounded bg-muted px-1.5 py-0.5">whiteboard.md</code> file
          — a structured, unambiguous spec that Claude Code or Codex can read and turn into working code.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/login">Create your first whiteboard</Link>
        </Button>
      </section>
    </div>
  )
}
