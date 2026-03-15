'use client';

import { useEffect, useState } from 'react';
import { formatKRW } from '@/lib/format';

interface UserPoint {
  id: string;
  displayName: string;
  email: string;
  pointBalance: number;
  totalEarnedPoints: number;
  totalSpentPoints: number;
}

export default function PointBalancesPage() {
  const [items, setItems] = useState<UserPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserPoint | null>(null);
  const [form, setForm] = useState({ type: 'earn', amount: '', reason: '' });
  const [processing, setProcessing] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/points?search=${encodeURIComponent(search)}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleAdjust() {
    if (!selected || !form.amount || !form.reason) return;
    setProcessing(true);
    try {
      await fetch('/api/admin/points', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, ...form }),
      });
      setSelected(null);
      setForm({ type: 'earn', amount: '', reason: '' });
      await loadData();
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">💰 포인트 잔액 관리</h1>
        <p className="text-gray-500 text-sm mt-1">사용자 포인트 잔액 조회 및 수동 조정 (CS 보상, 오류 수정 등)</p>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadData()}
          placeholder="이름, 이메일, UID 검색..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button onClick={loadData} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          검색
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">로딩중...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-left">사용자</th>
                <th className="px-4 py-3 text-right">현재 잔액</th>
                <th className="px-4 py-3 text-right">총 적립</th>
                <th className="px-4 py-3 text-right">총 사용</th>
                <th className="px-4 py-3 text-left">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.displayName}</p>
                    <p className="text-xs text-gray-400">{item.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-600">{formatKRW(item.pointBalance)}</td>
                  <td className="px-4 py-3 text-right text-green-600">{formatKRW(item.totalEarnedPoints)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{formatKRW(item.totalSpentPoints)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(item)}
                      className="text-xs bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 text-gray-600 px-3 py-1.5 rounded-md"
                    >
                      잔액 조정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">포인트 수동 조정</h2>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="font-medium">{selected.displayName}</p>
              <p className="text-gray-500">현재 잔액: <span className="font-bold text-indigo-600">{formatKRW(selected.pointBalance)}</span></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">조정 유형</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="earn">적립 (잔액 증가)</option>
                  <option value="spend">차감 (잔액 감소)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">금액 (원)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사유 (필수)</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="CS 보상 / 오류 수정 / 이벤트..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAdjust}
                disabled={processing || !form.amount || !form.reason}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {processing ? '처리중...' : '조정 적용'}
              </button>
              <button onClick={() => setSelected(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
