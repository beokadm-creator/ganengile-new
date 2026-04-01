export type ZaiChatRequest = {
  apiKey: string;
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

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

export async function runZaiChatCompletion(input: ZaiChatRequest): Promise<ZaiChatResult> {
  const startedAt = Date.now();
  const response = await fetch(normalizeBaseUrl(input.baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        {
          role: 'user',
          content: input.prompt,
        },
      ],
      max_tokens: input.maxTokens ?? 256,
      temperature: input.temperature ?? 0.1,
      thinking: {
        type: input.disableThinking === false ? 'enabled' : 'disabled',
      },
    }),
    cache: 'no-store',
  });

  const latencyMs = Date.now() - startedAt;
  const json = (await response.json()) as Record<string, unknown>;
  const choices = Array.isArray(json.choices) ? json.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const error = json.error as Record<string, unknown> | undefined;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      latencyMs,
      model: input.model,
      error: typeof error?.message === 'string' ? error.message : 'GLM 요청이 실패했습니다.',
      details: json,
    };
  }

  return {
    ok: true,
    status: response.status,
    latencyMs,
    model: typeof json.model === 'string' ? json.model : input.model,
    requestId: typeof json.request_id === 'string' ? json.request_id : undefined,
    content: typeof message?.content === 'string' ? message.content : undefined,
    raw: json,
  };
}
