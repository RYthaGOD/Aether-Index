# Aether Index Core - 2026 Sovereign Edition
FROM node:20-slim

WORKDIR /app

# Copy monorepo manifests
COPY package.json .
COPY packages/aether-core/package.json ./packages/aether-core/
COPY packages/shared/package.json ./packages/shared/
COPY packages/aether-agentic/package.json ./packages/aether-agentic/
COPY packages/aether-zk/package.json ./packages/aether-zk/
COPY packages/aether-lending/package.json ./packages/aether-lending/
COPY packages/aether-nft/package.json ./packages/aether-nft/

# Install dependencies for the whole workspace
RUN npm install

# Copy source code
COPY . .

# Build all packages
RUN npm run build --workspaces

EXPOSE 4000

# Start core engine
CMD ["npm", "run", "start", "--workspace=@aether/core"]
