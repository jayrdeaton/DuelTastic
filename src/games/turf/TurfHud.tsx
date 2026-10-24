import { MONO_FONT } from '@tastic/hud'
import { StyleSheet, Text, View } from 'react-native'
import { Icon } from 'react-native-paper'

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
}

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

// The held powerup's icon, or an empty slot, so the badge doesn't change size when one's picked up.
function Held({ powerup }: { powerup: TurfPowerup | null }) {
  return <View style={styles.held}>{powerup && <Icon source={TURF_POWERUP_ICONS[powerup]} size={14} color='rgba(255,255,255,0.9)' />}</View>
}

function Badge({ seat, ground, totalCells, timeLeftMs, colors, held, powerupsOn }: Omit<TurfHudProps, 'humanPlayers'> & { seat: TurfSeat }) {
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
export function TurfHud({ humanPlayers, ...rest }: TurfHudProps) {
  return (
    <>
      {SEATS.map((seat) => {
        const human = humanPlayers.includes(seat)
        if (!human && !rest.powerupsOn) return null
        return (
          <View key={seat} pointerEvents='none' style={seat === 1 ? styles.bottom : styles.top}>
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
  held: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.3)', borderRadius: 10, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 },
  own: { fontWeight: '700' },
  text: { color: 'rgba(255,255,255,0.9)', fontFamily: MONO_FONT, fontSize: 13 },
  top: { alignItems: 'center', left: 0, position: 'absolute', right: 0, top: 8, transform: [{ rotate: '180deg' }] }
})
