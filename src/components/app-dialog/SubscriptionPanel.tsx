import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { User } from '~/prisma-generated/browser'
import type { BillingStatus, PriceInfo } from './AppDialog.types'
import Alert from '~/components/ui/Alert'
import Badge from '~/components/ui/Badge'
import Button from '~/components/buttons/Button'
import PlanHighlightCard from './PlanHighlightCard'

function formatPrice(cents: number, currency: string, fractionDigits?: number) {
  const amount = cents / 100
  const digits = fractionDigits ?? (amount % 1 === 0 ? 0 : 2)
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}


type Props = {
  user: User | undefined
  billing: BillingStatus | null
  prices: PriceInfo | null
  onClose?: () => void
  upsellWordLength?: number | null
}

export default function PremiumUpsellPanel({ user, billing, prices, onClose, upsellWordLength }: Props) {
  const [loadingInterval, setLoadingInterval] = useState<'monthly' | 'annual' | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async (interval: 'monthly' | 'annual') => {
    setLoadingInterval(interval)
    setError(null)
    try {
      const res = await fetch('/api/trpc/billing.createCheckout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { interval } }),
      })
      const data = await res.json()
      const url = data?.result?.data?.json?.url
      if (url) {
        window.location.href = url
      } else {
        const msg = data?.error?.json?.message || 'Failed to create checkout session.'
        setError(msg)
        setLoadingInterval(null)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoadingInterval(null)
    }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/trpc/billing.createPortalSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: {} }),
      })
      const data = await res.json()
      const url = data?.result?.data?.json?.url
      if (url) {
        window.location.href = url
      } else {
        setPortalLoading(false)
      }
    } catch {
      setPortalLoading(false)
    }
  }

  // Lifetime premium
  if (billing?.premiumGranted) {
    return (
      <div className="flex justify-between items-center gap-2 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800">
        <div>
          <p className="text-sm font-medium">Lifetime Premium</p>
          <p className="text-xs text-accent">
            No subscription required, ever.
          </p>
        </div>
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Active</Badge>
      </div>
    )
  }

  // Active subscription
  if (billing?.subscription?.status === 'ACTIVE') {
    const periodEnd = billing.subscription.currentPeriodEnd
      ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
      : 'N/A'
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-lg bg-accent">
          <div className="flex justify-between items-center w-full mb-4">
            <div>
              <p className="font-medium">Premium Subscription</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {billing.subscription.cancelAtPeriodEnd
                  ? `Cancels on ${periodEnd}`
                  : `Next billing date: ${periodEnd}`}
              </p>
            </div>
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Active</Badge>
          </div>
          <Button onClick={handlePortal} aria-disabled={portalLoading} className="w-full">
            {portalLoading ? (
              <LoaderCircle className="animate-spin w-4 h-4" />
            ) : (
              'Manage Subscription'
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Upsell (not premium, free trial, or unauthenticated)
  const annualPerMonth = prices ? formatPrice(prices.annual.amount / 12, prices.annual.currency) : null
  const annualTotal = prices ? formatPrice(prices.annual.amount, prices.annual.currency, 2) : null
  const monthlyPrice = prices ? formatPrice(prices.monthly.amount, prices.monthly.currency) : null

  return (
    <div className="space-y-3 rounded-lg">
      <PlanHighlightCard
        annualPerMonth={annualPerMonth}
        annualTotal={annualTotal}
        monthlyPrice={monthlyPrice}
        user={user}
        loadingInterval={loadingInterval}
        onCheckout={handleCheckout}
        onClose={onClose}
        upsellWordLength={upsellWordLength}
      />

      {error && <Alert type="error">{error}</Alert>}
    </div>
  )
}
