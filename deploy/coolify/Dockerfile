# Relais (Youzoune's listmonk fork), built from source: the SSR admin and the
# React front with Bun, the Go binary, then both packed into the binary with
# stuffbin. Used by /docker-compose.relais.yml (build context: the repository root).

# --- Fronts -----------------------------------------------------------------
FROM node:24-bookworm-slim AS front
RUN npm install -g bun@1.4.2
WORKDIR /src

# Dependencies first, for the build cache.
COPY static/admin/package.json static/admin/bun.lock static/admin/
COPY static/app/package.json static/app/bun.lock static/app/
RUN cd static/admin && bun install --frozen-lockfile \
 && cd ../app && bun install --frozen-lockfile

COPY static/admin static/admin
COPY static/app static/app
RUN cd static/admin && bun run build \
 && cd ../app && bun run build

# --- Backend ----------------------------------------------------------------
FROM golang:1.27-alpine AS back
ARG RELAIS_VERSION=v7.4.0
WORKDIR /src

RUN go install github.com/knadh/stuffbin/stuffbin@v1.3.0

COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=front /src/static/admin/dist static/admin/dist
COPY --from=front /src/static/app/dist static/app/dist

RUN CGO_ENABLED=0 go build -o listmonk \
      -ldflags="-s -w -X 'main.buildString=${RELAIS_VERSION} (relais)' -X 'main.versionString=${RELAIS_VERSION}'" ./cmd \
 && stuffbin -a stuff -in listmonk -out listmonk \
      config.toml.sample schema.sql queries:/queries permissions.json \
      static/public:/public \
      static/admin/views:/admin/views \
      static/admin/partials:/admin/partials \
      static/admin/dist:/admin/static \
      static/admin/i18n.txt:/admin/i18n.txt \
      static/app/dist:/app \
      static/email-templates \
      i18n:/i18n

# --- Runtime ----------------------------------------------------------------
FROM alpine:3.22
RUN apk --no-cache add ca-certificates tzdata shadow su-exec wget
WORKDIR /listmonk

COPY --from=back /src/listmonk .
COPY config.toml.sample config.toml
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /listmonk/uploads

EXPOSE 9000
ENTRYPOINT ["docker-entrypoint.sh"]

# Install the database on the first start, run pending migrations, then start.
# --config '' makes listmonk read its configuration from the LISTMONK_* variables.
CMD ["sh", "-c", "./listmonk --install --idempotent --yes --config '' && ./listmonk --upgrade --yes --config '' && exec ./listmonk --config ''"]
