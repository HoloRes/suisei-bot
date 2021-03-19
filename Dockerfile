# Select NodeJS LTS Alpine image, alpine for smaller size
FROM node:lts-alpine

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

# Create a folder for the bot
WORKDIR /app
COPY package.json .
COPY package-lock.json .

# Install packages
RUN npm ci

# Copy remaining files except files in .dockerignore
COPY . .

# Set start command
CMD ["node", "index.js", "--trace-events-enabled", "--trace-warnings"]
