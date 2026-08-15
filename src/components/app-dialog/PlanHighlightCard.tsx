import { Check, ChevronRight, LoaderCircle } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import Badge from '~/components/ui/Badge'
import type { User } from '~/prisma-generated/browser'

const PREMIUM_BENEFITS = [
  { title: 'Full puzzle archive', desc: 'play every past daily puzzle' },
  { title: '7 & 8 letter modes', desc: 'unlock the harder game modes' },
  { title: 'Score analysis', desc: 'get a detailed breakdown of your score' },
  { title: 'Cancel anytime', desc: 'no strings attached' },
]

type Interval = 'monthly' | 'annual'

type Props = {
  annualPerMonth: string | null
  annualTotal: string | null
  monthlyPrice: string | null
  user: User | undefined
  loadingInterval: Interval | null
  onCheckout: (interval: Interval) => void
  onClose?: () => void
  upsellWordLength?: number | null
}

const labelCls = 'text-xxs font-semibold tracking-widest uppercase'

const tileBaseCls =
  'group relative flex flex-col items-start gap-1 rounded-lg px-4 py-4 text-left cursor-pointer select-none no-underline transition-colors'

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
    ? 'bg-yellow-300 text-zinc-900 border border-yellow-500 hover:bg-yellow-400 active:bg-yellow-400'
    : 'bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 active:bg-zinc-700'
  const mutedCls = gold ? 'text-zinc-700' : 'text-zinc-400'

  const content = (
    <>
      {badge && <div className="absolute top-0 left-3 -translate-y-1/2">{badge}</div>}
      <span className="text-sm font-bold">{label}</span>
      <span className="text-2xl font-bold leading-none">
        {price}
        <span className={clsx('text-sm font-semibold', mutedCls)}> /mo</span>
      </span>
      <span className={clsx('text-sm', mutedCls)}>{sub}</span>
      <div className={clsx('mt-auto pt-3 flex items-center gap-1 text-sm font-semibold', mutedCls)}>
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <>
            CONTINUE
            <ChevronRight className="h-4 w-4" />
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
  user,
  loadingInterval,
  onCheckout,
  onClose,
  upsellWordLength,
}: Props) {
  const heading = upsellWordLength
    ? `Access the ${upsellWordLength}-letter puzzle`
    : 'grammble Premium'
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
          sub={formattedAnnualTotal ? `${formattedAnnualTotal} billed annually` : 'billed annually'}
          badge={<Badge className="bg-yellow-400 text-zinc-900 border border-yellow-600 uppercase text-xxs h-auto py-0.5">Best Value</Badge>}
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
          sub="billed monthly"
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
