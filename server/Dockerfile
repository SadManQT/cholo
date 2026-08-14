FROM node:24-alpine AS dependencies
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY server/package*.json ./
COPY server/src ./src
COPY server/scripts ./scripts
COPY database /database
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:init && node src/server.js"]
