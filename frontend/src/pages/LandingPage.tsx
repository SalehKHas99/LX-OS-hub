import { Link } from 'react-router-dom'

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1686097928367-9f1e4e4a6e36?w=1400&q=80',
  'https://images.unsplash.com/photo-1707343848552-893e05dba6ac?w=800&q=80',
  'https://images.unsplash.com/photo-1695653422543-7da6d6744364?w=800&q=80',
  'https://images.unsplash.com/photo-1671726203454-488ab18f7eda?w=800&q=80',
  'https://images.unsplash.com/photo-1675526160014-41dcb91dce42?w=800&q=80',
]

export function LandingPage() {
  return (
    <div className="landing-root">
      <header className="landing-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="landing-logo-box">LX</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 14, color: 'var(--text-1)' }}>
            LX-OS
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/explore" className="landing-overline" style={{ marginBottom: 0, textDecoration: 'none', color: 'var(--text-3)' }}>Explore</Link>
          <Link to="/login" className="landing-overline" style={{ marginBottom: 0, textDecoration: 'none', color: 'var(--text-3)' }}>Sign in</Link>
          <Link to="/register" className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>Join Free</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-bg">
          <img src={HERO_IMAGES[0]} alt="AI Art" />
          <div className="landing-hero-overlay" />
        </div>
        <div className="landing-hero-content">
          <p className="landing-overline">AI Art Prompt Engineering Marketplace</p>
          <h1 className="landing-display-xl">
            Engineer Prompts.<br />
            <span className="landing-text-amber">Share the Art.</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 18, color: 'var(--text-2)', maxWidth: '36rem', marginBottom: 40, lineHeight: 1.6 }}>
            The free community platform for AI artists. Discover structured prompts,
            dissect their anatomy, optimize with Xenon Engine, and publish your work.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary" style={{ fontSize: 13, padding: '12px 24px' }}>Get Started Free</Link>
            <Link to="/explore" className="btn btn-outline" style={{ fontSize: 13, padding: '12px 24px' }}>Browse Prompts</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 48 }}>
            <span className="landing-overline" style={{ marginBottom: 0, marginRight: 8 }}>Supports</span>
            {['Midjourney', 'DALL·E', 'Stable Diffusion', 'Flux', 'ComfyUI'].map(m => (
              <span key={m} className="badge" style={{ fontSize: 12 }}>{m}</span>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 32, right: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.4 }}>
          <div style={{ width: 1, height: 48, background: 'var(--text-3)', animation: 'pulse 2s ease-in-out infinite' }} />
          <span className="landing-overline" style={{ marginBottom: 0, writingMode: 'vertical-rl', fontSize: 11 }}>scroll</span>
        </div>
      </section>

      <section className="landing-section" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 40 }}>
          <h2 className="landing-display-md">Featured Prompts</h2>
          <Link to="/explore" className="landing-overline" style={{ marginBottom: 0, textDecoration: 'none', color: 'var(--text-3)' }}>View all →</Link>
        </div>
        <div className="landing-art-grid">
          <Link to="/explore" className="landing-art-card" style={{ gridColumn: 'span 7', gridRow: 'span 2' }}>
            <img src={HERO_IMAGES[1]} alt="" />
            <div className="landing-art-card-overlay" />
            <div className="landing-art-card-content">
              <p className="landing-overline" style={{ marginBottom: 8 }}>Midjourney · Cyberpunk</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.875rem', color: 'var(--text-1)', lineHeight: 1.1, marginBottom: 4 }}>
                Neon Metropolis<br />at Dusk
              </h3>
              <p style={{ color: 'var(--text-2)', fontSize: 14, fontFamily: 'var(--font-body)', marginTop: 8 }}>by synthetik_eye</p>
            </div>
          </Link>
          <Link to="/explore" className="landing-art-card" style={{ gridColumn: 'span 5' }}>
            <img src={HERO_IMAGES[2]} alt="" />
            <div className="landing-art-card-overlay" />
            <div className="landing-art-card-content">
              <p className="landing-overline" style={{ marginBottom: 4 }}>Flux · Organic</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--text-1)', lineHeight: 1.2 }}>Bioluminescent Forest</h3>
            </div>
          </Link>
          <Link to="/explore" className="landing-art-card" style={{ gridColumn: 'span 5' }}>
            <img src={HERO_IMAGES[3]} alt="" />
            <div className="landing-art-card-overlay" />
            <div className="landing-art-card-content">
              <p className="landing-overline" style={{ marginBottom: 4 }}>DALL·E · Abstract</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--text-1)', lineHeight: 1.2 }}>Void Architecture</h3>
            </div>
          </Link>
        </div>
      </section>

      <section style={{ borderTop: '1px solid var(--border)', padding: '80px 1.5rem' }} className="landing-section">
        <div style={{ display: 'grid', gap: 48, gridTemplateColumns: '1fr' }}>
          {[
            { num: '01', title: 'Discover', body: 'Browse a community library of AI art prompts organized by model, style, difficulty, and technique.' },
            { num: '02', title: 'Engineer', body: 'Xenon Engine parses any prompt into structured context blocks — subject, lighting, composition, style, and more.' },
            { num: '03', title: 'Share', body: 'Publish your prompts with full anatomy, example outputs, and remix lineage. Build your reputation.' },
          ].map(({ num, title, body }) => (
            <div key={num} style={{ display: 'flex', gap: 24 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', color: 'var(--border)', lineHeight: 1, userSelect: 'none' }}>{num}</span>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text-1)', marginBottom: 12 }}>{title}</h3>
                <p style={{ color: 'var(--text-2)', fontFamily: 'var(--font-body)', lineHeight: 1.6, fontSize: 14 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ position: 'relative', overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
        <img src={HERO_IMAGES[4]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.2 }} />
        <div style={{ position: 'relative', padding: '96px 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }} className="landing-section">
          <p className="landing-overline" style={{ marginBottom: 16 }}>Free Forever</p>
          <h2 className="landing-display-xl" style={{ marginBottom: 24 }}>Start Creating</h2>
          <Link to="/register" className="btn btn-primary" style={{ fontSize: 13, padding: '12px 32px' }}>Join the Community</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="landing-logo-box" style={{ width: 24, height: 24, fontSize: 10 }}>LX</div>
          <span style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.12em', fontSize: 12, textTransform: 'uppercase', color: 'var(--text-3)' }}>LX-OS</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
          Free, community-first. No paywalls on prompts.
        </p>
      </footer>
    </div>
  )
}
