import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { searchApi } from '../api'
import { Search, SlidersHorizontal, X } from 'lucide-react'

const MODELS = ['All', 'Midjourney', 'DALL·E', 'Flux', 'Stable Diffusion', 'ComfyUI']

export default function ExplorePage() {
  const [prompts, setPrompts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [model, setModel] = useState('All')
  const [tag, setTag] = useState('') // tag slug (exact match)
  const [filterOpen, setFilterOpen] = useState(false)

  const search = async () => {
    setLoading(true)
    try {
      const params: { q?: string; model?: string; tag?: string; sort?: string; page?: number } = { page: 1 }
      if (query) params.q = query
      if (model !== 'All') params.model = model
      if (tag.trim()) params.tag = tag.trim().toLowerCase()
      const { data } = await searchApi.search(params)
      setPrompts(data?.items ?? [])
    } catch { setPrompts([]) }
    setLoading(false)
  }

  useEffect(() => { search() }, [model])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header fade-up">
        <h1 className="page-title">Search</h1>
        <p className="page-subtitle">Search prompts and filter by model + tag</p>
      </div>

      <div className="page-content" style={{ paddingTop: 0 }}>
        {/* Search bar */}
        <div className="fade-up fade-up-1" style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(167,139,250,0.14)',
            borderRadius: 12, padding: '0 16px', height: 44,
            backdropFilter: 'blur(12px)',
          }}>
            <Search size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Search prompts, tags, subjects…"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-1)', fontFamily: 'var(--font-body)',
                fontSize: 13.5, width: '100%',
              }}
            />
            {query && <button onClick={() => { setQuery(''); search() }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>}
          </div>
          <button onClick={() => setFilterOpen(o => !o)} className={`btn ${filterOpen ? 'btn-primary' : 'btn-ghost'}`} style={{ gap: 6, height: 44, paddingLeft: 14, paddingRight: 14 }}>
            <SlidersHorizontal size={15} />
            Filters
          </button>
          <button onClick={search} className="btn btn-primary" style={{ height: 44, paddingLeft: 20, paddingRight: 20 }}>
            Search
          </button>
        </div>

        {/* Filter chips */}
        {filterOpen && (
          <div className="theme-card shimmer-top fade-up" style={{ padding: '18px 20px', marginBottom: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <div className="label">Model</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {MODELS.map(m => (
                  <button key={m} onClick={() => setModel(m)} style={{
                    padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                    fontSize: 12, fontFamily: 'var(--font-body)',
                    background: model === m ? 'rgba(110,86,207,0.28)' : 'rgba(255,255,255,0.04)',
                    color: model === m ? 'var(--nebula-soft)' : 'var(--text-3)',
                    border: model === m ? '1px solid rgba(167,139,250,0.30)' : '1px solid rgba(167,139,250,0.08)',
                    transition: 'all 180ms ease',
                  }}>{m}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="label">Tag (slug)</div>
              <input
                className="input"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. cyberpunk, portrait, neon-noir"
                style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
              />
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
                Matches exact tag slug.
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="theme-card" style={{ height: 260, opacity: 0.4 + i * 0.04 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
            {prompts.map((p, i) => (
              <Link key={p.id} to={`/prompt/${p.id}`} className="art-card fade-up"
                style={{ height: 260, animationDelay: `${i * 35}ms`, textDecoration: 'none' }}>
                {p.images?.[0]?.image_url
                  ? <img src={p.images[0].image_url} alt={p.title} className="card-img" />
                  : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg,hsl(${260+i*15},55%,10%),hsl(${245+i*18},65%,7%))` }} />
                }
                <div className="card-overlay" />
                <div className="card-body">
                  <span className="badge" style={{ fontSize: 9, padding: '2px 7px', marginBottom: 5, display: 'inline-flex' }}>{p.model_family ?? 'General'}</span>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#f8fafc', lineHeight: 1.3,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {p.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && prompts.length === 0 && (
          <div className="theme-card" style={{ padding: '50px 40px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>No prompts found. Try different keywords.</p>
          </div>
        )}
      </div>
    </div>
  )
}
