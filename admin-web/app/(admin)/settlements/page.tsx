'use client';

import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { formatDate, formatKRW, statusColor, statusLabel } from '@/lib/format';

interface SettlementItem {
  id: string;
  requestId: string;
  deliveryId?: string;
  gillerId?: string;
  requesterId?: string;
  status: string;
  customerPaidAmount?: number | null;
  publicFareAmount?: number | null;
  vatAmount?: number | null;
  feeSupplyAmount?: number | null;
  platformFeeAmount?: number | null;
  gillerGrossAmount?: number | null;
  gillerWithholdingTaxAmount?: number | null;
  expectedWithholdingTaxAmount?: number | null;
  taxDifference?: number | null;
  gillerNetAmount?: number | null;
  withholdingReviewStatus?: 'ok' | 'review' | 'missing';
  gillerIdentityStatus?: string;
  gillerBankVerificationStatus?: string;
  paymentConfigLiveReady?: boolean;
  paymentConfigTestMode?: boolean;
  paymentProvider?: string;
  paymentStatusMessage?: string;
  bankConfigLiveReady?: boolean;
  bankConfigTestMode?: boolean;
  createdAt?: { seconds: number } | string;
  settledAt?: { seconds: number } | string;
  geo?: {
    pickup?: { lat?: number; lng?: number };
    dropoff?: { lat?: number; lng?: number };
  } | null;
}

interface IntegrationSummary {
  paymentLiveReady: boolean;
  paymentTestMode: boolean;
  paymentProvider: string;
  paymentStatusMessage: string;
  bankLiveReady: boolean;
  bankTestMode: boolean;
}

interface Summary {
  totalCustomerPaid: number;
  totalPlatformFee: number;
  totalGrossSettlement: number;
  totalWithholdingTax: number;
  totalNetSettlement: number;
  taxReviewCount: number;
  taxMissingCount: number;
}

interface TaxPolicy {
  businessIncomeRate: number;
  localIncomeTaxRate: number;
  combinedWithholdingRate: number;
  combinedWithholdingPercentLabel: string;
  annualFilingWindow: string;
  withholdingRemitDueRule: string;
  simpleStatementDueRule: string;
  caution: string;
}

interface SettlementResponse {
  items?: SettlementItem[];
  integration?: IntegrationSummary;
  summary?: Summary;
  taxPolicy?: TaxPolicy;
}

const TABS = ['processing', 'completed', 'failed'] as const;

function isSettlementResponse(value: unknown): value is SettlementResponse {
  return typeof value === 'object' && value !== null;
}

async function loadSettlements(status: string): Promise<SettlementResponse> {
  const response = await fetch(`/api/admin/settlements?status=${status}`);
  const json: unknown = await response.json();
  return isSettlementResponse(json) ? json : {};
}

function buildStaticMapUrl(item: SettlementItem): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'ganengile';
  const region = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? 'us-central1';
  const pickup = item.geo?.pickup;
  const dropoff = item.geo?.dropoff;
  if (!projectId || typeof pickup?.lat !== 'number' || typeof pickup.lng !== 'number') {
    return '';
  }

  const markers = [
    `${pickup.lng},${pickup.lat},P`,
    typeof dropoff?.lat === 'number' && typeof dropoff.lng === 'number'
      ? `${dropoff.lng},${dropoff.lat},D`
      : null,
  ]
    .filter((value): value is string => value !== null)
    .join('|');

  const query = new URLSearchParams({
    center: `${pickup.lng},${pickup.lat}`,
    level: '13',
    w: '800',
    h: '260',
    scale: '2',
    markers,
  });

  return `https://${region}-${projectId}.cloudfunctions.net/naverStaticMapProxy?${query.toString()}`;
}

function formatMoney(value?: number | null): string {
  return formatKRW(value ?? 0);
}

export default function SettlementsPage(): JSX.Element {
  const [tab, setTab] = useState<(typeof TABS)[number]>('processing');
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [integration, setIntegration] = useState<IntegrationSummary | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [taxPolicy, setTaxPolicy] = useState<TaxPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SettlementItem | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const payload = await loadSettlements(tab);
        if (active) {
          setItems(payload.items ?? []);
          setIntegration(payload.integration ?? null);
          setSummary(payload.summary ?? null);
          setTaxPolicy(payload.taxPolicy ?? null);
        }
      } catch {
        if (active) {
          setItems([]);
          setIntegration(null);
          setSummary(null);
          setTaxPolicy(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [tab]);

  const selectedMapUrl = useMemo(() => (selected ? buildStaticMapUrl(selected) : ''), [selected]);

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">정산 운영</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            정산은 고객 결제, 플랫폼 수수료, 길러 세전 수익, 원천징수 3.3%, 실수령액을 분리해서 봐야 합니다.
            환불, 패널티, 본인 확인, 최종 지급 책임은 운영 검토가 마지막으로 마감합니다.
          </p>
        </section>

        {integration ? (
          <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  integration.paymentLiveReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {integration.paymentLiveReady ? 'PG live ready' : 'PG test/manual'}
              </span>
              <span className="text-amber-900">
                {integration.paymentProvider} / {integration.paymentStatusMessage}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  integration.bankLiveReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {integration.bankLiveReady ? 'Bank live ready' : 'Bank review/manual'}
              </span>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">settlement summary</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">정산 대상 금액</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard title="고객 결제" value={formatKRW(summary?.totalCustomerPaid ?? 0)} hint="고객이 실제로 결제한 총액" />
              <MetricCard title="플랫폼 수수료" value={formatKRW(summary?.totalPlatformFee ?? 0)} hint="플랫폼 기준 수수료 합계" />
              <MetricCard title="길러 세전 수익" value={formatKRW(summary?.totalGrossSettlement ?? 0)} hint="원천징수 전 기준 금액" />
              <MetricCard title="원천징수액" value={formatKRW(summary?.totalWithholdingTax ?? 0)} hint="사업소득 3.3% 반영 금액" />
              <MetricCard title="길러 실수령액" value={formatKRW(summary?.totalNetSettlement ?? 0)} hint="최종 지급 기준 금액" />
              <MetricCard
                title="세무 검토 필요"
                value={`${(summary?.taxReviewCount ?? 0) + (summary?.taxMissingCount ?? 0)}건`}
                hint="원천징수 계산 차이 또는 누락 검토가 필요한 건수"
              />
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">tax policy</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">사업소득 3.3% 처리 기준</h2>
            <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <PolicyRow label="사업소득세" value={taxPolicy ? `${(taxPolicy.businessIncomeRate * 100).toFixed(1)}%` : '-'} />
              <PolicyRow label="지방소득세" value={taxPolicy ? `${(taxPolicy.localIncomeTaxRate * 100).toFixed(1)}%` : '-'} />
              <PolicyRow label="합산 원천징수" value={taxPolicy?.combinedWithholdingPercentLabel ?? '-'} />
              <PolicyRow label="원천세 신고·납부" value={taxPolicy?.withholdingRemitDueRule ?? '-'} />
              <PolicyRow label="간이지급명세서" value={taxPolicy?.simpleStatementDueRule ?? '-'} />
              <PolicyRow label="종합소득세 안내" value={taxPolicy ? `다음 해 ${taxPolicy.annualFilingWindow}` : '-'} />
            </div>
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              {taxPolicy?.caution ?? '정산 정책과 세무 기준은 운영 검토를 함께 확인해야 합니다.'}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">individual payout</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">길러 개인 정산 기준</h3>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
              <li>개인 길러는 사업소득 원천징수 3.3%와 계좌 인증, 본인 확인, 분쟁 여부를 함께 검토합니다.</li>
              <li>취소와 분쟁이 남아 있는 건은 보증금 환급 또는 차감 판단과 같이 운영 검토를 거칩니다.</li>
              <li>최종 실수령액은 플랫폼 수수료, 교통비, 원천징수를 분리해서 계산합니다.</li>
            </ul>
          </div>

          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">enterprise legacy billing</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">기업고객 레거시 정산 기준</h3>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
              <li>기업고객 레거시는 개인 원천징수 정산과 분리해서 월 단위 청구, 세금계산서, 운영 확정 금액 흐름으로 관리합니다.</li>
              <li>기업 청구는 공급가액과 VAT를 명시하고, 개인 길러 3.3% 규칙을 그대로 적용하지 않습니다.</li>
              <li>외부 세무 API 연동 전까지는 운영 검토와 관리자 확인으로 처리합니다.</li>
            </ul>
          </div>
        </section>

        <section className="flex gap-2">
          {TABS.map((status) => (
            <button
              key={status}
              onClick={() => setTab(status)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === status
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {statusLabel(status)}
            </button>
          ))}
        </section>

        {loading ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            정산 로그를 불러오는 중입니다.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            해당 상태의 정산 내역이 없습니다.
          </div>
        ) : (
          <section className="overflow-x-auto rounded-[24px] border border-slate-100 bg-white shadow-sm">
            <table className="min-w-[1700px] w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">요청 ID</th>
                  <th className="px-4 py-3 text-left">길러 / 요청자</th>
                  <th className="px-4 py-3 text-right">고객 결제</th>
                  <th className="px-4 py-3 text-right">공급가액</th>
                  <th className="px-4 py-3 text-right">VAT</th>
                  <th className="px-4 py-3 text-right">교통비</th>
                  <th className="px-4 py-3 text-right">플랫폼 수수료</th>
                  <th className="px-4 py-3 text-right">세전 수익</th>
                  <th className="px-4 py-3 text-right">원천징수</th>
                  <th className="px-4 py-3 text-right">예상 세액</th>
                  <th className="px-4 py-3 text-right">실수령액</th>
                  <th className="px-4 py-3 text-left">정산 가드</th>
                  <th className="px-4 py-3 text-left">결제 / 계좌 상태</th>
                  <th className="px-4 py-3 text-left">지도</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-left">생성일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">{item.requestId.slice(0, 10)}...</td>
                    <td className="px-4 py-4">
                      <p className="font-mono text-xs text-slate-600">{item.gillerId?.slice(0, 10) || '-'}...</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{item.requesterId?.slice(0, 10) || '-'}...</p>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold">{formatMoney(item.customerPaidAmount)}</td>
                    <td className="px-4 py-4 text-right">{formatMoney(item.feeSupplyAmount)}</td>
                    <td className="px-4 py-4 text-right">{formatMoney(item.vatAmount)}</td>
                    <td className="px-4 py-4 text-right">{formatMoney(item.publicFareAmount)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-indigo-600">{formatMoney(item.platformFeeAmount)}</td>
                    <td className="px-4 py-4 text-right font-semibold">{formatMoney(item.gillerGrossAmount)}</td>
                    <td className="px-4 py-4 text-right text-rose-600">{formatMoney(item.gillerWithholdingTaxAmount)}</td>
                    <td className="px-4 py-4 text-right text-slate-500">{formatMoney(item.expectedWithholdingTaxAmount)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-emerald-700">{formatMoney(item.gillerNetAmount)}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            item.withholdingReviewStatus === 'ok'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.withholdingReviewStatus === 'review'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.withholdingReviewStatus === 'ok'
                            ? '세액 일치'
                            : item.withholdingReviewStatus === 'review'
                              ? '세액 검토 필요'
                              : '세액 누락 확인'}
                        </span>
                        <div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusColor(item.gillerIdentityStatus ?? 'not_submitted')}`}>
                            본인 확인 {statusLabel(item.gillerIdentityStatus ?? 'not_submitted')}
                          </span>
                        </div>
                        <div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusColor(item.gillerBankVerificationStatus ?? 'not_submitted')}`}>
                            계좌 {statusLabel(item.gillerBankVerificationStatus ?? 'not_submitted')}
                          </span>
                        </div>
                        {typeof item.taxDifference === 'number' && item.taxDifference !== 0 ? (
                          <p className="text-[11px] text-rose-600">차이 {formatKRW(Math.abs(item.taxDifference))}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2 text-xs">
                        <p className="font-medium text-slate-700">{item.paymentProvider ?? 'tosspayments'}</p>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 font-semibold ${
                            item.paymentConfigLiveReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.paymentConfigLiveReady ? 'PG ready' : 'PG test/manual'}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 font-semibold ${
                            item.bankConfigLiveReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.bankConfigLiveReady ? 'Bank ready' : 'Bank review'}
                        </span>
                        {item.paymentConfigTestMode ? <p className="text-amber-700">테스트 모드와 수동 마감을 병행합니다.</p> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setSelected(item)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        구간 보기
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">{item.createdAt ? formatDate(item.createdAt) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-[760px] max-w-[92vw] rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">정산 대상 요청 구간</h2>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-700">
                닫기
              </button>
            </div>
            {selectedMapUrl ? (
              <div className="space-y-4">
                <img
                  src={selectedMapUrl}
                  alt="정산 대상 요청 구간 지도"
                  className="h-64 w-full rounded-2xl object-cover"
                />
                <p className="text-sm leading-6 text-slate-500">
                  픽업지는 P, 도착지는 D로 표시됩니다. 취소/분쟁/정산 판단을 함께 볼 때 참고용으로 사용합니다.
                </p>
              </div>
            ) : (
              <div className="text-sm leading-6 text-slate-500">
                이 정산 건에는 아직 지도에 표시할 좌표가 없습니다. 요청 상세와 운영 메모를 함께 확인해 주세요.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ title, value, hint }: { title: string; value: string; hint: string }): JSX.Element {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p>
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="font-medium text-slate-900">{label}</span>
      <span className="max-w-[60%] text-right text-slate-600">{value}</span>
    </div>
  );
}
