export type ZaiChatRequest = {
  apiKey: string;
  provider?: string;
  baseUrl: string;
  model: string;
  prompt: string;
  disableThinking?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export type ZaiChatResult = {
  ok: boolean;
  status: number;
  latencyMs: number;
  model: string;
  requestId?: string;
  content?: string;
  raw?: unknown;
  error?: string;
  details?: unknown;
};

function readMessageContent(content: unknown): string | undefined {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return undefined;
  }

  return (
    content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        const record = part as Record<string, unknown>;
        if (typeof record.text === 'string') return record.text;
        if (typeof record.content === 'string') return record.content;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim() || undefined
  );
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function toCodingBaseUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.replace('/api/paas/v4/chat/completions', '/api/coding/paas/v4/chat/completions');
}

function shouldRetryWithCodingBase(input: ZaiChatRequest, responseJson: Record<string, unknown>): boolean {
  if ((input.provider ?? 'zai') !== 'zai') return false;
  const normalized = normalizeBaseUrl(input.baseUrl);
  if (!normalized.includes('/api/paas/v4/chat/completions')) return false;
  const error = responseJson.error as Record<string, unknown> | undefined;
  const code = typeof error?.code === 'string' ? error.code : '';
  return code === '1113';
}

async function performChatCompletion(
  input: ZaiChatRequest,
  resolvedBaseUrl: string
): Promise<ZaiChatResult> {
  const startedAt = Date.now();
  const requestBody: Record<string, unknown> = {
    model: input.model,
    messages: [
      {
        role: 'user',
        content: input.prompt,
      },
    ],
    max_tokens: input.maxTokens ?? 256,
    temperature: input.temperature ?? 0.1,
  };

  if ((input.provider ?? 'zai') === 'zai') {
    requestBody.thinking = {
      type: input.disableThinking === false ? 'enabled' : 'disabled',
    };
  }

  const response = await fetch(resolvedBaseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    cache: 'no-store',
  });

  const latencyMs = Date.now() - startedAt;
  const json = (await response.json()) as Record<string, unknown>;
  const choices = Array.isArray(json.choices) ? json.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const error = json.error as Record<string, unknown> | undefined;

  return {
    ok: response.ok,
    status: response.status,
    latencyMs,
    model: typeof json.model === 'string' ? json.model : input.model,
    requestId: typeof json.request_id === 'string' ? json.request_id : undefined,
    content: response.ok ? readMessageContent(message?.content) : undefined,
    raw: response.ok ? json : undefined,
    error: !response.ok
      ? typeof error?.message === 'string'
        ? error.message
        : 'GLM 요청이 실패했습니다.'
      : undefined,
    details: !response.ok ? json : undefined,
  };
}

export async function runZaiChatCompletion(input: ZaiChatRequest): Promise<ZaiChatResult> {
  const primary = await performChatCompletion(input, normalizeBaseUrl(input.baseUrl));
  if (!primary.ok && primary.details && shouldRetryWithCodingBase(input, primary.details as Record<string, unknown>)) {
    const retried = await performChatCompletion(input, toCodingBaseUrl(input.baseUrl));
    if (retried.ok) {
      return retried;
    }
  }
  return primary;
}
