'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type ProviderConfig = {
  enabled: boolean;
  label: string;
  startUrl: string;
  callbackUrl: string;
  clientId: string;
  apiKey: string;
  webhookSecret: string;
  signatureParam: string;
  signatureHeader: string;
};

type IdentityConfig = {
  enabled: boolean;
  testMode: boolean;
  allowTestBypass: boolean;
  requiredForGillerUpgrade: boolean;
  pass: ProviderConfig;
  kakao: ProviderConfig;
};

const emptyConfig: IdentityConfig = {
  enabled: true,
  testMode: true,
  allowTestBypass: true,
  requiredForGillerUpgrade: true,
  pass: {
    enabled: true,
    label: 'PASS',
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
    label: 'Kakao',
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
      const json = (await res.json()) as { item?: IdentityConfig };
      if (res.ok && json.item) {
        setConfig({ ...emptyConfig, ...json.item });
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
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(json.error ?? '저장에 실패했습니다.');
        return;
      }
      window.alert('저장 완료: CI/PASS 인증 설정이 반영되었습니다.');
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

  function providerReady(provider: ProviderConfig) {
    return provider.enabled && Boolean(provider.startUrl && (provider.clientId || provider.apiKey));
  }

  function renderProvider(provider: 'pass' | 'kakao', title: string, hint: string) {
    const current = config[provider];
    const ready = providerReady(current);
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ready ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {ready ? 'live ready' : 'test only'}
            </span>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={current.enabled}
                onChange={(event) => updateProvider(provider, { enabled: event.target.checked })}
              />
              사용
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="표시 이름">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={current.label}
              onChange={(event) => updateProvider(provider, { label: event.target.value })}
            />
          </Field>
          <Field label="시작 URL">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={current.startUrl}
              onChange={(event) => updateProvider(provider, { startUrl: event.target.value })}
              placeholder="https://..."
            />
          </Field>
          <Field label="콜백 URL">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={current.callbackUrl}
              onChange={(event) => updateProvider(provider, { callbackUrl: event.target.value })}
              placeholder="비우면 Cloud Functions 콜백을 사용합니다."
            />
          </Field>
          <Field label="Client ID">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={current.clientId}
              onChange={(event) => updateProvider(provider, { clientId: event.target.value })}
            />
          </Field>
          <Field label="API Key">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="password"
              value={current.apiKey}
              onChange={(event) => updateProvider(provider, { apiKey: event.target.value })}
            />
          </Field>
          <Field label="Webhook Secret">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="password"
              value={current.webhookSecret}
              onChange={(event) => updateProvider(provider, { webhookSecret: event.target.value })}
            />
          </Field>
          <Field label="Signature Param">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={current.signatureParam}
              onChange={(event) => updateProvider(provider, { signatureParam: event.target.value })}
            />
          </Field>
          <Field label="Signature Header">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={current.signatureHeader}
              onChange={(event) => updateProvider(provider, { signatureHeader: event.target.value })}
            />
          </Field>
        </div>
      </section>
    );
  }

  if (loading) {
    return <div className="p-6 text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="max-w-5xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">CI / PASS 인증 설정</h1>
        <p className="mt-2 text-sm text-slate-500">
          회원가입 이후 길러 승급으로 이어지는 실명 인증 경로를 설정합니다. 지금은 테스트 모드로 우회할 수 있게 두고, 나중에는 키만 넣으면 실제 인증으로 전환할 수 있게 준비합니다.
        </p>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => setConfig((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            승급용 CI 인증 흐름 사용
          </label>
          <label className="flex items-center gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={config.requiredForGillerUpgrade}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, requiredForGillerUpgrade: event.target.checked }))
              }
            />
            길러 승급 전에 CI 인증 필수
          </label>
          <label className="flex items-center gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={config.testMode}
              onChange={(event) => setConfig((prev) => ({ ...prev, testMode: event.target.checked }))}
            />
            테스트 모드 유지
          </label>
          <label className="flex items-center gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={config.allowTestBypass}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, allowTestBypass: event.target.checked }))
              }
            />
            테스트 우회 허용
          </label>
        </div>
        <p className="mt-3 text-xs text-amber-800">
          테스트 모드에서는 실제 PASS/Kakao 호출이 없어도 앱에서 인증 완료를 진행할 수 있습니다. 라이브 전환 전에는 최소 한 개 공급자에 시작 URL과 키를 넣어 두는 것이 좋습니다.
        </p>
      </section>

      <div className="mt-4 space-y-4">
        {renderProvider('pass', 'PASS', '국내 일반 사용자 인증 흐름을 기본으로 준비합니다.')}
        {renderProvider('kakao', 'Kakao', 'PASS가 막히는 경우를 대비한 보조 실명 인증 경로입니다.')}
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => {
            void save();
          }}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? '저장 중...' : '설정 저장'}
        </button>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          다시 불러오기
        </button>
      </div>
    </div>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <p className="mb-1 text-xs font-medium text-slate-500">{props.label}</p>
      {props.children}
    </label>
  );
}
