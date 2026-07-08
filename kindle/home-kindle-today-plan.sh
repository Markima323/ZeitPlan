#!/bin/sh
set -u

# Configure these two values on the Kindle after creating a device in ZeitPlan.
BASE_URL="https://zeitplan.example.com"
API_KEY="replace-with-device-token"

WIDTH="${WIDTH:-1072}"
HEIGHT="${HEIGHT:-1448}"
STATE_DIR="${STATE_DIR:-/mnt/us/home-kindle-today-plan/state}"
SCREEN_PATH="${SCREEN_PATH:-/mnt/us/home-kindle-today-plan/current.png}"
VERSION_FILE="$STATE_DIR/version"
EVENT_FILE="$STATE_DIR/event.json"
HTTP_FILE="$STATE_DIR/http_code"

mkdir -p "$STATE_DIR"
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
    sleep "$(backoff_seconds "$ERROR_COUNT")"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    continue
  fi

  if [ "$HTTP_CODE" = "204" ]; then
    ERROR_COUNT=0
    continue
  fi

  if [ "$HTTP_CODE" != "200" ]; then
    sleep "$(backoff_seconds "$ERROR_COUNT")"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    continue
  fi

  TYPE="$(json_get type)"
  NEW_VERSION="$(json_get_number version)"
  IMAGE_URL="$(json_get image_url)"

  if [ "$TYPE" = "screen.update" ] && [ -n "$NEW_VERSION" ] && [ "$NEW_VERSION" != "$VERSION" ] && [ -n "$IMAGE_URL" ]; then
    if curl --silent --show-error --location --max-time 30 "$IMAGE_URL" -o "$SCREEN_PATH"; then
      eips -c
      eips -g "$SCREEN_PATH" -x 0 -y 0
      VERSION="$NEW_VERSION"
      echo "$VERSION" > "$VERSION_FILE"
      ERROR_COUNT=0
    else
      sleep "$(backoff_seconds "$ERROR_COUNT")"
      ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
  fi
done
