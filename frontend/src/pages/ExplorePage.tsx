import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { searchApi, type SearchSuggestResult } from '../api'
import { PromptCard } from '../components/prompts/PromptCard'
import { Search, SlidersHorizontal, X, User, Users, FileText } from 'lucide-react'
import type { PromptCard as PromptCardType } from '../types'

const MODELS = ['All', 'Midjourney', 'DALL·E', 'Flux', 'Stable Diffusion', 'ComfyUI']
const SUGGEST_DEBOUNCE_MS = 280

export default function ExplorePage() {
  const [prompts, setPrompts] = useState<PromptCardType[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [model, setModel] = useState('All')
  const [tag, setTag] = useState('') // tag slug (exact match)
  const [filterOpen, setFilterOpen] = useState(false)
  const [suggest, setSuggest] = useState<SearchSuggestResult | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const suggestRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!query.trim()) { setSuggest(null); setSuggestOpen(false); setSuggestLoading(false); return }
    setSuggestLoading(true)
    const t = setTimeout(() => {
      searchApi.suggest(query.trim())
        .then((r) => {
          setSuggest(r.data)
          setSuggestOpen(true)
        })
        .catch(() => setSuggest(null))
        .finally(() => setSuggestLoading(false))
    }, SUGGEST_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) setSuggestOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header fade-up">
        <h1 className="page-title">Search</h1>
        <p className="page-subtitle">Search prompts and filter by model + tag</p>
      </div>

      <div className="page-content" style={{ paddingTop: 0 }}>
        {/* Search bar: input + dropdown live in same wrapper so dropdown aligns under input only */}
        <div className="fade-up fade-up-1" style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
          <div ref={suggestRef} style={{ flex: 1, position: 'relative' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(167,139,250,0.14)',
              borderRadius: 12, padding: '0 16px', height: 44,
              backdropFilter: 'blur(12px)',
            }}>
              <Search size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => query.trim() && (suggest !== null || suggestLoading) && setSuggestOpen(true)}
                onKeyDown={e => e.key === 'Enter' && (search(), setSuggestOpen(false))}
                placeholder="Search prompts, users, communities…"
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-1)', fontFamily: 'var(--font-body)',
                  fontSize: 13.5, width: '100%',
                }}
              />
              {query && <button type="button" onClick={() => { setQuery(''); setSuggest(null); setSuggestOpen(false); search() }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>}
            </div>
            {/* Dropdown only when query is non-empty; show results, loading, or "no results" */}
            {suggestOpen && query.trim() && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: 'rgba(15,23,42,0.98)',
                border: '1px solid rgba(167,139,250,0.2)',
                borderRadius: 12,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                maxHeight: 320,
                overflowY: 'auto',
                zIndex: 50,
              }}>
                {suggestLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Searching…</div>
                ) : suggest && (suggest.prompts.length > 0 || suggest.users.length > 0 || suggest.communities.length > 0) ? (
                  <>
                    {suggest.prompts.length > 0 && (
                      <div style={{ padding: '6px 0' }}>
                        <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prompts</div>
                        {suggest.prompts.slice(0, 5).map((p) => (
                          <Link key={p.id} to={`/prompt/${p.id}`} onClick={() => setSuggestOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', color: 'var(--text-1)', textDecoration: 'none', fontSize: 13, borderRadius: 8, margin: '0 6px' }} className="link-hover-underline" onMouseDown={(e) => e.preventDefault()}>
                            <FileText size={16} style={{ color: 'var(--nebula-soft)', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                    {suggest.users.length > 0 && (
                      <div style={{ padding: '6px 0' }}>
                        <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Users</div>
                        {suggest.users.slice(0, 5).map((u) => (
                          <Link key={u.id} to={`/u/${u.username}`} onClick={() => setSuggestOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', color: 'var(--text-1)', textDecoration: 'none', fontSize: 13, borderRadius: 8, margin: '0 6px' }} className="link-hover-underline" onMouseDown={(e) => e.preventDefault()}>
                            <User size={16} style={{ color: 'var(--nebula-soft)', flexShrink: 0 }} />
                            <span>{u.username}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                    {suggest.communities.length > 0 && (
                      <div style={{ padding: '6px 0 10px' }}>
                        <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Communities</div>
                        {suggest.communities.slice(0, 5).map((c) => (
                          <Link key={c.id} to={`/c/${c.slug}`} onClick={() => setSuggestOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', color: 'var(--text-1)', textDecoration: 'none', fontSize: 13, borderRadius: 8, margin: '0 6px' }} className="link-hover-underline" onMouseDown={(e) => e.preventDefault()}>
                            <Users size={16} style={{ color: 'var(--nebula-soft)', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: 16, color: 'var(--text-3)', fontSize: 13 }}>No results for “{query.trim()}”</div>
                )}
              </div>
            )}
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
              <div key={i} className="skeleton-prompt-card theme-card" style={{ minHeight: 260 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
            {prompts.map((p, i) => (
              <div key={p.id} className="fade-up" style={{ animationDelay: `${i * 35}ms` }}>
                <PromptCard prompt={p} />
              </div>
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
