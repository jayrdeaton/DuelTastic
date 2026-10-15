# TODO

Open fixes from the 2026-10-15 review of the 2026-10-08 fleet audit. Line numbers are as of that date. The F042 and F010 fixes and `@tastic/profile` 0.12.0 landed on 2026-10-15.

## Before launch

Nothing open: the 2026-10-15 live checks passed and keep-awake is in (see CLAUDE.md).

## Needs Jay's call

1. **Back after the match ends still asks "Quit Match?"** (audit F094). The getter at `src/app/game.tsx:118` checks `roundHistory.length > 0`, and the comment at 463-466 says confirming after the match is deliberate. The result card's own Quit exits at once, though, so the two exits disagree. Suggested: keep confirming at `roundOver` (mid-streak), return false at `matchOver`.
2. **Device-wide unlocks show on both seats in 2 Player** (audit F037). `broadcastDeviceUnlocks` at `src/app/game.tsx:591` puts them on the losing seat too. Suggested (same as Snake): show device-wide unlocks only on the winner's side, both on a draw.

## After launch

3. **Android hardware back and web browser back skip "Quit Match?"** (audit F093). Needs hud support (an opt-in `BackHandler` in `useQuitConfirmation`, plus a router-level block for web). Before an Android release; iOS is unaffected.
4. **The Update Available prompt and toasts stay portrait while the screen is turned** (audit F007). The UpdateDialog wrapper passes no `rotation`, and the Toaster sits outside any turned frame. Pass `rotation`, or mount both in hud's `RotatedFrame`.
5. **Home's hero trails keep animating under `/lobby` and `/game`** (audit F016). Pause them on blur and in the background, as Solitaire's HeroCards does (`useIsFocused` plus AppState).
6. **The tick loop rounds every tick up to a whole frame** (audit F065). At 60Hz the 43ms fast tier runs at 50ms (16% slow), the 90ms slow tier at 100ms, and the 26ms ramp floor at 33ms (28% slow); at 120Hz the same tiers run faster, so speed depends on the display. A fixed-step hook in `@tastic/core` (carry the remainder, bounded catch-up) would fix this and Snake together; retune the speeds alongside, since fixing only the loop makes every game faster than it has been tuned.
7. **A lobby shared-setting dropdown can open toward the wrong edge during the panel-swap fade** (audit F225; from reading the code, not reproduced). Pass the `panelLayout` rotation to each shared-control trigger, as BoxHockey does.
