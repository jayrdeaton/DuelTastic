import { seatToastSpots } from '@/games/snake/utils/seatToastSpots'

// Where each 2 Player seat's unlock toasts go: the half of the screen that's theirs (useSeatSplit's, the window's shape), turned the way they
// read it.
describe('seatToastSpots', () => {
  it('puts each player at their own end in a tall window, snake 2 turned across the table', () => {
    expect(seatToastSpots({ orientationMode: 'faceToFace', p1OnRight: false })).toEqual({ 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } })
  })

  it('splits a wide window left and right, both upright, by p1OnRight', () => {
    expect(seatToastSpots({ orientationMode: 'sideBySide', p1OnRight: false })).toEqual({ 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } })
    expect(seatToastSpots({ orientationMode: 'sideBySide', p1OnRight: true })).toEqual({ 1: { rotation: 0, zone: 'right' }, 2: { rotation: 0, zone: 'left' } })
  })
})
