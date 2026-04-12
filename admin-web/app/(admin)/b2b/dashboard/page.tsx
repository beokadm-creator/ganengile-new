'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface B2BStats {
  totalDeliveriesThisMonth: number;
  completedDeliveriesThisMonth: number;
  activePartnersCount: number;
  pendingSettlementAmount: number;
}

export default function B2BDashboardPage() {
  const [stats, setStats] = useState<B2BStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/b2b/dashboard')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data.stats);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex-1 p-8 text-slate-900 bg-slate-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">B2B 파트너 관리 대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          외부 배송업체 위임 현황과 정산 내역을 통합 관리합니다.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-slate-500">데이터를 불러오는 중입니다...</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">이번 달 총 위임 배송</h3>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {stats?.totalDeliveriesThisMonth.toLocaleString()}<span className="text-sm font-normal text-slate-500 ml-1">건</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              완료: {stats?.completedDeliveriesThisMonth.toLocaleString()}건
            </p>
          </div>
          
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">활성 배송 파트너</h3>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {stats?.activePartnersCount.toLocaleString()}<span className="text-sm font-normal text-slate-500 ml-1">개사</span>
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
            <h3 className="text-sm font-medium text-slate-500">미정산/대기 금액</h3>
            <p className="mt-2 text-3xl font-bold text-rose-600">
              {stats?.pendingSettlementAmount.toLocaleString()}<span className="text-sm font-normal text-slate-500 ml-1">원</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              b2bSettlements 기준
            </p>
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4">바로가기</h2>
          <div className="space-y-3">
            <Link href="/delivery-partners" className="block p-4 rounded-xl border border-slate-100 hover:border-cyan-500 hover:bg-cyan-50 transition-colors">
              <h3 className="font-semibold text-slate-900">배송업체 관리</h3>
              <p className="text-sm text-slate-500">B2B 파트너사 등록, 상태 변경 및 API 연동 설정</p>
            </Link>
            <Link href="/partner-dispatches" className="block p-4 rounded-xl border border-slate-100 hover:border-cyan-500 hover:bg-cyan-50 transition-colors">
              <h3 className="font-semibold text-slate-900">업체 위임 현황</h3>
              <p className="text-sm text-slate-500">외부 파트너로 할당된 배송 요청(partner_dispatches) 실시간 관제</p>
            </Link>
            <Link href="/b2b/settlements" className="block p-4 rounded-xl border border-slate-100 hover:border-cyan-500 hover:bg-cyan-50 transition-colors">
              <h3 className="font-semibold text-slate-900">B2B 정산 내역</h3>
              <p className="text-sm text-slate-500">월별 위임 수수료 청구 및 파트너 정산 처리 내역</p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
