import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import FeedPage from './pages/FeedPage'
import ExplorePage from './pages/ExplorePage'
import PromptDetailPage from './pages/PromptDetailPage'
import LabPage from './pages/LabPage'
import SubmitPage from './pages/SubmitPage'
import ProfilePage from './pages/ProfilePage'
import CommunitiesPage from './pages/CommunitiesPage'
import CommunityDetailPage from './pages/CommunityDetailPage'
import CreateCommunityPage from './pages/CreateCommunityPage'
import CollectionsPage from './pages/CollectionsPage'
import CollectionDetailPage from './pages/CollectionDetailPage'
import SettingsPage from './pages/SettingsPage'
import MessagesPage from './pages/MessagesPage'
import AuthPage from './pages/auth'
import { useAuthStore } from './store'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AppWithShell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <BrowserRouter>
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
        <Route path="/settings" element={<AppWithShell><ProtectedRoute><SettingsPage /></ProtectedRoute></AppWithShell>} />

        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
