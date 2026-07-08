BASE_URL="https://zeitplan.markima.de"
API_KEY="replace-with-device-token-from-zeitplan"

# Kindle native screen resolution.
AUTO_DETECT_SCREEN_SIZE="0"
WIDTH="1072"
HEIGHT="1448"

# eips_plain is the safest default. Try eips_xy only if the image does not start at the top-left.
DISPLAY_MODE="eips_plain"

# Prefer opening the generated PDF in Kindle's native reader. This prevents taps
# from falling through to the Home/Library UI under an eips-painted image.
OPEN_AS_BOOK="1"
STARTUP_PULL="1"
DOCUMENT_DIR="/mnt/us/documents"
DOCUMENT_PREFIX="ZeitPlan_Today"

# Used only when OPEN_AS_BOOK="0".
TOUCH_EVENT_DEVICE="/dev/input/event2"
