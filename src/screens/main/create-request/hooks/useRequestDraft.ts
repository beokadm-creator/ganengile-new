import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useCreateRequestStore } from '../store/useCreateRequestStore';
import { useUser } from '../../../../contexts/UserContext';
import {
  saveCreateRequestProgress,
  deleteCreateRequestProgress,
  hasDraftableContent,
  type CreateRequestDraft,
} from '../../../../utils/draft-storage';

export function useRequestDraft() {
  const { user } = useUser();
  const store = useCreateRequestStore();
  
  const draftHydratedRef = useRef(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildDraftPayload(): CreateRequestDraft {
    return {
      step: store.activeStep,
      requestMode: store.requestMode,
      pickupMode: store.pickupMode,
      deliveryMode: store.deliveryMode,
      pickupStation: store.pickupStation ? { ...store.pickupStation } : null,
      deliveryStation: store.deliveryStation ? { ...store.deliveryStation } : null,
      pickupRoadAddress: store.pickupRoadAddress,
      pickupDetailAddress: store.pickupDetailAddress,
      deliveryRoadAddress: store.deliveryRoadAddress,
      deliveryDetailAddress: store.deliveryDetailAddress,
      photoUrl: store.photoUrl,
      photoRefs: store.photoRefs,
      packageItemName: store.packageItemName,
      packageCategory: store.packageCategory,
      packageDescription: store.packageDescription,
      packageSize: store.packageSize,
      weightKg: store.weightKg,
      itemValue: store.itemValue,
      recipientName: store.recipientName,
      recipientPhone: store.recipientPhone,
      pickupLocationDetail: store.pickupLocationDetail,
      storageLocation: store.storageLocation,
      specialInstructions: store.specialInstructions,
      urgency: store.urgency,
      directMode: store.directMode,
      preferredPickupDate: store.preferredPickupDate,
      preferredPickupTime: store.preferredPickupTime,
      preferredArrivalTime: store.preferredArrivalTime,
      contactPhoneNumber: store.contactPhoneNumber,
      recipientConsentChecked: store.recipientConsentChecked,
    };
  }

  // Auto-save logic
  useEffect(() => {
    if (!draftHydratedRef.current || !user?.uid) return;

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(() => {
      if (
        !hasDraftableContent({
          pickupStation: store.pickupStation,
          deliveryStation: store.deliveryStation,
          pickupRoadAddress: store.pickupRoadAddress,
          pickupDetailAddress: store.pickupDetailAddress,
          deliveryRoadAddress: store.deliveryRoadAddress,
          deliveryDetailAddress: store.deliveryDetailAddress,
          photoRefs: store.photoRefs,
          packageItemName: store.packageItemName,
          packageDescription: store.packageDescription,
          recipientName: store.recipientName,
          recipientPhone: store.recipientPhone,
          pickupLocationDetail: store.pickupLocationDetail,
          storageLocation: store.storageLocation,
          specialInstructions: store.specialInstructions,
          itemValue: store.itemValue,
          preferredPickupDate: store.preferredPickupDate,
          preferredPickupTime: store.preferredPickupTime,
        })
      ) {
        void deleteCreateRequestProgress();
        store.setDraftSaving(false);
        return;
      }

      store.setDraftSaving(true);
      void saveCreateRequestProgress(buildDraftPayload()).finally(() => store.setDraftSaving(false));
    }, 500);

    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [
    user?.uid,
    store.requestMode,
    store.pickupMode,
    store.deliveryMode,
    store.pickupStation,
    store.deliveryStation,
    store.pickupRoadAddress,
    store.pickupDetailAddress,
    store.deliveryRoadAddress,
    store.deliveryDetailAddress,
    store.photoUrl,
    store.photoRefs,
    store.packageItemName,
    store.packageCategory,
    store.packageDescription,
    store.packageSize,
    store.weightKg,
    store.itemValue,
    store.recipientName,
    store.recipientPhone,
    store.pickupLocationDetail,
    store.storageLocation,
    store.specialInstructions,
    store.urgency,
    store.directMode,
    store.preferredPickupDate,
    store.preferredPickupTime,
    store.preferredArrivalTime,
    store.contactPhoneNumber,
    store.recipientConsentChecked,
  ]);

  async function handleClearDraft() {
    await deleteCreateRequestProgress();
    store.setDraftRestored(false);
    Alert.alert('이어쓰기 기록을 지웠습니다', '지금 화면에서 다시 입력한 내용만 남습니다.');
  }

  async function handleSaveDraftNow() {
    if (
      !hasDraftableContent({
        pickupStation: store.pickupStation,
        deliveryStation: store.deliveryStation,
        pickupRoadAddress: store.pickupRoadAddress,
        pickupDetailAddress: store.pickupDetailAddress,
        deliveryRoadAddress: store.deliveryRoadAddress,
        deliveryDetailAddress: store.deliveryDetailAddress,
        photoRefs: store.photoRefs,
        packageItemName: store.packageItemName,
        packageDescription: store.packageDescription,
        recipientName: store.recipientName,
        recipientPhone: store.recipientPhone,
        pickupLocationDetail: store.pickupLocationDetail,
        storageLocation: store.storageLocation,
        specialInstructions: store.specialInstructions,
        itemValue: store.itemValue,
        preferredPickupDate: store.preferredPickupDate,
        preferredPickupTime: store.preferredPickupTime,
      })
    ) {
      Alert.alert('임시 저장', '먼저 이어서 작성할 내용을 조금이라도 입력해 주세요.');
      return;
    }

    store.setDraftSaving(true);
    try {
      await saveCreateRequestProgress(buildDraftPayload());
      store.setDraftRestored(true);
      Alert.alert('임시 저장됨', '다음에 돌아오면 이어서 작성할 수 있습니다.');
    } finally {
      store.setDraftSaving(false);
    }
  }

  return {
    draftHydratedRef,
    handleClearDraft,
    handleSaveDraftNow,
  };
}
