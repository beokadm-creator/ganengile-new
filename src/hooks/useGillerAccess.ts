/**
 * useGillerAccess
 * 길러 기능 접근 가능 여부를 판단하는 단일 진실 공급원(Single Source of Truth).
 *
 * isGiller 레거시 Firestore 필드 대신 role/gillerApplicationStatus/isVerified를
 * 기준으로 판단합니다. 여러 화면에 중복 정의되던 canAccessGiller 로직을 여기서만 관리합니다.
 */

import { useUser } from '../contexts/UserContext';
import { UserRole } from '../types/user';
import { PASS_TEST_MODE } from '../config/feature-flags';

export interface GillerAccessInfo {
  /** 탭·기능 진입 가능 여부 (승인 + 인증 완료 또는 테스트 모드) */
  canAccessGiller: boolean;
  /** 채팅에서 배송 수락/취소 버튼 표시 여부 */
  canGillerActionInChat: boolean;
  /** 현재 길러 역할로 활동 중인지 (탭 표시 기준) */
  isGillerRole: boolean;
  /** 길러 신청 상태 */
  applicationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  /** 본인인증 완료 여부 */
  isVerified: boolean;
}

export function useGillerAccess(): GillerAccessInfo {
  const { user } = useUser();

  const role = user?.role ?? null;
  const applicationStatus =
    (user?.gillerApplicationStatus as GillerAccessInfo['applicationStatus']) ?? 'none';
  const isVerified = user?.isVerified === true;

  const isGillerRole = role === UserRole.GILLER || role === UserRole.BOTH;

  // 탭·기능 접근: 승인 완료 + 본인인증 완료 (또는 개발 테스트 모드)
  const canAccessGiller =
    PASS_TEST_MODE ||
    isGillerRole ||
    (applicationStatus === 'approved' && isVerified);

  // 채팅 수락 버튼: 길러 역할이거나 승인된 사용자 (isVerified 미요구 — 이미 채팅방 진입 상태)
  const canGillerActionInChat =
    PASS_TEST_MODE ||
    isGillerRole ||
    applicationStatus === 'approved';

  return {
    canAccessGiller,
    canGillerActionInChat,
    isGillerRole,
    applicationStatus,
    isVerified,
  };
}
