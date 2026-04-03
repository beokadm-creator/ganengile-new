export interface Location {
  station: string;
  address: string;
  contact: string;
}

export interface ContractDuration {
  start: Date;
  end: Date;
  minDuration: number;
  autoRenew: boolean;
}

export interface DeliverySettings {
  frequency: 'daily' | 'weekly' | 'biweekly';
  preferredDays?: string[];
  preferredTime: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  instructions?: string;
}

export interface BillingInfo {
  method: 'card' | 'invoice' | 'transfer';
  cycle: 'monthly' | 'quarterly';
  accountNumber?: string;
}

export type ContractStatus = 'pending' | 'active' | 'suspended' | 'cancelled';
export type SubscriptionTier = 'basic' | 'standard' | 'premium';

export interface BusinessContract {
  id: string;
  businessId: string;
  tier: SubscriptionTier;
  duration: ContractDuration;
  deliverySettings: DeliverySettings;
  billing: BillingInfo;
  status: ContractStatus;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const SUBSCRIPTION_TIERS = {
  basic: {
    pricing: {
      monthly: 50000,
      perDelivery: 3000,
    },
    features: {
      maxDeliveries: 20,
      priority: 'low' as const,
      support: 'email' as const,
      insurance: false,
      analytics: false,
    },
    idealFor: ['소규모 카페', '개인 매장'],
  },
  standard: {
    pricing: {
      monthly: 150000,
      perDelivery: 2500,
    },
    features: {
      maxDeliveries: 100,
      priority: 'medium' as const,
      support: 'phone' as const,
      insurance: true,
      analytics: true,
    },
    idealFor: ['프랜차이즈 카페', '중소기업'],
  },
  premium: {
    pricing: {
      monthly: 500000,
      perDelivery: 2000,
    },
    features: {
      maxDeliveries: 500,
      priority: 'high' as const,
      support: 'dedicated' as const,
      insurance: true,
      analytics: true,
    },
    idealFor: ['대형 프랜차이즈', '다지점 운영'],
  },
} as const;
