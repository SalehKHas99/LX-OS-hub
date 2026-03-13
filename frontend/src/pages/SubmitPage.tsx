import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { promptsApi, uploadsApi, communitiesApi } from '../api'
import { Upload, X, Loader2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const MODELS = ['midjourney', 'dalle', 'stable_diffusion', 'flux', 'comfyui', 'other']

const CONTEXT_FIELDS = [
  'subject', 'environment', 'composition', 'lighting',
  'style', 'camera_or_render', 'mood', 'color_palette'
]

export default function SubmitPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const communitySlug = searchParams.get('community')
  const [communityMeta, setCommunityMeta] = useState<{ id: string; visibility: string } | null>(null)
  const [shareToFeed, setShareToFeed] = useState<boolean | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    raw_prompt: '',
    negative_prompt: '',
    notes: '',
    model_family: 'midjourney',
    tags: [] as string[],
    tagInput: '',
  })

  const [contextBlocks, setContextBlocks] = useState<Record<string, string>>(
    Object.fromEntries(CONTEXT_FIELDS.map(f => [f, '']))
  )

  // Load community metadata when coming from a community "Post a Prompt" entrypoint
  useEffect(() => {
    if (!communitySlug) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await communitiesApi.get(communitySlug)
        if (cancelled) return
        setCommunityMeta({ id: data.id, visibility: data.visibility })
        // Only set default once so we don't fight user toggles
        setShareToFeed(prev =>
          prev !== null
            ? prev
            : data.visibility === 'restricted'
              ? false
              : true
        )
      } catch {
        // Best-effort; fall back to normal submit behavior
      }
    })()
    return () => {
      cancelled = true
    }
  }, [communitySlug])

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
  })

  const addTag = () => {
    const t = form.tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t], tagInput: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.raw_prompt) {
      toast.error('Title and prompt are required')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Create prompt
      const contextBlocksPayload = Object.entries(contextBlocks)
        .filter(([, v]) => v.trim())
        .map(([field_name, field_value], i) => ({ field_name, field_value, sort_order: i }))

      let community_id: string | undefined
      let share_flag: boolean | undefined
      if (communityMeta) {
        community_id = communityMeta.id
        const defaultShare =
          communityMeta.visibility === 'restricted' ? false : true
        share_flag = shareToFeed ?? defaultShare
      }

      const { data: prompt } = await promptsApi.create({
        title: form.title,
        raw_prompt: form.raw_prompt,
        negative_prompt: form.negative_prompt || null,
        notes: form.notes || null,
        model_family: form.model_family,
        tags: form.tags,
        context_blocks: contextBlocksPayload,
        community_id,
        // Only send the flag when posting into a community; personal prompts
        // follow the backend default of being visible in feed/search.
        ...(community_id ? { share_to_feed: share_flag } : {}),
        status: 'published',
      })

      // 2. Upload image if provided
      if (imageFile) {
        await uploadsApi.uploadImage(prompt.id, imageFile, form.title)
      }

      toast.success('Prompt published!')
      navigate(`/prompt/${prompt.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header fade-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div className="badge">
            <svg width="6" height="6" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="4" fill="#a78bfa" />
            </svg>
            Create
          </div>
        </div>
        <h1 className="page-title">Submit a Prompt</h1>
        <p className="page-subtitle">Publish a prompt with full context so others can learn and remix.</p>
      </div>

      {/* Content */}
      <div className="page-content" style={{ paddingTop: 0 }}>
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
        {/* Image upload strip */}
        <div
          className="theme-card shimmer-top"
          style={{
            padding: 20,
            marginBottom: 20,
          }}
        >
          <label className="label">Output Image</label>
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden aspect-video">
              <img src={imagePreview} className="w-full h-full object-cover" alt="preview" />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null) }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-void/80 flex items-center justify-center
                           text-ink-secondary hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              style={{
                borderWidth: 2,
                borderStyle: 'dashed',
                borderRadius: 14,
                padding: 32,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 160ms var(--ease-out)',
                borderColor: isDragActive ? 'var(--accent-h)' : 'var(--border)',
                background: isDragActive ? 'rgba(15,23,42,0.7)' : 'transparent',
              }}
            >
              <input {...getInputProps()} />
              <div style={{ marginBottom: 8 }}>
                <Upload size={24} style={{ margin: '0 auto', color: 'var(--text-3)' }} />
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-2)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {isDragActive ? 'Drop image here' : 'Drag & drop or click to upload'}
              </p>
              <p
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: 'var(--text-3)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                JPG, PNG, WEBP
              </p>
            </div>
          )}
        </div>

        {/* Core + context + notes in one glassy strip */}
        <div className="theme-card shimmer-top" style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Title *</label>
            <input
              className="input"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Describe your prompt in a few words"
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="label">Raw Prompt *</label>
            <textarea
              className="input resize-none h-28 text-sm font-mono"
              value={form.raw_prompt}
              onChange={e => setForm(f => ({ ...f, raw_prompt: e.target.value }))}
              placeholder="Paste your full prompt text here..."
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="label">Negative Prompt</label>
            <textarea
              className="input resize-none h-16 text-sm font-mono"
              value={form.negative_prompt}
              onChange={e => setForm(f => ({ ...f, negative_prompt: e.target.value }))}
              placeholder="Things to exclude from the image..."
            />
          </div>

          {/* Model */}
          <div style={{ marginBottom: 18 }}>
            <label className="label">Model</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                gap: 8,
                marginTop: 6,
              }}
            >
              {MODELS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, model_family: m }))}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    border: '1px solid rgba(148,163,184,0.6)',
                    background:
                      form.model_family === m
                        ? 'rgba(110,86,207,0.25)'
                        : 'rgba(15,23,42,0.85)',
                    color:
                      form.model_family === m
                        ? 'var(--nebula-soft)'
                        : 'var(--text-3)',
                    cursor: 'pointer',
                    transition: 'all 160ms var(--ease-out)',
                  }}
                >
                  {m === 'stable_diffusion' ? 'SD' : m === 'dalle' ? 'DALL·E' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div style={{ paddingTop: 8, borderTop: '1px dashed rgba(55,65,81,0.7)', marginTop: 4 }}>
            <label className="label">Tags</label>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <input
                className="input"
                style={{ flex: 1, fontSize: 13 }}
                value={form.tagInput}
                onChange={e => setForm(f => ({ ...f, tagInput: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag and press Enter"
              />
              <button
                type="button"
                onClick={addTag}
                className="btn-ghost"
                style={{ paddingInline: 12 }}
              >
                <Plus size={14} />
              </button>
            </div>
            {form.tags.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 8,
                }}
              >
                {form.tags.map(tag => (
                  <span key={tag} className="badge flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Context blocks (optional) */}
        <div className="theme-card shimmer-top" style={{ marginTop: 20, padding: 20 }}>
          <label className="label mb-1">Context Blocks</label>
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-3)',
              fontFamily: 'var(--font-body)',
              marginBottom: 12,
            }}
          >
            Optional but recommended — helps the community understand your prompt structure
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {CONTEXT_FIELDS.map(field => (
              <div key={field}>
                <label className="label">{field.replace(/_/g, ' ')}</label>
                <input
                  className="input text-sm"
                  value={contextBlocks[field]}
                  onChange={e => setContextBlocks(b => ({ ...b, [field]: e.target.value }))}
                  placeholder={`Optional — describe ${field.replace(/_/g, ' ')}...`}
                />
              </div>
            ))}
          </div>

          {communityMeta && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-3)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    marginBottom: 2,
                  }}
                >
                  Share to global feed & search
                </div>
                <p>
                  When enabled, this community prompt can appear on the main feed and in Explore search.
                  For restricted communities, the default is wall-only unless you turn this on.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setShareToFeed(v => (v === null ? true : !v))
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  flexShrink: 0,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                    color: 'var(--text-3)',
                  }}
                >
                  {shareToFeed ?? (communityMeta.visibility === 'restricted' ? false : true)
                    ? 'On'
                    : 'Off'}
                </span>
                <span
                  style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    width: 42,
                    height: 22,
                    borderRadius: 999,
                    padding: 2,
                    border: '1px solid rgba(148,163,184,0.6)',
                    background:
                      (shareToFeed ?? (communityMeta.visibility === 'restricted' ? false : true))
                        ? 'linear-gradient(135deg,#22d3ee,#4f46e5)'
                        : 'rgba(15,23,42,0.95)',
                    transition: 'background 160ms ease, border-color 160ms ease',
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      background: '#020617',
                      boxShadow:
                        '0 0 0 1px rgba(148,163,184,0.7), 0 0 10px rgba(56,189,248,0.6)',
                      transform:
                        (shareToFeed ?? (communityMeta.visibility === 'restricted' ? false : true))
                          ? 'translateX(18px)'
                          : 'translateX(0)',
                      transition: 'transform 160ms ease',
                    }}
                  />
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Notes strip */}
        <div className="theme-card shimmer-top" style={{ padding: 20, marginTop: 20 }}>
          <label className="label">Notes & Rationale</label>
          <textarea
            className="input resize-none h-20 text-sm"
            style={{
              background:
                'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.90))',
              borderRadius: 18,
              border: '1px solid rgba(55,65,81,0.9)',
              boxShadow:
                '0 0 0 1px rgba(15,23,42,1), 0 10px 32px rgba(15,23,42,0.9)',
            }}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Explain why this prompt is structured this way, what you discovered, tips for remixing..."
          />
        </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px 18px',
              fontSize: 15,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Loader2 size={16} className="animate-spin" /> Publishing...
              </span>
            ) : (
              'Publish Prompt'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
