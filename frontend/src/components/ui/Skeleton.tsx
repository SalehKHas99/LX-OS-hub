/**
 * Unified skeleton loading placeholders.
 * Use CSS classes from index.css: skeleton-prompt-card, skeleton-line, skeleton-avatar, etc.
 */

export function SkeletonCard({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton-prompt-card theme-card ${className}`.trim()} style={style} />
}

export function SkeletonLine({ width = 'long', style }: { width?: 'short' | 'medium' | 'long'; style?: React.CSSProperties }) {
  return <div className={`skeleton skeleton-line ${width}`} style={style} />
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return <div className={`skeleton-avatar ${size === 'lg' ? 'lg' : ''}`.trim()} />
}

/** Profile header skeleton: avatar + lines */
export function SkeletonProfileHeader() {
  return (
    <div className="theme-card shimmer-top card-padding" style={{ marginBottom: 28 }}>
      <div className="profile-header-card" style={{ alignItems: 'flex-start', gap: 24 }}>
        <SkeletonAvatar size="lg" />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SkeletonLine width="medium" style={{ height: 28, borderRadius: 8 }} />
          <div style={{ display: 'flex', gap: 16 }}>
            <SkeletonLine width="short" />
            <SkeletonLine width="short" />
          </div>
          <SkeletonLine width="long" />
          <SkeletonLine width="long" />
        </div>
      </div>
    </div>
  )
}

/** Grid of skeleton prompt cards */
export function SkeletonPromptGrid({ count = 6, cardMinHeight = 280 }: { count?: number; cardMinHeight?: number }) {
  return (
    <div className="prompts-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-prompt-card theme-card" style={{ minHeight: cardMinHeight }} />
      ))}
    </div>
  )
}

/** Two-column detail layout (e.g. prompt detail, collection detail) */
export function SkeletonDetailLayout() {
  return (
    <div className="page-container page-container-lg" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <SkeletonLine width="short" style={{ height: 14 }} />
        <SkeletonLine width="short" style={{ height: 14, width: 14 }} />
        <SkeletonLine width="medium" style={{ height: 14 }} />
      </div>
      <div className="detail-grid" style={{ gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton theme-card" style={{ aspectRatio: '4/3', borderRadius: 16, minHeight: 320 }} />
          <div className="skeleton theme-card card-padding" style={{ borderRadius: 16 }}>
            <SkeletonLine width="long" style={{ marginBottom: 12 }} />
            <SkeletonLine width="long" style={{ marginBottom: 8 }} />
            <SkeletonLine width="medium" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton theme-card card-padding" style={{ borderRadius: 16 }}>
            <SkeletonLine width="long" style={{ height: 24, marginBottom: 16 }} />
            <SkeletonLine width="medium" style={{ marginBottom: 12 }} />
            <SkeletonLine width="long" style={{ marginBottom: 12 }} />
            <SkeletonLine width="short" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** List of skeleton collection cards (icon + lines) */
export function SkeletonCollectionList({ count = 4 }: { count?: number }) {
  return (
    <div className="prompts-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="theme-card card-padding card-hover" style={{ padding: '1.25rem' }}>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 12 }} />
          <SkeletonLine width="long" style={{ marginBottom: 8 }} />
          <SkeletonLine width="medium" style={{ height: 12 }} />
        </div>
      ))}
    </div>
  )
}
