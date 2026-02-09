import { Timestamp } from 'firebase/firestore';

export function toJsDate(value: Date | Timestamp | undefined | null): Date | null {
  if (!value) return null;
  return value instanceof Timestamp ? value.toDate() : value;
}

export function formatDateTimeKR(value: Date | Timestamp | undefined | null): string {
  const date = toJsDate(value);
  if (!date) return '-';
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

export function formatTimeKR(value: Date | Timestamp | undefined | null): string {
  const date = toJsDate(value);
  if (!date) return '-';
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
