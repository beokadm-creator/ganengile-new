import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoLinking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from './firebase';
import type { RootStackParamList } from '../types/navigation';

const STORAGE_KEY = '@channel_attribution';

export interface ChannelAttributionPayload {
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
  channel: string;
  referrer?: string;
  inviterCode?: string;
  deeplinkPath: string;
  rawUrl: string;
  detectedAt: string;
  entrySource: 'initial_url' | 'url_event' | 'web';
}

export interface StoredChannelAttribution {
  firstTouch: ChannelAttributionPayload;
  lastTouch: ChannelAttributionPayload;
  syncedUserIds: string[];
}

function normalizeText(value: string | null | undefined, fallback = ''): string {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function toChannelValue(parsed: ReturnType<typeof ExpoLinking.parse>): string {
  const queryParams = parsed.queryParams ?? {};
  const explicitChannel =
    normalizeText(String(queryParams.channel ?? ''), '') ||
    normalizeText(String(queryParams.utm_source ?? ''), '') ||
    normalizeText(String(queryParams.ref ?? ''), '');

  if (explicitChannel) {
    return explicitChannel.toLowerCase();
  }

  if (parsed.hostname) {
    return parsed.hostname.toLowerCase();
  }

  return 'direct';
}

function getDeepLinkPath(parsed: ReturnType<typeof ExpoLinking.parse>): string {
  const path = normalizeText(parsed.path ?? '', '');
  return path || 'home';
}

function buildPayload(url: string, entrySource: ChannelAttributionPayload['entrySource']): ChannelAttributionPayload {
  const parsed = ExpoLinking.parse(url);
  const queryParams = parsed.queryParams ?? {};

  return {
    source: normalizeText(String(queryParams.utm_source ?? ''), 'direct'),
    medium: normalizeText(String(queryParams.utm_medium ?? ''), 'none'),
    campaign: normalizeText(String(queryParams.utm_campaign ?? ''), 'none'),
    term: normalizeText(String(queryParams.utm_term ?? ''), ''),
    content: normalizeText(String(queryParams.utm_content ?? ''), ''),
    channel: toChannelValue(parsed),
    referrer: normalizeText(String(queryParams.referrer ?? queryParams.ref ?? ''), ''),
    inviterCode: normalizeText(String(queryParams.invite ?? queryParams.inviter ?? queryParams.code ?? ''), ''),
    deeplinkPath: getDeepLinkPath(parsed),
    rawUrl: url,
    detectedAt: new Date().toISOString(),
    entrySource,
  };
}

function hasAttributionSignal(payload: ChannelAttributionPayload): boolean {
  return Boolean(
    payload.source !== 'direct' ||
      payload.medium !== 'none' ||
      payload.campaign !== 'none' ||
      payload.referrer ||
      payload.inviterCode ||
      payload.deeplinkPath !== 'home'
  );
}

export async function getStoredChannelAttribution(): Promise<StoredChannelAttribution | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as StoredChannelAttribution;
  } catch (error) {
    console.error('Failed to read stored channel attribution', error);
    return null;
  }
}

export async function captureChannelAttributionFromUrl(
  url: string,
  entrySource: ChannelAttributionPayload['entrySource']
): Promise<StoredChannelAttribution | null> {
  if (!url) {
    return null;
  }

  const payload = buildPayload(url, entrySource);
  if (!hasAttributionSignal(payload)) {
    return null;
  }

  const current = await getStoredChannelAttribution();
  const next: StoredChannelAttribution = {
    firstTouch: current?.firstTouch ?? payload,
    lastTouch: payload,
    syncedUserIds: current?.syncedUserIds ?? [],
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function syncStoredChannelAttributionToUser(userId: string): Promise<void> {
  if (!userId) {
    return;
  }

  const stored = await getStoredChannelAttribution();
  if (!stored || stored.syncedUserIds.includes(userId)) {
    return;
  }

  await setDoc(
    doc(db, 'users', userId),
    {
      acquisition: {
        firstTouch: stored.firstTouch,
        lastTouch: stored.lastTouch,
        syncedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const next: StoredChannelAttribution = {
    ...stored,
    syncedUserIds: [...stored.syncedUserIds, userId],
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function buildLinkingConfig(): LinkingOptions<RootStackParamList> {
  return {
    prefixes: [
      ExpoLinking.createURL('/'),
      'ganengile://',
      'https://ganengile.app',
      'https://www.ganengile.app',
    ],
    config: {
      screens: {
        Auth: {
          screens: {
            Landing: '',
            NewSignUp: 'signup',
            Login: 'login',
          },
        },
        Onboarding: 'onboarding',
        Main: {
          screens: {
            Tabs: {
              screens: {
                Home: 'home',
                Requests: 'requests',
                GillerRequests: 'missions',
                ChatList: 'chat',
                RouteManagement: 'routes',
                Profile: 'profile',
              },
            },
            CreateRequest: 'request/new',
            RequestDetail: 'request/:requestId',
            MatchingResult: 'request/:requestId/matching',
            Chat: 'chat/:chatRoomId',
            IdentityVerification: 'verify/identity',
            GillerApply: 'giller/apply',
            LockerMap: 'lockers',
          },
        },
        B2B: {
          screens: {
            B2BDashboard: 'b2b',
            B2BRequest: 'b2b/request',
          },
        },
      },
    } as LinkingOptions<RootStackParamList>['config'],
  };
}
