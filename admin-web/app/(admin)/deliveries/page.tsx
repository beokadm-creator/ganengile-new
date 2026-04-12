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
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function updateStatus(id: string, newStatus: string) {
    if (!confirm(`배송 상태를 '${statusLabel(newStatus)}'(으)로 강제 변경하시겠습니까?`)) return;
    
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/deliveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
      } else {
        alert('상태 업데이트에 실패했습니다.');
      }
    } catch (error) {
      alert('오류가 발생했습니다.');
    } finally {
      setUpdatingId(null);
    }
  }

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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🚴 배송 관리</h1>
        <p className="text-gray-500 text-sm mt-1">배송 요청 현황을 확인합니다.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {(['active', 'done'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s === 'active' ? '진행중' : '완료/취소'}
          </button>
        ))}
      </div>

      {tab === 'active' && items.length > 0 && (
        <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-sm">
          <span className="font-semibold text-indigo-800">진행중 배송: {items.length}건</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">로딩중...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg">배송 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
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
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.id.slice(0, 10)}...</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[120px] truncate">{item.itemDescription || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px]">
                    <p className="truncate">{item.fromLocation || '-'}</p>
                    <p className="text-gray-400">↓</p>
                    <p className="truncate">{item.toLocation || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatKRW(item.totalAmount)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {item.gillerId ? `${item.gillerId.slice(0, 10)}...` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={item.status}
                      onChange={(e) => updateStatus(item.id, e.target.value)}
                      disabled={updatingId === item.id}
                      className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer border-0 outline-none ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-indigo-600 appearance-none text-center ${statusColor(item.status)} ${updatingId === item.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <optgroup label="진행중">
                        <option value="pending" className="bg-white text-gray-900">대기 중</option>
                        <option value="matched" className="bg-white text-gray-900">매칭 완료</option>
                        <option value="accepted" className="bg-white text-gray-900">수락됨</option>
                        <option value="picked_up" className="bg-white text-gray-900">픽업 완료</option>
                        <option value="in_transit" className="bg-white text-gray-900">이동 중</option>
                        <option value="arrived" className="bg-white text-gray-900">도착</option>
                        <option value="at_locker" className="bg-white text-gray-900">보관함 도착</option>
                        <option value="handover_pending" className="bg-white text-gray-900">인계 대기</option>
                        <option value="last_mile_in_progress" className="bg-white text-gray-900">라스트마일 진행중</option>
                      </optgroup>
                      <optgroup label="완료/취소">
                        <option value="completed" className="bg-white text-gray-900">완료</option>
                        <option value="cancelled" className="bg-white text-gray-900">취소</option>
                        <option value="failed" className="bg-white text-gray-900">실패</option>
                      </optgroup>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
