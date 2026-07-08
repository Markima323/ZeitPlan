#!/bin/sh

APP_DIR="/mnt/us/home-kindle-today-plan"
STATE_DIR="$APP_DIR/state"
CONFIG_FILE="$APP_DIR/config.sh"
SCREEN_PATH="$APP_DIR/current.png"
LOG_FILE="$STATE_DIR/kindle.log"
MODE="${1:-eips_plain}"

mkdir -p "$STATE_DIR"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

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

if [ ! -f "$SCREEN_PATH" ]; then
  log "Display current failed. missing image path=$SCREEN_PATH"
  show_message "No current image" "use Update now first"
  exit 1
fi

case "$MODE" in
  fbink)
    if command -v fbink >/dev/null 2>&1; then
      fbink -c
      fbink -g "$SCREEN_PATH"
      STATUS="$?"
    else
      log "Display current fbink failed. fbink not found."
      show_message "FBInk not found" "try eips modes"
      exit 1
    fi
    ;;
  eips_xy)
    eips -c
    eips -g "$SCREEN_PATH" -x 0 -y 0
    STATUS="$?"
    ;;
  *)
    eips -c
    eips -g "$SCREEN_PATH"
    STATUS="$?"
    ;;
esac

log "Display current requested. mode=$MODE status=$STATUS path=$SCREEN_PATH"
exit "$STATUS"
