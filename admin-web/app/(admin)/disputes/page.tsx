'use client';

import { useEffect, useState } from 'react';
import { formatDate, statusLabel, statusColor } from '@/lib/format';

interface Dispute {
  id: string;
  reporterId: string;
  reporterType: 'requester' | 'giller';
  requestId: string;
  type: 'damage' | 'loss' | 'quality';
  description: string;
  photoUrls: string[];
  status: string;
  createdAt: { seconds: number } | string;
  resolution?: {
    responsibility: string;
    compensation: number;
    note: string;
  };
}

const DISPUTE_TYPE_LABEL: Record<string, string> = {
  damage: '파손',
  loss: '분실',
  quality: '품질 문제',
};

const REPORTER_LABEL: Record<string, string> = {
  requester: '요청자',
  giller: '길러',
};

export default function DisputesPage() {
  const [tab, setTab] = useState<'pending' | 'resolved'>('pending');
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [form, setForm] = useState({ responsibility: 'giller', compensation: '', note: '' });
  const [processing, setProcessing] = useState(false);

  async function loadData(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/disputes?status=${status}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(tab); }, [tab]);

  async function handleResolve() {
    if (!selected) return;
    setProcessing(true);
    try {
      await fetch('/api/admin/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: selected.id,
          responsibility: form.responsibility,
          compensation: Number(form.compensation) || 0,
          note: form.note,
        }),
      });
      setSelected(null);
      setForm({ responsibility: 'giller', compensation: '', note: '' });
      await loadData(tab);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">⚖️ 분쟁 처리</h1>
        <p className="text-gray-500 text-sm mt-1">배송 관련 분쟁을 검토하고 처리합니다.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {(['pending', 'resolved'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s === 'pending' ? '처리 대기' : '처리 완료'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">로딩중...</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-lg">분쟁 내역이 없습니다. 👍</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-left">요청 ID</th>
                <th className="px-4 py-3 text-left">신고자</th>
                <th className="px-4 py-3 text-left">분쟁 유형</th>
                <th className="px-4 py-3 text-left">내용 (요약)</th>
                <th className="px-4 py-3 text-left">신고일</th>
                <th className="px-4 py-3 text-left">상태</th>
                {tab === 'pending' && <th className="px-4 py-3 text-left">액션</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{item.requestId?.slice(0, 10)}...</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      item.reporterType === 'requester' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {REPORTER_LABEL[item.reporterType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs">
                      {DISPUTE_TYPE_LABEL[item.type] ?? item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{item.description}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  {tab === 'pending' && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(item)}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-indigo-700"
                      >
                        처리하기
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Process Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4">분쟁 처리</h2>

              {/* Dispute Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">요청 ID</span>
                  <span className="font-mono text-xs">{selected.requestId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">신고자</span>
                  <span>{REPORTER_LABEL[selected.reporterType]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">분쟁 유형</span>
                  <span className="text-red-600 font-medium">{DISPUTE_TYPE_LABEL[selected.type]}</span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1 font-medium">신고 내용</p>
                <p className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-sm text-gray-700">
                  {selected.description}
                </p>
              </div>

              {/* Photos */}
              {selected.photoUrls?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">첨부 사진 ({selected.photoUrls.length}장)</p>
                  <div className="flex gap-2 flex-wrap">
                    {selected.photoUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                         className="bg-gray-100 border rounded px-3 py-1 text-xs text-blue-600 hover:underline">
                        사진 {i + 1} 보기
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution Form */}
              <div className="border-t pt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">책임 소재</label>
                  <select
                    value={form.responsibility}
                    onChange={(e) => setForm({ ...form, responsibility: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="giller">길러 책임</option>
                    <option value="requester">요청자 책임</option>
                    <option value="system">시스템/기타 (보상 없음)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">보상금 (원)</label>
                  <input
                    type="number"
                    value={form.compensation}
                    onChange={(e) => setForm({ ...form, compensation: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">처리 메모</label>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    rows={3}
                    placeholder="처리 사유 및 결정 내용을 입력하세요."
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleResolve}
                  disabled={processing}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {processing ? '처리중...' : '결정 저장'}
                </button>
                <button
                  onClick={() => setSelected(null)}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
