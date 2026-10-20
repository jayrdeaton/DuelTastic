import { fireEvent, render, screen, within } from '@testing-library/react-native'

import RoundOverDialog from '@/components/RoundOverDialog'
import type { Player } from '@/types'

jest.mock('@rific/auto-paper', () => {
  const { View: MockView } = require('react-native')
  return {
    // @tastic/hud's OverlayCard draws on auto-paper's BlurView (style forwarded, so a card's rotation can be read) and reads Blur with useBlur.
    BlurView: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => <MockView style={style}>{children}</MockView>,
    useAutoPaperTheme: () => ({ dark: false, colors: { onPrimary: '#FFFFFF', onSecondary: '#FFFFFF' } }),
    useBlur: () => false
  }
})

jest.mock('@rific/feedback-press', () => {
  const { Pressable, Text: MockText } = require('react-native')
  return {
    Button: ({ children, disabled, onPress }: { children: string; disabled?: boolean; onPress: () => void }) => (
      <Pressable disabled={disabled} onPress={onPress}>
        <MockText>{children}</MockText>
      </Pressable>
    )
  }
})

const COLORS: Record<Player, string> = { 1: '#2196f3', 2: '#f44336' }
const FACE_TO_FACE = { 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } } as const
const SIDE_BY_SIDE = { 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } } as const

const renderCards = async (props: Partial<Parameters<typeof RoundOverDialog>[0]> = {}) => {
  const onRequestRematch = jest.fn()
  const onQuit = jest.fn()
  await render(<RoundOverDialog orientationMode='faceToFace' p1OnRight={false} rotation={0} humanPlayers={[1, 2]} gameMode='twoPlayer' outcome={{ type: 'win', winner: 1 }} colors={COLORS} rematchReady={{ 1: false, 2: false }} onRequestRematch={onRequestRematch} onQuit={onQuit} {...props} />)
  return { onQuit, onRequestRematch }
}

const flatStyle = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean))
// The nearest view laying its children out in a row: hud's action row, for a card's buttons.
const rowOf = (el: { parent: unknown }) => {
  let node = el.parent as { parent: unknown; props?: { style?: unknown } } | null
  while (node && flatStyle(node.props?.style).flexDirection !== 'row') node = node.parent as typeof node
  return node
}
const zoneStyle = (player: Player) => flatStyle(screen.getByTestId(`round-over-${player}`).props.style)
const cardRotation = (player: Player) => flatStyle((screen.getByTestId(`round-over-${player}`).children[0] as unknown as { props: { style: unknown } }).props.style).transform?.[0]?.rotate ?? '0deg'

describe('RoundOverDialog 2 Player cards', () => {
  it("puts each player's Quit and Play Again side by side on hud's action row, Quit first", async () => {
    await renderCards()
    for (const player of [1, 2] as const) {
      const card = within(screen.getByTestId(`round-over-${player}`))
      const row = rowOf(card.getByText('Quit'))
      expect(row).not.toBeNull()
      expect(rowOf(card.getByText('Play Again'))).toBe(row)
    }
  })

  it("asks for a rematch from that player's Play Again, and shows Waiting… once they have", async () => {
    const { onRequestRematch } = await renderCards({ rematchReady: { 1: false, 2: true } })
    await fireEvent.press(within(screen.getByTestId('round-over-1')).getByText('Play Again'))
    expect(onRequestRematch).toHaveBeenCalledWith(1)
    expect(within(screen.getByTestId('round-over-2')).getByText('Waiting…')).toBeTruthy()
  })

  it("puts each card in its player's half from the spots it's given: face to face, player 2 turned", async () => {
    await renderCards({ seatSpots: FACE_TO_FACE })
    expect(zoneStyle(1)).toMatchObject({ top: '50%' })
    expect(zoneStyle(2)).toMatchObject({ bottom: '50%' })
    expect(cardRotation(1)).toBe('0deg')
    expect(cardRotation(2)).toBe('180deg')
  })

  it('sets the cards side by side, both upright, at a computer', async () => {
    await renderCards({ seatSpots: SIDE_BY_SIDE })
    expect(zoneStyle(1)).toMatchObject({ right: '50%' })
    expect(zoneStyle(2)).toMatchObject({ left: '50%' })
    expect(cardRotation(1)).toBe('0deg')
    expect(cardRotation(2)).toBe('0deg')
  })

  it('puts Quit and Play Again side by side on the Vs CPU card too', async () => {
    await renderCards({ humanPlayers: [1], gameMode: 'vsCpu' })
    const row = rowOf(screen.getByText('Quit'))
    expect(row).not.toBeNull()
    expect(rowOf(screen.getByText('Play Again'))).toBe(row)
  })
})
