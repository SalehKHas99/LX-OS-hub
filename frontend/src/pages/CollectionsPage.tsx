import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collectionsApi } from '../api'
import { useAuthStore } from '../store'
import { BookMarked, Plus } from 'lucide-react'
import { SkeletonCollectionList } from '../components/ui/Skeleton'
import toast from 'react-hot-toast'

export default function CollectionsPage() {
  const { isAuthenticated } = useAuthStore()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionsApi.mine().then(r => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000, // list changes infrequently
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      await collectionsApi.create({ title: newTitle, description: newDesc || null })
      toast.success('Collection created')
      setNewTitle(''); setNewDesc(''); setCreating(false)
      qc.invalidateQueries({ queryKey: ['collections'] })
    } catch {
      toast.error('Failed to create collection')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="page-container page-container-sm empty-state">
        <BookMarked size={40} style={{ color: 'var(--text-3)', opacity: 0.3 }} className="empty-state-icon" />
        <p className="section-title" style={{ fontSize: '1.25rem', marginBottom: 8 }}>Sign in to view collections</p>
      </div>
    )
  }

  return (
    <div className="page-container page-container-sm" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="section-title" style={{ marginBottom: 4 }}>Collections</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, fontFamily: 'var(--font-body)' }}>
            Save and organize prompts into themed folders
          </p>
        </div>
        <button type="button" onClick={() => setCreating(c => !c)} className="btn btn-primary" style={{ fontSize: 13 }}>
          <Plus size={14} /> New Collection
        </button>
      </div>

      {creating && (
        <div className="card theme-card card-padding animate-slide-up" style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Collection Name</label>
              <input className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Cyberpunk Aesthetics" required />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description..." />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" style={{ fontSize: 13 }}>Create</button>
              <button type="button" onClick={() => setCreating(false)} className="btn btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <SkeletonCollectionList count={6} />
      ) : (data ?? []).length === 0 ? (
        <div className="empty-state">
          <BookMarked size={40} style={{ color: 'var(--text-3)', opacity: 0.3 }} className="empty-state-icon" />
          <p className="section-title" style={{ marginBottom: 4 }}>No collections yet</p>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>Create one to start organizing prompts</p>
        </div>
      ) : (
        <div className="prompts-grid">
          {(data ?? []).map((c) => (
            <div key={c.id} className="card-hover card-padding">
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(110,86,207,0.15)',
                border: '1px solid rgba(167,139,250,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
                color: 'var(--nebula-soft)',
              }}>
                <BookMarked size={16} />
              </div>
              <h3 className="section-title" style={{ fontSize: '1rem', marginBottom: 4 }}>{c.title}</h3>
              {c.description && (
                <p style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-body)' }} className="line-clamp-2">{c.description}</p>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 12 }}>
                {new Date(c.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
