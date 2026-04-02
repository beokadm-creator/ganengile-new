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
  const feeTotal = resolveFeeTotal(request.fee, request.initialNegotiationFee || 0);

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

  const fallbackEvents: TrackingEvent[] = [
    {
      type: 'created',
      title: '요청 생성',
      description: '배송 요청이 생성되었습니다.',
      timestamp: createdAt,
      completed: true,
    },
    {
      type: 'matched',
      title: '매칭 완료',
      description: '길러가 매칭되었습니다.',
      timestamp: updatedAt,
      completed: ['matched', 'accepted', 'in_transit', 'arrived', 'completed'].includes(status),
    },
    {
      type: 'accepted',
      title: '수락 완료',
      description: '길러가 배송을 수락했습니다.',
      timestamp: updatedAt,
      completed: ['accepted', 'in_transit', 'arrived', 'completed'].includes(status),
    },
    {
      type: 'picked_up',
      title: '픽업 완료',
      description: '물품을 수령했습니다.',
      timestamp: updatedAt,
      completed: ['in_transit', 'arrived', 'completed'].includes(status),
    },
    {
      type: 'in_transit',
      title: '배송 중',
      description: '지정된 경로를 따라 이동 중입니다.',
      timestamp: updatedAt,
      completed: ['in_transit', 'arrived', 'completed'].includes(status),
    },
    {
      type: 'arrived',
      title: '도착 완료',
      description: '목적지에 도착했습니다.',
      timestamp: updatedAt,
      completed: ['arrived', 'completed'].includes(status),
    },
    {
      type: 'completed',
      title: '배송 완료',
      description: '배송이 완료되었습니다.',
      timestamp: updatedAt,
      completed: status === 'completed',
    },
  ];

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
          if (typeof item?.latitude !== 'number' || typeof item?.longitude !== 'number') {
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
    case 'completed':
      return '배송 완료';
    case 'matched':
      return '매칭 완료';
    case 'created':
      return '요청 생성';
    default:
      return '상태 변경';
  }
}

function toDateOrUndefined(value: Date | Timestamp | undefined | null): Date | undefined {
  if (!value) return undefined;
  return value instanceof Timestamp ? value.toDate() : value;
}
