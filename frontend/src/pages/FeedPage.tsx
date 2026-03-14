import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { promptsApi } from '../api'
import { PromptCard } from '../components/prompts/PromptCard'
import { Sparkles, TrendingUp, Clock, BookOpen } from 'lucide-react'
import type { PromptCard as PromptCardType } from '../types'

export default function FeedPage() {
  const [prompts, setPrompts] = useState<PromptCardType[]>([])
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
              <div key={i} className="skeleton-prompt-card theme-card" style={{ minHeight: 280 }} />
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
              <div key={p.id} className="fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <PromptCard prompt={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
