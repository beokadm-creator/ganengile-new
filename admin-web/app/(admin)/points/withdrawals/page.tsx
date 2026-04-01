'use client';

import { useEffect, useState } from 'react';
import { formatDate, formatKRW, statusColor, statusLabel } from '@/lib/format';

interface WithdrawRequest {
  id: string;
  userId: string;
  amount: number;
  bankName: string;
  accountNumber?: string;
  accountNumberMasked?: string;
  accountLast4?: string;
  accountHolder: string;
  status: string;
  createdAt: { seconds: number } | string;
  adminNote?: string;
  bankTestMode?: boolean;
  bankLiveReady?: boolean;
  bankProvider?: string | null;
  bankVerificationMode?: string | null;
  requiresAccountHolderMatch?: boolean;
  manualReviewFallback?: boolean;
  bankConfigLiveReady?: boolean;
  bankConfigTestMode?: boolean;
  bankConfigStatusMessage?: string;
  identityVerificationStatus?: string;
  bankVerificationStatus?: string;
  gillerApplicationStatus?: string;
  reviewChecklist?: {
    identityReady: boolean;
    bankReady: boolean;
    gillerApproved: boolean;
    liveTransferReady: boolean;
    manualReviewRequired: boolean;
  };
}

interface WithdrawIntegrationSummary {
  liveReady: boolean;
  testMode: boolean;
  statusMessage: string;
}

export default function WithdrawalsPage() {
  const [tab, setTab] = useState<'pending' | 'completed' | 'rejected'>('pending');
  const [items, setItems] = useState<WithdrawRequest[]>([]);
  const [integration, setIntegration] = useState<WithdrawIntegrationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WithdrawRequest | null>(null);
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);

  async function loadData(status: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/withdrawals?status=${status}`);
      const json = (await response.json()) as {
        items?: WithdrawRequest[];
        integration?: WithdrawIntegrationSummary;
      };
      setItems(json.items ?? []);
      setIntegration(json.integration ?? null);
    } catch {
      setItems([]);
      setIntegration(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(tab);
  }, [tab]);

  async function handleAction(action: 'approve' | 'reject') {
    if (!selected) return;
    setProcessing(true);
    try {
      await fetch('/api/admin/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selected.id,
          action,
          note,
          reviewChecklist: selected.reviewChecklist ?? null,
        }),
      });
      setSelected(null);
      setNote('');
      await loadData(tab);
    } finally {
      setProcessing(false);
    }
  }

  const totalPending = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">출금 운영</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            출금은 길러 승인 상태, 본인 확인, 계좌 인증, 테스트 모드 여부를 함께 보고 운영자가 최종 승인합니다.
            자동 이체가 아닌 경우에도 같은 체크리스트와 메모 기준을 남깁니다.
          </p>
        </section>

        {integration ? (
          <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  integration.liveReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {integration.liveReady ? '계좌 인증 live ready' : 'test/manual review'}
              </span>
              <span className="text-amber-900">{integration.statusMessage}</span>
            </div>
          </section>
        ) : null}

        <section className="flex gap-2">
          {(['pending', 'completed', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setTab(status)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === status
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {status === 'pending' ? '처리 대기' : status === 'completed' ? '처리 완료' : '반려'}
            </button>
          ))}
        </section>

        {tab === 'pending' && items.length > 0 ? (
          <section className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            총 대기 출금 {formatKRW(totalPending)} / {items.length}건
          </section>
        ) : null}

        {loading ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            출금 요청을 불러오는 중입니다.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            해당 상태의 출금 요청이 없습니다.
          </div>
        ) : (
          <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">사용자</th>
                  <th className="px-4 py-3 text-left">출금 금액</th>
                  <th className="px-4 py-3 text-left">계좌</th>
                  <th className="px-4 py-3 text-left">운영 체크</th>
                  <th className="px-4 py-3 text-left">인증 컨텍스트</th>
                  <th className="px-4 py-3 text-left">요청일</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  {tab === 'pending' ? <th className="px-4 py-3 text-left">액션</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 align-top font-mono text-xs text-slate-500">
                      {item.userId.slice(0, 10)}...
                    </td>
                    <td className="px-4 py-4 align-top font-semibold text-slate-900">
                      {formatKRW(item.amount)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div>{item.bankName}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {item.accountNumberMasked ?? item.accountNumber ?? '-'}
                      </div>
                      <div className="text-xs text-slate-500">{item.accountHolder}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <ChecklistBadge ok={Boolean(item.reviewChecklist?.identityReady)} label="본인 확인" />
                        <ChecklistBadge ok={Boolean(item.reviewChecklist?.bankReady)} label="계좌 인증" />
                        <ChecklistBadge ok={Boolean(item.reviewChecklist?.gillerApproved)} label="길러 승인" />
                        <ChecklistBadge ok={Boolean(item.reviewChecklist?.liveTransferReady)} label="실이체 준비" />
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1 text-xs">
                        <p className="font-medium text-slate-700">{item.bankVerificationMode ?? 'manual_review'}</p>
                        <p className="text-slate-500">provider: {item.bankProvider ?? 'manual_review'}</p>
                        <p className="text-slate-500">본인 확인: {statusLabel(item.identityVerificationStatus ?? 'not_submitted')}</p>
                        <p className="text-slate-500">계좌: {statusLabel(item.bankVerificationStatus ?? 'not_submitted')}</p>
                        {item.bankTestMode ? <p className="font-medium text-amber-700">테스트 우회 사용 가능</p> : null}
                        {item.reviewChecklist?.manualReviewRequired ? (
                          <p className="font-medium text-rose-700">운영 수동 검토 필요</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-500">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-4 align-top">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    {tab === 'pending' ? (
                      <td className="px-4 py-4 align-top">
                        <button
                          onClick={() => setSelected(item)}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          처리하기
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {selected ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
              <h2 className="mb-4 text-lg font-bold text-slate-900">출금 처리</h2>

              <div className="mb-4 rounded-lg bg-slate-50 p-4 text-sm">
                <div className="mb-2 flex justify-between">
                  <span className="text-slate-500">요청자 UID</span>
                  <span className="font-mono text-xs">{selected.userId}</span>
                </div>
                <div className="mb-2 flex justify-between">
                  <span className="text-slate-500">출금 금액</span>
                  <span className="text-lg font-bold text-slate-900">{formatKRW(selected.amount)}</span>
                </div>
                <div className="mb-2 flex justify-between">
                  <span className="text-slate-500">은행</span>
                  <span>{selected.bankName}</span>
                </div>
                <div className="mb-2 flex justify-between">
                  <span className="text-slate-500">계좌번호</span>
                  <span className="font-mono">
                    {selected.accountNumberMasked ?? selected.accountNumber ?? '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">예금주</span>
                  <span>{selected.accountHolder}</span>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                <p className="mb-3 text-sm font-semibold text-slate-900">운영 체크리스트</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <ChecklistRow ok={Boolean(selected.reviewChecklist?.identityReady)} label="본인 확인이 완료됐는지" />
                  <ChecklistRow ok={Boolean(selected.reviewChecklist?.bankReady)} label="계좌 인증 또는 운영 확인이 끝났는지" />
                  <ChecklistRow ok={Boolean(selected.reviewChecklist?.gillerApproved)} label="길러 승인 계정인지" />
                  <ChecklistRow ok={Boolean(selected.reviewChecklist?.liveTransferReady)} label="실이체 또는 운영 이체 체계가 준비됐는지" />
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                계좌 인증 방식: {selected.bankVerificationMode ?? 'manual_review'} / provider:{' '}
                {selected.bankProvider ?? 'manual_review'} / 준비 상태:{' '}
                {selected.bankLiveReady ? 'ready' : 'pending'}
                <br />
                {selected.requiresAccountHolderMatch ? '예금주 일치 검증 필요' : '예금주 일치 검증 선택'} /{' '}
                {selected.manualReviewFallback ? '운영 수동 검토 우선' : '자동 처리 우선'}
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">처리 메모</label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="이체 결과 또는 반려 사유를 적어 주세요."
                />
              </div>

              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                출금은 AI 자동 확정 대상이 아닙니다. 운영자가 계좌 상태와 정산 맥락을 다시 확인한 뒤 승인 또는
                반려해야 합니다.
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    void handleAction('approve');
                  }}
                  disabled={processing}
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  이체 완료
                </button>
                <button
                  onClick={() => {
                    void handleAction('reject');
                  }}
                  disabled={processing}
                  className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  반려 후 환급
                </button>
                <button
                  onClick={() => setSelected(null)}
                  disabled={processing}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChecklistBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
        ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }`}
    >
      {label} {ok ? '확인' : '미확인'}
    </span>
  );
}

function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-sm ${
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {ok ? '확인됨' : '추가 확인 필요'} / {label}
    </div>
  );
}
