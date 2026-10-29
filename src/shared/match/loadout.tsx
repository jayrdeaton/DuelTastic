import { IconButton } from '@rific/feedback-press'
import { useIsTouchPrimaryDevice } from '@tastic/core'
import { type MenuOption, type PopoverHost, SectionedDropdown } from '@tastic/hud'
import { assignSeatScheme } from '@tastic/input'
import type { SeatControlLook } from '@tastic/shell'
import { type ReactNode, useCallback } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import type { CpuDifficulty, GridSizeTier, KeyScheme, Player, SpeedTier } from '@/shared/match/types'

// The loadout pieces every game in the pack shares: the grid size, speed, CPU and controls menus
// (each game also has its own rows), the row they sit in, and each seat's controls picker.

// Small -> large vehicles, echoing the riders' own theme rather than a generic S/M/L badge. MDI's
// name for the first is 'motorbike', not 'motorcycle'.
export const GRID_SIZE_OPTIONS: MenuOption<GridSizeTier>[] = [
  { value: 'small', label: 'Small', icon: 'motorbike' },
  { value: 'medium', label: 'Medium', icon: 'car' },
  { value: 'large', label: 'Large', icon: 'train' }
]

export const SPEED_OPTIONS: MenuOption<SpeedTier>[] = [
  { value: 'slow', label: 'Slow', icon: 'snail' },
  { value: 'normal', label: 'Normal', icon: 'tortoise' },
  { value: 'fast', label: 'Fast', icon: 'rabbit' }
]

// Computer-flavored escalation instead of a plain skill-level label - "Drone" (a simple, disposable
// program), "Bot" (a real opponent), "Mainframe" (the big machine running the grid, the final boss).
// "Mainframe" replaced "MCP" (Tron's Master Control Program) on 2026-10-14 to keep Tron references
// out of the shipped app. Display only: the saved value stays easy/normal/hard.
export const CPU_DIFFICULTY_OPTIONS: MenuOption<CpuDifficulty>[] = [
  { value: 'easy', label: 'Drone', icon: 'emoticon-happy-outline' },
  { value: 'normal', label: 'Bot', icon: 'emoticon-neutral-outline' },
  { value: 'hard', label: 'Mainframe', icon: 'emoticon-devil-outline' }
]

// Each label also names the scheme's powerup key (ACTIVATE_KEYS in constants.ts), which nothing
// else on screen says. Every game gets every scheme: removing one players already use is a
// regression (Jay).
export const KEY_SCHEME_OPTIONS: MenuOption<KeyScheme>[] = [
  { value: 'mouse', label: 'Mouse+Click' },
  { value: 'wasd', label: 'WASD+Q' },
  { value: 'arrows', label: 'Arrows+Space' },
  { value: 'ijkl', label: 'IJKL+U' },
  { value: 'numpad', label: 'Numpad+Enter' }
]

// In menu order, for the shared playerSettings' distinctControls: two seats can't share a key
// cluster, so a saved clash moves seat 2 to the next free one for the match.
export const KEY_SCHEMES: readonly KeyScheme[] = KEY_SCHEME_OPTIONS.map((o) => o.value)

export function pickRandom<T>(options: readonly { value: T }[]): T {
  return options[Math.floor(Math.random() * options.length)].value
}

interface LoadoutOptionsRowProps {
  // The row's own popover ids (GameLoadout.optionIds), to elevate it while one of them is open.
  ids: readonly string[]
  host: PopoverHost
  // Both one-shot actions on the match settings as a whole, in their own row above the menus.
  // Undefined while the loadout folds them into its shared action band instead.
  onRandomize?: () => void
  onReset?: () => void
  dark: boolean
  // The game's menus (SectionedDropdowns on `host`).
  children: ReactNode
}

// A game's match-options row in the loadout: randomize/reset, then its menus, wrapping onto a second
// centered line on a narrow screen.
export function LoadoutOptionsRow({ ids, host, onRandomize, onReset, dark, children }: LoadoutOptionsRowProps) {
  // Elevated only for one of its own popovers: on a shared host (one human) the seat panels' popovers
  // are on the same host, and elevating for those too would let DOM order decide which paints on top.
  const ownPopoverOpen = host.openId !== null && ids.includes(host.openId)
  const fg = dark ? '#FFFFFF' : '#000000'
  return (
    <View style={[styles.container, ownPopoverOpen && styles.containerOpen]}>
      {onRandomize && onReset && (
        <View style={styles.actionsRow}>
          <IconButton icon='dice-multiple' iconColor={fg} size={18} onPress={onRandomize} accessibilityLabel='Randomize match settings' />
          <IconButton icon='restore' iconColor={fg} size={18} onPress={onReset} accessibilityLabel='Reset match settings to defaults' />
        </View>
      )}
      <View style={styles.row}>{children}</View>
    </View>
  )
}

// A person's controls picker on desktop web (the mouse or a key cluster), for GameLoadout's
// seatControl: nothing on a touch-first device, where swiping is the only control. Picking the other
// seat's scheme hands it this seat's old one (@tastic/input's assignSeatScheme), and in 2 Player the
// other seat's own is shown taken.
export function useKeySchemeControl(controlScheme: Record<Player, KeyScheme>, setControlScheme: (next: Record<Player, KeyScheme>) => void, p2IsHuman: boolean) {
  const isTouchPrimary = useIsTouchPrimaryDevice()
  const show = Platform.OS === 'web' && !isTouchPrimary
  return useCallback(
    (seat: Player, host: PopoverHost, { seatColor, mutedColor, dark, rotation }: SeatControlLook) => {
      if (!show) return undefined
      const other: Player = seat === 1 ? 2 : 1
      return <SectionedDropdown id={`p${seat}-control`} host={host} icon='keyboard-outline' accessibilityLabel='Control scheme' sections={[{ kind: 'single', id: 'controls', options: KEY_SCHEME_OPTIONS, value: controlScheme[seat], onChange: (scheme: KeyScheme) => setControlScheme(assignSeatScheme(controlScheme, seat, scheme)), takenValue: p2IsHuman ? controlScheme[other] : undefined }]} accentColor={seatColor} mutedColor={mutedColor} dark={dark} rotation={rotation} />
    },
    [show, controlScheme, setControlScheme, p2IsHuman]
  )
}

const styles = StyleSheet.create({
  // Small, secondary-weight (size 18 vs. the menus' own icon size) so Randomize/Reset read as quick
  // actions on the settings below rather than one more setting.
  actionsRow: {
    flexDirection: 'row',
    gap: 12
  },
  container: {
    alignItems: 'center',
    gap: 4
  },
  // A popover escaping the row needs this wrapper elevated, not just the popover content, to paint
  // above a later sibling panel (each View is its own stacking context on the web).
  containerOpen: {
    zIndex: 100
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    // A narrow device drops the last menus to a second centered line instead of off the edge.
    flexWrap: 'wrap',
    // Room for each menu's TriggerGauge arc to breathe against its neighbors.
    gap: 20,
    justifyContent: 'center'
  }
})
