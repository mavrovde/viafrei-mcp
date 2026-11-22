# The ViaFrei MCP server (Streamable HTTP on /mcp, the legacy HTTP+SSE pair on
# /sse + /messages, /healthz and /readyz) in one small runtime-only image.
#
#   docker run -e MCP_HOST=0.0.0.0 -e MCP_ALLOW_PUBLIC=1 -e VIAFREI_API_URL=… IMAGE
#
# The server binds 127.0.0.1 unless told otherwise, and a bind beyond loopback
# needs MCP_ALLOW_PUBLIC=1: the image does not opt in on anyone's behalf.
# Runs as uid 10001 with a read-only root file system: it writes nothing but
# its log lines to stdout; HOME points at /tmp (mount a tmpfs there).
# Both stages name the base image literally, pinned by its multi-arch index
# digest, so an update is a reviewed change; CI runs the same Node major.
# The base image's npm and npx are removed: the server never runs them, and
# npm's own bundled dependencies are the usual source of image-scan findings.

FROM node:26.13.0-alpine3.24@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json && npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:26.13.0-alpine3.24@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
# tini is PID 1: it forwards SIGTERM to node, whose handler drains and exits 143.
RUN apk add --no-cache tini=0.19.0-r3 \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/lib/node_modules/corepack /usr/local/bin/corepack \
 && addgroup -g 10001 -S viafrei && adduser -u 10001 -S -G viafrei -H -h /tmp viafrei
WORKDIR /app
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist
COPY package.json ./
# The catalogue the server reads at start (src/catalogue.ts: ../catalogue/catalogue.json).
COPY catalogue/catalogue.json ./catalogue/catalogue.json
ARG VERSION=dev
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="viafrei-mcp" \
      org.opencontainers.image.description="The ViaFrei MCP server: German real-time mobility data for AI assistants" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.source="https://github.com/mavrovde/viafrei-mcp" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}"
ENV NODE_ENV=production HOME=/tmp MCP_PORT=8787
USER 10001:10001
EXPOSE 8787
# The probe asks the port the server binds: MCP_PORT, else PORT, else 8787, as src/env.ts reads them. It asks
# loopback, which a bind to 0.0.0.0 or 127.0.0.1 answers.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "const p=process.env.MCP_PORT||process.env.PORT||'8787';fetch('http://127.0.0.1:'+p+'/healthz').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/http.js"]
