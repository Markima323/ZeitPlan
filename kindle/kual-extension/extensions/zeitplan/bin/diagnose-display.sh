#!/bin/sh

APP_DIR="/mnt/us/home-kindle-today-plan"
STATE_DIR="$APP_DIR/state"
CONFIG_FILE="$APP_DIR/config.sh"
LOG_FILE="$STATE_DIR/kindle.log"
SCREEN_PATH="$APP_DIR/current.png"

mkdir -p "$STATE_DIR"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

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

dump_file() {
  if [ -f "$1" ]; then
    printf '%s=' "$1" >> "$LOG_FILE"
    cat "$1" >> "$LOG_FILE" 2>&1
    printf '\n' >> "$LOG_FILE"
  else
    printf '%s=missing\n' "$1" >> "$LOG_FILE"
  fi
}

{
  printf '%s ZeitPlan display diagnostics begin\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf 'configured_width=%s configured_height=%s display_mode=%s\n' "${WIDTH:-}" "${HEIGHT:-}" "${DISPLAY_MODE:-}"
  printf 'uname='
  uname -a 2>&1
  printf 'commands='
  for command_name in eips fbset fbink file od pnginfo identify; do
    if command -v "$command_name" >/dev/null 2>&1; then
      printf '%s:%s ' "$command_name" "$(command -v "$command_name")"
    else
      printf '%s:missing ' "$command_name"
    fi
  done
  printf '\n'
  printf 'current_image='
  ls -l "$SCREEN_PATH" 2>&1
  printf 'current_header='
  if command -v od >/dev/null 2>&1 && [ -f "$SCREEN_PATH" ]; then
    od -An -tx1 -N32 "$SCREEN_PATH" 2>/dev/null | tr -d ' \n'
  else
    printf 'unavailable'
  fi
  printf '\n'
} >> "$LOG_FILE" 2>&1

for info_file in \
  /sys/class/graphics/fb0/virtual_size \
  /sys/class/graphics/fb0/modes \
  /sys/class/graphics/fb0/bits_per_pixel \
  /sys/class/graphics/fb0/stride \
  /sys/class/graphics/fb0/name \
  /proc/eink_fb/virtual_fb_size \
  /proc/eink_fb/update_display
do
  dump_file "$info_file"
done

{
  printf 'fbset=\n'
  fbset -s 2>&1 || true
  printf 'eips_help=\n'
  eips -h 2>&1 || eips --help 2>&1 || eips 2>&1 || true
  printf '%s ZeitPlan display diagnostics end\n' "$(date '+%Y-%m-%d %H:%M:%S')"
} >> "$LOG_FILE" 2>&1

show_message "Diagnostics saved" "Export log"
log "Display diagnostics saved."
