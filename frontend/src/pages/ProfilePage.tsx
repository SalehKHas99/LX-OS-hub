// ── Profile Page ──────────────────────────────────────────────────────────────
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { profilesApi } from '../api'
import { PromptCard } from '../components/prompts/PromptCard'
import { useAuthStore } from '../store'
import { Loader2, User, MessageCircle } from 'lucide-react'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user: me } = useAuthStore()

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => profilesApi.get(username!).then(r => r.data),
    enabled: !!username,
  })

  const { data: prompts } = useQuery({
    queryKey: ['profile-prompts', username],
    queryFn: () => profilesApi.prompts(username!).then(r => r.data),
    enabled: !!username,
  })

  if (loadingUser) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="animate-spin text-xenon-500" size={28} />
    </div>
  )

  if (!user) return <div className="text-center py-32 text-ink-secondary">User not found</div>

  return (
    <div className="max-w-5xl mx-auto">
      {/* Profile header */}
      <div className="card p-6 mb-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-xenon-900 flex items-center justify-center shrink-0">
          {user.avatar_url
            ? <img src={user.avatar_url} className="w-full h-full object-cover rounded-2xl" alt={user.username} />
            : <span className="text-xenon-400 text-2xl font-display font-bold">{user.username[0].toUpperCase()}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-2xl text-ink-primary">{user.username}</h1>
          <p className="text-ink-muted font-mono text-xs mt-0.5">{user.role}</p>
          {user.bio && <p className="text-ink-secondary text-sm font-body mt-2 leading-relaxed">{user.bio}</p>}
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          {me?.id && user.id !== me.id && (
            <Link
              to={`/messages?with=${user.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-xenon-500/50 bg-xenon-500/10 text-xenon-300 text-sm font-semibold hover:bg-xenon-500/20 transition-colors"
            >
              <MessageCircle size={16} /> Message
            </Link>
          )}
          <div>
            <p className="font-display font-bold text-xl text-xenon-400">{prompts?.total ?? 0}</p>
            <p className="text-xs text-ink-muted">prompts</p>
          </div>
        </div>
      </div>

      {/* Prompts grid */}
      <h2 className="font-display font-semibold text-lg text-ink-primary mb-4">Prompts</h2>
      {prompts?.items.length === 0 ? (
        <div className="text-center py-16 text-ink-secondary">
          <User size={32} className="mx-auto mb-3 opacity-30" />
          <p>No prompts yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {prompts?.items.map(p => <PromptCard key={p.id} prompt={p} />)}
        </div>
      )}
    </div>
  )
}
