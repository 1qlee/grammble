import { Check, ChevronRight, LoaderCircle } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import Badge from '~/components/ui/Badge'
import type { User } from '~/prisma-generated/browser'

const PREMIUM_BENEFITS = [
  { title: 'Full puzzle archive', desc: 'play every past daily puzzle' },
  { title: '7 & 8 letter modes', desc: 'unlock the harder game modes' },
  { title: 'Leaderboards', desc: 'compete for the top ranks' },
  { title: 'Cancel anytime', desc: 'no strings attached' },
]

type Interval = 'monthly' | 'annual'

type Props = {
  annualPerMonth: string | null
  annualTotal: string | null
  monthlyPrice: string | null
  savePercent: number | null
  user: User | undefined
  loadingInterval: Interval | null
  onCheckout: (interval: Interval) => void
  onClose?: () => void
  upsellWordLength?: number | null
}

const labelCls = 'font-mono text-xxs font-semibold tracking-widest uppercase'

const tileBaseCls =
  'group relative flex flex-col items-start gap-1 rounded-xl px-4 py-4 text-left cursor-pointer select-none no-underline transition-all active:translate-y-[2px]'

function PlanTile({
  interval,
  label,
  price,
  sub,
  badge,
  gold,
  loading,
  user,
  onCheckout,
  onClose,
}: {
  interval: Interval
  label: string
  price: string
  sub: string
  badge?: React.ReactNode
  gold?: boolean
  loading: boolean
  user: User | undefined
  onCheckout: (interval: Interval) => void
  onClose?: () => void
}) {
  const surface = gold
    ? 'bg-linear-to-b from-yellow-300 to-yellow-400 text-zinc-900 border-2 border-yellow-500 shadow-[0_4px_0_var(--color-yellow-600)] active:shadow-[0_2px_0_var(--color-yellow-600)]'
    : 'bg-linear-to-b from-zinc-800 to-zinc-900 text-zinc-100 border-2 border-zinc-700 shadow-[0_4px_0_#000] active:shadow-[0_2px_0_#000]'
  const mutedCls = gold ? 'text-zinc-700' : 'text-zinc-400'

  const content = (
    <>
      {badge && <div className="absolute top-0 left-3 -translate-y-1/2">{badge}</div>}
      <span className="text-sm font-bold">{label}</span>
      <span className="text-2xl font-bold leading-none">{price}</span>
      <span className={clsx('text-xxs', mutedCls)}>{sub}</span>
      <div className={clsx('mt-auto pt-3 flex items-center gap-1 text-xxs font-semibold', mutedCls)}>
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <>
            CONTINUE
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
      </div>
    </>
  )

  if (user) {
    return (
      <button
        type="button"
        onClick={() => onCheckout(interval)}
        aria-disabled={loading}
        className={clsx(tileBaseCls, surface)}
      >
        {content}
      </button>
    )
  }

  return (
    <Link
      to="/signup"
      search={{ checkout: interval }}
      onClick={onClose}
      className={clsx(tileBaseCls, surface)}
    >
      {content}
    </Link>
  )
}

export default function PlanHighlightCard({
  annualPerMonth,
  annualTotal,
  monthlyPrice,
  savePercent,
  user,
  loadingInterval,
  onCheckout,
  onClose,
  upsellWordLength,
}: Props) {
  const heading = upsellWordLength
    ? `Access the ${upsellWordLength}-letter puzzle`
    : 'Grammble Premium'
  const formattedAnnualTotal =
    annualTotal?.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') ?? null

  return (
    <div>

      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-1">{heading}</h2>
        <p className="text-sm text-accent">Click a plan below to continue.</p>
      </div>

      <p className={clsx(labelCls, 'mb-3 text-zinc-500 dark:text-zinc-400')}>Choose a plan</p>
      <div className="grid grid-cols-2 gap-3">
        <PlanTile
          interval="annual"
          label="Annual"
          price={annualPerMonth ?? '—'}
          sub={
            [
              formattedAnnualTotal ? `${formattedAnnualTotal}/yr` : null,
              savePercent && savePercent > 0 ? `save ${savePercent}%` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'per month'
          }
          badge={<Badge className="bg-linear-to-b from-yellow-300 to-yellow-500 text-zinc-900 border border-yellow-600 uppercase text-xxs h-auto py-0.5">Best Value</Badge>}
          gold
          loading={loadingInterval === 'annual'}
          user={user}
          onCheckout={onCheckout}
          onClose={onClose}
        />
        <PlanTile
          interval="monthly"
          label="Monthly"
          price={monthlyPrice ?? '—'}
          sub="per month"
          loading={loadingInterval === 'monthly'}
          user={user}
          onCheckout={onCheckout}
          onClose={onClose}
        />
      </div>

      <div className="mt-8">
        <p className={clsx(labelCls, 'mb-4 text-zinc-500 dark:text-zinc-400')}>Included in premium</p>
        <ul className="space-y-3">
          {PREMIUM_BENEFITS.map(({ title, desc }) => (
            <li key={title} className="flex items-start gap-2.5 text-sm">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 mt-0.5 dark:bg-green-900/60 dark:text-green-400">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              <span>
                <span className="font-semibold">{title}</span>{' '}
                <span className="text-accent">— {desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
