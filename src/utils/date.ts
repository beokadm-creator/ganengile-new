import { Timestamp } from 'firebase/firestore';

export function toJsDate(value?: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp || (typeof value === 'object' && typeof value.toDate === 'function')) {
    return value.toDate();
  }
  if (typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export function formatDateTimeKR(value?: any): string {
  const date = toJsDate(value);
  if (!date || Number.isNaN(date.getTime())) return '-';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    }).format(date);
  } catch {
    return date.toLocaleString('ko-KR');
  }
}

export function formatTimeKR(value?: any): string {
  const date = toJsDate(value);
  if (!date || Number.isNaN(date.getTime())) return '-';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    }).format(date);
  } catch {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
