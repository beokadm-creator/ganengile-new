'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: '📊 대시보드' },
  { href: '/users', label: '👥 사용자 관리' },
  { href: '/gillers/applications', label: '🔍 길러 심사', indent: true },
  { href: '/deliveries', label: '📦 배송 관리' },
  { href: '/points/withdrawals', label: '💸 출금 처리', badge: 'hot' },
  { href: '/points/balances', label: '💰 포인트 잔액' },
  { href: '/deposits', label: '🔒 보증금 관리' },
  { href: '/disputes', label: '⚖️ 분쟁 처리', badge: 'hot' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-4 py-5 border-b border-gray-700">
        <p className="text-xs text-gray-400">가는길에</p>
        <h1 className="text-lg font-bold">관리자</h1>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV.map(({ href, label, indent, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                indent ? 'ml-3' : ''
              } ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span>{label}</span>
              {badge === 'hot' && (
                <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">!</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-gray-700">
        <form action="/api/logout" method="POST">
          <button type="submit" className="text-xs text-gray-400 hover:text-white w-full text-left">
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
