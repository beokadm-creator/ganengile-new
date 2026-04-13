import { create } from 'zustand';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import type { Station } from '../../../../types/config';
import type { CreateRequestDraft } from '../../../../utils/draft-storage';
import type { Beta1QuoteCard } from '../../../../services/beta1-orchestration-service';
import type { StationInfo } from '../../../../types/request';

import type { SharedPackageSize } from '../../../../../shared/pricing-config';
import type { UserCoupon } from '../../../../types/coupon';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export type RequestMode = 'immediate' | 'reservation';
export type LocationMode = 'station' | 'address';
export type PackageSize = SharedPackageSize;
export type Urgency = 'normal' | 'fast' | 'urgent';
export type DirectMode = 'none' | 'requester_to_station' | 'locker_assisted';

export interface CreateRequestState {
  // Step Management
  activeStep: number;
  setActiveStep: (step: number) => void;

  // Request Mode (Step 1)
  requestMode: RequestMode;
  setRequestMode: (mode: RequestMode) => void;

  // Origin (Step 1)
  pickupMode: LocationMode;
  setPickupMode: (mode: LocationMode) => void;
  pickupStation: StationInfo | null;
  setPickupStation: (station: StationInfo | null) => void;
  pickupRoadAddress: string;
  setPickupRoadAddress: (address: string) => void;
  pickupDetailAddress: string;
  setPickupDetailAddress: (address: string) => void;

  // Destination (Step 1)
  deliveryMode: LocationMode;
  setDeliveryMode: (mode: LocationMode) => void;
  deliveryStation: StationInfo | null;
  setDeliveryStation: (station: StationInfo | null) => void;
  deliveryRoadAddress: string;
  setDeliveryRoadAddress: (address: string) => void;
  deliveryDetailAddress: string;
  setDeliveryDetailAddress: (address: string) => void;

  // Item Info (Step 2)
  packageItemName: string;
  setPackageItemName: (name: string) => void;
  packageCategory: string;
  setPackageCategory: (category: string) => void;
  packageDescription: string;
  setPackageDescription: (desc: string) => void;
  packageSize: PackageSize;
  setPackageSize: (size: PackageSize) => void;
  weightKg: string;
  setWeightKg: (weight: string) => void;
  itemValue: string;
  setItemValue: (value: string) => void;
  photoUrl: string | null;
  setPhotoUrl: (url: string | null) => void;
  photoRefs: string[];
  setPhotoRefs: (refs: string[]) => void;

  // Date & Time (Step 2)
  preferredPickupDate: string;
  setPreferredPickupDate: (date: string) => void;
  preferredPickupTime: string;
  setPreferredPickupTime: (time: string) => void;
  preferredArrivalTime: string;
  setPreferredArrivalTime: (time: string) => void;
  urgency: Urgency;
  setUrgency: (urgency: Urgency) => void;

  // Recipient & Instructions (Step 3)
  recipientName: string;
  setRecipientName: (name: string) => void;
  recipientPhone: string;
  setRecipientPhone: (phone: string) => void;
  recipientConsentChecked: boolean;
  setRecipientConsentChecked: (checked: boolean) => void;
  pickupLocationDetail: string;
  setPickupLocationDetail: (detail: string) => void;
  specialInstructions: string;
  setSpecialInstructions: (instructions: string) => void;
  directMode: DirectMode;
  setDirectMode: (mode: DirectMode) => void;
  storageLocation: string;
  setStorageLocation: (location: string) => void;
  lockerId: string | null;
  setLockerId: (id: string | null) => void;
  actualLockerFee: number | null;
  setActualLockerFee: (fee: number | null) => void;

  // Phone Verification (Step 3)
  contactPhoneNumber: string;
  setContactPhoneNumber: (phone: string) => void;
  verifiedPhoneOverride: string | null;
  setVerifiedPhoneOverride: (phone: string | null) => void;

  // AI & Pricing (Step 4 / Global)
  aiQuotesLoading: boolean;
  setAiQuotesLoading: (loading: boolean) => void;
  selectedQuoteType: Beta1QuoteCard['quoteType'];
  setSelectedQuoteType: (type: Beta1QuoteCard['quoteType']) => void;
  selectedCoupon: UserCoupon | null;
  setSelectedCoupon: (coupon: UserCoupon | null) => void;

  // Draft Management
  draftRestored: boolean;
  setDraftRestored: (restored: boolean) => void;
  draftSaving: boolean;
  setDraftSaving: (saving: boolean) => void;
  hydrateFromDraft: (draft: CreateRequestDraft) => void;
  hydrateFromPrefill: (prefill: any, prefilledReservation: any) => void;
  clearForm: () => void;
}

const initialState = {
  activeStep: 1,
  requestMode: 'immediate' as RequestMode,
  pickupMode: 'station' as LocationMode,
  pickupStation: null,
  pickupRoadAddress: '',
  pickupDetailAddress: '',
  deliveryMode: 'station' as LocationMode,
  deliveryStation: null,
  deliveryRoadAddress: '',
  deliveryDetailAddress: '',
  packageItemName: '',
  packageCategory: '',
  packageDescription: '',
  packageSize: 'small' as PackageSize,
  weightKg: '1',
  itemValue: '',
  photoUrl: null,
  photoRefs: [],
  preferredPickupDate: '',
  preferredPickupTime: '',
  preferredArrivalTime: '',
  urgency: 'fast' as Urgency,
  recipientName: '',
  recipientPhone: '',
  recipientConsentChecked: false,
  pickupLocationDetail: '',
  specialInstructions: '',
  directMode: 'none' as DirectMode,
  storageLocation: '',
  lockerId: null as string | null,
  actualLockerFee: null as number | null,
  contactPhoneNumber: '',
  verifiedPhoneOverride: null,
  aiQuotesLoading: false,
  selectedQuoteType: 'balanced' as Beta1QuoteCard['quoteType'],
  selectedCoupon: null,

  draftRestored: false,
  draftSaving: false,
};

export const useCreateRequestStore = create<CreateRequestState>((set) => ({
  ...initialState,activeStep: 1,
  setActiveStep: (step) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    set({ activeStep: step });
  },
  setRequestMode: (mode) => set({ requestMode: mode }),
  setPickupMode: (mode) => set({ pickupMode: mode }),
  setPickupStation: (station) => set({ pickupStation: station }),
  setPickupRoadAddress: (address) => set({ pickupRoadAddress: address }),
  setPickupDetailAddress: (address) => set({ pickupDetailAddress: address }),
  setDeliveryMode: (mode) => set({ deliveryMode: mode }),
  setDeliveryStation: (station) => set({ deliveryStation: station }),
  setDeliveryRoadAddress: (address) => set({ deliveryRoadAddress: address }),
  setDeliveryDetailAddress: (address) => set({ deliveryDetailAddress: address }),
  
  setPackageItemName: (name) => set({ packageItemName: name }),
  setPackageCategory: (category) => set({ packageCategory: category }),
  setPackageDescription: (desc) => set({ packageDescription: desc }),
  setPackageSize: (size) => set({ packageSize: size }),
  setWeightKg: (weight) => set({ weightKg: weight }),
  setItemValue: (value) => set({ itemValue: value }),
  setPhotoUrl: (url) => set({ photoUrl: url }),
  setPhotoRefs: (refs) => set({ photoRefs: refs }),
  
  setPreferredPickupDate: (date) => set({ preferredPickupDate: date }),
  setPreferredPickupTime: (time) => set({ preferredPickupTime: time }),
  setPreferredArrivalTime: (time) => set({ preferredArrivalTime: time }),
  setUrgency: (urgency) => set({ urgency }),
  
  setRecipientName: (name) => set({ recipientName: name }),
  setRecipientPhone: (phone) => set({ recipientPhone: phone }),
  setRecipientConsentChecked: (checked) => set({ recipientConsentChecked: checked }),
  setPickupLocationDetail: (detail) => set({ pickupLocationDetail: detail }),
  setSpecialInstructions: (instructions) => set({ specialInstructions: instructions }),
  setDirectMode: (mode) => set({ directMode: mode }),
  setStorageLocation: (loc) => set({ storageLocation: loc }),
  setLockerId: (id) => set({ lockerId: id }),
  setActualLockerFee: (fee) => set({ actualLockerFee: fee }),
  
  setContactPhoneNumber: (phone) => set({ contactPhoneNumber: phone }),
  setVerifiedPhoneOverride: (phone) => set({ verifiedPhoneOverride: phone }),
  
  setAiQuotesLoading: (loading) => set({ aiQuotesLoading: loading }),
  setSelectedQuoteType: (type) => set({ selectedQuoteType: type }),
  setSelectedCoupon: (coupon) => set({ selectedCoupon: coupon }),

  setDraftRestored: (restored) => set({ draftRestored: restored }),
  setDraftSaving: (saving) => set({ draftSaving: saving }),

  hydrateFromDraft: (draft) => set((state) => {
    return {
      activeStep: 1, // ALWAYS start at step 1 to let users review restored data
      requestMode: draft.requestMode as RequestMode ?? 'immediate',
      pickupMode: draft.pickupMode ?? 'station',
      deliveryMode: draft.deliveryMode ?? 'station',
      
      pickupStation: draft.pickupStation ? {
        id: draft.pickupStation.stationId,
        stationId: draft.pickupStation.stationId,
        stationName: draft.pickupStation.stationName,
        line: draft.pickupStation.line ?? '',
        lineCode: draft.pickupStation.lineCode ?? '',
        lat: draft.pickupStation.lat,
        lng: draft.pickupStation.lng,
      } : null,
      
      deliveryStation: draft.deliveryStation ? {
        id: draft.deliveryStation.stationId,
        stationId: draft.deliveryStation.stationId,
        stationName: draft.deliveryStation.stationName,
        line: draft.deliveryStation.line ?? '',
        lineCode: draft.deliveryStation.lineCode ?? '',
        lat: draft.deliveryStation.lat,
        lng: draft.deliveryStation.lng,
      } : null,
      
      pickupRoadAddress: draft.pickupRoadAddress,
      pickupDetailAddress: draft.pickupDetailAddress,
      deliveryRoadAddress: draft.deliveryRoadAddress,
      deliveryDetailAddress: draft.deliveryDetailAddress,
      photoUrl: draft.photoUrl,
      photoRefs: draft.photoRefs,
      packageItemName: draft.packageItemName,
      packageCategory: draft.packageCategory,
      packageDescription: draft.packageDescription,
      packageSize: draft.packageSize,
      weightKg: draft.weightKg,
      itemValue: draft.itemValue,
      recipientName: draft.recipientName,
      recipientPhone: draft.recipientPhone,
      pickupLocationDetail: draft.pickupLocationDetail,
      storageLocation: draft.storageLocation,
      lockerId: (draft as any).lockerId ?? null,
      actualLockerFee: (draft as any).actualLockerFee ?? null,
      specialInstructions: draft.specialInstructions,
      directMode: draft.directMode,
      urgency: draft.urgency,
      preferredPickupDate: draft.preferredPickupDate,
      preferredPickupTime: draft.preferredPickupTime,
      preferredArrivalTime: draft.preferredArrivalTime,
      contactPhoneNumber: draft.contactPhoneNumber,
      recipientConsentChecked: draft.recipientConsentChecked,
      draftRestored: true,
    };
  }),

  hydrateFromPrefill: (prefill, prefilledReservation) => set((state) => {
    return {
      requestMode: prefill?.preferredPickupTime ? 'reservation' : 'immediate',
      pickupMode: prefill?.pickupMode ?? 'station',
      deliveryMode: prefill?.deliveryMode ?? 'station',
      pickupRoadAddress: prefill?.pickupRoadAddress ?? '',
      pickupDetailAddress: prefill?.pickupDetailAddress ?? '',
      deliveryRoadAddress: prefill?.deliveryRoadAddress ?? '',
      deliveryDetailAddress: prefill?.deliveryDetailAddress ?? '',
      photoUrl: prefill?.photoRefs?.[0] ?? null,
      photoRefs: prefill?.photoRefs ?? [],
      packageDescription: prefill?.packageDescription ?? '',
      packageSize: prefill?.packageSize ?? 'small',
      weightKg: String(prefill?.weightKg ?? 1),
      itemValue: prefill?.itemValue ? String(prefill.itemValue) : '',
      recipientName: prefill?.recipientName ?? '',
      recipientPhone: prefill?.recipientPhone ?? '',
      pickupLocationDetail: prefill?.pickupLocationDetail ?? '',
      storageLocation: prefill?.storageLocation ?? '',
      lockerId: prefill?.lockerId ?? null,
      actualLockerFee: prefill?.actualLockerFee ?? null,
      specialInstructions: prefill?.specialInstructions ?? '',
      directMode: prefill?.directParticipationMode ?? 'none',
      urgency: prefill?.urgency ?? 'fast',
      preferredPickupDate: prefilledReservation.date,
      preferredPickupTime: prefilledReservation.time,
      preferredArrivalTime: prefill?.preferredArrivalTime ?? '',
    };
  }),

  clearForm: () => set(initialState),
}));