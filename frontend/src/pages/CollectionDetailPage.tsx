import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { collectionsApi } from '../api'
import { PromptCard } from '../components/prompts/PromptCard'
import { BookMarked, ArrowLeft, Loader2 } from 'lucide-react'

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: collection, isLoading, error } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => collectionsApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin" size={28} style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="page-header max-w-5xl mx-auto">
        <h1 className="page-title">Collection not found</h1>
        <p className="page-subtitle mb-4">This collection doesn&apos;t exist or was removed.</p>
        <Link to="/collections" className="page-header-breadcrumb">
          <ArrowLeft size={12} /> Collections
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="page-header">
        <Link to="/collections" className="page-header-breadcrumb">
          <ArrowLeft size={12} /> Collections
        </Link>
        <h1 className="page-title">{collection.title}</h1>
        {collection.description ? (
          <p className="page-subtitle">{collection.description}</p>
        ) : null}
      </div>

      <div className="page-content">
        {collection.prompts.length === 0 ? (
          <div className="text-center py-20">
            <BookMarked size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-2)' }} />
            <p className="page-title text-lg mb-2">No prompts in this collection</p>
            <p style={{ color: 'var(--text-2)', fontFamily: 'Nunito', fontSize: '0.875rem' }}>
              Save prompts from the feed or prompt pages to add them here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collection.prompts.map((p: any) => (
              <PromptCard key={p.id} prompt={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
