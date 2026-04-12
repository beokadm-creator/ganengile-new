import { create } from 'zustand';
import type { StationInfo } from '../../../../types/request';
import type { RequestDraft } from '../../../../types/beta1';

export type RequestMode = 'immediate' | 'reservation';
export type LocationMode = 'station' | 'address';
export type PackageSize = 'small' | 'medium' | 'large' | 'xl';
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

  // Phone Verification (Step 3)
  contactPhoneNumber: string;
  setContactPhoneNumber: (phone: string) => void;
  verifiedPhoneOverride: string | null;
  setVerifiedPhoneOverride: (phone: string | null) => void;

  // AI & Pricing (Step 4 / Global)
  aiQuotesLoading: boolean;
  setAiQuotesLoading: (loading: boolean) => void;
  selectedQuoteType: 'balanced' | 'cheapest' | 'fastest';
  setSelectedQuoteType: (type: 'balanced' | 'cheapest' | 'fastest') => void;

  // Draft Management
  draftRestored: boolean;
  setDraftRestored: (restored: boolean) => void;
  draftSaving: boolean;
  setDraftSaving: (saving: boolean) => void;
  hydrateFromDraft: (draft: Partial<RequestDraft>) => void;
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
  lockerId: null,
  contactPhoneNumber: '',
  verifiedPhoneOverride: null,
  aiQuotesLoading: false,
  selectedQuoteType: 'balanced' as const,
  draftRestored: false,
  draftSaving: false,
};

export const useCreateRequestStore = create<CreateRequestState>((set) => ({
  ...initialState,

  setActiveStep: (step) => set({ activeStep: step }),
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
  setStorageLocation: (location) => set({ storageLocation: location }),
  setLockerId: (id) => set({ lockerId: id }),
  
  setContactPhoneNumber: (phone) => set({ contactPhoneNumber: phone }),
  setVerifiedPhoneOverride: (phone) => set({ verifiedPhoneOverride: phone }),
  
  setAiQuotesLoading: (loading) => set({ aiQuotesLoading: loading }),
  setSelectedQuoteType: (type) => set({ selectedQuoteType: type }),
  
  setDraftRestored: (restored) => set({ draftRestored: restored }),
  setDraftSaving: (saving) => set({ draftSaving: saving }),

  hydrateFromDraft: (draft) => set((state) => {
    return {
      requestMode: draft.requestMode as RequestMode ?? 'immediate',
      pickupMode: draft.pickupLocation?.type === 'address' ? 'address' : 'station',
      deliveryMode: draft.deliveryLocation?.type === 'address' ? 'address' : 'station',
      
      pickupStation: draft.pickupLocation?.type === 'station' ? {
        stationId: draft.pickupLocation.stationId!,
        stationName: draft.pickupLocation.stationName!,
        lat: draft.pickupLocation.lat,
        lng: draft.pickupLocation.lng,
      } : null,
      
      deliveryStation: draft.deliveryLocation?.type === 'station' ? {
        stationId: draft.deliveryLocation.stationId!,
        stationName: draft.deliveryLocation.stationName!,
        lat: draft.deliveryLocation.lat,
        lng: draft.deliveryLocation.lng,
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

  clearForm: () => set(initialState),
}));