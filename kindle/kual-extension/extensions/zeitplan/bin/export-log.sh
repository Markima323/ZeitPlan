#!/bin/sh

STATE_DIR="/mnt/us/home-kindle-today-plan/state"
LOG_FILE="$STATE_DIR/kindle.log"
TARGET="/mnt/us/documents/ZeitPlan-Kindle-Log.txt"

mkdir -p "$STATE_DIR"

if [ -f "$LOG_FILE" ]; then
  cp "$LOG_FILE" "$TARGET"
else
  echo "No ZeitPlan Kindle log exists yet." > "$TARGET"
fi
