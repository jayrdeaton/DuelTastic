# DuelTastic

Four arcade duel games in one app: LightCycles, Turf, Tag and Snake. Play a friend face to face on one device, or the CPU.

DuelTastic is a pack of grid duel games for iOS, Android, and web, grown out of LightCycles. Built with Expo, React Native, and React Native Skia, it's part of a family of games built on my open-source `@tastic` game-engine and `@rific` Expo utility packages. App Store and Google Play release in progress.

<p align="center"><img src="docs/gameplay.gif" alt="LightCycles gameplay: a round against the CPU on the Slow speed" width="300"></p>

## The games

- **LightCycles:** the classic light-trail duel. Every rider leaves a solid trail, walls and every trail are deadly (your own included), and the last rider still riding wins the round.
  - Five arenas: Open, Pillars, Gauntlet, Portals (paired teleporters) and Underpass (a tunnel riders can cross over and under).
  - Six optional powerups: Overdrive, Stasis, Shield, Prune, Hack and Overclock.
  - Match options: three grid sizes, three speeds, a trail speed setting, Wrap Edges, and Full Screen (the board extends into the safe area).
- **Turf:** each rider starts on a square of its own ground. Leave it to lay a trail, and get back to claim the trail and everything it loops, the other rider's ground included. Cut their trail before they get home. Most ground at the buzzer wins.
  - Rules: a crash ends the round or sends the rider home, and an option to cross your own trail. Rounds of 1, 2 or 3 minutes.
  - Seven optional powerups: Dash, Frost, Mud, Fence, Tangle, Gust and Sod.
- **Tag:** the playground classic. One rider is It: catch the other to make them It, then run.
  - Rules: Hot Potato (whoever's It at the buzzer loses) or Least Time It. A Pillars or Open arena, and rounds of 30 seconds to a minute and a half.
  - Five optional powerups: Dash, Freeze, Mud, Safe and Tangle.
- **Snake:** the arcade classic. Eat, grow, and keep off the walls and every snake. Play alone for a high score, or against the CPU or a friend's snake.
  - Five arenas, Wrap Edges, Full Screen, three grid sizes and three speeds.
  - Six optional powerups: Sidewind, Coldblood, Scales, Constrict, Mesmerize and Frenzy.

## Features

- **One app, one Home:** pick who's playing (seat 1), then a game from the list. Each game shows its How to Play cards the first time it's opened, and its rules button replays them.
- **Seat 2, kept across games:** each loadout's seat 2 button picks the CPU (three difficulties per game: Drone, Bot and Mainframe, or Snake's Garter, Rattler and King Cobra), Player 2, a saved profile, or Nobody (Snake only). It's saved for the whole pack, so the same two people stay set up from one game to the next. In 2 Player on a phone, players sit face to face, each steering in their own half of the screen.
- **Controls:** swipe to steer on touch devices. On desktop web each player picks the mouse, WASD, the arrow keys, IJKL or the numpad, each with its own powerup key.
- **Player profiles:** saved names, colors and tags. On iOS the roster is shared with my other games through an App Group, and on games.infinitetoken.com through the browser's storage. A profile's color pick for a seat is kept for this pack only.
- **Stats and achievements:** each game keeps its own stats and its own achievements (123 in all: LightCycles, Turf and Tag 30 each, Snake 33). One stats screen filters by player and by game, with per-profile and device-wide records, player rankings and day streaks. Unlocks show as toasts; in 2 Player each player's toasts face them in their own half.
- **Settings:** sound, haptics, appearance, blur, Lock Orientation, Keep Awake, Edge Guard (an iOS option that makes system edge gestures need a second swipe during play), and Check for Updates. A match pauses when the app goes to the background and stays Paused until a player taps Resume.

## Under the hood

- **One pack, four games.** `src/pack.ts` lists the games. Each is one `GameDefinition` (`src/games/<id>/index.ts`) that hands the shared shell (`src/shell/`: Home, the loadout, stats, profiles, settings and the store) its settings, loadout menus, play screen, stats and How to Play cards. The shell and shared code never import a game, and no game imports another; ESLint enforces it.
- **Pure, deterministic engines.** Each game's rules are plain TypeScript (`gameEngine.ts` for LightCycles, `engine.ts` for Turf and Tag, `snakeEngine.ts` for Snake): a tick takes a state and returns the next one, with randomness injected so tests can seed it. Rounds run on `requestAnimationFrame` loops that stop cleanly on pause.
- **CPU opponents.** LightCycles' CPU flood-fills ahead of each legal turn to measure how much open space it leaves, understanding portals, tunnels and wrap-around edges; Snake's measures the same room and how near each turn brings it to the food. Turf's plans loops out from its ground and heads home when its trail is threatened. Tag's chases by the shortest way around the pillars and, when running, heads for the cell the chaser would take longest to reach. Difficulty changes how well each CPU plays and how it uses powerups, not how fast it reacts.
- **Skia rendering.** Boards, trails, snakes, death animations and powerup effects are drawn with React Native Skia and Reanimated. On web each board's host lazy-loads it only after CanvasKit (Skia's WASM build) has loaded, because Skia binds to it at module evaluation.
- **Split-screen input.** In 2 Player each player gets their own gesture zone (`@tastic/split-screen`), and popovers stay in their own player's half. On web, pointer and keyboard input replace the gesture zones.
- **Redux Toolkit + redux-persist.** One store, saved under `dueltastic:root`. Each game keeps its own keys (its settings per player, controls, achievements and How to Play progress), and the pack keeps seat 2, profiles, seat colors and app settings. Per-match state is never persisted.
- **App lifecycle.** Leaving the app mid-match pauses it. The splash screen is held until the theme, fonts and profiles are ready (`@rific/splash-gate`). Over-the-air updates ship through `@rific/updater`, with failures shown as a toast.
- **Tests.** 845 Jest tests across 48 suites cover each game's engine and CPU, input resolution, stats and achievements, the store's saved keys, every game's How to Play copy, the pause flow, and profile syncing.

## Built on

| Package | Used for |
| --- | --- |
| [`@tastic/core`](https://github.com/jayrdeaton/React-Native-Game-Core) | Orientation and rotation handling, background pause, rotation-aware status bar, content bounds, themed root background, config plugin for the native portrait lock |
| [`@tastic/grid`](https://www.npmjs.com/package/@tastic/grid) | Grid coordinate math, stepping, edge wrap |
| [`@tastic/input`](https://www.npmjs.com/package/@tastic/input) | Swipe/key direction resolution, key schemes, control inversion, conflict-free seat scheme assignment |
| [`@tastic/split-screen`](https://www.npmjs.com/package/@tastic/split-screen) | Two-player zone layout and seat placement |
| [`@tastic/hud`](https://www.npmjs.com/package/@tastic/hud) | Player setup panels, dropdowns, settings, overlay cards, confirm and update dialogs, stats screen sections, How to Play guide, Skia web loader |
| [`@tastic/sprites`](https://www.npmjs.com/package/@tastic/sprites) | Skia board shapes (obstacles, the mystery powerup box) |
| [`@tastic/profile`](https://www.npmjs.com/package/@tastic/profile) | Player profiles, the seat button, roster screen, per-profile seat colors, shared App Group sync |
| [`@tastic/achievements`](https://www.npmjs.com/package/@tastic/achievements) | Tiered achievement catalog, streak tracking, Redux-backed persistence |
| [`@tastic/edge-guard`](https://www.npmjs.com/package/@tastic/edge-guard) | Optional guard against iOS edge system gestures during play |
| [`@rific/core`](https://www.npmjs.com/package/@rific/core) | Redux settings slice factory, safe back navigation, Keep Awake |
| [`@rific/auto-paper`](https://www.npmjs.com/package/@rific/auto-paper) | React Native Paper theming from seed colors, light/dark appearance |
| [`@rific/feedback-press`](https://www.npmjs.com/package/@rific/feedback-press) | Buttons with haptic and sound feedback, vibration, game sounds |
| [`@rific/toaster`](https://www.npmjs.com/package/@rific/toaster) | Toast notifications (achievement unlocks, update errors) |
| [`@rific/splash-gate`](https://www.npmjs.com/package/@rific/splash-gate) | Keeps the splash screen up until the theme, fonts, and profiles are ready |
| [`@rific/updater`](https://www.npmjs.com/package/@rific/updater) | OTA update checks |
| [`@rific/focus-chain`](https://www.npmjs.com/package/@rific/focus-chain) | Peer dependency of `@tastic/profile` for form focus |

## Getting started

```bash
npm install
npm run ios        # or: npm run android / npm start (web)
```

The app uses native code that Expo Go doesn't include (the `@tastic/core` and `@tastic/edge-guard` config plugins and `@tastic/profile`'s native iOS shared-roster module), so iOS and Android run as a development build (`expo-dev-client`). `npm run ios` and `npm run android` build it locally (`expo run:*`), and `npm run client` starts the dev server for an already-installed build. `npm install` also runs `setup-skia-web` (the `postinstall` script), which copies Skia's CanvasKit WASM into `public/` for the web target.

### Checks

```bash
npm run verify     # lint (expo lint) + Jest + typecheck (tsc)
```

CI runs the same command on pushes and pull requests to `main`. `npm run build` and `npm run update` are plain `eas build` and `eas update`, so run `npm run verify` first.

## Project layout

```
src/
  app/          thin expo-router routes: Home, profiles, stats, loadout/[game], play/[game]
  pack.ts       DuelTastic: its games and its store
  shell/        app-wide screens, providers, settings and store slices (imports no game)
  shared/       code two or more games use: the match flow, duel stats, powerups, player settings
  games/        lightcycles/, turf/, tag/, snake/: one GameDefinition each
  testUtils/    shared test helpers
  __tests__/    the pack's own Jest suites (each game has its own __tests__ folder too)
  __mocks__/    manual mocks for native and Expo modules
```

## License

The code is released under the MIT License, see [LICENSE](LICENSE).

The games' names, the logo and icons, and the original artwork and audio in this repository, are not covered by that license and remain all rights reserved. If you fork it, please give your version its own name and look.
