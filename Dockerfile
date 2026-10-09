# One image, one deploy: NestJS serves the API on /api and the built game on /.

# ── 1. Build the game (Vite) ──
FROM node:20-alpine AS client
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── 2. Build the API (NestJS) ──
FROM node:20-alpine AS server
WORKDIR /srv
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && test -f dist/main.js

# ── 3. Runtime ──
FROM node:20-alpine
RUN apk add --no-cache tini
WORKDIR /srv
ENV NODE_ENV=production \
    PORT=3100 \
    CLIENT_DIR=/srv/client
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=server /srv/dist ./dist
COPY --from=client /app/dist ./client
COPY server/start.sh ./start.sh
RUN sed -i 's/\r$//' ./start.sh && chmod +x ./start.sh
EXPOSE 3100
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./start.sh"]
