import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { labApi } from '../api'
import type { ParseResponse, OptimizeResponse } from '../types'
import { Sparkles, Zap, Copy, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const MODELS = ['midjourney', 'dalle', 'stable_diffusion', 'flux']
const MODEL_LABEL = (m: string) => (m === 'stable_diffusion' ? 'SD' : m === 'dalle' ? 'DALL·E' : m.charAt(0).toUpperCase() + m.slice(1))

const scoreColor = (n: number) => (n >= 75 ? 'var(--accent-h)' : n >= 40 ? '#F0A500' : '#F06460')
const barColor = (n: number) => (n >= 75 ? 'var(--accent)' : n >= 40 ? '#F0A500' : '#F06460')

const CONTEXT_FIELD_KEYS: string[] = [
  'subject',
  'environment',
  'composition',
  'lighting',
  'style',
  'camera_or_render',
  'mood',
  'color_palette',
  'negative_prompt',
  'model_parameters',
  'notes_and_rationale',
]

function sectionTitle(text: string) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 2,
          height: 16,
          borderRadius: 999,
          background: 'linear-gradient(180deg, var(--accent-h), rgba(167,139,250,0.4))',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
        }}
      >
        {text}
      </span>
    </div>
  )
}

function renderFieldBadge(status: 'required' | 'ok' | 'empty') {
  let label = '—'
  let background = 'rgba(15,23,42,0.45)'
  let border = '1px solid rgba(148,163,184,0.45)'
  let color = 'var(--text-3)'

  if (status === 'required') {
    label = 'required'
    background = 'rgba(245,158,11,0.18)'
    border = '1px solid rgba(245,158,11,0.45)'
    color = '#FBBF24'
  } else if (status === 'ok') {
    label = 'ok'
    background = 'rgba(167,139,250,0.14)'
    border = '1px solid rgba(167,139,250,0.35)'
    color = 'var(--accent-h)'
  }

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        background,
        border,
        color,
      }}
    >
      {label}
    </span>
  )
}

function ContextFieldsList({ parseResult }: { parseResult: ParseResponse | null }) {
  const blockMap = new Map(
    (parseResult?.context_blocks ?? []).map((b) => [b.field_name.toLowerCase().replace(/-/g, '_'), b]),
  )
  const missingSet = new Set(
    (parseResult?.missing_fields ?? []).map((f) => f.toLowerCase().replace(/-/g, '_')),
  )

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {CONTEXT_FIELD_KEYS.map((key) => {
        const block = blockMap.get(key)
        const hasValue = !!(block && (block.field_value?.trim() ?? '').length > 0)
        const isMissing = missingSet.has(key)
        const status: 'required' | 'ok' | 'empty' =
          isMissing ? 'required' : hasValue && (block?.confidence ?? 0) >= 40 ? 'ok' : 'empty'
        const label = key.replace(/_/g, ' ')
        return (
          <li
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 0',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-2)',
              }}
            >
              {label}
            </span>
            {renderFieldBadge(status)}
          </li>
        )
      })}
    </ul>
  )
}

export default function LabPage() {
  const [searchParams] = useSearchParams()
  const [prompt, setPrompt] = useState(searchParams.get('prompt') ?? '')
  const [model, setModel] = useState('midjourney')
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null)
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResponse | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [activeAdapter, setActiveAdapter] = useState<keyof ParseResponse['adapter_exports']>('midjourney')
  const [expandedSuggestions, setExpandedSuggestions] = useState(true)

  const handleParse = async () => {
    if (!prompt.trim()) {
      toast.error('Enter a prompt first')
      return
    }
    setIsParsing(true)
    setParseResult(null)
    setOptimizeResult(null)
    try {
      const { data } = await labApi.parse(prompt, model)
      setParseResult(data)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Parse failed')
    } finally {
      setIsParsing(false)
    }
  }

  const handleOptimize = async () => {
    if (!prompt.trim()) {
      toast.error('Enter a prompt first')
      return
    }
    setIsOptimizing(true)
    setOptimizeResult(null)
    try {
      const { data } = await labApi.optimize(prompt, model)
      setOptimizeResult(data)
      toast.success(`Completeness: ${data.completeness_before}% → ${data.completeness_after}%`)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Optimization failed')
    } finally {
      setIsOptimizing(false)
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied')
  }

  return (
    <div
      style={{
        maxWidth: 960,
        width: '100%',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          paddingTop: 20,
          paddingBottom: 18,
          borderBottom: '1px solid var(--border-sub)',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                marginBottom: 6,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--text-1)',
                fontFamily: 'var(--font-display)',
              }}
            >
              Context Optimizer
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: 'var(--text-2)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Parse, analyze, and optimize your AI art prompts using structured context engineering.
            </p>
          </div>
          <div
            style={{
              alignSelf: 'flex-start',
              borderRadius: 999,
              padding: '4px 10px',
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'rgba(15,23,42,0.75)',
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              color: 'var(--text-3)',
              whiteSpace: 'nowrap',
            }}
          >
            Powered by Xenon Engine
          </div>
        </div>
      </div>

      {/* main two-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 20,
        }}
      >
        {/* left: raw prompt + model */}
        <div
          style={{
            padding: 20,
            borderRadius: 16,
            border: '1px solid var(--border)',
            background:
              'radial-gradient(circle at top left, rgba(129,140,248,0.18), transparent 55%), rgba(15,23,42,0.92)',
          }}
        >
          {sectionTitle('Raw prompt')}
          <textarea
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Paste your AI image generation prompt here…"
            style={{
              width: '100%',
              resize: 'none',
              borderRadius: 12,
              border: '1px solid rgba(167,139,250,0.18)',
              background: 'rgba(15,23,42,0.95)',
              padding: '12px 14px',
              color: 'var(--text-1)',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-3)',
            }}
          >
            <span>{Math.ceil((prompt.length || 0) / 4)} / 2000 tokens</span>
          </div>

          <div
            style={{
              marginTop: 18,
              height: 1,
              background:
                'linear-gradient(90deg, transparent, rgba(167,139,250,0.35), transparent)',
            }}
          />

          <div style={{ marginTop: 18 }}>
            {sectionTitle('Target model')}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {MODELS.map((m) => {
                const selected = model === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: selected
                        ? '1px solid rgba(167,139,250,0.7)'
                        : '1px solid rgba(148,163,184,0.5)',
                      background: selected
                        ? 'rgba(129,140,248,0.35)'
                        : 'rgba(15,23,42,0.9)',
                      color: selected ? '#ffffff' : 'var(--text-2)',
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                    }}
                  >
                    {MODEL_LABEL(m)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* right: completeness + fields + guidance */}
        <div
          style={{
            padding: 20,
            borderRadius: 16,
            border: '1px solid var(--border)',
            background: 'rgba(15,23,42,0.96)',
          }}
        >
          <div>
            {sectionTitle('Completeness')}
            <div
              style={{
                width: '100%',
                height: 10,
                borderRadius: 999,
                background: 'var(--panel)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${parseResult?.completeness_score ?? 0}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: barColor(parseResult?.completeness_score ?? 0),
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-3)',
              }}
            >
              {parseResult?.completeness_score ?? 0}%
            </p>
          </div>

          <div style={{ marginTop: 18 }}>
            {sectionTitle('Context fields')}
            <ContextFieldsList parseResult={parseResult} />
          </div>

          <div
            style={{
              marginTop: 18,
              padding: 12,
              borderRadius: 12,
              border: '1px solid rgba(167,139,250,0.25)',
              background: 'rgba(30,64,175,0.18)',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--text-2)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Good prompts have at least subject, style, and lighting defined.
            </p>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 13,
                color: 'var(--text-2)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Use Optimize to let the AI fill missing fields automatically.
            </p>
            {parseResult?.suggestions?.[0] && (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 13,
                  color: 'var(--text-2)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {parseResult.suggestions[0].recommendation}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* actions */}
      <div
        style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={handleParse}
          disabled={isParsing || isOptimizing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 999,
            border: '1px solid rgba(56,189,248,0.7)',
            background:
              'linear-gradient(135deg, rgba(30,64,175,0.35), rgba(56,189,248,0.18))',
            color: '#e0f2fe',
            fontSize: 13,
            fontWeight: 600,
            cursor: isParsing || isOptimizing ? 'default' : 'pointer',
            opacity: isParsing || isOptimizing ? 0.65 : 1,
            boxShadow: isParsing
              ? '0 0 0 1px rgba(56,189,248,0.55)'
              : '0 0 18px rgba(56,189,248,0.45)',
            transition: 'transform 160ms var(--ease-out), box-shadow 160ms ease, opacity 120ms ease',
            transform: isParsing ? 'translateY(0)' : 'translateY(-0.5px)',
          }}
        >
          {isParsing ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Sparkles size={16} />
          )}
          <span>{isParsing ? 'Checking…' : 'Check my prompt'}</span>
        </button>

        <button
          type="button"
          onClick={handleOptimize}
          disabled={isParsing || isOptimizing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 22px',
            borderRadius: 999,
            border: '1px solid rgba(167,139,250,0.9)',
            background:
              'radial-gradient(circle at top left, rgba(129,140,248,0.55), rgba(56,189,248,0.35))',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            cursor: isParsing || isOptimizing ? 'default' : 'pointer',
            boxShadow: '0 0 24px rgba(110,86,207,0.45)',
            opacity: isParsing || isOptimizing ? 0.7 : 1,
          }}
        >
          {isOptimizing ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Zap size={16} />
          )}
          <span>{isOptimizing ? 'Optimizing…' : 'Optimize with AI'}</span>
        </button>
      </div>

      {/* optimized prompt + details */}
      {optimizeResult && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 16,
            border: '1px solid var(--border)',
            background: 'rgba(15,23,42,0.96)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-1)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Optimized prompt
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              <span
                style={{
                  textDecoration: 'line-through',
                  color: 'var(--text-3)',
                }}
              >
                {optimizeResult.completeness_before}%
              </span>
              <span
                style={{
                  color: 'var(--accent-h)',
                  fontWeight: 700,
                }}
              >
                {optimizeResult.completeness_after}%
              </span>
            </div>
          </div>
          <div
            style={{
              position: 'relative',
              borderRadius: 12,
              padding: 12,
              background: 'var(--panel)',
              marginBottom: 12,
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
                lineHeight: 1.6,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-h)',
              }}
            >
              {optimizeResult.optimized_prompt}
            </pre>
            <button
              type="button"
              onClick={() => copy(optimizeResult.optimized_prompt)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                border: 'none',
                background: 'transparent',
                padding: 4,
                cursor: 'pointer',
                opacity: 0.6,
              }}
            >
              <Copy size={12} />
            </button>
          </div>
          <div>
            <p
              style={{
                margin: '0 0 6px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-1)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Changes made
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}
            >
              {optimizeResult.changes_made.map((c, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    fontSize: 12,
                    color: 'var(--text-2)',
                    fontFamily: 'var(--font-body)',
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontWeight: 700,
                    }}
                  >
                    +
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* context blocks + adapter exports + suggestions */}
      {parseResult && (
        <div
          style={{
            marginTop: 24,
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          }}
        >
          <div
            style={{
              padding: 20,
              borderRadius: 16,
              border: '1px solid var(--border)',
              background: 'rgba(15,23,42,0.96)',
            }}
          >
            {sectionTitle('Context blocks')}
            <div>
              {(parseResult.context_blocks ?? []).map((block) => (
                <div
                  key={block.field_name}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-sub)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        marginBottom: 2,
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-3)',
                      }}
                    >
                      {block.field_name}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: 'var(--text-2)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {block.field_value || (
                        <em style={{ color: 'var(--text-3)' }}>Empty</em>
                      )}
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color: scoreColor(block.confidence),
                      }}
                    >
                      {block.confidence}%
                    </span>
                    <div
                      style={{
                        width: 56,
                        height: 4,
                        borderRadius: 999,
                        background: 'var(--panel)',
                      }}
                    >
                      <div
                        style={{
                          width: `${block.confidence}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: barColor(block.confidence),
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div
              style={{
                padding: 20,
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'rgba(15,23,42,0.96)',
              }}
            >
              {sectionTitle('Adapter exports')}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {(Object.keys(parseResult.adapter_exports) as Array<
                  keyof typeof parseResult.adapter_exports
                >).map((k) => {
                  const selected = activeAdapter === k
                  const label = k === 'stable_diffusion' ? 'SD' : k === 'dalle' ? 'DALL·E' : k
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setActiveAdapter(k)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: selected
                          ? '1px solid rgba(167,139,250,0.9)'
                          : '1px solid rgba(148,163,184,0.5)',
                        background: selected
                          ? 'rgba(129,140,248,0.35)'
                          : 'rgba(15,23,42,0.9)',
                        color: selected ? '#ffffff' : 'var(--text-2)',
                        fontSize: 11,
                        fontFamily: 'var(--font-body)',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <div
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  padding: 12,
                  background: 'var(--panel)',
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: 12,
                    lineHeight: 1.6,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-2)',
                  }}
                >
                  {parseResult.adapter_exports[activeAdapter]}
                </pre>
                <button
                  type="button"
                  onClick={() => copy(parseResult.adapter_exports[activeAdapter])}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    border: 'none',
                    background: 'transparent',
                    padding: 4,
                    cursor: 'pointer',
                    opacity: 0.6,
                  }}
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>

            {parseResult.suggestions.length > 0 && (
              <div
                style={{
                  padding: 20,
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  background: 'rgba(15,23,42,0.96)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedSuggestions((e) => !e)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-1)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Suggestions ({parseResult.suggestions.length})
                  </span>
                  {expandedSuggestions ? (
                    <ChevronUp size={14} color="var(--text-3)" />
                  ) : (
                    <ChevronDown size={14} color="var(--text-3)" />
                  )}
                </button>
                {expandedSuggestions && (
                  <div style={{ marginTop: 10 }}>
                    {parseResult.suggestions.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          borderRadius: 10,
                          padding: 10,
                          marginBottom: 8,
                          background: 'var(--panel)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            marginBottom: 4,
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--accent-h)',
                          }}
                        >
                          {s.field}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            marginBottom: 2,
                            fontSize: 12,
                            color: '#F0A500',
                            fontFamily: 'var(--font-body)',
                          }}
                        >
                          {s.issue}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            color: 'var(--text-2)',
                            fontFamily: 'var(--font-body)',
                          }}
                        >
                          {s.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
