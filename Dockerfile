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
	&& npm install --location=global pnpm@8.3.1 \
    && npm pkg set scripts.prepare="ts-patch install -s" \
    && pnpm i --frozen-lockfile \
    && pnpm db:generate \
    && pnpm build \
    && npm pkg delete scripts.prepare \
    && pnpm prune --prod

FROM node:lts-alpine AS runner
# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha
ENV NODE_ENV=production

# Set dir for files
WORKDIR /app

# Copy dependencies
COPY --from=builder /tmp/node_modules ./node_modules

# Copy transpiled code
COPY --from=builder /tmp/dist ./dist

# Set start command
CMD ["node", "dist/index.js"]
