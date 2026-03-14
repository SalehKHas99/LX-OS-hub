import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store'
import GalaxyBackground from '../../components/GalaxyBackground'

export default function AuthPage() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [focused, setFocused] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  const { login, register, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => { setTimeout(() => setMounted(true), 140) }, [])
  useEffect(() => { if (isAuthenticated) navigate('/feed') }, [isAuthenticated])

  const inputStyle = (name: string): React.CSSProperties => ({
    width: '100%',
    background: focused === name ? 'rgba(110,86,207,0.11)' : 'rgba(255,255,255,0.036)',
    border: `1px solid ${focused === name ? 'rgba(167,139,250,0.48)' : 'rgba(167,139,250,0.11)'}`,
    borderRadius: 10, padding: '13px 16px',
    color: '#f8fafc', fontSize: 14,
    fontFamily: 'var(--font-display)', outline: 'none',
    transition: 'all 0.26s ease', boxSizing: 'border-box',
    boxShadow: focused === name ? '0 0 22px rgba(110,86,207,0.20)' : 'none',
  })

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      if (tab === 'signin') {
        await login(loginId, password, rememberMe)
      } else {
        await register(username, loginId, password)
      }
      navigate('/feed')
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? 'Something went wrong'
      setError(Array.isArray(msg) ? msg[0] ?? msg : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::placeholder { color: rgba(161,161,170,0.40); }
        .lb { width:100%; padding:13px; border-radius:10px; border:none; cursor:pointer; font-family:'Sora',sans-serif; font-weight:600; font-size:14px; letter-spacing:0.025em; transition:all 0.26s ease; }
        .lp { background:linear-gradient(135deg,#7358D8,#4338CA); color:#fff; box-shadow:0 0 28px rgba(110,86,207,0.42),0 4px 18px rgba(67,56,202,0.30); }
        .lp:hover { transform:translateY(-1px); box-shadow:0 0 44px rgba(110,86,207,0.64),0 8px 26px rgba(67,56,202,0.42); }
        .lp:active { transform:none; }
        .lp:disabled { opacity:0.45; cursor:not-allowed; transform:none; }
        .ls { background:rgba(255,255,255,0.038); border:1px solid rgba(167,139,250,0.11)!important; color:#9ca3af; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:400; }
        .ls:hover { background:rgba(110,86,207,0.09); border-color:rgba(167,139,250,0.30)!important; color:#e5e7eb; }
        .tp { flex:1; padding:8px; background:transparent; border:none; font-family:'Sora',sans-serif; font-size:13px; font-weight:500; cursor:pointer; border-radius:7px; transition:all 0.20s; color:#6b7280; }
        .tp.on { background:rgba(110,86,207,0.20); color:#c4b5fd; box-shadow:0 0 14px rgba(110,86,207,0.18); }
        .tp:hover:not(.on) { color:#9ca3af; }
        .ce { opacity:0; transform:translateY(26px) scale(0.974); transition:all 0.90s cubic-bezier(0.16,1,0.3,1); }
        .ce.in { opacity:1; transform:none; }
        .dl { flex:1; height:1px; background:linear-gradient(90deg,transparent,rgba(167,139,250,0.13),transparent); }
        .rg { width:18px; height:18px; border:2px solid rgba(255,255,255,0.18); border-top-color:#fff; border-radius:50%; animation:sp 0.7s linear infinite; display:inline-block; }
        @keyframes sp { to { transform:rotate(360deg); } }
        .abadge { display:inline-flex; align-items:center; gap:5px; padding:4px 11px; border-radius:20px; background:rgba(110,86,207,0.14); border:1px solid rgba(167,139,250,0.18); font-size:10.5px; color:#a78bfa; font-family:'Space Grotesk',sans-serif; letter-spacing:0.09em; text-transform:uppercase; margin-bottom:14px; }
        a { color:#a78bfa; text-decoration:none; transition:color 0.2s; }
        a:hover { color:#c4b5fd; }
        input:-webkit-autofill { -webkit-box-shadow:0 0 0 100px rgba(4,3,14,0.95) inset!important; -webkit-text-fill-color:#f8fafc!important; }
      `}</style>

      <GalaxyBackground opacity={1} />

      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 460px 370px at 50% 50%, rgba(68,44,140,0.07) 0%, transparent 68%)',
      }} />

      <div style={{
        position: 'fixed', inset: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
        <div className={`ce ${mounted ? 'in' : ''}`} style={{
          width: '100%', maxWidth: 416,
          background: 'rgba(4,3,12,0.80)',
          backdropFilter: 'blur(36px)', WebkitBackdropFilter: 'blur(36px)',
          border: '1px solid rgba(167,139,250,0.12)',
          borderRadius: 20, padding: '40px 36px 36px',
          boxShadow: '0 0 0 1px rgba(167,139,250,0.04),0 0 50px rgba(110,86,207,0.14),0 0 110px rgba(67,56,202,0.06),0 60px 120px rgba(0,0,0,0.84)',
          position: 'relative',
        }}>
          {/* Shimmer edge */}
          <div style={{
            position: 'absolute', top: 0, left: '12%', right: '12%', height: 1,
            background: 'linear-gradient(90deg,transparent,rgba(167,139,250,0.52),transparent)',
            borderRadius: '100%',
          }} />

          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div className="abadge">
              <svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#a78bfa"/></svg>
              Alpha · v0.1
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 5 }}>
              <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
                <circle cx="15" cy="15" r="14" fill="url(#lauth)" opacity="0.9"/>
                <path d="M15 8 C18 8 22 11 22 15 C22 19 18 22 15 22 C12 22 8 19 8 15" stroke="rgba(255,240,180,0.9)" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <circle cx="15" cy="15" r="2.2" fill="rgba(255,245,180,0.95)"/>
                <circle cx="15" cy="15" r="1" fill="white"/>
                <defs><radialGradient id="lauth" cx="50%" cy="50%"><stop offset="0%" stopColor="#6E56CF"/><stop offset="100%" stopColor="#1e1060"/></radialGradient></defs>
              </svg>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700,
                color: '#f8fafc', letterSpacing: '-0.04em',
              }}>
                LX-OS
              </span>
            </div>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 13,
              color: '#6b7280', letterSpacing: '0.01em',
            }}>
              Context engineering for AI artists
            </p>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 4,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(167,139,250,0.09)',
            borderRadius: 10, padding: 4, marginBottom: 22,
          }}>
            <button className={`tp ${tab === 'signin' ? 'on' : ''}`} onClick={() => setTab('signin')}>Sign In</button>
            <button className={`tp ${tab === 'signup' ? 'on' : ''}`} onClick={() => setTab('signup')}>Create Account</button>
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 18 }}>
            {tab === 'signup' && (
              <input
                type="text" placeholder="Username"
                value={username} onChange={e => setUsername(e.target.value)}
                style={inputStyle('username')}
                onFocus={() => setFocused('username')} onBlur={() => setFocused(null)}
              />
            )}
            <input
              type={tab === 'signup' ? 'email' : 'text'}
              placeholder={tab === 'signup' ? 'Email' : 'Username or email'}
              value={loginId} onChange={e => setLoginId(e.target.value)}
              style={inputStyle('email')}
              onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <input
              type="password" placeholder="Password"
              value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle('password')}
              onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {tab === 'signin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                role="switch"
                aria-checked={rememberMe}
                onClick={() => setRememberMe((v) => !v)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  background: rememberMe ? 'rgba(110,86,207,0.6)' : 'rgba(255,255,255,0.1)',
                  position: 'relative',
                  transition: 'background 0.2s ease',
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: rememberMe ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s ease',
                }} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'var(--font-body)' }}>Remember me</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: tab === 'signin' ? 'flex-end' : 'center', marginBottom: 18 }}>
            {tab === 'signin'
              ? <a href="#" style={{ fontSize: 12 }}>Forgot password?</a>
              : <span style={{ fontSize: 11, color: '#4b5563', fontFamily: 'var(--font-body)' }}>
                  By creating an account you agree to our{' '}
                  <a href="#">Terms</a> and <a href="#">Privacy Policy</a>
                </span>
            }
          </div>

          {error && (
            <div style={{
              marginBottom: 14, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(240,100,96,0.12)', border: '1px solid rgba(240,100,96,0.25)',
              color: '#f87171', fontSize: 12.5, fontFamily: 'var(--font-body)',
            }}>
              {error}
            </div>
          )}

          <button className="lb lp" onClick={handleSubmit} disabled={loading} style={{ marginBottom: 15 }}>
            {loading
              ? <span className="rg" />
              : tab === 'signin' ? 'Enter the OS →' : 'Create Your Account →'
            }
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
            <div className="dl"/>
            <span style={{ fontSize: 11, color: '#374151', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
              or continue with
            </span>
            <div className="dl"/>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            {[
              { l: 'Google', i: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> },
              { l: 'GitHub', i: <svg width="15" height="15" viewBox="0 0 24 24" fill="#9ca3af"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg> },
              { l: 'Discord', i: <svg width="15" height="15" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg> },
            ].map(({ l, i }) => (
              <button key={l} className="lb ls" style={{ border: 'none', flex: 1 }}>
                {i}<span style={{ fontSize: 12 }}>{l}</span>
              </button>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#374151', fontFamily: 'var(--font-body)' }}>
            {tab === 'signin'
              ? <span>New to LX-OS? <a href="#" onClick={() => setTab('signup')}>Create an account</a></span>
              : <span>Already have an account? <a href="#" onClick={() => setTab('signin')}>Sign in</a></span>
            }
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingBottom: 22,
        background: 'linear-gradient(to top,rgba(0,0,0,0.52) 0%,rgba(0,0,0,0.18) 60%,transparent 100%)',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
          color: 'rgba(180,175,210,0.72)', letterSpacing: '0.14em',
          textTransform: 'uppercase', textShadow: '0 1px 8px rgba(0,0,0,0.80)',
        }}>
          Context Engineering Marketplace&nbsp;&nbsp;·&nbsp;&nbsp;v0.1
        </span>
      </div>
    </>
  )
}
