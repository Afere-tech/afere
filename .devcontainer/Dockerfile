FROM mcr.microsoft.com/devcontainers/go:1.22-bookworm

ARG NODE_VERSION=22

RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs postgresql-client \
  && npm install -g pnpm \
  && rm -rf /var/lib/apt/lists/*

RUN go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest \
  && go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
