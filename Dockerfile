# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG GIT_COMMIT=dev
ENV NEXT_TELEMETRY_DISABLED=1 GIT_COMMIT=$GIT_COMMIT
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ARG GIT_COMMIT=dev
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 GIT_COMMIT=$GIT_COMMIT
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
USER node
EXPOSE 3000
# App: `node server.js`. Jobs: `node dist/scripts/bootstrap.cjs`, `node dist/sim/crowd-sim.cjs`, `node dist/scripts/retention.cjs`.
CMD ["node", "server.js"]
