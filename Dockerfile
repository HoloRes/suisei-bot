FROM ghcr.io/pnpm/pnpm:12-alpine AS base
# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

WORKDIR /app

# Node.js 26.8+ musl builds require libatomic and libstdc++
# hadolint ignore=DL3018
RUN apk add --no-cache libatomic libstdc++

# Copy npm files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS builder
# Set a placeholder database url so Prisma will generate the client
ENV DATABASE_URL="postgres://127.0.0.1:26257"

# Create a folder to build the source in
WORKDIR /tmp
# Copy files
COPY . .

# Install build essentials, install pnpm, install dependencies and generate database client
# hadolint ignore=DL3018
RUN apk add --no-cache --virtual .gyp python3 make g++ \
    && corepack enable \
	&& corepack prepare pnpm@latest --activate \
    && npm pkg delete scripts.prepare \
    && pnpm i --frozen-lockfile \
    && pnpm db:generate \
    && pnpm build \
    && pnpm prune --prod

FROM node:lts-alpine AS runner
# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha
ENV NODE_ENV=production

# Set dir for files
WORKDIR /app

# Copy npm files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS builder
# Set a placeholder database url so Prisma will generate the client
ENV DATABASE_URL="postgres://127.0.0.1:26257"

# Install build essentials and dependencies
# hadolint ignore=DL3018
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    apk add --no-cache --virtual .gyp python3 make g++ && \
    pnpm pkg delete scripts.prepare && \
    pnpm install --store-dir /var/cache/pnpm --frozen-lockfile

# Copy files
COPY . .

# Generate database client, build, and prune dev dependencies
RUN pnpm db:generate && \
    pnpm build && \
    pnpm prune --prod && \
    apk del .gyp

FROM base
ENV NODE_ENV=production

# Copy dependencies
COPY --from=builder /app/node_modules /app/node_modules

# Copy transpiled code
COPY --from=builder /app/dist /app/dist

# Set start command
CMD ["pnpm", "start"]
