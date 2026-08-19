# Multi-stage Docker build for Discord Booking & Schedule Manager
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy source files
COPY src ./src/

# Generate Prisma Client & Build TypeScript
RUN npx prisma generate
RUN npm run build

# Production Runtime Image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install openssl for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
