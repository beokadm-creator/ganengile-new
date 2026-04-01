import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

const PRIVATE_DOC_PATH = ['admin_settings', 'ai'] as const;
const PUBLIC_DOC_PATH = ['config_integrations', 'ai'] as const;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function defaultPayload() {
  return {
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
    visionPrompt:
      '물품 사진과 요청 컨텍스트를 분석해 설명, 카테고리, 가치, 무게, 크기 후보를 JSON으로 제안하세요.',
    pricingPrompt:
      '요청 위험도, 이동 거리, 참여 방식, 물품 특성을 반영해 가격과 보증금 가이드를 JSON으로 제안하세요.',
    missionPrompt:
      '요청을 DeliveryLeg와 Mission 단위로 분해하고, 필요 시 MissionBundle과 actor selection 판단을 제안하세요.',
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
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection(PRIVATE_DOC_PATH[0]).doc(PRIVATE_DOC_PATH[1]).get();

  if (!snap.exists) {
    return NextResponse.json({ item: defaultPayload() });
  }

  const data = snap.data() ?? {};
  return NextResponse.json({
    item: {
      ...defaultPayload(),
      ...data,
      autoFillFields: {
        ...defaultPayload().autoFillFields,
        ...((data.autoFillFields as Record<string, boolean> | undefined) ?? {}),
      },
    },
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const bodyAutoFill = (body.autoFillFields as Record<string, unknown> | undefined) ?? {};

  const privatePayload = {
    enabled: Boolean(body.enabled ?? false),
    provider: asString(body.provider, 'zai').trim(),
    apiKey: asString(body.apiKey).trim(),
    baseUrl: asString(body.baseUrl, 'https://api.z.ai/api/paas/v4').trim(),
    model: asString(body.model, 'glm-4.7').trim(),
    analysisModel: asString(body.analysisModel, asString(body.model, 'glm-4.7')).trim(),
    pricingModel: asString(body.pricingModel, asString(body.model, 'glm-4.7')).trim(),
    missionModel: asString(body.missionModel, asString(body.model, 'glm-4.7')).trim(),
    confidenceThreshold: Math.min(1, Math.max(0, Number(body.confidenceThreshold ?? 0.75))),
    fallbackMode: asString(body.fallbackMode, 'manual').trim(),
    disableThinking: Boolean(body.disableThinking ?? true),
    visionPrompt: asString(body.visionPrompt).trim(),
    pricingPrompt: asString(body.pricingPrompt).trim(),
    missionPrompt: asString(body.missionPrompt).trim(),
    autoFillFields: {
      itemName: Boolean(bodyAutoFill.itemName ?? true),
      category: Boolean(bodyAutoFill.category ?? true),
      description: Boolean(bodyAutoFill.description ?? true),
      estimatedValue: Boolean(bodyAutoFill.estimatedValue ?? true),
      estimatedWeight: Boolean(bodyAutoFill.estimatedWeight ?? true),
      estimatedSize: Boolean(bodyAutoFill.estimatedSize ?? true),
      depositSuggestion: Boolean(bodyAutoFill.depositSuggestion ?? true),
      startingPriceSuggestion: Boolean(bodyAutoFill.startingPriceSuggestion ?? true),
    },
    updatedAt: new Date(),
  };

  const publicPayload = {
    enabled: privatePayload.enabled,
    provider: privatePayload.provider,
    baseUrl: privatePayload.baseUrl,
    model: privatePayload.model,
    analysisModel: privatePayload.analysisModel,
    pricingModel: privatePayload.pricingModel,
    missionModel: privatePayload.missionModel,
    confidenceThreshold: privatePayload.confidenceThreshold,
    fallbackMode: privatePayload.fallbackMode,
    disableThinking: privatePayload.disableThinking,
    autoFillFields: privatePayload.autoFillFields,
    updatedAt: new Date(),
  };

  const db = getAdminDb();
  await db.collection(PRIVATE_DOC_PATH[0]).doc(PRIVATE_DOC_PATH[1]).set(privatePayload, { merge: true });
  await db.collection(PUBLIC_DOC_PATH[0]).doc(PUBLIC_DOC_PATH[1]).set(publicPayload, { merge: true });

  return NextResponse.json({
    ok: true,
    item: privatePayload,
  });
}
