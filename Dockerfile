FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --no-audit --no-fund
COPY frontend frontend
COPY shared shared
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && rm -rf /var/lib/apt/lists/*
COPY scraper/requirements.txt /app/scraper/requirements.txt
RUN python3 -m venv /app/.venv && /app/.venv/bin/pip install --no-cache-dir -r scraper/requirements.txt
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --no-audit --no-fund
COPY --chown=node:node backend backend
COPY --chown=node:node scraper scraper
COPY --chown=node:node shared shared
COPY --chown=node:node scripts scripts
COPY --from=build --chown=node:node /app/frontend/dist frontend/dist
RUN mkdir -p /app/data && chown node:node /app/data
ENV NODE_ENV=production PORT=3001 PYTHON_BIN=/app/.venv/bin/python DB_PATH=/app/data/news.db
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/src/server.js"]
