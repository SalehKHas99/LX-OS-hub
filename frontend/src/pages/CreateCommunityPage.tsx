import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { communitiesApi } from '../api'
import { ArrowLeft, Users, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CreateCommunityPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    rules: '',
    visibility: 'public',
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleTitleChange = (title: string) => {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setForm((f) => ({ ...f, title, slug }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.slug.trim()) {
      toast.error('Title and slug are required')
      return
    }
    setIsLoading(true)
    try {
      const { data } = await communitiesApi.create({
        title: form.title,
        slug: form.slug,
        description: form.description || null,
        rules: form.rules || null,
        visibility: form.visibility,
      })
      toast.success('Community created!')
      navigate(`/c/${data.slug}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create community')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      style={{
        maxWidth: 720,
        width: '100%',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          paddingTop: 20,
          paddingBottom: 18,
          marginBottom: 16,
        }}
      >
        <Link
          to="/communities"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'Outfit',
            color: 'var(--text-3)',
            marginBottom: 12,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={12} /> All Communities
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-muted)',
              border: '1.5px solid var(--border)',
            }}
          >
            <Users size={18} style={{ color: 'var(--accent-h)' }} />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--text-1)',
              }}
            >
              Create Community
            </h1>
            <p
              style={{
                margin: 0,
                marginTop: 4,
                fontSize: 14,
                color: 'var(--text-2)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Build a space for your niche.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          padding: 20,
          borderRadius: 18,
          border: '1px solid var(--border)',
          background: 'rgba(15,23,42,0.96)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Outfit',
              color: 'var(--text-1)',
            }}
          >
            Community Name *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g. Midjourney Realists"
            required
            maxLength={60}
            style={{
              width: '100%',
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.7)',
              background: 'rgba(15,23,42,0.95)',
              padding: '8px 10px',
              color: 'var(--text-1)',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Outfit',
              color: 'var(--text-1)',
            }}
          >
            URL Slug *
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                padding: '8px 10px',
                borderRadius: '10px 0 0 10px',
                border: '1px solid rgba(148,163,184,0.7)',
                borderRight: 'none',
                background: 'rgba(15,23,42,0.9)',
                color: 'var(--text-3)',
                fontFamily: 'JetBrains Mono',
                fontSize: 12,
              }}
            >
              c/
            </span>
            <input
              type="text"
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                }))
              }
              placeholder="midjourney-realists"
              required
              maxLength={50}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '0 10px 10px 0',
                border: '1px solid rgba(148,163,184,0.7)',
                borderLeft: 'none',
                background: 'rgba(15,23,42,0.95)',
                color: 'var(--text-1)',
                fontFamily: 'JetBrains Mono',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <p
            style={{
              marginTop: 6,
              fontSize: 11,
              color: 'var(--text-3)',
              fontFamily: 'Nunito',
            }}
          >
            Lowercase letters, numbers, and hyphens only. Cannot be changed later.
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Outfit',
              color: 'var(--text-1)',
            }}
          >
            Description
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="What is this community about?"
            maxLength={500}
            style={{
              width: '100%',
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.7)',
              background: 'rgba(15,23,42,0.95)',
              padding: '8px 10px',
              color: 'var(--text-1)',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              resize: 'none',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Outfit',
              color: 'var(--text-1)',
            }}
          >
            Rules
          </label>
          <textarea
            rows={4}
            value={form.rules}
            onChange={(e) =>
              setForm((f) => ({ ...f, rules: e.target.value }))
            }
            placeholder="Optional — community guidelines, posting rules, etc."
            maxLength={2000}
            style={{
              width: '100%',
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.7)',
              background: 'rgba(15,23,42,0.95)',
              padding: '8px 10px',
              color: 'var(--text-1)',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              resize: 'none',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Outfit',
              color: 'var(--text-1)',
            }}
          >
            Visibility
          </label>
          <div
            style={{
              display: 'flex',
              gap: 8,
            }}
          >
            {(['public', 'restricted'] as const).map((v) => {
              const active = form.visibility === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, visibility: v }))}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 999,
                    border: active
                      ? '1px solid rgba(167,139,250,0.9)'
                      : '1px solid rgba(148,163,184,0.7)',
                    background: active
                      ? 'rgba(129,140,248,0.35)'
                      : 'rgba(15,23,42,0.9)',
                    color: active ? '#ffffff' : 'var(--text-2)',
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                  }}
                >
                  {v}
                </button>
              )
            })}
          </div>
          <p
            style={{
              marginTop: 6,
              fontSize: 11,
              color: 'var(--text-3)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Restricted communities require moderator approval to join.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            paddingTop: 8,
          }}
        >
          <Link
            to="/communities"
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 14px',
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.8)',
              background: 'transparent',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              color: 'var(--text-1)',
              textDecoration: 'none',
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 999,
              border: '1px solid rgba(167,139,250,0.9)',
              background:
                'radial-gradient(circle at top left, rgba(129,140,248,0.55), rgba(56,189,248,0.35))',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              color: '#ffffff',
              cursor: isLoading ? 'default' : 'pointer',
              opacity: isLoading ? 0.75 : 1,
            }}
          >
            {isLoading && <Loader2 size={14} />}
            <span>{isLoading ? 'Creating…' : 'Create Community'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
