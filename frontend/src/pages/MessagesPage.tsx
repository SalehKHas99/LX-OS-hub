import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messagesApi } from '../api'
import { useAuthStore } from '../store'
import { MessageCircle, Send, Loader2, User, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ConversationSummary, Message } from '../types'

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const withUserId = searchParams.get('with') ?? ''
  const [draft, setDraft] = useState('')
  const listEndRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated, user } = useAuthStore()
  const qc = useQueryClient()

  const { data: conversations = [], isLoading: loadingConvos } = useQuery({
    queryKey: ['messages', 'conversations'],
    queryFn: () => messagesApi.listConversations().then((r) => r.data),
    enabled: !!isAuthenticated,
  })

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', 'with', withUserId],
    queryFn: () => messagesApi.getWith(withUserId).then((r) => r.data),
    enabled: !!withUserId && !!isAuthenticated,
  })

  const sendMutation = useMutation({
    mutationFn: (content: string) => messagesApi.send(withUserId, content),
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['messages', 'with', withUserId] })
      qc.invalidateQueries({ queryKey: ['messages', 'conversations'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to send'),
  })

  useEffect(() => {
    if (withUserId) {
      messagesApi.markRead(withUserId).catch(() => {})
      qc.invalidateQueries({ queryKey: ['messages', 'conversations'] })
    }
  }, [withUserId, qc])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const openConversation = (userId: string) => setSearchParams(userId ? { with: userId } : {})
  const other = conversations.find((c) => c.other_user_id === withUserId)
  const otherUsername = other?.other_username ?? 'User'

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 40, textAlign: 'center' }}>
        <MessageCircle size={48} style={{ color: 'var(--text-3)', marginBottom: 16 }} />
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-1)', marginBottom: 8 }}>
          Messages
        </h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Sign in to view and send messages.</p>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 280px) 1fr',
        gap: 0,
        height: 'calc(100vh - 120px)',
        maxWidth: 900,
        margin: '0 auto',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(15,23,42,0.6)',
      }}
    >
      {/* Conversation list */}
      <div
        style={{
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-1)' }}>
            Messages
          </h1>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvos ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Loader2 size={24} style={{ color: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              No conversations yet. Start one from a user&apos;s profile.
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.other_user_id}
                type="button"
                onClick={() => openConversation(c.other_user_id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: c.other_user_id === withUserId ? 'rgba(167,139,250,0.15)' : 'transparent',
                  color: 'var(--text-1)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.other_username}</span>
                  {c.unread_count > 0 && (
                    <span
                      style={{
                        background: 'var(--accent)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 999,
                      }}
                    >
                      {c.unread_count}
                    </span>
                  )}
                </div>
                {c.last_message_preview && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.last_message_preview}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread + composer */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!withUserId ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              color: 'var(--text-3)',
              fontSize: 14,
            }}
          >
            <MessageCircle size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p>Select a conversation or start a new one from a user profile.</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={() => openConversation('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 4 }}
                aria-label="Back to list"
              >
                <ArrowLeft size={20} />
              </button>
              <User size={20} style={{ color: 'var(--text-3)' }} />
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-1)' }}>{otherUsername}</span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loadingMessages ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                  <Loader2 size={24} style={{ color: 'var(--accent)' }} />
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.is_from_me ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      padding: '10px 14px',
                      borderRadius: 14,
                      background: m.is_from_me ? 'var(--accent)' : 'rgba(148,163,184,0.2)',
                      color: m.is_from_me ? '#fff' : 'var(--text-1)',
                      fontSize: 14,
                      fontFamily: 'var(--font-body)',
                      borderBottomRightRadius: m.is_from_me ? 4 : 14,
                      borderBottomLeftRadius: m.is_from_me ? 14 : 4,
                    }}
                  >
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.85 }}>{new Date(m.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
              <div ref={listEndRef} />
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const text = draft.trim()
                if (!text || sendMutation.isPending) return
                sendMutation.mutate(text)
              }}
              style={{
                padding: 12,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-end',
              }}
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                rows={1}
                maxLength={10000}
                style={{
                  flex: 1,
                  resize: 'none',
                  minHeight: 40,
                  maxHeight: 120,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'rgba(0,0,0,0.25)',
                  color: 'var(--text-1)',
                  padding: '10px 14px',
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!draft.trim() || sendMutation.isPending}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: draft.trim() && !sendMutation.isPending ? 'pointer' : 'not-allowed',
                  opacity: draft.trim() && !sendMutation.isPending ? 1 : 0.5,
                }}
              >
                {sendMutation.isPending ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={18} />}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
