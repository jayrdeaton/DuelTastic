import { Platform, useWindowDimensions } from 'react-native'

import { DESKTOP_WEB_MIN_WIDTH } from '@/shared/match/constants'

// A web window at least DESKTOP_WEB_MIN_WIDTH wide. There the back and settings chips stay up in the
// page's top corners for the whole match (useMatchFlow's controlsVisible), and MatchScreen keeps at
// least a DESKTOP_CHIP_BAND clear down each side of the board for them.
export function useDesktopWeb(): boolean {
  const { width } = useWindowDimensions()
  return Platform.OS === 'web' && width >= DESKTOP_WEB_MIN_WIDTH
}
