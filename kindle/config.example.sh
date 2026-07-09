BASE_URL="https://zeitplan.markima.de"
API_KEY="replace-with-device-token-from-zeitplan"

# Kindle native screen resolution.
AUTO_DETECT_SCREEN_SIZE="0"
WIDTH="1072"
HEIGHT="1448"

# Download pushed PNGs directly to the ScreenSavers Hack image path. This makes
# the received image path and the lockscreen image path the same file.
SCREEN_PATH="/mnt/us/linkss/screensavers/bg_ss00.png"

# eips_plain is the safest default. Try eips_xy only if the image does not start at the top-left.
DISPLAY_MODE="eips_plain"

# Prefer opening the generated PDF in Kindle's native reader. This prevents taps
# from falling through to the Home/Library UI under an eips-painted image.
OPEN_AS_BOOK="1"
STARTUP_PULL="1"
DOCUMENT_DIR="/mnt/us/documents"
DOCUMENT_PREFIX="ZeitPlan_Today"
DOCUMENT_KEEP_COUNT="2"

# Optional compatibility copy for extra lockscreen names. Keep disabled when
# SCREEN_PATH already points at the lockscreen image used by linkss.
LOCKSCREEN_SYNC="0"
LOCKSCREEN_DIR="/mnt/us/linkss/screensavers"
LOCKSCREEN_FILENAME="bg_ss00.png"
LOCKSCREEN_EXTRA_FILENAMES=""
LOCKSCREEN_REFRESH="1"
LOCKSCREEN_CANONICAL_FILENAME="bg_ss00.png"
LOCKSCREEN_SHUFFLE="1"

# Wake from suspend and refresh the lockscreen during the active window.
# With this config, updates run at every :01, :06, :31 and :36 from 06:00
# through 23:59. The next wake after 23:36 is 06:01 the next morning.
SCHEDULED_WAKE_ENABLED="1"
SCHEDULED_WAKE_START_HOUR="6"
SCHEDULED_WAKE_END_HOUR="0"
SCHEDULED_WAKE_MINUTES="1 6 31 36"
SCHEDULED_WAKE_WIFI_ENABLE="1"
SCHEDULED_WAKE_WIFI_WAIT_SECONDS="60"

# Used only when OPEN_AS_BOOK="0".
TOUCH_EVENT_DEVICE="/dev/input/event2"
