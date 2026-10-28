import { getStaggeredWordDuration, StaggeredWord } from '@tastic/hud'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'

import type { HeroTitleProps } from '@/shell/types'

import { DISPLAY_FONT } from './fonts'
import { TRAIL_CANVAS_PAD, TRAIL_TEXT_MARGIN_BOTTOM, TRAIL_TEXT_MARGIN_TOP, WordBox } from './heroTitleGeometry'
import HeroTitleTrailsHost from './HeroTitleTrailsHost'

const TRAIL_FADE_DURATION_MS = 280

// The second word sits lower than the first and the two words touch with no horizontal gap - a real
// (layout, not transform) offset so onLayout's measured box stays truthful and the trail loops
// actually land where the letters are.
//
// Both words share the same 44px line height, and TRAIL_TEXT_MARGIN_TOP/_BOTTOM (from
// heroTitleGeometry.ts) add themselves to each word's trail loop - with HeroTitleTrails' loop
// corners sharp (no radius, matching the real game's own grid-based trails), each word's straight
// vertical trail edge spans the loop's FULL padded height (44 + TOP + BOTTOM) with nothing carved
// off the ends, so that full height sits dead center on the shared horizontal seam. An offset of
// exactly that padded height makes the two words' trail edges touch at a single
// point (a true kiss, zero gap); px above it is real clearance, px below it is deliberate overlap.
// +1 here leaves the two loops' edges a hairline apart at that point, rather than overlapping -
// combined with HeroTitleTrails' own 3px stroke width this reads as the two strokes passing by
// each other without ever touching: a true near-miss, not the graze a negative value (or a literal
// 0 kiss) produces.
const SECOND_WORD_OFFSET = 44 + TRAIL_TEXT_MARGIN_TOP + TRAIL_TEXT_MARGIN_BOTTOM + 1

// DuelTastic's hero (PackDefinition.HeroTitle, LightCycles' light-trail wordmark): the wordmark's two
// words side by side in the display face, each looped by a light trail in its player's live color
// (the first word's in player 1's, the second's in player 2's) once the letters have landed. The
// trails stop while Home is covered or the app is in the background (`active`).
export function HeroTitle({ words, color, p1Color, p2Color, active }: HeroTitleProps) {
  const [firstWord, secondWord] = words
  // Trails start looping the instant they mount (see HeroTitleTrails) but stay hidden behind this
  // shared fade until the letters are most of the way settled - one "power on" beat once the
  // wordmark has mostly landed, rather than motion competing with letters still flying in.
  const trailFadeDelayMs = Math.round(getStaggeredWordDuration(firstWord.length + secondWord.length) * 0.7)
  const reducedMotion = useReducedMotion()
  const [firstBox, setFirstBox] = useState<WordBox | null>(null)
  const [secondBox, setSecondBox] = useState<WordBox | null>(null)

  const trailOpacity = useSharedValue(reducedMotion ? 1 : 0)
  useEffect(() => {
    if (reducedMotion) return
    trailOpacity.value = withDelay(trailFadeDelayMs, withTiming(1, { duration: TRAIL_FADE_DURATION_MS }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion])
  const trailStyle = useAnimatedStyle(() => ({ opacity: trailOpacity.value }))

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <StaggeredWord word={firstWord} color={color} fontFamily={DISPLAY_FONT} fontSize={36} lineHeight={44} reducedMotion={reducedMotion} startIndex={0} fontWeight='normal' onLayout={(e) => setFirstBox(e.nativeEvent.layout)} />
        <StaggeredWord word={secondWord} color={color} fontFamily={DISPLAY_FONT} fontSize={36} lineHeight={44} reducedMotion={reducedMotion} startIndex={firstWord.length} fontWeight='normal' style={styles.secondWordOffset} onLayout={(e) => setSecondBox(e.nativeEvent.layout)} />
      </View>

      {firstBox && secondBox && (
        <Animated.View pointerEvents='none' style={[styles.canvas, trailStyle]}>
          <HeroTitleTrailsHost firstBox={firstBox} secondBox={secondBox} p1Color={p1Color} p2Color={p2Color} active={active && !reducedMotion} startDelayMs={trailFadeDelayMs} />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: {
    bottom: -TRAIL_CANVAS_PAD,
    left: -TRAIL_CANVAS_PAD,
    position: 'absolute',
    right: -TRAIL_CANVAS_PAD,
    top: -TRAIL_CANVAS_PAD
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row'
  },
  secondWordOffset: {
    marginTop: SECOND_WORD_OFFSET
  },
  wrapper: {}
})
