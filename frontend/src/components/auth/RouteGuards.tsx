import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth-store'

function AuthChecking() {
  return (
    <div className="flex min-h-[50svh] items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  )
}

/** Layout route: gate `/dashboard` and `/whiteboard/:id` behind a session. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthChecking />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Layout route: bounce already-authed visitors off `/login`. */
export function RedirectIfAuthed() {
  const { user, loading } = useAuth()

  if (loading) return <AuthChecking />
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
