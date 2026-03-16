# Use Node 20
FROM node:20-slim

# Install system dependencies for DuckDB and SQLite
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build
RUN if [ -d "dist/src" ]; then cp -R dist/src/* dist/ && rm -rf dist/src; fi
RUN mkdir -p dist/api/static && cp -R src/api/static/. dist/api/static/
RUN cp src/db/*.sql dist/db/

# Create persistent data volumes
RUN mkdir -p /app/data/parquet /app/data/sqlite

# Sovereign Port
EXPOSE 4000

# Environment Defaults for Railway
ENV PORT=4000
ENV SQLITE_DB_PATH=/app/data/sqlite/sovereign.db
ENV DUCKDB_PATH=/app/data/parquet/analytics.duckdb

CMD ["npm", "start"]
