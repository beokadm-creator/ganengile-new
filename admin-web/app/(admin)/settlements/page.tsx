'use client';

import { useEffect, useState } from 'react';
import { formatKRW, formatDate, statusLabel, statusColor } from '@/lib/format';

interface Settlement {
  id: string;
  requestId: string;
  deliveryId?: string;
  gillerId?: string;
  requesterId?: string;
  status: string;
  depositId?: string | null;
  depositAmount?: number | null;
  refundStatus?: string | null;
  earningPaymentId?: string | null;
  earningAmount?: number | null;
  customerPaidAmount?: number | null;
  publicFareAmount?: number | null;
  vatAmount?: number | null;
  feeSupplyAmount?: number | null;
  platformServiceFeeAmount?: number | null;
  platformFeeAmount?: number | null;
  gillerGrossAmount?: number | null;
  gillerWithholdingTaxAmount?: number | null;
  gillerNetAmount?: number | null;
  errorMessage?: string | null;
  createdAt?: { seconds: number } | string;
  settledAt?: { seconds: number } | string;
  updatedAt?: { seconds: number } | string;
}

const TABS = ['processing', 'completed', 'failed'] as const;

export default function SettlementsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('processing');
  const [items, setItems] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  async function loadData(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/settlements?status=${status}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(tab);
  }, [tab]);

  async function openDetail(requestId?: string) {
    if (!requestId) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/fee`);
      if (!res.ok) {
        throw new Error('상세 정보를 불러올 수 없습니다.');
      }
      const json = await res.json();
      setDetail(json);
    } catch (error: any) {
      setDetailError(error?.message || '상세 정보를 불러올 수 없습니다.');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailOpen(false);
    setDetail(null);
    setDetailError(null);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">💰 정산/환급 로그</h1>
        <p className="text-gray-500 text-sm mt-1">수령 확인 이후 정산 및 보증금 환급 내역을 확인합니다.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">로딩중...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg">내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[1680px]">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-left">요청 ID</th>
                <th className="px-4 py-3 text-left">길러 UID</th>
                <th className="px-4 py-3 text-left">요청자 UID</th>
                <th className="px-4 py-3 text-right">고객 결제</th>
                <th className="px-4 py-3 text-right">공급가액</th>
                <th className="px-4 py-3 text-right">VAT</th>
                <th className="px-4 py-3 text-right">운임(전달금)</th>
                <th className="px-4 py-3 text-right">플랫폼 수수료</th>
                <th className="px-4 py-3 text-right">보증금</th>
                <th className="px-4 py-3 text-left">환급 상태</th>
                <th className="px-4 py-3 text-right">길러 정산(세전)</th>
                <th className="px-4 py-3 text-right">원천세(3.3%)</th>
                <th className="px-4 py-3 text-right">길러 실지급</th>
                <th className="px-4 py-3 text-left">요금 상세</th>
                <th className="px-4 py-3 text-left">상태</th>
                <th className="px-4 py-3 text-left">생성일</th>
                <th className="px-4 py-3 text-left">정산일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{item.requestId?.slice(0, 10)}...</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.gillerId?.slice(0, 10)}...</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.requesterId?.slice(0, 10)}...</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {typeof item.customerPaidAmount === 'number' ? formatKRW(item.customerPaidAmount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {typeof item.feeSupplyAmount === 'number' ? formatKRW(item.feeSupplyAmount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {typeof item.vatAmount === 'number' ? formatKRW(item.vatAmount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {typeof item.publicFareAmount === 'number' ? formatKRW(item.publicFareAmount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-indigo-600">
                    {typeof item.platformFeeAmount === 'number' ? formatKRW(item.platformFeeAmount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {typeof item.depositAmount === 'number' ? formatKRW(item.depositAmount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {item.refundStatus ? statusLabel(item.refundStatus) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {typeof item.gillerGrossAmount === 'number' ? formatKRW(item.gillerGrossAmount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {typeof item.gillerWithholdingTaxAmount === 'number' ? formatKRW(item.gillerWithholdingTaxAmount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">
                    {typeof item.gillerNetAmount === 'number' ? formatKRW(item.gillerNetAmount) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDetail(item.requestId)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      보기
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.createdAt ? formatDate(item.createdAt) : '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.settledAt ? formatDate(item.settledAt) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[720px] max-w-[92vw] rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">요금 상세</h2>
              <button onClick={closeDetail} className="text-gray-500 hover:text-gray-700">닫기</button>
            </div>
            {detailLoading ? (
              <div className="text-gray-500 text-sm">불러오는 중...</div>
            ) : detailError ? (
              <div className="text-red-500 text-sm">{detailError}</div>
            ) : detail ? (
              <div className="space-y-4 text-sm">
                {detail.settlement ? (
                  <div className="border rounded-lg p-3 bg-amber-50 border-amber-100">
                    <div className="text-xs text-amber-700 mb-2">정산/세무 로그</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>고객 결제: {formatKRW(detail.settlement.customerPaidAmount ?? 0)}</div>
                      <div>공급가액: {formatKRW(detail.settlement.feeSupplyAmount ?? 0)}</div>
                      <div>VAT: {formatKRW(detail.settlement.vatAmount ?? 0)}</div>
                      <div>운임(전달금): {formatKRW(detail.settlement.publicFareAmount ?? 0)}</div>
                      <div>플랫폼 수수료: {formatKRW(detail.settlement.platformFeeAmount ?? 0)}</div>
                      <div>길러 정산(세전): {formatKRW(detail.settlement.gillerGrossAmount ?? 0)}</div>
                      <div>원천세(3.3%): {formatKRW(detail.settlement.gillerWithholdingTaxAmount ?? 0)}</div>
                      <div>길러 실지급: {formatKRW(detail.settlement.gillerNetAmount ?? 0)}</div>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-gray-500 text-xs">경로</div>
                    <div className="font-medium">
                      {detail.pickupStation?.stationName ?? '-'} → {detail.deliveryStation?.stationName ?? '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">긴급도</div>
                    <div className="font-medium">{detail.urgency ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">패키지</div>
                    <div className="font-medium">
                      {detail.packageInfo?.size ?? '-'} / {detail.packageInfo?.weight ?? '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">물건 가치</div>
                    <div className="font-medium">
                      {typeof detail.itemValue === 'number' ? formatKRW(detail.itemValue) : '-'}
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="text-xs text-gray-500 mb-2">배송비 구성</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>기본: {formatKRW(detail.feeBreakdown?.baseFee ?? 0)}</div>
                    <div>거리: {formatKRW(detail.feeBreakdown?.distanceFee ?? 0)}</div>
                    <div>무게: {formatKRW(detail.feeBreakdown?.weightFee ?? 0)}</div>
                    <div>크기: {formatKRW(detail.feeBreakdown?.sizeFee ?? 0)}</div>
                    <div>긴급: {formatKRW(detail.feeBreakdown?.urgencySurcharge ?? 0)}</div>
                    <div>운임: {formatKRW(detail.feeBreakdown?.publicFare ?? 0)}</div>
                    <div>수수료: {formatKRW(detail.feeBreakdown?.serviceFee ?? 0)}</div>
                    <div>VAT: {formatKRW(detail.feeBreakdown?.vat ?? 0)}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between font-semibold">
                    <span>합계</span>
                    <span>{formatKRW(detail.feeBreakdown?.totalFee ?? detail.initialNegotiationFee ?? 0)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
