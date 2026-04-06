'use client';

import { useEffect, useState } from 'react';
import { formatKRW, formatDate, statusLabel, statusColor } from '@/lib/format';

interface Delivery {
  id: string;
  requesterId: string;
  gillerId: string;
  status: string;
  totalAmount: number;
  itemDescription: string;
  fromLocation: string;
  toLocation: string;
  createdAt: { seconds: number } | string;
  completedAt: { seconds: number } | string | null;
}

export default function DeliveriesPage() {
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [items, setItems] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData(t: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/deliveries?tab=${t}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(tab); }, [tab]);

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* 다크 헤더 */}
        <section className="rounded-[28px] bg-[#0f172a] px-7 py-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">delivery ops</p>
          <h1 className="mt-3 text-3xl font-bold">배송 운영</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">배송 요청 현황을 확인합니다.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {(['active', 'done'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setTab(s)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tab === s
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {s === 'active' ? '진행중' : '완료/취소'}
              </button>
            ))}
          </div>
        </section>

        {/* 진행중 배송 요약 */}
        {tab === 'active' && items.length > 0 && !loading && (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">진행중 배송</p>
              <p className="mt-3 text-4xl font-bold text-slate-900">{items.length}</p>
              <p className="mt-3 text-sm text-slate-500">현재 활성 배송 건수</p>
            </div>
          </div>
        )}

        {/* 콘텐츠 */}
        {loading ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            배송 목록을 불러오는 중입니다.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            배송 내역이 없습니다.
          </div>
        ) : (
          <section className="overflow-hidden rounded-[24px] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">배송 목록</p>
                <p className="text-xs text-slate-500">{items.length}건</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">요청 ID</th>
                    <th className="px-4 py-3 text-left">물품</th>
                    <th className="px-4 py-3 text-left">출발 → 도착</th>
                    <th className="px-4 py-3 text-right">금액</th>
                    <th className="px-4 py-3 text-left">길러 (UID)</th>
                    <th className="px-4 py-3 text-left">요청일</th>
                    <th className="px-4 py-3 text-left">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.id.slice(0, 10)}...</td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-slate-700">{item.itemDescription || '-'}</td>
                      <td className="max-w-[160px] px-4 py-3 text-xs text-slate-600">
                        <p className="truncate">{item.fromLocation || '-'}</p>
                        <p className="text-slate-400">↓</p>
                        <p className="truncate">{item.toLocation || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatKRW(item.totalAmount)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {item.gillerId ? `${item.gillerId.slice(0, 10)}...` : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
