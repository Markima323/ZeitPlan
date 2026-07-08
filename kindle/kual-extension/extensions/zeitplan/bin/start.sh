#!/bin/sh

APP_DIR="/mnt/us/home-kindle-today-plan"
STATE_DIR="$APP_DIR/state"
SCRIPT="$APP_DIR/home-kindle-today-plan.sh"
PID_FILE="$STATE_DIR/zeitplan.pid"
LOG_FILE="$STATE_DIR/kindle.log"

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

if [ ! -f "$SCRIPT" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Missing script: $SCRIPT" >> "$LOG_FILE"
  show_message "Missing sync script" "$SCRIPT"
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Restart requested. stopping existing client. pid=$PID" >> "$LOG_FILE"
    kill "$PID" 2>/dev/null || true
    sleep 1
  fi
fi

ps 2>/dev/null | grep '[h]ome-kindle-today-plan.sh' | awk '{print $1}' | while read -r OLD_PID; do
  if [ -n "$OLD_PID" ]; then
    kill "$OLD_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped extra ZeitPlan client process. pid=$OLD_PID" >> "$LOG_FILE"
  fi
done

rm -f "$PID_FILE"

nohup sh "$SCRIPT" >> "$LOG_FILE" 2>&1 &
echo "$!" > "$PID_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') Started ZeitPlan client. pid=$!" >> "$LOG_FILE"
show_message "Restarted sync" "pid=$!"
