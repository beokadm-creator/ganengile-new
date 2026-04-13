'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/beta1/ai-review', label: 'AI 관제', badge: 'new' },
  { href: '/integrations/ai', label: 'AI 설정', indent: true },
  { href: '/pricing/policy', label: '가격 정책', indent: true, badge: 'new' },
  { href: '/pricing/insights', label: '가격 인사이트', indent: true, badge: 'new' },
  { href: '/pricing/overrides', label: '구간 오버라이드', indent: true, badge: 'new' },
  { href: '/users', label: '사용자 관리' },
  { href: '/gillers/applications', label: '길러 심사 (통합)', indent: true },
  { href: '/integrations/identity', label: 'CI 설정', indent: true },
  { href: '/integrations/bank', label: '계좌 인증 설정', indent: true },
  { href: '/deliveries', label: '배송 운영' },
  { href: '/delayed-requests', label: '매칭 지연 요청', indent: true, badge: 'hot' },
  { href: '/lockers', label: '사물함 운영', indent: true },
  { href: '/b2b/dashboard', label: 'B2B 파트너 관리', badge: 'new' },
  { href: '/delivery-partners', label: '배송업체 관리', indent: true },
  { href: '/partner-dispatches', label: '업체 위임 현황', indent: true },
  { href: '/b2b/settlements', label: 'B2B 정산 내역', indent: true },
  { href: '/deposits', label: '보증금 운영' },
  { href: '/points/withdrawals', label: '출금 처리', badge: 'hot', indent: true },
  { href: '/coupons', label: '쿠폰 관리', badge: 'new' },
  { href: '/points/balances', label: '사용자 지갑', indent: true },
  { href: '/settlements', label: '정산' },
  { href: '/accounting', label: '재무/세무 리포트', badge: 'new' },
  { href: '/disputes', label: '분쟁 처리', badge: 'hot' },
  { href: '/integrations/payment', label: '결제 설정' },
  { href: '/integrations/fare-cache', label: '운임 캐시' },
  { href: '/consents', label: '약관 관리', badge: 'new' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 flex-col bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-5 py-5">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">ganengile ops</p>
        <h1 className="mt-2 text-lg font-bold">가는길에 관리자</h1>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ href, label, indent, badge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
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
