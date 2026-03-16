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

  useEffect(() => {
    load();
  }, [tab]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🧳 사물함 관리</h1>
        <p className="text-gray-500 text-sm mt-1">지하철/비지하철 사물함을 분리 관리합니다.</p>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('subway')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'subway' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          지하철
        </button>
        <button
          onClick={() => setTab('non_subway')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'non_subway' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          비지하철
        </button>
      </div>

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
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">역/시설</th>
                <th className="px-4 py-3 text-left">노선</th>
                <th className="px-4 py-3 text-left">구역</th>
                <th className="px-4 py-3 text-left">사이즈</th>
                <th className="px-4 py-3 text-right">수량</th>
                <th className="px-4 py-3 text-left">업데이트</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{item.lockerId || item.id}</td>
                  <td className="px-4 py-3 text-xs">{item.location?.stationName || item.facilityName || '-'}</td>
                  <td className="px-4 py-3 text-xs">{item.location?.line || '-'}</td>
                  <td className="px-4 py-3 text-xs">{item.location?.section || '-'}</td>
                  <td className="px-4 py-3 text-xs">{item.size || '-'}</td>
                  <td className="px-4 py-3 text-right text-xs">
                    {item.availability?.available ?? item.availability?.total ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.updatedAt ? formatDate(item.updatedAt) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
