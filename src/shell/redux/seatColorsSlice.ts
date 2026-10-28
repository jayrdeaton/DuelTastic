import { createSeatColorsSlice, type SeatColorsState as GenericSeatColorsState } from '@tastic/profile'

import type { Seat } from '@/shell/types'

// The loadout's per-seat color memory: a thin binding over @tastic/profile's createSeatColorsSlice
// (see its doc for each field: a guest seat's last color, the CPU seat's last color, and each
// profile's own color pick in this pack, kept by profile id). One memory for every game in the
// pack, so a player's color follows them from one game to the next.
export type SeatColorsState = GenericSeatColorsState<Seat>

// What a fresh install remembers: each guest seat on its own default color (the pack's seat colors,
// PackDefinition.seatColors) and the CPU on seat 2's.
export function defaultSeatColorsState(seatColors: Record<Seat, string>): SeatColorsState {
  return { lastGuestColor: { 1: seatColors[1], 2: seatColors[2] }, lastCpuColor: seatColors[2], profileColors: {} }
}

// 'pack' only prefixes the action types; the state is stored under seatColors.
export function createSeatColorsReducer(seatColors: Record<Seat, string>) {
  return createSeatColorsSlice<Seat>('pack', defaultSeatColorsState(seatColors)).reducer
}

// The slice's actions match by type alone, so these answer any pack's reducer above. The defaults
// they're built over are never read.
export const seatColorsActions = createSeatColorsSlice<Seat>('pack', defaultSeatColorsState({ 1: '', 2: '' })).actions
