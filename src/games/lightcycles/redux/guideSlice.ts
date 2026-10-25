import { GUIDE_VERSION } from '@/games/lightcycles/constants/guide'
import { createGameGuideSlice } from '@/shell/redux/gameGuideSlice'

// Which version of LightCycles' How to Play cards this player has finished or skipped, under its own
// store key. New to everyone in DuelTastic, so a saved store without it reads as not seen (see
// createGameGuideSlice).
const slice = createGameGuideSlice('lightcyclesGuide')

export { GUIDE_VERSION }
export const guideActions = slice.actions
export const selectGuideVersionSeen = slice.selectVersionSeen
export default slice.reducer
