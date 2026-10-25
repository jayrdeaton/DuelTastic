import type { KeyScheme } from '@/shared/match/types'
import type { GameDefinition } from '@/shell/types'

import { getGuideSteps, GUIDE_VERSION, guideActions, guideReducer, selectGuideVersionSeen } from './guide'
import PlayScreen from './PlayScreen'
import { playerSettings } from './settings'
import { turfStats } from './stats'
import type { TurfCrashRule } from './types'
import { useLoadout } from './useLoadout'

// What Turf's How to Play cards are built from (see getGuideSteps), flat for the guide's shallow
// compare.
interface GuideInput {
  control1: KeyScheme
  control2: KeyScheme
  crash: TurfCrashRule
}

// Turf, DuelTastic's first new game. Its store keys are its own (turfSettings, turfControls,
// turfAchievements, turfGuide).
export const turf: GameDefinition = {
  id: 'turf',
  title: 'Turf',
  blurb: 'Loop out from your ground to claim more. Cut their trail.',
  icon: { light: require('./art/icon-light.png'), dark: require('./art/icon-dark.png') },
  seatTwo: ['cpu', 'person'],
  // The same board as LightCycles' (see MatchScreen): always face to face, never flipped.
  twoPlayerSeats: { faceToFaceOnWeb: true, followUpsideDown: false },
  reducers: { ...playerSettings.reducers, ...turfStats.reducers, turfGuide: guideReducer },
  Provider: turfStats.Provider,
  useLoadout,
  PlayScreen,
  StatsSections: turfStats.StatsSections,
  AchievementList: turfStats.AchievementList,
  resetStats: turfStats.actions.reset,
  guide: {
    version: GUIDE_VERSION,
    selectVersionSeen: (state) => selectGuideVersionSeen(state),
    markSeen: guideActions.markSeen,
    selectInput: (state): GuideInput => {
      const s = playerSettings.select(state)
      return { control1: s.controlScheme[1], control2: s.controlScheme[2], crash: s.crash }
    },
    getSteps: (input, { touch }) => {
      const { control1, control2, crash } = input as GuideInput
      return getGuideSteps({ touch, keys: { 1: control1, 2: control2 }, crash })
    }
  }
}
