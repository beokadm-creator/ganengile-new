jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: jest.fn(() => new Date()),
  },
  addDoc: jest.fn(),
  collection: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  updateDoc: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  where: jest.fn(),
}));

jest.mock('../src/services/firebase', () => ({
  db: {},
}));

jest.mock('../src/services/request-draft-service', () => ({
  createAIAnalysis: jest.fn(),
  createPricingQuote: jest.fn(),
  createRequestDraft: jest.fn(),
  markPricingQuoteSelected: jest.fn(),
  updateRequestDraft: jest.fn(),
}));

jest.mock('../src/services/integration-config-service', () => ({
  getAIIntegrationConfig: jest.fn(),
}));

jest.mock('../src/services/beta1-wallet-service', () => ({
  getWalletLedger: jest.fn(),
}));

jest.mock('../src/services/matching-service', () => ({
  findMatchesForRequest: jest.fn(),
}));

jest.mock('../src/services/matching-notification', () => ({
  sendMissionBundleAvailableNotification: jest.fn(),
}));

jest.mock('../src/services/b2b-delivery-service', () => ({
  B2BDeliveryService: {
    createDelivery: jest.fn(),
  },
}));

import {
  buildBeta1QuoteCards,
  buildSegmentedLegDefinitions,
  formatDetailedAddress,
  selectActorForMission,
  splitRewardAcrossLegs,
  type Beta1RequestCreateInput,
} from '../src/services/beta1-orchestration-service';

function makeInput(overrides: Partial<Beta1RequestCreateInput> = {}): Beta1RequestCreateInput {
  return {
    requesterUserId: 'requester-1',
    requestMode: 'immediate',
    originType: 'station',
    destinationType: 'station',
    pickupStation: {
      stationId: 's1',
      stationName: '강남역',
      lat: 37.4979,
      lng: 127.0276,
    },
    deliveryStation: {
      stationId: 's2',
      stationName: '잠실역',
      lat: 37.5133,
      lng: 127.1001,
    },
    packageDescription: '서류 봉투',
    packageSize: 'small',
    weightKg: 0.5,
    recipientName: '홍길동',
    recipientPhone: '01012345678',
    selectedQuoteType: 'balanced',
    directParticipationMode: 'none',
    ...overrides,
  };
}

describe('beta1 orchestration quote cards', () => {
  it('builds four quote cards for a station-to-station request', () => {
    const cards = buildBeta1QuoteCards(makeInput());

    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.quoteType)).toEqual([
      'fastest',
      'balanced',
      'lowest_price',
      'locker_included',
    ]);
    expect(cards.every((card) => card.includesAddressPickup === false)).toBe(true);
    expect(cards.every((card) => card.includesAddressDropoff === false)).toBe(true);
    expect(cards.find((card) => card.quoteType === 'balanced')?.includesLocker).toBe(false);
  });

  it('reflects address handling fees and locker participation in quote metadata', () => {
    const cards = buildBeta1QuoteCards(
      makeInput({
        requestMode: 'reservation',
        originType: 'address',
        destinationType: 'address',
        pickupRoadAddress: '서울 강남구 테헤란로 1',
        pickupDetailAddress: '101호',
        deliveryRoadAddress: '서울 송파구 올림픽로 2',
        deliveryDetailAddress: '202호',
        directParticipationMode: 'locker_assisted',
        packageSize: 'extra_large',
        urgency: 'urgent',
      })
    );

    const fastest = cards.find((card) => card.quoteType === 'fastest');
    const balanced = cards.find((card) => card.quoteType === 'balanced');
    const lockerIncluded = cards.find((card) => card.quoteType === 'locker_included');

    expect(fastest?.includesAddressPickup).toBe(true);
    expect(fastest?.includesAddressDropoff).toBe(true);
    expect(fastest?.pricing.addressPickupFee).toBe(900);
    expect(fastest?.pricing.addressDropoffFee).toBe(800);
    expect(balanced?.includesLocker).toBe(true);
    expect(balanced?.etaLabel).toContain('예약');
    expect(lockerIncluded?.includesLocker).toBe(true);
    expect(lockerIncluded?.pricing.lockerFee).toBeGreaterThan(0);
  });

  it('keeps the lowest-price quote above the configured floor', () => {
    const cards = buildBeta1QuoteCards(
      makeInput({
        pickupStation: {
          stationId: 's1',
          stationName: '강남역',
          lat: 0,
          lng: 0,
        },
        deliveryStation: {
          stationId: 's1',
          stationName: '강남역',
          lat: 0,
          lng: 0,
        },
        weightKg: 0,
      })
    );

    const lowestPrice = cards.find((card) => card.quoteType === 'lowest_price');

    expect(lowestPrice?.pricing.publicPrice).toBeGreaterThanOrEqual(3000);
  });
});

describe('beta1 orchestration actor selection', () => {
  it('prefers lockers when the caller explicitly requests locker flow', () => {
    const decision = selectActorForMission({
      missionType: 'subway_transport',
      preferLocker: true,
      requiresAddressHandling: false,
      urgency: 'normal',
    });

    expect(decision.selectedActorType).toBe('locker');
    expect(decision.selectionReason).toContain('보관함');
  });

  it('routes urgent address handling to an external partner first', () => {
    const decision = selectActorForMission({
      missionType: 'last_mile',
      preferLocker: false,
      requiresAddressHandling: true,
      urgency: 'urgent',
    });

    expect(decision.selectedActorType).toBe('external_partner');
    expect(decision.selectedPartnerId).toBe('partner-a');
    expect(decision.manualReviewRequired).toBe(true);
  });

  it('defaults subway missions to a giller recommendation', () => {
    const decision = selectActorForMission({
      missionType: 'subway_transport',
      preferLocker: false,
      requiresAddressHandling: false,
      urgency: 'fast',
    });

    expect(decision.selectedActorType).toBe('giller');
    expect(decision.fallbackActorTypes).toEqual(['locker', 'external_partner']);
    expect(decision.manualReviewRequired).toBe(false);
  });
});

describe('beta1 orchestration leg helpers', () => {
  it('formats road and detail address into a single string', () => {
    expect(formatDetailedAddress('서울 강남구 테헤란로 1', '101호')).toBe('서울 강남구 테헤란로 1 101호');
    expect(formatDetailedAddress('서울 강남구 테헤란로 1')).toBe('서울 강남구 테헤란로 1');
    expect(formatDetailedAddress(undefined, '101호')).toBeUndefined();
  });

  it('splits rewards across legs without losing remainder', () => {
    expect(splitRewardAcrossLegs(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitRewardAcrossLegs(500, 0)).toEqual([]);
  });

  it('builds pickup, subway, and last-mile legs for address-to-address requests', () => {
    const legs = buildSegmentedLegDefinitions({
      requestId: 'request-1',
      deliveryId: 'delivery-1',
      originType: 'address',
      destinationType: 'address',
      pickupStation: {
        stationId: 's1',
        stationName: '강남역',
        lat: 37.4979,
        lng: 127.0276,
      },
      deliveryStation: {
        stationId: 's2',
        stationName: '잠실역',
        lat: 37.5133,
        lng: 127.1001,
      },
      pickupAddress: '서울 강남구 테헤란로 1 101호',
      pickupRoadAddress: '서울 강남구 테헤란로 1',
      pickupDetailAddress: '101호',
      deliveryAddress: '서울 송파구 올림픽로 2 202호',
      deliveryRoadAddress: '서울 송파구 올림픽로 2',
      deliveryDetailAddress: '202호',
    });

    expect(legs.map((leg) => leg.legType)).toEqual([
      'pickup_address',
      'subway_transport',
      'last_mile_address',
    ]);
    expect(legs.map((leg) => leg.sequence)).toEqual([1, 2, 3]);
    expect(legs[0].originRef.type).toBe('address');
    expect(legs[2].destinationRef.type).toBe('address');
  });

  it('falls back to a single subway leg when stations are identical and no address is involved', () => {
    const legs = buildSegmentedLegDefinitions({
      requestId: 'request-2',
      deliveryId: 'delivery-2',
      originType: 'station',
      destinationType: 'station',
      pickupStation: {
        stationId: 's1',
        stationName: '강남역',
        lat: 37.4979,
        lng: 127.0276,
      },
      deliveryStation: {
        stationId: 's1',
        stationName: '강남역',
        lat: 37.4979,
        lng: 127.0276,
      },
    });

    expect(legs).toHaveLength(1);
    expect(legs[0].legType).toBe('subway_transport');
    expect(legs[0].sequence).toBe(1);
  });
});
