type JsonSchema = Record<string, unknown>;

type OpenAIJsonParams = {
  instructions: string;
  input: string;
  schemaName: string;
  schema: JsonSchema;
  maxOutputTokens?: number;
};

export async function createOpenAIJsonResponse<T>({
  instructions,
  input,
  schemaName,
  schema,
  maxOutputTokens = 1800,
}: OpenAIJsonParams): Promise<T> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error('OPENAI_API_KEYが未設定です。');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_TEXT_MODEL') ?? 'gpt-5.4-nano',
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      reasoning: {
        effort: 'low',
      },
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const outputText = readOpenAIOutputText(payload);

  if (!outputText) {
    throw new Error('OpenAIのJSON出力を読み取れませんでした。');
  }

  return JSON.parse(outputText) as T;
}

function readOpenAIOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string') {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    return null;
  }

  const chunks: string[] = [];

  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (!isRecord(content)) {
        continue;
      }

      if (content.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }

  return chunks.length > 0 ? chunks.join('') : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
