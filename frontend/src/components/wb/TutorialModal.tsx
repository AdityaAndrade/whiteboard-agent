import { useMemo, useState } from 'react'
import type { EditorActions } from '@/lib/use-project-editor'
import { buildMarkdown } from '@/lib/wb-export'
import { sampleProject } from '@/lib/wb-data'
import { DEF_H, NODE_W } from '@/lib/wb-geometry'
import { Btn } from './Button'
import { Canvas } from './Canvas'
import { Icon } from './Icon'
import { MdView } from './ExportModal'
import { Modal } from './Modal'

// The tutorial canvas is a fixed snapshot — every mutation is a no-op so the
// sample diagram can never be edited or saved from here.
const READ_ONLY_ACTIONS: EditorActions = {
  setView: () => {},
  live: () => {},
  commit: () => {},
  beginInteraction: () => {},
  commitInteraction: () => {},
  addNode: () => {},
  duplicateNode: () => {},
  deleteNode: () => {},
  addEdge: () => {},
  updateEdge: () => {},
  deleteEdge: () => {},
  reverseEdge: () => {},
  saveLibrary: () => {},
  deleteLibrary: () => {},
}

const STEPS = [
  {
    title: 'Diagram your workflow',
    body: 'Drag triggers, agents, orchestrators, tools, data sources, decisions, human steps, and outputs onto a canvas, then connect them to define how data and control flow through your system. Below is a finished example: a support-triage assistant that routes incoming emails to the right specialist.',
  },
  {
    title: 'Pick your stack, node by node',
    body: 'Select any node and choose the model, service, or data store that powers it from a simple inspector panel — see the chips already picked for the orchestrator below (Claude Sonnet 4.5, Claude Agent SDK). Reusable stack presets make this quick across a whole diagram.',
  },
  {
    title: 'Export a whiteboard.md spec',
    body: 'One click turns the diagram into a structured markdown spec — build instructions, stack summary, architecture, and a breakdown of every component — ready to hand to Claude Code or Codex to scaffold the real implementation.',
  },
] as const

interface TutorialModalProps {
  open: boolean
  onClose: () => void
}

export function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0)
  const project = useMemo(() => sampleProject(), [])
  const md = useMemo(() => buildMarkdown(project), [project])
  // The orchestrator — the node with the most interesting stack picks to showcase.
  const highlightId = project.nodes[1]?.id

  // Canvas.fitView needs a measured stage rect we don't have outside the editor,
  // and the view baked into sampleProject() was tuned for that larger viewport —
  // so replicate its fit-to-bounds math here against the .tut-canvas box's fixed
  // size (see whiteboard.css), using an estimated card height since real cards
  // (with descriptions/stack chips) run taller than the DEF_H placeholder.
  const previewProject = useMemo(() => {
    const W = 834, H = 358, PAD = 50, cardH = DEF_H * 1.5
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of project.nodes) {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + NODE_W); maxY = Math.max(maxY, n.y + cardH)
    }
    const z = Math.min((W - PAD * 2) / (maxX - minX), (H - PAD * 2) / (maxY - minY))
    const view = { z, x: W / 2 - ((minX + maxX) / 2) * z, y: H / 2 - ((minY + maxY) / 2) * z }
    return { ...project, view }
  }, [project])

  const close = () => {
    onClose()
    setStep(0)
  }

  const current = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <div className="wb-theme">
      <Modal open={open} onClose={close} wide>
        <div className="modal-head">
          <div className="mh-ic"><Icon name="book" size={17} /></div>
          <div>
            <h2>{current.title}</h2>
            <p>Step {step + 1} of {STEPS.length} — see how it works, end to end</p>
          </div>
        </div>
        <div className="tut-body">
          <p className="tut-copy">{current.body}</p>
          {last ? (
            <div className="tut-md">
              <MdView md={md} />
            </div>
          ) : (
            <div className="tut-canvas">
              <Canvas
                project={previewProject}
                selection={step === 1 && highlightId ? { type: 'node', id: highlightId } : null}
                setSelection={() => {}}
                actions={READ_ONLY_ACTIONS}
              />
            </div>
          )}
        </div>
        <div className="modal-foot">
          <div className="tut-dots">
            {STEPS.map((_, i) => <span key={i} className={`tut-dot ${i === step ? 'on' : ''}`} />)}
          </div>
          <div className="spacer" />
          {step > 0 && (
            <Btn kind="soft" icon="back" onClick={() => setStep((s) => s - 1)}>Back</Btn>
          )}
          {last ? (
            <Btn kind="primary" icon="check" onClick={close}>Done</Btn>
          ) : (
            <Btn kind="primary" icon="arrow" onClick={() => setStep((s) => s + 1)}>Next</Btn>
          )}
        </div>
      </Modal>
    </div>
  )
}
