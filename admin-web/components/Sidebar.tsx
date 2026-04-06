'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: '운영',
    items: [
      { href: '/dashboard', label: '대시보드' },
      { href: '/beta1/ai-review', label: 'AI 관제' },
      { href: '/deliveries', label: '배송 운영' },
      { href: '/deposits', label: '보증금 운영' },
      { href: '/settlements', label: '정산' },
      { href: '/disputes', label: '분쟁 처리' },
    ],
  },
  {
    title: '회원',
    items: [
      { href: '/users', label: '사용자 관리' },
      { href: '/gillers/applications', label: '길러 승급' },
      { href: '/verifications', label: '본인 확인' },
      { href: '/points/withdrawals', label: '출금 처리' },
      { href: '/points/balances', label: '사용자 지갑' },
    ],
  },
  {
    title: '인프라',
    items: [
      { href: '/lockers', label: '사물함 운영' },
      { href: '/integrations/payment', label: '결제 설정' },
      { href: '/integrations/fare-cache', label: '운임 캐시' },
      { href: '/integrations/identity', label: 'CI/PASS 설정' },
      { href: '/integrations/bank', label: '계좌 인증 설정' },
      { href: '/integrations/ai', label: 'AI 설정' },
    ],
  },
  {
    title: '법무',
    items: [
      { href: '/consents', label: '약관 관리' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 flex-col bg-slate-950 text-white">
      <div className="border-b border-slate-800 px-5 py-5">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">ganengile ops</p>
        <h1 className="mt-2 text-lg font-bold">가는길에 관리자</h1>
      </div>

      <nav className="flex-1 space-y-6 px-3 py-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? 'bg-cyan-500/15 text-cyan-100'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
