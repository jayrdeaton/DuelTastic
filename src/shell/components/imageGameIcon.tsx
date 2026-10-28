import type { ComponentType } from 'react'
import { Image, type ImageSourcePropType } from 'react-native'

import type { GameIconProps } from '@/shell/types'

// A game icon drawn as a light and dark pair of pictures (opaque squares, the art drawn as an app
// icon) rather than in the seats' colors: GameDefinition.icon for a game whose art is a picture.
// Home clips it to the row's rounded icon square.
export function imageGameIcon(images: { light: ImageSourcePropType; dark: ImageSourcePropType }): ComponentType<GameIconProps> {
  return function ImageGameIcon({ size, dark }: GameIconProps) {
    return <Image source={dark ? images.dark : images.light} style={{ height: size, width: size }} accessibilityIgnoresInvertColors />
  }
}
