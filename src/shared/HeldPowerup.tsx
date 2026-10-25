import { StyleSheet, View } from 'react-native'
import { Icon } from 'react-native-paper'

// The held powerup's icon in a player's badge, or an empty slot, so the badge doesn't change size when
// one's picked up.
export function HeldPowerup({ icon }: { icon: string | null }) {
  return <View style={styles.slot}>{icon && <Icon source={icon} size={14} color='rgba(255,255,255,0.9)' />}</View>
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.3)', borderRadius: 10, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 }
})
