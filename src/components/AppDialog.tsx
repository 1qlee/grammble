import { useState, useEffect } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { User } from '~/prisma-generated/browser'
import PromoCodeSection from './app-dialog/PromoCodeSection'
import ReferralSection from './app-dialog/ReferralSection'
import SettingsPanel from './app-dialog/SettingsPanel'
import { useGameStore } from '~/stores/game-store'
import { useAppDialogStore } from '~/hooks/useAppDialog'
import { WORD_LENGTH_BY_MODE } from '~/utils/game/constants'
import type { BillingStatus, ReferralInfo, PriceInfo } from './app-dialog/AppDialog.types'
import Dialog from './ui/Dialog'
import SubscriptionPanel from './app-dialog/SubscriptionPanel'
import Tabs from './ui/Tabs'

export type AppDialogTab = 'settings' | 'subscription'

const TAB_OPTIONS: [{ label: string; value: AppDialogTab }, { label: string; value: AppDialogTab }] = [
  { label: 'Settings', value: 'settings' },
  { label: 'Subscription', value: 'subscription' },
]

type AppDialogProps = {
  isOpen: boolean
  initialTab: AppDialogTab
  onClose: () => void
  user: User | undefined
}

export default function AppDialog({ isOpen, initialTab, onClose, user }: AppDialogProps) {
  const pauseGame = useGameStore((s) => s.pauseGame)
  const resumeGame = useGameStore((s) => s.resumeGame)
  const upsellMode = useAppDialogStore((s) => s.upsellMode)
  const upsellWordLength = upsellMode ? WORD_LENGTH_BY_MODE[upsellMode] : null

  const [activeTab, setActiveTab] = useState<AppDialogTab>(initialTab)

  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [referral, setReferral] = useState<ReferralInfo | null>(null)
  const [prices, setPrices] = useState<PriceInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab)
  }, [isOpen, initialTab])

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/trpc/billing.getPrices')
        const data = await res.json()
        setPrices(data?.result?.data?.json ?? null)
      } catch {
        // non-critical, price cards will stay in skeleton state
      }
    }
    fetchPrices()
  }, [])

  useEffect(() => {
    if (!user) {
      setBilling(null)
      setReferral(null)
      return
    }
    if (!isOpen) return

    const fetchAccountData = async () => {
      setLoading(true)
      try {
        const [billingRes, referralRes] = await Promise.all([
          fetch('/api/trpc/billing.getStatus'),
          fetch('/api/trpc/billing.getReferralInfo'),
        ])
        const [billingData, referralData] = await Promise.all([
          billingRes.json(),
          referralRes.json(),
        ])
        setBilling(billingData?.result?.data?.json ?? null)
        setReferral(referralData?.result?.data?.json ?? null)
      } catch {
        // child components handle their own error states
      } finally {
        setLoading(false)
      }
    }

    fetchAccountData()
  }, [isOpen, user?.id])

  return (
    <Dialog
      isOpen={isOpen}
      setIsOpen={(open) => { if (!open) onClose() }}
      onOpen={pauseGame}
      onClose={resumeGame}
    >
      <div className="p-4 pb-0 pr-12">
        <Tabs
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className="h-[360px] overflow-y-auto scrollbar-thin p-4">
        {activeTab === 'settings' && <SettingsPanel />}

        {activeTab === 'subscription' && (
          loading ? (
            <div className="flex justify-center py-4">
              <LoaderCircle className="animate-spin w-5 h-5" />
            </div>
          ) : user?.isPremium ? (
            <div className="space-y-2">
              <SubscriptionPanel user={user} billing={billing} prices={prices} onClose={onClose} upsellWordLength={upsellWordLength} />
              {billing?.premiumExpiresAt && !billing?.premiumGranted && <PromoCodeSection />}
              {billing?.premiumGranted && <ReferralSection referral={referral} />}
            </div>
          ) : (
            <SubscriptionPanel user={user} billing={billing} prices={prices} onClose={onClose} upsellWordLength={upsellWordLength} />
          )
        )}
      </div>
    </Dialog>
  )
}
