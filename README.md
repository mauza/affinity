<img src="assets/icon.svg" width="64" height="64" alt="">

# Affinity

**Find your pod.** A live map of where like-minded people gather at KubeCon + CloudNativeCon North America 2026 (Salt Lake City), built for the [Cloud Native Hackathon](https://www.wemakedevs.org/hackathons/cnh).

Describe your interests in your own words, get a crowd-aware session plan, check in to an area of the venue, and say you're open to connect. Every attendee who joins makes the map, the planner, and the pop-up topic tables better for everyone else. Press play on **the murmuration** to watch the whole conference flow through the day.

- Plan: [docs/plans/mvp.md](docs/plans/mvp.md)
- Host: https://affinity.mau.guru
- Stack: Next.js, Elasticsearch (the only datastore), Kubernetes, direct A770 embeddings; chat via LiteLLM

## Run locally

Use Node 22+ and `pnpm install --frozen-lockfile`. Copy `.env.example` to `.env.local` and fill credentials privately from your secret store. Forward Elasticsearch, embeddings, and chat in separate terminals:

```sh
kubectl --context default -n kubecon port-forward svc/elasticsearch 19200:9200
kubectl --context default -n llm-gateway port-forward svc/embed-a770 18000:8000
kubectl --context default -n llm-gateway port-forward svc/litellm-proxy 14000:4000
```

Run `pnpm dev -p 3100`. Routes: `/` interests, `/map` live/planned/replay maps, `/plan` agenda, `/tables` connection topics and alerts, `/me` privacy controls, `/lobby` kiosk.

CLI jobs read exported environment variables (not Next's `.env.local`). With credentials exported, run `pnpm bootstrap` to import committed data. `ES_EMBED_URL` is the address Elasticsearch calls from inside Kubernetes; keep its in-cluster default when forwarding the cluster ES locally. Query-time embeddings go directly to the A770; chat stays on LiteLLM.

`pnpm exec tsx scripts/tag-sessions.ts` regenerates the committed AI topic snapshot; bootstrap then imports it without another AI call. See [sim/README.md](sim/README.md) for labeled synthetic backfill and live simulation.

## Verify and deliver

`pnpm test`, `pnpm exec next typegen && pnpm typecheck`, and `pnpm build`. The image includes the app plus bootstrap, retention, and simulator jobs.

GitOps manifests live in `~/Projects/home-k8s/apps/kubecon/`. Release CI publishes the app image after merge; Argo Image Updater deploys it. Local integration does not deploy automatically.

AI assisted development and session tagging. Generated agendas are validated against the real schedule, time conflicts, and meal windows. Attendees confirm interest suggestions. The replay and map explicitly label synthetic attendees; `live=1` excludes them.

Schedule data © The Linux Foundation, from the [public KubeCon NA 2026 schedule](https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/).
