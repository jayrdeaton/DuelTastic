import { MONO_FONT } from '@tastic/hud'
import { StyleSheet, Text, View } from 'react-native'

import { HeldPowerup } from '@/shared/HeldPowerup'

import { TURF_POWERUP_ICONS } from './constants'
import type { TurfPowerup, TurfSeat } from './types'

export interface TurfHudProps {
  ground: Record<TurfSeat, number>
  totalCells: number
  timeLeftMs: number
  colors: Record<TurfSeat, string>
  // The seats with a person in them: each gets a badge at its own edge of the board, seat 2's turned
  // to face it across the table. Against the CPU only seat 1 has one.
  humanPlayers: TurfSeat[]
  // What each rider is holding, shown while powerups are on: in a person's badge, and on its own at
  // the CPU's edge.
  held: Record<TurfSeat, TurfPowerup | null>
  powerupsOn: boolean
  // MatchScreen's safe-area insets: all zero unless the round plays under them (Full Screen), when each
  // badge moves in by them, clear of the Dynamic Island, notch and home indicator.
  insets: { top: number; bottom: number }
}

// How far each badge sits in from its edge of the board (plus the safe-area insets in Full Screen).
const EDGE_GAP = 8

const SEATS: readonly TurfSeat[] = [1, 2]

// Under 1% reads "<1%", not "0%", which would look like nothing left.
function percent(cells: number, total: number) {
  const share = (cells / total) * 100
  return cells > 0 && share < 0.5 ? '<1%' : `${Math.round(share)}%`
}

function clock(ms: number) {
  const seconds = Math.ceil(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const Held = ({ powerup }: { powerup: TurfPowerup | null }) => <HeldPowerup icon={powerup && TURF_POWERUP_ICONS[powerup]} />

function Badge({ seat, ground, totalCells, timeLeftMs, colors, held, powerupsOn }: Omit<TurfHudProps, 'humanPlayers' | 'insets'> & { seat: TurfSeat }) {
  const them: TurfSeat = seat === 1 ? 2 : 1
  return (
    <View style={styles.badge}>
      {powerupsOn && <Held powerup={held[seat]} />}
      <View style={[styles.dot, { backgroundColor: colors[seat] }]} />
      <Text style={[styles.text, styles.own]}>{percent(ground[seat], totalCells)}</Text>
      <View style={[styles.dot, { backgroundColor: colors[them] }]} />
      <Text style={styles.text}>{percent(ground[them], totalCells)}</Text>
      <Text style={[styles.text, styles.clock]}>{clock(timeLeftMs)}</Text>
    </View>
  )
}

// Each player's share of the board, the other's, the clock and what they're holding, at the
// player's own edge. Drawn over the board but never in the way of a swipe.
export function TurfHud({ humanPlayers, insets, ...rest }: TurfHudProps) {
  return (
    <>
      {SEATS.map((seat) => {
        const human = humanPlayers.includes(seat)
        if (!human && !rest.powerupsOn) return null
        return (
          <View key={seat} pointerEvents='none' style={seat === 1 ? [styles.bottom, { bottom: EDGE_GAP + insets.bottom }] : [styles.top, { top: EDGE_GAP + insets.top }]}>
            {human ? (
              <Badge seat={seat} {...rest} />
            ) : (
              <View style={styles.badge}>
                <View style={[styles.dot, { backgroundColor: rest.colors[seat] }]} />
                <Held powerup={rest.held[seat]} />
              </View>
            )}
          </View>
        )
      })}
    </>
  )
}

const styles = StyleSheet.create({
  // The same translucent chip as Trap's PowerupHud badges.
  badge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 28,
    paddingHorizontal: 10
  },
  bottom: { alignItems: 'center', left: 0, position: 'absolute', right: 0 },
  clock: { marginLeft: 6, opacity: 0.8 },
  dot: { borderRadius: 4, height: 8, width: 8 },
  own: { fontWeight: '700' },
  text: { color: 'rgba(255,255,255,0.9)', fontFamily: MONO_FONT, fontSize: 13 },
  top: { alignItems: 'center', left: 0, position: 'absolute', right: 0, transform: [{ rotate: '180deg' }] }
})
