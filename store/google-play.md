# Google Play

DuelTastic for Android ships through Google Play, from the Infinite Token organization developer account (the one Lumber opened, 2026-11-11). The Android app is this repo's Expo app, package `com.infinitetoken.dueltastic`, built by EAS as an app bundle (`.aab`); Google signs it for the store with the Play App Signing key, and EAS keeps the upload key. It's a new app on Play: no Tastic game has been there before.

Checked 2026-11-11 against Play Console Help, the Developer Program Policies and Expo's store privacy declarations for EAS Update.

## What Google asks of DuelTastic

- **Target API level:** 36 (Android 16), Expo SDK 58's default, so nothing is set.
- **Selling:** nothing is sold, in the app or anywhere else, and there are no ads.
- **Account deletion:** no accounts. Player profiles are names and colors kept on the device.
- **Permissions:** `app.json`'s `android.blockedPermissions` takes out what Expo's template asks for and DuelTastic never uses (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`). What's left is the network (the update check), vibration (haptics) and `MODIFY_AUDIO_SETTINGS` (expo-audio's sound effects). None needs a declaration form. No `AD_ID`.
- **Shared profiles are iOS and web only:** `@tastic/profile` has no Android store (its App Group bridge is Apple's), so on Android each Tastic game keeps its own profiles. The Android description leaves out the iOS line about sharing them.
- **The icon:** Android draws `app.json`'s adaptive icon (`android-icon-foreground.png` and `android-icon-monochrome.png` over `#050505`, made by `store/creative/android-icons.py`), so a launcher's mask never cuts the art and themed icons work.
- **Tablets and Chromebooks:** Android 16 ignores the portrait lock on screens 600dp and wider, so a tablet turns with the OS, as the iPad does (CLAUDE.md, "The OS turns tablets").

## Jay's steps, in order

1. **Finish the developer account** if it isn't yet (Lumber's `store/google-play.md`, steps 1 and 2: the payments profile, the $25 fee, then identity, organization and website verification).
2. **Create the app** (Play Console, Create app): name DuelTastic, default language English (United States), Game, Free, and the declarations.
3. **Fill in App content** (the answers below), the **store listing** and **store settings**.
4. **Build:** `jrd ship build production`, picking All. The first Android build makes the upload keystore on EAS.
5. **Upload the first bundle by hand** in Play Console (Production, Create new release): Google's API can't create an app's first release, so `eas submit -p android` only works from the second one on, with a service account key.
6. **Send for review** (Publishing overview). A new account's first app can take several days.
7. **After it's live:** add `googlePlay: 'https://play.google.com/store/apps/details?id=com.infinitetoken.dueltastic'` to DuelTastic's entry in Games-Web's `src/constants/site.ts`, and the same link to InfiniteToken-WWW's and JayDeaton-Web's cards (the site-alignment skill checks them).

Every later version: `jrd ship build production`, `eas submit -p android --profile production`, the release notes, then send for review.

## Store listing (main store listing)

**App name** (30 at most): `DuelTastic`

**Short description** (80 at most, 76 used):

> Four duel games in one: Trap, Turf, Tag and Snake. Play a friend or the CPU.

**Full description** (4000 at most; the iPhone text with two Android changes: "phones and tablets", and no line about profiles shared between Tastic games):

```
Four arcade duel games in one app: Trap, Turf, Tag and Snake. Play a friend face to face on one device, or the CPU. No ads, no accounts.

• Trap: the classic light-trail duel. Every rider leaves a solid trail, so box the other rider in and be the last one riding. Five arenas and six optional powerups
• Turf: loop out from your ground to claim more of the board, and cut the other rider's trail before they get home. Most ground at the buzzer wins
• Tag: the playground classic. Catch the other rider, then run before they catch you back
• Snake: the arcade classic. Eat, grow, and keep off the walls. Play alone for a high score, or against a second snake
• Two Player face to face on one device, or One Player against the CPU at three difficulties
• Set each game's speed, grid size, rules and optional powerups
• Player profiles, stats, and 123 achievements across the four games
• A match pauses when you leave the app
• Light and dark mode, on phones and tablets
• Plays offline

Part of the Tastic family of games.

Open source on GitHub: https://github.com/jayrdeaton/DuelTastic
```

**Release notes** for the first release (500 at most): `DuelTastic's first release on Android.`

**Graphics** (in `store/screenshots/google-play/`, gitignored):

- **App icon:** `icon-512.png`, 512 x 512, 32-bit PNG with alpha, from `assets/images/icon-dark.png`. Google rounds its corners itself.
- **Feature graphic:** `feature-graphic.png`, 1024 x 500, no alpha: the App Store header's real Trap round (`store/creative/build.mjs`, the app's own engine with the CPU's AI riding both seats), cropped to Play's shape around the middle, where both heads are. No words.
- **Phone screenshots:** `store/screenshots/android/`, 1440x2560, five shots, with alt text (from `store/screenshots.json`):
  1. Two Players, One Phone: "Trap played face to face: two riders' light trails filling the board, one player at each end of the phone"
  2. Claim the Most Ground: "Turf against the CPU: each rider's colored ground spreading over the board, a trail looping out from it"
  3. Tag, You're It: "Tag against the CPU: the rider who is It glowing as it chases the other between pillars"
  4. Take On the CPU: "Trap against the hardest CPU, Mainframe, on the Portals arena"
  5. 123 Achievements: "The stats screen: a player's record, rankings and unlocked achievements"

  Home and Snake are left out for now: Home's blurbs are cut off with an ellipsis on Android (its monospace runs wider than iOS's), and on the emulator Snake's heads were drawn apart from their bodies or not at all. Add them once each is fixed or checked on a device.

How the screenshots were made (2026-11-11): the shared `Pixel_9` emulator (Android 16, dark, demo mode at 9:41), a local release build made `debuggable` (in the generated `android/`) so `store/seed/reseed-android.sh` could write the seed into AsyncStorage, built with the autopilot (`store/seed/autopilot.patch`, `EXPO_PUBLIC_STORE_AUTOPILOT=1`, reverted after). Taps went in as `adb shell input swipe x y x y 150` (a bare tap often didn't register on the loaded emulator), and the rounds were caught as bursts of `adb exec-out screencap` stills (`screenrecord` failed about half the time). Composed with the app-store-prep skill's `compose.mjs`, Orbitron Bold, the same captions as the iPhone.

## Store settings

- **App category:** Game, Arcade.
- **Tags:** up to five from Play's list, picked in the console (Arcade, Local Multiplayer, Casual, Offline and Snake fit, if offered).
- **Contact details:** the account's developer email (public), website https://games.infinitetoken.com/dueltastic, no phone.

## App content

- **Privacy policy:** https://games.infinitetoken.com/privacy
- **App access:** All functionality is available without special access.
- **Ads:** No, the app doesn't contain ads.
- **Content rating** (IARC questionnaire): category Game. No violence (riders crash into walls and trails, nothing is hurt), no fear, sexuality, language, controlled substances, crude humor or gambling. Users don't interact or share content with each other online (two players share one device), no location is shared, nothing is bought in the app, and there's no unrestricted internet access. They match the App Store's answers (`store/README.md`, Age rating).
- **Target audience:** 13 to 15, 16 to 17, and 18 and over (Jay, 2026-11-11), so the Families policy doesn't apply. Play then asks whether the app could unintentionally appeal to children: the listing has no characters, mascots or child-directed words, so the answer is no unless Jay sees it differently. The IARC rating still says it suits everyone.
- **News app, government app, financial features, health:** no, no, none, none.
- **Advertising ID:** the app doesn't use one.
- **Data safety:** below.

## Data safety

Nothing the player makes (profiles, settings, stats, achievements) leaves the device. The only thing that does is the over-the-air update check (expo-updates, to Expo's EAS Update). Expo's store privacy guide (https://docs.expo.dev/eas-update/store-privacy-declarations/) gives Play's answers for it:

| Data type | Collected or shared | Required | Purposes | Why |
| --- | --- | --- | --- | --- |
| Device or other IDs | Collected (Expo is a service provider, so not shared); not ephemeral | Required | App functionality, Analytics | expo-updates sends a random client ID made at install with every update check |
| App info and performance, Crash logs | Collected; not ephemeral | Required | Analytics | IDs of updates that failed to launch, and the launch error, sent back with the next check |

- **Does the app collect or share user data?** Yes (the two above).
- **Encrypted in transit?** Yes (HTTPS).
- **Can users request deletion?** No: there are no accounts, and nothing ties the client ID to a person. Deleting the app deletes its data.
- **Delete account URL:** none (no accounts).

**The App Store declares the same** (Jay, 2026-11-11; `store/README.md`, App Privacy): the client ID and the failed-update reports, neither linked to the player nor used for tracking.
