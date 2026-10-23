# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time variables — only public client-side config goes here
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_SPREADSHEET_ID

ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_SPREADSHEET_ID=$VITE_SPREADSHEET_ID

RUN npm run build

# Stage 2: Runtime image
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.js push.js cells.js ./

RUN mkdir -p /app/data

EXPOSE 80
ENV PORT=80

# Runtime secrets are injected via docker-compose env_file or -e flags — never baked in here
# Required at runtime: VITE_GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (legacy: VITE_GOOGLE_CLIENT_SECRET), VITE_SPREADSHEET_ID,
#                      GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (only for API keys without a stored refresh token)
# Optional: ALLOWED_EMAILS (comma-separated allowlist; empty = open access)

CMD ["npm", "run", "start"]
