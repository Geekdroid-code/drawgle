import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountDashboard } from '@/components/account/account-dashboard'
import { Card, CardContent } from '@/components/ui/card'
import { cookies } from 'next/headers'

export default async function AccountPage() {
  await cookies() // enable dynamic cookie routing context
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // Fetch user's payment history
  const { data: payments } = await supabase
    .from('dodo_payments')
    .select(`
      *,
      pricing_plan:dodo_pricing_plans(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get user's current credit balance
  const { data: credits } = await supabase
    .from('credits')
    .select('credits')
    .eq('user_id', user.id)
    .single()

  // Fetch user's active subscription summary
  const { data: activeSub } = await supabase
    .from('dodo_subscriptions')
    .select('dodo_subscription_id, status, cancel_at_period_end, next_billing_date, current_period_end, canceled_at, metadata, price_snapshot, currency_snapshot, dodo_pricing_plans(name, credits)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Normalize status to a strict union and coerce booleans
  const rawStatus = String((activeSub as any)?.status ?? 'pending').toLowerCase()
  const normalizedStatus =
    rawStatus === 'active'
      ? 'active'
      : rawStatus === 'cancelled' || rawStatus === 'canceled'
        ? 'cancelled'
        : rawStatus === 'expired'
          ? 'expired'
          : 'pending'

  const subscription =
    activeSub
      ? {
        subscription_id: String((activeSub as any)?.dodo_subscription_id || ''),
        status: normalizedStatus as 'pending' | 'active' | 'cancelled' | 'expired',
        plan_name: (activeSub as any)?.dodo_pricing_plans?.name as string | undefined,
        next_billing_date:
          (activeSub as any)?.next_billing_date ||
          (activeSub as any)?.metadata?.raw?.next_billing_date ||
          (activeSub as any)?.metadata?.next_billing_date ||
          undefined,
        cancel_at_period_end:
          typeof (activeSub as any)?.cancel_at_period_end === 'boolean'
            ? (activeSub as any).cancel_at_period_end
            : Boolean(
              (activeSub as any)?.metadata?.raw?.cancel_at_next_billing_date ??
              (activeSub as any)?.metadata?.cancel_at_next_billing_date ??
              false,
            ),
        current_period_end:
          (activeSub as any)?.current_period_end || undefined,
        canceled_at:
          (activeSub as any)?.canceled_at || undefined,
        price_snapshot: (activeSub as any)?.price_snapshot ?? null,
        currency_snapshot: (activeSub as any)?.currency_snapshot ?? null,
      }
      : null

  // Calculate total credits purchased from completed payments
  const totalCreditsPurchased = payments
    ?.filter(payment => payment.status === 'completed' || payment.status === 'succeeded')
    ?.reduce((sum, payment) => sum + payment.credits, 0) || 0

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl min-h-screen text-slate-900 dark:text-slate-100 flex flex-col gap-6">
      <Card className="border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#1a1d22] p-6 text-left">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-heading">
            Account Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 leading-relaxed">
            Manage your account metrics, inspect active plans, and securely download billing receipts.
          </p>
        </div>

        <AccountDashboard
          user={user}
          payments={payments || []}
          currentCredits={credits?.credits || 0}
          totalCreditsPurchased={totalCreditsPurchased}
          subscription={subscription}
        />
      </Card>
    </div>
  )
}

export const metadata = {
  title: 'User Account Details',
  description: 'Manage your profile, view payment history, and track credits',
}