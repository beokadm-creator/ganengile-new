'use client';

import { useEffect, useState } from 'react';

type PaymentConfig = {
  testMode: boolean;
  tossClientKey: string;
};

const emptyConfig: PaymentConfig = {
  testMode: true,
  tossClientKey: '',
};

export default function PaymentIntegrationPage() {
  const [config, setConfig] = useState<PaymentConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integrations/payment');
      const json = await res.json();
      if (res.ok && json?.item) {
        setConfig(json.item);
      }
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/integrations/payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || '저장에 실패했습니다.');
        return;
      }
      alert('저장 완료: 결제 설정이 반영되었습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">💳 결제 연동 설정</h1>
        <p className="text-sm text-gray-500 mt-1">
          Toss Payments 설정을 관리합니다. 테스트 모드 OFF 전환 시 실제 결제가 발생합니다.
        </p>
      </div>

      {/* 테스트 모드 토글 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-amber-900">테스트 모드</h2>
            <p className="text-xs text-amber-700 mt-1">
              ON: 실제 결제 없이 성공 처리 (개발·QA 전용)<br />
              OFF: 실제 Toss Payments 결제 발생 (라이브)
            </p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <span className={`text-sm font-semibold ${config.testMode ? 'text-amber-700' : 'text-gray-400'}`}>
              {config.testMode ? '테스트 모드' : '라이브'}
            </span>
            <div
              onClick={() => setConfig((prev) => ({ ...prev, testMode: !prev.testMode }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                config.testMode ? 'bg-amber-500' : 'bg-green-500'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.testMode ? 'translate-x-1' : 'translate-x-6'
                }`}
              />
            </div>
          </label>
        </div>
      </div>

      {/* Toss Client Key */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold mb-3">Toss Payments</h2>
        <div>
          <p className="text-xs text-gray-500 mb-1">Client Key</p>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={config.tossClientKey}
            onChange={(e) => setConfig((prev) => ({ ...prev, tossClientKey: e.target.value }))}
            placeholder="live_ck_... 또는 test_ck_..."
          />
          <p className="text-xs text-gray-400 mt-1">
            테스트 키(test_ck_)는 테스트 모드에서, 라이브 키(live_ck_)는 라이브 모드에서 사용하세요.
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '설정 저장'}
        </button>
        <button
          onClick={() => void load()}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
