'use client';

import { useEffect, useState } from 'react';
import { formatKRW } from '@/lib/format';

interface B2BSettlementItem {
  id: string;
  partnerId: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  commissionAmount: number;
  taxAmount: number;
  netAmount: number;
  createdAt: string;
  settledAt: string | null;
}

interface B2BSettlementSummary {
  totalGrossAmount: number;
  totalCommissionAmount: number;
  totalTaxAmount: number;
  totalNetAmount: number;
}

const TABS = ['pending', 'processing', 'completed', 'failed'] as const;
type TabStatus = typeof TABS[number];

export default function B2BSettlementsPage() {
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [items, setItems] = useState<B2BSettlementItem[]>([]);
  const [summary, setSummary] = useState<B2BSettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/b2b/settlements?status=${activeTab}`)
      .then(res => {
        if (!res.ok) throw new Error('API 요청 실패');
        return res.json();
      })
      .then(data => {
        if (data.success) {
          setItems(data.items || []);
          setSummary(data.summary || null);
        } else {
          setError(data.error || '데이터를 불러올 수 없습니다.');
        }
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <main className="flex-1 p-8 text-slate-900 bg-slate-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">B2B 정산 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          외부 배송업체에 대한 위임 수수료 및 정산금 지급 현황입니다.
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-cyan-500 text-cyan-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab === 'pending' && '대기 중'}
            {tab === 'processing' && '처리 중'}
            {tab === 'completed' && '완료'}
            {tab === 'failed' && '실패'}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-600">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          불러오는 중...
        </div>
      ) : (
        <>
          {/* Summary */}
          {summary && (
            <div className="mb-8 grid gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-medium text-slate-500">총 거래액 (Gross)</h3>
                <p className="mt-2 text-2xl font-bold text-slate-900">{formatKRW(summary.totalGrossAmount)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-medium text-slate-500">플랫폼 수수료 (Commission)</h3>
                <p className="mt-2 text-2xl font-bold text-slate-900">{formatKRW(summary.totalCommissionAmount)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-medium text-slate-500">세금 (Tax)</h3>
                <p className="mt-2 text-2xl font-bold text-slate-900">{formatKRW(summary.totalTaxAmount)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-cyan-50 p-5 shadow-sm">
                <h3 className="text-sm font-medium text-cyan-800">최종 지급액 (Net)</h3>
                <p className="mt-2 text-2xl font-bold text-cyan-900">{formatKRW(summary.totalNetAmount)}</p>
              </div>
            </div>
          )}

          {/* List */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-500">해당 상태의 정산 내역이 없습니다.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">정산 ID</th>
                    <th className="px-6 py-3 font-medium">파트너사 ID</th>
                    <th className="px-6 py-3 font-medium">기간</th>
                    <th className="px-6 py-3 font-medium text-right">거래액</th>
                    <th className="px-6 py-3 font-medium text-right">수수료+세금</th>
                    <th className="px-6 py-3 font-medium text-right">지급액 (Net)</th>
                    <th className="px-6 py-3 font-medium text-right">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{item.id.slice(0, 8)}...</td>
                      <td className="px-6 py-4">{item.partnerId}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {item.periodStart} ~ {item.periodEnd}
                      </td>
                      <td className="px-6 py-4 text-right">{formatKRW(item.grossAmount)}</td>
                      <td className="px-6 py-4 text-right text-rose-600">
                        -{formatKRW((item.commissionAmount || 0) + (item.taxAmount || 0))}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">{formatKRW(item.netAmount)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          item.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          item.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {item.status === 'pending' && '대기 중'}
                          {item.status === 'processing' && '처리 중'}
                          {item.status === 'completed' && '완료'}
                          {item.status === 'failed' && '실패'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </main>
  );
}
