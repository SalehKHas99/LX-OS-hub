import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { communitiesApi } from '../api'
import { Users, Plus, Search } from 'lucide-react'
import { useAuthStore } from '../store'

export default function CommunitiesPage() {
  const [query, setQuery] = useState('')
  const { isAuthenticated } = useAuthStore()

  const { data: communities = [], isLoading: loading } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return communities
    return communities.filter((c) => {
      const title = (c.title ?? '').toLowerCase()
      const slug = (c.slug ?? '').toLowerCase()
      const desc = (c.description ?? '').toLowerCase()
      return title.includes(q) || slug.includes(q) || desc.includes(q)
    })
  }, [communities, query])

  return (
    <div
      style={{
        maxWidth: 960,
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* header */}
      <div
        style={{
          paddingTop: 20,
          paddingBottom: 18,
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: 6,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-1)',
            fontFamily: 'var(--font-display)',
          }}
        >
          Communities
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--text-2)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Join spaces built around models, styles, and creative niches
        </p>
      </div>

      {/* search + new community */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            height: 46,
            borderRadius: 999,
            border: '1px solid rgba(167,139,250,0.25)',
            background: 'rgba(15,23,42,0.78)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Search size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search communities…"
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text-1)',
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              width: '100%',
            }}
          />
        </div>
        {isAuthenticated && (
          <Link
            to="/communities/new"
            style={{
              height: 46,
              padding: '0 18px',
              borderRadius: 999,
              border: '1px solid rgba(167,139,250,0.9)',
              background:
                'radial-gradient(circle at top left, rgba(129,140,248,0.55), rgba(56,189,248,0.35))',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              color: '#ffffff',
              textDecoration: 'none',
              boxShadow: '0 0 24px rgba(110,86,207,0.45)',
            }}
          >
            <Plus size={15} /> New Community
          </Link>
        )}
      </div>

      {/* content */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 96,
                borderRadius: 18,
                border: '1px solid rgba(148,163,184,0.4)',
                background: 'rgba(15,23,42,0.8)',
                opacity: 0.4,
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: '56px 40px',
            borderRadius: 24,
            border: '1px solid rgba(148,163,184,0.5)',
            background: 'rgba(15,23,42,0.9)',
            textAlign: 'center',
          }}
        >
          <Users
            size={36}
            style={{
              color: 'var(--nebula-glow)',
              opacity: 0.45,
              margin: '0 auto 16px',
              display: 'block',
            }}
          />
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text-1)',
              margin: '0 0 8px',
            }}
          >
            No communities yet
          </h3>
          <p
            style={{
              margin: '0 0 20px',
              color: 'var(--text-2)',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
            }}
          >
            Start the first one and grow your niche.
          </p>
          {isAuthenticated && (
            <Link
              to="/communities/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 18px',
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
              Create a Community
            </Link>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {filtered.map((c, i) => (
            <Link
              key={c.id}
              to={`/c/${c.slug}`}
              style={{
                position: 'relative',
                display: 'block',
                padding: '18px 20px',
                borderRadius: 18,
                border: '1px solid rgba(15,23,42,0.85)',
                background:
                  'radial-gradient(circle at top left, rgba(15,23,42,0.9), rgba(15,23,42,0.85))',
                textDecoration: 'none',
                boxShadow: '0 16px 60px rgba(15,23,42,0.75)',
                transform: 'translateY(0)',
                overflow: 'hidden',
                transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
              }}
            >
              {c.avatar_url && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${c.avatar_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.32,
                    filter: 'blur(14px)',
                    transform: 'scale(1.1)',
                    pointerEvents: 'none',
                  }}
                />
              )}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: c.avatar_url
                      ? 'rgba(15,23,42,0.9)'
                      : `linear-gradient(135deg,hsl(${260 + i * 25},60%,30%),hsl(${245 + i * 20},70%,18%))`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontFamily: 'var(--font-display)',
                    color: '#E5E7EB',
                    overflow: 'hidden',
                  }}
                >
                  {c.avatar_url ? (
                    <img
                      src={c.avatar_url}
                      alt={c.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    c.title?.[0]?.toUpperCase() ?? '?'
                  )}
                </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 15,
                          color: 'var(--text-1)',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.title}
                      </div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          background:
                            c.visibility === 'restricted'
                              ? 'rgba(251, 191, 36, 0.14)'
                              : 'rgba(34,197,94,0.14)',
                          color:
                            c.visibility === 'restricted'
                              ? '#facc15'
                              : '#6ee7b7',
                          border:
                            c.visibility === 'restricted'
                              ? '1px solid rgba(250,204,21,0.5)'
                              : '1px solid rgba(16,185,129,0.5)',
                        }}
                      >
                        {c.visibility === 'restricted' ? 'Restricted' : 'Public'}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--nebula-glow)',
                        fontFamily: 'var(--font-mono)',
                        marginBottom: 6,
                        textShadow: '0 0 8px rgba(0,0,0,0.9)',
                      }}
                    >
                      c/{c.slug}
                      {typeof c.member_count === 'number' && (
                        <span style={{ marginLeft: 8, color: 'var(--text-3)', fontWeight: 500 }}>
                          · {c.member_count} member{c.member_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  {c.description && (
                    <p
                      style={{
                        fontSize: 12.5,
                        color: 'var(--text-2)',
                        lineHeight: 1.5,
                        margin: 0,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as any,
                        textShadow: '0 0 8px rgba(0,0,0,0.9)',
                      }}
                    >
                      {c.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
