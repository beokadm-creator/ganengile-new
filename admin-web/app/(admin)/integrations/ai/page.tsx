'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

type AutoFillFields = {
  itemName: boolean;
  category: boolean;
  description: boolean;
  estimatedValue: boolean;
  estimatedWeight: boolean;
  estimatedSize: boolean;
  depositSuggestion: boolean;
  startingPriceSuggestion: boolean;
};

type AIConfig = {
  enabled: boolean;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  analysisModel: string;
  pricingModel: string;
  missionModel: string;
  confidenceThreshold: number;
  fallbackMode: string;
  disableThinking: boolean;
  visionPrompt: string;
  pricingPrompt: string;
  missionPrompt: string;
  autoFillFields: AutoFillFields;
};

type AIConfigResponse = {
  item?: Partial<AIConfig>;
  error?: string;
};

type TestResponse = {
  ok: boolean;
  latencyMs?: number;
  model?: string;
  requestId?: string;
  content?: string;
  raw?: unknown;
  error?: string;
  details?: unknown;
};

const emptyConfig: AIConfig = {
  enabled: false,
  provider: 'zai',
  apiKey: '',
  baseUrl: 'https://api.z.ai/api/paas/v4',
  model: 'glm-4.7',
  analysisModel: 'glm-4.7',
  pricingModel: 'glm-4.7',
  missionModel: 'glm-4.7',
  confidenceThreshold: 0.75,
  fallbackMode: 'manual',
  disableThinking: true,
  visionPrompt: '',
  pricingPrompt: '',
  missionPrompt: '',
  autoFillFields: {
    itemName: true,
    category: true,
    description: true,
    estimatedValue: true,
    estimatedWeight: true,
    estimatedSize: true,
    depositSuggestion: true,
    startingPriceSuggestion: true,
  },
};

const autoFillLabels: Array<{ key: keyof AutoFillFields; label: string }> = [
  { key: 'itemName', label: '물품명' },
  { key: 'category', label: '카테고리' },
  { key: 'description', label: '설명' },
  { key: 'estimatedValue', label: '예상 가치' },
  { key: 'estimatedWeight', label: '예상 무게' },
  { key: 'estimatedSize', label: '예상 크기' },
  { key: 'depositSuggestion', label: '보증금 제안' },
  { key: 'startingPriceSuggestion', label: '시작가 제안' },
];

export default function AIIntegrationPage() {
  const [config, setConfig] = useState<AIConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testModel, setTestModel] = useState('glm-4.7');
  const [testPrompt, setTestPrompt] = useState('OK만 답해주세요.');
  const [testResult, setTestResult] = useState<TestResponse | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/integrations/ai');
      const json = (await res.json()) as AIConfigResponse;
      if (res.ok && json.item) {
        setConfig({
          ...emptyConfig,
          ...json.item,
          autoFillFields: {
            ...emptyConfig.autoFillFields,
            ...(json.item.autoFillFields ?? {}),
          },
        });
        setTestModel(json.item.model ?? emptyConfig.model);
      }
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/integrations/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = (await res.json()) as AIConfigResponse;
      if (!res.ok) {
        window.alert(json.error ?? '저장에 실패했습니다.');
        return;
      }
      window.alert('AI 설정을 저장했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/integrations/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: testModel,
          prompt: testPrompt,
          disableThinking: config.disableThinking,
        }),
      });
      const json = (await res.json()) as TestResponse;
      setTestResult(json);
    } finally {
      setTesting(false);
    }
  }

  function updateAutoFillField(key: keyof AutoFillFields, value: boolean) {
    setConfig((prev) => ({
      ...prev,
      autoFillFields: {
        ...prev.autoFillFields,
        [key]: value,
      },
    }));
  }

  function updateField<K extends keyof AIConfig>(key: K, value: AIConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function handleTextField<K extends keyof AIConfig>(key: K) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      updateField(key, event.target.value as AIConfig[K]);
    };
  }

  if (loading) {
    return <div className="p-6 text-gray-500">불러오는 중...</div>;
  }

  return (
    <div className="max-w-5xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">AI 설정</h1>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900">AI 사용</h2>
          <button
            type="button"
            onClick={() => updateField('enabled', !config.enabled)}
            className={`inline-flex h-10 min-w-24 items-center justify-center rounded-full px-4 text-sm font-semibold ${
              config.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
            }`}
          >
            {config.enabled ? '사용 중' : '꺼짐'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">연결</h2>
          <div className="mt-4 grid gap-4">
            <Field label="공급자">
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={config.provider}
                onChange={handleTextField('provider')}
              >
                <option value="zai">Z.AI / GLM</option>
                <option value="openai_compatible">OpenAI Compatible</option>
              </select>
            </Field>
            <Field label="API Base URL">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={config.baseUrl}
                onChange={handleTextField('baseUrl')}
                placeholder="https://api.z.ai/api/paas/v4"
              />
            </Field>
            <Field label="API Key">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                type="password"
                value={config.apiKey}
                onChange={handleTextField('apiKey')}
                placeholder="API Key"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">모델</h2>
          <div className="mt-4 grid gap-4">
            <Field label="기본 모델">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={config.model} onChange={handleTextField('model')} />
            </Field>
            <Field label="분석 모델">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={config.analysisModel} onChange={handleTextField('analysisModel')} />
            </Field>
            <Field label="가격 모델">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={config.pricingModel} onChange={handleTextField('pricingModel')} />
            </Field>
            <Field label="미션 모델">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={config.missionModel} onChange={handleTextField('missionModel')} />
            </Field>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">실행 옵션</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="신뢰도 기준">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={config.confidenceThreshold}
              onChange={(event) => updateField('confidenceThreshold', Number(event.target.value || 0))}
            />
          </Field>
          <Field label="Fallback 모드">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={config.fallbackMode}
              onChange={handleTextField('fallbackMode')}
            >
              <option value="manual">수동 검토</option>
              <option value="partial">부분 자동 제안</option>
              <option value="block">중단</option>
            </select>
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.disableThinking}
            onChange={(event) => updateField('disableThinking', event.target.checked)}
          />
          thinking 끄기
        </label>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">프롬프트</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Vision Prompt">
            <textarea className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={config.visionPrompt} onChange={handleTextField('visionPrompt')} />
          </Field>
          <Field label="Pricing Prompt">
            <textarea className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={config.pricingPrompt} onChange={handleTextField('pricingPrompt')} />
          </Field>
          <Field label="Mission Prompt">
            <textarea className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={config.missionPrompt} onChange={handleTextField('missionPrompt')} />
          </Field>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">자동 입력 항목</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {autoFillLabels.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={config.autoFillFields[key]} onChange={(event) => updateAutoFillField(key, event.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white">
        <h2 className="text-base font-semibold">API 테스트</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="테스트 모델">
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              value={testModel}
              onChange={(event) => setTestModel(event.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                void runTest();
              }}
              disabled={testing}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {testing ? '테스트 중...' : '테스트 실행'}
            </button>
          </div>
        </div>
        <Field label="테스트 프롬프트">
          <textarea
            className="mt-4 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            value={testPrompt}
            onChange={(event) => setTestPrompt(event.target.value)}
          />
        </Field>
        {testResult ? (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
            <div className="flex flex-wrap gap-4 text-xs text-slate-300">
              <span>상태: {testResult.ok ? '성공' : '실패'}</span>
              {testResult.model ? <span>모델: {testResult.model}</span> : null}
              {testResult.latencyMs ? <span>지연: {testResult.latencyMs}ms</span> : null}
              {testResult.requestId ? <span>요청 ID: {testResult.requestId}</span> : null}
            </div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm text-slate-100">
              {testResult.content ?? testResult.error ?? JSON.stringify(testResult.raw ?? testResult.details ?? testResult, null, 2)}
            </pre>
          </div>
        ) : null}
      </section>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => {
            void save();
          }}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '설정 저장'}
        </button>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
