import type { Plan } from '@/types'

/** Max saved workflows per plan — enforced (UI-side) on the dashboard. */
export const PLAN_LIMITS: Record<Plan, number> = {
  free: 3,
  pro: 10,
}

/** Monthly Brainstorm message cap for Pro users — enforced server-side via the
 *  increment_brainstorm_usage() RPC and mirrored in the UI meter. */
export const BRAINSTORM_MONTHLY_CAP = 200

export type BillingPeriod = 'monthly' | 'annual'

/** Annual Pro pricing constants — billed as a single charge once a year. */
export const PRO_ANNUAL_PRICE = '$99'
export const PRO_ANNUAL_MONTHLY_EQUIV = '$8.25'

export interface PlanDef {
  id: Plan
  name: string
  price: string
  priceNote: string
  blurb: string
  features: string[]
}

export const PLANS: Record<Plan, PlanDef> = {
  free: {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceNote: 'forever',
    blurb: 'Everything you need to design and export agentic workflows.',
    features: [
      'Full canvas editor — drag, connect, configure',
      'Complete node palette & stack picker',
      'whiteboard.md export (download + copy)',
      `Up to ${PLAN_LIMITS.free} saved workflows`,
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: '$12',
    priceNote: '/ month',
    blurb: 'For builders who need more room to build, with an AI co-pilot for ideation.',
    features: [
      'Everything in Free',
      `Up to ${PLAN_LIMITS.pro} saved workflows`,
      `Brainstorm — ${BRAINSTORM_MONTHLY_CAP} AI messages / month`,
    ],
  },
}
