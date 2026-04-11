import { RequestStatus, type Request } from '../types/request';

export function getRequesterStatusLabel(status?: RequestStatus): string {
  switch (status) {
    case RequestStatus.PENDING:
      return '매칭 대기';
    case RequestStatus.MATCHED:
      return '길러 매칭 완료';
    case RequestStatus.ACCEPTED:
      return '배송 수락 완료';
    case RequestStatus.IN_TRANSIT:
      return '배송 이동 중';
    case RequestStatus.ARRIVED:
      return '도착 확인';
    case RequestStatus.AT_LOCKER:
      return '사물함 보관';
    case RequestStatus.DELIVERED:
      return '수령 확인 대기';
    case RequestStatus.COMPLETED:
      return '배송 완료';
    case RequestStatus.CANCELLED:
      return '요청 취소';
    default:
      return '상태 확인 필요';
  }
}

export function getRequesterStatusBody(request: Request | null): string {
  if (!request) {
    return '요청을 저장했고, 연결 상태를 불러오는 중입니다.';
  }

  if (request.status === RequestStatus.PENDING && request.beta1RequestStatus === 'match_pending') {
    if (request.missionProgress?.partiallyMatched) {
      return '일부 구간은 연결되었고, 남은 구간을 이어서 찾고 있습니다.';
    }
    return '주변 길러와 배송 파트너를 찾고 있습니다.';
  }

  if (request.status === RequestStatus.MATCHED) {
    return '응답 가능한 수행자를 찾았고 수락을 기다리는 중입니다.';
  }

  if (request.status === RequestStatus.ACCEPTED) {
    return '배송 준비가 시작되었습니다.';
  }

  if (request.status === RequestStatus.IN_TRANSIT) {
    return '실제 배송이 진행 중입니다.';
  }

  if (request.status === RequestStatus.ARRIVED || request.status === RequestStatus.AT_LOCKER) {
    return '도착 후 인계 절차가 진행 중입니다.';
  }

  if (request.status === RequestStatus.DELIVERED) {
    return '전달이 끝났고 수령 확인만 남았습니다.';
  }

  if (request.status === RequestStatus.COMPLETED) {
    return '요청이 정상적으로 완료되었습니다.';
  }

  if (request.status === RequestStatus.CANCELLED) {
    return '취소 처리된 요청입니다.';
  }

  return '요청 상세에서 최신 상태를 확인할 수 있습니다.';
}

export function getRequesterProgressDescription(request: Request): string {
  if (request.beta1RequestStatus === 'match_pending' && request.status === RequestStatus.PENDING) {
    if (request.missionProgress?.partiallyMatched) {
      return '일부 구간은 이미 연결되었고, 남은 구간을 이어서 찾고 있습니다.';
    }
    return '후보를 찾는 중입니다.';
  }

  if (request.status === RequestStatus.MATCHED) {
    return '길러 응답을 기다리는 중입니다.';
  }

  if (request.beta1RequestStatus === 'accepted') {
    return '배송이 시작됐습니다.';
  }

  if (request.status === RequestStatus.ACCEPTED) {
    return '픽업 준비가 진행 중입니다.';
  }

  if (request.status === RequestStatus.IN_TRANSIT) {
    return '배송이 이동 중입니다.';
  }

  if (request.status === RequestStatus.ARRIVED || request.status === RequestStatus.AT_LOCKER) {
    return '수령 또는 인계만 남아 있습니다.';
  }

  if (request.status === RequestStatus.DELIVERED) {
    return '수령 확인을 하면 요청이 완료됩니다.';
  }

  if (request.status === RequestStatus.COMPLETED) {
    return '배송이 정상적으로 완료되었습니다.';
  }

  if (request.status === RequestStatus.CANCELLED) {
    return '취소된 요청입니다.';
  }

  return '현재 상태입니다.';
}
