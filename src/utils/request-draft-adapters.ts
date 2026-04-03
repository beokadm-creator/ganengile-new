import { Timestamp } from 'firebase/firestore';
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

export interface LegacyStationInfo {
  id?: string;
  stationId: string;
  stationName: string;
  line?: string;
  lineCode?: string;
  lat: number;
  lng: number;
}

type LegacyFeeBreakdown = {
  baseFee: number;
  distanceFee: number;
  weightFee: number;
  sizeFee: number;
  urgencySurcharge: number;
  publicFare?: number;
  serviceFee: number;
  vat: number;
  totalFee: number;
};

export interface LegacyCreateRequestDraftInput {
  requesterUserId: string;
  pickupStation?: LegacyStationInfo | null;
  deliveryStation?: LegacyStationInfo | null;
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

export interface LegacyRequestPricingInput {
  requesterId: string;
  itemValue?: number;
  feeBreakdown?: LegacyFeeBreakdown;
  fee?: LegacyFeeBreakdown;
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

export function mapLegacyStationToLocationRef(station?: LegacyStationInfo | null): LocationRef {
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
    originRef: mapLegacyStationToLocationRef(input.pickupStation),
    destinationRef: mapLegacyStationToLocationRef(input.deliveryStation),
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

export function buildPricingQuoteFromLegacyRequest(
  input: LegacyRequestPricingInput,
  requestDraftId: string
): Omit<PricingQuote, 'pricingQuoteId'> {
  const fee = input.fee ?? input.feeBreakdown;

  if (!fee) {
    throw new Error('Fee is required to create a pricing quote.');
  }

  return buildPricingQuoteFromLegacyFee({
    requestDraftId,
    requesterUserId: input.requesterId,
    publicPrice: fee.totalFee,
    depositAmount: input.itemValue ? Math.round(input.itemValue) : 0,
    baseFee: fee.baseFee,
    distanceFee: fee.distanceFee,
    weightFee: fee.weightFee,
    sizeFee: fee.sizeFee,
    urgencySurcharge: fee.urgencySurcharge,
    publicFare: fee.publicFare,
    serviceFee: fee.serviceFee,
    vat: fee.vat,
    speedLabel: 'Balanced',
    includesAddressDropoff: true,
  });
}
