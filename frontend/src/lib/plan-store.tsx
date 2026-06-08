import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Plan } from '@/types'
import { useAuth } from './auth-store'
import { supabase } from './supabase'

interface PlanValue {
  /** Defaults to 'free' while loading or for signed-out visitors. */
  plan: Plan
  loading: boolean
}

const PlanContext = createContext<PlanValue | null>(null)

/**
 * Reads the signed-in user's plan from `public.profiles` (see
 * supabase/schema.sql — every signup gets a 'free' row instantly via a DB
 * trigger, so there's nothing to provision client-side). Pricing/limits
 * live in src/lib/plans.ts.
 */
export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [plan, setPlan] = useState<Plan>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      // Signed out: reset to the default tier shown to anonymous visitors.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlan('free')
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setPlan(data?.plan === 'pro' ? 'pro' : 'free')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user, authLoading])

  return <PlanContext.Provider value={{ plan, loading }}>{children}</PlanContext.Provider>
}

// usePlan is colocated with PlanProvider/PlanContext (the standard provider+hook
// pattern) rather than split into its own file, hence the Fast Refresh trade-off here.
// eslint-disable-next-line react-refresh/only-export-components
export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used within a PlanProvider')
  return ctx
}
