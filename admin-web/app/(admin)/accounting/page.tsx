'use client';

import { useState, useEffect } from 'react';
import { formatKRW } from '@/lib/format';

interface ReportData {
  period: { year: number; month: number };
  revenue: {
    grossRevenue: number;
    revenueDiscount: number;
    liabilityOffset: number;
    cashCollected: number;
  };
  gillerSettlement: {
    grossPayout: number;
    withholdingTax: number;
    netPayout: number;
  };
  partnerSettlement: {
    grossPayout: number;
    commission: number;
    vat: number;
    netPayout: number;
  };
}

export default function AccountingReportPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/accounting?year=${year}&month=${month}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        alert(json.error);
      }
    } catch (e) {
      alert('리포트를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [year, month]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">재무/세무 리포트</h1>
          <p className="mt-1 text-sm text-gray-500">
            전문 배송업체(VAT 10%)와 일반 길러(3.3%)의 정산 내역 및 매출/부채상계 내역을 월별로 조회합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {[...Array(5)].map((_, i) => {
              const y = new Date().getFullYear() - i;
              return <option key={y} value={y}>{y}년</option>;
            })}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}월</option>
            ))}
          </select>
          <button
            onClick={fetchReport}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            조회
          </button>
          <button
            onClick={async () => {
              if (!confirm(`${year}년 ${month}월의 통계 데이터를 재집계하시겠습니까?\n이 작업은 많은 데이터를 읽어오므로 과금이 발생할 수 있습니다.`)) return;
              try {
                setLoading(true);
                const res = await fetch(`/api/admin/accounting/sync`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ year, month })
                });
                if (res.ok) {
                  alert('재집계가 완료되었습니다.');
                  fetchReport();
                } else {
                  alert('재집계 실패');
                  setLoading(false);
                }
              } catch (e: any) {
                alert(`재집계 중 오류가 발생했습니다: ${e.message}`);
                setLoading(false);
              }
            }}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-200"
          >
            전체 재집계 (수동)
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-12 text-center text-gray-500">데이터를 분석 중입니다...</div>
      )}

      {!loading && data && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 1. 플랫폼 매출 및 선수금 변동 */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
              <h3 className="font-bold text-gray-900">플랫폼 매출 (결제 기준)</h3>
              <p className="text-xs text-gray-500 mt-1">쿠폰(매출할인) 및 포인트(부채상계)를 명확히 분리하여 부가세 과세표준을 산정합니다.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">총 과세표준 매출 (Gross)</span>
                <span className="font-semibold text-gray-900">{formatKRW(data.revenue.grossRevenue)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>(-) 쿠폰 할인 (판매촉진비/매출할인)</span>
                <span>{formatKRW(data.revenue.revenueDiscount)}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>(-) 포인트 결제 (기충전 선수금/부채 상계)</span>
                <span>{formatKRW(data.revenue.liabilityOffset)}</span>
              </div>
              <div className="pt-4 border-t border-gray-100 flex justify-between font-bold text-lg">
                <span>실제 PG사 현금 입금액 (Net Cash)</span>
                <span className="text-indigo-700">{formatKRW(data.revenue.cashCollected)}</span>
              </div>
            </div>
          </div>

          {/* 2. 일반 길러 정산 내역 (3.3%) */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
              <h3 className="font-bold text-gray-900">일반 길러 정산 (원천징수 3.3%)</h3>
              <p className="text-xs text-gray-500 mt-1">일반 개인 길러의 사업소득/지방소득세 원천징수 내역입니다.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">정산 대상 총액 (과세표준)</span>
                <span className="font-semibold text-gray-900">{formatKRW(data.gillerSettlement.grossPayout)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>(-) 사업소득세/지방세 (3.3% 원천징수)</span>
                <span>{formatKRW(data.gillerSettlement.withholdingTax)}</span>
              </div>
              <div className="pt-4 border-t border-gray-100 flex justify-between font-bold text-lg">
                <span>실 지급액 (Net Payout)</span>
                <span className="text-indigo-700">{formatKRW(data.gillerSettlement.netPayout)}</span>
              </div>
            </div>
          </div>

          {/* 3. 전문 배송업체 정산 내역 (B2B, 부가세 10%) */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden lg:col-span-2">
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
              <h3 className="font-bold text-gray-900">전문 배송업체 정산 (세금계산서, 부가세 10%)</h3>
              <p className="text-xs text-gray-500 mt-1">B2B 위임 파트너의 월간 정산 내역입니다. 세금계산서 역발행 기준으로 10% 부가세를 인식합니다.</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">공급가액 (Gross)</span>
                  <span className="font-semibold text-gray-900">{formatKRW(data.partnerSettlement.grossPayout)}</span>
                </div>
                <div className="flex justify-between text-indigo-600">
                  <span>(-) 플랫폼 수수료 매출 (수취액)</span>
                  <span>{formatKRW(data.partnerSettlement.commission)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>(-) 매입 부가세 대급금 (VAT 10%)</span>
                  <span>{formatKRW(data.partnerSettlement.vat)}</span>
                </div>
              </div>
              <div className="flex flex-col justify-end border-l border-gray-100 pl-8">
                <div className="flex justify-between font-bold text-xl">
                  <span>실 지급액 (Net Payout)</span>
                  <span className="text-indigo-700">{formatKRW(data.partnerSettlement.netPayout)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-right">정산 주기에 맞춰 세금계산서를 발행할 수 있도록 B2B 정산 데이터만 추출한 값입니다.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}