#!/bin/zsh
# Reseeds one simulator's LightCycles install for the App Store screenshots and relaunches it.
#   store/seed/reseed.sh <simulator udid> [--scene twoPlayer|vsCpu] [--grid large]
# Run store/seed/generate.mjs first. See store/README.md.
DIR=${0:A:h}
udid=$1
shift
xcrun simctl terminate $udid com.infinitetoken.LightCycles 2> /dev/null
python3 $DIR/write-store.py $udid "$@" || exit 1
xcrun simctl launch $udid com.infinitetoken.LightCycles
