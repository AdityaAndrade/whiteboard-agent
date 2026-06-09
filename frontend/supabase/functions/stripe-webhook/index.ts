import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!stripeKey || !webhookSecret) return new Response('Misconfigured', { status: 500 })

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing stripe-signature header', { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    // constructEventAsync uses the Web Crypto API — required in Deno (no Node Buffer)
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Webhook signature verification failed'
    return new Response(msg, { status: 400 })
  }

  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.supabase_user_id
    const subscriptionId = session.subscription as string | null
    if (userId && subscriptionId) {
      await sbAdmin
        .from('profiles')
        .update({ plan: 'pro', stripe_subscription_id: subscriptionId })
        .eq('user_id', userId)
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    // Try primary lookup by stored subscription ID first, fall back to subscription metadata
    const userId = sub.metadata?.supabase_user_id
    if (userId) {
      await sbAdmin
        .from('profiles')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('user_id', userId)
    } else {
      await sbAdmin
        .from('profiles')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('stripe_subscription_id', sub.id)
    }
  } else if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    // active + trialing = Pro; past_due / unpaid / canceled / paused = Free
    const plan = (sub.status === 'active' || sub.status === 'trialing') ? 'pro' : 'free'
    const userId = sub.metadata?.supabase_user_id
    if (userId) {
      await sbAdmin.from('profiles').update({ plan }).eq('user_id', userId)
    } else {
      await sbAdmin.from('profiles').update({ plan }).eq('stripe_subscription_id', sub.id)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
