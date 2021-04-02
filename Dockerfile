# Select NodeJS LTS image
FROM node:lts-buster

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

ENV NODE_ENV=production

# Create a folder for the bot
WORKDIR /tmp
COPY package.json .
COPY package-lock.json .

# Install packages
RUN npm ci --ignore-scripts

# Symlink $ to source code dir
RUN npx basetag link

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
