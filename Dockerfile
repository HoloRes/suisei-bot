# Select NodeJS LTS Alpine image, alpine for smaller size
FROM node:16-alpine

SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

# Create a folder to build the source in
WORKDIR /tmp
COPY package.json .
COPY pnpm-lock.yaml .

# Update npm and install packages
RUN npm i -g pnpm \
    && pnpm i --ignore-scripts

# Copy remaining files except files in .dockerignore
COPY . .

# Compile to TS
RUN pnpm build

# Copy dist and only install production packages
ENV NODE_ENV=production
WORKDIR /app

COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm i --ignore-scripts\
    && sed -i 's|"main": "src/index.ts"|"main": "dist/index.js"|g' package.json

# Copy build to dist
RUN cp -r /tmp/dist . \
    && rm -rf /tmp

EXPOSE 80

# Set start command
CMD ["node", "index.js", "--trace-events-enabled", "--trace-warnings"]
