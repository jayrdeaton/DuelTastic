import type { GameDefinition } from '@tastic/shell'

import { GameIcon } from './components/GameIcon'
import { getGuideSteps } from './constants/guideSteps'
import PlayScreen from './PlayScreen'
import guide, { GUIDE_VERSION, guideActions, selectGuideVersionSeen } from './redux/guideSlice'
import { playerSettings } from './redux/settingsSlice'
import { trapStats } from './stats'
import type { KeyScheme } from './types'
import { useLoadout } from './useLoadout'

// What Trap's How to Play cards are built from (see getGuideSteps), flat so the guide's
// shallow compare sees no change while neither changes.
interface GuideInput {
  control1: KeyScheme
  control2: KeyScheme
}

export const trap: GameDefinition = {
  id: 'trap',
  title: 'Trap',
  blurb: 'The classic light-trail duel. Box the other rider in.',
  icon: GameIcon,
  seatTwo: ['cpu', 'person'],
  // The board is one tall, fixed split (see MatchScreen), so on a phone or tablet 2 Player is face to
  // face in any window; at a computer the players sit side by side, here and in the match's cards
  // (useAtComputer).
  sideBySideAtComputer: true,
  reducers: { ...playerSettings.reducers, ...trapStats.reducers, trapGuide: guide },
  Provider: trapStats.Provider,
  useLoadout,
  PlayScreen,
  StatsSections: trapStats.StatsSections,
  AchievementList: trapStats.AchievementList,
  resetStats: trapStats.actions.reset,
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
