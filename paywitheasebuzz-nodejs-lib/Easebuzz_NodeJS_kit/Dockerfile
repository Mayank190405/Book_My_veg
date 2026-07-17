FROM node:18-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source
COPY . .

# Expose default port
EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "index.js"]
