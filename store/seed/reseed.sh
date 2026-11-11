#!/bin/zsh
# Reseeds one simulator's DuelTastic install for the store screenshots and relaunches it.
#   store/seed/reseed.sh <simulator udid> [--scene twoPlayer|vsCpu] [--grid large]
# Run store/seed/generate.test.ts first. See store/README.md.
DIR=${0:A:h}
udid=$1
shift
xcrun simctl terminate $udid com.infinitetoken.DuelTastic 2> /dev/null
python3 $DIR/write-store.py ios $udid "$@" || exit 1
xcrun simctl launch $udid com.infinitetoken.DuelTastic
