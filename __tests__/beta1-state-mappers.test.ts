import { DeliveryStatus } from '../src/types/delivery';
import { RequestStatus } from '../src/types/request';
import {
  AIAnalysisStatus,
  Beta1DeliveryStatus,
  Beta1RequestStatus,
  DeliveryLegStatus,
  PricingQuoteStatus,
  RequestDraftStatus,
} from '../src/types/beta1';
import {
  assertTransition,
  canTransition,
  deliveryTransitions,
  deriveDraftStatus,
  deriveLegStatus,
  mapLegacyDeliveryStatus,
  mapLegacyRequestStatus,
  missionTransitions,
} from '../src/utils/beta1-state-mappers';
import { MissionStatus } from '../src/types/beta1';

describe('beta1 state mappers', () => {
  it('maps legacy request statuses into beta1 request statuses', () => {
    expect(mapLegacyRequestStatus(RequestStatus.PENDING)).toBe(
      Beta1RequestStatus.MATCH_PENDING
    );
    expect(mapLegacyRequestStatus(RequestStatus.MATCHED)).toBe(
      Beta1RequestStatus.MATCH_PROPOSED
    );
    expect(mapLegacyRequestStatus(RequestStatus.COMPLETED)).toBe(
      Beta1RequestStatus.CLOSED
    );
  });

  it('maps legacy delivery statuses into beta1 delivery statuses', () => {
    expect(mapLegacyDeliveryStatus(DeliveryStatus.PENDING)).toBe(
      Beta1DeliveryStatus.CREATED
    );
    expect(mapLegacyDeliveryStatus(DeliveryStatus.AT_LOCKER)).toBe(
      Beta1DeliveryStatus.AT_LOCKER
    );
    expect(mapLegacyDeliveryStatus(DeliveryStatus.COMPLETED)).toBe(
      Beta1DeliveryStatus.COMPLETED
    );
  });

  it('derives draft status from AI and quote progress', () => {
    expect(
      deriveDraftStatus({
        hasPhotos: false,
      })
    ).toBe(RequestDraftStatus.DRAFT);

    expect(
      deriveDraftStatus({
        hasPhotos: true,
        aiStatus: AIAnalysisStatus.PROCESSING,
      })
    ).toBe(RequestDraftStatus.ANALYZING);

    expect(
      deriveDraftStatus({
        hasPhotos: true,
        aiStatus: AIAnalysisStatus.COMPLETED,
      })
    ).toBe(RequestDraftStatus.READY_FOR_REVIEW);

    expect(
      deriveDraftStatus({
        hasPhotos: true,
        quoteStatus: PricingQuoteStatus.SELECTED,
      })
    ).toBe(RequestDraftStatus.PRICING_READY);
  });

  it('derives delivery leg status from execution flags', () => {
    expect(deriveLegStatus({})).toBe(DeliveryLegStatus.PENDING);
    expect(deriveLegStatus({ startedAt: true })).toBe(DeliveryLegStatus.IN_PROGRESS);
    expect(deriveLegStatus({ waitingForHandover: true })).toBe(
      DeliveryLegStatus.HANDOVER_PENDING
    );
    expect(deriveLegStatus({ completedAt: true })).toBe(DeliveryLegStatus.COMPLETED);
    expect(deriveLegStatus({ failed: true })).toBe(DeliveryLegStatus.FAILED);
  });

  it('validates delivery and mission transitions with shared guards', () => {
    expect(
      canTransition(
        deliveryTransitions,
        Beta1DeliveryStatus.ACCEPTED,
        Beta1DeliveryStatus.PICKUP_IN_PROGRESS
      )
    ).toBe(true);

    expect(
      canTransition(
        missionTransitions,
        MissionStatus.QUEUED,
        MissionStatus.COMPLETED
      )
    ).toBe(false);

    expect(() =>
      assertTransition(
        missionTransitions,
        MissionStatus.QUEUED,
        MissionStatus.COMPLETED,
        'Mission'
      )
    ).toThrow('Mission 상태 전이 불가');
  });
});
