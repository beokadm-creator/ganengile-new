/**
 * Draft Storage
 * 폼 진행 상태 및 임시 데이터 저장소 (AsyncStorage 래퍼)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_PREFIX = '@ganengile_draft_';
const FORM_PROGRESS_PREFIX = '@ganengile_form_';

export interface DraftData<T = any> {
  data: T;
  timestamp: number;
  version?: number;
}

/**
 * 드래프트 저장
 */
export async function saveDraft<T>(key: string, data: T): Promise<void> {
  try {
    const draft: DraftData<T> = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(draft));
  } catch (error) {
    console.error('Error saving draft:', error);
  }
}

/**
 * 드래프트 불러오기
 */
export async function loadDraft<T>(key: string): Promise<T | null> {
  try {
    const json = await AsyncStorage.getItem(`${DRAFT_PREFIX}${key}`);
    if (!json) return null;

    const draft: DraftData<T> = JSON.parse(json);

    // Check if draft is too old (7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    if (Date.now() - draft.timestamp > maxAge) {
      await deleteDraft(key);
      return null;
    }

    return draft.data;
  } catch (error) {
    console.error('Error loading draft:', error);
    return null;
  }
}

/**
 * 드래프트 삭제
 */
export async function deleteDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${DRAFT_PREFIX}${key}`);
  } catch (error) {
    console.error('Error deleting draft:', error);
  }
}

/**
 * 모든 드래프트 키 목록 가져오기
 */
export async function getAllDraftKeys(): Promise<string[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys
      .filter(key => key.startsWith(DRAFT_PREFIX))
      .map(key => key.replace(DRAFT_PREFIX, ''));
  } catch (error) {
    console.error('Error getting draft keys:', error);
    return [];
  }
}

/**
 * 오래된 드래프트 정리 (7일 이상)
 */
export async function cleanupOldDrafts(): Promise<number> {
  try {
    const keys = await getAllDraftKeys();
    let cleaned = 0;

    for (const key of keys) {
      const json = await AsyncStorage.getItem(`${DRAFT_PREFIX}${key}`);
      if (json) {
        const draft: DraftData = JSON.parse(json);
        const maxAge = 7 * 24 * 60 * 60 * 1000;

        if (Date.now() - draft.timestamp > maxAge) {
          await deleteDraft(key);
          cleaned++;
        }
      }
    }

    return cleaned;
  } catch (error) {
    console.error('Error cleaning up drafts:', error);
    return 0;
  }
}

/**
 * 폼 진행 상태 저장
 */
export async function saveFormProgress(
  formId: string,
  step: number,
  data: Record<string, any>
): Promise<void> {
  try {
    const formData = {
      step,
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(`${FORM_PROGRESS_PREFIX}${formId}`, JSON.stringify(formData));
  } catch (error) {
    console.error('Error saving form progress:', error);
  }
}

/**
 * 폼 진행 상태 불러오기
 */
export async function loadFormProgress(
  formId: string
): Promise<{ step: number; data: Record<string, any> } | null> {
  try {
    const json = await AsyncStorage.getItem(`${FORM_PROGRESS_PREFIX}${formId}`);
    if (!json) return null;

    const formData = JSON.parse(json);

    // Check if progress is too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - formData.timestamp > maxAge) {
      await deleteFormProgress(formId);
      return null;
    }

    return formData;
  } catch (error) {
    console.error('Error loading form progress:', error);
    return null;
  }
}

/**
 * 폼 진행 상태 삭제
 */
export async function deleteFormProgress(formId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${FORM_PROGRESS_PREFIX}${formId}`);
  } catch (error) {
    console.error('Error deleting form progress:', error);
  }
}

/**
 * 별점 드래프트 저장
 */
export interface RatingDraft {
  rating: number;
  selectedTags: string[];
  comment: string;
  isAnonymous: boolean;
}

export async function saveRatingDraft(
  deliveryId: string,
  draft: RatingDraft
): Promise<void> {
  await saveDraft(`rating_${deliveryId}`, draft);
}

/**
 * 별점 드래프트 불러오기
 */
export async function loadRatingDraft(
  deliveryId: string
): Promise<RatingDraft | null> {
  return await loadDraft<RatingDraft>(`rating_${deliveryId}`);
}

/**
 * 별점 드래프트 삭제
 */
export async function deleteRatingDraft(deliveryId: string): Promise<void> {
  await deleteDraft(`rating_${deliveryId}`);
}

/**
 * 배송 요청 폼 진행 상태 저장
 */
export interface CreateRequestDraft {
  step: number;
  pickupStation: any;
  deliveryStation: any;
  packageSize: string;
  weight: string;
  description: string;
  isFragile: boolean;
  isPerishable: boolean;
  recipientName: string;
  recipientPhone: string;
  pickupTime: string;
  deliveryTime: string;
  urgency: string;
  pickupLocationDetail: string;
  storageLocation: string;
  specialInstructions: string;
}

export async function saveCreateRequestProgress(
  draft: CreateRequestDraft
): Promise<void> {
  await saveFormProgress('create_request', draft.step, draft);
}

/**
 * 배송 요청 폼 진행 상태 불러오기
 */
export async function loadCreateRequestProgress(): Promise<CreateRequestDraft | null> {
  const progress = await loadFormProgress('create_request');
  if (!progress) return null;
  return progress.data as CreateRequestDraft;
}

/**
 * 배송 요청 폼 진행 상태 삭제
 */
export async function deleteCreateRequestProgress(): Promise<void> {
  await deleteFormProgress('create_request');
}

/**
 * 드래프트가 존재하는지 확인
 */
export async function hasDraft(key: string): Promise<boolean> {
  try {
    const json = await AsyncStorage.getItem(`${DRAFT_PREFIX}${key}`);
    return json !== null;
  } catch (error) {
    console.error('Error checking draft:', error);
    return false;
  }
}

/**
 * 드래프트 나이 확인 (시간 단위)
 */
export async function getDraftAge(key: string): Promise<number | null> {
  try {
    const json = await AsyncStorage.getItem(`${DRAFT_PREFIX}${key}`);
    if (!json) return null;

    const draft: DraftData = JSON.parse(json);
    const ageHours = (Date.now() - draft.timestamp) / (1000 * 60 * 60);
    return ageHours;
  } catch (error) {
    console.error('Error getting draft age:', error);
    return null;
  }
}

/**
 * 유틸리티: 모든 드래프트 및 진행 상태 삭제
 */
export async function clearAllDrafts(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const draftKeys = allKeys.filter(
      key => key.startsWith(DRAFT_PREFIX) || key.startsWith(FORM_PROGRESS_PREFIX)
    );

    if (draftKeys.length > 0) {
      await AsyncStorage.multiRemove(draftKeys);
    }
  } catch (error) {
    console.error('Error clearing all drafts:', error);
  }
}
