#!/bin/sh
set -eu

cd /app

current_state() {
  {
    find src/main -type f 2>/dev/null
    printf '%s\n' pom.xml
  } | xargs stat -c '%n:%Y' 2>/dev/null | sort | tr '\n' '|'
}

echo "Initial backend compile..."
./mvnw -q -DskipTests compile

echo "Starting Spring Boot with DevTools..."
./mvnw spring-boot:run &
APP_PID=$!

cleanup() {
  if kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

LAST_STATE="$(current_state)"
echo "Watching backend source files for hot reload..."

while kill -0 "$APP_PID" 2>/dev/null; do
  sleep 1
  NEXT_STATE="$(current_state)"

  if [ "$NEXT_STATE" != "$LAST_STATE" ]; then
    echo "Change detected. Recompiling backend..."
    if ./mvnw -q -DskipTests compile; then
      echo "Compile finished. Spring DevTools will restart the app."
    else
      echo "Compile failed. Waiting for the next change..."
    fi
    LAST_STATE="$NEXT_STATE"
  fi
done

wait "$APP_PID"
