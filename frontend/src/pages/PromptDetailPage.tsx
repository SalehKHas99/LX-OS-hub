import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { promptsApi, labApi } from '../api'
import { Copy, FlaskConical, ChevronRight, Send, MessageCircle, Bookmark, Pencil, Trash2 } from 'lucide-react'
import { SkeletonDetailLayout } from '../components/ui/Skeleton'
import { VoteButtons } from '../components/ui/VoteButtons'
import { useAuthStore } from '../store'
import toast from 'react-hot-toast'
import type { Comment as CommentType } from '../types'

const FIELD_LABELS: Record<string, string> = {
  subject:          'Subject',
  environment:      'Environment',
  composition:      'Composition',
  lighting:         'Lighting',
  style:            'Style',
  camera_or_render: 'Camera / Render',
  mood:             'Mood',
  color_palette:    'Color Palette',
  negative_prompt:  'Negative Prompt',
  model_parameters: 'Parameters',
  notes_and_rationale: 'Notes',
}

function CommentBlock({
  comment,
  promptId,
  isAuthenticated,
  currentUserId,
  replyText,
  onReplyTextChange,
  onReplySubmit,
  refetchComments,
  isReply = false,
}: {
  comment: CommentType
  promptId: string
  isAuthenticated: boolean
  currentUserId?: string
  replyText: string
  onReplyTextChange: (text: string) => void
  onReplySubmit: (e: React.FormEvent) => void
  refetchComments: () => void
  isReply?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const isOwn = !!currentUserId && comment.user.id === currentUserId

  const handleCommentVote = async (value: 1 | -1 | null) => {
    if (value === null) await promptsApi.removeCommentVote(promptId, comment.id)
    else await promptsApi.voteComment(promptId, comment.id, value)
  }
  const handleSaveEdit = async () => {
    const trimmed = editContent.trim()
    if (!trimmed) return
    await promptsApi.updateComment(promptId, comment.id, trimmed)
    setEditing(false)
    refetchComments()
    toast.success('Comment updated')
  }
  const handleDelete = async () => {
    if (!window.confirm('Delete this comment?')) return
    await promptsApi.deleteComment(promptId, comment.id)
    refetchComments()
    toast.success('Comment deleted')
  }
  const score = comment.vote_score ?? 0
  const currentVote = comment.current_user_vote ?? null
  return (
    <div id={`comment-${comment.id}`} style={{ display: 'flex', gap: 12, marginLeft: isReply ? 32 : 0 }}>
      <Link to={`/u/${comment.user.username}`} style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
        <div className="avatar-circle" style={{ marginTop: 2 }}>
          {comment.user.username[0].toUpperCase()}
        </div>
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <Link
            to={`/u/${comment.user.username}`}
            style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-1)', textDecoration: 'none' }}
            className="link-hover-underline"
          >
            {comment.user.username}
          </Link>
          <VoteButtons
            score={score}
            currentUserVote={currentVote}
            onVote={handleCommentVote}
            invalidateKeys={[['comments', promptId]]}
            compact
          />
          {isOwn && !editing && (
            <>
              <button type="button" onClick={() => { setEditing(true); setEditContent(comment.content) }} aria-label="Edit" style={{ padding: 2, border: 'none', background: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><Pencil size={12} /></button>
              <button type="button" onClick={handleDelete} aria-label="Delete" style={{ padding: 2, border: 'none', background: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><Trash2 size={12} /></button>
            </>
          )}
        </div>
        {editing ? (
          <div style={{ marginTop: 4, marginBottom: 8 }}>
            <textarea className="input" value={editContent} onChange={e => setEditContent(e.target.value)} rows={2} style={{ width: '100%', fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button type="button" onClick={handleSaveEdit} className="btn btn-primary" style={{ padding: '6px 10px', fontSize: 12 }}>Save</button>
              <button type="button" onClick={() => { setEditing(false); setEditContent(comment.content) }} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-body)', marginTop: 4, marginBottom: 8 }}>
            {comment.content}
          </p>
        )}
        {!isReply && isAuthenticated && (
          <form onSubmit={onReplySubmit} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input
              className="input"
              style={{ flex: 1, fontSize: 12 }}
              placeholder="Reply... Use @username to mention"
              value={replyText}
              onChange={e => onReplyTextChange(e.target.value)}
            />
            <button type="submit" className="btn btn-ghost" style={{ padding: '6px 10px' }}>
              <Send size={12} />
            </button>
          </form>
        )}
        {(comment.replies ?? []).map(r => (
          <CommentBlock
            key={r.id}
            comment={r}
            promptId={promptId}
            isAuthenticated={isAuthenticated}
            currentUserId={currentUserId}
            replyText=""
            onReplyTextChange={() => {}}
            onReplySubmit={(e) => e.preventDefault()}
            refetchComments={refetchComments}
            isReply
          />
        ))}
      </div>
    </div>
  )
}

export default function PromptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated, user: me } = useAuthStore()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'context' | 'comments'>('context')

  const { data: prompt, isLoading } = useQuery({
    queryKey: ['prompt', id],
    queryFn: () => promptsApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => promptsApi.comments(id!).then(r => r.data),
    enabled: !!id,
  })
  const location = useLocation()

  // Scroll to comment when hash is #comment-{id}
  useEffect(() => {
    const hash = location.hash
    if (hash.startsWith('#comment-')) {
      const commentId = hash.slice(9)
      document.getElementById(`comment-${commentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [location.hash, comments])

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt?.raw_prompt ?? '')
    toast.success('Copied to clipboard')
  }

  const handlePromptVote = async (value: 1 | -1 | null) => {
    if (value === null) await promptsApi.removeVote(id!)
    else await promptsApi.vote(id!, value)
  }
  const handleSave = async () => {
    if (!isAuthenticated) { toast.error('Sign in to save'); return }
    try {
      if (prompt?.is_saved) await promptsApi.unsave(id!)
      else await promptsApi.save(id!)
      queryClient.invalidateQueries({ queryKey: ['prompt', id] })
      toast.success(prompt?.is_saved ? 'Removed from saved' : 'Saved')
    } catch { toast.error('Failed to save') }
  }

  const handleComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault()
    const text = parentId ? replyText[parentId] : comment
    if (!text?.trim()) return
    await promptsApi.addComment(id!, text, parentId)
    if (parentId) setReplyText(prev => ({ ...prev, [parentId]: '' }))
    else setComment('')
    refetchComments()
    toast.success('Comment added')
  }

  if (isLoading) {
    return <SkeletonDetailLayout />
  }

  if (!prompt) {
    return (
      <div className="empty-state">
        <p style={{ color: 'var(--text-2)' }}>Prompt not found</p>
      </div>
    )
  }

  return (
    <div className="page-container page-container-lg" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingBottom: '2rem' }}>
      <div className="breadcrumb">
        <Link to="/feed">Feed</Link>
        <ChevronRight size={14} />
        <span>{prompt.title}</span>
      </div>

      <div className="detail-grid" style={{ gap: 24 }}>
        {/* Left — Images & tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {prompt.images.length > 0 ? (
            <div className="card theme-card" style={{ overflow: 'hidden' }}>
              <img
                src={prompt.images[0].image_url}
                alt={prompt.images[0].alt_text ?? prompt.title}
                style={{ width: '100%', objectFit: 'cover', maxHeight: 520 }}
              />
            </div>
          ) : (
            <div className="card theme-card" style={{ aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '3rem', fontFamily: 'var(--font-mono)', color: 'var(--border)' }}>[ ]</span>
            </div>
          )}

          <div className="card theme-card">
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {(['context', 'comments'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: 13,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    border: 'none',
                    borderBottom: activeTab === tab ? '2px solid var(--nebula-glow)' : '2px solid transparent',
                    background: 'none',
                    color: activeTab === tab ? 'var(--nebula-soft)' : 'var(--text-3)',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease, border-color 0.2s ease',
                  }}
                >
                  {tab} {tab === 'comments' && `(${comments?.length ?? 0})`}
                </button>
              ))}
            </div>
            <div style={{ padding: 16 }}>
              {activeTab === 'context' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {prompt.context_blocks.map(block => (
                    <div key={block.id}>
                      <p className="label">{FIELD_LABELS[block.field_name] ?? block.field_name}</p>
                      <p className="context-value">
                        {block.field_value || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Not specified</span>}
                      </p>
                    </div>
                  ))}
                  {prompt.context_blocks.length === 0 && (
                    <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: 16 }}>
                      No context blocks — open Context Optimizer to parse this prompt
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {isAuthenticated && (
                    <form onSubmit={(e) => handleComment(e)} style={{ display: 'flex', gap: 12 }}>
                      <input
                        className="input"
                        style={{ flex: 1, fontSize: 13 }}
                        placeholder="Add a comment... Use @username to mention"
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                      />
                      <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px' }}>
                        <Send size={14} />
                      </button>
                    </form>
                  )}
                  {(comments ?? []).map(c => (
                    <CommentBlock
                      key={c.id}
                      comment={c}
                      promptId={id!}
                      isAuthenticated={!!isAuthenticated}
                      currentUserId={me?.id}
                      replyText={replyText[c.id]}
                      onReplyTextChange={(text) => setReplyText(prev => ({ ...prev, [c.id]: text }))}
                      onReplySubmit={(e) => handleComment(e, c.id)}
                      refetchComments={refetchComments}
                    />
                  ))}
                  {(comments ?? []).length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: 16 }}>No comments yet</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — Prompt info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card theme-card card-padding">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-1)', lineHeight: 1.3, margin: 0 }}>
                {prompt.title}
              </h1>
              {prompt.model_family && (
                <span className="badge-xenon" style={{ flexShrink: 0 }}>{prompt.model_family}</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              <Link
                to={`/u/${prompt.creator.username}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}
              >
                <div className="avatar-circle">
                  {prompt.creator.username[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-body)' }}>
                  {prompt.creator.username}
                </span>
              </Link>
              {me?.id && prompt.creator.id !== me.id && (
                <Link to={`/messages?with=${prompt.creator.id}`} className="btn-message">
                  <MessageCircle size={14} /> Message
                </Link>
              )}
            </div>

            {prompt.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {prompt.tags.map(tag => (
                  <span key={tag.id} className="badge">{tag.display_name}</span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <VoteButtons
                score={prompt.score}
                currentUserVote={prompt.current_user_vote ?? null}
                onVote={handlePromptVote}
                invalidateKeys={[['prompt', id], ['feed']]}
              />
              <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                <button type="button" onClick={handleSave} className="btn btn-ghost" style={{ flex: 1, minWidth: 90 }} title={prompt.is_saved ? 'Unsave' : 'Save'}>
                  <Bookmark size={14} fill={prompt.is_saved ? 'currentColor' : 'none'} /> {prompt.is_saved ? 'Saved' : 'Save'}
                </button>
                <button type="button" onClick={handleCopy} className="btn btn-ghost" style={{ flex: 1, minWidth: 90 }}>
                  <Copy size={14} /> Copy
                </button>
                <Link to={`/lab?prompt=${encodeURIComponent(prompt.raw_prompt)}`} className="btn btn-primary" style={{ flex: 1, minWidth: 90, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlaskConical size={14} /> Lab
                </Link>
              </div>
            </div>
          </div>

          <div className="card theme-card card-padding">
            <label className="label" style={{ marginBottom: 12 }}>Raw Prompt</label>
            <div style={{ background: 'var(--void)', borderRadius: 'var(--r-md)', padding: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, position: 'relative' }}>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{prompt.raw_prompt}</pre>
              <button
                type="button"
                onClick={handleCopy}
                className="btn btn-ghost"
                style={{ position: 'absolute', top: 8, right: 8, padding: 6, opacity: 0.7 }}
              >
                <Copy size={12} />
              </button>
            </div>
          </div>

          {prompt.negative_prompt && (
            <div className="card theme-card card-padding">
              <label className="label" style={{ marginBottom: 8 }}>Negative Prompt</label>
              <p style={{ fontSize: 12, color: 'rgba(248,113,113,0.9)', fontFamily: 'var(--font-mono)', background: 'var(--void)', borderRadius: 'var(--r-md)', padding: 12, lineHeight: 1.6, margin: 0 }}>
                {prompt.negative_prompt}
              </p>
            </div>
          )}

          {prompt.notes && (
            <div className="card theme-card card-padding">
              <label className="label" style={{ marginBottom: 8 }}>Notes</label>
              <p style={{ fontSize: 14, color: 'var(--text-2)', fontFamily: 'var(--font-body)', lineHeight: 1.6, margin: 0 }}>
                {prompt.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
