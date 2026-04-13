'use client';

import { useState } from 'react';

export default function TaxIntegrationPage() {
  const [provider, setProvider] = useState('volta');
  const [apiKey, setApiKey] = useState('');
  const [corpNum, setCorpNum] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // API 연동 키 저장 시뮬레이션
    setTimeout(() => {
      alert('세금/정산 API 설정이 저장되었습니다. 이제 정산 스케줄러가 이 설정을 참조합니다.');
      setSaving(false);
    }, 800);
  };

  const handleTestIssue = async () => {
    try {
      const res = await fetch('/api/admin/integrations/tax/test', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        alert(`API 테스트 성공!\n송장 ID: ${json.invoiceId}\n${provider === 'volta' ? '볼타' : '팝빌'} 샌드박스로 테스트 세금계산서 역발행 요청이 전송되었습니다.`);
      } else {
        alert(`API 테스트 실패: ${json.error}`);
      }
    } catch (e) {
      alert('테스트 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">세금계산서 / 원천세 API 연동</h1>
        <p className="mt-1 text-sm text-gray-500">
          볼타(Volta), 팝빌 등 외부 세무 자동화 솔루션의 API 키를 입력하여 월별 자동 정산/신고를 활성화합니다.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">API 서비스 선택</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <label className={`cursor-pointer rounded-lg border p-4 flex items-center gap-3 ${provider === 'volta' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input type="radio" name="provider" value="volta" checked={provider === 'volta'} onChange={() => setProvider('volta')} className="w-4 h-4 text-blue-600" />
            <div>
              <div className="font-bold text-gray-900">볼타 (Volta)</div>
              <div className="text-xs text-gray-500">스타트업 특화, 세금계산서 역발행/정발행, 원천세 간편 신고 지원</div>
            </div>
          </label>
          <label className={`cursor-pointer rounded-lg border p-4 flex items-center gap-3 ${provider === 'popbill' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input type="radio" name="provider" value="popbill" checked={provider === 'popbill'} onChange={() => setProvider('popbill')} className="w-4 h-4 text-blue-600" />
            <div>
              <div className="font-bold text-gray-900">팝빌 (Popbill)</div>
              <div className="text-xs text-gray-500">전통적인 전자세금계산서/현금영수증/휴폐업조회 등 통합 지원</div>
            </div>
          </label>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API 연동 키 (Secret / Token)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2"
              placeholder={`${provider === 'volta' ? '볼타 API 키를 입력하세요' : '팝빌 연동 토큰을 입력하세요'}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">플랫폼 사업자등록번호 (본사)</label>
            <input
              type="text"
              value={corpNum}
              onChange={(e) => setCorpNum(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2"
              placeholder="숫자만 입력하세요 (예: 1234567890)"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button
            onClick={handleTestIssue}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
          >
            연동 테스트 (샌드박스)
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-gray-50 p-6 text-sm text-gray-600 space-y-2">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          💡 자동화 파이프라인 작동 방식
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>전문 배송업체 (B2B):</strong> 매월 5일, 파트너별 월간 합산 공급가액/부가세를 기준으로 해당 API를 통해 <strong>매입 세금계산서 역발행</strong>이 자동 요청됩니다. 파트너가 홈택스에서 승인하면 즉시 정산이 실행됩니다.</li>
          <li><strong>일반 길러 (C2C):</strong> 매월 10일 전, 전월 3.3% 사업소득 지급분에 대한 <strong>원천징수 이행상황신고서 및 지급명세서</strong> 데이터가 세무 API를 통해 자동 전송됩니다.</li>
        </ul>
      </div>
    </div>
  );
}