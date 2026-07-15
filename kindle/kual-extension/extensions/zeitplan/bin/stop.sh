#!/bin/sh

STATE_DIR="/mnt/us/home-kindle-today-plan/state"
PID_FILE="$STATE_DIR/zeitplan.pid"
TOUCH_PID_FILE="$STATE_DIR/touch.pid"
WAKE_PID_FILE="$STATE_DIR/wake-scheduler.pid"
ALWAYS_ON_PULL_PID_FILE="$STATE_DIR/always-on-pull-scheduler.pid"
LOG_FILE="$STATE_DIR/kindle.log"
STOP_FILE="$STATE_DIR/stop"
WAKE_STOP_FILE="$STATE_DIR/wake-scheduler.stop"
ALWAYS_ON_PULL_STOP_FILE="$STATE_DIR/always-on-pull-scheduler.stop"

mkdir -p "$STATE_DIR"
touch "$STOP_FILE"
touch "$WAKE_STOP_FILE"
touch "$ALWAYS_ON_PULL_STOP_FILE"

show_message() {
  if [ "${QUIET:-0}" = "1" ]; then
    return 0
  fi

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

if [ -f "$TOUCH_PID_FILE" ]; then
  TOUCH_PID="$(cat "$TOUCH_PID_FILE" 2>/dev/null || true)"
  if [ -n "$TOUCH_PID" ] && kill -0 "$TOUCH_PID" 2>/dev/null; then
    kill "$TOUCH_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped ZeitPlan touch controls. pid=$TOUCH_PID" >> "$LOG_FILE"
  fi
fi

ps 2>/dev/null | grep '[t]ouch-buttons.sh' | awk '{print $1}' | while read -r OLD_TOUCH_PID; do
  if [ -n "$OLD_TOUCH_PID" ]; then
    kill "$OLD_TOUCH_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped extra ZeitPlan touch controls. pid=$OLD_TOUCH_PID" >> "$LOG_FILE"
  fi
done

if [ -f "$WAKE_PID_FILE" ]; then
  WAKE_PID="$(cat "$WAKE_PID_FILE" 2>/dev/null || true)"
  if [ -n "$WAKE_PID" ] && kill -0 "$WAKE_PID" 2>/dev/null; then
    kill "$WAKE_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped ZeitPlan wake scheduler. pid=$WAKE_PID" >> "$LOG_FILE"
  fi
fi

ps 2>/dev/null | grep '[w]ake-scheduler.sh' | awk '{print $1}' | while read -r OLD_WAKE_PID; do
  if [ -n "$OLD_WAKE_PID" ]; then
    kill "$OLD_WAKE_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped extra ZeitPlan wake scheduler. pid=$OLD_WAKE_PID" >> "$LOG_FILE"
  fi
done

if [ -f "$ALWAYS_ON_PULL_PID_FILE" ]; then
  ALWAYS_ON_PULL_PID="$(cat "$ALWAYS_ON_PULL_PID_FILE" 2>/dev/null || true)"
  if [ -n "$ALWAYS_ON_PULL_PID" ] && kill -0 "$ALWAYS_ON_PULL_PID" 2>/dev/null; then
    kill "$ALWAYS_ON_PULL_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped always-on pull scheduler. pid=$ALWAYS_ON_PULL_PID" >> "$LOG_FILE"
  fi
fi

ps 2>/dev/null | grep '[a]lways-on-pull-scheduler.sh' | awk '{print $1}' | while read -r OLD_PULL_PID; do
  if [ -n "$OLD_PULL_PID" ]; then
    kill "$OLD_PULL_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped extra always-on pull scheduler. pid=$OLD_PULL_PID" >> "$LOG_FILE"
  fi
done


sleep 1
ps 2>/dev/null | grep '[a]lways-on-pull-scheduler.sh' | awk '{print $1}' | while read -r OLD_PULL_PID; do
  if [ -n "$OLD_PULL_PID" ]; then
    kill -9 "$OLD_PULL_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Force-stopped stale always-on pull scheduler. pid=$OLD_PULL_PID" >> "$LOG_FILE"
  fi
done


sleep 1
ps 2>/dev/null | grep '[w]ake-scheduler.sh' | awk '{print $1}' | while read -r OLD_WAKE_PID; do
  if [ -n "$OLD_WAKE_PID" ]; then
    kill -9 "$OLD_WAKE_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Force-stopped stale ZeitPlan wake scheduler. pid=$OLD_WAKE_PID" >> "$LOG_FILE"
  fi
done


ps 2>/dev/null | grep '[l]ipc-wait-event.*com.lab126.powerd' | awk '{print $1}' | while read -r OLD_EVENT_PID; do
  if [ -n "$OLD_EVENT_PID" ]; then
    kill "$OLD_EVENT_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped stale power event listener. pid=$OLD_EVENT_PID" >> "$LOG_FILE"
  fi
done

rm -f "$PID_FILE" "$TOUCH_PID_FILE" "$WAKE_PID_FILE" "$ALWAYS_ON_PULL_PID_FILE"
show_message "Stopped sync" "${PID:+pid=$PID}"
