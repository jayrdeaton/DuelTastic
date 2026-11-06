import { seatToastSpots } from '@/shared/match/seatToastSpots'

// Where each 2 Player seat's countdown, round card and unlock toasts go: on a phone, the seat's own half of the always face-to-face board
// (player 1 the bottom, player 2 the top), turned the way they read it; at a computer, side by side, left and right, both upright.
describe('seatToastSpots', () => {
  const portrait = { orientationMode: 'faceToFace' as const, p1OnRight: false, upsideDown: false }

  it('turns player 2 across the table face to face', () => {
    expect(seatToastSpots(portrait, false, 'faceToFace', true, false)).toEqual({ 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } })
    // The halves are fixed, so a portrait upside-down reading turns nothing (see @tastic/core's getFixedZoneRotation).
    expect(seatToastSpots({ ...portrait, upsideDown: true }, false, 'faceToFace', true, false)).toEqual({ 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } })
  })

  it('turns nothing a quarter for a wide window on native: the halves stay face to face', () => {
    // Since @tastic/core 0.15 the reading is the window's shape, and nothing is drawn turned (getFixedZoneRotation is always 0).
    const faceToFace = { 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } }
    expect(seatToastSpots({ orientationMode: 'sideBySide', p1OnRight: true, upsideDown: false }, false, 'faceToFace', true, false)).toEqual(faceToFace)
    expect(seatToastSpots({ orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false }, false, 'faceToFace', true, false)).toEqual(faceToFace)
  })

  it('splits a computer screen, or a browser window wider than tall, left and right, both upright', () => {
    // On the web the reading has player 1 on the left (p1OnRight false), at WASD; player 2 on the right, at the arrow keys.
    const sideBySide = { 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } }
    expect(seatToastSpots(portrait, true, 'faceToFace', true, true)).toEqual(sideBySide)
    expect(seatToastSpots({ orientationMode: 'sideBySide', p1OnRight: false, upsideDown: false }, false, 'faceToFace', true, true)).toEqual(sideBySide)
  })
})
