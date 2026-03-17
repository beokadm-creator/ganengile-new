export function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

export function formatDate(date: Date | { seconds: number } | string): string {
  if (!date) return '-';
  const raw: any = date;
  const d = date instanceof Date
    ? date
    : typeof date === 'string'
    ? new Date(date)
    : typeof raw?.toDate === 'function'
    ? raw.toDate()
    : typeof raw?.seconds === 'number'
    ? new Date(raw.seconds * 1000)
    : typeof raw?._seconds === 'number'
    ? new Date(raw._seconds * 1000)
    : new Date(0);

  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '대기중',
    completed: '완료',
    rejected: '반려',
    processing: '처리중',
    failed: '실패',
    paid: '납부',
    refunded: '환급',
    deducted: '차감',
    skipped: '대상 아님',
    resolved: '해결됨',
    approved: '승인',
    in_review: '심사중',
    under_review: '심사중',
    not_submitted: '미제출',
  };
  return map[status] ?? status;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    paid: 'bg-green-100 text-green-800',
    refunded: 'bg-gray-100 text-gray-800',
    deducted: 'bg-red-100 text-red-800',
    skipped: 'bg-gray-100 text-gray-800',
    resolved: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
    in_review: 'bg-blue-100 text-blue-800',
    under_review: 'bg-blue-100 text-blue-800',
    not_submitted: 'bg-gray-100 text-gray-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}
