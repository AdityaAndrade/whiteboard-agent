import { useMemo, useState } from 'react'
import { buildMarkdown } from '@/lib/wb-export'
import type { Project } from '@/types'
import { Btn } from './Button'
import { Icon } from './Icon'
import { Modal } from './Modal'

const HEADING_RE = /^#{1,6}\s/
const COMMENT_RE = /^(>|```|---)/

export function MdView({ md }: { md: string }) {
  const lines = md.split('\n')
  return (
    <pre className="md-pre">
      {lines.map((line, i) => {
        const cls = HEADING_RE.test(line) ? 'h' : COMMENT_RE.test(line) ? 'c' : undefined
        return (
          <div key={i} className={cls}>{line.length ? line : ' '}</div>
        )
      })}
    </pre>
  )
}

interface ExportModalProps {
  open: boolean
  project: Project | null
  onClose: () => void
  toast: (msg: string) => void
}

export function ExportModal({ open, project, onClose, toast }: ExportModalProps) {
  const [busy, setBusy] = useState<'copy' | 'download' | null>(null)
  const md = useMemo(() => (project ? buildMarkdown(project) : ''), [project])

  const copy = async () => {
    setBusy('copy')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(md)
      } else {
        const ta = document.createElement('textarea')
        ta.value = md
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast('Copied whiteboard.md to clipboard')
    } catch {
      toast('Couldn’t copy — try downloading instead')
    } finally {
      setBusy(null)
    }
  }

  const download = () => {
    setBusy('download')
    try {
      const blob = new Blob([md], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'whiteboard.md'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast('Downloaded whiteboard.md')
    } finally {
      setBusy(null)
    }
  }

  if (!project) return null

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="modal-head">
        <div className="mh-ic"><Icon name="file" size={17} /></div>
        <div>
          <h2>Export whiteboard.md</h2>
          <p>A build-ready spec Claude Code or Codex can turn into the real thing.</p>
        </div>
      </div>
      <MdView md={md} />
      <div className="modal-foot">
        <div className="spacer" />
        <Btn kind="soft" icon="copy" onClick={copy} disabled={busy !== null}>
          {busy === 'copy' ? 'Copying…' : 'Copy'}
        </Btn>
        <Btn kind="primary" icon="download" onClick={download} disabled={busy !== null}>
          {busy === 'download' ? 'Downloading…' : 'Download .md'}
        </Btn>
      </div>
    </Modal>
  )
}
