import { useMemo, useState } from 'react'
import { buildMarkdown } from '@/lib/wb-export'
import { sampleProject } from '@/lib/wb-data'
import { Btn } from './Button'
import { HowItWorksDemo } from './HowItWorksDemo'
import { Icon } from './Icon'
import { Modal } from './Modal'

const STEPS = [
  {
    title: 'Diagram your workflow',
    body: 'Watch a support-triage assistant build itself — triggers, orchestrators, data sources, and agents appearing one by one, then edges connecting them to define the flow.',
  },
  {
    title: 'Configure your stack',
    body: 'Select any node to open its inspector. Choose the model for each agent and the service for each integration — the orchestrator here is already set up with Claude Sonnet 4.5 and the Agent SDK.',
  },
  {
    title: 'Export a whiteboard.md spec',
    body: 'One click generates a structured spec — build instructions, stack summary, architecture, and a full component breakdown — ready for Claude Code or Codex to scaffold the real implementation.',
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

        {/* animated demo — key restarts all CSS animations on step change */}
        <div style={{ overflow: 'hidden' }}>
          <HowItWorksDemo key={step} step={step} md={md} />
        </div>

        {/* step description */}
        <p style={{
          margin: 0,
          padding: '12px 22px 4px',
          fontSize: 11,
          lineHeight: 1.6,
          color: 'var(--ink-2)',
        }}>
          {current.body}
        </p>

        <div className="modal-foot">
          <div className="tut-dots">
            {STEPS.map((_, i) => (
              <span key={i} className={`tut-dot ${i === step ? 'on' : ''}`} />
            ))}
          </div>
          <div className="spacer" />
          {step > 0 && (
            <Btn kind="soft" icon="back" onClick={() => setStep(s => s - 1)}>Back</Btn>
          )}
          {last ? (
            <Btn kind="primary" icon="check" onClick={close}>Done</Btn>
          ) : (
            <Btn kind="primary" icon="arrow" onClick={() => setStep(s => s + 1)}>Next</Btn>
          )}
        </div>
      </Modal>
    </div>
  )
}
