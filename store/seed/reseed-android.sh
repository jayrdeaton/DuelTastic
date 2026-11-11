#!/bin/zsh
# Reseeds the running emulator's DuelTastic install for the store screenshots and relaunches it. Needs a debuggable
# build (run-as only reaches a debuggable app's data); see store/README.md.
#   store/seed/reseed-android.sh [--scene twoPlayer|vsCpu] [--grid large]
DIR=${0:A:h}
PKG=com.infinitetoken.dueltastic
db=$(mktemp -d)/RKStorage
python3 $DIR/write-store.py android $db "$@" || exit 1
adb shell am force-stop $PKG
adb push $db /data/local/tmp/RKStorage > /dev/null
adb shell run-as $PKG sh -c "'mkdir -p databases && rm -f databases/RKStorage-journal databases/RKStorage-wal databases/RKStorage-shm && cp /data/local/tmp/RKStorage databases/RKStorage'" || exit 1
adb shell rm /data/local/tmp/RKStorage
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 > /dev/null
