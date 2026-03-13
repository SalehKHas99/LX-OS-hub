import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collectionsApi } from '../api'
import { useAuthStore } from '../store'
import { BookMarked, Plus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

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

  if (!isAuthenticated) return (
    <div className="max-w-2xl mx-auto text-center py-32">
      <BookMarked size={40} className="mx-auto mb-4 text-ink-muted opacity-30" />
      <p className="font-display text-xl text-ink-primary mb-2">Sign in to view collections</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title mb-1">Collections</h1>
          <p className="text-ink-secondary text-sm font-body">Save and organize prompts into themed folders</p>
        </div>
        <button onClick={() => setCreating(c => !c)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={14} /> New Collection
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="card p-5 mb-6 animate-slide-up">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Collection Name</label>
              <input className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Cyberpunk Aesthetics" required />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description..." />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary text-sm">Create</button>
              <button type="button" onClick={() => setCreating(false)} className="btn-ghost text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-xenon-500" size={28} />
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="text-center py-20">
          <BookMarked size={40} className="mx-auto mb-3 text-ink-muted opacity-30" />
          <p className="font-display text-ink-primary mb-1">No collections yet</p>
          <p className="text-sm text-ink-secondary">Create one to start organizing prompts</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data ?? []).map(c => (
            <div key={c.id} className="card-hover p-5">
              <div className="w-10 h-10 rounded-xl bg-xenon-900/40 border border-xenon-800/30 flex items-center justify-center mb-3">
                <BookMarked size={16} className="text-xenon-500" />
              </div>
              <h3 className="font-display font-semibold text-ink-primary mb-1">{c.title}</h3>
              {c.description && (
                <p className="text-xs text-ink-secondary font-body line-clamp-2">{c.description}</p>
              )}
              <p className="text-xs text-ink-muted font-mono mt-3">
                {new Date(c.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
