import { useAutoPaperTheme } from '@rific/auto-paper'
import { StyleSheet, View } from 'react-native'
import { Icon } from 'react-native-paper'

// Turf's picture for its How to Play cards: player 1's ground (a filled square), the trail looping
// out from it and back, and the rider's head on its way home. Plain Views, like LightCycles' own
// GuideArt, so it costs nothing to mount over Home. Colored from the live theme (primary = P1).
export function GuideTurfClaim() {
  const { colors } = useAutoPaperTheme()
  return (
    <View accessible accessibilityLabel='A trail looping out from a square of ground and back' style={styles.stage}>
      <View style={[styles.ground, { backgroundColor: colors.primary }]} />
      <View style={[styles.trailUp, { backgroundColor: colors.primary }]} />
      <View style={[styles.trailAcross, { backgroundColor: colors.primary }]} />
      <View style={[styles.trailDown, { backgroundColor: colors.primary }]} />
      <View style={[styles.head, { backgroundColor: colors.primary }]} />
    </View>
  )
}

// Player 1 riding into player 2's trail while player 2 is out on it: the cut.
export function GuideTurfCut() {
  const { colors } = useAutoPaperTheme()
  return (
    <View accessible accessibilityLabel="A rider cutting the other rider's trail" style={styles.stage}>
      <View style={[styles.cutGround, { backgroundColor: colors.secondary }]} />
      <View style={[styles.cutTrail, { backgroundColor: colors.secondary }]} />
      <View style={[styles.cutHead, { backgroundColor: colors.secondary }]} />
      <View style={[styles.cutterTrail, { backgroundColor: colors.primary }]} />
      <View style={styles.cut}>
        <Icon source='close-thick' size={30} color={colors.error} />
      </View>
    </View>
  )
}

const TRAIL = 6

const styles = StyleSheet.create({
  cut: {
    left: 63,
    position: 'absolute',
    top: 38
  },
  cutGround: {
    borderRadius: 4,
    height: 36,
    left: 8,
    opacity: 0.45,
    position: 'absolute',
    top: 36,
    width: 30
  },
  cutHead: {
    borderRadius: 7,
    height: 14,
    left: 130,
    position: 'absolute',
    top: 47,
    width: 14
  },
  cutTrail: {
    height: TRAIL,
    left: 38,
    position: 'absolute',
    top: 51,
    width: 96
  },
  cutterTrail: {
    height: 40,
    left: 75,
    position: 'absolute',
    top: 64,
    width: TRAIL
  },
  ground: {
    borderRadius: 4,
    height: 44,
    left: 20,
    opacity: 0.45,
    position: 'absolute',
    top: 52,
    width: 52
  },
  head: {
    borderRadius: 7,
    height: 14,
    left: 117,
    position: 'absolute',
    top: 66,
    width: 14
  },
  stage: {
    height: 108,
    width: 156
  },
  trailAcross: {
    height: TRAIL,
    left: 60,
    position: 'absolute',
    top: 14,
    width: 67
  },
  trailDown: {
    height: 54,
    left: 121,
    position: 'absolute',
    top: 14,
    width: TRAIL
  },
  trailUp: {
    height: 44,
    left: 60,
    position: 'absolute',
    top: 14,
    width: TRAIL
  }
})
