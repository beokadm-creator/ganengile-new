import {
  PricingQuoteStatus,
  RequestDraftStatus,
} from '../src/types/beta1';
import {
  buildPricingQuoteFromLegacyFee,
  buildRequestDraftFromLegacyInput,
} from '../src/utils/request-draft-adapters';

jest.mock('firebase/firestore', () => ({
  Timestamp: class MockTimestamp {
    static now() {
      return new MockTimestamp();
    }
  },
}));

const { Timestamp } = jest.requireMock('firebase/firestore') as {
  Timestamp: { now: () => unknown };
};

describe('request draft adapters', () => {
  it('builds a beta1 request draft from legacy create-request data', () => {
    const draft = buildRequestDraftFromLegacyInput({
      requesterUserId: 'user-1',
      pickupStation: {
        id: 's1',
        stationId: 's1',
        stationName: '서울역',
        line: '1호선',
        lineCode: '1',
        lat: 37.55,
        lng: 126.97,
      },
      deliveryStation: {
        id: 's2',
        stationId: 's2',
        stationName: '강남역',
        line: '2호선',
        lineCode: '2',
        lat: 37.49,
        lng: 127.03,
      },
      selectedPhotoIds: ['photo-1'],
      description: '노트북',
      estimatedValue: 1200000,
      recipientName: '홍길동',
      recipientPhone: '010-0000-0000',
    });

    expect(draft.requesterUserId).toBe('user-1');
    expect(draft.originRef.stationId).toBe('s1');
    expect(draft.destinationRef.stationId).toBe('s2');
    expect(draft.selectedPhotoIds).toEqual(['photo-1']);
    expect(draft.packageDraft?.description).toBe('노트북');
    expect(draft.status).toBe(RequestDraftStatus.DRAFT);
    expect(draft.createdAt).toBeInstanceOf(Timestamp);
  });

  it('builds a beta1 pricing quote from legacy fee preview data', () => {
    const quote = buildPricingQuoteFromLegacyFee({
      requestDraftId: 'draft-1',
      requesterUserId: 'user-1',
      publicPrice: 7800,
      depositAmount: 50000,
      baseFee: 2000,
      distanceFee: 600,
      weightFee: 100,
      sizeFee: 400,
      urgencySurcharge: 0,
      publicFare: 1500,
      serviceFee: 310,
      vat: 890,
    });

    expect(quote.requestDraftId).toBe('draft-1');
    expect(quote.finalPricing.publicPrice).toBe(7800);
    expect(quote.finalPricing.depositAmount).toBe(50000);
    expect(quote.status).toBe(PricingQuoteStatus.CALCULATED);
    expect(quote.createdAt).toBeInstanceOf(Timestamp);
  });
});
