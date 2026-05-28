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
        <Card className="border-[var(--dg-border)] bg-[var(--dg-surface)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-[var(--dg-text-muted)]">
              <User className="h-4 w-4 text-[#1b7fcc]" />
              Account Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-[var(--dg-text-faint)]" />
              <span className="truncate text-sm font-semibold text-[var(--dg-text)]">
                {user?.email || 'user@drawgle.com'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-[var(--dg-text-faint)]" />
              <span className="text-xs text-[var(--dg-text-muted)]">
                Joined: {joinedDate}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Credits Card */}
        <Card className="border-[var(--dg-border)] bg-[var(--dg-surface)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-[var(--dg-text-muted)]">
              <CircleDollarSign className="h-4 w-4 text-emerald-500" />
              AI Credits Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline gap-1 text-3xl font-extrabold text-[var(--dg-text)]">
              <span>{currentCredits}</span>
              <span className="text-xs font-semibold text-[var(--dg-text-muted)]">remaining</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--dg-text-muted)]">
              Total purchased: {totalCreditsPurchased} credits
            </p>
          </CardContent>
        </Card>

        {/* Subscription Plan Card */}
        <Card className="border-[var(--dg-border)] bg-[var(--dg-surface)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-[var(--dg-text-muted)]">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold text-[var(--dg-text)]">
              {subscription?.status === 'active' ? `${subscription.plan_name} Tier` : 'Free Tier'}
            </div>
            {subscription?.status === 'active' ? (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs capitalize text-[var(--dg-text-muted)]">
                  {subscription.status} subscription
                </span>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--dg-text-muted)]">
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
