import { Link } from 'react-router-dom'
import { Bookmark, Star } from 'lucide-react'
import type { PromptCard as PromptCardType } from '../../types'
import { promptsApi } from '../../api'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'

const MODEL_LABELS: Record<string, string> = {
  midjourney: 'MJ', dalle: 'DL', stable_diffusion: 'SD', flux: 'FX', comfyui: 'CUI',
}

export function PromptCard({ prompt }: { prompt: PromptCardType }) {
  const { isAuthenticated } = useAuthStore()
  const coverImage = prompt.images?.[0]?.image_url

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isAuthenticated) { toast.error('Sign in to save'); return }
    await promptsApi.save(prompt.id)
    toast.success('Saved ✓')
  }

  return (
    <Link to={`/prompt/${prompt.id}`} className="art-card group block w-full" style={{ height: '280px' }}>
      {coverImage ? (
        <img src={coverImage} alt={prompt.images[0].alt_text ?? prompt.title}
             className="card-img" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center"
             style={{ background: 'var(--panel)' }}>
          <span style={{ fontFamily: 'Outfit', fontSize: '2rem', color: 'var(--border)', fontWeight: 800 }}>[ ]</span>
        </div>
      )}

      <div className="card-overlay" />

      {/* Top */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
        {prompt.model_family && (
          <span className="badge">{MODEL_LABELS[prompt.model_family] ?? prompt.model_family}</span>
        )}
        <button onClick={handleSave}
          className="w-7 h-7 rounded-lg backdrop-blur-sm flex items-center justify-center ml-auto
                     opacity-0 group-hover:opacity-100 transition-all"
          style={{ background: 'rgba(12,11,18,0.75)' }}>
          <Bookmark size={12} style={{ color: 'var(--text-2)' }} />
        </button>
      </div>

      {/* Bottom */}
      <div className="card-body">
        {prompt.tags.length > 0 && (
          <div className="flex gap-2 mb-1.5 flex-wrap">
            {prompt.tags.slice(0, 2).map(t => (
              <span key={t.id} style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.6rem',
                                       letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                {t.display_name}
              </span>
            ))}
          </div>
        )}
        <h3 className="mb-2 leading-snug transition-colors group-hover:text-[var(--accent-h)]"
            style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-1)' }}>
          {prompt.title}
        </h3>
        <div className="flex items-center justify-between">
          <span style={{ fontFamily: 'Nunito', fontSize: '0.78rem', color: 'var(--text-2)' }}>
            {prompt.creator.username}
          </span>
          <div className="flex items-center gap-1" style={{ color: 'var(--gold)' }}>
            <Star size={11} fill="currentColor" />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.72rem' }}>{prompt.score}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
