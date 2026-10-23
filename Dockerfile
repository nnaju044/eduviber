# ==========================================
# EDUviber - Production Dockerfile
# Multi-stage lightweight Node.js container
# ==========================================

FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies in a separate layer for build caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=2000

# Run container as non-root user for defense-in-depth
USER node

# Expose default port
EXPOSE 2000

# Container healthcheck using the unauthenticated /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e 'fetch("http://localhost:" + (process.env.PORT || 2000) + "/health").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'

# Start production server
CMD ["node", "server.js"]
