import { useAutoPaperTheme } from '@rific/auto-paper'
import { StyleSheet, View } from 'react-native'
import { Icon } from 'react-native-paper'

// Tag's picture for its How to Play cards: It (player 1, bigger, with the ring the board draws
// around It) closing in on the other rider beside a pillar. Plain Views, like LightCycles' own
// GuideArt, so it costs nothing to mount over Home. Colored from the live theme (primary = P1).
export function GuideTagChase() {
  const { colors } = useAutoPaperTheme()
  return (
    <View accessible accessibilityLabel='It chasing the other rider around a pillar' style={styles.stage}>
      <View style={[styles.pillar, { backgroundColor: colors.outline }]} />
      <View style={[styles.itRing, { borderColor: colors.primary }]} />
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
    left: 60,
    position: 'absolute',
    top: 59
  },
  it: {
    borderRadius: 10,
    height: 20,
    left: 28,
    position: 'absolute',
    top: 62,
    width: 20
  },
  itRing: {
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    left: 22,
    position: 'absolute',
    top: 56,
    width: 32
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
    borderRadius: 7,
    height: 14,
    left: 118,
    position: 'absolute',
    top: 65,
    width: 14
  },
  stage: {
    height: 108,
    width: 156
  }
})
