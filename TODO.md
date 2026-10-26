# TODO

Open fixes from the 2026-10-15 review of the 2026-10-08 fleet audit. Line numbers are as of that date. The F042, F010 and F094 fixes and `@tastic/profile` 0.12.0 landed on 2026-10-15, and F037 (device-wide unlocks on the winner's card only) with `@tastic/achievements` 0.6.0.

## Before launch

Nothing open: the 2026-10-15 live checks passed and keep-awake is in (see CLAUDE.md).

## After launch

1. ✅ **Android hardware back and web browser back skip "Quit Match?"** (audit F093) — fixed 2026-10-26 by adding route-level back prevention on match screens that routes back attempts through the existing Quit Match confirmation flow.
2. ✅ **The Update Available prompt and toasts stay portrait while the screen is turned** (audit F007) — fixed 2026-10-26 by passing live rotation to UpdateDialog and mounting root toasts in a rotated frame.
3. ✅ **Home's hero trails keep animating under `/lobby` and `/game`** (audit F016) — fixed 2026-10-26 by gating hero-trail animation on Home focus and active app state.
4. ✅ **The tick loop rounds every tick up to a whole frame** (audit F065) — fixed 2026-10-26 in LightCycles and Snake by switching to fixed-step accumulation with bounded catch-up and retuning speed intervals to preserve feel.
5. ✅ **A lobby shared-setting dropdown can open toward the wrong edge during the panel-swap fade** (audit F225; from reading the code, not reproduced) — fixed 2026-10-26 by threading panel-layout rotation through shared setting dropdown triggers.

## Expo SDK 58 follow-ups (2026-10-16)

Deferred to ship SDK 58 the same day:

- **Check it on a device.** Verify, typecheck and an iOS prebuild pass, but nothing ran on hardware: launch (SDK 58's scene life cycle), swiping a toast away (`@rific/toaster` 0.8.1 only had its gesture-handler 3 peer range raised, and its tests mock gesture-handler), the trails, walls and Home title trails (moved to Skia 2.14's `PathBuilder`), and the edge-gesture guard.
- **React Native 0.88 strict types.** `@infinitetoken/tsconfig` 0.6 resolves React Native 0.88's legacy types, and React Native drops them after 0.88. This app's own code is already clean under the strict types (checked 2026-10-16 with `customConditions: ["react-native"]` only); the errors it sees are all in package source it type-checks (`@tastic/hud` 15, `@tastic/split-screen` 6, `@rific/auto-paper` 3, `@tastic/profile` 3, `@tastic/core` 1, `@rific/updater` 1). Fix those packages first (their TODO.md files), then drop the deferral.
- **Web tab title in the static HTML.** Since SDK 58, `expo-router/head`'s `<Head>` (in `src/components/Fonts.tsx`) only sets the title after hydration; the static export's HTML has none, so the tab shows the URL until the JS loads and crawlers see no title. Export `generateMetadata()` (returns `{ title }`) from each route, or from the root layout if Expo Router supports it there, then drop `<Head>`.

## Store ignores back to the root .gitignore (2026-10-19)

`store/.gitignore` holds `screenshots/` and `seed/seed.json` only because the root `.gitignore` is part of the EAS fingerprint (`ios/` and `android/` are gitignored, so it decides what's generated): adding them there changed the runtime version and would have cut OTA updates off from build 1.1.3 (28). Move them back, and delete `store/.gitignore`, in the same change as the next native change that bumps the fingerprint anyway (a native dependency, a config plugin, an `app.json` native field). Check with `eas fingerprint:compare --build-id <id>` that the fingerprint was already changing before adding this to it.

## Move the shell into @tastic/shell (plan, 2026-10-25)

Jay: copy PuckTastic's shell now, pull it out into a `@tastic/shell` package later (CLAUDE.md, "Pack structure"). Compared with PuckTastic's `main` at e7118ce: 28 of the 34 `src/shell/` files both repos have are byte-identical (DuelTastic has 4 more, its hero's trails), and so are `src/app/`'s six routes and the six files `src/shared/` copied from PuckTastic. No logic has drifted. Every difference is a pack setting:

| File | PuckTastic | DuelTastic |
|---|---|---|
| `seatColors.ts` | P1 red `#f44336`, P2 blue `#2196f3` | the other way round |
| `redux/shellState.ts` | theme appearance `'system'` (the factory's default) | `appearance: 'dark'` |
| `components/HeroTitle.tsx` | words stacked, in `MONO_FONT`, goal-line bars and a bouncing puck | words side by side, in Orbitron, looped by light trails (plus `HeroTitleTrails.tsx`, `HeroTitleTrailsHost(.web).tsx`, `heroTitleGeometry.ts`, Skia) |
| `components/Fonts.tsx` | the icon font, with expo-font's `useFonts` | Orbitron_700Bold as well, with `@expo-google-fonts/orbitron`'s `useFonts` (expo-font's hook, re-exported) |
| `components/Theme.tsx` | nothing extra | adds `reanimated={Reanimated}` and `fontFamily={MONO_FONT}` |
| `fonts.ts` | its own `MONO_FONT` | hud's `MONO_FONT` (the same `Platform.select`), plus `DISPLAY_FONT` |

The tests have drifted too: PuckTastic's `settingsSlice.test.ts` covers the shell's `appSettingsSlice`, and nothing here does.

**Options**, as `PackDefinition` fields read through `usePack()` (so the shell still imports no pack):
- `seatColors: Record<Seat, string>`, in place of `seatColors.ts`.
- `appearance?: 'system' | 'light' | 'dark'`, default `'system'`.
- `HeroTitle: ComponentType<HeroTitleProps>`. The shell keeps the props type (`words`, `color`, `p1Color`, `p2Color`), and HomeScreen renders `pack.HeroTitle`.
- `fonts?: Record<string, FontSource>`: loaded beside the icon font behind the `fonts` gate, with expo-font's `useFonts`.
- `fontFamily?: string`: auto-paper's typography font. Unset is Paper's system font (PuckTastic).
- `otaVersion: number`, for the Settings dialog's version label. `SettingsDialog.tsx` imports `@/constants/release` today, the shell's one import from outside `src/shell/`. `release.ts` stays in each app for the OTA tooling.

**Not options**, converged instead:
- `reanimated` is always passed. Nothing in either app or any @tastic/@rific package passes `Dialog` an `animatedStyle`, so PuckTastic doesn't change, and `LoadoutScreen` already imports reanimated.
- `MONO_FONT` is hud's. `src/shell/fonts.ts` goes, and its importers take it from `@tastic/hud` (here `shared/duelStats/createDuelStats.tsx`, `shared/match/OnboardingOverlay.tsx` and `games/snake/stats.tsx`; in PuckTastic `shared/SeatResultCards.tsx`, `shared/PlayerRankings.tsx`, `shared/paddleGame/PlayScreen.tsx`, `games/airhockey/PlayScreen.tsx` and `games/boxhockey/components/GuideArt.tsx`). `DISPLAY_FONT` goes with this app's hero.

**What each app passes in:**
- `src/pack.ts`: the `PackDefinition` with the fields above, and `createPackStore(pack, { keyPrefix, migrate })`. The store factory takes the pack so it can merge `pack.games`' reducers itself (both pack.ts files do the same `Object.assign` today) and build the shell's from the pack: `shellState.ts`'s module-level `shellReducers` becomes `createShellReducers({ seatColors, appearance })`, the theme's triad and `seatColorsSlice.ts`'s fresh-install guest and CPU colors come from `seatColors`, and `useSeatColors` reads `usePack().seatColors`. `ShellState` keeps its type. PuckTastic still passes `migrate: createBoxHockey1Import(AsyncStorage)`.
- Its hero (DuelTastic: the trail files and `DISPLAY_FONT`, in `src/hero/` beside pack.ts; its web host can use `shared/lazySkia.tsx` then), the fonts packages behind its `fonts`, and `src/constants/release.ts`.
- `src/app/`'s six routes stay in the app (expo-router only reads routes there), importing from `@tastic/shell`.

**What moves into the package:** the rest of `src/shell/`: `PackContext`, `RootLayout`, `types`, `navigation`, `splashGate`, `components/` (Providers, Theme, Fonts, GuideHost, SettingsDialog, SeatTwoPanel, UpdateDialog), `hooks/` (5), `redux/` (9) and `screens/` (5). Also `shared/playerSettings.ts` and `shared/gameStats.tsx`, which import the shell's own `onProfileRemoved`, `ShellState` and `types`, so they'd otherwise need those exported. The tests that go with it: `profiles.test.tsx` (mounting a stand-in controls reducer instead of a game's), `playerSettings.test.tsx`, PuckTastic's `appSettingsSlice` tests, a new `createPackStore` test (the prefix, `liveplay` never saved, game reducers merged, `seatColors` reaching the theme and `seatColors`), and Theme's half of `statusBar.test.tsx`. `store.test.ts` (each pack's keys and saves) and the source scan in `statusBar.test.tsx` stay in the apps. Peer dependencies: what the shell imports today, minus Skia and Orbitron (they go with this app's hero), plus `expo-font` (PuckTastic's Fonts.tsx imports it undeclared, through `expo`). The two apps' ranges differ only in patch versions.

**What CardTastic needs** (Solitaire at 1.2.8, renamed, with more card games added, per the PuckTastic plan doc). The options above only cover where PuckTastic and DuelTastic differ, and both are two-seat packs. Each of these is optional, so the two-seat packs don't change, and resume and preview tiles serve any later puzzle game too (Jay):
1. **Games with no seats.** `seatTwo`, `twoPlayerSeats` and `GameLoadout.cpuDifficulty` become optional. A game without `seatTwo` gets no seat 2 button, and its play screen plays solo (today `useActiveRound` falls back to `'vsCpu'` when no round was committed).
2. **Games with no loadout.** `useLoadout` becomes optional. Home opens a game without one straight to `play/[game]`, after its How to Play the first time. Its rule variants (Klondike's draw, Spider's suits) go in its play screen's own Settings rows, as Solitaire's `GameChrome` hands its `settingsContent` to `SettingsDialog`, so the shell's `SettingsDialog` gains `children`.
3. **Settings for the whole pack.** A pack field for extra Settings sections, handed to `BaseSettingsDialog`'s `children` everywhere (Solitaire's Gameplay and Cards: auto-move, dim unplayable, auto hint, reduce motion, card style, card back, inverted dark colors), plus pack-level reducers in `createPackStore` to save them in.
4. **Stats across games.** A slot on the stats screen for a pack-wide section (Solitaire's `PlayCalendar` counts every game's plays). Per-variant stats (`klondike-draw3`) stay inside each game's `StatsSections`. The plan doc moves Solitaire's `StatsFilters` and `PlayCalendar` into the package too: compare `StatsFilters` with the stats screen's own player and game filters and keep one.
5. **Resume** (`GameDefinition.resumable`, opt-in): a cold launch drops the player back into the game they left. Port Solitaire's `stores/lastActiveGame.tsx` and `redux/lastActiveGameSlice.ts` as they are. The id is read once at mount and never subscribed to (a live read rebuilt every Home in the stack, about 370 preview cards, on each change), and any later set or clear drops the pending resume, so a deep link never resumes a stale game. The play route sets it when a resumable game's screen mounts and clears it on back. The saved board stays in each game's own slice. PuckTastic's and DuelTastic's games don't opt in: a match is never saved (`liveplay`), so a resume would open a fresh match against the CPU.
6. **Preview tiles** (`GameDefinition.Preview`, optional): a component Home draws in place of the icon. The shell owns the tile layout for previews (Solitaire's `components/homeLayout.ts`, a grid on wide screens), holding previews back until after first paint (`app/index.tsx`'s `previewsRevealed`) and freezing Home's layout while a game covers it (`components/useFrozenWhileHidden.ts`). What a preview draws stays with the game: Solitaire's `GamePreview` and its card-face bitmaps go to CardTastic's own card code. Games without one keep their icon.

**Order:**
1. **Converge in place, in both repos:** add the fields, move `seatColors.ts`, `fonts.ts` and the hero out of `src/shell/`, pass `reanimated` in both, `createPackStore(pack, ...)`. Done when `diff -r` of the two `src/shell/` folders is empty and `npm run verify` passes in both. JS only, so an OTA update can carry it.
2. **Create `@tastic/shell`,** a new repo set up like `@tastic/hud` (source under the `react-native` and `browser` export conditions, a built `dist` for the rest), from the converged `src/shell/` with its `@/shell/` imports made relative, plus the two shared files and the tests above. Develop against a packed tarball (`npm install --no-save`), never `yalc push`.
3. **Widen it for CardTastic, in the package:** the six items above, with tests (a game with no seats, a game with no loadout, a resume used once and cleared on back, a preview in place of an icon). Done in the package rather than in both repos' copies, so it's written once and the two apps switch onto the contract CardTastic will use.
4. **Switch both apps:** delete `src/shell/` and the two shared files, import `@tastic/shell` from `src/app/`, the games and `src/shared/`, drop `src/shell/**` from `eslint.config.cjs`'s boundary rule (the games' and `src/shared/`'s rules stay), and check a web export of each (Home's hero, a match start, Settings' version label).
5. **Later:** `SeatToasters.tsx`, `useUnlockToasts.ts`, `useGameSound.ts` and `lazySkia.tsx` (identical, but with no tie to the shell) as a second entry point or in another package. CardTastic starts on the package rather than a third copy, and Solitaire's own Home, resume, `StatsFilters` and `PlayCalendar` give way to the package's.

Open for Jay: whether PuckTastic should start dark and set Paper's text in `MONO_FONT` too. If yes, `appearance` and `fontFamily` become plain defaults instead of options.

## NOTES

I think (and my kids agree) that the shield should last for a certain amount of time, and not go away after first contact.  Shield maybe should allow you to crash through gauntlet walls, pillars, and screen edges.

Achievements on desktop are full width, but on solitaire its capped to a certain width, or the profile view is at least...  These should all be the same across the fleet.