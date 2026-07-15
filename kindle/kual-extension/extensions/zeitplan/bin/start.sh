#!/bin/sh

APP_DIR="/mnt/us/home-kindle-today-plan"
STATE_DIR="$APP_DIR/state"
SCRIPT="$APP_DIR/home-kindle-today-plan.sh"
SCREEN_PATH="$APP_DIR/current.png"
CONFIG_FILE="$APP_DIR/config.sh"
TOUCH_SCRIPT="/mnt/us/extensions/zeitplan/bin/touch-buttons.sh"
WAKE_SCRIPT="/mnt/us/extensions/zeitplan/bin/wake-scheduler.sh"
ALWAYS_ON_PULL_SCRIPT="/mnt/us/extensions/zeitplan/bin/always-on-pull-scheduler.sh"
PID_FILE="$STATE_DIR/zeitplan.pid"
TOUCH_PID_FILE="$STATE_DIR/touch.pid"
WAKE_PID_FILE="$STATE_DIR/wake-scheduler.pid"
ALWAYS_ON_PULL_PID_FILE="$STATE_DIR/always-on-pull-scheduler.pid"
LOG_FILE="$STATE_DIR/kindle.log"
STOP_FILE="$STATE_DIR/stop"
WAKE_STOP_FILE="$STATE_DIR/wake-scheduler.stop"
ALWAYS_ON_PULL_STOP_FILE="$STATE_DIR/always-on-pull-scheduler.stop"

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

if [ -f "$ALWAYS_ON_PULL_PID_FILE" ]; then
  ALWAYS_ON_PULL_PID="$(cat "$ALWAYS_ON_PULL_PID_FILE" 2>/dev/null || true)"
  if [ -n "$ALWAYS_ON_PULL_PID" ] && kill -0 "$ALWAYS_ON_PULL_PID" 2>/dev/null; then
    kill "$ALWAYS_ON_PULL_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Restart requested. stopping existing always-on pull scheduler. pid=$ALWAYS_ON_PULL_PID" >> "$LOG_FILE"
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

# Old scheduler builds trapped TERM for cleanup but continued running. Ensure
# no stale scheduler survives before always-on mode starts.
sleep 1
ps 2>/dev/null | grep '[w]ake-scheduler.sh' | awk '{print $1}' | while read -r OLD_WAKE_PID; do
  if [ -n "$OLD_WAKE_PID" ]; then
    kill -9 "$OLD_WAKE_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Force-stopped stale ZeitPlan wake scheduler. pid=$OLD_WAKE_PID" >> "$LOG_FILE"
  fi
done

# Older scheduler versions used a shell pipeline. Killing only the parent left
# lipc-wait-event children alive, so every power event was handled repeatedly.
ps 2>/dev/null | grep '[l]ipc-wait-event.*com.lab126.powerd' | awk '{print $1}' | while read -r OLD_EVENT_PID; do
  if [ -n "$OLD_EVENT_PID" ]; then
    kill "$OLD_EVENT_PID" 2>/dev/null || true
    echo "$(date '+%Y-%m-%d %H:%M:%S') Stopped stale power event listener. pid=$OLD_EVENT_PID" >> "$LOG_FILE"
  fi
done
sleep 2

# Give the old scheduler and its event pipeline time to release the singleton
# lock before launching its replacement.
OLD_WAKE_WAIT=0
while [ -d "$STATE_DIR/wake-scheduler.lock" ] && [ "$OLD_WAKE_WAIT" -lt 10 ]; do
  sleep 1
  OLD_WAKE_WAIT=$((OLD_WAKE_WAIT + 1))
done
if [ -d "$STATE_DIR/wake-scheduler.lock" ]; then
  OLD_LOCK_PID="$(cat "$STATE_DIR/wake-scheduler.lock/pid" 2>/dev/null || true)"
  if [ -z "$OLD_LOCK_PID" ] || ! kill -0 "$OLD_LOCK_PID" 2>/dev/null; then
    rm -f "$STATE_DIR/wake-scheduler.lock/pid" 2>/dev/null || true
    rmdir "$STATE_DIR/wake-scheduler.lock" 2>/dev/null || true
  fi
fi

rm -f "$PID_FILE" "$TOUCH_PID_FILE" "$WAKE_PID_FILE" "$ALWAYS_ON_PULL_PID_FILE" "$STOP_FILE" "$WAKE_STOP_FILE" "$ALWAYS_ON_PULL_STOP_FILE"

nohup sh "$SCRIPT" >> "$LOG_FILE" 2>&1 &
echo "$!" > "$PID_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') Started ZeitPlan client. pid=$!" >> "$LOG_FILE"

if [ "${SCHEDULED_WAKE_ENABLED:-1}" = "1" ] && [ -f "$WAKE_SCRIPT" ]; then
  nohup sh "$WAKE_SCRIPT" >> "$LOG_FILE" 2>&1 &
  echo "$!" > "$WAKE_PID_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') Started ZeitPlan wake scheduler. pid=$!" >> "$LOG_FILE"
fi

if [ "${ALWAYS_ON_ENABLED:-0}" = "1" ] && [ "${ALWAYS_ON_PULL_ENABLED:-1}" = "1" ] && [ -f "$ALWAYS_ON_PULL_SCRIPT" ]; then
  nohup sh "$ALWAYS_ON_PULL_SCRIPT" >> "$LOG_FILE" 2>&1 &
  echo "$!" > "$ALWAYS_ON_PULL_PID_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') Started always-on pull scheduler. pid=$!" >> "$LOG_FILE"
fi

if [ "$OPEN_AS_BOOK" != "1" ] && [ -f "$TOUCH_SCRIPT" ]; then
  nohup sh "$TOUCH_SCRIPT" >> "$LOG_FILE" 2>&1 &
  echo "$!" > "$TOUCH_PID_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') Started ZeitPlan touch controls. pid=$!" >> "$LOG_FILE"
fi

render_current_screen || show_message "Restarted sync" "pid=$!"
schedule_post_kual_redraw
