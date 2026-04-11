'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { statusColor, statusLabel } from '@/lib/format';

type DelayedRequestItem = {
  id: string;
  requesterId: string;
  matchedGillerId: string;
  status: string;
  beta1RequestStatus: string;
  requestMode: string;
  pickupStationName: string;
  deliveryStationName: string;
  createdAt: string | null;
  updatedAt: string | null;
  ageMinutes: number;
  feeTotal: number;
  opsPriority: string;
  opsMemo: string;
  opsLastReviewedAt: string | null;
};

const PRIORITY_OPTIONS = ['normal', 'watch', 'urgent'] as const;

function orchestrationStatusLabel(value: string): string {
  switch (value) {
    case 'match_pending':
      return '매칭 탐색 중';
    case 'accepted':
      return '배송 연결됨';
    case 'completed':
      return '완료';
    case 'cancelled':
      return '취소';
    default:
      return value || '-';
  }
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const resolved = new Date(value);
  if (Number.isNaN(resolved.getTime())) return '-';
  return resolved.toLocaleString('ko-KR');
}

export default function DelayedRequestsPage() {
  const [items, setItems] = useState<DelayedRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [thresholdMinutes, setThresholdMinutes] = useState(15);
  const [selected, setSelected] = useState<DelayedRequestItem | null>(null);
  const [opsMemo, setOpsMemo] = useState('');
  const [opsPriority, setOpsPriority] = useState<string>('normal');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((item) => item.status === 'pending').length,
      matched: items.filter((item) => item.status === 'matched').length,
      over30m: items.filter((item) => item.ageMinutes >= 30).length,
    }),
    [items],
  );

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/delayed-requests');
      const json = (await res.json()) as {
        items?: DelayedRequestItem[];
        thresholdMinutes?: number;
      };
      const nextItems = json.items ?? [];
      setItems(nextItems);
      setThresholdMinutes(json.thresholdMinutes ?? 15);
      if (selected) {
        const nextSelected = nextItems.find((item) => item.id === selected.id) ?? null;
        setSelected(nextSelected);
        setOpsMemo(nextSelected?.opsMemo ?? '');
        setOpsPriority(nextSelected?.opsPriority ?? 'normal');
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveOpsState() {
    if (!selected) return;

    setSaving(selected.id);
    try {
      await fetch('/api/admin/delayed-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selected.id,
          opsPriority,
          opsMemo,
        }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">매칭 지연 요청</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {thresholdMinutes}분 이상 `pending` 또는 `matched` 상태에 머문 요청입니다.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Metric title="전체 지연" value={`${summary.total}건`} />
          <Metric title="매칭 대기" value={`${summary.pending}건`} />
          <Metric title="부분 매칭" value={`${summary.matched}건`} />
          <Metric title="30분 이상" value={`${summary.over30m}건`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">지연 요청 목록</h2>
              <p className="text-sm text-slate-500">요청 상세와 AI 관제로 바로 이동할 수 있습니다.</p>
            </div>
            <button
              onClick={() => void load()}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              새로고침
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">지연 요청이 없습니다.</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">요청</th>
                    <th className="px-4 py-3 text-left">구간</th>
                    <th className="px-4 py-3 text-left">상태</th>
                    <th className="px-4 py-3 text-left">경과</th>
                    <th className="px-4 py-3 text-left">금액</th>
                    <th className="px-4 py-3 text-left">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 align-top">
                        <button
                          onClick={() => {
                            setSelected(item);
                            setOpsMemo(item.opsMemo ?? '');
                            setOpsPriority(item.opsPriority ?? 'normal');
                          }}
                          className="text-left"
                        >
                          <p className="font-semibold text-slate-900">{item.id}</p>
                          <p className="mt-1 text-xs text-slate-400">requester: {item.requesterId || '-'}</p>
                          <p className="mt-1 text-xs text-slate-400">giller: {item.matchedGillerId || '-'}</p>
                        </button>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-700">
                        <p>{item.pickupStationName}</p>
                        <p className="text-xs text-slate-400">to {item.deliveryStationName}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                        <p className="mt-2 text-xs text-slate-500">{orchestrationStatusLabel(item.beta1RequestStatus)}</p>
                        <p className="mt-1 text-xs text-slate-400">{item.requestMode === 'reservation' ? '예약' : '즉시'}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-700">
                        <p className="font-semibold">{item.ageMinutes}분</p>
                        <p className="mt-1 text-xs text-slate-400">{formatDate(item.createdAt)}</p>
                        <p className="mt-1 text-xs text-slate-400">priority: {item.opsPriority || 'normal'}</p>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-700">
                        {item.feeTotal > 0 ? `${item.feeTotal.toLocaleString()}원` : '-'}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href="/beta1/ai-review"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            AI 관제
                          </Link>
                          <Link
                            href={`/deliveries?requestId=${item.id}`}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            배송 운영
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>

          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">운영 메모</h2>
            <p className="mt-1 text-sm text-slate-500">우선순위와 처리 메모를 바로 남길 수 있습니다.</p>

            {!selected ? (
              <div className="py-16 text-center text-sm text-slate-400">좌측에서 요청을 선택해 주세요.</div>
            ) : (
              <div className="mt-4 space-y-4">
                <Detail label="요청 ID">{selected.id}</Detail>
                <Detail label="구간">
                  {selected.pickupStationName} to {selected.deliveryStationName}
                </Detail>
                <Detail label="현재 상태">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(selected.status)}`}>
                    {statusLabel(selected.status)}
                  </span>
                </Detail>
                <Detail label="경과 시간">{selected.ageMinutes}분</Detail>
                <Detail label="마지막 검토">{formatDate(selected.opsLastReviewedAt)}</Detail>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    우선순위
                  </label>
                  <select
                    value={opsPriority}
                    onChange={(event) => setOpsPriority(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    운영 메모
                  </label>
                  <textarea
                    value={opsMemo}
                    onChange={(event) => setOpsMemo(event.target.value)}
                    className="min-h-[140px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void saveOpsState()}
                    disabled={saving === selected.id}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    저장
                  </button>
                  <Link
                    href="/beta1/ai-review"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    AI 관제
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  );
}
