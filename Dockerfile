# Multi-stage build, modelled on mazeps's. Node 22.13 or later is required
# (iron-session 9); the app is developed on 24.
ARG NODE_VERSION=24

# Production dependencies only. The Prisma CLI and tsx are regular
# dependencies because the release command (`prisma migrate deploy`) and the
# one-time seed run inside this image. `postinstall` runs `prisma generate`,
# so the schema has to exist in this stage.
FROM node:${NODE_VERSION}-alpine AS production-dependencies-env
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

# Everything, to build with Vite. Same Prisma rule: the schema comes first.
FROM node:${NODE_VERSION}-alpine AS build-env
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-alpine
# Prisma's migration engine (release command) needs OpenSSL.
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
# The server bundle imports its dependencies from node_modules at run time.
COPY --chown=node:node package.json package-lock.json server.js ./
COPY --chown=node:node --from=production-dependencies-env /app/node_modules ./node_modules
# The generated Prisma client: the seed imports it from here (the server
# bundle has its own copy inside dist/).
COPY --chown=node:node --from=production-dependencies-env /app/src/generated ./src/generated
COPY --chown=node:node --from=build-env /app/dist ./dist
# Migrations and the one-time seed with its input.
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node backup-comments.json backup-hits.json ./
USER node
EXPOSE 3000
# Not `npm start`: node is the process that receives SIGTERM.
CMD ["node", "server.js"]
