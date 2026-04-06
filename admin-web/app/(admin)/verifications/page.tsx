'use client';

import { useEffect, useState } from 'react';
import { formatDate, statusLabel, statusColor } from '@/lib/format';

interface VerificationItem {
  id: string;
  userId: string;
  userName?: string;
  status: string;
  submittedAt?: { seconds: number } | string;
  reviewedAt?: { seconds: number } | string;
  rejectionReason?: string;
  idCard?: {
    type?: string;
    frontImageUrl?: string;
    backImageUrl?: string;
  };
  name?: string;
  birthDate?: string;
  personalId?: string;
}

const TABS = [
  { key: 'pending', label: '대기중' },
  { key: 'under_review', label: '심사중' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '반려' },
] as const;

export default function VerificationsPage() {
  const [tab, setTab] = useState<'pending' | 'under_review' | 'approved' | 'rejected'>('pending');
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VerificationItem | null>(null);
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);

  async function loadData(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verifications?status=${status}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(tab); }, [tab]);

  async function handleAction(action: 'approve' | 'reject' | 'review') {
    if (!selected) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/verifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.userId, action, reason: note }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || '처리 중 오류가 발생했습니다.');
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
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* 다크 헤더 */}
        <section className="rounded-[28px] bg-[#0f172a] px-7 py-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">verification</p>
          <h1 className="mt-3 text-3xl font-bold">신원 인증 심사</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">길러 신원 인증을 검토하고 승인 또는 반려합니다.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* 콘텐츠 */}
        {loading ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            심사 목록을 불러오는 중입니다.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            해당 상태의 신청 내역이 없습니다.
          </div>
        ) : (
          <section className="overflow-hidden rounded-[24px] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">심사 목록</p>
                <p className="text-xs text-slate-500">{items.length}건</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">이름</th>
                    <th className="px-4 py-3 text-left">사용자 ID</th>
                    <th className="px-4 py-3 text-left">신청일</th>
                    <th className="px-4 py-3 text-left">상태</th>
                    {(tab === 'pending' || tab === 'under_review') && <th className="px-4 py-3 text-left">작업</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.userName ?? '(이름 없음)'}</td>
                      <td className="px-4 py-3 text-slate-600">{item.userId}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(item.submittedAt || '')}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      {(tab === 'pending' || tab === 'under_review') && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelected(item)}
                            className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            심사하기
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* 심사 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">verification review</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">신원 인증 심사</h2>

            <div className="mt-5 rounded-2xl border border-slate-100 bg-stone-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">신청자</span>
                <span className="font-medium text-slate-900">{selected.userName ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">생년월일</span>
                <span className="text-slate-900">{selected.birthDate ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">신분증 유형</span>
                <span className="text-slate-900">{selected.idCard?.type ?? '-'}</span>
              </div>
            </div>

            {selected.idCard?.frontImageUrl && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">신분증 앞면</p>
                <a
                  href={selected.idCard.frontImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-slate-50"
                >
                  이미지 보기
                </a>
              </div>
            )}

            {selected.idCard?.backImageUrl && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">신분증 뒷면</p>
                <a
                  href={selected.idCard.backImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-slate-50"
                >
                  이미지 보기
                </a>
              </div>
            )}

            <div className="mt-5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">반려 사유</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                rows={2}
                placeholder="반려 시 사유를 입력하세요."
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => handleAction('approve')}
                disabled={processing}
                className="flex-1 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                승인
              </button>
              <button
                onClick={() => handleAction('review')}
                disabled={processing}
                className="flex-1 rounded-full bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                심사중으로
              </button>
              <button
                onClick={() => handleAction('reject')}
                disabled={processing}
                className="flex-1 rounded-full bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                반려
              </button>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="mt-2 w-full rounded-full border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
