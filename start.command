#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

function ensure_install() {
  local target="$1"
  if [ ! -d "$target/node_modules" ]; then
    (cd "$target" && npm install)
  fi
}

ensure_install "$DIR/server"
ensure_install "$DIR/client"

(cd "$DIR/server" && npm run dev &)
SERVER_PID=$!
(cd "$DIR/client" && npm run dev &)
CLIENT_PID=$!

cleanup() {
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
}
trap cleanup EXIT

printf 'Ждём запуск клиента...'
until curl -sf "http://localhost:5173" >/dev/null 2>&1; do
  printf '.'
  sleep 1
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "\nСервер остановлен." >&2
    exit 1
  fi
  if ! kill -0 "$CLIENT_PID" 2>/dev/null; then
    echo "\nКлиент остановлен." >&2
    exit 1
  fi
done
printf '\nОткрываем браузер...\n'

URL="http://localhost:5173"
if command -v xdg-open >/dev/null; then
  xdg-open "$URL" >/dev/null 2>&1 &
elif command -v open >/dev/null; then
  open "$URL" >/dev/null 2>&1 &
fi

wait
