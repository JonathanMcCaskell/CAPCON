# Multi-stage Dockerfile for Cloud Run & production deployment
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package configuration
COPY package*.json ./
RUN npm install

# Copy source files and build client and server
COPY . .
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled frontend and bundled server from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.cjs"]

