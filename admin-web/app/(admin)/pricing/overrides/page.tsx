'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type RouteOverride = {
  routeKey: string;
  pickupStationId: string;
  deliveryStationId: string;
  requestMode: 'immediate' | 'reservation';
  enabled: boolean;
  fixedAdjustment: number;
  multiplier: number;
  minCompletedCount: number;
  notes: string;
};

const emptyForm: RouteOverride = {
  routeKey: '',
  pickupStationId: '',
  deliveryStationId: '',
  requestMode: 'immediate',
  enabled: true,
  fixedAdjustment: 0,
  multiplier: 1,
  minCompletedCount: 3,
  notes: '',
};

export default function PricingOverridesPage() {
  const [items, setItems] = useState<RouteOverride[]>([]);
  const [form, setForm] = useState<RouteOverride>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/route-pricing-overrides');
      const json = (await response.json()) as { items?: RouteOverride[] };
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function update<K extends keyof RouteOverride>(key: K, value: RouteOverride[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/route-pricing-overrides', {
        method: form.routeKey ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        window.alert(json.error ?? '저장 실패');
        return;
      }
      setForm(emptyForm);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">구간 오버라이드</h1>
        <p className="mt-1 text-sm text-slate-500">구간별 할증/할인</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">규칙 등록</h2>
          <div className="mt-4 grid gap-4">
            <Field label="출발역 ID">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.pickupStationId} onChange={(event) => update('pickupStationId', event.target.value)} />
            </Field>
            <Field label="도착역 ID">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.deliveryStationId} onChange={(event) => update('deliveryStationId', event.target.value)} />
            </Field>
            <Field label="요청 방식">
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.requestMode} onChange={(event) => update('requestMode', event.target.value as 'immediate' | 'reservation')}>
                <option value="immediate">즉시</option>
                <option value="reservation">예약</option>
              </select>
            </Field>
            <Field label="고정 할증/할인">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" value={form.fixedAdjustment} onChange={(event) => update('fixedAdjustment', Number(event.target.value))} />
            </Field>
            <Field label="배수">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" step="0.01" value={form.multiplier} onChange={(event) => update('multiplier', Number(event.target.value))} />
            </Field>
            <Field label="최소 표본">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="number" value={form.minCompletedCount} onChange={(event) => update('minCompletedCount', Number(event.target.value))} />
            </Field>
            <Field label="메모">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.notes} onChange={(event) => update('notes', event.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.enabled} onChange={(event) => update('enabled', event.target.checked)} />
              사용
            </label>
            <button type="button" onClick={() => void save()} disabled={saving} className="rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">등록된 규칙</h2>
          {loading ? (
            <div className="mt-4 text-sm text-slate-500">불러오는 중...</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">구간</th>
                    <th className="px-4 py-3 text-right">고정</th>
                    <th className="px-4 py-3 text-right">배수</th>
                    <th className="px-4 py-3 text-right">표본</th>
                    <th className="px-4 py-3">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.routeKey} className="bg-white cursor-pointer" onClick={() => setForm(item)}>
                      <td className="px-4 py-3 text-slate-800">{item.routeKey}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.fixedAdjustment}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.multiplier}x</td>
                      <td className="px-4 py-3 text-right text-slate-600">{item.minCompletedCount}</td>
                      <td className="px-4 py-3 text-slate-600">{item.enabled ? '사용' : '중지'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-slate-700">{label}</div>
      {children}
    </label>
  );
}
