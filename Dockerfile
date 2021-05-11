# Select NodeJS LTS image
FROM node:lts-buster

# For Sentry release tracking
ARG sha
ENV COMMIT_SHA=$sha

ENV NODE_ENV=production

RUN curl -f https://get.pnpm.io/v6.js | node - add --global pnpm@6

# Create a folder to build the source in
WORKDIR /tmp
COPY package.json .
COPY package-lock.json .

# Install packages
RUN pnpm install -D

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
RUN pnpm install -P

RUN cp -r /tmp/dist/* . \
    && rm -rf /tmp

EXPOSE 80

# Set start command
CMD ["node", "index.js", "--trace-events-enabled", "--trace-warnings"]
