import { Timestamp } from 'firebase/firestore';
import type { StationInfo } from '../types/request';
import type {
  LocationRef,
  PricingQuote,
  QuoteType,
  RequestDraft,
} from '../types/beta1';
import {
  PricingQuoteStatus,
  RequestDraftStatus,
} from '../types/beta1';

export interface LegacyCreateRequestDraftInput {
  requesterUserId: string;
  pickupStation?: StationInfo | null;
  deliveryStation?: StationInfo | null;
  selectedPhotoIds?: string[];
  itemName?: string;
  category?: string;
  description?: string;
  estimatedValue?: number;
  estimatedWeightKg?: number;
  estimatedSize?: 'small' | 'medium' | 'large' | 'xl';
  isFragile?: boolean;
  isPerishable?: boolean;
  recipientName?: string;
  recipientPhone?: string;
}

export interface LegacyFeePreviewInput {
  requestDraftId: string;
  requesterUserId: string;
  quoteType?: QuoteType;
  publicPrice: number;
  depositAmount: number;
  baseFee: number;
  distanceFee: number;
  weightFee: number;
  sizeFee: number;
  urgencySurcharge: number;
  publicFare?: number;
  lockerFee?: number;
  addressPickupFee?: number;
  addressDropoffFee?: number;
  serviceFee: number;
  vat: number;
  speedLabel?: string;
  includesLocker?: boolean;
  includesAddressPickup?: boolean;
  includesAddressDropoff?: boolean;
}

function mapStationToLocationRef(station?: StationInfo | null): LocationRef {
  if (!station) {
    return { type: 'station' };
  }
  return {
    type: 'station',
    stationId: station.stationId,
    stationName: station.stationName,
    latitude: station.lat,
    longitude: station.lng,
  };
}

export function buildRequestDraftFromLegacyInput(
  input: LegacyCreateRequestDraftInput
): Omit<RequestDraft, 'requestDraftId'> {
  return {
    requesterUserId: input.requesterUserId,
    originType: 'station',
    destinationType: 'station',
    originRef: mapStationToLocationRef(input.pickupStation),
    destinationRef: mapStationToLocationRef(input.deliveryStation),
    selectedPhotoIds: input.selectedPhotoIds ?? [],
    packageDraft: {
      itemName: input.itemName,
      category: input.category,
      description: input.description,
      estimatedValue: input.estimatedValue,
      estimatedWeightKg: input.estimatedWeightKg,
      estimatedSize: input.estimatedSize,
      isFragile: input.isFragile,
      isPerishable: input.isPerishable,
    },
    recipient: {
      name: input.recipientName,
      phone: input.recipientPhone,
    },
    status: RequestDraftStatus.DRAFT,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export function buildPricingQuoteFromLegacyFee(
  input: LegacyFeePreviewInput
): Omit<PricingQuote, 'pricingQuoteId'> {
  return {
    requestDraftId: input.requestDraftId,
    requesterUserId: input.requesterUserId,
    quoteType: input.quoteType ?? 'balanced',
    pricingVersion: 'beta1-v1',
    selectedDeliveryOption: {
      speedLabel: input.speedLabel ?? '일반',
      includesLocker: input.includesLocker ?? false,
      includesAddressPickup: input.includesAddressPickup ?? false,
      includesAddressDropoff: input.includesAddressDropoff ?? false,
    },
    finalPricing: {
      publicPrice: input.publicPrice,
      depositAmount: input.depositAmount,
      baseFee: input.baseFee,
      distanceFee: input.distanceFee,
      weightFee: input.weightFee,
      sizeFee: input.sizeFee,
      urgencySurcharge: input.urgencySurcharge,
      publicFare: input.publicFare ?? 0,
      lockerFee: input.lockerFee ?? 0,
      addressPickupFee: input.addressPickupFee ?? 0,
      addressDropoffFee: input.addressDropoffFee ?? 0,
      serviceFee: input.serviceFee,
      vat: input.vat,
    },
    status: PricingQuoteStatus.CALCULATED,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}
