#!/bin/sh
set -u

WIDTH="${WIDTH:-600}"
HEIGHT="${HEIGHT:-800}"
AUTO_DETECT_SCREEN_SIZE="${AUTO_DETECT_SCREEN_SIZE:-1}"
DISPLAY_MODE="${DISPLAY_MODE:-eips_plain}"
STARTUP_PULL="${STARTUP_PULL:-0}"
ALWAYS_ON_ENABLED="${ALWAYS_ON_ENABLED:-0}"
ALWAYS_ON_WIFI_WAIT_SECONDS="${ALWAYS_ON_WIFI_WAIT_SECONDS:-120}"
DISPLAY_CLEAR_DELAY="${DISPLAY_CLEAR_DELAY:-1}"
OPEN_AS_BOOK="${OPEN_AS_BOOK:-1}"
STATE_DIR="${STATE_DIR:-/mnt/us/home-kindle-today-plan/state}"
SCREEN_PATH="${SCREEN_PATH:-/mnt/us/linkss/screensavers/bg_ss00.png}"
DOCUMENT_DIR="${DOCUMENT_DIR:-/mnt/us/documents}"
DOCUMENT_PREFIX="${DOCUMENT_PREFIX:-ZeitPlan_Today}"
DOCUMENT_KEEP_COUNT="${DOCUMENT_KEEP_COUNT:-2}"
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
LOCKSCREEN_ONLY_FILE="$STATE_DIR/lockscreen-only"
WAKE_UPDATE_ACTIVE_FILE="$STATE_DIR/wake-update-active"

mkdir -p "$STATE_DIR"

# Configure BASE_URL and API_KEY in CONFIG_FILE on the Kindle.
BASE_URL="${BASE_URL:-https://zeitplan.example.com}"
API_KEY="${API_KEY:-replace-with-device-token}"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

LIB_DIR="${LIB_DIR:-/mnt/us/home-kindle-today-plan/lib}"
for module in runtime files display network; do
  module_path="$LIB_DIR/$module.sh"
  if [ ! -f "$module_path" ]; then
    printf '%s Required module is missing. path=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$module_path" >> "$LOG_FILE"
    exit 1
  fi
  # shellcheck disable=SC1090
  . "$module_path"
done

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

ERROR_COUNT=0
log "ZeitPlan Kindle client started. base_url=$BASE_URL width=$WIDTH height=$HEIGHT version=$VERSION"
enable_always_on || true
recover_always_on_wifi || true
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

  if scheduled_wake_update_is_active; then
    log "Event poll paused while scheduled wake update is active."
    sleep 2
    continue
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
    recover_always_on_wifi || true
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
    LOCKSCREEN_ONLY_UPDATE=0
    if is_lockscreen_only_update; then
      LOCKSCREEN_ONLY_UPDATE=1
    fi

    if download_screen_image "$IMAGE_URL" "$SCREEN_PATH"; then
      PNG_READY=1
      if [ "$LOCKSCREEN_SYNC" = "1" ]; then
        sync_lockscreen_image "$SCREEN_PATH" || true
      fi
      refresh_linkss_lockscreen "$SCREEN_PATH" || true
    else
      log "Pushed PNG could not be downloaded to target path=$SCREEN_PATH"
    fi

    if [ "$LOCKSCREEN_ONLY_UPDATE" = "1" ] && [ "$PNG_READY" = "1" ]; then
      VERSION="$NEW_VERSION"
      echo "$VERSION" > "$VERSION_FILE"
      ERROR_COUNT=0
      log "Screen update applied to lockscreen only. version=$VERSION path=$SCREEN_PATH"
      continue
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
