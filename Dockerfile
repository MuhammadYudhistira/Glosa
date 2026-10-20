# syntax=docker/dockerfile:1

# Glosa's image (spec 1E §3): the app server and the Storage sweep. It holds
# no secrets; every setting is read from the environment at start.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN npm run build
# Source maps go to Sentry when a token is given, then leave the image.
ARG SENTRY_ORG
ARG SENTRY_PROJECT
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    if [ -n "${SENTRY_AUTH_TOKEN:-}" ]; then \
      npx sentry-cli sourcemaps inject dist && \
      npx sentry-cli sourcemaps upload --release "$APP_VERSION" dist; \
    else \
      echo "SENTRY_AUTH_TOKEN not set: source maps are not uploaded"; \
    fi \
    && find dist -name '*.map' -delete
RUN npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# srvx resolves --static from the entry's folder: ../client is dist/client.
CMD ["node_modules/.bin/srvx", "serve", "--prod", "--entry", "dist/server/server.js", "--static", "../client", "--port", "3000"]
