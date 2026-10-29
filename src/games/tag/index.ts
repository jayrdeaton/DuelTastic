import { type GameDefinition, imageGameIcon } from '@tastic/shell'

import type { KeyScheme } from '@/shared/match/types'

import { getGuideSteps, GUIDE_VERSION, guideActions, guideReducer, selectGuideVersionSeen } from './guide'
import PlayScreen from './PlayScreen'
import { playerSettings } from './settings'
import { tagStats } from './stats'
import type { TagRule } from './types'
import { useLoadout } from './useLoadout'

// What Tag's How to Play cards are built from (see getGuideSteps), flat for the guide's shallow
// compare.
interface GuideInput {
  control1: KeyScheme
  control2: KeyScheme
  rule: TagRule
}

// Tag, DuelTastic's second new game. Its store keys are its own (tagSettings, tagControls,
// tagAchievements, tagGuide).
export const tag: GameDefinition = {
  id: 'tag',
  title: 'Tag',
  blurb: 'The playground classic. Catch the other rider, then run.',
  icon: imageGameIcon({ light: require('./art/icon-light.png'), dark: require('./art/icon-dark.png') }),
  seatTwo: ['cpu', 'person'],
  // The same board as LightCycles' (see MatchScreen): always face to face, never flipped.
  twoPlayerSeats: { faceToFaceOnWeb: true, followUpsideDown: false },
  reducers: { ...playerSettings.reducers, ...tagStats.reducers, tagGuide: guideReducer },
  Provider: tagStats.Provider,
  useLoadout,
  PlayScreen,
  StatsSections: tagStats.StatsSections,
  AchievementList: tagStats.AchievementList,
  resetStats: tagStats.actions.reset,
  guide: {
    version: GUIDE_VERSION,
    selectVersionSeen: (state) => selectGuideVersionSeen(state),
    markSeen: guideActions.markSeen,
    selectInput: (state): GuideInput => {
      const s = playerSettings.select(state)
      return { control1: s.controlScheme[1], control2: s.controlScheme[2], rule: s.rule }
    },
    getSteps: (input, { touch }) => {
      const { control1, control2, rule } = input as GuideInput
      return getGuideSteps({ touch, keys: { 1: control1, 2: control2 }, rule })
    }
  }
}
