#!/bin/sh
set -u

WIDTH="${WIDTH:-600}"
HEIGHT="${HEIGHT:-800}"
AUTO_DETECT_SCREEN_SIZE="${AUTO_DETECT_SCREEN_SIZE:-1}"
DISPLAY_MODE="${DISPLAY_MODE:-eips_plain}"
STARTUP_PULL="${STARTUP_PULL:-0}"
DISPLAY_CLEAR_DELAY="${DISPLAY_CLEAR_DELAY:-1}"
OPEN_AS_BOOK="${OPEN_AS_BOOK:-1}"
STATE_DIR="${STATE_DIR:-/mnt/us/home-kindle-today-plan/state}"
SCREEN_PATH="${SCREEN_PATH:-/mnt/us/linkss/screensavers/bg_ss00.png}"
DOCUMENT_DIR="${DOCUMENT_DIR:-/mnt/us/documents}"
DOCUMENT_PREFIX="${DOCUMENT_PREFIX:-ZeitPlan_Today}"
LOCKSCREEN_SYNC="${LOCKSCREEN_SYNC:-0}"
LOCKSCREEN_DIR="${LOCKSCREEN_DIR:-/mnt/us/linkss/screensavers}"
LOCKSCREEN_FILENAME="${LOCKSCREEN_FILENAME:-bg_ss00.png}"
LOCKSCREEN_EXTRA_FILENAMES="${LOCKSCREEN_EXTRA_FILENAMES:-}"
LOCKSCREEN_REFRESH="${LOCKSCREEN_REFRESH:-1}"
LOCKSCREEN_CANONICAL_FILENAME="${LOCKSCREEN_CANONICAL_FILENAME:-bg_ss00.png}"
LOCKSCREEN_SHUFFLE="${LOCKSCREEN_SHUFFLE:-1}"
CONFIG_FILE="${CONFIG_FILE:-/mnt/us/home-kindle-today-plan/config.sh}"
LOG_FILE="${LOG_FILE:-$STATE_DIR/kindle.log}"
VERSION_FILE="$STATE_DIR/version"
EVENT_FILE="$STATE_DIR/event.json"
HTTP_FILE="$STATE_DIR/http_code"
IMAGE_HTTP_FILE="$STATE_DIR/image_http_code"
PULL_RESPONSE_FILE="$STATE_DIR/pull.json"
PULL_HTTP_FILE="$STATE_DIR/pull_http_code"
STOP_FILE="$STATE_DIR/stop"

mkdir -p "$STATE_DIR"

# Configure BASE_URL and API_KEY in CONFIG_FILE on the Kindle.
BASE_URL="${BASE_URL:-https://zeitplan.example.com}"
API_KEY="${API_KEY:-replace-with-device-token}"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
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

if [ "$BASE_URL" = "https://zeitplan.example.com" ] || [ -z "$BASE_URL" ]; then
  log "BASE_URL is not configured. Edit $CONFIG_FILE."
  exit 1
fi

if [ "$API_KEY" = "replace-with-device-token" ] || [ -z "$API_KEY" ]; then
  log "API_KEY is not configured. Edit $CONFIG_FILE."
  exit 1
fi

if [ "$AUTO_DETECT_SCREEN_SIZE" != "0" ]; then
  detect_screen_size || true
fi

VERSION="0"
if [ -f "$VERSION_FILE" ]; then
  VERSION="$(cat "$VERSION_FILE" 2>/dev/null || echo 0)"
fi

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

is_pdf_file() {
  [ "$(file_header_hex "$1" | cut -c1-10)" = "255044462d" ]
}

open_document() {
  if ! command -v lipc-set-prop >/dev/null 2>&1; then
    log "Reader open failed. lipc-set-prop command not found."
    return 1
  fi

  lipc-set-prop com.lab126.appmgrd start "app://com.lab126.booklet.reader:$1"
}

cleanup_old_documents() {
  keep_file="$1"
  find "$DOCUMENT_DIR" -maxdepth 1 -name "${DOCUMENT_PREFIX}_*.pdf" ! -name "$(basename "$keep_file")" -delete 2>/dev/null || true
}

sync_lockscreen_image() {
  source_path="$1"
  if [ "$LOCKSCREEN_SYNC" != "1" ]; then
    return 0
  fi

  if ! is_png_file "$source_path"; then
    log "Lockscreen sync skipped. source is not a PNG. path=$source_path header=$(file_header_hex "$source_path")"
    return 1
  fi

  if [ "$LOCKSCREEN_DIR" = "/mnt/us/linkss/screensavers" ] && [ ! -d "/mnt/us/linkss" ]; then
    log "Lockscreen sync notice. /mnt/us/linkss is missing; install or enable the ScreenSavers Hack for this image to appear on lockscreen."
  fi

  mkdir -p "$LOCKSCREEN_DIR" || {
    log "Lockscreen sync failed. cannot create directory=$LOCKSCREEN_DIR"
    return 1
  }

  failed=0
  for filename in $LOCKSCREEN_FILENAME $LOCKSCREEN_EXTRA_FILENAMES; do
    [ -n "$filename" ] || continue
    target_path="$LOCKSCREEN_DIR/$filename"
    temp_path="$target_path.tmp"
    if cp "$source_path" "$temp_path" 2>/dev/null && mv "$temp_path" "$target_path" 2>/dev/null; then
      log "Lockscreen image synced. path=$target_path"
    else
      rm -f "$temp_path" 2>/dev/null || true
      log "Lockscreen sync failed. target=$target_path"
      failed=1
    fi
  done

  return "$failed"
}

refresh_linkss_lockscreen() {
  source_path="$1"
  if [ "$LOCKSCREEN_REFRESH" != "1" ]; then
    return 0
  fi

  if [ ! -d "/mnt/us/linkss" ]; then
    log "Lockscreen refresh skipped. /mnt/us/linkss is missing."
    return 0
  fi

  if ! is_png_file "$source_path"; then
    log "Lockscreen refresh skipped. source is not a PNG. path=$source_path header=$(file_header_hex "$source_path")"
    return 1
  fi

  mkdir -p "$LOCKSCREEN_DIR" || {
    log "Lockscreen refresh failed. cannot create directory=$LOCKSCREEN_DIR"
    return 1
  }

  target_path="$LOCKSCREEN_DIR/$LOCKSCREEN_CANONICAL_FILENAME"
  if [ "$source_path" != "$target_path" ]; then
    temp_path="$target_path.tmp"
    if cp "$source_path" "$temp_path" 2>/dev/null && mv "$temp_path" "$target_path" 2>/dev/null; then
      log "Lockscreen canonical image updated. path=$target_path"
    else
      rm -f "$temp_path" 2>/dev/null || true
      log "Lockscreen refresh failed. target=$target_path"
      return 1
    fi
  fi

  # PW4/Paperwhite 10th gen uses bg_ss*. Keeping bg_medium files can make
  # linkss cycle stale images or update the wrong file family.
  for stale_path in "$LOCKSCREEN_DIR"/bg_medium_ss*.png "$LOCKSCREEN_DIR"/bg_xsmall_ss*.png "$LOCKSCREEN_DIR"/bg_ss[0-9][1-9].png "$LOCKSCREEN_DIR"/bg_ss[1-9][0-9].png; do
    [ -f "$stale_path" ] && rm -f "$stale_path" 2>/dev/null || true
  done

  sync

  if [ "$LOCKSCREEN_SHUFFLE" = "1" ] && [ -x "/mnt/us/linkss/bin/shuffless" ]; then
    if /mnt/us/linkss/bin/shuffless watchdog >> "$LOG_FILE" 2>&1; then
      log "Lockscreen linkss directory refreshed. path=$target_path"
    else
      log "Lockscreen linkss directory refresh returned a non-zero status. path=$target_path"
    fi
  fi

  for active_dir in /usr/share/blanket/screensaver /var/local/custom_screensavers; do
    if [ -d "$active_dir" ]; then
      cp "$target_path" "$active_dir/$LOCKSCREEN_CANONICAL_FILENAME" 2>/dev/null || true
    fi
  done

  sync
  log "Lockscreen image refreshed. path=$target_path"
}

display_screen() {
  if ! command -v eips >/dev/null 2>&1; then
    log "Display failed. eips command not found."
    return 1
  fi

  # KUAL often redraws the Kindle home after an action exits. Always clear before
  # painting the PNG so home/menu fragments are less likely to remain behind it.
  eips -c
  sleep "$DISPLAY_CLEAR_DELAY"

  case "$DISPLAY_MODE" in
    fbink)
      if command -v fbink >/dev/null 2>&1; then
        fbink -c
        fbink -g "$SCREEN_PATH"
        return "$?"
      fi
      log "fbink not found. falling back to eips_plain."
      eips -g "$SCREEN_PATH"
      ;;
    eips_xy)
      eips -g "$SCREEN_PATH" -x 0 -y 0
      ;;
    *)
      eips -g "$SCREEN_PATH"
      ;;
  esac
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

  PULL_CURL_EXIT="$?"
  PULL_HTTP_CODE="$(cat "$PULL_HTTP_FILE" 2>/dev/null || echo 000)"
  if [ "$PULL_CURL_EXIT" = "0" ] && [ "$PULL_HTTP_CODE" = "200" ]; then
    log "Startup pull requested successfully. width=$WIDTH height=$HEIGHT"
  else
    log "Startup pull failed. curl_exit=$PULL_CURL_EXIT http_code=$PULL_HTTP_CODE"
  fi
}

download_screen_image() {
  image_url="$1"
  output_path="$2"
  output_dir="${output_path%/*}"

  if [ "$output_dir" != "$output_path" ]; then
    mkdir -p "$output_dir" || {
      log "Screen image download failed. cannot create directory=$output_dir"
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

  IMAGE_CURL_EXIT="$?"
  IMAGE_HTTP_CODE="$(cat "$IMAGE_HTTP_FILE" 2>/dev/null || echo 000)"
  IMAGE_HEADER="$(file_header_hex "$output_path")"

  if [ "$IMAGE_CURL_EXIT" != "0" ]; then
    log "Screen image download failed. curl_exit=$IMAGE_CURL_EXIT http_code=$IMAGE_HTTP_CODE header=$IMAGE_HEADER image_url=$image_url"
    return 1
  fi

  if [ "$IMAGE_HTTP_CODE" != "200" ]; then
    log "Screen image returned unexpected status. http_code=$IMAGE_HTTP_CODE header=$IMAGE_HEADER image_url=$image_url"
    return 1
  fi

  if ! is_png_file "$output_path"; then
    log "Screen image is not PNG. http_code=$IMAGE_HTTP_CODE header=$IMAGE_HEADER path=$output_path"
    return 1
  fi

  return 0
}

backoff_seconds() {
  case "$1" in
    0|1) echo 2 ;;
    2) echo 5 ;;
    3) echo 10 ;;
    *) echo 30 ;;
  esac
}

ERROR_COUNT=0
log "ZeitPlan Kindle client started. base_url=$BASE_URL width=$WIDTH height=$HEIGHT version=$VERSION"
if [ "$STARTUP_PULL" = "1" ]; then
  request_pull
else
  log "Startup pull skipped. Use KUAL Update or the on-screen Update button to request a fresh image."
fi

while true; do
  if [ -f "$STOP_FILE" ]; then
    log "Stop file detected. exiting client."
    rm -f "$STOP_FILE"
    exit 0
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
    "$BASE_URL/api/kindle/events?since=$VERSION" > "$HTTP_FILE"

  CURL_EXIT="$?"
  HTTP_CODE="$(cat "$HTTP_FILE" 2>/dev/null || echo 000)"

  if [ "$CURL_EXIT" != "0" ]; then
    log "Event poll failed. curl_exit=$CURL_EXIT http_code=$HTTP_CODE"
    sleep "$(backoff_seconds "$ERROR_COUNT")"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    continue
  fi

  if [ "$HTTP_CODE" = "204" ]; then
    ERROR_COUNT=0
    continue
  fi

  if [ "$HTTP_CODE" != "200" ]; then
    log "Event poll returned unexpected status. http_code=$HTTP_CODE"
    sleep "$(backoff_seconds "$ERROR_COUNT")"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    continue
  fi

  TYPE="$(json_get type)"
  NEW_VERSION="$(json_get_number version)"
  IMAGE_URL="$(json_get image_url)"
  DOCUMENT_URL="$(json_get document_url)"

  if [ "$TYPE" = "screen.update" ] && [ -n "$NEW_VERSION" ] && [ "$NEW_VERSION" != "$VERSION" ] && [ -n "$IMAGE_URL" ]; then
    log "Screen update received. version=$NEW_VERSION image_url=$IMAGE_URL"
    PNG_READY=0

    if download_screen_image "$IMAGE_URL" "$SCREEN_PATH"; then
      PNG_READY=1
      if [ "$LOCKSCREEN_SYNC" = "1" ]; then
        sync_lockscreen_image "$SCREEN_PATH" || true
      fi
      refresh_linkss_lockscreen "$SCREEN_PATH" || true
    else
      log "Pushed PNG could not be downloaded to target path=$SCREEN_PATH"
    fi

    if [ "$OPEN_AS_BOOK" = "1" ] && [ -n "$DOCUMENT_URL" ]; then
      mkdir -p "$DOCUMENT_DIR"
      DOCUMENT_PATH="$DOCUMENT_DIR/${DOCUMENT_PREFIX}_${NEW_VERSION}.pdf"
      curl \
        --silent \
        --show-error \
        --location \
        --max-time 30 \
        --output "$DOCUMENT_PATH" \
        --write-out "%{http_code}" \
        "$DOCUMENT_URL" > "$IMAGE_HTTP_FILE"

      DOCUMENT_CURL_EXIT="$?"
      DOCUMENT_HTTP_CODE="$(cat "$IMAGE_HTTP_FILE" 2>/dev/null || echo 000)"
      DOCUMENT_HEADER="$(file_header_hex "$DOCUMENT_PATH")"

      if [ "$DOCUMENT_CURL_EXIT" = "0" ] && [ "$DOCUMENT_HTTP_CODE" = "200" ] && is_pdf_file "$DOCUMENT_PATH"; then
        if open_document "$DOCUMENT_PATH"; then
          VERSION="$NEW_VERSION"
          echo "$VERSION" > "$VERSION_FILE"
          ERROR_COUNT=0
          cleanup_old_documents "$DOCUMENT_PATH"
          log "Screen opened in Kindle reader successfully. version=$VERSION path=$DOCUMENT_PATH header=$DOCUMENT_HEADER"
          continue
        fi

        log "Reader open failed. falling back to PNG. path=$DOCUMENT_PATH header=$DOCUMENT_HEADER"
      else
        log "Screen document download failed. curl_exit=$DOCUMENT_CURL_EXIT http_code=$DOCUMENT_HTTP_CODE header=$DOCUMENT_HEADER document_url=$DOCUMENT_URL"
      fi
    fi

    if [ "$PNG_READY" != "1" ]; then
      sleep "$(backoff_seconds "$ERROR_COUNT")"
      ERROR_COUNT=$((ERROR_COUNT + 1))
      continue
    fi

    if display_screen; then
      VERSION="$NEW_VERSION"
      echo "$VERSION" > "$VERSION_FILE"
      ERROR_COUNT=0
      log "Screen rendered successfully. version=$VERSION path=$SCREEN_PATH header=$IMAGE_HEADER display_mode=$DISPLAY_MODE"
    else
      log "Screen render failed. path=$SCREEN_PATH header=$IMAGE_HEADER"
      sleep "$(backoff_seconds "$ERROR_COUNT")"
      ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
  else
    log "Ignored event. type=$TYPE new_version=$NEW_VERSION current_version=$VERSION image_url=$IMAGE_URL"
  fi
done
