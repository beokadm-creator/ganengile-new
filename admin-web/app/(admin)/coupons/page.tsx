'use client';

import { useEffect, useState } from 'react';
import { formatKRW, formatDate } from '@/lib/format';

interface Coupon {
  id: string;
  name: string;
  description: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
  purpose: 'delivery_fee' | 'all';
  triggerEvent: 'none' | 'signup' | 'first_order' | 'manual';
  validDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function CouponsPage() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    discountType: 'fixed',
    discountValue: '',
    maxDiscountAmount: '',
    minOrderAmount: '',
    purpose: 'delivery_fee',
    triggerEvent: 'none',
    validDays: '30',
    isActive: true,
  });

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/coupons');
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.discountValue || !form.validDays) {
      alert('필수 항목을 입력해주세요.');
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error('쿠폰 생성 실패');
      
      setIsModalOpen(false);
      setForm({
        name: '',
        description: '',
        discountType: 'fixed',
        discountValue: '',
        maxDiscountAmount: '',
        minOrderAmount: '',
        purpose: 'delivery_fee',
        triggerEvent: 'none',
        validDays: '30',
        isActive: true,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    if (!confirm(`쿠폰을 ${currentStatus ? '비활성화' : '활성화'} 하시겠습니까?`)) return;
    
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });
      if (res.ok) await loadData();
    } catch (err) {
      alert('상태 변경에 실패했습니다.');
    }
  }

  async function issueManualCoupon(couponId: string) {
    const userId = prompt('쿠폰을 지급할 대상 회원의 ID (UID)를 입력하세요.');
    if (!userId) return;

    try {
      const res = await fetch('/api/admin/coupons/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId, userId }),
      });
      const json = await res.json();
      if (res.ok) {
        alert('쿠폰이 성공적으로 지급되었습니다.');
      } else {
        alert(`지급 실패: ${json.error}`);
      }
    } catch (err) {
      alert('지급 중 오류가 발생했습니다.');
    }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">쿠폰 관리</h1>
          <p className="mt-1 text-sm text-gray-500">전체 쿠폰 템플릿을 생성하고 관리합니다.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          새 쿠폰 생성
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">쿠폰명/설명</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">할인 혜택</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">최소/최대 조건</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">발급 조건</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상태/생성일</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.map((item) => (
              <tr key={item.id} className={!item.isActive ? 'opacity-50 bg-gray-50' : ''}>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.description || '-'}</div>
                  <div className="text-xs text-blue-600 mt-1">ID: {item.id}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">
                    {item.discountType === 'fixed' ? formatKRW(item.discountValue) : `${item.discountValue}%`} 할인
                  </div>
                  <div className="text-xs text-gray-500">목적: {item.purpose === 'delivery_fee' ? '배송비 전용' : '전체'}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div>최소: {item.minOrderAmount ? formatKRW(item.minOrderAmount) : '제한 없음'}</div>
                  <div>최대: {item.maxDiscountAmount ? formatKRW(item.maxDiscountAmount) : '제한 없음'}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div className="font-medium text-gray-700">
                    {item.triggerEvent === 'signup' ? '회원가입 시' : 
                     item.triggerEvent === 'first_order' ? '첫 주문 시' : 
                     item.triggerEvent === 'manual' ? '수동 발급 전용' : '트리거 없음'}
                  </div>
                  <div>유효기간: {item.validDays}일</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {item.isActive ? '활성' : '비활성'}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">{formatDate(item.createdAt)}</div>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => issueManualCoupon(item.id)}
                    disabled={!item.isActive}
                    className="text-sm font-medium text-blue-600 hover:text-blue-900 disabled:opacity-50"
                  >
                    수동 지급
                  </button>
                  <button
                    onClick={() => toggleStatus(item.id, item.isActive)}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    {item.isActive ? '중지' : '재개'}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  등록된 쿠폰이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 새 쿠폰 생성 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-100 p-6">
              <h2 className="text-xl font-bold text-gray-900">새 쿠폰 생성</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">쿠폰명 *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="예: 가입 환영 3천원 할인 쿠폰"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="사용자에게 보여질 상세 설명"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">할인 방식 *</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <option value="fixed">정액 할인 (원)</option>
                    <option value="percentage">정률 할인 (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">할인 금액/비율 *</label>
                  <input
                    type="number"
                    required
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    placeholder="예: 3000 또는 10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">최소 주문 금액</label>
                  <input
                    type="number"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    placeholder="없으면 비워둠"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">최대 할인 금액</label>
                  <input
                    type="number"
                    value={form.maxDiscountAmount}
                    onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                    placeholder="정률 할인일 때만 입력"
                    disabled={form.discountType === 'fixed'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">발급 트리거 *</label>
                  <select
                    value={form.triggerEvent}
                    onChange={(e) => setForm({ ...form, triggerEvent: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <option value="none">자동 발급 없음</option>
                    <option value="signup">회원 가입 시</option>
                    <option value="first_order">첫 주문 완료 시</option>
                    <option value="manual">수동 발급용</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유효 기간 (일) *</label>
                  <input
                    type="number"
                    required
                    value={form.validDays}
                    onChange={(e) => setForm({ ...form, validDays: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  {processing ? '생성 중...' : '생성하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}