#!/bin/sh

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

release_always_on() {
  if [ "${ALWAYS_ON_ACTIVE:-0}" != "1" ]; then
    return 0
  fi

  if lipc-set-prop com.lab126.powerd preventScreenSaver 0 >/dev/null 2>&1; then
    ALWAYS_ON_ACTIVE=0
    log "Always-on mode released. property=preventScreenSaver value=0"
    return 0
  fi

  log "Always-on mode release failed. property=preventScreenSaver value=0"
  return 1
}

cleanup_client() {
  release_always_on || true
}

handle_client_signal() {
  log "ZeitPlan Kindle client received termination signal."
  exit 0
}

enable_always_on() {
  if [ "$ALWAYS_ON_ENABLED" != "1" ]; then
    log "Always-on mode disabled by configuration."
    return 0
  fi

  if ! command -v lipc-set-prop >/dev/null 2>&1; then
    log "Always-on mode failed. lipc-set-prop command not found."
    return 1
  fi

  if lipc-set-prop com.lab126.powerd preventScreenSaver 1 >/dev/null 2>&1; then
    ALWAYS_ON_ACTIVE=1
    log "Always-on mode enabled. property=preventScreenSaver value=1"
    return 0
  fi

  log "Always-on mode failed. property=preventScreenSaver value=1"
  return 1
}

recover_always_on_wifi() {
  if [ "$ALWAYS_ON_ENABLED" != "1" ]; then
    return 0
  fi

  log "Always-on Wi-Fi recovery started. timeout_seconds=$ALWAYS_ON_WIFI_WAIT_SECONDS"
  lipc-set-prop com.lab126.wifid enable 1 >/dev/null 2>&1 || true
  lipc-set-prop com.lab126.cmd wirelessEnable 1 >/dev/null 2>&1 || true
  if command -v wpa_cli >/dev/null 2>&1; then
    wpa_cli reassociate >/dev/null 2>&1 || true
  fi

  elapsed=0
  limit="$(printf '%s' "$ALWAYS_ON_WIFI_WAIT_SECONDS" | sed 's/[^0-9].*//')"
  [ -n "$limit" ] || limit=120
  while [ "$elapsed" -lt "$limit" ]; do
    state="$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null || true)"
    case "$state" in
      *CONNECTED*)
        log "Always-on Wi-Fi recovery succeeded. elapsed=$elapsed state=$state"
        return 0
        ;;
    esac

    if [ "$elapsed" -eq 10 ] && command -v wpa_cli >/dev/null 2>&1; then
      wpa_cli disconnect >/dev/null 2>&1 || true
      sleep 1
      wpa_cli reconnect >/dev/null 2>&1 || true
    elif [ "$elapsed" -eq 30 ] || [ "$elapsed" -eq 60 ]; then
      lipc-set-prop com.lab126.wifid enable 0 >/dev/null 2>&1 || true
      sleep 2
      lipc-set-prop com.lab126.wifid enable 1 >/dev/null 2>&1 || true
      lipc-set-prop com.lab126.cmd wirelessEnable 1 >/dev/null 2>&1 || true
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  log "Always-on Wi-Fi recovery failed. timed out after ${limit}s state=${state:-unknown}"
  return 1
}

apply_screen_size() {
  set -- $(printf '%s\n' "$1" | sed 's/[^0-9]/ /g')
  if [ "${1:-0}" -ge 300 ] 2>/dev/null && [ "${2:-0}" -ge 300 ] 2>/dev/null; then
    WIDTH="$1"
    HEIGHT="$2"
    return 0
  fi

  return 1
}

detect_screen_size() {
  for size_file in \
    /sys/class/graphics/fb0/virtual_size \
    /sys/class/graphics/fb0/modes \
    /proc/eink_fb/virtual_fb_size
  do
    if [ -f "$size_file" ] && apply_screen_size "$(head -n 1 "$size_file" 2>/dev/null)"; then
      log "Detected screen size from $size_file width=$WIDTH height=$HEIGHT"
      return 0
    fi
  done

  if command -v fbset >/dev/null 2>&1; then
    FB_GEOMETRY="$(fbset -s 2>/dev/null | sed -n 's/.*geometry[[:space:]]*//p' | head -n 1)"
    if apply_screen_size "$FB_GEOMETRY"; then
      log "Detected screen size from fbset width=$WIDTH height=$HEIGHT"
      return 0
    fi
  fi

  log "Unable to auto-detect screen size. using configured width=$WIDTH height=$HEIGHT"
  return 1
}

trap cleanup_client EXIT
trap handle_client_signal INT TERM
