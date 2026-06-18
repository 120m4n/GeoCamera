# ── Stage 1: Build ────────────────────────────────────────────
# Uses node:alpine to keep the builder layer small.
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cached unless package.json changes)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────
# nginx:alpine is ~5 MB. Only the compiled dist/ is copied over.
FROM nginx:alpine AS server

# Replace the default vhost config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled app from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
