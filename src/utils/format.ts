export function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

export function formatPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function splitReservationSchedule(value?: string) {
  const trimmed = (value ?? '').trim();
  const matched = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
  if (!matched) {
    return { date: '', time: trimmed };
  }

  return { date: matched[1], time: matched[2] };
}

export function combineReservationSchedule(date: string, time: string) {
  const trimmedDate = date.trim();
  const trimmedTime = time.trim();

  if (!trimmedDate && !trimmedTime) return '';
  if (!trimmedDate) return trimmedTime;
  if (!trimmedTime) return trimmedDate;
  return `${trimmedDate} ${trimmedTime}`;
}
