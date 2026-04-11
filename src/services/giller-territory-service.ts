import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { getAllStations } from './config-service';
import { db } from './firebase';
import { locationService } from './location-service';
import type { Station } from '../types/config';
import type { GillerTerritory, User } from '../types/user';

const MAX_TERRITORIES = 2;
const DEFAULT_RADIUS_KM = 6;

function buildTerritoryId(station: Station): string {
  return `territory-${station.stationId}`;
}

function findNearestStation(latitude: number, longitude: number, stations: Station[]): Station | null {
  if (!stations.length) {
    return null;
  }

  let nearest: Station | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  stations.forEach((station) => {
    const distance = locationService.calculateDistance(
      latitude,
      longitude,
      station.location.latitude,
      station.location.longitude
    );

    if (distance < nearestDistance) {
      nearest = station;
      nearestDistance = distance;
    }
  });

  return nearest;
}

export async function saveCurrentLocationAsGillerTerritory(
  userId: string,
  existingProfile?: User['gillerProfile']
): Promise<GillerTerritory[]> {
  const currentLocation = await locationService.getCurrentLocation();
  if (!currentLocation) {
    throw new Error('현재 위치를 확인할 수 없습니다.');
  }

  const stations = await getAllStations();
  const nearestStation = findNearestStation(currentLocation.latitude, currentLocation.longitude, stations);
  if (!nearestStation) {
    throw new Error('권역 기준 역을 찾지 못했습니다.');
  }

  const nextTerritory: GillerTerritory = {
    territoryId: buildTerritoryId(nearestStation),
    label: `${nearestStation.stationName} 권역`,
    stationId: nearestStation.stationId,
    stationName: nearestStation.stationName,
    region: nearestStation.region,
    latitude: nearestStation.location.latitude,
    longitude: nearestStation.location.longitude,
    radiusKm: DEFAULT_RADIUS_KM,
    source: 'current_location',
    verifiedAt: new Date().toISOString(),
  };

  const previousTerritories = existingProfile?.territories ?? [];
  const merged = [nextTerritory, ...previousTerritories.filter((item) => item.territoryId !== nextTerritory.territoryId)]
    .slice(0, MAX_TERRITORIES);

  await updateDoc(doc(db, 'users', userId), {
    gillerProfile: {
      ...(existingProfile ?? {}),
      territories: merged,
      activeTerritoryId: nextTerritory.territoryId,
    },
    updatedAt: serverTimestamp(),
  });

  return merged;
}

export async function setActiveGillerTerritory(
  userId: string,
  territoryId: string,
  existingProfile?: User['gillerProfile']
): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    gillerProfile: {
      ...(existingProfile ?? {}),
      activeTerritoryId: territoryId,
    },
    updatedAt: serverTimestamp(),
  });
}
