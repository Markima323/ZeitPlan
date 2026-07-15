#!/bin/sh

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
