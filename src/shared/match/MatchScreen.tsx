import { useAutoPaperTheme } from '@rific/auto-paper'
import { broadcastDeviceUnlocks } from '@tastic/achievements'
import { computeContentBounds } from '@tastic/core'
import { useActiveRound, useProfiles } from '@tastic/shell'
import { type ComponentType, useCallback, useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { RoundContext } from '@/shared/duelStats/statsEngine'
import type { AchievementDefinition } from '@/shared/duelStats/types'
import { DESKTOP_CHIP_BAND, MAX_BOARD_CONTENT_WIDTH } from '@/shared/match/constants'
import { type CpuDifficulty, type GameMode, humanPlayersFor, type OrientationMode, type Player, type RoundOutcome } from '@/shared/match/types'
import { useDesktopWeb } from '@/shared/match/useDesktopWeb'
import { SEAT_TOAST_STACKS, useUnlockToasts } from '@/shared/useUnlockToasts'

// A stable, referentially-constant all-zero insets object - see safeAreaInsetsPx's own comment
// below for why the board passes this instead of the device's real insets whenever it isn't
// actually bleeding under them.
const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

const SEATS: readonly Player[] = [1, 2]
// Vs CPU has one human, seat 1.
const SOLO_SEATS: readonly Player[] = [1]

// What a game's round component is handed (LightCycles' GameRound, TurfRound, TagRound).
export interface MatchRoundProps<S> {
  // The board's one-time DESIGN measurement - read once, at mount (a round component freezes it
  // with a lazy useState), the size the grid itself is built from. It never changes again for the
  // life of the match: the cols/rows a round plays out on can't change without invalidating every
  // cell already laid down in that coordinate space, so a side shouldn't swap out from under a
  // player mid-round just because the phone got bumped or picked up. The floating dialogs live in
  // MatchOverlays, the board's sibling, so their live rotation tracking never re-renders the board.
  width: number
  height: number
  // The SAME container's current LIVE measurement - deliberately NOT frozen, so the round can scale
  // the board as one rigid unit (Math.min(liveWidth / width, liveHeight / height)) as the window
  // resizes or the gutter changes, without the frozen grid ever finding out anything changed.
  liveWidth: number
  liveHeight: number
  // The device's real safe-area insets in px, but ONLY when the round is actually bleeding under
  // them (a game's Full Screen option) - all-zero otherwise, since the board's own pixel container
  // already stops short of the inset then. A game keeps pickups out of cells a notch, Dynamic
  // Island, home indicator or speaker cutout would hide.
  safeAreaInsetsPx: { top: number; right: number; bottom: number; left: number }
  settings: S
  gameMode: GameMode
  colors: Record<Player, string>
  // Seat -> saved profile name, only for seats that had one selected when the round was committed.
  profileNames: Partial<Record<Player, string>>
  // Always 'faceToFace' - see MatchScreen's own comment on why the board never uses 'sideBySide'.
  orientationMode: OrientationMode
  // Meaningless alongside a permanently-'faceToFace' orientationMode - see MatchScreen.
  p1OnRight: boolean
  // Owned by MatchScreen, not the round, so the match's record survives whatever the round does.
  roundHistory: RoundOutcome[]
  // Reports a just-finished round upward instead of the round tracking its own history.
  onRoundOutcome: (outcome: RoundOutcome) => void
}

// What every game's settings carry for the frame: the CPU's difficulty (for the stats) and, where
// the game has one, LightCycles' Full Screen option.
interface MatchSettings {
  cpuDifficulty: CpuDifficulty
  extendIntoSafeArea?: boolean
}

interface MatchScreenProps<S extends MatchSettings> {
  gameId: string
  // What a play screen reached without a committed round (a direct link, a web reload) plays.
  defaults: S
  Round: ComponentType<MatchRoundProps<S>>
  // The game's stats (see shared/duelStats): records one finished round and returns its unlocks.
  recordRoundOutcome: (outcome: RoundOutcome, context: RoundContext) => { device: AchievementDefinition[]; profiles: Partial<Record<Player, AchievementDefinition[]>> }
}

// Every game's play screen: the round the loadout committed (frozen at mount, so a settings change
// mid-match only affects the next match), the board area measured once, the match's record, and
// what a finished round does to the game's stats and the players' unlock toasts. The game's own
// round component runs the game itself, with the shared match flow (useMatchFlow, MatchOverlays).
export function MatchScreen<S extends MatchSettings>({ gameId, defaults, Round, recordRoundOutcome }: MatchScreenProps<S>) {
  // Committed once by the loadout when every human player readied up (see the shell's
  // liveplaySlice.ts and useActiveRound), and frozen here at mount.
  const activeRound = useActiveRound(gameId, defaults)
  const [{ settings, gameMode }] = useState(() => ({ settings: activeRound.settings, gameMode: (activeRound.mode === 'twoPlayer' ? 'twoPlayer' : 'vsCpu') as GameMode }))

  // The board itself always uses the SAME split, regardless of how the phone is physically being
  // held - 'faceToFace' (P1 near/bottom, P2 far/top, moving toward each other along the tall axis),
  // never 'sideBySide'. This isn't a frozen live reading, it's a fixed constant: the render surface
  // is permanently portrait-shaped (the app is portrait-locked at the OS level, and unlike the
  // loadout, the board/touch layer is deliberately never wrapped in FakeLandscapeView - see
  // MatchOverlays' own comment on why that'd risk breaking swipe-to-turn), so it can never actually
  // become wide enough for a genuine left/right split to make sense. p1OnRight is meaningless
  // alongside a permanently-'faceToFace' mode, so it's just a fixed placeholder. The floating
  // dialogs and countdown still turn to match whichever way the phone is actually held (or stay put
  // while Lock Orientation is on): see MatchOverlays.
  const [orientationMode] = useState<OrientationMode>('faceToFace')
  const [p1OnRight] = useState(true)

  const insets = useSafeAreaInsets()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const { gutterWidth } = computeContentBounds(windowWidth, MAX_BOARD_CONTENT_WIDTH)
  const fullBleed = settings.extendIntoSafeArea === true
  // On desktop web the back and settings chips stay up through play, in boardArea's top corners
  // (MatchOverlays), so there boardArea spans the whole safe area (the chips land in the page's own
  // corners, where the loadout's are) and is padded in to the board, which keeps at least a
  // DESKTOP_CHIP_BAND clear down each side for them, taken out of the gutter when the window has one.
  // boardSideInset is how far the board sits from the safe area's side edges (the window's, full
  // bleed); boardPadding is how much of that is boardArea's padding rather than its position.
  const desktopWeb = useDesktopWeb()
  const chipBand = desktopWeb ? DESKTOP_CHIP_BAND : 0
  const boardSideInset = fullBleed ? chipBand : Math.max(gutterWidth, chipBand)
  const boardPadding = desktopWeb ? boardSideInset : 0
  const { colors: themeColors, dark } = useAutoPaperTheme()
  const colors = useMemo<Record<Player, string>>(() => ({ 1: themeColors.primary, 2: themeColors.secondary }), [themeColors.primary, themeColors.secondary])

  // Resolved once at mount from whichever profile each seat had selected, like `settings` above: a
  // saved profile edited or deleted from another still-mounted screen shouldn't alter a round
  // already underway. Seat 2's selection only counts in 2 Player: against the CPU, seat 2 is the CPU
  // (a profile left over from an earlier 2 Player match would otherwise collect the CPU's results).
  const { profiles: savedProfiles, lastSelected } = useProfiles()
  const [profileIds] = useState<Partial<Record<Player, string>>>(() => {
    const ids: Partial<Record<Player, string>> = {}
    if (savedProfiles.some((p) => p.id === lastSelected[1])) ids[1] = lastSelected[1] as string
    if (gameMode !== 'vsCpu' && savedProfiles.some((p) => p.id === lastSelected[2])) ids[2] = lastSelected[2] as string
    return ids
  })
  const [profileNames] = useState<Partial<Record<Player, string>>>(() => {
    const names: Partial<Record<Player, string>> = {}
    const p1 = savedProfiles.find((p) => p.id === lastSelected[1])
    const p2 = gameMode !== 'vsCpu' ? savedProfiles.find((p) => p.id === lastSelected[2]) : undefined
    if (p1) names[1] = p1.name
    if (p2) names[2] = p2.name
    return names
  })

  // Chronological record of each round's outcome this match, oldest first.
  const [roundHistory, setRoundHistory] = useState<RoundOutcome[]>([])
  // Each unlocked achievement gets its own tier-colored, tier-iconed toast, named for its seat's
  // profile (see useUnlockToasts).
  const showUnlockToasts = useUnlockToasts()
  const handleRoundOutcome = useCallback(
    (outcome: RoundOutcome) => {
      setRoundHistory((history) => [...history, outcome])
      const result = recordRoundOutcome(outcome, { gameMode, cpuDifficulty: settings.cpuDifficulty, colors, profileIds })
      // Each human seat's own unlocks plus the device-wide ones that are really that seat's (all of
      // them for a guest, only scope: 'device' ones for a profile; see @tastic/achievements'
      // broadcastDeviceUnlocks). In 2 Player the device-wide ones go to the round's winner only, both
      // seats on a draw (audit F037).
      const winners = gameMode === 'twoPlayer' && outcome.type === 'win' ? [outcome.winner] : undefined
      const seatUnlocks = broadcastDeviceUnlocks(humanPlayersFor(gameMode), result.profiles, result.device, profileIds, { winners })

      if (gameMode === 'vsCpu') {
        // Only seat 1 is human here, so its unlocks go on the app's screen-fixed toast.
        showUnlockToasts(seatUnlocks, SOLO_SEATS, profileNames)
      } else {
        // Both seats are human, face to face, so each seat's go to its own Toaster, in its half of the
        // board and turned to face it (MatchOverlays' SeatToasters), the way its own round card is.
        showUnlockToasts(seatUnlocks, SEATS, profileNames, SEAT_TOAST_STACKS)
      }
    },
    [recordRoundOutcome, gameMode, settings.cpuDifficulty, colors, profileIds, profileNames, showUnlockToasts]
  )

  // The board area's edge IS the wall. Bounded to exactly the safe area by default plus a
  // @tastic/core gutter (gutterWidth above) on anything wider than MAX_BOARD_CONTENT_WIDTH, so the
  // wall always sits somewhere a player can see and reach AND the arena never stretches into an
  // unplayably wide, short rectangle on a maximized desktop-web window; Full Screen (fullBleed)
  // opts into bleeding the board all the way to the physical screen edge instead. This container's
  // own bounds track the window on every render; designSize below is the frozen ONE-TIME
  // measurement the round's grid is built from, while liveWidth/liveHeight (further below) are what
  // the round scales the board to.
  const [designSize, setDesignSize] = useState<{ width: number; height: number } | null>(null)
  const onBoardLayout = useCallback(
    (e: LayoutChangeEvent) => {
      // Captured eagerly, not read off `e` inside the updater below - React can invoke a functional
      // setState updater more than once, and by a second call React Native's synthetic
      // LayoutChangeEvent may already be recycled, leaving e.nativeEvent null.
      // The board gets boardArea's content box: its measured size less the padding.
      const { width, height } = e.nativeEvent.layout
      setDesignSize((prev) => prev ?? { width: width - 2 * boardPadding, height })
    },
    [boardPadding]
  )

  const bg = dark ? '#000000' : '#FFFFFF'

  // The container's LIVE content box, as plain numbers - the same arithmetic boardArea's own style
  // below expresses, computed directly rather than measured by a second onLayout: on react-native-
  // web, onLayout doesn't reliably re-fire on a bare window resize when boardArea's style object
  // never changes (the full-bleed case), so a measured live size could stay stuck.
  const liveWidth = fullBleed ? windowWidth - 2 * boardSideInset : windowWidth - insets.left - insets.right - 2 * boardSideInset
  const liveHeight = fullBleed ? windowHeight : windowHeight - insets.top - insets.bottom
  const safeAreaInsetsPx = fullBleed ? insets : ZERO_INSETS

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* The OS status bar is hidden on the play screen (RootLayout's PLAY_OPTIONS), for the whole
      match, whether or not the board is bleeding under the safe area. */}
      <View style={[styles.boardArea, fullBleed ? styles.boardAreaFullBleed : { top: insets.top, bottom: insets.bottom, left: insets.left + boardSideInset - boardPadding, right: insets.right + boardSideInset - boardPadding }, { paddingHorizontal: boardPadding }]} onLayout={onBoardLayout}>
        {designSize && <Round width={designSize.width} height={designSize.height} liveWidth={liveWidth} liveHeight={liveHeight} safeAreaInsetsPx={safeAreaInsetsPx} settings={settings} gameMode={gameMode} colors={colors} profileNames={profileNames} orientationMode={orientationMode} p1OnRight={p1OnRight} roundHistory={roundHistory} onRoundOutcome={handleRoundOutcome} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // alignItems/justifyContent center the design-resolution board inside these live bounds - the
  // overlays' own children are all position:'absolute', laid out against the padding box, so on
  // desktop web (see boardPadding) they span the whole safe area, the chips in its corners, while the
  // board is centered in the content box between.
  boardArea: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'absolute' },
  boardAreaFullBleed: { bottom: 0, left: 0, right: 0, top: 0 },
  root: { flex: 1 }
})
