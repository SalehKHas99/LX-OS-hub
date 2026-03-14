// ── Profile Page ──────────────────────────────────────────────────────────────
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { profilesApi } from '../api'
import { PromptCard } from '../components/prompts/PromptCard'
import { useAuthStore } from '../store'
import { User, MessageCircle, Settings, ChevronRight, Sparkles, UserPlus, Ban } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { friendsApi, blocksApi } from '../api'
import toast from 'react-hot-toast'
import { SkeletonProfileHeader, SkeletonPromptGrid } from '../components/ui/Skeleton'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const isOwnProfile = !!me && me.username === username

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => profilesApi.get(username!).then(r => r.data),
    enabled: !!username,
    staleTime: 60_000, // profile view changes infrequently
  })

  const { data: prompts } = useQuery({
    queryKey: ['profile-prompts', username],
    queryFn: () => profilesApi.prompts(username!).then(r => r.data),
    enabled: !!username,
    staleTime: 45_000,
  })

  const { data: friendStatus } = useQuery({
    queryKey: ['friends', 'status', user?.id],
    queryFn: () => friendsApi.getStatus(user!.id).then(r => r.data),
    enabled: !!user?.id && !!me?.id && !isOwnProfile,
  })

  const addFriendMutation = useMutation({
    mutationFn: (addresseeId: string) => friendsApi.sendRequest(addresseeId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['friends'] })
      qc.invalidateQueries({ queryKey: ['friends', 'status', user?.id] })
      toast.success(data?.message ?? 'Friend request sent')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      toast.error(e?.response?.data?.detail ?? 'Failed to send request')
    },
  })

  const blockMutation = useMutation({
    mutationFn: (userId: string) => blocksApi.block(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocks'] })
      toast.success('User blocked')
    },
    onError: () => toast.error('Failed to block'),
  })

  if (loadingUser) {
    return (
      <div className="page-container page-content">
        <nav className="page-header-breadcrumb" style={{ marginBottom: 20 }}>
          <div className="skeleton skeleton-line short" style={{ width: 80, height: 14 }} />
        </nav>
        <SkeletonProfileHeader />
        <div style={{ marginBottom: 16 }}>
          <div className="skeleton skeleton-line short" style={{ width: 100, height: 18, marginBottom: 16 }} />
        </div>
        <SkeletonPromptGrid count={6} cardMinHeight={280} />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-container page-content">
        <div className="empty-state theme-card card-padding">
          <User size={48} style={{ color: 'var(--text-3)' }} className="empty-state-icon" />
          <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>User not found</p>
          <Link to="/feed" className="btn btn-ghost" style={{ fontSize: 13 }}>Back to Explore</Link>
        </div>
      </div>
    )
  }

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null

  return (
    <div className="page-container page-content">
      {/* Breadcrumb */}
      <nav className="page-header-breadcrumb" style={{ marginBottom: 20 }}>
        <Link to="/feed" style={{ color: 'var(--text-3)', textDecoration: 'none', fontSize: 13 }}>Explore</Link>
        <ChevronRight size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 600 }}>{user.username}</span>
      </nav>

      {/* Profile header card */}
      <div className="theme-card shimmer-top card-padding" style={{ marginBottom: 28 }}>
        <div className="profile-header-card" style={{ alignItems: 'flex-start', gap: 24 }}>
          <div className="avatar-box" style={{ width: 96, height: 96, borderRadius: 20 }}>
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} />
            ) : (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--nebula-soft)' }}>
                {user.username[0].toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 8 }}>
              <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem' }}>{user.username}</h1>
            </div>
            {(memberSince || (prompts?.total ?? 0) >= 0) && (
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  <strong style={{ color: 'var(--text-2)' }}>{prompts?.total ?? 0}</strong> prompts
                </span>
                {memberSince && (
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Joined {memberSince}</span>
                )}
              </div>
            )}
            {user.bio && (
              <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.65, marginTop: 12, marginBottom: 0, maxWidth: '42rem' }}>
                {user.bio}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
            {isOwnProfile ? (
              <Link to="/settings" className="btn btn-ghost" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} /> Edit profile
              </Link>
            ) : me?.id && user?.id && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {friendStatus?.status === 'pending_sent' ? (
                  <span style={{ fontSize: 13, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <UserPlus size={16} /> Request sent
                  </span>
                ) : friendStatus?.status !== 'friends' && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => addFriendMutation.mutate(user.id)}
                    disabled={addFriendMutation.isPending}
                  >
                    <UserPlus size={16} /> Add friend
                  </button>
                )}
                <Link to={`/messages?with=${user.id}`} className="btn btn-primary" style={{ padding: '10px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <MessageCircle size={16} /> Message
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 13, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => blockMutation.mutate(user.id)}
                  disabled={blockMutation.isPending}
                  title="Block user"
                >
                  <Ban size={16} /> Block
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prompts section */}
      <h2 className="section-title" style={{ marginBottom: 16, fontSize: '1.1rem' }}>Prompts</h2>
      {(prompts?.items ?? []).length === 0 ? (
        <div className="empty-state theme-card card-padding">
          <Sparkles size={36} style={{ color: 'var(--text-3)' }} className="empty-state-icon" />
          <p style={{ color: 'var(--text-2)', marginBottom: 8 }}>No prompts yet</p>
          {isOwnProfile && (
            <Link to="/submit" className="btn btn-primary" style={{ marginTop: 12, fontSize: 13 }}>Submit your first prompt</Link>
          )}
        </div>
      ) : (
        <div className="prompts-grid">
          {(prompts?.items ?? []).map(p => <PromptCard key={p.id} prompt={p} />)}
        </div>
      )}
    </div>
  )
}
