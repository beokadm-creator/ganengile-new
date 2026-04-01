'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

type PaymentConfig = {
  enabled: boolean;
  testMode: boolean;
  allowTestBypass: boolean;
  provider: string;
  clientKey: string;
  secretKey: string;
  successUrl: string;
  failUrl: string;
  webhookSecret: string;
  escrowEnabled: boolean;
  bankVerificationRequired: boolean;
  manualSettlementReview: boolean;
  statusMessage: string;
};

type PaymentTestResult = {
  ok: boolean;
  mode?: string;
  provider?: string;
  paymentKeyReady?: boolean;
  paymentId?: string;
  orderId?: string | null;
  orderName?: string | null;
  amount?: number;
  message?: string;
  error?: string;
};

const emptyConfig: PaymentConfig = {
  enabled: true,
  testMode: true,
  allowTestBypass: true,
  provider: 'tosspayments',
  clientKey: '',
  secretKey: '',
  successUrl: '',
  failUrl: '',
  webhookSecret: '',
  escrowEnabled: true,
  bankVerificationRequired: true,
  manualSettlementReview: true,
  statusMessage: 'PG 키가 준비되기 전에는 테스트 모드로 보증금 결제를 우회합니다.',
};

export default function PaymentIntegrationPage() {
  const [config, setConfig] = useState<PaymentConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testAmount, setTestAmount] = useState('4500');
  const [testOrderId, setTestOrderId] = useState('beta1-order-test');
  const [testOrderName, setTestOrderName] = useState('보증금 테스트');
  const [testResult, setTestResult] = useState<PaymentTestResult | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integrations/payment');
      const json = (await res.json()) as { item?: PaymentConfig };
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
      const res = await fetch('/api/admin/integrations/payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(json.error ?? '저장에 실패했습니다.');
        return;
      }
      window.alert('저장 완료: 결제/보증금 설정이 반영되었습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/integrations/payment/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(testAmount || 0),
          orderId: testOrderId,
          orderName: testOrderName,
        }),
      });
      setTestResult((await res.json()) as PaymentTestResult);
    } finally {
      setTesting(false);
    }
  }

  function handleField<K extends keyof PaymentConfig>(key: K) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setConfig((prev) => ({ ...prev, [key]: event.target.value as PaymentConfig[K] }));
    };
  }

  const liveReady = Boolean(config.enabled && config.clientKey && config.secretKey);

  if (loading) {
    return <div className="p-6 text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">PG / 보증금 결제 설정</h1>
        <p className="mt-2 text-sm text-slate-500">
          지금은 테스트 모드로 우회하고, 나중에는 PG 키만 입력하면 보증금 결제 흐름을 실제 결제로 전환할 수 있게 준비합니다.
        </p>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              liveReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {liveReady ? 'live ready' : 'test only'}
          </span>
          <label className="flex items-center gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => setConfig((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            결제 흐름 사용
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
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="공급자">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={config.provider}
              onChange={handleField('provider')}
            >
              <option value="tosspayments">TossPayments</option>
              <option value="kcp">KCP</option>
              <option value="inicis">Inicis</option>
            </select>
          </Field>
          <Field label="Client Key">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={config.clientKey}
              onChange={handleField('clientKey')}
            />
          </Field>
          <Field label="Secret Key">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="password"
              value={config.secretKey}
              onChange={handleField('secretKey')}
            />
          </Field>
          <Field label="Webhook Secret">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="password"
              value={config.webhookSecret}
              onChange={handleField('webhookSecret')}
            />
          </Field>
          <Field label="Success URL">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={config.successUrl}
              onChange={handleField('successUrl')}
            />
          </Field>
          <Field label="Fail URL">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={config.failUrl}
              onChange={handleField('failUrl')}
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={config.escrowEnabled}
              onChange={(event) => setConfig((prev) => ({ ...prev, escrowEnabled: event.target.checked }))}
            />
            보증금/에스크로 정책 사용
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={config.bankVerificationRequired}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, bankVerificationRequired: event.target.checked }))
              }
            />
            출금 전에 계좌 검증 필요
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={config.manualSettlementReview}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, manualSettlementReview: event.target.checked }))
              }
            />
            운영자 최종 정산 검토 유지
          </label>
        </div>

        <Field label="상태 메시지">
          <textarea
            className="mt-4 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={config.statusMessage}
            onChange={handleField('statusMessage')}
          />
        </Field>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white">
        <h2 className="text-base font-semibold">서버 테스트</h2>
        <p className="mt-1 text-sm text-slate-300">
          현재 설정 기준으로 결제 confirm 자리가 어떤 응답 모드로 동작하는지 확인합니다.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="금액">
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              value={testAmount}
              onChange={(event) => setTestAmount(event.target.value)}
            />
          </Field>
          <Field label="주문 ID">
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              value={testOrderId}
              onChange={(event) => setTestOrderId(event.target.value)}
            />
          </Field>
          <Field label="주문명">
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              value={testOrderName}
              onChange={(event) => setTestOrderName(event.target.value)}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => {
            void runTest();
          }}
          disabled={testing}
          className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {testing ? '테스트 중...' : '테스트 실행'}
        </button>
        {testResult ? (
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        ) : null}
      </section>

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
