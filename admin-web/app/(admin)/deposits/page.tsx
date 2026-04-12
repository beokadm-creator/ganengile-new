'use client';

import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import Image from 'next/image';
import { formatDate, formatKRW, statusColor, statusLabel } from '@/lib/format';

type DepositTab = 'paid' | 'refunded' | 'deducted';

interface DepositItem {
  id: string;
  userId: string;
  requestId: string;
  depositAmount: number;
  pointAmount?: number;
  tossAmount?: number;
  paymentMethod: string;
  status: string;
  createdAt: { seconds: number } | string;
  geo?: {
    pickup?: { stationName?: string; lat?: number; lng?: number };
    dropoff?: { stationName?: string; lat?: number; lng?: number };
  } | null;
}

interface DepositListResponse {
  items?: DepositItem[];
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  point_only: '포인트 전액',
  mixed: '포인트 + 결제',
  toss_only: '외부 결제 전액',
};

function isDepositListResponse(value: unknown): value is DepositListResponse {
  return typeof value === 'object' && value !== null;
}

async function loadDeposits(status: DepositTab): Promise<DepositItem[]> {
  const response = await fetch(`/api/admin/deposits?status=${status}`);
  const json: unknown = await response.json();
  if (!isDepositListResponse(json) || !Array.isArray(json.items)) {
    return [];
  }
  return json.items;
}

function buildStaticMapUrl(item: DepositItem): string {
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

export default function DepositsPage(): JSX.Element {
  const [tab, setTab] = useState<DepositTab>('paid');
  const [items, setItems] = useState<DepositItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selected, setSelected] = useState<DepositItem | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const nextItems = await loadDeposits(tab);
        if (active) {
          setItems(nextItems);
        }
      } catch {
        if (active) {
          setItems([]);
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

  const summary = useMemo(
    () => ({
      totalCount: items.length,
      totalAmount: items.reduce((sum, item) => sum + item.depositAmount, 0),
      pointPortion: items.reduce((sum, item) => sum + (item.pointAmount ?? 0), 0),
      externalPortion: items.reduce((sum, item) => sum + (item.tossAmount ?? 0), 0),
    }),
    [items]
  );

  const selectedMapUrl = useMemo(() => (selected ? buildStaticMapUrl(selected) : ''), [selected]);

  async function handleAction(depositId: string, action: 'refund' | 'deduct'): Promise<void> {
    const confirmed = window.confirm(
      action === 'refund'
        ? '이 보증금을 환급할까요? 포인트 사용분이 있으면 함께 되돌립니다.'
        : '이 보증금을 차감할까요? 분쟁/패널티 판단이 끝난 뒤에만 진행해 주세요.'
    );

    if (!confirmed) return;

    setProcessing(depositId);
    try {
      await fetch('/api/admin/deposits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId, action }),
      });
      setItems(await loadDeposits(tab));
      if (selected?.id === depositId) {
        setSelected(null);
      }
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">deposit operations</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">보증금 운영</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            보증금은 취소, 분쟁, 패널티 판단과 연결됩니다. 환급은 요청자 보호 기준, 차감은 길러 책임과
            분쟁 판정 기준으로 처리해야 하므로 운영 메모와 요청 맥락을 함께 확인해야 합니다.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard title="현재 목록" value={`${summary.totalCount}건`} hint="현재 탭 기준 보증금 건수" />
          <MetricCard title="보증금 합계" value={formatKRW(summary.totalAmount)} hint="보유/환급/차감 상태별 합계" />
          <MetricCard title="포인트 사용분" value={formatKRW(summary.pointPortion)} hint="환급 시 포인트로 돌려줄 금액" />
          <MetricCard title="외부 결제분" value={formatKRW(summary.externalPortion)} hint="PG/외부 결제로 처리된 금액" />
        </section>

        <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900 shadow-sm">
          환급 전 체크: 픽업 전 취소인지, 분쟁 판정에서 요청자 보호가 맞는지, 포인트와 외부 결제를 함께 돌려야 하는지.
          차감 전 체크: 길러 책임이 확정됐는지, 패널티와 중복 차감이 아닌지, 운영 메모가 충분한지.
        </section>

        <section className="flex gap-2">
          {(['paid', 'refunded', 'deducted'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setTab(status)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === status
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {status === 'paid' ? '보관 중' : status === 'refunded' ? '환급 완료' : '차감 완료'}
            </button>
          ))}
        </section>

        {loading ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            보증금 목록을 불러오는 중입니다.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            현재 상태의 보증금이 없습니다.
          </div>
        ) : (
          <section className="overflow-x-auto rounded-[24px] border border-slate-100 bg-white shadow-sm">
            <table className="min-w-[1280px] w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">길러 UID</th>
                  <th className="px-4 py-3 text-left">요청 ID</th>
                  <th className="px-4 py-3 text-right">보증금</th>
                  <th className="px-4 py-3 text-right">포인트</th>
                  <th className="px-4 py-3 text-right">외부 결제</th>
                  <th className="px-4 py-3 text-left">결제 방식</th>
                  <th className="px-4 py-3 text-left">생성 시각</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-left">지도</th>
                  <th className="px-4 py-3 text-left">조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">{item.userId.slice(0, 12) || '-'}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">{item.requestId.slice(0, 12) || '-'}</td>
                    <td className="px-4 py-4 text-right font-semibold">{formatKRW(item.depositAmount)}</td>
                    <td className="px-4 py-4 text-right text-slate-600">{formatKRW(item.pointAmount ?? 0)}</td>
                    <td className="px-4 py-4 text-right text-slate-600">{formatKRW(item.tossAmount ?? 0)}</td>
                    <td className="px-4 py-4 text-slate-600">{PAYMENT_METHOD_LABEL[item.paymentMethod] ?? item.paymentMethod}</td>
                    <td className="px-4 py-4 text-slate-500">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
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
                      {tab === 'paid' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleAction(item.id, 'refund')}
                            disabled={processing === item.id}
                            className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                          >
                            환급
                          </button>
                          <button
                            onClick={() => void handleAction(item.id, 'deduct')}
                            disabled={processing === item.id}
                            className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-50"
                          >
                            차감
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">기록만 확인</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">deposit review</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">보증금 요청 구간 확인</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-sm text-slate-500 hover:text-slate-700">
                닫기
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoCard label="요청 ID" value={selected.requestId} mono />
              <InfoCard label="길러 UID" value={selected.userId} mono />
              <InfoCard label="보증금" value={formatKRW(selected.depositAmount)} />
              <InfoCard label="결제 방식" value={PAYMENT_METHOD_LABEL[selected.paymentMethod] ?? selected.paymentMethod} />
            </div>

            {selectedMapUrl ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">route context</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">보증금 대상 요청 구간 지도</h3>
                <div className="mt-4 relative h-56 w-full overflow-hidden rounded-2xl">
                  <Image
                    src={selectedMapUrl}
                    alt="보증금 대상 요청 구간 지도"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  픽업지는 P, 도착지는 D로 표시됩니다. 환급과 차감을 결정할 때 취소 시점과 경로 맥락을 함께 확인합니다.
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                이 요청에는 아직 지도에 표시할 좌표가 없습니다. 분쟁/취소 이력과 운영 메모를 함께 확인해 주세요.
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
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

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-sm text-slate-700 ${mono ? 'font-mono' : ''}`}>{value || '-'}</p>
    </div>
  );
}
