'use client';

import { useEffect, useState } from 'react';

type ProviderConfig = {
  enabled: boolean;
  startUrl: string;
  callbackUrl: string;
  clientId: string;
  apiKey: string;
  webhookSecret: string;
  signatureParam: string;
  signatureHeader: string;
};

type IdentityConfig = {
  testMode: boolean;
  pass: ProviderConfig;
  kakao: ProviderConfig;
};

const emptyConfig: IdentityConfig = {
  testMode: true,
  pass: {
    enabled: true,
    startUrl: '',
    callbackUrl: '',
    clientId: '',
    apiKey: '',
    webhookSecret: '',
    signatureParam: 'signature',
    signatureHeader: 'x-signature',
  },
  kakao: {
    enabled: true,
    startUrl: '',
    callbackUrl: '',
    clientId: '',
    apiKey: '',
    webhookSecret: '',
    signatureParam: 'signature',
    signatureHeader: 'x-signature',
  },
};

export default function IdentityIntegrationPage() {
  const [config, setConfig] = useState<IdentityConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integrations/identity');
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
      const res = await fetch('/api/admin/integrations/identity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || '저장에 실패했습니다.');
        return;
      }
      alert('저장 완료: CI 인증 설정이 반영되었습니다.');
    } finally {
      setSaving(false);
    }
  }

  function updateProvider(provider: 'pass' | 'kakao', patch: Partial<ProviderConfig>) {
    setConfig((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        ...patch,
      },
    }));
  }

  const renderProvider = (provider: 'pass' | 'kakao', title: string) => {
    const current = config[provider];
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={current.enabled}
              onChange={(e) => updateProvider(provider, { enabled: e.target.checked })}
            />
            사용
          </label>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">인증 시작 URL</p>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={current.startUrl}
            onChange={(e) => updateProvider(provider, { startUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">콜백 URL (선택)</p>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={current.callbackUrl}
            onChange={(e) => updateProvider(provider, { callbackUrl: e.target.value })}
            placeholder="비우면 기본 cloud function 콜백 사용"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Client ID (선택)</p>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={current.clientId}
              onChange={(e) => updateProvider(provider, { clientId: e.target.value })}
              placeholder="client id"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">API Key (선택)</p>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={current.apiKey}
              onChange={(e) => updateProvider(provider, { apiKey: e.target.value })}
              placeholder="api key"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Webhook Secret (권장)</p>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              type="password"
              value={current.webhookSecret}
              onChange={(e) => updateProvider(provider, { webhookSecret: e.target.value })}
              placeholder="콜백 서명 검증용 secret"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Signature Param</p>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={current.signatureParam}
              onChange={(e) => updateProvider(provider, { signatureParam: e.target.value })}
              placeholder="signature"
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Signature Header</p>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={current.signatureHeader}
            onChange={(e) => updateProvider(provider, { signatureHeader: e.target.value })}
            placeholder="x-signature"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            서명 규칙: `HMAC_SHA256(sessionId|provider|result|ci, webhookSecret)` (hex)
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="p-6 text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">🔐 CI 인증 연동 설정</h1>
        <p className="text-sm text-gray-500 mt-1">
          PASS/카카오 본인인증 API 정보를 설정하면 앱의 인증 시작 플로우에 즉시 반영됩니다.
        </p>
      </div>

      {/* 테스트 모드 토글 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-amber-900">테스트 모드</h2>
            <p className="text-xs text-amber-700 mt-1">
              ON: 실제 PASS/카카오 인증 없이 인증 완료 처리 (개발·QA 전용)<br />
              OFF: 실제 인증 URL을 사용하는 라이브 모드
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

      <div className="space-y-4">
        {renderProvider('pass', 'PASS')}
        {renderProvider('kakao', '카카오')}
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
