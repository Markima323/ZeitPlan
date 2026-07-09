#!/bin/sh

APP_DIR="/mnt/us/home-kindle-today-plan"
STATE_DIR="$APP_DIR/state"
SCRIPT="$APP_DIR/home-kindle-today-plan.sh"
SCREEN_PATH="$APP_DIR/current.png"
CONFIG_FILE="$APP_DIR/config.sh"
TOUCH_SCRIPT="/mnt/us/extensions/zeitplan/bin/touch-buttons.sh"
WAKE_SCRIPT="/mnt/us/extensions/zeitplan/bin/wake-scheduler.sh"
PID_FILE="$STATE_DIR/zeitplan.pid"
TOUCH_PID_FILE="$STATE_DIR/touch.pid"
WAKE_PID_FILE="$STATE_DIR/wake-scheduler.pid"
LOG_FILE="$STATE_DIR/kindle.log"
STOP_FILE="$STATE_DIR/stop"
WAKE_STOP_FILE="$STATE_DIR/wake-scheduler.stop"

mkdir -p "$STATE_DIR"

OPEN_AS_BOOK="${OPEN_AS_BOOK:-0}"
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

render_current_screen() {
  if [ "$OPEN_AS_BOOK" = "1" ]; then
    return 0
  fi

  if command -v eips >/dev/null 2>&1 && [ -f "$SCREEN_PATH" ]; then
    eips -c
    sleep 1
    eips -g "$SCREEN_PATH"
  fi
}

schedule_post_kual_redraw() {
  if [ "$OPEN_AS_BOOK" = "1" ]; then
    return 0
  fi

  if command -v eips >/dev/null 2>&1 && [ -f "$SCREEN_PATH" ]; then
    (
      sleep 2
      render_current_screen
      sleep 3
      render_current_screen
    ) >> "$LOG_FILE" 2>&1 &
    echo "$(date '+%Y-%m-%d %H:%M:%S') Scheduled post-KUAL redraw. pid=$!" >> "$LOG_FILE"
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

if [ -f "$TOUCH_PID_FILE" ]; then
  TOUCH_PID="$(cat "$TOUCH_PID_FILE" 2>/dev/null || true)"
  if [ -n "$TOUCH_PID" ] && kill -0 "$TOUCH_PID" 2>/dev/null; then
    kill "$TOUCH_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Restart requested. stopping existing touch controls. pid=$TOUCH_PID" >> "$LOG_FILE"
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
    echo "$(date '+%Y-%m-%d %H:%M:%S') Restart requested. stopping existing wake scheduler. pid=$WAKE_PID" >> "$LOG_FILE"
  fi
fi

ps 2>/dev/null | grep '[w]ake-scheduler.sh' | awk '{print $1}' | while read -r OLD_WAKE_PID; do
  if [ -n "$OLD_WAKE_PID" ]; then
    kill "$OLD_WAKE_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped extra ZeitPlan wake scheduler. pid=$OLD_WAKE_PID" >> "$LOG_FILE"
  fi
done

rm -f "$PID_FILE" "$TOUCH_PID_FILE" "$WAKE_PID_FILE" "$STOP_FILE" "$WAKE_STOP_FILE"

nohup sh "$SCRIPT" >> "$LOG_FILE" 2>&1 &
echo "$!" > "$PID_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') Started ZeitPlan client. pid=$!" >> "$LOG_FILE"

if [ "${SCHEDULED_WAKE_ENABLED:-1}" = "1" ] && [ -f "$WAKE_SCRIPT" ]; then
  nohup sh "$WAKE_SCRIPT" >> "$LOG_FILE" 2>&1 &
  echo "$!" > "$WAKE_PID_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') Started ZeitPlan wake scheduler. pid=$!" >> "$LOG_FILE"
fi

if [ "$OPEN_AS_BOOK" != "1" ] && [ -f "$TOUCH_SCRIPT" ]; then
  nohup sh "$TOUCH_SCRIPT" >> "$LOG_FILE" 2>&1 &
  echo "$!" > "$TOUCH_PID_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') Started ZeitPlan touch controls. pid=$!" >> "$LOG_FILE"
fi

render_current_screen || show_message "Restarted sync" "pid=$!"
schedule_post_kual_redraw
