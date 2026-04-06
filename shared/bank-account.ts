export interface ProtectedBankAccountShape {
  bankName: string;
  accountHolder: string;
  accountNumberMasked: string;
  accountLast4: string;
  accountNumber?: string;
  bankCode?: string;
  verificationStatus?: string;
}

export function normalizeAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/[^0-9]/g, '');
}

export function maskAccountNumber(accountNumber: string): string {
  const normalized = normalizeAccountNumber(accountNumber);
  if (!normalized) {
    return '';
  }

  if (normalized.length <= 4) {
    return normalized;
  }

  return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

export function getAccountLast4(accountNumber: string): string {
  const normalized = normalizeAccountNumber(accountNumber);
  return normalized.slice(-4);
}

export function createProtectedBankAccount(input: {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  bankCode?: string;
  verificationStatus?: string;
}): ProtectedBankAccountShape {
  const normalized = normalizeAccountNumber(input.accountNumber);

  return {
    bankName: input.bankName.trim(),
    accountHolder: input.accountHolder.trim(),
    accountNumberMasked: maskAccountNumber(normalized),
    accountLast4: getAccountLast4(normalized),
    bankCode: input.bankCode?.trim() ?? undefined,
    verificationStatus: input.verificationStatus,
  };
}

export function readMaskedAccountNumber(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const record = value as Record<string, unknown>;
  if (typeof record.accountNumberMasked === 'string') {
    return record.accountNumberMasked;
  }

  if (typeof record.accountNumber === 'string') {
    return maskAccountNumber(record.accountNumber);
  }

  return '';
}

export function readAccountLast4(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const record = value as Record<string, unknown>;
  if (typeof record.accountLast4 === 'string') {
    return record.accountLast4;
  }

  if (typeof record.accountNumber === 'string') {
    return getAccountLast4(record.accountNumber);
  }

  return '';
}
