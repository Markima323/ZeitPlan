#!/bin/sh

APP_DIR="/mnt/us/home-kindle-today-plan"
STATE_DIR="$APP_DIR/state"
CONFIG_FILE="$APP_DIR/config.sh"
LOG_FILE="$STATE_DIR/kindle.log"
PULL_RESPONSE_FILE="$STATE_DIR/pull.json"
PULL_HTTP_FILE="$STATE_DIR/pull_http_code"

mkdir -p "$STATE_DIR"

BASE_URL="${BASE_URL:-https://zeitplan.example.com}"
API_KEY="${API_KEY:-replace-with-device-token}"
WIDTH="${WIDTH:-600}"
HEIGHT="${HEIGHT:-800}"
AUTO_DETECT_SCREEN_SIZE="${AUTO_DETECT_SCREEN_SIZE:-1}"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

show_message() {
  if command -v eips >/dev/null 2>&1; then
    eips -c
    eips 2 2 "ZeitPlan"
    eips 2 4 "$1"
    if [ -n "${2:-}" ]; then
      eips 2 5 "$2"
    fi
  fi
}

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

apply_screen_size() {
  set -- $(printf '%s\n' "$1" | sed 's/[^0-9]/ /g')
  if [ "${1:-0}" -ge 300 ] 2>/dev/null && [ "${2:-0}" -ge 300 ] 2>/dev/null; then
    WIDTH="$1"
    HEIGHT="$2"
    return 0
  fi

  return 1
}

detect_screen_size() {
  for size_file in \
    /sys/class/graphics/fb0/virtual_size \
    /sys/class/graphics/fb0/modes \
    /proc/eink_fb/virtual_fb_size
  do
    if [ -f "$size_file" ] && apply_screen_size "$(head -n 1 "$size_file" 2>/dev/null)"; then
      return 0
    fi
  done

  if command -v fbset >/dev/null 2>&1; then
    FB_GEOMETRY="$(fbset -s 2>/dev/null | sed -n 's/.*geometry[[:space:]]*//p' | head -n 1)"
    apply_screen_size "$FB_GEOMETRY" && return 0
  fi

  return 1
}

if [ "$AUTO_DETECT_SCREEN_SIZE" != "0" ]; then
  detect_screen_size || true
fi

if [ "$BASE_URL" = "https://zeitplan.example.com" ] || [ -z "$BASE_URL" ]; then
  show_message "BASE_URL missing" "edit config.sh"
  log "Pull skipped. BASE_URL is not configured."
  exit 1
fi

if [ "$API_KEY" = "replace-with-device-token" ] || [ -z "$API_KEY" ]; then
  show_message "API_KEY missing" "edit config.sh"
  log "Pull skipped. API_KEY is not configured."
  exit 1
fi

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

CURL_EXIT="$?"
HTTP_CODE="$(cat "$PULL_HTTP_FILE" 2>/dev/null || echo 000)"

if [ "$CURL_EXIT" = "0" ] && [ "$HTTP_CODE" = "200" ]; then
  log "Manual pull requested successfully. width=$WIDTH height=$HEIGHT"
  show_message "Update requested" "wait for refresh"
else
  log "Manual pull failed. curl_exit=$CURL_EXIT http_code=$HTTP_CODE"
  show_message "Update failed" "http=$HTTP_CODE curl=$CURL_EXIT"
fi
