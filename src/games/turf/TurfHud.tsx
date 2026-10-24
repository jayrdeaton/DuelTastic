import { MONO_FONT } from '@tastic/hud'
import { StyleSheet, Text, View } from 'react-native'

import type { TurfSeat } from './types'

export interface TurfHudProps {
  ground: Record<TurfSeat, number>
  totalCells: number
  timeLeftMs: number
  colors: Record<TurfSeat, string>
  // The seats with a person in them: each gets a badge at its own edge of the board, seat 2's turned
  // to face it across the table. Against the CPU only seat 1 has one.
  humanPlayers: TurfSeat[]
}

const percent = (cells: number, total: number) => `${Math.round((cells / total) * 100)}%`

function clock(ms: number) {
  const seconds = Math.ceil(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function Badge({ seat, ground, totalCells, timeLeftMs, colors }: Omit<TurfHudProps, 'humanPlayers'> & { seat: TurfSeat }) {
  const them: TurfSeat = seat === 1 ? 2 : 1
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: colors[seat] }]} />
      <Text style={[styles.text, styles.own]}>{percent(ground[seat], totalCells)}</Text>
      <View style={[styles.dot, { backgroundColor: colors[them] }]} />
      <Text style={styles.text}>{percent(ground[them], totalCells)}</Text>
      <Text style={[styles.text, styles.clock]}>{clock(timeLeftMs)}</Text>
    </View>
  )
}

// Each player's share of the board, the other's, and the clock, at the player's own edge. Drawn over
// the board but never in the way of a swipe.
export function TurfHud({ humanPlayers, ...rest }: TurfHudProps) {
  return (
    <>
      {humanPlayers.map((seat) => (
        <View key={seat} pointerEvents='none' style={seat === 1 ? styles.bottom : styles.top}>
          <Badge seat={seat} {...rest} />
        </View>
      ))}
    </>
  )
}

const styles = StyleSheet.create({
  // The same translucent chip as LightCycles' PowerupHud badges.
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
  bottom: { alignItems: 'center', bottom: 8, left: 0, position: 'absolute', right: 0 },
  clock: { marginLeft: 6, opacity: 0.8 },
  dot: { borderRadius: 4, height: 8, width: 8 },
  own: { fontWeight: '700' },
  text: { color: 'rgba(255,255,255,0.9)', fontFamily: MONO_FONT, fontSize: 13 },
  top: { alignItems: 'center', left: 0, position: 'absolute', right: 0, top: 8, transform: [{ rotate: '180deg' }] }
})
