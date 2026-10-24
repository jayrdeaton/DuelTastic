import { MONO_FONT } from '@tastic/hud'
import { StyleSheet, Text, View } from 'react-native'

import type { TagRule, TagSeat } from './types'

export interface TagHudProps {
  it: TagSeat
  // Ticks each seat has spent as It, and how long a tick is, for Least Time It's running totals.
  itTicks: Record<TagSeat, number>
  intervalMs: number
  rule: TagRule
  timeLeftMs: number
  colors: Record<TagSeat, string>
  // The seats with a person in them: each gets a badge at its own edge of the board, seat 2's turned
  // to face it across the table. Against the CPU only seat 1 has one.
  humanPlayers: TagSeat[]
}

function clock(ms: number) {
  const seconds = Math.ceil(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function Badge({ seat, it, itTicks, intervalMs, rule, timeLeftMs, colors }: Omit<TagHudProps, 'humanPlayers'> & { seat: TagSeat }) {
  const them: TagSeat = seat === 1 ? 2 : 1
  const seconds = (s: TagSeat) => `${Math.round((itTicks[s] * intervalMs) / 1000)}s`
  const isIt = seat === it
  return (
    <View style={styles.badge}>
      <View style={[styles.status, isIt && { backgroundColor: colors[seat] }]}>
        <Text style={[styles.text, styles.statusText]}>{isIt ? 'IT' : 'RUN'}</Text>
      </View>
      {rule === 'leastIt' && (
        <>
          <View style={[styles.dot, { backgroundColor: colors[seat] }]} />
          <Text style={[styles.text, styles.own]}>{seconds(seat)}</Text>
          <View style={[styles.dot, { backgroundColor: colors[them] }]} />
          <Text style={styles.text}>{seconds(them)}</Text>
        </>
      )}
      <Text style={[styles.text, styles.clock]}>{clock(timeLeftMs)}</Text>
    </View>
  )
}

// Whether each player is It or running, the clock, and on Least Time It each one's time as It, at the
// player's own edge. Drawn over the board but never in the way of a swipe.
export function TagHud({ humanPlayers, ...rest }: TagHudProps) {
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
  // The same translucent chip as Turf's and LightCycles' badges.
  badge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    height: 28,
    paddingLeft: 4,
    paddingRight: 10
  },
  bottom: { alignItems: 'center', bottom: 8, left: 0, position: 'absolute', right: 0 },
  clock: { marginLeft: 4, opacity: 0.8 },
  dot: { borderRadius: 4, height: 8, width: 8 },
  own: { fontWeight: '700' },
  // "IT" fills with the player's color; "RUN" sits on the badge's own background.
  status: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.3)', borderRadius: 10, borderWidth: 1, height: 20, justifyContent: 'center', minWidth: 40, paddingHorizontal: 6 },
  statusText: { fontWeight: '700' },
  text: { color: 'rgba(255,255,255,0.9)', fontFamily: MONO_FONT, fontSize: 13 },
  top: { alignItems: 'center', left: 0, position: 'absolute', right: 0, top: 8, transform: [{ rotate: '180deg' }] }
})
