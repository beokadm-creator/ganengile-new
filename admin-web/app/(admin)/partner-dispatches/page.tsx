'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDate, statusColor, statusLabel } from '@/lib/format';

type DispatchItem = {
  id: string;
  partnerId: string;
  partnerName: string;
  missionId: string;
  requestId: string;
  deliveryId: string;
  deliveryLegId: string;
  partnerCapability: string;
  dispatchMethod: string;
  status: string;
  opsMemo: string;
  createdAt: { seconds?: number; _seconds?: number; toDate?: () => Date } | string | null;
  updatedAt: { seconds?: number; _seconds?: number; toDate?: () => Date } | string | null;
  requestedAt: { seconds?: number; _seconds?: number; toDate?: () => Date } | string | null;
  acceptedAt: { seconds?: number; _seconds?: number; toDate?: () => Date } | string | null;
  completedAt: { seconds?: number; _seconds?: number; toDate?: () => Date } | string | null;
  rawResponse?: Record<string, unknown> | null;
};

const STATUS_OPTIONS = ['queued', 'requested', 'accepted', 'rejected', 'in_progress', 'completed', 'failed', 'cancelled'] as const;

export default function PartnerDispatchesPage() {
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selected, setSelected] = useState<DispatchItem | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [opsMemo, setOpsMemo] = useState('');

  useEffect(() => {
    void load();
  }, [selectedStatus]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      queued: items.filter((item) => item.status === 'queued' || item.status === 'requested').length,
      active: items.filter((item) => item.status === 'accepted' || item.status === 'in_progress').length,
      failed: items.filter((item) => item.status === 'failed' || item.status === 'rejected').length,
    };
  }, [items]);

  async function load() {
    setLoading(true);
    try {
      const query = selectedStatus ? `?status=${selectedStatus}` : '';
      const res = await fetch(`/api/admin/partner-dispatches${query}`);
      const json = (await res.json()) as { items?: DispatchItem[] };
      setItems(json.items ?? []);
      if (selected) {
        const nextSelected = (json.items ?? []).find((item) => item.id === selected.id) ?? null;
        setSelected(nextSelected);
        setOpsMemo(nextSelected?.opsMemo ?? '');
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(dispatchId: string, status: string) {
    setSaving(dispatchId);
    try {
      await fetch('/api/admin/partner-dispatches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchId, status, opsMemo: selected?.id === dispatchId ? opsMemo : '' }),
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
          <h1 className="text-2xl font-bold text-slate-900">외부 배송업체 위임 현황</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
            배송 오케스트레이션이 외부 배송업체로 넘긴 미션과 레그의 진행 상태를 운영자가 추적하고,
            수동 dispatch 흐름도 같은 보드에서 관리합니다.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Metric title="전체 위임" value={`${summary.total}건`} />
          <Metric title="대기 / 요청" value={`${summary.queued}건`} />
          <Metric title="진행 중" value={`${summary.active}건`} />
          <Metric title="실패 / 거절" value={`${summary.failed}건`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">위임 목록</h2>
                <p className="text-sm text-slate-500">mission 단위 external partner dispatch</p>
              </div>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">전체 상태</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-slate-400">불러오는 중...</div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">위임 이력이 없습니다.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">업체</th>
                      <th className="px-4 py-3 text-left">미션</th>
                      <th className="px-4 py-3 text-left">방식</th>
                      <th className="px-4 py-3 text-left">상태</th>
                      <th className="px-4 py-3 text-left">요청 시각</th>
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
                            }}
                            className="text-left"
                          >
                            <p className="font-semibold text-slate-900">{item.partnerName || item.partnerId}</p>
                            <p className="mt-1 font-mono text-[11px] text-slate-400">{item.partnerId}</p>
                          </button>
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-600">
                          <p>mission: {item.missionId || '-'}</p>
                          <p>request: {item.requestId || '-'}</p>
                          <p>capability: {item.partnerCapability || '-'}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-600">{item.dispatchMethod}</td>
                        <td className="px-4 py-4 align-top">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-500">
                          {formatDate(item.requestedAt ?? item.createdAt)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                setSelected(item);
                                setOpsMemo(item.opsMemo ?? '');
                              }}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              상세
                            </button>
                            <button
                              onClick={() => void updateStatus(item.id, 'accepted')}
                              disabled={saving === item.id}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              수락
                            </button>
                            <button
                              onClick={() => void updateStatus(item.id, 'failed')}
                              disabled={saving === item.id}
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                              실패
                            </button>
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
            <h2 className="text-lg font-bold text-slate-900">위임 상세</h2>
            <p className="mt-1 text-sm text-slate-500">상태 전이와 운영 메모를 함께 관리합니다.</p>

            {!selected ? (
              <div className="py-16 text-center text-sm text-slate-400">좌측에서 위임 건을 선택해 주세요.</div>
            ) : (
              <div className="mt-4 space-y-4">
                <Detail label="업체">{selected.partnerName || selected.partnerId}</Detail>
                <Detail label="상태">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(selected.status)}`}>
                    {statusLabel(selected.status)}
                  </span>
                </Detail>
                <Detail label="missionId">{selected.missionId || '-'}</Detail>
                <Detail label="requestId">{selected.requestId || '-'}</Detail>
                <Detail label="deliveryId">{selected.deliveryId || '-'}</Detail>
                <Detail label="deliveryLegId">{selected.deliveryLegId || '-'}</Detail>
                <Detail label="dispatchMethod">{selected.dispatchMethod || '-'}</Detail>
                <Detail label="requestedAt">{formatDate(selected.requestedAt)}</Detail>
                <Detail label="acceptedAt">{formatDate(selected.acceptedAt)}</Detail>
                <Detail label="completedAt">{formatDate(selected.completedAt)}</Detail>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    운영 메모
                  </label>
                  <textarea
                    value={opsMemo}
                    onChange={(event) => setOpsMemo(event.target.value)}
                    className="min-h-[100px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      onClick={() => void updateStatus(selected.id, status)}
                      disabled={saving === selected.id}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {selected.rawResponse ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      rawResponse
                    </label>
                    <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                      {JSON.stringify(selected.rawResponse, null, 2)}
                    </pre>
                  </div>
                ) : null}
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
