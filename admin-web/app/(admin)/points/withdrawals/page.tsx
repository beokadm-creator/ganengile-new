'use client';

import { useEffect, useState } from 'react';
import { formatKRW, formatDate, statusLabel, statusColor } from '@/lib/format';

interface WithdrawRequest {
  id: string;
  userId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: string;
  createdAt: { seconds: number } | string;
  adminNote?: string;
}

export default function WithdrawalsPage() {
  const [tab, setTab] = useState<'pending' | 'completed' | 'rejected'>('pending');
  const [items, setItems] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WithdrawRequest | null>(null);
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);

  async function loadData(status: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/withdrawals?status=${status}`);
    const json = await res.json();
    setItems(json.items ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(tab); }, [tab]);

  async function handleAction(action: 'approve' | 'reject') {
    if (!selected) return;
    setProcessing(true);
    await fetch('/api/admin/withdrawals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: selected.id, action, note }),
    });
    setSelected(null);
    setNote('');
    await loadData(tab);
    setProcessing(false);
  }

  const totalPending = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">💸 포인트 출금 처리</h1>
        <p className="text-gray-500 text-sm mt-1">사용자의 출금 신청을 검토하고 이체 처리합니다.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['pending', 'completed', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s === 'pending' ? '대기중' : s === 'completed' ? '처리완료' : '반려'}
          </button>
        ))}
      </div>

      {tab === 'pending' && items.length > 0 && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm">
          <span className="font-semibold text-yellow-800">
            총 대기 출금액: {formatKRW(totalPending)}
          </span>
          <span className="text-yellow-700 ml-2">({items.length}건)</span>
        </div>
      )}

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
                <th className="px-4 py-3 text-left">신청자 (UID)</th>
                <th className="px-4 py-3 text-left">금액</th>
                <th className="px-4 py-3 text-left">은행</th>
                <th className="px-4 py-3 text-left">계좌번호</th>
                <th className="px-4 py-3 text-left">예금주</th>
                <th className="px-4 py-3 text-left">신청일</th>
                <th className="px-4 py-3 text-left">상태</th>
                {tab === 'pending' && <th className="px-4 py-3 text-left">액션</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.userId.slice(0, 10)}...</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{formatKRW(item.amount)}</td>
                  <td className="px-4 py-3">{item.bankName}</td>
                  <td className="px-4 py-3 font-mono">{item.accountNumber}</td>
                  <td className="px-4 py-3">{item.accountHolder}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  {tab === 'pending' && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(item)}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-indigo-700"
                      >
                        처리하기
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Process Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">출금 처리</h2>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">신청자 UID</span>
                <span className="font-mono text-xs">{selected.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">출금 금액</span>
                <span className="font-bold text-lg text-indigo-600">{formatKRW(selected.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">은행</span>
                <span>{selected.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">계좌번호</span>
                <span className="font-mono">{selected.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">예금주</span>
                <span>{selected.accountHolder}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">처리 메모 (선택)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                rows={2}
                placeholder="메모 입력..."
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-4">
              ⚠️ 완료 처리 전 반드시 실제 계좌 이체를 먼저 진행해 주세요.
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleAction('approve')}
                disabled={processing}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                ✅ 이체 완료
              </button>
              <button
                onClick={() => handleAction('reject')}
                disabled={processing}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                ❌ 반려 (포인트 반환)
              </button>
              <button
                onClick={() => setSelected(null)}
                disabled={processing}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
