export interface PriceInfo {
  monthly: { amount: number; currency: string };
  annual: { amount: number; currency: string };
}

export interface BillingStatus {
  isPremium: boolean;
  premiumGranted: boolean;
  premiumExpiresAt: string | null;
  subscription: {
    status: string;
    stripePriceId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

export interface ReferralInfo {
  code: string;
  maxRedemptions: number | null;
  currentRedemptions: number;
}
