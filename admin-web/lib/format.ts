export function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

export function formatDate(date: Date | { seconds: number } | string): string {
  if (!date) return '-';
  const d = date instanceof Date
    ? date
    : typeof date === 'string'
    ? new Date(date)
    : new Date((date as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '대기중',
    completed: '완료',
    rejected: '반려',
    processing: '처리중',
    paid: '납부',
    refunded: '환급',
    deducted: '차감',
    resolved: '해결됨',
    approved: '승인',
    in_review: '심사중',
  };
  return map[status] ?? status;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    refunded: 'bg-gray-100 text-gray-800',
    deducted: 'bg-red-100 text-red-800',
    resolved: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
    in_review: 'bg-blue-100 text-blue-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}
