FROM ghcr.io/pnpm/pnpm:12-alpine AS base
# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

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
