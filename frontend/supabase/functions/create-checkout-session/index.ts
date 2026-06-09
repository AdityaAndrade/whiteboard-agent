import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const stripeKey      = Deno.env.get('STRIPE_SECRET_KEY')
  // Support separate monthly/annual price IDs; STRIPE_PRICE_ID is the legacy fallback for both
  const monthlyPriceId = Deno.env.get('STRIPE_PRICE_ID_MONTHLY') ?? Deno.env.get('STRIPE_PRICE_ID')
  const annualPriceId  = Deno.env.get('STRIPE_PRICE_ID_ANNUAL')  ?? Deno.env.get('STRIPE_PRICE_ID')
  if (!stripeKey || !monthlyPriceId || !annualPriceId) {
    return new Response('Server misconfigured', { status: 500, headers: CORS })
  }

  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401, headers: CORS })

  // Verify the user's JWT via the anon client
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  )
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const period: 'monthly' | 'annual' = body.period === 'annual' ? 'annual' : 'monthly'
  const priceId = period === 'annual' ? annualPriceId! : monthlyPriceId!

  // Service-role client for reading/writing profiles (bypasses RLS)
  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: profile } = await sbAdmin
    .from('profiles')
    .select('stripe_customer_id, plan')
    .eq('user_id', user.id)
    .maybeSingle()

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

  // Derive the site URL from the Origin header so this works in both local dev and prod
  const origin = req.headers.get('Origin') ?? 'http://localhost:5173'

  // Pro user already subscribed: open the billing portal instead
  if (profile?.plan === 'pro' && profile?.stripe_customer_id) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/pricing`,
    })
    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Create a Stripe customer if this user doesn't have one yet
  let customerId = profile?.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await sbAdmin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/pricing?upgraded=true`,
    cancel_url: `${origin}/pricing?cancelled=true`,
    // session metadata: used by checkout.session.completed webhook
    metadata: { supabase_user_id: user.id },
    // subscription metadata: used by subscription.updated/deleted webhooks
    // (defense in depth — lets us find the user from any subscription event)
    subscription_data: { metadata: { supabase_user_id: user.id } },
  })

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
