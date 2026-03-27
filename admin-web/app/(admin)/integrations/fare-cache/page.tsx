'use client';

import { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getClientAuth } from '@/lib/firebase-client';

type FareCacheStats = {
  totalCount: number;
  latestUpdatedAt: string | null;
  zeroFareCount: number;
};

export default function FareCachePage() {
  const [stats, setStats] = useState<FareCacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    void loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/fare-cache');
      if (res.ok) {
        const json = await res.json();
        setStats(json);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const auth = getClientAuth();
      const app = auth.app;
      const functions = getFunctions(app, 'asia-northeast3');
      const trigger = httpsCallable(functions, 'triggerFareCacheSync');
      const result = await trigger({});
      const data = result.data as { success: boolean; result?: Record<string, unknown> };
      if (data?.success) {
        const r = data.result as Record<string, number> | undefined;
        setSyncResult(
          r
            ? `완료: 처리 ${r.processedRoutes}건 / 갱신 ${r.updatedRoutes}건 / 스킵 ${r.skippedRoutes}건 / 실패 ${r.failedRoutes}건 / 매핑 누락 ${r.missingMappingRoutes}건`
            : '운임 캐시 갱신 완료'
        );
        await loadStats();
      } else {
        setSyncResult('갱신 실패 — 결과를 확인하세요');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncResult(`오류: ${msg}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 600 }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem' }}>운임 캐시 관리</h1>
      <p style={{ color: '#555', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <code>config_fares</code> 컬렉션 현황을 확인하고 수동으로 운임 캐시를 갱신합니다.
        매주 월요일 03:00에 자동 갱신됩니다.
      </p>

      {loading ? (
        <p>불러오는 중...</p>
      ) : stats ? (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '1.5rem' }}>
          <tbody>
            <tr>
              <td style={tdStyle}>캐시 항목 수</td>
              <td style={tdStyle}><strong>{stats.totalCount.toLocaleString()}건</strong></td>
            </tr>
            <tr>
              <td style={tdStyle}>마지막 갱신</td>
              <td style={tdStyle}>
                {stats.latestUpdatedAt
                  ? new Date(stats.latestUpdatedAt).toLocaleString('ko-KR')
                  : '없음'}
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>운임 0원 항목</td>
              <td style={{ ...tdStyle, color: stats.zeroFareCount > 0 ? '#d32f2f' : '#388e3c' }}>
                {stats.zeroFareCount}건
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p style={{ color: '#d32f2f' }}>통계를 불러올 수 없습니다.</p>
      )}

      <button
        onClick={() => void handleSync()}
        disabled={syncing}
        style={{
          padding: '0.6rem 1.4rem',
          background: syncing ? '#aaa' : '#1565c0',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: syncing ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        {syncing ? '갱신 중...' : '운임 캐시 수동 갱신'}
      </button>

      {syncResult && (
        <p style={{ marginTop: '1rem', color: syncResult.startsWith('오류') ? '#d32f2f' : '#2e7d32', fontSize: '0.9rem' }}>
          {syncResult}
        </p>
      )}
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  border: '1px solid #ddd',
  fontSize: '0.9rem',
};
