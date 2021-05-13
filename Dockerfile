# Select NodeJS LTS image
FROM node:lts-buster

SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

# Create a folder to build the source in
WORKDIR /tmp
COPY package.json .
COPY package-lock.json .

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
RUN npm ci

# Copy build to dist
RUN cp -r /tmp/dist/* . \
    && rm -rf /tmp

EXPOSE 80

# Set start command
CMD ["node", "index.js", "--trace-events-enabled", "--trace-warnings"]
