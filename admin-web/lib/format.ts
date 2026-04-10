export function formatKRW(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function formatDate(
  date:
    | Date
    | { seconds?: number; _seconds?: number; toDate?: () => Date }
    | string
    | null
    | undefined
): string {
  if (!date) return '-';

  const raw = date as { seconds?: number; _seconds?: number; toDate?: () => Date };
  const resolved =
    date instanceof Date
      ? date
      : typeof date === 'string'
        ? new Date(date)
        : typeof raw.toDate === 'function'
          ? raw.toDate()
          : typeof raw.seconds === 'number'
            ? new Date(raw.seconds * 1000)
            : typeof raw._seconds === 'number'
              ? new Date(raw._seconds * 1000)
              : new Date(Number.NaN);

  if (Number.isNaN(resolved.getTime())) {
    return '-';
  }

  return resolved.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '대기 중',
    active: '활성',
    suspended: '일시 중지',
    cancelled: '취소',
    matched: '매칭 완료',
    picked_up: '픽업 완료',
    in_transit: '이동 중',
    delivered: '배송 완료',
    completed: '완료',
    rejected: '반려',
    processing: '처리 중',
    failed: '실패',
    paid: '지급 완료',
    refunded: '환불',
    deducted: '차감',
    skipped: '대상 아님',
    resolved: '해결됨',
    approved: '승인',
    approved_test_bypass: '테스트 우회 승인',
    in_review: '검토 중',
    under_review: '검토 중',
    not_submitted: '미제출',
    submitted: '제출됨',
    manual_review: '수동 검토',
    verified: '인증 완료',
    pending_review: '심사 대기',
    none: '없음',
  };

  return map[status] ?? status;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    active: 'bg-emerald-100 text-emerald-800',
    suspended: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-slate-100 text-slate-800',
    matched: 'bg-sky-100 text-sky-800',
    picked_up: 'bg-cyan-100 text-cyan-800',
    in_transit: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-emerald-100 text-emerald-800',
    completed: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-rose-100 text-rose-800',
    processing: 'bg-sky-100 text-sky-800',
    failed: 'bg-rose-100 text-rose-800',
    paid: 'bg-emerald-100 text-emerald-800',
    refunded: 'bg-slate-100 text-slate-800',
    deducted: 'bg-rose-100 text-rose-800',
    skipped: 'bg-slate-100 text-slate-800',
    resolved: 'bg-emerald-100 text-emerald-800',
    approved: 'bg-emerald-100 text-emerald-800',
    approved_test_bypass: 'bg-violet-100 text-violet-800',
    in_review: 'bg-sky-100 text-sky-800',
    under_review: 'bg-sky-100 text-sky-800',
    not_submitted: 'bg-slate-100 text-slate-700',
    submitted: 'bg-amber-100 text-amber-800',
    manual_review: 'bg-rose-100 text-rose-800',
    verified: 'bg-emerald-100 text-emerald-800',
    pending_review: 'bg-amber-100 text-amber-800',
    none: 'bg-slate-100 text-slate-700',
  };

  return map[status] ?? 'bg-slate-100 text-slate-800';
}
