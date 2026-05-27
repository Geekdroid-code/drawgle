import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import ManageSubscription from '@/components/subscribe/ManageSubscription'
import RealtimeSubscriptionSync from '@/components/subscribe/RealtimeSubscriptionSync'
import PlanGrid from '@/components/subscribe/PlanGrid'
import { Card } from '@/components/ui/card'

type PlanRow = {
    id: string
    name: string
    description: string | null
    price: number
    credits: number | null
    currency: string | null
    dodo_product_id: string
}

async function getPlans(): Promise<PlanRow[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('dodo_pricing_plans')
        .select('id, name, description, price, credits, currency, dodo_product_id')
        .eq('is_active', true)
        .order('price', { ascending: true })
    if (error) return []
    return (data || []) as PlanRow[]
}

async function getUser() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

async function getLatestSubscription(userId: string) {
    const supabase = await createClient()

    // Priority 1: Look for an active subscription first
    const { data: activeSub, error: activeError } = await supabase
        .from('dodo_subscriptions')
        .select('dodo_subscription_id, status, pricing_plan_id, next_billing_date, cancel_at_period_end, current_period_end, canceled_at, price_snapshot, currency_snapshot')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (activeError) return null
    if (activeSub) return activeSub

    // Priority 2: Look for a pending subscription (checkout in progress)
    const { data: pendingSub, error: pendingError } = await supabase
        .from('dodo_subscriptions')
        .select('dodo_subscription_id, status, pricing_plan_id, next_billing_date, cancel_at_period_end, current_period_end, canceled_at, price_snapshot, currency_snapshot')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (pendingError) return null
    if (pendingSub) return pendingSub

    // Priority 3: Fall back to most recent subscription (for cancelled/expired states)
    const { data, error } = await supabase
        .from('dodo_subscriptions')
        .select('dodo_subscription_id, status, pricing_plan_id, next_billing_date, cancel_at_period_end, current_period_end, canceled_at, price_snapshot, currency_snapshot')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) return null
    return data
}

export default async function SubscribePage() {
    // Touch cookies to enable RSC auth context
    await cookies()
    const [plans, user] = await Promise.all([getPlans(), getUser()])

    // If user is available, try pulling their latest subscription
    let subscriptionSummary: {
        subscription_id: string
        status: 'pending' | 'active' | 'cancelled' | 'expired'
        plan_name?: string
        next_billing_date?: string
        cancel_at_period_end?: boolean
        current_period_end?: string
        canceled_at?: string
        price_snapshot?: number | null
        currency_snapshot?: string | null
    } | null = null

    if (user) {
        const row = await getLatestSubscription(user.id)
        if (row?.dodo_subscription_id) {
            const planName = plans.find(p => p.id === (row as any).pricing_plan_id)?.name
            // Normalize status
            const rawStatus = String(row.status || '').toLowerCase()
            const status = (rawStatus === 'active'
                ? 'active'
                : rawStatus === 'pending'
                    ? 'pending'
                    : rawStatus === 'cancelled' || rawStatus === 'canceled'
                        ? 'cancelled'
                        : 'expired') as 'pending' | 'active' | 'cancelled' | 'expired'

            subscriptionSummary = {
                subscription_id: row.dodo_subscription_id,
                status,
                plan_name: planName || undefined,
                next_billing_date: row.next_billing_date || undefined,
                cancel_at_period_end: !!row.cancel_at_period_end,
                current_period_end: row.current_period_end || undefined,
                canceled_at: row.canceled_at || undefined,
                price_snapshot: row.price_snapshot ?? null,
                currency_snapshot: row.currency_snapshot ?? null,
            }
        }
    }

    const isActive = subscriptionSummary?.status === 'active'

    return (
        <main className="min-h-screen font-sans text-slate-900 dark:text-slate-100 flex flex-col items-center py-10">
            {/* Live updates for webhook-driven lifecycle changes */}
            <RealtimeSubscriptionSync userId={user?.id} />

            <div className="w-full max-w-4xl px-4 flex flex-col gap-10 items-center">
                {/* 1. Subscription Management Cockpit (Active Subscribers Only) */}
                {isActive && subscriptionSummary && (
                    <div className="w-full">
                        <ManageSubscription
                            subscription={subscriptionSummary}
                            plans={plans}
                            userEmail={user?.email || null}
                        />
                    </div>
                )}

                {/* 2. Choose/Compare Plans Grid (All Users) */}
                <div className="w-full flex justify-center">
                    <PlanGrid
                        plans={plans}
                        subscription={subscriptionSummary}
                        isAuthenticated={!!user}
                    />
                </div>
            </div>
        </main>
    )
}

export const metadata = {
    title: 'Billing & Subscriptions',
    description: 'Manage your pricing plans, upgrades, and billing details.',
}