#!/bin/sh

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

is_lockscreen_only_update() {
  if [ ! -f "$LOCKSCREEN_ONLY_FILE" ]; then
    return 1
  fi

  expires_at="$(cat "$LOCKSCREEN_ONLY_FILE" 2>/dev/null || true)"
  case "$expires_at" in
    ''|*[!0-9]*)
      rm -f "$LOCKSCREEN_ONLY_FILE" 2>/dev/null || true
      return 1
      ;;
  esac

  now_epoch="$(date '+%s' 2>/dev/null || echo 0)"
  if [ "$now_epoch" -le "$expires_at" ] 2>/dev/null; then
    return 0
  fi

  rm -f "$LOCKSCREEN_ONLY_FILE" 2>/dev/null || true
  return 1
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
  keep_count="$(printf '%s' "$DOCUMENT_KEEP_COUNT" | sed 's/[^0-9]//g')"
  [ -n "$keep_count" ] || keep_count=2
  [ "$keep_count" -ge 1 ] 2>/dev/null || keep_count=1

  if [ ! -d "$DOCUMENT_DIR" ]; then
    return 0
  fi

  # Kindle Reader creates a .sdr directory for every opened PDF. Keep the
  # newest ZeitPlan versions and remove both the PDF and its sidecar folder.
  {
    for entry in "$DOCUMENT_DIR"/"${DOCUMENT_PREFIX}"_*.pdf "$DOCUMENT_DIR"/"${DOCUMENT_PREFIX}"_*.sdr; do
      [ -e "$entry" ] || continue
      name="${entry##*/}"
      base="${name%.pdf}"
      base="${base%.sdr}"
      version="${base#${DOCUMENT_PREFIX}_}"
      case "$version" in
        ''|*[!0-9]*) continue ;;
      esac
      printf '%s %s\n' "$version" "$base"
    done
  } | sort -rn | awk '!seen[$2]++ { print $2 }' | {
    index=0
    while read -r base; do
      [ -n "$base" ] || continue
      index=$((index + 1))
      if [ "$index" -le "$keep_count" ]; then
        continue
      fi

      pdf_path="$DOCUMENT_DIR/$base.pdf"
      sdr_path="$DOCUMENT_DIR/$base.sdr"
      if [ "$pdf_path" != "$keep_file" ] && [ -f "$pdf_path" ]; then
        rm -f "$pdf_path" 2>/dev/null || true
        log "Old Kindle document removed. path=$pdf_path"
      fi
      if [ -d "$sdr_path" ]; then
        rm -rf "$sdr_path" 2>/dev/null || true
        log "Old Kindle document sidecar removed. path=$sdr_path"
      fi
    done
  }
}
