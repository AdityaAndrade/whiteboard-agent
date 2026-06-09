import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Btn } from '@/components/wb/Button'
import { Icon } from '@/components/wb/Icon'
import { Modal } from '@/components/wb/Modal'
import { ThumbGraph } from '@/components/wb/ThumbGraph'
import { usePlan } from '@/lib/plan-store'
import { PLAN_LIMITS } from '@/lib/plans'
import { useWbStore } from '@/lib/wb-store'
import type { Project } from '@/types'

function formatUpdated(t: number) {
  const days = Math.floor((Date.now() - t) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ProjectCard({ project, onOpen, onDuplicate, onDelete, duplicateDisabled }: {
  project: Project
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
  duplicateDisabled: boolean
}) {
  return (
    <div className="proj-card" onClick={onOpen}>
      <div className="proj-thumb">
        <ThumbGraph project={project} />
      </div>
      <div className="proj-meta">
        <h3>{project.name}</h3>
        <div className="sub">
          <span>{project.nodes.length} node{project.nodes.length === 1 ? '' : 's'}</span>
          <span className="dot" />
          <span>{project.edges.length} link{project.edges.length === 1 ? '' : 's'}</span>
          <span className="dot" />
          <span>{formatUpdated(project.updatedAt)}</span>
        </div>
      </div>
      <div className="proj-card-actions" onClick={(e) => e.stopPropagation()}>
        <Btn
          kind="ghost"
          size="s"
          icon="copy"
          disabled={duplicateDisabled}
          title={duplicateDisabled ? "You've reached your plan's workflow limit" : undefined}
          onClick={onDuplicate}
        >
          Duplicate
        </Btn>
        <div style={{ flex: 1 }} />
        <Btn kind="ghost" size="s" icon="trash" className="btn-danger" onClick={onDelete} />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { projects, loading, error, reload, createProject, duplicateProject, deleteProject } = useWbStore()
  const { plan } = usePlan()
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const limit = PLAN_LIMITS[plan]
  const atLimit = projects.length >= limit

  const handleCreate = async () => {
    if (atLimit) return
    const project = await createProject()
    if (project) navigate(`/whiteboard/${project.id}`)
  }

  const handleDuplicate = (id: string) => {
    if (atLimit) return
    duplicateProject(id)
  }

  const doDelete = () => {
    if (confirmDel) deleteProject(confirmDel)
    setConfirmDel(null)
  }

  return (
    <div className="wb-theme dash">
      <div className="dash-inner">
        <div className="dash-hero">
          <h1>Your workflows</h1>
          <p>
            Sketch agentic and multi-agent systems on a whiteboard, wire up the stack, then export a{' '}
            <b style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13.5 }}>whiteboard.md</b>{' '}
            that Claude Code or Codex can build from.
          </p>
        </div>
        <div className="dash-bar">
          <h2>{projects.length} of {limit} project{limit === 1 ? '' : 's'}</h2>
          <div className="spacer" />
          <Btn
            kind="primary"
            icon="plus"
            onClick={handleCreate}
            disabled={loading || atLimit}
            title={atLimit ? "You've reached your plan's workflow limit" : undefined}
          >
            New workflow
          </Btn>
        </div>

        {!loading && atLimit && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderRadius: 'var(--r)',
              border: '1px solid color-mix(in oklch, var(--accent) 35%, transparent)',
              background: 'color-mix(in oklch, var(--accent) 8%, transparent)',
              color: 'var(--ink)',
              fontSize: 13,
              padding: '10px 14px',
              marginBottom: 16,
            }}
          >
            <span style={{ flex: 1 }}>
              You&rsquo;ve reached your {plan === 'free' ? 'Free' : 'Pro'} plan&rsquo;s limit of {limit} saved
              workflow{limit === 1 ? '' : 's'}.
              {plan === 'free' && ` Upgrade to Pro for up to ${PLAN_LIMITS.pro}.`}
            </span>
            {plan === 'free' && (
              <Btn kind="soft" size="s" onClick={() => navigate('/pricing')}>See plans</Btn>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderRadius: 'var(--r)',
              border: '1px solid color-mix(in oklch, var(--t-output) 35%, transparent)',
              background: 'color-mix(in oklch, var(--t-output) 8%, transparent)',
              color: 'var(--ink)',
              fontSize: 13,
              padding: '10px 14px',
              marginBottom: 16,
            }}
          >
            <span style={{ flex: 1 }}>Couldn't load your workflows — {error}</span>
            <Btn kind="soft" size="s" onClick={reload}>Retry</Btn>
          </div>
        )}

        {loading ? (
          <div className="proj-grid">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="proj-card"
                style={{ opacity: 0.5, pointerEvents: 'none' }}
                aria-hidden
              >
                <div className="proj-thumb" style={{ background: 'var(--surface-2)' }} />
                <div className="proj-meta">
                  <h3 style={{ background: 'var(--surface-2)', borderRadius: 4, color: 'transparent' }}>Loading</h3>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="proj-grid">
            {!atLimit && (
              <div className="proj-card new" onClick={handleCreate}>
                <div className="np-ic"><Icon name="plus" size={20} /></div>
                <b>New workflow</b>
                <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Start from a blank canvas</span>
              </div>
            )}
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => navigate(`/whiteboard/${project.id}`)}
                onDuplicate={() => handleDuplicate(project.id)}
                onDelete={() => setConfirmDel(project.id)}
                duplicateDisabled={atLimit}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)}>
        <div className="modal-head">
          <div className="mh-ic" style={{ background: 'oklch(0.95 0.04 18)', color: 'var(--t-output)' }}>
            <Icon name="trash" size={17} />
          </div>
          <div><h2>Delete this workflow?</h2><p>This can&rsquo;t be undone.</p></div>
        </div>
        <div className="confirm-body">The workflow and all its nodes and connections will be permanently removed.</div>
        <div className="modal-foot">
          <div className="spacer" />
          <Btn kind="soft" onClick={() => setConfirmDel(null)}>Cancel</Btn>
          <Btn kind="line" className="btn-danger" icon="trash" onClick={doDelete}>Delete</Btn>
        </div>
      </Modal>
    </div>
  )
}
