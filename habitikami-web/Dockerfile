# Stage 1: Build the application
FROM node:20-alpine AS builder

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
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.js ./
COPY --from=builder /app/CHANGELOG.md ./

RUN mkdir -p /app/data

EXPOSE 80
ENV PORT=80

# Runtime secrets are injected via docker-compose env_file or -e flags — never baked in here
# Required at runtime: VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_CLIENT_SECRET, VITE_SPREADSHEET_ID,
#                      EXPORT_API_TOKEN, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY

CMD ["npm", "run", "start"]
