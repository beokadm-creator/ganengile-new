'use client';

import { useEffect, useState } from 'react';

type AlimtalkSettings = {
  appKey: string;
  secretKey: string;
  senderKey: string;
  templates: {
    newMission: string;
    requestAccepted: string;
    deliveryCompleted: string;
  };
};

export default function AlimtalkIntegrationPage() {
  const [settings, setSettings] = useState<AlimtalkSettings>({
    appKey: '',
    secretKey: '',
    senderKey: '',
    templates: {
      newMission: 'NEW_MISSION_V1',
      requestAccepted: 'REQUEST_ACCEPTED_V1',
      deliveryCompleted: 'DELIVERY_COMPLETED_V1',
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/integrations/alimtalk');
      if (response.ok) {
        const data = await response.json();
        setSettings({
          appKey: data.appKey || '',
          secretKey: data.secretKey || '',
          senderKey: data.senderKey || '',
          templates: {
            newMission: data.templates?.newMission || 'NEW_MISSION_V1',
            requestAccepted: data.templates?.requestAccepted || 'REQUEST_ACCEPTED_V1',
            deliveryCompleted: data.templates?.deliveryCompleted || 'DELIVERY_COMPLETED_V1',
          },
        });
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/integrations/alimtalk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: '알림톡 설정이 안전하게 저장되었습니다.' });
      } else {
        const err = await response.json();
        setMessage({ type: 'error', text: `저장 실패: ${err.error || '알 수 없는 오류'}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `저장 실패: ${err.message}` });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8">설정을 불러오는 중...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">NHN Cloud 카카오 알림톡 연동</h1>
        <p className="mt-2 text-sm text-gray-600">
          앱 푸시 알림(FCM)이 실패했을 때 백업으로 전송될 알림톡 API 키와 템플릿 코드를 관리합니다.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-lg p-4 ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* 인증 정보 섹션 */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">API 인증 정보 (Secret)</h2>
            <p className="mt-1 text-sm text-gray-500">
              NHN Cloud 콘솔에서 발급받은 알림톡 API 인증 키를 입력하세요.
            </p>
          </div>
          <div className="space-y-6 p-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">App Key</label>
              <input
                type="text"
                value={settings.appKey}
                onChange={(e) => setSettings({ ...settings, appKey: e.target.value })}
                placeholder="예: xxxxxxx"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Secret Key</label>
              <input
                type="password"
                value={settings.secretKey}
                onChange={(e) => setSettings({ ...settings, secretKey: e.target.value })}
                placeholder="보안을 위해 암호 형식으로 입력됩니다"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sender Key (발신 프로필 키)</label>
              <input
                type="text"
                value={settings.senderKey}
                onChange={(e) => setSettings({ ...settings, senderKey: e.target.value })}
                placeholder="예: xxxxxxxxxxxxxxxxxxxxx"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 템플릿 코드 섹션 */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">알림톡 템플릿 코드 매핑</h2>
            <p className="mt-1 text-sm text-gray-500">
              NHN Cloud 콘솔에 승인된 카카오 알림톡 템플릿 코드를 입력하세요.
            </p>
          </div>
          <div className="space-y-6 p-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">새로운 미션 (배송 매칭 알림)</label>
              <p className="text-xs text-gray-500 mb-2">변수: {'#{pickup}, #{dropoff}, #{reward}'}</p>
              <input
                type="text"
                value={settings.templates.newMission}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    templates: { ...settings.templates, newMission: e.target.value },
                  })
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">배송 요청 수락 (고객용)</label>
              <p className="text-xs text-gray-500 mb-2">변수: {'#{gillerName}'}</p>
              <input
                type="text"
                value={settings.templates.requestAccepted}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    templates: { ...settings.templates, requestAccepted: e.target.value },
                  })
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">배송 완료 (고객용)</label>
              <p className="text-xs text-gray-500 mb-2">변수: {'#{gillerName}'}</p>
              <input
                type="text"
                value={settings.templates.deliveryCompleted}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    templates: { ...settings.templates, deliveryCompleted: e.target.value },
                  })
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '설정 저장하기'}
          </button>
        </div>
      </form>
    </div>
  );
}