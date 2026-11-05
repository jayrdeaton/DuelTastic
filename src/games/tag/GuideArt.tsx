import { useAutoPaperTheme } from '@rific/auto-paper'
import { StyleSheet, View } from 'react-native'
import { Icon } from 'react-native-paper'

// Tag's picture for its How to Play cards: It (player 1, a little bigger, in the glow the board draws
// out to its reach, here a flat disc) closing in on the other rider beside a pillar. Plain Views, like LightCycles'
// own GuideArt, so it costs nothing to mount over Home. Colored from the live theme (primary = P1).
export function GuideTagChase() {
  const { colors } = useAutoPaperTheme()
  return (
    <View accessible accessibilityLabel='It chasing the other rider around a pillar' style={styles.stage}>
      <View style={[styles.pillar, { backgroundColor: colors.outline }]} />
      <View style={[styles.itGlow, { backgroundColor: colors.primary }]} />
      <View style={[styles.it, { backgroundColor: colors.primary }]} />
      <View style={styles.arrow}>
        <Icon source='arrow-right-thick' size={26} color={colors.primary} />
      </View>
      <View style={[styles.runner, { backgroundColor: colors.secondary }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  arrow: {
    left: 70,
    position: 'absolute',
    top: 59
  },
  it: {
    borderRadius: 6,
    height: 12,
    left: 32,
    position: 'absolute',
    top: 66,
    width: 12
  },
  itGlow: {
    borderRadius: 22,
    height: 44,
    left: 16,
    opacity: 0.3,
    position: 'absolute',
    top: 50,
    width: 44
  },
  pillar: {
    borderRadius: 3,
    height: 28,
    left: 64,
    opacity: 0.7,
    position: 'absolute',
    top: 18,
    width: 28
  },
  runner: {
    borderRadius: 5,
    height: 10,
    left: 120,
    position: 'absolute',
    top: 67,
    width: 10
  },
  stage: {
    height: 108,
    width: 156
  }
})
