import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Project } from '@/types'
import type { EditorActions } from '@/lib/use-project-editor'
import { usePlan } from '@/lib/plan-store'
import { useBrainstorm, type ChatMessage } from '@/lib/use-brainstorm'
import { BRAINSTORM_MONTHLY_CAP } from '@/lib/plans'
import { Btn } from './Button'
import { Icon } from './Icon'

/* ── Pro-upsell gate ───────────────────────────────────────────────────── */
function UpsellView({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="inspector" style={{ justifyContent: 'center', alignItems: 'center', padding: 24, gap: 18, display: 'flex', flexDirection: 'column' }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>
        <Icon name="spark" size={22} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 15, letterSpacing: -0.01 }}>Brainstorm is Pro</p>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.5, maxWidth: 220 }}>
          Get AI-powered workflow ideation and live canvas editing with a Pro plan.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        <Btn kind="primary" onClick={() => navigate('/pricing')} style={{ justifyContent: 'center' }}>
          View plans
        </Btn>
        <Btn kind="ghost" onClick={onClose} style={{ justifyContent: 'center' }}>
          Maybe later
        </Btn>
      </div>
    </div>
  )
}

/* ── Message bubble ────────────────────────────────────────────────────── */
function MessageBubble({ msg, showRewrite, onRewrite }: {
  msg: ChatMessage
  showRewrite?: boolean
  onRewrite?: () => void
}) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!msg.content) return
    navigator.clipboard.writeText(msg.content).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [msg.content])

  const actionBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '2px 4px', borderRadius: 4,
    display: 'flex', alignItems: 'center',
    lineHeight: 1,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
      <div
        style={{
          maxWidth: '88%',
          padding: '9px 12px',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          background: isUser ? 'var(--accent)' : 'var(--surface-2)',
          color: isUser ? '#fff' : 'var(--ink)',
          fontSize: 13,
          lineHeight: 1.55,
          border: isUser ? 'none' : '1px solid var(--line)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {msg.content || (msg.streaming ? null : '…')}
        {msg.streaming && (
          <span style={{ display: 'inline-block', width: 8, height: 13, marginLeft: 2, background: 'var(--ink-faint)', borderRadius: 2, verticalAlign: 'text-bottom', animation: 'bs-blink 1s step-end infinite' }} />
        )}
      </div>
      {msg.changes && msg.changes.length > 0 && (
        <div style={{ maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 2 }}>
          {msg.changes.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-3)' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
                {c.action === 'delete' ? <Icon name="trash" size={11} /> : <Icon name="check" size={11} />}
              </span>
              {c.label}
            </div>
          ))}
        </div>
      )}
      {!msg.streaming && msg.content && (
        <div style={{ display: 'flex', gap: 1, alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
          <button
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy'}
            style={{ ...actionBtnStyle, color: copied ? 'var(--accent)' : 'var(--ink-faint)' }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={11} />
          </button>
          {showRewrite && (
            <button
              onClick={onRewrite}
              title="Rewrite"
              style={{ ...actionBtnStyle, color: 'var(--ink-faint)' }}
            >
              <Icon name="refresh" size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main panel ────────────────────────────────────────────────────────── */
interface BrainstormPanelProps {
  project: Project
  actions: EditorActions
  onClose: () => void
}

export function BrainstormPanel({ project, actions, onClose }: BrainstormPanelProps) {
  const { plan } = usePlan()
  const { messages, streaming, error, send, clear, rewrite, longTermMemory, clearLongTermMemory, usageCount } = useBrainstorm(project, actions)
  const [input, setInput] = useState('')
  const [confirmClearMemory, setConfirmClearMemory] = useState(false)
  const atCap = usageCount >= BRAINSTORM_MONTHLY_CAP
  const listRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  const handleSend = () => {
    const text = input.trim()
    if (!text || streaming || atCap) return
    setInput('')
    send(text)
    textRef.current?.focus()
  }

  if (plan !== 'pro') return <UpsellView onClose={onClose} />

  const isEmpty = messages.length === 0

  return (
    <div className="inspector" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="insp-head" style={{ gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0 }}>
          <Icon name="spark" size={14} />
        </div>
        <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: -0.01, flex: 1 }}>Brainstorm</span>
        {messages.length > 0 && (
          <Btn kind="ghost" size="s" onClick={clear} title="Clear conversation (keeps memory)" style={{ opacity: 0.7 }}>
            <Icon name="trash" size={13} />
          </Btn>
        )}
        <Btn kind="ghost" size="s" onClick={onClose} title="Close">
          <Icon name="close" size={13} />
        </Btn>
      </div>

      {/* Long-term memory indicator */}
      {longTermMemory.length > 0 && (
        <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-3)' }}>
          <Icon name="spark" size={11} />
          <span style={{ flex: 1 }}>{longTermMemory.length} memory {longTermMemory.length === 1 ? 'fact' : 'facts'} saved</span>
          {confirmClearMemory ? (
            <>
              <span style={{ color: 'var(--ink-faint)' }}>Clear?</span>
              <button
                onClick={() => { clearLongTermMemory(); setConfirmClearMemory(false) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-output)', fontSize: 11.5, padding: '0 2px' }}
              >Yes</button>
              <button
                onClick={() => setConfirmClearMemory(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 11.5, padding: '0 2px' }}
              >No</button>
            </>
          ) : (
            <button
              onClick={() => setConfirmClearMemory(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 11.5, padding: 0, textDecoration: 'underline' }}
            >clear</button>
          )}
        </div>
      )}

      {/* Message list */}
      <div
        ref={listRef}
        style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {isEmpty && !streaming && (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '24px 8px', color: 'var(--ink-faint)' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✦</div>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>
              Ask me anything
            </p>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, maxWidth: 200 }}>
              I can add nodes, connect them, and help you design your workflow.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLastAssistant =
            msg.role === 'assistant' &&
            !msg.streaming &&
            !messages.slice(i + 1).some((m) => m.role === 'assistant')
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              showRewrite={isLastAssistant && !streaming}
              onRewrite={rewrite}
            />
          )
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ margin: '0 12px 8px', padding: '8px 12px', background: 'oklch(0.96 0.04 18)', border: '1px solid oklch(0.88 0.08 18)', borderRadius: 'var(--r)', fontSize: 12.5, color: 'var(--t-output)', lineHeight: 1.4 }}>
          {error}
        </div>
      )}

      {/* Input area */}
      <div style={{ padding: '10px 12px 12px', borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={textRef}
            className="ta"
            placeholder={atCap ? 'Monthly limit reached — resets on the 1st.' : 'Describe what to add or change…'}
            value={input}
            rows={1}
            disabled={streaming || atCap}
            style={{ flex: 1, minHeight: 36, maxHeight: 120, resize: 'none', padding: '8px 10px', fontSize: 13, lineHeight: 1.4, overflowY: 'auto' }}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Btn
            kind="primary"
            size="s"
            disabled={!input.trim() || streaming || atCap}
            onClick={handleSend}
            title="Send (Enter)"
            style={{ flexShrink: 0, height: 36 }}
          >
            <Icon name="arrow" size={14} />
          </Btn>
        </div>
        {usageCount > 0 && (
          <div style={{
            marginTop: 6,
            fontSize: 11,
            textAlign: 'right',
            color: atCap
              ? 'var(--t-output)'
              : usageCount >= BRAINSTORM_MONTHLY_CAP * 0.8
              ? 'oklch(0.62 0.13 60)'
              : 'var(--ink-faint)',
          }}>
            {usageCount} / {BRAINSTORM_MONTHLY_CAP} messages this month
          </div>
        )}
      </div>

      {/* Blink keyframe – injected once per mount */}
      <style>{`@keyframes bs-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}
