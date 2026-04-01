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
    requesterUserId: string;
    status: string;
    requestMode: string;
    sourceRequestId: string;
    originName: string;
    destinationName: string;
    description: string;
    preferredPickupTime: string;
    preferredArrivalTime: string;
    selectedPricingQuoteId: string;
    aiAnalysisId: string;
    updatedAt: string | null;
  }>;
  quotes: Array<{
    id: string;
    requestDraftId: string;
    status: string;
    quoteType: string;
    speedLabel: string;
    requestMode: string;
    preferredPickupTime: string;
    preferredArrivalTime: string;
    publicPrice: number;
    depositAmount: number;
    pricingVersion: string;
    updatedAt: string | null;
  }>;
  decisions: Array<{
    id: string;
    requestId: string;
    deliveryId: string;
    selectedActorType: string;
    interventionLevel: string;
    manualReviewRequired: boolean;
    selectionReason: string;
    riskFlags: string[];
    createdAt: string | null;
  }>;
  missions: Array<{
    id: string;
    requestId: string;
    deliveryId: string;
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

function asReviewResponse(value: unknown): ReviewResponse | null {
  const record = asRecord(value);
  const summary = asRecord(record?.summary);
  if (!record || !summary) return null;

  const toAnalysis = (item: unknown) => {
    const current = asRecord(item);
    if (!current || typeof current.id !== 'string') return null;
    return {
      id: current.id,
      requestDraftId: typeof current.requestDraftId === 'string' ? current.requestDraftId : '',
      provider: typeof current.provider === 'string' ? current.provider : '',
      model: typeof current.model === 'string' ? current.model : '',
      status: typeof current.status === 'string' ? current.status : 'unknown',
      confidence: typeof current.confidence === 'number' ? current.confidence : 0,
      description: typeof current.description === 'string' ? current.description : '',
      riskFlags: asStringArray(current.riskFlags),
      createdAt: typeof current.createdAt === 'string' ? current.createdAt : null,
    };
  };

  const toDraft = (item: unknown) => {
    const current = asRecord(item);
    if (!current || typeof current.id !== 'string') return null;
    return {
      id: current.id,
      requesterUserId: typeof current.requesterUserId === 'string' ? current.requesterUserId : '',
      status: typeof current.status === 'string' ? current.status : 'unknown',
      requestMode: typeof current.requestMode === 'string' ? current.requestMode : 'immediate',
      sourceRequestId: typeof current.sourceRequestId === 'string' ? current.sourceRequestId : '',
      originName: typeof current.originName === 'string' ? current.originName : '',
      destinationName: typeof current.destinationName === 'string' ? current.destinationName : '',
      description: typeof current.description === 'string' ? current.description : '',
      preferredPickupTime:
        typeof current.preferredPickupTime === 'string' ? current.preferredPickupTime : '',
      preferredArrivalTime:
        typeof current.preferredArrivalTime === 'string' ? current.preferredArrivalTime : '',
      selectedPricingQuoteId:
        typeof current.selectedPricingQuoteId === 'string' ? current.selectedPricingQuoteId : '',
      aiAnalysisId: typeof current.aiAnalysisId === 'string' ? current.aiAnalysisId : '',
      updatedAt: typeof current.updatedAt === 'string' ? current.updatedAt : null,
    };
  };

  const toQuote = (item: unknown) => {
    const current = asRecord(item);
    if (!current || typeof current.id !== 'string') return null;
    return {
      id: current.id,
      requestDraftId: typeof current.requestDraftId === 'string' ? current.requestDraftId : '',
      status: typeof current.status === 'string' ? current.status : 'unknown',
      quoteType: typeof current.quoteType === 'string' ? current.quoteType : '',
      speedLabel: typeof current.speedLabel === 'string' ? current.speedLabel : '',
      requestMode: typeof current.requestMode === 'string' ? current.requestMode : 'immediate',
      preferredPickupTime:
        typeof current.preferredPickupTime === 'string' ? current.preferredPickupTime : '',
      preferredArrivalTime:
        typeof current.preferredArrivalTime === 'string' ? current.preferredArrivalTime : '',
      publicPrice: typeof current.publicPrice === 'number' ? current.publicPrice : 0,
      depositAmount: typeof current.depositAmount === 'number' ? current.depositAmount : 0,
      pricingVersion: typeof current.pricingVersion === 'string' ? current.pricingVersion : '',
      updatedAt: typeof current.updatedAt === 'string' ? current.updatedAt : null,
    };
  };

  const toDecision = (item: unknown) => {
    const current = asRecord(item);
    if (!current || typeof current.id !== 'string') return null;
    return {
      id: current.id,
      requestId: typeof current.requestId === 'string' ? current.requestId : '',
      deliveryId: typeof current.deliveryId === 'string' ? current.deliveryId : '',
      selectedActorType:
        typeof current.selectedActorType === 'string' ? current.selectedActorType : '',
      interventionLevel:
        typeof current.interventionLevel === 'string' ? current.interventionLevel : '',
      manualReviewRequired: Boolean(current.manualReviewRequired),
      selectionReason: typeof current.selectionReason === 'string' ? current.selectionReason : '',
      riskFlags: asStringArray(current.riskFlags),
      createdAt: typeof current.createdAt === 'string' ? current.createdAt : null,
    };
  };

  const toMission = (item: unknown) => {
    const current = asRecord(item);
    if (!current || typeof current.id !== 'string') return null;
    return {
      id: current.id,
      requestId: typeof current.requestId === 'string' ? current.requestId : '',
      deliveryId: typeof current.deliveryId === 'string' ? current.deliveryId : '',
      status: typeof current.status === 'string' ? current.status : 'unknown',
      missionType: typeof current.missionType === 'string' ? current.missionType : '',
      assignedGillerUserId:
        typeof current.assignedGillerUserId === 'string' ? current.assignedGillerUserId : '',
      currentReward: typeof current.currentReward === 'number' ? current.currentReward : 0,
      updatedAt: typeof current.updatedAt === 'string' ? current.updatedAt : null,
    };
  };

  return {
    summary: {
      analysisCount: typeof summary.analysisCount === 'number' ? summary.analysisCount : 0,
      lowConfidenceCount:
        typeof summary.lowConfidenceCount === 'number' ? summary.lowConfidenceCount : 0,
      selectedQuoteCount:
        typeof summary.selectedQuoteCount === 'number' ? summary.selectedQuoteCount : 0,
      manualReviewCount:
        typeof summary.manualReviewCount === 'number' ? summary.manualReviewCount : 0,
      activeMissionCount:
        typeof summary.activeMissionCount === 'number' ? summary.activeMissionCount : 0,
      reservationDraftCount:
        typeof summary.reservationDraftCount === 'number' ? summary.reservationDraftCount : 0,
      immediateDraftCount:
        typeof summary.immediateDraftCount === 'number' ? summary.immediateDraftCount : 0,
    },
    analyses: Array.isArray(record.analyses)
      ? record.analyses.map(toAnalysis).filter((item): item is NonNullable<ReturnType<typeof toAnalysis>> => item !== null)
      : [],
    drafts: Array.isArray(record.drafts)
      ? record.drafts.map(toDraft).filter((item): item is NonNullable<ReturnType<typeof toDraft>> => item !== null)
      : [],
    quotes: Array.isArray(record.quotes)
      ? record.quotes.map(toQuote).filter((item): item is NonNullable<ReturnType<typeof toQuote>> => item !== null)
      : [],
    decisions: Array.isArray(record.decisions)
      ? record.decisions.map(toDecision).filter((item): item is NonNullable<ReturnType<typeof toDecision>> => item !== null)
      : [],
    missions: Array.isArray(record.missions)
      ? record.missions.map(toMission).filter((item): item is NonNullable<ReturnType<typeof toMission>> => item !== null)
      : [],
  };
}

function formatDate(value: string | null) {
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

function toneClass(status: string) {
  if (status === 'low_confidence' || status === 'failed' || status === 'reassigning') {
    return 'bg-rose-100 text-rose-700';
  }
  if (status === 'selected' || status === 'accepted' || status === 'completed') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (
    status === 'queued' ||
    status === 'presented' ||
    status === 'ready_for_review' ||
    status === 'pricing_ready'
  ) {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-slate-100 text-slate-700';
}

function modeBadgeClass(mode: string) {
  return mode === 'reservation' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700';
}

export default function Beta1AIReviewPage() {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'analyses' | 'quotes' | 'decisions' | 'missions'>(
    'analyses'
  );

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

  const spotlight = useMemo(() => {
    if (!data) return [];

    return [
      {
        label: '즉시형 초안',
        value: data.summary.immediateDraftCount.toLocaleString(),
        hint: '지금 바로 연결을 목표로 만드는 요청 초안 수입니다.',
      },
      {
        label: '예약형 초안',
        value: data.summary.reservationDraftCount.toLocaleString(),
        hint: '시간 약속과 동선 최적화를 우선하는 예약 요청 초안 수입니다.',
      },
      {
        label: '저신뢰 분석',
        value: data.summary.lowConfidenceCount.toLocaleString(),
        hint: '운영자가 다시 봐야 하는 AI 분석 건수입니다.',
      },
      {
        label: '선택된 견적',
        value: data.summary.selectedQuoteCount.toLocaleString(),
        hint: '실제 요청으로 이어진 가격 제안 건수입니다.',
      },
      {
        label: '수동 검토',
        value: data.summary.manualReviewCount.toLocaleString(),
        hint: 'AI 단독 확정이 아니라 운영 검토가 필요한 actor 결정 건수입니다.',
      },
      {
        label: '활성 미션',
        value: data.summary.activeMissionCount.toLocaleString(),
        hint: '현재 관제가 필요한 mission 건수입니다.',
      },
    ];
  }, [data]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">beta1 AI 관제 데이터를 불러오는 중입니다.</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-rose-600">beta1 AI 관제 데이터를 불러오지 못했습니다.</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-slate-950 px-7 py-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
            beta1 ai review
          </p>
          <h1 className="mt-3 text-3xl font-bold">
            즉시형과 예약형을 같은 언어로 보는 beta1 AI 관제
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            운영자는 AI 분석, 가격 제안, actor 선택, mission 상태뿐 아니라 요청이 즉시형인지
            예약형인지까지 한 흐름으로 확인할 수 있습니다. 환불, 보증금 차감, 패널티, 본인 확인 완료,
            최종 정산은 여전히 운영 책임 영역입니다.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {spotlight.map((card) => (
            <div key={card.label} className="rounded-[24px] bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{card.value}</p>
              <p className="mt-3 text-sm leading-6 text-slate-500">{card.hint}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <TabButton label="분석" active={activeTab === 'analyses'} onClick={() => setActiveTab('analyses')} />
              <TabButton label="견적" active={activeTab === 'quotes'} onClick={() => setActiveTab('quotes')} />
              <TabButton label="actor 결정" active={activeTab === 'decisions'} onClick={() => setActiveTab('decisions')} />
              <TabButton label="미션" active={activeTab === 'missions'} onClick={() => setActiveTab('missions')} />
            </div>

            {activeTab === 'analyses' ? (
              <div className="mt-5 space-y-3">
                {data.analyses.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.description || '설명 없는 분석'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.provider} / {item.model} / draft {item.requestDraftId || '-'}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>신뢰도 {(item.confidence * 100).toFixed(0)}%</span>
                      <span>생성 {formatDate(item.createdAt)}</span>
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

            {activeTab === 'quotes' ? (
              <div className="mt-5 space-y-3">
                {data.quotes.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.speedLabel} / {item.quoteType}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.pricingVersion} / draft {item.requestDraftId || '-'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${modeBadgeClass(item.requestMode)}`}>
                          {item.requestMode === 'reservation' ? '예약형' : '즉시형'}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                      <span>가격 {item.publicPrice.toLocaleString()}원</span>
                      <span>보증금 {item.depositAmount.toLocaleString()}원</span>
                      <span>업데이트 {formatDate(item.updatedAt)}</span>
                    </div>
                    {item.preferredPickupTime ? (
                      <p className="mt-3 text-xs text-slate-500">
                        희망 출발 {item.preferredPickupTime}
                        {item.preferredArrivalTime ? ` / 희망 도착 ${item.preferredArrivalTime}` : ''}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === 'decisions' ? (
              <div className="mt-5 space-y-3">
                {data.decisions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.selectedActorType} / {item.interventionLevel}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          request {item.requestId || '-'} / delivery {item.deliveryId || '-'}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.manualReviewRequired ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.manualReviewRequired ? '수동 검토 필요' : '자동 보조'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.selectionReason || '선택 사유 없음'}</p>
                    {item.riskFlags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.riskFlags.map((flag) => (
                          <span key={flag} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                            {flag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === 'missions' ? (
              <div className="mt-5 space-y-3">
                {data.missions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.missionType} / {item.status}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          request {item.requestId || '-'} / delivery {item.deliveryId || '-'}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
                      <span>보상 {item.currentReward.toLocaleString()}원</span>
                      <span>길러 {item.assignedGillerUserId || '미배정'}</span>
                      <span>업데이트 {formatDate(item.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">recent drafts</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">요청 초안의 즉시형과 예약형 흐름</h2>
              <div className="mt-5 space-y-3">
                {data.drafts.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.originName} {'->'} {item.destinationName}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${modeBadgeClass(item.requestMode)}`}>
                          {item.requestMode === 'reservation' ? '예약형' : '즉시형'}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      analysis {item.aiAnalysisId || '-'} / quote {item.selectedPricingQuoteId || '-'} / {formatDate(item.updatedAt)}
                    </p>
                    {item.preferredPickupTime ? (
                      <p className="mt-2 text-xs text-slate-500">
                        희망 출발 {item.preferredPickupTime}
                        {item.preferredArrivalTime ? ` / 희망 도착 ${item.preferredArrivalTime}` : ''}
                      </p>
                    ) : null}
                    {item.sourceRequestId ? (
                      <p className="mt-2 text-xs text-slate-400">시작한 원본 request {item.sourceRequestId}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] bg-[#fff7d6] p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">operator guardrails</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">운영자 책임이 끝까지 남는 영역</h2>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                <li>환불, 보증금 차감, 패널티, 본인 확인 완료, 최종 정산은 AI가 단독 확정하지 않습니다.</li>
                <li>저신뢰 분석과 수동 검토 actor 결정은 운영자가 다시 보고 승인해야 합니다.</li>
                <li>즉시형은 SLA와 재매칭 리스크를, 예약형은 시간 약속과 동선 적합성을 우선 확인해야 합니다.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
