# Teamsly — self-hosted image. Build: docker build -t teamsly .   Run: see docker-compose.yml
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Public env vars are inlined at build time; pass them with --build-arg if you use them.
ARG NEXT_PUBLIC_AI_ENABLED=false
ARG NEXT_PUBLIC_AZURE_AD_CLIENT_ID=
ENV NEXT_PUBLIC_AI_ENABLED=$NEXT_PUBLIC_AI_ENABLED NEXT_PUBLIC_AZURE_AD_CLIENT_ID=$NEXT_PUBLIC_AZURE_AD_CLIENT_ID
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S teamsly && adduser -S teamsly -G teamsly
COPY --from=builder --chown=teamsly:teamsly /app/.next/standalone ./
COPY --from=builder --chown=teamsly:teamsly /app/.next/static ./.next/static
COPY --from=builder --chown=teamsly:teamsly /app/public ./public
USER teamsly
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/auth/providers >/dev/null || exit 1
CMD ["node", "server.js"]
