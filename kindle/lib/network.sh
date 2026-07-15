#!/bin/sh

request_pull() {
  attempt=1
  max_attempts="${PULL_RETRIES:-4}"
  case "$max_attempts" in *[!0-9]*|'') max_attempts=4 ;; esac
  [ "$max_attempts" -ge 1 ] || max_attempts=1

  while [ "$attempt" -le "$max_attempts" ]; do
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
      log "Startup pull requested successfully. width=$WIDTH height=$HEIGHT attempt=$attempt"
      return 0
    fi

    log "Startup pull failed. curl_exit=$PULL_CURL_EXIT http_code=$PULL_HTTP_CODE attempt=$attempt/$max_attempts"
    [ "$attempt" -lt "$max_attempts" ] && sleep "$(backoff_seconds "$attempt")"
    attempt=$((attempt + 1))
  done

  return 1
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

scheduled_wake_update_is_active() {
  [ -f "$WAKE_UPDATE_ACTIVE_FILE" ] || return 1

  wake_pid="$(cat "$WAKE_UPDATE_ACTIVE_FILE" 2>/dev/null || true)"
  if [ -n "$wake_pid" ] && kill -0 "$wake_pid" 2>/dev/null; then
    return 0
  fi

  log "Stale wake update activity marker removed. path=$WAKE_UPDATE_ACTIVE_FILE pid=${wake_pid:-missing}"
  rm -f "$WAKE_UPDATE_ACTIVE_FILE" 2>/dev/null || true
  return 1
}
