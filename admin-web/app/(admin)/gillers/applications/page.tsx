'use client';

import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import { formatDate, statusColor, statusLabel } from '@/lib/format';

interface GillerApplication {
  id: string;
  userId: string;
  userName?: string;
  phone?: string;
  verificationStatus?: string;
  bankAccount?: {
    bankName?: string;
    accountNumber?: string;
    accountNumberMasked?: string;
    accountLast4?: string;
    accountHolder?: string;
    verificationStatus?: string;
  };
  status: string;
  createdAt: { seconds: number } | string;
  adminNote?: string;
  isSynthetic?: boolean;
  identityTestMode?: boolean;
  identityLiveReady?: boolean;
  bankTestMode?: boolean;
  bankLiveReady?: boolean;
  bankProvider?: string | null;
  bankVerificationMode?: string | null;
  bankVerificationStatus?: string | null;
  bankAccountMasked?: string | null;
  bankAccountLast4?: string | null;
}

type ApplicationsResponse = { items: GillerApplication[]; error?: string };

const TABS = [
  { key: 'pending', label: '대기 중' },
  { key: 'in_review', label: '심사 중' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '반려' },
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asBankAccount(value: unknown): GillerApplication['bankAccount'] {
  const record = asRecord(value);
  if (!record) return undefined;

  return {
    bankName: typeof record.bankName === 'string' ? record.bankName : undefined,
    accountNumber: typeof record.accountNumber === 'string' ? record.accountNumber : undefined,
    accountNumberMasked:
      typeof record.accountNumberMasked === 'string' ? record.accountNumberMasked : undefined,
    accountLast4: typeof record.accountLast4 === 'string' ? record.accountLast4 : undefined,
    accountHolder: typeof record.accountHolder === 'string' ? record.accountHolder : undefined,
    verificationStatus:
      typeof record.verificationStatus === 'string' ? record.verificationStatus : undefined,
  };
}

function asGillerApplication(value: unknown): GillerApplication | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== 'string' || typeof record.status !== 'string') return null;

  return {
    id: record.id,
    userId: typeof record.userId === 'string' ? record.userId : '',
    userName: typeof record.userName === 'string' ? record.userName : undefined,
    phone: typeof record.phone === 'string' ? record.phone : undefined,
    verificationStatus:
      typeof record.verificationStatus === 'string' ? record.verificationStatus : undefined,
    verificationProvider:
      typeof record.verificationProvider === 'string' ? record.verificationProvider : undefined,
    bankAccount: asBankAccount(record.bankAccount),
    status: record.status,
    createdAt:
      typeof record.createdAt === 'string' || asRecord(record.createdAt)
        ? (record.createdAt as GillerApplication['createdAt'])
        : '',
    adminNote: typeof record.adminNote === 'string' ? record.adminNote : undefined,
    isSynthetic: Boolean(record.isSynthetic),
    identityTestMode: Boolean(record.identityTestMode),
    identityLiveReady: Boolean(record.identityLiveReady),
    bankTestMode: Boolean(record.bankTestMode),
    bankLiveReady: Boolean(record.bankLiveReady),
    bankProvider: typeof record.bankProvider === 'string' ? record.bankProvider : null,
    bankVerificationMode:
      typeof record.bankVerificationMode === 'string' ? record.bankVerificationMode : null,
    bankVerificationStatus:
      typeof record.bankVerificationStatus === 'string' ? record.bankVerificationStatus : null,
    bankAccountMasked:
      typeof record.bankAccountMasked === 'string' ? record.bankAccountMasked : null,
    bankAccountLast4:
      typeof record.bankAccountLast4 === 'string' ? record.bankAccountLast4 : null,
  };
}

async function fetchApplications(status: string): Promise<ApplicationsResponse> {
  const res = await fetch(`/api/admin/gillers?status=${status}`);
  const json: unknown = await res.json();
  const record = asRecord(json);
  return {
    items: Array.isArray(record?.items)
      ? record.items.map(asGillerApplication).filter((item): item is GillerApplication => item !== null)
      : [],
    error: typeof record?.error === 'string' ? record.error : undefined,
  };
}

function readinessBadge(
  ready: boolean | undefined,
  yesLabel = '실서비스 준비',
  noLabel = '테스트 또는 수동 검토'
) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
        ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {ready ? yesLabel : noLabel}
    </span>
  );
}

export default function GillerApplicationsPage() {
  const [tab, setTab] = useState<'pending' | 'in_review' | 'approved' | 'rejected'>('pending');
  const [items, setItems] = useState<GillerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GillerApplication | null>(null);
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadData(status: string) {
    setLoading(true);
    try {
      const result = await fetchApplications(status);
      setErrorMessage(result.error ?? '');
      setItems(result.items);
    } catch {
      setErrorMessage('승급 요청 목록 조회 중 네트워크 오류가 발생했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(tab);
  }, [tab]);

  async function handleAction(action: 'approve' | 'reject' | 'review') {
    if (!selected) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/admin/gillers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: selected.id, action, note }),
      });
      const json: unknown = await res.json();
      const record = asRecord(json);
      if (!res.ok) {
        window.alert(
          typeof record?.error === 'string' ? record.error : '승급 심사 처리 중 오류가 발생했습니다.'
        );
        return;
      }

      setSelected(null);
      setNote('');
      await loadData(tab);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">길러 승급 요청</h1>
        <p className="mt-1 text-sm text-slate-500">
          본인 확인, 계좌 인증, 테스트 우회 여부까지 함께 보고 승인 또는 반려하는 심사 화면입니다.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          요청 목록을 불러오는 중입니다.
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <p className="text-lg">해당 상태의 승급 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">신청자</th>
                <th className="px-4 py-3 text-left">본인 확인</th>
                <th className="px-4 py-3 text-left">계좌 인증</th>
                <th className="px-4 py-3 text-left">심사 상태</th>
                <th className="px-4 py-3 text-left">신청일</th>
                {(tab === 'pending' || tab === 'in_review') ? (
                  <th className="px-4 py-3 text-left">작업</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const verificationApproved =
                  item.verificationStatus === 'approved' ||
                  item.verificationStatus === 'approved_test_bypass';

                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.userName ?? '(이름 없음)'}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.phone ?? '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`w-fit rounded-full px-2 py-1 text-xs font-medium ${statusColor(item.verificationStatus ?? 'not_submitted')}`}
                        >
                          {statusLabel(item.verificationStatus ?? 'not_submitted')}
                        </span>
                        {readinessBadge(
                          item.identityLiveReady,
                          'CI 연동 준비',
                          '테스트 우회 또는 수동 검토'
                        )}
                        {item.identityTestMode ? (
                          <span className="text-[11px] font-medium text-amber-700">테스트 우회 사용</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-700">
                          {item.bankVerificationStatus ?? item.bankVerificationMode ?? 'manual_review'}
                        </span>
                        {readinessBadge(
                          item.bankLiveReady,
                          '계좌 인증 준비',
                          '수동 검토 또는 테스트'
                        )}
                        <span className="text-[11px] text-slate-500">
                          {item.bankProvider ?? 'manual_review'}
                        </span>
                        {item.bankTestMode ? (
                          <span className="text-[11px] font-medium text-amber-700">
                            테스트 또는 수동 검토
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor(item.status)}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
                    {(tab === 'pending' || tab === 'in_review') ? (
                      <td className="px-4 py-3">
                        {item.isSynthetic ? (
                          <span className="text-xs text-slate-500">수동 심사 대상 아님</span>
                        ) : (
                          <button
                            onClick={() => setSelected(item)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${
                              verificationApproved ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-400'
                            }`}
                          >
                            심사하기
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="p-6">
              <h2 className="mb-4 text-lg font-bold text-slate-900">길러 승급 심사</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-xl bg-slate-50 p-4 text-sm">
                  <h3 className="mb-3 font-semibold text-slate-900">기본 정보</h3>
                  <ReviewRow label="신청자" value={selected.userName ?? '-'} />
                  <ReviewRow label="연락처" value={selected.phone ?? '-'} />
                  <ReviewRow label="신청일" value={formatDate(selected.createdAt)} />
                </section>

                <section className="rounded-xl bg-slate-50 p-4 text-sm">
                  <h3 className="mb-3 font-semibold text-slate-900">본인 확인 상태</h3>
                  <ReviewRow
                    label="상태"
                    value={statusLabel(selected.verificationStatus ?? 'not_submitted')}
                  />
                  <ReviewRow
                    label="테스트 우회"
                    value={selected.identityTestMode ? '사용함' : '실서비스 기준'}
                  />
                  <ReviewRow
                    label="실서비스 준비"
                    value={selected.identityLiveReady ? 'ready' : 'pending'}
                  />
                </section>

                <section className="rounded-xl bg-slate-50 p-4 text-sm">
                  <h3 className="mb-3 font-semibold text-slate-900">계좌 정보</h3>
                  <ReviewRow label="은행" value={selected.bankAccount?.bankName ?? '-'} />
                    <ReviewRow
                      label="계좌번호"
                      value={
                        selected.bankAccount?.accountNumberMasked ??
                        selected.bankAccountMasked ??
                        selected.bankAccount?.accountNumber ??
                        '-'
                      }
                    />
                  <ReviewRow label="예금주" value={selected.bankAccount?.accountHolder ?? '-'} />
                </section>

                <section className="rounded-xl bg-slate-50 p-4 text-sm">
                  <h3 className="mb-3 font-semibold text-slate-900">계좌 인증 컨텍스트</h3>
                  <ReviewRow
                    label="검증 상태"
                    value={selected.bankVerificationStatus ?? 'manual_review'}
                  />
                  <ReviewRow
                    label="검증 방식"
                    value={selected.bankVerificationMode ?? 'manual_review'}
                  />
                  <ReviewRow label="공급자" value={selected.bankProvider ?? 'manual_review'} />
                  <ReviewRow
                    label="실서비스 준비"
                    value={selected.bankLiveReady ? 'ready' : 'pending'}
                  />
                </section>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                본인 확인 또는 계좌 인증이 테스트 우회 상태일 수 있습니다. 지금 단계에서는 승급 심사가
                가능하지만, 운영자는 실제 서비스 전환 전 최종 확인 책임을 함께 집니다.
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">심사 메모</label>
                <textarea
                  value={note}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="승인 또는 반려 사유를 남겨 주세요."
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    void handleAction('approve');
                  }}
                  disabled={processing}
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  승인
                </button>
                <button
                  onClick={() => {
                    void handleAction('review');
                  }}
                  disabled={processing}
                  className="flex-1 rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  심사 중으로 이동
                </button>
                <button
                  onClick={() => {
                    void handleAction('reject');
                  }}
                  disabled={processing}
                  className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  반려
                </button>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="mt-2 w-full rounded-lg border border-slate-200 py-2 text-sm hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewRow(props: { label: string; value: string }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3">
      <span className="text-slate-500">{props.label}</span>
      <span className="text-right font-medium text-slate-800">{props.value}</span>
    </div>
  );
}
