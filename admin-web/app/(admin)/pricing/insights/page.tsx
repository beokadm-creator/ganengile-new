'use client';

import { useEffect, useState } from 'react';

type RecommendationRules = {
  peakTimeMultiplier: number;
  professionalPeakMultiplier: number;
  rainMultiplier: number;
  snowMultiplier: number;
  lowSupplyMultiplier: number;
  highSupplyDiscountMultiplier: number;
  reservationDiscountMultiplier: number;
  maxRecommendationMultiplier: number;
};

type PricingInsightPayload = {
  summary: {
    completedCount: number;
    averageFee: number;
    averageDynamicAdjustment: number;
    peakShare: number;
    lowSupplyShare: number;
    weatherImpactShare: number;
    immediateShare: number;
    activePolicyVersion: string;
    recommendationMultiplier: number;
    recommendationRules: RecommendationRules;
  };
  routes: Array<{
    routeKey: string;
    label: string;
    sampleCount: number;
    averageFee: number;
    averageDynamicAdjustment: number;
    peakShare: number;
    lowSupplyShare: number;
    immediateShare: number;
    latestPolicyVersion: string | null;
  }>;
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString()}원`;
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export default function PricingInsightsPage() {
  const [data, setData] = useState<PricingInsightPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/pricing-insights');
        const json = (await response.json()) as PricingInsightPayload;
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">불러오는 중...</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-rose-500">가격 인사이트를 불러오지 못했습니다.</div>;
  }

  const { summary, routes } = data;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">가격 인사이트</h1>
        <p className="mt-1 text-sm text-slate-500">최근 완료 이력 기준</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="완료 이력" value={`${summary.completedCount}건`} hint="최근 표본" />
        <MetricCard title="평균 요금" value={formatCurrency(summary.averageFee)} hint="평균" />
        <MetricCard title="평균 환경 보정" value={`${summary.averageDynamicAdjustment > 0 ? '+' : ''}${formatCurrency(summary.averageDynamicAdjustment)}`} hint="평균" />
        <MetricCard title="즉시 요청" value={formatPercent(summary.immediateShare)} hint="비중" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">운영 시그널</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SignalCard title="피크" value={formatPercent(summary.peakShare)} caption="비중" />
            <SignalCard title="공급 부족" value={formatPercent(summary.lowSupplyShare)} caption="비중" />
            <SignalCard title="날씨 영향" value={formatPercent(summary.weatherImpactShare)} caption="비중" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">현재 추천가 규칙</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <RuleRow label="정책 버전" value={summary.activePolicyVersion} />
            <RuleRow label="기본 추천 배수" value={`${summary.recommendationMultiplier}x`} />
            <RuleRow label="피크 가산" value={`${summary.recommendationRules.peakTimeMultiplier}x`} />
            <RuleRow label="전문 피크 가산" value={`${summary.recommendationRules.professionalPeakMultiplier}x`} />
            <RuleRow label="비 가산" value={`${summary.recommendationRules.rainMultiplier}x`} />
            <RuleRow label="눈 가산" value={`${summary.recommendationRules.snowMultiplier}x`} />
            <RuleRow label="공급 부족 가산" value={`${summary.recommendationRules.lowSupplyMultiplier}x`} />
            <RuleRow label="공급 충분 할인" value={`${summary.recommendationRules.highSupplyDiscountMultiplier}x`} />
            <RuleRow label="예약 할인" value={`${summary.recommendationRules.reservationDiscountMultiplier}x`} />
            <RuleRow label="최대 추천 배수" value={`${summary.recommendationRules.maxRecommendationMultiplier}x`} />
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">상위 구간 인사이트</h2>
            <p className="mt-1 text-sm text-slate-500">표본 많은 순</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">구간</th>
                <th className="px-4 py-3 text-right">표본</th>
                <th className="px-4 py-3 text-right">평균 요금</th>
                <th className="px-4 py-3 text-right">환경 보정</th>
                <th className="px-4 py-3 text-right">피크</th>
                <th className="px-4 py-3 text-right">공급 부족</th>
                <th className="px-4 py-3 text-right">즉시 요청</th>
                <th className="px-4 py-3">정책 버전</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routes.map((route) => (
                <tr key={route.routeKey} className="bg-white">
                  <td className="px-4 py-3 font-medium text-slate-800">{route.label}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{route.sampleCount}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(route.averageFee)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {route.averageDynamicAdjustment > 0 ? '+' : ''}
                    {formatCurrency(route.averageDynamicAdjustment)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatPercent(route.peakShare)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatPercent(route.lowSupplyShare)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatPercent(route.immediateShare)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{route.latestPolicyVersion ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function SignalCard({ title, value, caption }: { title: string; value: string; caption: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{caption}</div>
    </div>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
