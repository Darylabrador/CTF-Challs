#!/bin/sh
set -eu

SERVICE="${SERVICE:-all}"

start_proxy() {
  mkdir -p /tmp/nginx/client_body /tmp/nginx/proxy /tmp/nginx/fastcgi /tmp/nginx/uwsgi /tmp/nginx/scgi
  /usr/sbin/nginx -c /app/nginx/nginx.conf -g 'daemon off;' &
  PROXY_PID="$!"
}

start_internal() {
  cd /app/internal
  BIND_ADDR="0.0.0.0"
  if [ "$SERVICE" = "all" ]; then
    BIND_ADDR="127.0.0.1"
  fi
  /venv/bin/gunicorn \
    -w 2 \
    -b "${BIND_ADDR}:9000" \
    app:app \
    --access-logfile - \
    --error-logfile - &
  INTERNAL_PID="$!"
}

start_web() {
  cd /app/web
  /usr/local/bin/node index.js &
  WEB_PID="$!"
}

stop_all() {
  kill -TERM "${WEB_PID:-0}" "${INTERNAL_PID:-0}" "${PROXY_PID:-0}" 2>/dev/null || true
  wait "${WEB_PID:-0}" 2>/dev/null || true
  wait "${INTERNAL_PID:-0}" 2>/dev/null || true
  wait "${PROXY_PID:-0}" 2>/dev/null || true
}

trap stop_all INT TERM

case "$SERVICE" in
  web)
    start_web
    wait "$WEB_PID"
    ;;

  internal)
    start_internal
    wait "$INTERNAL_PID"
    ;;

  all)
    start_proxy
    start_internal
    start_web

    while :; do
      if ! kill -0 "$INTERNAL_PID" 2>/dev/null; then
        stop_all
        exit 1
      fi
      if ! kill -0 "$WEB_PID" 2>/dev/null; then
        stop_all
        exit 1
      fi
      sleep 1
    done
    ;;

  *)
    echo "[entrypoint] ERREUR: SERVICE='$SERVICE' invalide (attendu: web | internal | all)"
    exit 1
    ;;
esac
