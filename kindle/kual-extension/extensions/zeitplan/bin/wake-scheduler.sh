#!/bin/sh
set -u

APP_DIR="/mnt/us/home-kindle-today-plan"
STATE_DIR="$APP_DIR/state"
CONFIG_FILE="$APP_DIR/config.sh"
LOG_FILE="$STATE_DIR/kindle.log"
VERSION_FILE="$STATE_DIR/version"
SCHEDULER_PID_FILE="$STATE_DIR/wake-scheduler.pid"
SCHEDULER_STOP_FILE="$STATE_DIR/wake-scheduler.stop"
SCHEDULER_LOCK_DIR="$STATE_DIR/wake-scheduler.lock"
# /mnt/us is FAT-backed on Kindle and cannot host Unix FIFOs. Keep the
# persistent lock in STATE_DIR, but create the event pipe on the Linux tmpfs.
SCHEDULER_EVENT_PIPE="/tmp/zeitplan-wake-scheduler.$$.events"
EVENT_FILE="$STATE_DIR/wake-event.json"
HTTP_FILE="$STATE_DIR/wake-http-code"
PULL_RESPONSE_FILE="$STATE_DIR/wake-pull.json"
PULL_HTTP_FILE="$STATE_DIR/wake-pull-http-code"
IMAGE_HTTP_FILE="$STATE_DIR/wake-image-http-code"
LOCKSCREEN_ONLY_FILE="$STATE_DIR/lockscreen-only"
WAKE_UPDATE_ACTIVE_FILE="$STATE_DIR/wake-update-active"

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
SCHEDULED_WAKE_WIFI_WAIT_SECONDS="${SCHEDULED_WAKE_WIFI_WAIT_SECONDS:-120}"
SCHEDULED_WAKE_AFTER_PULL_WAIT_SECONDS="${SCHEDULED_WAKE_AFTER_PULL_WAIT_SECONDS:-4}"
SCHEDULED_WAKE_PULL_RETRIES="${SCHEDULED_WAKE_PULL_RETRIES:-4}"
SCHEDULED_WAKE_EVENT_RETRIES="${SCHEDULED_WAKE_EVENT_RETRIES:-2}"
SCHEDULED_WAKE_RETRY_DELAY_SECONDS="${SCHEDULED_WAKE_RETRY_DELAY_SECONDS:-10}"
SCHEDULED_WAKE_SLEEP_AFTER_UPDATE="${SCHEDULED_WAKE_SLEEP_AFTER_UPDATE:-1}"
SCHEDULED_WAKE_SLEEP_DELAY_SECONDS="${SCHEDULED_WAKE_SLEEP_DELAY_SECONDS:-8}"
LOCKSCREEN_ONLY_TTL_SECONDS="${LOCKSCREEN_ONLY_TTL_SECONDS:-300}"
SCHEDULED_WAKE_PREVENT_SUSPEND="${SCHEDULED_WAKE_PREVENT_SUSPEND:-1}"
RTC_WAKE_ARMED=0
RTC_WAKE_ARMED_SECONDS=""

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

cleanup_scheduler() {
  release_wake_lock
  rm -f "$WAKE_UPDATE_ACTIVE_FILE" 2>/dev/null || true
  cleanup_lockscreen_only_flag
  if [ -n "${EVENT_LISTENER_PID:-}" ]; then
    kill "$EVENT_LISTENER_PID" 2>/dev/null || true
  fi
  rm -f "$SCHEDULER_EVENT_PIPE" 2>/dev/null || true
  if [ -f "$SCHEDULER_LOCK_DIR/pid" ] && [ "$(cat "$SCHEDULER_LOCK_DIR/pid" 2>/dev/null)" = "$$" ]; then
    rm -f "$SCHEDULER_LOCK_DIR/pid" "$SCHEDULER_PID_FILE"
    rmdir "$SCHEDULER_LOCK_DIR" 2>/dev/null || true
  fi
}

acquire_wake_lock() {
  log "Wake step acquire_wake_lock started. configured=$SCHEDULED_WAKE_PREVENT_SUSPEND"
  if [ "$SCHEDULED_WAKE_PREVENT_SUSPEND" != "1" ]; then
    log "Wake step acquire_wake_lock skipped. disabled by configuration."
    return 0
  fi

  if ! command -v lipc-set-prop >/dev/null 2>&1; then
    log "Wake step acquire_wake_lock failed. lipc-set-prop command not found."
    return 1
  fi

  if lipc-set-prop com.lab126.powerd preventScreenSaver 1 >/dev/null 2>&1; then
    POWER_HOLD_ACTIVE=1
    log "Wake step acquire_wake_lock succeeded. property=preventScreenSaver value=1"
    return 0
  fi

  log "Wake step acquire_wake_lock failed. property=preventScreenSaver value=1"
  return 1
}

release_wake_lock() {
  if [ "${POWER_HOLD_ACTIVE:-0}" != "1" ]; then
    return 0
  fi

  if lipc-set-prop com.lab126.powerd preventScreenSaver 0 >/dev/null 2>&1; then
    POWER_HOLD_ACTIVE=0
    log "Wake step release_wake_lock succeeded. property=preventScreenSaver value=0"
    return 0
  fi

  log "Wake step release_wake_lock failed. property=preventScreenSaver value=0"
  return 1
}

clear_wake_update_active() {
  rm -f "$WAKE_UPDATE_ACTIVE_FILE" 2>/dev/null || true
}

acquire_scheduler_lock() {
  if mkdir "$SCHEDULER_LOCK_DIR" 2>/dev/null; then
    echo "$$" > "$SCHEDULER_LOCK_DIR/pid"
    return 0
  fi

  lock_pid="$(cat "$SCHEDULER_LOCK_DIR/pid" 2>/dev/null || true)"
  if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
    log "Wake scheduler already running. pid=$lock_pid; duplicate exiting."
    return 1
  fi

  rm -f "$SCHEDULER_LOCK_DIR/pid" 2>/dev/null || true
  rmdir "$SCHEDULER_LOCK_DIR" 2>/dev/null || true
  mkdir "$SCHEDULER_LOCK_DIR" 2>/dev/null || return 1
  echo "$$" > "$SCHEDULER_LOCK_DIR/pid"
}

set_lockscreen_only_flag() {
  log "Wake step set_lockscreen_only_flag started."
  now_epoch="$(date '+%s' 2>/dev/null || echo 0)"
  ttl="$(to_number "$LOCKSCREEN_ONLY_TTL_SECONDS")"
  [ "$ttl" -gt 0 ] 2>/dev/null || ttl=300
  expires_at=$((now_epoch + ttl))
  if echo "$expires_at" > "$LOCKSCREEN_ONLY_FILE"; then
    log "Wake step set_lockscreen_only_flag succeeded. path=$LOCKSCREEN_ONLY_FILE now=$now_epoch ttl=$ttl expires_at=$expires_at"
    return 0
  fi

  log "Wake step set_lockscreen_only_flag failed. path=$LOCKSCREEN_ONLY_FILE now=$now_epoch ttl=$ttl"
  return 1
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
  if [ "$RTC_WAKE_ARMED" = "1" ]; then
    log "Scheduled RTC wakeup unchanged. pid=$$ already_armed=1 seconds=$RTC_WAKE_ARMED_SECONDS"
    return 0
  fi

  seconds="$(next_wake_seconds)"
  if command -v lipc-set-prop >/dev/null 2>&1; then
    if lipc-set-prop -i com.lab126.powerd rtcWakeup "$seconds" >> "$LOG_FILE" 2>&1; then
      RTC_WAKE_ARMED=1
      RTC_WAKE_ARMED_SECONDS="$seconds"
      log "Scheduled RTC wakeup. pid=$$ seconds=$seconds minutes=$SCHEDULED_WAKE_MINUTES window=$SCHEDULED_WAKE_START_HOUR-$SCHEDULED_WAKE_END_HOUR"
    else
      log "Scheduled RTC wakeup failed. pid=$$ seconds=$seconds"
    fi
  else
    log "Scheduled RTC wakeup failed. lipc-set-prop not found."
  fi
}

enable_wifi() {
  log "Wake step enable_wifi started. configured=$SCHEDULED_WAKE_WIFI_ENABLE"
  if [ "$SCHEDULED_WAKE_WIFI_ENABLE" != "1" ]; then
    log "Wake step enable_wifi succeeded. Wi-Fi enable is disabled by configuration; no command was required."
    return 0
  fi

  enable_result=1
  if command -v wpa_cli >/dev/null 2>&1; then
    if wpa_cli reassociate >/dev/null 2>&1; then
      log "Wake step enable_wifi wpa_cli reassociate succeeded."
      enable_result=0
    else
      log "Wake step enable_wifi wpa_cli reassociate failed."
    fi
  else
    log "Wake step enable_wifi wpa_cli skipped. command not found."
  fi
  if lipc-set-prop com.lab126.wifid enable 1 >/dev/null 2>&1; then
    log "Wake step enable_wifi wifid enable succeeded."
    enable_result=0
  else
    log "Wake step enable_wifi wifid enable failed."
  fi
  if lipc-set-prop com.lab126.cmd wirelessEnable 1 >/dev/null 2>&1; then
    log "Wake step enable_wifi wirelessEnable succeeded."
    enable_result=0
  else
    log "Wake step enable_wifi wirelessEnable failed."
  fi

  if [ "$enable_result" = "0" ]; then
    log "Wake step enable_wifi succeeded. at least one Wi-Fi enable command was accepted."
    return 0
  fi

  log "Wake step enable_wifi failed. all available Wi-Fi enable commands failed."
  return 1
}

reconnect_wifi_stage() {
  stage="$1"

  if command -v wpa_cli >/dev/null 2>&1; then
    case "$stage" in
      1)
        wpa_cli reassociate >/dev/null 2>&1 || true
        ;;
      2)
        wpa_cli disconnect >/dev/null 2>&1 || true
        sleep 1
        wpa_cli reconnect >/dev/null 2>&1 || true
        ;;
      *)
        wpa_cli reconnect >/dev/null 2>&1 || true
        ;;
    esac
  fi

  if [ "$stage" -ge 3 ] 2>/dev/null; then
    lipc-set-prop com.lab126.wifid enable 0 >/dev/null 2>&1 || true
    sleep 2
    lipc-set-prop com.lab126.wifid enable 1 >/dev/null 2>&1 || true
    lipc-set-prop com.lab126.cmd wirelessEnable 1 >/dev/null 2>&1 || true
  fi
}

wait_for_wifi() {
  log "Wake step wait_for_wifi started. configured=$SCHEDULED_WAKE_WIFI_ENABLE timeout_seconds=$SCHEDULED_WAKE_WIFI_WAIT_SECONDS"
  if [ "$SCHEDULED_WAKE_WIFI_ENABLE" != "1" ]; then
    log "Wake step wait_for_wifi succeeded. Wi-Fi waiting is disabled by configuration."
    return 0
  fi

  elapsed=0
  limit="$(to_number "$SCHEDULED_WAKE_WIFI_WAIT_SECONDS")"
  while [ "$elapsed" -lt "$limit" ]; do
    if [ "$elapsed" -eq 0 ]; then
      reconnect_wifi_stage 1
    elif [ "$elapsed" -eq 10 ]; then
      reconnect_wifi_stage 2
    elif [ "$elapsed" -eq 30 ]; then
      reconnect_wifi_stage 3
    elif [ "$elapsed" -eq 60 ]; then
      reconnect_wifi_stage 4
    fi

    state="$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null || true)"
    log "Wake step wait_for_wifi checked state. elapsed=$elapsed limit=$limit state=${state:-unknown}"
    case "$state" in
      *CONNECTED*)
        log "Wake step wait_for_wifi succeeded. elapsed=$elapsed state=$state"
        return 0
        ;;
    esac
    sleep 2
    elapsed=$((elapsed + 2))
  done

  log "Wake step wait_for_wifi failed. timed out after ${limit}s last_state=${state:-unknown}"
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
  attempt=1
  max_attempts="$(to_number "$SCHEDULED_WAKE_PULL_RETRIES")"
  [ "$max_attempts" -ge 1 ] 2>/dev/null || max_attempts=1
  log "Wake step request_pull started. max_attempts=$max_attempts width=$WIDTH height=$HEIGHT"

  while [ "$attempt" -le "$max_attempts" ]; do
    log "Wake step request_pull attempt started. attempt=$attempt/$max_attempts"
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
      -H "auto-pull: true" \
      -H "width: $WIDTH" \
      -H "height: $HEIGHT" \
      "$BASE_URL/api/kindle/pull" > "$PULL_HTTP_FILE"

    pull_curl_exit="$?"
    pull_http_code="$(cat "$PULL_HTTP_FILE" 2>/dev/null || echo 000)"
    log "Wake step request_pull HTTP request completed. attempt=$attempt/$max_attempts curl_exit=$pull_curl_exit http_code=$pull_http_code"
    if [ "$pull_curl_exit" = "0" ] && [ "$pull_http_code" = "200" ]; then
      log "Wake step request_pull succeeded. width=$WIDTH height=$HEIGHT attempt=$attempt/$max_attempts"
      return 0
    fi

    log "Wake step request_pull attempt failed. curl_exit=$pull_curl_exit http_code=$pull_http_code attempt=$attempt/$max_attempts"
    log "Wake step request_pull reconnect started. attempt=$attempt/$max_attempts"
    reconnect_wifi_stage "$attempt"
    retry_delay="$(to_number "$SCHEDULED_WAKE_RETRY_DELAY_SECONDS")"
    log "Wake step request_pull reconnect completed. waiting_before_retry=${retry_delay}s attempt=$attempt/$max_attempts"
    sleep "$retry_delay"
    attempt=$((attempt + 1))
  done

  log "Wake step request_pull failed. exhausted_attempts=$max_attempts"
  return 1
}

poll_and_apply_update() {
  version="0"
  if [ -f "$VERSION_FILE" ]; then
    version="$(cat "$VERSION_FILE" 2>/dev/null || echo 0)"
  fi

  attempt=1
  max_attempts="$(to_number "$SCHEDULED_WAKE_EVENT_RETRIES")"
  [ "$max_attempts" -ge 1 ] 2>/dev/null || max_attempts=1
  log "Wake step poll_and_apply_update started. current_version=$version max_attempts=$max_attempts"

  while [ "$attempt" -le "$max_attempts" ]; do
    log "Wake step poll_and_apply_update poll started. since=$version attempt=$attempt/$max_attempts"
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
    log "Wake step poll_and_apply_update poll completed. since=$version attempt=$attempt/$max_attempts curl_exit=$event_curl_exit http_code=$event_http_code"

    if [ "$event_curl_exit" = "0" ] && [ "$event_http_code" = "204" ]; then
      log "Wake step poll_and_apply_update succeeded with no new content. another client may have already applied the update. since=$version attempt=$attempt/$max_attempts"
      return 0
    fi

    if [ "$event_curl_exit" = "0" ] && [ "$event_http_code" = "200" ]; then
      break
    fi

    log "Wake step poll_and_apply_update poll failed. curl_exit=$event_curl_exit http_code=$event_http_code since=$version attempt=$attempt/$max_attempts"
    if [ "$attempt" -lt "$max_attempts" ]; then
      log "Wake step poll_and_apply_update reconnect started. attempt=$attempt/$max_attempts"
      reconnect_wifi_stage "$attempt"
      log "Wake step poll_and_apply_update waiting for Wi-Fi recovery. attempt=$attempt/$max_attempts"
      if wait_for_wifi; then
        log "Wake step poll_and_apply_update Wi-Fi recovery succeeded. attempt=$attempt/$max_attempts"
      else
        log "Wake step poll_and_apply_update Wi-Fi recovery failed. attempt=$attempt/$max_attempts"
      fi
      retry_delay="$(to_number "$SCHEDULED_WAKE_RETRY_DELAY_SECONDS")"
      log "Wake step poll_and_apply_update reconnect completed. waiting_before_retry=${retry_delay}s attempt=$attempt/$max_attempts"
      sleep "$retry_delay"
    else
      log "Wake step poll_and_apply_update no retry remains. attempt=$attempt/$max_attempts"
    fi
    attempt=$((attempt + 1))
  done

  if [ "$event_curl_exit" != "0" ] || [ "$event_http_code" != "200" ]; then
    log "Wake step poll_and_apply_update failed. exhausted_attempts=$max_attempts curl_exit=$event_curl_exit http_code=$event_http_code"
    return 1
  fi

  log "Wake step poll_and_apply_update event response received. parsing event."
  event_type="$(json_get type)"
  new_version="$(json_get_number version)"
  image_url="$(json_get image_url)"
  log "Wake step poll_and_apply_update event parsed. type=${event_type:-missing} version=${new_version:-missing} image_url_present=$([ -n "$image_url" ] && echo 1 || echo 0)"

  if [ "$event_type" != "screen.update" ] || [ -z "$new_version" ] || [ -z "$image_url" ]; then
    log "Wake step poll_and_apply_update failed. invalid event type=$event_type version=$new_version image_url_present=$([ -n "$image_url" ] && echo 1 || echo 0)"
    return 1
  fi

  log "Wake step poll_and_apply_update image download started. version=$new_version path=$SCREEN_PATH"
  if download_screen_image "$image_url" "$SCREEN_PATH"; then
    log "Wake step poll_and_apply_update image download succeeded. version=$new_version path=$SCREEN_PATH"
    log "Wake step poll_and_apply_update lockscreen refresh started. version=$new_version"
    if refresh_linkss_lockscreen "$SCREEN_PATH"; then
      log "Wake step poll_and_apply_update lockscreen refresh succeeded. version=$new_version"
    else
      log "Wake step poll_and_apply_update lockscreen refresh failed; continuing because the downloaded image is valid. version=$new_version"
    fi
    if ! echo "$new_version" > "$VERSION_FILE"; then
      log "Wake step poll_and_apply_update failed. could not write version file=$VERSION_FILE version=$new_version"
      return 1
    fi
    log "Wake step poll_and_apply_update succeeded. update applied version=$new_version path=$SCREEN_PATH"
    return 0
  fi

  log "Wake step poll_and_apply_update failed. image download failed version=$new_version path=$SCREEN_PATH"
  return 1
}

request_sleep_after_update() {
  if [ "$SCHEDULED_WAKE_SLEEP_AFTER_UPDATE" != "1" ]; then
    return 0
  fi

  # powerd may reject rtcWakeup once readyToSuspend has begun. Arm it while the
  # device is definitely awake, before asking powerd to suspend.
  set_next_rtc_wakeup
  delay="$(to_number "$SCHEDULED_WAKE_SLEEP_DELAY_SECONDS")"
  sleep "$delay"
  release_wake_lock || true
  if command -v lipc-set-prop >/dev/null 2>&1; then
    lipc-set-prop com.lab126.powerd powerButton 1 >/dev/null 2>&1 || true
    log "Wake scheduler requested sleep after update."
  fi
}

run_wake_update() {
  log "Wake step run_wake_update started. pid=$$ base_url_configured=$([ -n "$BASE_URL" ] && [ "$BASE_URL" != "https://zeitplan.example.com" ] && echo 1 || echo 0)"
  if [ "$BASE_URL" = "https://zeitplan.example.com" ] || [ -z "$BASE_URL" ]; then
    log "Wake step run_wake_update failed. BASE_URL is not configured."
    return 1
  fi

  if [ "$API_KEY" = "replace-with-device-token" ] || [ -z "$API_KEY" ]; then
    log "Wake step run_wake_update failed. API_KEY is not configured."
    return 1
  fi

  if echo "$$" > "$WAKE_UPDATE_ACTIVE_FILE"; then
    log "Wake step run_wake_update activity marker created. path=$WAKE_UPDATE_ACTIVE_FILE pid=$$"
  else
    log "Wake step run_wake_update activity marker failed. path=$WAKE_UPDATE_ACTIVE_FILE pid=$$"
  fi

  log "Wake step run_wake_update calling acquire_wake_lock."
  if acquire_wake_lock; then
    log "Wake step run_wake_update acquire_wake_lock succeeded."
  else
    log "Wake step run_wake_update acquire_wake_lock failed; continuing without guaranteed suspend protection."
  fi

  log "Wake step run_wake_update calling enable_wifi."
  if enable_wifi; then
    log "Wake step run_wake_update enable_wifi succeeded."
  else
    log "Wake step run_wake_update enable_wifi failed; continuing to wait_for_wifi for diagnostics and recovery."
  fi

  log "Wake step run_wake_update calling wait_for_wifi."
  if wait_for_wifi; then
    log "Wake step run_wake_update wait_for_wifi succeeded."
  else
    log "Wake step run_wake_update wait_for_wifi failed; continuing to request_pull so the HTTP result is recorded."
  fi

  log "Wake step run_wake_update calling set_lockscreen_only_flag."
  if set_lockscreen_only_flag; then
    log "Wake step run_wake_update set_lockscreen_only_flag succeeded."
  else
    log "Wake step run_wake_update set_lockscreen_only_flag failed; continuing without a confirmed lockscreen-only flag."
  fi

  log "Wake step run_wake_update calling request_pull."
  request_pull || {
    log "Wake step run_wake_update request_pull failed. requesting sleep and ending update."
    request_sleep_after_update
    release_wake_lock || true
    clear_wake_update_active
    log "Wake step run_wake_update failed. stage=request_pull"
    return 1
  }
  log "Wake step run_wake_update request_pull succeeded."

  after_pull_wait="$(to_number "$SCHEDULED_WAKE_AFTER_PULL_WAIT_SECONDS")"
  log "Wake step run_wake_update waiting after pull. seconds=$after_pull_wait"
  sleep "$after_pull_wait"
  log "Wake step run_wake_update wait after pull completed. seconds=$after_pull_wait"

  log "Wake step run_wake_update calling poll_and_apply_update."
  poll_and_apply_update
  result="$?"
  if [ "$result" = "0" ]; then
    log "Wake step run_wake_update poll_and_apply_update succeeded."
  else
    log "Wake step run_wake_update poll_and_apply_update failed. exit=$result"
  fi

  log "Wake step run_wake_update calling request_sleep_after_update."
  request_sleep_after_update
  sleep_result="$?"
  if [ "$sleep_result" = "0" ]; then
    log "Wake step run_wake_update request_sleep_after_update completed."
  else
    log "Wake step run_wake_update request_sleep_after_update failed. exit=$sleep_result"
  fi

  release_wake_lock || true
  clear_wake_update_active
  log "Wake step run_wake_update activity marker cleared. path=$WAKE_UPDATE_ACTIVE_FILE"

  if [ "$result" = "0" ]; then
    log "Wake step run_wake_update succeeded."
  else
    log "Wake step run_wake_update failed. stage=poll_and_apply_update exit=$result"
  fi
  return "$result"
}

trap cleanup_scheduler EXIT
trap 'exit 0' INT TERM

handle_power_event() {
  event_line="$1"
  case "$event_line" in
    *readyToSuspend*)
      set_next_rtc_wakeup
      ;;
    *wakeupFromSuspend*)
      RTC_WAKE_ARMED=0
      RTC_WAKE_ARMED_SECONDS=""
      log "Scheduled RTC wakeup latch cleared after wake. pid=$$"
      log "Wake scheduler woke from suspend. pid=$$ event=$event_line"
      run_wake_update || true
      ;;
  esac
}

if [ "$SCHEDULED_WAKE_ENABLED" != "1" ]; then
  log "Wake scheduler disabled by config."
  exit 0
fi

if ! acquire_scheduler_lock; then
  exit 0
fi

if [ "$AUTO_DETECT_SCREEN_SIZE" != "0" ]; then
  detect_screen_size || true
fi

rm -f "$SCHEDULER_STOP_FILE"
echo "$$" > "$SCHEDULER_PID_FILE"
log "Wake scheduler started. pid=$$ window=$SCHEDULED_WAKE_START_HOUR-$SCHEDULED_WAKE_END_HOUR minutes=$SCHEDULED_WAKE_MINUTES"

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

  rm -f "$SCHEDULER_EVENT_PIPE" 2>/dev/null || true
  if ! mkfifo "$SCHEDULER_EVENT_PIPE" 2>/dev/null; then
    log "Wake scheduler could not create event pipe. retrying."
    sleep 2
    continue
  fi

  lipc-wait-event -m com.lab126.powerd '*' > "$SCHEDULER_EVENT_PIPE" 2>> "$LOG_FILE" &
  EVENT_LISTENER_PID="$!"
  while read -r event_line; do
    if [ -f "$SCHEDULER_STOP_FILE" ]; then
      break
    fi
    handle_power_event "$event_line"
  done < "$SCHEDULER_EVENT_PIPE"

  kill "$EVENT_LISTENER_PID" 2>/dev/null || true
  wait "$EVENT_LISTENER_PID" 2>/dev/null || true
  EVENT_LISTENER_PID=""
  rm -f "$SCHEDULER_EVENT_PIPE" 2>/dev/null || true

  sleep 2
done
