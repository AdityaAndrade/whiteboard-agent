import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth-store'
import { usePlan } from '@/lib/plan-store'
import { PLANS } from '@/lib/plans'
import type { Plan } from '@/types'

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

function PlanCta({ plan, current, onUpgrade }: { plan: Plan; current: Plan | null; onUpgrade: () => void }) {
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
    <Button className="w-full" onClick={onUpgrade}>
      Upgrade to Pro
    </Button>
  )
}

export function PricingPage() {
  const { user } = useAuth()
  const { plan: currentPlan } = usePlan()
  const [comingSoonOpen, setComingSoonOpen] = useState(false)

  const current = user ? currentPlan : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:py-24">
      <section className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Simple, honest pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Start free with everything you need to design and export agentic workflows. Upgrade
          when you need more room to build.
        </p>
      </section>

      <section className="mt-14 grid gap-6 sm:grid-cols-2">
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
            <PlanCta plan="free" current={current} onUpgrade={() => setComingSoonOpen(true)} />
          </CardFooter>
        </Card>

        {/* Pro */}
        <Card className="flex flex-col border-primary/40 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{PLANS.pro.name}</CardTitle>
              <Badge>Most room to build</Badge>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight">{PLANS.pro.price}</span>
              <span className="text-sm text-muted-foreground">{PLANS.pro.priceNote}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{PLANS.pro.blurb}</p>
          </CardHeader>
          <CardContent className="flex-1">
            <Tabs defaultValue="features">
              <TabsList className="w-full">
                <TabsTrigger value="features">What&rsquo;s included</TabsTrigger>
                <TabsTrigger value="brainstorm" className="gap-1.5">
                  <Sparkles className="size-3.5" />
                  Brainstorm
                  <Badge variant="secondary" className="ml-0.5">Coming soon</Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="features" className="pt-4">
                <FeatureList features={PLANS.pro.features} />
              </TabsContent>
              <TabsContent value="brainstorm" className="pt-4">
                <div className="rounded-lg border border-dashed p-4 text-sm">
                  <div className="flex items-center gap-2 font-medium" style={{ color: 'var(--foreground)' }}>
                    <Sparkles className="size-4 text-primary" />
                    Brainstorm — your AI workflow co-pilot
                    <Badge variant="secondary">Coming soon</Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    An AI agent assistant built into the canvas — describe what you&rsquo;re
                    trying to build in plain language, and Brainstorm helps sketch the agents,
                    tools, and connections for you. It&rsquo;s still in the works; Pro members
                    will get access the moment it ships.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter>
            <PlanCta plan="pro" current={current} onUpgrade={() => setComingSoonOpen(true)} />
          </CardFooter>
        </Card>
      </section>

      <p className="mx-auto mt-8 max-w-xl text-center text-sm text-muted-foreground">
        Every new account starts on the Free plan automatically — no card required.
      </p>

      <Dialog open={comingSoonOpen} onOpenChange={setComingSoonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pro is launching soon</DialogTitle>
            <DialogDescription>
              We&rsquo;re putting the finishing touches on Brainstorm before opening up Pro
              billing. Check back soon — your account is all set on the Free plan in the
              meantime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setComingSoonOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
