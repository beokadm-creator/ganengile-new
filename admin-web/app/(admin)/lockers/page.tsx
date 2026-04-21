'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatKRW, formatDate } from '@/lib/format';

interface LockerItem {
  id: string;
  lockerId: string;
  type?: 'public' | 'private';
  operator?: string;
  status?: 'available' | 'occupied' | 'maintenance';
  location?: {
    stationId?: string;
    stationName?: string;
    line?: string;
    floor?: number;
    section?: string;
    latitude?: number;
    longitude?: number;
  };
  size?: 'small' | 'medium' | 'large';
  pricing?: {
    base?: number;
    baseDuration?: number;
    extension?: number;
    maxDuration?: number;
  };
  availability?: {
    total?: number;
    occupied?: number;
    available?: number;
  };
  qrCode?: string;
  accessMethod?: string;
  isSubway?: boolean;
  source?: string;
  updatedAt?: { seconds: number; _seconds?: number; toDate?: () => Date } | string;
}

interface LockerStats {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
  avgBaseFee: number;
  totalCapacity: number;
  totalAvailable: number;
}

const lockerStatusLabel: Record<string, string> = {
  available: '사용 가능',
  occupied: '사용 중',
  maintenance: '정비 중',
};

const lockerStatusColor: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-800',
  occupied: 'bg-amber-100 text-amber-800',
  maintenance: 'bg-rose-100 text-rose-800',
};

const sizeLabel: Record<string, string> = {
  small: '소형',
  medium: '중형',
  large: '대형',
};

const operatorLabel: Record<string, string> = {
  seoul_metro: '서울메트로',
  korail: '코레일',
  local_gov: '지자체',
  cu: 'CU',
  gs25: 'GS25',
  locker_box: 'Locker Box',
};

function formatFloor(floor: number | undefined): string {
  if (floor === undefined) return '-';
  if (floor < 0) return `B${Math.abs(floor)}`;
  return `${floor}층`;
}

export default function LockersPage() {
  const [tab, setTab] = useState<'subway' | 'non_subway'>('subway');
  const [items, setItems] = useState<LockerItem[]>([]);
  const [stats, setStats] = useState<LockerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [editingLocker, setEditingLocker] = useState<LockerItem | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [updating, setUpdating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const collection = tab === 'subway' ? 'lockers' : 'non_subway_lockers';
      const params = new URLSearchParams({ collection, limit: '500' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (operatorFilter) params.set('operator', operatorFilter);

      const res = await fetch(`/api/admin/lockers?${params}`);
      const json = await res.json();
      setItems(json.items ?? []);
      setStats(json.stats ?? null);
    } catch {
      setItems([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [tab, search, statusFilter, operatorFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleStatusChangeClick(item: LockerItem) {
    setEditingLocker(item);
    setNewStatus(item.status ?? 'available');
  }

  async function handleStatusSave() {
    if (!editingLocker || !newStatus) return;
    setUpdating(true);
    try {
      const collection = tab === 'subway' ? 'lockers' : 'non_subway_lockers';
      const res = await fetch(
        `/api/admin/lockers/${editingLocker.id}?collection=${collection}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === editingLocker.id ? { ...item, status: newStatus as LockerItem['status'] } : item
          )
        );
        setEditingLocker(null);
      }
    } catch (_error) {
      void _error;
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(item: LockerItem) {
    if (!confirm('정말 이 사물함을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      const collection = tab === 'subway' ? 'lockers' : 'non_subway_lockers';
      const res = await fetch(`/api/admin/lockers/${item.id}?collection=${collection}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch (_error) {
      void _error;
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🧳 사물함 관리</h1>
        <p className="text-gray-500 text-sm mt-1">지하철 및 일반 사물함 현황을 관리합니다.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">총 사물함</p>
            <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">사용 가능</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.available.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">정비 중</p>
            <p className="text-2xl font-bold text-rose-600">{stats.maintenance.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">평균 기본요금</p>
            <p className="text-2xl font-bold">{formatKRW(stats.avgBaseFee)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('subway')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'subway' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          지하철 사물함
        </button>
        <button
          onClick={() => setTab('non_subway')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'non_subway' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          일반 사물함
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="🔍 역명/구역 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') loadData();
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">상태: 전체</option>
          <option value="available">사용 가능</option>
          <option value="occupied">사용 중</option>
          <option value="maintenance">정비 중</option>
        </select>
        <select
          value={operatorFilter}
          onChange={(e) => setOperatorFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">운영사: 전체</option>
          <option value="seoul_metro">서울메트로</option>
          <option value="korail">코레일</option>
          <option value="local_gov">지자체</option>
          <option value="cu">CU</option>
          <option value="gs25">GS25</option>
          <option value="locker_box">Locker Box</option>
        </select>
        <button
          onClick={loadData}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50"
        >
          🔄 새로고침
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">ID</th>
                  <th className="px-3 py-3 text-left">역/시설</th>
                  <th className="px-3 py-3 text-left">노선</th>
                  <th className="px-3 py-3 text-left">구역</th>
                  <th className="px-3 py-3 text-left">층</th>
                  <th className="px-3 py-3 text-left">크기</th>
                  <th className="px-3 py-3 text-right">기본요금</th>
                  <th className="px-3 py-3 text-right">기본시간</th>
                  <th className="px-3 py-3 text-right">가용</th>
                  <th className="px-3 py-3 text-left">상태</th>
                  <th className="px-3 py-3 text-left">출처</th>
                  <th className="px-3 py-3 text-left">업데이트</th>
                  <th className="px-3 py-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{item.lockerId || item.id}</td>
                    <td className="px-3 py-2 text-xs">{item.location?.stationName || '-'}</td>
                    <td className="px-3 py-2 text-xs">{item.location?.line || '-'}</td>
                    <td className="px-3 py-2 text-xs">{item.location?.section || '-'}</td>
                    <td className="px-3 py-2 text-xs">{formatFloor(item.location?.floor)}</td>
                    <td className="px-3 py-2 text-xs">{sizeLabel[item.size || ''] || item.size || '-'}</td>
                    <td className="px-3 py-2 text-xs text-right">
                      {item.pricing?.base ? formatKRW(item.pricing.base) : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right">
                      {item.pricing?.baseDuration ? `${item.pricing.baseDuration}분` : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right">
                      {item.availability
                        ? `${item.availability.available ?? '-'}/${item.availability.total ?? '-'}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {item.status ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${lockerStatusColor[item.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {lockerStatusLabel[item.status] ?? item.status}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {item.source === 'kric_api' ? 'KRIC' : '수동'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{formatDate(item.updatedAt)}</td>
                    <td className="px-3 py-2 text-xs text-center">
                      <button
                        onClick={() => handleStatusChangeClick(item)}
                        className="text-indigo-600 hover:text-indigo-800 mr-2"
                      >
                        상태변경
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="text-rose-600 hover:text-rose-800"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingLocker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">상태 변경</h3>
            <p className="text-sm text-gray-500 mb-4">
              {editingLocker.lockerId || editingLocker.id} — {editingLocker.location?.stationName || '-'}
            </p>
            <div className="space-y-3 mb-6">
              {(['available', 'occupied', 'maintenance'] as const).map((s) => (
                <label key={s} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={newStatus === s}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="text-indigo-600"
                  />
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${lockerStatusColor[s]}`}
                  >
                    {lockerStatusLabel[s]}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditingLocker(null)}
                disabled={updating}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleStatusSave}
                disabled={updating || newStatus === editingLocker.status}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {updating ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
