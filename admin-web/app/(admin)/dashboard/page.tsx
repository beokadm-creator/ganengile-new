'use client';
/* eslint-disable @typescript-eslint/no-unsafe-return */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

interface DashboardPayload {
  metrics: {
    pendingWithdrawals: number;
    pendingDisputes: number;
    pendingGillerApps: number;
    activeDeliveries: number;
    todayRequests: number;
    totalUsers: number;
    fareCount: number;
    fareLatestUpdatedAt?: string | null;
    lowConfidenceCount: number;
    manualReviewCount: number;
    reservationDraftCount: number;
    immediateDraftCount: number;
    criticalQueue: number;
  };
  integrations: {
    identity: IntegrationCardState;
    bank: IntegrationCardState;
    payment: IntegrationCardState;
    ai: IntegrationCardState & {
      model: string;
      disableThinking: boolean;
    };
  };
  onboarding: {
    identityPending: number;
    identityDoneBankPending: number;
    awaitingUpgradeReview: number;
    readyForUpgradeReview: number;
  };
  geo?: {
    recentMarkers: Array<{
      type: 'pickup' | 'dropoff';
      label: string;
      latitude: number;
      longitude: number;
    }>;
  };
}

interface IntegrationCardState {
  enabled: boolean;
  testMode: boolean;
  liveReady: boolean;
  statusMessage: string;
  provider: string;
}

interface Beta1Infrastructure {
  stationCatalog: {
    totalStations: number;
    stationsReady: boolean;
  };
  routing: {
    travelTimeEdges: number;
    expressLines: number;
    congestionLines: number;
  };
  beta1Engine: {
    requestDrafts: number;
    missions: number;
    deliveryLegs: number;
  };
  ai: {
    enabled: boolean;
    provider: string;
    model: string;
    disableThinking: boolean;
  };
}

interface Beta1AIReviewSummary {
  summary: {
    analysisCount: number;
    lowConfidenceCount: number;
    selectedQuoteCount: number;
    manualReviewCount: number;
    activeMissionCount: number;
    reservationDraftCount: number;
    immediateDraftCount: number;
  };
}

interface WarningItem {
  title: string;
  count: number;
  description: string;
  href: string;
  tone: 'critical' | 'warning' | 'neutral';
}

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }

  return (await response.json()) as T;
}

function getEnvString(value: string | undefined, fallback = ''): string {
  return value ?? fallback;
}

function getPublicEnv(name: string, fallback = ''): string {
  const env = process.env as Record<string, string | undefined>;
  return getEnvString(env[name], fallback);
}

function formatDateLabel(date: string | null | undefined): string {
  if (!date) return '-';
  const resolved = new Date(date);
  if (Number.isNaN(resolved.getTime())) return '-';

  return resolved.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getIntegrationBadge(integration?: IntegrationCardState): { label: string; className: string } {
  if (!integration?.enabled) {
    return { label: '비활성', className: 'bg-slate-100 text-slate-700' };
  }

  if (integration.testMode) {
    return { label: '테스트 모드', className: 'bg-amber-100 text-amber-700' };
  }

  if (integration.liveReady) {
    return { label: '실서비스 준비', className: 'bg-emerald-100 text-emerald-700' };
  }

  return { label: '준비 중', className: 'bg-sky-100 text-sky-700' };
}

function buildAdminStaticMapUrl(markers: Array<{ label: string; latitude: number; longitude: number }>): string {
  if (markers.length === 0) {
    return '';
  }

  const projectId = getPublicEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'ganengile');
  const region = getPublicEnv('NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION', 'us-central1');
  if (!projectId) {
    return '';
  }

  const center = markers[0];
  const query = new URLSearchParams({
    center: `${center.longitude},${center.latitude}`,
    level: '13',
    w: '900',
    h: '320',
    scale: '2',
    markers: markers
      .map((marker) => `${marker.longitude},${marker.latitude},${encodeURIComponent(marker.label)}`)
      .join('|'),
  });

  return `https://${region}-${projectId}.cloudfunctions.net/naverStaticMapProxy?${query.toString()}`;
}

export default function DashboardPage(): ReactElement {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [infra, setInfra] = useState<Beta1Infrastructure | null>(null);
  const [review, setReview] = useState<Beta1AIReviewSummary | null>(null);

  useEffect(() => {
    void Promise.all([
      loadJson<DashboardPayload>('/api/admin/dashboard'),
      loadJson<Beta1Infrastructure>('/api/admin/beta1-infrastructure'),
      loadJson<Beta1AIReviewSummary>('/api/admin/beta1-ai-review'),
    ])
      .then(([dashboardPayload, infrastructure, reviewSummary]) => {
        setDashboard(dashboardPayload);
        setInfra(infrastructure);
        setReview(reviewSummary);
      })
      .catch(() => {
        setDashboard(null);
        setInfra(null);
        setReview(null);
      });
  }, []);

  const serviceRisk = useMemo(() => {
    if (!dashboard) return 0;
    return (
      dashboard.metrics.pendingDisputes +
      dashboard.metrics.pendingWithdrawals +
      dashboard.metrics.manualReviewCount +
      dashboard.metrics.lowConfidenceCount
    );
  }, [dashboard]);

  const warnings = useMemo<WarningItem[]>(() => {
    if (!dashboard) return [];

    return [
      {
        title: '분쟁 대기',
        count: dashboard.metrics.pendingDisputes,
        description: '배송 취소 이후 조정, 환불, 책임 판단이 필요한 운영 개입 건입니다.',
        href: '/disputes',
        tone: dashboard.metrics.pendingDisputes > 0 ? 'critical' : 'neutral',
      },
      {
        title: '출금 대기',
        count: dashboard.metrics.pendingWithdrawals,
        description: '계좌 인증, 분쟁 여부, 운영 보류 체크가 필요한 출금 요청입니다.',
        href: '/points/withdrawals',
        tone: dashboard.metrics.pendingWithdrawals > 0 ? 'warning' : 'neutral',
      },
      {
        title: '수동 검토',
        count: dashboard.metrics.manualReviewCount,
        description: 'AI 단독 확정이 어려운 actor 선택, 환불, 보증금, 정산 개입 건입니다.',
        href: '/beta1/ai-review',
        tone: dashboard.metrics.manualReviewCount > 0 ? 'critical' : 'neutral',
      },
      {
        title: '길러 승급 병목',
        count: dashboard.metrics.pendingGillerApps,
        description: '공급 병목으로 이어질 수 있는 길러 승급 심사 대기 건입니다.',
        href: '/gillers/applications',
        tone: dashboard.metrics.pendingGillerApps > 0 ? 'warning' : 'neutral',
      },
      {
        title: '예약형 초안',
        count: dashboard.metrics.reservationDraftCount,
        description: '시간 약속과 번들 판단이 중요한 예약 요청입니다.',
        href: '/beta1/ai-review',
        tone: 'neutral',
      },
      {
        title: '즉시형 초안',
        count: dashboard.metrics.immediateDraftCount,
        description: '빠른 매칭, 가격 조정, fallback actor 판단이 필요한 요청입니다.',
        href: '/beta1/ai-review',
        tone: 'neutral',
      },
    ];
  }, [dashboard]);

  const aiMeta =
    dashboard?.integrations.ai != null
      ? `${dashboard.integrations.ai.provider} / ${dashboard.integrations.ai.model} / thinking ${
          dashboard.integrations.ai.disableThinking ? 'off' : 'on'
        }`
      : undefined;

  const fareUpdatedAt = formatDateLabel(dashboard?.metrics.fareLatestUpdatedAt);
  const operationsMapUrl = useMemo(
    () => buildAdminStaticMapUrl(dashboard?.geo?.recentMarkers ?? []),
    [dashboard?.geo?.recentMarkers]
  );

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-[#0f172a] px-7 py-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">operations</p>
          <h1 className="mt-3 text-3xl font-bold">운영 대시보드</h1>
          <div className="mt-5 flex flex-wrap gap-3">
            <QuickLink href="/beta1/ai-review" label="AI 관제" />
            <QuickLink href="/disputes" label="분쟁 처리" />
            <QuickLink href="/deposits" label="보증금 운영" />
            <QuickLink href="/settlements" label="정산 운영" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="오늘 요청" value={dashboard?.metrics.todayRequests ?? 0} hint="오늘 들어온 전체 요청 건수" tone="neutral" />
          <MetricCard title="활성 배송" value={dashboard?.metrics.activeDeliveries ?? 0} hint="현재 진행 중인 배송 건수" tone="positive" />
          <MetricCard title="운영 우선 순위" value={serviceRisk} hint="분쟁, 출금, 수동 검토, 저신뢰 분석을 합친 우선 확인 수치" tone="warning" />
          <MetricCard title="전체 사용자" value={dashboard?.metrics.totalUsers ?? 0} hint="현재 서비스 전체 가입자 수" tone="neutral" />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[24px] bg-white p-6 shadow-sm xl:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">warning panel</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">운영 경고</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {warnings.map((item) => (
                <WarningCard key={item.title} item={item} />
              ))}
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-6 shadow-sm xl:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">ops map</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">최근 요청 지도</h2>
            {operationsMapUrl ? (
              <img
                src={operationsMapUrl}
                alt="최근 요청 구간 지도"
                className="mt-5 h-64 w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="mt-5 rounded-2xl bg-slate-50 p-6 text-sm leading-6 text-slate-500">
                최근 요청 좌표가 아직 충분하지 않아 운영 지도를 표시하지 못하고 있습니다.
              </div>
            )}
          </div>

          <div className="rounded-[24px] bg-white p-6 shadow-sm xl:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">integration readiness</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">연동 상태</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <IntegrationTile title="본인 확인" integration={dashboard?.integrations.identity} href="/integrations/identity" />
              <IntegrationTile title="계좌 인증" integration={dashboard?.integrations.bank} href="/integrations/bank" />
              <IntegrationTile title="PG 결제" integration={dashboard?.integrations.payment} href="/integrations/payment" />
              <IntegrationTile title="AI 엔진" integration={dashboard?.integrations.ai} href="/integrations/ai" meta={aiMeta} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">upgrade funnel</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">승급 병목</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <MetricTile title="본인 확인 대기" value={`${dashboard?.onboarding.identityPending ?? 0}`} caption="CI/PASS 또는 테스트 우회 처리가 아직 끝나지 않은 사용자 수" />
              <MetricTile title="계좌 인증 대기" value={`${dashboard?.onboarding.identityDoneBankPending ?? 0}`} caption="본인 확인은 끝났지만 정산 계좌 준비가 남아 있는 사용자 수" />
              <MetricTile title="심사 준비 완료" value={`${dashboard?.onboarding.readyForUpgradeReview ?? 0}`} caption="운영 심사만 진행하면 되는 길러 후보 수" />
              <MetricTile title="승급 심사 대기" value={`${dashboard?.onboarding.awaitingUpgradeReview ?? 0}`} caption="요청은 들어왔지만 최종 결정이 남아 있는 상태" />
            </div>
            <div className="mt-5">
              <Link href="/gillers/applications" className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
                길러 승급 심사로 이동
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">beta1 infrastructure</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">엔진 상태</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <MetricTile
                title="역 카탈로그"
                value={`${infra?.stationCatalog.totalStations ?? 0}`}
                caption={infra?.stationCatalog.stationsReady ? '역 데이터가 준비된 상태입니다.' : '역 데이터 준비 상태를 다시 확인해야 합니다.'}
              />
              <MetricTile title="이동 시간 edge" value={`${infra?.routing.travelTimeEdges ?? 0}`} caption="라우팅 계산에 사용하는 이동 시간 데이터 수" />
              <MetricTile title="미션 / Leg" value={`${infra?.beta1Engine.missions ?? 0} / ${infra?.beta1Engine.deliveryLegs ?? 0}`} caption="beta1 미션과 delivery leg 추적 현황" />
              <MetricTile title="요금 캐시" value={`${dashboard?.metrics.fareCount ?? 0}`} caption={`마지막 갱신 ${fareUpdatedAt}`} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">decision memo</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">운영 메모</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <PrincipleCard
                title="즉시형과 예약형을 같은 요청 구조에서 판단합니다"
                body={`즉시형 ${dashboard?.metrics.immediateDraftCount ?? 0}건과 예약형 ${dashboard?.metrics.reservationDraftCount ?? 0}건이 같은 요청 구조에서 가격과 actor fallback 판단을 받습니다.`}
              />
              <PrincipleCard
                title="AI는 빠르게 제안하고 운영이 최종 마감합니다"
                body={`${review?.summary.analysisCount ?? 0}건의 최근 분석과 ${review?.summary.selectedQuoteCount ?? 0}건의 선택 이력이 보이지만, 환불·보증금·패널티·정산은 운영 검토가 마지막 책임입니다.`}
              />
              <PrincipleCard
                title="분쟁과 보증금은 같이 봐야 합니다"
                body={`현재 분쟁 ${dashboard?.metrics.pendingDisputes ?? 0}건, 출금 ${dashboard?.metrics.pendingWithdrawals ?? 0}건이 있어 보증금 환불·차감과 정산 판단을 함께 볼 필요가 있습니다.`}
              />
              <PrincipleCard
                title="테스트 모드는 연결 실패를 막기 위한 안전장치입니다"
                body="CI, 계좌 인증, PG, AI가 아직 실서비스 준비 전이어도 테스트 모드와 live-ready 상태를 분리해서 운영합니다."
              />
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">next moves</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">바로가기</h2>
            <div className="mt-5 space-y-4">
              <TaskCard title="beta1 AI 관제" body="저신뢰 분석, 선택된 견적, actor 결정, 활성 미션을 한 번에 확인합니다." href="/beta1/ai-review" />
              <TaskCard title="분쟁 처리" body="책임 주체, 보상 금액, 보증금 환불·차감 판단을 바로 진행합니다." href="/disputes" />
              <TaskCard title="보증금 운영" body="요청자 보호 환불과 길러 책임 차감을 운영 체크리스트로 마감합니다." href="/deposits" />
              <TaskCard title="정산 운영" body="개인 3.3% 정산과 B2B 월 청구를 다른 규칙으로 관리합니다." href="/settlements" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CompactCard title="활성 mission" value={`${review?.summary.activeMissionCount ?? 0}`} hint="현재 운영 추적이 필요한 mission 수" />
          <CompactCard title="AI 저신뢰" value={`${review?.summary.lowConfidenceCount ?? 0}`} hint="운영 검토 우선순위가 높은 분석 건수" />
          <CompactCard title="선택된 견적" value={`${review?.summary.selectedQuoteCount ?? 0}`} hint="최근 beta1 quote 중 실제 선택된 건수" />
          <CompactCard title="AI 상태" value={dashboard?.integrations.ai.enabled ? 'enabled' : 'disabled'} hint={`${dashboard?.integrations.ai.provider ?? 'unknown'} / ${dashboard?.integrations.ai.model ?? 'unknown'}`} />
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: number;
  hint: string;
  tone: 'neutral' | 'positive' | 'warning';
}): ReactElement {
  const toneClass = tone === 'positive' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-slate-900';

  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-3 text-4xl font-bold ${toneClass}`}>{value.toLocaleString()}</p>
      <p className="mt-3 text-sm leading-6 text-slate-500">{hint}</p>
    </div>
  );
}

function WarningCard({ item }: { item: WarningItem }): ReactElement {
  const toneClass =
    item.tone === 'critical'
      ? 'border-rose-200 bg-rose-50'
      : item.tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : 'border-slate-200 bg-stone-50';

  const countClass =
    item.tone === 'critical' ? 'text-rose-700' : item.tone === 'warning' ? 'text-amber-700' : 'text-slate-900';

  return (
    <Link href={item.href} className={`rounded-2xl border p-4 transition-colors hover:opacity-90 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
        </div>
        <span className={`text-2xl font-bold ${countClass}`}>{item.count}</span>
      </div>
    </Link>
  );
}

function IntegrationTile({
  title,
  integration,
  href,
  meta,
}: {
  title: string;
  integration?: IntegrationCardState;
  href: string;
  meta?: string;
}): ReactElement {
  const badge = getIntegrationBadge(integration);

  return (
    <Link href={href} className="rounded-2xl border border-slate-100 bg-stone-50 p-4 transition-colors hover:bg-stone-100">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{integration?.provider ?? 'unknown'}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{meta ?? integration?.statusMessage ?? '설정 상태를 확인해 주세요.'}</p>
    </Link>
  );
}

function MetricTile({ title, value, caption }: { title: string; value: string; caption: string }): ReactElement {
  return (
    <div className="rounded-2xl border border-slate-100 bg-stone-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{caption}</p>
    </div>
  );
}

function PrincipleCard({ title, body }: { title: string; body: string }): ReactElement {
  return (
    <div className="rounded-2xl border border-slate-100 bg-stone-50 p-4">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

function TaskCard({ title, body, href }: { title: string; body: string; href: string }): ReactElement {
  return (
    <Link href={href} className="block rounded-2xl border border-slate-100 bg-stone-50 p-4 transition-colors hover:bg-stone-100">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </Link>
  );
}

function CompactCard({ title, value, hint }: { title: string; value: string; hint: string }): ReactElement {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-500">{hint}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }): ReactElement {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
    >
      {label}
    </Link>
  );
}
