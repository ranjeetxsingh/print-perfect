# Stage 1: Build the Vite application
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build production assets into /app/dist
RUN npm run build

# Stage 2: Production web server using lightweight Nginx
FROM nginx:alpine AS runner

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts to Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Port Dokploy will route traffic to
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
