import { Link } from 'react-router-dom'

// Placeholder art images (will be replaced by real prompt outputs)
const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1686097928367-9f1e4e4a6e36?w=1400&q=80',
  'https://images.unsplash.com/photo-1707343848552-893e05dba6ac?w=800&q=80',
  'https://images.unsplash.com/photo-1695653422543-7da6d6744364?w=800&q=80',
  'https://images.unsplash.com/photo-1671726203454-488ab18f7eda?w=800&q=80',
  'https://images.unsplash.com/photo-1675526160014-41dcb91dce42?w=800&q=80',
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-void text-ink-primary overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-lx-white flex items-center justify-center">
            <span className="font-display text-void text-xs leading-none">LX</span>
          </div>
          <span className="font-sub font-semibold tracking-widest uppercase text-sm text-ink-primary">
            LX-OS
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/explore" className="overline hover:text-ink-primary transition-colors">Explore</Link>
          <Link to="/login" className="overline hover:text-ink-primary transition-colors">Sign in</Link>
          <Link to="/register" className="btn-primary text-xs px-4 py-2">Join Free</Link>
        </div>
      </header>

      {/* ── Hero — full viewport ─────────────────────────── */}
      <section className="relative h-screen w-full">
        {/* Background image with ken burns */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={HERO_IMAGES[0]}
            alt="AI Art"
            className="w-full h-full object-cover animate-ken-burns"
          />
          <div className="absolute inset-0 bg-overlay-full" />
        </div>

        {/* Hero content */}
        <div className="relative h-full flex flex-col justify-end pb-16 px-6 md:px-12 lg:px-20">
          {/* Overline */}
          <p className="overline mb-4 text-ink-muted">
            AI Art Prompt Engineering Marketplace
          </p>

          {/* Big display title */}
          <h1 className="display-xl mb-6 max-w-5xl">
            Engineer Prompts.<br />
            <span className="text-lx-amber">Share the Art.</span>
          </h1>

          <p className="font-body text-lg text-ink-secondary max-w-xl mb-10 leading-relaxed">
            The free community platform for AI artists. Discover structured prompts, 
            dissect their anatomy, optimize with Xenon Engine, and publish your work.
          </p>

          <div className="flex items-center gap-4 flex-wrap">
            <Link to="/register" className="btn-primary text-sm px-8 py-4">
              Get Started Free
            </Link>
            <Link to="/explore" className="btn-outline text-sm px-8 py-4">
              Browse Prompts
            </Link>
          </div>

          {/* Model strip */}
          <div className="flex items-center gap-2 mt-12">
            <span className="overline mr-2">Supports</span>
            {['Midjourney', 'DALL·E', 'Stable Diffusion', 'Flux', 'ComfyUI'].map(m => (
              <span key={m} className="badge text-xs">{m}</span>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 right-8 flex flex-col items-center gap-2 opacity-40">
          <div className="w-px h-12 bg-ink-muted animate-pulse" />
          <span className="overline text-xs" style={{ writingMode: 'vertical-rl' }}>scroll</span>
        </div>
      </section>

      {/* ── Editorial grid ───────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-20 py-20">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="display-md">Featured Prompts</h2>
          <Link to="/explore" className="overline hover:text-ink-primary transition-colors">
            View all →
          </Link>
        </div>

        {/* Masonry-style editorial grid */}
        <div className="grid grid-cols-12 gap-3 h-[700px]">
          {/* Large left feature */}
          <Link to="/explore" className="art-card col-span-7 row-span-2">
            <img src={HERO_IMAGES[1]} alt="" className="w-full h-full" />
            <div className="art-card-overlay" />
            <div className="art-card-content">
              <p className="overline mb-2 text-ink-muted">Midjourney · Cyberpunk</p>
              <h3 className="font-display text-3xl text-ink-primary leading-none mb-1">
                Neon Metropolis<br />at Dusk
              </h3>
              <p className="text-ink-secondary text-sm font-body mt-2">by synthetik_eye</p>
            </div>
          </Link>

          {/* Top right */}
          <Link to="/explore" className="art-card col-span-5">
            <img src={HERO_IMAGES[2]} alt="" className="w-full h-full" />
            <div className="art-card-overlay" />
            <div className="art-card-content">
              <p className="overline mb-1 text-ink-muted">Flux · Organic</p>
              <h3 className="font-display text-xl text-ink-primary leading-none">
                Bioluminescent Forest
              </h3>
            </div>
          </Link>

          {/* Bottom right */}
          <Link to="/explore" className="art-card col-span-5">
            <img src={HERO_IMAGES[3]} alt="" className="w-full h-full" />
            <div className="art-card-overlay" />
            <div className="art-card-content">
              <p className="overline mb-1 text-ink-muted">DALL·E · Abstract</p>
              <h3 className="font-display text-xl text-ink-primary leading-none">
                Void Architecture
              </h3>
            </div>
          </Link>
        </div>
      </section>

      {/* ── What is LX-OS strip ─────────────────────────── */}
      <section className="border-t border-border px-6 md:px-12 lg:px-20 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {[
            { num: '01', title: 'Discover', body: 'Browse a community library of AI art prompts organized by model, style, difficulty, and technique.' },
            { num: '02', title: 'Engineer', body: 'Xenon Engine parses any prompt into structured context blocks — subject, lighting, composition, style, and more.' },
            { num: '03', title: 'Share', body: 'Publish your prompts with full anatomy, example outputs, and remix lineage. Build your reputation.' },
          ].map(({ num, title, body }) => (
            <div key={num} className="flex gap-6">
              <span className="font-display text-5xl text-border leading-none select-none">{num}</span>
              <div>
                <h3 className="font-display text-2xl text-ink-primary mb-3">{title}</h3>
                <p className="text-ink-secondary font-body leading-relaxed text-sm">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA bar ─────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-border">
        <img src={HERO_IMAGES[4]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="relative px-6 md:px-12 lg:px-20 py-24 flex flex-col items-center text-center">
          <p className="overline mb-4">Free Forever</p>
          <h2 className="display-xl mb-6">Start Creating</h2>
          <Link to="/register" className="btn-primary text-sm px-12 py-4">
            Join the Community
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 md:px-12 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-lx-white flex items-center justify-center">
            <span className="font-display text-void text-xs leading-none">LX</span>
          </div>
          <span className="font-sub tracking-widest text-xs uppercase text-ink-muted">LX-OS</span>
        </div>
        <p className="text-xs text-ink-muted font-body">
          Free, community-first. No paywalls on prompts.
        </p>
      </footer>
    </div>
  )
}
