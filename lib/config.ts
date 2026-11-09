// Runtime configuration. Everything comes from env so the same image serves
// the app, the bootstrap Job and the crowd simulator.
const env = (k: string, d = "") => process.env[k] ?? d;

export const config = {
  esUrl: env("ES_URL", "http://elasticsearch.kubecon:9200"),
  esUsername: env("ES_USERNAME", "elastic"),
  esPassword: env("ES_PASSWORD"),
  // Embeddings go straight to llama.cpp on the A770 (no LiteLLM hop).
  embedUrl: env("EMBED_URL", "http://embed-a770.llm-gateway:8000/v1"),
  embedModel: env("EMBED_MODEL", "qwen3-embedding-0.6b"),
  // What Elasticsearch's inference endpoint calls (from inside the cluster).
  esEmbedUrl: env("ES_EMBED_URL", "http://embed-a770.llm-gateway:8000/v1"),
  llmUrl: env("LLM_URL", "http://litellm-proxy.llm-gateway:4000/v1"),
  llmApiKey: env("LLM_API_KEY"),
  refineModel: env("LLM_REFINE_MODEL", "gpt-6-luna"),
  planModel: env("LLM_PLAN_MODEL", "gpt-6.1-sol"),
  inferenceId: "affinity-embed",
  publicUrl: env("PUBLIC_URL", "https://affinity.mau.guru"),
};

/** Interest-derived counts below this show as "a few". */
export const K_FLOOR = 3;
/** Filters may OR at most this many interests (blocks narrowing attacks). */
export const MAX_FILTER_INTERESTS = 3;
/** A check-in lasts this long unless renewed. */
export const STINT_MINUTES = 30;
