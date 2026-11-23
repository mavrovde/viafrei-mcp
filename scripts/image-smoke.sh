#!/usr/bin/env bash
# Runs an image of the MCP server the way a deployment does, and refuses it
# unless every hardening holds:
#   - it runs as uid 10001 (no root) with a read-only root file system, all
#     capabilities dropped and no-new-privileges;
#   - /healthz answers 200 within 30 s; /readyz answers 503 (the API it names
#     does not exist, so readiness must say so rather than pretend);
#   - a write to the root file system fails;
#   - SIGTERM stops it with exit 143 within the stop deadline.
#
#   IMAGE=ghcr.io/mavrovde/viafrei-mcp@sha256:… scripts/image-smoke.sh
#
# Exit 0 = every check passed, 1 = a check failed, 2 = could not run at all.
# The container is this script's own (a unique name), and only it is removed.
set -uo pipefail

IMAGE="${IMAGE:-}"
DOCKER="${DOCKER:-docker}"
[[ -n $IMAGE ]] || { echo "::error::usage: IMAGE=<ref> scripts/image-smoke.sh"; exit 2; }
command -v "$DOCKER" >/dev/null || { echo "::error::$DOCKER is not on PATH"; exit 2; }

name="viafrei-mcp-smoke-$$-$RANDOM"
fail() { echo "::error::image smoke: $*"; "$DOCKER" logs "$name" 2>&1 | tail -n 20; "$DOCKER" rm -f "$name" >/dev/null 2>&1; exit 1; }

"$DOCKER" run -d --name "$name" --read-only --tmpfs /tmp --user 10001:10001 --cap-drop ALL --security-opt no-new-privileges \
  -e MCP_HOST=0.0.0.0 -e MCP_ALLOW_PUBLIC=1 -e VIAFREI_API_URL=http://example.invalid -p 127.0.0.1::8787 "$IMAGE" >/dev/null \
  || { echo "::error::image smoke: the container did not start"; exit 2; }

port="$("$DOCKER" port "$name" 8787/tcp | head -n 1 | sed 's/.*://')"
[[ $port =~ ^[0-9]+$ ]] || fail "no published port ('$port')"

status=""
for _ in $(seq 1 30); do
  status="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/healthz" || true)"
  [[ $status == 200 ]] && break
  sleep 1
done
[[ $status == 200 ]] || fail "/healthz answered '$status', not 200, within 30 s"
echo "ok /healthz 200"

ready="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/readyz" || true)"
[[ $ready == 503 ]] || fail "/readyz answered '$ready' with no API behind it, not 503"
echo "ok /readyz 503 with no API"

uid="$("$DOCKER" exec "$name" id -u)" || fail "cannot read the uid"
[[ $uid == 10001 ]] || fail "runs as uid $uid, not 10001"
echo "ok uid 10001"
[[ $("$DOCKER" inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$name") == true ]] || fail "the root file system is writable"
if "$DOCKER" exec "$name" sh -c 'echo x > /app/written' 2>/dev/null; then fail "a write to /app succeeded"; fi
echo "ok read-only root file system"
if "$DOCKER" exec "$name" sh -c 'command -v npm' >/dev/null 2>&1; then fail "npm is in the runtime image"; fi
echo "ok no npm"

"$DOCKER" stop -t 10 "$name" >/dev/null || fail "docker stop failed"
code="$("$DOCKER" inspect -f '{{.State.ExitCode}}' "$name")"
[[ $code == 143 ]] || fail "SIGTERM exited $code, not 143"
echo "ok SIGTERM exit 143"
"$DOCKER" rm "$name" >/dev/null
echo "image smoke passed: $IMAGE"
