#!/usr/bin/env sh
# Starts a container from the given image, waits until its healthcheck
# reports "healthy" and checks a few things from outside and inside it.
# Used by CI; also runnable locally:
#   docker build -t era-mock-api-rest:local . && scripts/docker-smoke-test.sh era-mock-api-rest:local
set -eu

IMAGE="${1:?usage: $0 <image>}"
NAME="era-mock-api-smoke-$$"
PORT="${SMOKE_PORT:-3999}"
URL="http://127.0.0.1:${PORT}"

cleanup() {
  docker rm -f "$NAME" > /dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "FAIL: $1"
  echo "--- container logs"
  docker logs "$NAME" 2>&1 | tail -30 || true
  exit 1
}

echo "Starting $IMAGE as $NAME on port $PORT"
docker run -d --name "$NAME" -p "${PORT}:3000" -e JWT_SECRET=smoke-test-secret "$IMAGE" > /dev/null

status=starting
i=0
while [ $i -lt 45 ]; do
  status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$NAME")
  [ "$status" = none ] && fail "image has no HEALTHCHECK"
  [ "$status" = healthy ] && break
  [ "$status" = unhealthy ] && fail "container reported unhealthy"
  i=$((i + 1))
  sleep 2
done
[ "$status" = healthy ] || fail "container not healthy after 90s (last status: $status)"
echo "OK: healthy"

seed=$(curl -fsS "$URL/seed/status") || fail "GET /seed/status failed"
echo "$seed" | grep -q '"users":3' || fail "unexpected /seed/status: $seed"
echo "OK: /seed/status -> $seed"

code=$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/docs")
[ "$code" = 200 ] || fail "Swagger returned $code"
echo "OK: Swagger 200"

token=$(curl -fsS -X POST "$URL/auth/login" -H 'content-type: application/json' \
  -d '{"email":"admin@mock.dev","password":"password123"}' |
  sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[ -n "$token" ] || fail "login did not return a token"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$URL/categories")
[ "$code" = 200 ] || fail "GET /categories with token returned $code"
code=$(curl -s -o /dev/null -w '%{http_code}' "$URL/categories")
[ "$code" = 401 ] || fail "GET /categories without token returned $code"
echo "OK: login, /categories 200 with token and 401 without"

user=$(docker exec "$NAME" whoami)
[ "$user" = node ] || fail "process runs as '$user', expected 'node'"
docker exec "$NAME" test ! -e /app/.env || fail ".env found inside the image"
docker exec "$NAME" test ! -d /app/src || fail "src/ found inside the image"
echo "OK: runs as node, no .env or src/ in the image"

echo "Smoke test passed"
