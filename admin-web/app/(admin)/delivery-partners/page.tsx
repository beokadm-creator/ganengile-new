'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type DeliveryPartnerItem = {
  id: string;
  partnerName: string;
  partnerType: string;
  status: string;
  capabilities: string[];
  integrationMode: string;
  connectionStatus: string;
  lastConnectionMessage: string;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
  healthcheckPath: string;
  authScheme: string;
  statusMessage: string;
  orchestration: {
    actorType: 'external_partner';
    enabled: boolean;
    priorityScore: number;
    supportsFullDelivery: boolean;
    supportsPartialLegs: boolean;
    supportedMissionTypes: string[];
    fallbackOnly: boolean;
  };
};

type PartnerResponse = {
  items?: DeliveryPartnerItem[];
};

type TestResponse = {
  ok: boolean;
  message?: string;
  connectionStatus?: string;
  checks?: Record<string, boolean>;
  error?: string;
};

const DEFAULT_FORM: DeliveryPartnerItem = {
  id: '',
  partnerName: '',
  partnerType: 'delivery_agency',
  status: 'testing',
  capabilities: ['address_dropoff'],
  integrationMode: 'manual_ops',
  connectionStatus: 'unknown',
  lastConnectionMessage: '',
  baseUrl: '',
  apiKey: '',
  apiSecret: '',
  webhookUrl: '',
  healthcheckPath: '',
  authScheme: 'bearer',
  statusMessage: '',
  orchestration: {
    actorType: 'external_partner',
    enabled: true,
    priorityScore: 50,
    supportsFullDelivery: true,
    supportsPartialLegs: true,
    supportedMissionTypes: ['last_mile'],
    fallbackOnly: false,
  },
};

const CAPABILITY_OPTIONS = [
  'station_to_station',
  'address_pickup',
  'address_dropoff',
  'same_day',
  'urgent',
  'night_delivery',
  'heavy_item',
  'fragile_item',
];

const MISSION_TYPE_OPTIONS = [
  'pickup',
  'dropoff',
  'subway_transport',
  'last_mile',
  'locker_dropoff',
  'locker_pickup',
  'meetup_handover',
];

function badgeTone(status: string): string {
  switch (status) {
    case 'active':
    case 'connected':
      return 'bg-emerald-100 text-emerald-700';
    case 'degraded':
    case 'testing':
      return 'bg-amber-100 text-amber-700';
    case 'error':
    case 'suspended':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function DeliveryPartnersPage() {
  const [items, setItems] = useState<DeliveryPartnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState<DeliveryPartnerItem>(DEFAULT_FORM);

  useEffect(() => {
    void load();
  }, []);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/delivery-partners');
      const json = (await res.json()) as PartnerResponse;
      const nextItems = json.items ?? [];
      setItems(nextItems);
      if (selectedId) {
        const nextSelected = nextItems.find((item) => item.id === selectedId);
        if (nextSelected) {
          setForm(nextSelected);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function selectPartner(item: DeliveryPartnerItem) {
    setSelectedId(item.id);
    setForm(item);
  }

  function resetForm() {
    setSelectedId('');
    setForm(DEFAULT_FORM);
  }

  async function savePartner() {
    setSaving(true);
    try {
      const method = selectedId ? 'PATCH' : 'POST';
      const payload = {
        ...(selectedId ? { partnerId: selectedId } : {}),
        ...form,
      };
      const res = await fetch('/api/admin/delivery-partners', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(json.error ?? '저장에 실패했습니다.');
        return;
      }
      await load();
      window.alert(selectedId ? '배송업체 정보 수정 완료' : '배송업체 등록 완료');
      if (!selectedId) {
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(partnerId: string) {
    setTesting(partnerId);
    try {
      const res = await fetch('/api/admin/delivery-partners/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId }),
      });
      const json = (await res.json()) as TestResponse;
      window.alert(json.message ?? json.error ?? '연결 상태를 확인했습니다.');
      await load();
      if (selectedId === partnerId) {
        const refreshed = await fetch('/api/admin/delivery-partners');
        const refreshedJson = (await refreshed.json()) as PartnerResponse;
        const match = refreshedJson.items?.find((item) => item.id === partnerId);
        if (match) setForm(match);
      }
    } finally {
      setTesting(null);
    }
  }

  function toggleStringItem(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">배송업체 / External Partner 관리</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
            길러와 함께 오케스트레이션에 참여하는 외부 배송업체를 등록하고, API 키 또는 수동 운영형 설정,
            오케스트레이션 우선순위, 미션 타입 지원 범위를 함께 관리합니다.
          </p>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">등록된 배송업체</h2>
                <p className="text-sm text-slate-500">연동 상태와 오케스트레이션 참여 여부를 함께 봅니다.</p>
              </div>
              <button
                onClick={resetForm}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                신규 등록
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-slate-400">불러오는 중...</div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">등록된 배송업체가 없습니다.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">업체</th>
                      <th className="px-4 py-3 text-left">유형</th>
                      <th className="px-4 py-3 text-left">운영 상태</th>
                      <th className="px-4 py-3 text-left">연동 상태</th>
                      <th className="px-4 py-3 text-left">오케스트레이션</th>
                      <th className="px-4 py-3 text-left">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-slate-900">{item.partnerName || '이름 없음'}</p>
                          <p className="mt-1 font-mono text-[11px] text-slate-400">{item.id}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.integrationMode}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-600">{item.partnerType}</td>
                        <td className="px-4 py-4 align-top">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTone(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTone(item.connectionStatus)}`}
                          >
                            {item.connectionStatus}
                          </span>
                          <p className="mt-2 max-w-[220px] text-xs leading-5 text-slate-500">
                            {item.lastConnectionMessage || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top text-xs text-slate-600">
                          <p>enabled: {item.orchestration.enabled ? 'yes' : 'no'}</p>
                          <p>priority: {item.orchestration.priorityScore}</p>
                          <p>fallbackOnly: {item.orchestration.fallbackOnly ? 'yes' : 'no'}</p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => selectPartner(item)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              편집
                            </button>
                            <button
                              onClick={() => void testConnection(item.id)}
                              disabled={testing === item.id}
                              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
                            >
                              {testing === item.id ? '확인 중...' : '연결 확인'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-[24px] bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {selectedItem ? '배송업체 편집' : '배송업체 등록'}
              </h2>
              <p className="text-sm text-slate-500">
                업체 연동 정보와 오케스트레이션 참여 조건을 함께 저장합니다.
              </p>
            </div>

            <div className="space-y-5">
              <Field label="업체명">
                <input
                  value={form.partnerName}
                  onChange={(event) => setForm((prev) => ({ ...prev, partnerName: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="업체 유형">
                  <select
                    value={form.partnerType}
                    onChange={(event) => setForm((prev) => ({ ...prev, partnerType: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="delivery_agency">delivery_agency</option>
                    <option value="quick_service">quick_service</option>
                    <option value="last_mile_carrier">last_mile_carrier</option>
                    <option value="regional_courier">regional_courier</option>
                    <option value="custom">custom</option>
                  </select>
                </Field>
                <Field label="연동 방식">
                  <select
                    value={form.integrationMode}
                    onChange={(event) => setForm((prev) => ({ ...prev, integrationMode: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="manual_ops">manual_ops</option>
                    <option value="api">api</option>
                    <option value="csv_batch">csv_batch</option>
                    <option value="email_dispatch">email_dispatch</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="운영 상태">
                  <select
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="testing">testing</option>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="suspended">suspended</option>
                  </select>
                </Field>
                <Field label="인증 방식">
                  <select
                    value={form.authScheme}
                    onChange={(event) => setForm((prev) => ({ ...prev, authScheme: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="bearer">bearer</option>
                    <option value="basic">basic</option>
                    <option value="header_key">header_key</option>
                    <option value="manual">manual</option>
                  </select>
                </Field>
              </div>

              <Field label="Capabilities">
                <div className="flex flex-wrap gap-2">
                  {CAPABILITY_OPTIONS.map((capability) => (
                    <button
                      key={capability}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          capabilities: toggleStringItem(prev.capabilities, capability),
                        }))
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        form.capabilities.includes(capability)
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {capability}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="지원 미션 타입">
                <div className="flex flex-wrap gap-2">
                  {MISSION_TYPE_OPTIONS.map((missionType) => (
                    <button
                      key={missionType}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          orchestration: {
                            ...prev.orchestration,
                            supportedMissionTypes: toggleStringItem(
                              prev.orchestration.supportedMissionTypes,
                              missionType
                            ),
                          },
                        }))
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        form.orchestration.supportedMissionTypes.includes(missionType)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {missionType}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Base URL">
                  <input
                    value={form.baseUrl}
                    onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Healthcheck Path">
                  <input
                    value={form.healthcheckPath}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, healthcheckPath: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="API Key">
                  <input
                    value={form.apiKey}
                    onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="API Secret">
                  <input
                    type="password"
                    value={form.apiSecret}
                    onChange={(event) => setForm((prev) => ({ ...prev, apiSecret: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Webhook URL">
                <input
                  value={form.webhookUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, webhookUrl: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="오케스트레이션 설정">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.orchestration.enabled}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          orchestration: { ...prev.orchestration, enabled: event.target.checked },
                        }))
                      }
                    />
                    actor 활성화
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.orchestration.supportsFullDelivery}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          orchestration: {
                            ...prev.orchestration,
                            supportsFullDelivery: event.target.checked,
                          },
                        }))
                      }
                    />
                    전체 배송 가능
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.orchestration.supportsPartialLegs}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          orchestration: {
                            ...prev.orchestration,
                            supportsPartialLegs: event.target.checked,
                          },
                        }))
                      }
                    />
                    부분 레그 가능
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.orchestration.fallbackOnly}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          orchestration: { ...prev.orchestration, fallbackOnly: event.target.checked },
                        }))
                      }
                    />
                    fallback 전용
                  </label>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-500">priority score</label>
                  <input
                    type="number"
                    value={form.orchestration.priorityScore}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        orchestration: {
                          ...prev.orchestration,
                          priorityScore: Number(event.target.value || 0),
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </Field>

              <Field label="운영 메모 / 상태 메시지">
                <textarea
                  value={form.statusMessage}
                  onChange={(event) => setForm((prev) => ({ ...prev, statusMessage: event.target.value }))}
                  className="min-h-[88px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => void savePartner()}
                  disabled={saving}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
                >
                  {saving ? '저장 중...' : selectedId ? '수정 저장' : '신규 등록'}
                </button>
                {selectedId ? (
                  <button
                    onClick={() => void testConnection(selectedId)}
                    disabled={testing === selectedId}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {testing === selectedId ? '연결 확인 중...' : '연결 상태 확인'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
