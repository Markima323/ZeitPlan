#!/bin/sh
set -u

APP_DIR="/mnt/us/home-kindle-today-plan"
STATE_DIR="$APP_DIR/state"
CONFIG_FILE="$APP_DIR/config.sh"
LOG_FILE="$STATE_DIR/kindle.log"
PID_FILE="$STATE_DIR/always-on-pull-scheduler.pid"
STOP_FILE="$STATE_DIR/always-on-pull-scheduler.stop"
PULL_RESPONSE_FILE="$STATE_DIR/always-on-pull.json"
PULL_HTTP_FILE="$STATE_DIR/always-on-pull-http-code"

mkdir -p "$STATE_DIR"

BASE_URL="${BASE_URL:-https://zeitplan.example.com}"
API_KEY="${API_KEY:-replace-with-device-token}"
WIDTH="${WIDTH:-600}"
HEIGHT="${HEIGHT:-800}"
ALWAYS_ON_PULL_ENABLED="${ALWAYS_ON_PULL_ENABLED:-1}"
ALWAYS_ON_PULL_RETRIES="${ALWAYS_ON_PULL_RETRIES:-4}"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

ALWAYS_ON_PULL_START_HOUR="${ALWAYS_ON_PULL_START_HOUR:-${SCHEDULED_WAKE_START_HOUR:-6}}"
ALWAYS_ON_PULL_END_HOUR="${ALWAYS_ON_PULL_END_HOUR:-${SCHEDULED_WAKE_END_HOUR:-0}}"
ALWAYS_ON_PULL_MINUTES="${ALWAYS_ON_PULL_MINUTES:-${SCHEDULED_WAKE_MINUTES:-1 6 31 36}}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

to_number() {
  value="$(printf '%s' "$1" | sed 's/^0*//')"
  [ -n "$value" ] || value=0
  echo "$value"
}

is_active_hour() {
  hour="$1"
  start_hour="$(to_number "$ALWAYS_ON_PULL_START_HOUR")"
  end_hour="$(to_number "$ALWAYS_ON_PULL_END_HOUR")"

  if [ "$start_hour" = "$end_hour" ]; then
    return 0
  fi

  if [ "$start_hour" -lt "$end_hour" ]; then
    [ "$hour" -ge "$start_hour" ] && [ "$hour" -lt "$end_hour" ]
    return "$?"
  fi

  [ "$hour" -ge "$start_hour" ] || [ "$hour" -lt "$end_hour" ]
}

next_pull_seconds() {
  now_h="$(to_number "$(date '+%H')")"
  now_m="$(to_number "$(date '+%M')")"
  now_s="$(to_number "$(date '+%S')")"
  now_total=$((now_h * 3600 + now_m * 60 + now_s))
  best=999999
  day=0

  while [ "$day" -le 1 ]; do
    hour=0
    while [ "$hour" -le 23 ]; do
      if is_active_hour "$hour"; then
        for minute_value in $ALWAYS_ON_PULL_MINUTES; do
          minute="$(to_number "$minute_value")"
          if [ "$minute" -ge 0 ] 2>/dev/null && [ "$minute" -le 59 ] 2>/dev/null; then
            target=$((day * 86400 + hour * 3600 + minute * 60))
            diff=$((target - now_total))
            if [ "$diff" -ge 1 ] && [ "$diff" -lt "$best" ]; then
              best="$diff"
            fi
          fi
        done
      fi
      hour=$((hour + 1))
    done
    day=$((day + 1))
  done

  if [ "$best" = "999999" ]; then
    echo 3600
  else
    echo "$best"
  fi
}

wait_until_due() {
  remaining="$1"
  while [ "$remaining" -gt 0 ]; do
    [ -f "$STOP_FILE" ] && return 1
    chunk=30
    [ "$remaining" -lt "$chunk" ] && chunk="$remaining"
    sleep "$chunk"
    remaining=$((remaining - chunk))
  done
  [ ! -f "$STOP_FILE" ]
}

request_scheduled_pull() {
  attempt=1
  max_attempts="$(to_number "$ALWAYS_ON_PULL_RETRIES")"
  [ "$max_attempts" -ge 1 ] 2>/dev/null || max_attempts=1
  log "Always-on scheduled pull started. max_attempts=$max_attempts width=$WIDTH height=$HEIGHT"

  while [ "$attempt" -le "$max_attempts" ]; do
    rm -f "$PULL_RESPONSE_FILE" "$PULL_HTTP_FILE"
    curl \
      --silent \
      --show-error \
      --location \
      --max-time 25 \
      --request POST \
      --output "$PULL_RESPONSE_FILE" \
      --write-out "%{http_code}" \
      -H "access-token: $API_KEY" \
      -H "width: $WIDTH" \
      -H "height: $HEIGHT" \
      "$BASE_URL/api/kindle/pull" > "$PULL_HTTP_FILE"

    curl_exit="$?"
    http_code="$(cat "$PULL_HTTP_FILE" 2>/dev/null || echo 000)"
    if [ "$curl_exit" = "0" ] && [ "$http_code" = "200" ]; then
      status="$(sed -n 's/.*"status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PULL_RESPONSE_FILE" | head -n 1)"
      version="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$PULL_RESPONSE_FILE" | head -n 1)"
      log "Always-on scheduled pull succeeded. attempt=$attempt/$max_attempts version=${version:-unknown} status=${status:-unknown}"
      return 0
    fi

    log "Always-on scheduled pull failed. attempt=$attempt/$max_attempts curl_exit=$curl_exit http_code=$http_code"
    [ "$attempt" -lt "$max_attempts" ] && sleep 10
    attempt=$((attempt + 1))
  done

  return 1
}

cleanup_scheduler() {
  if [ -f "$PID_FILE" ] && [ "$(cat "$PID_FILE" 2>/dev/null || true)" = "$$" ]; then
    rm -f "$PID_FILE"
  fi
  log "Always-on pull scheduler stopped. pid=$$"
}

handle_signal() {
  exit 0
}

trap cleanup_scheduler EXIT
trap handle_signal INT TERM

if [ "$ALWAYS_ON_PULL_ENABLED" != "1" ]; then
  log "Always-on pull scheduler disabled by configuration."
  exit 0
fi

if [ "$BASE_URL" = "https://zeitplan.example.com" ] || [ -z "$BASE_URL" ] || [ "$API_KEY" = "replace-with-device-token" ] || [ -z "$API_KEY" ]; then
  log "Always-on pull scheduler failed. BASE_URL or API_KEY is not configured."
  exit 1
fi

rm -f "$STOP_FILE"
echo "$$" > "$PID_FILE"
log "Always-on pull scheduler started. pid=$$ window=$ALWAYS_ON_PULL_START_HOUR-$ALWAYS_ON_PULL_END_HOUR minutes=$ALWAYS_ON_PULL_MINUTES"

while true; do
  seconds="$(next_pull_seconds)"
  log "Always-on pull scheduled. pid=$$ seconds=$seconds minutes=$ALWAYS_ON_PULL_MINUTES window=$ALWAYS_ON_PULL_START_HOUR-$ALWAYS_ON_PULL_END_HOUR"
  if ! wait_until_due "$seconds"; then
    log "Always-on pull scheduler stop file detected."
    exit 0
  fi

  log "Always-on scheduled pull triggered. pid=$$"
  request_scheduled_pull || true
done
