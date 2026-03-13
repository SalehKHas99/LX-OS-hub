import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { profilesApi, uploadsApi } from '../api'
import { useAuthStore } from '../store'
import { Loader2, User, Camera, ExternalLink, LogOut, Shield, Bell, KeyRound } from 'lucide-react'
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
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin" size={28} style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Profile, preferences, and account controls</p>
      </div>

      <div className="page-content grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Left nav */}
        <aside className="hidden lg:block">
          <div className="theme-card p-4 sticky top-20">
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)', fontFamily: 'Outfit', letterSpacing: '0.08em' }}>
              SETTINGS
            </p>
            <nav className="space-y-1">
              {sections.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ color: 'var(--text-2)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--panel)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <div className="space-y-6">
          {/* Account */}
          <section id="account" className="theme-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--text-1)' }}>
                  Account
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                  Signed in as <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{user.username}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link to={`/u/${user.username}`} className="btn-outline text-sm">
                  <ExternalLink size={14} /> View profile
                </Link>
                <button
                  type="button"
                  className="btn-outline text-sm"
                  onClick={() => { logout(); toast.success('Signed out') }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoPill label="Username" value={user.username} />
              <InfoPill label="Role" value={(profile?.role ?? 'user') as string} />
              <InfoPill label="Member since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'} />
            </div>
          </section>

          {/* Profile */}
          <section id="profile">
            <form onSubmit={handleSubmit} className="theme-card p-5 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--text-1)' }}>
                    <User size={16} /> Profile
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                    This is how you appear across prompts, communities, and comments.
                  </p>
                </div>
                <button type="submit" className="btn-primary text-sm" disabled={saving}>
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save changes'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
                <div>
                  <label className="label">Profile picture</label>
                  <div
                    {...getRootProps()}
                    className="relative mt-2 w-full aspect-square rounded-2xl overflow-hidden border-2 border-dashed cursor-pointer transition-colors"
                    style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}
                  >
                    <input {...getInputProps()} />
                    {avatarUrl ? (
                      <img src={avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Camera size={28} style={{ color: 'var(--text-3)' }} />
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-2)', fontFamily: 'Outfit' }}>
                          Upload a photo
                        </p>
                      </div>
                    )}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50" style={{ color: 'white' }}>
                        <Loader2 size={24} className="animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                    jpg, png, webp, gif. Max 2MB.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label">Avatar URL (optional)</label>
                    <input
                      type="url"
                      className="input text-sm"
                      value={avatarUrl}
                      onChange={e => setAvatarUrl(e.target.value)}
                      placeholder="https://..."
                    />
                    <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                      Paste a URL if you don’t want to upload a file.
                    </p>
                  </div>

                  <div>
                    <label className="label">Bio</label>
                    <textarea
                      className="input resize-none text-sm"
                      rows={5}
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="What do you make? What models do you like? What are you exploring?"
                    />
                    <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                      Tip: include your favorite model families + the kind of prompts you publish.
                    </p>
                  </div>
                </div>
              </div>
            </form>
          </section>

          {/* Coming soon */}
          <section id="privacy" className="theme-card p-5">
            <SectionHeader
              icon={<Shield size={16} />}
              title="Privacy & safety"
              subtitle="Controls for visibility, blocks, and reporting defaults (coming soon)."
            />
            <ComingSoonRow label="Default community visibility" hint="Choose public or restricted by default when creating communities." />
            <ComingSoonRow label="Content filters" hint="Hide sensitive topics or low-trust content in feed/explore." />
          </section>

          <section id="notifications" className="theme-card p-5">
            <SectionHeader
              icon={<Bell size={16} />}
              title="Notifications"
              subtitle="Mentions, join requests, comment replies, and collection updates (coming soon)."
            />
            <ComingSoonRow label="Email notifications" hint="Get updates for replies and moderation actions." />
            <ComingSoonRow label="In-app notifications" hint="A bell inbox in the top bar." />
          </section>

          <section id="security" className="theme-card p-5">
            <SectionHeader
              icon={<KeyRound size={16} />}
              title="Security"
              subtitle="Password + sessions management (coming soon)."
            />
            <ComingSoonRow label="Change password" hint="Update your password from settings." />
            <ComingSoonRow label="Active sessions" hint="See and revoke devices." />
          </section>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'Outfit', color: 'var(--text-1)' }}>
        {icon} {title}
      </h2>
      <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
        {subtitle}
      </p>
    </div>
  )
}

function ComingSoonRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3" style={{ borderTop: '1px solid var(--border-sub)' }}>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)', fontFamily: 'Outfit' }}>{label}</p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{hint}</p>
      </div>
      <span className="text-xs px-2 py-1 rounded-md shrink-0" style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
        Coming soon
      </span>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--panel)', border: '1.5px solid var(--border)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-3)', fontFamily: 'Outfit', letterSpacing: '0.06em' }}>
        {label.toUpperCase()}
      </p>
      <p className="text-sm mt-1 truncate" style={{ color: 'var(--text-1)', fontFamily: 'Nunito' }}>
        {value}
      </p>
    </div>
  )
}
