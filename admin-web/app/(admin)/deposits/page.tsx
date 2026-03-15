'use client';

import { useEffect, useState } from 'react';
import { formatKRW, formatDate, statusLabel, statusColor } from '@/lib/format';

interface Deposit {
  id: string;
  userId: string;
  requestId: string;
  depositAmount: number;
  pointAmount?: number;
  tossAmount?: number;
  paymentMethod: string;
  status: string;
  createdAt: { seconds: number } | string;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  point_only: '포인트 전액',
  mixed: '포인트+토스',
  toss_only: '토스 전액',
};

export default function DepositsPage() {
  const [tab, setTab] = useState<'paid' | 'refunded' | 'deducted'>('paid');
  const [items, setItems] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadData(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/deposits?status=${status}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(tab); }, [tab]);

  async function handleAction(depositId: string, action: 'refund' | 'deduct') {
    const confirmed = confirm(action === 'refund' ? '보증금을 환급하시겠습니까?' : '사고로 인한 보증금을 차감하시겠습니까?');
    if (!confirmed) return;
    setProcessing(depositId);
    try {
      await fetch('/api/admin/deposits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId, action }),
      });
      await loadData(tab);
    } finally {
      setProcessing(null);
    }
  }

  const totalAmount = items.reduce((s, i) => s + i.depositAmount, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🔒 보증금 관리</h1>
        <p className="text-gray-500 text-sm mt-1">길러의 보증금 현황을 관리합니다.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {(['paid', 'refunded', 'deducted'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s === 'paid' ? '납부중' : s === 'refunded' ? '환급완료' : '차감(사고)'}
          </button>
        ))}
      </div>

      {tab === 'paid' && items.length > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
          <span className="font-semibold text-blue-800">현재 보유 보증금 합계: {formatKRW(totalAmount)}</span>
          <span className="text-blue-700 ml-2">({items.length}건)</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">로딩중...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg">내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-left">길러 (UID)</th>
                <th className="px-4 py-3 text-left">요청 ID</th>
                <th className="px-4 py-3 text-right">보증금액</th>
                <th className="px-4 py-3 text-left">결제 방법</th>
                <th className="px-4 py-3 text-left">납부일</th>
                <th className="px-4 py-3 text-left">상태</th>
                {tab === 'paid' && <th className="px-4 py-3 text-left">액션</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.userId?.slice(0, 10)}...</td>
                  <td className="px-4 py-3 font-mono text-xs">{item.requestId?.slice(0, 10)}...</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatKRW(item.depositAmount)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{PAYMENT_METHOD_LABEL[item.paymentMethod] ?? item.paymentMethod}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  {tab === 'paid' && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAction(item.id, 'refund')}
                          disabled={processing === item.id}
                          className="bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                        >
                          환급
                        </button>
                        <button
                          onClick={() => handleAction(item.id, 'deduct')}
                          disabled={processing === item.id}
                          className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                        >
                          차감(사고)
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
