import { router } from 'expo-router'
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { useEffect, useState } from 'react'
import { BackHandler, Pressable, Text, View } from 'react-native'

import type { GamePhase, RoundOutcome } from '@/shared/match/types'
import { useMatchControls } from '@/shared/match/useMatchFlow'

// useMatchControls' back wiring under expo-router's real in-memory router (the app's own expo-router
// mock stands in for it everywhere else). Its first version stubbed usePreventRemove, which is why
// nothing caught Quit doing nothing mid-match (2026-11-06). The block itself is @tastic/shell's
// useBackBlock since 2026-11-12, tested in the shell; this pins when a round screen holds the route.
jest.unmock('expo-router')

// Android's back, as the router's container hears it: React Native's BackHandler is a no-op off
// Android, so this keeps every listener and calls them the way the OS does (the newest first, until
// one handles it).
type BackListener = Parameters<typeof BackHandler.addEventListener>[1]
const backListeners: BackListener[] = []
jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
  backListeners.push(handler)
  return { remove: () => backListeners.splice(backListeners.indexOf(handler), 1) }
})
async function pressAndroidBack() {
  await act(async () => {
    for (const handler of [...backListeners].reverse()) if (handler({} as Parameters<BackListener>[0])) return
  })
}

const PLAYED: RoundOutcome[] = [{ type: 'draw' }]
let mockFirstPhase: GamePhase = 'playing'

// A round screen's back wiring in miniature: the real useMatchControls with a round already played,
// told the phase the way useMatchFlow tells it (in an effect, after the render that changed it), the
// back chip, Quit Match? and its Quit, and buttons standing in for the round ending and the next one
// starting.
function RoundScreen() {
  const [phase, setPhase] = useState<GamePhase>(mockFirstPhase)
  const { trackPhase, requestBack, confirmVisible, quit } = useMatchControls(PLAYED)
  useEffect(() => {
    trackPhase(phase)
  }, [phase, trackPhase])
  return (
    <View>
      <Pressable accessibilityLabel='Round Over' onPress={() => setPhase('roundOver')} />
      <Pressable accessibilityLabel='Next Round' onPress={() => setPhase('onboarding')} />
      <Pressable accessibilityLabel='Back' onPress={requestBack} />
      {confirmVisible && (
        <View>
          <Text>Quit Match?</Text>
          <Pressable accessibilityLabel='Quit' onPress={quit} />
        </View>
      )}
    </View>
  )
}

async function openRound(phase: GamePhase) {
  mockFirstPhase = phase
  const rendered = await renderRouter({ index: () => <Text>Loadout</Text>, 'play/[game]': RoundScreen }, { initialUrl: '/' })
  await act(async () => router.push('/play/lightcycles'))
  expect(rendered.getPathname()).toBe('/play/lightcycles')
  return rendered
}

const press = (label: string) => fireEvent.press(screen.getByLabelText(label))

let warn: jest.SpyInstance
let error: jest.SpyInstance
beforeEach(() => {
  backListeners.length = 0
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  error = jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  // expo-router warns when a stopped navigation is carried on with the block still on.
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  warn.mockRestore()
  error.mockRestore()
})

describe('backing out mid-round', () => {
  it("opens Quit Match? on Android's back and stays", async () => {
    const rendered = await openRound('playing')
    await pressAndroidBack()
    expect(screen.getByText('Quit Match?')).toBeTruthy()
    expect(rendered.getPathname()).toBe('/play/lightcycles')
  })

  it("opens Quit Match? on the router's back, which the browser's back goes through", async () => {
    const rendered = await openRound('playing')
    await act(async () => router.back())
    expect(screen.getByText('Quit Match?')).toBeTruthy()
    expect(rendered.getPathname()).toBe('/play/lightcycles')
  })

  it.each([
    ['the back chip', () => press('Back')],
    ["Android's back", pressAndroidBack]
  ])('still leaves on Quit, past the block (Quit Match? opened by %s)', async (_name, open) => {
    const rendered = await openRound('playing')
    await open()
    await press('Quit')
    expect(rendered.getPathname()).toBe('/')
    expect(screen.getByText('Loadout')).toBeTruthy()
  })
})

describe('backing out around the end of a round', () => {
  it.each([
    ["Android's back", pressAndroidBack],
    ['the back chip', () => press('Back')]
  ])('leaves without asking once the round is over (%s)', async (_name, back) => {
    const rendered = await openRound('playing')
    await press('Round Over')
    await back()
    expect(screen.queryByText('Quit Match?')).toBeNull()
    expect(rendered.getPathname()).toBe('/')
  })

  it('asks again once the next round starts', async () => {
    const rendered = await openRound('roundOver')
    await press('Next Round')
    await pressAndroidBack()
    expect(screen.getByText('Quit Match?')).toBeTruthy()
    expect(rendered.getPathname()).toBe('/play/lightcycles')
  })
})
