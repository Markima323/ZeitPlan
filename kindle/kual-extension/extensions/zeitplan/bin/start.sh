#!/bin/sh

APP_DIR="/mnt/us/home-kindle-today-plan"
STATE_DIR="$APP_DIR/state"
SCRIPT="$APP_DIR/home-kindle-today-plan.sh"
PID_FILE="$STATE_DIR/zeitplan.pid"
LOG_FILE="$STATE_DIR/kindle.log"

mkdir -p "$STATE_DIR"

if [ ! -f "$SCRIPT" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Missing script: $SCRIPT" >> "$LOG_FILE"
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') ZeitPlan client is already running. pid=$PID" >> "$LOG_FILE"
    exit 0
  fi
fi

nohup sh "$SCRIPT" >> "$LOG_FILE" 2>&1 &
echo "$!" > "$PID_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') Started ZeitPlan client. pid=$!" >> "$LOG_FILE"
