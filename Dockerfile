# Select NodeJS LTS Alpine image, alpine for smaller size
FROM node:lts-alpine

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

ENV NODE_ENV=production

# Create a folder for the bot
WORKDIR /tmp
COPY package.json .
COPY package-lock.json .

# Install packages
RUN npm ci --also=dev

# Copy remaining files except files in .dockerignore
COPY . .

# Compile to TS
RUN npm run build

# Copy dist and only install production packages
WORKDIR /app

COPY package.json .
COPY package-lock.json .
RUN npm ci

RUN cp -r /tmp/dist/* . \
    && rm -rf /tmp


# Set start command
CMD ["node", "index.js", "--trace-events-enabled", "--trace-warnings"]
