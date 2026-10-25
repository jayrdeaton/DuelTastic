import { selectGuideVersionSeen as selectLightCyclesGuide } from '@/games/lightcycles/redux/guideSlice'
import { DEFAULT_SETTINGS, playerSettings } from '@/games/lightcycles/redux/settingsSlice'
import { selectGuideVersionSeen as selectTagGuide } from '@/games/tag/guide'
import { selectGuideVersionSeen as selectTurfGuide } from '@/games/turf/guide'

type StoreModule = typeof import('@/pack')
type AsyncStorageModule = typeof import('@react-native-async-storage/async-storage')
type AsyncStorage = AsyncStorageModule['default']

// redux-persist keeps each slice as its own JSON string inside the root blob.
const rootBlob = (slices: Record<string, unknown>) => JSON.stringify(Object.fromEntries([...Object.entries(slices), ['_persist', { version: -1, rehydrated: true }]].map(([key, value]) => [key, JSON.stringify(value)])))

// The real pack store (pack.ts), loaded fresh against the in-memory AsyncStorage mock, so this
// checks the key the actual persistConfig reads and writes, not a copy of the config.
async function launch(items: Record<string, string>) {
  let loaded: StoreModule | undefined
  let storage: AsyncStorage | undefined
  jest.isolateModules(() => {
    // The official mock is a plain CommonJS object (module.exports = the mock), with no `default`.
    storage = require('@react-native-async-storage/async-storage') as AsyncStorage
    // Its multiSet writes before its first await, so storage is seeded before the store reads it.
    void storage.multiSet(Object.entries(items))
    loaded = require('@/pack') as StoreModule
  })
  const { persistor, store } = loaded as StoreModule
  await new Promise<void>((resolve) => {
    if (persistor.getState().bootstrapped) resolve()
    else persistor.subscribe(() => persistor.getState().bootstrapped && resolve())
  })
  // Drains redux-persist's write queue, so the root blob is written and no timer outlives the test.
  await persistor.flush()
  return { store, storage: storage as AsyncStorage }
}

const root = (state: unknown) => state as Record<string, unknown>

// On the web every Tastic game shares games.infinitetoken.com's localStorage, where redux-persist's
// default prefix would make this pack's state the same persist:root every game writes.
describe("the pack store's storage key", () => {
  it('writes its state under its own prefix, dueltastic:root, and nothing else', async () => {
    const { storage } = await launch({})

    expect(await storage.getAllKeys()).toEqual(['dueltastic:root'])
  })

  it('reads its state back from dueltastic:root on the next launch', async () => {
    const { store } = await launch({ 'dueltastic:root': rootBlob({ turfGuide: { versionSeen: 1 }, opponent: { seatTwo: 'person' } }) })

    expect(selectTurfGuide(store.getState())).toBe(1)
    expect(store.getState().opponent).toEqual({ seatTwo: 'person' })
  })

  // LightCycles' own save, from before the pack, is left where it is and never read.
  it('leaves a LightCycles save under lightcycles:root unread and in place', async () => {
    const oldSave = rootBlob({ guide: { versionSeen: 1 }, settings: { gameMode: 'twoPlayer', lockOrientation: true, speedTier: 'fast' } })
    const { storage, store } = await launch({ 'lightcycles:root': oldSave })
    const state = store.getState()

    expect(selectLightCyclesGuide(state)).toBe(0)
    expect(state.appSettings.lockOrientation).toBe(false)
    expect(playerSettings.select(state)).toEqual(DEFAULT_SETTINGS)
    expect(await storage.getItem('lightcycles:root')).toBe(oldSave)
  })

  it('starts a fresh install with the CPU in seat 2 and every game unseen', async () => {
    const { store } = await launch({})
    const state = store.getState()

    expect(state.opponent).toEqual({ seatTwo: 'cpu' })
    expect([selectLightCyclesGuide(state), selectTurfGuide(state), selectTagGuide(state)]).toEqual([0, 0, 0])
  })

  it("mounts each game's own keys beside the shell's", async () => {
    const { store } = await launch({})
    const keys = Object.keys(root(store.getState()))

    for (const id of ['lightcycles', 'turf', 'tag']) expect(keys).toEqual(expect.arrayContaining([`${id}Settings`, `${id}Controls`, `${id}Achievements`, `${id}Guide`]))
    expect(keys).toEqual(expect.arrayContaining(['theme', 'haptic', 'sound', 'keepAwake', 'profiles', 'profileSelection', 'seatColors', 'appSettings', 'opponent', 'liveplay']))
  })
})
