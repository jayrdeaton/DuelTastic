import { seatsSideBySide, seatToastSpots } from '@/shared/match/seatToastSpots'

// Where each 2 Player seat's countdown, round card and unlock toasts go: on a device, the seat's own half of the always face-to-face board
// (player 1 the bottom, player 2 the top), turned the way they read it; at a computer, side by side, left and right, both upright.
describe('seatsSideBySide', () => {
  it('seats players side by side at a computer, or in a browser window wider than tall', () => {
    expect(seatsSideBySide('faceToFace', true, true)).toBe(true)
    expect(seatsSideBySide('sideBySide', false, true)).toBe(true)
    expect(seatsSideBySide('faceToFace', false, true)).toBe(false)
  })

  it("keeps a device's players at the board's two ends whatever the window's shape", () => {
    // A landscape iPad: the board and its touch zones are still face to face.
    expect(seatsSideBySide('sideBySide', false, false)).toBe(false)
    expect(seatsSideBySide('faceToFace', false, false)).toBe(false)
  })
})

describe('seatToastSpots', () => {
  it('turns player 2 across the table face to face', () => {
    expect(seatToastSpots(false, 'faceToFace', true)).toEqual({ 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } })
  })

  it('splits side by side left and right, both upright, player 1 on the left at WASD', () => {
    expect(seatToastSpots(true, 'faceToFace', true)).toEqual({ 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } })
  })
})
