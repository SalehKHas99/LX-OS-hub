import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { promptsApi } from '../api'
import { Sparkles, TrendingUp, Clock, BookOpen } from 'lucide-react'

interface Prompt { id: string; title: string; model_family?: string | null; creator?: { username: string }; images?: { image_url: string }[] }

export default function FeedPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('trending')

  useEffect(() => {
    promptsApi.feed(1, tab)
      .then(({ data }) => setPrompts(data?.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header fade-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div className="badge">
            <svg width="6" height="6" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#a78bfa"/></svg>
            Live
          </div>
        </div>
        <h1 className="page-title">Explore</h1>
        <p className="page-subtitle">Discover and remix the best AI art prompts.</p>
      </div>

      {/* Tabs */}
      <div className="page-content" style={{ paddingTop: 0 }}>
        <div className="tab-group fade-up fade-up-1" style={{ marginBottom: 24 }}>
          {[
            { id: 'trending', icon: TrendingUp, label: 'Trending' },
            { id: 'recent',   icon: Clock,      label: 'Recent' },
            { id: 'featured', icon: Sparkles,   label: 'Featured' },
            { id: 'guides',   icon: BookOpen,   label: 'Guides' },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} className={`tab-item ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="theme-card" style={{ height: 280, borderRadius: 16, opacity: 0.5 + i * 0.06 }}>
                <div style={{ height: '100%', background: 'linear-gradient(135deg,rgba(110,86,207,0.08),rgba(67,56,202,0.04))', borderRadius: 16 }} />
              </div>
            ))}
          </div>
        ) : prompts.length === 0 ? (
          <div className="theme-card shimmer-top fade-up" style={{ padding: '60px 40px', textAlign: 'center' }}>
            <Sparkles size={36} style={{ color: 'var(--nebula-glow)', opacity: 0.5, margin: '0 auto 16px' }} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>No prompts yet</h3>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>Be the first to share a prompt.</p>
            <Link to="/submit" className="btn btn-primary" style={{ display: 'inline-flex' }}>Submit a Prompt</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
            {prompts.map((p, i) => (
              <Link key={p.id} to={`/prompt/${p.id}`} className="art-card fade-up"
                style={{ height: 280, animationDelay: `${i * 40}ms`, textDecoration: 'none' }}>
                {p.images?.[0]?.image_url
                  ? <img src={p.images[0].image_url} alt={p.title} className="card-img" />
                  : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, hsl(${260 + i * 18},60%,12%), hsl(${240 + i * 22},70%,8%))` }} />
                }
                <div className="card-overlay" />
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span className="badge" style={{ fontSize: 9.5, padding: '2px 7px' }}>{p.model_family ?? 'General'}</span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: '#f8fafc', marginBottom: 4, lineHeight: 1.3,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {p.title}
                  </p>
                  {p.creator && (
                    <span style={{ fontSize: 11, color: 'rgba(196,181,253,0.7)', fontFamily: 'var(--font-body)' }}>
                      by {p.creator.username}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
