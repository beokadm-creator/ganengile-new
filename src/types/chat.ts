/**
 * Chat Types
 * 채팅 및 알림 관련 타입 정의
 * 당근마켓 스타일 채팅 시스템
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 메시지 타입
 */
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  SYSTEM = 'system',  // 시스템 메시지 (매칭, 배송 상태 변경 등)
}

/**
 * 메시지 읽음 상태
 */
export enum MessageReadStatus {
  SENT = 'sent',         // 전송됨
  DELIVERED = 'delivered', // 배송됨
  READ = 'read',         // 읽음
}

/**
 * 채팅방 상태 (당근마켓 스타일)
 */
export enum ChatRoomStatus {
  PENDING = 'pending',   // 매칭 전 (협의중)
  ACTIVE = 'active',     // 매칭 완료, 채팅 진행중
  MATCHED = 'matched',   // 매칭 완료
  CLOSED = 'closed',     // 종료됨
}

/**
 * 배송 요청 정보 (당근마켓 상품 정보 스타일)
 */
export interface RequestInfo {
  from: string;
  to: string;
  urgency: string;
}

/**
 * 채팅 메시지
 */
export interface ChatMessage {
  messageId: string;

  // 채팅방 ID
  chatRoomId: string;

  // 발신자 ID
  senderId: string;

  // 메시지 타입
  type: MessageType;

  // 텍스트 내용
  content: string;

  // 이미지 URL (이미지 메시지인 경우)
  imageUrl?: string;

  // 읽음 상태
  readStatus: MessageReadStatus;

  // 생성 시간
  createdAt: Timestamp;

  // 시스템 메시지인 경우 추가 데이터 (매칭 ID, 요청 ID 등)
  metadata?: {
    requestId?: string;
    matchId?: string;
    type?: 'match_created' | 'match_accepted' | 'pickup_verified' | 'delivery_completed';
  };
}

/**
 * 채팅방 참여자 정보
 */
export interface ChatParticipant {
  userId: string;
  name: string;
  profileImage?: string;
  lastReadAt?: Timestamp;  // 마지막으로 메시지를 읽은 시간
}

/**
 * 채팅방
 */
export interface ChatRoom {
  chatRoomId: string;

  participants: {
    user1: ChatParticipant;
    user2: ChatParticipant;
  };

  requestId?: string;
  matchId?: string;

  requestInfo?: RequestInfo;

  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  };

  unreadCounts: {
    user1: number;
    user2: number;
  };

  status?: ChatRoomStatus;

  isActive: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 채팅방 생성 데이터
 */
export interface CreateChatRoomData {
  user1: {
    userId: string;
    name: string;
    profileImage?: string;
  };
  user2: {
    userId: string;
    name: string;
    profileImage?: string;
  };
  requestId?: string;
  matchId?: string;
  requestInfo?: RequestInfo;
}

/**
 * 메시지 생성 데이터
 */
export interface CreateMessageData {
  chatRoomId: string;
  senderId: string;
  type: MessageType;
  content: string;
  imageUrl?: string;
  metadata?: ChatMessage['metadata'];
}

/**
 * 푸시 알림 타입
 */
export enum NotificationType {
  MATCH_FOUND = 'match_found',           // 매칭 찾음
  MATCH_ACCEPTED = 'match_accepted',     // 매칭 수락됨
  MATCH_CANCELLED = 'match_cancelled',   // 매칭 취소됨
  PICKUP_REQUESTED = 'pickup_requested', // 픽업 요청
  PICKUP_VERIFIED = 'pickup_verified',   // 픽업 인증됨
  DELIVERY_COMPLETED = 'delivery_completed', // 배송 완료
  NEW_MESSAGE = 'new_message',           // 새 메시지
  RATING_RECEIVED = 'rating_received',   // 평가 받음
}

/**
 * 푸시 알림 설정
 */
export interface NotificationSettings {
  userId: string;

  // 알림 전체 허용 여부
  enabled: boolean;

  // 개별 알림 타입별 설정
  settings: {
    [NotificationType.MATCH_FOUND]: boolean;
    [NotificationType.MATCH_ACCEPTED]: boolean;
    [NotificationType.MATCH_CANCELLED]: boolean;
    [NotificationType.PICKUP_REQUESTED]: boolean;
    [NotificationType.PICKUP_VERIFIED]: boolean;
    [NotificationType.DELIVERY_COMPLETED]: boolean;
    [NotificationType.NEW_MESSAGE]: boolean;
    [NotificationType.RATING_RECEIVED]: boolean;
  };

  // 푸시 토큰
  fcmToken?: string;

  // 알림 받을 시간대 (선택)
  quietHours?: {
    enabled: boolean;
    startTime: string;  // HH:mm format
    endTime: string;    // HH:mm format
  };

  // 생성/업데이트 시간
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 푸시 알림 데이터
 */
export interface PushNotificationData {
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    requestId?: string;
    matchId?: string;
    chatRoomId?: string;
    senderId?: string;
    senderName?: string;
  };
}

/**
 * 푸시 알림 생성 데이터 (서버용)
 */
export interface CreatePushNotificationData {
  userId: string;
  notification: PushNotificationData;
}
