import Link from 'next/link';

type Beta1AreaCard = {
  title: string;
  description: string;
  href?: string;
  status: 'live' | 'planned';
};

const beta1Areas: Beta1AreaCard[] = [
  {
    title: 'AI Review',
    description: 'AI 분석, 가격 제안, 수동 검토가 필요한 요청을 운영 기준으로 확인합니다.',
    href: '/beta1/ai-review',
    status: 'live',
  },
  {
    title: 'Request Drafts',
    description: '초안 상태와 제출 전 병목을 점검하는 전용 운영 화면 확장 후보입니다.',
    status: 'planned',
  },
  {
    title: 'Pricing Quotes',
    description: '견적 선택률, fallback 비중, quote 품질을 추적하는 전용 운영 화면 확장 후보입니다.',
    status: 'planned',
  },
  {
    title: 'Missions',
    description: 'mission 재배정, reward 변동, handover 병목을 전담 운영 화면으로 분리할 후보입니다.',
    status: 'planned',
  },
];

function badgeClass(status: Beta1AreaCard['status']): string {
  return status === 'live'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-100 text-slate-700';
}

export default function Beta1OverviewPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
              Beta1 Ops
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">beta1 운영 허브</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              현재 운영 가능한 beta1 영역과 다음 확장 후보를 한곳에서 확인할 수 있도록
              정리한 시작 화면입니다.
            </p>
          </div>
          <Link
            href="/beta1/ai-review"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            AI Review 열기
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {beta1Areas.map((area) => {
          const cardBody = (
            <article className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900">{area.title}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(area.status)}`}>
                  {area.status === 'live' ? '운영 중' : '확장 후보'}
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-600">{area.description}</p>
              <p className="mt-auto text-sm font-medium text-slate-500">
                {area.href ? '바로 진입 가능' : '현재는 운영 범위 설명만 제공'}
              </p>
            </article>
          );

          return area.href ? (
            <Link key={area.title} href={area.href} className="block">
              {cardBody}
            </Link>
          ) : (
            <div key={area.title}>{cardBody}</div>
          );
        })}
      </section>
    </div>
  );
}
