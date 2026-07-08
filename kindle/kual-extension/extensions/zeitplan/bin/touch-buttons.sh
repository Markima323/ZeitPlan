#!/bin/sh

APP_DIR="/mnt/us/home-kindle-today-plan"
EXTENSION_DIR="/mnt/us/extensions/zeitplan"
STATE_DIR="$APP_DIR/state"
CONFIG_FILE="$APP_DIR/config.sh"
LOG_FILE="$STATE_DIR/kindle.log"
TOUCH_PID_FILE="$STATE_DIR/touch.pid"
REFRESH_SCRIPT="$EXTENSION_DIR/bin/refresh.sh"
STOP_SCRIPT="$EXTENSION_DIR/bin/stop.sh"

mkdir -p "$STATE_DIR"

WIDTH="${WIDTH:-1072}"
HEIGHT="${HEIGHT:-1448}"
TOUCH_EVENT_DEVICE="${TOUCH_EVENT_DEVICE:-}"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

find_touch_device() {
  if [ -n "$TOUCH_EVENT_DEVICE" ] && [ -e "$TOUCH_EVENT_DEVICE" ]; then
    echo "$TOUCH_EVENT_DEVICE"
    return 0
  fi

  awk '
    /^I:/ {
      name = ""
      event = ""
      has_abs = 0
    }
    /Name=/ { name=tolower($0) }
    /Handlers=/ {
      for (i = 1; i <= NF; i += 1) {
        if ($i ~ /^event[0-9]+$/) {
          event = "/dev/input/" $i
        }
      }
    }
    /B: ABS=/ { has_abs = 1 }
    /^$/ {
      if (event != "" && name ~ /touch|cyttsp|elan|zforce|finger|multitouch|mx|max|fts/) {
        print event
        exit
      }
      if (fallback == "" && event != "" && has_abs == 1) {
        fallback = event
      }
    }
    END {
      if (fallback != "") {
        print fallback
      }
    }
  ' /proc/bus/input/devices 2>/dev/null
}

run_update() {
  log "Touch button tapped: update."
  if [ -x "$REFRESH_SCRIPT" ] || [ -f "$REFRESH_SCRIPT" ]; then
    QUIET=1 sh "$REFRESH_SCRIPT" &
  fi
}

run_exit() {
  log "Touch button tapped: exit."
  if [ -x "$STOP_SCRIPT" ] || [ -f "$STOP_SCRIPT" ]; then
    QUIET=1 sh "$STOP_SCRIPT" &
  fi
}

handle_tap() {
  x="$1"
  y="$2"
  min_y=$((HEIGHT - 170))
  max_y=$((HEIGHT - 25))
  update_min_x=$((WIDTH - 340))
  exit_min_x=$((WIDTH - 180))
  max_x=$((WIDTH - 35))

  if [ "$y" -lt "$min_y" ] || [ "$y" -gt "$max_y" ] || [ "$x" -lt "$update_min_x" ] || [ "$x" -gt "$max_x" ]; then
    log "Touch ignored. x=$x y=$y"
    return 0
  fi

  if [ "$x" -ge "$exit_min_x" ]; then
    run_exit
  else
    run_update
  fi
}

if ! command -v evtest >/dev/null 2>&1; then
  log "Touch buttons disabled. evtest is not available on this Kindle."
  exit 0
fi

DEVICE="$(find_touch_device)"
if [ -z "$DEVICE" ] || [ ! -e "$DEVICE" ]; then
  log "Touch buttons disabled. touch input device not found."
  if [ -f /proc/bus/input/devices ]; then
    log "Available input devices follow:"
    sed 's/^/  /' /proc/bus/input/devices >> "$LOG_FILE" 2>/dev/null || true
  fi
  exit 0
fi

echo "$$" > "$TOUCH_PID_FILE"
log "Touch buttons started. device=$DEVICE width=$WIDTH height=$HEIGHT"

current_x=""
current_y=""
evtest --grab "$DEVICE" 2>&1 | while IFS= read -r line; do
  case "$line" in
    *ABS_X*|*ABS_MT_POSITION_X*)
      current_x="$(printf '%s\n' "$line" | sed -n 's/.*value \([-0-9][0-9]*\).*/\1/p')"
      ;;
    *ABS_Y*|*ABS_MT_POSITION_Y*)
      current_y="$(printf '%s\n' "$line" | sed -n 's/.*value \([-0-9][0-9]*\).*/\1/p')"
      ;;
    *BTN_TOUCH*value\ 0*)
      if [ -n "$current_x" ] && [ -n "$current_y" ]; then
        handle_tap "$current_x" "$current_y"
      fi
      ;;
  esac
done
