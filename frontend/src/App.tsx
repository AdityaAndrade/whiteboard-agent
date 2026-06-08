import { Navigate, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth, RedirectIfAuthed } from '@/components/auth/RouteGuards'
import { LandingPage } from '@/pages/LandingPage'
import { PricingPage } from '@/pages/PricingPage'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { WhiteboardEditorPage } from '@/pages/WhiteboardEditorPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        {/* Google sign-in covers both login and signup — old bookmarks just land on /login */}
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
      </Route>
      {/* The editor manages its own full-bleed chrome so the canvas gets maximum space */}
      <Route element={<RequireAuth />}>
        <Route path="/whiteboard/:id" element={<WhiteboardEditorPage />} />
      </Route>
    </Routes>
  )
}

export default App
