import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Sparkles, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth-store'
import { usePlan } from '@/lib/plan-store'
import { PLANS, PRO_ANNUAL_PRICE, type BillingPeriod } from '@/lib/plans'
import { supabase } from '@/lib/supabase'
import type { Plan } from '@/types'

function ProFeatureTabs() {
  return (
    <Tabs defaultValue="features">
      <TabsList className="w-full">
        <TabsTrigger value="features">What&rsquo;s included</TabsTrigger>
        <TabsTrigger value="brainstorm" className="gap-1.5">
          <Sparkles className="size-3.5" />
          Brainstorm
        </TabsTrigger>
      </TabsList>
      <TabsContent value="features" className="pt-4">
        <FeatureList features={PLANS.pro.features} />
      </TabsContent>
      <TabsContent value="brainstorm" className="pt-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 font-medium" style={{ color: 'var(--foreground)' }}>
            <Sparkles className="size-4 text-primary" />
            Brainstorm — your AI workflow co-pilot
          </div>
          <p className="text-muted-foreground">
            An AI agent built into the canvas editor. Describe what you&rsquo;re
            trying to build in plain language — Brainstorm adds nodes, draws
            connections, and wires up your stack in real time.
          </p>
          <ul className="space-y-1.5">
            {[
              'Build full workflows from a single prompt',
              'Edit and refine nodes conversationally',
              'Remembers your stack preferences across sessions',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </TabsContent>
    </Tabs>
  )
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-2.5">
      {features.map((f) => (
        <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  )
}


function PlanCta({
  plan,
  current,
  onUpgrade,
  onManage,
  loading,
}: {
  plan: Plan
  current: Plan | null
  onUpgrade: () => void
  onManage: () => void
  loading: boolean
}) {
  if (current === plan && plan === 'pro') {
    return (
      <div className="flex w-full flex-col gap-2">
        <Button className="w-full" variant="outline" disabled>
          Your current plan
        </Button>
        <Button className="w-full gap-1.5" variant="ghost" size="sm" onClick={onManage} disabled={loading}>
          <ExternalLink className="size-3.5" />
          Manage subscription
        </Button>
      </div>
    )
  }
  if (current === plan) {
    return (
      <Button className="w-full" variant="outline" disabled>
        Your current plan
      </Button>
    )
  }
  if (plan === 'free') {
    return (
      <Button className="w-full" variant="outline" asChild>
        <Link to="/login">Get started free</Link>
      </Button>
    )
  }
  return (
    <Button className="w-full" onClick={onUpgrade} disabled={loading}>
      {loading ? 'Redirecting…' : 'Upgrade to Pro'}
    </Button>
  )
}

export function PricingPage() {
  const { user } = useAuth()
  const { plan: currentPlan, refreshPlan } = usePlan()
  const [searchParams, setSearchParams] = useSearchParams()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = user ? currentPlan : null

  // Detect return from Stripe Checkout and refresh the plan from DB
  const upgraded = searchParams.get('upgraded') === 'true'
  const cancelled = searchParams.get('cancelled') === 'true'

  useEffect(() => {
    if (upgraded) {
      refreshPlan()
      // Clean the query param without a full navigation
      setSearchParams({}, { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleUpgrade(period: BillingPeriod) {
    if (!user) return
    setCheckoutLoading(true)
    setError(null)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) throw new Error('Not authenticated')
      const res = await supabase.functions.invoke('create-checkout-session', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: { period },
      })
      if (res.error) throw new Error(res.error.message)
      const { url } = res.data as { url: string }
      window.location.href = url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setCheckoutLoading(false)
    }
  }

  async function handleManage() {
    if (!user) return
    setPortalLoading(true)
    setError(null)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) throw new Error('Not authenticated')
      const res = await supabase.functions.invoke('create-portal-session', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      const { url } = res.data as { url: string }
      window.location.href = url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPortalLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <section className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Simple, honest pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Start free with everything you need to design and export agentic workflows. Upgrade
          when you need more room to build.
        </p>
      </section>

      {upgraded && (
        <div className="mx-auto mt-8 max-w-xl rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Welcome to Pro! Your plan will update shortly — if it hasn't yet, refresh the page.
        </div>
      )}

      {cancelled && (
        <div className="mx-auto mt-8 max-w-xl rounded-lg border border-muted bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          No worries — you're still on the Free plan. Upgrade any time.
        </div>
      )}

      {error && (
        <div className="mx-auto mt-8 max-w-xl rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="mt-12 grid gap-6 lg:grid-cols-3">
        {/* Free */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-xl">{PLANS.free.name}</CardTitle>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight">{PLANS.free.price}</span>
              <span className="text-sm text-muted-foreground">{PLANS.free.priceNote}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{PLANS.free.blurb}</p>
          </CardHeader>
          <CardContent className="flex-1">
            <FeatureList features={PLANS.free.features} />
          </CardContent>
          <CardFooter>
            <PlanCta
              plan="free"
              current={current}
              onUpgrade={() => handleUpgrade('monthly')}
              onManage={handleManage}
              loading={checkoutLoading || portalLoading}
            />
          </CardFooter>
        </Card>

        {/* Pro — monthly */}
        <Card className="flex flex-col border-primary/40 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{PLANS.pro.name}</CardTitle>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight">{PLANS.pro.price}</span>
              <span className="text-sm text-muted-foreground">{PLANS.pro.priceNote}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{PLANS.pro.blurb}</p>
          </CardHeader>
          <CardContent className="flex-1">
            <ProFeatureTabs />
          </CardContent>
          <CardFooter>
            <PlanCta
              plan="pro"
              current={current}
              onUpgrade={() => handleUpgrade('monthly')}
              onManage={handleManage}
              loading={checkoutLoading || portalLoading}
            />
          </CardFooter>
        </Card>

        {/* Pro — annual */}
        <Card className="flex flex-col border-primary/60 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{PLANS.pro.name}</CardTitle>
              <Badge>Best value</Badge>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight">{PRO_ANNUAL_PRICE}</span>
              <span className="text-sm text-muted-foreground">/ year</span>
              <span className="ml-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Save 17%</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{PLANS.pro.blurb}</p>
          </CardHeader>
          <CardContent className="flex-1">
            <ProFeatureTabs />
          </CardContent>
          <CardFooter>
            <PlanCta
              plan="pro"
              current={current}
              onUpgrade={() => handleUpgrade('annual')}
              onManage={handleManage}
              loading={checkoutLoading || portalLoading}
            />
          </CardFooter>
        </Card>
      </section>

      <p className="mx-auto mt-8 max-w-xl text-center text-sm text-muted-foreground">
        Every new account starts on the Free plan automatically — no card required.
      </p>
    </div>
  )
}
