'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: '운영 대시보드' },
  { href: '/beta1/ai-review', label: 'beta1 AI 관제', badge: 'new' },
  { href: '/integrations/ai', label: 'AI 설정', indent: true },
  { href: '/users', label: '사용자 관리' },
  { href: '/gillers/applications', label: '길러 승급 요청', indent: true },
  { href: '/verifications', label: '본인 확인', indent: true },
  { href: '/integrations/identity', label: 'CI 인증 설정', indent: true },
  { href: '/integrations/bank', label: '계좌 인증 설정', indent: true },
  { href: '/deliveries', label: '배송 운영' },
  { href: '/lockers', label: '사물함 운영', indent: true },
  { href: '/deposits', label: '보증금 운영', indent: true },
  { href: '/points/withdrawals', label: '출금 처리', badge: 'hot' },
  { href: '/points/balances', label: '사용자 지갑' },
  { href: '/settlements', label: '정산 로그' },
  { href: '/disputes', label: '분쟁 처리', badge: 'hot' },
  { href: '/integrations/payment', label: '결제 설정' },
  { href: '/integrations/fare-cache', label: '운임 캐시' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 flex-col bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-5 py-5">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">ganengile ops</p>
        <h1 className="mt-2 text-lg font-bold">관리자 콘솔</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          beta1 엔진, 운영 리스크, 정산 흐름을 한 화면에서 확인합니다.
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ href, label, indent, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                indent ? 'ml-3' : ''
              } ${
                active
                  ? 'bg-cyan-500/15 text-cyan-100'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <span>{label}</span>
              {badge ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    badge === 'hot' ? 'bg-rose-500 text-white' : 'bg-cyan-500 text-slate-950'
                  }`}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-5 py-4">
        <form action="/api/logout" method="POST">
          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-900 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
