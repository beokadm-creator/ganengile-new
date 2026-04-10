import { Timestamp } from 'firebase/firestore';
import type { Request } from '../types/request';
import { RequestStatus } from '../types/request';

export interface TrackingEvent {
  type: string;
  title: string;
  description: string;
  timestamp?: Date;
  completed: boolean;
}

export interface TrackingModel {
  status: string;
  pickupStation: { stationName: string; line: string; lat?: number; lng?: number };
  deliveryStation: { stationName: string; line: string; lat?: number; lng?: number };
  courierLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: Date;
  };
  locationHistory?: Array<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number | null;
    heading?: number | null;
    timestamp?: Date;
  }>;
  packageInfo: { size: string; weight: string | number; weightKg?: number; description?: string };
  recipientName?: string;
  recipientVerificationCode?: string;
  createdAt?: Date;
  updatedAt?: Date;
  trackingEvents?: TrackingEvent[];
  deliveryId?: string;
  gillerId?: string;
  gillerName?: string;
  estimatedMinutes?: number;
}

export interface RequestDetailView {
  status: RequestStatus;
  pickupStation: { stationName: string; line: string };
  deliveryStation: { stationName: string; line: string };
  packageInfo: { size: string; weight: string | number; weightKg?: number; description?: string };
  feeTotal: number;
  deadline?: Date;
  preferredTime?: { departureTime?: string; arrivalTime?: string };
  createdAt?: Date;
  cancellationReason?: string;
  cancelledAt?: Date;
}

interface FeeShape {
  totalFee?: unknown;
  total?: {
    fee?: unknown;
  };
  estimatedTime?: unknown;
}

interface TrackingEventInput {
  type?: string;
  description?: string;
  timestamp?: Date | Timestamp | null;
}

interface TrackingInput {
  status?: string;
  pickupStation?: {
    stationName?: string;
    line?: string;
    lat?: number;
    lng?: number;
  };
  deliveryStation?: {
    stationName?: string;
    line?: string;
    lat?: number;
    lng?: number;
  };
  packageInfo?: {
    size?: string;
    weight?: string | number;
    weightKg?: number;
    description?: string;
  };
  recipientInfo?: {
    name?: string;
    verificationCode?: string;
  };
  recipientName?: string;
  recipientVerificationCode?: string;
  createdAt?: Date | Timestamp | null;
  updatedAt?: Date | Timestamp | null;
  matchedAt?: Date | Timestamp | null;
  acceptedAt?: Date | Timestamp | null;
  pickedUpAt?: Date | Timestamp | null;
  arrivedAt?: Date | Timestamp | null;
  deliveredAt?: Date | Timestamp | null;
  requesterConfirmedAt?: Date | Timestamp | null;
  tracking?: {
    events?: TrackingEventInput[];
    courierLocation?: {
      location?: {
        latitude?: number;
        longitude?: number;
      };
      accuracy?: number;
      timestamp?: Date | Timestamp | null;
    };
    locationHistory?: Array<{
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      speed?: number | null;
      heading?: number | null;
      timestamp?: Date | Timestamp | null;
    }>;
  };
  deliveryId?: string;
  gillerId?: string;
  matchedGillerId?: string;
  gillerName?: string;
  gillerInfo?: {
    name?: string;
  };
  estimatedMinutes?: number;
  fee?: FeeShape;
}

export function toRequestDetailView(request: Request): RequestDetailView {
  const feeTotal = resolveFeeTotal(request.fee, request.initialNegotiationFee ?? 0);

  return {
    status: request.status,
    pickupStation: {
      stationName: request.pickupStation?.stationName ?? '-',
      line: request.pickupStation?.line ?? '',
    },
    deliveryStation: {
      stationName: request.deliveryStation?.stationName ?? '-',
      line: request.deliveryStation?.line ?? '',
    },
    packageInfo: {
      size: request.packageInfo?.size ?? '-',
      weight: request.packageInfo?.weight ?? '-',
      weightKg: request.packageInfo?.weightKg,
      description: request.packageInfo?.description,
    },
    feeTotal,
    deadline: request.deadline instanceof Timestamp ? request.deadline.toDate() : request.deadline,
    preferredTime: request.preferredTime,
    createdAt: request.createdAt instanceof Timestamp ? request.createdAt.toDate() : request.createdAt,
    cancellationReason: request.cancellationReason,
    cancelledAt: request.cancelledAt instanceof Timestamp ? request.cancelledAt.toDate() : request.cancelledAt,
  };
}

function resolveFeeTotal(rawFee: FeeShape | undefined, fallback: number): number {
  const direct = extractNumber(rawFee);
  if (typeof direct === 'number') return direct;

  if (rawFee && typeof rawFee === 'object') {
    const totalFee = extractNumber(rawFee.totalFee);
    if (typeof totalFee === 'number') return totalFee;

    const nestedTotalFee = extractNumber(rawFee.total?.fee);
    if (typeof nestedTotalFee === 'number') return nestedTotalFee;
  }

  return Number.isFinite(fallback) ? fallback : 0;
}

function extractNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const normalized = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(normalized) ? normalized : undefined;
  }
  return undefined;
}

function createFallbackEvent(
  type: string,
  title: string,
  description: string,
  timestamp?: Date
): TrackingEvent | null {
  if (!timestamp) {
    return null;
  }

  return {
    type,
    title,
    description,
    timestamp,
    completed: true,
  };
}

function buildFallbackTrackingEvents(data: TrackingInput, createdAt?: Date, updatedAt?: Date): TrackingEvent[] {
  const events = [
    createFallbackEvent('created', '요청 생성', '배송 요청이 생성되었습니다.', createdAt),
    createFallbackEvent('matched', '매칭 완료', '길러가 매칭되었습니다.', toDateOrUndefined(data.matchedAt)),
    createFallbackEvent('accepted', '수락 완료', '길러가 배송을 수락했습니다.', toDateOrUndefined(data.acceptedAt)),
    createFallbackEvent('picked_up', '픽업 완료', '물품을 수령했습니다.', toDateOrUndefined(data.pickedUpAt)),
    createFallbackEvent('in_transit', '배송 중', '지정된 경로를 따라 이동 중입니다.', toDateOrUndefined(data.pickedUpAt)),
    createFallbackEvent('arrived', '도착 완료', '목적지에 도착했습니다.', toDateOrUndefined(data.arrivedAt)),
    createFallbackEvent('delivered', '전달 완료', '수령 확인을 기다리고 있습니다.', toDateOrUndefined(data.deliveredAt)),
    createFallbackEvent(
      'completed',
      '배송 완료',
      '배송이 완료되었습니다.',
      toDateOrUndefined(data.requesterConfirmedAt) ?? (data.status === 'completed' ? updatedAt : undefined)
    ),
  ].filter((event): event is TrackingEvent => event != null);

  if (events.length > 0) {
    return events.sort((left, right) => {
      const leftTime = left.timestamp?.getTime() ?? 0;
      const rightTime = right.timestamp?.getTime() ?? 0;
      return leftTime - rightTime;
    });
  }

  if (!createdAt && updatedAt && data.status && data.status !== 'pending') {
    return [
      {
        type: data.status,
        title: eventTitle(data.status),
        description: eventTitle(data.status),
        timestamp: updatedAt,
        completed: true,
      },
    ];
  }

  return [];
}

export function toTrackingModel(data: TrackingInput): TrackingModel {
  const createdAt = toDateOrUndefined(data.createdAt);
  const updatedAt = toDateOrUndefined(data.updatedAt);
  const status = data.status ?? 'pending';

  const eventsFromTracking = Array.isArray(data.tracking?.events)
    ? data.tracking.events.map((event) => {
        const type = event.type ?? 'status_changed';
        return {
          type,
          title: eventTitle(type),
          description: event.description ?? eventTitle(type),
          timestamp: toDateOrUndefined(event.timestamp),
          completed: true,
        };
      })
    : null;

  const fallbackEvents = buildFallbackTrackingEvents(data, createdAt, updatedAt);

  return {
    status,
    pickupStation: {
      stationName: data.pickupStation?.stationName ?? '-',
      line: data.pickupStation?.line ?? '',
      lat: typeof data.pickupStation?.lat === 'number' ? data.pickupStation.lat : undefined,
      lng: typeof data.pickupStation?.lng === 'number' ? data.pickupStation.lng : undefined,
    },
    deliveryStation: {
      stationName: data.deliveryStation?.stationName ?? '-',
      line: data.deliveryStation?.line ?? '',
      lat: typeof data.deliveryStation?.lat === 'number' ? data.deliveryStation.lat : undefined,
      lng: typeof data.deliveryStation?.lng === 'number' ? data.deliveryStation.lng : undefined,
    },
    courierLocation:
      typeof data.tracking?.courierLocation?.location?.latitude === 'number' &&
      typeof data.tracking?.courierLocation?.location?.longitude === 'number'
        ? {
            latitude: data.tracking.courierLocation.location.latitude,
            longitude: data.tracking.courierLocation.location.longitude,
            accuracy: data.tracking.courierLocation.accuracy,
            timestamp: toDateOrUndefined(data.tracking.courierLocation.timestamp),
          }
        : undefined,
    locationHistory: Array.isArray(data.tracking?.locationHistory)
      ? data.tracking.locationHistory.reduce<NonNullable<TrackingModel['locationHistory']>>((acc, item) => {
          if (typeof item?.latitude !== 'number' ?? typeof item?.longitude !== 'number') { // eslint-disable-line no-constant-binary-expression, no-constant-condition
            return acc;
          }

          acc.push({
            latitude: item.latitude,
            longitude: item.longitude,
            accuracy: item.accuracy,
            speed: item.speed,
            heading: item.heading,
            timestamp: toDateOrUndefined(item.timestamp),
          });

          return acc;
        }, [])
      : undefined,
    packageInfo: {
      size: data.packageInfo?.size ?? '-',
      weight: data.packageInfo?.weight ?? '-',
      weightKg: data.packageInfo?.weightKg,
      description: data.packageInfo?.description,
    },
    recipientName: data.recipientInfo?.name ?? data.recipientName,
    recipientVerificationCode: data.recipientInfo?.verificationCode ?? data.recipientVerificationCode,
    createdAt,
    updatedAt,
    trackingEvents: eventsFromTracking ?? fallbackEvents,
    deliveryId: data.deliveryId,
    gillerId: data.gillerId ?? data.matchedGillerId,
    gillerName: data.gillerName ?? data.gillerInfo?.name,
    estimatedMinutes: data.estimatedMinutes ?? extractNumber(data.fee?.estimatedTime),
  };
}

function eventTitle(type: string): string {
  switch (type) {
    case 'accepted':
      return '수락 완료';
    case 'picked_up':
      return '픽업 완료';
    case 'in_transit':
      return '배송 중';
    case 'arrived':
      return '도착 완료';
    case 'delivered':
      return '전달 완료';
    case 'completed':
    case 'confirmed_by_requester':
      return '배송 완료';
    case 'matched':
      return '매칭 완료';
    case 'created':
      return '요청 생성';
    case 'dropped_at_locker':
      return '보관함 전달';
    default:
      return '상태 변경';
  }
}

function toDateOrUndefined(value: Date | Timestamp | undefined | null): Date | undefined {
  if (!value) return undefined;
  return value instanceof Timestamp ? value.toDate() : value;
}
