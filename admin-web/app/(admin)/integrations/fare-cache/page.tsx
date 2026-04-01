'use client';

import { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getClientAuth } from '@/lib/firebase-client';

type FareCacheStats = {
  totalCount: number;
  latestUpdatedAt: string | null;
  zeroFareCount: number;
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

  useEffect(() => {
    void loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);

    try {
      const response = await fetch('/api/admin/fare-cache');
      if (!response.ok) {
        setStats(null);
        setMessage('운임 캐시를 불러오지 못했습니다.');
        return;
      }

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
      const auth = getClientAuth();
      const functions = getFunctions(auth.app, 'asia-northeast3');
      const trigger = httpsCallable(functions, 'triggerFareCacheSync');
      const result = await trigger({});
      const data = result.data as
        | {
            success?: boolean;
            result?: {
              processedRoutes?: number;
              updatedRoutes?: number;
              skippedRoutes?: number;
              failedRoutes?: number;
              missingMappingRoutes?: number;
            };
          }
        | undefined;

      if (data?.success) {
        const summary = data.result;
        if (summary) {
          setMessage(
            `완료 · 처리 ${summary.processedRoutes ?? 0} · 갱신 ${summary.updatedRoutes ?? 0} · 건너뜀 ${
              summary.skippedRoutes ?? 0
            } · 실패 ${summary.failedRoutes ?? 0} · 매핑 누락 ${summary.missingMappingRoutes ?? 0}`
          );
        } else {
          setMessage('운임 캐시를 갱신했습니다.');
        }
        await loadStats();
      } else {
        setMessage('운임 캐시 갱신에 실패했습니다.');
      }
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : '알 수 없는 오류';
      setMessage(`오류 · ${messageText}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <section className="rounded-[24px] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">운임 캐시</h1>
            <p className="mt-2 text-sm text-slate-500">지하철 구간 운임 캐시 상태</p>
          </div>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {syncing ? '갱신 중' : '지금 갱신'}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="캐시 수"
          value={loading ? '...' : `${stats?.totalCount?.toLocaleString() ?? 0}`}
        />
        <StatCard label="마지막 갱신" value={loading ? '...' : formatDateLabel(stats?.latestUpdatedAt ?? null)} />
        <StatCard
          label="0원 항목"
          value={loading ? '...' : `${stats?.zeroFareCount?.toLocaleString() ?? 0}`}
          tone={(stats?.zeroFareCount ?? 0) > 0 ? 'warning' : 'default'}
        />
      </section>

      {message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            message.startsWith('오류') ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-bold ${tone === 'warning' ? 'text-rose-700' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}
