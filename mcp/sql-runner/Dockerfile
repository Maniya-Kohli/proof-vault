FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json* tsconfig.json ./
COPY src ./src

RUN npm ci
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
