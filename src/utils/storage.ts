/**
 * AsyncStorage Utilities
 * 온보딩 및 임시 데이터 저장을 위한 유틸리티
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { decryptStorageJson, encryptStorageJson } from './secure-local-storage';

const KEYS = {
  // Onboarding
  ONBOARDING_LAST_STEP: 'onboarding_last_step',
  ONBOARDING_TEMP_DATA: 'onboarding_temp_data',

  // User
  USER_ROLE: 'user_current_role',

  // App
  SKIP_ONBOARDING: 'skip_onboarding',
} as const;

/**
 * 온보딩 마지막 완료 단계 저장
 */
export async function saveOnboardingStep(step: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.ONBOARDING_LAST_STEP, step);
    console.log('💾 Onboarding step saved:', step);
  } catch (error) {
    console.error('Error saving onboarding step:', error);
  }
}

/**
 * 온보딩 마지막 완료 단계 가져오기
 */
export async function getOnboardingStep(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.ONBOARDING_LAST_STEP);
  } catch (error) {
    console.error('Error getting onboarding step:', error);
    return null;
  }
}

/**
 * 온보딩 임시 데이터 저장 (중단 후 복구용)
 */
export async function saveOnboardingTempData(data: Record<string, unknown>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.ONBOARDING_TEMP_DATA, await encryptStorageJson(data));
    console.log('💾 Onboarding temp data saved:', data);
  } catch (error) {
    console.error('Error saving onboarding temp data:', error);
  }
}

/**
 * 온보딩 임시 데이터 가져오기
 */
export async function getOnboardingTempData(): Promise<Record<string, unknown> | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.ONBOARDING_TEMP_DATA);
    return data ? await decryptStorageJson<Record<string, unknown>>(data) : null;
  } catch (error) {
    console.error('Error getting onboarding temp data:', error);
    return null;
  }
}

/**
 * 온보딩 데이터 모두 삭제 (완료 후)
 */
export async function clearOnboardingData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      KEYS.ONBOARDING_LAST_STEP,
      KEYS.ONBOARDING_TEMP_DATA,
    ]);
    console.log('💾 Onboarding data cleared');
  } catch (error) {
    console.error('Error clearing onboarding data:', error);
  }
}

/**
 * 현재 사용자 역할 저장
 */
export function saveCurrentRole(role: 'gller' | 'giller' | 'both'): Promise<void> {
  try {
    // await AsyncStorage.setItem(KEYS.USER_ROLE, role);
    console.log('💾 Current role saved:', role);
    return Promise.resolve();
  } catch (error) {
    console.error('Error saving current role:', error);
    return Promise.reject(error instanceof Error ? error : new Error('Failed to save current role'));
  }
}

/**
 * 현재 사용자 역할 가져오기
 */
export function getCurrentRole(): Promise<'gller' | 'giller' | 'both' | null> {
  try {
    // const role = await AsyncStorage.getItem(KEYS.USER_ROLE);
    // return role as 'gller' | 'giller' | 'both' | null;
    console.log('💾 Current role retrieved');
    return Promise.resolve(null);
  } catch (error) {
    console.error('Error getting current role:', error);
    return Promise.resolve(null);
  }
}
