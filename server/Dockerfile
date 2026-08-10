# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files & prisma
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies with npm cache
RUN --mount=type=cache,target=/root/.npm \
    npm install --prefer-offline --no-audit

# Copy source
COPY . .

# Generate Prisma client
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/db" npx prisma generate

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 5000

# Start command
CMD ["npm", "start"]
