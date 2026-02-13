/**
 * Delivery Method Types
 * 배송 방식 관련 타입
 */

/**
 * 배송 방식
 */
export type DeliveryMethod = 'direct' | 'locker_pickup' | 'locker_dropoff' | 'locker_delivery';

/**
 * 배송 방식 옵션
 */
export interface DeliveryMethodOption {
  /** 방식 ID */
  id: DeliveryMethod;
  /** 아이콘 */
  icon: keyof typeof Icons;
  /** 라벨 */
  label: string;
  /** 설명 */
  description: string;
  /** 사물함 필요 여부 */
  requiresLocker: boolean;
  /** 이모지 */
  emoji: string;
}

// Icons (임시)
const Icons = {
  'people': 'people',
  'cube': 'cube',
  'swap': 'swap-horizontal',
  'log-out': 'log-out',
};

/**
 * 배송 방식 옵션 목록
 */
export const DELIVERY_METHODS: DeliveryMethodOption[] = [
  {
    id: 'direct',
    icon: 'people',
    label: '직접 만남',
    description: '길러와 직접 만나서 인수/인계',
    requiresLocker: false,
    emoji: '🤝',
  },
  {
    id: 'locker_pickup',
    icon: 'cube',
    label: '사물함 인수',
    description: '이용자가 사물함에 넣어두면 길러가 수거',
    requiresLocker: true,
    emoji: '📦',
  },
  {
    id: 'locker_dropoff',
    icon: 'swap',
    label: '사물함 인계',
    description: '길러가 사물함에 보관하면 이용자가 수령',
    requiresLocker: true,
    emoji: '🔐',
  },
  {
    id: 'locker_delivery',
    icon: 'log-out',
    label: '사물함 택배',
    description: '픽업/배송 모두 사물함으로',
    requiresLocker: true,
    emoji: '📬',
  },
];
