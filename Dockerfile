FROM node:18-bullseye-slim AS base

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

# Set noninteractive env variable and set a placeholder database url so Prisma will generate the client
ENV DEBIAN_FRONTEND=noninteractive
ENV DATABASE_URL="postgres://127.0.0.1:26257"

# Install build essentials, install pnpm, install dependencies and generate database client
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -yq --no-install-recommends libc-dev gcc g++ make python3 git \
    && rm -rf /var/lib/apt/lists/* \
	&& npm install --location=global pnpm@8.1.1

FROM base AS builder

# Create a folder to build the source in
WORKDIR /tmp
COPY package.json .
COPY pnpm-lock.yaml .
COPY prisma ./prisma

RUN npm pkg set scripts.prepare="ts-patch install -s" \
        && pnpm i --frozen-lockfile \
        && pnpm db:generate

# Copy remaining files except files in .dockerignore
COPY . .

# Compile to TS
RUN pnpm build

FROM base AS runner

ENV NODE_ENV=production

# Set dir for files
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
COPY --from=builder /tmp/prisma/schema.prisma ./prisma/schema.prisma

RUN npm pkg delete scripts.prepare \
    && pnpm i --frozen-lockfile \
    && pnpm prisma generate

# Copy transpiled code
COPY --from=builder /tmp/dist ./dist

# Set start command
CMD ["pnpm", "start"]
