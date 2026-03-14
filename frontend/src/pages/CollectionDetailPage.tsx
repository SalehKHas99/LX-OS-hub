import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { collectionsApi } from '../api'
import { PromptCard } from '../components/prompts/PromptCard'
import { BookMarked, ArrowLeft } from 'lucide-react'
import { SkeletonDetailLayout } from '../components/ui/Skeleton'

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: collection, isLoading, error } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => collectionsApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  if (isLoading) {
    return <SkeletonDetailLayout />
  }

  if (error || !collection) {
    return (
      <div className="page-container page-header">
        <h1 className="page-title">Collection not found</h1>
        <p className="page-subtitle" style={{ marginBottom: 16 }}>This collection doesn&apos;t exist or was removed.</p>
        <Link to="/collections" className="page-header-breadcrumb">
          <ArrowLeft size={12} /> Collections
        </Link>
      </div>
    )
  }

  return (
    <div className="page-container page-container-sm" style={{ width: '100%' }}>
      <div className="page-header">
        <Link to="/collections" className="page-header-breadcrumb">
          <ArrowLeft size={12} /> Collections
        </Link>
        <h1 className="page-title">{collection.title}</h1>
        {collection.description ? <p className="page-subtitle">{collection.description}</p> : null}
      </div>

      <div className="page-content">
        {collection.prompts.length === 0 ? (
          <div className="empty-state">
            <BookMarked size={32} style={{ color: 'var(--text-2)' }} className="empty-state-icon" />
            <p className="section-title" style={{ fontSize: '1.125rem', marginBottom: 8 }}>No prompts in this collection</p>
            <p style={{ color: 'var(--text-2)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
              Save prompts from the feed or prompt pages to add them here.
            </p>
          </div>
        ) : (
          <div className="prompts-grid">
            {collection.prompts.map((p) => (
              <PromptCard key={p.id} prompt={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
