import { Timestamp } from 'firebase/firestore';
import type { Request } from '../types/request';

export interface TrackingEvent {
  type: string;
  title: string;
  description: string;
  timestamp?: Date;
  completed: boolean;
}

export interface TrackingModel {
  status: string;
  pickupStation: { stationName: string; line: string };
  deliveryStation: { stationName: string; line: string };
  packageInfo: { size: string; weight: string | number; description?: string };
  recipientName?: string;
  recipientVerificationCode?: string;
  createdAt?: Date;
  updatedAt?: Date;
  trackingEvents?: TrackingEvent[];
  deliveryId?: string;
}

export interface RequestDetailView {
  status: string;
  pickupStation: { stationName: string; line: string };
  deliveryStation: { stationName: string; line: string };
  packageInfo: { size: string; weight: string | number; description?: string };
  feeTotal: number;
  deadline?: Date;
  preferredTime?: { departureTime?: string; arrivalTime?: string };
  createdAt?: Date;
  cancellationReason?: string;
  cancelledAt?: Date;
}

export function toRequestDetailView(request: Request): RequestDetailView {
  return {
    status: request.status,
    pickupStation: {
      stationName: request.pickupStation?.stationName || '-',
      line: request.pickupStation?.line || '',
    },
    deliveryStation: {
      stationName: request.deliveryStation?.stationName || '-',
      line: request.deliveryStation?.line || '',
    },
    packageInfo: {
      size: request.packageInfo?.size || '-',
      weight: request.packageInfo?.weight ?? '-',
      description: request.packageInfo?.description,
    },
    feeTotal: request.fee || 0,
    deadline: request.deadline instanceof Timestamp ? request.deadline.toDate() : request.deadline,
    preferredTime: request.preferredTime,
    createdAt: request.createdAt instanceof Timestamp ? request.createdAt.toDate() : request.createdAt,
    cancellationReason: request.cancellationReason,
    cancelledAt: request.cancelledAt instanceof Timestamp ? request.cancelledAt.toDate() : request.cancelledAt,
  };
}

export function toTrackingModel(data: any): TrackingModel {
  const createdAt = toDateOrUndefined(data.createdAt);
  const updatedAt = toDateOrUndefined(data.updatedAt);
  const status = data.status as string;

  const eventsFromTracking = Array.isArray(data.tracking?.events)
    ? data.tracking.events.map((event: any) => ({
        type: event.type,
        title: eventTitle(event.type),
        description: event.description || eventTitle(event.type),
        timestamp: toDateOrUndefined(event.timestamp),
        completed: true,
      }))
    : null;

  const fallbackEvents: TrackingEvent[] = [
    {
      type: 'created',
      title: '요청 생성',
      description: '배송 요청이 생성되었습니다',
      timestamp: createdAt,
      completed: true,
    },
    {
      type: 'matched',
      title: '매칭 완료',
      description: '길러가 매칭되었습니다',
      timestamp: updatedAt,
      completed: ['matched', 'accepted', 'in_transit', 'arrived', 'completed'].includes(status),
    },
    {
      type: 'accepted',
      title: '수락 완료',
      description: '길러가 배송을 수락했습니다',
      timestamp: updatedAt,
      completed: ['accepted', 'in_transit', 'arrived', 'completed'].includes(status),
    },
    {
      type: 'picked_up',
      title: '픽업 완료',
      description: '물품을 수령했습니다',
      timestamp: updatedAt,
      completed: ['in_transit', 'arrived', 'completed'].includes(status),
    },
    {
      type: 'in_transit',
      title: '배송 중',
      description: '지하철을 타고 이동 중입니다',
      timestamp: updatedAt,
      completed: ['in_transit', 'arrived', 'completed'].includes(status),
    },
    {
      type: 'arrived',
      title: '도착 완료',
      description: '목적지에 도착했습니다',
      timestamp: updatedAt,
      completed: ['arrived', 'completed'].includes(status),
    },
    {
      type: 'completed',
      title: '배송 완료',
      description: '배송이 완료되었습니다',
      timestamp: updatedAt,
      completed: status === 'completed',
    },
  ];

  return {
    status,
    pickupStation: {
      stationName: data.pickupStation?.stationName || '-',
      line: data.pickupStation?.line || '',
    },
    deliveryStation: {
      stationName: data.deliveryStation?.stationName || '-',
      line: data.deliveryStation?.line || '',
    },
    packageInfo: {
      size: data.packageInfo?.size || '-',
      weight: data.packageInfo?.weight ?? '-',
      description: data.packageInfo?.description,
    },
    recipientName: data.recipientInfo?.name || data.recipientName,
    recipientVerificationCode: data.recipientInfo?.verificationCode || data.recipientVerificationCode,
    createdAt,
    updatedAt,
    trackingEvents: eventsFromTracking || fallbackEvents,
    deliveryId: data.deliveryId,
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
