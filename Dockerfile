FROM node:lts-alpine AS builder
# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

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
    && pnpm typia patch \
    && pnpm db:generate \
    && pnpm build \
    && npm pkg delete scripts.postinstall \
    && pnpm prune --prod

FROM node:lts-alpine AS runner
# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha
ENV NODE_ENV=production

# Set dir for files
WORKDIR /app

# Copy npm files
COPY package.json pnpm-lock.yaml ./

# Copy dependencies
COPY --from=builder /tmp/node_modules ./node_modules

# Copy transpiled code
COPY --from=builder /tmp/dist ./dist

# Set start command
CMD ["node", "dist/index.js"]
