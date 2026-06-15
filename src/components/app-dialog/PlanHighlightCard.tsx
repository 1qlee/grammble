import { Check, LoaderCircle } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Radio, RadioGroup } from '@headlessui/react'
import Badge from '~/components/ui/Badge'
import Button from '~/components/buttons/Button'
import type { User } from '~/prisma-generated/browser'

const PREMIUM_BENEFITS = [
  'Play past puzzles in the archive',
  'Access 7 and 8 letter game modes',
  'Participate in the leaderboards',
  'Cancel any time',
]

type Props = {
  interval: 'monthly' | 'annual'
  onIntervalChange: (interval: 'monthly' | 'annual') => void
  annualPerMonth: string | null
  annualTotal: string | null
  monthlyPrice: string | null
  user: User | undefined
  checkoutLoading: boolean
  onCheckout: () => void
  onClose?: () => void
  upsellWordLength?: number | null
}

const planCardCls =
  'group flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 cursor-pointer transition-colors data-checked:border-yellow-300 data-checked:ring-1 data-checked:ring-yellow-300 focus:outline-none'

export default function PlanHighlightCard({
  interval,
  onIntervalChange,
  annualPerMonth,
  annualTotal,
  monthlyPrice,
  user,
  checkoutLoading,
  onCheckout,
  onClose,
  upsellWordLength,
}: Props) {
  const isAnnual = interval === 'annual'
  const heading = upsellWordLength
    ? `Access the ${upsellWordLength}-letter puzzle`
    : 'Go Premium'
  const subtext = upsellWordLength
    ? 'Pick a plan to access premium game modes along with additional features.'
    : 'Pick a plan to access additional features.'
  const formattedAnnualTotal = annualTotal?.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') ?? null
  const ctaTotal = isAnnual ? formattedAnnualTotal : monthlyPrice

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold">{heading}</h2>
        <p className="text-sm text-accent">{subtext}</p>
      </div>

      <RadioGroup value={interval} onChange={onIntervalChange} className="space-y-3">
        <Radio value="annual" className={planCardCls}>
          <span className="flex w-5 h-5 shrink-0 items-center justify-center rounded-full border-2 border-zinc-400 group-data-checked:border-yellow-300">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-300 opacity-0 group-data-checked:opacity-100" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold">Annual</span>
              <Badge className="bg-yellow-300 text-zinc-900 uppercase text-xxs">Best Value</Badge>
            </div>
            <p className="text-xs text-accent mt-0.5">
              {formattedAnnualTotal ? `${formattedAnnualTotal} billed yearly.` : 'Billed yearly.'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold price-gold leading-none">
              {annualPerMonth ?? '—'}
            </div>
            <div className="text-xs text-accent mt-1">
              {monthlyPrice && <span className="line-through mr-1">{monthlyPrice}</span>}
              per month
            </div>
          </div>
        </Radio>

        <Radio value="monthly" className={planCardCls}>
          <span className="flex w-5 h-5 shrink-0 items-center justify-center rounded-full border-2 border-zinc-400 group-data-checked:border-yellow-300">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-300 opacity-0 group-data-checked:opacity-100" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold">Monthly</p>
            <p className="text-xs text-accent mt-0.5">{monthlyPrice} billed monthly.</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold leading-none">{monthlyPrice ?? '—'}</div>
            <div className="text-xs text-accent mt-1">per month</div>
          </div>
        </Radio>
      </RadioGroup>

      <div className="my-6">
        {user ? (
          <Button onClick={onCheckout} aria-disabled={checkoutLoading} variant="gold" className="w-full">
            {checkoutLoading ? (
              <LoaderCircle className="animate-spin w-4 h-4" />
            ) : (
              <span>Start Premium{ctaTotal ? ` · ${ctaTotal}` : ''}</span>
            )}
          </Button>
        ) : (
          <Link to="/signup" search={{ checkout: interval }} className="no-underline w-full" onClick={onClose}>
            <Button className="w-full" variant="gold">Sign up</Button>
          </Link>
        )}
      </div>

      <div className="my-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">What's included</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {PREMIUM_BENEFITS.map((text) => (
            <div key={text} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-yellow-300" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
