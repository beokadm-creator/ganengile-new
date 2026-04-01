/**
 * useGillerAccess
 * 길러 기능 접근 여부를 판별하는 단일 진입점.
 */

import { useUser } from '../contexts/UserContext';
import { UserRole } from '../types/user';
import { PASS_TEST_MODE } from '../config/feature-flags';

export interface GillerAccessInfo {
  canAccessGiller: boolean;
  canGillerActionInChat: boolean;
  isGillerRole: boolean;
  applicationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  isVerified: boolean;
}

export function useGillerAccess(): GillerAccessInfo {
  const { user } = useUser();

  const role = user?.role ?? null;
  const rawStatus = user?.gillerApplicationStatus;
  const applicationStatus: GillerAccessInfo['applicationStatus'] =
    rawStatus === 'pending' ||
    rawStatus === 'approved' ||
    rawStatus === 'rejected'
      ? rawStatus
      : 'none';
  const isVerified = user?.isVerified === true;
  const isGillerRole = role === UserRole.GILLER || role === UserRole.BOTH;

  const canAccessGiller =
    PASS_TEST_MODE || isGillerRole || (applicationStatus === 'approved' && isVerified);

  const canGillerActionInChat =
    PASS_TEST_MODE || isGillerRole || (applicationStatus === 'approved' && isVerified);

  return {
    canAccessGiller,
    canGillerActionInChat,
    isGillerRole,
    applicationStatus,
    isVerified,
  };
}
