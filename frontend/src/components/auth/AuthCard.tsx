import type { SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/wb/Logo'

function GoogleGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden {...props}>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

interface AuthCardProps {
  title: string
  description: string
  onContinue: () => void
  submitting: boolean
  error?: string | null
}

export function AuthCard({ title, description, onContinue, submitting, error }: AuthCardProps) {
  return (
    <div className="flex min-h-[calc(100svh-4rem-3.5rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link to="/" className="wb-theme mx-auto flex items-center">
            <Logo markSize={22} sub={null} />
          </Link>
          <CardTitle className="mt-2 text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <Button type="button" variant="outline" className="w-full" disabled={submitting} onClick={onContinue}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <GoogleGlyph />}
            Continue with Google
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            We use Google sign-in to keep your account secure — no separate password to manage.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
