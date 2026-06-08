import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Btn } from '@/components/wb/Button'
import { Canvas } from '@/components/wb/Canvas'
import { ExportModal } from '@/components/wb/ExportModal'
import { Icon } from '@/components/wb/Icon'
import { Inspector } from '@/components/wb/Inspector'
import { LogoMark } from '@/components/wb/Logo'
import { useProjectEditor, type SaveStatus } from '@/lib/use-project-editor'
import { useWbStore } from '@/lib/wb-store'

const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: "Couldn't save — retrying",
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        color: status === 'error' ? 'var(--t-output)' : 'var(--ink-faint)',
      }}
    >
      {status === 'saved' && <Icon name="check" size={13} />}
      {SAVE_STATUS_LABEL[status]}
    </span>
  )
}

export function WhiteboardEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [exportOpen, setExportOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200)
  }, [])

  const { loading } = useWbStore()
  const { project, selection, setSelection, actions, renameProject, undo, redo, canUndo, canRedo, saveStatus } =
    useProjectEditor(id, () => toast('Saved to stack library'))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!project) return
      const tag = (document.activeElement && document.activeElement.tagName) || ''
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo(); else undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (typing) return
      if ((e.key === 'Backspace' || e.key === 'Delete') && selection) {
        e.preventDefault()
        if (selection.type === 'node') actions.deleteNode(selection.id)
        else actions.deleteEdge(selection.id)
      }
      if (e.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project, selection, undo, redo, actions, setSelection])

  if (loading) {
    return (
      <div className="wb-theme wb-app-shell" style={{ alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Loading your workflow…</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="wb-theme wb-app-shell" style={{ alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>Workflow not found</h1>
        <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>It may have been deleted, or the link is incorrect.</p>
        <Btn kind="primary" icon="back" onClick={() => navigate('/dashboard')}>Back to dashboard</Btn>
      </div>
    )
  }

  return (
    <div className="wb-theme wb-app-shell">
      <div className="topbar">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{ display: 'flex', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          title="Back to dashboard"
        >
          <LogoMark size={26} />
        </button>
        <span className="sep" />
        <Btn kind="ghost" icon="back" onClick={() => navigate('/dashboard')}>Projects</Btn>
        <span className="sep" />
        <input
          className="proj-name-edit"
          value={project.name}
          onChange={(e) => renameProject(e.target.value)}
          onFocus={(e) => e.target.select()}
          spellCheck={false}
        />
        <SaveIndicator status={saveStatus} />
        <div className="spacer" />
        <Btn kind="ghost" icon="undo" disabled={!canUndo} onClick={undo} title="Undo (⌘Z)" />
        <Btn kind="ghost" icon="redo" disabled={!canRedo} onClick={redo} title="Redo (⌘⇧Z)" />
        <span className="sep" />
        <Btn kind="primary" icon="download" onClick={() => setExportOpen(true)}>Export whiteboard.md</Btn>
      </div>
      <div className="editor">
        <Canvas project={project} selection={selection} setSelection={setSelection} actions={actions} />
        <Inspector project={project} selection={selection} actions={actions} />
      </div>

      <ExportModal open={exportOpen} project={project} onClose={() => setExportOpen(false)} toast={toast} />

      {toastMsg && <div className="toast"><Icon name="check" size={15} />{toastMsg}</div>}
    </div>
  )
}
