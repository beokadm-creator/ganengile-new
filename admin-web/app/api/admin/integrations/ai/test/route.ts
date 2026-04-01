import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';
import { runZaiChatCompletion } from '@/lib/ai/zai';

const PRIVATE_DOC_PATH = ['admin_settings', 'ai'] as const;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const db = getAdminDb();
  const snap = await db.collection(PRIVATE_DOC_PATH[0]).doc(PRIVATE_DOC_PATH[1]).get();
  const config = (snap.data() ?? {}) as Record<string, unknown>;

  const apiKey = asString(config.apiKey).trim();
  const baseUrl = asString(config.baseUrl, 'https://api.z.ai/api/paas/v4').trim();
  const model = asString(body.model, asString(config.model, 'glm-4.7-flash')).trim();
  const prompt = asString(body.prompt, '간단히 OK만 답해주세요.').trim();
  const disableThinking = Boolean(body.disableThinking ?? config.disableThinking ?? true);

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'API Key가 저장되어 있지 않습니다.' }, { status: 400 });
  }

  const result = await runZaiChatCompletion({
    apiKey,
    baseUrl,
    model,
    prompt,
    disableThinking,
    maxTokens: 128,
    temperature: 0.1,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
