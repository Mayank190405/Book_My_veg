# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

# Cache node_modules installation
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline --no-audit

# Copy source
COPY . .

# Build Next.js with BuildKit persistent cache mount for .next/cache
ARG NEXT_PUBLIC_API_URL
ARG INTERNAL_SERVER_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV INTERNAL_SERVER_URL=${INTERNAL_SERVER_URL}

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "server.js"]
