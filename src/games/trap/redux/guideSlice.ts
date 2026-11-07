import { createGameGuideSlice } from '@tastic/shell'

import { GUIDE_VERSION } from '@/games/trap/constants/guide'

// Which version of Trap's How to Play cards this player has finished or skipped, under its own
// store key. New to everyone in DuelTastic, so a saved store without it reads as not seen (see
// createGameGuideSlice).
const slice = createGameGuideSlice('trapGuide')

export { GUIDE_VERSION }
export const guideActions = slice.actions
export const selectGuideVersionSeen = slice.selectVersionSeen
export default slice.reducer
