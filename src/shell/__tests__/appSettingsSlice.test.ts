import appSettingsReducer, { appSettingsActions, DEFAULT_APP_SETTINGS } from '@/shell/redux/appSettingsSlice'

const REHYDRATE = 'persist/REHYDRATE'

describe("the shell's appSettingsSlice", () => {
  it('starts from the defaults', () => {
    expect(appSettingsReducer(undefined, { type: '@@INIT' })).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('records the locked angle on lock', () => {
    const next = appSettingsReducer(DEFAULT_APP_SETTINGS, appSettingsActions.initialize({ lockOrientation: true, lockedRotation: -90 }))
    expect(next).toEqual({ ...DEFAULT_APP_SETTINGS, lockOrientation: true, lockedRotation: -90 })
  })

  it('clears lockedRotation when unlocking', () => {
    const locked = appSettingsReducer(DEFAULT_APP_SETTINGS, appSettingsActions.initialize({ lockOrientation: true, lockedRotation: 180 }))
    expect(appSettingsReducer(locked, appSettingsActions.initialize({ lockOrientation: false, lockedRotation: undefined })).lockedRotation).toBeUndefined()
  })

  it('fills fields missing from saved app settings with the defaults on rehydrate', () => {
    const next = appSettingsReducer(undefined, { type: REHYDRATE, payload: { appSettings: { lockOrientation: true } } } as { type: string })
    expect(next).toEqual({ ...DEFAULT_APP_SETTINGS, lockOrientation: true })
  })
})
