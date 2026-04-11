import type { MissionCard, MissionGroup } from '../components/giller/mission-board-types';
import type { Request } from '../types/request';
import { GillerType } from '../types/user';

export type GillerMissionExecutionMode = 'in_app' | 'external_bridge';
export type MissionExecutionGuide = {
  pickupGuide?: string;
  lockerGuide?: string;
  specialInstructions?: string;
  recipientSummary?: string;
  completionHint: string;
};

export function resolveGillerMissionExecutionMode(
  gillerType: GillerType | undefined,
  group: MissionGroup
): GillerMissionExecutionMode {
  const prefersPartnerExecution =
    group.requiresExternalPartner ||
    group.options.some((option) => option.recommendedActorType === 'external_partner');

  if (
    prefersPartnerExecution &&
    (gillerType === GillerType.PROFESSIONAL || gillerType === GillerType.MASTER)
  ) {
    return 'external_bridge';
  }

  return 'in_app';
}

export function buildProfessionalMissionBridgeReason(group: MissionGroup): string {
  if (group.requiresExternalPartner) {
    return '이 미션은 외부 파트너 연계 가능성이 있어 연동 상태를 먼저 확인합니다.';
  }

  return '전문 길러 전용 처리 흐름으로 연결될 수 있어 연동 준비 상태를 먼저 확인합니다.';
}

function normalizeGuide(value?: string | null) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function buildMissionExecutionGuideFromCard(card?: MissionCard | null): MissionExecutionGuide {
  return {
    pickupGuide: normalizeGuide(card?.pickupLocationDetail),
    lockerGuide: normalizeGuide(card?.storageLocation),
    specialInstructions: normalizeGuide(card?.specialInstructions),
    recipientSummary: normalizeGuide(card?.recipientSummary),
    completionHint: '사진 한 장과 인증 코드로 완료를 남기면 됩니다.',
  };
}

export function buildMissionExecutionGuideFromRequest(
  request?: Pick<Request, 'pickupLocationDetail' | 'storageLocation' | 'specialInstructions' | 'recipientName' | 'recipientPhone'> | null
): MissionExecutionGuide {
  const recipientName = normalizeGuide(request?.recipientName);
  const recipientPhone = normalizeGuide(request?.recipientPhone);
  const recipientSummary =
    recipientName && recipientPhone ? `${recipientName} · ${recipientPhone}` : recipientName ?? recipientPhone;

  return {
    pickupGuide: normalizeGuide(request?.pickupLocationDetail),
    lockerGuide: normalizeGuide(request?.storageLocation),
    specialInstructions: normalizeGuide(request?.specialInstructions),
    recipientSummary,
    completionHint: '사진 한 장과 인증 코드로 완료를 남기면 됩니다.',
  };
}
