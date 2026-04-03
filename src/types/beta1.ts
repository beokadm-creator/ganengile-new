import { Timestamp } from 'firebase/firestore';

export type LocationRefType = 'station' | 'address' | 'locker';

export type DeliveryLegType =
  | 'pickup_address'
  | 'pickup_station'
  | 'locker_dropoff'
  | 'locker_pickup'
  | 'subway_transport'
  | 'meetup_handover'
  | 'last_mile_address';

export type DeliveryActorType =
  | 'requester'
  | 'giller'
  | 'external_partner'
  | 'locker'
  | 'system';

export type QuoteType = 'fastest' | 'balanced' | 'lowest_price' | 'locker_included';

export type MissionType =
  | 'pickup'
  | 'dropoff'
  | 'locker_dropoff'
  | 'locker_pickup'
  | 'subway_transport'
  | 'meetup_handover'
  | 'last_mile';

export type AIInterventionLevel =
  | 'assist'
  | 'recommend'
  | 'guarded_execute'
  | 'human_review'
  | 'disallowed';

export enum RequestDraftStatus {
  DRAFT = 'draft',
  ANALYZING = 'analyzing',
  READY_FOR_REVIEW = 'ready_for_review',
  PRICING_READY = 'pricing_ready',
  SUBMITTED = 'submitted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum AIAnalysisStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  LOW_CONFIDENCE = 'low_confidence',
  FAILED = 'failed',
}

export enum PricingQuoteStatus {
  DRAFT = 'draft',
  CALCULATED = 'calculated',
  PRESENTED = 'presented',
  SELECTED = 'selected',
  EXPIRED = 'expired',
}

export enum Beta1RequestStatus {
  SUBMITTED = 'submitted',
  MATCH_PENDING = 'match_pending',
  MATCH_PROPOSED = 'match_proposed',
  MATCH_CONFIRMED = 'match_confirmed',
  CANCELLED = 'cancelled',
  CLOSED = 'closed',
}

export enum Beta1DeliveryStatus {
  CREATED = 'created',
  ASSIGNED = 'assigned',
  ACCEPTED = 'accepted',
  PICKUP_IN_PROGRESS = 'pickup_in_progress',
  IN_TRANSIT = 'in_transit',
  HANDOVER_PENDING = 'handover_pending',
  AT_LOCKER = 'at_locker',
  LAST_MILE_IN_PROGRESS = 'last_mile_in_progress',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}

export enum DeliveryLegStatus {
  PENDING = 'pending',
  READY = 'ready',
  IN_PROGRESS = 'in_progress',
  HANDOVER_PENDING = 'handover_pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum HandoverEventStatus {
  SCHEDULED = 'scheduled',
  WAITING = 'waiting',
  VERIFIED = 'verified',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum MissionStatus {
  PLANNED = 'planned',
  QUEUED = 'queued',
  OFFERED = 'offered',
  ACCEPTED = 'accepted',
  ARRIVAL_PENDING = 'arrival_pending',
  HANDOVER_PENDING = 'handover_pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  REASSIGNING = 'reassigning',
}

export enum MissionBundleStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ActorSelectionActorType {
  GILLER = 'giller',
  EXTERNAL_PARTNER = 'external_partner',
  LOCKER = 'locker',
  REQUESTER = 'requester',
}

export interface LocationRef {
  type: LocationRefType;
  stationId?: string;
  stationName?: string;
  lockerId?: string;
  addressText?: string;
  roadAddress?: string;
  detailAddress?: string;
  latitude?: number;
  longitude?: number;
}

export interface PhotoAsset {
  photoId: string;
  ownerUserId: string;
  requestDraftId?: string;
  requestId?: string;
  deliveryId?: string;
  purpose: 'item' | 'pickup' | 'dropoff' | 'chat' | 'evidence';
  url: string;
  thumbnailUrl?: string;
  status: 'uploaded' | 'analyzing' | 'usable' | 'needs_retry' | 'rejected';
  metadata?: {
    mimeType?: string;
    width?: number;
    height?: number;
    fileSize?: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RequestDraft {
  requestDraftId: string;
  requesterUserId: string;
  requestMode?: 'immediate' | 'reservation';
  sourceRequestId?: string;
  originType: LocationRefType;
  destinationType: LocationRefType;
  originRef: LocationRef;
  destinationRef: LocationRef;
  selectedPhotoIds: string[];
  selectedPricingQuoteId?: string;
  aiAnalysisId?: string;
  packageDraft?: {
    itemName?: string;
    category?: string;
    description?: string;
    estimatedValue?: number;
    estimatedWeightKg?: number;
    estimatedSize?: 'small' | 'medium' | 'large' | 'xl';
    isFragile?: boolean;
    isPerishable?: boolean;
  };
  recipient?: {
    name?: string;
    phone?: string;
  };
  preferredSchedule?: {
    pickupTime?: string;
    arrivalTime?: string;
  };
  status: RequestDraftStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AIAnalysis {
  aiAnalysisId: string;
  requestDraftId: string;
  requesterUserId: string;
  inputPhotoIds: string[];
  provider: string;
  model: string;
  confidence: number;
  status: AIAnalysisStatus;
  result?: {
    itemName?: string;
    category?: string;
    description?: string;
    estimatedValue?: number;
    estimatedWeightKg?: number;
    estimatedSize?: 'small' | 'medium' | 'large' | 'xl';
    riskFlags?: string[];
    handlingNotes?: string[];
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PricingQuote {
  pricingQuoteId: string;
  requestDraftId: string;
  requesterUserId: string;
  quoteType: QuoteType;
  pricingVersion: string;
  selectedDeliveryOption: {
    speedLabel: string;
    includesLocker: boolean;
    includesAddressPickup: boolean;
    includesAddressDropoff: boolean;
    requestMode?: 'immediate' | 'reservation';
    preferredPickupTime?: string;
    preferredArrivalTime?: string;
  };
  suggestedByAI?: {
    startingPrice?: number;
    suggestedDeposit?: number;
  };
  finalPricing: {
    publicPrice: number;
    depositAmount: number;
    baseFee: number;
    distanceFee: number;
    weightFee: number;
    sizeFee: number;
    urgencySurcharge: number;
    publicFare: number;
    lockerFee: number;
    addressPickupFee: number;
    addressDropoffFee: number;
    serviceFee: number;
    vat: number;
  };
  status: PricingQuoteStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DeliveryLeg {
  deliveryLegId: string;
  deliveryId: string;
  requestId: string;
  legType: DeliveryLegType;
  actorType: DeliveryActorType;
  sequence: number;
  originRef: LocationRef;
  destinationRef: LocationRef;
  status: DeliveryLegStatus;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface HandoverEvent {
  handoverEventId: string;
  deliveryId: string;
  deliveryLegId: string;
  requestId: string;
  eventType:
    | 'pickup_verified'
    | 'locker_stored'
    | 'locker_retrieved'
    | 'meetup_confirmed'
    | 'dropoff_verified';
  status: HandoverEventStatus;
  actorUserId?: string;
  photoIds?: string[];
  verificationCode?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Mission {
  missionId: string;
  requestId: string;
  deliveryId: string;
  deliveryLegId: string;
  sequence: number;
  missionType: MissionType;
  status: MissionStatus;
  originRef: LocationRef;
  destinationRef: LocationRef;
  windowStartAt?: Timestamp;
  windowEndAt?: Timestamp;
  recommendedReward?: number;
  minimumReward?: number;
  currentReward?: number;
  raiseStep?: number;
  raiseIntervalMinutes?: number;
  raiseMaxReward?: number;
  assignedGillerUserId?: string;
  nextMissionId?: string;
  fallbackPlanId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MissionBundle {
  missionBundleId: string;
  requestId: string;
  deliveryId: string;
  missionIds: string[];
  status: MissionBundleStatus;
  strategy: 'single_actor' | 'multi_actor' | 'locker_assisted' | 'partner_fallback';
  bundleType?: 'single_leg' | 'contiguous_range';
  startSequence?: number;
  endSequence?: number;
  title?: string;
  summary?: string;
  windowLabel?: string;
  rewardTotal?: number;
  recommendedActorType?: ActorSelectionActorType;
  candidateGillerUserIds?: string[];
  selectedGillerUserId?: string;
  requiresExternalPartner?: boolean;
  fallbackDeliveryIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ActorSelectionDecision {
  decisionId: string;
  requestId: string;
  deliveryId?: string;
  deliveryLegId?: string;
  missionId?: string;
  interventionLevel: AIInterventionLevel;
  selectedActorType: ActorSelectionActorType;
  selectedPartnerId?: string;
  selectionReason: string;
  fallbackActorTypes: ActorSelectionActorType[];
  fallbackPartnerIds?: string[];
  manualReviewRequired: boolean;
  riskFlags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PartnerMissionQuote {
  partnerId: string;
  estimatedPickupMinutes: number;
  estimatedCompletionMinutes: number;
  quotedCost: number;
  successRate: number;
  coverageScore: number;
  available: boolean;
}

export interface ExternalPartnerDispatchRequest {
  missionId: string;
  requestId: string;
  originRef: LocationRef;
  destinationRef: LocationRef;
  payload?: Record<string, unknown>;
}

export interface ExternalPartnerDispatchStatus {
  dispatchId: string;
  partnerId: string;
  status: 'queued' | 'dispatched' | 'accepted' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  raw?: Record<string, unknown>;
}

export interface ExternalPartnerAdapter {
  partnerId: string;
  quoteMission(request: ExternalPartnerDispatchRequest): Promise<PartnerMissionQuote>;
  createDispatch(request: ExternalPartnerDispatchRequest): Promise<ExternalPartnerDispatchStatus>;
  cancelDispatch(dispatchId: string): Promise<void>;
  getDispatchStatus(dispatchId: string): Promise<ExternalPartnerDispatchStatus>;
  mapWebhookEvent(payload: Record<string, unknown>): ExternalPartnerDispatchStatus;
}
