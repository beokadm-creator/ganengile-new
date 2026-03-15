'use client';

import { useEffect, useState } from 'react';
import { formatKRW, formatDate } from '@/lib/format';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  pointBalance: number;
  gillerApplicationStatus: string | null;
  createdAt: { seconds: number } | string;
}

const ROLE_LABEL: Record<string, string> = {
  giller: '길러',
  gller: '이용자',
  both: '길러+이용자',
};

const ROLE_COLOR: Record<string, string> = {
  giller: 'bg-purple-100 text-purple-700',
  gller: 'bg-blue-100 text-blue-700',
  both: 'bg-green-100 text-green-700',
};

export default function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function toggleActive(userId: string, current: boolean) {
    setProcessing(userId);
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: !current }),
      });
      await loadData();
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">👥 사용자 관리</h1>
        <p className="text-gray-500 text-sm mt-1">가입 사용자 목록 조회 및 계정 상태 관리</p>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadData()}
          placeholder="이름, 이메일, UID 검색..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">전체 역할</option>
          <option value="giller">길러</option>
          <option value="gller">이용자</option>
          <option value="both">길러+이용자</option>
        </select>
        <button onClick={loadData} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          검색
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">로딩중...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg">사용자가 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium">{items.length}명</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-left">사용자</th>
                <th className="px-4 py-3 text-left">역할</th>
                <th className="px-4 py-3 text-right">포인트</th>
                <th className="px-4 py-3 text-left">가입일</th>
                <th className="px-4 py-3 text-left">상태</th>
                <th className="px-4 py-3 text-left">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.email}</p>
                    <p className="text-xs text-gray-300 font-mono">{item.id.slice(0, 10)}...</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLOR[item.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {(ROLE_LABEL[item.role] ?? item.role) || '-'}
                    </span>
                    {item.gillerApplicationStatus === 'pending' && (
                      <span className="ml-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">심사중</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-indigo-600">{formatKRW(item.pointBalance)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {item.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(item.id, item.isActive)}
                      disabled={processing === item.id}
                      className={`text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-50 ${
                        item.isActive
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      {item.isActive ? '비활성화' : '활성화'}
                    </button>
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
