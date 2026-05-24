'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Check, Zap, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import SubscribeButton from './SubscribeButton'
import { changeSubscriptionPlan as apiChangePlan } from '@/lib/dodopayments'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'

export interface PlanRow {
  id: string
  name: string
  description: string | null
  price: number
  credits: number | null
  currency: string | null
  dodo_product_id: string
}

interface PlanGridProps {
  plans: PlanRow[]
  subscription: {
    subscription_id: string
    status: 'pending' | 'active' | 'cancelled' | 'expired'
    plan_name?: string
    next_billing_date?: string
    cancel_at_period_end?: boolean
    current_period_end?: string
    canceled_at?: string
  } | null
  isAuthenticated: boolean
}

export default function PlanGrid({ plans, subscription, isAuthenticated }: PlanGridProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [targetUpgrade, setTargetUpgrade] = useState<PlanRow | null>(null)

  const activePlanName = useMemo(() => {
    if (subscription?.status === 'active') {
      return subscription.plan_name || null
    }
    return null
  }, [subscription])

  const handlePlanClick = useCallback(async (plan: PlanRow) => {
    if (subscription?.status === 'active') {
      // Prompt upgrade/downgrade plan confirmation
      setTargetUpgrade(plan)
    }
  }, [subscription])

  const confirmUpgrade = useCallback(async () => {
    if (!targetUpgrade || !subscription?.subscription_id) return
    try {
      setBusy(true)
      await apiChangePlan(subscription.subscription_id, targetUpgrade.dodo_product_id, 'prorated_immediately', 1)
      setTargetUpgrade(null)
      alert(`Successfully changed your plan to ${targetUpgrade.name}!`)
      router.refresh()
    } catch (e: any) {
      console.error('Plan upgrade error:', e)
      alert(e?.message ?? 'Failed to upgrade plan.')
    } finally {
      setBusy(false)
    }
  }, [targetUpgrade, subscription, router])

  const formatPrice = (value: number | string, currency: string) => {
    const n = typeof value === 'number' ? value : Number(value || 0)
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
    } catch {
      return `$${n.toFixed(2)}`
    }
  }

  // Define tailored features for each tier to display in the grid
  const getFeatures = (planName: string) => {
    const name = planName.toLowerCase()
    if (name === 'lite') {
      return [
        '600 AI generation credits/mo',
        'Build ~20 screens per month',
        'Free blueprint brief planner',
        'Tailwind CSS component exports',
        'Figma design system matching',
      ]
    }
    if (name === 'starter') {
      return [
        '1,500 AI generation credits/mo',
        'Build ~50 screens per month',
        'Style reference image matching',
        'Priority AI generation speed',
        'All Lite features included',
      ]
    }
    // Pro
    return [
      '10,000 AI generation credits/mo',
      'Build ~333 screens per month',
      'Multi-screen system planning',
      'Unlimited Figma exports',
      'Priority developer support',
    ]
  }

  return (
    <div className="w-full max-w-6xl px-4 py-8">
      {/* Compare Plans Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200/50 dark:border-sky-800/30 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-[#1b7fcc]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#1b7fcc] dark:text-[#38bdf8]">Pricing & Upgrades</span>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-3 font-heading">
          Flexible, credit-backed subscription plans
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
          Drawgle consumes credits dynamically based on LLM execution costs. Choose a plan that fits your builder velocity.
        </p>
      </div>

      {/* 3-Column Plan Cards */}
      <div className="grid md:grid-cols-3 gap-6 items-stretch">
        {plans.map((p) => {
          const isActive = activePlanName?.toLowerCase() === p.name.toLowerCase()
          const features = getFeatures(p.name)
          const isStarter = p.name.toLowerCase() === 'starter'

          return (
            <Card
              key={p.id}
              className={`relative flex flex-col overflow-hidden transition-all duration-200 bg-white dark:bg-[#1a1d22] border ${
                isActive
                  ? 'ring-2 ring-[#1b7fcc] border-transparent shadow-[0_8px_30px_rgba(27,127,204,0.12)]'
                  : isStarter
                  ? 'border-[#1b7fcc]/40 dark:border-[#1b7fcc]/20 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
                  : 'border-slate-100 dark:border-white/[0.06] hover:border-slate-200 dark:hover:border-white/[0.12]'
              }`}
            >
              {/* Highlight Badge */}
              {isActive && (
                <div className="absolute top-0 right-0 bg-[#1b7fcc] text-white text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-bl-lg shadow-sm">
                  Active
                </div>
              )}
              {!isActive && isStarter && (
                <div className="absolute top-0 right-0 bg-[#1b7fcccc]/20 text-[#1b7fcc] dark:text-[#38bdf8] text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-bl-lg">
                  Most Popular
                </div>
              )}

              {/* Card Title & Desc */}
              <div className="p-6 border-b border-slate-50 dark:border-white/[0.04] text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {p.name}
                </h3>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1.5 min-h-[32px] leading-relaxed">
                  {p.description}
                </p>

                {/* Price block */}
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    {formatPrice(p.price, p.currency ?? 'USD')}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold">/mo</span>
                </div>

                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05]">
                  <Zap className="w-3 h-3 text-[#1b7fcc] fill-[#1b7fcc]/10" />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    {p.credits} Monthly Credits
                  </span>
                </div>
              </div>

              {/* Card Features List */}
              <div className="flex-1 p-6 flex flex-col gap-4 text-left">
                <ul className="space-y-3 flex-1">
                  {features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium leading-normal">
                      <Check className="w-4 h-4 text-[#1b7fcc] flex-shrink-0 mt-0.5" strokeWidth={3} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* Subscription Action Button */}
                <div className="pt-4 mt-auto">
                  {isActive ? (
                    <Button
                      variant="outline"
                      className="w-full h-10 font-bold uppercase tracking-wider text-xs border-[#1b7fcc]/40 text-[#1b7fcc] dark:text-[#38bdf8] opacity-80 cursor-not-allowed select-none bg-sky-50/10"
                      disabled
                    >
                      Current Plan
                    </Button>
                  ) : subscription?.status === 'active' ? (
                    <Button
                      onClick={() => handlePlanClick(p)}
                      disabled={busy}
                      className="w-full h-10 font-bold uppercase tracking-wider text-xs text-white bg-[#1b7fcc] hover:bg-[#1b7fcc]/90 transition-all active:scale-[0.98]"
                    >
                      Upgrade to {p.name}
                    </Button>
                  ) : (
                    <SubscribeButton
                      productId={p.dodo_product_id}
                      isAuthenticated={isAuthenticated}
                      className="w-full cursor-pointer h-10 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-xs bg-gradient-to-b from-[#1b7fcc] to-[#146ba8] hover:from-[#248fdc] hover:to-[#1777b8] transition-all active:scale-[0.98]"
                    >
                      Choose {p.name}
                    </SubscribeButton>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Security note */}
      <div className="mt-8 flex items-center justify-center gap-2 opacity-50 dark:opacity-40">
        <ShieldCheck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Securely handled by Dodo Payments. Cancel anytime with 1-click.
        </span>
      </div>

      {/* Plan upgrade confirmation */}
      <ConfirmationDialog
        isOpen={targetUpgrade !== null}
        onClose={() => setTargetUpgrade(null)}
        onConfirm={confirmUpgrade}
        title={`Change plan to ${targetUpgrade?.name}?`}
        description={`Confirming will transition your subscription to the ${targetUpgrade?.name} plan immediately. Dodo Payments will automatically prorate your billing for the current period so you only pay for what you use.`}
        confirmText="Confirm change"
        cancelText="Cancel"
      />
    </div>
  )
}
