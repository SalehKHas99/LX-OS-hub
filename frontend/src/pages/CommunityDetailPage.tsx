// @ts-nocheck
import { useState, useMemo, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { communitiesApi, communityPostsApi } from '../api'
import { PromptCard } from '../components/prompts/PromptCard'
import { useAuthStore } from '../store'
import {
  Users, Loader2, Grid3X3, MessageSquare,
  Send, ArrowLeft, PlusCircle, ChevronRight, ShieldOff, UserCheck, Search, LayoutList, LayoutGrid, BookOpen, Megaphone, Pencil, Check, X
} from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'prompts' | 'discussion'

export default function CommunityDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [tab, setTab] = useState<Tab>('prompts')
  const [page, setPage] = useState(1)
  const [postContent, setPostContent] = useState('')
  const [manageTab, setManageTab] = useState<'joiners' | 'members' | 'banned'>('joiners')
  const [managePanelOpen, setManagePanelOpen] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [acceptAllChecked, setAcceptAllChecked] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)
  const [membersViewMode, setMembersViewMode] = useState<'list' | 'grid'>('list')
  const RULES_MAX_LENGTH = 2000
  const [editingRules, setEditingRules] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState(false)
  const [editingAbout, setEditingAbout] = useState(false)
  const [draftRules, setDraftRules] = useState('')
  const [draftAnnouncement, setDraftAnnouncement] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const { isAuthenticated, user } = useAuthStore()
  const qc = useQueryClient()

  const { data: community, isLoading: loadingCom } = useQuery({
    queryKey: ['community', slug],
    queryFn: () => communitiesApi.get(slug!).then(r => r.data),
    enabled: !!slug,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: (_, error: any) => {
      const status = error?.response?.status
      if (status === 404 || status === 403) return false
      return true
    },
    retryDelay: 1000,
  })

  const { data: membership, isLoading: loadingMembership } = useQuery({
    queryKey: ['community-membership', slug],
    queryFn: () => communitiesApi.membership(slug!).then(r => r.data),
    enabled: !!slug && !!isAuthenticated && !!community,
    staleTime: 0,
    gcTime: 5 * 60_000,
    retry: (_, error: any) => error?.response?.status !== 404 && error?.response?.status !== 403,
  })

  const isOwnerOrMod =
    !!user &&
    !!community &&
    (community.owner_id === user.id ||
      ['moderator', 'admin', 'super_admin'].includes((user as any).role))

  const isOwner = !!user && !!community && community.owner_id === user.id

  const isBanned = membership?.status === 'banned'
  const isMember =
    !!membership &&
    (membership.status === 'member' || membership.status === 'owner' || membership.status === 'moderator')
  const isPending = membership?.status === 'pending'
  const isRestricted = community?.visibility === 'restricted'
  // For authenticated users, wait for membership so we know if they're banned before showing content
  const membershipKnown = !isAuthenticated || membership !== undefined
  const canViewPrompts = membershipKnown && !isBanned && (!isRestricted || isMember)
  const canPostPrompt = membershipKnown && !isBanned && (!isRestricted || isMember || isOwnerOrMod)
  const canPostDiscussion = membershipKnown && !isBanned && isMember

  const joinMutation = useMutation({
    mutationFn: () => communitiesApi.requestJoin(slug!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-membership', slug] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Join request sent. Wait for approval.')
    },
    onError: (err: any) => {
      const d = err?.response?.data?.detail
      const msg = Array.isArray(d) ? d.map((x: any) => x.msg ?? x).join(', ') : (d || 'Failed to request join')
      toast.error(msg)
    },
  })

  const { data: prompts, isLoading: loadingPrompts } = useQuery({
    queryKey: ['community-prompts', slug, page],
    queryFn: () => communitiesApi.prompts(slug!, page).then(r => r.data),
    enabled: !!slug && tab === 'prompts' && canViewPrompts,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  const { data: postsData, isLoading: loadingPosts } = useQuery({
    queryKey: ['community-posts', slug],
    queryFn: () => communityPostsApi.list(slug!).then(r => r.data),
    enabled: !!slug && tab === 'discussion' && canViewPrompts,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  const postMutation = useMutation({
    mutationFn: () => communityPostsApi.create(slug!, postContent),
    onSuccess: () => {
      setPostContent('')
      qc.invalidateQueries({ queryKey: ['community-posts', slug] })
      toast.success('Posted!')
    },
    onError: () => toast.error('Failed to post — backend may need /posts endpoint'),
  })

  const { data: joinRequests = [], isLoading: loadingJoinRequests } = useQuery({
    queryKey: ['community-join-requests', slug],
    queryFn: () => communitiesApi.listJoinRequests(slug!, 'pending').then(r => r.data),
    enabled: !!slug && isOwnerOrMod && managePanelOpen,
    staleTime: 20_000,
    gcTime: 2 * 60_000,
  })

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['community-members', slug],
    queryFn: () => communitiesApi.listMembers(slug!).then(r => r.data),
    enabled: !!slug && isOwnerOrMod && managePanelOpen,
    staleTime: 20_000,
    gcTime: 2 * 60_000,
  })

  const { data: moderatorInvites = [] } = useQuery({
    queryKey: ['community-moderator-invites', slug],
    queryFn: () => communitiesApi.listModeratorInvites(slug!).then(r => r.data),
    enabled: !!slug && isOwner && managePanelOpen,
    staleTime: 20_000,
    gcTime: 2 * 60_000,
  })
  const pendingInviteUserIds = new Set((moderatorInvites || []).map((i: { user_id: string }) => i.user_id))

  const { data: bans = [] } = useQuery({
    queryKey: ['community-bans', slug],
    queryFn: () => communitiesApi.listBans(slug!).then(r => r.data),
    enabled: !!slug && isOwnerOrMod && managePanelOpen,
    staleTime: 20_000,
    gcTime: 2 * 60_000,
  })

  const approveJoinMutation = useMutation({
    mutationFn: ({ requestId }: { requestId: string }) =>
      communitiesApi.approveJoinRequest(slug!, requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-join-requests', slug] })
      qc.invalidateQueries({ queryKey: ['community-members', slug] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Join request approved')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to approve'),
  })

  const rejectJoinMutation = useMutation({
    mutationFn: ({ requestId }: { requestId: string }) =>
      communitiesApi.rejectJoinRequest(slug!, requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-join-requests', slug] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Join request rejected')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to reject'),
  })

  const setRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'member' | 'moderator' }) =>
      communitiesApi.setMemberRole(slug!, userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-members', slug] })
      qc.invalidateQueries({ queryKey: ['community-moderator-invites', slug] })
      toast.success('Role updated')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to update role'),
  })

  const inviteModeratorMutation = useMutation({
    mutationFn: (userId: string) => communitiesApi.inviteModerator(slug!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-members', slug] })
      qc.invalidateQueries({ queryKey: ['community-moderator-invites', slug] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Moderator invite sent')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to send invite'),
  })

  const banUserMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      communitiesApi.banUser(slug!, userId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-members', slug] })
      qc.invalidateQueries({ queryKey: ['community-bans', slug] })
      qc.invalidateQueries({ queryKey: ['community-membership', slug] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('User banned. They have been notified.')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to ban'),
  })

  const unbanUserMutation = useMutation({
    mutationFn: (userId: string) => communitiesApi.unbanUser(slug!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-bans', slug] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('User unbanned')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to unban'),
  })

  const updateCommunityMutation = useMutation({
    mutationFn: (data: { description?: string; rules?: string; announcement?: string; show_owner_badge?: boolean }) =>
      communitiesApi.update(slug!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community', slug] })
      toast.success('Saved')
      setEditingRules(false)
      setEditingAnnouncement(false)
      setEditingAbout(false)
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to save'),
  })

  const handleAcceptAllJoiners = async () => {
    if (!acceptAllChecked || !joinRequests?.length || !slug) return
    setApprovingAll(true)
    try {
      for (const req of joinRequests) {
        await communitiesApi.approveJoinRequest(slug, req.id)
      }
      qc.invalidateQueries({ queryKey: ['community-join-requests', slug] })
      qc.invalidateQueries({ queryKey: ['community-members', slug] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      setAcceptAllChecked(false)
      toast.success(`Accepted ${joinRequests.length} join request(s)`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Failed to accept all')
    } finally {
      setApprovingAll(false)
    }
  }

  const searchLower = memberSearch.trim().toLowerCase()
  const filteredMembers = useMemo(
    () => (members || []).filter(
      (m: { username: string }) => !searchLower || m.username.toLowerCase().includes(searchLower)
    ),
    [members, searchLower]
  )

  useEffect(() => {
    if (!joinRequests?.length) setAcceptAllChecked(false)
  }, [joinRequests?.length])

  if (loadingCom) {
    return (
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          paddingTop: 32,
        }}
      >
        <div
          style={{
            marginBottom: 20,
            borderRadius: 18,
            border: '1px solid rgba(148,163,184,0.4)',
            background: 'rgba(15,23,42,0.9)',
            padding: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                background: 'rgba(31,41,55,0.9)',
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 18,
                  width: '40%',
                  borderRadius: 999,
                  background: 'rgba(55,65,81,0.9)',
                  marginBottom: 8,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: '24%',
                  borderRadius: 999,
                  background: 'rgba(55,65,81,0.7)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!community) {
    return (
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          paddingTop: 24,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-1)',
          }}
        >
          Community not found
        </h1>
        <Link
          to="/communities"
          style={{
            marginTop: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 999,
            border: '1px solid rgba(148,163,184,0.7)',
            textDecoration: 'none',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            color: 'var(--text-1)',
          }}
        >
          <ArrowLeft size={14} /> Back to communities
        </Link>
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: 960,
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Community header */}
      <div
        style={{
          paddingTop: 20,
          paddingBottom: 18,
          marginBottom: 16,
          paddingLeft: 4,
          paddingRight: 4,
        }}
      >
        <Link
          to="/communities"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'Outfit',
            color: 'var(--text-3)',
            marginBottom: 12,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={12} /> Communities
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          {/* Avatar with edit overlay */}
          <div
            style={{
              position: 'relative',
              width: 56,
              height: 56,
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: 'var(--accent-muted)',
              border: '1.5px solid var(--border)',
              overflow: 'hidden',
              cursor: isOwnerOrMod ? 'pointer' : 'default',
            }}
          >
            {community.avatar_url ? (
              <img
                src={community.avatar_url}
                alt={community.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span
                style={{
                  fontFamily: 'Outfit',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                  color: 'var(--accent-h)',
                }}
              >
                {community.title[0].toUpperCase()}
              </span>
            )}
            {isOwnerOrMod && (
              <>
                <input
                  id="community-avatar-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file || !slug) return
                    try {
                      await communitiesApi.uploadAvatar(slug, file)
                      await qc.invalidateQueries({ queryKey: ['community', slug] })
                      toast.success('Community image updated')
                    } catch (err: any) {
                      toast.error(err?.response?.data?.detail || 'Upload failed')
                    } finally {
                      e.target.value = ''
                    }
                  }}
                />
                <label
                  htmlFor="community-avatar-input"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: 6,
                    background:
                      'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.0))',
                    opacity: 0,
                    transition: 'opacity 0.18s ease-out',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    ; (e.currentTarget as HTMLLabelElement).style.opacity = '1'
                  }}
                  onMouseLeave={(e) => {
                    ; (e.currentTarget as HTMLLabelElement).style.opacity = '0'
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      border: '1px solid rgba(248,250,252,0.75)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(15,23,42,0.95)',
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderBottom: '2px solid #a855f7',
                        borderRight: '2px solid #a855f7',
                        transform: 'rotate(45deg)',
                        borderRadius: 1,
                      }}
                    />
                  </div>
                </label>
              </>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <h1
                    style={{
                      margin: 0,
                      fontSize: 24,
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      fontFamily: 'var(--font-display)',
                      color: 'var(--text-1)',
                    }}
                  >
                    {community.title}
                  </h1>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      background:
                        community.visibility === 'restricted'
                          ? 'rgba(251, 191, 36, 0.14)'
                          : 'rgba(34,197,94,0.14)',
                      color:
                        community.visibility === 'restricted'
                          ? '#facc15'
                          : '#6ee7b7',
                      border:
                        community.visibility === 'restricted'
                          ? '1px solid rgba(250,204,21,0.5)'
                          : '1px solid rgba(16,185,129,0.5)',
                    }}
                  >
                    {community.visibility === 'restricted' ? 'Restricted' : 'Public'}
                  </span>
                  {isRestricted && isAuthenticated && !isOwnerOrMod && membershipKnown && !isBanned && (
                    <>
                      {isMember ? (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--text-2)',
                            background: 'rgba(148,163,184,0.2)',
                            border: '1px solid rgba(148,163,184,0.4)',
                          }}
                        >
                          Member
                        </span>
                      ) : isPending ? (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#fbbf24',
                            background: 'rgba(251,191,36,0.15)',
                            border: '1px solid rgba(251,191,36,0.4)',
                          }}
                        >
                          Request pending
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => joinMutation.mutate()}
                          disabled={joinMutation.isPending || loadingMembership}
                          style={{
                            padding: '4px 12px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#fff',
                            background: 'var(--accent)',
                            border: '1px solid rgba(167,139,250,0.6)',
                            cursor: joinMutation.isPending || loadingMembership ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {joinMutation.isPending || loadingMembership ? (
                            <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                          ) : null}
                          Request to join
                        </button>
                      )}
                    </>
                  )}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'JetBrains Mono',
                    fontSize: 11,
                    color: 'var(--text-3)',
                    textShadow: '0 0 8px rgba(0,0,0,0.9)',
                  }}
                >
                  c/{community.slug}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Manage community: tabs, scrollable lists, search, accept all */}
        {isOwnerOrMod && (
          <details
            open={managePanelOpen}
            onToggle={(e) => setManagePanelOpen((e.target as HTMLDetailsElement).open)}
            style={{
              marginTop: 12,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'rgba(15,23,42,0.85)',
              overflow: 'hidden',
            }}
          >
            <summary
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12,
                color: 'var(--text-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Users size={14} />
              Manage community
            </summary>
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }}>
              {/* Tab bar */}
              <div role="tablist" style={{ display: 'flex', padding: '8px 12px 0', gap: 4, borderBottom: '1px solid rgba(148,163,184,0.12)', overflowX: 'auto', minHeight: 36 }}>
                {(['joiners', 'members', 'banned'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={manageTab === t}
                    onClick={() => setManageTab(t)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: manageTab === t ? 'rgba(129,140,248,0.25)' : 'transparent',
                      color: manageTab === t ? '#c4b5fd' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {t === 'joiners' && <>Join requests{joinRequests?.length ? <span style={{ marginLeft: 4, opacity: 0.9 }}>({joinRequests.length})</span> : ''}</>}
                    {t === 'members' && <>Members{members?.length ? <span style={{ marginLeft: 4, opacity: 0.9 }}>({members.length})</span> : ''}</>}
                    {t === 'banned' && <>Banned{bans?.length ? <span style={{ marginLeft: 4, opacity: 0.9 }}>({bans.length})</span> : ''}</>}
                  </button>
                ))}
              </div>

              <div style={{ padding: 12 }}>
                {/* Join requests tab */}
                {manageTab === 'joiners' && (
                  <>
                    {joinRequests && joinRequests.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-2)' }}>
                          <input
                            type="checkbox"
                            checked={acceptAllChecked}
                            onChange={(e) => setAcceptAllChecked(e.target.checked)}
                            style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                          />
                          Accept all joiners
                        </label>
                        <button
                          type="button"
                          onClick={handleAcceptAllJoiners}
                          disabled={!acceptAllChecked || approvingAll}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            border: '1px solid rgba(34,197,94,0.5)',
                            background: acceptAllChecked ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.08)',
                            color: acceptAllChecked ? '#6ee7b7' : 'var(--text-3)',
                            cursor: acceptAllChecked && !approvingAll ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {approvingAll ? 'Accepting…' : 'Confirm accept'}
                        </button>
                      </div>
                    )}
                    <div style={{ maxHeight: 260, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
                      {loadingJoinRequests ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 12, padding: 12 }}>
                          <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                          Loading…
                        </div>
                      ) : !joinRequests?.length ? (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>No pending join requests</div>
                      ) : (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {joinRequests.map((req: { id: string; user_id: string; username: string; status: string }) => (
                            <li key={req.id} style={{ marginBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
                                <Link to={`/u/${req.username}`} style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-1)', textDecoration: 'none' }}>{req.username}</Link>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button type="button" onClick={() => approveJoinMutation.mutate({ requestId: req.id })} disabled={approveJoinMutation.isPending}
                                    style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.15)', color: '#6ee7b7', cursor: 'pointer' }}>Approve</button>
                                  <button type="button" onClick={() => rejectJoinMutation.mutate({ requestId: req.id })} disabled={rejectJoinMutation.isPending}
                                    style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.12)', color: '#fca5a5', cursor: 'pointer' }}>Reject</button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}

                {/* Members tab: search + list/grid */}
                {manageTab === 'members' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                        <input
                          type="text"
                          placeholder="Search members…"
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          aria-label="Search members by username"
                          style={{
                            width: '100%',
                            padding: '6px 10px 6px 32px',
                            paddingRight: memberSearch.trim() ? 44 : 10,
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'rgba(0,0,0,0.25)',
                            color: 'var(--text-1)',
                            fontSize: 12,
                            boxSizing: 'border-box',
                          }}
                        />
                        {memberSearch.trim() && (
                          <button
                            type="button"
                            onClick={() => setMemberSearch('')}
                            aria-label="Clear search"
                            style={{
                              position: 'absolute',
                              right: 6,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              padding: 2,
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-3)',
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button type="button" onClick={() => setMembersViewMode('list')} title="List view"
                          style={{ padding: 6, borderRadius: 6, border: 'none', background: membersViewMode === 'list' ? 'rgba(129,140,248,0.2)' : 'transparent', color: membersViewMode === 'list' ? '#c4b5fd' : 'var(--text-3)', cursor: 'pointer' }}>
                          <LayoutList size={16} />
                        </button>
                        <button type="button" onClick={() => setMembersViewMode('grid')} title="Grid view"
                          style={{ padding: 6, borderRadius: 6, border: 'none', background: membersViewMode === 'grid' ? 'rgba(129,140,248,0.2)' : 'transparent', color: membersViewMode === 'grid' ? '#c4b5fd' : 'var(--text-3)', cursor: 'pointer' }}>
                          <LayoutGrid size={16} />
                        </button>
                      </div>
                    </div>
                    <div style={{ maxHeight: 280, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
                      {loadingMembers && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 12, padding: 12 }}>
                          <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading…
                        </div>
                      )}
                      {!loadingMembers && !members?.length && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>No members yet</div>
                      )}
                      {!loadingMembers && members?.length > 0 && memberSearch.trim() && filteredMembers.length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
                          No members match &quot;{memberSearch}&quot;
                        </div>
                      )}
                      {!loadingMembers && members?.length > 0 && !(memberSearch.trim() && filteredMembers.length === 0) && membersViewMode === 'grid' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                          {filteredMembers.map((m: { user_id: string; username: string; role: string }) => (
                            <div key={m.user_id} style={{ padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(148,163,184,0.1)' }}>
                              <Link to={`/u/${m.username}`} style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-1)', textDecoration: 'none', display: 'block', marginBottom: 4 }}>{m.username}</Link>
                              <span style={{ padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', background: m.role === 'moderator' ? 'rgba(167,139,250,0.25)' : 'rgba(148,163,184,0.2)', color: m.role === 'moderator' ? '#c4b5fd' : 'var(--text-2)' }}>{m.role}</span>
                              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {isOwner && (m.role === 'moderator' ? (
                                  <button type="button" onClick={() => setRoleMutation.mutate({ userId: m.user_id, role: 'member' })} disabled={setRoleMutation.isPending}
                                    style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Remove mod</button>
                                ) : pendingInviteUserIds.has(m.user_id) ? (
                                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Pending</span>
                                ) : (
                                  <button type="button" onClick={() => inviteModeratorMutation.mutate(m.user_id)} disabled={inviteModeratorMutation.isPending}
                                    style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Invite mod</button>
                                ))}
                                {isOwnerOrMod && m.role === 'member' && community?.owner_id !== m.user_id && (
                                  <button type="button" onClick={() => banUserMutation.mutate({ userId: m.user_id })} disabled={banUserMutation.isPending}
                                    style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer' }}>Ban</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!loadingMembers && members?.length > 0 && !(memberSearch.trim() && filteredMembers.length === 0) && membersViewMode === 'list' && (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {filteredMembers.map((m: { user_id: string; username: string; role: string }) => (
                            <li key={m.user_id} style={{ marginBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Link to={`/u/${m.username}`} style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-1)', textDecoration: 'none' }}>{m.username}</Link>
                                  <span style={{ padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', background: m.role === 'moderator' ? 'rgba(167,139,250,0.25)' : 'rgba(148,163,184,0.2)', color: m.role === 'moderator' ? '#c4b5fd' : 'var(--text-2)' }}>{m.role}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  {isOwner && (m.role === 'moderator' ? (
                                    <button type="button" title="Revoke moderator" onClick={() => setRoleMutation.mutate({ userId: m.user_id, role: 'member' })} disabled={setRoleMutation.isPending}
                                      style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Remove mod</button>
                                  ) : pendingInviteUserIds.has(m.user_id) ? (
                                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Pending</span>
                                  ) : (
                                    <button type="button" onClick={() => inviteModeratorMutation.mutate(m.user_id)} disabled={inviteModeratorMutation.isPending}
                                      style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Invite mod</button>
                                  ))}
                                  {isOwnerOrMod && m.role === 'member' && community?.owner_id !== m.user_id && (
                                    <button type="button" title="Ban user" onClick={() => banUserMutation.mutate({ userId: m.user_id })} disabled={banUserMutation.isPending}
                                      style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <ShieldOff size={10} /> Ban
                                    </button>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {members?.length && memberSearch.trim() && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                        Showing {filteredMembers.length} of {members.length} members
                      </div>
                    )}
                  </>
                )}

                {/* Banned tab */}
                {manageTab === 'banned' && (
                  <div style={{ maxHeight: 280, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
                    {bans.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>No banned users</div>
                    ) : (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {bans.map((b: { user_id: string; username: string; banned_by_username: string; reason: string | null; created_at: string }) => (
                          <li key={b.user_id} style={{ marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
                              <div>
                                <Link to={`/u/${b.username}`} style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-1)', textDecoration: 'none' }}>{b.username}</Link>
                                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>by {b.banned_by_username}{b.reason ? ` · ${b.reason}` : ''}</div>
                              </div>
                              <button type="button" title="Unban" onClick={() => unbanUserMutation.mutate(b.user_id)} disabled={unbanUserMutation.isPending}
                                style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: '#86efac', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <UserCheck size={10} /> Unban
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </details>
        )}

        {/* Tabs */}
        <div
          style={{
            marginTop: 16,
            display: 'inline-flex',
            padding: 4,
            borderRadius: 999,
            border: '1px solid rgba(148,163,184,0.5)',
            background: 'rgba(15,23,42,0.85)',
          }}
        >
          {(['prompts', 'discussion'] as Tab[]).map((key) => {
            const active = tab === key
            const label = key === 'prompts' ? 'Prompts' : 'Discussion'
            const Icon = key === 'prompts' ? Grid3X3 : MessageSquare
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  background: active ? 'rgba(129,140,248,0.35)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--text-2)',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                }}
              >
                <Icon size={13} />
                <span>{label}</span>
                {key === 'prompts' && prompts && (
                  <span
                    style={{
                      fontSize: 10,
                      opacity: 0.7,
                    }}
                  >
                    {prompts.total}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main + Sidebar grid (same card/section foundation) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 280px',
          gap: 24,
          alignItems: 'start',
          marginTop: 20,
        }}
      >
        {/* Main content column */}
        <div style={{ minWidth: 0 }}>
      {/* Content */}
      <div
        style={{
          paddingTop: 4,
        }}
      >
        {tab === 'prompts' && (
          <>
            {!canViewPrompts ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 16px',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'rgba(15,23,42,0.7)',
                  marginTop: 16,
                }}
              >
                {isAuthenticated && loadingMembership ? (
                  <>
                    <Loader2
                      size={28}
                      style={{
                        display: 'block',
                        margin: '0 auto 16px',
                        color: 'var(--text-2)',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontFamily: 'var(--font-body)',
                        color: 'var(--text-2)',
                      }}
                    >
                      Checking access…
                    </p>
                  </>
                ) : isBanned ? (
                  <>
                    <p
                      style={{
                        margin: '0 0 12px',
                        fontSize: 16,
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                        color: 'var(--text-1)',
                      }}
                    >
                      You are banned from this community
                    </p>
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--text-2)',
                        fontFamily: 'Nunito',
                        fontSize: 14,
                      }}
                    >
                      You cannot view prompts or post here. Contact the community owner if you believe this was a mistake.
                    </p>
                  </>
                ) : (
                  <>
                <p
                  style={{
                    margin: '0 0 12px',
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-1)',
                  }}
                >
                  This is a restricted community
                </p>
                <p
                  style={{
                    margin: '0 0 20px',
                    color: 'var(--text-2)',
                    fontFamily: 'Nunito',
                    fontSize: 14,
                  }}
                >
                  Request to join to view and post prompts. Approval is required from the owner or a moderator.
                </p>
                {!isAuthenticated ? (
                  <Link
                    to="/login"
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#fff',
                      background: 'var(--accent)',
                      border: '1px solid rgba(167,139,250,0.6)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Sign in to request to join
                  </Link>
                ) : !isMember && !isPending ? (
                  <button
                    type="button"
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending || loadingMembership}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#fff',
                      background: 'var(--accent)',
                      border: '1px solid rgba(167,139,250,0.6)',
                      cursor: joinMutation.isPending || loadingMembership ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {joinMutation.isPending || loadingMembership ? (
                      <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                    ) : null}
                    Request to join
                  </button>
                ) : null}
                {isPending && (
                  <span
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#fbbf24',
                      background: 'rgba(251,191,36,0.15)',
                      border: '1px solid rgba(251,191,36,0.4)',
                    }}
                  >
                    Request pending
                  </span>
                )}
                  </>
                )}
              </div>
            ) : loadingPrompts ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 14,
                  marginTop: 16,
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 180,
                      borderRadius: 18,
                      border: '1px solid rgba(148,163,184,0.4)',
                      background: 'rgba(15,23,42,0.85)',
                      opacity: 0.5,
                    }}
                  />
                ))}
              </div>
            ) : (prompts?.items ?? []).length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '64px 16px',
                }}
              >
                <Grid3X3
                  size={32}
                  style={{
                    display: 'block',
                    margin: '0 auto 16px',
                    color: 'var(--text-2)',
                    opacity: 0.25,
                  }}
                />
                <p
                  style={{
                    margin: '0 0 8px',
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-1)',
                  }}
                >
                  No prompts yet
                </p>
                <p
                  style={{
                    margin: '0 0 20px',
                    color: 'var(--text-2)',
                    fontFamily: 'Nunito',
                    fontSize: 14,
                  }}
                >
                  Be the first to post in this community
                </p>
                {canPostPrompt && (
                  <Link
                    to={`/submit?community=${slug}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 16px',
                      borderRadius: 999,
                      border: '1px solid rgba(167,139,250,0.9)',
                      background:
                        'radial-gradient(circle at top left, rgba(129,140,248,0.55), rgba(56,189,248,0.35))',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'var(--font-body)',
                      color: '#ffffff',
                      textDecoration: 'none',
                    }}
                  >
                    <PlusCircle size={14} /> Post a Prompt
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 16,
                  }}
                >
                  {prompts!.items.map(p => <PromptCard key={p.id} prompt={p} />)}
                </div>
                {(prompts!.has_more || page > 1) && (
                  <div
                    style={{
                      marginTop: 24,
                      paddingTop: 16,
                      borderTop: '1.5px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 16,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: '1px solid rgba(148,163,184,0.7)',
                        background: 'transparent',
                        color: 'var(--text-1)',
                        fontSize: 12,
                        fontFamily: 'var(--font-body)',
                        cursor: page === 1 ? 'default' : 'pointer',
                        opacity: page === 1 ? 0.4 : 1,
                      }}
                    >
                      ← Prev
                    </button>
                    <span style={{ color: 'var(--text-3)', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                      {page} / {Math.ceil(prompts!.total / prompts!.page_size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(p => p + 1)}
                      disabled={!prompts!.has_more}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: '1px solid rgba(148,163,184,0.7)',
                        background: 'transparent',
                        color: 'var(--text-1)',
                        fontSize: 12,
                        fontFamily: 'var(--font-body)',
                        cursor: !prompts!.has_more ? 'default' : 'pointer',
                        opacity: !prompts!.has_more ? 0.4 : 1,
                      }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'discussion' && (
          <>
            {/* Restricted: non-members cannot view or post in discussion */}
            {!canViewPrompts ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 16px',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  background: 'rgba(15,23,42,0.7)',
                  marginTop: 16,
                }}
              >
                {isAuthenticated && loadingMembership ? (
                  <>
                    <Loader2
                      size={28}
                      style={{
                        display: 'block',
                        margin: '0 auto 16px',
                        color: 'var(--text-2)',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontFamily: 'var(--font-body)',
                        color: 'var(--text-2)',
                      }}
                    >
                      Checking access…
                    </p>
                  </>
                ) : isBanned ? (
                  <>
                    <p
                      style={{
                        margin: '0 0 12px',
                        fontSize: 16,
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                        color: 'var(--text-1)',
                      }}
                    >
                      You are banned from this community
                    </p>
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--text-2)',
                        fontFamily: 'Nunito',
                        fontSize: 14,
                      }}
                    >
                      You cannot view or post in the discussion. Contact the community owner if you believe this was a mistake.
                    </p>
                  </>
                ) : (
                  <>
                    <p
                      style={{
                        margin: '0 0 12px',
                        fontSize: 16,
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                        color: 'var(--text-1)',
                      }}
                    >
                      This is a restricted community
                    </p>
                    <p
                      style={{
                        margin: '0 0 20px',
                        color: 'var(--text-2)',
                        fontFamily: 'Nunito',
                        fontSize: 14,
                      }}
                    >
                      Request to join to view and post in the discussion. Approval is required from the owner or a moderator.
                    </p>
                    {!isAuthenticated ? (
                      <Link
                        to="/login"
                        style={{
                          padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#fff',
                          background: 'var(--accent)', border: '1px solid rgba(167,139,250,0.6)', textDecoration: 'none',
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        Sign in to request to join
                      </Link>
                    ) : !isMember && !isPending ? (
                      <button
                        type="button"
                        onClick={() => joinMutation.mutate()}
                        disabled={joinMutation.isPending || loadingMembership}
                        style={{
                          padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#fff',
                          background: 'var(--accent)', border: '1px solid rgba(167,139,250,0.6)', cursor: joinMutation.isPending || loadingMembership ? 'wait' : 'pointer',
                        }}
                      >
                        {joinMutation.isPending || loadingMembership ? 'Requesting…' : 'Request to join'}
                      </button>
                    ) : isPending ? (
                      <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Request pending. Wait for approval.</span>
                    ) : null}
                  </>
                )}
              </div>
            ) : !canPostDiscussion && isAuthenticated ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  background: 'rgba(15,23,42,0.96)',
                  color: 'var(--text-2)',
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {isBanned
                  ? 'You are banned from this community and cannot post in the discussion.'
                  : 'Join this community to post in the discussion. Request to join and wait for approval if it’s restricted.'}
              </div>
            ) : null}
            {canViewPrompts && canPostDiscussion ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  background: 'rgba(15,23,42,0.96)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'Outfit',
                      background: 'var(--accent-muted)',
                      color: 'var(--accent-h)',
                      flexShrink: 0,
                    }}
                  >
                    {user?.username[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <textarea
                      rows={3}
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                      placeholder={`Share something with c/${slug}...`}
                      style={{
                        width: '100%',
                        resize: 'none',
                        borderRadius: 10,
                        border: '1px solid rgba(148,163,184,0.6)',
                        background: 'rgba(15,23,42,0.95)',
                        padding: '8px 10px',
                        color: 'var(--text-1)',
                        fontSize: 13,
                        fontFamily: 'var(--font-body)',
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: 8,
                      }}
                    >
                      <button
                        type="button"
                        disabled={!postContent.trim() || postMutation.isPending}
                        onClick={() => postMutation.mutate()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 999,
                          border: '1px solid rgba(167,139,250,0.9)',
                          background:
                            'radial-gradient(circle at top left, rgba(129,140,248,0.55), rgba(56,189,248,0.35))',
                          fontSize: 13,
                          fontWeight: 600,
                          fontFamily: 'var(--font-body)',
                          color: '#ffffff',
                          cursor: !postContent.trim() || postMutation.isPending ? 'default' : 'pointer',
                          opacity: !postContent.trim() || postMutation.isPending ? 0.7 : 1,
                        }}
                      >
                        {postMutation.isPending ? (
                          <Loader2 size={13} />
                        ) : (
                          <Send size={13} />
                        )}
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : !isAuthenticated ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  background: 'rgba(15,23,42,0.96)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: 'Nunito',
                    fontSize: 14,
                    color: 'var(--text-2)',
                    margin: 0,
                  }}
                >
                  Sign in to join the discussion
                </p>
                <Link
                  to="/login"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 16px',
                    borderRadius: 999,
                    border: '1px solid rgba(167,139,250,0.9)',
                    background:
                      'radial-gradient(circle at top left, rgba(129,140,248,0.55), rgba(56,189,248,0.35))',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    color: '#ffffff',
                    textDecoration: 'none',
                  }}
                >
                  Sign in
                </Link>
              </div>
            ) : null}

            {/* Posts list: only when user is allowed to view content */}
            {canViewPrompts ? (loadingPosts ? (
              <div
                style={{
                  paddingTop: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 80,
                      borderRadius: 14,
                      border: '1px solid rgba(148,163,184,0.4)',
                      background: 'rgba(15,23,42,0.9)',
                      opacity: 0.6,
                    }}
                  />
                ))}
              </div>
            ) : (postsData?.items ?? []).length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 16px',
                }}
              >
                <MessageSquare
                  size={32}
                  style={{
                    display: 'block',
                    margin: '0 auto 12px',
                    color: 'var(--text-2)',
                    opacity: 0.25,
                  }}
                />
                <p
                  style={{
                    fontFamily: 'Outfit',
                    fontWeight: 700,
                    fontSize: 16,
                    color: 'var(--text-1)',
                    margin: '0 0 4px',
                  }}
                >
                  No posts yet
                </p>
                <p
                  style={{
                    color: 'var(--text-2)',
                    fontFamily: 'Nunito',
                    fontSize: 13,
                    margin: 0,
                  }}
                >
                  Start the conversation
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {postsData!.items.map((post: any) => (
                  <div
                    key={post.id}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      background: 'rgba(15,23,42,0.96)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                          background: 'var(--accent-muted)',
                          color: 'var(--accent-h)',
                          fontFamily: 'Outfit',
                        }}
                      >
                        {post.author?.username?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <span
                          style={{
                            fontFamily: 'Outfit',
                            fontWeight: 600,
                            fontSize: 13,
                            color: 'var(--text-1)',
                          }}
                        >
                          {post.author?.username ?? 'Unknown'}
                        </span>
                        <span
                          style={{
                            fontFamily: 'Nunito',
                            fontSize: 11,
                            color: 'var(--text-3)',
                            marginLeft: 8,
                          }}
                        >
                          {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <p
                      style={{
                        fontFamily: 'Nunito',
                        fontSize: 14,
                        color: 'var(--text-2)',
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {post.content}
                    </p>
                  </div>
                ))}
              </div>
            )) : null}
          </>
        )}
      </div>
        </div>

        {/* Sidebar: same grid foundation (card/section styling) */}
        <aside
          style={{
            position: 'sticky',
            top: 72,
            maxHeight: 'calc(100vh - 96px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* About + member count (editable for mod/owner) */}
          <section
            style={{
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'rgba(15,23,42,0.7)',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                About
              </h3>
              {isOwnerOrMod && (
                !editingAbout ? (
                  <button type="button" onClick={() => { setDraftDescription(community.description ?? ''); setEditingAbout(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }} title="Edit about"><Pencil size={12} /></button>
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" onClick={() => updateCommunityMutation.mutate({ description: draftDescription })} disabled={updateCommunityMutation.isPending} style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#6ee7b7', padding: '2px 6px', borderRadius: 6, cursor: 'pointer' }}><Check size={12} /></button>
                    <button type="button" onClick={() => { setEditingAbout(false); setDraftDescription(''); }} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', padding: '2px 6px', borderRadius: 6, cursor: 'pointer' }}><X size={12} /></button>
                  </div>
                )
              )}
            </div>
            {editingAbout ? (
              <textarea value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} placeholder="Community description…" rows={3} style={{ width: '100%', resize: 'vertical', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.25)', color: 'var(--text-1)', padding: 8, fontSize: 12, fontFamily: 'var(--font-body)', boxSizing: 'border-box', marginBottom: 8 }} />
            ) : (
              <>
                {community.description ? (
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-body)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {community.description}
                  </p>
                ) : (
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
                    No description yet.
                  </p>
                )}
              </>
            )}
            {typeof community.member_count === 'number' && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
                <strong style={{ color: 'var(--text-2)' }}>{community.member_count}</strong> member{community.member_count !== 1 ? 's' : ''}
              </p>
            )}
          </section>

          {/* Announcement */}
          <section
            style={{
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'rgba(15,23,42,0.7)',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Megaphone size={14} style={{ color: 'var(--accent-h)' }} />
                <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Announcement
                </h3>
              </div>
              {isOwnerOrMod && (
                !editingAnnouncement ? (
                  <button type="button" onClick={() => { setDraftAnnouncement(community.announcement ?? ''); setEditingAnnouncement(true) }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }} title="Edit announcement"><Pencil size={12} /></button>
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" onClick={() => { updateCommunityMutation.mutate({ announcement: draftAnnouncement }); }} disabled={updateCommunityMutation.isPending} style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', color: '#6ee7b7', padding: '2px 6px', borderRadius: 6, cursor: 'pointer' }}><Check size={12} /></button>
                    <button type="button" onClick={() => { setEditingAnnouncement(false); setDraftAnnouncement(''); }} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', padding: '2px 6px', borderRadius: 6, cursor: 'pointer' }}><X size={12} /></button>
                  </div>
                )
              )}
            </div>
            {editingAnnouncement ? (
              <textarea value={draftAnnouncement} onChange={(e) => setDraftAnnouncement(e.target.value)} placeholder="Community announcement…" rows={3} style={{ width: '100%', resize: 'vertical', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.25)', color: 'var(--text-1)', padding: 8, fontSize: 12, fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-body)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {community.announcement || 'No announcement.'}
              </p>
            )}
          </section>

          {/* Community: rules (editable for mod/owner) + show owner badge */}
          <section
            style={{
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'rgba(15,23,42,0.7)',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <BookOpen size={14} style={{ color: 'var(--accent-h)' }} />
              <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Community
              </h3>
            </div>
            {community.owner_username && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-body)' }}>
                  Owner: <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>{community.owner_username}</strong>
                </span>
                {community.show_owner_badge !== false && (
                  <span
                    style={{
                      padding: '1px 5px',
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      background: 'rgba(167,139,250,0.22)',
                      color: '#c4b5fd',
                      border: '1px solid rgba(167,139,250,0.4)',
                      lineHeight: 1.2,
                    }}
                  >
                    Owner
                  </span>
                )}
              </div>
            )}
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
              c/{community.slug} · {community.visibility === 'restricted' ? 'Restricted' : 'Public'}
            </p>
            {isOwner && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 12, color: 'var(--text-2)', cursor: updateCommunityMutation.isPending ? 'not-allowed' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={community.show_owner_badge !== false}
                  onChange={(e) => updateCommunityMutation.mutate({ show_owner_badge: e.target.checked })}
                  disabled={updateCommunityMutation.isPending}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                  aria-hidden
                />
                <span
                  role="switch"
                  aria-checked={community.show_owner_badge !== false}
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 20,
                    borderRadius: 999,
                    background: community.show_owner_badge !== false ? 'var(--accent)' : 'rgba(148,163,184,0.4)',
                    border: '1px solid ' + (community.show_owner_badge !== false ? 'rgba(167,139,250,0.5)' : 'rgba(148,163,184,0.5)'),
                    flexShrink: 0,
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: community.show_owner_badge !== false ? 18 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      transition: 'left 0.2s ease-out',
                    }}
                  />
                </span>
                <span>Show Owner badge</span>
              </label>
            )}
            <div style={{ marginTop: 8 }}>
              {editingRules ? (
                <>
                  <textarea value={draftRules} onChange={(e) => setDraftRules(e.target.value.slice(0, RULES_MAX_LENGTH))} placeholder="Community rules…" maxLength={RULES_MAX_LENGTH} rows={4} style={{ width: '100%', resize: 'vertical', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.25)', color: 'var(--text-1)', padding: 8, fontSize: 12, fontFamily: 'var(--font-body)', boxSizing: 'border-box', marginBottom: 4 }} />
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-3)' }}>{draftRules.length} / {RULES_MAX_LENGTH} characters</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => { updateCommunityMutation.mutate({ rules: draftRules }); }} disabled={updateCommunityMutation.isPending} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.2)', color: '#6ee7b7', cursor: 'pointer' }}>Save</button>
                    <button type="button" onClick={() => { setEditingRules(false); setDraftRules(community.rules ?? ''); }} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  {community.rules ? (
                    <div style={{ paddingTop: 4, borderTop: '1px solid rgba(148,163,184,0.2)', fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {community.rules}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>No rules set.</p>
                  )}
                  {isOwnerOrMod && (
                    <button type="button" onClick={() => { setDraftRules(community.rules ?? ''); setEditingRules(true); }} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>
                      <Pencil size={10} /> Edit rules
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
