import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { profilesApi, uploadsApi, blocksApi } from '../api'
import { useAuthStore } from '../store'
import { Loader2, User, Camera, ExternalLink, LogOut, Shield, Bell, KeyRound, Ban } from 'lucide-react'
import { SkeletonLine, SkeletonAvatar } from '../components/ui/Skeleton'
import toast from 'react-hot-toast'

const AVATAR_ACCEPT = { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'] }
const AVATAR_MAX_SIZE = 2 * 1024 * 1024 // 2MB

export default function SettingsPage() {
  const { user, logout } = useAuthStore()
  const qc = useQueryClient()
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.username],
    queryFn: () => user && profilesApi.get(user.username).then(r => r.data),
    enabled: !!user?.username,
    staleTime: 60_000, // profile changes infrequently
  })

  useEffect(() => {
    if (profile) {
      setBio(profile.bio ?? '')
      setAvatarUrl(profile.avatar_url ?? '')
    }
  }, [profile])

  const sections = useMemo(() => ([
    { id: 'account', label: 'Account' },
    { id: 'profile', label: 'Profile' },
    { id: 'privacy', label: 'Privacy & safety' },
    { id: 'blocks', label: 'Blocked users' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'security', label: 'Security' },
  ]), [])

  const onAvatarDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file || !user) return
    if (file.size > AVATAR_MAX_SIZE) {
      toast.error('Image must be under 2MB')
      return
    }
    setUploadingAvatar(true)
    try {
      const { data } = await uploadsApi.uploadAvatar(file)
      setAvatarUrl(data.avatar_url)
      qc.invalidateQueries({ queryKey: ['profile', user.username] })
      toast.success('Profile picture updated')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: onAvatarDrop,
    accept: AVATAR_ACCEPT,
    maxFiles: 1,
    maxSize: AVATAR_MAX_SIZE,
    disabled: uploadingAvatar,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await profilesApi.updateMe({ bio: bio || undefined, avatar_url: avatarUrl || undefined })
      qc.invalidateQueries({ queryKey: ['profile', user.username] })
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !user) {
    return (
      <div className="page-container page-container-sm" style={{ width: '100%' }}>
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div className="skeleton skeleton-line medium" style={{ height: 28, marginBottom: 8 }} />
          <div className="skeleton skeleton-line short" style={{ height: 16 }} />
        </div>
        <div className="settings-layout">
          <aside className="settings-nav">
            <div className="theme-card settings-nav-card">
              <div className="skeleton skeleton-line short" style={{ height: 12, marginBottom: 12 }} />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton skeleton-line medium" style={{ height: 14, marginBottom: 8 }} />
              ))}
            </div>
          </aside>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="theme-card card-padding">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <SkeletonAvatar size="lg" />
                <div style={{ flex: 1 }}>
                  <SkeletonLine width="medium" style={{ marginBottom: 8 }} />
                  <SkeletonLine width="short" />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container page-container-sm" style={{ width: '100%', maxWidth: 860 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Profile, preferences, and account controls</p>
      </div>

      <div className="page-content settings-layout">
        <aside className="settings-nav">
          <nav className="theme-card settings-nav-card">
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', marginBottom: 10 }}>SETTINGS</p>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>{s.label}</a>
            ))}
          </nav>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section id="account" className="theme-card card-padding">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-1)', margin: 0 }}>Account</h2>
                <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-2)' }}>
                  Signed in as <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{user.username}</span>
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Link to={`/u/${user.username}`} className="btn-outline" style={{ fontSize: 12, padding: '6px 12px' }}>
                  <ExternalLink size={14} /> View profile
                </Link>
                <button type="button" className="btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => { logout(); toast.success('Signed out') }}>
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>
            <div className="info-pills" style={{ marginTop: 12 }}>
              <InfoPill label="Username" value={user.username} />
              <InfoPill label="Member since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'} />
            </div>
          </section>

          <section id="profile">
            <form onSubmit={handleSubmit} className="theme-card card-padding">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', color: 'var(--text-1)', margin: 0 }}>
                    <User size={16} /> Profile
                  </h2>
                  <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-2)' }}>
                    How you appear on prompts and communities.
                  </p>
                </div>
                <button type="submit" className="btn btn-primary" style={{ fontSize: 12, padding: '8px 14px' }} disabled={saving}>
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save changes'}
                </button>
              </div>
              <div className="settings-form-grid">
                <div>
                  <label className="label">Profile picture</label>
                  <div {...getRootProps()} className="avatar-upload-zone">
                    <input {...getInputProps()} />
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Camera size={28} style={{ color: 'var(--text-3)' }} />
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', fontFamily: 'var(--font-display)' }}>Upload a photo</p>
                      </div>
                    )}
                    {uploadingAvatar && (
                      <div className="avatar-upload-overlay">
                        <Loader2 size={24} className="animate-spin" />
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 11, marginTop: 6, color: 'var(--text-3)' }}>jpg, png, webp, gif. Max 2MB.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="label">Avatar URL (optional)</label>
                    <input type="url" className="input" style={{ fontSize: 13 }} value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="label">Bio</label>
                    <textarea className="input" style={{ resize: 'none', fontSize: 13 }} rows={4} value={bio} onChange={e => setBio(e.target.value)} placeholder="What do you make? What models do you like?" />
                  </div>
                </div>
              </div>
            </form>
          </section>

          <section id="privacy" className="theme-card card-padding">
            <SectionHeader icon={<Shield size={16} />} title="Privacy & safety" subtitle="Visibility and content controls (coming soon)." />
            <ComingSoonRow label="Default community visibility" hint="Public or restricted when creating communities." />
            <ComingSoonRow label="Content filters" hint="Hide sensitive or low-trust content in feed." />
          </section>

          <BlockedUsersSection />

          <section id="notifications" className="theme-card card-padding">
            <SectionHeader icon={<Bell size={16} />} title="Notifications" subtitle="Email and in-app alerts (coming soon)." />
            <ComingSoonRow label="Email notifications" hint="Replies and moderation updates." />
            <ComingSoonRow label="In-app notifications" hint="Bell inbox in the header." />
          </section>

          <section id="security" className="theme-card card-padding">
            <SectionHeader icon={<KeyRound size={16} />} title="Security" subtitle="Password and sessions (coming soon)." />
            <ComingSoonRow label="Change password" hint="Update your password." />
            <ComingSoonRow label="Active sessions" hint="See and revoke devices." />
          </section>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', color: 'var(--text-1)', margin: 0 }}>
        {icon} {title}
      </h2>
      <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-2)' }}>{subtitle}</p>
    </div>
  )
}

function ComingSoonRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="coming-soon-row">
      <div style={{ minWidth: 0 }}>
        <p>{label}</p>
        <p>{hint}</p>
      </div>
      <span className="coming-soon-badge">Coming soon</span>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-pill">
      <p>{label.toUpperCase()}</p>
      <p>{value}</p>
    </div>
  )
}

function BlockedUsersSection() {
  const qc = useQueryClient()
  const { data: blocked = [], isLoading } = useQuery({
    queryKey: ['blocks'],
    queryFn: () => blocksApi.list().then(r => r.data),
  })
  const unblockMutation = useMutation({
    mutationFn: (userId: string) => blocksApi.unblock(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocks'] })
      toast.success('User unblocked')
    },
    onError: () => toast.error('Failed to unblock'),
  })
  return (
    <section id="blocks" className="theme-card card-padding">
      <SectionHeader icon={<Ban size={16} />} title="Blocked users" subtitle="Blocked users cannot message you or see you in lists. Unblock to allow contact again." />
      {isLoading ? (
        <div className="skeleton skeleton-line medium" style={{ height: 40, borderRadius: 8 }} />
      ) : blocked.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>You haven&apos;t blocked anyone.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {blocked.map(b => (
            <li key={b.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <Link to={`/u/${b.username}`} style={{ fontWeight: 600, color: 'var(--text-1)', textDecoration: 'none' }} className="link-hover-underline">{b.username}</Link>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => unblockMutation.mutate(b.user_id)} disabled={unblockMutation.isPending}>Unblock</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
