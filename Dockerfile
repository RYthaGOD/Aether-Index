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

# Copy ALL source first for Monorepo Workspace detection
COPY . .

# Install all dependencies including workspaces (Clean Install)
RUN npm install

# Build the entire monorepo using Project References (tsc --build)
# This handles the dependency order (shared -> core) automatically.
RUN npm run build

# Ensure SQL schemas are in place for the core engine
RUN mkdir -p packages/aether-core/dist/db && cp packages/aether-core/src/db/*.sql packages/aether-core/dist/db/ 2>/dev/null || true

# Create persistent data volumes
RUN mkdir -p /app/data/parquet /app/data/sqlite

# Sovereign Port
EXPOSE 4000

# Environment Defaults for Railway
ENV PORT=4000
ENV SQLITE_DB_PATH=/app/data/sqlite/sovereign.db
ENV DUCKDB_PATH=/app/data/parquet/analytics.duckdb

# Start the core service
CMD ["npm", "start"]
