
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for build
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build Next.js
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

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
