#!/bin/sh
set -u

APP_DIR="/mnt/us/home-kindle-today-plan"
STATE_DIR="$APP_DIR/state"
CONFIG_FILE="$APP_DIR/config.sh"
LOG_FILE="$STATE_DIR/kindle.log"
VERSION_FILE="$STATE_DIR/version"
SCHEDULER_PID_FILE="$STATE_DIR/wake-scheduler.pid"
SCHEDULER_STOP_FILE="$STATE_DIR/wake-scheduler.stop"
EVENT_FILE="$STATE_DIR/wake-event.json"
HTTP_FILE="$STATE_DIR/wake-http-code"
PULL_RESPONSE_FILE="$STATE_DIR/wake-pull.json"
PULL_HTTP_FILE="$STATE_DIR/wake-pull-http-code"
IMAGE_HTTP_FILE="$STATE_DIR/wake-image-http-code"
LOCKSCREEN_ONLY_FILE="$STATE_DIR/lockscreen-only"

mkdir -p "$STATE_DIR"

BASE_URL="${BASE_URL:-https://zeitplan.example.com}"
API_KEY="${API_KEY:-replace-with-device-token}"
WIDTH="${WIDTH:-600}"
HEIGHT="${HEIGHT:-800}"
AUTO_DETECT_SCREEN_SIZE="${AUTO_DETECT_SCREEN_SIZE:-1}"
SCREEN_PATH="${SCREEN_PATH:-/mnt/us/linkss/screensavers/bg_ss00.png}"
LOCKSCREEN_DIR="${LOCKSCREEN_DIR:-/mnt/us/linkss/screensavers}"
LOCKSCREEN_REFRESH="${LOCKSCREEN_REFRESH:-1}"
LOCKSCREEN_CANONICAL_FILENAME="${LOCKSCREEN_CANONICAL_FILENAME:-bg_ss00.png}"
LOCKSCREEN_SHUFFLE="${LOCKSCREEN_SHUFFLE:-1}"
SCHEDULED_WAKE_ENABLED="${SCHEDULED_WAKE_ENABLED:-1}"
SCHEDULED_WAKE_START_HOUR="${SCHEDULED_WAKE_START_HOUR:-6}"
SCHEDULED_WAKE_END_HOUR="${SCHEDULED_WAKE_END_HOUR:-0}"
SCHEDULED_WAKE_MINUTES="${SCHEDULED_WAKE_MINUTES:-1 6 31 36}"
SCHEDULED_WAKE_MIN_LEAD_SECONDS="${SCHEDULED_WAKE_MIN_LEAD_SECONDS:-30}"
SCHEDULED_WAKE_WIFI_ENABLE="${SCHEDULED_WAKE_WIFI_ENABLE:-1}"
SCHEDULED_WAKE_WIFI_WAIT_SECONDS="${SCHEDULED_WAKE_WIFI_WAIT_SECONDS:-60}"
SCHEDULED_WAKE_AFTER_PULL_WAIT_SECONDS="${SCHEDULED_WAKE_AFTER_PULL_WAIT_SECONDS:-4}"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

cleanup_lockscreen_only_flag() {
  rm -f "$LOCKSCREEN_ONLY_FILE" 2>/dev/null || true
}

to_number() {
  value="$(printf '%s' "$1" | sed 's/^0*//')"
  [ -n "$value" ] || value=0
  echo "$value"
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
      log "Wake scheduler detected screen size from $size_file width=$WIDTH height=$HEIGHT"
      return 0
    fi
  done

  if command -v fbset >/dev/null 2>&1; then
    FB_GEOMETRY="$(fbset -s 2>/dev/null | sed -n 's/.*geometry[[:space:]]*//p' | head -n 1)"
    if apply_screen_size "$FB_GEOMETRY"; then
      log "Wake scheduler detected screen size from fbset width=$WIDTH height=$HEIGHT"
      return 0
    fi
  fi

  return 1
}

json_get() {
  key="$1"
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$EVENT_FILE" | head -n 1
}

json_get_number() {
  key="$1"
  sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p" "$EVENT_FILE" | head -n 1
}

file_header_hex() {
  if command -v od >/dev/null 2>&1 && [ -f "$1" ]; then
    od -An -tx1 -N8 "$1" 2>/dev/null | tr -d ' \n'
  else
    echo "unavailable"
  fi
}

is_png_file() {
  [ "$(file_header_hex "$1")" = "89504e470d0a1a0a" ]
}

is_active_hour() {
  hour="$1"
  start_hour="$(to_number "$SCHEDULED_WAKE_START_HOUR")"
  end_hour="$(to_number "$SCHEDULED_WAKE_END_HOUR")"

  if [ "$start_hour" = "$end_hour" ]; then
    return 0
  fi

  if [ "$start_hour" -lt "$end_hour" ]; then
    [ "$hour" -ge "$start_hour" ] && [ "$hour" -lt "$end_hour" ]
    return "$?"
  fi

  [ "$hour" -ge "$start_hour" ] || [ "$hour" -lt "$end_hour" ]
}

next_wake_seconds() {
  now_h="$(to_number "$(date '+%H')")"
  now_m="$(to_number "$(date '+%M')")"
  now_s="$(to_number "$(date '+%S')")"
  now_total=$((now_h * 3600 + now_m * 60 + now_s))
  best=999999
  min_lead="$(to_number "$SCHEDULED_WAKE_MIN_LEAD_SECONDS")"
  day=0

  while [ "$day" -le 1 ]; do
    hour=0
    while [ "$hour" -le 23 ]; do
      if is_active_hour "$hour"; then
        for minute_value in $SCHEDULED_WAKE_MINUTES; do
          minute="$(to_number "$minute_value")"
          if [ "$minute" -ge 0 ] 2>/dev/null && [ "$minute" -le 59 ] 2>/dev/null; then
            target=$((day * 86400 + hour * 3600 + minute * 60))
            diff=$((target - now_total))
            if [ "$diff" -ge "$min_lead" ] && [ "$diff" -lt "$best" ]; then
              best="$diff"
            fi
          fi
        done
      fi
      hour=$((hour + 1))
    done
    day=$((day + 1))
  done

  if [ "$best" = "999999" ]; then
    echo 3600
  else
    echo "$best"
  fi
}

set_next_rtc_wakeup() {
  seconds="$(next_wake_seconds)"
  if command -v lipc-set-prop >/dev/null 2>&1; then
    if lipc-set-prop -i com.lab126.powerd rtcWakeup "$seconds" >> "$LOG_FILE" 2>&1; then
      log "Scheduled RTC wakeup. seconds=$seconds minutes=$SCHEDULED_WAKE_MINUTES window=$SCHEDULED_WAKE_START_HOUR-$SCHEDULED_WAKE_END_HOUR"
    else
      log "Scheduled RTC wakeup failed. seconds=$seconds"
    fi
  else
    log "Scheduled RTC wakeup failed. lipc-set-prop not found."
  fi
}

enable_wifi() {
  if [ "$SCHEDULED_WAKE_WIFI_ENABLE" != "1" ]; then
    return 0
  fi

  lipc-set-prop com.lab126.wifid enable 1 >/dev/null 2>&1 || true
  lipc-set-prop com.lab126.cmd wirelessEnable 1 >/dev/null 2>&1 || true
}

wait_for_wifi() {
  if [ "$SCHEDULED_WAKE_WIFI_ENABLE" != "1" ]; then
    return 0
  fi

  elapsed=0
  limit="$(to_number "$SCHEDULED_WAKE_WIFI_WAIT_SECONDS")"
  while [ "$elapsed" -lt "$limit" ]; do
    state="$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null || true)"
    case "$state" in
      *CONNECTED*)
        log "Wake scheduler Wi-Fi connected. state=$state"
        return 0
        ;;
    esac
    sleep 2
    elapsed=$((elapsed + 2))
  done

  log "Wake scheduler Wi-Fi wait timed out."
  return 1
}

download_screen_image() {
  image_url="$1"
  output_path="$2"
  output_dir="${output_path%/*}"

  if [ "$output_dir" != "$output_path" ]; then
    mkdir -p "$output_dir" || {
      log "Wake image download failed. cannot create directory=$output_dir"
      return 1
    }
  fi

  curl \
    --silent \
    --show-error \
    --location \
    --max-time 30 \
    --output "$output_path" \
    --write-out "%{http_code}" \
    "$image_url" > "$IMAGE_HTTP_FILE"

  image_curl_exit="$?"
  image_http_code="$(cat "$IMAGE_HTTP_FILE" 2>/dev/null || echo 000)"
  image_header="$(file_header_hex "$output_path")"

  if [ "$image_curl_exit" = "0" ] && [ "$image_http_code" = "200" ] && is_png_file "$output_path"; then
    return 0
  fi

  log "Wake image download failed. curl_exit=$image_curl_exit http_code=$image_http_code header=$image_header image_url=$image_url"
  return 1
}

refresh_linkss_lockscreen() {
  source_path="$1"
  if [ "$LOCKSCREEN_REFRESH" != "1" ]; then
    return 0
  fi

  if [ ! -d "/mnt/us/linkss" ]; then
    log "Wake lockscreen refresh skipped. /mnt/us/linkss is missing."
    return 0
  fi

  if ! is_png_file "$source_path"; then
    log "Wake lockscreen refresh skipped. source is not a PNG. path=$source_path header=$(file_header_hex "$source_path")"
    return 1
  fi

  mkdir -p "$LOCKSCREEN_DIR" || {
    log "Wake lockscreen refresh failed. cannot create directory=$LOCKSCREEN_DIR"
    return 1
  }

  target_path="$LOCKSCREEN_DIR/$LOCKSCREEN_CANONICAL_FILENAME"
  if [ "$source_path" != "$target_path" ]; then
    temp_path="$target_path.tmp"
    if cp "$source_path" "$temp_path" 2>/dev/null && mv "$temp_path" "$target_path" 2>/dev/null; then
      log "Wake lockscreen canonical image updated. path=$target_path"
    else
      rm -f "$temp_path" 2>/dev/null || true
      log "Wake lockscreen refresh failed. target=$target_path"
      return 1
    fi
  fi

  for stale_path in "$LOCKSCREEN_DIR"/bg_medium_ss*.png "$LOCKSCREEN_DIR"/bg_xsmall_ss*.png "$LOCKSCREEN_DIR"/bg_ss[0-9][1-9].png "$LOCKSCREEN_DIR"/bg_ss[1-9][0-9].png; do
    [ -f "$stale_path" ] && rm -f "$stale_path" 2>/dev/null || true
  done

  sync

  if [ "$LOCKSCREEN_SHUFFLE" = "1" ] && [ -x "/mnt/us/linkss/bin/shuffless" ]; then
    if /mnt/us/linkss/bin/shuffless watchdog >> "$LOG_FILE" 2>&1; then
      log "Wake lockscreen linkss directory refreshed. path=$target_path"
    else
      log "Wake lockscreen linkss directory refresh returned a non-zero status. path=$target_path"
    fi
  fi

  for active_dir in /usr/share/blanket/screensaver /var/local/custom_screensavers; do
    if [ -d "$active_dir" ]; then
      cp "$target_path" "$active_dir/$LOCKSCREEN_CANONICAL_FILENAME" 2>/dev/null || true
    fi
  done

  sync
  log "Wake lockscreen image refreshed. path=$target_path"
}

request_pull() {
  rm -f "$PULL_RESPONSE_FILE" "$PULL_HTTP_FILE"
  curl \
    --silent \
    --show-error \
    --location \
    --max-time 25 \
    --request POST \
    --output "$PULL_RESPONSE_FILE" \
    --write-out "%{http_code}" \
    -H "access-token: $API_KEY" \
    -H "width: $WIDTH" \
    -H "height: $HEIGHT" \
    "$BASE_URL/api/kindle/pull" > "$PULL_HTTP_FILE"

  pull_curl_exit="$?"
  pull_http_code="$(cat "$PULL_HTTP_FILE" 2>/dev/null || echo 000)"
  if [ "$pull_curl_exit" = "0" ] && [ "$pull_http_code" = "200" ]; then
    log "Wake pull requested successfully. width=$WIDTH height=$HEIGHT"
    return 0
  fi

  log "Wake pull failed. curl_exit=$pull_curl_exit http_code=$pull_http_code"
  return 1
}

poll_and_apply_update() {
  version="0"
  if [ -f "$VERSION_FILE" ]; then
    version="$(cat "$VERSION_FILE" 2>/dev/null || echo 0)"
  fi

  rm -f "$EVENT_FILE" "$HTTP_FILE" "$IMAGE_HTTP_FILE"
  curl \
    --silent \
    --show-error \
    --location \
    --max-time 65 \
    --output "$EVENT_FILE" \
    --write-out "%{http_code}" \
    -H "access-token: $API_KEY" \
    -H "width: $WIDTH" \
    -H "height: $HEIGHT" \
    "$BASE_URL/api/kindle/events?since=$version" > "$HTTP_FILE"

  event_curl_exit="$?"
  event_http_code="$(cat "$HTTP_FILE" 2>/dev/null || echo 000)"

  if [ "$event_curl_exit" = "0" ] && [ "$event_http_code" = "204" ]; then
    log "Wake event poll returned no new content. another client may have already applied the update. since=$version"
    return 0
  fi

  if [ "$event_curl_exit" != "0" ] || [ "$event_http_code" != "200" ]; then
    log "Wake event poll failed. curl_exit=$event_curl_exit http_code=$event_http_code since=$version"
    return 1
  fi

  event_type="$(json_get type)"
  new_version="$(json_get_number version)"
  image_url="$(json_get image_url)"

  if [ "$event_type" != "screen.update" ] || [ -z "$new_version" ] || [ -z "$image_url" ]; then
    log "Wake event ignored. type=$event_type version=$new_version image_url=$image_url"
    return 1
  fi

  if download_screen_image "$image_url" "$SCREEN_PATH"; then
    refresh_linkss_lockscreen "$SCREEN_PATH" || true
    echo "$new_version" > "$VERSION_FILE"
    log "Wake update applied. version=$new_version path=$SCREEN_PATH"
    return 0
  fi

  return 1
}

run_wake_update() {
  if [ "$BASE_URL" = "https://zeitplan.example.com" ] || [ -z "$BASE_URL" ]; then
    log "Wake update skipped. BASE_URL is not configured."
    return 1
  fi

  if [ "$API_KEY" = "replace-with-device-token" ] || [ -z "$API_KEY" ]; then
    log "Wake update skipped. API_KEY is not configured."
    return 1
  fi

  enable_wifi
  wait_for_wifi || true
  touch "$LOCKSCREEN_ONLY_FILE"
  request_pull || {
    cleanup_lockscreen_only_flag
    return 1
  }
  sleep "$(to_number "$SCHEDULED_WAKE_AFTER_PULL_WAIT_SECONDS")"
  poll_and_apply_update
  result="$?"
  cleanup_lockscreen_only_flag
  return "$result"
}

trap cleanup_lockscreen_only_flag EXIT INT TERM

handle_power_event() {
  event_line="$1"
  case "$event_line" in
    *readyToSuspend*)
      set_next_rtc_wakeup
      ;;
    *wakeupFromSuspend*)
      log "Wake scheduler woke from suspend. event=$event_line"
      run_wake_update || true
      ;;
  esac
}

if [ "$SCHEDULED_WAKE_ENABLED" != "1" ]; then
  log "Wake scheduler disabled by config."
  exit 0
fi

if [ "$AUTO_DETECT_SCREEN_SIZE" != "0" ]; then
  detect_screen_size || true
fi

rm -f "$SCHEDULER_STOP_FILE"
echo "$$" > "$SCHEDULER_PID_FILE"
log "Wake scheduler started. window=$SCHEDULED_WAKE_START_HOUR-$SCHEDULED_WAKE_END_HOUR minutes=$SCHEDULED_WAKE_MINUTES"

if ! command -v lipc-wait-event >/dev/null 2>&1; then
  log "Wake scheduler stopped. lipc-wait-event not found."
  exit 1
fi

while true; do
  if [ -f "$SCHEDULER_STOP_FILE" ]; then
    log "Wake scheduler stop file detected. exiting."
    rm -f "$SCHEDULER_STOP_FILE" "$SCHEDULER_PID_FILE"
    exit 0
  fi

  lipc-wait-event -m com.lab126.powerd '*' 2>> "$LOG_FILE" | while read -r event_line; do
    if [ -f "$SCHEDULER_STOP_FILE" ]; then
      break
    fi
    handle_power_event "$event_line"
  done

  sleep 2
done
