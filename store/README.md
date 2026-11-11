# App Store

Everything the iOS listing needs. Google Play's checklist is `store/google-play.md`. The text lives in `store.config.json` (repo root), which `eas metadata:push` sends to App Store Connect. The rest is set by hand in App Store Connect once and carries over to later versions.

## Pushed by EAS Metadata (`store.config.json`)

Title, subtitle, promotional text, description, keywords, marketing/support/privacy URLs, copyright and categories (Games > Action, Casual). Not the age rating: see Age rating under "Set by hand" (removed from `store.config.json` 2026-11-11).

```bash
eas metadata:lint
```

```bash
eas metadata:push
```

`push` needs the app record to exist in App Store Connect and edits its editable version, setting its number to `store.config.json`'s `apple.version`. Keep that equal to `app.json`'s `expo.version` and bump both together: without it, push sends no version number and Apple refuses the version step (copyright, promo text, description, keywords, support and marketing URLs) while the rest goes through.

**DuelTastic is a new app record (2026-10-25), bundle ID `com.infinitetoken.DuelTastic`, not created yet.** `eas submit` creates it on the first upload (it asks for the name: DuelTastic, which has to be unique on the App Store), or create it by hand first. LightCycles' record (bundle ID `com.infinitetoken.LightCycles`, created as LightCyclesTastic, its 1.1.3 turned down by App Review with Snake and Solitaire as too many similar apps) is left as it was: DuelTastic replaces it, and LightCycles and Snake are two of its games. Everything under "Set by hand" below lives on a record, so it all has to be filled in again for DuelTastic's. The listing's description counts 123 achievements (LightCycles, Turf and Tag 30 each, Snake 33): recheck it when a catalog changes.

Limits: title 30, subtitle 30, promotional text 170 (editable any time without review), description 4000, keywords 100 in total with the commas. Keywords don't repeat words already in the title or subtitle ("four", "duel", "games", "ads" are indexed from the subtitle; "DuelTastic" is one word, so it does NOT match a search for "duel" on its own, which is why the subtitle says it).

`releaseNotes` (What's New) is left out for the first version, which has none. Add it to `info.en-US` for every later version.

## Screenshots (uploaded by hand)

**These are LightCycles' screenshots, from before the pack (2026-10-19): DuelTastic needs a new set before it's submitted.** They show LightCycles alone, and the seed below still writes LightCycles' old save (`lightcycles:root`, its old slices), which the pack never reads (its save is `dueltastic:root`, with each game's own keys). The header and search art below are LightCycles' too ("Light Cycle Duels"). The rest of this section is how the LightCycles set was made, for reuse.

`store/screenshots/iphone-medium/` (1206x2622) goes in the "iPhone 6.1" or 6.3" displays" slot, which App Store Connect requires (a 1320x2868 file there fails with "File dimensions are invalid"). `store/screenshots/iphone/` (1320x2868) is for the optional 6.9" slot, and `store/screenshots/ipad/` (2064x2752) for the 13" iPad slot, which is required because `ios.supportsTablet` is on. Apple scales these to every smaller device. The order in the folder is the upload order; the first three are what search results show.

The iPad set is four shots (01-duel captioned "Two Players, One iPad", 02-cpu, 03-win, 07-stats). The lobby shots (04 to 06) are left out there: the lobby's controls stay phone-sized in the middle of the 13" screen and can't be read at App Store size. The iPad captures use the Large grid (`--grid large`), since the default grid's trails look thin on a 13" board.

The PNGs are build output and are gitignored, along with the raw captures they were made from (`store/screenshots/raw/`). The captions are in `store/screenshots.json`.

How they were made (2026-10-19): a Release build on the `LightCycles iPhone 6.9` (iPhone 17 Pro Max) and `LightCycles iPad 13` (iPad Pro 13" M5) simulators, status bar pinned to 9:41 with full battery, dark appearance. These are LightCycles' own simulators, not the shared `AppStore` pair: another session was driving Swirlio on those at the same time, and its input landed in this app. Both were deleted once the shots were done (2026-10-19), so a reshoot uses the shared `AppStore` pair. The saved data was written before first launch (sound off, guide seen, three profiles, and three weeks of rounds played through the app's own stats engine and achievement catalog), so every number on screen is one the app produced.

The gameplay shots (01-duel, 02-cpu, 03-win) are real rounds, ridden by the CPU's own AI on the human seats. Steering through the simulator tool lagged by seconds, so every hand-steered round ended before the board looked like a game. The build they came from was made with a temporary patch to `src/hooks/useGameState.ts` (`store/seed/autopilot.patch`, never applied in the repo): when `EXPO_PUBLIC_STORE_AUTOPILOT=1` at build time, `chooseCpuDirection` (at Bot) picks the human seats' turns each tick. The patch was reverted as soon as the build finished. No shipped build has it. 01 and 02 are frames from screen recordings; the others are still screenshots. A compositor puts each capture under its caption in Orbitron Bold (the app's display font) on one dark background. The tools (simulator setup, the slim build, frame picking, the compositor) are in Jay's `app-store-prep` skill; the LightCycles seeding is here in `store/seed/`.

To redo them:

1. `node store/seed/generate.mjs` (writes `store/seed/seed.json`, gitignored)
2. Build with the autopilot for the gameplay shots: `git apply store/seed/autopilot.patch` (a `storeAutopilot(state, settings)` step at the top of the tick's `setState` that steers seat 1, and seat 2 in Two Player, with `chooseCpuDirection`), build with `EXPO_PUBLIC_STORE_AUTOPILOT=1` and the skill's `sim-build.sh`, then `git apply -R store/seed/autopilot.patch` and install the `.app` on both simulators. If the patch no longer applies, `useGameState.ts` has moved on: redo the same step by hand
3. `store/seed/reseed.sh <udid> --scene vsCpu|twoPlayer` on each (add `--grid large` on the iPad), then capture into `store/screenshots/raw/<device>/<name>.png`:
   - **01-duel:** `--scene twoPlayer`, Two Player, ready both seats, record; a frame about 20 s in, when both halves are full of trail and both riders are alive
   - **02-cpu:** `--scene vsCpu` (Mainframe, Portals), One Player, Ready, record; a frame with both riders alive and long trails
   - **03-win:** a Two Player round's result card, once one ends with Maya (bottom seat) winning
   - **04-powerups:** the lobby (`--scene vsCpu`) with the powerups dial (lightning) open, all six on
   - **05-arenas:** the same lobby with the arena dial (first) open
   - **06-profiles:** the same lobby with Maya's seat menu open (Color, Player, Leo, Maya, Priya, Manage)
   - **07-stats:** the trophy on Home, scrolled to Player Rankings, Activity and the first achievements
4. The skill's `compose.mjs store/screenshots.json`

## Header and search results art (uploaded by hand, optional, iOS 27+)

`store/screenshots/header.png` (3840 x 1646) and `store/screenshots/search.png` (3840 x 2560), gitignored like the screenshots. `node store/creative/build.mjs` makes both:

- **Header:** a real round on a 21:9 board, played by the app's own engine (`createInitialGameState`, `tickGame`) with the CPU's AI riding both cycles, drawn the way `GameBoard.tsx` draws trails (0.85-cell stroke, round caps, a white-ringed head) in the default blue and red, at the tick where both heads are inside Apple's safe area with the most trail on the board. No words: the app's name sits right under it.
- **Search results:** "Light Cycle Duels / Two players, one phone. Or take on the CPU." in Orbitron beside the 01-duel capture in a phone (`store/screenshots/raw/iphone/01-duel.png`, so take the screenshots first).

Each comes with `-safe.png` (the safe area from Apple's templates outlined) and `-384.png` (about a search card's size on a phone). They are rendered through the app-store-prep skill's `creative.mjs`, which checks the size and strips any alpha channel.

Upload in the version's Product Page Information > Header and Search Results (Header, then Search Results), then check both with Preview. The header has no words, so it can go on every localization; the search image's words are English, so it goes on English only. They're reviewed with the version, or on their own through Asset Library.

## Set by hand in App Store Connect

**App Privacy** (Jay, 2026-11-11, following Expo's store privacy guide, https://docs.expo.dev/eas-update/store-privacy-declarations/, and matching Google Play's Data safety in `store/google-play.md`): "Yes, we collect data from this app", two types, both from the over-the-air update check (expo-updates to Expo's EAS Update), and nothing the player makes (profiles, settings, stats) ever leaves the device:

| Data type | Purposes | Linked to the user | Tracking |
| --- | --- | --- | --- |
| Identifiers, Device ID | App Functionality, Analytics | No | No |
| Diagnostics, Crash Data | App Functionality | No | No |

The Device ID is the random client ID expo-updates makes at install and sends with every update check; the crash data is the IDs of updates that failed to launch and the launch error, sent back with the next check. The privacy policy at https://games.infinitetoken.com/privacy already describes the check and its random installation ID. There's no tracking, so no App Tracking Transparency prompt. Revisit it if analytics, crash reporting, ads or accounts are ever added.

**Age rating** (by hand until eas-cli can send it): Apple has required an answer to its Social Media question since September 2026, and eas-cli 27.7.2's metadata schema has no `socialMedia` field, so a push with `advisory` updates everything else and then fails ("You must provide a value for the attribute 'socialMedia'"). It's out of `store.config.json`; answer it in App Store Connect (App Information, Age Rating). Every content question None: no cartoon, fantasy or realistic violence (riders crash into walls and trails; nothing is hurt), no horror, mature themes, profanity, substances, sexual content, medical or wellness topics, contests or simulated gambling. No gambling, loot boxes, ads, messaging or chat, user-generated content, social media, unrestricted web access, parental controls or age assurance. Not made for kids (no Kids category). The result is 4+. Put `advisory` back once eas-cli's schema has `socialMedia`.

**App Review Information:** sign-in not required. Contact: name, email and phone (the phone stays out of `store.config.json`, which is public). The same notes go in TestFlight's Test Information (Beta App Review Information) for the first build tested outside the team. Notes (rewritten 2026-11-08 for the OS turning tablets and the opponent button):

> No account or sign-in is needed, and there are no in-app purchases or ads.
>
> DuelTastic is four games in one app (Trap, Turf, Tag and Snake): pick one from the Home screen. Each game opens on a setup screen, where the button beside player 1's own picks the opponent: the CPU at one of three levels, Solo in Snake to play alone, or Player for two people on one device.
>
> Two Player is played face to face: each player swipes in their own half of the screen to steer, so the top half's buttons and text are upside down on purpose.
>
> The iPhone stays in portrait. The iPad turns with the device. On an iPad held sideways, Trap, Turf and Tag keep their tall face-to-face board in the middle of the screen, the same board as on a phone, and Snake's board fills the screen, with two players side by side.
>
> Player profiles are shared through an App Group with other Tastic games by the same developer, if any are installed. No profile, progress or other game data leaves the device.
>
> Each game shows its How to Play cards the first time it's opened. Tap Skip to go straight to it. The button at the end of each game's row on the Home screen shows them again.

**Content Rights:** the app contains third-party content, and the rights are covered: the Orbitron font (SIL Open Font License) and Material Design Icons (Apache 2.0, via @expo/vector-icons). The sound effects in `assets/sounds/` are Jay's own: he generated them himself (confirmed 2026-10-21). Snake's in `src/games/snake/sounds/` came over from Snake's repo with it: confirm they're his too before answering.

**Pricing and Availability:** Free, all territories except China mainland (needs a government game approval number) and Vietnam (needs a game license from a local company), the same as SolitaireTastic. Apple Silicon Mac and Apple Vision Pro availability unticked: the app has never been run on either.

**Export compliance:** already answered by `ITSAppUsesNonExemptEncryption: false` in `app.json`, so App Store Connect doesn't ask.

**Accessibility (optional):** Dark Interface could be claimed (the app is dark by default and follows Settings' appearance). Nothing else until each feature has been checked on a device. Apple asks per feature (VoiceOver, Larger Text, Dark Interface, Reduced Motion and so on), and a claim that doesn't hold up is worse than none.

**Version release:** manual (you press Release), so it goes live together with SolitaireTastic (or whatever pack Solitaire becomes).

## Shipping a version

1. `npm run verify`
2. `jrd ship build production`
3. `eas submit -p ios --profile production` (uploads the build to TestFlight)
4. `eas metadata:push`
5. Upload the screenshots, and the header and search art, if they changed
6. In App Store Connect: pick the build, fill in anything new above, and Add for Review
