#!/bin/sh

STATE_DIR="/mnt/us/home-kindle-today-plan/state"
LOG_FILE="$STATE_DIR/kindle.log"
TARGET="/mnt/us/documents/ZeitPlan-Kindle-Log.txt"

mkdir -p "$STATE_DIR"

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

if [ -f "$LOG_FILE" ]; then
  cp "$LOG_FILE" "$TARGET"
  echo "$(date '+%Y-%m-%d %H:%M:%S') Exported log to $TARGET" >> "$LOG_FILE"
  show_message "Log exported" "documents/ZeitPlan-Kindle-Log.txt"
else
  echo "No ZeitPlan Kindle log exists yet." > "$TARGET"
  show_message "No log yet" "created empty log file"
fi
