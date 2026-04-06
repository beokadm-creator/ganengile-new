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

  const TABS = [
    { key: 'pending', label: '대기중' },
    { key: 'under_review', label: '심사중' },
    { key: 'approved', label: '승인' },
    { key: 'rejected', label: '반려' },
  ] as const;

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🪪 신원 인증 심사</h1>
        <p className="text-gray-500 text-sm mt-1">길러 신원 인증을 검토하고 승인/반려합니다.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">로딩중...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg">신청 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-left">이름</th>
                <th className="px-4 py-3 text-left">사용자 ID</th>
                <th className="px-4 py-3 text-left">신청일</th>
                <th className="px-4 py-3 text-left">상태</th>
                {(tab === 'pending' || tab === 'under_review') && <th className="px-4 py-3 text-left">액션</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.userName ?? '(이름 없음)'}</td>
                  <td className="px-4 py-3 text-gray-600">{item.userId}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(item.submittedAt || '')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  {(tab === 'pending' || tab === 'under_review') && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(item)}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-indigo-700"
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
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4">신원 인증 심사</h2>

              <div className="space-y-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">신청자</span>
                    <span className="font-medium">{selected.userName ?? '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">생년월일</span>
                    <span>{selected.birthDate ?? '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">신분증 유형</span>
                    <span>{selected.idCard?.type ?? '-'}</span>
                  </div>
                </div>

                {selected.idCard?.frontImageUrl && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">신분증 앞면</p>
                    <a
                      href={selected.idCard.frontImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-gray-100 border rounded px-4 py-2 text-sm text-blue-600 hover:underline"
                    >
                      📎 이미지 보기
                    </a>
                  </div>
                )}

                {selected.idCard?.backImageUrl && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">신분증 뒷면</p>
                    <a
                      href={selected.idCard.backImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-gray-100 border rounded px-4 py-2 text-sm text-blue-600 hover:underline"
                    >
                      📎 이미지 보기
                    </a>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">반려 사유</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    placeholder="반려 시 사유를 입력하세요."
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleAction('approve')}
                  disabled={processing}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  ✅ 승인
                </button>
                <button
                  onClick={() => handleAction('review')}
                  disabled={processing}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50"
                >
                  📋 심사중으로
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={processing}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  ❌ 반려
                </button>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="mt-2 w-full py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
