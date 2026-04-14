'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { formatDate, formatKRW, statusColor, statusLabel } from '@/lib/format';

interface UserItem {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  pointBalance: number;
  gillerApplicationStatus: string | null;
  identityVerificationStatus: string;
  bankVerificationStatus: string;
  bankCode: string;
  accountNumberMasked: string;
  onboardingStage: string;
  createdAt: { seconds?: number; _seconds?: number; toDate?: () => Date } | string | null;
}

type UsersResponse = { items: UserItem[] };

const ROLE_LABEL: Record<string, string> = {
  user: '이용자',
  gller: '이용자',
  giller: '길러',
  both: '이용자 + 길러',
  admin: '관리자',
};

const ROLE_COLOR: Record<string, string> = {
  user: 'bg-sky-100 text-sky-700',
  gller: 'bg-sky-100 text-sky-700',
  giller: 'bg-violet-100 text-violet-700',
  both: 'bg-emerald-100 text-emerald-700',
  admin: 'bg-slate-900 text-white',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asUserItem(value: unknown): UserItem | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== 'string') return null;

  return {
    id: record.id,
    name: typeof record.name === 'string' ? record.name : '(이름 없음)',
    email: typeof record.email === 'string' ? record.email : '',
    phoneNumber: typeof record.phoneNumber === 'string' ? record.phoneNumber : '',
    role: typeof record.role === 'string' ? record.role : '',
    isActive: Boolean(record.isActive),
    isVerified: Boolean(record.isVerified),
    pointBalance: typeof record.pointBalance === 'number' ? record.pointBalance : 0,
    gillerApplicationStatus:
      typeof record.gillerApplicationStatus === 'string' ? record.gillerApplicationStatus : null,
    identityVerificationStatus:
      typeof record.identityVerificationStatus === 'string'
        ? record.identityVerificationStatus
        : 'not_submitted',
    bankVerificationStatus:
      typeof record.bankVerificationStatus === 'string'
        ? record.bankVerificationStatus
        : 'not_submitted',
    bankCode: typeof record.bankCode === 'string' ? record.bankCode : '',
    accountNumberMasked:
      typeof record.accountNumberMasked === 'string' ? record.accountNumberMasked : '',
    onboardingStage:
      typeof record.onboardingStage === 'string' ? record.onboardingStage : '미설정',
    createdAt:
      typeof record.createdAt === 'string' || asRecord(record.createdAt) ? (record.createdAt as UserItem['createdAt']) : null,
  };
}

async function fetchUsers(url: string): Promise<UsersResponse> {
  const response = await fetch(url);
  const json: unknown = await response.json();
  const record = asRecord(json);
  const items = Array.isArray(record?.items)
    ? record.items.map(asUserItem).filter((item): item is UserItem => item !== null)
    : [];
  return { items };
}

function onboardingDescription(item: UserItem) {
  if (item.gillerApplicationStatus === 'approved') {
    return '길러 권한이 활성화된 상태입니다. 정산과 출금 흐름도 함께 확인해 주세요.';
  }

  if (item.gillerApplicationStatus === 'pending') {
    return '본인 확인이 끝나 심사 대기 중입니다. 운영 검토가 필요한 구간입니다.';
  }

  if (
    item.identityVerificationStatus === 'approved' ||
    item.identityVerificationStatus === 'approved_test_bypass'
  ) {
    return '본인 확인은 준비됐습니다. 다음 단계는 길러 신청입니다.';
  }

  return '회원가입 이후 본인 확인부터 길러 승급 준비까지의 현재 위치입니다.';
}

export default function UsersPage() {
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (role) params.set('role', role);

      const { items: nextItems } = await fetchUsers(`/api/admin/users?${params.toString()}`);
      setItems(nextItems);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [role, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function toggleActive(userId: string, current: boolean) {
    setProcessing(userId);
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: !current }),
      });
      await loadData();
    } finally {
      setProcessing(null);
    }
  }

  async function deleteInactiveUser(userId: string) {
    const confirmed = window.confirm('비활성화된 회원만 정리 삭제할 수 있습니다. 계속할까요?');
    if (!confirmed) return;

    setProcessing(userId);
    try {
      await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      await loadData();
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">사용자 관리</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            단순 계정 목록이 아니라 본인 확인, 계좌 인증, 길러 승급, 지갑 잔액까지 한 사람 기준으로
            이어서 보는 운영 화면입니다.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <input
              type="text"
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter') void loadData();
              }}
              placeholder="이름, 이메일, 전화번호, UID 검색"
              className="w-72 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <select
              value={role}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setRole(event.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">전체 역할</option>
              <option value="gller">이용자</option>
              <option value="giller">길러</option>
              <option value="both">이용자 + 길러</option>
              <option value="admin">관리자</option>
            </select>
            <button
              onClick={() => void loadData()}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
            >
              조회
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            사용자 목록을 불러오는 중입니다.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            조건에 맞는 사용자가 없습니다.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">조회 결과</p>
                <p className="text-xs text-slate-500">{items.length.toLocaleString()}명</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">사용자</th>
                    <th className="px-4 py-3 text-left">역할</th>
                    <th className="px-4 py-3 text-left">온보딩 단계</th>
                    <th className="px-4 py-3 text-left">인증 상태</th>
                    <th className="px-4 py-3 text-right">지갑 잔액</th>
                    <th className="px-4 py-3 text-left">가입일</th>
                    <th className="px-4 py-3 text-left">계정 상태</th>
                    <th className="px-4 py-3 text-left">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.email || '이메일 없음'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.phoneNumber || '전화번호 없음'}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-slate-400">{item.id}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            ROLE_COLOR[item.role] ?? 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ROLE_LABEL[item.role] ?? item.role ?? '역할 없음'}
                        </span>
                        {item.gillerApplicationStatus ? (
                          <div className="mt-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(item.gillerApplicationStatus)}`}
                            >
                              {statusLabel(item.gillerApplicationStatus)}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium text-slate-900">{item.onboardingStage}</p>
                        <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                          {onboardingDescription(item)}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2">
                          <div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(item.identityVerificationStatus)}`}
                            >
                              본인 확인 {statusLabel(item.identityVerificationStatus)}
                            </span>
                          </div>
                          <div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(item.bankVerificationStatus)}`}
                            >
                              계좌 인증 {statusLabel(item.bankVerificationStatus)}
                            </span>
                          </div>
                          {item.bankCode || item.accountNumberMasked ? (
                            <p className="text-xs text-slate-500">
                              {item.bankCode || '은행 미설정'} {item.accountNumberMasked}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right align-top font-semibold text-cyan-700">
                        {formatKRW(item.pointBalance)}
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-500">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {item.isActive ? '활성' : '비활성'}
                        </span>
                        <div className="mt-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.isVerified
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.isVerified ? '기본 인증 완료' : '기본 인증 전'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => void toggleActive(item.id, item.isActive)}
                            disabled={processing === item.id}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                              item.isActive
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {item.isActive ? '비활성화' : '활성화'}
                          </button>
                          {!item.isActive ? (
                            <button
                              onClick={() => void deleteInactiveUser(item.id)}
                              disabled={processing === item.id}
                              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              정리 삭제
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
