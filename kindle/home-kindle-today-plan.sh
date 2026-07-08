#!/bin/sh
set -u

WIDTH="${WIDTH:-1072}"
HEIGHT="${HEIGHT:-1448}"
STATE_DIR="${STATE_DIR:-/mnt/us/home-kindle-today-plan/state}"
SCREEN_PATH="${SCREEN_PATH:-/mnt/us/home-kindle-today-plan/current.png}"
CONFIG_FILE="${CONFIG_FILE:-/mnt/us/home-kindle-today-plan/config.sh}"
LOG_FILE="${LOG_FILE:-$STATE_DIR/kindle.log}"
VERSION_FILE="$STATE_DIR/version"
EVENT_FILE="$STATE_DIR/event.json"
HTTP_FILE="$STATE_DIR/http_code"

mkdir -p "$STATE_DIR"

# Configure BASE_URL and API_KEY in CONFIG_FILE on the Kindle.
BASE_URL="${BASE_URL:-https://zeitplan.example.com}"
API_KEY="${API_KEY:-replace-with-device-token}"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

if [ "$BASE_URL" = "https://zeitplan.example.com" ] || [ -z "$BASE_URL" ]; then
  log "BASE_URL is not configured. Edit $CONFIG_FILE."
  exit 1
fi

if [ "$API_KEY" = "replace-with-device-token" ] || [ -z "$API_KEY" ]; then
  log "API_KEY is not configured. Edit $CONFIG_FILE."
  exit 1
fi

VERSION="0"
if [ -f "$VERSION_FILE" ]; then
  VERSION="$(cat "$VERSION_FILE" 2>/dev/null || echo 0)"
fi

json_get() {
  key="$1"
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$EVENT_FILE" | head -n 1
}

json_get_number() {
  key="$1"
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p" "$EVENT_FILE" | head -n 1
}

backoff_seconds() {
  case "$1" in
    0|1) echo 2 ;;
    2) echo 5 ;;
    3) echo 10 ;;
    *) echo 30 ;;
  esac
}

ERROR_COUNT=0
log "ZeitPlan Kindle client started. base_url=$BASE_URL width=$WIDTH height=$HEIGHT version=$VERSION"

while true; do
  rm -f "$EVENT_FILE" "$HTTP_FILE"
  curl \
    --silent \
    --show-error \
    --location \
    --max-time 65 \
    --output "$EVENT_FILE" \
    --write-out "%{http_code}" \
    -H "access-token: $API_KEY" \
    -H "width: $WIDTH" \
    -H "height: $HEIGHT" \
    "$BASE_URL/api/kindle/events?since=$VERSION" > "$HTTP_FILE"

  CURL_EXIT="$?"
  HTTP_CODE="$(cat "$HTTP_FILE" 2>/dev/null || echo 000)"

  if [ "$CURL_EXIT" != "0" ]; then
    log "Event poll failed. curl_exit=$CURL_EXIT http_code=$HTTP_CODE"
    sleep "$(backoff_seconds "$ERROR_COUNT")"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    continue
  fi

  if [ "$HTTP_CODE" = "204" ]; then
    ERROR_COUNT=0
    continue
  fi

  if [ "$HTTP_CODE" != "200" ]; then
    log "Event poll returned unexpected status. http_code=$HTTP_CODE"
    sleep "$(backoff_seconds "$ERROR_COUNT")"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    continue
  fi

  TYPE="$(json_get type)"
  NEW_VERSION="$(json_get_number version)"
  IMAGE_URL="$(json_get image_url)"

  if [ "$TYPE" = "screen.update" ] && [ -n "$NEW_VERSION" ] && [ "$NEW_VERSION" != "$VERSION" ] && [ -n "$IMAGE_URL" ]; then
    log "Screen update received. version=$NEW_VERSION image_url=$IMAGE_URL"
    if curl --silent --show-error --location --max-time 30 "$IMAGE_URL" -o "$SCREEN_PATH"; then
      eips -c
      if eips -g "$SCREEN_PATH" -x 0 -y 0; then
        VERSION="$NEW_VERSION"
        echo "$VERSION" > "$VERSION_FILE"
        ERROR_COUNT=0
        log "Screen rendered successfully. version=$VERSION path=$SCREEN_PATH"
      else
        log "Screen render failed. path=$SCREEN_PATH"
        sleep "$(backoff_seconds "$ERROR_COUNT")"
        ERROR_COUNT=$((ERROR_COUNT + 1))
      fi
    else
      log "Screen image download failed. image_url=$IMAGE_URL"
      sleep "$(backoff_seconds "$ERROR_COUNT")"
      ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
  else
    log "Ignored event. type=$TYPE new_version=$NEW_VERSION current_version=$VERSION image_url=$IMAGE_URL"
  fi
done
