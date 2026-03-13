import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

function notificationHref(n: Notification): string | null {
  if (n.entity_type === 'community' && n.entity_slug) return `/c/${n.entity_slug}`
  if (n.entity_type === 'prompt') return `/prompt/${n.entity_id}`
  if (n.entity_type === 'message_thread') return `/messages?with=${n.entity_id}`
  return null
}
import {
  Home, Compass, FlaskConical, PlusCircle, Users,
  BookMarked, LogOut, Menu, X, Bell, Search, Settings, MessageCircle
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store'
import GalaxyBackground from '../GalaxyBackground'
import { notificationsApi, moderatorInvitesApi } from '../../api'
import type { Notification } from '../../types'
import toast from 'react-hot-toast'

const NAV = [
  { to: '/feed',        icon: Home,         label: 'Explore' },
  { to: '/explore',     icon: Compass,      label: 'Search' },
  { to: '/lab',         icon: FlaskConical, label: 'Context Optimizer' },
  { to: '/communities', icon: Users,        label: 'Communities' },
  { to: '/messages',    icon: MessageCircle, label: 'Messages' },
  { to: '/collections', icon: BookMarked,   label: 'Collections' },
]

function AndromedaLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: collapsed ? '8px 12px' : '8px 4px',
      justifyContent: collapsed ? 'center' : 'flex-start',
    }}>
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="15" cy="15" r="14" fill="url(#lxlogo)" opacity="0.9"/>
        <path d="M15 8 C18 8 22 11 22 15 C22 19 18 22 15 22 C12 22 8 19 8 15"
          stroke="rgba(255,240,180,0.9)" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <path d="M15 10 C17 10 20 12.5 20 15 C20 17.5 17 20 15 20"
          stroke="rgba(245,158,11,0.7)" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <circle cx="15" cy="15" r="2.2" fill="rgba(255,245,180,0.95)"/>
        <circle cx="15" cy="15" r="1" fill="white"/>
        <defs>
          <radialGradient id="lxlogo" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#6E56CF"/>
            <stop offset="100%" stopColor="#1e1060"/>
          </radialGradient>
        </defs>
      </svg>
      {!collapsed && (
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
          color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1,
        }}>
          LX-OS
        </span>
      )}
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [backgroundMode, setBackgroundMode] = useState<'live' | 'static'>('live')
  const { user, logout, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const SIDEBAR_W = collapsed ? 68 : 220

  const qc = useQueryClient()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement | null>(null)

  const handleLogout = () => { logout(); navigate('/login') }

  const { data: notifications, refetch: refetchNotifications, isFetching: notificationsFetching, isError: notificationsError } = useQuery({
    queryKey: ['notifications', { unread_only: false }],
    queryFn: () => notificationsApi.list({ unread_only: false, limit: 20 }).then(r => r.data),
    enabled: isAuthenticated,
    refetchInterval: notifOpen ? 5_000 : 12_000,
    refetchOnWindowFocus: true,
    retry: 2,
    staleTime: 0,
  })

  useEffect(() => {
    if (notifOpen && isAuthenticated) refetchNotifications()
  }, [notifOpen, isAuthenticated, refetchNotifications])

  const { data: myModeratorInvites = [] } = useQuery({
    queryKey: ['moderator-invites'],
    queryFn: () => moderatorInvitesApi.listMine().then(r => r.data),
    enabled: notifOpen && isAuthenticated,
  })
  const inviteIdByCommunityId = useMemo(() => {
    const m: Record<string, string> = {}
    for (const inv of myModeratorInvites) m[inv.community_id] = inv.id
    return m
  }, [myModeratorInvites])

  const acceptInviteMutation = useMutation({
    mutationFn: (inviteId: string) => moderatorInvitesApi.accept(inviteId).then(r => r.data),
    onSuccess: (data: { status?: string; community_slug?: string }) => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['moderator-invites'] })
      toast.success('You are now a moderator')
      if (data?.community_slug) navigate(`/c/${data.community_slug}`)
      setNotifOpen(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to accept'),
  })
  const rejectInviteMutation = useMutation({
    mutationFn: (inviteId: string) => moderatorInvitesApi.reject(inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['moderator-invites'] })
      toast.success('Invite declined')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Failed to reject'),
  })

  const unreadCount = useMemo(
    () => (notifications ?? []).filter(n => n.is_read === false).length,
    [notifications]
  )

  useEffect(() => {
    if (!notifOpen) return
    const onDown = (e: MouseEvent) => {
      if (!notifRef.current) return
      if (!notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [notifOpen])

  const markSingleAsRead = async (id: string) => {
    try {
      await notificationsApi.markRead([id])
      qc.invalidateQueries({ queryKey: ['notifications'] })
    } catch {
      // ignore
    }
  }

  const markAllVisibleUnreadRead = async () => {
    const ids = (notifications ?? []).filter(n => !n.is_read).map(n => n.id)
    if (ids.length === 0) return
    try {
      await notificationsApi.markRead(ids)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    } catch {
      // ignore
    }
  }

  // hydrate background preference from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('lxos-background-mode')
      if (stored === 'live' || stored === 'static') {
        setBackgroundMode(stored)
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  // persist background preference
  useEffect(() => {
    try {
      window.localStorage.setItem('lxos-background-mode', backgroundMode)
    } catch {
      // ignore storage errors
    }
  }, [backgroundMode])

  const Sidebar = (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: SIDEBAR_W,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(4,3,12,0.85)',
      backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      borderRight: '1px solid rgba(167,139,250,0.10)',
      zIndex: 20,
      transition: 'width 280ms cubic-bezier(0.16,1,0.3,1)',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: '18px 14px 12px',
        borderBottom: '1px solid rgba(167,139,250,0.07)',
        flexShrink: 0,
      }}>
        <Link to="/feed" style={{ textDecoration: 'none' }}>
          <AndromedaLogo collapsed={collapsed} />
        </Link>
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(107,114,128,0.6)', padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center',
          }}>
            <Menu size={18} />
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={() => setCollapsed(false)} style={{
          margin: '8px auto',
          background: 'rgba(110,86,207,0.10)',
          border: '1px solid rgba(167,139,250,0.12)',
          cursor: 'pointer', color: 'rgba(167,139,250,0.7)',
          padding: 6, borderRadius: 8,
          display: 'flex', alignItems: 'center',
        }}>
          <Menu size={18} />
        </button>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12,
            padding: collapsed ? '11px 14px' : '11px 16px',
            borderRadius: 10,
            color: isActive ? 'rgba(196,181,253,1)' : 'rgba(107,114,128,0.85)',
            background: isActive ? 'rgba(110,86,207,0.18)' : 'transparent',
            border: isActive ? '1px solid rgba(167,139,250,0.22)' : '1px solid transparent',
            boxShadow: isActive ? '0 0 20px rgba(110,86,207,0.15)' : 'none',
            textDecoration: 'none',
            fontSize: 13.5, fontFamily: 'var(--font-display)',
            fontWeight: isActive ? 600 : 500,
            letterSpacing: '0.01em',
            transition: 'all 200ms ease',
            justifyContent: collapsed ? 'center' : 'flex-start',
            whiteSpace: 'nowrap', overflow: 'hidden',
          })}>
            {({ isActive }) => (
              <>
                <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.75, display: 'flex' }}>
                  <Icon size={18} />
                </span>
                {!collapsed && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{
        padding: '12px 10px',
        borderTop: '1px solid rgba(167,139,250,0.07)',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {isAuthenticated ? (
          <>
            <NavLink to="/submit" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: collapsed ? '11px 14px' : '11px 16px',
              borderRadius: 10,
              background: 'linear-gradient(135deg,rgba(115,88,216,0.25),rgba(67,56,202,0.20))',
              border: '1px solid rgba(167,139,250,0.20)',
              color: 'rgba(196,181,253,0.9)',
              textDecoration: 'none',
              fontSize: 13.5, fontFamily: 'var(--font-display)', fontWeight: 600,
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'all 200ms ease',
              marginBottom: 4,
            })}>
              <PlusCircle size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>Submit Prompt</span>}
            </NavLink>
            <NavLink to="/settings" style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: collapsed ? '11px 14px' : '11px 16px',
              borderRadius: 10,
              color: isActive ? 'rgba(196,181,253,1)' : 'rgba(107,114,128,0.75)',
              background: isActive ? 'rgba(110,86,207,0.18)' : 'transparent',
              border: '1px solid transparent',
              textDecoration: 'none',
              fontSize: 13.5, fontFamily: 'var(--font-display)', fontWeight: 500,
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'all 200ms ease',
            })}>
              <Settings size={18} style={{ flexShrink: 0, opacity: 0.7 }} />
              {!collapsed && <span>Settings</span>}
            </NavLink>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px 12px' : '10px 14px',
              marginTop: 4, borderRadius: 10,
              background: 'rgba(110,86,207,0.07)',
              border: '1px solid rgba(167,139,250,0.08)',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg,#6E56CF,#4338CA)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {user?.username?.[0]?.toUpperCase() ?? 'U'}
              </div>
              {!collapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--star-silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.username ?? 'User'}
                  </div>
                </div>
              )}
              {!collapsed && (
                <button onClick={handleLogout} title="Log out" style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(107,114,128,0.55)', padding: 4, borderRadius: 6,
                  display: 'flex', alignItems: 'center', transition: 'color 150ms ease',
                  flexShrink: 0,
                }}>
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Link to="/login" className="btn btn-primary" style={{ justifyContent: 'center', fontSize: 13 }}>
              {collapsed ? '→' : 'Sign In'}
            </Link>
          </div>
        )}
      </div>
    </aside>
  )

  return (
    <>
      {/* Both backgrounds stay mounted; we just fade opacities for smoother theme switching */}
      <GalaxyBackground opacity={backgroundMode === 'live' ? 0.9 : 0} />
      <div
        className={
          backgroundMode === 'static'
            ? 'theme-static-background'
            : 'theme-static-background is-hidden'
        }
      />

      {/* Desktop sidebar */}
      <div style={{ display: 'none' }} className="hide-mobile">
        {Sidebar}
      </div>
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: SIDEBAR_W,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(4,3,12,0.85)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        borderRight: '1px solid rgba(167,139,250,0.10)',
        zIndex: 20,
        transition: 'width 280ms cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden',
      }}
      className="shell-sidebar"
      >
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: '18px 14px 12px',
          borderBottom: '1px solid rgba(167,139,250,0.07)',
          flexShrink: 0,
        }}>
          <Link to="/feed" style={{ textDecoration: 'none' }}>
            <AndromedaLogo collapsed={collapsed} />
          </Link>
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(107,114,128,0.6)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}>
              <Menu size={18} />
            </button>
          )}
        </div>

        {collapsed && (
          <button onClick={() => setCollapsed(false)} style={{
            margin: '8px auto',
            background: 'rgba(110,86,207,0.10)',
            border: '1px solid rgba(167,139,250,0.12)',
            cursor: 'pointer', color: 'rgba(167,139,250,0.7)',
            padding: 6, borderRadius: 8,
            display: 'flex', alignItems: 'center',
          }}>
            <Menu size={18} />
          </button>
        )}

        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: collapsed ? '11px 14px' : '11px 16px',
              borderRadius: 10,
              color: isActive ? 'rgba(196,181,253,1)' : 'rgba(107,114,128,0.85)',
              background: isActive ? 'rgba(110,86,207,0.18)' : 'transparent',
              border: isActive ? '1px solid rgba(167,139,250,0.22)' : '1px solid transparent',
              boxShadow: isActive ? '0 0 20px rgba(110,86,207,0.15)' : 'none',
              textDecoration: 'none',
              fontSize: 13.5, fontFamily: 'var(--font-display)',
              fontWeight: isActive ? 600 : 500,
              transition: 'all 200ms ease',
              justifyContent: collapsed ? 'center' : 'flex-start',
              whiteSpace: 'nowrap', overflow: 'hidden',
            })}>
              {({ isActive }) => (
                <>
                  <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.75, display: 'flex' }}>
                    <Icon size={18} />
                  </span>
                  {!collapsed && <span>{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{
          padding: '12px 10px',
          borderTop: '1px solid rgba(167,139,250,0.07)',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {isAuthenticated ? (
            <>
              <NavLink to="/submit" style={() => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: collapsed ? '11px 14px' : '11px 16px',
                borderRadius: 10,
                background: 'linear-gradient(135deg,rgba(115,88,216,0.25),rgba(67,56,202,0.20))',
                border: '1px solid rgba(167,139,250,0.20)',
                color: 'rgba(196,181,253,0.9)',
                textDecoration: 'none',
                fontSize: 13.5, fontFamily: 'var(--font-display)', fontWeight: 600,
                justifyContent: collapsed ? 'center' : 'flex-start',
                transition: 'all 200ms ease', marginBottom: 4,
              })}>
                <PlusCircle size={18} style={{ flexShrink: 0 }} />
                {!collapsed && <span>Submit Prompt</span>}
              </NavLink>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px 12px' : '10px 14px',
                marginTop: 4, borderRadius: 10,
                background: 'rgba(110,86,207,0.07)',
                border: '1px solid rgba(167,139,250,0.08)',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#6E56CF,#4338CA)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {user?.username?.[0]?.toUpperCase() ?? 'U'}
                </div>
                {!collapsed && (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--star-silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user?.username ?? 'User'}
                      </div>
                    </div>
                    <button onClick={handleLogout} title="Log out" style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(107,114,128,0.55)', padding: 4, borderRadius: 6,
                      display: 'flex', alignItems: 'center', flexShrink: 0,
                    }}>
                      <LogOut size={14} />
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <Link to="/login" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '10px 14px', borderRadius: 10,
              background: 'linear-gradient(135deg,#7358D8,#4338CA)',
              color: '#fff', textDecoration: 'none',
              fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600,
              boxShadow: 'var(--shadow-glow)',
            }}>
              {collapsed ? '→' : 'Sign In'}
            </Link>
          )}
        </div>
      </aside>

      {/* Topbar */}
      <header style={{
        position: 'fixed', top: 0, right: 0,
        left: SIDEBAR_W,
        height: 56, zIndex: 19,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 20px',
        background: 'rgba(4,3,12,0.72)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(167,139,250,0.09)',
        transition: 'left 280ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(o => !o)} style={{
          display: 'none', background: 'none', border: 'none',
          cursor: 'pointer', color: 'rgba(167,139,250,0.7)',
          padding: 4, alignItems: 'center',
        }} className="mobile-menu-btn">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Search */}
        <div style={{
          flex: 1, maxWidth: 440,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.035)',
          border: '1px solid rgba(167,139,250,0.10)',
          borderRadius: 10, padding: '0 14px', height: 36,
        }}>
          <Search size={14} style={{ color: 'rgba(107,114,128,0.55)', flexShrink: 0 }} />
          <input
            placeholder="Search prompts, creators, models…"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-1)', fontFamily: 'var(--font-body)',
              fontSize: 13, width: '100%',
            }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {isAuthenticated && (
          <>
            <Link to="/submit" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg,#7358D8,#4338CA)',
              color: '#fff', borderRadius: 9, padding: '7px 14px',
              fontSize: 12.5, fontFamily: 'var(--font-display)', fontWeight: 600,
              letterSpacing: '0.02em', textDecoration: 'none',
              boxShadow: '0 0 20px rgba(110,86,207,0.35)',
              transition: 'all 200ms ease', whiteSpace: 'nowrap',
            }}>
              <PlusCircle size={14} />
              <span>Submit</span>
            </Link>
            {/* Background mode toggle */}
            <button
              type="button"
              onClick={() =>
                setBackgroundMode(prev => (prev === 'live' ? 'static' : 'live'))
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginLeft: 10,
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.4)',
                background:
                  backgroundMode === 'static'
                    ? 'rgba(15,23,42,0.9)'
                    : 'rgba(15,23,42,0.7)',
                color: 'var(--text-2)',
                fontSize: 11,
                fontFamily: 'var(--font-display)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ opacity: 0.9 }}>Theme</span>
              <span
                aria-hidden="true"
                style={{
                  position: 'relative',
                  width: 42,
                  height: 20,
                  borderRadius: 999,
                  background:
                    backgroundMode === 'live'
                      ? 'linear-gradient(135deg,#4f46e5,#22d3ee)'
                      : 'rgba(15,23,42,0.9)',
                  border: '1px solid rgba(148,163,184,0.5)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 2,
                  boxSizing: 'border-box',
                  transition: 'background 160ms ease, border-color 160ms ease',
                }}
              >
                <span
                  style={{
                    position: 'relative',
                    width: 16,
                    height: 16,
                    borderRadius: '999px',
                    background: '#0b0615',
                    boxShadow:
                      '0 0 0 1px rgba(148,163,184,0.6), 0 0 10px rgba(129,140,248,0.7)',
                    transform:
                      backgroundMode === 'live'
                        ? 'translateX(0)'
                        : 'translateX(20px)',
                    transition: 'transform 160ms ease',
                  }}
                />
              </span>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {backgroundMode === 'live' ? 'Live' : 'Static'}
              </span>
            </button>
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(prev => !prev)}
                style={{
                  background: 'none', border: '1px solid rgba(167,139,250,0.12)',
                  color: 'rgba(167,139,250,0.65)', borderRadius: 9,
                  padding: '7px 9px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', position: 'relative',
                  transition: 'all 200ms ease',
                }}
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 5, right: 5,
                    minWidth: 16, height: 16,
                    borderRadius: 999,
                    padding: '0 5px',
                    background: 'rgba(167,139,250,0.95)',
                    color: '#0b0615',
                    fontSize: 10.5,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 10px rgba(167,139,250,0.65)',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div style={{
                  position: 'absolute',
                  top: 44,
                  right: 0,
                  width: 360,
                  maxWidth: 'calc(100vw - 24px)',
                  background: 'rgba(4,3,12,0.88)',
                  border: '1px solid rgba(167,139,250,0.14)',
                  borderRadius: 14,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(22px)',
                  WebkitBackdropFilter: 'blur(22px)',
                  overflow: 'hidden',
                  zIndex: 50,
                }}>
                  <div style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(167,139,250,0.10)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-1)', fontSize: 13 }}>
                      Notifications
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => markAllVisibleUnreadRead()}
                          style={{
                            background: 'rgba(167,139,250,0.12)',
                            border: '1px solid rgba(167,139,250,0.2)',
                            color: 'rgba(196,181,253,0.95)',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => setNotifOpen(false)}
                        style={{ background: 'none', border: 'none', color: 'rgba(107,114,128,0.8)', cursor: 'pointer', padding: 4 }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                    {notificationsError ? (
                      <div style={{ padding: 18, color: 'var(--text-2)', fontSize: 12.5 }}>
                        Couldn&apos;t load notifications. Try again later.
                      </div>
                    ) : notificationsFetching && (notifications ?? []).length === 0 ? (
                      <div style={{ padding: 18, color: 'var(--text-2)', fontSize: 12.5 }}>
                        Loading…
                      </div>
                    ) : (notifications ?? []).length === 0 ? (
                      <div style={{ padding: 18, color: 'var(--text-2)', fontSize: 12.5 }}>
                        No notifications yet.
                      </div>
                    ) : (
                      (notifications ?? []).map((n: Notification) => {
                        const href = notificationHref(n)
                        const isModInvite = n.notification_type === 'moderator_invite'
                        const inviteId = isModInvite ? inviteIdByCommunityId[n.entity_id] : null
                        const hasInviteActions = isModInvite && inviteId
                        const isClickable = href && !hasInviteActions
                        const rowStyle = {
                          padding: '12px 14px',
                          borderBottom: '1px solid rgba(167,139,250,0.08)',
                          background: n.is_read ? 'transparent' : 'rgba(110,86,207,0.10)',
                          textDecoration: 'none' as const,
                          color: 'inherit' as const,
                          display: 'block' as const,
                          cursor: isClickable ? 'pointer' : 'default',
                        }
                        const inner = (
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{
                              width: 10, height: 10, borderRadius: 999,
                              marginTop: 5,
                              background: n.is_read ? 'rgba(107,114,128,0.25)' : 'rgba(167,139,250,0.95)',
                              boxShadow: n.is_read ? 'none' : '0 0 10px rgba(167,139,250,0.55)',
                              flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'var(--text-1)', fontSize: 12.5, lineHeight: 1.35 }}>
                                {hasInviteActions && n.entity_slug ? (
                                  <Link
                                    to={`/c/${n.entity_slug}`}
                                    onClick={() => {
                                      markSingleAsRead(n.id)
                                      setNotifOpen(false)
                                    }}
                                    style={{ color: 'inherit', textDecoration: 'none' }}
                                  >
                                    {n.message}
                                  </Link>
                                ) : (
                                  n.message
                                )}
                              </div>
                              <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                                {new Date(n.created_at).toLocaleString()}
                              </div>
                              {hasInviteActions && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); acceptInviteMutation.mutate(inviteId) }}
                                    disabled={acceptInviteMutation.isPending}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      border: '1px solid rgba(34,197,94,0.5)',
                                      background: 'rgba(34,197,94,0.15)',
                                      color: '#86efac',
                                      cursor: acceptInviteMutation.isPending ? 'wait' : 'pointer',
                                    }}
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); rejectInviteMutation.mutate(inviteId) }}
                                    disabled={rejectInviteMutation.isPending}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      border: '1px solid rgba(248,113,113,0.4)',
                                      background: 'rgba(248,113,113,0.1)',
                                      color: '#fca5a5',
                                      cursor: rejectInviteMutation.isPending ? 'wait' : 'pointer',
                                    }}
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                        return isClickable && href ? (
                          <Link
                            key={n.id}
                            to={href}
                            onClick={() => {
                              markSingleAsRead(n.id)
                              setNotifOpen(false)
                            }}
                            style={rowStyle}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div key={n.id} style={rowStyle}>
                            {inner}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </header>

      {/* Main content */}
      <main style={{
        marginLeft: SIDEBAR_W,
        paddingTop: 56,
        minHeight: '100vh',
        position: 'relative', zIndex: 10,
        transition: 'margin-left 280ms cubic-bezier(0.16,1,0.3,1)',
        overflowX: 'hidden',
      }}>
        {children}
      </main>

      {/* Mobile overlay */}
      <style>{`
        @media (max-width: 768px) {
          .shell-sidebar { width: 220px !important; transform: translateX(-100%); transition: transform 280ms ease !important; }
          .shell-sidebar.mobile-open { transform: translateX(0); }
          main { margin-left: 0 !important; }
          header { left: 0 !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </>
  )
}
