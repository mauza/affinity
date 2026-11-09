<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Affinity

Plan: `docs/plans/mvp.md`. Next.js 16 app + API routes; Elasticsearch is the only datastore.

- `lib/` domain code (ES queries, privacy floor, presence stints, tables, alerts, AI). `app/api/*` thin routes over it.
- Every interest-derived count goes through `floorCount()` (0 = none, 1 = "a few", n >= 3 = n). Never return raw text, private interests or names of people who didn't opt in.
- Times are MST (`lib/time.ts`). Simulated docs carry `source: "sim"`; `?live=1` excludes them.
- Dev: port-forward ES (`kubectl --context default -n kubecon port-forward svc/elasticsearch 19200:9200`), set env from `.env.example`, `pnpm dev`. Tests: `pnpm test`, `pnpm typecheck`.
- Deploy: merge to `main`; CI pushes `docker.mau.guru/affinity/app:<timestamp>`, Argo Image Updater rolls it out. Manifests live in home-k8s `apps/kubecon/`.
