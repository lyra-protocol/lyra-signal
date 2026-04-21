# Long-running WebSocket + Pump worker — deploy to Railway, Fly.io, Render, Google Cloud Run (with CPU always on), etc.
# Vercel cannot host this process (no WebSocket server / no persistent Pump connection).

FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 3847

CMD ["npm", "run", "start"]
