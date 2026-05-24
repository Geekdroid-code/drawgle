'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { InvoiceHistory, type InvoiceItem } from '@/components/billingsdk/invoice-history'
import { Mail, Calendar, CircleDollarSign, Zap, User, Sparkles } from 'lucide-react'
import type { AuthenticatedUser } from '@/lib/types'

export interface PaymentRow {
  id: string
  created_at: string
  user_id: string
  dodo_payment_id: string
  pricing_plan_id: string
  amount: number
  currency: string
  status: string
  credits: number
  pricing_plan?: {
    name: string
  } | null
}

export interface SubscriptionSummary {
  subscription_id: string
  status: 'pending' | 'active' | 'cancelled' | 'expired'
  plan_name?: string
  next_billing_date?: string
  cancel_at_period_end?: boolean
  current_period_end?: string
  canceled_at?: string
  price_snapshot?: number | null
  currency_snapshot?: string | null
}

interface AccountDashboardProps {
  user: any
  payments: PaymentRow[]
  currentCredits: number
  totalCreditsPurchased: number
  subscription: SubscriptionSummary | null
}

export function AccountDashboard({
  user,
  payments,
  currentCredits,
  totalCreditsPurchased,
  subscription,
}: AccountDashboardProps) {

  // Map database payments to BSDK InvoiceItem
  const invoices = useMemo<InvoiceItem[]>(() => {
    return (payments || []).map((p) => {
      const sym = p.currency === 'USD' ? '$' : p.currency === 'EUR' ? '€' : p.currency || '$'
      const status: InvoiceItem['status'] =
        p.status === 'completed' || p.status === 'succeeded'
          ? 'paid'
          : p.status === 'refunded'
          ? 'refunded'
          : 'open'

      return {
        id: p.dodo_payment_id,
        date: new Date(p.created_at).toLocaleDateString(),
        amount: `${sym}${Number(p.amount).toFixed(2)}`,
        status,
        invoiceUrl: `/api/dodopayments/invoices/${p.dodo_payment_id}`,
        description: `${p.credits} AI credits purchased (${p.pricing_plan?.name || 'SaaS Plan'})`,
      }
    })
  }, [payments])

  const joinedDate = useMemo(() => {
    if (user?.created_at) {
      return new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
    return 'Recently'
  }, [user])

  return (
    <div className="space-y-8 text-left">
      {/* Metrics Row */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* User Card */}
        <Card className="border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#1a1d22]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <User className="h-4 w-4 text-[#1b7fcc]" />
              Account Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                {user?.email || 'user@drawgle.com'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Joined: {joinedDate}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Credits Card */}
        <Card className="border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#1a1d22]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <CircleDollarSign className="h-4 w-4 text-emerald-500" />
              AI Credits Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 flex items-baseline gap-1">
              <span>{currentCredits}</span>
              <span className="text-xs font-semibold text-slate-450 dark:text-slate-500">remaining</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              Total purchased: {totalCreditsPurchased} credits
            </p>
          </CardContent>
        </Card>

        {/* Subscription Plan Card */}
        <Card className="border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#1a1d22]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {subscription?.status === 'active' ? `${subscription.plan_name} Tier` : 'Free Tier'}
            </div>
            {subscription?.status === 'active' ? (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                  {subscription.status} subscription
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Subscribe on the billing page to unlock premium AI tools.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice History section */}
      <InvoiceHistory invoices={invoices} />
    </div>
  )
}