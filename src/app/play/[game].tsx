import { PlayRoute } from '@tastic/shell'
import type { GenerateMetadataFunction } from 'expo-router/server'

import { games } from '@/pack'
import { gameMetadata, GamePageTitle } from '@/seo'

// The web build is a static export, so every game's play page is listed here.
export function generateStaticParams(): { game: string }[] {
  return games.map((g) => ({ game: g.id }))
}

// The game's own title, description and link preview (src/seo.tsx)
export const generateMetadata: GenerateMetadataFunction = (_request, { game }) => gameMetadata(game)

export default function Play() {
  return (
    <>
      <GamePageTitle />
      <PlayRoute />
    </>
  )
}
