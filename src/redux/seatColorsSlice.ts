import { createSeatColorsSlice, type SeatColorsState as SeatColorsStateGeneric } from '@tastic/profile'

import { DEFAULT_P1_COLOR, DEFAULT_P2_COLOR } from '@/constants/game'
import { Player } from '@/types'

// The loadout's per-seat color memory: a thin binding over @tastic/profile's createSeatColorsSlice
// (see its doc for each field: a guest seat's last color, the CPU seat's last color, and each
// profile's own color pick in LightCycles, kept by profile id). Not a setting: the player's settings
// live in settingsSlice.ts.
export type SeatColorsState = SeatColorsStateGeneric<Player>

export const defaultSeatColorsState: SeatColorsState = {
  lastGuestColor: { 1: DEFAULT_P1_COLOR, 2: DEFAULT_P2_COLOR },
  lastCpuColor: DEFAULT_P2_COLOR,
  profileColors: {}
}

const { actions, reducer } = createSeatColorsSlice<Player>('lightcycles', defaultSeatColorsState)

export const seatColorsActions = actions
export default reducer
