import type { GameDefinition } from '@/shell/types'

import { getGuideSteps } from './constants/guideSteps'
import PlayScreen from './PlayScreen'
import guide, { GUIDE_VERSION, guideActions, selectGuideVersionSeen } from './redux/guideSlice'
import { playerSettings } from './redux/settingsSlice'
import { lightCyclesStats } from './stats'
import type { KeyScheme } from './types'
import { useLoadout } from './useLoadout'

// What LightCycles' How to Play cards are built from (see getGuideSteps), flat so the guide's
// shallow compare sees no change while neither changes.
interface GuideInput {
  control1: KeyScheme
  control2: KeyScheme
}

// LightCycles, the game this repo shipped as. Its store keys are its own (lightcyclesSettings,
// lightcyclesControls, lightcyclesAchievements, lightcyclesGuide).
export const lightCycles: GameDefinition = {
  id: 'lightcycles',
  title: 'LightCycles',
  blurb: 'The classic light-trail duel. Box the other rider in.',
  icon: { light: require('./art/icon-light.png'), dark: require('./art/icon-dark.png') },
  seatTwo: ['cpu', 'person'],
  // Always face to face, on the web too: the board is one tall, fixed split (see MatchScreen), and
  // an upside-down hold never swaps who is at the bottom.
  twoPlayerSeats: { faceToFaceOnWeb: true, followUpsideDown: false },
  reducers: { ...playerSettings.reducers, ...lightCyclesStats.reducers, lightcyclesGuide: guide },
  Provider: lightCyclesStats.Provider,
  useLoadout,
  PlayScreen,
  StatsSections: lightCyclesStats.StatsSections,
  AchievementList: lightCyclesStats.AchievementList,
  resetStats: lightCyclesStats.actions.reset,
  guide: {
    version: GUIDE_VERSION,
    selectVersionSeen: (state) => selectGuideVersionSeen(state),
    markSeen: guideActions.markSeen,
    selectInput: (state): GuideInput => {
      const s = playerSettings.select(state)
      return { control1: s.controlScheme[1], control2: s.controlScheme[2] }
    },
    getSteps: (input, { touch }) => {
      const { control1, control2 } = input as GuideInput
      return getGuideSteps({ touch, keys: { 1: control1, 2: control2 } })
    }
  }
}
