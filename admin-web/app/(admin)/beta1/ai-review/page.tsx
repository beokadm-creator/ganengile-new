'use client';

import { useEffect, useMemo, useState } from 'react';

type ReviewResponse = {
  summary: {
    analysisCount: number;
    lowConfidenceCount: number;
    selectedQuoteCount: number;
    manualReviewCount: number;
    activeMissionCount: number;
    reservationDraftCount: number;
    immediateDraftCount: number;
  };
  analyses: Array<{
    id: string;
    requestDraftId: string;
    provider: string;
    model: string;
    status: string;
    confidence: number;
    description: string;
    riskFlags: string[];
    createdAt: string | null;
  }>;
  drafts: Array<{
    id: string;
    status: string;
    requestMode: string;
    originName: string;
    destinationName: string;
    description: string;
    preferredPickupTime: string;
    preferredArrivalTime: string;
    updatedAt: string | null;
  }>;
  quotes: Array<{
    id: string;
    status: string;
    quoteType: string;
    speedLabel: string;
    requestMode: string;
    publicPrice: number;
    depositAmount: number;
    updatedAt: string | null;
  }>;
  decisions: Array<{
    id: string;
    selectedActorType: string;
    interventionLevel: string;
    manualReviewRequired: boolean;
    selectionReason: string;
    riskFlags: string[];
    createdAt: string | null;
  }>;
  missions: Array<{
    id: string;
    status: string;
    missionType: string;
    assignedGillerUserId: string;
    currentReward: number;
    updatedAt: string | null;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asReviewResponse(value: unknown): ReviewResponse | null {
  const record = asRecord(value);
  const summary = asRecord(record?.summary);
  if (!record || !summary) return null;

  return {
    summary: {
      analysisCount: readNumber(summary.analysisCount),
      lowConfidenceCount: readNumber(summary.lowConfidenceCount),
      selectedQuoteCount: readNumber(summary.selectedQuoteCount),
      manualReviewCount: readNumber(summary.manualReviewCount),
      activeMissionCount: readNumber(summary.activeMissionCount),
      reservationDraftCount: readNumber(summary.reservationDraftCount),
      immediateDraftCount: readNumber(summary.immediateDraftCount),
    },
    analyses: Array.isArray(record.analyses)
      ? record.analyses
          .map((item) => {
            const current = asRecord(item);
            if (!current || typeof current.id !== 'string') return null;
            return {
              id: current.id,
              requestDraftId: readString(current.requestDraftId),
              provider: readString(current.provider),
              model: readString(current.model),
              status: readString(current.status, 'unknown'),
              confidence: readNumber(current.confidence),
              description: readString(current.description),
              riskFlags: asStringArray(current.riskFlags),
              createdAt: readNullableString(current.createdAt),
            };
          })
          .filter((item): item is ReviewResponse['analyses'][number] => item !== null)
      : [],
    drafts: Array.isArray(record.drafts)
      ? record.drafts
          .map((item) => {
            const current = asRecord(item);
            if (!current || typeof current.id !== 'string') return null;
            return {
              id: current.id,
              status: readString(current.status, 'unknown'),
              requestMode: readString(current.requestMode, 'immediate'),
              originName: readString(current.originName),
              destinationName: readString(current.destinationName),
              description: readString(current.description),
              preferredPickupTime: readString(current.preferredPickupTime),
              preferredArrivalTime: readString(current.preferredArrivalTime),
              updatedAt: readNullableString(current.updatedAt),
            };
          })
          .filter((item): item is ReviewResponse['drafts'][number] => item !== null)
      : [],
    quotes: Array.isArray(record.quotes)
      ? record.quotes
          .map((item) => {
            const current = asRecord(item);
            if (!current || typeof current.id !== 'string') return null;
            return {
              id: current.id,
              status: readString(current.status, 'unknown'),
              quoteType: readString(current.quoteType),
              speedLabel: readString(current.speedLabel),
              requestMode: readString(current.requestMode, 'immediate'),
              publicPrice: readNumber(current.publicPrice),
              depositAmount: readNumber(current.depositAmount),
              updatedAt: readNullableString(current.updatedAt),
            };
          })
          .filter((item): item is ReviewResponse['quotes'][number] => item !== null)
      : [],
    decisions: Array.isArray(record.decisions)
      ? record.decisions
          .map((item) => {
            const current = asRecord(item);
            if (!current || typeof current.id !== 'string') return null;
            return {
              id: current.id,
              selectedActorType: readString(current.selectedActorType),
              interventionLevel: readString(current.interventionLevel),
              manualReviewRequired: Boolean(current.manualReviewRequired),
              selectionReason: readString(current.selectionReason),
              riskFlags: asStringArray(current.riskFlags),
              createdAt: readNullableString(current.createdAt),
            };
          })
          .filter((item): item is ReviewResponse['decisions'][number] => item !== null)
      : [],
    missions: Array.isArray(record.missions)
      ? record.missions
          .map((item) => {
            const current = asRecord(item);
            if (!current || typeof current.id !== 'string') return null;
            return {
              id: current.id,
              status: readString(current.status, 'unknown'),
              missionType: readString(current.missionType),
              assignedGillerUserId: readString(current.assignedGillerUserId),
              currentReward: readNumber(current.currentReward),
              updatedAt: readNullableString(current.updatedAt),
            };
          })
          .filter((item): item is ReviewResponse['missions'][number] => item !== null)
      : [],
  };
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function toneClass(status: string): string {
  if (status === 'low_confidence' || status === 'failed' || status === 'reassigning') {
    return 'bg-rose-100 text-rose-700';
  }
  if (status === 'selected' || status === 'accepted' || status === 'completed') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (status === 'queued' || status === 'presented' || status === 'ready_for_review' || status === 'pricing_ready') {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-slate-100 text-slate-700';
}

function modeBadgeClass(mode: string): string {
  return mode === 'reservation' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700';
}

export default function AIReviewPage() {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'analyses' | 'quotes' | 'decisions' | 'missions'>('analyses');

  useEffect(() => {
    void fetch('/api/admin/beta1-ai-review')
      .then(async (response) => {
        const json: unknown = await response.json();
        return asReviewResponse(json);
      })
      .then((json) => {
        setData(json);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const cards = useMemo(() => {
    if (!data) return [];

    return [
      { label: '즉시 요청', value: data.summary.immediateDraftCount },
      { label: '예약 요청', value: data.summary.reservationDraftCount },
      { label: '저신뢰 분석', value: data.summary.lowConfidenceCount },
      { label: '선택 견적', value: data.summary.selectedQuoteCount },
      { label: '수동 검토', value: data.summary.manualReviewCount },
      { label: '활성 미션', value: data.summary.activeMissionCount },
    ];
  }, [data]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">불러오는 중</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-rose-600">데이터를 불러오지 못했습니다.</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-slate-950 px-7 py-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">ai review</p>
          <h1 className="mt-3 text-3xl font-bold">AI 관제</h1>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className="rounded-[24px] bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{card.value.toLocaleString()}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <TabButton label="분석" active={tab === 'analyses'} onClick={() => setTab('analyses')} />
              <TabButton label="견적" active={tab === 'quotes'} onClick={() => setTab('quotes')} />
              <TabButton label="결정" active={tab === 'decisions'} onClick={() => setTab('decisions')} />
              <TabButton label="미션" active={tab === 'missions'} onClick={() => setTab('missions')} />
            </div>

            {tab === 'analyses' ? (
              <div className="mt-5 space-y-3">
                {data.analyses.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.description || '설명 없음'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.provider} / {item.model} / {item.requestDraftId || '-'}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>신뢰도 {(item.confidence * 100).toFixed(0)}%</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                    {item.riskFlags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.riskFlags.map((flag) => (
                          <span key={flag} className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
                            {flag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {tab === 'quotes' ? (
              <div className="mt-5 space-y-3">
                {data.quotes.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.speedLabel || item.quoteType}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(item.updatedAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${modeBadgeClass(item.requestMode)}`}>
                          {item.requestMode === 'reservation' ? '예약' : '즉시'}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                      <span>가격 {item.publicPrice.toLocaleString()}원</span>
                      <span>보증금 {item.depositAmount.toLocaleString()}원</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === 'decisions' ? (
              <div className="mt-5 space-y-3">
                {data.decisions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.selectedActorType || '-'} / {item.interventionLevel || '-'}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">{item.selectionReason || '사유 없음'}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.manualReviewRequired ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.manualReviewRequired ? '수동 검토' : '자동 보조'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === 'missions' ? (
              <div className="mt-5 space-y-3">
                {data.missions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.missionType || '미션'} / {item.status}</p>
                        <p className="mt-2 text-sm text-slate-600">길러 {item.assignedGillerUserId || '미배정'}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">보상 {item.currentReward.toLocaleString()}원</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">recent drafts</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">최근 요청</h2>
              <div className="mt-5 space-y-3">
                {data.drafts.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.originName} {'->'} {item.destinationName}
                      </p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${modeBadgeClass(item.requestMode)}`}>
                        {item.requestMode === 'reservation' ? '예약' : '즉시'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDate(item.updatedAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {label}
    </button>
  );
}
