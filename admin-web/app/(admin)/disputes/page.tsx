'use client';

import type { ChangeEvent, JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { formatDate, formatKRW, statusColor, statusLabel } from '@/lib/format';

type DisputeStatusTab = 'pending' | 'resolved';
type Responsibility = 'giller' | 'requester' | 'system';

interface DisputeItem {
  id: string;
  reporterId: string;
  reporterType: 'requester' | 'giller';
  requestId: string;
  type: 'damage' | 'loss' | 'quality' | 'delay' | 'other';
  description: string;
  photoUrls: string[];
  status: string;
  createdAt: { seconds: number } | string;
  resolution?: {
    responsibility: Responsibility;
    compensation: number;
    note: string;
  };
  geo?: {
    pickup?: {
      stationName?: string;
      lat?: number;
      lng?: number;
    };
    dropoff?: {
      stationName?: string;
      lat?: number;
      lng?: number;
    };
  } | null;
}

interface DisputeListResponse {
  items?: DisputeItem[];
}

interface DisputeFormState {
  responsibility: Responsibility;
  compensation: string;
  note: string;
}

const DISPUTE_TYPE_LABEL: Record<DisputeItem['type'], string> = {
  damage: '파손',
  loss: '분실',
  quality: '품질 문제',
  delay: '지연',
  other: '기타',
};

const REPORTER_LABEL: Record<DisputeItem['reporterType'], string> = {
  requester: '요청자',
  giller: '길러',
};

const RESPONSIBILITY_LABEL: Record<Responsibility, string> = {
  giller: '길러 책임',
  requester: '요청자 책임',
  system: '시스템/운영 책임',
};

function isDisputeListResponse(value: unknown): value is DisputeListResponse {
  return typeof value === 'object' && value !== null;
}

async function loadDisputes(status: DisputeStatusTab): Promise<DisputeItem[]> {
  const response = await fetch(`/api/admin/disputes?status=${status}`);
  const json: unknown = await response.json();
  if (!isDisputeListResponse(json) || !Array.isArray(json.items)) {
    return [];
  }
  return json.items;
}

function buildStaticMapUrl(item: DisputeItem): string {
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

export default function DisputesPage(): JSX.Element {
  const [tab, setTab] = useState<DisputeStatusTab>('pending');
  const [items, setItems] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DisputeItem | null>(null);
  const [form, setForm] = useState<DisputeFormState>({
    responsibility: 'giller',
    compensation: '',
    note: '',
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const nextItems = await loadDisputes(tab);
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
      total: items.length,
      photoEvidence: items.filter((item) => item.photoUrls.length > 0).length,
      compensationTotal: items.reduce((sum, item) => sum + (item.resolution?.compensation ?? 0), 0),
    }),
    [items]
  );

  const selectedMapUrl = useMemo(() => (selected ? buildStaticMapUrl(selected) : ''), [selected]);

  function updateForm<K extends keyof DisputeFormState>(key: K, value: DisputeFormState[K]): void {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleResponsibilityChange(event: ChangeEvent<HTMLSelectElement>): void {
    updateForm('responsibility', event.target.value as Responsibility);
  }

  function handleCompensationChange(event: ChangeEvent<HTMLInputElement>): void {
    updateForm('compensation', event.target.value);
  }

  function handleNoteChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    updateForm('note', event.target.value);
  }

  async function handleResolve(): Promise<void> {
    if (!selected) return;

    setProcessing(true);
    try {
      await fetch('/api/admin/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: selected.id,
          responsibility: form.responsibility,
          compensation: Number(form.compensation) || 0,
          note: form.note,
        }),
      });

      setSelected(null);
      setForm({
        responsibility: 'giller',
        compensation: '',
        note: '',
      });
      setItems(await loadDisputes(tab));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">dispute operations</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">분쟁 처리</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            배송 취소 이후 조정이 필요하거나 파손, 분실, 지연 이슈가 접수되면 이 화면에서 증빙과 책임 주체,
            보상 금액을 함께 판단합니다. 환불과 보증금 차감은 운영 결정 이후 반영되는 흐름입니다.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard title="현재 목록" value={`${summary.total}건`} hint="현재 탭에 표시된 분쟁 건수" />
          <MetricCard title="사진 증빙 포함" value={`${summary.photoEvidence}건`} hint="즉시 검토 가능한 사진 증빙 보유 건수" />
          <MetricCard title="누적 보상액" value={formatKRW(summary.compensationTotal)} hint="해결된 건 기준 보상 금액" />
        </section>

        <section className="flex gap-2">
          {(['pending', 'resolved'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setTab(status)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === status
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {status === 'pending' ? '처리 대기' : '처리 완료'}
            </button>
          ))}
        </section>

        {loading ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            분쟁 목록을 불러오는 중입니다.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm">
            현재 상태의 분쟁이 없습니다.
          </div>
        ) : (
          <section className="overflow-x-auto rounded-[24px] border border-slate-100 bg-white shadow-sm">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">요청 ID</th>
                  <th className="px-4 py-3 text-left">신고자</th>
                  <th className="px-4 py-3 text-left">분쟁 유형</th>
                  <th className="px-4 py-3 text-left">내용 요약</th>
                  <th className="px-4 py-3 text-left">증빙</th>
                  <th className="px-4 py-3 text-left">접수 시각</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-left">조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-mono text-xs text-slate-600">{item.requestId.slice(0, 12)}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <span className="inline-flex rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                          {REPORTER_LABEL[item.reporterType]}
                        </span>
                        <p className="font-mono text-[11px] text-slate-500">{item.reporterId.slice(0, 12)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                        {DISPUTE_TYPE_LABEL[item.type]}
                      </span>
                    </td>
                    <td className="max-w-[320px] px-4 py-4 text-slate-600">{item.description}</td>
                    <td className="px-4 py-4 text-slate-500">
                      {item.photoUrls.length > 0 ? `${item.photoUrls.length}건` : '없음'}
                    </td>
                    <td className="px-4 py-4 text-slate-500">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setSelected(item)}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        {tab === 'pending' ? '판정하기' : '상세 보기'}
                      </button>
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
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">dispute review</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">분쟁 판정</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-sm text-slate-500 hover:text-slate-700">
                닫기
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoCard label="요청 ID" value={selected.requestId} mono />
              <InfoCard label="신고자" value={REPORTER_LABEL[selected.reporterType]} />
              <InfoCard label="분쟁 유형" value={DISPUTE_TYPE_LABEL[selected.type]} />
              <InfoCard label="사진 증빙" value={selected.photoUrls.length > 0 ? `${selected.photoUrls.length}건` : '없음'} />
            </div>

            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              취소 이후 배송 진행과 충돌한 건인지, 보증금 환불 또는 차감이 필요한지, 길러 패널티를 별도로 반영해야 하는지 함께 판단해 주세요.
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">reported detail</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{selected.description}</p>
              {selected.photoUrls.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.photoUrls.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-700 hover:border-cyan-200"
                    >
                      증빙 사진 {index + 1}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            {selectedMapUrl ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">route context</p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">분쟁 요청 구간 지도</h3>
                <div className="mt-4 relative h-56 w-full overflow-hidden rounded-2xl">
                  <Image
                    src={selectedMapUrl}
                    alt="분쟁 요청 구간 지도"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  픽업지는 P, 도착지는 D로 표시됩니다. 취소 시점과 분쟁 책임을 함께 판단할 때 참고용으로 사용합니다.
                </p>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                책임 주체
                <select
                  value={form.responsibility}
                  onChange={handleResponsibilityChange}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="giller">길러 책임</option>
                  <option value="requester">요청자 책임</option>
                  <option value="system">시스템/운영 책임</option>
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                보상 금액
                <input
                  type="number"
                  value={form.compensation}
                  onChange={handleCompensationChange}
                  placeholder="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              운영 메모
              <textarea
                rows={4}
                value={form.note}
                onChange={handleNoteChange}
                placeholder="보증금 환불, 차감, 재매칭, 패널티 조정 판단 근거를 적어 주세요."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>

            {selected.resolution ? (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                기존 판정: {RESPONSIBILITY_LABEL[selected.resolution.responsibility]} / 보상{' '}
                {formatKRW(selected.resolution.compensation)} / 메모 {selected.resolution.note || '없음'}
              </div>
            ) : null}

            <div className="mt-6 flex gap-2">
              {tab === 'pending' ? (
                <button
                  onClick={() => void handleResolve()}
                  disabled={processing}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {processing ? '판정 반영 중...' : '판정 반영'}
                </button>
              ) : null}
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
