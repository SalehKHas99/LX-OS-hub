import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Bookmark } from 'lucide-react'
import type { PromptCard as PromptCardType } from '../../types'
import { promptsApi } from '../../api'
import { useAuthStore } from '../../store'
import { VoteButtons } from '../ui/VoteButtons'
import toast from 'react-hot-toast'

const MODEL_LABELS: Record<string, string> = {
  midjourney: 'MJ', dalle: 'DL', stable_diffusion: 'SD', flux: 'FX', comfyui: 'CUI',
}

export function PromptCard({ prompt }: { prompt: PromptCardType }) {
  const coverImage = prompt.images?.[0]?.image_url
  const { isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()

  const handleVote = async (value: 1 | -1 | null) => {
    if (value === null) await promptsApi.removeVote(prompt.id)
    else await promptsApi.vote(prompt.id, value)
  }

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) { toast.error('Sign in to save'); return }
    try {
      if (prompt.is_saved) await promptsApi.unsave(prompt.id)
      else await promptsApi.save(prompt.id)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['prompt', prompt.id] })
      queryClient.invalidateQueries({ queryKey: ['search'] })
      toast.success(prompt.is_saved ? 'Removed from saved' : 'Saved')
    } catch {
      toast.error('Failed to save')
    }
  }

  return (
    <Link
      to={`/prompt/${prompt.id}`}
      className="art-card"
      style={{ display: 'block', width: '100%', height: 280, textDecoration: 'none' }}
    >
      {coverImage ? (
        <img src={coverImage} alt={prompt.images[0].alt_text ?? prompt.title} className="card-img" loading="lazy" />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--border)', fontWeight: 800 }}>[ ]</span>
        </div>
      )}

      <div className="card-overlay" />

      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {prompt.model_family && (
          <span className="badge">{MODEL_LABELS[prompt.model_family] ?? prompt.model_family}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', opacity: 0, transition: 'opacity 0.2s ease' }} className="art-card-save-btn">
          <button
            type="button"
            onClick={handleSave}
            aria-label={prompt.is_saved ? 'Unsave' : 'Save'}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'rgba(12,11,18,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: prompt.is_saved ? 'var(--accent)' : 'var(--text-2)',
            }}
          >
            <Bookmark size={14} fill={prompt.is_saved ? 'currentColor' : 'none'} />
          </button>
          <VoteButtons
          score={prompt.score}
          currentUserVote={prompt.current_user_vote ?? null}
          onVote={handleVote}
          invalidateKeys={[['feed'], ['prompt', prompt.id], ['search']]}
          compact
          stopPropagation
          style={{ padding: 4, borderRadius: 8, background: 'rgba(12,11,18,0.75)', backdropFilter: 'blur(8px)' }}
        />
        </div>
      </div>

      <div className="card-body">
        {prompt.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            {prompt.tags.slice(0, 2).map(t => (
              <span
                key={t.id}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '0.6rem',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--text-3)',
                }}
              >
                {t.display_name}
              </span>
            ))}
          </div>
        )}
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-1)', marginBottom: 8, lineHeight: 1.3 }}>
          {prompt.title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link
            to={`/u/${prompt.creator.username}`}
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--text-2)', textDecoration: 'none' }}
            className="link-hover-underline"
          >
            {prompt.creator.username}
          </Link>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-3)' }}>
            {prompt.score} votes
          </span>
        </div>
      </div>
    </Link>
  )
}
