# Select NodeJS LTS image
FROM node:lts-buster

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

# Create a folder for the bot
WORKDIR /app
COPY package.json .
COPY package-lock.json .

# Install packages and symlink $ to source code dir
RUN npm ci --ignore-scripts \
    && npx basetag link

# Copy remaining files except files in .dockerignore
COPY . .

# Setup basetag
RUN npx basetag link

# Set start command
CMD ["node", "index.js", "--trace-events-enabled", "--trace-warnings"]
