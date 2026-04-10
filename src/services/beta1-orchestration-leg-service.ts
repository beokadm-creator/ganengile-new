import type { DeliveryActorType, DeliveryLegType, LocationRef, MissionType } from '../types/beta1';
import { type LegacyStationInfo as StationInfo } from '../utils/request-draft-adapters';

export function toLocationRef(station: StationInfo): LocationRef {
  return {
    type: 'station',
    stationId: station.stationId,
    stationName: station.stationName,
    latitude: station.lat,
    longitude: station.lng,
  };
}

export function toAddressLocationRef(address: string, station: StationInfo): LocationRef {
  return {
    type: 'address',
    addressText: address,
    roadAddress: address,
    stationId: station.stationId,
    stationName: station.stationName,
    latitude: station.lat,
    longitude: station.lng,
  };
}

export function formatDetailedAddress(roadAddress?: string, detailAddress?: string): string | undefined {
  const road = (roadAddress ?? '').trim();
  const detail = (detailAddress ?? '').trim();
  if (!road) return undefined;
  return detail ? `${road} ${detail}` : road;
}

export function mapLegTypeToMissionType(legType: DeliveryLegType): MissionType {
  switch (legType) {
    case 'pickup_address':
    case 'pickup_station':
      return 'pickup';
    case 'locker_dropoff':
      return 'locker_dropoff';
    case 'locker_pickup':
      return 'locker_pickup';
    case 'meetup_handover':
      return 'meetup_handover';
    case 'last_mile_address':
      return 'last_mile';
    case 'subway_transport':
    default:
      return 'subway_transport';
  }
}

export function describeLocationRef(location: LocationRef): string {
  if (location.type === 'address') {
    return location.addressText ?? location.roadAddress ?? '주소';
  }
  if (location.type === 'locker') {
    return location.lockerId ?? location.stationName ?? '보관함';
  }
  return location.stationName ?? '역';
}

export function describeLegType(legType: DeliveryLegType): string {
  switch (legType) {
    case 'pickup_address':
      return '주소 수거';
    case 'pickup_station':
      return '출발역 인계';
    case 'locker_dropoff':
      return '보관함 투입';
    case 'locker_pickup':
      return '보관함 수령';
    case 'meetup_handover':
      return '대면 인계';
    case 'last_mile_address':
      return '도착지 전달';
    case 'subway_transport':
    default:
      return '역간 이동';
  }
}

export function requiresAddressHandling(legType: DeliveryLegType): boolean {
  return legType === 'pickup_address' || legType === 'last_mile_address';
}

export function buildMissionWindowLabel(missionCount: number, requiresPartner: boolean): string {
  if (requiresPartner) {
    return '주소 구간 포함, 빠른 선택 권장';
  }
  return missionCount > 1 ? '연속 구간 선택 가능' : '지금 수락 가능';
}

export function splitRewardAcrossLegs(totalReward: number, legCount: number): number[] {
  if (legCount <= 0) {
    return [];
  }

  const base = Math.floor(totalReward / legCount);
  const rewards = Array.from({ length: legCount }, () => base);
  let remainder = totalReward - base * legCount;

  for (let index = 0; index < rewards.length && remainder > 0; index += 1) {
    rewards[index] += 1;
    remainder -= 1;
  }

  return rewards;
}

export function buildSegmentedLegDefinitions(input: {
  requestId: string;
  deliveryId: string;
  originType: 'station' | 'address';
  destinationType: 'station' | 'address';
  pickupStation: StationInfo;
  deliveryStation: StationInfo;
  pickupAddress?: string;
  pickupRoadAddress?: string;
  pickupDetailAddress?: string;
  deliveryAddress?: string;
  deliveryRoadAddress?: string;
  deliveryDetailAddress?: string;
}): Array<{
  legType: DeliveryLegType;
  actorType: DeliveryActorType;
  sequence: number;
  originRef: LocationRef;
  destinationRef: LocationRef;
}> {
  const legs: Array<{
    legType: DeliveryLegType;
    actorType: DeliveryActorType;
    sequence: number;
    originRef: LocationRef;
    destinationRef: LocationRef;
  }> = [];

  if (input.originType === 'address' && input.pickupAddress) {
    legs.push({
      legType: 'pickup_address',
      actorType: 'giller',
      sequence: legs.length + 1,
      originRef: {
        ...toAddressLocationRef(input.pickupAddress, input.pickupStation),
        roadAddress: input.pickupRoadAddress?.trim(),
        detailAddress: input.pickupDetailAddress?.trim(),
      },
      destinationRef: toLocationRef(input.pickupStation),
    });
  }

  if (
    input.pickupStation.stationId !== input.deliveryStation.stationId ||
    input.pickupStation.stationName !== input.deliveryStation.stationName
  ) {
    legs.push({
      legType: 'subway_transport',
      actorType: 'giller',
      sequence: legs.length + 1,
      originRef: toLocationRef(input.pickupStation),
      destinationRef: toLocationRef(input.deliveryStation),
    });
  }

  if (input.destinationType === 'address' && input.deliveryAddress) {
    legs.push({
      legType: 'last_mile_address',
      actorType: 'giller',
      sequence: legs.length + 1,
      originRef: toLocationRef(input.deliveryStation),
      destinationRef: {
        ...toAddressLocationRef(input.deliveryAddress, input.deliveryStation),
        roadAddress: input.deliveryRoadAddress?.trim(),
        detailAddress: input.deliveryDetailAddress?.trim(),
      },
    });
  }

  if (legs.length === 0) {
    legs.push({
      legType: 'subway_transport',
      actorType: 'giller',
      sequence: 1,
      originRef: toLocationRef(input.pickupStation),
      destinationRef: toLocationRef(input.deliveryStation),
    });
  }

  return legs.map((leg, index) => ({
    ...leg,
    sequence: index + 1,
  }));
}
