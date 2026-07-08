#!/bin/sh

STATE_DIR="/mnt/us/home-kindle-today-plan/state"
PID_FILE="$STATE_DIR/zeitplan.pid"
LOG_FILE="$STATE_DIR/kindle.log"

mkdir -p "$STATE_DIR"

if [ ! -f "$PID_FILE" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Stop requested, but no pid file exists." >> "$LOG_FILE"
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
  echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped ZeitPlan client. pid=$PID" >> "$LOG_FILE"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') Stop requested, but process is not running. pid=$PID" >> "$LOG_FILE"
fi

rm -f "$PID_FILE"
