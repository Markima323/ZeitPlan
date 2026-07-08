#!/bin/sh

STATE_DIR="/mnt/us/home-kindle-today-plan/state"
PID_FILE="$STATE_DIR/zeitplan.pid"
LOG_FILE="$STATE_DIR/kindle.log"
STOP_FILE="$STATE_DIR/stop"

mkdir -p "$STATE_DIR"
touch "$STOP_FILE"

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

if [ ! -f "$PID_FILE" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Stop requested, but no pid file exists." >> "$LOG_FILE"
  PID=""
else
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
fi

if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
  echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped ZeitPlan client. pid=$PID" >> "$LOG_FILE"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') Stop requested, but process is not running. pid=$PID" >> "$LOG_FILE"
fi

ps 2>/dev/null | grep '[h]ome-kindle-today-plan.sh' | awk '{print $1}' | while read -r OLD_PID; do
  if [ -n "$OLD_PID" ]; then
    kill "$OLD_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped extra ZeitPlan client process. pid=$OLD_PID" >> "$LOG_FILE"
  fi
done

rm -f "$PID_FILE"
show_message "Stopped sync" "${PID:+pid=$PID}"
