'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/format';

interface LockerItem {
  id: string;
  lockerId: string;
  location?: {
    stationName?: string;
    line?: string;
    section?: string;
  };
  size?: string;
  status?: string;
  availability?: {
    total?: number;
    available?: number;
  };
  updatedAt?: { seconds: number } | string;
  facilityName?: string;
  isSubway?: boolean;
}

export default function LockersPage() {
  const [tab, setTab] = useState<'subway' | 'non_subway'>('subway');
  const [items, setItems] = useState<LockerItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const url = tab === 'subway' ? '/api/admin/lockers' : '/api/admin/non-subway-lockers';
      const res = await fetch(url);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab]);

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-[#0f172a] px-7 py-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">infrastructure</p>
          <h1 className="mt-3 text-3xl font-bold">사물함 운영</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">지하철 및 비지하철 사물함을 분리 관리합니다.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => setTab('subway')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === 'subway' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
            >지하철</button>
            <button
              onClick={() => setTab('non_subway')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${tab === 'non_subway' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
            >비지하철</button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">내역이 없습니다.</div>
        ) : (
          <section className="overflow-hidden rounded-[24px] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">사물함 목록</p>
                <p className="text-xs text-slate-500">{items.length}건</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">역/시설</th>
                    <th className="px-4 py-3 text-left">노선</th>
                    <th className="px-4 py-3 text-left">구역</th>
                    <th className="px-4 py-3 text-left">사이즈</th>
                    <th className="px-4 py-3 text-right">수량</th>
                    <th className="px-4 py-3 text-left">업데이트</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.lockerId || item.id}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{item.location?.stationName || item.facilityName || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.location?.line || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.location?.section || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.size || '-'}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-700">{item.availability?.available ?? item.availability?.total ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{item.updatedAt ? formatDate(item.updatedAt) : '-'}</td>
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
