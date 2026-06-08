import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AuthCard } from '@/components/auth/AuthCard'
import { useAuth } from '@/lib/auth-store'

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled — you'll need to allow access to continue.",
}

function readOAuthError(location: { search: string; hash: string }): string | null {
  for (const raw of [location.search, location.hash]) {
    const params = new URLSearchParams(raw.replace(/^[?#]/, ''))
    const code = params.get('error')
    if (!code) continue
    const description = params.get('error_description')
    return OAUTH_ERROR_MESSAGES[code] || description?.replace(/\+/g, ' ') || 'Sign-in failed. Please try again.'
  }
  return null
}

export function LoginPage() {
  const { signInWithGoogle } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/dashboard'

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(() => readOAuthError(location))

  async function handleContinue() {
    setError(null)
    setSubmitting(true)
    const { error } = await signInWithGoogle(from)
    if (error) {
      setSubmitting(false)
      setError(error)
    }
    // On success, Supabase redirects the full page to Google — no further state to set here.
  }

  return (
    <AuthCard
      title="Welcome"
      description="Sign in with Google to access your whiteboards."
      onContinue={handleContinue}
      submitting={submitting}
      error={error}
    />
  )
}
