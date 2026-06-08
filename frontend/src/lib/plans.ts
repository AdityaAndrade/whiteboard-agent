import type { Plan } from '@/types'

/** Max saved workflows per plan — enforced (UI-side) on the dashboard. */
export const PLAN_LIMITS: Record<Plan, number> = {
  free: 2,
  pro: 12,
}

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
    price: '$10.99',
    priceNote: '/ month',
    blurb: 'For builders running more workflows, with an AI co-pilot for ideation.',
    features: [
      'Everything in Free',
      `Up to ${PLAN_LIMITS.pro} saved workflows (${PLAN_LIMITS.pro - PLAN_LIMITS.free} more than Free)`,
      'Brainstorm — AI agent assistant',
    ],
  },
}
