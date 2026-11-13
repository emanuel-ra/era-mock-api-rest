# syntax=docker/dockerfile:1

# ---- Build stage: install all dependencies and compile TypeScript ----
FROM node:24-alpine AS build
WORKDIR /app

# Copy the manifests first so `npm ci` is cached until dependencies change.
COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage: production dependencies + compiled code only ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# The official image ships an unprivileged "node" user.
USER node

EXPOSE 3000

# /seed/status is public and cheap, so it works as a liveness probe.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/seed/status" > /dev/null || exit 1

CMD ["node", "dist/main.js"]
