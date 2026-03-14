import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { friendsApi } from '../api'
import { useAuthStore } from '../store'
import { UserPlus, Users, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Friend } from '../types'

export default function FriendsPage() {
  const { isAuthenticated } = useAuthStore()
  const qc = useQueryClient()

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.list().then((r) => r.data),
    enabled: !!isAuthenticated,
  })

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['friends', 'requests'],
    queryFn: () => friendsApi.listRequests().then((r) => r.data),
    enabled: !!isAuthenticated,
  })

  const sendRequestMutation = useMutation({
    mutationFn: (addresseeId: string) => friendsApi.sendRequest(addresseeId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['friends'] })
      toast.success(data?.message ?? 'Request sent')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      toast.error(e?.response?.data?.detail ?? 'Failed to send request')
    },
  })

  const acceptMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.accept(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] })
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] })
      toast.success('Friend added')
    },
    onError: () => toast.error('Failed to accept'),
  })

  const declineMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.decline(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] })
      toast.success('Request declined')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.remove(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] })
      toast.success('Friend removed')
    },
  })

  if (!isAuthenticated) {
    return (
      <div className="page-container page-content">
        <div className="empty-state theme-card card-padding" style={{ maxWidth: 420, margin: '0 auto' }}>
          <Users size={48} style={{ color: 'var(--text-3)' }} />
          <h2 className="page-title" style={{ marginTop: 16, marginBottom: 8 }}>Friends</h2>
          <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>Sign in to manage friends.</p>
          <Link to="/login" className="btn btn-primary">Sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container page-content" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="page-title">Friends</h1>
        <p className="page-subtitle">Manage friend requests and your friend list.</p>
      </div>

      <div className="theme-card shimmer-top card-padding" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={18} /> Add friend
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
          Go to a creator&apos;s profile and click <strong>Add friend</strong> to send a request. They can accept from their Friends or Messages requests.
        </p>
      </div>

      {requests.length > 0 && (
        <section className="theme-card shimmer-top card-padding" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={18} /> Incoming requests ({requests.length})
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map((r) => (
              <li
                key={r.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(167,139,250,0.08)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                }}
              >
                <Link to={`/u/${r.username}`} style={{ fontWeight: 600, color: 'var(--text-1)', textDecoration: 'none' }} className="link-hover-underline">
                  {r.username}
                </Link>
                <span style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => declineMutation.mutate(r.user_id)}
                    disabled={declineMutation.isPending}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 12 }}
                    onClick={() => acceptMutation.mutate(r.user_id)}
                    disabled={acceptMutation.isPending}
                  >
                    Accept
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="theme-card shimmer-top card-padding">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} /> Your friends ({friends.length})
        </h2>
        {loadingFriends ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton skeleton-line medium" style={{ height: 48, borderRadius: 12 }} />
            ))}
          </div>
        ) : friends.length === 0 ? (
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>No friends yet. Send requests from creator profiles.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {friends.map((f) => (
              <li
                key={f.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                }}
              >
                <Link to={`/u/${f.username}`} style={{ fontWeight: 600, color: 'var(--text-1)', textDecoration: 'none' }} className="link-hover-underline">
                  {f.username}
                </Link>
                <Link to={`/messages?with=${f.user_id}`} className="btn btn-ghost" style={{ fontSize: 12 }}>Message</Link>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: 'var(--text-3)' }}
                  onClick={() => removeMutation.mutate(f.user_id)}
                  disabled={removeMutation.isPending}
                  title="Remove friend"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
