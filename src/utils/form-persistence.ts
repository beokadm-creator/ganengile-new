/**
 * Form Persistence Utility
 * Auto-save form progress to AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { decryptStorageJson, encryptStorageJson } from './secure-local-storage';

export interface FormData {
  [key: string]: any;
}

const PREFIX = 'form_draft_';

/**
 * Save form data to AsyncStorage
 */
export async function saveFormDraft(formId: string, data: FormData): Promise<void> {
  try {
    const key = `${PREFIX}${formId}`;
    await AsyncStorage.setItem(key, await encryptStorageJson({
      data,
      timestamp: Date.now(),
    }));
    // Form draft saved
  } catch (error) {
    console.error('Error saving form draft:', error);
  }
}

/**
 * Load form data from AsyncStorage
 */
export async function loadFormDraft(formId: string): Promise<FormData | null> {
  try {
    const key = `${PREFIX}${formId}`;
    const value = await AsyncStorage.getItem(key);

    if (!value) {
      return null;
    }

    const parsed = await decryptStorageJson<{ data: FormData; timestamp: number }>(value);

    // Check if draft is too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - parsed.timestamp > maxAge) {
      await clearFormDraft(formId);
      return null;
    }

    // Form draft loaded
    return parsed.data;
  } catch (error) {
    console.error('Error loading form draft:', error);
    return null;
  }
}

/**
 * Clear form data from AsyncStorage
 */
export async function clearFormDraft(formId: string): Promise<void> {
  try {
    const key = `${PREFIX}${formId}`;
    await AsyncStorage.removeItem(key);
    // Form draft cleared
  } catch (error) {
    console.error('Error clearing form draft:', error);
  }
}

/**
 * Get all form drafts
 */
export async function getAllFormDrafts(): Promise<Array<{ formId: string; data: FormData; timestamp: number }>> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const formKeys = keys.filter(key => key.startsWith(PREFIX));

    const drafts = await Promise.all(
      formKeys.map(async (key) => {
        const value = await AsyncStorage.getItem(key);
        if (!value) return null;

        const parsed = await decryptStorageJson<{ data: FormData; timestamp: number }>(value);
        return {
          formId: key.replace(PREFIX, ''),
          data: parsed.data,
          timestamp: parsed.timestamp,
        };
      })
    );

    return drafts.filter((draft): draft is { formId: string; data: FormData; timestamp: number } => draft !== null);
  } catch (error) {
    console.error('Error getting all form drafts:', error);
    return [];
  }
}

/**
 * Clear old form drafts (older than 24 hours)
 */
export async function clearOldFormDrafts(): Promise<void> {
  try {
    const drafts = await getAllFormDrafts();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const draft of drafts) {
      if (Date.now() - draft.timestamp > maxAge) {
        await clearFormDraft(draft.formId);
      }
    }

    // Old form drafts cleared
  } catch (error) {
    console.error('Error clearing old form drafts:', error);
  }
}
