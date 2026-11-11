#!/usr/bin/env python3
"""Writes a screenshot scene from store/seed/seed.json (made by store/seed/generate.test.ts) into DuelTastic's saved
data BEFORE the app launches, so it opens on Home with sound off, every How to Play seen, three profiles (Maya in
seat 1) and three weeks of stats and achievements in all four games. See store/README.md.

  write-store.py ios <simulator udid> [--scene twoPlayer|vsCpu] [--grid small|medium|large]
  write-store.py android <out.db> [--scene twoPlayer|vsCpu] [--grid small|medium|large]

--scene: twoPlayer (the default) puts Leo in seat 2 face to face; vsCpu puts the CPU there (the hardest level, Trap
on Portals). --grid sets every game's grid size for Maya (the iPad shots use large). The app must not be running.

iOS: the store is redux-persist on @react-native-async-storage: Library/Application Support/<bundle
id>/RCTAsyncLocalStorage_V1, with values over 1024 characters in a file named by the MD5 of the key. The profiles also
go in the App Group (group.com.infinitetoken.tastic, key sharedProfiles), which wins over the app's own copy when it
isn't empty, so another Tastic game seeded on the same simulator since needs this run again.

Android: writes AsyncStorage's SQLite database (RKStorage, table catalystLocalStorage) to <out.db>, for
store/seed/reseed-android.sh to push into a debuggable build's databases/ folder.
"""
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys

BUNDLE = 'com.infinitetoken.DuelTastic'
GROUP = 'group.com.infinitetoken.tastic'
# The keyPrefix in src/pack.ts
ROOT_KEY = 'dueltastic:root'
HERE = os.path.dirname(os.path.abspath(__file__))
GAMES = ['trap', 'turf', 'tag', 'snake']


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


platform, target = sys.argv[1], sys.argv[2]
scene = arg('--scene', 'twoPlayer')
grid = arg('--grid')
seed = json.load(open(os.path.join(HERE, 'seed.json')))
slices = {**seed['root'], **seed['scenes'][scene]}
if grid:
    for game in GAMES:
        for player in slices[f'{game}Settings'].values():
            player['gridSizeTier'] = grid
blob = {k: json.dumps(v) for k, v in slices.items()}
blob['_persist'] = json.dumps({'version': -1, 'rehydrated': True})
value = json.dumps(blob)
profiles = seed['root']['profiles']

if platform == 'android':
    if os.path.exists(target):
        os.remove(target)
    db = sqlite3.connect(target)
    db.execute('CREATE TABLE catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    db.execute('INSERT INTO catalystLocalStorage VALUES (?, ?)', (ROOT_KEY, value))
    db.execute('PRAGMA user_version = 1')
    db.commit()
    db.close()
    print(f'Wrote {scene} to {target}: {len(profiles)} profiles')
    sys.exit(0)

udid = target
container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', udid, BUNDLE, 'data'], text=True).strip()
store_dir = os.path.join(container, 'Library/Application Support', BUNDLE, 'RCTAsyncLocalStorage_V1')
shutil.rmtree(store_dir, ignore_errors=True)
os.makedirs(store_dir)
manifest = {}
if len(value) > 1024:
    open(os.path.join(store_dir, hashlib.md5(ROOT_KEY.encode()).hexdigest()), 'w').write(value)
    manifest[ROOT_KEY] = None
else:
    manifest[ROOT_KEY] = value
json.dump(manifest, open(os.path.join(store_dir, 'manifest.json'), 'w'))

# The App Group roster, through the simulator's own defaults so cfprefsd doesn't hold an older copy
group = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', udid, BUNDLE, GROUP], text=True).strip()
domain = os.path.join(group, 'Library/Preferences', GROUP)
subprocess.check_call(['xcrun', 'simctl', 'spawn', udid, 'defaults', 'write', domain, 'sharedProfiles', '-string', json.dumps(profiles)])
print(f'Seeded {scene}{" (" + grid + " grid)" if grid else ""}: {len(profiles)} profiles')
