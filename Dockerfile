# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependencies
COPY package*.json ./
RUN npm ci --only=production && npm install --save-dev typescript @types/node @types/react @types/react-dom next eslint-config-next tailwindcss @tailwindcss/postcss

# Copiar código
COPY . .

# Build
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Instalar apenas deps de produção
COPY package*.json ./
RUN npm ci --only=production

# Copiar build do stage anterior
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

# User não-root
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
