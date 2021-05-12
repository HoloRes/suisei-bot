# Select NodeJS LTS image
FROM node:lts-buster

SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

RUN apk add curl=7.67.0-r3 --no-cache \
    && curl -f https://get.pnpm.io/v6.js | node - add --global pnpm

# Create a folder to build the source in
WORKDIR /tmp
COPY package.json .
COPY package-lock.json .
COPY pnpm-lock.yaml .

# Install packages
RUN npm ci

# Symlink $ to source code dir
RUN npx basetag link

# Copy remaining files except files in .dockerignore
COPY . .

# Compile to TS
RUN npm run build

# Copy dist and only install production packages
ENV NODE_ENV=production
WORKDIR /app

COPY package.json .
COPY package-lock.json .
COPY pnpm-lock.yaml .
RUN pnpm install -P

# Copy build to dist
RUN cp -r /tmp/dist/* . \
    && rm -rf /tmp

EXPOSE 80

# Set start command
CMD ["node", "index.js", "--trace-events-enabled", "--trace-warnings"]
