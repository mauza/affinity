// Server-side chat calls through the home LiteLLM gateway (OpenAI-compatible).
// The ChatGPT-backed routes ignore response_format, so the schema also goes in
// the prompt and the reply is parsed defensively (one retry on bad JSON).
import { config } from "../config";

async function once(opts: { model: string; system: string; user: string; name: string; schema: object; timeoutMs: number }) {
  const res = await fetch(`${config.llmUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.llmApiKey}` },
    signal: AbortSignal.timeout(opts.timeoutMs),
    body: JSON.stringify({
      model: opts.model,
      messages: [
        {
          role: "system",
          content: `${opts.system}\n\nRespond with only one JSON object (no prose, no code fences) matching this JSON Schema:\n${JSON.stringify(opts.schema)}`,
        },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: opts.name, schema: opts.schema, strict: true } },
    }),
  });
  if (!res.ok) throw new Error(`llm ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body: any = await res.json();
  const content: string = body.choices?.[0]?.message?.content ?? "";
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) throw new SyntaxError(`no JSON in reply: ${content.slice(0, 120)}`);
  return JSON.parse(content.slice(start, end + 1));
}

export async function chatJson<T>(opts: {
  model: string;
  system: string;
  user: string;
  name: string;
  schema: object;
  timeoutMs?: number;
}): Promise<T> {
  const o = { ...opts, timeoutMs: opts.timeoutMs ?? 30_000 };
  try {
    return (await once(o)) as T;
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    return (await once(o)) as T;
  }
}
