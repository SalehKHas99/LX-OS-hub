import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messagesApi, friendsApi, profilesApi } from '../api'
import { useAuthStore } from '../store'
import { MessageCircle, Send, User, ArrowLeft, Compass, UserPlus, Check, CheckCheck, Users, UserCheck, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ConversationSummary, Message } from '../types'
import { ensureKeyPairAndExportPublic, encrypt, decrypt, isEncrypted } from '../lib/e2e'

const POLL_INTERVAL_MS = 1000
const TYPING_DEBOUNCE_MS = 400
const SEEN_NOW_THRESHOLD_MS = 5 * 60 * 1000

function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatSeenLabel(readAt: string | null): string {
  if (!readAt) return 'Sent'
  const d = new Date(readAt)
  const now = new Date()
  if (now.getTime() - d.getTime() < SEEN_NOW_THRESHOLD_MS) return 'Seen now'
  return `Seen ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

type MessageTab = 'inbox' | 'requests' | 'friends'

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const withUserId = searchParams.get('with') ?? ''
  const tabParam = searchParams.get('tab') as MessageTab | null
  const [messageTab, setMessageTab] = useState<MessageTab>(tabParam === 'friends' || tabParam === 'requests' ? tabParam : 'inbox')

  useEffect(() => {
    if (tabParam === 'friends' || tabParam === 'requests') setMessageTab(tabParam)
  }, [tabParam])
  const [draft, setDraft] = useState('')
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([])
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const listEndRef = useRef<HTMLDivElement>(null)
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { isAuthenticated, user } = useAuthStore()
  const qc = useQueryClient()

  const { data: conversations = [], isLoading: loadingConvos } = useQuery({
    queryKey: ['messages', 'conversations'],
    queryFn: () => messagesApi.listConversations().then((r) => r.data),
    enabled: !!isAuthenticated,
    staleTime: 0,
  })

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['messages', 'requests'],
    queryFn: () => messagesApi.listRequests().then((r) => r.data),
    enabled: !!isAuthenticated,
    staleTime: 0,
  })

  const { data: requestsCount = { count: 0 } } = useQuery({
    queryKey: ['messages', 'requests-count'],
    queryFn: () => messagesApi.getRequestsCount().then((r) => r.data),
    enabled: !!isAuthenticated,
    staleTime: 0,
  })

  const acceptRequestMutation = useMutation({
    mutationFn: (userId: string) => messagesApi.acceptRequest(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', 'conversations'] })
      qc.invalidateQueries({ queryKey: ['messages', 'requests'] })
      qc.invalidateQueries({ queryKey: ['messages', 'requests-count'] })
    },
    onError: () => toast.error('Failed to accept'),
  })

  const { data: friendsList = [], isLoading: loadingFriends } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.list().then((r) => r.data),
    enabled: !!isAuthenticated && messageTab === 'friends',
  })

  const { data: friendRequests = [], isLoading: loadingFriendRequests } = useQuery({
    queryKey: ['friends', 'requests'],
    queryFn: () => friendsApi.listRequests().then((r) => r.data),
    enabled: !!isAuthenticated && messageTab === 'friends',
  })

  const acceptFriendMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.accept(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] })
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] })
    },
    onError: () => toast.error('Failed to accept'),
  })

  const declineFriendMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.decline(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] })
    },
  })

  const removeFriendMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.remove(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] })
    },
  })

  const list = messageTab === 'inbox' ? conversations : messageTab === 'requests' ? requests : []
  const loadingList = messageTab === 'inbox' ? loadingConvos : messageTab === 'requests' ? loadingRequests : false

  const {
    data: threadData,
    isLoading: loadingMessages,
    refetch: refetchThread,
  } = useQuery({
    queryKey: ['messages', 'with', withUserId],
    queryFn: () => messagesApi.getWith(withUserId).then((r) => r.data),
    enabled: !!withUserId && !!isAuthenticated,
    refetchInterval: withUserId ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const { data: typingData } = useQuery({
    queryKey: ['messages', 'typing', withUserId],
    queryFn: () => messagesApi.getTypingStatus(withUserId).then((r) => r.data),
    enabled: !!withUserId && !!isAuthenticated,
    refetchInterval: withUserId ? 1500 : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })

  const messages = (threadData?.messages ?? []).concat(optimisticMessages)

  const sendMutation = useMutation({
    mutationFn: ({ payload }: { plain: string; payload: string }) => messagesApi.send(withUserId, payload),
    onMutate: async ({ plain }) => {
      setDraft('')
      const tempId = `temp-${Date.now()}`
      const optimistic: Message = {
        id: tempId,
        sender_id: user!.id,
        recipient_id: withUserId,
        sender_username: user!.username,
        content: plain,
        created_at: new Date().toISOString(),
        read_at: null,
        is_from_me: true,
      }
      setOptimisticMessages((prev) => prev.concat(optimistic))
      return { tempId, optimistic }
    },
    onSuccess: (_serverMessage, _arg, ctx) => {
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== ctx?.tempId))
      refetchThread()
      qc.invalidateQueries({ queryKey: ['messages', 'conversations'] })
      qc.invalidateQueries({ queryKey: ['messages', 'unread-count'] })
    },
    onError: (_e, _arg, ctx) => {
      if (ctx?.tempId) setOptimisticMessages((prev) => prev.filter((m) => m.id !== ctx.tempId))
      toast.error('Failed to send')
    },
  })

  const sendTyping = useCallback(() => {
    if (!withUserId) return
    if (typingRef.current) clearTimeout(typingRef.current)
    typingRef.current = setTimeout(() => {
      messagesApi.setTyping(withUserId).catch(() => {})
      typingRef.current = null
    }, TYPING_DEBOUNCE_MS)
  }, [withUserId])

  useEffect(() => {
    if (withUserId) {
      messagesApi.markRead(withUserId).then(() => {
        qc.invalidateQueries({ queryKey: ['messages', 'conversations'] })
        qc.invalidateQueries({ queryKey: ['messages', 'unread-count'] })
      }).catch(() => {})
    }
  }, [withUserId, qc])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    return () => {
      if (typingRef.current) clearTimeout(typingRef.current)
    }
  }, [])

  const [, setSeenTick] = useState(0)
  useEffect(() => {
    if (!withUserId) return
    const t = setInterval(() => setSeenTick((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [withUserId])

  const openConversation = (userId: string) => setSearchParams(userId ? { with: userId } : {})
  const other = conversations.find((c) => c.other_user_id === withUserId) ?? requests.find((c) => c.other_user_id === withUserId)
  const otherUsername = threadData?.other_username ?? other?.other_username ?? 'User'
  const isRequest = !!requests.find((c) => c.other_user_id === withUserId)

  const { data: otherProfile } = useQuery({
    queryKey: ['profile', otherUsername],
    queryFn: () => profilesApi.get(otherUsername).then((r) => r.data),
    enabled: !!otherUsername && otherUsername !== 'User' && !!withUserId,
  })

  const [decryptedContent, setDecryptedContent] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!otherProfile?.public_key || !messages.length) {
      setDecryptedContent({})
      return
    }
    let cancelled = false
    const run = async () => {
      const next: Record<string, string> = {}
      for (const m of messages) {
        if (!isEncrypted(m.content)) continue
        try {
          const plain = await decrypt(m.content, otherProfile.public_key)
          if (!cancelled) next[m.id] = plain
        } catch {
          if (!cancelled) next[m.id] = '[Encrypted]'
        }
      }
      if (!cancelled) setDecryptedContent(next)
    }
    run()
    return () => { cancelled = true }
  }, [messages, otherProfile?.public_key])

  useEffect(() => {
    if (!isAuthenticated) return
    ensureKeyPairAndExportPublic().then((pub) => {
      profilesApi.setPublicKey(pub).catch(() => {})
    })
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return (
      <div className="page-container page-content">
        <div className="empty-state theme-card card-padding" style={{ maxWidth: 420, margin: '0 auto' }}>
          <MessageCircle size={48} style={{ color: 'var(--text-3)' }} className="empty-state-icon" />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-1)', marginBottom: 8 }}>
            Messages
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>Sign in to view and send messages.</p>
          <Link to="/login" className="btn btn-primary" style={{ fontSize: 13 }}>Sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container page-content" style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1 className="page-title">Messages</h1>
        <p className="page-subtitle">Direct conversations with other creators. Start one from their profile.</p>
      </div>

      <div
        className="theme-card shimmer-top"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 280px) 1fr',
          gap: 0,
          minHeight: 420,
          height: 'calc(100vh - 200px)',
          maxHeight: 'calc(100vh - 200px)',
          overflow: 'hidden',
          border: '1px solid rgba(167,139,250,0.12)',
          borderRadius: 16,
          background: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Conversation list */}
        <div
          style={{
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => { setMessageTab('inbox'); setSearchParams((prev) => { const p = new URLSearchParams(prev); p.delete('tab'); return p }) }}
              className={messageTab === 'inbox' ? 'tab-item active' : 'tab-item'}
              style={{ flex: 1, fontSize: 12 }}
            >
              Inbox
            </button>
            <button
              type="button"
              onClick={() => { setMessageTab('requests'); setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set('tab', 'requests'); return p }) }}
              className={messageTab === 'requests' ? 'tab-item active' : 'tab-item'}
              style={{ flex: 1, fontSize: 12, position: 'relative' }}
            >
              Requests
              {requestsCount.count > 0 && (
                <span style={{ marginLeft: 4, background: 'var(--accent)', color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 999 }}>
                  {requestsCount.count}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setMessageTab('friends'); setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set('tab', 'friends'); return p }) }}
              className={messageTab === 'friends' ? 'tab-item active' : 'tab-item'}
              style={{ flex: 1, fontSize: 12 }}
            >
              Friends
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {messageTab === 'friends' ? (
              <>
                {loadingFriendRequests || loadingFriends ? (
                  <div style={{ padding: 12 }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                        <div className="skeleton skeleton-line medium" style={{ height: 16, marginBottom: 6 }} />
                        <div className="skeleton skeleton-line short" style={{ height: 12 }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {friendRequests.length > 0 && (
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <UserCheck size={14} /> Incoming ({friendRequests.length})
                        </div>
                        {friendRequests.map((r) => (
                          <div
                            key={r.user_id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '10px 0',
                              borderBottom: '1px solid rgba(167,139,250,0.08)',
                            }}
                          >
                            <Link to={`/u/${r.username}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', textDecoration: 'none' }} className="link-hover-underline" onClick={(e) => e.stopPropagation()}>
                              {r.username}
                            </Link>
                            <span style={{ display: 'flex', gap: 6 }}>
                              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={(e) => { e.stopPropagation(); declineFriendMutation.mutate(r.user_id) }} disabled={declineFriendMutation.isPending}>Decline</button>
                              <button type="button" className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={(e) => { e.stopPropagation(); acceptFriendMutation.mutate(r.user_id) }} disabled={acceptFriendMutation.isPending}>Accept</button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ padding: '8px 16px 12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={14} /> Your friends ({friendsList.length})
                      </div>
                      {friendsList.length === 0 && friendRequests.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>No friends yet. Send requests from creator profiles.</p>
                      ) : (
                        friendsList.map((f) => (
                          <div
                            key={f.user_id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              padding: '10px 12px',
                              borderRadius: 10,
                              background: 'rgba(0,0,0,0.15)',
                              marginBottom: 6,
                              border: '1px solid var(--border)',
                            }}
                          >
                            <Link to={`/u/${f.username}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', textDecoration: 'none' }} className="link-hover-underline" onClick={(e) => e.stopPropagation()}>
                              {f.username}
                            </Link>
                            <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                              <Link to={`/messages?with=${f.user_id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={(e) => e.stopPropagation()}>Message</Link>
                              <button type="button" className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-3)' }} onClick={(e) => { e.stopPropagation(); removeFriendMutation.mutate(f.user_id) }} disabled={removeFriendMutation.isPending} title="Remove friend">Remove</button>
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </>
            ) : loadingList ? (
              <div style={{ padding: 12 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="skeleton skeleton-line medium" style={{ height: 16, marginBottom: 6 }} />
                    <div className="skeleton skeleton-line short" style={{ height: 12 }} />
                  </div>
                ))}
              </div>
            ) : list.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center' }}>
                <UserPlus size={32} style={{ color: 'var(--text-3)', marginBottom: 12, opacity: 0.7 }} />
                <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                  {messageTab === 'requests'
                    ? 'No message requests. When someone you haven\'t chatted with messages you, they appear here.'
                    : 'No conversations yet. Open a creator\'s profile and click Message to start one.'}
                </p>
                <Link to="/feed" className="btn btn-ghost" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Compass size={14} /> Browse Explore
                </Link>
              </div>
            ) : (
            list.map((c) => (
              <div
                key={c.other_user_id}
                role="button"
                tabIndex={0}
                onClick={() => openConversation(c.other_user_id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openConversation(c.other_user_id) }}
                className={`conv-list-item ${c.other_user_id === withUserId ? 'active' : ''}`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.other_username}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.unread_count > 0 && (
                      <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 999 }}>
                        {c.unread_count}
                      </span>
                    )}
                    {messageTab === 'requests' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); acceptRequestMutation.mutate(c.other_user_id) }}
                        disabled={acceptRequestMutation.isPending}
                        className="btn btn-primary"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        Accept
                      </button>
                    )}
                  </span>
                </div>
                {c.last_message_preview && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isEncrypted(c.last_message_preview) ? '🔒 Encrypted' : c.last_message_preview}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Thread + composer: fixed height so sending doesn't expand page */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, minHeight: 0, background: 'rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        {!withUserId ? (
          <div
            className="empty-state"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              color: 'var(--text-3)',
              fontSize: 14,
            }}
          >
            <MessageCircle size={44} style={{ marginBottom: 16, opacity: 0.5 }} />
            <p style={{ color: 'var(--text-2)', marginBottom: 12, textAlign: 'center' }}>
              Select a conversation or start a new one from a creator&apos;s profile.
            </p>
            <Link to="/feed" className="btn btn-ghost" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Compass size={14} /> Go to Explore
            </Link>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <header
              className="messages-thread-header"
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: 'rgba(0,0,0,0.25)',
              }}
            >
              <button
                type="button"
                onClick={() => openConversation('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 8 }}
                aria-label="Back to list"
                className="link-hover-underline"
              >
                <ArrowLeft size={22} />
              </button>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(167,139,250,0.35), rgba(110,86,207,0.4))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <User size={20} style={{ color: 'var(--text-2)' }} />
              </div>
              <Link to={`/u/${otherUsername}`} style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-1)', textDecoration: 'none' }} className="link-hover-underline">
                {otherUsername}
              </Link>
            </header>

            {isRequest && (
              <div style={{ padding: '8px 20px', background: 'rgba(167,139,250,0.12)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Message request — accept to move to inbox</span>
                <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => acceptRequestMutation.mutate(withUserId)} disabled={acceptRequestMutation.isPending}>Accept</button>
              </div>
            )}

            {typingData?.typing && (
              <div style={{ padding: '6px 20px 10px', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
                {otherUsername} is typing…
              </div>
            )}

            {/* Messages: scrollable area with fixed flex so container doesn't grow */}
            <div className="messages-thread" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {threadData?.has_more && threadData?.messages?.length && (
                <div style={{ alignSelf: 'center', marginBottom: 8 }}>
                  <button
                    type="button"
                    disabled={loadingOlder}
                    onClick={() => {
                      const before = threadData.messages[0]?.created_at
                      if (!before || loadingOlder) return
                      setLoadingOlder(true)
                      messagesApi
                        .getWith(withUserId, { before, limit: 50 })
                        .then((r) => {
                          if (r.data.messages.length) {
                            qc.setQueryData(['messages', 'with', withUserId], (old: typeof threadData) =>
                              old
                                ? {
                                    ...old,
                                    messages: [...(r.data.messages ?? []), ...(old.messages ?? [])],
                                    has_more: r.data.has_more,
                                    next_before: r.data.next_before,
                                  }
                                : old
                            )
                          }
                        })
                        .finally(() => setLoadingOlder(false))
                    }}
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                  >
                    {loadingOlder ? 'Loading…' : 'Load older messages'}
                  </button>
                </div>
              )}
              {loadingMessages ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                  <div className="skeleton" style={{ alignSelf: 'flex-start', width: '60%', height: 48, borderRadius: 14 }} />
                  <div className="skeleton" style={{ alignSelf: 'flex-end', width: '50%', height: 40, borderRadius: 14 }} />
                  <div className="skeleton" style={{ alignSelf: 'flex-start', width: '70%', height: 52, borderRadius: 14 }} />
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`message-bubble ${m.is_from_me ? 'message-bubble--me' : 'message-bubble--them'}`}
                    style={{ position: 'relative' }}
                  >
                    {editingMessageId === m.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <textarea
                          className="input"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={2}
                          style={{ width: '100%', fontSize: 14 }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                            onClick={async () => {
                              const text = editContent.trim()
                              if (!text) return
                              try {
                                if (otherProfile?.public_key) {
                                  const payload = await encrypt(text, otherProfile.public_key)
                                  await messagesApi.update(m.id, payload)
                                } else {
                                  await messagesApi.update(m.id, text)
                                }
                                setEditingMessageId(null)
                                refetchThread()
                                toast.success('Message updated')
                              } catch { toast.error('Failed to update') }
                            }}
                          >
                            Save
                          </button>
                          <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { setEditingMessageId(null); setEditContent('') }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p style={{ margin: 0 }}>{decryptedContent[m.id] ?? (isEncrypted(m.content) ? '[Encrypted]' : m.content)}</p>
                        <div className="message-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="message-time">{formatMessageTime(m.created_at)}</span>
                          {m.is_from_me && (
                            <>
                              <span
                                className={`message-seen ${m.read_at && (Date.now() - new Date(m.read_at).getTime() < SEEN_NOW_THRESHOLD_MS) ? 'recent' : ''}`}
                                title={formatSeenLabel(m.read_at)}
                              >
                                {m.read_at ? <CheckCheck size={12} /> : <Check size={12} />}
                                {m.read_at ? (Date.now() - new Date(m.read_at).getTime() < SEEN_NOW_THRESHOLD_MS ? 'Seen now' : `Seen ${new Date(m.read_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`) : 'Sent'}
                              </span>
                              <button type="button" aria-label="Edit" style={{ padding: 2, border: 'none', background: 'none', color: 'var(--text-3)', cursor: 'pointer', opacity: 0.7 }} onClick={() => { setEditingMessageId(m.id); setEditContent(decryptedContent[m.id] ?? m.content) }}><Pencil size={12} /></button>
                              <button type="button" aria-label="Delete" style={{ padding: 2, border: 'none', background: 'none', color: 'var(--text-3)', cursor: 'pointer', opacity: 0.7 }} onClick={async () => { if (!window.confirm('Delete this message?')) return; await messagesApi.delete(m.id); refetchThread(); toast.success('Message deleted') }}><Trash2 size={12} /></button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
              <div ref={listEndRef} />
            </div>

            {/* Composer */}
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const text = draft.trim()
                if (!text || sendMutation.isPending) return
                if (otherProfile?.public_key) {
                  try {
                    const payload = await encrypt(text, otherProfile.public_key)
                    sendMutation.mutate({ plain: text, payload })
                  } catch {
                    toast.error('Encryption failed')
                  }
                } else {
                  sendMutation.mutate({ plain: text, payload: text })
                }
              }}
              className="messages-composer"
              style={{
                padding: '14px 20px 18px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-end',
                background: 'rgba(0,0,0,0.15)',
              }}
            >
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value)
                  sendTyping()
                }}
                placeholder="Type a message…"
                rows={1}
                maxLength={10000}
                className="input"
                style={{
                  flex: 1,
                  resize: 'none',
                  minHeight: 44,
                  maxHeight: 120,
                  borderRadius: 14,
                  padding: '12px 16px',
                  fontSize: 14,
                }}
              />
              <button
                type="submit"
                disabled={!draft.trim() || sendMutation.isPending}
                className="btn btn-primary"
                style={{ padding: '12px 16px', borderRadius: 14, flexShrink: 0 }}
              >
                <Send size={18} />
              </button>
            </form>
          </>
        )}
      </div>
      </div>
    </div>
  )
}
