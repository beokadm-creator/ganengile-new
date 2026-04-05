import { DeliveryStatus } from '../types/delivery';
import { RequestStatus } from '../types/request';
import {
  AIAnalysisStatus,
  Beta1DeliveryStatus,
  Beta1RequestStatus,
  DeliveryLegStatus,
  HandoverEventStatus,
  MissionStatus,
  PricingQuoteStatus,
  RequestDraftStatus,
} from '../types/beta1';

type TransitionMap<T extends string> = Record<T, readonly T[]>;

export const requestDraftTransitions: TransitionMap<RequestDraftStatus> = {
  [RequestDraftStatus.DRAFT]: [RequestDraftStatus.ANALYZING, RequestDraftStatus.CANCELLED],
  [RequestDraftStatus.ANALYZING]: [RequestDraftStatus.DRAFT, RequestDraftStatus.READY_FOR_REVIEW],
  [RequestDraftStatus.READY_FOR_REVIEW]: [RequestDraftStatus.PRICING_READY, RequestDraftStatus.CANCELLED],
  [RequestDraftStatus.PRICING_READY]: [RequestDraftStatus.SUBMITTED, RequestDraftStatus.CANCELLED],
  [RequestDraftStatus.SUBMITTED]: [],
  [RequestDraftStatus.EXPIRED]: [],
  [RequestDraftStatus.CANCELLED]: [],
};

export const aiAnalysisTransitions: TransitionMap<AIAnalysisStatus> = {
  [AIAnalysisStatus.QUEUED]: [AIAnalysisStatus.PROCESSING],
  [AIAnalysisStatus.PROCESSING]: [
    AIAnalysisStatus.COMPLETED,
    AIAnalysisStatus.LOW_CONFIDENCE,
    AIAnalysisStatus.FAILED,
  ],
  [AIAnalysisStatus.COMPLETED]: [],
  [AIAnalysisStatus.LOW_CONFIDENCE]: [],
  [AIAnalysisStatus.FAILED]: [],
};

export const pricingQuoteTransitions: TransitionMap<PricingQuoteStatus> = {
  [PricingQuoteStatus.DRAFT]: [PricingQuoteStatus.CALCULATED],
  [PricingQuoteStatus.CALCULATED]: [PricingQuoteStatus.PRESENTED],
  [PricingQuoteStatus.PRESENTED]: [PricingQuoteStatus.SELECTED, PricingQuoteStatus.EXPIRED],
  [PricingQuoteStatus.SELECTED]: [],
  [PricingQuoteStatus.EXPIRED]: [],
};

export const requestTransitions: TransitionMap<Beta1RequestStatus> = {
  [Beta1RequestStatus.SUBMITTED]: [Beta1RequestStatus.MATCH_PENDING],
  [Beta1RequestStatus.MATCH_PENDING]: [
    Beta1RequestStatus.MATCH_PROPOSED,
    Beta1RequestStatus.CANCELLED,
  ],
  [Beta1RequestStatus.MATCH_PROPOSED]: [
    Beta1RequestStatus.MATCH_CONFIRMED,
    Beta1RequestStatus.CANCELLED,
  ],
  [Beta1RequestStatus.MATCH_CONFIRMED]: [Beta1RequestStatus.CLOSED],
  [Beta1RequestStatus.CANCELLED]: [],
  [Beta1RequestStatus.CLOSED]: [],
};

export const deliveryTransitions: TransitionMap<Beta1DeliveryStatus> = {
  [Beta1DeliveryStatus.CREATED]: [Beta1DeliveryStatus.ASSIGNED],
  [Beta1DeliveryStatus.ASSIGNED]: [Beta1DeliveryStatus.ACCEPTED],
  [Beta1DeliveryStatus.ACCEPTED]: [
    Beta1DeliveryStatus.PICKUP_IN_PROGRESS,
    Beta1DeliveryStatus.CANCELLED,
    Beta1DeliveryStatus.DISPUTED,
  ],
  [Beta1DeliveryStatus.PICKUP_IN_PROGRESS]: [
    Beta1DeliveryStatus.IN_TRANSIT,
    Beta1DeliveryStatus.CANCELLED,
    Beta1DeliveryStatus.DISPUTED,
  ],
  [Beta1DeliveryStatus.IN_TRANSIT]: [
    Beta1DeliveryStatus.HANDOVER_PENDING,
    Beta1DeliveryStatus.CANCELLED,
    Beta1DeliveryStatus.DISPUTED,
  ],
  [Beta1DeliveryStatus.HANDOVER_PENDING]: [
    Beta1DeliveryStatus.AT_LOCKER,
    Beta1DeliveryStatus.LAST_MILE_IN_PROGRESS,
    Beta1DeliveryStatus.CANCELLED,
  ],
  [Beta1DeliveryStatus.AT_LOCKER]: [Beta1DeliveryStatus.IN_TRANSIT],
  [Beta1DeliveryStatus.LAST_MILE_IN_PROGRESS]: [Beta1DeliveryStatus.DELIVERED],
  [Beta1DeliveryStatus.DELIVERED]: [Beta1DeliveryStatus.COMPLETED, Beta1DeliveryStatus.DISPUTED],
  [Beta1DeliveryStatus.COMPLETED]: [],
  [Beta1DeliveryStatus.CANCELLED]: [],
  [Beta1DeliveryStatus.DISPUTED]: [],
};

export const deliveryLegTransitions: TransitionMap<DeliveryLegStatus> = {
  [DeliveryLegStatus.PENDING]: [DeliveryLegStatus.READY, DeliveryLegStatus.CANCELLED],
  [DeliveryLegStatus.READY]: [DeliveryLegStatus.IN_PROGRESS, DeliveryLegStatus.CANCELLED],
  [DeliveryLegStatus.IN_PROGRESS]: [
    DeliveryLegStatus.HANDOVER_PENDING,
    DeliveryLegStatus.COMPLETED,
    DeliveryLegStatus.FAILED,
    DeliveryLegStatus.CANCELLED,
  ],
  [DeliveryLegStatus.HANDOVER_PENDING]: [
    DeliveryLegStatus.COMPLETED,
    DeliveryLegStatus.FAILED,
    DeliveryLegStatus.CANCELLED,
  ],
  [DeliveryLegStatus.COMPLETED]: [],
  [DeliveryLegStatus.CANCELLED]: [],
  [DeliveryLegStatus.FAILED]: [],
};

export const handoverEventTransitions: TransitionMap<HandoverEventStatus> = {
  [HandoverEventStatus.SCHEDULED]: [HandoverEventStatus.WAITING, HandoverEventStatus.CANCELLED],
  [HandoverEventStatus.WAITING]: [
    HandoverEventStatus.VERIFIED,
    HandoverEventStatus.FAILED,
    HandoverEventStatus.CANCELLED,
  ],
  [HandoverEventStatus.VERIFIED]: [HandoverEventStatus.COMPLETED],
  [HandoverEventStatus.COMPLETED]: [],
  [HandoverEventStatus.FAILED]: [],
  [HandoverEventStatus.CANCELLED]: [],
};

export const missionTransitions: TransitionMap<MissionStatus> = {
  [MissionStatus.PLANNED]: [MissionStatus.QUEUED],
  [MissionStatus.QUEUED]: [MissionStatus.OFFERED],
  [MissionStatus.OFFERED]: [
    MissionStatus.ACCEPTED,
    MissionStatus.CANCELLED,
    MissionStatus.REASSIGNING,
  ],
  [MissionStatus.ACCEPTED]: [
    MissionStatus.ARRIVAL_PENDING,
    MissionStatus.CANCELLED,
    MissionStatus.REASSIGNING,
  ],
  [MissionStatus.ARRIVAL_PENDING]: [
    MissionStatus.HANDOVER_PENDING,
    MissionStatus.CANCELLED,
    MissionStatus.REASSIGNING,
  ],
  [MissionStatus.HANDOVER_PENDING]: [
    MissionStatus.IN_PROGRESS,
    MissionStatus.REASSIGNING,
  ],
  [MissionStatus.IN_PROGRESS]: [MissionStatus.COMPLETED, MissionStatus.FAILED],
  [MissionStatus.COMPLETED]: [],
  [MissionStatus.CANCELLED]: [],
  [MissionStatus.FAILED]: [],
  [MissionStatus.REASSIGNING]: [MissionStatus.OFFERED],
};

export function mapLegacyRequestStatus(status: RequestStatus): Beta1RequestStatus {
  switch (status) {
    case RequestStatus.PENDING:
      return Beta1RequestStatus.MATCH_PENDING;
    case RequestStatus.MATCHED:
      return Beta1RequestStatus.MATCH_PROPOSED;
    case RequestStatus.ACCEPTED:
    case RequestStatus.IN_TRANSIT:
    case RequestStatus.ARRIVED:
    case RequestStatus.AT_LOCKER:
    case RequestStatus.DELIVERED:
      return Beta1RequestStatus.MATCH_CONFIRMED;
    case RequestStatus.COMPLETED:
      return Beta1RequestStatus.CLOSED;
    case RequestStatus.CANCELLED:
    default:
      return Beta1RequestStatus.CANCELLED;
  }
}

export function mapLegacyDeliveryStatus(status: DeliveryStatus): Beta1DeliveryStatus {
  switch (status) {
    case DeliveryStatus.PENDING:
      return Beta1DeliveryStatus.CREATED;
    case DeliveryStatus.MATCHED:
      return Beta1DeliveryStatus.ASSIGNED;
    case DeliveryStatus.ACCEPTED:
      return Beta1DeliveryStatus.ACCEPTED;
    case DeliveryStatus.IN_TRANSIT:
      return Beta1DeliveryStatus.IN_TRANSIT;
    case DeliveryStatus.ARRIVED:
      return Beta1DeliveryStatus.HANDOVER_PENDING;
    case DeliveryStatus.AT_LOCKER:
      return Beta1DeliveryStatus.AT_LOCKER;
    case DeliveryStatus.DELIVERED:
      return Beta1DeliveryStatus.DELIVERED;
    case DeliveryStatus.COMPLETED:
      return Beta1DeliveryStatus.COMPLETED;
    case DeliveryStatus.CANCELLED:
      return Beta1DeliveryStatus.CANCELLED;
    case DeliveryStatus.QUOTE_REQUESTED:
    case DeliveryStatus.QUOTE_RECEIVED:
    case DeliveryStatus.SCHEDULED:
    default:
      return Beta1DeliveryStatus.CREATED;
  }
}

export function deriveDraftStatus(params: {
  hasPhotos: boolean;
  aiStatus?: AIAnalysisStatus;
  quoteStatus?: PricingQuoteStatus;
  submitted?: boolean;
}): RequestDraftStatus {
  if (params.submitted) return RequestDraftStatus.SUBMITTED;
  if (params.quoteStatus === PricingQuoteStatus.SELECTED) return RequestDraftStatus.PRICING_READY;
  if (params.aiStatus === AIAnalysisStatus.COMPLETED ?? params.aiStatus === AIAnalysisStatus.LOW_CONFIDENCE) {
    return RequestDraftStatus.READY_FOR_REVIEW;
  }
  if (params.hasPhotos && params.aiStatus === AIAnalysisStatus.PROCESSING) {
    return RequestDraftStatus.ANALYZING;
  }
  return RequestDraftStatus.DRAFT;
}

export function deriveLegStatus(params: {
  startedAt?: boolean;
  completedAt?: boolean;
  waitingForHandover?: boolean;
  failed?: boolean;
  cancelled?: boolean;
}): DeliveryLegStatus {
  if (params.cancelled) return DeliveryLegStatus.CANCELLED;
  if (params.failed) return DeliveryLegStatus.FAILED;
  if (params.completedAt) return DeliveryLegStatus.COMPLETED;
  if (params.waitingForHandover) return DeliveryLegStatus.HANDOVER_PENDING;
  if (params.startedAt) return DeliveryLegStatus.IN_PROGRESS;
  return DeliveryLegStatus.PENDING;
}

export function canTransition<T extends string>(
  transitions: TransitionMap<T>,
  from: T,
  to: T
): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function assertTransition<T extends string>(
  transitions: TransitionMap<T>,
  from: T,
  to: T,
  entityName: string
): void {
  if (from === to) {
    return;
  }

  if (!canTransition(transitions, from, to)) {
    throw new Error(`${entityName} 상태 전이 불가: ${from} -> ${to}`);
  }
}
