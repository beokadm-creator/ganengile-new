'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

type BankConfig = {
  enabled: boolean;
  testMode: boolean;
  allowTestBypass: boolean;
  provider: string;
  verificationMode: string;
  apiBaseUrl: string;
  clientId: string;
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  requiresAccountHolderMatch: boolean;
  manualReviewFallback: boolean;
  statusMessage: string;
};

type BankTestResult = {
  ok: boolean;
  mode?: string;
  provider?: string;
  verificationMode?: string;
  accountHolderMatch?: boolean;
  result?: string;
  message?: string;
  error?: string;
};

const emptyConfig: BankConfig = {
  enabled: true,
  testMode: true,
  allowTestBypass: true,
  provider: 'manual_review',
  verificationMode: 'manual_review',
  apiBaseUrl: '',
  clientId: '',
  apiKey: '',
  secretKey: '',
  webhookSecret: '',
  requiresAccountHolderMatch: true,
  manualReviewFallback: true,
  statusMessage: 'API 키가 준비되기 전에는 테스트 모드 또는 운영 수동 검토로 계좌를 확인합니다.',
};

export default function BankIntegrationPage() {
  const [config, setConfig] = useState<BankConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testAccountHolder, setTestAccountHolder] = useState('홍길동');
  const [testBankName, setTestBankName] = useState('국민은행');
  const [testAccountNumber, setTestAccountNumber] = useState('12345678901234');
  const [testResult, setTestResult] = useState<BankTestResult | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integrations/bank');
      const json = (await res.json()) as { item?: BankConfig };
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
      const res = await fetch('/api/admin/integrations/bank', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(json.error ?? '저장에 실패했습니다.');
        return;
      }
      window.alert('저장 완료: 계좌 인증 설정이 반영되었습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/integrations/bank/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName: testBankName,
          accountNumber: testAccountNumber,
          accountHolder: testAccountHolder,
        }),
      });
      setTestResult((await res.json()) as BankTestResult);
    } finally {
      setTesting(false);
    }
  }

  function handleField<K extends keyof BankConfig>(key: K) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setConfig((prev) => ({ ...prev, [key]: event.target.value as BankConfig[K] }));
    };
  }

  const liveReady = Boolean(
    config.enabled && config.apiBaseUrl && (config.apiKey || (config.clientId && config.secretKey))
  );

  if (loading) {
    return <div className="min-h-screen bg-stone-50 p-6 text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Dark header */}
        <section className="rounded-[28px] bg-[#0f172a] px-7 py-8 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">bank integration</p>
              <h1 className="mt-3 text-3xl font-bold">계좌 인증 / 출금 설정</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
                길러 승급과 출금에 필요한 계좌 확인 흐름을 준비합니다. 지금은 테스트 또는 운영 검토를 허용하고, 나중에는 API 키만 넣어 자동 검증으로 전환합니다.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                liveReady ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {liveReady ? 'live ready' : 'test only'}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) => setConfig((prev) => ({ ...prev, enabled: event.target.checked }))}
              />
              계좌 인증 사용
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={config.testMode}
                onChange={(event) => setConfig((prev) => ({ ...prev, testMode: event.target.checked }))}
              />
              테스트 모드 유지
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
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
        </section>

        {/* Form card */}
        <section className="rounded-[24px] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">API 연동 설정</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="공급자">
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                value={config.provider}
                onChange={handleField('provider')}
              >
                <option value="manual_review">Manual review</option>
                <option value="open_banking">Open banking</option>
                <option value="virtual_account">Micro deposit</option>
              </select>
            </Field>
            <Field label="검증 방식">
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                value={config.verificationMode}
                onChange={handleField('verificationMode')}
              >
                <option value="manual_review">운영 검토</option>
                <option value="account_holder_match">예금주 조회</option>
                <option value="micro_deposit">1원 인증</option>
              </select>
            </Field>
            <Field label="API Base URL">
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                value={config.apiBaseUrl}
                onChange={handleField('apiBaseUrl')}
              />
            </Field>
            <Field label="Client ID">
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                value={config.clientId}
                onChange={handleField('clientId')}
              />
            </Field>
            <Field label="API Key">
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                type="password"
                value={config.apiKey}
                onChange={handleField('apiKey')}
              />
            </Field>
            <Field label="Secret Key">
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                type="password"
                value={config.secretKey}
                onChange={handleField('secretKey')}
              />
            </Field>
            <Field label="Webhook Secret">
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                type="password"
                value={config.webhookSecret}
                onChange={handleField('webhookSecret')}
              />
            </Field>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={config.requiresAccountHolderMatch}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, requiresAccountHolderMatch: event.target.checked }))
                }
              />
              예금주 일치 검증 필요
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={config.manualReviewFallback}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, manualReviewFallback: event.target.checked }))
                }
              />
              실패 시 운영 수동 검토 유지
            </label>
          </div>

          <div className="mt-5">
            <Field label="상태 메시지">
              <textarea
                className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                value={config.statusMessage}
                onChange={handleField('statusMessage')}
              />
            </Field>
          </div>
        </section>

        {/* Test section (dark card) */}
        <section className="rounded-[24px] bg-slate-950 p-6 text-white shadow-sm">
          <h2 className="text-lg font-bold">서버 테스트</h2>
          <p className="mt-1 text-sm text-slate-300">
            현재 설정 기준으로 서버사이드 계좌 인증 자리가 어떤 모드로 응답하는지 확인합니다.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Field label="은행명">
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                value={testBankName}
                onChange={(event) => setTestBankName(event.target.value)}
              />
            </Field>
            <Field label="계좌번호">
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                value={testAccountNumber}
                onChange={(event) => setTestAccountNumber(event.target.value)}
              />
            </Field>
            <Field label="예금주">
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                value={testAccountHolder}
                onChange={(event) => setTestAccountHolder(event.target.value)}
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={() => {
              void runTest();
            }}
            disabled={testing}
            className="mt-4 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {testing ? '테스트 중...' : '테스트 실행'}
          </button>
          {testResult ? (
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm text-slate-100">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          ) : null}
        </section>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              void save();
            }}
            disabled={saving}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
          <button
            type="button"
            onClick={() => {
              void load();
            }}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            다시 불러오기
          </button>
        </div>
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
