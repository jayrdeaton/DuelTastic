import { getBlendedColor, useAutoPaperTheme } from '@rific/auto-paper'
import { broadcastDeviceUnlocks } from '@tastic/achievements'
import { computeContentBounds } from '@tastic/core'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'

import GameBoardHost from '@/components/GameBoardHost'
import { MatchOverlays } from '@/components/MatchOverlays'
import { PowerupHud } from '@/components/PowerupHud'
import TouchInputLayer from '@/components/TouchInputLayer'
import { deathAnimationDurationMs, MAX_BOARD_CONTENT_WIDTH, TRAIL_SPEED_RATE } from '@/constants/game'
import { useGameState } from '@/hooks/useGameState'
import { useGameStats } from '@/hooks/useGameStats'
import { useMatchControls, useMatchFlow } from '@/hooks/useMatchFlow'
import { useProfiles } from '@/hooks/useProfiles'
import { useSettings } from '@/hooks/useSettings'
import { SEAT_TOAST_STACKS, useUnlockToasts } from '@/hooks/useUnlockToasts'
import type { RootState } from '@/redux/store'
import { Direction, OrientationMode, Player, RoundOutcome, Settings } from '@/types'
import { humanPlayersFor } from '@/utils/gameParams'
import { safeBack } from '@/utils/navigation'

// A stable, referentially-constant all-zero insets object - see safeAreaInsetsPx's own comment
// below for why the board passes this instead of the device's real insets whenever it isn't
// actually bleeding under them.
const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

const SEATS: readonly Player[] = [1, 2]
// Vs CPU has one human, seat 1.
const SOLO_SEATS: readonly Player[] = [1]

interface GameRoundProps {
  // The board's one-time DESIGN measurement (see GameScreen's boardSize.design) - read once, at
  // mount, via GameRound's own lazy useState below, same treatment as orientationMode/p1OnRight
  // right below. This is what the grid itself is built from (see useGameState) and never changes
  // again for the life of the match: the actual cols/rows a round plays out on can't change without
  // invalidating every trail cell already laid down in that coordinate space, so a side shouldn't
  // swap out from under a player mid-round just because the phone got bumped or picked up - freezing
  // at mount is a gameplay-fairness guard, not a workaround for OS rotation (the app is
  // portrait-locked at the OS level, so there's no real rotation to fight in the first place). The
  // floating dialogs (OnboardingOverlay, RoundOverDialog, ...) are a different story - see
  // MatchOverlays, rendered as this component's own sibling specifically so their live rotation
  // tracking can never cascade a re-render into the board/touch subtree below.
  width: number
  height: number
  // The SAME container's current LIVE measurement (see GameScreen's boardSize.live) - unlike
  // width/height above, these are deliberately NOT frozen into local state: they flow straight
  // through on every render so the live transform:scale below (see this component's own comment
  // next to it) can track the window resizing/gutter changing in real time, without the frozen grid
  // above ever finding out anything changed.
  liveWidth: number
  liveHeight: number
  // The device's real safe-area insets in px, but ONLY when this round is actually bleeding under
  // them (extendIntoSafeArea - see GameScreen's own boardArea style) - GameScreen passes all-zero
  // otherwise, since the board's own pixel container already stops short of the inset in that case
  // and there's nothing left for a pickup to need to avoid. Frozen at mount same as width/height
  // above, and fed straight through to useGameState so a pickup never spawns somewhere a notch/
  // Dynamic Island/home-indicator/speaker cutout would physically hide it (see gameEngine.ts's
  // buildUnsafeAreaCells).
  safeAreaInsetsPx: { top: number; right: number; bottom: number; left: number }
  settings: Settings
  colors: Record<Player, string>
  // Seat -> saved profile name, only for seats that had one selected at lobby handoff - see
  // GameScreen's own profileSnapshot comment for why this is frozen once, not read live.
  profileNames: Partial<Record<Player, string>>
  // Always 'faceToFace' - see GameScreen's own comment on why the board never uses 'sideBySide'.
  orientationMode: OrientationMode
  // Meaningless alongside a permanently-'faceToFace' orientationMode - see GameScreen's own comment.
  p1OnRight: boolean
  // Owned by GameScreen, not this component, so it survives whatever GameRound itself does across
  // rotations - see onRoundOutcome.
  roundHistory: RoundOutcome[]
  // Reports a just-finished round upward instead of GameRound tracking its own roundHistory.
  onRoundOutcome: (outcome: RoundOutcome) => void
}

// Split out from GameScreen so useGameState's lazy initial state (see useGameState.ts) is always
// built from a real, already-measured board size - mounting it before the board area's onLayout
// ever fires would lock the grid to a throwaway placeholder size forever, since that initializer
// only ever runs once per mount. Mounted exactly once for the life of a match (see GameScreen,
// which measures the board area once and never revisits it) - width/height/orientationMode/
// p1OnRight below are all frozen at that single mount via lazy useState (redundant with
// GameScreen's own freeze of the values it passes down, but cheap insurance against this
// component ever receiving something other than a stable value), so a later rotation never tears
// the round down, rebuilds the grid, or touches the board/touch layer at all.
function GameRound({ width: widthAtMount, height: heightAtMount, liveWidth, liveHeight, safeAreaInsetsPx: safeAreaInsetsPxAtMount, settings, colors, profileNames, orientationMode: orientationModeAtMount, p1OnRight: p1OnRightAtMount, roundHistory, onRoundOutcome }: GameRoundProps) {
  const [width] = useState(widthAtMount)
  const [height] = useState(heightAtMount)
  const [safeAreaInsetsPx] = useState(safeAreaInsetsPxAtMount)
  const [orientationMode] = useState(orientationModeAtMount)
  const [p1OnRight] = useState(p1OnRightAtMount)
  // The match's dialogs and pause (see useMatchFlow.ts), ahead of useGameState, which needs `paused`.
  const controls = useMatchControls(roundHistory)
  const { state, turn, activate, beginPlaying, rematch, tickIntervalMs, cellPx } = useGameState(width, height, settings, colors, orientationMode, p1OnRight, safeAreaInsetsPx, controls.paused)

  // Live, not frozen (see liveWidth/liveHeight's own doc on GameRoundProps) - recomputed every
  // render as the window resizes/gutter changes, so the board+touch subtree below visibly tracks
  // it. Math.min, not independent X/Y scale, so a live aspect ratio that's drifted from the design
  // one (a much shorter or narrower window than the round actually started in) still scales the
  // whole board uniformly and leaves the extra room on one axis as margin, instead of stretching
  // cycles/trails into ovals. Applying this as a transform on the board+touch subtree as one rigid
  // unit, rather than re-deriving cols/rows/cellPx from the live size, is what actually makes this
  // safe: TouchInputLayer's own zones are already percentage-of-parent/pan-translation based, not
  // absolute-pixel (see that file's own doc), so scaling both the canvas and the touch zones
  // together by the exact same factor can never let them disagree about where anything is - unlike
  // the "freeze only the grid, leave the container live" approach width/height's own comment above
  // describes as tried and rejected, which let the two resize independently instead.
  const boardScale = Math.min(liveWidth / width, liveHeight / height)

  const humanPlayers = useMemo(() => humanPlayersFor(settings), [settings])
  const controlInverted = useMemo<Record<Player, boolean>>(() => ({ 1: state.players[1].effects.control !== null, 2: state.players[2].effects.control !== null }), [state.players])
  // Fed to TouchInputLayer so it can gate turn feedback (sound/haptic) on a swipe that would
  // actually turn the player - see isEffectiveTurn.
  const currentDirections = useMemo<Record<Player, Direction>>(() => ({ 1: state.players[1].direction, 2: state.players[2].direction }), [state.players])

  // The persisted, cross-round defaults (not this round's already-locked-in `settings` prop above)
  // - matches every other screen's settings button, which always edits "next time," never the
  // round already underway.
  const { settings: userSettings, setSettings: setUserSettings } = useSettings()

  // The board reacts to the round's end at once - each crashed player's own PlayerTrail (see
  // GameBoard.tsx) starts its explosion-then-wipe death sequence the instant its `alive` flips false -
  // and the result card waits for the slower of those sequences (both, on a draw), so it never covers
  // a still-wiping trail. Read once, when the round ends: a dead player's trail never changes again
  // that round, and GameBoard.tsx computes the same number from deathAnimationDurationMs.
  const resultDelayMs = () => {
    const deadPlayers = ([1, 2] as Player[]).filter((p) => !state.players[p].alive)
    return deadPlayers.length > 0 ? Math.max(...deadPlayers.map((p) => deathAnimationDurationMs(state.players[p].trail.length).totalMs)) : 0
  }
  const flow = useMatchFlow({ controls, phase: state.phase, outcome: state.outcome, humanPlayers, rematch, onRoundOutcome, resultDelayMs })

  const { colors: themeColors } = useAutoPaperTheme()
  // themeColors.outline on its own is already blended 45% toward player 1's own primary color (see
  // auto-paper's useComputedTheme.ts), which reads as "belongs to player 1" rather than a neutral
  // board marker - per explicit user feedback. Blending it further with tertiary (the same neutral,
  // belongs-to-neither-player role pickups already render in) pulls obstacle/portal/tunnel geometry
  // back toward "inert board structure" instead.
  const obstacleColor = getBlendedColor(themeColors.tertiary, themeColors.outline, 0.5)

  return (
    <>
      {/* Fixed at the frozen design width/height (not liveWidth/liveHeight) and scaled as one rigid
      unit via boardScale above - see that comment for why this, not resizing the pieces
      independently, is what keeps the canvas and the touch zones from ever disagreeing. transform's
      default origin (center) is exactly what keeps this centered inside boardArea's own live,
      already-centered bounds (see styles.boardArea's alignItems/justifyContent) as boardScale
      changes, with no separate positioning math needed here. */}
      <View style={{ width, height, transform: [{ scale: boardScale }] }}>
        <GameBoardHost players={state.players} phase={state.phase} tickIntervalMs={tickIntervalMs} cellPx={cellPx} grid={state.grid} orientationMode={orientationMode} p1OnRight={p1OnRight} tick={state.tick} pickups={state.pickups} pickupColor={themeColors.tertiary} obstacles={state.obstacles} obstacleColor={obstacleColor} portals={state.portals} tunnels={state.tunnels} trailSpeedRate={TRAIL_SPEED_RATE[settings.trailSpeedTier]} wrapEdges={settings.wrapEdges} />
        <TouchInputLayer orientationMode={orientationMode} p1OnRight={p1OnRight} humanPlayers={humanPlayers} enabled={state.phase === 'playing' && !controls.paused} onTurn={turn} onActivate={activate} controlInverted={controlInverted} currentDirections={currentDirections} keyScheme={settings.keyScheme} />
      </View>

      {/* Deliberately OUTSIDE the scaled View above, unlike GameBoardHost/TouchInputLayer - a held
      powerup's badge is UI chrome, not part of the rendered world, and needs to stay a legible,
      comfortably-tappable fixed size (see PowerupHud's own 12px corner insets) regardless of
      whatever size the board itself is currently scaled to. */}
      {state.phase === 'playing' && settings.enabledPowerups.length > 0 && <PowerupHud players={state.players} orientationMode={orientationMode} p1OnRight={p1OnRight} />}

      {/* Every floating dialog, and the back and settings chips, live in MatchOverlays, the board's
      sibling, so their live rotation tracking can never re-render the board/touch subtree above (see
      that component's own doc). Also outside the scaled View, same reason as PowerupHud: a dialog
      shouldn't shrink just because the board did. */}
      <MatchOverlays phase={state.phase} orientationMode={orientationMode} p1OnRight={p1OnRight} settingsOpen={controls.settingsOpen} onSettingsDismiss={() => controls.setSettingsOpen(false)} onSettingsOpen={() => controls.setSettingsOpen(true)} userSettings={userSettings} setUserSettings={setUserSettings} confirmVisible={controls.confirmVisible} cancelBack={controls.cancelBack} humanPlayers={humanPlayers} colors={colors} profileNames={profileNames} roundHistory={roundHistory} onOnboardingComplete={beginPlaying} showResultDialog={flow.showResultDialog} matchOver={controls.matchOver} controlsVisible={flow.controlsVisible} desktopWeb={flow.isDesktopWeb} outcome={state.outcome ?? null} gameMode={settings.gameMode} rematchReady={flow.rematchReady} onRequestRematch={flow.handleRequestRematch} onQuit={flow.handleQuit} onExit={safeBack} onBackPress={controls.requestBack} backgroundPaused={controls.backgroundPaused} onResume={controls.resume} />
    </>
  )
}

export default function GameScreen() {
  // Locked in once at mount from /lobby's own handoff (liveplay.activeRoundSettings, see
  // liveplaySlice.ts), not read reactively off the store, so a settings-dialog edit made mid-
  // round (which only ever touches the *editable* settings, not this snapshot) can't change a
  // round already underway out from under it.
  const activeRoundSettings = useSelector((state: RootState) => state.liveplay.activeRoundSettings)
  const [settings] = useState(activeRoundSettings)

  useEffect(() => {
    // Reached directly - a refreshed page (web) or a deep link - rather than via /lobby's own
    // "Ready" handoff, so there's no committed round to play. Same fallback safeBack uses for its
    // own no-history case.
    if (!settings) router.replace('/')
  }, [settings])

  // The board itself always uses the SAME split, regardless of how the phone is physically being
  // held - 'faceToFace' (P1 near/bottom, P2 far/top, moving toward each other along the tall axis),
  // never 'sideBySide'. This isn't a frozen live reading, it's a fixed constant: the render surface
  // is permanently portrait-shaped (the app is portrait-locked at the OS level, and unlike the
  // lobby, the board/touch layer is deliberately never wrapped in FakeLandscapeView - see
  // MatchOverlays' own comment on why that'd risk breaking swipe-to-turn), so it can never actually
  // become wide enough for a genuine left/right split to make sense - that would just carve the
  // same tall, narrow canvas into two unplayably thin vertical strips. p1OnRight is meaningless
  // alongside a permanently-'faceToFace' mode (nothing reads it when orientationMode is
  // 'faceToFace' - see wallPath, TouchInputLayer's zone split, PowerupHud's corner pick), so it's
  // just a fixed placeholder. The floating dialogs/countdown still visually rotate to match
  // whichever way the phone is actually held (or stay put while Lock Orientation is on): see
  // MatchOverlays, which reads that shared signal independently and applies it on top of this same
  // fixed 'faceToFace' zone split.
  const [orientationMode] = useState<OrientationMode>('faceToFace')
  const [p1OnRight] = useState(true)

  const insets = useSafeAreaInsets()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const { gutterWidth } = computeContentBounds(windowWidth, MAX_BOARD_CONTENT_WIDTH)
  const { colors: themeColors, dark } = useAutoPaperTheme()
  const colors = useMemo<Record<Player, string>>(() => ({ 1: themeColors.primary, 2: themeColors.secondary }), [themeColors.primary, themeColors.secondary])

  // Resolved once at mount from whichever profile each seat had selected at lobby handoff, exactly
  // like `settings` above (activeRoundSettings) - a mid-round profile change (there's no UI for one
  // during a match, but a saved profile could still be edited/deleted from another still-mounted
  // screen under expo-router) shouldn't retroactively alter a round already underway.
  const { profiles: savedProfiles, lastSelected } = useProfiles()
  // Seat 2's own lastSelected is deliberately ignored in vsCpu mode below - it's a single piece of
  // state persisted across mode switches (useProfiles.tsx), so a profile picked for local two-player
  // seat 2 in an earlier session can otherwise still be sitting there once the player switches to
  // vsCpu, where seat 2 is the CPU and has no profile-selection UI at all (@tastic/hud's
  // PlayerSetupPanel never renders a ProfilePicker for a non-human seat). Without this gate that
  // stale id would flow straight into statsEngine.ts's profile-bump loop and MatchOverDialog's
  // title, silently attributing the CPU's own wins/losses to a human profile.
  const [profileIds] = useState<Partial<Record<Player, string>>>(() => {
    const ids: Partial<Record<Player, string>> = {}
    if (savedProfiles.some((p) => p.id === lastSelected[1])) ids[1] = lastSelected[1] as string
    if (settings?.gameMode !== 'vsCpu' && savedProfiles.some((p) => p.id === lastSelected[2])) ids[2] = lastSelected[2] as string
    return ids
  })
  const [profileNames] = useState<Partial<Record<Player, string>>>(() => {
    const names: Partial<Record<Player, string>> = {}
    const p1 = savedProfiles.find((p) => p.id === lastSelected[1])
    const p2 = settings?.gameMode !== 'vsCpu' ? savedProfiles.find((p) => p.id === lastSelected[2]) : undefined
    if (p1) names[1] = p1.name
    if (p2) names[2] = p2.name
    return names
  })

  // Chronological record of each round's outcome this match, oldest first - lives here rather than
  // inside GameRound purely as the existing home for it; GameRound itself stays mounted for the
  // whole match regardless of rotation (see its own comment), so nothing here is actually at risk
  // of a mid-match reset.
  const [roundHistory, setRoundHistory] = useState<RoundOutcome[]>([])
  const { recordRoundOutcome } = useGameStats()
  // Each unlocked achievement gets its own tier-colored, tier-iconed toast, named for its seat's
  // profile (see useUnlockToasts).
  const showUnlockToasts = useUnlockToasts()
  const handleRoundOutcome = useCallback(
    (outcome: RoundOutcome) => {
      setRoundHistory((history) => [...history, outcome])
      // settings is only null before the initial-mount redirect below (see the effect above) - by
      // the time a round can actually finish and report an outcome here, GameRound (which requires
      // non-null settings as a prop) is already what's rendering it.
      if (!settings) return
      const result = recordRoundOutcome(outcome, { gameMode: settings.gameMode, cpuDifficulty: settings.cpuDifficulty, colors, profileIds })
      // Each human seat's own unlocks plus the device-wide ones that are really that seat's (all of
      // them for a guest, only scope: 'device' ones for a profile; see @tastic/achievements'
      // broadcastDeviceUnlocks), same as Snake. In 2 Player the device-wide ones go to the round's
      // winner only, both seats on a draw (audit F037).
      const winners = settings.gameMode === 'twoPlayer' && outcome.type === 'win' ? [outcome.winner] : undefined
      const seatUnlocks = broadcastDeviceUnlocks(humanPlayersFor(settings), result.profiles, result.device, profileIds, { winners })

      if (settings.gameMode === 'vsCpu') {
        // Only seat 1 is ever human here, so its unlocks go on the app's screen-fixed toast - there's
        // no "other side" to distinguish it from.
        showUnlockToasts(seatUnlocks, SOLO_SEATS, profileNames)
      } else {
        // Both seats are human here, face to face, so each seat's go to its own Toaster, in its half
        // of the board and turned to face it (MatchOverlays' SeatToasters), the way its own
        // RoundOverDialog card is; side by side, each player's stack stays on their own half.
        showUnlockToasts(seatUnlocks, SEATS, profileNames, SEAT_TOAST_STACKS)
      }
    },
    [recordRoundOutcome, settings, colors, profileIds, profileNames, showUnlockToasts]
  )

  // The board area's edge IS the wall - running off it is a crash like any trail, and GameBoard
  // draws a thin two-color outline at the grid's actual pixel bounds to mark exactly where that
  // edge is. Bounded to exactly the safe area by default (the insets below) plus a @tastic/core
  // gutter (gutterWidth above) on anything wider than MAX_BOARD_CONTENT_WIDTH, so that outline
  // always sits somewhere a player can actually see and reach AND the arena never stretches into an
  // unplayably wide, short rectangle on a maximized desktop-web window; extendIntoSafeArea (a
  // per-round lobby setting - see Settings' own comment) opts into bleeding the board all the
  // way to the physical screen edge instead, ignoring both the safe area and the gutter and trading
  // that margin for more play space.
  // This container's own bounds (the style below) are fully live, same as insets/gutterWidth
  // themselves - they track the window on every render, no freezing at all at this level.
  // designSize below captures a frozen ONE-TIME measurement instead - what GameRound's actual
  // grid/game state gets built from (see GameRoundProps' own comment on why THAT can never change
  // mid-round). GameRound also gets this container's current LIVE size (liveWidth/liveHeight,
  // computed further below, past the `if (!settings)` guard) and does the live-scaling itself (see
  // its own boardScale comment) - resizing the window after a round has already started grows/
  // shrinks the board in place instead of doing nothing, without the frozen grid underneath ever
  // finding out anything changed. A previous version of this froze the CONTAINER too (matching the
  // grid), on the theory that only a device rotation - already prevented by the orientation lock
  // above - could ever invalidate a one-time measurement; that reasoning quietly stopped covering
  // the real world the moment gutterWidth made plain window resizing (always possible on web, no
  // rotation involved at all) something worth reacting to.
  const [designSize, setDesignSize] = useState<{ width: number; height: number } | null>(null)
  const onBoardLayout = useCallback((e: LayoutChangeEvent) => {
    // Captured eagerly, not read off `e` inside the updater below - React can invoke a functional
    // setState updater more than once (e.g. StrictMode's double-invoke), and by a second call
    // React Native's synthetic LayoutChangeEvent may already be pooled/recycled, leaving
    // e.nativeEvent null and crashing this on "Cannot read property 'layout' of null".
    const { width, height } = e.nativeEvent.layout
    setDesignSize((prev) => prev ?? { width, height })
  }, [])

  const bg = dark ? '#000000' : '#FFFFFF'

  if (!settings) return null

  // The container's LIVE content box, as plain numbers - the exact same arithmetic boardArea's own
  // style just below already expresses (insets+gutterWidth when not full-bleed, the raw window
  // otherwise), just computed directly from useWindowDimensions()/useSafeAreaInsets() rather than
  // measured via a second onBoardLayout firing. A second-measurement version (mirroring designSize
  // above but never freezing) was tried first and doesn't hold up: onLayout - RN-Web's
  // ResizeObserver under the hood - doesn't reliably re-fire on a bare window resize when
  // boardArea's own style is the referentially-stable styles.boardAreaFullBleed constant, confirmed
  // directly by comparing the two side by side: windowWidth/gutterWidth above tracked every resize
  // correctly the whole time, while that version's live measurement stayed stuck at whatever it had
  // last fired with - reliably reproducible specifically in extendIntoSafeArea's full-bleed branch,
  // where boardArea's own style object never changes, so nothing about its inline style ever gives
  // RN-Web a reason to re-measure. Computing it directly here sidesteps that reliability gap
  // entirely, at the cost of duplicating this one arithmetic expression rather than measuring it
  // once.
  const liveWidth = settings.extendIntoSafeArea ? windowWidth : windowWidth - insets.left - insets.right - 2 * gutterWidth
  const liveHeight = settings.extendIntoSafeArea ? windowHeight : windowHeight - insets.top - insets.bottom
  // All-zero unless the board is actually bleeding under the real insets (extendIntoSafeArea) - see
  // GameRoundProps' own safeAreaInsetsPx comment for why: the non-full-bleed boardArea style below
  // already stops short of the inset on its own, so there's nothing left for a pickup to avoid.
  const safeAreaInsetsPx = settings.extendIntoSafeArea ? insets : ZERO_INSETS

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* The OS status bar is hidden on this screen only (_layout.tsx's GAME_OPTIONS), for the
      whole time a match is in progress, regardless of whether the board itself is bleeding under
      the safe area - full-screen immersion during actual play, not just when there'd otherwise be
      a visible clash. */}
      <View style={[styles.boardArea, settings.extendIntoSafeArea ? styles.boardAreaFullBleed : { top: insets.top, bottom: insets.bottom, left: insets.left + gutterWidth, right: insets.right + gutterWidth }]} onLayout={onBoardLayout}>
        {designSize && <GameRound width={designSize.width} height={designSize.height} liveWidth={liveWidth} liveHeight={liveHeight} safeAreaInsetsPx={safeAreaInsetsPx} settings={settings} colors={colors} profileNames={profileNames} orientationMode={orientationMode} p1OnRight={p1OnRight} roundHistory={roundHistory} onRoundOutcome={handleRoundOutcome} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // alignItems/justifyContent center the design-resolution board (see GameRound's own boardScale
  // comment) inside these live bounds - MatchOverlays/PowerupHud's own children are all
  // position:'absolute' internally (see their own styles), so centering this container has no
  // effect on them; only the board's normal-flow scaled View is actually being centered.
  boardArea: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'absolute' },
  boardAreaFullBleed: { bottom: 0, left: 0, right: 0, top: 0 },
  root: { flex: 1 }
})
