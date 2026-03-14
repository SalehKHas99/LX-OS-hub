import { ChevronUp, ChevronDown } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'

interface VoteButtonsProps {
  /** Net score to display */
  score: number
  /** Current user's vote: 1, -1, or null */
  currentUserVote: number | null | undefined
  /** Called with 1 or -1 to vote; called with null to remove vote */
  onVote: (value: 1 | -1 | null) => Promise<void>
  /** Optional: invalidate these query keys after vote */
  invalidateKeys?: (string | string[])[]
  /** Compact style for comments */
  compact?: boolean
  /** Optional className */
  className?: string
  /** Optional inline style for wrapper */
  style?: React.CSSProperties
  /** Stop click propagation (e.g. when inside a Link) */
  stopPropagation?: boolean
}

export function VoteButtons({
  score,
  currentUserVote,
  onVote,
  invalidateKeys = [],
  compact = false,
  className = '',
  style: wrapperStyle,
  stopPropagation = false,
}: VoteButtonsProps) {
  const { isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()
  const size = compact ? 14 : 18
  const gap = compact ? 2 : 4

  const handleClick = async (value: 1 | -1) => {
    if (!isAuthenticated) {
      toast.error('Sign in to vote')
      return
    }
    const next = currentUserVote === value ? null : value
    try {
      await onVote(next === null ? null : (next as 1 | -1))
      invalidateKeys.forEach(key =>
        queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] })
      )
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Failed to vote')
    }
  }

  const wrap = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation()
  }

  return (
    <div
      className={className}
      onClick={wrap}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        flexDirection: 'column',
        ...wrapperStyle,
      }}
    >
      <button
        type="button"
        aria-label="Upvote"
        onClick={(e) => { wrap(e); handleClick(1) }}
        style={{
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: isAuthenticated ? 'pointer' : 'default',
          color: currentUserVote === 1 ? 'var(--accent)' : 'var(--text-3)',
        }}
      >
        <ChevronUp size={size} strokeWidth={2.5} />
      </button>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: compact ? 11 : 12, color: 'var(--text-2)' }}>
        {score}
      </span>
      <button
        type="button"
        aria-label="Downvote"
        onClick={(e) => { wrap(e); handleClick(-1) }}
        style={{
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: isAuthenticated ? 'pointer' : 'default',
          color: currentUserVote === -1 ? 'var(--accent)' : 'var(--text-3)',
        }}
      >
        <ChevronDown size={size} strokeWidth={2.5} />
      </button>
    </div>
  )
}
