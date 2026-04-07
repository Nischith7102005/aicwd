# ETL Webhook Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY webhook.ts tsconfig.json ./

# Build TypeScript
RUN npx tsc webhook.ts --esModuleInterop --target ES2020 --module commonjs --outDir dist

EXPOSE 3001

CMD ["node", "dist/webhook.js"]
