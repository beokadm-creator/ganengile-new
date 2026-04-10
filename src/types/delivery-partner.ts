export type DeliveryPartnerType =
  | 'quick_service'
  | 'delivery_agency'
  | 'last_mile_carrier'
  | 'regional_courier'
  | 'custom';

export type DeliveryPartnerStatus = 'active' | 'inactive' | 'suspended' | 'testing';

export type DeliveryPartnerIntegrationMode = 'manual_ops' | 'api' | 'csv_batch' | 'email_dispatch';

export type DeliveryPartnerCapability =
  | 'station_to_station'
  | 'address_pickup'
  | 'address_dropoff'
  | 'same_day'
  | 'urgent'
  | 'night_delivery'
  | 'heavy_item'
  | 'fragile_item';

export type DeliveryPartnerCoverageArea = {
  region?: string;
  district?: string;
  stationIds?: string[];
  postalCodes?: string[];
};

export type DeliveryPartnerPricingPolicy = {
  baseFee?: number;
  distanceFeePerKm?: number;
  weightSurchargePerKg?: number;
  urgentSurcharge?: number;
  minimumFee?: number;
  currency?: 'KRW';
};

export type DeliveryPartnerSLA = {
  estimatedPickupMinutes?: number;
  estimatedCompletionMinutes?: number;
  supportHours?: string;
};

export type DeliveryPartnerContact = {
  name?: string;
  phone?: string;
  email?: string;
  dispatchChannel?: string;
};

export type DeliveryPartnerMissionCapability =
  | 'pickup'
  | 'dropoff'
  | 'subway_transport'
  | 'last_mile'
  | 'locker_dropoff'
  | 'locker_pickup'
  | 'meetup_handover';

export type DeliveryPartnerOrchestrationConfig = {
  actorType: 'external_partner';
  enabled: boolean;
  priorityScore: number;
  supportsFullDelivery: boolean;
  supportsPartialLegs: boolean;
  supportedMissionTypes: DeliveryPartnerMissionCapability[];
  fallbackOnly?: boolean;
};

export type DeliveryPartnerConnectionStatus = 'unknown' | 'connected' | 'degraded' | 'error';

export interface DeliveryPartner {
  partnerId: string;
  partnerName: string;
  partnerType: DeliveryPartnerType;
  status: DeliveryPartnerStatus;
  capabilities: DeliveryPartnerCapability[];
  coverage: DeliveryPartnerCoverageArea[];
  integrationMode: DeliveryPartnerIntegrationMode;
  pricingPolicy?: DeliveryPartnerPricingPolicy;
  sla?: DeliveryPartnerSLA;
  contact?: DeliveryPartnerContact;
  orchestration?: DeliveryPartnerOrchestrationConfig;
  connectionStatus?: DeliveryPartnerConnectionStatus;
  lastConnectionCheckedAt?: Date;
  lastConnectionMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeliveryPartnerData {
  partnerName: string;
  partnerType: DeliveryPartnerType;
  capabilities: DeliveryPartnerCapability[];
  coverage?: DeliveryPartnerCoverageArea[];
  integrationMode: DeliveryPartnerIntegrationMode;
  pricingPolicy?: DeliveryPartnerPricingPolicy;
  sla?: DeliveryPartnerSLA;
  contact?: DeliveryPartnerContact;
  orchestration?: Partial<DeliveryPartnerOrchestrationConfig>;
  metadata?: Record<string, unknown>;
  status?: DeliveryPartnerStatus;
}

export type DeliveryPartnerDispatchMethod = 'api' | 'manual_dashboard' | 'phone' | 'email';

export type DeliveryPartnerDispatchStatusType =
  | 'queued'
  | 'requested'
  | 'accepted'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DeliveryPartnerDispatchRequest {
  missionId: string;
  requestId: string;
  deliveryId?: string;
  deliveryLegId?: string;
  partnerCapability?: DeliveryPartnerCapability;
  payload?: Record<string, unknown>;
  originRef?: unknown;
  destinationRef?: unknown;
}

export interface DeliveryPartnerDispatch {
  dispatchId: string;
  partnerId: string;
  missionId: string;
  requestId: string;
  deliveryId?: string;
  deliveryLegId?: string;
  partnerCapability?: DeliveryPartnerCapability;
  dispatchMethod: DeliveryPartnerDispatchMethod;
  status: DeliveryPartnerDispatchStatusType;
  originRef?: unknown;
  destinationRef?: unknown;
  payload?: Record<string, unknown>;
  requestedAt?: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  rawResponse?: Record<string, unknown>;
  opsMemo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeliveryPartnerDispatchData extends DeliveryPartnerDispatchRequest {
  partnerId: string;
  dispatchMethod: DeliveryPartnerDispatchMethod;
  opsMemo?: string;
}

export interface DeliveryPartnerQuote {
  partnerId: string;
  estimatedPickupMinutes: number;
  estimatedCompletionMinutes: number;
  quotedCost: number;
  successRate: number;
  coverageScore: number;
  available: boolean;
}

export interface DeliveryPartnerAdapter {
  partnerId: string;
  quoteMission(request: DeliveryPartnerDispatchRequest): Promise<DeliveryPartnerQuote>;
  createDispatch(request: DeliveryPartnerDispatchRequest): Promise<DeliveryPartnerDispatch>;
  cancelDispatch(dispatchId: string): Promise<void>;
  getDispatchStatus(dispatchId: string): Promise<DeliveryPartnerDispatch>;
  mapWebhookEvent(payload: Record<string, unknown>): DeliveryPartnerDispatch;
}
