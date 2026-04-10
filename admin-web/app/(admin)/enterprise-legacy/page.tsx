'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { formatDate, formatKRW, statusColor, statusLabel } from '@/lib/format';

type TimestampLike = { seconds?: number; _seconds?: number; toDate?: () => Date } | string | null;

type EnterpriseContract = {
  id: string;
  businessId: string;
  companyName: string;
  registrationNumber: string;
  ceoName: string;
  contact: string;
  email: string;
  address: string;
  tier: string;
  status: string;
  billingMethod: string;
  startAt: TimestampLike;
  endAt: TimestampLike;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};

type EnterpriseDelivery = {
  id: string;
  contractId: string;
  businessId: string;
  gillerId: string;
  status: string;
  type: string;
  pickupLabel: string;
  dropoffLabel: string;
  scheduledTime: TimestampLike;
  weight: number;
  notes: string;
  totalFee: number;
  gillerEarning: number;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  completedAt: TimestampLike;
};

type EnterpriseLegacyResponse = {
  contracts?: EnterpriseContract[];
  deliveries?: EnterpriseDelivery[];
  summary?: {
    contractsTotal: number;
    contractsPending: number;
    contractsActive: number;
    deliveriesTotal: number;
    deliveriesActive: number;
  };
};

const CONTRACT_STATUS_OPTIONS = ['pending', 'active', 'suspended', 'cancelled'] as const;
const DELIVERY_STATUS_OPTIONS = ['pending', 'matched', 'picked_up', 'in_transit', 'delivered', 'cancelled'] as const;

export default function EnterpriseLegacyPage() {
  const [contracts, setContracts] = useState<EnterpriseContract[]>([]);
  const [deliveries, setDeliveries] = useState<EnterpriseDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'contracts' | 'deliveries'>('contracts');
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    return {
      contractsTotal: contracts.length,
      contractsPending: contracts.filter((item) => item.status === 'pending').length,
      contractsActive: contracts.filter((item) => item.status === 'active').length,
      deliveriesTotal: deliveries.length,
      deliveriesActive: deliveries.filter((item) => ['pending', 'matched', 'picked_up', 'in_transit'].includes(item.status)).length,
    };
  }, [contracts, deliveries]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/enterprise-legacy');
      const json = (await res.json()) as EnterpriseLegacyResponse;
      setContracts(json.contracts ?? []);
      setDeliveries(json.deliveries ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(targetType: 'contract' | 'delivery', targetId: string, status: string) {
    setSaving(`${targetType}:${targetId}`);
    try {
      await fetch('/api/admin/enterprise-legacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, status }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">enterprise legacy</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">기업고객 레거시 운영</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
            이전에 B2B로 불리던 기업고객 계약, 구독, 배송 요청 흐름을 별도 보드로 격리합니다.
            새 B2B 배송업체 운영은 배송업체 관리와 업체 위임 현황에서 관리합니다.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <Metric title="계약 전체" value={`${summary.contractsTotal}건`} />
          <Metric title="계약 대기" value={`${summary.contractsPending}건`} />
          <Metric title="계약 활성" value={`${summary.contractsActive}건`} />
          <Metric title="배송 전체" value={`${summary.deliveriesTotal}건`} />
          <Metric title="배송 진행" value={`${summary.deliveriesActive}건`} />
        </section>

        <section className="rounded-[24px] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">레거시 데이터 분리 확인</h2>
              <p className="text-sm text-slate-500">business_contracts와 b2b_deliveries를 새 배송업체 도메인과 분리해 봅니다.</p>
            </div>
            <div className="flex gap-2">
              <TabButton active={tab === 'contracts'} onClick={() => setTab('contracts')}>계약</TabButton>
              <TabButton active={tab === 'deliveries'} onClick={() => setTab('deliveries')}>배송 요청</TabButton>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400">불러오는 중...</div>
          ) : tab === 'contracts' ? (
            <ContractsTable items={contracts} saving={saving} onStatusChange={updateStatus} />
          ) : (
            <DeliveriesTable items={deliveries} saving={saving} onStatusChange={updateStatus} />
          )}
        </section>
      </div>
    </div>
  );
}

function ContractsTable({
  items,
  saving,
  onStatusChange,
}: {
  items: EnterpriseContract[];
  saving: string | null;
  onStatusChange: (targetType: 'contract', targetId: string, status: string) => Promise<void>;
}) {
  if (items.length === 0) {
    return <div className="py-16 text-center text-sm text-slate-400">기업고객 계약 데이터가 없습니다.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">기업</th>
            <th className="px-4 py-3 text-left">계약</th>
            <th className="px-4 py-3 text-left">연락처</th>
            <th className="px-4 py-3 text-left">기간</th>
            <th className="px-4 py-3 text-left">상태 변경</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-4 align-top">
                <p className="font-semibold text-slate-900">{item.companyName}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">{item.businessId || item.id}</p>
                <p className="mt-1 text-xs text-slate-500">{item.registrationNumber || '-'}</p>
              </td>
              <td className="px-4 py-4 align-top">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
                <p className="mt-2 text-xs text-slate-500">tier: {item.tier}</p>
                <p className="text-xs text-slate-500">billing: {item.billingMethod}</p>
              </td>
              <td className="px-4 py-4 align-top text-xs text-slate-600">
                <p>{item.contact || '-'}</p>
                <p>{item.email || '-'}</p>
                <p className="mt-1 max-w-[220px] truncate">{item.address || '-'}</p>
              </td>
              <td className="px-4 py-4 align-top text-xs text-slate-500">
                <p>{formatDate(item.startAt)}</p>
                <p>~ {formatDate(item.endAt)}</p>
              </td>
              <td className="px-4 py-4 align-top">
                <div className="flex flex-wrap gap-2">
                  {CONTRACT_STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      onClick={() => void onStatusChange('contract', item.id, status)}
                      disabled={saving === `contract:${item.id}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliveriesTable({
  items,
  saving,
  onStatusChange,
}: {
  items: EnterpriseDelivery[];
  saving: string | null;
  onStatusChange: (targetType: 'delivery', targetId: string, status: string) => Promise<void>;
}) {
  if (items.length === 0) {
    return <div className="py-16 text-center text-sm text-slate-400">기업고객 배송 요청 데이터가 없습니다.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">배송</th>
            <th className="px-4 py-3 text-left">구간</th>
            <th className="px-4 py-3 text-right">금액</th>
            <th className="px-4 py-3 text-left">일정</th>
            <th className="px-4 py-3 text-left">상태 변경</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-4 align-top">
                <p className="font-mono text-xs text-slate-500">{item.id}</p>
                <p className="mt-1 text-xs text-slate-500">contract: {item.contractId || '-'}</p>
                <p className="text-xs text-slate-500">giller: {item.gillerId || '-'}</p>
              </td>
              <td className="px-4 py-4 align-top text-xs text-slate-600">
                <p className="max-w-[220px] truncate">{item.pickupLabel}</p>
                <p className="text-slate-400">↓</p>
                <p className="max-w-[220px] truncate">{item.dropoffLabel}</p>
                {item.notes ? <p className="mt-1 max-w-[220px] truncate text-slate-400">{item.notes}</p> : null}
              </td>
              <td className="px-4 py-4 text-right align-top">
                <p className="font-semibold text-slate-900">{formatKRW(item.totalFee)}</p>
                <p className="text-xs text-slate-500">길러 {formatKRW(item.gillerEarning)}</p>
              </td>
              <td className="px-4 py-4 align-top text-xs text-slate-500">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
                <p className="mt-2">{formatDate(item.scheduledTime)}</p>
                <p>{item.type} · {item.weight}kg</p>
              </td>
              <td className="px-4 py-4 align-top">
                <div className="flex flex-wrap gap-2">
                  {DELIVERY_STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      onClick={() => void onStatusChange('delivery', item.id, status)}
                      disabled={saving === `delivery:${item.id}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold ${
        active ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
