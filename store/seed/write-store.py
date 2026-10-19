#!/usr/bin/env python3
"""Writes the screenshot seed (store/seed/seed.json, from generate.mjs) into a simulator's LightCycles install
BEFORE it launches, so it opens on Home with sound off, the guide seen, three profiles (Maya on seat 1, Leo
on seat 2) and three weeks of stats and achievements. See store/README.md.

  write-store.py <simulator udid> [--scene twoPlayer|vsCpu] [--grid small|medium|large]

--scene picks the lobby's match settings: twoPlayer (the default) is Pillars with every powerup on;
vsCpu is Portals against Mainframe with every powerup on. Everything else is the default. --grid sets the
grid size (the iPad shots use large: the 13" board makes the default grid's trails look thin). The app must
not be running.

The store is redux-persist on @react-native-async-storage: on iOS, Library/Application Support/<bundle
id>/RCTAsyncLocalStorage_V1, with values over 1024 characters in a file named by the MD5 of the key.
Slices left out of lightcycles:root keep their initial state. The profiles also go in the App Group
(group.com.infinitetoken.tastic, key sharedProfiles), which wins over the app's own copy when it isn't
empty: any other Tastic game on the simulator sees the same three profiles.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys

BUNDLE = 'com.infinitetoken.LightCycles'
GROUP = 'group.com.infinitetoken.tastic'
# The keyPrefix in src/redux/store.ts.
KEY_PREFIX = 'lightcycles:'
HERE = os.path.dirname(os.path.abspath(__file__))
POWERUPS = ['overdrive', 'stasis', 'shield', 'prune', 'hack', 'overclock']
SCENES = {
    'twoPlayer': {'gameMode': 'twoPlayer', 'arenaVariant': 'pillars', 'enabledPowerups': POWERUPS},
    'vsCpu': {'gameMode': 'vsCpu', 'cpuDifficulty': 'hard', 'arenaVariant': 'portals', 'enabledPowerups': POWERUPS},
}

udid = sys.argv[1]
scene = sys.argv[sys.argv.index('--scene') + 1] if '--scene' in sys.argv else 'twoPlayer'
grid = sys.argv[sys.argv.index('--grid') + 1] if '--grid' in sys.argv else None
seed = json.load(open(os.path.join(HERE, 'seed.json')))
container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', udid, BUNDLE, 'data'], text=True).strip()
store_dir = os.path.join(container, 'Library/Application Support', BUNDLE, 'RCTAsyncLocalStorage_V1')
shutil.rmtree(store_dir, ignore_errors=True)
os.makedirs(store_dir)
manifest = {}


def write(key, value):
    if len(value) > 1024:
        open(os.path.join(store_dir, hashlib.md5(key.encode()).hexdigest()), 'w').write(value)
        manifest[key] = None
    else:
        manifest[key] = value


profiles = seed['profiles']
root = {
    'achievements': {'stats': seed['stats'], 'unlocked': seed['unlocked']},
    'sound': {'enabled': False},
    'guide': {'versionSeen': 1},
    'settings': {**SCENES[scene], **({'gridSizeTier': grid} if grid else {})},
    'profiles': profiles,
    'profileSelection': {'1': profiles[0]['id'], '2': None if scene == 'vsCpu' else profiles[1]['id']},
    'profileExtensions': {p['id']: {'keyScheme': 'wasd'} for p in profiles},
}
root = {k: json.dumps(v) for k, v in root.items()}
root['_persist'] = json.dumps({'version': -1, 'rehydrated': True})
write(KEY_PREFIX + 'root', json.dumps(root))
json.dump(manifest, open(os.path.join(store_dir, 'manifest.json'), 'w'))

# The App Group roster, through the simulator's own defaults so cfprefsd doesn't hold an older copy.
group = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', udid, BUNDLE, GROUP], text=True).strip()
domain = os.path.join(group, 'Library/Preferences', GROUP)
subprocess.check_call(['xcrun', 'simctl', 'spawn', udid, 'defaults', 'write', domain, 'sharedProfiles', '-string', json.dumps(profiles)])
print(f'Seeded {scene}: {len(profiles)} profiles, {len(seed["unlocked"])} unlocks')
