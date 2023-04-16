FROM node:18-buster-slim

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

# Create a folder to build the source in
WORKDIR /tmp
COPY package.json .
COPY pnpm-lock.yaml .
COPY aurora.config.json .
COPY prisma ./prisma

# Set noninteractive env variable and set a placeholder database url so Prisma will generate the client
ENV DEBIAN_FRONTEND=noninteractive
ENV DATABASE_URL="postgres://127.0.0.1:26257"

# Install build essentials, install pnpm, install dependencies and generate database client
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -yq --no-install-recommends build-essential python3 git \
    && rm -rf /var/lib/apt/lists/* \
	&& npm i -g pnpm \
    && npm set-script prepare "ts-patch install -s" \
    && pnpm i \
    && pnpm db:generate

# Copy remaining files except files in .dockerignore
COPY . .

# Compile to TS
RUN pnpm build

# Copy dist and only install production packages
ENV NODE_ENV=production
WORKDIR /app

COPY package.json .
COPY pnpm-lock.yaml .
COPY aurora.config.json .
COPY prisma ./prisma

RUN npm set-script prepare "" \
    && pnpm i \
    && pnpm db:generate \
    && sed -i 's|"main": "src/index.ts"|"main": "dist/index.js"|g' package.json

# Copy build to dist
RUN cp -r /tmp/dist . \
    && rm -rf /tmp

# Set start command
CMD ["node", "dist/index.js", "--trace-events-enabled", "--trace-warnings"]
