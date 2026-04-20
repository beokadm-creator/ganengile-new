import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getStationByName } from '../../data/subway-stations';
import { BadgeService } from '../BadgeService';
import type { FirestoreUserDoc, FirestoreRouteDoc, LooseRouteInput } from './types';
import { snapshotExists, normalizeBadges } from './internal-helpers';
import type { Route } from '../../types/route';
import type { DeliveryRequest, GillerRoute, MatchingResult } from '../../data/matching-engine';
import type { RouteMatchScore } from '../../types/matching-extended';
import { namesLooselyEqual, normalizeStationName } from './internal-helpers';
import { calculateRouteMatchScore } from './filtering';

export async function calculateBadgeBonus(userId: string): Promise<{
  feeBonus: number;
  priorityBoost: number;
}> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!snapshotExists(userDoc)) {
      return { feeBonus: 0, priorityBoost: 0 };
    }

    const user = userDoc.data() as FirestoreUserDoc;
    const badgeTier = BadgeService.calculateBadgeTier(normalizeBadges(user.badges));

    const bonusConfig = {
      bronze: { feeBonus: 0.05, priorityBoost: 0 },
      silver: { feeBonus: 0.10, priorityBoost: 0 },
      gold: { feeBonus: 0.15, priorityBoost: 10 },
      platinum: { feeBonus: 0.20, priorityBoost: 20 },
      none: { feeBonus: 0, priorityBoost: 0 },
    };

    const tier = badgeTier.tier ?? 'none';
    return bonusConfig[tier];
  } catch (error) {
    console.error('Error calculating badge bonus:', error);
    return { feeBonus: 0, priorityBoost: 0 };
  }
}

async function fetchUserStats(userId: string): Promise<{
  rating: number;
  totalDeliveries: number;
  completedDeliveries: number;
}> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!snapshotExists(userDoc)) {
      return {
        rating: 3.5,
        totalDeliveries: 0,
        completedDeliveries: 0,
      };
    }

    const data = userDoc.data() as FirestoreUserDoc;
    const stats = data.stats ?? {};
    const gillerInfo = data.gillerInfo ?? {};

    return {
      rating: stats.rating ?? data.rating ?? 3.5,
      totalDeliveries: stats.totalDeliveries ?? stats.completedDeliveries ?? gillerInfo.totalDeliveries ?? 0,
      completedDeliveries: stats.completedDeliveries ?? gillerInfo.completedDeliveries ?? gillerInfo.totalDeliveries ?? 0,
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return {
      rating: 3.5,
      totalDeliveries: 0,
      completedDeliveries: 0,
    };
  }
}

export async function fetchActiveGillerRoutes(): Promise<GillerRoute[]> {
  try {
    const q = query(
      collection(db, 'routes'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const routes: GillerRoute[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as FirestoreRouteDoc;

      const startStationName = data.startStation?.stationName;
      const endStationName = data.endStation?.stationName;

      if (!data.userId || !startStationName || !endStationName) {
        return;
      }

      const startStation = getStationByName(startStationName);
      const endStation = getStationByName(endStationName);

      if (!startStation || !endStation) {
        console.warn(`Station not found for route ${docSnapshot.id}`);
        return;
      }

      const userStats = {
        rating: data.rating ?? 4.5,
        totalDeliveries: data.totalDeliveries ?? 0,
        completedDeliveries: data.completedDeliveries ?? 0,
      };

      routes.push({
        gillerId: data.userId,
        gillerName: data.gillerName ?? 'giller',
        startStation,
        endStation,
        departureTime: data.departureTime ?? '08:00',
        daysOfWeek: data.daysOfWeek ?? [1, 2, 3, 4, 5],
        rating: userStats.rating,
        totalDeliveries: userStats.totalDeliveries,
        completedDeliveries: userStats.completedDeliveries,
      });
    });

    return routes;
  } catch (error) {
    console.error('Error fetching giller routes:', error);
    throw error;
  }
}

export async function fetchUserInfo(userId: string): Promise<{
  name: string;
  rating: number;
  totalDeliveries: number;
  completedDeliveries: number;
  profileImage?: string;
}> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!snapshotExists(userDoc)) {
      return {
        name: 'giller',
        rating: 3.5,
        totalDeliveries: 0,
        completedDeliveries: 0,
        profileImage: undefined,
      };
    }

    const data = userDoc.data() as FirestoreUserDoc;
    const gillerInfo = data.gillerInfo ?? {};
    return {
      name: data.name ?? 'giller',
      rating: data.rating ?? 3.5,
      totalDeliveries: gillerInfo.totalDeliveries ?? 0,
      completedDeliveries: gillerInfo.completedDeliveries ?? gillerInfo.totalDeliveries ?? 0,
      profileImage: data.profilePhoto ?? data.profileImage ?? undefined,
    };
  } catch (error) {
    console.error('Error fetching user info:', error);
    return {
      name: 'giller',
      rating: 3.5,
      totalDeliveries: 0,
      completedDeliveries: 0,
      profileImage: undefined,
    };
  }
}

function normalizeRouteForMatching(routeData: LooseRouteInput, routeId: string): Route | null {
  if (!routeData?.userId || !routeData?.startStation || !routeData?.endStation) {
    return null;
  }

  const start = routeData.startStation;
  const end = routeData.endStation;

  const startStation = {
    stationId: start.stationId ?? start.id,
    stationName: start.stationName ?? '',
    line: start.line ?? start.lineName ?? '',
    lat: start.lat ?? start.latitude ?? 0,
    lng: start.lng ?? start.longitude ?? 0,
  };

  const endStation = {
    stationId: end.stationId ?? end.id,
    stationName: end.stationName ?? '',
    line: end.line ?? end.lineName ?? '',
    lat: end.lat ?? end.latitude ?? 0,
    lng: end.lng ?? end.longitude ?? 0,
  };

  if (!startStation.stationName || !endStation.stationName) {
    return null;
  }

  return {
    routeId,
    userId: routeData.userId,
    startStation,
    endStation,
    departureTime: routeData.departureTime ?? '08:00',
    daysOfWeek: Array.isArray(routeData.daysOfWeek) && routeData.daysOfWeek.length > 0
      ? routeData.daysOfWeek
      : [1, 2, 3, 4, 5, 6, 7],
    isActive: routeData.isActive !== false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Route;
}

async function findMatchesByRouteHeuristic(
  requestData: {
    id?: string;
    pickupStation?: { stationName?: string };
    deliveryStation?: { stationName?: string };
  },
  topN: number
): Promise<MatchingResult[]> {
  const snapshot = await getDocs(query(collection(db, 'routes'), where('isActive', '==', true)));
  const today = new Date().getDay();
  const dayOfWeek = today === 0 ? 7 : today;
  const requestPickup = requestData.pickupStation?.stationName ?? '';
  const requestDelivery = requestData.deliveryStation?.stationName ?? '';

  const routeCandidates: Array<{
    gillerId: string;
    route: Route;
    routeScore: RouteMatchScore;
  }> = [];

  snapshot.forEach((routeDoc) => {
    const route = normalizeRouteForMatching(routeDoc.data(), routeDoc.id);
    if (!route) return;

    const routeScore = calculateRouteMatchScore(requestData, route);
    const loosePickup = namesLooselyEqual(route.startStation.stationName, requestPickup);
    const looseDelivery = namesLooselyEqual(route.endStation.stationName, requestDelivery);
    const isTodayRoute = route.daysOfWeek.includes(dayOfWeek);
    const adjustedScore = routeScore.score + (isTodayRoute ? 10 : 0) + ((loosePickup || looseDelivery) ? 5 : 0);

    if (adjustedScore < 10) return;

    routeCandidates.push({
      gillerId: route.userId,
      route,
      routeScore: {
        ...routeScore,
        score: Math.min(100, adjustedScore),
      },
    });
  });

  routeCandidates.sort((a, b) => b.routeScore.score - a.routeScore.score);
  const uniqueByGiller = new Map<string, typeof routeCandidates[number]>();
  for (const candidate of routeCandidates) {
    if (!uniqueByGiller.has(candidate.gillerId)) {
      uniqueByGiller.set(candidate.gillerId, candidate);
    }
  }

  const topCandidates = Array.from(uniqueByGiller.values()).slice(0, Math.max(topN * 2, 10));
  const hydrated = await Promise.all(topCandidates.map(async (candidate) => {
    const [userInfo, userStats] = await Promise.all([
      fetchUserInfo(candidate.gillerId),
      fetchUserStats(candidate.gillerId),
    ]);
    return { ...candidate, userInfo, userStats };
  }));

  return hydrated
    .map((item) => {
      const routeMatchScore = Math.min(50, Math.round(item.routeScore.score * 0.5));
      const timeMatchScore = Math.min(30, Math.round((item.routeScore.details.timeScore + item.routeScore.details.dayOfWeekScore) * 1.2));
      const ratingScore = Math.min(15, Math.round(((item.userStats.rating - 1) / 4) * 15));
      const completionRate = item.userStats.totalDeliveries > 0
        ? (item.userStats.completedDeliveries / item.userStats.totalDeliveries)
        : 0.5;
      const completionRateScore = Math.min(5, Math.round(completionRate * 5));
      const totalScore = routeMatchScore + timeMatchScore + ratingScore + completionRateScore;

      return {
        gillerId: item.gillerId,
        gillerName: item.userInfo.name ?? 'giller',
        totalScore,
        routeMatchScore,
        timeMatchScore,
        ratingScore,
        completionRateScore,
        scores: {
          pickupMatchScore: item.routeScore.details.pickupStationScore,
          deliveryMatchScore: item.routeScore.details.deliveryStationScore,
          departureTimeMatchScore: item.routeScore.details.timeScore,
          scheduleFlexibilityScore: item.routeScore.details.dayOfWeekScore,
          ratingRawScore: ratingScore,
          completionRateRawScore: completionRateScore,
        },
        routeDetails: {
          travelTime: Math.max(1200, Math.round(3600 - item.routeScore.score * 20)),
          isExpressAvailable: false,
          transferCount: item.routeScore.routeDirection === 'exact' ? 0 : 1,
          congestionLevel: 'medium' as const,
        },
        reasons: [
          item.routeScore.pickupMatch ? '출발역 기준으로 등록 동선과 잘 맞습니다.' : '출발역 기준 동선 일치도가 낮습니다.',
          item.routeScore.deliveryMatch ? '도착역 기준으로 등록 동선과 잘 맞습니다.' : '도착역 기준 동선 일치도가 낮습니다.',
        ],
      } as MatchingResult;
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, topN);
}

export { findMatchesByRouteHeuristic };
