# Select NodeJS LTS Alpine image, alpine for smaller size
FROM node:lts-alpine

SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

# Create a folder to build the source in
WORKDIR /tmp
COPY package.json .
COPY package-lock.json .

# Update npm
RUN npm i -g npm

# Install Git
RUN apk add git

# Use HTTP instead of SSH
RUN git config --global url."https://github.com/".insteadOf git@github.com: \
    && git config --global url."https://".insteadOf ssh://

# Install packages
RUN npm i --ignore-scripts

# Copy remaining files except files in .dockerignore
COPY . .

# Compile to TS
RUN npm run build

# Copy dist and only install production packages
ENV NODE_ENV=production
WORKDIR /app

COPY package.json .
COPY package-lock.json .
RUN npm ci --ignore-scripts

# Remove Git
RUN apk del git

# Copy build to dist
RUN cp -r /tmp/dist/* . \
    && rm -rf /tmp

EXPOSE 80

# Set start command
CMD ["node", "index.js", "--trace-events-enabled", "--trace-warnings"]
