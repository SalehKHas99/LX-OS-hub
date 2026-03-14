import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import FeedPage from './pages/FeedPage'
import ExplorePage from './pages/ExplorePage'
import PromptDetailPage from './pages/PromptDetailPage'
import ProfilePage from './pages/ProfilePage'
import CommunityDetailPage from './pages/CommunityDetailPage'
import AuthPage from './pages/auth'
import { useAuthStore } from './store'

// Lazy-loaded pages (reduces initial bundle)
const LabPage = lazy(() => import('./pages/LabPage').then(m => ({ default: m.default })))
const SubmitPage = lazy(() => import('./pages/SubmitPage').then(m => ({ default: m.default })))
const CommunitiesPage = lazy(() => import('./pages/CommunitiesPage').then(m => ({ default: m.default })))
const CreateCommunityPage = lazy(() => import('./pages/CreateCommunityPage').then(m => ({ default: m.default })))
const CollectionsPage = lazy(() => import('./pages/CollectionsPage').then(m => ({ default: m.default })))
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage').then(m => ({ default: m.default })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.default })))
const MessagesPage = lazy(() => import('./pages/MessagesPage').then(m => ({ default: m.default })))

/** On app load, if we have a token (localStorage or sessionStorage), fetch current user so sidebar shows username and "My profile" works. */
function AuthHydrate({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore((s) => s.fetchMe)
  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token')
    if (token) fetchMe()
  }, [fetchMe])
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AppWithShell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--text-2)' }}>
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthHydrate>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Auth — full screen galaxy, no shell */}
            <Route path="/login"    element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} />

            {/* App shell pages */}
            <Route path="/feed" element={<AppWithShell><FeedPage /></AppWithShell>} />
            <Route path="/explore" element={<AppWithShell><ExplorePage /></AppWithShell>} />
            <Route path="/prompt/:id" element={<AppWithShell><PromptDetailPage /></AppWithShell>} />
            <Route path="/lab" element={<AppWithShell><LabPage /></AppWithShell>} />
            <Route path="/communities" element={<AppWithShell><CommunitiesPage /></AppWithShell>} />
            <Route path="/communities/new" element={<AppWithShell><ProtectedRoute><CreateCommunityPage /></ProtectedRoute></AppWithShell>} />
            <Route path="/c/:slug" element={<AppWithShell><CommunityDetailPage /></AppWithShell>} />
            <Route path="/submit" element={<AppWithShell><ProtectedRoute><SubmitPage /></ProtectedRoute></AppWithShell>} />
            <Route path="/collections" element={<AppWithShell><ProtectedRoute><CollectionsPage /></ProtectedRoute></AppWithShell>} />
            <Route path="/collections/:id" element={<AppWithShell><ProtectedRoute><CollectionDetailPage /></ProtectedRoute></AppWithShell>} />
            <Route path="/u/:username" element={<AppWithShell><ProfilePage /></AppWithShell>} />
            <Route path="/messages" element={<AppWithShell><ProtectedRoute><MessagesPage /></ProtectedRoute></AppWithShell>} />
            <Route path="/friends" element={<Navigate to="/messages?tab=friends" replace />} />
            <Route path="/settings" element={<AppWithShell><ProtectedRoute><SettingsPage /></ProtectedRoute></AppWithShell>} />

            <Route path="/" element={<Navigate to="/feed" replace />} />
            <Route path="*" element={<Navigate to="/feed" replace />} />
          </Routes>
        </Suspense>
      </AuthHydrate>
    </BrowserRouter>
  )
}
