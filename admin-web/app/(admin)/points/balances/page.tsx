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
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Dark header */}
        <section className="rounded-[28px] bg-[#0f172a] px-7 py-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">points</p>
          <h1 className="mt-3 text-3xl font-bold">포인트 잔액 관리</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">사용자 포인트 잔액 조회 및 수동 조정 (CS 보상, 오류 수정 등)</p>
        </section>

        {/* Search bar */}
        <section className="rounded-[24px] bg-white p-5 shadow-sm">
          <div className="flex gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              placeholder="이름, 이메일, UID 검색..."
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={loadData}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              검색
            </button>
          </div>
        </section>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">로딩중...</div>
        ) : (
          <section className="overflow-hidden rounded-[24px] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">사용자 목록</h2>
              <span className="text-sm text-slate-500">{items.length}건</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left">사용자</th>
                    <th className="px-5 py-3 text-right">현재 잔액</th>
                    <th className="px-5 py-3 text-right">총 적립</th>
                    <th className="px-5 py-3 text-right">총 사용</th>
                    <th className="px-5 py-3 text-left">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{item.displayName}</p>
                        <p className="text-xs text-slate-400">{item.email}</p>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">{formatKRW(item.pointBalance)}</td>
                      <td className="px-5 py-3 text-right text-emerald-600">{formatKRW(item.totalEarnedPoints)}</td>
                      <td className="px-5 py-3 text-right text-rose-500">{formatKRW(item.totalSpentPoints)}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setSelected(item)}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          잔액 조정
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-xl">
              <h2 className="text-lg font-bold text-slate-900">포인트 수동 조정</h2>
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                <p className="font-medium text-slate-900">{selected.displayName}</p>
                <p className="mt-1 text-slate-500">현재 잔액: <span className="font-bold text-slate-900">{formatKRW(selected.pointBalance)}</span></p>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">조정 유형</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="earn">적립 (잔액 증가)</option>
                    <option value="spend">차감 (잔액 감소)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">금액 (원)</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">사유 (필수)</label>
                  <input
                    type="text"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="CS 보상 / 오류 수정 / 이벤트..."
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleAdjust}
                  disabled={processing || !form.amount || !form.reason}
                  className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {processing ? '처리중...' : '조정 적용'}
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
