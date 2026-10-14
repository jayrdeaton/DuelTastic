# LightCycles

A Tron-style light-cycle duel for two players on one phone, or one player against the CPU.

LightCycles is a local multiplayer arcade game: each rider leaves a solid trail behind them, and the last cycle still riding wins the round. It runs on iOS, Android, and web from one codebase. Built with Expo, React Native, and React Native Skia, it is part of a family of games built on my open-source `@tastic` game-engine and `@rific` Expo utility packages. App Store and Google Play release in progress.

<p align="center"><img src="docs/gameplay.gif" alt="LightCycles gameplay: a round against the CPU on the Slow speed" width="300"></p>

## Features

- **Two modes:** pass-and-play two-player on a single device (players sit face to face, each steering in their own half of the screen), or one player against a CPU opponent with three difficulties (Drone, Bot, Mainframe).
- **Controls:** swipe to steer on touch devices; on desktop web each player picks WASD, the arrow keys, or IJKL, with conflicts swapped automatically.
- **Six powerups:** Overdrive, Stasis, Shield, Prune, Hack, and Overclock, collected from a mystery pickup and fired with a tap. Each can be toggled per match, and all are off by default.
- **Five arenas:** Open, Pillars, Gauntlet, Portals (paired teleporters), and Underpass (a tunnel riders can cross over and under). Layouts are generated to fit the board's actual size.
- **Match options:** three grid sizes (Small, Medium, Large), three speeds (Slow, Normal, Fast), a trail speed setting (Slow (Off) is the classic trail that never shortens; on Medium and Fast the tail follows, so the trail grows at half or a quarter of its usual rate), Wrap Edges, and a Full Screen mode that extends the board into the safe area.
- **Profiles, stats, and achievements:** saved player profiles with a name, color, and key scheme; per-profile and overall stats (vs CPU by difficulty, two-player, per-color records, player rankings); and a 30-entry achievement catalog with bronze, silver, and gold tiers.
- **How-to-play guide** shown once on first launch and replayable from Settings, with copy that adapts to touch or keyboard and names each player's chosen keys.
- **Settings:** sound, haptics, appearance, Lock Orientation, Edge Guard (an iOS option that makes system edge gestures need a second swipe during play), and Check for Updates. A match pauses automatically when the app goes to the background and stays Paused until a player taps Resume.

## Under the hood

- **Pure, deterministic engine.** All game rules live in plain TypeScript (`src/utils/gameEngine.ts`): `tickGame` takes a state and returns the next one, with randomness injected so tests can seed it. `useGameState` drives it from a `requestAnimationFrame` loop that clamps frame gaps after a stall, scales tick timing to the cell size so on-screen speed is the same at every grid size, and stops cleanly on pause.
- **Flood-fill CPU.** For each legal turn, the CPU walks ahead (several cells when it is boosted) and runs a capped BFS (`src/utils/floodFill.ts`) to measure how much open space that move leaves it. The BFS understands portals, tunnels, and wrap-around edges. Difficulty changes how faithfully the CPU follows the best move and how it uses powerups (seeking pickups, saving a Shield for when it is cornered, timing Hack or Stasis against a boxed-in opponent), not how fast it reacts.
- **Skia rendering.** The board, trails, head animations, death explosions and trail wipes, and powerup effects are drawn with React Native Skia and Reanimated. On web, `GameBoardHost.web.tsx` lazy-loads the board only after CanvasKit (Skia's WASM build) has loaded, because Skia binds to it at module evaluation.
- **Split-screen input.** In two-player mode, each player gets their own gesture zone, placed by device tilt (face to face, or side by side when held in landscape) using `@tastic/split-screen`. Popovers are clamped so they never cross into the other player's half. Platform files (`TouchInputLayer.tsx` / `.web.tsx`) swap Gesture Handler zones for pointer and keyboard input on web.
- **Redux Toolkit + redux-persist.** Settings, profiles, seat colors, stats, achievements, and guide progress are persisted Redux slices, mostly built from shared package factories. Per-match state is blacklisted from persistence. A persist migration detects players upgrading from the earlier AsyncStorage-only build, so they aren't shown the first-run guide again. On iOS, profiles are shared with the other games in the family through an App Group.
- **App lifecycle.** Leaving the app mid-match pauses it. The splash screen is held until the theme, fonts, and profiles are ready (`@rific/splash-gate`). Over-the-air updates ship through `@rific/updater`, with failures shown as a toast.
- **Tests.** 451 Jest tests across 19 suites cover the engine, CPU, flood fill, arenas, input resolution, stats and achievements, Redux slices and persist migration, the guide copy, the pause flow, and profile syncing.

## Built on

| Package | Used for |
| --- | --- |
| [`@tastic/core`](https://github.com/jayrdeaton/React-Native-Game-Core) | Orientation and rotation handling, background pause, rotation-aware status bar, content bounds, themed root background, config plugin for the native portrait lock |
| [`@tastic/grid`](https://www.npmjs.com/package/@tastic/grid) | Grid coordinate math, stepping, edge wrap |
| [`@tastic/input`](https://www.npmjs.com/package/@tastic/input) | Swipe/key direction resolution, key schemes, control inversion, conflict-free seat scheme assignment |
| [`@tastic/split-screen`](https://www.npmjs.com/package/@tastic/split-screen) | Two-player zone layout and seat placement |
| [`@tastic/hud`](https://www.npmjs.com/package/@tastic/hud) | Player setup panels, dropdowns, settings, confirm and update dialogs, stats screen sections, how-to-play guide, Skia web loader |
| [`@tastic/sprites`](https://www.npmjs.com/package/@tastic/sprites) | Skia board shapes (obstacles, mystery pickup) |
| [`@tastic/profile`](https://www.npmjs.com/package/@tastic/profile) | Player profiles, picker, roster screen, per-profile extensions, shared App Group sync |
| [`@tastic/achievements`](https://www.npmjs.com/package/@tastic/achievements) | Tiered achievement catalog, streak tracking, Redux-backed persistence |
| [`@tastic/edge-guard`](https://www.npmjs.com/package/@tastic/edge-guard) | Optional guard against iOS edge system gestures during play |
| [`@rific/core`](https://www.npmjs.com/package/@rific/core) | Redux settings slice factory, safe back navigation |
| [`@rific/auto-paper`](https://www.npmjs.com/package/@rific/auto-paper) | React Native Paper theming from seed colors, light/dark appearance |
| [`@rific/feedback-press`](https://www.npmjs.com/package/@rific/feedback-press) | Buttons with haptic and sound feedback, vibration, game sounds |
| [`@rific/toaster`](https://www.npmjs.com/package/@rific/toaster) | Toast notifications (achievement unlocks, update errors) |
| [`@rific/splash-gate`](https://www.npmjs.com/package/@rific/splash-gate) | Keeps the splash screen up until the theme, fonts, and profiles are ready |
| [`@rific/updater`](https://www.npmjs.com/package/@rific/updater) | OTA update checks and the `build`/`update` scripts |
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

CI runs the same command on pushes and pull requests to `main`, and `npm run build` / `npm run update` (via `@rific/updater`) run it before building or publishing.

## Project layout

```
src/
  app/          expo-router routes: home, lobby, game, profiles, achievements
  components/   Skia game board, touch/keyboard input layers, dialogs, HUD, guide art
  constants/    game tuning, powerups, CPU knobs, achievement catalog, guide steps, fonts, release info
  hooks/        game loop, settings, profiles, stats, sound
  redux/        store, persisted slices, persist config
  testUtils/    shared test helpers
  types/        shared TypeScript types
  utils/        engine, CPU AI, flood fill, arena generators, grid, input resolution, stats
  __tests__/    Jest suites
  __mocks__/    manual mocks for native and Expo modules
```

## License

The code is released under the MIT License, see [LICENSE](LICENSE).

The game's name, logo, and icons, and the original artwork and audio in this repository, are not covered by that license and remain all rights reserved. If you fork it, please give your version its own name and look.
