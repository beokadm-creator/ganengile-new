'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  pendingWithdrawals: number;
  pendingDisputes: number;
  pendingGillerApps: number;
  activeDeliveries: number;
  todayRequests: number;
  totalUsers: number;
  fareCount: number;
  fareLatestUpdatedAt: string | null;
}

function StatCard({ label, value, href, color }: { label: string; value: number; href?: string; color: string }) {
  const inner = (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow`}>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function AlertCard({ label, count, href, urgent }: { label: string; count: number; href: string; urgent?: boolean }) {
  if (count === 0) return null;
  return (
    <Link href={href} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${urgent ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} hover:opacity-80 transition-opacity`}>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${urgent ? 'text-red-700' : 'text-yellow-700'}`}>
          {urgent ? '🔴' : '🟡'} {label}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${urgent ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>
          {count}건
        </span>
      </div>
      <span className={`text-xs font-medium ${urgent ? 'text-red-600' : 'text-yellow-600'}`}>처리하기 →</span>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const fareUpdatedLabel = stats?.fareLatestUpdatedAt
    ? new Date(stats.fareLatestUpdatedAt).toLocaleString('ko-KR')
    : '없음';

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">📊 대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">{dateStr}</p>
      </div>

      {loading || !stats ? (
        <div className="flex items-center justify-center py-20 text-gray-400">데이터 로딩중...</div>
      ) : (
        <>
          {/* Urgent Alerts */}
          {(stats.pendingWithdrawals > 0 || stats.pendingDisputes > 0 || stats.pendingGillerApps > 0) && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">긴급 처리 필요</h2>
              <div className="space-y-2">
                <AlertCard label="출금 신청 대기" count={stats.pendingWithdrawals} href="/points/withdrawals" urgent />
                <AlertCard label="분쟁 처리 대기" count={stats.pendingDisputes} href="/disputes" urgent />
                <AlertCard label="길러 심사 대기" count={stats.pendingGillerApps} href="/gillers/applications" />
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <h2 className="text-sm font-semibold text-gray-700 mb-2">현황</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="오늘 신규 요청" value={stats.todayRequests} color="text-indigo-600" />
            <StatCard label="진행중 배송" value={stats.activeDeliveries} href="/deliveries" color="text-blue-600" />
            <StatCard label="전체 회원수" value={stats.totalUsers} href="/users" color="text-gray-800" />
            <StatCard label="대기 출금 신청" value={stats.pendingWithdrawals} href="/points/withdrawals" color={stats.pendingWithdrawals > 0 ? 'text-red-600' : 'text-gray-400'} />
            <StatCard label="미처리 분쟁" value={stats.pendingDisputes} href="/disputes" color={stats.pendingDisputes > 0 ? 'text-red-600' : 'text-gray-400'} />
            <StatCard label="길러 심사 대기" value={stats.pendingGillerApps} href="/gillers/applications" color={stats.pendingGillerApps > 0 ? 'text-yellow-600' : 'text-gray-400'} />
          </div>

          <h2 className="text-sm font-semibold text-gray-700 mb-2">운임 캐시 모니터링</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm text-gray-500 mb-1">config_fares 총 건수</p>
              <p className="text-3xl font-bold text-emerald-600">{stats.fareCount.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm text-gray-500 mb-1">최신 갱신 시각</p>
              <p className="text-lg font-semibold text-gray-800">{fareUpdatedLabel}</p>
              <p className="text-xs text-gray-400 mt-1">기준: config_fares.updatedAt</p>
            </div>
          </div>

          {/* Quick Links */}
          <h2 className="text-sm font-semibold text-gray-700 mb-2">바로가기</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { href: '/points/withdrawals', label: '💸 출금 처리' },
              { href: '/disputes', label: '⚖️ 분쟁 처리' },
              { href: '/gillers/applications', label: '🔍 길러 심사' },
              { href: '/points/balances', label: '💰 포인트 관리' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="bg-white border border-gray-100 rounded-xl p-4 text-center text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors shadow-sm"
              >
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
