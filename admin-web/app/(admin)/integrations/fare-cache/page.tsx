'use client';

import { useEffect, useState } from 'react';

type FareCacheStats = {
  totalCount: number;
  latestUpdatedAt: string | null;
  zeroFareCount: number;
};

type SyncResponse = {
  ok?: boolean;
  error?: string;
  result?: {
    processedRoutes?: number;
    updatedRoutes?: number;
    skippedRoutes?: number;
    failedRoutes?: number;
    missingMappingRoutes?: number;
  };
};

function formatDateLabel(value: string | null): string {
  if (!value) return '없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '없음';
  return date.toLocaleString('ko-KR');
}

export default function FareCachePage() {
  const [stats, setStats] = useState<FareCacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/fare-cache');
      if (!response.ok) { setStats(null); setMessage('운임 캐시를 불러오지 못했습니다.'); return; }
      const json = (await response.json()) as FareCacheStats;
      setStats(json);
      setMessage(null);
    } catch {
      setStats(null);
      setMessage('운임 캐시를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/fare-cache', { method: 'POST' });
      const data = (await response.json()) as SyncResponse;
      if (response.ok && data.ok) {
        const summary = data.result;
        if (summary) {
          setMessage(`완료 · 처리 ${summary.processedRoutes ?? 0} · 갱신 ${summary.updatedRoutes ?? 0} · 건너뜀 ${summary.skippedRoutes ?? 0} · 실패 ${summary.failedRoutes ?? 0} · 매핑 누락 ${summary.missingMappingRoutes ?? 0}`);
        } else {
          setMessage('운임 캐시를 갱신했습니다.');
        }
        await loadStats();
      } else {
        setMessage(data.error ?? '운임 캐시 갱신에 실패했습니다.');
      }
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : '알 수 없는 오류';
      setMessage(`오류 · ${messageText}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-[#0f172a] px-7 py-8 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">infrastructure</p>
          <h1 className="mt-3 text-3xl font-bold">운임 캐시</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">지하철 구간 운임 캐시 상태를 확인하고 갱신합니다.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
            >
              {syncing ? '갱신 중...' : '지금 갱신'}
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">캐시 수</p>
            <p className="mt-3 text-4xl font-bold text-slate-900">{loading ? '...' : (stats?.totalCount?.toLocaleString() ?? 0)}</p>
            <p className="mt-3 text-sm text-slate-500">현재 저장된 구간 운임 수</p>
          </div>
          <div className="rounded-[24px] bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">마지막 갱신</p>
            <p className="mt-3 text-2xl font-bold text-slate-900">{loading ? '...' : formatDateLabel(stats?.latestUpdatedAt ?? null)}</p>
            <p className="mt-3 text-sm text-slate-500">최근 동기화 시각</p>
          </div>
          <div className="rounded-[24px] bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">0원 항목</p>
            <p className={`mt-3 text-4xl font-bold ${(stats?.zeroFareCount ?? 0) > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{loading ? '...' : (stats?.zeroFareCount?.toLocaleString() ?? 0)}</p>
            <p className="mt-3 text-sm text-slate-500">운임이 0원인 캐시 항목</p>
          </div>
        </section>

        {message ? (
          <div className={`rounded-2xl px-4 py-3 text-sm ${message.startsWith('오류') ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
