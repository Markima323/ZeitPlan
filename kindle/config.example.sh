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

# Optional compatibility copy for extra lockscreen names. Keep disabled when
# SCREEN_PATH already points at the lockscreen image used by linkss.
LOCKSCREEN_SYNC="0"
LOCKSCREEN_DIR="/mnt/us/linkss/screensavers"
LOCKSCREEN_FILENAME="bg_ss00.png"
LOCKSCREEN_EXTRA_FILENAMES=""
LOCKSCREEN_REFRESH="1"
LOCKSCREEN_CANONICAL_FILENAME="bg_ss00.png"
LOCKSCREEN_SHUFFLE="1"

# Used only when OPEN_AS_BOOK="0".
TOUCH_EVENT_DEVICE="/dev/input/event2"
