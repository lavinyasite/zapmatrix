# Stage 1 — Build React frontend
FROM node:20-alpine AS build-web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install --legacy-peer-deps
COPY web/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2 — Node.js backend + static files
FROM node:20-alpine AS server
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production
COPY server/ ./
COPY --from=build-web /app/web/dist ./public

ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000
CMD ["node", "index.js"]
