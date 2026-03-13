import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { promptsApi, labApi } from '../api'
import { Copy, Bookmark, FlaskConical, Share2, ChevronRight, Loader2, Send } from 'lucide-react'
import { useAuthStore } from '../store'
import toast from 'react-hot-toast'
import clsx from 'clsx'

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

export default function PromptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated } = useAuthStore()
  const [comment, setComment] = useState('')
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

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt?.raw_prompt ?? '')
    toast.success('Copied to clipboard')
  }

  const handleSave = async () => {
    if (!isAuthenticated) { toast.error('Sign in to save'); return }
    await promptsApi.save(id!)
    toast.success('Saved!')
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    await promptsApi.addComment(id!, comment)
    setComment('')
    refetchComments()
    toast.success('Comment added')
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="animate-spin text-xenon-500" size={32} />
    </div>
  )

  if (!prompt) return (
    <div className="text-center py-32 text-ink-secondary">Prompt not found</div>
  )

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-ink-muted font-body mb-6">
        <Link to="/feed" className="hover:text-xenon-400 transition-colors">Feed</Link>
        <ChevronRight size={14} />
        <span className="text-ink-secondary truncate max-w-xs">{prompt.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left — Images */}
        <div className="lg:col-span-3 space-y-4">
          {prompt.images.length > 0 ? (
            <div className="card overflow-hidden">
              <img
                src={prompt.images[0].image_url}
                alt={prompt.images[0].alt_text ?? prompt.title}
                className="w-full object-cover max-h-[520px]"
              />
            </div>
          ) : (
            <div className="card aspect-[4/3] flex items-center justify-center">
              <span className="text-6xl font-mono text-border">[ ]</span>
            </div>
          )}

          {/* Tabs */}
          <div className="card">
            <div className="flex border-b border-border">
              {(['context', 'comments'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    'flex-1 py-3 text-sm font-display font-semibold capitalize transition-colors',
                    activeTab === tab
                      ? 'text-xenon-400 border-b-2 border-xenon-500'
                      : 'text-ink-muted hover:text-ink-secondary'
                  )}
                >
                  {tab} {tab === 'comments' && `(${comments?.length ?? 0})`}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === 'context' ? (
                <div className="space-y-3">
                  {prompt.context_blocks.map(block => (
                    <div key={block.id} className="group">
                      <p className="label">{FIELD_LABELS[block.field_name] ?? block.field_name}</p>
                      <p className="text-sm text-ink-secondary font-body leading-relaxed bg-panel rounded-lg px-3 py-2">
                        {block.field_value || <span className="text-ink-muted italic">Not specified</span>}
                      </p>
                    </div>
                  ))}
                  {prompt.context_blocks.length === 0 && (
                    <p className="text-ink-muted text-sm text-center py-4">
                      No context blocks — open Context Optimizer to parse this prompt
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {isAuthenticated && (
                    <form onSubmit={handleComment} className="flex gap-3">
                      <input
                        className="input flex-1 text-sm"
                        placeholder="Add a comment..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                      />
                      <button type="submit" className="btn-primary px-3">
                        <Send size={14} />
                      </button>
                    </form>
                  )}
                  {(comments ?? []).map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-xenon-900 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xenon-400 text-xs font-mono">
                          {c.user.username[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-display font-semibold text-ink-primary">
                          {c.user.username}
                        </span>
                        <p className="text-sm text-ink-secondary font-body mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {(comments ?? []).length === 0 && (
                    <p className="text-center text-ink-muted text-sm py-4">No comments yet</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — Prompt info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header card */}
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="font-display font-bold text-xl text-ink-primary leading-tight">
                {prompt.title}
              </h1>
              {prompt.model_family && (
                <span className="badge-xenon shrink-0">{prompt.model_family}</span>
              )}
            </div>

            {/* Creator */}
            <Link
              to={`/u/${prompt.creator.username}`}
              className="flex items-center gap-2 mb-5 group"
            >
              <div className="w-7 h-7 rounded-full bg-xenon-900 flex items-center justify-center">
                <span className="text-xenon-400 text-xs font-mono">
                  {prompt.creator.username[0].toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-ink-secondary group-hover:text-xenon-400 transition-colors font-body">
                {prompt.creator.username}
              </span>
            </Link>

            {/* Tags */}
            {prompt.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {prompt.tags.map(tag => (
                  <span key={tag.id} className="badge">{tag.display_name}</span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm">
                <Copy size={14} /> Copy
              </button>
              <button onClick={handleSave} className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm">
                <Bookmark size={14} /> Save
              </button>
              <Link
                to={`/lab?prompt=${encodeURIComponent(prompt.raw_prompt)}`}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
              >
                <FlaskConical size={14} /> Lab
              </Link>
            </div>
          </div>

          {/* Raw prompt */}
          <div className="card p-5">
            <label className="label mb-3">Raw Prompt</label>
            <div className="bg-void rounded-lg p-4 font-mono text-xs text-ink-secondary leading-relaxed relative">
              <pre className="whitespace-pre-wrap break-words">{prompt.raw_prompt}</pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 btn-ghost p-1.5 opacity-50 hover:opacity-100"
              >
                <Copy size={12} />
              </button>
            </div>
          </div>

          {/* Negative prompt */}
          {prompt.negative_prompt && (
            <div className="card p-5">
              <label className="label mb-2">Negative Prompt</label>
              <p className="text-xs text-red-400/80 font-mono bg-void rounded-lg p-3 leading-relaxed">
                {prompt.negative_prompt}
              </p>
            </div>
          )}

          {/* Notes */}
          {prompt.notes && (
            <div className="card p-5">
              <label className="label mb-2">Notes</label>
              <p className="text-sm text-ink-secondary font-body leading-relaxed">{prompt.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
