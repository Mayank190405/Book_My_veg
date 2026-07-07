
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Generate Prisma client
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/db" npx prisma generate

# Build TypeScript with detailed error logging
RUN npm run build || (npm run build > build_error_docker.log 2>&1 || cat build_error_docker.log && exit 1)

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and prisma for migrations
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 5000

# Start command
CMD ["npm", "start"]
